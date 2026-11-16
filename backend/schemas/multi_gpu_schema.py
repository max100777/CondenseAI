"""
Pydantic schemas for Multi-GPU Scaling and Thermal Simulation API (Module 5).

Provides request validation, GPU configuration arrays, GPU comparison models,
and structured multi-GPU time-series response models.
"""

from __future__ import annotations

import math
from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.schemas.analytics_schema import AnalyticsSummarySchema


class GPUConfigSchema(BaseModel):
    """Configuration for an individual GPU in the multi-GPU array."""

    model_config = ConfigDict(extra="forbid")

    gpu_id: Annotated[str, Field(default="GPU-1", description="Unique identifier for the GPU.")]
    power_w: Annotated[
        float,
        Field(
            default=350.0,
            ge=0.0,
            le=50000.0,
            description="Electrical power consumed by GPU in Watts.",
            examples=[350.0],
        ),
    ]
    heat_conversion_fraction: Annotated[
        float,
        Field(
            default=0.95,
            ge=0.0,
            le=1.0,
            description="Fraction of electrical power converted to thermal dissipation.",
            examples=[0.95],
        ),
    ]
    initial_temp_c: Annotated[
        float,
        Field(
            default=35.0,
            ge=-50.0,
            le=150.0,
            description="Starting GPU die temperature in °C.",
            examples=[35.0],
        ),
    ]
    thermal_resistance_k_per_w: Annotated[
        float,
        Field(
            default=0.12,
            gt=0.0,
            le=10.0,
            description="Thermal resistance between GPU die and coolant loop in K/W.",
            examples=[0.12],
        ),
    ]
    thermal_capacitance_j_per_k: Annotated[
        float,
        Field(
            default=250.0,
            gt=0.0,
            le=100000.0,
            description="Thermal heat capacity of GPU package in J/K.",
            examples=[250.0],
        ),
    ]
    max_temp_c: Annotated[
        Optional[float],
        Field(
            default=None,
            ge=40.0,
            le=150.0,
            description="Optional maximum operating temperature threshold for thermal warning/throttling in °C.",
        ),
    ] = None


class GPUStateSchema(BaseModel):
    """Dynamic thermodynamic state of an individual GPU at a simulation step."""

    model_config = ConfigDict(extra="forbid")

    gpu_id: Annotated[str, Field(description="GPU identifier.")]
    power_w: Annotated[float, Field(description="Electrical power input in Watts.")]
    current_temp_c: Annotated[float, Field(description="Current junction temperature in °C.")]
    heat_generated_w: Annotated[float, Field(description="Heat generation rate in Watts.")]
    heat_to_coolant_w: Annotated[float, Field(description="Heat dissipation rate to primary coolant in Watts.")]
    net_heat_w: Annotated[float, Field(description="Net thermal rate absorbed by GPU thermal mass in Watts.")]
    stored_energy_j: Annotated[float, Field(description="Stored thermal energy rise relative to initial temp in Joules.")]
    status: Annotated[str, Field(default="nominal", description="Thermal status: nominal or warning.")]


class MultiGPUStepSchema(BaseModel):
    """Time-series record for a discrete multi-GPU simulation time step."""

    model_config = ConfigDict(extra="forbid")

    time_s: Annotated[float, Field(description="Elapsed simulation time in seconds.")]
    gpu_states: Annotated[List[GPUStateSchema], Field(description="Array of individual GPU dynamic states.")]
    aggregate_heat_generated_w: Annotated[float, Field(description="Sum of all GPU heat generation rates in Watts.")]
    aggregate_heat_to_coolant_w: Annotated[
        float, Field(description="Total heat rate transferred to shared primary coolant in Watts.")
    ]
    primary_coolant_temp_c: Annotated[float, Field(description="Shared primary coolant loop temperature in °C.")]
    primary_heat_loss_w: Annotated[float, Field(description="Primary coolant ambient heat loss in Watts.")]
    hx_heat_transfer_w: Annotated[float, Field(description="Heat transferred across heat exchanger in Watts.")]
    hx_effectiveness: Annotated[float, Field(description="Heat exchanger thermal effectiveness.")]
    hx_ntu: Annotated[float, Field(description="Heat exchanger Number of Transfer Units.")]
    hx_primary_outlet_temp_c: Annotated[float, Field(description="Primary coolant exchanger outlet temperature in °C.")]
    hx_secondary_outlet_temp_c: Annotated[float, Field(description="Secondary water exchanger outlet temperature in °C.")]
    secondary_reservoir_temp_c: Annotated[float, Field(description="Secondary water reservoir bulk temperature in °C.")]
    secondary_stored_energy_j: Annotated[
        float, Field(description="Secondary reservoir stored thermal energy relative to 0 °C in Joules.")
    ]
    secondary_heat_loss_w: Annotated[float, Field(description="Secondary reservoir ambient heat loss in Watts.")]
    heat_to_agmd_w: Annotated[float, Field(description="Actual thermal heat rate supplied to AGMD in Watts.")]
    unmet_agmd_demand_w: Annotated[float, Field(description="Unmet AGMD thermal demand in Watts.")]
    cumulative_heat_generated_j: Annotated[float, Field(description="Total aggregate heat generated in Joules.")]
    cumulative_heat_to_coolant_j: Annotated[
        float, Field(description="Total heat transferred into primary coolant in Joules.")
    ]
    cumulative_heat_recovered_hx_j: Annotated[float, Field(description="Total heat recovered across HX in Joules.")]
    cumulative_heat_to_agmd_j: Annotated[float, Field(description="Total thermal energy supplied to AGMD in Joules.")]
    cumulative_ambient_loss_j: Annotated[float, Field(description="Total heat dissipated to surroundings in Joules.")]
    energy_balance_residual_j: Annotated[
        float, Field(description="First-Law system energy conservation residual in Joules.")
    ]

    # Coupled AGMD Desalination Permeate Metrics
    freshwater_production_rate_kg_s: Annotated[
        Optional[float], Field(default=None, description="Permeate freshwater production rate in kg/s.")
    ] = None
    freshwater_production_rate_l_h: Annotated[
        Optional[float], Field(default=None, description="Freshwater production rate in L/h.")
    ] = None
    cumulative_freshwater_mass_kg: Annotated[
        Optional[float], Field(default=None, description="Cumulative freshwater produced in kg.")
    ] = None
    cumulative_freshwater_volume_l: Annotated[
        Optional[float], Field(default=None, description="Cumulative freshwater produced in Litres.")
    ] = None
    feed_salinity_g_l: Annotated[
        Optional[float], Field(default=None, description="Current feed salinity in g/L.")
    ] = None
    agmd_hot_membrane_temp_c: Annotated[
        Optional[float], Field(default=None, description="Hot membrane surface temperature in °C.")
    ] = None
    agmd_cold_condensing_temp_c: Annotated[
        Optional[float], Field(default=None, description="Cold condensing surface temperature in °C.")
    ] = None
    agmd_vapor_flux_kg_m2_s: Annotated[
        Optional[float], Field(default=None, description="Vapor mass flux in kg/(m²·s).")
    ] = None


class GPUComparisonItem(BaseModel):
    """Comparative summary metrics for an individual GPU."""

    model_config = ConfigDict(extra="forbid")

    gpu_id: str
    power_w: float
    final_temp_c: float
    heat_generated_w: float
    heat_to_coolant_w: float
    stored_energy_j: float
    status: str


class MultiGPUSimulationRequest(BaseModel):
    """Request model for running a multi-GPU integrated simulation."""

    model_config = ConfigDict(extra="forbid")

    gpus: Annotated[
        List[GPUConfigSchema],
        Field(
            default_factory=lambda: [GPUConfigSchema(gpu_id="GPU-1", power_w=350.0)],
            min_length=1,
            max_length=64,
            description="List of GPU configurations sharing the primary coolant circuit.",
        ),
    ]

    # Primary Circuit
    primary_coolant_mass_kg: Annotated[
        float, Field(default=2.0, gt=0.0, le=10000.0, description="Mass of primary coolant in kg.")
    ]
    primary_mass_flow_kg_s: Annotated[
        float, Field(default=0.05, gt=0.0, le=100.0, description="Primary coolant mass flow rate in kg/s.")
    ]
    primary_initial_temp_c: Annotated[
        float, Field(default=30.0, ge=-20.0, le=120.0, description="Initial primary coolant temperature in °C.")
    ]
    primary_specific_heat_j_kg_k: Annotated[
        float, Field(default=4184.0, gt=1000.0, le=6000.0, description="Primary coolant specific heat in J/(kg·K).")
    ]
    primary_heat_loss_ua_w_k: Annotated[
        float, Field(default=2.0, ge=0.0, le=1000.0, description="Primary loop ambient heat loss UA in W/K.")
    ]

    # Heat Exchanger
    exchanger_ua_w_k: Annotated[
        float, Field(default=150.0, gt=0.0, le=50000.0, description="Counterflow heat exchanger overall UA in W/K.")
    ]

    # Secondary Circuit
    secondary_water_mass_kg: Annotated[
        float, Field(default=20.0, gt=0.0, le=100000.0, description="Secondary reservoir water mass in kg.")
    ]
    secondary_mass_flow_kg_s: Annotated[
        float, Field(default=0.02, gt=0.0, le=100.0, description="Secondary water mass flow rate in kg/s.")
    ]
    secondary_initial_temp_c: Annotated[
        float, Field(default=25.0, ge=0.0, le=100.0, description="Initial secondary reservoir temperature in °C.")
    ]
    secondary_specific_heat_j_kg_k: Annotated[
        float, Field(default=4184.0, gt=1000.0, le=6000.0, description="Secondary water specific heat in J/(kg·K).")
    ]
    secondary_heat_loss_ua_w_k: Annotated[
        float, Field(default=5.0, ge=0.0, le=1000.0, description="Secondary reservoir ambient heat loss UA in W/K.")
    ]

    # System & AGMD Controls
    ambient_temp_c: Annotated[
        float, Field(default=25.0, ge=-40.0, le=60.0, description="Ambient surrounding temperature in °C.")
    ]
    agmd_heat_demand_w: Annotated[
        float, Field(default=0.0, ge=0.0, le=100000.0, description="AGMD thermal power demand in Watts.")
    ]
    min_secondary_temp_c: Annotated[
        float,
        Field(
            default=20.0,
            ge=0.0,
            le=80.0,
            description="Minimum secondary reservoir temperature safety threshold in °C.",
        ),
    ]
    time_step_s: Annotated[
        float,
        Field(
            default=1.0,
            gt=0.0,
            le=5.0,
            description="Simulation time step in seconds (0 < dt <= 5.0 s).",
        ),
    ]
    simulation_duration_s: Annotated[
        float,
        Field(
            default=60.0,
            gt=0.0,
            le=360000.0,
            description="Total simulation duration in seconds.",
        ),
    ]

    # Coupled AGMD Desalination Model
    enable_agmd: Annotated[
        bool, Field(default=False, description="Enable coupled AGMD desalination physical model.")
    ]
    agmd_membrane_pore_diameter_m: Annotated[
        float, Field(default=0.22e-6, gt=0.01e-6, le=5.0e-6, description="Membrane pore diameter in meters.")
    ]
    agmd_membrane_thickness_m: Annotated[
        float, Field(default=100.0e-6, gt=1.0e-6, le=1000.0e-6, description="Membrane thickness in meters.")
    ]
    agmd_membrane_porosity: Annotated[
        float, Field(default=0.70, gt=0.0, lt=1.0, description="Membrane porosity (0 to 1).")
    ]
    agmd_membrane_tortuosity: Annotated[
        float, Field(default=2.0, ge=1.0, le=10.0, description="Membrane pore tortuosity.")
    ]
    agmd_active_length_m: Annotated[
        float, Field(default=0.04, gt=0.001, le=2.0, description="Active membrane length in meters.")
    ]
    agmd_active_width_m: Annotated[
        float, Field(default=0.04, gt=0.001, le=2.0, description="Active membrane width in meters.")
    ]
    agmd_air_gap_thickness_m: Annotated[
        float, Field(default=0.003, ge=0.0001, le=0.05, description="Air gap thickness in meters.")
    ]
    agmd_initial_salinity_g_l: Annotated[
        float, Field(default=35.0, ge=0.0, le=350.0, description="Initial feed water salinity in g/L.")
    ]
    agmd_initial_feed_mass_kg: Annotated[
        float, Field(default=10.0, gt=0.0, le=10000.0, description="Initial feed water mass in kg.")
    ]
    agmd_cold_plate_temp_c: Annotated[
        float, Field(default=25.0, ge=0.0, le=60.0, description="Cold condensing plate temperature in °C.")
    ]

    @model_validator(mode="after")
    def validate_simulation_bounds(self) -> MultiGPUSimulationRequest:
        """Validate operational limits and safety constraints."""
        step_count = self.simulation_duration_s / self.time_step_s
        if step_count > 100000:
            raise ValueError(
                f"Requested number of simulation steps ({step_count:.0f}) exceeds the safety limit of 100,000 steps. "
                "Increase time_step_s or reduce simulation_duration_s."
            )

        gpu_ids = [g.gpu_id for g in self.gpus]
        if len(gpu_ids) != len(set(gpu_ids)):
            raise ValueError(f"GPU IDs must be unique across the array, found duplicates: {gpu_ids}")

        return self


class MultiGPUSimulationResponse(BaseModel):
    """Complete response returned by multi-GPU integrated simulation."""

    parameters: MultiGPUSimulationRequest
    gpu_count: Annotated[int, Field(description="Total number of active GPUs in the array.")]
    aggregate_power_w: Annotated[float, Field(description="Total electrical power consumed by all GPUs in Watts.")]
    gpu_comparison: Annotated[List[GPUComparisonItem], Field(description="Per-GPU comparative performance summaries.")]
    final_primary_coolant_temp_c: Annotated[float, Field(description="Final shared primary coolant temperature in °C.")]
    final_secondary_reservoir_temp_c: Annotated[
        float, Field(description="Final secondary reservoir temperature in °C.")
    ]
    total_heat_generated_j: Annotated[float, Field(description="Total aggregate GPU heat generated in Joules.")]
    total_heat_to_coolant_j: Annotated[float, Field(description="Total heat transferred to primary coolant in Joules.")]
    total_heat_recovered_hx_j: Annotated[float, Field(description="Total heat transferred across HX in Joules.")]
    total_heat_to_agmd_j: Annotated[float, Field(description="Total thermal energy supplied to AGMD in Joules.")]
    total_ambient_loss_j: Annotated[float, Field(description="Total heat lost to ambient in Joules.")]
    system_energy_balance_residual_j: Annotated[
        float, Field(description="First-Law system energy conservation residual in Joules.")
    ]
    total_freshwater_produced_kg: Annotated[
        Optional[float], Field(default=None, description="Total cumulative freshwater produced in kg.")
    ] = None
    total_freshwater_produced_l: Annotated[
        Optional[float], Field(default=None, description="Total cumulative freshwater produced in Litres.")
    ] = None
    simulation_duration_s: Annotated[float, Field(description="Total simulated duration in seconds.")]
    step_count: Annotated[int, Field(description="Total number of simulation steps.")]
    analytics: Annotated[
        Optional[AnalyticsSummarySchema], Field(default=None, description="Module 5 analytics summary KPIs.")
    ] = None
    time_series: List[MultiGPUStepSchema]


class MultiGPUResetResponse(BaseModel):
    """Response returned upon resetting multi-GPU simulation state."""

    status: str
    message: str
    gpu_count: int
    primary_coolant_temp_c: float
    secondary_reservoir_temp_c: float
