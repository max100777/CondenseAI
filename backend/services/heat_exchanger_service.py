"""
Service layer for Heat Recovery Exchanger simulation (Module 2).

Manages heat exchanger model lifecycle, time-series streaming,
energy accumulation, and interfaces for future coupling with
GPU coolant output (Module 1) and Hot-Water Circulation (Module 3).
"""

from __future__ import annotations

import math
from typing import Iterator

from backend.models.heat_exchanger_model import (
    HeatExchangerModel,
    HeatExchangerParameters,
    HeatExchangerStep,
)
from backend.schemas.heat_exchanger_schema import (
    HeatExchangerResetResponse,
    HeatExchangerSimulationRequest,
    HeatExchangerSimulationResponse,
    HeatExchangerStepSchema,
)


class HeatExchangerService:
    """Service layer for heat recovery exchanger simulations."""

    def __init__(self) -> None:
        """Initialize service with default heat exchanger model."""
        self._default_params = HeatExchangerParameters()
        self._active_model: HeatExchangerModel = HeatExchangerModel(self._default_params)

    @property
    def active_model(self) -> HeatExchangerModel:
        """Retrieve active heat exchanger model instance."""
        return self._active_model

    def create_model_from_request(self, request: HeatExchangerSimulationRequest) -> HeatExchangerModel:
        """
        Convert validated request schema to domain model instance.

        Args:
            request: Validated simulation request parameters.

        Returns:
            Configured HeatExchangerModel.
        """
        params = HeatExchangerParameters(
            primary_inlet_temp_c=request.primary_inlet_temp_c,
            secondary_inlet_temp_c=request.secondary_inlet_temp_c,
            primary_mass_flow_kg_s=request.primary_mass_flow_kg_s,
            secondary_mass_flow_kg_s=request.secondary_mass_flow_kg_s,
            ua_w_k=request.ua_w_k,
            specific_heat_j_kg_k=request.specific_heat_j_kg_k,
            time_step_s=request.time_step_s,
            simulation_duration_s=request.simulation_duration_s,
        )
        return HeatExchangerModel(params)

    def stream_simulation(self, model: HeatExchangerModel) -> Iterator[HeatExchangerStep]:
        """
        Stream discrete time-series steps for real-time WebSocket or coupled co-simulation.

        Args:
            model: Configured HeatExchangerModel.

        Yields:
            HeatExchangerStep at each discrete time step.
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

    def run_simulation(self, request: HeatExchangerSimulationRequest) -> HeatExchangerSimulationResponse:
        """
        Execute batch heat exchanger simulation over the requested duration.

        Performs:
            1. Effectiveness-NTU calculation at each discrete interval.
            2. Primary-to-secondary thermal energy recovery integration in Joules.
            3. Second-law boundary check ensuring hot fluid does not cool below cold inlet
               and cold fluid does not exceed hot inlet.

        Args:
            request: Validated request parameters.

        Returns:
            HeatExchangerSimulationResponse with comprehensive analytics.
        """
        model = self.create_model_from_request(request)
        self._active_model = model

        time_series: list[HeatExchangerStepSchema] = []

        for step in self.stream_simulation(model):
            time_series.append(
                HeatExchangerStepSchema(
                    time_s=step.time_s,
                    primary_inlet_temp_c=step.primary_inlet_temp_c,
                    primary_outlet_temp_c=step.primary_outlet_temp_c,
                    secondary_inlet_temp_c=step.secondary_inlet_temp_c,
                    secondary_outlet_temp_c=step.secondary_outlet_temp_c,
                    primary_mass_flow_kg_s=step.primary_mass_flow_kg_s,
                    secondary_mass_flow_kg_s=step.secondary_mass_flow_kg_s,
                    c_h_w_per_k=step.c_h_w_per_k,
                    c_c_w_per_k=step.c_c_w_per_k,
                    c_min_w_per_k=step.c_min_w_per_k,
                    c_max_w_per_k=step.c_max_w_per_k,
                    capacity_ratio_cr=step.capacity_ratio_cr,
                    ntu=step.ntu,
                    effectiveness=step.effectiveness,
                    q_max_w=step.q_max_w,
                    heat_transfer_w=step.heat_transfer_w,
                    cumulative_recovered_heat_j=step.cumulative_recovered_heat_j,
                )
            )

        last_step = time_series[-1] if time_series else None
        eff = last_step.effectiveness if last_step else 0.0
        ntu_val = last_step.ntu if last_step else 0.0
        q_max = last_step.q_max_w if last_step else 0.0
        q_actual = last_step.heat_transfer_w if last_step else 0.0
        final_t_h_out = last_step.primary_outlet_temp_c if last_step else request.primary_inlet_temp_c
        final_t_c_out = last_step.secondary_outlet_temp_c if last_step else request.secondary_inlet_temp_c
        total_energy_j = model.cumulative_recovered_heat_j

        return HeatExchangerSimulationResponse(
            parameters=request,
            effectiveness=round(eff, 4),
            ntu=round(ntu_val, 4),
            q_max_w=round(q_max, 4),
            actual_heat_transfer_w=round(q_actual, 4),
            final_primary_outlet_temp_c=round(final_t_h_out, 4),
            final_secondary_outlet_temp_c=round(final_t_c_out, 4),
            total_recovered_energy_j=round(total_energy_j, 4),
            simulation_duration_s=round(request.simulation_duration_s, 4),
            step_count=len(time_series),
            time_series=time_series,
        )

    def reset_simulation(self) -> HeatExchangerResetResponse:
        """
        Reset active heat exchanger simulation state to t=0 and zero energy.

        Returns:
            HeatExchangerResetResponse confirmation.
        """
        self._active_model.reset()
        return HeatExchangerResetResponse(
            status="success",
            message="Heat recovery exchanger simulation state reset successfully.",
            elapsed_time_s=self._active_model.elapsed_time_s,
            cumulative_recovered_heat_j=self._active_model.cumulative_recovered_heat_j,
        )
