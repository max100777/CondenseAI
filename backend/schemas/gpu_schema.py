"""
Pydantic schemas for CondensAI GPU simulation API.

Provides strict request validation, physical range enforcement,
and standardized time-series response formatting.
"""

from __future__ import annotations

import math
from typing import Annotated, List

from pydantic import BaseModel, ConfigDict, Field, model_validator


class GPUSimulationRequest(BaseModel):
    """
    Validated user request model for running a GPU thermal simulation.
    All physical parameters have sensible defaults and strict physical limits.
    """

    model_config = ConfigDict(extra="forbid")

    gpu_power_w: Annotated[
        float,
        Field(
            default=350.0,
            ge=0.0,
            le=50000.0,
            description="GPU electrical power consumption in Watts.",
            examples=[350.0],
        ),
    ]
    initial_gpu_temp_c: Annotated[
        float,
        Field(
            default=35.0,
            ge=-50.0,
            le=150.0,
            description="Initial GPU die temperature in degrees Celsius.",
            examples=[35.0],
        ),
    ]
    coolant_temp_c: Annotated[
        float,
        Field(
            default=30.0,
            ge=-50.0,
            le=100.0,
            description="Coolant inlet temperature in degrees Celsius.",
            examples=[30.0],
        ),
    ]
    heat_conversion_fraction: Annotated[
        float,
        Field(
            default=0.95,
            ge=0.0,
            le=1.0,
            description="Fraction of electrical power converted to thermal energy (0.0 to 1.0).",
            examples=[0.95],
        ),
    ]
    thermal_resistance_k_per_w: Annotated[
        float,
        Field(
            default=0.12,
            gt=0.0,
            le=10.0,
            description="Effective GPU-to-coolant thermal resistance R_th in K/W.",
            examples=[0.12],
        ),
    ]
    thermal_capacitance_j_per_k: Annotated[
        float,
        Field(
            default=250.0,
            gt=0.0,
            le=100000.0,
            description="Lumped thermal capacitance C_th in J/K.",
            examples=[250.0],
        ),
    ]
    time_step_s: Annotated[
        float,
        Field(
            default=1.0,
            gt=0.0,
            le=5.0,
            description="Simulation integration time step dt in seconds (enforced dt <= 5.0s for numerical precision).",
            examples=[1.0],
        ),
    ]
    simulation_duration_s: Annotated[
        float,
        Field(
            default=60.0,
            gt=0.0,
            le=86400.0,
            description="Total duration of simulation in seconds (max 86400s / 24h).",
            examples=[60.0],
        ),
    ]

    @model_validator(mode="after")
    def validate_simulation_bounds(self) -> GPUSimulationRequest:
        """Validate logical and numerical limits across fields."""
        # Ensure numbers are finite
        for field_name, value in self.__dict__.items():
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError(f"Field '{field_name}' must be a finite numerical value.")

        if self.time_step_s > self.simulation_duration_s:
            raise ValueError(
                f"Time step ({self.time_step_s}s) cannot be greater than simulation duration ({self.simulation_duration_s}s)."
            )

        step_count = self.simulation_duration_s / self.time_step_s
        if step_count > 100_000:
            raise ValueError(
                f"Requested number of simulation steps ({step_count:.0f}) exceeds the safety limit of 100,000 steps. "
                "Increase the time_step_s or reduce simulation_duration_s."
            )

        return self


class GPUSimulationStepSchema(BaseModel):
    """Instantaneous time-series simulation record at a discrete time step."""

    time_s: Annotated[float, Field(description="Elapsed simulation time in seconds.")]
    gpu_power_w: Annotated[float, Field(description="Instantaneous GPU electrical power in Watts.")]
    gpu_temp_c: Annotated[float, Field(description="Current GPU temperature in degrees Celsius.")]
    coolant_temp_c: Annotated[float, Field(description="Coolant inlet temperature in degrees Celsius.")]
    heat_generated_w: Annotated[float, Field(description="Instantaneous thermal power generated in Watts.")]
    heat_to_coolant_w: Annotated[float, Field(description="Instantaneous heat power transferred to coolant in Watts.")]
    net_heat_w: Annotated[float, Field(description="Net instantaneous thermal power stored in GPU in Watts.")]


class GPUSimulationResponse(BaseModel):
    """Complete simulation response containing parameters, analytics, and time-series records."""

    parameters: GPUSimulationRequest
    final_gpu_temp_c: Annotated[float, Field(description="Final GPU temperature at conclusion of simulation in °C.")]
    initial_gpu_temp_c: Annotated[float, Field(description="Initial GPU temperature in °C.")]
    final_gpu_temp_change_c: Annotated[float, Field(description="Net change in GPU temperature (T_final - T_initial) in °C.")]
    total_heat_generated_j: Annotated[float, Field(description="Total heat energy generated over the simulation in Joules.")]
    total_heat_to_coolant_j: Annotated[float, Field(description="Total heat energy transferred to coolant in Joules.")]
    avg_heat_to_coolant_w: Annotated[float, Field(description="Average heat power transferred to coolant in Watts.")]
    simulation_duration_s: Annotated[float, Field(description="Simulated time duration in seconds.")]
    step_count: Annotated[int, Field(description="Total number of discrete integration steps calculated.")]
    time_series: List[GPUSimulationStepSchema]


class ResetResponse(BaseModel):
    """Response returned upon resetting the active GPU simulation state."""

    status: str
    message: str
    initial_gpu_temp_c: float
    current_gpu_temp_c: float
    elapsed_time_s: float


class HealthResponse(BaseModel):
    """Health status response."""

    status: str
    service: str
    version: str


class RootResponse(BaseModel):
    """Root endpoint metadata response."""

    application_name: str
    module_name: str
    api_status: str
    version: str
    documentation_url: str
