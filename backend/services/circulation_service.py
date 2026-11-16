"""
Service layer for Hot-Water Circulation, Thermal Storage & System Integration (Module 3).

Orchestrates multi-subsystem simulation:
- GPU heat generation (Module 1)
- Counterflow heat exchanger recovery (Module 2)
- Primary coolant thermal loop dynamics
- Secondary reservoir thermal storage dynamics
- Downstream AGMD heat extraction
- First-Law system energy conservation auditing
"""

from __future__ import annotations

import math
from typing import Iterator

from backend.models.circulation_model import (
    CirculationModel,
    CirculationParameters,
    SystemSimulationStep,
)
from backend.schemas.circulation_schema import (
    SystemResetResponse,
    SystemSimulationRequest,
    SystemSimulationResponse,
    SystemSimulationStepSchema,
)


class CirculationService:
    """Service layer managing integrated multi-subsystem thermal simulations."""

    def __init__(self) -> None:
        """Initialize service with default circulation model."""
        self._default_params = CirculationParameters()
        self._active_model: CirculationModel = CirculationModel(self._default_params)

    @property
    def active_model(self) -> CirculationModel:
        """Retrieve active integrated circulation model instance."""
        return self._active_model

    def create_model_from_request(self, request: SystemSimulationRequest) -> CirculationModel:
        """
        Convert validated request schema to domain model instance.

        Args:
            request: Validated simulation request parameters.

        Returns:
            Configured CirculationModel.
        """
        params = CirculationParameters(
            gpu_power_w=request.gpu_power_w,
            heat_conversion_fraction=request.heat_conversion_fraction,
            initial_gpu_temp_c=request.initial_gpu_temp_c,
            thermal_resistance_k_per_w=request.thermal_resistance_k_per_w,
            thermal_capacitance_j_per_k=request.thermal_capacitance_j_per_k,
            primary_coolant_mass_kg=request.primary_coolant_mass_kg,
            primary_mass_flow_kg_s=request.primary_mass_flow_kg_s,
            primary_initial_temp_c=request.primary_initial_temp_c,
            primary_specific_heat_j_kg_k=request.primary_specific_heat_j_kg_k,
            primary_heat_loss_ua_w_k=request.primary_heat_loss_ua_w_k,
            exchanger_ua_w_k=request.exchanger_ua_w_k,
            secondary_water_mass_kg=request.secondary_water_mass_kg,
            secondary_mass_flow_kg_s=request.secondary_mass_flow_kg_s,
            secondary_initial_temp_c=request.secondary_initial_temp_c,
            secondary_specific_heat_j_kg_k=request.secondary_specific_heat_j_kg_k,
            secondary_heat_loss_ua_w_k=request.secondary_heat_loss_ua_w_k,
            ambient_temp_c=request.ambient_temp_c,
            agmd_heat_demand_w=request.agmd_heat_demand_w,
            min_secondary_temp_c=request.min_secondary_temp_c,
            time_step_s=request.time_step_s,
            simulation_duration_s=request.simulation_duration_s,
            enable_agmd=request.enable_agmd,
            agmd_membrane_pore_diameter_m=request.agmd_membrane_pore_diameter_m,
            agmd_membrane_thickness_m=request.agmd_membrane_thickness_m,
            agmd_membrane_porosity=request.agmd_membrane_porosity,
            agmd_membrane_tortuosity=request.agmd_membrane_tortuosity,
            agmd_active_length_m=request.agmd_active_length_m,
            agmd_active_width_m=request.agmd_active_width_m,
            agmd_air_gap_thickness_m=request.agmd_air_gap_thickness_m,
            agmd_initial_salinity_g_l=request.agmd_initial_salinity_g_l,
            agmd_initial_feed_mass_kg=request.agmd_initial_feed_mass_kg,
            agmd_cold_plate_temp_c=request.agmd_cold_plate_temp_c,
        )
        return CirculationModel(params)

    def stream_simulation(self, model: CirculationModel) -> Iterator[SystemSimulationStep]:
        """
        Stream discrete time-series steps for real-time WebSocket or multi-agent analytics.

        Args:
            model: Configured CirculationModel.

        Yields:
            SystemSimulationStep at each discrete time step.
        """
        duration = model.params.simulation_duration_s
        dt = model.params.time_step_s
        elapsed = 0.0
        tolerance = 1e-9

        while elapsed + tolerance < duration:
            step_dt = min(dt, duration - elapsed)
            step_record = model.step(step_dt)
            elapsed += step_dt
            yield step_record

    def run_simulation(self, request: SystemSimulationRequest) -> SystemSimulationResponse:
        """
        Execute integrated batch simulation across all coupled loops.

        Performs:
            1. Coupled thermal stepping across GPU, primary loop, heat exchanger, and secondary reservoir.
            2. Downstream AGMD heat extraction accounting.
            3. Ambient thermal dissipation accounting.
            4. System-wide energy balance verification.

        Args:
            request: Validated integrated simulation request.

        Returns:
            SystemSimulationResponse containing comprehensive summary metrics and time series.
        """
        model = self.create_model_from_request(request)
        self._active_model = model

        time_series: list[SystemSimulationStepSchema] = []
        total_unmet_agmd_j = 0.0
        prev_time = 0.0

        for step in self.stream_simulation(model):
            step_dt = step.time_s - prev_time
            prev_time = step.time_s
            total_unmet_agmd_j += step.unmet_agmd_demand_w * step_dt

            time_series.append(
                SystemSimulationStepSchema(
                    time_s=step.time_s,
                    gpu_temp_c=step.gpu_temp_c,
                    heat_generated_w=step.heat_generated_w,
                    heat_to_coolant_w=step.heat_to_coolant_w,
                    net_heat_w=step.net_heat_w,
                    primary_coolant_temp_c=step.primary_coolant_temp_c,
                    primary_heat_capacity_j_per_k=step.primary_heat_capacity_j_per_k,
                    heat_from_gpu_w=step.heat_from_gpu_w,
                    heat_to_hx_w=step.heat_to_hx_w,
                    primary_heat_loss_w=step.primary_heat_loss_w,
                    hx_heat_transfer_w=step.hx_heat_transfer_w,
                    hx_effectiveness=step.hx_effectiveness,
                    hx_ntu=step.hx_ntu,
                    hx_primary_outlet_temp_c=step.hx_primary_outlet_temp_c,
                    hx_secondary_outlet_temp_c=step.hx_secondary_outlet_temp_c,
                    secondary_reservoir_temp_c=step.secondary_reservoir_temp_c,
                    secondary_stored_energy_j=step.secondary_stored_energy_j,
                    heat_received_hx_w=step.heat_received_hx_w,
                    heat_to_agmd_w=step.heat_to_agmd_w,
                    unmet_agmd_demand_w=step.unmet_agmd_demand_w,
                    secondary_heat_loss_w=step.secondary_heat_loss_w,
                    cumulative_heat_generated_j=step.cumulative_heat_generated_j,
                    cumulative_heat_to_coolant_j=step.cumulative_heat_to_coolant_j,
                    cumulative_heat_recovered_hx_j=step.cumulative_heat_recovered_hx_j,
                    cumulative_heat_to_agmd_j=step.cumulative_heat_to_agmd_j,
                    cumulative_ambient_loss_j=step.cumulative_ambient_loss_j,
                    energy_balance_residual_j=step.energy_balance_residual_j,
                    freshwater_production_rate_kg_s=step.freshwater_production_rate_kg_s,
                    freshwater_production_rate_l_h=step.freshwater_production_rate_l_h,
                    cumulative_freshwater_mass_kg=step.cumulative_freshwater_mass_kg,
                    cumulative_freshwater_volume_l=step.cumulative_freshwater_volume_l,
                    feed_salinity_g_l=step.feed_salinity_g_l,
                    agmd_hot_membrane_temp_c=step.agmd_hot_membrane_temp_c,
                    agmd_cold_condensing_temp_c=step.agmd_cold_condensing_temp_c,
                    agmd_vapor_flux_kg_m2_s=step.agmd_vapor_flux_kg_m2_s,
                )
            )

        last_step = time_series[-1] if time_series else None
        final_gpu_temp = last_step.gpu_temp_c if last_step else request.initial_gpu_temp_c
        final_primary_temp = last_step.primary_coolant_temp_c if last_step else request.primary_initial_temp_c
        final_secondary_temp = last_step.secondary_reservoir_temp_c if last_step else request.secondary_initial_temp_c
        total_gen_j = model._cumulative_heat_generated_j
        total_coolant_j = model._cumulative_heat_to_coolant_j
        total_hx_j = model._cumulative_heat_recovered_hx_j
        total_agmd_j = model._cumulative_heat_to_agmd_j
        total_loss_j = model._cumulative_ambient_loss_j
        residual_j = last_step.energy_balance_residual_j if last_step else 0.0

        total_fw_kg = model.agmd_model.cumulative_freshwater_mass_kg if model.agmd_model else None
        total_fw_l = model.agmd_model.cumulative_freshwater_volume_l if model.agmd_model else None

        return SystemSimulationResponse(
            parameters=request,
            final_gpu_temp_c=round(final_gpu_temp, 4),
            final_primary_coolant_temp_c=round(final_primary_temp, 4),
            final_secondary_reservoir_temp_c=round(final_secondary_temp, 4),
            total_heat_generated_j=round(total_gen_j, 4),
            total_heat_to_coolant_j=round(total_coolant_j, 4),
            total_heat_recovered_hx_j=round(total_hx_j, 4),
            total_heat_to_agmd_j=round(total_agmd_j, 4),
            total_unmet_agmd_demand_j=round(total_unmet_agmd_j, 4),
            total_ambient_loss_j=round(total_loss_j, 4),
            system_energy_balance_residual_j=round(residual_j, 6),
            total_freshwater_produced_kg=round(total_fw_kg, 8) if total_fw_kg is not None else None,
            total_freshwater_produced_l=round(total_fw_l, 6) if total_fw_l is not None else None,
            simulation_duration_s=round(request.simulation_duration_s, 4),
            step_count=len(time_series),
            time_series=time_series,
        )

    def reset_simulation(self) -> SystemResetResponse:
        """
        Reset integrated system simulation state back to initial conditions and zero energy.

        Returns:
            SystemResetResponse confirmation.
        """
        self._active_model.reset()
        return SystemResetResponse(
            status="success",
            message="Integrated system simulation state reset to initial conditions successfully.",
            elapsed_time_s=self._active_model.elapsed_time_s,
            gpu_temp_c=self._active_model.gpu_model.current_temp_c,
            primary_coolant_temp_c=self._active_model.params.primary_initial_temp_c,
            secondary_reservoir_temp_c=self._active_model.params.secondary_initial_temp_c,
        )
