"""
Module 5: Multi-GPU Waste-Heat Scaling & Thermal Simulation Model for CondensAI.

Physics-based mathematical simulation of N independent GPUs feeding a shared primary coolant circuit:
- Independent thermal states for each GPU (junction temperature, heat generation, dissipation).
- Heterogeneous or homogeneous GPU configurations (custom power, R_th, C_th, initial temps).
- Aggregate heat generation Q_gen,total and aggregate coolant transfer Q_coolant,total.
- Shared primary coolant loop coupled to counterflow heat exchanger (Module 2).
- Secondary thermal storage reservoir and coupled AGMD desalination (Modules 3 & 4).
- Full First-Law energy conservation accounting:
    E_generated,total = sum(Delta E_GPU,i) + Delta E_primary + Delta E_secondary + E_AGMD + E_ambient_loss
- Strict backward compatibility: 1-GPU multi-GPU simulation produces identical results to single-GPU circulation model.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Any, List, Optional

from backend.models.agmd_model import AGMDModel, AGMDParameters
from backend.models.gpu_model import GPUModel, GPUParameters
from backend.models.heat_exchanger_model import HeatExchangerModel, HeatExchangerParameters


@dataclass(frozen=True)
class GPUConfig:
    """Configuration parameters for an individual GPU in the multi-GPU array."""

    gpu_id: str = "GPU-1"
    power_w: float = 350.0
    heat_conversion_fraction: float = 0.95
    initial_temp_c: float = 35.0
    thermal_resistance_k_per_w: float = 0.12
    thermal_capacitance_j_per_k: float = 250.0
    max_temp_c: Optional[float] = None

    def __post_init__(self) -> None:
        """Validate GPU parameters."""
        if not self.gpu_id:
            raise ValueError("GPU ID must be a non-empty string.")
        if self.power_w < 0.0 or not math.isfinite(self.power_w):
            raise ValueError(f"GPU power must be non-negative and finite, received: {self.power_w} W")
        if not (0.0 <= self.heat_conversion_fraction <= 1.0):
            raise ValueError(
                f"Heat conversion fraction must be between 0.0 and 1.0, received: {self.heat_conversion_fraction}"
            )
        if self.thermal_resistance_k_per_w <= 0.0 or not math.isfinite(self.thermal_resistance_k_per_w):
            raise ValueError(
                f"Thermal resistance must be strictly positive, received: {self.thermal_resistance_k_per_w} K/W"
            )
        if self.thermal_capacitance_j_per_k <= 0.0 or not math.isfinite(self.thermal_capacitance_j_per_k):
            raise ValueError(
                f"Thermal capacitance must be strictly positive, received: {self.thermal_capacitance_j_per_k} J/K"
            )
        if not math.isfinite(self.initial_temp_c):
            raise ValueError(f"Initial temperature must be finite, received: {self.initial_temp_c} °C")
        if self.max_temp_c is not None:
            if not math.isfinite(self.max_temp_c) or self.max_temp_c <= self.initial_temp_c:
                raise ValueError(
                    f"Max operating temperature must be finite and > initial temp, received: {self.max_temp_c} °C"
                )


@dataclass(frozen=True)
class GPUState:
    """Dynamic thermodynamic state of an individual GPU at a simulation step."""

    gpu_id: str
    power_w: float
    current_temp_c: float
    heat_generated_w: float
    heat_to_coolant_w: float
    net_heat_w: float
    stored_energy_j: float
    status: str = "nominal"

    def to_dict(self) -> dict[str, Any]:
        """Convert state to dictionary."""
        return asdict(self)


@dataclass(frozen=True)
class MultiGPUParameters:
    """System-wide configuration parameters for multi-GPU simulation."""

    # GPU Array
    gpus: List[GPUConfig] = field(default_factory=lambda: [GPUConfig()])

    # Primary Circuit
    primary_coolant_mass_kg: float = 2.0
    primary_mass_flow_kg_s: float = 0.05
    primary_initial_temp_c: float = 30.0
    primary_specific_heat_j_kg_k: float = 4184.0
    primary_heat_loss_ua_w_k: float = 2.0

    # Heat Exchanger
    exchanger_ua_w_k: float = 150.0

    # Secondary Circuit
    secondary_water_mass_kg: float = 20.0
    secondary_mass_flow_kg_s: float = 0.02
    secondary_initial_temp_c: float = 25.0
    secondary_specific_heat_j_kg_k: float = 4184.0
    secondary_heat_loss_ua_w_k: float = 5.0

    # System & AGMD Load
    ambient_temp_c: float = 25.0
    agmd_heat_demand_w: float = 0.0
    min_secondary_temp_c: float = 20.0
    time_step_s: float = 1.0
    simulation_duration_s: float = 60.0

    # Module 4: Coupled AGMD
    enable_agmd: bool = False
    agmd_membrane_pore_diameter_m: float = 0.22e-6
    agmd_membrane_thickness_m: float = 100.0e-6
    agmd_membrane_porosity: float = 0.70
    agmd_membrane_tortuosity: float = 2.0
    agmd_active_length_m: float = 0.04
    agmd_active_width_m: float = 0.04
    agmd_air_gap_thickness_m: float = 0.003
    agmd_initial_salinity_g_l: float = 35.0
    agmd_initial_feed_mass_kg: float = 10.0
    agmd_cold_plate_temp_c: float = 25.0

    def __post_init__(self) -> None:
        """Validate multi-GPU system parameters."""
        if not self.gpus:
            raise ValueError("At least one GPU configuration must be provided.")

        gpu_ids = [g.gpu_id for g in self.gpus]
        if len(gpu_ids) != len(set(gpu_ids)):
            raise ValueError(f"GPU IDs must be unique across the array, found duplicates: {gpu_ids}")

        if self.primary_coolant_mass_kg <= 0.0:
            raise ValueError("Primary coolant mass must be strictly positive.")
        if self.primary_mass_flow_kg_s <= 0.0:
            raise ValueError("Primary mass flow must be strictly positive.")
        if self.exchanger_ua_w_k <= 0.0:
            raise ValueError("Exchanger UA must be strictly positive.")
        if self.secondary_water_mass_kg <= 0.0:
            raise ValueError("Secondary water mass must be strictly positive.")
        if self.secondary_mass_flow_kg_s <= 0.0:
            raise ValueError("Secondary mass flow must be strictly positive.")
        if not (0.0 < self.time_step_s <= 5.0):
            raise ValueError(f"Time step must be in range (0, 5.0] seconds, received: {self.time_step_s}")
        if self.simulation_duration_s <= 0.0:
            raise ValueError("Simulation duration must be strictly positive.")


@dataclass(frozen=True)
class MultiGPUSimulationStep:
    """Discrete time-series snapshot for multi-GPU simulation."""

    time_s: float
    gpu_states: List[GPUState]
    aggregate_heat_generated_w: float
    aggregate_heat_to_coolant_w: float
    primary_coolant_temp_c: float
    primary_heat_loss_w: float
    hx_heat_transfer_w: float
    hx_effectiveness: float
    hx_ntu: float
    hx_primary_outlet_temp_c: float
    hx_secondary_outlet_temp_c: float
    secondary_reservoir_temp_c: float
    secondary_stored_energy_j: float
    secondary_heat_loss_w: float
    heat_to_agmd_w: float
    unmet_agmd_demand_w: float
    cumulative_heat_generated_j: float
    cumulative_heat_to_coolant_j: float
    cumulative_heat_recovered_hx_j: float
    cumulative_heat_to_agmd_j: float
    cumulative_ambient_loss_j: float
    energy_balance_residual_j: float

    # Coupled AGMD Permeate Metrics
    freshwater_production_rate_kg_s: Optional[float] = None
    freshwater_production_rate_l_h: Optional[float] = None
    cumulative_freshwater_mass_kg: Optional[float] = None
    cumulative_freshwater_volume_l: Optional[float] = None
    feed_salinity_g_l: Optional[float] = None
    agmd_hot_membrane_temp_c: Optional[float] = None
    agmd_cold_condensing_temp_c: Optional[float] = None
    agmd_vapor_flux_kg_m2_s: Optional[float] = None


class MultiGPUModel:
    """
    Physical simulation model for N GPUs sharing a common primary cooling loop.
    """

    def __init__(self, params: MultiGPUParameters | None = None) -> None:
        """Initialize multi-GPU digital twin model."""
        self.params: MultiGPUParameters = params if params is not None else MultiGPUParameters()

        # Instantiate independent GPU models
        self.gpu_models: List[GPUModel] = []
        for g_cfg in self.params.gpus:
            g_params = GPUParameters(
                gpu_power_w=g_cfg.power_w,
                initial_gpu_temp_c=g_cfg.initial_temp_c,
                coolant_temp_c=self.params.primary_initial_temp_c,
                heat_conversion_fraction=g_cfg.heat_conversion_fraction,
                thermal_resistance_k_per_w=g_cfg.thermal_resistance_k_per_w,
                thermal_capacitance_j_per_k=g_cfg.thermal_capacitance_j_per_k,
                time_step_s=self.params.time_step_s,
                duration_s=self.params.simulation_duration_s,
            )
            self.gpu_models.append(GPUModel(g_params))

        # Instantiate shared heat exchanger
        hx_params = HeatExchangerParameters(
            primary_inlet_temp_c=self.params.primary_initial_temp_c,
            secondary_inlet_temp_c=self.params.secondary_initial_temp_c,
            primary_mass_flow_kg_s=self.params.primary_mass_flow_kg_s,
            secondary_mass_flow_kg_s=self.params.secondary_mass_flow_kg_s,
            ua_w_k=self.params.exchanger_ua_w_k,
            specific_heat_j_kg_k=self.params.secondary_specific_heat_j_kg_k,
            time_step_s=self.params.time_step_s,
            simulation_duration_s=self.params.simulation_duration_s,
        )
        self.hx_model: HeatExchangerModel = HeatExchangerModel(hx_params)

        # Instantiate coupled AGMD model if enabled
        if self.params.enable_agmd:
            agmd_params = AGMDParameters(
                membrane_pore_diameter_m=self.params.agmd_membrane_pore_diameter_m,
                membrane_thickness_m=self.params.agmd_membrane_thickness_m,
                membrane_porosity=self.params.agmd_membrane_porosity,
                membrane_tortuosity=self.params.agmd_membrane_tortuosity,
                active_length_m=self.params.agmd_active_length_m,
                active_width_m=self.params.agmd_active_width_m,
                air_gap_thickness_m=self.params.agmd_air_gap_thickness_m,
                initial_feed_temp_c=self.params.secondary_initial_temp_c,
                initial_salinity_g_l=self.params.agmd_initial_salinity_g_l,
                initial_feed_mass_kg=self.params.agmd_initial_feed_mass_kg,
                cold_plate_temp_c=self.params.agmd_cold_plate_temp_c,
                time_step_s=self.params.time_step_s,
                simulation_duration_s=self.params.simulation_duration_s,
            )
            self.agmd_model: Optional[AGMDModel] = AGMDModel(agmd_params)
        else:
            self.agmd_model = None

        # State tracking
        self._current_primary_temp_c: float = self.params.primary_initial_temp_c
        self._current_secondary_temp_c: float = self.params.secondary_initial_temp_c
        self._elapsed_time_s: float = 0.0

        # Energy accumulators (Joules)
        self._cumulative_heat_generated_j: float = 0.0
        self._cumulative_heat_to_coolant_j: float = 0.0
        self._cumulative_heat_recovered_hx_j: float = 0.0
        self._cumulative_heat_to_agmd_j: float = 0.0
        self._cumulative_ambient_loss_j: float = 0.0

    @property
    def current_primary_temp_c(self) -> float:
        """Current shared primary coolant temperature in °C."""
        return self._current_primary_temp_c

    @property
    def current_secondary_temp_c(self) -> float:
        """Current secondary reservoir temperature in °C."""
        return self._current_secondary_temp_c

    @property
    def elapsed_time_s(self) -> float:
        """Total elapsed simulation time in seconds."""
        return self._elapsed_time_s

    @property
    def primary_thermal_capacitance_j_per_k(self) -> float:
        """Primary coolant lumped thermal heat capacity C_thermal,p = m_p * Cp,p in J/K."""
        return self.params.primary_coolant_mass_kg * self.params.primary_specific_heat_j_kg_k

    @property
    def secondary_thermal_capacitance_j_per_k(self) -> float:
        """Secondary water reservoir lumped thermal heat capacity C_thermal,s = m_s * Cp,s in J/K."""
        return self.params.secondary_water_mass_kg * self.params.secondary_specific_heat_j_kg_k

    def calculate_primary_heat_loss(self, primary_temp_c: float) -> float:
        """Calculate primary circuit ambient heat loss in Watts."""
        return self.params.primary_heat_loss_ua_w_k * (primary_temp_c - self.params.ambient_temp_c)

    def calculate_secondary_heat_loss(self, secondary_temp_c: float) -> float:
        """Calculate secondary reservoir ambient heat loss in Watts."""
        return self.params.secondary_heat_loss_ua_w_k * (secondary_temp_c - self.params.ambient_temp_c)

    def step(self, dt: float | None = None) -> MultiGPUSimulationStep:
        """
        Advance the multi-GPU coupled simulation by one time step dt.
        """
        step_dt = dt if dt is not None else self.params.time_step_s
        if step_dt <= 0.0 or not math.isfinite(step_dt):
            raise ValueError(f"Time step must be positive and finite, received: {step_dt}")
        if step_dt > 5.0:
            raise ValueError(f"Time step must be <= 5.0 s for numerical precision, received: {step_dt} s")

        # 1. State at start of time step (explicit Euler base)
        t_p_old = self._current_primary_temp_c
        t_s_old = self._current_secondary_temp_c
        c_thermal_p = self.primary_thermal_capacitance_j_per_k
        c_thermal_s = self.secondary_thermal_capacitance_j_per_k

        # 2. Step each independent GPU and calculate aggregate fluxes
        gpu_states: List[GPUState] = []
        q_gen_total = 0.0
        q_coolant_total = 0.0

        for idx, (g_cfg, g_model) in enumerate(zip(self.params.gpus, self.gpu_models)):
            t_gpu_old = g_model.current_temp_c
            q_gen_i = g_model.calculate_heat_generated()
            q_cool_i = g_model.calculate_heat_to_coolant(t_gpu_old, t_p_old)

            # Step individual GPU with current shared coolant temperature
            g_step = g_model.step(step_dt, coolant_temp_c=t_p_old)

            q_gen_total += q_gen_i
            q_coolant_total += q_cool_i

            # Check thermal status
            status = "nominal"
            if g_cfg.max_temp_c is not None:
                if g_step.gpu_temp_c >= g_cfg.max_temp_c:
                    status = "warning"

            stored_e_i = g_cfg.thermal_capacitance_j_per_k * (g_step.gpu_temp_c - g_cfg.initial_temp_c)

            gpu_states.append(
                GPUState(
                    gpu_id=g_cfg.gpu_id,
                    power_w=g_cfg.power_w,
                    current_temp_c=g_step.gpu_temp_c,
                    heat_generated_w=q_gen_i,
                    heat_to_coolant_w=q_cool_i,
                    net_heat_w=g_step.net_heat_w,
                    stored_energy_j=stored_e_i,
                    status=status,
                )
            )

        # 3. Heat Exchanger step
        (
            _,
            _,
            _,
            _,
            _,
            _,
            hx_eff,
            q_max,
            q_hx,
            t_h_out,
            t_c_out,
        ) = self.hx_model.calculate_thermal_performance(
            primary_inlet_temp_c=t_p_old,
            secondary_inlet_temp_c=t_s_old,
        )
        hx_step = self.hx_model.step(
            step_dt,
            primary_inlet_temp_c=t_p_old,
            secondary_inlet_temp_c=t_s_old,
        )

        # 4. Ambient Heat Losses (W)
        q_loss_p = self.calculate_primary_heat_loss(t_p_old)
        q_loss_s = self.calculate_secondary_heat_loss(t_s_old)
        total_q_loss = q_loss_p + q_loss_s

        # 5. AGMD Thermal Supply and Throttling
        if self.agmd_model is not None:
            t_min = self.params.min_secondary_temp_c
            available_power_w = max(
                0.0,
                ((t_s_old - t_min) * c_thermal_s / step_dt) + q_hx - q_loss_s,
            )
            agmd_step_res = self.agmd_model.step(
                dt=step_dt,
                feed_temp_c=t_s_old,
                cold_plate_temp_c=self.params.agmd_cold_plate_temp_c,
                available_thermal_power_w=available_power_w,
            )
            q_agmd = agmd_step_res.actual_heat_supplied_w
            q_unmet = agmd_step_res.unmet_heat_demand_w
            fw_rate_kg_s = agmd_step_res.freshwater_production_rate_kg_s
            fw_rate_l_h = agmd_step_res.freshwater_production_rate_l_h
            cum_fw_kg = agmd_step_res.cumulative_freshwater_mass_kg
            cum_fw_l = agmd_step_res.cumulative_freshwater_volume_l
            feed_salinity = agmd_step_res.feed_salinity_g_l
            agmd_t_mh = agmd_step_res.hot_membrane_temp_c
            agmd_t_mc = agmd_step_res.cold_condensing_temp_c
            agmd_j_flux = agmd_step_res.vapor_flux_kg_m2_s
        else:
            requested = self.params.agmd_heat_demand_w
            if requested > 0.0:
                t_min = self.params.min_secondary_temp_c
                available_power_w = max(
                    0.0,
                    ((t_s_old - t_min) * c_thermal_s / step_dt) + q_hx - q_loss_s,
                )
                q_agmd = min(requested, available_power_w)
                q_unmet = max(0.0, requested - q_agmd)
            else:
                q_agmd = 0.0
                q_unmet = 0.0

            fw_rate_kg_s = None
            fw_rate_l_h = None
            cum_fw_kg = None
            cum_fw_l = None
            feed_salinity = None
            agmd_t_mh = None
            agmd_t_mc = None
            agmd_j_flux = None

        # 6. Shared Primary Coolant Update (Euler)
        dt_p_rate = (q_coolant_total - q_hx - q_loss_p) / c_thermal_p
        t_p_new = t_p_old + (dt_p_rate * step_dt)

        if not math.isfinite(t_p_new):
            raise FloatingPointError(f"Primary coolant temperature became non-finite: {t_p_new}")

        # 7. Secondary Reservoir Update (Euler)
        dt_s_rate = (q_hx - q_agmd - q_loss_s) / c_thermal_s
        t_s_new = t_s_old + (dt_s_rate * step_dt)

        if not math.isfinite(t_s_new):
            raise FloatingPointError(f"Secondary reservoir temperature became non-finite: {t_s_new}")

        # Update dynamic temperatures
        self._current_primary_temp_c = t_p_new
        self._current_secondary_temp_c = t_s_new
        self._elapsed_time_s += step_dt

        # 8. Cumulative Energy Integration (Joules)
        self._cumulative_heat_generated_j += q_gen_total * step_dt
        self._cumulative_heat_to_coolant_j += q_coolant_total * step_dt
        self._cumulative_heat_recovered_hx_j += q_hx * step_dt
        self._cumulative_heat_to_agmd_j += q_agmd * step_dt
        self._cumulative_ambient_loss_j += total_q_loss * step_dt

        # First-Law Energy Conservation Check:
        # E_generated = sum(Delta E_GPU,i) + Delta E_primary + Delta E_secondary + E_AGMD + E_ambient_loss
        total_delta_e_gpu = sum(
            g_cfg.thermal_capacitance_j_per_k * (g_model.current_temp_c - g_cfg.initial_temp_c)
            for g_cfg, g_model in zip(self.params.gpus, self.gpu_models)
        )
        delta_e_primary = c_thermal_p * (self._current_primary_temp_c - self.params.primary_initial_temp_c)
        delta_e_secondary = c_thermal_s * (self._current_secondary_temp_c - self.params.secondary_initial_temp_c)

        total_accounted_energy_j = (
            total_delta_e_gpu
            + delta_e_primary
            + delta_e_secondary
            + self._cumulative_heat_to_agmd_j
            + self._cumulative_ambient_loss_j
        )
        energy_residual_j = self._cumulative_heat_generated_j - total_accounted_energy_j

        secondary_stored_energy_j = c_thermal_s * self._current_secondary_temp_c

        return MultiGPUSimulationStep(
            time_s=self._elapsed_time_s,
            gpu_states=gpu_states,
            aggregate_heat_generated_w=q_gen_total,
            aggregate_heat_to_coolant_w=q_coolant_total,
            primary_coolant_temp_c=t_p_new,
            primary_heat_loss_w=q_loss_p,
            hx_heat_transfer_w=q_hx,
            hx_effectiveness=hx_step.effectiveness,
            hx_ntu=hx_step.ntu,
            hx_primary_outlet_temp_c=hx_step.primary_outlet_temp_c,
            hx_secondary_outlet_temp_c=hx_step.secondary_outlet_temp_c,
            secondary_reservoir_temp_c=t_s_new,
            secondary_stored_energy_j=secondary_stored_energy_j,
            secondary_heat_loss_w=q_loss_s,
            heat_to_agmd_w=q_agmd,
            unmet_agmd_demand_w=q_unmet,
            cumulative_heat_generated_j=self._cumulative_heat_generated_j,
            cumulative_heat_to_coolant_j=self._cumulative_heat_to_coolant_j,
            cumulative_heat_recovered_hx_j=self._cumulative_heat_recovered_hx_j,
            cumulative_heat_to_agmd_j=self._cumulative_heat_to_agmd_j,
            cumulative_ambient_loss_j=self._cumulative_ambient_loss_j,
            energy_balance_residual_j=energy_residual_j,
            freshwater_production_rate_kg_s=fw_rate_kg_s,
            freshwater_production_rate_l_h=fw_rate_l_h,
            cumulative_freshwater_mass_kg=cum_fw_kg,
            cumulative_freshwater_volume_l=cum_fw_l,
            feed_salinity_g_l=feed_salinity,
            agmd_hot_membrane_temp_c=agmd_t_mh,
            agmd_cold_condensing_temp_c=agmd_t_mc,
            agmd_vapor_flux_kg_m2_s=agmd_j_flux,
        )

    def reset(self) -> None:
        """Reset multi-GPU system to initial conditions."""
        for g in self.gpu_models:
            g.reset()
        self.hx_model.reset()
        if self.agmd_model is not None:
            self.agmd_model.reset()
        self._current_primary_temp_c = self.params.primary_initial_temp_c
        self._current_secondary_temp_c = self.params.secondary_initial_temp_c
        self._elapsed_time_s = 0.0
        self._cumulative_heat_generated_j = 0.0
        self._cumulative_heat_to_coolant_j = 0.0
        self._cumulative_heat_recovered_hx_j = 0.0
        self._cumulative_heat_to_agmd_j = 0.0
        self._cumulative_ambient_loss_j = 0.0
