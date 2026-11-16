"""
Automated unit and integration test suite for CondensAI Module 2: Heat Recovery Exchanger Model.

Tests cover:
1. Correct heat capacity rate calculations (C_h = m_dot_h * Cp, C_c = m_dot_c * Cp).
2. Correct maximum heat transfer calculation (Q_max = C_min * (T_h_in - T_c_in)).
3. Correct NTU calculation (NTU = UA / C_min).
4. Counterflow effectiveness calculation (general case C_r < 1).
5. Equal heat capacity rates edge case (C_r = 1: epsilon = NTU / (1 + NTU)).
6. Different primary and secondary mass flow rates.
7. Correct primary outlet temperature (T_h_out = T_h_in - Q_HX / C_h).
8. Correct secondary outlet temperature (T_c_out = T_c_in + Q_HX / C_c).
9. Energy conservation between both sides (Q_primary == Q_secondary == Q_HX).
10. Heat transfer never exceeding theoretical maximum (Q_HX <= Q_max).
11. Effectiveness strictly bounded between 0 and 1.
12. Equal inlet temperatures producing zero heat transfer.
13. Secondary inlet hotter than primary inlet producing zero positive recovery.
14. Invalid or zero mass flow rates being rejected.
15. Invalid or zero UA being rejected.
16. Invalid specific heat capacity being rejected.
17. NaN and infinite inputs being rejected.
18. Time step greater than 5.0 seconds being rejected.
19. Simulation exceeding 100,000 steps being rejected.
20. Deterministic output for identical inputs.
21. API endpoint integration (POST /api/heat-exchanger/simulate, POST /api/heat-exchanger/reset).
"""

from __future__ import annotations

import math
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.heat_exchanger_model import (
    HeatExchangerModel,
    HeatExchangerParameters,
    HeatExchangerStep,
)
from backend.schemas.heat_exchanger_schema import HeatExchangerSimulationRequest
from backend.services.heat_exchanger_service import HeatExchangerService


# ---------------------------------------------------------------------------
# Core Model Tests
# ---------------------------------------------------------------------------

def test_1_heat_capacity_rate_calculations():
    """Requirement 1: Correct heat capacity rate calculations (C_h = m_dot_h * Cp, C_c = m_dot_c * Cp)."""
    params = HeatExchangerParameters(
        primary_mass_flow_kg_s=0.05,
        secondary_mass_flow_kg_s=0.02,
        specific_heat_j_kg_k=4184.0,
    )
    model = HeatExchangerModel(params)
    c_h, c_c = model.calculate_heat_capacity_rates()

    # C_h = 0.05 * 4184 = 209.2 W/K
    # C_c = 0.02 * 4184 = 83.68 W/K
    assert math.isclose(c_h, 209.2, rel_tol=1e-6)
    assert math.isclose(c_c, 83.68, rel_tol=1e-6)


def test_2_maximum_heat_transfer_calculation():
    """Requirement 2: Correct maximum heat transfer calculation (Q_max = C_min * (T_h_in - T_c_in))."""
    params = HeatExchangerParameters(
        primary_inlet_temp_c=65.0,
        secondary_inlet_temp_c=25.0,
        primary_mass_flow_kg_s=0.05,
        secondary_mass_flow_kg_s=0.02,
        specific_heat_j_kg_k=4184.0,
    )
    model = HeatExchangerModel(params)
    c_h, c_c = model.calculate_heat_capacity_rates()
    c_min = min(c_h, c_c)  # 83.68 W/K

    # Q_max = 83.68 * (65 - 25) = 83.68 * 40 = 3347.2 W
    perf = model.calculate_thermal_performance()
    q_max = perf[7]
    assert math.isclose(q_max, c_min * 40.0, rel_tol=1e-6)
    assert math.isclose(q_max, 3347.2, rel_tol=1e-6)


def test_3_ntu_calculation():
    """Requirement 3: Correct NTU calculation (NTU = UA / C_min)."""
    params = HeatExchangerParameters(
        primary_mass_flow_kg_s=0.05,
        secondary_mass_flow_kg_s=0.02,
        ua_w_k=150.0,
        specific_heat_j_kg_k=4184.0,
    )
    model = HeatExchangerModel(params)
    c_h, c_c = model.calculate_heat_capacity_rates()
    c_min = min(c_h, c_c)  # 83.68 W/K

    # NTU = 150.0 / 83.68 = 1.792543...
    perf = model.calculate_thermal_performance()
    ntu = perf[5]
    assert math.isclose(ntu, 150.0 / c_min, rel_tol=1e-6)
    assert math.isclose(ntu, 1.792543, rel_tol=1e-4)


def test_4_counterflow_effectiveness_calculation():
    """Requirement 4: Counterflow effectiveness calculation for general case C_r < 1."""
    params = HeatExchangerParameters(
        primary_mass_flow_kg_s=0.05,
        secondary_mass_flow_kg_s=0.02,
        ua_w_k=150.0,
        specific_heat_j_kg_k=4184.0,
    )
    model = HeatExchangerModel(params)
    c_h, c_c = model.calculate_heat_capacity_rates()
    c_min = min(c_h, c_c)
    c_max = max(c_h, c_c)
    c_r = c_min / c_max  # 83.68 / 209.2 = 0.4
    ntu = 150.0 / c_min  # 1.792543

    # Analytical formula:
    # exp_val = exp(-NTU * (1 - C_r)) = exp(-1.792543 * 0.6) = exp(-1.0755258) = 0.3411195
    # epsilon = (1 - 0.3411195) / (1 - 0.4 * 0.3411195) = 0.6588805 / 0.8635522 = 0.762988
    perf = model.calculate_thermal_performance()
    eff = perf[6]
    expected_eff = (1.0 - math.exp(-ntu * (1.0 - c_r))) / (1.0 - c_r * math.exp(-ntu * (1.0 - c_r)))
    assert math.isclose(eff, expected_eff, rel_tol=1e-6)
    assert math.isclose(eff, 0.7630, abs_tol=1e-3)


def test_5_equal_heat_capacity_rates():
    """Requirement 5: Equal heat capacity rates (C_r = 1: epsilon = NTU / (1 + NTU))."""
    params = HeatExchangerParameters(
        primary_mass_flow_kg_s=0.03,
        secondary_mass_flow_kg_s=0.03,  # Equal mass flow rates -> C_r = 1.0
        ua_w_k=100.0,
        specific_heat_j_kg_k=4184.0,
    )
    model = HeatExchangerModel(params)
    c_h, c_c = model.calculate_heat_capacity_rates()
    c_min = min(c_h, c_c)
    ntu = 100.0 / c_min

    # Formula for C_r = 1: epsilon = NTU / (1 + NTU)
    expected_eff = ntu / (1.0 + ntu)

    perf = model.calculate_thermal_performance()
    c_r = perf[4]
    eff = perf[6]
    assert math.isclose(c_r, 1.0, rel_tol=1e-6)
    assert math.isclose(eff, expected_eff, rel_tol=1e-6)


def test_6_different_primary_and_secondary_flow_rates():
    """Requirement 6: Model accurately handles different primary and secondary flow rates."""
    # Case A: High primary flow, low secondary flow (C_h > C_c)
    params_a = HeatExchangerParameters(primary_mass_flow_kg_s=0.1, secondary_mass_flow_kg_s=0.02)
    model_a = HeatExchangerModel(params_a)
    perf_a = model_a.calculate_thermal_performance()
    assert perf_a[2] == perf_a[1]  # C_min == C_c

    # Case B: Low primary flow, high secondary flow (C_h < C_c)
    params_b = HeatExchangerParameters(primary_mass_flow_kg_s=0.02, secondary_mass_flow_kg_s=0.1)
    model_b = HeatExchangerModel(params_b)
    perf_b = model_b.calculate_thermal_performance()
    assert perf_b[2] == perf_b[0]  # C_min == C_h


def test_7_correct_primary_outlet_temperature():
    """Requirement 7: Primary outlet temperature T_h_out = T_h_in - Q_HX / C_h."""
    params = HeatExchangerParameters(
        primary_inlet_temp_c=65.0,
        secondary_inlet_temp_c=25.0,
        primary_mass_flow_kg_s=0.05,
        secondary_mass_flow_kg_s=0.02,
    )
    model = HeatExchangerModel(params)
    perf = model.calculate_thermal_performance()
    c_h = perf[0]
    q_hx = perf[8]
    t_h_out = perf[9]

    expected_t_h_out = 65.0 - (q_hx / c_h)
    assert math.isclose(t_h_out, expected_t_h_out, rel_tol=1e-6)
    # Hot fluid must cool down
    assert t_h_out < 65.0
    # Hot fluid cannot cool below cold inlet
    assert t_h_out >= 25.0


def test_8_correct_secondary_outlet_temperature():
    """Requirement 8: Secondary outlet temperature T_c_out = T_c_in + Q_HX / C_c."""
    params = HeatExchangerParameters(
        primary_inlet_temp_c=65.0,
        secondary_inlet_temp_c=25.0,
        primary_mass_flow_kg_s=0.05,
        secondary_mass_flow_kg_s=0.02,
    )
    model = HeatExchangerModel(params)
    perf = model.calculate_thermal_performance()
    c_c = perf[1]
    q_hx = perf[8]
    t_c_out = perf[10]

    expected_t_c_out = 25.0 + (q_hx / c_c)
    assert math.isclose(t_c_out, expected_t_c_out, rel_tol=1e-6)
    # Cold fluid must warm up
    assert t_c_out > 25.0
    # Cold fluid cannot exceed hot inlet
    assert t_c_out <= 65.0


def test_9_energy_conservation_between_both_sides():
    """Requirement 9: Primary coolant loses exactly the heat gained by secondary water (Q_primary == Q_secondary == Q_HX)."""
    params = HeatExchangerParameters(
        primary_inlet_temp_c=70.0,
        secondary_inlet_temp_c=20.0,
        primary_mass_flow_kg_s=0.04,
        secondary_mass_flow_kg_s=0.03,
        ua_w_k=180.0,
    )
    model = HeatExchangerModel(params)
    perf = model.calculate_thermal_performance()
    c_h, c_c = perf[0], perf[1]
    q_hx = perf[8]
    t_h_out = perf[9]
    t_c_out = perf[10]

    q_primary = c_h * (70.0 - t_h_out)
    q_secondary = c_c * (t_c_out - 20.0)

    assert math.isclose(q_primary, q_hx, rel_tol=1e-6)
    assert math.isclose(q_secondary, q_hx, rel_tol=1e-6)
    assert math.isclose(q_primary, q_secondary, rel_tol=1e-6)


def test_10_heat_transfer_never_exceeds_q_max():
    """Requirement 10: Heat transfer Q_HX <= Q_max under all conditions."""
    # Test with very large UA
    params_high_ua = HeatExchangerParameters(ua_w_k=10000.0)
    model = HeatExchangerModel(params_high_ua)
    perf = model.calculate_thermal_performance()
    q_max = perf[7]
    q_hx = perf[8]

    assert q_hx <= q_max
    assert math.isclose(q_hx, q_max, rel_tol=1e-2)  # Asymptotically approaches Q_max


def test_11_effectiveness_strictly_between_0_and_1():
    """Requirement 11: Effectiveness remains strictly between 0 and 1."""
    for ua in [0.1, 10.0, 150.0, 1000.0, 50000.0]:
        for flow_ratio in [0.01, 0.5, 1.0, 2.0, 50.0]:
            params = HeatExchangerParameters(
                primary_mass_flow_kg_s=0.05,
                secondary_mass_flow_kg_s=0.05 * flow_ratio,
                ua_w_k=ua,
            )
            model = HeatExchangerModel(params)
            perf = model.calculate_thermal_performance()
            eff = perf[6]
            assert 0.0 <= eff <= 1.0


def test_12_equal_inlet_temperatures_produce_zero_heat_transfer():
    """Requirement 12: Equal inlet temperatures produce zero heat transfer and unchanged outlet temperatures."""
    params = HeatExchangerParameters(
        primary_inlet_temp_c=30.0,
        secondary_inlet_temp_c=30.0,
    )
    model = HeatExchangerModel(params)
    perf = model.calculate_thermal_performance()
    q_max, q_hx, t_h_out, t_c_out = perf[7], perf[8], perf[9], perf[10]

    assert q_max == 0.0
    assert q_hx == 0.0
    assert t_h_out == 30.0
    assert t_c_out == 30.0


def test_13_secondary_inlet_hotter_than_primary_produces_zero_recovery():
    """Requirement 13: Secondary inlet hotter than primary inlet produces zero positive recovery."""
    params = HeatExchangerParameters(
        primary_inlet_temp_c=25.0,
        secondary_inlet_temp_c=40.0,  # Cold side is hotter than hot side
    )
    model = HeatExchangerModel(params)
    perf = model.calculate_thermal_performance()
    q_max, q_hx, t_h_out, t_c_out = perf[7], perf[8], perf[9], perf[10]

    assert q_max == 0.0
    assert q_hx == 0.0
    assert t_h_out == 25.0
    assert t_c_out == 40.0


def test_14_invalid_or_zero_mass_flow_rates_rejected():
    """Requirement 14: Invalid or zero mass flow rates are rejected."""
    with pytest.raises(ValueError, match="Primary mass flow rate must be strictly positive"):
        HeatExchangerParameters(primary_mass_flow_kg_s=0.0)

    with pytest.raises(ValueError, match="Primary mass flow rate must be strictly positive"):
        HeatExchangerParameters(primary_mass_flow_kg_s=-0.01)

    with pytest.raises(ValueError, match="Secondary mass flow rate must be strictly positive"):
        HeatExchangerParameters(secondary_mass_flow_kg_s=0.0)

    with pytest.raises(ValueError, match="Secondary mass flow rate must be strictly positive"):
        HeatExchangerParameters(secondary_mass_flow_kg_s=-0.05)


def test_15_invalid_or_zero_ua_rejected():
    """Requirement 15: Invalid or zero UA values are rejected."""
    with pytest.raises(ValueError, match="Overall heat transfer coefficient"):
        HeatExchangerParameters(ua_w_k=0.0)

    with pytest.raises(ValueError, match="Overall heat transfer coefficient"):
        HeatExchangerParameters(ua_w_k=-50.0)


def test_16_invalid_specific_heat_capacity_rejected():
    """Requirement 16: Invalid or zero specific heat capacity is rejected."""
    with pytest.raises(ValueError, match="Specific heat capacity must be strictly positive"):
        HeatExchangerParameters(specific_heat_j_kg_k=0.0)

    with pytest.raises(ValueError, match="Specific heat capacity must be strictly positive"):
        HeatExchangerParameters(specific_heat_j_kg_k=-4184.0)


def test_17_nan_and_infinite_inputs_rejected():
    """Requirement 17: NaN and infinite inputs are strictly rejected."""
    with pytest.raises(ValueError, match="must be a finite number"):
        HeatExchangerParameters(primary_inlet_temp_c=float("nan"))

    with pytest.raises(ValueError, match="must be a finite number"):
        HeatExchangerParameters(ua_w_k=float("inf"))


def test_18_time_step_greater_than_5s_rejected():
    """Requirement 18: Time step greater than 5.0 seconds is rejected."""
    with pytest.raises(ValueError, match="Time step must be strictly positive and <= 5.0 s"):
        HeatExchangerParameters(time_step_s=5.1)

    with pytest.raises(ValueError, match="Time step must be strictly positive and <= 5.0 s"):
        HeatExchangerParameters(time_step_s=10.0)

    # Step method runtime validation
    model = HeatExchangerModel()
    with pytest.raises(ValueError, match="Time step must be <= 5.0 s"):
        model.step(dt=5.5)


def test_19_simulation_exceeding_100k_steps_rejected():
    """Requirement 19: Simulation exceeding 100,000 steps is rejected by Pydantic schema validation."""
    with pytest.raises(ValueError, match="exceeds the safety limit of 100,000 steps"):
        HeatExchangerSimulationRequest(
            simulation_duration_s=1000.0,
            time_step_s=0.001,  # 1,000,000 steps > 100,000
        )


def test_20_deterministic_output_for_identical_inputs():
    """Requirement 20: Deterministic output for identical simulation inputs."""
    service = HeatExchangerService()
    req_a = HeatExchangerSimulationRequest(
        primary_inlet_temp_c=68.0,
        secondary_inlet_temp_c=22.0,
        primary_mass_flow_kg_s=0.06,
        secondary_mass_flow_kg_s=0.03,
        simulation_duration_s=30.0,
        time_step_s=0.5,
    )
    req_b = HeatExchangerSimulationRequest(
        primary_inlet_temp_c=68.0,
        secondary_inlet_temp_c=22.0,
        primary_mass_flow_kg_s=0.06,
        secondary_mass_flow_kg_s=0.03,
        simulation_duration_s=30.0,
        time_step_s=0.5,
    )

    res_a = service.run_simulation(req_a)
    res_b = service.run_simulation(req_b)

    assert res_a.effectiveness == res_b.effectiveness
    assert res_a.actual_heat_transfer_w == res_b.actual_heat_transfer_w
    assert res_a.total_recovered_energy_j == res_b.total_recovered_energy_j
    assert len(res_a.time_series) == len(res_b.time_series)
    assert res_a.time_series[-1].model_dump() == res_b.time_series[-1].model_dump()


# ---------------------------------------------------------------------------
# API Endpoint Integration Tests
# ---------------------------------------------------------------------------

client = TestClient(app)


def test_21_api_heat_exchanger_endpoints():
    """Requirement 21: Test POST /api/heat-exchanger/simulate and POST /api/heat-exchanger/reset."""
    # 1. Run simulation with defaults
    res = client.post("/api/heat-exchanger/simulate", json={})
    assert res.status_code == 200
    data = res.json()

    assert data["step_count"] == 60
    assert len(data["time_series"]) == 60
    assert 0.0 < data["effectiveness"] <= 1.0
    assert data["actual_heat_transfer_w"] > 0.0
    assert data["final_primary_outlet_temp_c"] < 65.0
    assert data["final_secondary_outlet_temp_c"] > 25.0
    assert data["total_recovered_energy_j"] > 0.0

    # Total energy should equal actual power * duration (since constant inlet temps)
    expected_energy = data["actual_heat_transfer_w"] * 60.0
    assert math.isclose(data["total_recovered_energy_j"], expected_energy, rel_tol=1e-3)

    # 2. Test validation rejections
    # dt > 5.0 s
    res_bad_dt = client.post("/api/heat-exchanger/simulate", json={"time_step_s": 6.0})
    assert res_bad_dt.status_code == 422

    # negative flow rate
    res_bad_flow = client.post("/api/heat-exchanger/simulate", json={"primary_mass_flow_kg_s": -0.1})
    assert res_bad_flow.status_code == 422

    # zero UA
    res_bad_ua = client.post("/api/heat-exchanger/simulate", json={"ua_w_k": 0.0})
    assert res_bad_ua.status_code == 422

    # 3. Test reset endpoint
    res_reset = client.post("/api/heat-exchanger/reset")
    assert res_reset.status_code == 200
    reset_data = res_reset.json()
    assert reset_data["status"] == "success"
    assert reset_data["elapsed_time_s"] == 0.0
    assert reset_data["cumulative_recovered_heat_j"] == 0.0
