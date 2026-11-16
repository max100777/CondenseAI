"""
Pydantic schemas for CondensAI System Integration simulation API (Module 3).

Provides strict request validation, physical parameter limits,
and structured multi-subsystem time-series response formatting.
"""

from __future__ import annotations

import math
from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SystemSimulationRequest(BaseModel):
    """
    Validated user request model for running an integrated system simulation.
    Couples GPU, primary coolant loop, counterflow heat exchanger, secondary reservoir,
    and downstream AGMD heat demand.
    """

    model_config = ConfigDict(extra="forbid")

    # GPU Subsystem Parameters
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
    heat_conversion_fraction: Annotated[
        float,
        Field(
            default=0.95,
            ge=0.0,
            le=1.0,
            description="Fraction of electrical power converted to thermal energy (0 to 1).",
            examples=[0.95],
        ),
    ]
    initial_gpu_temp_c: Annotated[
        float,
        Field(
            default=35.0,
            ge=-50.0,
            le=150.0,
            description="Initial GPU junction/die temperature in °C.",
            examples=[35.0],
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
            description="Lumped thermal capacitance C_th of the GPU in J/K.",
            examples=[250.0],
        ),
    ]

    # Primary Coolant Circuit Parameters
    primary_coolant_mass_kg: Annotated[
        float,
        Field(
            default=2.0,
            gt=0.0,
            le=10000.0,
            description="Fluid mass inventory in primary GPU cooling loop in kg.",
            examples=[2.0],
        ),
    ]
    primary_mass_flow_kg_s: Annotated[
        float,
        Field(
            default=0.05,
            gt=0.0,
            le=100.0,
            description="Circulation mass flow rate of primary coolant in kg/s.",
            examples=[0.05],
        ),
    ]
    primary_initial_temp_c: Annotated[
        float,
        Field(
            default=30.0,
            ge=-50.0,
            le=120.0,
            description="Initial temperature of primary coolant inventory in °C.",
            examples=[30.0],
        ),
    ]
    primary_specific_heat_j_kg_k: Annotated[
        float,
        Field(
            default=4184.0,
            gt=0.0,
            le=10000.0,
            description="Specific heat capacity of primary coolant in J/(kg·K).",
            examples=[4184.0],
        ),
    ]
    primary_heat_loss_ua_w_k: Annotated[
        float,
        Field(
            default=2.0,
            ge=0.0,
            le=500.0,
            description="Primary loop heat loss conductance to ambient (UA) in W/K.",
            examples=[2.0],
        ),
    ]

    # Heat Exchanger Parameters
    exchanger_ua_w_k: Annotated[
        float,
        Field(
            default=150.0,
            gt=0.0,
            le=50000.0,
            description="Counterflow heat exchanger overall heat transfer coefficient * area (UA) in W/K.",
            examples=[150.0],
        ),
    ]

    # Secondary Circuit & Storage Reservoir Parameters
    secondary_water_mass_kg: Annotated[
        float,
        Field(
            default=20.0,
            gt=0.0,
            le=100000.0,
            description="Water mass inventory in secondary thermal storage reservoir in kg.",
            examples=[20.0],
        ),
    ]
    secondary_mass_flow_kg_s: Annotated[
        float,
        Field(
            default=0.02,
            gt=0.0,
            le=100.0,
            description="Circulation mass flow rate of secondary water in kg/s.",
            examples=[0.02],
        ),
    ]
    secondary_initial_temp_c: Annotated[
        float,
        Field(
            default=25.0,
            ge=-50.0,
            le=120.0,
            description="Initial temperature of secondary water reservoir in °C.",
            examples=[25.0],
        ),
    ]
    secondary_specific_heat_j_kg_k: Annotated[
        float,
        Field(
            default=4184.0,
            gt=0.0,
            le=10000.0,
            description="Specific heat capacity of secondary water in J/(kg·K).",
            examples=[4184.0],
        ),
    ]
    secondary_heat_loss_ua_w_k: Annotated[
        float,
        Field(
            default=5.0,
            ge=0.0,
            le=500.0,
            description="Secondary reservoir heat loss conductance to ambient (UA) in W/K.",
            examples=[5.0],
        ),
    ]

    # System & AGMD Downstream Demand Parameters
    ambient_temp_c: Annotated[
        float,
        Field(
            default=25.0,
            ge=-50.0,
            le=60.0,
            description="Surrounding ambient temperature in °C.",
            examples=[25.0],
        ),
    ]
    agmd_heat_demand_w: Annotated[
        float,
        Field(
            default=0.0,
            ge=0.0,
            le=50000.0,
            description="Requested downstream heat demand from AGMD desalination unit in Watts.",
            examples=[0.0],
        ),
    ]
    min_secondary_temp_c: Annotated[
        float,
        Field(
            default=20.0,
            ge=-50.0,
            le=100.0,
            description="Minimum secondary reservoir operating threshold in °C below which AGMD heat extraction is throttled.",
            examples=[20.0],
        ),
    ]
    time_step_s: Annotated[
        float,
        Field(
            default=1.0,
            gt=0.0,
            le=5.0,
            description="Simulation integration time step dt in seconds (enforced dt <= 5.0 s).",
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

    # Coupled AGMD Desalination Model (Module 4)
    enable_agmd: Annotated[
        bool,
        Field(
            default=False,
            description="Whether to couple the dynamic AGMD desalination model to the secondary loop.",
            examples=[False],
        ),
    ] = False
    agmd_membrane_pore_diameter_m: Annotated[
        float,
        Field(
            default=0.22e-6,
            gt=0.0,
            description="Mean membrane pore diameter in meters.",
            examples=[0.22e-6],
        ),
    ] = 0.22e-6
    agmd_membrane_thickness_m: Annotated[
        float,
        Field(
            default=100.0e-6,
            gt=0.0,
            description="PTFE membrane thickness in meters.",
            examples=[100.0e-6],
        ),
    ] = 100.0e-6
    agmd_membrane_porosity: Annotated[
        float,
        Field(
            default=0.70,
            gt=0.0,
            lt=1.0,
            description="Membrane porosity void fraction (0 < epsilon < 1).",
            examples=[0.70],
        ),
    ] = 0.70
    agmd_membrane_tortuosity: Annotated[
        float,
        Field(
            default=2.0,
            ge=1.0,
            description="Membrane pore tortuosity factor (tau >= 1.0).",
            examples=[2.0],
        ),
    ] = 2.0
    agmd_active_length_m: Annotated[
        float,
        Field(
            default=0.04,
            gt=0.0,
            description="Active membrane channel length in meters.",
            examples=[0.04],
        ),
    ] = 0.04
    agmd_active_width_m: Annotated[
        float,
        Field(
            default=0.04,
            gt=0.0,
            description="Active membrane channel width in meters.",
            examples=[0.04],
        ),
    ] = 0.04
    agmd_air_gap_thickness_m: Annotated[
        float,
        Field(
            default=0.003,
            gt=0.0,
            description="Stagnant air gap thickness in meters.",
            examples=[0.003],
        ),
    ] = 0.003
    agmd_initial_salinity_g_l: Annotated[
        float,
        Field(
            default=35.0,
            ge=0.0,
            description="Initial saline water salinity in g/L.",
            examples=[35.0],
        ),
    ] = 35.0
    agmd_initial_feed_mass_kg: Annotated[
        float,
        Field(
            default=10.0,
            gt=0.0,
            description="Initial feed water mass in kg.",
            examples=[10.0],
        ),
    ] = 10.0
    agmd_cold_plate_temp_c: Annotated[
        float,
        Field(
            default=25.0,
            ge=0.0,
            le=100.0,
            description="Cold plate coolant boundary temperature in °C.",
            examples=[25.0],
        ),
    ] = 25.0

    @model_validator(mode="after")
    def validate_simulation_bounds(self) -> SystemSimulationRequest:
        """Validate logical and numerical limits across fields."""
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


class SystemSimulationStepSchema(BaseModel):
    """Instantaneous time-series record of integrated system performance."""

    time_s: Annotated[float, Field(description="Elapsed simulation time in seconds.")]

    # GPU
    gpu_temp_c: Annotated[float, Field(description="Current GPU junction temperature in °C.")]
    heat_generated_w: Annotated[float, Field(description="Instantaneous GPU thermal power generated in Watts.")]
    heat_to_coolant_w: Annotated[float, Field(description="Heat power transferred from GPU into primary coolant in Watts.")]
    net_heat_w: Annotated[float, Field(description="Net thermal power accumulating in GPU die in Watts.")]

    # Primary Circuit
    primary_coolant_temp_c: Annotated[float, Field(description="Primary coolant loop inventory temperature in °C.")]
    primary_heat_capacity_j_per_k: Annotated[float, Field(description="Primary loop thermal capacitance (m_p * Cp,p) in J/K.")]
    heat_from_gpu_w: Annotated[float, Field(description="Thermal heat rate absorbed from GPU in Watts.")]
    heat_to_hx_w: Annotated[float, Field(description="Thermal heat rate transferred to heat exchanger in Watts.")]
    primary_heat_loss_w: Annotated[float, Field(description="Primary loop ambient heat loss rate in Watts.")]

    # Heat Exchanger
    hx_heat_transfer_w: Annotated[float, Field(description="Heat exchanger actual thermal recovery rate in Watts.")]
    hx_effectiveness: Annotated[float, Field(description="Counterflow heat exchanger thermal effectiveness (0 to 1).")]
    hx_ntu: Annotated[float, Field(description="Number of Transfer Units (NTU).")]
    hx_primary_outlet_temp_c: Annotated[float, Field(description="Exchanger primary coolant outlet temperature in °C.")]
    hx_secondary_outlet_temp_c: Annotated[float, Field(description="Exchanger secondary heated water outlet temperature in °C.")]

    # Secondary Circuit & Reservoir
    secondary_reservoir_temp_c: Annotated[float, Field(description="Secondary water reservoir bulk temperature in °C.")]
    secondary_stored_energy_j: Annotated[float, Field(description="Secondary reservoir stored thermal energy relative to 0 °C in Joules.")]
    heat_received_hx_w: Annotated[float, Field(description="Heat rate received from heat exchanger in Watts.")]
    heat_to_agmd_w: Annotated[float, Field(description="Actual thermal heat rate supplied to AGMD desalination unit in Watts.")]
    unmet_agmd_demand_w: Annotated[float, Field(description="Unmet AGMD thermal demand rate in Watts.")]
    secondary_heat_loss_w: Annotated[float, Field(description="Secondary reservoir ambient heat loss rate in Watts.")]

    # System Energy Conservation
    cumulative_heat_generated_j: Annotated[float, Field(description="Cumulative electrical heat generated by GPU in Joules.")]
    cumulative_heat_to_coolant_j: Annotated[float, Field(description="Cumulative heat transferred into primary coolant in Joules.")]
    cumulative_heat_recovered_hx_j: Annotated[float, Field(description="Cumulative heat recovered through heat exchanger in Joules.")]
    cumulative_heat_to_agmd_j: Annotated[float, Field(description="Cumulative thermal energy supplied to AGMD in Joules.")]
    cumulative_ambient_loss_j: Annotated[float, Field(description="Cumulative heat dissipated to surroundings in Joules.")]
    energy_balance_residual_j: Annotated[float, Field(description="First-Law energy balance residual (should be ~0 J) in Joules.")]

    # Coupled AGMD Permeate Metrics (Module 4)
    freshwater_production_rate_kg_s: Annotated[Optional[float], Field(default=None, description="Permeate freshwater production rate in kg/s.")] = None
    freshwater_production_rate_l_h: Annotated[Optional[float], Field(default=None, description="Freshwater production rate in L/h.")] = None
    cumulative_freshwater_mass_kg: Annotated[Optional[float], Field(default=None, description="Cumulative freshwater produced in kg.")] = None
    cumulative_freshwater_volume_l: Annotated[Optional[float], Field(default=None, description="Cumulative freshwater produced in Litres.")] = None
    feed_salinity_g_l: Annotated[Optional[float], Field(default=None, description="Current feed salinity in g/L.")] = None
    agmd_hot_membrane_temp_c: Annotated[Optional[float], Field(default=None, description="Hot membrane surface temperature T_mh in °C.")] = None
    agmd_cold_condensing_temp_c: Annotated[Optional[float], Field(default=None, description="Cold condensing surface temperature T_mc in °C.")] = None
    agmd_vapor_flux_kg_m2_s: Annotated[Optional[float], Field(default=None, description="Vapor mass flux in kg/(m²·s).")] = None


class SystemSimulationResponse(BaseModel):
    """Complete response model for integrated system simulation."""

    parameters: SystemSimulationRequest
    final_gpu_temp_c: Annotated[float, Field(description="Final GPU junction temperature in °C.")]
    final_primary_coolant_temp_c: Annotated[float, Field(description="Final primary coolant loop temperature in °C.")]
    final_secondary_reservoir_temp_c: Annotated[float, Field(description="Final secondary reservoir temperature in °C.")]
    total_heat_generated_j: Annotated[float, Field(description="Total electrical heat generated in Joules.")]
    total_heat_to_coolant_j: Annotated[float, Field(description="Total heat transferred from GPU to coolant in Joules.")]
    total_heat_recovered_hx_j: Annotated[float, Field(description="Total heat transferred across heat exchanger in Joules.")]
    total_heat_to_agmd_j: Annotated[float, Field(description="Total thermal energy supplied to AGMD in Joules.")]
    total_unmet_agmd_demand_j: Annotated[float, Field(description="Total unmet AGMD thermal demand in Joules.")]
    total_ambient_loss_j: Annotated[float, Field(description="Total thermal energy lost to ambient in Joules.")]
    system_energy_balance_residual_j: Annotated[float, Field(description="First-Law system energy conservation residual in Joules.")]
    total_freshwater_produced_kg: Annotated[Optional[float], Field(default=None, description="Total cumulative freshwater produced in kg.")] = None
    total_freshwater_produced_l: Annotated[Optional[float], Field(default=None, description="Total cumulative freshwater produced in Litres.")] = None
    simulation_duration_s: Annotated[float, Field(description="Total simulated duration in seconds.")]
    step_count: Annotated[int, Field(description="Total number of simulation steps.")]
    time_series: List[SystemSimulationStepSchema]


class SystemResetResponse(BaseModel):
    """Response returned upon resetting the integrated system simulation state."""

    status: str
    message: str
    elapsed_time_s: float
    gpu_temp_c: float
    primary_coolant_temp_c: float
    secondary_reservoir_temp_c: float
