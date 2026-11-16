"""
Service layer for Air-Gap Membrane Distillation (AGMD) Desalination simulation (Module 4).

Manages AGMD model lifecycle, streaming discrete steps, mass & energy accumulation,
and interfaces for standalone simulation as well as coupled co-simulation with
Hot-Water Circulation and Storage (Module 3).
"""

from __future__ import annotations

import math
from typing import Iterator

from backend.models.agmd_model import (
    AGMDModel,
    AGMDParameters,
    AGMDStep,
)
from backend.schemas.agmd_schema import (
    AGMDRequest,
    AGMDResetResponse,
    AGMDResponse,
    AGMDStepSchema,
)


class AGMDService:
    """Service layer for AGMD desalination simulation."""

    def __init__(self) -> None:
        """Initialize service with default AGMD model."""
        self._default_params = AGMDParameters()
        self._active_model: AGMDModel = AGMDModel(self._default_params)

    @property
    def active_model(self) -> AGMDModel:
        """Retrieve active AGMD model instance."""
        return self._active_model

    def create_model_from_request(self, request: AGMDRequest) -> AGMDModel:
        """
        Convert validated request schema to domain model instance.

        Args:
            request: Validated simulation request parameters.

        Returns:
            Configured AGMDModel.
        """
        params = AGMDParameters(
            membrane_pore_diameter_m=request.membrane_pore_diameter_m,
            membrane_thickness_m=request.membrane_thickness_m,
            membrane_porosity=request.membrane_porosity,
            membrane_tortuosity=request.membrane_tortuosity,
            membrane_thermal_conductivity_w_m_k=request.membrane_thermal_conductivity_w_m_k,
            active_length_m=request.active_length_m,
            active_width_m=request.active_width_m,
            air_gap_thickness_m=request.air_gap_thickness_m,
            initial_feed_temp_c=request.initial_feed_temp_c,
            initial_salinity_g_l=request.initial_salinity_g_l,
            initial_feed_mass_kg=request.initial_feed_mass_kg,
            feed_specific_heat_j_kg_k=request.feed_specific_heat_j_kg_k,
            feed_density_kg_m3=request.feed_density_kg_m3,
            hot_side_htc_w_m2_k=request.hot_side_htc_w_m2_k,
            cold_plate_temp_c=request.cold_plate_temp_c,
            cold_side_htc_w_m2_k=request.cold_side_htc_w_m2_k,
            time_step_s=request.time_step_s,
            simulation_duration_s=request.simulation_duration_s,
        )
        return AGMDModel(params)

    def stream_simulation(
        self,
        model: AGMDModel,
        feed_temp_c: float | None = None,
        cold_plate_temp_c: float | None = None,
        available_thermal_power_w: float | None = None,
    ) -> Iterator[AGMDStep]:
        """
        Stream discrete time-series steps for real-time WebSocket or coupled co-simulation.

        Args:
            model: Configured AGMDModel.
            feed_temp_c: Optional override for hot feed temperature.
            cold_plate_temp_c: Optional override for cold plate temperature.
            available_thermal_power_w: Optional available thermal power limit.

        Yields:
            AGMDStep at each discrete time step.
        """
        duration = model.params.simulation_duration_s
        dt = model.params.time_step_s
        elapsed = 0.0
        tolerance = 1e-9

        while elapsed + tolerance < duration:
            step_dt = min(dt, duration - elapsed)
            step_record = model.step(
                dt=step_dt,
                feed_temp_c=feed_temp_c,
                cold_plate_temp_c=cold_plate_temp_c,
                available_thermal_power_w=available_thermal_power_w,
            )
            elapsed += step_dt
            yield step_record

    def run_simulation(self, request: AGMDRequest) -> AGMDResponse:
        """
        Execute batch AGMD simulation over the requested duration.

        Args:
            request: Validated request parameters.

        Returns:
            AGMDResponse with complete time-series and production analytics.
        """
        model = self.create_model_from_request(request)
        self._active_model = model

        time_series: list[AGMDStepSchema] = []
        fluxes_lmh: list[float] = []

        for step in self.stream_simulation(
            model=model,
            available_thermal_power_w=request.available_thermal_power_w,
        ):
            fluxes_lmh.append(step.flux_l_m2_h)
            time_series.append(
                AGMDStepSchema(
                    time_s=step.time_s,
                    bulk_feed_temp_c=step.bulk_feed_temp_c,
                    hot_membrane_temp_c=step.hot_membrane_temp_c,
                    cold_condensing_temp_c=step.cold_condensing_temp_c,
                    cold_plate_temp_c=step.cold_plate_temp_c,
                    temperature_difference_membrane_c=step.temperature_difference_membrane_c,
                    hot_sat_vapor_pressure_pa=step.hot_sat_vapor_pressure_pa,
                    hot_effective_vapor_pressure_pa=step.hot_effective_vapor_pressure_pa,
                    cold_sat_vapor_pressure_pa=step.cold_sat_vapor_pressure_pa,
                    vapor_pressure_difference_pa=step.vapor_pressure_difference_pa,
                    membrane_resistance_pa_s_m2_per_kg=step.membrane_resistance_pa_s_m2_per_kg,
                    air_gap_resistance_pa_s_m2_per_kg=step.air_gap_resistance_pa_s_m2_per_kg,
                    total_mass_transfer_resistance_pa_s_m2_per_kg=step.total_mass_transfer_resistance_pa_s_m2_per_kg,
                    vapor_flux_kg_m2_s=step.vapor_flux_kg_m2_s,
                    freshwater_production_rate_kg_s=step.freshwater_production_rate_kg_s,
                    freshwater_production_rate_l_h=step.freshwater_production_rate_l_h,
                    flux_l_m2_h=step.flux_l_m2_h,
                    cumulative_freshwater_mass_kg=step.cumulative_freshwater_mass_kg,
                    cumulative_freshwater_volume_l=step.cumulative_freshwater_volume_l,
                    feed_inventory_mass_kg=step.feed_inventory_mass_kg,
                    feed_salinity_g_l=step.feed_salinity_g_l,
                    latent_heat_flux_w=step.latent_heat_flux_w,
                    conductive_heat_flux_w=step.conductive_heat_flux_w,
                    total_agmd_heat_demand_w=step.total_agmd_heat_demand_w,
                    actual_heat_supplied_w=step.actual_heat_supplied_w,
                    unmet_heat_demand_w=step.unmet_heat_demand_w,
                    cold_plate_heat_rejection_w=step.cold_plate_heat_rejection_w,
                    cumulative_thermal_energy_consumed_j=step.cumulative_thermal_energy_consumed_j,
                    iterations=step.iterations,
                    converged=step.converged,
                    energy_balance_residual_w=step.energy_balance_residual_w,
                )
            )

        avg_flux = (sum(fluxes_lmh) / len(fluxes_lmh)) if fluxes_lmh else 0.0
        final_feed_temp = time_series[-1].bulk_feed_temp_c if time_series else request.initial_feed_temp_c

        return AGMDResponse(
            parameters=request,
            total_freshwater_produced_kg=round(model.cumulative_freshwater_mass_kg, 8),
            total_freshwater_produced_l=round(model.cumulative_freshwater_volume_l, 6),
            average_flux_l_m2_h=round(avg_flux, 6),
            total_thermal_energy_consumed_j=round(model.cumulative_thermal_energy_consumed_j, 4),
            final_feed_temp_c=round(final_feed_temp, 4),
            final_feed_salinity_g_l=round(model.current_salinity_g_l, 4),
            final_feed_mass_kg=round(model.current_feed_mass_kg, 6),
            simulation_duration_s=round(request.simulation_duration_s, 4),
            step_count=len(time_series),
            time_series=time_series,
        )

    def reset_simulation(self) -> AGMDResetResponse:
        """
        Reset active AGMD simulation state back to t=0 and initial inventory.

        Returns:
            AGMDResetResponse confirmation.
        """
        self._active_model.reset()
        return AGMDResetResponse(
            status="success",
            message="AGMD desalination simulation state reset successfully.",
            elapsed_time_s=self._active_model.elapsed_time_s,
            cumulative_freshwater_volume_l=self._active_model.cumulative_freshwater_volume_l,
        )
