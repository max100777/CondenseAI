"""
Automated unit and integration test suite for CondensAI Module 3:
Hot-Water Circulation, Thermal Storage & System Integration.

Tests cover:
Primary Circuit Tests:
1. Primary coolant temperature increases when GPU heat input exceeds heat exchanger extraction and losses.
2. Primary coolant temperature decreases when heat extraction and losses exceed heat input.
3. Primary coolant heat loss responds correctly to ambient temperature.
4. Primary coolant temperature remains finite under long-duration operation.
5. Invalid primary coolant mass and flow rate are rejected.

Secondary Circuit Tests:
6. Secondary reservoir temperature increases when recovered heat exceeds downstream demand and losses.
7. Secondary reservoir temperature decreases when downstream demand exceeds recovered heat.
8. Secondary ambient heat loss is calculated correctly.
9. Reservoir energy calculation relative to reference temperature is correct.
10. Minimum secondary operating temperature is strictly respected.
11. Actual AGMD heat supply cannot exceed physically available energy.
12. Unmet AGMD heat demand is tracked and reported accurately.

Integrated System Tests:
13. Module 1 is dynamically updated with primary coolant temperature at each step.
14. Module 2 is dynamically updated with dynamic primary and secondary inlet temperatures.
15. Primary and secondary circuits remain physically and thermally isolated (two separate loops).
16. Internal heat exchanger energy transfer is conserved (E_primary_to_hx == E_hx_to_secondary).
17. Identical simulation inputs produce deterministic, bit-exact results.
18. System-wide First-Law energy conservation residual is zero within numerical tolerance.
19. No artificial heat is generated when GPU is powered off (0 W).
20. Rejection of non-finite, negative masses, negative flow rates, or invalid time steps.
21. API endpoint integration: POST /api/system/simulate and POST /api/system/reset.
"""

from __future__ import annotations

import math
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.circulation_model import CirculationModel, CirculationParameters
from backend.schemas.circulation_schema import SystemSimulationRequest
from backend.services.circulation_service import CirculationService


# ---------------------------------------------------------------------------
# Primary Circuit Tests
# ---------------------------------------------------------------------------

def test_1_primary_coolant_temp_increases_when_gpu_heat_exceeds_extraction():
    """Test 1: Primary coolant temp rises when GPU heat input exceeds HX removal and ambient loss."""
    # High GPU power (1000 W), low HX UA (10 W/K), low ambient loss
    params = CirculationParameters(
        gpu_power_w=1000.0,
        heat_conversion_fraction=0.95,  # 950 W generated
        primary_coolant_mass_kg=2.0,
        primary_initial_temp_c=30.0,
        exchanger_ua_w_k=10.0,
        primary_heat_loss_ua_w_k=1.0,
        ambient_temp_c=25.0,
        simulation_duration_s=20.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)

    for _ in range(20):
        step = model.step()

    # Temperature must have increased from 30.0 °C
    assert step.primary_coolant_temp_c > 30.0
    assert model.current_primary_temp_c > 30.0


def test_2_primary_coolant_temp_decreases_when_extraction_exceeds_input():
    """Test 2: Primary coolant temp decreases when HX extraction and ambient loss exceed heat input."""
    # Zero GPU power (cool-down phase), primary starts hot at 70°C, secondary cold at 20°C
    params = CirculationParameters(
        gpu_power_w=0.0,
        initial_gpu_temp_c=25.0,
        primary_initial_temp_c=70.0,
        secondary_initial_temp_c=20.0,
        exchanger_ua_w_k=200.0,
        primary_heat_loss_ua_w_k=5.0,
        ambient_temp_c=20.0,
        simulation_duration_s=10.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)

    for _ in range(10):
        step = model.step()

    assert step.primary_coolant_temp_c < 70.0


def test_3_primary_heat_loss_responds_to_ambient():
    """Test 3: Primary coolant heat loss responds correctly to ambient temperature."""
    params_warm_ambient = CirculationParameters(
        primary_initial_temp_c=50.0,
        ambient_temp_c=25.0,
        primary_heat_loss_ua_w_k=2.0,
    )
    model_warm = CirculationModel(params_warm_ambient)
    q_loss_warm = model_warm.calculate_primary_heat_loss(50.0)
    # (50 - 25) * 2.0 = 50.0 W lost to surroundings
    assert math.isclose(q_loss_warm, 50.0, rel_tol=1e-6)

    # Ambient hotter than coolant -> negative loss (ambient heats fluid)
    params_hot_ambient = CirculationParameters(
        primary_initial_temp_c=30.0,
        ambient_temp_c=40.0,
        primary_heat_loss_ua_w_k=2.0,
    )
    model_hot = CirculationModel(params_hot_ambient)
    q_loss_hot = model_hot.calculate_primary_heat_loss(30.0)
    # (30 - 40) * 2.0 = -20.0 W
    assert math.isclose(q_loss_hot, -20.0, rel_tol=1e-6)


def test_4_primary_coolant_temp_remains_finite():
    """Test 4: Primary coolant temperature remains finite over multiple steps."""
    params = CirculationParameters(
        simulation_duration_s=100.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)
    for _ in range(100):
        step = model.step()
        assert math.isfinite(step.primary_coolant_temp_c)
        assert math.isfinite(step.gpu_temp_c)


def test_5_invalid_primary_mass_and_flow_rate_rejected():
    """Test 5: Zero or negative coolant mass and flow rate are rejected."""
    with pytest.raises(ValueError, match="Primary coolant mass must be strictly positive"):
        CirculationParameters(primary_coolant_mass_kg=0.0)

    with pytest.raises(ValueError, match="Primary coolant mass must be strictly positive"):
        CirculationParameters(primary_coolant_mass_kg=-1.0)

    with pytest.raises(ValueError, match="Primary mass flow rate must be strictly positive"):
        CirculationParameters(primary_mass_flow_kg_s=0.0)

    with pytest.raises(ValueError, match="Primary mass flow rate must be strictly positive"):
        CirculationParameters(primary_mass_flow_kg_s=-0.05)


# ---------------------------------------------------------------------------
# Secondary Circuit & Storage Reservoir Tests
# ---------------------------------------------------------------------------

def test_6_secondary_reservoir_temp_increases_when_heat_exceeds_demand():
    """Test 6: Secondary reservoir temperature rises when recovered heat exceeds AGMD demand and losses."""
    params = CirculationParameters(
        gpu_power_w=500.0,
        primary_initial_temp_c=45.0,
        secondary_initial_temp_c=25.0,
        secondary_water_mass_kg=10.0,
        exchanger_ua_w_k=200.0,
        agmd_heat_demand_w=0.0,  # No extraction
        simulation_duration_s=30.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)

    for _ in range(30):
        step = model.step()

    assert step.secondary_reservoir_temp_c > 25.0
    assert model.current_secondary_temp_c > 25.0


def test_7_secondary_reservoir_temp_decreases_when_demand_exceeds_recovered_heat():
    """Test 7: Secondary reservoir temperature decreases when downstream AGMD demand exceeds recovered heat."""
    # Zero GPU power, secondary starts hot at 60°C, large AGMD demand (2000 W)
    params = CirculationParameters(
        gpu_power_w=0.0,
        initial_gpu_temp_c=25.0,
        primary_initial_temp_c=25.0,
        secondary_initial_temp_c=60.0,
        secondary_water_mass_kg=10.0,
        agmd_heat_demand_w=2000.0,
        min_secondary_temp_c=20.0,
        simulation_duration_s=10.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)

    for _ in range(10):
        step = model.step()

    assert step.secondary_reservoir_temp_c < 60.0


def test_8_secondary_ambient_heat_loss_calculated_correctly():
    """Test 8: Secondary ambient heat loss is calculated correctly with signed convention."""
    params = CirculationParameters(
        secondary_initial_temp_c=55.0,
        ambient_temp_c=25.0,
        secondary_heat_loss_ua_w_k=5.0,
    )
    model = CirculationModel(params)
    loss = model.calculate_secondary_heat_loss(55.0)
    # (55 - 25) * 5.0 = 150.0 W
    assert math.isclose(loss, 150.0, rel_tol=1e-6)


def test_9_reservoir_stored_energy_calculation():
    """Test 9: Secondary reservoir stored thermal energy relative to reference 0°C is correct."""
    params = CirculationParameters(
        secondary_water_mass_kg=20.0,
        secondary_specific_heat_j_kg_k=4184.0,
        secondary_initial_temp_c=25.0,
    )
    model = CirculationModel(params)
    step = model.step()

    # E_stored = m_s * Cp,s * T_s = 20 * 4184 * T_s
    expected_e = 20.0 * 4184.0 * step.secondary_reservoir_temp_c
    assert math.isclose(step.secondary_stored_energy_j, expected_e, rel_tol=1e-3)


def test_10_minimum_secondary_operating_temp_respected():
    """Test 10: AGMD extraction cannot force reservoir below min_secondary_temp_c."""
    params = CirculationParameters(
        gpu_power_w=0.0,
        primary_initial_temp_c=20.0,
        secondary_initial_temp_c=22.0,
        secondary_water_mass_kg=5.0,
        agmd_heat_demand_w=10000.0,  # Enormous demand
        min_secondary_temp_c=20.0,
        simulation_duration_s=20.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)

    for _ in range(20):
        step = model.step()
        assert step.secondary_reservoir_temp_c >= params.min_secondary_temp_c - 1e-6


def test_11_actual_agmd_supply_capped_at_available_energy():
    """Test 11: Actual AGMD heat supply cannot exceed available energy above min_secondary_temp_c."""
    # Secondary at min_secondary_temp_c (20°C) with no incoming heat -> supply must be 0
    params = CirculationParameters(
        gpu_power_w=0.0,
        primary_initial_temp_c=20.0,
        secondary_initial_temp_c=20.0,
        agmd_heat_demand_w=500.0,
        min_secondary_temp_c=20.0,
        ambient_temp_c=20.0,
    )
    model = CirculationModel(params)
    step = model.step()

    assert step.heat_to_agmd_w == 0.0
    assert step.unmet_agmd_demand_w == 500.0


def test_12_unmet_agmd_demand_reported_correctly():
    """Test 12: Unmet AGMD demand is correctly computed (unmet = requested - supplied)."""
    params = CirculationParameters(
        gpu_power_w=0.0,
        primary_initial_temp_c=20.0,
        secondary_initial_temp_c=21.0,
        secondary_water_mass_kg=1.0,  # 1 kg * 4184 J/kg·K * 1 K = 4184 J max available
        agmd_heat_demand_w=6000.0,    # 6000 W exceeds ~4179 W available
        min_secondary_temp_c=20.0,
        ambient_temp_c=20.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)
    step = model.step()

    assert step.heat_to_agmd_w < 6000.0
    assert step.unmet_agmd_demand_w > 0.0
    assert math.isclose(step.heat_to_agmd_w + step.unmet_agmd_demand_w, 6000.0, rel_tol=1e-5)


# ---------------------------------------------------------------------------
# Integrated System & Energy Conservation Tests
# ---------------------------------------------------------------------------

def test_13_module_1_receives_dynamic_primary_coolant_temp():
    """Test 13: Module 1 GPU step uses dynamic primary coolant temperature."""
    params = CirculationParameters(
        gpu_power_w=350.0,
        initial_gpu_temp_c=35.0,
        primary_initial_temp_c=40.0,  # Coolant warmer than default
        thermal_resistance_k_per_w=0.12,
    )
    model = CirculationModel(params)
    step = model.step()

    # Coolant temp reported in step should equal primary coolant temp
    assert math.isclose(step.primary_coolant_temp_c, 40.0, abs_tol=1.0)
    # Heat to coolant Q = max(0, (35 - 40)/0.12) = 0 W
    assert step.heat_to_coolant_w == 0.0


def test_14_module_2_receives_dynamic_inlet_temperatures():
    """Test 14: Module 2 Heat Exchanger uses dynamic primary and secondary inlet temperatures."""
    params = CirculationParameters(
        primary_initial_temp_c=60.0,
        secondary_initial_temp_c=30.0,
        exchanger_ua_w_k=150.0,
    )
    model = CirculationModel(params)
    step = model.step()

    assert step.hx_heat_transfer_w > 0.0
    assert step.hx_primary_outlet_temp_c < 60.0
    assert step.hx_secondary_outlet_temp_c > 30.0


def test_15_primary_and_secondary_circuits_isolated():
    """Test 15: Primary and secondary mass inventories remain separate and constant."""
    params = CirculationParameters(
        primary_coolant_mass_kg=2.5,
        secondary_water_mass_kg=25.0,
    )
    model = CirculationModel(params)

    for _ in range(10):
        model.step()

    # Fluid inventories do not change (no fluid transfer, purely thermal transfer)
    assert model.params.primary_coolant_mass_kg == 2.5
    assert model.params.secondary_water_mass_kg == 25.0


def test_16_heat_exchanger_energy_transfer_balanced():
    """Test 16: Heat lost by primary across HX equals heat gained by secondary across HX."""
    params = CirculationParameters(
        primary_initial_temp_c=55.0,
        secondary_initial_temp_c=25.0,
        exchanger_ua_w_k=180.0,
        time_step_s=1.0,
        simulation_duration_s=20.0,
    )
    model = CirculationModel(params)

    for _ in range(20):
        step = model.step()
        # In every step, heat_to_hx_w == heat_received_hx_w == hx_heat_transfer_w
        assert math.isclose(step.heat_to_hx_w, step.heat_received_hx_w, rel_tol=1e-6)
        assert math.isclose(step.heat_to_hx_w, step.hx_heat_transfer_w, rel_tol=1e-6)


def test_17_deterministic_output_for_identical_inputs():
    """Test 17: Identical simulation inputs produce deterministic, identical outputs."""
    service = CirculationService()
    req_a = SystemSimulationRequest(
        gpu_power_w=400.0,
        simulation_duration_s=30.0,
        time_step_s=1.0,
        agmd_heat_demand_w=50.0,
    )
    req_b = SystemSimulationRequest(
        gpu_power_w=400.0,
        simulation_duration_s=30.0,
        time_step_s=1.0,
        agmd_heat_demand_w=50.0,
    )

    res_a = service.run_simulation(req_a)
    res_b = service.run_simulation(req_b)

    assert res_a.final_gpu_temp_c == res_b.final_gpu_temp_c
    assert res_a.final_primary_coolant_temp_c == res_b.final_primary_coolant_temp_c
    assert res_a.final_secondary_reservoir_temp_c == res_b.final_secondary_reservoir_temp_c
    assert res_a.total_heat_generated_j == res_b.total_heat_generated_j
    assert res_a.total_heat_recovered_hx_j == res_b.total_heat_recovered_hx_j
    assert res_a.time_series[-1].model_dump() == res_b.time_series[-1].model_dump()


def test_18_system_energy_conservation_residual_is_zero():
    """
    Test 18: First-Law Energy Conservation:
    E_generated = Delta E_GPU + Delta E_primary + Delta E_secondary + E_AGMD + E_ambient_loss
    Residual must be ~0 Joules within floating-point tolerance.
    """
    service = CirculationService()
    req = SystemSimulationRequest(
        gpu_power_w=350.0,
        heat_conversion_fraction=0.95,
        primary_coolant_mass_kg=2.0,
        secondary_water_mass_kg=20.0,
        primary_heat_loss_ua_w_k=2.0,
        secondary_heat_loss_ua_w_k=5.0,
        agmd_heat_demand_w=100.0,
        simulation_duration_s=60.0,
        time_step_s=1.0,
    )
    res = service.run_simulation(req)

    # Residual should be effectively zero (less than 1e-3 Joules over 60s of simulation)
    assert abs(res.system_energy_balance_residual_j) < 1e-3
    for step in res.time_series:
        assert abs(step.energy_balance_residual_j) < 1e-3


def test_19_no_artificial_heat_generation_when_power_is_zero():
    """Test 19: No artificial heat generation occurs when GPU power is 0 W."""
    service = CirculationService()
    req = SystemSimulationRequest(
        gpu_power_w=0.0,
        initial_gpu_temp_c=25.0,
        primary_initial_temp_c=25.0,
        secondary_initial_temp_c=25.0,
        ambient_temp_c=25.0,
        simulation_duration_s=20.0,
    )
    res = service.run_simulation(req)

    assert res.total_heat_generated_j == 0.0
    assert res.final_gpu_temp_c == 25.0
    assert res.final_primary_coolant_temp_c == 25.0
    assert res.final_secondary_reservoir_temp_c == 25.0


def test_20_parameter_validation_and_rejection():
    """Test 20: Negative masses, flow rates, invalid time steps are strictly rejected."""
    # Negative primary mass in domain model
    with pytest.raises(ValueError, match="Primary coolant mass must be strictly positive"):
        CirculationParameters(primary_coolant_mass_kg=-5.0)

    # Negative secondary mass in domain model
    with pytest.raises(ValueError, match="Secondary water mass must be strictly positive"):
        CirculationParameters(secondary_water_mass_kg=0.0)

    # Negative primary mass flow rate in domain model
    with pytest.raises(ValueError, match="Primary mass flow rate must be strictly positive"):
        CirculationParameters(primary_mass_flow_kg_s=0.0)

    # Time step > 5.0 s rejected by Pydantic
    with pytest.raises(ValueError):
        SystemSimulationRequest(time_step_s=6.0)

    # Steps > 100,000 rejected by Pydantic
    with pytest.raises(ValueError, match="exceeds the safety limit of 100,000 steps"):
        SystemSimulationRequest(simulation_duration_s=1000.0, time_step_s=0.005)


# ---------------------------------------------------------------------------
# API Endpoint Integration Tests
# ---------------------------------------------------------------------------

client = TestClient(app)


def test_21_api_system_simulation_and_reset_endpoints():
    """Test 21: Test POST /api/system/simulate and POST /api/system/reset endpoints."""
    # 1. Successful simulation with default request
    res = client.post("/api/system/simulate", json={})
    assert res.status_code == 200
    data = res.json()

    assert data["step_count"] == 60
    assert len(data["time_series"]) == 60
    assert data["total_heat_generated_j"] > 0.0
    assert abs(data["system_energy_balance_residual_j"]) < 1e-3

    # Validate first step fields
    step_0 = data["time_series"][0]
    assert "gpu_temp_c" in step_0
    assert "primary_coolant_temp_c" in step_0
    assert "secondary_reservoir_temp_c" in step_0
    assert "hx_heat_transfer_w" in step_0
    assert "energy_balance_residual_j" in step_0

    # 2. Validation error response on invalid input (422)
    res_bad = client.post("/api/system/simulate", json={"gpu_power_w": -100.0})
    assert res_bad.status_code == 422

    # 3. Reset endpoint
    res_reset = client.post("/api/system/reset")
    assert res_reset.status_code == 200
    reset_data = res_reset.json()
    assert reset_data["status"] == "success"
    assert reset_data["elapsed_time_s"] == 0.0
