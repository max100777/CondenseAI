"""
Service layer for Water Production Analytics & Thermal Performance (Module 5).

Provides execution logic for computing, storing, and formatting analytics KPIs:
- Processing raw calculation requests.
- Extracting analytics from integrated system simulations.
- Extracting analytics from standalone AGMD runs.
- Managing active analytics session state.
"""

from __future__ import annotations

from typing import Any, Optional

from backend.models.analytics_model import AnalyticsModel, AnalyticsSummary, AnalyticsTimeSeriesPoint
from backend.schemas.agmd_schema import AGMDResponse
from backend.schemas.analytics_schema import (
    AnalyticsCalculationRequest,
    AnalyticsResetResponse,
    AnalyticsResponse,
    AnalyticsSummarySchema,
    AnalyticsTimeSeriesPointSchema,
)
from backend.schemas.circulation_schema import SystemSimulationResponse


class AnalyticsService:
    """Service managing analytics calculation, KPI aggregation, and session summary."""

    def __init__(self) -> None:
        """Initialize service with empty latest summary."""
        self._latest_response: Optional[AnalyticsResponse] = None

    @property
    def latest_response(self) -> Optional[AnalyticsResponse]:
        """Retrieve the latest evaluated analytics response if available."""
        return self._latest_response

    def calculate_from_request(self, request: AnalyticsCalculationRequest) -> AnalyticsResponse:
        """
        Calculate analytics KPIs from a direct array request.

        Args:
            request: Validated time-series arrays and optional energy metrics.

        Returns:
            AnalyticsResponse containing structured summary and time series.
        """
        summary, time_points = AnalyticsModel.compute_from_time_series(
            time_points_s=request.time_points_s,
            freshwater_mass_kg=request.freshwater_mass_kg,
            freshwater_rates_l_h=request.freshwater_rates_l_h,
            fluxes_lmh=request.fluxes_lmh,
            agmd_powers_w=request.agmd_powers_w,
            feed_salinities_g_l=request.feed_salinities_g_l,
            feed_temps_c=request.feed_temps_c,
            total_gpu_heat_j=request.total_gpu_heat_j,
            total_hx_heat_j=request.total_hx_heat_j,
            initial_feed_mass_kg=request.initial_feed_mass_kg,
            energy_balance_residual_j=request.energy_balance_residual_j,
        )

        response = self._build_response(summary, time_points)
        self._latest_response = response
        return response

    def calculate_from_system_simulation(
        self,
        sim_response: SystemSimulationResponse,
        initial_feed_mass_kg: Optional[float] = None,
    ) -> AnalyticsResponse:
        """
        Extract analytics from an integrated circulation system simulation.
        """
        steps = sim_response.time_series
        if not steps:
            raise ValueError("System simulation contains no time series data.")

        time_points: list[float] = [s.time_s for s in steps]
        freshwater_masses: list[float] = [s.cumulative_freshwater_mass_kg or 0.0 for s in steps]
        freshwater_rates: list[float] = [s.freshwater_production_rate_l_h or 0.0 for s in steps]

        # Convert vapor mass flux (kg/(m²·s)) to LMH: J_LMH = (J_m / 1000) * 3.6e6
        fluxes_lmh: list[float] = []
        for s in steps:
            if s.agmd_vapor_flux_kg_m2_s is not None:
                fluxes_lmh.append(s.agmd_vapor_flux_kg_m2_s * 3600.0)
            elif s.freshwater_production_rate_l_h is not None and sim_response.parameters.enable_agmd:
                # Fallback using membrane area: J_LMH = V_dot_L_h / Area_m²
                area = sim_response.parameters.agmd_active_length_m * sim_response.parameters.agmd_active_width_m
                fluxes_lmh.append(s.freshwater_production_rate_l_h / area if area > 0 else 0.0)
            else:
                fluxes_lmh.append(0.0)

        agmd_powers: list[float] = [s.heat_to_agmd_w for s in steps]
        feed_salinities: list[float] = [s.feed_salinity_g_l or 0.0 for s in steps]
        feed_temps: list[float] = [s.secondary_reservoir_temp_c for s in steps]

        feed_mass = initial_feed_mass_kg or (
            sim_response.parameters.agmd_initial_feed_mass_kg if sim_response.parameters.enable_agmd else None
        )

        summary, pts = AnalyticsModel.compute_from_time_series(
            time_points_s=time_points,
            freshwater_mass_kg=freshwater_masses,
            freshwater_rates_l_h=freshwater_rates,
            fluxes_lmh=fluxes_lmh,
            agmd_powers_w=agmd_powers,
            feed_salinities_g_l=feed_salinities,
            feed_temps_c=feed_temps,
            total_gpu_heat_j=sim_response.total_heat_generated_j,
            total_hx_heat_j=sim_response.total_heat_recovered_hx_j,
            initial_feed_mass_kg=feed_mass,
            energy_balance_residual_j=sim_response.system_energy_balance_residual_j,
        )

        response = self._build_response(summary, pts)
        self._latest_response = response
        return response

    def calculate_from_agmd_simulation(self, agmd_response: AGMDResponse) -> AnalyticsResponse:
        """
        Extract analytics from a standalone AGMD desalination simulation.
        GPU and heat-exchanger metrics will be set to None.
        """
        steps = agmd_response.time_series
        if not steps:
            raise ValueError("AGMD simulation contains no time series data.")

        time_points: list[float] = [s.time_s for s in steps]
        freshwater_masses: list[float] = [s.cumulative_freshwater_mass_kg for s in steps]
        freshwater_rates: list[float] = [s.freshwater_production_rate_l_h for s in steps]
        fluxes_lmh: list[float] = [s.flux_l_m2_h for s in steps]
        agmd_powers: list[float] = [s.actual_heat_supplied_w for s in steps]
        feed_salinities: list[float] = [s.feed_salinity_g_l for s in steps]
        feed_temps: list[float] = [s.bulk_feed_temp_c for s in steps]

        summary, pts = AnalyticsModel.compute_from_time_series(
            time_points_s=time_points,
            freshwater_mass_kg=freshwater_masses,
            freshwater_rates_l_h=freshwater_rates,
            fluxes_lmh=fluxes_lmh,
            agmd_powers_w=agmd_powers,
            feed_salinities_g_l=feed_salinities,
            feed_temps_c=feed_temps,
            total_gpu_heat_j=None,
            total_hx_heat_j=None,
            initial_feed_mass_kg=agmd_response.parameters.initial_feed_mass_kg,
            energy_balance_residual_j=None,
        )

        response = self._build_response(summary, pts)
        self._latest_response = response
        return response

    def reset_analytics(self) -> AnalyticsResetResponse:
        """Reset current active analytics state."""
        self._latest_response = None
        return AnalyticsResetResponse(
            status="reset",
            message="Analytics engine state has been reset.",
        )

    @staticmethod
    def _build_response(
        summary: AnalyticsSummary,
        time_points: list[AnalyticsTimeSeriesPoint],
    ) -> AnalyticsResponse:
        """Construct validated Pydantic response from model dataclasses."""
        summary_schema = AnalyticsSummarySchema(
            simulation_duration_s=summary.simulation_duration_s,
            total_gpu_heat_generated_j=summary.total_gpu_heat_generated_j,
            total_heat_recovered_j=summary.total_heat_recovered_j,
            total_agmd_energy_j=summary.total_agmd_energy_j,
            total_agmd_energy_kwh=summary.total_agmd_energy_kwh,
            total_freshwater_mass_kg=summary.total_freshwater_mass_kg,
            total_freshwater_volume_l=summary.total_freshwater_volume_l,
            total_freshwater_volume_ml=summary.total_freshwater_volume_ml,
            instantaneous_production_l_h=summary.instantaneous_production_l_h,
            average_production_l_h=summary.average_production_l_h,
            average_flux_lmh=summary.average_flux_lmh,
            maximum_flux_lmh=summary.maximum_flux_lmh,
            minimum_flux_lmh=summary.minimum_flux_lmh,
            heat_exchanger_recovery_percent=summary.heat_exchanger_recovery_percent,
            heat_utilization_percent=summary.heat_utilization_percent,
            gpu_to_agmd_efficiency_percent=summary.gpu_to_agmd_efficiency_percent,
            specific_thermal_energy_kwh_m3=summary.specific_thermal_energy_kwh_m3,
            water_recovery_percent=summary.water_recovery_percent,
            final_feed_salinity_g_l=summary.final_feed_salinity_g_l,
            energy_balance_residual_j=summary.energy_balance_residual_j,
        )

        points_schema = [
            AnalyticsTimeSeriesPointSchema(
                time_s=p.time_s,
                freshwater_production_rate_l_h=p.freshwater_production_rate_l_h,
                cumulative_freshwater_volume_l=p.cumulative_freshwater_volume_l,
                flux_lmh=p.flux_lmh,
                agmd_thermal_power_w=p.agmd_thermal_power_w,
                feed_salinity_g_l=p.feed_salinity_g_l,
                feed_temp_c=p.feed_temp_c,
            )
            for p in time_points
        ]

        return AnalyticsResponse(summary=summary_schema, time_series=points_schema)
