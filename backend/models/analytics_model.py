"""
Module 5: Water Production Analytics & Thermal Performance Model for CondensAI.

Extracts, aggregates, and computes operational KPIs from digital twin simulations:
- Instantaneous and cumulative freshwater production rates and yields (kg, L, mL, L/h).
- Trans-membrane vapor flux metrics (instantaneous, time-weighted average, min, max in LMH).
- Thermal energy consumption for AGMD (latent + conductive in J and kWh_th).
- Waste-heat recovery efficiency metrics:
    * eta_HX: Heat exchanger recovery efficiency relative to GPU heat generation.
    * eta_utilization: Secondary heat utilization efficiency by AGMD relative to HX recovery.
    * eta_gpu_to_agmd: Overall GPU-to-AGMD thermal conversion efficiency.
- Specific Thermal Energy Consumption (STEC in kWh_th/m³).
- Feed water recovery ratio (%).
- Support for both standalone AGMD runs and integrated system / multi-GPU simulations.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Any, List, Optional


@dataclass(frozen=True)
class AnalyticsTimeSeriesPoint:
    """Discrete time-series performance entry for water production and thermal metrics."""

    time_s: float
    freshwater_production_rate_l_h: float
    cumulative_freshwater_volume_l: float
    flux_lmh: float
    agmd_thermal_power_w: float
    feed_salinity_g_l: Optional[float] = None
    feed_temp_c: Optional[float] = None


@dataclass(frozen=True)
class AnalyticsSummary:
    """
    Consolidated performance summary across water production, thermal recovery,
    and thermodynamic efficiencies.
    """

    simulation_duration_s: float
    total_gpu_heat_generated_j: Optional[float]
    total_heat_recovered_j: Optional[float]
    total_agmd_energy_j: float
    total_agmd_energy_kwh: float
    total_freshwater_mass_kg: float
    total_freshwater_volume_l: float
    total_freshwater_volume_ml: float
    instantaneous_production_l_h: float
    average_production_l_h: float
    average_flux_lmh: float
    maximum_flux_lmh: float
    minimum_flux_lmh: float
    heat_exchanger_recovery_percent: Optional[float]
    heat_utilization_percent: Optional[float]
    gpu_to_agmd_efficiency_percent: Optional[float]
    specific_thermal_energy_kwh_m3: Optional[float]
    water_recovery_percent: Optional[float]
    final_feed_salinity_g_l: Optional[float]
    energy_balance_residual_j: Optional[float]

    def to_dict(self) -> dict[str, Any]:
        """Convert dataclass to dictionary format."""
        return asdict(self)


class AnalyticsModel:
    """
    Physics-based analytics engine calculating thermodynamic and mass-transfer KPIs.
    """

    # Pure distillate water density convention (consistent with AGMD model)
    RHO_WATER_KG_M3: float = 1000.0

    @staticmethod
    def calculate_production_rates(
        mass_flux_kg_m2_s: float,
        membrane_area_m2: float,
        water_density_kg_m3: float = RHO_WATER_KG_M3,
    ) -> tuple[float, float, float]:
        """
        Calculate freshwater production rates from vapor mass flux and membrane area.

        Equations:
            m_dot_w = J_m * A_m                [kg/s]
            V_dot_m3_s = m_dot_w / rho_w       [m³/s]
            V_dot_l_h = (m_dot_w / rho_w) * 3600 * 1000 [L/h]
            J_LMH = (J_m / rho_w) * 3600 * 1000          [LMH]

        Returns:
            Tuple of (mass_rate_kg_s, volumetric_rate_l_h, flux_lmh).
        """
        if water_density_kg_m3 <= 0.0 or not math.isfinite(water_density_kg_m3):
            raise ValueError(f"Water density must be positive and finite, received: {water_density_kg_m3}")
        if membrane_area_m2 < 0.0 or not math.isfinite(membrane_area_m2):
            raise ValueError(f"Membrane area must be non-negative and finite, received: {membrane_area_m2}")

        mass_rate_kg_s = max(0.0, mass_flux_kg_m2_s * membrane_area_m2)
        volumetric_rate_l_h = (mass_rate_kg_s / water_density_kg_m3) * 3.6e6
        flux_lmh = max(0.0, (mass_flux_kg_m2_s / water_density_kg_m3) * 3.6e6)

        return mass_rate_kg_s, volumetric_rate_l_h, flux_lmh

    @staticmethod
    def calculate_time_weighted_average_flux(
        fluxes_lmh: List[float],
        time_steps_s: List[float],
    ) -> float:
        """
        Compute time-weighted average flux:
            J_avg = (sum_i J_i * dt_i) / (sum_i dt_i)

        Args:
            fluxes_lmh: List of instantaneous flux values in LMH.
            time_steps_s: List of corresponding timestep durations in seconds.

        Returns:
            Time-weighted average flux in LMH.
        """
        if not fluxes_lmh or not time_steps_s or len(fluxes_lmh) != len(time_steps_s):
            return 0.0

        total_time_s = sum(time_steps_s)
        if total_time_s <= 0.0 or not math.isfinite(total_time_s):
            return 0.0

        weighted_flux_sum = sum(f * dt for f, dt in zip(fluxes_lmh, time_steps_s))
        avg_flux = weighted_flux_sum / total_time_s
        return max(0.0, avg_flux) if math.isfinite(avg_flux) else 0.0

    @staticmethod
    def calculate_efficiencies(
        total_gpu_heat_j: Optional[float],
        total_hx_heat_j: Optional[float],
        total_agmd_energy_j: float,
    ) -> tuple[Optional[float], Optional[float], Optional[float]]:
        """
        Compute the three distinct thermal efficiency ratios:
            1. eta_HX = (E_HX,recovered / E_GPU,generated) * 100
            2. eta_utilization = (E_AGMD / E_HX,recovered) * 100
            3. eta_gpu_to_agmd = (E_AGMD / E_GPU,generated) * 100

        Safely handles zero denominators and preserves raw un-clamped values.

        Returns:
            Tuple of (eta_hx_percent, eta_utilization_percent, eta_gpu_to_agmd_percent).
        """
        eta_hx: Optional[float] = None
        eta_util: Optional[float] = None
        eta_gpu_agmd: Optional[float] = None

        if total_gpu_heat_j is not None and math.isfinite(total_gpu_heat_j):
            if total_gpu_heat_j > 0.0:
                if total_hx_heat_j is not None and math.isfinite(total_hx_heat_j):
                    eta_hx = (total_hx_heat_j / total_gpu_heat_j) * 100.0
                eta_gpu_agmd = (total_agmd_energy_j / total_gpu_heat_j) * 100.0
            else:
                eta_hx = 0.0 if (total_hx_heat_j is not None and total_hx_heat_j == 0.0) else None
                eta_gpu_agmd = 0.0 if total_agmd_energy_j == 0.0 else None

        if total_hx_heat_j is not None and math.isfinite(total_hx_heat_j):
            if total_hx_heat_j > 0.0:
                eta_util = (total_agmd_energy_j / total_hx_heat_j) * 100.0
            else:
                eta_util = 0.0 if total_agmd_energy_j == 0.0 else None

        return eta_hx, eta_util, eta_gpu_agmd

    @staticmethod
    def calculate_stec(
        total_agmd_energy_kwh: float,
        total_freshwater_volume_m3: float,
    ) -> Optional[float]:
        """
        Compute Specific Thermal Energy Consumption:
            STEC = E_AGMD,kWh / V_water,m³  [kWh_th / m³]

        Returns:
            STEC in kWh_th/m³, or None if freshwater volume is zero or non-positive.
        """
        if total_freshwater_volume_m3 <= 0.0 or not math.isfinite(total_freshwater_volume_m3):
            return None

        stec = total_agmd_energy_kwh / total_freshwater_volume_m3
        return stec if math.isfinite(stec) and stec >= 0.0 else None

    @staticmethod
    def calculate_water_recovery(
        freshwater_mass_kg: float,
        initial_feed_mass_kg: Optional[float],
    ) -> Optional[float]:
        """
        Compute Feed Water Recovery Ratio:
            Recovery = (m_freshwater,produced / m_initial,feedwater) * 100 [%]

        Returns:
            Recovery percentage, or None if initial feed mass is unavailable or non-positive.
        """
        if initial_feed_mass_kg is None or initial_feed_mass_kg <= 0.0 or not math.isfinite(initial_feed_mass_kg):
            return None

        recovery = (freshwater_mass_kg / initial_feed_mass_kg) * 100.0
        return recovery if math.isfinite(recovery) else None

    @classmethod
    def compute_from_time_series(
        cls,
        time_points_s: List[float],
        freshwater_mass_kg: List[float],
        freshwater_rates_l_h: List[float],
        fluxes_lmh: List[float],
        agmd_powers_w: List[float],
        feed_salinities_g_l: Optional[List[float]] = None,
        feed_temps_c: Optional[List[float]] = None,
        total_gpu_heat_j: Optional[float] = None,
        total_hx_heat_j: Optional[float] = None,
        initial_feed_mass_kg: Optional[float] = None,
        energy_balance_residual_j: Optional[float] = None,
    ) -> tuple[AnalyticsSummary, List[AnalyticsTimeSeriesPoint]]:
        """
        Aggregate full analytics from time-series sequences.
        """
        n_steps = len(time_points_s)
        if n_steps == 0:
            raise ValueError("Time series cannot be empty for analytics calculation.")

        simulation_duration_s = time_points_s[-1] if n_steps > 0 else 0.0

        # Calculate discrete time intervals dt_i
        dt_list: List[float] = []
        for i in range(n_steps):
            if i == 0:
                dt_list.append(time_points_s[0] if time_points_s[0] > 0.0 else 1.0)
            else:
                dt_list.append(max(0.0, time_points_s[i] - time_points_s[i - 1]))

        # Production metrics
        total_freshwater_mass_kg = freshwater_mass_kg[-1] if freshwater_mass_kg else 0.0
        total_freshwater_volume_m3 = total_freshwater_mass_kg / cls.RHO_WATER_KG_M3
        total_freshwater_volume_l = total_freshwater_volume_m3 * 1000.0
        total_freshwater_volume_ml = total_freshwater_volume_m3 * 1.0e6

        instantaneous_production_l_h = freshwater_rates_l_h[-1] if freshwater_rates_l_h else 0.0

        # Average production rate (L/h) = total volume (L) / duration (hours)
        if simulation_duration_s > 0.0:
            duration_hours = simulation_duration_s / 3600.0
            average_production_l_h = total_freshwater_volume_l / duration_hours
        else:
            average_production_l_h = 0.0

        # Flux metrics
        average_flux_lmh = cls.calculate_time_weighted_average_flux(fluxes_lmh, dt_list)
        maximum_flux_lmh = max(fluxes_lmh) if fluxes_lmh else 0.0
        minimum_flux_lmh = min(fluxes_lmh) if fluxes_lmh else 0.0

        # AGMD thermal energy
        total_agmd_energy_j = sum(p * dt for p, dt in zip(agmd_powers_w, dt_list))
        total_agmd_energy_kwh = total_agmd_energy_j / 3.6e6

        # Efficiencies
        eta_hx, eta_util, eta_gpu_agmd = cls.calculate_efficiencies(
            total_gpu_heat_j=total_gpu_heat_j,
            total_hx_heat_j=total_hx_heat_j,
            total_agmd_energy_j=total_agmd_energy_j,
        )

        # STEC and Recovery
        stec = cls.calculate_stec(total_agmd_energy_kwh, total_freshwater_volume_m3)
        water_recovery_percent = cls.calculate_water_recovery(total_freshwater_mass_kg, initial_feed_mass_kg)

        final_feed_salinity_g_l = (
            feed_salinities_g_l[-1] if feed_salinities_g_l and len(feed_salinities_g_l) > 0 else None
        )

        summary = AnalyticsSummary(
            simulation_duration_s=simulation_duration_s,
            total_gpu_heat_generated_j=total_gpu_heat_j,
            total_heat_recovered_j=total_hx_heat_j,
            total_agmd_energy_j=total_agmd_energy_j,
            total_agmd_energy_kwh=total_agmd_energy_kwh,
            total_freshwater_mass_kg=total_freshwater_mass_kg,
            total_freshwater_volume_l=total_freshwater_volume_l,
            total_freshwater_volume_ml=total_freshwater_volume_ml,
            instantaneous_production_l_h=instantaneous_production_l_h,
            average_production_l_h=average_production_l_h,
            average_flux_lmh=average_flux_lmh,
            maximum_flux_lmh=maximum_flux_lmh,
            minimum_flux_lmh=minimum_flux_lmh,
            heat_exchanger_recovery_percent=eta_hx,
            heat_utilization_percent=eta_util,
            gpu_to_agmd_efficiency_percent=eta_gpu_agmd,
            specific_thermal_energy_kwh_m3=stec,
            water_recovery_percent=water_recovery_percent,
            final_feed_salinity_g_l=final_feed_salinity_g_l,
            energy_balance_residual_j=energy_balance_residual_j,
        )

        # Build time-series points
        time_series_points: List[AnalyticsTimeSeriesPoint] = []
        for i in range(n_steps):
            cum_vol_l = (freshwater_mass_kg[i] / cls.RHO_WATER_KG_M3) * 1000.0 if i < len(freshwater_mass_kg) else 0.0
            sal = feed_salinities_g_l[i] if feed_salinities_g_l and i < len(feed_salinities_g_l) else None
            temp = feed_temps_c[i] if feed_temps_c and i < len(feed_temps_c) else None

            point = AnalyticsTimeSeriesPoint(
                time_s=time_points_s[i],
                freshwater_production_rate_l_h=freshwater_rates_l_h[i],
                cumulative_freshwater_volume_l=cum_vol_l,
                flux_lmh=fluxes_lmh[i],
                agmd_thermal_power_w=agmd_powers_w[i],
                feed_salinity_g_l=sal,
                feed_temp_c=temp,
            )
            time_series_points.append(point)

        return summary, time_series_points
