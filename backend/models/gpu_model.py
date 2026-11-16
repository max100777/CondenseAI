"""
Module 1: GPU Heat Generation Model for CondensAI.

Physics-based lumped-capacitance thermal simulation of an AI GPU.
Calculates electrical power to heat conversion, thermal dissipation to coolant,
and transient temperature evolution using Euler numerical integration.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class GPUParameters:
    """
    Configuration parameters for GPU thermal simulation.

    Physical Units:
        gpu_power_w: Watts (W) - Total electrical power consumed by GPU.
        initial_gpu_temp_c: Degrees Celsius (°C) - Starting GPU junction/die temperature.
        coolant_temp_c: Degrees Celsius (°C) - Coolant inlet temperature.
        heat_conversion_fraction: Dimensionless [0.0, 1.0] - Fraction of power converted to heat.
        thermal_resistance_k_per_w: Kelvin per Watt (K/W) - Effective thermal resistance to coolant.
        thermal_capacitance_j_per_k: Joules per Kelvin (J/K) - Lumped heat capacity of GPU package.
        time_step_s: Seconds (s) - Numerical integration step size dt.
        duration_s: Seconds (s) - Total simulation duration.
    """

    gpu_power_w: float = 350.0
    initial_gpu_temp_c: float = 35.0
    coolant_temp_c: float = 30.0
    heat_conversion_fraction: float = 0.95
    thermal_resistance_k_per_w: float = 0.12
    thermal_capacitance_j_per_k: float = 250.0
    time_step_s: float = 1.0
    duration_s: float = 60.0

    def __post_init__(self) -> None:
        """Validate physical parameters upon construction."""
        for field_name, value in asdict(self).items():
            if not math.isfinite(value):
                raise ValueError(f"Parameter '{field_name}' must be a finite number, received: {value}")

        if self.gpu_power_w < 0.0:
            raise ValueError(f"GPU power must be non-negative, received: {self.gpu_power_w} W")

        if not (0.0 <= self.heat_conversion_fraction <= 1.0):
            raise ValueError(
                f"Heat conversion fraction must be between 0.0 and 1.0, received: {self.heat_conversion_fraction}"
            )

        if self.thermal_resistance_k_per_w <= 0.0:
            raise ValueError(
                f"Thermal resistance must be strictly positive, received: {self.thermal_resistance_k_per_w} K/W"
            )

        if self.thermal_capacitance_j_per_k <= 0.0:
            raise ValueError(
                f"Thermal capacitance must be strictly positive, received: {self.thermal_capacitance_j_per_k} J/K"
            )

        if not (0.0 < self.time_step_s <= 5.0):
            raise ValueError(
                f"Time step must be strictly positive and <= 5.0 s for numerical accuracy and stability, received: {self.time_step_s} s"
            )

        if self.duration_s <= 0.0:
            raise ValueError(f"Simulation duration must be strictly positive, received: {self.duration_s} s")

        if self.initial_gpu_temp_c < -273.15 or self.coolant_temp_c < -273.15:
            raise ValueError("Temperatures cannot be below absolute zero (-273.15 °C)")


@dataclass
class GPUSimulationStep:
    """Structured data point generated at a simulation time step."""

    time_s: float
    gpu_power_w: float
    gpu_temp_c: float
    coolant_temp_c: float
    heat_generated_w: float
    heat_to_coolant_w: float
    net_heat_w: float

    def to_dict(self) -> dict[str, float]:
        """Convert step record to dictionary format."""
        return {
            "time_s": self.time_s,
            "gpu_power_w": self.gpu_power_w,
            "gpu_temp_c": self.gpu_temp_c,
            "coolant_temp_c": self.coolant_temp_c,
            "heat_generated_w": self.heat_generated_w,
            "heat_to_coolant_w": self.heat_to_coolant_w,
            "net_heat_w": self.net_heat_w,
        }


class GPUModel:
    """
    Lumped-parameter thermal model of an AI GPU.

    Governing differential equation:
        C_th * (dT_GPU / dt) = Q_generated - Q_coolant

    Where:
        Q_generated = P_GPU * f_heat
        Q_coolant = max(0.0, (T_GPU - T_coolant) / R_th)
        Q_net = Q_generated - Q_coolant
        dT_GPU / dt = Q_net / C_th

    Discretized using forward Euler integration:
        T_GPU(t + dt) = T_GPU(t) + (Q_net(t) / C_th) * dt
    """

    def __init__(self, params: GPUParameters | None = None) -> None:
        """
        Initialize the GPU thermal model.

        Args:
            params: Thermal and electrical simulation parameters. Uses defaults if None.
        """
        self.params: GPUParameters = params if params is not None else GPUParameters()
        self._current_temp_c: float = self.params.initial_gpu_temp_c
        self._elapsed_time_s: float = 0.0

    @property
    def current_temp_c(self) -> float:
        """Current temperature of the GPU in degrees Celsius."""
        return self._current_temp_c

    @property
    def elapsed_time_s(self) -> float:
        """Total elapsed simulation time in seconds."""
        return self._elapsed_time_s

    @property
    def thermal_time_constant_s(self) -> float:
        """
        First-order thermal system time constant tau = R_th * C_th in seconds.
        Indicates the time required to reach ~63.2% of steady-state temperature rise.
        """
        return self.params.thermal_resistance_k_per_w * self.params.thermal_capacitance_j_per_k

    @property
    def steady_state_temp_c(self) -> float:
        """Theoretical steady-state GPU temperature: T_coolant + Q_generated * R_th."""
        return self.params.coolant_temp_c + (self.calculate_heat_generated() * self.params.thermal_resistance_k_per_w)

    def calculate_heat_generated(self) -> float:
        """
        Calculate generated thermal power:
            Q_generated = P_GPU * f_heat [W]

        Returns:
            Thermal power generated in Watts.
        """
        return self.params.gpu_power_w * self.params.heat_conversion_fraction

    def calculate_heat_to_coolant(
        self,
        gpu_temp_c: float | None = None,
        coolant_temp_c: float | None = None,
    ) -> float:
        """
        Calculate convective/conductive heat dissipation to coolant:
            Q_coolant = max(0, (T_GPU - T_coolant) / R_th) [W]

        Heat transfer is strictly non-negative (coolant removes heat when T_GPU > T_coolant;
        if T_GPU <= T_coolant, heat transfer to coolant is zero).

        Args:
            gpu_temp_c: GPU temperature to evaluate. Defaults to current model temperature.
            coolant_temp_c: Coolant inlet/reference temperature. Defaults to params.coolant_temp_c.

        Returns:
            Heat power transferred to coolant in Watts.
        """
        temp = gpu_temp_c if gpu_temp_c is not None else self._current_temp_c
        t_coolant = coolant_temp_c if coolant_temp_c is not None else self.params.coolant_temp_c
        temp_difference = temp - t_coolant
        if temp_difference <= 0.0:
            return 0.0
        return temp_difference / self.params.thermal_resistance_k_per_w

    def calculate_net_heat(
        self,
        gpu_temp_c: float | None = None,
        coolant_temp_c: float | None = None,
    ) -> float:
        """
        Calculate net thermal power stored in GPU:
            Q_net = Q_generated - Q_coolant [W]

        Args:
            gpu_temp_c: GPU temperature to evaluate. Defaults to current model temperature.
            coolant_temp_c: Coolant inlet/reference temperature. Defaults to params.coolant_temp_c.

        Returns:
            Net heat power in Watts.
        """
        q_gen = self.calculate_heat_generated()
        q_coolant = self.calculate_heat_to_coolant(gpu_temp_c, coolant_temp_c)
        return q_gen - q_coolant

    def step(
        self,
        dt: float | None = None,
        coolant_temp_c: float | None = None,
    ) -> GPUSimulationStep:
        """
        Advance the simulation by one time step dt using forward Euler integration.

        Equation:
            T_new = T_old + (Q_net / C_th) * dt

        Args:
            dt: Time step in seconds. If None, uses params.time_step_s.
            coolant_temp_c: Dynamic coolant temperature (°C) for closed-loop thermal coupling.
                If None, uses params.coolant_temp_c.

        Returns:
            GPUSimulationStep containing instantaneous simulation metrics.
        """
        step_dt = dt if dt is not None else self.params.time_step_s
        if step_dt <= 0.0 or not math.isfinite(step_dt):
            raise ValueError(f"Time step must be positive and finite, received: {step_dt}")
        if step_dt > 5.0:
            raise ValueError(
                f"Time step must be <= 5.0 s for numerical accuracy and stability, received: {step_dt} s"
            )

        t_coolant = coolant_temp_c if coolant_temp_c is not None else self.params.coolant_temp_c
        if not math.isfinite(t_coolant):
            raise ValueError(f"Coolant temperature must be finite, received: {t_coolant}")

        # Compute fluxes at start of time step (explicit Euler formulation)
        q_gen = self.calculate_heat_generated()
        q_coolant = self.calculate_heat_to_coolant(self._current_temp_c, t_coolant)
        q_net = q_gen - q_coolant

        # Temperature rate of change dT/dt in K/s (°C/s)
        rate_of_temp_change = q_net / self.params.thermal_capacitance_j_per_k

        # Euler temperature update
        new_temp_c = self._current_temp_c + (rate_of_temp_change * step_dt)

        if not math.isfinite(new_temp_c):
            raise FloatingPointError(
                f"Numerical instability detected: temperature became non-finite ({new_temp_c}) at t={self._elapsed_time_s + step_dt}s"
            )

        # Update state
        self._current_temp_c = new_temp_c
        self._elapsed_time_s += step_dt

        return GPUSimulationStep(
            time_s=round(self._elapsed_time_s, 6),
            gpu_power_w=round(self.params.gpu_power_w, 4),
            gpu_temp_c=round(self._current_temp_c, 4),
            coolant_temp_c=round(t_coolant, 4),
            heat_generated_w=round(q_gen, 4),
            heat_to_coolant_w=round(q_coolant, 4),
            net_heat_w=round(q_net, 4),
        )

    def reset(self) -> None:
        """Reset the GPU simulation state back to initial conditions."""
        self._current_temp_c = self.params.initial_gpu_temp_c
        self._elapsed_time_s = 0.0
