"""
Pydantic schemas for CondensAI AGMD Desalination simulation API (Module 4).

Provides strict request validation, physical parameter bounds,
and standardized time-series response formatting.
"""

from __future__ import annotations

import math
from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AGMDRequest(BaseModel):
    """
    Validated user request model for running an AGMD desalination simulation.
    All physical parameters have sensible default values and strict physical limits.
    """

    model_config = ConfigDict(extra="forbid")

    # Membrane specifications
    membrane_pore_diameter_m: Annotated[
        float,
        Field(
            default=0.22e-6,
            gt=0.0,
            le=1e-3,
            description="Mean membrane pore diameter in meters (e.g. 0.22 µm).",
            examples=[0.22e-6],
        ),
    ]
    membrane_thickness_m: Annotated[
        float,
        Field(
            default=100.0e-6,
            gt=0.0,
            le=5e-3,
            description="PTFE membrane thickness in meters (e.g. 100 µm).",
            examples=[100.0e-6],
        ),
    ]
    membrane_porosity: Annotated[
        float,
        Field(
            default=0.70,
            gt=0.0,
            lt=1.0,
            description="Membrane porosity void fraction (0 < epsilon < 1).",
            examples=[0.70],
        ),
    ]
    membrane_tortuosity: Annotated[
        float,
        Field(
            default=2.0,
            ge=1.0,
            le=10.0,
            description="Membrane pore tortuosity factor (tau >= 1.0).",
            examples=[2.0],
        ),
    ]
    membrane_thermal_conductivity_w_m_k: Annotated[
        float,
        Field(
            default=0.25,
            gt=0.0,
            le=5.0,
            description="Thermal conductivity of porous membrane in W/(m·K).",
            examples=[0.25],
        ),
    ]
    active_length_m: Annotated[
        float,
        Field(
            default=0.04,
            gt=0.0,
            le=2.0,
            description="Active membrane channel length in meters.",
            examples=[0.04],
        ),
    ]
    active_width_m: Annotated[
        float,
        Field(
            default=0.04,
            gt=0.0,
            le=2.0,
            description="Active membrane channel width in meters.",
            examples=[0.04],
        ),
    ]

    # Air gap specifications
    air_gap_thickness_m: Annotated[
        float,
        Field(
            default=0.003,
            gt=0.0,
            le=0.05,
            description="Stagnant air gap thickness in meters (e.g. 3 mm).",
            examples=[0.003],
        ),
    ]

    # Hot feed specifications
    initial_feed_temp_c: Annotated[
        float,
        Field(
            default=70.0,
            ge=0.0,
            le=100.0,
            description="Initial hot saline feed temperature in °C.",
            examples=[70.0],
        ),
    ]
    initial_salinity_g_l: Annotated[
        float,
        Field(
            default=35.0,
            ge=0.0,
            le=350.0,
            description="Initial feed water salinity in g/L (NaCl / total dissolved salts).",
            examples=[35.0],
        ),
    ]
    initial_feed_mass_kg: Annotated[
        float,
        Field(
            default=10.0,
            gt=0.0,
            le=10000.0,
            description="Initial saline water mass in feed inventory in kg.",
            examples=[10.0],
        ),
    ]
    feed_specific_heat_j_kg_k: Annotated[
        float,
        Field(
            default=4184.0,
            gt=1000.0,
            le=6000.0,
            description="Specific heat capacity of saline feed in J/(kg·K).",
            examples=[4184.0],
        ),
    ]
    feed_density_kg_m3: Annotated[
        float,
        Field(
            default=1025.0,
            gt=800.0,
            le=1400.0,
            description="Density of saline feed brine in kg/m³.",
            examples=[1025.0],
        ),
    ]
    hot_side_htc_w_m2_k: Annotated[
        float,
        Field(
            default=1000.0,
            gt=1.0,
            le=20000.0,
            description="Convective heat transfer coefficient on hot feed side in W/(m²·K).",
            examples=[1000.0],
        ),
    ]

    # Cold condensing plate specifications
    cold_plate_temp_c: Annotated[
        float,
        Field(
            default=25.0,
            ge=0.0,
            le=100.0,
            description="Cold condensing plate temperature in °C.",
            examples=[25.0],
        ),
    ]
    cold_side_htc_w_m2_k: Annotated[
        float,
        Field(
            default=1000.0,
            gt=1.0,
            le=20000.0,
            description="Convective heat transfer coefficient on cold plate side in W/(m²·K).",
            examples=[1000.0],
        ),
    ]

    # Optional power throttle
    available_thermal_power_w: Annotated[
        Optional[float],
        Field(
            default=None,
            ge=0.0,
            le=100000.0,
            description="Optional maximum available thermal power (W) supplying the AGMD module.",
            examples=[None],
        ),
    ]

    # Simulation controls
    time_step_s: Annotated[
        float,
        Field(
            default=1.0,
            gt=0.0,
            le=5.0,
            description="Discrete integration time step dt in seconds (0 < dt <= 5.0 s).",
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
    def validate_simulation_bounds(self) -> AGMDRequest:
        """Validate logical limits and numerical safety across fields."""
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
                "Increase time_step_s or reduce simulation_duration_s."
            )

        return self


class AGMDStepSchema(BaseModel):
    """Instantaneous time-series record of AGMD performance at a discrete time step."""

    time_s: Annotated[float, Field(description="Elapsed simulation time in seconds.")]
    bulk_feed_temp_c: Annotated[float, Field(description="Hot bulk feed brine temperature in °C.")]
    hot_membrane_temp_c: Annotated[float, Field(description="Hot membrane surface temperature T_mh in °C.")]
    cold_condensing_temp_c: Annotated[float, Field(description="Cold condensing surface temperature T_mc in °C.")]
    cold_plate_temp_c: Annotated[float, Field(description="Cold plate coolant boundary temperature in °C.")]
    temperature_difference_membrane_c: Annotated[
        float, Field(description="Trans-membrane temperature difference (T_mh - T_mc) in °C.")
    ]
    hot_sat_vapor_pressure_pa: Annotated[float, Field(description="Saturation vapor pressure at hot surface in Pa.")]
    hot_effective_vapor_pressure_pa: Annotated[
        float, Field(description="Effective salinity-depressed vapor pressure at hot surface in Pa.")
    ]
    cold_sat_vapor_pressure_pa: Annotated[float, Field(description="Saturation vapor pressure at cold surface in Pa.")]
    vapor_pressure_difference_pa: Annotated[float, Field(description="Driving trans-membrane vapor pressure difference in Pa.")]
    membrane_resistance_pa_s_m2_per_kg: Annotated[
        float, Field(description="Knudsen + molecular mass transfer resistance across membrane in Pa·s·m²/kg.")
    ]
    air_gap_resistance_pa_s_m2_per_kg: Annotated[
        float, Field(description="Molecular mass transfer resistance across stagnant air gap in Pa·s·m²/kg.")
    ]
    total_mass_transfer_resistance_pa_s_m2_per_kg: Annotated[
        float, Field(description="Total series mass transfer resistance in Pa·s·m²/kg.")
    ]
    vapor_flux_kg_m2_s: Annotated[float, Field(description="Instantaneous water vapor mass flux in kg/(m²·s).")]
    freshwater_production_rate_kg_s: Annotated[float, Field(description="Instantaneous freshwater production rate in kg/s.")]
    freshwater_production_rate_l_h: Annotated[float, Field(description="Freshwater production rate in Litres per hour (L/h).")]
    flux_l_m2_h: Annotated[float, Field(description="Water permeate flux in LMH (L/(m²·h)).")]
    cumulative_freshwater_mass_kg: Annotated[float, Field(description="Cumulative freshwater yield in kg.")]
    cumulative_freshwater_volume_l: Annotated[float, Field(description="Cumulative freshwater yield in Litres.")]
    feed_inventory_mass_kg: Annotated[float, Field(description="Remaining feed solution mass in inventory in kg.")]
    feed_salinity_g_l: Annotated[float, Field(description="Current feed solution salinity in g/L.")]
    latent_heat_flux_w: Annotated[float, Field(description="Instantaneous latent heat of evaporation demand in Watts.")]
    conductive_heat_flux_w: Annotated[float, Field(description="Instantaneous parasitic conductive heat loss in Watts.")]
    total_agmd_heat_demand_w: Annotated[float, Field(description="Total AGMD thermal power demand (latent + conductive) in Watts.")]
    actual_heat_supplied_w: Annotated[float, Field(description="Actual thermal power supplied in Watts.")]
    unmet_heat_demand_w: Annotated[float, Field(description="Unmet thermal power demand in Watts.")]
    cold_plate_heat_rejection_w: Annotated[float, Field(description="Total heat rejected to cold plate in Watts.")]
    cumulative_thermal_energy_consumed_j: Annotated[float, Field(description="Cumulative thermal energy consumed in Joules.")]
    iterations: Annotated[int, Field(description="Number of iterations required to resolve surface temperatures.")]
    converged: Annotated[float, Field(description="1.0 if thermal polarization solver converged, 0.0 otherwise.")]
    energy_balance_residual_w: Annotated[float, Field(description="Thermal energy residual (Supplied - Consumed) in Watts.")]


class AGMDResponse(BaseModel):
    """Complete simulation response for AGMD Desalination."""

    parameters: AGMDRequest
    total_freshwater_produced_kg: Annotated[float, Field(description="Total cumulative freshwater produced in kg.")]
    total_freshwater_produced_l: Annotated[float, Field(description="Total cumulative freshwater produced in Litres.")]
    average_flux_l_m2_h: Annotated[float, Field(description="Time-averaged permeate flux in L/(m²·h).")]
    total_thermal_energy_consumed_j: Annotated[float, Field(description="Total thermal energy consumed in Joules.")]
    final_feed_temp_c: Annotated[float, Field(description="Final bulk feed temperature in °C.")]
    final_feed_salinity_g_l: Annotated[float, Field(description="Final feed water salinity in g/L.")]
    final_feed_mass_kg: Annotated[float, Field(description="Final remaining feed water mass in kg.")]
    simulation_duration_s: Annotated[float, Field(description="Total simulated duration in seconds.")]
    step_count: Annotated[int, Field(description="Total number of simulation steps.")]
    time_series: List[AGMDStepSchema]


class AGMDResetResponse(BaseModel):
    """Response returned upon resetting the AGMD simulation state."""

    status: str
    message: str
    elapsed_time_s: float
    cumulative_freshwater_volume_l: float
