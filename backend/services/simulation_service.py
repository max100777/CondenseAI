"""
Simulation Service for CondensAI GPU Thermal Model.

Orchestrates execution of the GPU thermal model, aggregates time-series results,
performs numerical energy integration, and manages the simulation lifecycle.
Designed for modular extension with future Heat Recovery (Module 2) and AGMD modules.
"""

from __future__ import annotations

import math
from typing import Iterator

from backend.models.gpu_model import GPUModel, GPUParameters, GPUSimulationStep
from backend.schemas.gpu_schema import (
    GPUSimulationRequest,
    GPUSimulationResponse,
    GPUSimulationStepSchema,
    ResetResponse,
)


class GPUSimulationService:
    """Service layer managing GPU simulation lifecycles and computations."""

    def __init__(self) -> None:
        """Initialize the service with default active model state."""
        self._default_params = GPUParameters()
        self._active_model: GPUModel = GPUModel(self._default_params)

    @property
    def active_model(self) -> GPUModel:
        """Retrieve current active model instance."""
        return self._active_model

    def create_model_from_request(self, request: GPUSimulationRequest) -> GPUModel:
        """
        Convert validated API request schema into a core physics model instance.

        Args:
            request: Validated request parameters.

        Returns:
            Configured GPUModel ready for simulation.
        """
        params = GPUParameters(
            gpu_power_w=request.gpu_power_w,
            initial_gpu_temp_c=request.initial_gpu_temp_c,
            coolant_temp_c=request.coolant_temp_c,
            heat_conversion_fraction=request.heat_conversion_fraction,
            thermal_resistance_k_per_w=request.thermal_resistance_k_per_w,
            thermal_capacitance_j_per_k=request.thermal_capacitance_j_per_k,
            time_step_s=request.time_step_s,
            duration_s=request.simulation_duration_s,
        )
        return GPUModel(params)

    def stream_simulation(self, model: GPUModel) -> Iterator[GPUSimulationStep]:
        """
        Generator yielding time-series steps one at a time.
        Ideal for real-time WebSocket streaming or step-by-step coupled co-simulation
        with future Module 2 (Heat Recovery) and Module 3 (Circulation).

        Args:
            model: GPUModel configured with simulation parameters.

        Yields:
            GPUSimulationStep at each discrete time step.
        """
        duration = model.params.duration_s
        dt = model.params.time_step_s

        elapsed = 0.0
        # Guard against floating point accumulation inaccuracies
        tolerance = 1e-9

        while elapsed + tolerance < duration:
            # Handle potential partial final step if duration is not an exact multiple of dt
            step_dt = min(dt, duration - elapsed)
            step_record = model.step(step_dt)
            elapsed += step_dt
            yield step_record

    def run_simulation(self, request: GPUSimulationRequest) -> GPUSimulationResponse:
        """
        Execute deterministic batch simulation over the requested duration.

        Performs:
            1. Forward Euler numerical integration across discrete time intervals.
            2. Cumulative energy integration:
               - Total heat generated E_gen = sum(Q_gen * dt) [Joules]
               - Total heat dissipated to coolant E_coolant = sum(Q_coolant * dt) [Joules]
            3. Average coolant heat transfer rate P_avg = E_coolant / duration [Watts]
            4. Net GPU temperature differential Delta T = T_final - T_initial [°C]

        Args:
            request: Validated simulation request parameters.

        Returns:
            GPUSimulationResponse with summary metrics and time-series arrays.
        """
        model = self.create_model_from_request(request)

        # Update service active model state for reset and telemetry
        self._active_model = model

        time_series: list[GPUSimulationStepSchema] = []
        total_heat_generated_j = 0.0
        total_heat_to_coolant_j = 0.0

        prev_time = 0.0
        for step in self.stream_simulation(model):
            # Numerical integration of energy (Joules = Watts * seconds)
            step_dt = step.time_s - prev_time
            prev_time = step.time_s

            total_heat_generated_j += step.heat_generated_w * step_dt
            total_heat_to_coolant_j += step.heat_to_coolant_w * step_dt

            time_series.append(
                GPUSimulationStepSchema(
                    time_s=step.time_s,
                    gpu_power_w=step.gpu_power_w,
                    gpu_temp_c=step.gpu_temp_c,
                    coolant_temp_c=step.coolant_temp_c,
                    heat_generated_w=step.heat_generated_w,
                    heat_to_coolant_w=step.heat_to_coolant_w,
                    net_heat_w=step.net_heat_w,
                )
            )

        duration = request.simulation_duration_s
        final_temp = model.current_temp_c
        initial_temp = request.initial_gpu_temp_c
        temp_change = final_temp - initial_temp
        avg_heat_to_coolant_w = total_heat_to_coolant_j / duration if duration > 0.0 else 0.0

        return GPUSimulationResponse(
            parameters=request,
            final_gpu_temp_c=round(final_temp, 4),
            initial_gpu_temp_c=round(initial_temp, 4),
            final_gpu_temp_change_c=round(temp_change, 4),
            total_heat_generated_j=round(total_heat_generated_j, 4),
            total_heat_to_coolant_j=round(total_heat_to_coolant_j, 4),
            avg_heat_to_coolant_w=round(avg_heat_to_coolant_w, 4),
            simulation_duration_s=round(duration, 4),
            step_count=len(time_series),
            time_series=time_series,
        )

    def reset_simulation(self) -> ResetResponse:
        """
        Reset the active GPU simulation model back to its initial parameters and time t=0.

        Returns:
            ResetResponse confirming reset state.
        """
        self._active_model.reset()
        return ResetResponse(
            status="success",
            message="GPU simulation state reset to initial conditions successfully.",
            initial_gpu_temp_c=self._active_model.params.initial_gpu_temp_c,
            current_gpu_temp_c=self._active_model.current_temp_c,
            elapsed_time_s=self._active_model.elapsed_time_s,
        )
