"""
Pydantic schemas for CondensAI Water Production Analytics API (Module 5).

Provides structured request models, KPI summaries, and time-series serialization
for water production, membrane flux, and thermodynamic efficiencies.
"""

from __future__ import annotations

from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AnalyticsTimeSeriesPointSchema(BaseModel):
    """Discrete time-series performance entry for water production and thermal metrics."""

    model_config = ConfigDict(extra="forbid")

    time_s: Annotated[float, Field(description="Elapsed simulation time in seconds.")]
    freshwater_production_rate_l_h: Annotated[
        float, Field(description="Instantaneous freshwater production rate in Litres per hour (L/h).")
    ]
    cumulative_freshwater_volume_l: Annotated[
        float, Field(description="Cumulative freshwater yield in Litres.")
    ]
    flux_lmh: Annotated[float, Field(description="Trans-membrane water vapor flux in LMH (L/(m²·h)).")]
    agmd_thermal_power_w: Annotated[float, Field(description="AGMD thermal power consumption in Watts.")]
    feed_salinity_g_l: Annotated[
        Optional[float], Field(default=None, description="Feed brine salinity in g/L.")
    ] = None
    feed_temp_c: Annotated[
        Optional[float], Field(default=None, description="Hot feed temperature in °C.")
    ] = None


class AnalyticsSummarySchema(BaseModel):
    """
    Consolidated performance summary across water production, thermal recovery,
    and thermodynamic efficiencies.
    """

    model_config = ConfigDict(extra="forbid")

    simulation_duration_s: Annotated[float, Field(description="Total simulated duration in seconds.")]
    total_gpu_heat_generated_j: Annotated[
        Optional[float], Field(default=None, description="Total GPU heat generated in Joules (None for standalone AGMD).")
    ] = None
    total_heat_recovered_j: Annotated[
        Optional[float], Field(default=None, description="Total heat transferred across heat exchanger in Joules.")
    ] = None
    total_agmd_energy_j: Annotated[float, Field(description="Total thermal energy consumed by AGMD in Joules.")]
    total_agmd_energy_kwh: Annotated[
        float, Field(description="Total thermal energy consumed by AGMD in thermal kilowatt-hours (kWh_th).")
    ]
    total_freshwater_mass_kg: Annotated[float, Field(description="Total cumulative freshwater yield in kilograms (kg).")]
    total_freshwater_volume_l: Annotated[float, Field(description="Total cumulative freshwater yield in Litres (L).")]
    total_freshwater_volume_ml: Annotated[float, Field(description="Total cumulative freshwater yield in Millilitres (mL).")]
    instantaneous_production_l_h: Annotated[
        float, Field(description="Instantaneous freshwater production rate at simulation end in L/h.")
    ]
    average_production_l_h: Annotated[
        float, Field(description="Average freshwater production rate over the simulation duration in L/h.")
    ]
    average_flux_lmh: Annotated[float, Field(description="Time-weighted average membrane flux in LMH (L/(m²·h)).")]
    maximum_flux_lmh: Annotated[float, Field(description="Peak membrane flux during the simulation in LMH.")]
    minimum_flux_lmh: Annotated[float, Field(description="Minimum membrane flux during the simulation in LMH.")]
    heat_exchanger_recovery_percent: Annotated[
        Optional[float],
        Field(
            default=None,
            description="Exchanger recovery efficiency eta_HX = (E_HX / E_GPU) * 100% (None if GPU heat unavailable).",
        ),
    ] = None
    heat_utilization_percent: Annotated[
        Optional[float],
        Field(
            default=None,
            description="Heat utilization efficiency eta_util = (E_AGMD / E_HX) * 100% (None if HX heat unavailable).",
        ),
    ] = None
    gpu_to_agmd_efficiency_percent: Annotated[
        Optional[float],
        Field(
            default=None,
            description="Overall conversion efficiency eta_GPU->AGMD = (E_AGMD / E_GPU) * 100% (None if GPU heat unavailable).",
        ),
    ] = None
    specific_thermal_energy_kwh_m3: Annotated[
        Optional[float],
        Field(
            default=None,
            description="Specific Thermal Energy Consumption STEC = E_AGMD,kWh / V_water,m³ in kWh_th/m³ (None if zero water produced).",
        ),
    ] = None
    water_recovery_percent: Annotated[
        Optional[float],
        Field(
            default=None,
            description="Feed water recovery ratio = (m_freshwater / m_initial_feed) * 100% (None if feed mass unavailable).",
        ),
    ] = None
    final_feed_salinity_g_l: Annotated[
        Optional[float], Field(default=None, description="Final salinity of remaining brine in g/L.")
    ] = None
    energy_balance_residual_j: Annotated[
        Optional[float], Field(default=None, description="System First-Law energy conservation residual in Joules.")
    ] = None


class AnalyticsCalculationRequest(BaseModel):
    """Request model for computing analytics from supplied time-series arrays or simulation outputs."""

    model_config = ConfigDict(extra="forbid")

    time_points_s: Annotated[List[float], Field(min_length=1, description="Simulation timestamps in seconds.")]
    freshwater_mass_kg: Annotated[List[float], Field(description="Cumulative freshwater mass array in kg.")]
    freshwater_rates_l_h: Annotated[List[float], Field(description="Freshwater production rate array in L/h.")]
    fluxes_lmh: Annotated[List[float], Field(description="Trans-membrane vapor flux array in LMH.")]
    agmd_powers_w: Annotated[List[float], Field(description="AGMD thermal power consumption array in Watts.")]
    feed_salinities_g_l: Annotated[
        Optional[List[float]], Field(default=None, description="Optional feed salinity array in g/L.")
    ] = None
    feed_temps_c: Annotated[
        Optional[List[float]], Field(default=None, description="Optional feed temperature array in °C.")
    ] = None
    total_gpu_heat_j: Annotated[
        Optional[float], Field(default=None, description="Optional cumulative GPU heat generated in Joules.")
    ] = None
    total_hx_heat_j: Annotated[
        Optional[float], Field(default=None, description="Optional cumulative heat transferred across exchanger in Joules.")
    ] = None
    initial_feed_mass_kg: Annotated[
        Optional[float], Field(default=None, gt=0.0, description="Optional initial feedwater mass in kg.")
    ] = None
    energy_balance_residual_j: Annotated[
        Optional[float], Field(default=None, description="Optional system energy balance residual in Joules.")
    ] = None


class AnalyticsResponse(BaseModel):
    """Complete response returned by analytics evaluation endpoint."""

    summary: AnalyticsSummarySchema
    time_series: List[AnalyticsTimeSeriesPointSchema]


class AnalyticsResetResponse(BaseModel):
    """Response returned upon resetting analytics state."""

    status: str
    message: str
