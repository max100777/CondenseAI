"""
Pydantic schemas for CondensAI Heat Recovery Exchanger simulation API.

Provides strict request validation, physical range enforcement,
and standardized time-series response formatting for Module 2.
"""

from __future__ import annotations

import math
from typing import Annotated, List

from pydantic import BaseModel, ConfigDict, Field, model_validator


class HeatExchangerSimulationRequest(BaseModel):
    """
    Validated user request model for running a counterflow heat exchanger simulation.
    All physical parameters have sensible defaults and strict physical limits.
    """

    model_config = ConfigDict(extra="forbid")

    primary_inlet_temp_c: Annotated[
        float,
        Field(
            default=65.0,
            ge=-50.0,
            le=200.0,
            description="Primary hot coolant inlet temperature from GPU loop in °C.",
            examples=[65.0],
        ),
    ]
    secondary_inlet_temp_c: Annotated[
        float,
        Field(
            default=25.0,
            ge=-50.0,
            le=150.0,
            description="Secondary cold water inlet temperature from reservoir in °C.",
            examples=[25.0],
        ),
    ]
    primary_mass_flow_kg_s: Annotated[
        float,
        Field(
            default=0.05,
            gt=0.0,
            le=100.0,
            description="Mass flow rate of primary coolant in kg/s.",
            examples=[0.05],
        ),
    ]
    secondary_mass_flow_kg_s: Annotated[
        float,
        Field(
            default=0.02,
            gt=0.0,
            le=100.0,
            description="Mass flow rate of secondary water in kg/s.",
            examples=[0.02],
        ),
    ]
    ua_w_k: Annotated[
        float,
        Field(
            default=150.0,
            gt=0.0,
            le=50000.0,
            description="Overall heat transfer coefficient * area (UA) in W/K.",
            examples=[150.0],
        ),
    ]
    specific_heat_j_kg_k: Annotated[
        float,
        Field(
            default=4184.0,
            gt=0.0,
            le=10000.0,
            description="Specific heat capacity of fluid (Cp) in J/kg·K.",
            examples=[4184.0],
        ),
    ]
    time_step_s: Annotated[
        float,
        Field(
            default=1.0,
            gt=0.0,
            le=5.0,
            description="Simulation integration time step dt in seconds (enforced dt <= 5.0s).",
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
    def validate_simulation_bounds(self) -> HeatExchangerSimulationRequest:
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


class HeatExchangerStepSchema(BaseModel):
    """Instantaneous time-series record of heat exchanger performance."""

    time_s: Annotated[float, Field(description="Elapsed simulation time in seconds.")]
    primary_inlet_temp_c: Annotated[float, Field(description="Primary hot coolant inlet temperature in °C.")]
    primary_outlet_temp_c: Annotated[float, Field(description="Primary coolant outlet temperature in °C.")]
    secondary_inlet_temp_c: Annotated[float, Field(description="Secondary water inlet temperature in °C.")]
    secondary_outlet_temp_c: Annotated[float, Field(description="Secondary water outlet temperature in °C.")]
    primary_mass_flow_kg_s: Annotated[float, Field(description="Primary mass flow rate in kg/s.")]
    secondary_mass_flow_kg_s: Annotated[float, Field(description="Secondary mass flow rate in kg/s.")]
    c_h_w_per_k: Annotated[float, Field(description="Primary hot-side heat capacity rate (C_h) in W/K.")]
    c_c_w_per_k: Annotated[float, Field(description="Secondary cold-side heat capacity rate (C_c) in W/K.")]
    c_min_w_per_k: Annotated[float, Field(description="Minimum heat capacity rate (C_min) in W/K.")]
    c_max_w_per_k: Annotated[float, Field(description="Maximum heat capacity rate (C_max) in W/K.")]
    capacity_ratio_cr: Annotated[float, Field(description="Heat capacity rate ratio (C_r = C_min / C_max).")]
    ntu: Annotated[float, Field(description="Number of Transfer Units (NTU = UA / C_min).")]
    effectiveness: Annotated[float, Field(description="Counterflow heat exchanger effectiveness (epsilon).")]
    q_max_w: Annotated[float, Field(description="Thermodynamic maximum possible heat transfer rate in Watts.")]
    heat_transfer_w: Annotated[float, Field(description="Actual instantaneous heat transfer rate (Q_HX) in Watts.")]
    cumulative_recovered_heat_j: Annotated[float, Field(description="Cumulative recovered thermal energy in Joules.")]


class HeatExchangerSimulationResponse(BaseModel):
    """Complete simulation response for Heat Recovery Exchanger."""

    parameters: HeatExchangerSimulationRequest
    effectiveness: Annotated[float, Field(description="Counterflow heat exchanger thermal effectiveness (0 to 1).")]
    ntu: Annotated[float, Field(description="Number of Transfer Units (NTU).")]
    q_max_w: Annotated[float, Field(description="Maximum possible heat transfer rate in Watts.")]
    actual_heat_transfer_w: Annotated[float, Field(description="Actual thermal heat recovery rate in Watts.")]
    final_primary_outlet_temp_c: Annotated[float, Field(description="Final primary coolant outlet temperature in °C.")]
    final_secondary_outlet_temp_c: Annotated[float, Field(description="Final secondary water outlet temperature in °C.")]
    total_recovered_energy_j: Annotated[float, Field(description="Total cumulative thermal energy recovered in Joules.")]
    simulation_duration_s: Annotated[float, Field(description="Total simulated duration in seconds.")]
    step_count: Annotated[int, Field(description="Total number of simulation steps.")]
    time_series: List[HeatExchangerStepSchema]


class HeatExchangerResetResponse(BaseModel):
    """Response returned upon resetting the heat exchanger simulation state."""

    status: str
    message: str
    elapsed_time_s: float
    cumulative_recovered_heat_j: float
