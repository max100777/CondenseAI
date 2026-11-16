"""
Module 2: Heat Recovery Exchanger Model for CondensAI.

Physics-based mathematical simulation of a counterflow heat exchanger
transferring thermal energy from the GPU primary coolant circuit to a
secondary water circuit (destined for AGMD desalination) using the
Effectiveness-NTU (epsilon-NTU) method.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class HeatExchangerParameters:
    """
    Configuration parameters for counterflow heat exchanger simulation.

    Physical Units:
        primary_inlet_temp_c: Degrees Celsius (°C) - Hot coolant inlet temperature from GPU loop.
        secondary_inlet_temp_c: Degrees Celsius (°C) - Cold water inlet temperature from reservoir.
        primary_mass_flow_kg_s: kg/s - Mass flow rate of primary coolant.
        secondary_mass_flow_kg_s: kg/s - Mass flow rate of secondary water.
        ua_w_k: Watts per Kelvin (W/K) - Overall heat transfer coefficient * heat transfer area.
        specific_heat_j_kg_k: Joules per kg-Kelvin (J/kg·K) - Specific heat capacity of fluid.
        time_step_s: Seconds (s) - Simulation discrete time step (0 < dt <= 5.0 s).
        simulation_duration_s: Seconds (s) - Total simulation duration.
    """

    primary_inlet_temp_c: float = 65.0
    secondary_inlet_temp_c: float = 25.0
    primary_mass_flow_kg_s: float = 0.05
    secondary_mass_flow_kg_s: float = 0.02
    ua_w_k: float = 150.0
    specific_heat_j_kg_k: float = 4184.0
    time_step_s: float = 1.0
    simulation_duration_s: float = 60.0

    def __post_init__(self) -> None:
        """Validate physical parameters upon construction."""
        for field_name, value in asdict(self).items():
            if not math.isfinite(value):
                raise ValueError(f"Parameter '{field_name}' must be a finite number, received: {value}")

        if self.primary_mass_flow_kg_s <= 0.0:
            raise ValueError(
                f"Primary mass flow rate must be strictly positive, received: {self.primary_mass_flow_kg_s} kg/s"
            )

        if self.secondary_mass_flow_kg_s <= 0.0:
            raise ValueError(
                f"Secondary mass flow rate must be strictly positive, received: {self.secondary_mass_flow_kg_s} kg/s"
            )

        if self.ua_w_k <= 0.0:
            raise ValueError(f"Overall heat transfer coefficient (UA) must be strictly positive, received: {self.ua_w_k} W/K")

        if self.specific_heat_j_kg_k <= 0.0:
            raise ValueError(
                f"Specific heat capacity must be strictly positive, received: {self.specific_heat_j_kg_k} J/kg·K"
            )

        if not (0.0 < self.time_step_s <= 5.0):
            raise ValueError(
                f"Time step must be strictly positive and <= 5.0 s for numerical precision, received: {self.time_step_s} s"
            )

        if self.simulation_duration_s <= 0.0:
            raise ValueError(f"Simulation duration must be strictly positive, received: {self.simulation_duration_s} s")

        if self.primary_inlet_temp_c < -273.15 or self.secondary_inlet_temp_c < -273.15:
            raise ValueError("Temperatures cannot be below absolute zero (-273.15 °C)")


@dataclass
class HeatExchangerStep:
    """Structured record generated at each simulation time step."""

    time_s: float
    primary_inlet_temp_c: float
    primary_outlet_temp_c: float
    secondary_inlet_temp_c: float
    secondary_outlet_temp_c: float
    primary_mass_flow_kg_s: float
    secondary_mass_flow_kg_s: float
    c_h_w_per_k: float
    c_c_w_per_k: float
    c_min_w_per_k: float
    c_max_w_per_k: float
    capacity_ratio_cr: float
    ntu: float
    effectiveness: float
    q_max_w: float
    heat_transfer_w: float
    cumulative_recovered_heat_j: float

    def to_dict(self) -> dict[str, float]:
        """Convert step record to dictionary format."""
        return {
            "time_s": self.time_s,
            "primary_inlet_temp_c": self.primary_inlet_temp_c,
            "primary_outlet_temp_c": self.primary_outlet_temp_c,
            "secondary_inlet_temp_c": self.secondary_inlet_temp_c,
            "secondary_outlet_temp_c": self.secondary_outlet_temp_c,
            "primary_mass_flow_kg_s": self.primary_mass_flow_kg_s,
            "secondary_mass_flow_kg_s": self.secondary_mass_flow_kg_s,
            "c_h_w_per_k": self.c_h_w_per_k,
            "c_c_w_per_k": self.c_c_w_per_k,
            "c_min_w_per_k": self.c_min_w_per_k,
            "c_max_w_per_k": self.c_max_w_per_k,
            "capacity_ratio_cr": self.capacity_ratio_cr,
            "ntu": self.ntu,
            "effectiveness": self.effectiveness,
            "q_max_w": self.q_max_w,
            "heat_transfer_w": self.heat_transfer_w,
            "cumulative_recovered_heat_j": self.cumulative_recovered_heat_j,
        }


class HeatExchangerModel:
    """
    Counterflow Heat Exchanger simulation model based on the Effectiveness-NTU method.

    Governing physics:
        1. Heat capacity rates:
           C_h = m_dot_h * C_p
           C_c = m_dot_c * C_p
        2. Minimum and maximum capacity rates:
           C_min = min(C_h, C_c)
           C_max = max(C_h, C_c)
           C_r = C_min / C_max
        3. Number of Transfer Units (NTU):
           NTU = UA / C_min
        4. Counterflow effectiveness (epsilon):
           If C_r == 1: epsilon = NTU / (1 + NTU)
           If C_r < 1:  epsilon = (1 - exp(-NTU*(1 - C_r))) / (1 - C_r*exp(-NTU*(1 - C_r)))
        5. Maximum and actual heat transfer rate:
           Q_max = C_min * (T_h_in - T_c_in)  (for T_h_in > T_c_in)
           Q_HX = epsilon * Q_max
        6. Outlet temperatures:
           T_h_out = T_h_in - Q_HX / C_h
           T_c_out = T_c_in + Q_HX / C_c
        7. Energy accumulation:
           E_recovered = sum(Q_HX * dt) [Joules]
    """

    def __init__(self, params: HeatExchangerParameters | None = None) -> None:
        """
        Initialize the heat exchanger model.

        Args:
            params: Thermal and flow parameters. Uses defaults if None.
        """
        self.params: HeatExchangerParameters = params if params is not None else HeatExchangerParameters()
        self._elapsed_time_s: float = 0.0
        self._cumulative_recovered_heat_j: float = 0.0

    @property
    def elapsed_time_s(self) -> float:
        """Elapsed simulation time in seconds."""
        return self._elapsed_time_s

    @property
    def cumulative_recovered_heat_j(self) -> float:
        """Cumulative recovered heat energy in Joules."""
        return self._cumulative_recovered_heat_j

    def calculate_heat_capacity_rates(self) -> tuple[float, float]:
        """
        Calculate hot (primary) and cold (secondary) heat capacity rates:
            C_h = m_dot_primary * C_p  [W/K]
            C_c = m_dot_secondary * C_p  [W/K]

        Returns:
            Tuple of (C_h, C_c) in Watts per Kelvin.
        """
        c_h = self.params.primary_mass_flow_kg_s * self.params.specific_heat_j_kg_k
        c_c = self.params.secondary_mass_flow_kg_s * self.params.specific_heat_j_kg_k
        return c_h, c_c

    def calculate_effectiveness(self, c_h: float, c_c: float) -> tuple[float, float, float, float, float]:
        """
        Compute capacity rates, NTU, and counterflow heat exchanger effectiveness.

        Handles:
            - General case: C_r < 1
            - Equal capacity rates: C_r ≈ 1 (avoids numerical division by zero)

        Args:
            c_h: Primary heat capacity rate (W/K).
            c_c: Secondary heat capacity rate (W/K).

        Returns:
            Tuple of (c_min, c_max, c_r, ntu, effectiveness).
        """
        c_min = min(c_h, c_c)
        c_max = max(c_h, c_c)
        c_r = c_min / c_max
        ntu = self.params.ua_w_k / c_min

        # Tolerance for C_r ≈ 1 limit
        tolerance = 1e-6
        if abs(c_r - 1.0) <= tolerance:
            effectiveness = ntu / (1.0 + ntu)
        else:
            exponent = -ntu * (1.0 - c_r)
            # Guard against potential numerical overflow/underflow
            if exponent < -700.0:
                exp_term = 0.0
            else:
                exp_term = math.exp(exponent)

            denominator = 1.0 - (c_r * exp_term)
            if abs(denominator) < 1e-12:
                effectiveness = ntu / (1.0 + ntu)
            else:
                effectiveness = (1.0 - exp_term) / denominator

        # Bound effectiveness strictly to [0.0, 1.0]
        effectiveness = max(0.0, min(1.0, effectiveness))

        return c_min, c_max, c_r, ntu, effectiveness

    def calculate_thermal_performance(
        self,
        primary_inlet_temp_c: float | None = None,
        secondary_inlet_temp_c: float | None = None,
    ) -> tuple[float, float, float, float, float, float, float, float, float, float, float]:
        """
        Compute instantaneous heat transfer and outlet temperatures.

        Physical constraints:
            - If T_h_in <= T_c_in: Q_max = 0, Q_HX = 0, outlet temps = inlet temps.
            - Q_HX <= Q_max
            - Secondary outlet temp T_c_out <= Primary inlet temp T_h_in (2nd Law).
            - Primary outlet temp T_h_out >= Secondary inlet temp T_c_in (2nd Law).
            - Energy conserved: C_h * (T_h_in - T_h_out) == C_c * (T_c_out - T_c_in) == Q_HX.

        Returns:
            Tuple containing:
            (c_h, c_c, c_min, c_max, c_r, ntu, effectiveness, q_max_w, q_hx_w, t_h_out, t_c_out)
        """
        t_h_in = (
            primary_inlet_temp_c
            if primary_inlet_temp_c is not None
            else self.params.primary_inlet_temp_c
        )
        t_c_in = (
            secondary_inlet_temp_c
            if secondary_inlet_temp_c is not None
            else self.params.secondary_inlet_temp_c
        )

        c_h, c_c = self.calculate_heat_capacity_rates()
        c_min, c_max, c_r, ntu, effectiveness = self.calculate_effectiveness(c_h, c_c)

        # Thermal driving potential Delta T
        delta_t_inlet = t_h_in - t_c_in

        if delta_t_inlet <= 0.0:
            # No heat recovery when hot side is colder than or equal to cold side
            q_max = 0.0
            q_hx = 0.0
            eff = 0.0
            t_h_out = t_h_in
            t_c_out = t_c_in
        else:
            q_max = c_min * delta_t_inlet
            q_hx = effectiveness * q_max
            # Safety clamp against any numerical floating overshoot
            q_hx = max(0.0, min(q_max, q_hx))

            t_h_out = t_h_in - (q_hx / c_h)
            t_c_out = t_c_in + (q_hx / c_c)
            eff = effectiveness

        return c_h, c_c, c_min, c_max, c_r, ntu, eff, q_max, q_hx, t_h_out, t_c_out

    def step(
        self,
        dt: float | None = None,
        primary_inlet_temp_c: float | None = None,
        secondary_inlet_temp_c: float | None = None,
    ) -> HeatExchangerStep:
        """
        Advance the heat exchanger simulation by one time step dt.

        Args:
            dt: Time step in seconds. Uses params.time_step_s if None.
            primary_inlet_temp_c: Dynamic primary inlet temperature (°C) if coupled.
            secondary_inlet_temp_c: Dynamic secondary inlet temperature (°C) if coupled.

        Returns:
            HeatExchangerStep containing complete thermodynamic performance state.
        """
        step_dt = dt if dt is not None else self.params.time_step_s
        if step_dt <= 0.0 or not math.isfinite(step_dt):
            raise ValueError(f"Time step must be positive and finite, received: {step_dt}")
        if step_dt > 5.0:
            raise ValueError(f"Time step must be <= 5.0 s for numerical precision, received: {step_dt} s")

        t_h_in = (
            primary_inlet_temp_c
            if primary_inlet_temp_c is not None
            else self.params.primary_inlet_temp_c
        )
        t_c_in = (
            secondary_inlet_temp_c
            if secondary_inlet_temp_c is not None
            else self.params.secondary_inlet_temp_c
        )

        (
            c_h,
            c_c,
            c_min,
            c_max,
            c_r,
            ntu,
            effectiveness,
            q_max,
            q_hx,
            t_h_out,
            t_c_out,
        ) = self.calculate_thermal_performance(t_h_in, t_c_in)

        # Accumulate recovered energy (Joules = Watts * seconds)
        recovered_energy_step_j = q_hx * step_dt
        self._cumulative_recovered_heat_j += recovered_energy_step_j
        self._elapsed_time_s += step_dt

        return HeatExchangerStep(
            time_s=round(self._elapsed_time_s, 6),
            primary_inlet_temp_c=round(t_h_in, 4),
            primary_outlet_temp_c=round(t_h_out, 4),
            secondary_inlet_temp_c=round(t_c_in, 4),
            secondary_outlet_temp_c=round(t_c_out, 4),
            primary_mass_flow_kg_s=round(self.params.primary_mass_flow_kg_s, 6),
            secondary_mass_flow_kg_s=round(self.params.secondary_mass_flow_kg_s, 6),
            c_h_w_per_k=round(c_h, 4),
            c_c_w_per_k=round(c_c, 4),
            c_min_w_per_k=round(c_min, 4),
            c_max_w_per_k=round(c_max, 4),
            capacity_ratio_cr=round(c_r, 4),
            ntu=round(ntu, 4),
            effectiveness=round(effectiveness, 4),
            q_max_w=round(q_max, 4),
            heat_transfer_w=round(q_hx, 4),
            cumulative_recovered_heat_j=round(self._cumulative_recovered_heat_j, 4),
        )

    def reset(self) -> None:
        """Reset elapsed time and accumulated energy back to zero."""
        self._elapsed_time_s = 0.0
        self._cumulative_recovered_heat_j = 0.0
