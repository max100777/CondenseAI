"""
Module 3: Hot-Water Circulation, Thermal Storage & System Integration Model.

Integrates:
- Module 1: GPU Heat Generation Model (lumped thermal capacitance)
- Module 2: Heat Recovery Exchanger Model (Effectiveness-NTU counterflow)
- Primary Coolant Loop Inventory (well-mixed primary thermal storage)
- Secondary Water Reservoir (well-mixed secondary thermal storage)
- Downstream AGMD Thermal Demand Interface
- Ambient Heat Losses & First-Law Thermodynamic Energy Conservation
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

from backend.models.gpu_model import GPUModel, GPUParameters, GPUSimulationStep
from backend.models.heat_exchanger_model import (
    HeatExchangerModel,
    HeatExchangerParameters,
    HeatExchangerStep,
)


@dataclass(frozen=True)
class CirculationParameters:
    """
    Configuration parameters for integrated system thermal simulation.

    Physical Units:
        GPU:
            gpu_power_w: Watts (W) - GPU electrical power consumption.
            heat_conversion_fraction: Dimensionless [0, 1] - Electrical-to-thermal fraction.
            initial_gpu_temp_c: °C - Initial GPU junction/die temperature.
            thermal_resistance_k_per_w: K/W - Effective GPU-to-coolant thermal resistance.
            thermal_capacitance_j_per_k: J/K - Lumped heat capacity of GPU package.

        Primary Circuit (GPU Cooling Loop):
            primary_coolant_mass_kg: kg - Fluid mass inventory in primary loop.
            primary_mass_flow_kg_s: kg/s - Circulation mass flow rate of primary coolant.
            primary_initial_temp_c: °C - Initial primary coolant inventory temperature.
            primary_specific_heat_j_kg_k: J/(kg·K) - Specific heat capacity of primary coolant.
            primary_heat_loss_ua_w_k: W/K - Heat loss conductance to ambient (UA).

        Heat Exchanger:
            exchanger_ua_w_k: W/K - Counterflow heat exchanger UA conductance.

        Secondary Circuit (AGMD Feed Loop & Storage Reservoir):
            secondary_water_mass_kg: kg - Water mass inventory in secondary reservoir.
            secondary_mass_flow_kg_s: kg/s - Secondary loop circulation mass flow rate.
            secondary_initial_temp_c: °C - Initial secondary reservoir water temperature.
            secondary_specific_heat_j_kg_k: J/(kg·K) - Specific heat capacity of secondary water.
            secondary_heat_loss_ua_w_k: W/K - Reservoir and pipe heat loss conductance to ambient (UA).

        System & Downstream Load:
            ambient_temp_c: °C - Ambient air/surroundings temperature.
            agmd_heat_demand_w: W - Requested thermal heat demand from AGMD desalination unit.
            min_secondary_temp_c: °C - Minimum allowable secondary reservoir temperature.
            time_step_s: s - Numerical integration step size (0 < dt <= 5.0 s).
            simulation_duration_s: s - Total simulation duration.
    """

    # GPU Parameters
    gpu_power_w: float = 350.0
    heat_conversion_fraction: float = 0.95
    initial_gpu_temp_c: float = 35.0
    thermal_resistance_k_per_w: float = 0.12
    thermal_capacitance_j_per_k: float = 250.0

    # Primary Circuit Parameters
    primary_coolant_mass_kg: float = 2.0
    primary_mass_flow_kg_s: float = 0.05
    primary_initial_temp_c: float = 30.0
    primary_specific_heat_j_kg_k: float = 4184.0
    primary_heat_loss_ua_w_k: float = 2.0

    # Heat Exchanger Parameters
    exchanger_ua_w_k: float = 150.0

    # Secondary Circuit Parameters
    secondary_water_mass_kg: float = 20.0
    secondary_mass_flow_kg_s: float = 0.02
    secondary_initial_temp_c: float = 25.0
    secondary_specific_heat_j_kg_k: float = 4184.0
    secondary_heat_loss_ua_w_k: float = 5.0

    # System & AGMD Load Parameters
    ambient_temp_c: float = 25.0
    agmd_heat_demand_w: float = 0.0
    min_secondary_temp_c: float = 20.0
    time_step_s: float = 1.0
    simulation_duration_s: float = 60.0

    # Module 4: Coupled AGMD Desalination Model
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
        """Validate physical parameters upon construction."""
        for field_name, value in asdict(self).items():
            if not math.isfinite(value):
                raise ValueError(f"Parameter '{field_name}' must be a finite number, received: {value}")

        if self.gpu_power_w < 0.0:
            raise ValueError(f"GPU power must be non-negative, received: {self.gpu_power_w} W")

        if not (0.0 <= self.heat_conversion_fraction <= 1.0):
            raise ValueError(
                f"Heat conversion fraction must be between 0.0 and 1.0, received: {self.heat_conversion_fraction}"
            )

        if self.thermal_resistance_k_per_w <= 0.0:
            raise ValueError(
                f"GPU thermal resistance must be strictly positive, received: {self.thermal_resistance_k_per_w} K/W"
            )

        if self.thermal_capacitance_j_per_k <= 0.0:
            raise ValueError(
                f"GPU thermal capacitance must be strictly positive, received: {self.thermal_capacitance_j_per_k} J/K"
            )

        # Primary Circuit
        if self.primary_coolant_mass_kg <= 0.0:
            raise ValueError(
                f"Primary coolant mass must be strictly positive, received: {self.primary_coolant_mass_kg} kg"
            )

        if self.primary_mass_flow_kg_s <= 0.0:
            raise ValueError(
                f"Primary mass flow rate must be strictly positive, received: {self.primary_mass_flow_kg_s} kg/s"
            )

        if self.primary_specific_heat_j_kg_k <= 0.0:
            raise ValueError(
                f"Primary specific heat must be strictly positive, received: {self.primary_specific_heat_j_kg_k} J/(kg·K)"
            )

        if self.primary_heat_loss_ua_w_k < 0.0:
            raise ValueError(
                f"Primary heat loss UA must be non-negative, received: {self.primary_heat_loss_ua_w_k} W/K"
            )

        # Heat Exchanger
        if self.exchanger_ua_w_k <= 0.0:
            raise ValueError(f"Exchanger UA must be strictly positive, received: {self.exchanger_ua_w_k} W/K")

        # Secondary Circuit
        if self.secondary_water_mass_kg <= 0.0:
            raise ValueError(
                f"Secondary water mass must be strictly positive, received: {self.secondary_water_mass_kg} kg"
            )

        if self.secondary_mass_flow_kg_s <= 0.0:
            raise ValueError(
                f"Secondary mass flow rate must be strictly positive, received: {self.secondary_mass_flow_kg_s} kg/s"
            )

        if self.secondary_specific_heat_j_kg_k <= 0.0:
            raise ValueError(
                f"Secondary specific heat must be strictly positive, received: {self.secondary_specific_heat_j_kg_k} J/(kg·K)"
            )

        if self.secondary_heat_loss_ua_w_k < 0.0:
            raise ValueError(
                f"Secondary heat loss UA must be non-negative, received: {self.secondary_heat_loss_ua_w_k} W/K"
            )

        # Downstream & Operational bounds
        if self.agmd_heat_demand_w < 0.0:
            raise ValueError(f"AGMD heat demand must be non-negative, received: {self.agmd_heat_demand_w} W")

        if not (0.0 < self.time_step_s <= 5.0):
            raise ValueError(
                f"Time step must be strictly positive and <= 5.0 s for numerical precision, received: {self.time_step_s} s"
            )

        if self.simulation_duration_s <= 0.0:
            raise ValueError(f"Simulation duration must be strictly positive, received: {self.simulation_duration_s} s")

        for temp_name in [
            "initial_gpu_temp_c",
            "primary_initial_temp_c",
            "secondary_initial_temp_c",
            "ambient_temp_c",
            "min_secondary_temp_c",
        ]:
            if getattr(self, temp_name) < -273.15:
                raise ValueError(f"{temp_name} cannot be below absolute zero (-273.15 °C)")


@dataclass
class SystemSimulationStep:
    """Structured record containing instantaneous system metrics at a simulation timestep."""

    time_s: float

    # GPU Subsystem (Module 1)
    gpu_temp_c: float
    heat_generated_w: float
    heat_to_coolant_w: float
    net_heat_w: float

    # Primary Circuit (Module 3)
    primary_coolant_temp_c: float
    primary_heat_capacity_j_per_k: float
    heat_from_gpu_w: float
    heat_to_hx_w: float
    primary_heat_loss_w: float

    # Heat Exchanger Subsystem (Module 2)
    hx_heat_transfer_w: float
    hx_effectiveness: float
    hx_ntu: float
    hx_primary_outlet_temp_c: float
    hx_secondary_outlet_temp_c: float

    # Secondary Circuit & Reservoir (Module 3)
    secondary_reservoir_temp_c: float
    secondary_stored_energy_j: float
    heat_received_hx_w: float
    heat_to_agmd_w: float
    unmet_agmd_demand_w: float
    secondary_heat_loss_w: float

    # System-Wide Energy Accounting (Joules)
    cumulative_heat_generated_j: float
    cumulative_heat_to_coolant_j: float
    cumulative_heat_recovered_hx_j: float
    cumulative_heat_to_agmd_j: float
    cumulative_ambient_loss_j: float
    energy_balance_residual_j: float

    # Coupled AGMD Desalination Metrics (Module 4)
    freshwater_production_rate_kg_s: float | None = None
    freshwater_production_rate_l_h: float | None = None
    cumulative_freshwater_mass_kg: float | None = None
    cumulative_freshwater_volume_l: float | None = None
    feed_salinity_g_l: float | None = None
    agmd_hot_membrane_temp_c: float | None = None
    agmd_cold_condensing_temp_c: float | None = None
    agmd_vapor_flux_kg_m2_s: float | None = None

    def to_dict(self) -> dict[str, float]:
        """Convert step record to dictionary format."""
        record: dict[str, float] = {
            "time_s": self.time_s,
            "gpu_temp_c": self.gpu_temp_c,
            "heat_generated_w": self.heat_generated_w,
            "heat_to_coolant_w": self.heat_to_coolant_w,
            "net_heat_w": self.net_heat_w,
            "primary_coolant_temp_c": self.primary_coolant_temp_c,
            "primary_heat_capacity_j_per_k": self.primary_heat_capacity_j_per_k,
            "heat_from_gpu_w": self.heat_from_gpu_w,
            "heat_to_hx_w": self.heat_to_hx_w,
            "primary_heat_loss_w": self.primary_heat_loss_w,
            "hx_heat_transfer_w": self.hx_heat_transfer_w,
            "hx_effectiveness": self.hx_effectiveness,
            "hx_ntu": self.hx_ntu,
            "hx_primary_outlet_temp_c": self.hx_primary_outlet_temp_c,
            "hx_secondary_outlet_temp_c": self.hx_secondary_outlet_temp_c,
            "secondary_reservoir_temp_c": self.secondary_reservoir_temp_c,
            "secondary_stored_energy_j": self.secondary_stored_energy_j,
            "heat_received_hx_w": self.heat_received_hx_w,
            "heat_to_agmd_w": self.heat_to_agmd_w,
            "unmet_agmd_demand_w": self.unmet_agmd_demand_w,
            "secondary_heat_loss_w": self.secondary_heat_loss_w,
            "cumulative_heat_generated_j": self.cumulative_heat_generated_j,
            "cumulative_heat_to_coolant_j": self.cumulative_heat_to_coolant_j,
            "cumulative_heat_recovered_hx_j": self.cumulative_heat_recovered_hx_j,
            "cumulative_heat_to_agmd_j": self.cumulative_heat_to_agmd_j,
            "cumulative_ambient_loss_j": self.cumulative_ambient_loss_j,
            "energy_balance_residual_j": self.energy_balance_residual_j,
        }
        if self.freshwater_production_rate_kg_s is not None:
            record["freshwater_production_rate_kg_s"] = self.freshwater_production_rate_kg_s
            record["freshwater_production_rate_l_h"] = self.freshwater_production_rate_l_h
            record["cumulative_freshwater_mass_kg"] = self.cumulative_freshwater_mass_kg
            record["cumulative_freshwater_volume_l"] = self.cumulative_freshwater_volume_l
            record["feed_salinity_g_l"] = self.feed_salinity_g_l
            record["agmd_hot_membrane_temp_c"] = self.agmd_hot_membrane_temp_c
            record["agmd_cold_condensing_temp_c"] = self.agmd_cold_condensing_temp_c
            record["agmd_vapor_flux_kg_m2_s"] = self.agmd_vapor_flux_kg_m2_s
        return record


class CirculationModel:
    """
    Integrated dynamic thermal circulation model connecting:
    - Module 1 (GPU heat generation)
    - Module 2 (Counterflow heat exchanger)
    - Primary well-mixed coolant loop inventory
    - Secondary well-mixed storage reservoir
    - Ambient thermal dissipation
    - Downstream AGMD thermal demand load
    """

    def __init__(self, params: CirculationParameters | None = None) -> None:
        """
        Initialize the integrated circulation model.

        Args:
            params: Configuration parameters for all circuits and components.
        """
        self.params: CirculationParameters = params if params is not None else CirculationParameters()

        # Initialize sub-models reusing existing implementations
        gpu_init_params = GPUParameters(
            gpu_power_w=self.params.gpu_power_w,
            initial_gpu_temp_c=self.params.initial_gpu_temp_c,
            coolant_temp_c=self.params.primary_initial_temp_c,
            heat_conversion_fraction=self.params.heat_conversion_fraction,
            thermal_resistance_k_per_w=self.params.thermal_resistance_k_per_w,
            thermal_capacitance_j_per_k=self.params.thermal_capacitance_j_per_k,
            time_step_s=self.params.time_step_s,
            duration_s=self.params.simulation_duration_s,
        )
        self.gpu_model = GPUModel(gpu_init_params)

        hx_init_params = HeatExchangerParameters(
            primary_inlet_temp_c=self.params.primary_initial_temp_c,
            secondary_inlet_temp_c=self.params.secondary_initial_temp_c,
            primary_mass_flow_kg_s=self.params.primary_mass_flow_kg_s,
            secondary_mass_flow_kg_s=self.params.secondary_mass_flow_kg_s,
            ua_w_k=self.params.exchanger_ua_w_k,
            specific_heat_j_kg_k=self.params.secondary_specific_heat_j_kg_k,
            time_step_s=self.params.time_step_s,
            simulation_duration_s=self.params.simulation_duration_s,
        )
        self.hx_model = HeatExchangerModel(hx_init_params)

        # Coupled AGMD Desalination Model (Module 4)
        if self.params.enable_agmd:
            from backend.models.agmd_model import AGMDModel, AGMDParameters

            agmd_init_params = AGMDParameters(
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
            self.agmd_model: AGMDModel | None = AGMDModel(agmd_init_params)
        else:
            self.agmd_model = None

        # Dynamic state variables
        self._current_primary_temp_c: float = self.params.primary_initial_temp_c
        self._current_secondary_temp_c: float = self.params.secondary_initial_temp_c
        self._elapsed_time_s: float = 0.0

        # Cumulative energy integrals (Joules)
        self._cumulative_heat_generated_j: float = 0.0
        self._cumulative_heat_to_coolant_j: float = 0.0
        self._cumulative_heat_recovered_hx_j: float = 0.0
        self._cumulative_heat_to_agmd_j: float = 0.0
        self._cumulative_ambient_loss_j: float = 0.0

    @property
    def current_primary_temp_c(self) -> float:
        """Current temperature of the primary coolant inventory in °C."""
        return self._current_primary_primary_temp_c if hasattr(self, "_current_primary_primary_temp_c") else self._current_primary_temp_c

    @property
    def current_secondary_temp_c(self) -> float:
        """Current temperature of the secondary reservoir water in °C."""
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
        """
        Calculate primary circuit heat loss to ambient:
            Q_loss,p = UA_loss,p * (T_p - T_ambient) [W]

        Signed convention: positive means heat leaves circuit into surroundings.
        """
        return self.params.primary_heat_loss_ua_w_k * (primary_temp_c - self.params.ambient_temp_c)

    def calculate_secondary_heat_loss(self, secondary_temp_c: float) -> float:
        """
        Calculate secondary reservoir and pipe heat loss to ambient:
            Q_loss,s = UA_loss,s * (T_s - T_ambient) [W]

        Signed convention: positive means heat leaves reservoir into surroundings.
        """
        return self.params.secondary_heat_loss_ua_w_k * (secondary_temp_c - self.params.ambient_temp_c)

    def calculate_agmd_heat_supply(
        self,
        secondary_temp_c: float,
        q_hx: float,
        q_loss_s: float,
        step_dt: float,
    ) -> tuple[float, float]:
        """
        Calculate actual heat delivered to AGMD process and any unmet demand.

        Constraints:
            - Requested demand: agmd_heat_demand_w
            - Heat supply cannot force reservoir below min_secondary_temp_c.
            - Maximum extractable power over dt without violating min_secondary_temp_c:
              P_max = max(0, (m_s * Cp,s * (T_s - T_min) / dt) + q_hx - q_loss_s)
            - Q_agmd = min(requested, P_max)
            - Q_unmet = requested - Q_agmd

        Returns:
            Tuple of (q_agmd_supplied_w, q_agmd_unmet_w).
        """
        requested = self.params.agmd_heat_demand_w
        if requested <= 0.0:
            return 0.0, 0.0

        c_thermal_s = self.secondary_thermal_capacitance_j_per_k
        t_min = self.params.min_secondary_temp_c

        # Net thermal rate available above t_min
        available_power_w = ((secondary_temp_c - t_min) * c_thermal_s / step_dt) + q_hx - q_loss_s
        max_extractable_w = max(0.0, available_power_w)

        supplied_w = min(requested, max_extractable_w)
        unmet_w = max(0.0, requested - supplied_w)
        return supplied_w, unmet_w

    def step(self, dt: float | None = None) -> SystemSimulationStep:
        """
        Advance the integrated system simulation by one time step dt using forward Euler integration.

        Timestep Order:
            1. Read current states: T_GPU, T_p, T_s.
            2. Compute GPU heat dissipation using Module 1 with reference coolant T_p.
            3. Compute Exchanger heat transfer using Module 2 with T_h_in=T_p, T_c_in=T_s.
            4. Compute ambient heat losses for primary and secondary circuits.
            5. Compute downstream AGMD consumption and unmet demand.
            6. Update primary coolant inventory temperature:
               dT_p/dt = (Q_GPU - Q_HX - Q_loss,p) / (m_p * Cp,p)
            7. Update secondary water reservoir temperature:
               dT_s/dt = (Q_HX - Q_AGMD - Q_loss,s) / (m_s * Cp,s)
            8. Accumulate energy integrals and evaluate First-Law conservation residual.
        """
        step_dt = dt if dt is not None else self.params.time_step_s
        if step_dt <= 0.0 or not math.isfinite(step_dt):
            raise ValueError(f"Time step must be positive and finite, received: {step_dt}")
        if step_dt > 5.0:
            raise ValueError(f"Time step must be <= 5.0 s for numerical precision, received: {step_dt} s")

        # 1. State at start of time step (explicit Euler base)
        t_gpu_old = self.gpu_model.current_temp_c
        t_p_old = self._current_primary_temp_c
        t_s_old = self._current_secondary_temp_c
        c_thermal_p = self.primary_thermal_capacitance_j_per_k
        c_thermal_s = self.secondary_thermal_capacitance_j_per_k

        # 2. Module 1: Exact GPU Fluxes & Step with dynamic primary coolant temperature
        q_gen = self.gpu_model.calculate_heat_generated()
        q_gpu = self.gpu_model.calculate_heat_to_coolant(t_gpu_old, t_p_old)
        gpu_step = self.gpu_model.step(step_dt, coolant_temp_c=t_p_old)

        # 3. Module 2: Exact Heat Exchanger Fluxes & Step with dynamic inlets
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

        # 5. AGMD Thermal Demand & Supply (W)
        if self.agmd_model is not None:
            # Secondary reservoir thermal fluid directly powers AGMD hot feed channel
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
            q_agmd, q_unmet = self.calculate_agmd_heat_supply(t_s_old, q_hx, q_loss_s, step_dt)
            fw_rate_kg_s = None
            fw_rate_l_h = None
            cum_fw_kg = None
            cum_fw_l = None
            feed_salinity = None
            agmd_t_mh = None
            agmd_t_mc = None
            agmd_j_flux = None

        # 6. Primary Coolant Inventory Update (Euler)
        c_thermal_p = self.primary_thermal_capacitance_j_per_k
        dt_p_rate = (q_gpu - q_hx - q_loss_p) / c_thermal_p
        t_p_new = t_p_old + (dt_p_rate * step_dt)

        if not math.isfinite(t_p_new):
            raise FloatingPointError(f"Primary coolant temperature became non-finite: {t_p_new} at t={self._elapsed_time_s + step_dt}s")

        # 7. Secondary Reservoir Update (Euler)
        c_thermal_s = self.secondary_thermal_capacitance_j_per_k
        dt_s_rate = (q_hx - q_agmd - q_loss_s) / c_thermal_s
        t_s_new = t_s_old + (dt_s_rate * step_dt)

        if not math.isfinite(t_s_new):
            raise FloatingPointError(f"Secondary reservoir temperature became non-finite: {t_s_new} at t={self._elapsed_time_s + step_dt}s")

        # Update dynamic state
        self._current_primary_temp_c = t_p_new
        self._current_secondary_temp_c = t_s_new
        self._elapsed_time_s += step_dt

        # 8. Cumulative Energy Integration (Joules = Watts * seconds)
        self._cumulative_heat_generated_j += q_gen * step_dt
        self._cumulative_heat_to_coolant_j += q_gpu * step_dt
        self._cumulative_heat_recovered_hx_j += q_hx * step_dt
        self._cumulative_heat_to_agmd_j += q_agmd * step_dt
        self._cumulative_ambient_loss_j += total_q_loss * step_dt

        # Stored internal thermal energy changes (Delta E = C_th * Delta T)
        delta_e_gpu = self.gpu_model.params.thermal_capacitance_j_per_k * (self.gpu_model.current_temp_c - self.params.initial_gpu_temp_c)
        delta_e_primary = c_thermal_p * (self._current_primary_temp_c - self.params.primary_initial_temp_c)
        delta_e_secondary = c_thermal_s * (self._current_secondary_temp_c - self.params.secondary_initial_temp_c)

        # First-Law System Energy Balance:
        # E_generated = Delta E_GPU + Delta E_primary + Delta E_secondary + E_AGMD + E_ambient_loss
        total_accounted_energy_j = (
            delta_e_gpu
            + delta_e_primary
            + delta_e_secondary
            + self._cumulative_heat_to_agmd_j
            + self._cumulative_ambient_loss_j
        )
        energy_residual_j = self._cumulative_heat_generated_j - total_accounted_energy_j

        # Reservoir thermal storage relative to reference temperature 0 °C
        secondary_stored_energy_j = c_thermal_s * self._current_secondary_temp_c

        return SystemSimulationStep(
            time_s=round(self._elapsed_time_s, 6),
            gpu_temp_c=round(gpu_step.gpu_temp_c, 4),
            heat_generated_w=round(q_gen, 4),
            heat_to_coolant_w=round(q_gpu, 4),
            net_heat_w=round(gpu_step.net_heat_w, 4),
            primary_coolant_temp_c=round(t_p_new, 4),
            primary_heat_capacity_j_per_k=round(c_thermal_p, 4),
            heat_from_gpu_w=round(q_gpu, 4),
            heat_to_hx_w=round(q_hx, 4),
            primary_heat_loss_w=round(q_loss_p, 4),
            hx_heat_transfer_w=round(q_hx, 4),
            hx_effectiveness=round(hx_step.effectiveness, 4),
            hx_ntu=round(hx_step.ntu, 4),
            hx_primary_outlet_temp_c=round(hx_step.primary_outlet_temp_c, 4),
            hx_secondary_outlet_temp_c=round(hx_step.secondary_outlet_temp_c, 4),
            secondary_reservoir_temp_c=round(t_s_new, 4),
            secondary_stored_energy_j=round(secondary_stored_energy_j, 4),
            heat_received_hx_w=round(q_hx, 4),
            heat_to_agmd_w=round(q_agmd, 4),
            unmet_agmd_demand_w=round(q_unmet, 4),
            secondary_heat_loss_w=round(q_loss_s, 4),
            cumulative_heat_generated_j=round(self._cumulative_heat_generated_j, 4),
            cumulative_heat_to_coolant_j=round(self._cumulative_heat_to_coolant_j, 4),
            cumulative_heat_recovered_hx_j=round(self._cumulative_heat_recovered_hx_j, 4),
            cumulative_heat_to_agmd_j=round(self._cumulative_heat_to_agmd_j, 4),
            cumulative_ambient_loss_j=round(self._cumulative_ambient_loss_j, 4),
            energy_balance_residual_j=round(energy_residual_j, 6),
            freshwater_production_rate_kg_s=round(fw_rate_kg_s, 8) if fw_rate_kg_s is not None else None,
            freshwater_production_rate_l_h=round(fw_rate_l_h, 6) if fw_rate_l_h is not None else None,
            cumulative_freshwater_mass_kg=round(cum_fw_kg, 8) if cum_fw_kg is not None else None,
            cumulative_freshwater_volume_l=round(cum_fw_l, 6) if cum_fw_l is not None else None,
            feed_salinity_g_l=round(feed_salinity, 4) if feed_salinity is not None else None,
            agmd_hot_membrane_temp_c=round(agmd_t_mh, 4) if agmd_t_mh is not None else None,
            agmd_cold_condensing_temp_c=round(agmd_t_mc, 4) if agmd_t_mc is not None else None,
            agmd_vapor_flux_kg_m2_s=round(agmd_j_flux, 8) if agmd_j_flux is not None else None,
        )

    def reset(self) -> None:
        """Reset the integrated circulation model and all sub-models to initial conditions."""
        self.gpu_model.reset()
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
