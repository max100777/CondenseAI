"""
Module 4: Air-Gap Membrane Distillation (AGMD) Desalination Model for CondensAI.

Physics-based mathematical simulation of AGMD desalination:
- Antoine equation for water saturation vapor pressure.
- Seawater salinity and water activity (a_w) depression.
- Combined Knudsen and molecular diffusion through hydrophobic microporous PTFE membrane.
- Molecular diffusion through stagnant air gap.
- Thermal polarization & iterative surface temperature estimation (T_mh, T_mc).
- Water vapor mass flux and freshwater production rate (kg/s, L/h).
- Latent heat of evaporation and parasitic conductive heat demand.
- Cold plate heat rejection.
- Mass conservation of water and dissolved salts in feed inventory.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Tuple


@dataclass(frozen=True)
class AGMDParameters:
    """
    Physical and geometric parameters for the AGMD desalination prototype.

    Physical Units:
        Membrane:
            membrane_pore_diameter_m: Meters (m) - Mean pore diameter of PTFE membrane (default 0.22 µm).
            membrane_thickness_m: Meters (m) - Thickness of PTFE membrane (default 100 µm).
            membrane_porosity: Dimensionless [0.0, 1.0] - Void volume fraction (default 0.70).
            membrane_tortuosity: Dimensionless >= 1.0 - Pore tortuosity factor (default 2.0).
            membrane_thermal_conductivity_w_m_k: W/(m·K) - Effective thermal conductivity of porous PTFE (default 0.25).
            active_length_m: Meters (m) - Active membrane flow channel length (default 0.04 m).
            active_width_m: Meters (m) - Active membrane flow channel width (default 0.04 m).

        Air Gap:
            air_gap_thickness_m: Meters (m) - Stagnant air gap width between membrane and cold plate (default 0.003 m).

        Hot Feed Water:
            initial_feed_temp_c: °C - Initial hot saline feed bulk temperature (default 70.0 °C).
            initial_salinity_g_l: g/L - Initial dissolved salt concentration (default 35.0 g/L).
            initial_feed_mass_kg: kg - Initial feed saline water mass in inventory (default 10.0 kg).
            feed_specific_heat_j_kg_k: J/(kg·K) - Specific heat capacity of feed solution (default 4184.0).
            feed_density_kg_m3: kg/m³ - Density of feed brine (default 1025.0 kg/m³).
            hot_side_htc_w_m2_k: W/(m²·K) - Convective heat transfer coefficient on hot feed side (default 1000.0).

        Cold Condensing Plate:
            cold_plate_temp_c: °C - Cold condensing surface boundary temperature (default 25.0 °C).
            cold_side_htc_w_m2_k: W/(m²·K) - Heat transfer coefficient on cold plate side (default 1000.0).

        Simulation Controls:
            time_step_s: Seconds (s) - Discrete simulation time step (0 < dt <= 5.0 s).
            simulation_duration_s: Seconds (s) - Total simulation duration.
    """

    # Membrane specifications
    membrane_pore_diameter_m: float = 0.22e-6
    membrane_thickness_m: float = 100.0e-6
    membrane_porosity: float = 0.70
    membrane_tortuosity: float = 2.0
    membrane_thermal_conductivity_w_m_k: float = 0.25
    active_length_m: float = 0.04
    active_width_m: float = 0.04

    # Air gap specifications
    air_gap_thickness_m: float = 0.003

    # Hot feed specifications
    initial_feed_temp_c: float = 70.0
    initial_salinity_g_l: float = 35.0
    initial_feed_mass_kg: float = 10.0
    feed_specific_heat_j_kg_k: float = 4184.0
    feed_density_kg_m3: float = 1025.0
    hot_side_htc_w_m2_k: float = 1000.0

    # Cold plate specifications
    cold_plate_temp_c: float = 25.0
    cold_side_htc_w_m2_k: float = 1000.0

    # Simulation controls
    time_step_s: float = 1.0
    simulation_duration_s: float = 60.0

    def __post_init__(self) -> None:
        """Validate physical parameters upon construction."""
        for field_name, value in asdict(self).items():
            if not math.isfinite(value):
                raise ValueError(f"Parameter '{field_name}' must be a finite number, received: {value}")

        if self.membrane_pore_diameter_m <= 0.0:
            raise ValueError("Membrane pore diameter must be strictly positive.")

        if self.membrane_thickness_m <= 0.0:
            raise ValueError("Membrane thickness must be strictly positive.")

        if not (0.0 < self.membrane_porosity < 1.0):
            raise ValueError(f"Membrane porosity must be between 0 and 1, received: {self.membrane_porosity}")

        if self.membrane_tortuosity < 1.0:
            raise ValueError(f"Membrane tortuosity must be >= 1.0, received: {self.membrane_tortuosity}")

        if self.active_length_m <= 0.0 or self.active_width_m <= 0.0:
            raise ValueError("Membrane active dimensions must be strictly positive.")

        if self.air_gap_thickness_m <= 0.0:
            raise ValueError("Air gap thickness must be strictly positive.")

        if self.initial_salinity_g_l < 0.0:
            raise ValueError(f"Salinity must be non-negative, received: {self.initial_salinity_g_l} g/L")

        if self.initial_feed_mass_kg <= 0.0:
            raise ValueError(f"Initial feed mass must be strictly positive, received: {self.initial_feed_mass_kg} kg")

        if not (0.0 < self.time_step_s <= 5.0):
            raise ValueError(f"Time step must be strictly positive and <= 5.0 s, received: {self.time_step_s} s")

        if self.simulation_duration_s <= 0.0:
            raise ValueError("Simulation duration must be strictly positive.")

        if self.initial_feed_temp_c < 0.0 or self.initial_feed_temp_c > 100.0:
            raise ValueError(f"Feed temperature must be within liquid range [0°C, 100°C], received: {self.initial_feed_temp_c}")

        if self.cold_plate_temp_c < 0.0 or self.cold_plate_temp_c > 100.0:
            raise ValueError(f"Cold plate temperature must be within liquid range [0°C, 100°C], received: {self.cold_plate_temp_c}")

    @property
    def active_area_m2(self) -> float:
        """Active membrane surface area in m²."""
        return self.active_length_m * self.active_width_m


@dataclass
class AGMDStep:
    """Structured record of AGMD performance at a discrete time step."""

    time_s: float

    # Thermal states
    bulk_feed_temp_c: float
    hot_membrane_temp_c: float
    cold_condensing_temp_c: float
    cold_plate_temp_c: float
    temperature_difference_membrane_c: float

    # Vapor pressure and transport
    hot_sat_vapor_pressure_pa: float
    hot_effective_vapor_pressure_pa: float
    cold_sat_vapor_pressure_pa: float
    vapor_pressure_difference_pa: float
    membrane_resistance_pa_s_m2_per_kg: float
    air_gap_resistance_pa_s_m2_per_kg: float
    total_mass_transfer_resistance_pa_s_m2_per_kg: float
    vapor_flux_kg_m2_s: float

    # Water production metrics
    freshwater_production_rate_kg_s: float
    freshwater_production_rate_l_h: float
    flux_l_m2_h: float
    cumulative_freshwater_mass_kg: float
    cumulative_freshwater_volume_l: float
    feed_inventory_mass_kg: float
    feed_salinity_g_l: float

    # Thermal energy rates
    latent_heat_flux_w: float
    conductive_heat_flux_w: float
    total_agmd_heat_demand_w: float
    actual_heat_supplied_w: float
    unmet_heat_demand_w: float
    cold_plate_heat_rejection_w: float
    cumulative_thermal_energy_consumed_j: float

    # Numerical diagnostics
    iterations: int
    converged: bool
    energy_balance_residual_w: float

    def to_dict(self) -> dict[str, float]:
        """Convert step record to dictionary format."""
        return {
            "time_s": self.time_s,
            "bulk_feed_temp_c": self.bulk_feed_temp_c,
            "hot_membrane_temp_c": self.hot_membrane_temp_c,
            "cold_condensing_temp_c": self.cold_condensing_temp_c,
            "cold_plate_temp_c": self.cold_plate_temp_c,
            "temperature_difference_membrane_c": self.temperature_difference_membrane_c,
            "hot_sat_vapor_pressure_pa": self.hot_sat_vapor_pressure_pa,
            "hot_effective_vapor_pressure_pa": self.hot_effective_vapor_pressure_pa,
            "cold_sat_vapor_pressure_pa": self.cold_sat_vapor_pressure_pa,
            "vapor_pressure_difference_pa": self.vapor_pressure_difference_pa,
            "membrane_resistance_pa_s_m2_per_kg": self.membrane_resistance_pa_s_m2_per_kg,
            "air_gap_resistance_pa_s_m2_per_kg": self.air_gap_resistance_pa_s_m2_per_kg,
            "total_mass_transfer_resistance_pa_s_m2_per_kg": self.total_mass_transfer_resistance_pa_s_m2_per_kg,
            "vapor_flux_kg_m2_s": self.vapor_flux_kg_m2_s,
            "freshwater_production_rate_kg_s": self.freshwater_production_rate_kg_s,
            "freshwater_production_rate_l_h": self.freshwater_production_rate_l_h,
            "flux_l_m2_h": self.flux_l_m2_h,
            "cumulative_freshwater_mass_kg": self.cumulative_freshwater_mass_kg,
            "cumulative_freshwater_volume_l": self.cumulative_freshwater_volume_l,
            "feed_inventory_mass_kg": self.feed_inventory_mass_kg,
            "feed_salinity_g_l": self.feed_salinity_g_l,
            "latent_heat_flux_w": self.latent_heat_flux_w,
            "conductive_heat_flux_w": self.conductive_heat_flux_w,
            "total_agmd_heat_demand_w": self.total_agmd_heat_demand_w,
            "actual_heat_supplied_w": self.actual_heat_supplied_w,
            "unmet_heat_demand_w": self.unmet_heat_demand_w,
            "cold_plate_heat_rejection_w": self.cold_plate_heat_rejection_w,
            "cumulative_thermal_energy_consumed_j": self.cumulative_thermal_energy_consumed_j,
            "iterations": self.iterations,
            "converged": 1.0 if self.converged else 0.0,
            "energy_balance_residual_w": self.energy_balance_residual_w,
        }


# ---------------------------------------------------------------------------
# Reusable Thermodynamic & Physical Calculation Functions
# ---------------------------------------------------------------------------

# Constants
GAS_CONSTANT_R = 8.314462618  # J/(mol·K)
MOLAR_MASS_WATER = 0.01801528  # kg/mol
ATMOSPHERIC_PRESSURE_PA = 101325.0  # Pa
WATER_DENSITY_KG_M3 = 1000.0  # kg/m³


def calculate_saturation_vapor_pressure_pa(temp_c: float) -> float:
    """
    Calculate saturation vapor pressure of pure water using the Antoine equation.

    Formula:
        log10(P_sat_mmHg) = A - B / (C + T_c)
        P_sat_Pa = P_sat_mmHg * 133.322387415

    NIST coefficients for water (0°C to 100°C):
        A = 8.07131
        B = 1730.63
        C = 233.426

    Args:
        temp_c: Temperature in degrees Celsius (valid range 0°C to 100°C).

    Returns:
        Saturation vapor pressure in Pascals (Pa).
    """
    if not math.isfinite(temp_c):
        raise ValueError(f"Temperature must be finite, received: {temp_c}")
    if temp_c < -10.0 or temp_c > 110.0:
        raise ValueError(f"Temperature {temp_c}°C is outside the validated Antoine range [0°C, 100°C].")

    # Guard clamp against sub-zero extremes
    t_eval = max(0.0, min(100.0, temp_c))
    log10_p_mmhg = 8.07131 - (1730.63 / (233.426 + t_eval))
    p_mmhg = 10.0 ** log10_p_mmhg
    p_pa = p_mmhg * 133.322387415
    return p_pa


def calculate_water_activity(salinity_g_l: float) -> float:
    """
    Calculate water activity (a_w) of saline feed solution.

    Seawater correlation (Sharqawy et al., 2010):
        a_w = 1.0 - 0.000537 * S_g_l

    Args:
        salinity_g_l: Feed water salinity in g/L (NaCl / total dissolved salts).

    Returns:
        Water activity coefficient (0.0 < a_w <= 1.0).
    """
    if salinity_g_l < 0.0:
        raise ValueError(f"Salinity cannot be negative, received: {salinity_g_l} g/L")
    if not math.isfinite(salinity_g_l):
        raise ValueError(f"Salinity must be finite, received: {salinity_g_l}")

    # Enforce physical boundary: pure water limit is 1.0; salinity depresses activity
    a_w = 1.0 - (0.000537 * salinity_g_l)
    return max(0.50, min(1.0, a_w))


def calculate_latent_heat_of_vaporization_j_kg(temp_c: float) -> float:
    """
    Calculate temperature-dependent latent heat of vaporization of water:
        h_fg(T) = (2.501e6 - 2370.0 * T_c) [J/kg]

    Args:
        temp_c: Temperature in degrees Celsius.

    Returns:
        Specific enthalpy of vaporization in J/kg.
    """
    t_clamped = max(0.0, min(100.0, temp_c))
    return 2.501e6 - (2370.0 * t_clamped)


def calculate_air_thermal_conductivity(temp_c: float) -> float:
    """
    Thermal conductivity of air in the air gap as a function of temperature:
        k_air = 0.024 + 7.7e-5 * T_c [W/(m·K)]
    """
    return 0.024 + (7.7e-5 * max(0.0, temp_c))


def calculate_molecular_diffusivity_water_air_m2_s(temp_k: float) -> float:
    """
    Molecular diffusivity of water vapor in air (Fuller / Marrero-Mason correlation):
        D_AB = 1.87e-10 * (T_k^2.072) / (P_total / 101325) [m²/s]
    """
    return 1.87e-10 * (temp_k ** 2.072)


def calculate_knudsen_diffusivity_m2_s(pore_radius_m: float, temp_k: float) -> float:
    """
    Knudsen diffusivity inside membrane micropores:
        D_K = (2 * r_p / 3) * sqrt(8 * R * T / (pi * M_w)) [m²/s]
    """
    mean_molecular_speed = math.sqrt((8.0 * GAS_CONSTANT_R * temp_k) / (math.pi * MOLAR_MASS_WATER))
    return (2.0 * pore_radius_m / 3.0) * mean_molecular_speed


class AGMDModel:
    """
    Lumped engineering physics model of an Air-Gap Membrane Distillation module.

    Simulates:
    - Vapor flux through combined Knudsen + molecular diffusion in PTFE pores and molecular diffusion in the air gap.
    - Thermal polarization (hot membrane surface and cold condensing surface temperatures).
    - Freshwater production rate and cumulative yield.
    - Evaporative latent heat demand and parasitic conduction through membrane & air gap.
    - Feed water mass depletion and salinity concentration over time.
    """

    def __init__(self, params: AGMDParameters | None = None) -> None:
        """Initialize AGMD model with physical parameters."""
        self.params: AGMDParameters = params if params is not None else AGMDParameters()

        # Dynamic inventories
        self._current_feed_mass_kg: float = self.params.initial_feed_mass_kg
        # Total initial dissolved salt mass: (S g/L) * (V_feed m³ * 1000 L/m³) / 1000 g/kg = kg salt
        feed_volume_m3 = self.params.initial_feed_mass_kg / self.params.feed_density_kg_m3
        self._initial_salt_mass_kg: float = (self.params.initial_salinity_g_l * (feed_volume_m3 * 1000.0)) / 1000.0

        # Cumulative outputs
        self._cumulative_freshwater_mass_kg: float = 0.0
        self._cumulative_freshwater_volume_l: float = 0.0
        self._cumulative_thermal_energy_consumed_j: float = 0.0
        self._elapsed_time_s: float = 0.0

    @property
    def current_feed_mass_kg(self) -> float:
        """Current feed water mass in inventory (kg)."""
        return self._current_feed_mass_kg

    @property
    def current_salinity_g_l(self) -> float:
        """Current feed salinity in g/L based on conserved salt mass."""
        if self._current_feed_mass_kg <= 1e-6:
            return 999.0  # Dry/saturated limit
        current_volume_m3 = self._current_feed_mass_kg / self.params.feed_density_kg_m3
        volume_l = current_volume_m3 * 1000.0
        return (self._initial_salt_mass_kg * 1000.0) / volume_l

    @property
    def cumulative_freshwater_mass_kg(self) -> float:
        """Total freshwater produced since start of simulation in kg."""
        return self._cumulative_freshwater_mass_kg

    @property
    def cumulative_freshwater_volume_l(self) -> float:
        """Total freshwater produced since start of simulation in Litres."""
        return self._cumulative_freshwater_volume_l

    @property
    def cumulative_thermal_energy_consumed_j(self) -> float:
        """Cumulative thermal energy consumed by AGMD in Joules."""
        return self._cumulative_thermal_energy_consumed_j

    @property
    def elapsed_time_s(self) -> float:
        """Elapsed simulation time in seconds."""
        return self._elapsed_time_s

    def calculate_mass_transfer_resistances(
        self,
        t_hot_c: float,
        t_cold_c: float,
    ) -> Tuple[float, float, float]:
        """
        Calculate membrane and air-gap mass transfer resistances.

        Membrane:
            Combination of Knudsen diffusion (D_K) and molecular diffusion (D_AB):
            1 / D_eff = 1 / D_K + 1 / D_AB
            D_eff_m = (porosity / tortuosity) * D_eff
            R_m = (R * T_m * delta_m) / (M_w * D_eff_m)  [Pa·s·m²/kg]

        Air Gap:
            Molecular diffusion through stagnant air:
            R_a = (R * T_a * delta_a * P_air_lm) / (M_w * D_AB * P_total)  [Pa·s·m²/kg]

        Returns:
            Tuple of (R_membrane, R_airgap, R_total) in Pa·s·m²/kg.
        """
        t_mean_c = 0.5 * (t_hot_c + t_cold_c)
        t_mean_k = t_mean_c + 273.15
        pore_radius_m = 0.5 * self.params.membrane_pore_diameter_m

        # Diffusivities
        d_k = calculate_knudsen_diffusivity_m2_s(pore_radius_m, t_mean_k)
        d_ab = calculate_molecular_diffusivity_water_air_m2_s(t_mean_k)

        # Dusty gas / Bosanquet harmonic combination
        d_combined = (d_k * d_ab) / (d_k + d_ab)
        d_eff_membrane = (self.params.membrane_porosity / self.params.membrane_tortuosity) * d_combined

        # Membrane resistance R_m (Pa·s·m²/kg)
        r_membrane = (GAS_CONSTANT_R * t_mean_k * self.params.membrane_thickness_m) / (
            MOLAR_MASS_WATER * d_eff_membrane
        )

        # Log-mean air pressure in air gap
        p_sat_hot = calculate_saturation_vapor_pressure_pa(t_hot_c)
        p_sat_cold = calculate_saturation_vapor_pressure_pa(t_cold_c)
        p_air_hot = max(100.0, ATMOSPHERIC_PRESSURE_PA - p_sat_hot)
        p_air_cold = max(100.0, ATMOSPHERIC_PRESSURE_PA - p_sat_cold)

        if abs(p_air_hot - p_air_cold) < 1.0:
            p_air_lm = p_air_hot
        else:
            p_air_lm = (p_air_hot - p_air_cold) / math.log(p_air_hot / p_air_cold)

        # Air-gap resistance R_a (Pa·s·m²/kg)
        r_airgap = (GAS_CONSTANT_R * t_mean_k * self.params.air_gap_thickness_m * p_air_lm) / (
            MOLAR_MASS_WATER * d_ab * ATMOSPHERIC_PRESSURE_PA
        )

        r_total = r_membrane + r_airgap
        return r_membrane, r_airgap, r_total

    def calculate_thermal_conductance_w_m2_k(self, t_mean_c: float) -> float:
        """
        Calculate combined parasitic conductive heat transfer coefficient across membrane and air gap:
            U_cond = 1 / ( (delta_m / k_m) + (delta_a / k_a) ) [W/(m²·K)]
        """
        k_air = calculate_air_thermal_conductivity(t_mean_c)
        r_th_m = self.params.membrane_thickness_m / self.params.membrane_thermal_conductivity_w_m_k
        r_th_a = self.params.air_gap_thickness_m / k_air
        return 1.0 / (r_th_m + r_th_a)

    def solve_surface_temperatures_and_flux(
        self,
        t_feed_c: float,
        t_cold_c: float,
        salinity_g_l: float,
        max_iterations: int = 25,
        tolerance_c: float = 1e-4,
    ) -> Tuple[float, float, float, float, float, float, float, float, float, int, bool]:
        """
        Solve coupled thermal polarization and mass transfer equations iteratively.

        Governing heat flux balance:
            h_feed * (T_feed - T_mh) = J * h_fg + U_cond * (T_mh - T_mc) = h_cold * (T_mc - T_cold)

        Returns:
            Tuple: (T_mh, T_mc, J, p_sat_hot, p_eff_hot, p_sat_cold, delta_p, R_m, R_a, iterations, converged)
        """
        # If feed is colder than or equal to cold plate, zero driving force
        if t_feed_c <= t_cold_c:
            p_sat = calculate_saturation_vapor_pressure_pa(t_feed_c)
            a_w = calculate_water_activity(salinity_g_l)
            r_m, r_a, _ = self.calculate_mass_transfer_resistances(t_feed_c, t_cold_c)
            return (
                t_feed_c,
                t_cold_c,
                0.0,
                p_sat,
                a_w * p_sat,
                p_sat,
                0.0,
                r_m,
                r_a,
                1,
                True,
            )

        a_w = calculate_water_activity(salinity_g_l)
        h_feed = self.params.hot_side_htc_w_m2_k
        h_cold = self.params.cold_side_htc_w_m2_k

        # Initial guesses: bulk temperatures
        t_mh = t_feed_c
        t_mc = t_cold_c

        converged = False
        iteration = 0
        j_flux = 0.0
        p_sat_hot = 0.0
        p_eff_hot = 0.0
        p_sat_cold = 0.0
        delta_p = 0.0
        r_m = 0.0
        r_a = 0.0

        for it in range(1, max_iterations + 1):
            iteration = it
            t_mean = 0.5 * (t_mh + t_mc)
            h_fg = calculate_latent_heat_of_vaporization_j_kg(t_mh)
            u_cond = self.calculate_thermal_conductance_w_m2_k(t_mean)

            # Mass transfer and vapor pressures
            p_sat_hot = calculate_saturation_vapor_pressure_pa(t_mh)
            p_eff_hot = a_w * p_sat_hot
            p_sat_cold = calculate_saturation_vapor_pressure_pa(t_mc)
            delta_p = max(0.0, p_eff_hot - p_sat_cold)

            r_m, r_a, r_total = self.calculate_mass_transfer_resistances(t_mh, t_mc)
            j_flux = delta_p / r_total if r_total > 0.0 else 0.0

            q_latent = j_flux * h_fg

            # Solve 2x2 linear thermal system for (T_mh, T_mc) with current q_latent:
            # (h_feed + U_cond) * T_mh - U_cond * T_mc = h_feed * T_feed - q_latent
            # -U_cond * T_mh + (h_cold + U_cond) * T_mc = h_cold * T_cold + q_latent
            a1 = h_feed + u_cond
            b1 = -u_cond
            c1 = (h_feed * t_feed_c) - q_latent

            a2 = -u_cond
            b2 = h_cold + u_cond
            c2 = (h_cold * t_cold_c) + q_latent

            det = (a1 * b2) - (a2 * b1)
            t_mh_new = ((c1 * b2) - (c2 * b1)) / det
            t_mc_new = ((a1 * c2) - (a2 * c1)) / det

            # Guard physical bounds: T_cold <= T_mc <= T_mh <= T_feed
            t_mh_new = max(t_cold_c, min(t_feed_c, t_mh_new))
            t_mc_new = max(t_cold_c, min(t_feed_c, t_mc_new))
            if t_mc_new > t_mh_new:
                t_mc_new = t_mh_new

            # Relaxation for numerical stability
            omega = 0.5
            t_mh_next = (omega * t_mh_new) + ((1.0 - omega) * t_mh)
            t_mc_next = (omega * t_mc_new) + ((1.0 - omega) * t_mc)

            diff = max(abs(t_mh_next - t_mh), abs(t_mc_next - t_mc))
            t_mh = t_mh_next
            t_mc = t_mc_next

            if diff < tolerance_c:
                converged = True
                break

        return (
            t_mh,
            t_mc,
            j_flux,
            p_sat_hot,
            p_eff_hot,
            p_sat_cold,
            delta_p,
            r_m,
            r_a,
            iteration,
            converged,
        )

    def step(
        self,
        dt: float | None = None,
        feed_temp_c: float | None = None,
        cold_plate_temp_c: float | None = None,
        available_thermal_power_w: float | None = None,
    ) -> AGMDStep:
        """
        Advance the AGMD simulation by one time step dt.

        Args:
            dt: Time step in seconds. Uses params.time_step_s if None.
            feed_temp_c: Current hot saline feed temperature (°C). Defaults to params.initial_feed_temp_c.
            cold_plate_temp_c: Current cold plate temperature (°C). Defaults to params.cold_plate_temp_c.
            available_thermal_power_w: Maximum thermal power (W) that the secondary reservoir can provide.
                If None, unconstrained standalone operation is assumed.

        Returns:
            AGMDStep record with complete thermal, mass transfer, and water production metrics.
        """
        step_dt = dt if dt is not None else self.params.time_step_s
        if step_dt <= 0.0 or not math.isfinite(step_dt):
            raise ValueError(f"Time step must be positive and finite, received: {step_dt}")
        if step_dt > 5.0:
            raise ValueError(f"Time step must be <= 5.0 s for numerical precision, received: {step_dt} s")

        t_feed = feed_temp_c if feed_temp_c is not None else self.params.initial_feed_temp_c
        t_cold = cold_plate_temp_c if cold_plate_temp_c is not None else self.params.cold_plate_temp_c

        # Check feed inventory
        current_salinity = self.current_salinity_g_l
        if self._current_feed_mass_kg <= 1e-6:
            # Feed inventory depleted
            return AGMDStep(
                time_s=round(self._elapsed_time_s + step_dt, 6),
                bulk_feed_temp_c=round(t_feed, 4),
                hot_membrane_temp_c=round(t_feed, 4),
                cold_condensing_temp_c=round(t_cold, 4),
                cold_plate_temp_c=round(t_cold, 4),
                temperature_difference_membrane_c=0.0,
                hot_sat_vapor_pressure_pa=0.0,
                hot_effective_vapor_pressure_pa=0.0,
                cold_sat_vapor_pressure_pa=0.0,
                vapor_pressure_difference_pa=0.0,
                membrane_resistance_pa_s_m2_per_kg=0.0,
                air_gap_resistance_pa_s_m2_per_kg=0.0,
                total_mass_transfer_resistance_pa_s_m2_per_kg=0.0,
                vapor_flux_kg_m2_s=0.0,
                freshwater_production_rate_kg_s=0.0,
                freshwater_production_rate_l_h=0.0,
                flux_l_m2_h=0.0,
                cumulative_freshwater_mass_kg=round(self._cumulative_freshwater_mass_kg, 10),
                cumulative_freshwater_volume_l=round(self._cumulative_freshwater_volume_l, 8),
                feed_inventory_mass_kg=0.0,
                feed_salinity_g_l=round(current_salinity, 4),
                latent_heat_flux_w=0.0,
                conductive_heat_flux_w=0.0,
                total_agmd_heat_demand_w=0.0,
                actual_heat_supplied_w=0.0,
                unmet_heat_demand_w=0.0,
                cold_plate_heat_rejection_w=0.0,
                cumulative_thermal_energy_consumed_j=round(self._cumulative_thermal_energy_consumed_j, 4),
                iterations=0,
                converged=True,
                energy_balance_residual_w=0.0,
            )

        # Solve coupled polarization and mass flux
        (
            t_mh,
            t_mc,
            j_flux,
            p_sat_hot,
            p_eff_hot,
            p_sat_cold,
            delta_p,
            r_m,
            r_a,
            iterations,
            converged,
        ) = self.solve_surface_temperatures_and_flux(t_feed, t_cold, current_salinity)

        area = self.params.active_area_m2
        h_fg = calculate_latent_heat_of_vaporization_j_kg(t_mh)
        u_cond = self.calculate_thermal_conductance_w_m2_k(0.5 * (t_mh + t_mc))

        # Unconstrained thermal demand rates
        q_latent_unconstrained = j_flux * area * h_fg
        q_conductive = u_cond * area * (t_mh - t_mc)
        q_demand_total = q_latent_unconstrained + q_conductive

        # Thermal demand throttling based on available energy from Module 3
        if available_thermal_power_w is not None and available_thermal_power_w < q_demand_total:
            actual_heat_supplied = max(0.0, available_thermal_power_w)
            unmet_demand = q_demand_total - actual_heat_supplied

            # Scale evaporation flux and conduction based on available thermal driving power
            # Conductive heat takes precedence across the gap; remaining goes to latent evaporation
            if actual_heat_supplied <= q_conductive:
                q_conductive_actual = actual_heat_supplied
                q_latent_actual = 0.0
                j_flux_actual = 0.0
            else:
                q_conductive_actual = q_conductive
                q_latent_actual = actual_heat_supplied - q_conductive
                j_flux_actual = q_latent_actual / (area * h_fg) if area * h_fg > 0.0 else 0.0

            # Consistent thermal boundary condition adjustments under throttling:
            # Convective boundary layers transfer exactly actual_heat_supplied
            q_flux_supplied = actual_heat_supplied / area if area > 0.0 else 0.0
            t_mh = t_feed - (q_flux_supplied / self.params.hot_side_htc_w_m2_k)
            t_mc = t_cold + (q_flux_supplied / self.params.cold_side_htc_w_m2_k)
        else:
            actual_heat_supplied = q_demand_total
            unmet_demand = 0.0
            j_flux_actual = j_flux
            q_latent_actual = q_latent_unconstrained
            q_conductive_actual = q_conductive

        # Water production rate
        m_dot_water = j_flux_actual * area
        # Check against maximum available feed mass in this step
        max_possible_m_dot = self._current_feed_mass_kg / step_dt
        if m_dot_water > max_possible_m_dot:
            m_dot_water = max_possible_m_dot
            j_flux_actual = m_dot_water / area

        # Volumetric rates (L/h)
        v_dot_water_l_h = (m_dot_water / WATER_DENSITY_KG_M3) * 3600.0 * 1000.0  # (m³/s)*3600*1000 = L/h
        flux_l_m2_h = (j_flux_actual / WATER_DENSITY_KG_M3) * 3600.0 * 1000.0  # L/(m²·h)

        # Mass updates
        delta_m_water = m_dot_water * step_dt
        self._current_feed_mass_kg = max(0.0, self._current_feed_mass_kg - delta_m_water)
        self._cumulative_freshwater_mass_kg += delta_m_water
        self._cumulative_freshwater_volume_l += delta_m_water / (WATER_DENSITY_KG_M3 / 1000.0)

        # Thermal updates
        self._cumulative_thermal_energy_consumed_j += actual_heat_supplied * step_dt
        self._elapsed_time_s += step_dt

        # Cold side heat rejection
        q_cold_rejection = q_latent_actual + q_conductive_actual

        # Energy residual across AGMD boundaries (Hot Supply - (Latent + Conductive))
        energy_residual = actual_heat_supplied - (q_latent_actual + q_conductive_actual)

        return AGMDStep(
            time_s=round(self._elapsed_time_s, 6),
            bulk_feed_temp_c=round(t_feed, 4),
            hot_membrane_temp_c=round(t_mh, 4),
            cold_condensing_temp_c=round(t_mc, 4),
            cold_plate_temp_c=round(t_cold, 4),
            temperature_difference_membrane_c=round(t_mh - t_mc, 4),
            hot_sat_vapor_pressure_pa=round(p_sat_hot, 2),
            hot_effective_vapor_pressure_pa=round(p_eff_hot, 2),
            cold_sat_vapor_pressure_pa=round(p_sat_cold, 2),
            vapor_pressure_difference_pa=round(delta_p, 2),
            membrane_resistance_pa_s_m2_per_kg=round(r_m, 2),
            air_gap_resistance_pa_s_m2_per_kg=round(r_a, 2),
            total_mass_transfer_resistance_pa_s_m2_per_kg=round(r_m + r_a, 2),
            vapor_flux_kg_m2_s=round(j_flux_actual, 10),
            freshwater_production_rate_kg_s=round(m_dot_water, 10),
            freshwater_production_rate_l_h=round(v_dot_water_l_h, 6),
            flux_l_m2_h=round(flux_l_m2_h, 6),
            cumulative_freshwater_mass_kg=round(self._cumulative_freshwater_mass_kg, 10),
            cumulative_freshwater_volume_l=round(self._cumulative_freshwater_volume_l, 8),
            feed_inventory_mass_kg=round(self._current_feed_mass_kg, 6),
            feed_salinity_g_l=round(self.current_salinity_g_l, 4),
            latent_heat_flux_w=round(q_latent_actual, 4),
            conductive_heat_flux_w=round(q_conductive_actual, 4),
            total_agmd_heat_demand_w=round(q_demand_total, 4),
            actual_heat_supplied_w=round(actual_heat_supplied, 4),
            unmet_heat_demand_w=round(unmet_demand, 4),
            cold_plate_heat_rejection_w=round(q_cold_rejection, 4),
            cumulative_thermal_energy_consumed_j=round(self._cumulative_thermal_energy_consumed_j, 4),
            iterations=iterations,
            converged=converged,
            energy_balance_residual_w=round(energy_residual, 6),
        )

    def reset(self) -> None:
        """Reset the AGMD model state back to initial conditions."""
        self._current_feed_mass_kg = self.params.initial_feed_mass_kg
        feed_volume_m3 = self.params.initial_feed_mass_kg / self.params.feed_density_kg_m3
        self._initial_salt_mass_kg = (self.params.initial_salinity_g_l * (feed_volume_m3 * 1000.0)) / 1000.0
        self._cumulative_freshwater_mass_kg = 0.0
        self._cumulative_freshwater_volume_l = 0.0
        self._cumulative_thermal_energy_consumed_j = 0.0
        self._elapsed_time_s = 0.0
