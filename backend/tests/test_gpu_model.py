"""
Automated unit and integration test suite for CondensAI Module 1: GPU Heat Generation Model.

Tests cover:
1. Model initialization and default parameters.
2. Heat generation calculation (Q_generated = P_GPU * f_heat).
3. Heat transfer to coolant when T_GPU <= T_coolant (zero heat transfer).
4. Heat transfer to coolant when T_GPU > T_coolant (positive heat transfer).
5. Transient temperature update based on energy balance (Euler step).
6. Elapsed simulation time progression.
7. Model state reset functionality.
8. Validation and rejection of invalid physical parameters.
9. Numerical integration for total generated and transferred energy.
10. Determinism (reproducibility) of simulation runs.
11. First-law thermal energy conservation verification.
12. FastAPI endpoint integration (GET /, GET /health, POST /api/gpu/simulate, POST /api/gpu/reset).
"""

from __future__ import annotations

import math
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.gpu_model import GPUModel, GPUParameters, GPUSimulationStep
from backend.schemas.gpu_schema import GPUSimulationRequest
from backend.services.simulation_service import GPUSimulationService


# ---------------------------------------------------------------------------
# Core Model Tests
# ---------------------------------------------------------------------------

def test_1_gpu_model_initialization_temperature():
    """Requirement 1: GPU model initializes at the specified initial temperature."""
    custom_params = GPUParameters(initial_gpu_temp_c=42.5)
    model = GPUModel(custom_params)

    assert model.current_temp_c == 42.5
    assert model.elapsed_time_s == 0.0

    # Default parameters initialization check
    default_model = GPUModel()
    assert default_model.current_temp_c == 35.0
    assert default_model.elapsed_time_s == 0.0


def test_2_heat_generation_calculation():
    """Requirement 2: Heat generated at 350 W and 0.95 conversion fraction equals 332.5 W."""
    params = GPUParameters(gpu_power_w=350.0, heat_conversion_fraction=0.95)
    model = GPUModel(params)

    q_gen = model.calculate_heat_generated()
    assert math.isclose(q_gen, 332.5, rel_tol=1e-9)

    # Test with custom power
    params_500w = GPUParameters(gpu_power_w=500.0, heat_conversion_fraction=0.90)
    model_500w = GPUModel(params_500w)
    assert math.isclose(model_500w.calculate_heat_generated(), 450.0, rel_tol=1e-9)


def test_3_heat_transfer_zero_when_temp_at_or_below_coolant():
    """Requirement 3: Heat transfer is zero when GPU temperature is equal to or below coolant temperature."""
    params = GPUParameters(coolant_temp_c=30.0, thermal_resistance_k_per_w=0.12)
    model = GPUModel(params)

    # Equal temperatures
    assert model.calculate_heat_to_coolant(gpu_temp_c=30.0) == 0.0

    # GPU colder than coolant
    assert model.calculate_heat_to_coolant(gpu_temp_c=25.0) == 0.0
    assert model.calculate_heat_to_coolant(gpu_temp_c=0.0) == 0.0


def test_4_heat_transfer_positive_when_temp_above_coolant():
    """Requirement 4: Heat transfer is positive when GPU temperature is higher than coolant temperature."""
    params = GPUParameters(coolant_temp_c=30.0, thermal_resistance_k_per_w=0.12)
    model = GPUModel(params)

    # T_GPU = 35°C, T_coolant = 30°C, R_th = 0.12 K/W -> Q = (35 - 30) / 0.12 = 41.666... W
    q_coolant = model.calculate_heat_to_coolant(gpu_temp_c=35.0)
    assert q_coolant > 0.0
    assert math.isclose(q_coolant, 5.0 / 0.12, rel_tol=1e-6)

    # T_GPU = 70°C -> Q = (70 - 30) / 0.12 = 333.333... W
    q_coolant_70 = model.calculate_heat_to_coolant(gpu_temp_c=70.0)
    assert math.isclose(q_coolant_70, 40.0 / 0.12, rel_tol=1e-6)


def test_5_gpu_temperature_energy_balance_update():
    """Requirement 5: GPU temperature changes according to the energy balance."""
    params = GPUParameters(
        gpu_power_w=350.0,
        initial_gpu_temp_c=35.0,
        coolant_temp_c=30.0,
        heat_conversion_fraction=0.95,
        thermal_resistance_k_per_w=0.12,
        thermal_capacitance_j_per_k=250.0,
        time_step_s=1.0,
    )
    model = GPUModel(params)

    # Step 1 execution
    step_1 = model.step()

    # Manual analytical check:
    # Q_gen = 350 * 0.95 = 332.5 W
    # Q_coolant = (35 - 30) / 0.12 = 41.666667 W
    # Q_net = 332.5 - 41.666667 = 290.833333 W
    # dT = 290.833333 / 250.0 * 1.0 = 1.163333 °C
    # T_new = 35.0 + 1.163333 = 36.163333 °C
    assert math.isclose(step_1.heat_generated_w, 332.5, abs_tol=1e-2)
    assert math.isclose(step_1.heat_to_coolant_w, 41.67, abs_tol=1e-2)
    assert math.isclose(step_1.net_heat_w, 290.83, abs_tol=1e-2)
    assert math.isclose(step_1.gpu_temp_c, 36.16, abs_tol=1e-2)
    assert math.isclose(model.current_temp_c, 35.0 + (290.833333 / 250.0), rel_tol=1e-4)


def test_6_elapsed_time_progression():
    """Requirement 6: Elapsed time increases correctly across multiple steps."""
    params = GPUParameters(time_step_s=0.5)
    model = GPUModel(params)

    assert model.elapsed_time_s == 0.0

    step_1 = model.step()
    assert math.isclose(step_1.time_s, 0.5, abs_tol=1e-6)
    assert math.isclose(model.elapsed_time_s, 0.5, abs_tol=1e-6)

    step_2 = model.step()
    assert math.isclose(step_2.time_s, 1.0, abs_tol=1e-6)
    assert math.isclose(model.elapsed_time_s, 1.0, abs_tol=1e-6)

    # Step with custom dt
    step_3 = model.step(dt=2.0)
    assert math.isclose(step_3.time_s, 3.0, abs_tol=1e-6)
    assert math.isclose(model.elapsed_time_s, 3.0, abs_tol=1e-6)


def test_7_reset_functionality():
    """Requirement 7: Reset restores initial temperature and simulation time."""
    params = GPUParameters(initial_gpu_temp_c=40.0, time_step_s=1.0)
    model = GPUModel(params)

    # Advance 10 steps
    for _ in range(10):
        model.step()

    assert model.elapsed_time_s == 10.0
    assert model.current_temp_c != 40.0

    # Reset
    model.reset()

    assert model.elapsed_time_s == 0.0
    assert model.current_temp_c == 40.0


def test_8_invalid_parameter_rejection():
    """Requirement 8: Invalid physical parameters are strictly rejected."""
    # Negative power
    with pytest.raises(ValueError, match="GPU power must be non-negative"):
        GPUParameters(gpu_power_w=-10.0)

    # Conversion fraction < 0 or > 1
    with pytest.raises(ValueError, match="Heat conversion fraction"):
        GPUParameters(heat_conversion_fraction=-0.1)
    with pytest.raises(ValueError, match="Heat conversion fraction"):
        GPUParameters(heat_conversion_fraction=1.05)

    # Zero or negative thermal resistance
    with pytest.raises(ValueError, match="Thermal resistance must be strictly positive"):
        GPUParameters(thermal_resistance_k_per_w=0.0)
    with pytest.raises(ValueError, match="Thermal resistance must be strictly positive"):
        GPUParameters(thermal_resistance_k_per_w=-0.05)

    # Zero or negative thermal capacitance
    with pytest.raises(ValueError, match="Thermal capacitance must be strictly positive"):
        GPUParameters(thermal_capacitance_j_per_k=0.0)
    with pytest.raises(ValueError, match="Thermal capacitance must be strictly positive"):
        GPUParameters(thermal_capacitance_j_per_k=-100.0)

    # Zero or negative time step
    with pytest.raises(ValueError, match="Time step"):
        GPUParameters(time_step_s=0.0)
    with pytest.raises(ValueError, match="Time step"):
        GPUParameters(time_step_s=-1.0)

    # Time step exceeding strict operational limit of 5.0 seconds
    with pytest.raises(ValueError, match="Time step must be strictly positive and <= 5.0 s"):
        GPUParameters(time_step_s=5.1)

    # Step method call exceeding 5.0 seconds limit
    valid_model = GPUModel()
    with pytest.raises(ValueError, match="Time step must be <= 5.0 s"):
        valid_model.step(dt=6.0)

    # Negative or non-finite values
    with pytest.raises(ValueError, match="must be a finite number"):
        GPUParameters(gpu_power_w=float("nan"))
    with pytest.raises(ValueError, match="must be a finite number"):
        GPUParameters(thermal_resistance_k_per_w=float("inf"))


def test_9_total_energy_integration():
    """Requirement 9: Total generated and transferred energy are calculated correctly."""
    service = GPUSimulationService()
    request = GPUSimulationRequest(
        gpu_power_w=350.0,
        heat_conversion_fraction=0.95,
        simulation_duration_s=60.0,
        time_step_s=1.0,
    )

    response = service.run_simulation(request)

    # Heat generated is constant: Q_gen = 350 * 0.95 = 332.5 W
    # Total generated energy over 60s should be exactly 332.5 * 60 = 19,950 Joules
    assert math.isclose(response.total_heat_generated_j, 19950.0, rel_tol=1e-3)

    # Transferred energy must be positive and less than generated energy (since GPU warms up)
    assert 0.0 < response.total_heat_to_coolant_j < response.total_heat_generated_j

    # Average transferred power * duration equals total transferred energy
    recalculated_transferred_j = response.avg_heat_to_coolant_w * request.simulation_duration_s
    assert math.isclose(response.total_heat_to_coolant_j, recalculated_transferred_j, rel_tol=1e-3)


def test_10_simulation_determinism():
    """Requirement 10: Identical simulation inputs produce identical results."""
    service = GPUSimulationService()
    request_a = GPUSimulationRequest(
        gpu_power_w=400.0,
        initial_gpu_temp_c=32.0,
        coolant_temp_c=28.0,
        simulation_duration_s=45.0,
        time_step_s=0.5,
    )
    request_b = GPUSimulationRequest(
        gpu_power_w=400.0,
        initial_gpu_temp_c=32.0,
        coolant_temp_c=28.0,
        simulation_duration_s=45.0,
        time_step_s=0.5,
    )

    response_a = service.run_simulation(request_a)
    response_b = service.run_simulation(request_b)

    assert response_a.final_gpu_temp_c == response_b.final_gpu_temp_c
    assert response_a.total_heat_generated_j == response_b.total_heat_generated_j
    assert response_a.total_heat_to_coolant_j == response_b.total_heat_to_coolant_j
    assert len(response_a.time_series) == len(response_b.time_series)
    assert response_a.time_series[-1].model_dump() == response_b.time_series[-1].model_dump()


def test_11_first_law_energy_conservation():
    """Verification of First Law of Thermodynamics: Delta E_stored = E_generated - E_transferred."""
    service = GPUSimulationService()
    request = GPUSimulationRequest(
        gpu_power_w=350.0,
        initial_gpu_temp_c=35.0,
        coolant_temp_c=30.0,
        thermal_capacitance_j_per_k=250.0,
        simulation_duration_s=60.0,
        time_step_s=1.0,
    )
    response = service.run_simulation(request)

    # Change in internal thermal energy: Delta U = C_th * Delta T
    delta_u_joules = request.thermal_capacitance_j_per_k * response.final_gpu_temp_change_c
    net_heat_energy_joules = response.total_heat_generated_j - response.total_heat_to_coolant_j

    # Forward Euler numerical integration preserves exact energy conservation:
    # Delta T = sum((Q_gen - Q_coolant) / C_th * dt) = (E_gen - E_coolant) / C_th
    assert math.isclose(delta_u_joules, net_heat_energy_joules, rel_tol=1e-3)


# ---------------------------------------------------------------------------
# FastAPI Endpoint Integration Tests
# ---------------------------------------------------------------------------

client = TestClient(app)


def test_api_root_endpoint():
    """Test GET / endpoint returns correct metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "CondensAI" in data["application_name"]
    assert "Module 1" in data["module_name"]
    assert data["api_status"] == "operational"
    assert "version" in data


def test_api_health_endpoint():
    """Test GET /health endpoint returns healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "condensai-backend"


def test_api_simulate_default_parameters():
    """Test POST /api/gpu/simulate with defaults returns exact values matching prompt spec."""
    response = client.post("/api/gpu/simulate", json={})
    assert response.status_code == 200
    data = response.json()

    assert data["simulation_duration_s"] == 60.0
    assert data["step_count"] == 60
    assert len(data["time_series"]) == 60

    # Validate step 1 matches prompt example:
    # {"time_s": 1, "gpu_power_w": 350, "gpu_temp_c": 36.16, "coolant_temp_c": 30,
    #  "heat_generated_w": 332.5, "heat_to_coolant_w": 41.67, "net_heat_w": 290.83}
    step_1 = data["time_series"][0]
    assert step_1["time_s"] == 1.0
    assert step_1["gpu_power_w"] == 350.0
    assert math.isclose(step_1["gpu_temp_c"], 36.16, abs_tol=0.01)
    assert step_1["coolant_temp_c"] == 30.0
    assert step_1["heat_generated_w"] == 332.5
    assert math.isclose(step_1["heat_to_coolant_w"], 41.67, abs_tol=0.01)
    assert math.isclose(step_1["net_heat_w"], 290.83, abs_tol=0.01)


def test_api_simulate_validation_errors():
    """Test POST /api/gpu/simulate rejects invalid parameters with 422 Unprocessable Entity."""
    # Negative power
    res1 = client.post("/api/gpu/simulate", json={"gpu_power_w": -50.0})
    assert res1.status_code == 422

    # Heat conversion fraction > 1.0
    res2 = client.post("/api/gpu/simulate", json={"heat_conversion_fraction": 1.5})
    assert res2.status_code == 422

    # Zero thermal resistance
    res3 = client.post("/api/gpu/simulate", json={"thermal_resistance_k_per_w": 0.0})
    assert res3.status_code == 422

    # Time step greater than maximum allowed operational limit of 5.0 s
    res4 = client.post("/api/gpu/simulate", json={"time_step_s": 6.0})
    assert res4.status_code == 422

    # Excessive step count (> 100,000 steps)
    res5 = client.post("/api/gpu/simulate", json={"time_step_s": 0.001, "simulation_duration_s": 1000.0})
    assert res5.status_code == 422

    # Disallow unknown/extra fields
    res6 = client.post("/api/gpu/simulate", json={"invalid_field": 123})
    assert res6.status_code == 422


def test_api_reset_endpoint():
    """Test POST /api/gpu/reset restores initial state."""
    # First run a simulation
    client.post("/api/gpu/simulate", json={"gpu_power_w": 400.0})

    # Reset
    response = client.post("/api/gpu/reset")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["elapsed_time_s"] == 0.0
    assert data["current_gpu_temp_c"] == 35.0
