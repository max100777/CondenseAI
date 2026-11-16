"""
Service layer for Multi-GPU Scaling and Thermal Simulation (Module 5).

Orchestrates multi-GPU simulations:
- Translates MultiGPUSimulationRequest schemas into domain models.
- Executes batch simulation across all GPUs, shared primary coolant loop, heat exchanger,
  secondary storage reservoir, and coupled AGMD desalination.
- Evaluates per-GPU performance summaries (GPUComparisonItem).
- Automatically triggers Module 5 analytics calculation.
"""

from __future__ import annotations

import math
from typing import List, Optional

from backend.models.analytics_model import AnalyticsModel
from backend.models.multi_gpu_model import (
    GPUConfig,
    MultiGPUModel,
    MultiGPUParameters,
    MultiGPUSimulationStep,
)
from backend.schemas.analytics_schema import AnalyticsSummarySchema
from backend.schemas.multi_gpu_schema import (
    GPUComparisonItem,
    GPUConfigSchema,
    GPUStateSchema,
    MultiGPUResetResponse,
    MultiGPUSimulationRequest,
    MultiGPUSimulationResponse,
    MultiGPUStepSchema,
)


class MultiGPUService:
    """Service layer managing multi-GPU simulations and analytical evaluations."""

    def __init__(self) -> None:
        """Initialize service with default single-GPU model."""
        self._default_params = MultiGPUParameters()
        self._active_model: MultiGPUModel = MultiGPUModel(self._default_params)

    @property
    def active_model(self) -> MultiGPUModel:
        """Retrieve active MultiGPUModel instance."""
        return self._active_model

    def create_model_from_request(self, request: MultiGPUSimulationRequest) -> MultiGPUModel:
        """
        Convert validated request schema to domain model instance.
        """
        gpu_configs = [
            GPUConfig(
                gpu_id=g.gpu_id,
                power_w=g.power_w,
                heat_conversion_fraction=g.heat_conversion_fraction,
                initial_temp_c=g.initial_temp_c,
                thermal_resistance_k_per_w=g.thermal_resistance_k_per_w,
                thermal_capacitance_j_per_k=g.thermal_capacitance_j_per_k,
                max_temp_c=g.max_temp_c,
            )
            for g in request.gpus
        ]

        params = MultiGPUParameters(
            gpus=gpu_configs,
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
        return MultiGPUModel(params)

    def run_simulation(self, request: MultiGPUSimulationRequest) -> MultiGPUSimulationResponse:
        """
        Execute multi-GPU coupled simulation.
        """
        model = self.create_model_from_request(request)
        self._active_model = model

        duration = request.simulation_duration_s
        dt = request.time_step_s
        elapsed = 0.0
        tolerance = 1e-9

        steps: List[MultiGPUSimulationStep] = []

        while elapsed + tolerance < duration:
            step_dt = min(dt, duration - elapsed)
            step_record = model.step(step_dt)
            steps.append(step_record)
            elapsed += step_dt

        final_step = steps[-1]

        # Build GPU comparison table/items
        gpu_comparison: List[GPUComparisonItem] = []
        for g_state in final_step.gpu_states:
            gpu_comparison.append(
                GPUComparisonItem(
                    gpu_id=g_state.gpu_id,
                    power_w=g_state.power_w,
                    final_temp_c=g_state.current_temp_c,
                    heat_generated_w=g_state.heat_generated_w,
                    heat_to_coolant_w=g_state.heat_to_coolant_w,
                    stored_energy_j=g_state.stored_energy_j,
                    status=g_state.status,
                )
            )

        # Convert step records to schema
        time_series_schemas: List[MultiGPUStepSchema] = []
        for s in steps:
            gpu_state_schemas = [
                GPUStateSchema(
                    gpu_id=gs.gpu_id,
                    power_w=gs.power_w,
                    current_temp_c=gs.current_temp_c,
                    heat_generated_w=gs.heat_generated_w,
                    heat_to_coolant_w=gs.heat_to_coolant_w,
                    net_heat_w=gs.net_heat_w,
                    stored_energy_j=gs.stored_energy_j,
                    status=gs.status,
                )
                for gs in s.gpu_states
            ]

            time_series_schemas.append(
                MultiGPUStepSchema(
                    time_s=s.time_s,
                    gpu_states=gpu_state_schemas,
                    aggregate_heat_generated_w=s.aggregate_heat_generated_w,
                    aggregate_heat_to_coolant_w=s.aggregate_heat_to_coolant_w,
                    primary_coolant_temp_c=s.primary_coolant_temp_c,
                    primary_heat_loss_w=s.primary_heat_loss_w,
                    hx_heat_transfer_w=s.hx_heat_transfer_w,
                    hx_effectiveness=s.hx_effectiveness,
                    hx_ntu=s.hx_ntu,
                    hx_primary_outlet_temp_c=s.hx_primary_outlet_temp_c,
                    hx_secondary_outlet_temp_c=s.hx_secondary_outlet_temp_c,
                    secondary_reservoir_temp_c=s.secondary_reservoir_temp_c,
                    secondary_stored_energy_j=s.secondary_stored_energy_j,
                    secondary_heat_loss_w=s.secondary_heat_loss_w,
                    heat_to_agmd_w=s.heat_to_agmd_w,
                    unmet_agmd_demand_w=s.unmet_agmd_demand_w,
                    cumulative_heat_generated_j=s.cumulative_heat_generated_j,
                    cumulative_heat_to_coolant_j=s.cumulative_heat_to_coolant_j,
                    cumulative_heat_recovered_hx_j=s.cumulative_heat_recovered_hx_j,
                    cumulative_heat_to_agmd_j=s.cumulative_heat_to_agmd_j,
                    cumulative_ambient_loss_j=s.cumulative_ambient_loss_j,
                    energy_balance_residual_j=s.energy_balance_residual_j,
                    freshwater_production_rate_kg_s=s.freshwater_production_rate_kg_s,
                    freshwater_production_rate_l_h=s.freshwater_production_rate_l_h,
                    cumulative_freshwater_mass_kg=s.cumulative_freshwater_mass_kg,
                    cumulative_freshwater_volume_l=s.cumulative_freshwater_volume_l,
                    feed_salinity_g_l=s.feed_salinity_g_l,
                    agmd_hot_membrane_temp_c=s.agmd_hot_membrane_temp_c,
                    agmd_cold_condensing_temp_c=s.agmd_cold_condensing_temp_c,
                    agmd_vapor_flux_kg_m2_s=s.agmd_vapor_flux_kg_m2_s,
                )
            )

        # Compute Module 5 analytics
        analytics_summary_schema: Optional[AnalyticsSummarySchema] = None
        if request.enable_agmd:
            time_points_s = [s.time_s for s in steps]
            fw_masses = [s.cumulative_freshwater_mass_kg or 0.0 for s in steps]
            fw_rates = [s.freshwater_production_rate_l_h or 0.0 for s in steps]
            fluxes_lmh = [
                (s.agmd_vapor_flux_kg_m2_s * 3600.0) if s.agmd_vapor_flux_kg_m2_s is not None else 0.0
                for s in steps
            ]
            agmd_powers = [s.heat_to_agmd_w for s in steps]
            feed_salinities = [s.feed_salinity_g_l or 0.0 for s in steps]
            feed_temps = [s.secondary_reservoir_temp_c for s in steps]

            summary_data, _ = AnalyticsModel.compute_from_time_series(
                time_points_s=time_points_s,
                freshwater_mass_kg=fw_masses,
                freshwater_rates_l_h=fw_rates,
                fluxes_lmh=fluxes_lmh,
                agmd_powers_w=agmd_powers,
                feed_salinities_g_l=feed_salinities,
                feed_temps_c=feed_temps,
                total_gpu_heat_j=final_step.cumulative_heat_generated_j,
                total_hx_heat_j=final_step.cumulative_heat_recovered_hx_j,
                initial_feed_mass_kg=request.agmd_initial_feed_mass_kg,
                energy_balance_residual_j=final_step.energy_balance_residual_j,
            )

            analytics_summary_schema = AnalyticsSummarySchema(
                simulation_duration_s=summary_data.simulation_duration_s,
                total_gpu_heat_generated_j=summary_data.total_gpu_heat_generated_j,
                total_heat_recovered_j=summary_data.total_heat_recovered_j,
                total_agmd_energy_j=summary_data.total_agmd_energy_j,
                total_agmd_energy_kwh=summary_data.total_agmd_energy_kwh,
                total_freshwater_mass_kg=summary_data.total_freshwater_mass_kg,
                total_freshwater_volume_l=summary_data.total_freshwater_volume_l,
                total_freshwater_volume_ml=summary_data.total_freshwater_volume_ml,
                instantaneous_production_l_h=summary_data.instantaneous_production_l_h,
                average_production_l_h=summary_data.average_production_l_h,
                average_flux_lmh=summary_data.average_flux_lmh,
                maximum_flux_lmh=summary_data.maximum_flux_lmh,
                minimum_flux_lmh=summary_data.minimum_flux_lmh,
                heat_exchanger_recovery_percent=summary_data.heat_exchanger_recovery_percent,
                heat_utilization_percent=summary_data.heat_utilization_percent,
                gpu_to_agmd_efficiency_percent=summary_data.gpu_to_agmd_efficiency_percent,
                specific_thermal_energy_kwh_m3=summary_data.specific_thermal_energy_kwh_m3,
                water_recovery_percent=summary_data.water_recovery_percent,
                final_feed_salinity_g_l=summary_data.final_feed_salinity_g_l,
                energy_balance_residual_j=summary_data.energy_balance_residual_j,
            )

        aggregate_power = sum(g.power_w for g in request.gpus)

        return MultiGPUSimulationResponse(
            parameters=request,
            gpu_count=len(request.gpus),
            aggregate_power_w=aggregate_power,
            gpu_comparison=gpu_comparison,
            final_primary_coolant_temp_c=final_step.primary_coolant_temp_c,
            final_secondary_reservoir_temp_c=final_step.secondary_reservoir_temp_c,
            total_heat_generated_j=final_step.cumulative_heat_generated_j,
            total_heat_to_coolant_j=final_step.cumulative_heat_to_coolant_j,
            total_heat_recovered_hx_j=final_step.cumulative_heat_recovered_hx_j,
            total_heat_to_agmd_j=final_step.cumulative_heat_to_agmd_j,
            total_ambient_loss_j=final_step.cumulative_ambient_loss_j,
            system_energy_balance_residual_j=final_step.energy_balance_residual_j,
            total_freshwater_produced_kg=final_step.cumulative_freshwater_mass_kg,
            total_freshwater_produced_l=final_step.cumulative_freshwater_volume_l,
            simulation_duration_s=duration,
            step_count=len(steps),
            analytics=analytics_summary_schema,
            time_series=time_series_schemas,
        )

    def reset_simulation(self) -> MultiGPUResetResponse:
        """Reset multi-GPU simulation state."""
        self._active_model.reset()
        return MultiGPUResetResponse(
            status="reset",
            message="Multi-GPU simulation state has been reset to initial conditions.",
            gpu_count=len(self._active_model.params.gpus),
            primary_coolant_temp_c=self._active_model.params.primary_initial_temp_c,
            secondary_reservoir_temp_c=self._active_model.params.secondary_initial_temp_c,
        )
