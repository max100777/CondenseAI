"""
Automated unit and standalone test suite for CondensAI Module 4:
Air-Gap Membrane Distillation (AGMD) Desalination Model.

Tests cover:
1. Antoine saturation vapor pressure calculation within 1% of standard steam tables.
2. Salinity water activity (a_w) depression with increasing salt concentration.
3. Temperature-dependent latent heat of vaporization (h_fg).
4. Membrane and air-gap mass transfer resistances.
5. Air-gap thickness sweep: thicker air gap increases resistance and lowers flux.
6. Feed temperature sweep: higher feed temperature increases flux non-linearly.
7. Cold plate temperature sweep: colder plate increases driving vapor pressure and flux.
8. Zero driving force: T_feed <= T_cold produces zero vapor flux and zero water.
9. Salinity sweep: higher salinity depresses vapor pressure and reduces flux.
10. Thermal polarization: T_cold <= T_mc <= T_mh <= T_feed.
11. Freshwater production rate and volumetric integration.
12. Feed water mass conservation (dm_feed/dt = -J*A).
13. Salt conservation: dissolved salt mass is constant; salinity increases as water evaporates.
14. Energy balance across AGMD module: supplied heat equals latent + conductive heat.
15. Thermal power throttling when available secondary power is limited.
16. Depleted inventory handling: graceful zero-flux state when feed is dry.
17. Parameter bounds and rejection of invalid/non-finite inputs.
18. Simulation determinism for identical inputs.
19. AGMD model reset functionality.
20. Standalone API endpoints: POST /api/agmd/simulate and POST /api/agmd/reset.
"""

from __future__ import annotations

import math
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.agmd_model import (
    AGMDModel,
    AGMDParameters,
    calculate_latent_heat_of_vaporization_j_kg,
    calculate_saturation_vapor_pressure_pa,
    calculate_water_activity,
)
from backend.schemas.agmd_schema import AGMDRequest
from backend.services.agmd_service import AGMDService


# ---------------------------------------------------------------------------
# Thermodynamic & Physical Correlation Tests
# ---------------------------------------------------------------------------

def test_1_antoine_vapor_pressure_accuracy():
    """Test 1: Saturation vapor pressure matches steam tables within 1% across 20-100°C."""
    # Benchmarks from NIST / CRC handbook:
    # 20°C: ~2338 Pa
    # 60°C: ~19940 Pa
    # 70°C: ~31200 Pa
    # 100°C: ~101325 Pa
    p_20 = calculate_saturation_vapor_pressure_pa(20.0)
    assert abs(p_20 - 2338.0) / 2338.0 < 0.01

    p_60 = calculate_saturation_vapor_pressure_pa(60.0)
    assert abs(p_60 - 19940.0) / 19940.0 < 0.01

    p_70 = calculate_saturation_vapor_pressure_pa(70.0)
    assert abs(p_70 - 31200.0) / 31200.0 < 0.01

    p_100 = calculate_saturation_vapor_pressure_pa(100.0)
    assert abs(p_100 - 101325.0) / 101325.0 < 0.01


def test_2_salinity_water_activity_depression():
    """Test 2: Pure water activity is 1.0; decreases monotonically with salinity."""
    a_pure = calculate_water_activity(0.0)
    assert a_pure == 1.0

    a_seawater = calculate_water_activity(35.0)
    # Sharqawy correlation: 1.0 - 0.000537 * 35 = 0.9812
    assert 0.980 < a_seawater < 0.985

    a_brine = calculate_water_activity(100.0)
    assert a_brine < a_seawater


def test_3_latent_heat_of_vaporization():
    """Test 3: Latent heat h_fg decreases with temperature as expected."""
    h_0 = calculate_latent_heat_of_vaporization_j_kg(0.0)
    assert abs(h_0 - 2.501e6) < 1.0

    h_60 = calculate_latent_heat_of_vaporization_j_kg(60.0)
    assert 2.35e6 < h_60 < 2.40e6

    h_100 = calculate_latent_heat_of_vaporization_j_kg(100.0)
    assert abs(h_100 - (2.501e6 - 237000.0)) < 1.0


# ---------------------------------------------------------------------------
# Transport Resistances & Polarization Tests
# ---------------------------------------------------------------------------

def test_4_mass_transfer_resistances():
    """Test 4: Both membrane and air-gap resistances are positive and sum to total resistance."""
    model = AGMDModel()
    r_m, r_a, r_total = model.calculate_mass_transfer_resistances(t_hot_c=65.0, t_cold_c=25.0)

    assert r_m > 0.0
    assert r_a > 0.0
    assert math.isclose(r_total, r_m + r_a, rel_tol=1e-9)


def test_5_air_gap_thickness_effect():
    """Test 5: Increasing air gap thickness increases air-gap resistance and decreases flux."""
    params_thin = AGMDParameters(air_gap_thickness_m=0.001)
    params_thick = AGMDParameters(air_gap_thickness_m=0.005)

    model_thin = AGMDModel(params_thin)
    model_thick = AGMDModel(params_thick)

    step_thin = model_thin.step(dt=1.0)
    step_thick = model_thick.step(dt=1.0)

    assert step_thick.air_gap_resistance_pa_s_m2_per_kg > step_thin.air_gap_resistance_pa_s_m2_per_kg
    assert step_thin.vapor_flux_kg_m2_s > step_thick.vapor_flux_kg_m2_s


def test_6_feed_temperature_sweep():
    """Test 6: Higher feed temperature increases vapor flux non-linearly."""
    fluxes = []
    temps = [50.0, 60.0, 70.0]

    for t in temps:
        params = AGMDParameters(initial_feed_temp_c=t, cold_plate_temp_c=25.0)
        model = AGMDModel(params)
        step = model.step(dt=1.0)
        fluxes.append(step.vapor_flux_kg_m2_s)

    assert fluxes[0] < fluxes[1] < fluxes[2]
    # Check non-linear increase (Arrhenius / exponential growth)
    increase_1 = fluxes[1] - fluxes[0]
    increase_2 = fluxes[2] - fluxes[1]
    assert increase_2 > increase_1


def test_7_cold_plate_temperature_sweep():
    """Test 7: Lower cold plate temperature increases vapor pressure difference and flux."""
    params_colder = AGMDParameters(initial_feed_temp_c=70.0, cold_plate_temp_c=15.0)
    params_warmer = AGMDParameters(initial_feed_temp_c=70.0, cold_plate_temp_c=30.0)

    model_colder = AGMDModel(params_colder)
    model_warmer = AGMDModel(params_warmer)

    step_colder = model_colder.step(dt=1.0)
    step_warmer = model_warmer.step(dt=1.0)

    assert step_colder.vapor_pressure_difference_pa > step_warmer.vapor_pressure_difference_pa
    assert step_colder.vapor_flux_kg_m2_s > step_warmer.vapor_flux_kg_m2_s


def test_8_zero_driving_force_when_cold_or_equal():
    """Test 8: When feed temperature is <= cold plate temperature, flux is exactly zero."""
    params = AGMDParameters(initial_feed_temp_c=25.0, cold_plate_temp_c=25.0)
    model = AGMDModel(params)
    step = model.step(dt=1.0)

    assert step.vapor_flux_kg_m2_s == 0.0
    assert step.freshwater_production_rate_kg_s == 0.0
    assert step.latent_heat_flux_w == 0.0


def test_9_salinity_effect_on_flux():
    """Test 9: Higher salinity depresses water activity and lowers permeate flux."""
    params_fresh = AGMDParameters(initial_salinity_g_l=0.0)
    params_saline = AGMDParameters(initial_salinity_g_l=70.0)

    model_fresh = AGMDModel(params_fresh)
    model_saline = AGMDModel(params_saline)

    step_fresh = model_fresh.step(dt=1.0)
    step_saline = model_saline.step(dt=1.0)

    assert step_fresh.hot_effective_vapor_pressure_pa > step_saline.hot_effective_vapor_pressure_pa
    assert step_fresh.vapor_flux_kg_m2_s > step_saline.vapor_flux_kg_m2_s


def test_10_thermal_polarization():
    """Test 10: Thermal polarization ensures T_cold <= T_mc <= T_mh <= T_feed."""
    params = AGMDParameters(initial_feed_temp_c=70.0, cold_plate_temp_c=25.0)
    model = AGMDModel(params)
    step = model.step(dt=1.0)

    assert 25.0 <= step.cold_plate_temp_c
    assert step.cold_plate_temp_c <= step.cold_condensing_temp_c
    assert step.cold_condensing_temp_c <= step.hot_membrane_temp_c
    assert step.hot_membrane_temp_c <= step.bulk_feed_temp_c
    assert step.bulk_feed_temp_c <= 70.0
    assert step.converged == 1.0


# ---------------------------------------------------------------------------
# Mass & Energy Balances Tests
# ---------------------------------------------------------------------------

def test_11_freshwater_production_and_volumetric_rate():
    """Test 11: Freshwater production rate is consistent with vapor flux and area."""
    model = AGMDModel()
    step = model.step(dt=1.0)

    expected_kg_s = step.vapor_flux_kg_m2_s * model.params.active_area_m2
    assert math.isclose(step.freshwater_production_rate_kg_s, expected_kg_s, rel_tol=1e-4)

    # Volumetric rate in L/h: (kg/s / 1000 kg/m3) * 3600 s/h * 1000 L/m3 = kg/s * 3600
    expected_l_h = step.freshwater_production_rate_kg_s * 3600.0
    assert math.isclose(step.freshwater_production_rate_l_h, expected_l_h, rel_tol=1e-3)


def test_12_feed_water_mass_conservation():
    """Test 12: Feed water mass is strictly depleted by the exact cumulative freshwater produced."""
    params = AGMDParameters(initial_feed_mass_kg=5.0)
    model = AGMDModel(params)

    for _ in range(30):
        step = model.step(dt=1.0)

    initial_mass = params.initial_feed_mass_kg
    final_feed_mass = model.current_feed_mass_kg
    produced_fw_mass = model.cumulative_freshwater_mass_kg

    total_accounted = final_feed_mass + produced_fw_mass
    assert math.isclose(total_accounted, initial_mass, rel_tol=1e-7)


def test_13_dissolved_salt_mass_conservation():
    """Test 13: Salt mass is strictly conserved; feed salinity increases as water evaporates."""
    params = AGMDParameters(initial_feed_mass_kg=0.5, initial_salinity_g_l=35.0)
    model = AGMDModel(params)

    # Initial salt mass: 35 g/L * (0.5 kg / 1025 kg/m3 * 1000 L/m3) / 1000 g/kg
    v_init_l = (0.5 / 1025.0) * 1000.0
    m_salt_init = (35.0 * v_init_l) / 1000.0

    for _ in range(100):
        step = model.step(dt=1.0)

    v_final_l = (model.current_feed_mass_kg / 1025.0) * 1000.0
    m_salt_final = (model.current_salinity_g_l * v_final_l) / 1000.0

    assert math.isclose(m_salt_init, m_salt_final, rel_tol=1e-6)
    assert model.current_salinity_g_l > 35.0


def test_14_energy_balance_across_agmd():
    """Test 14: Heat supplied equals latent heat + conductive heat (residual is ~0)."""
    model = AGMDModel()
    step = model.step(dt=1.0)

    assert abs(step.energy_balance_residual_w) < 1e-4
    assert step.total_agmd_heat_demand_w > 0.0
    assert math.isclose(
        step.actual_heat_supplied_w,
        step.latent_heat_flux_w + step.conductive_heat_flux_w,
        rel_tol=1e-5,
    )


def test_15_thermal_power_throttling():
    """Test 15: When available thermal power is less than unconstrained demand, heat is throttled."""
    model = AGMDModel()
    unconstrained_step = model.step(dt=1.0)
    unconstrained_demand = unconstrained_step.total_agmd_heat_demand_w

    model_throttled = AGMDModel()
    throttled_power = 0.5 * unconstrained_demand
    throttled_step = model_throttled.step(dt=1.0, available_thermal_power_w=throttled_power)

    assert throttled_step.actual_heat_supplied_w <= throttled_power + 1e-6
    assert throttled_step.unmet_heat_demand_w > 0.0
    assert throttled_step.freshwater_production_rate_kg_s < unconstrained_step.freshwater_production_rate_kg_s
    assert abs(throttled_step.energy_balance_residual_w) < 1e-4


def test_15b_power_throttling_comprehensive_matrix():
    """
    Test 15b: Rigorous verification across 4 distinct available power regimes:
    1. Available power > demand (unthrottled full production).
    2. Available power == demand (exact match).
    3. Available power < demand (partial latent production and zero latent / conductive only).
    4. Available power == 0.0 W (complete shutoff: 0 W actual, 0 kg/s flux, 0 W residual).
    """
    base_model = AGMDModel()
    unconstrained = base_model.step(dt=1.0)
    q_dem = unconstrained.total_agmd_heat_demand_w
    q_cond = unconstrained.conductive_heat_flux_w

    # Regime 1: Available power > demand
    m1 = AGMDModel()
    s1 = m1.step(dt=1.0, available_thermal_power_w=q_dem * 2.0)
    assert math.isclose(s1.actual_heat_supplied_w, q_dem, rel_tol=1e-5)
    assert s1.unmet_heat_demand_w == 0.0
    assert math.isclose(s1.vapor_flux_kg_m2_s, unconstrained.vapor_flux_kg_m2_s, rel_tol=1e-5)
    assert abs(s1.energy_balance_residual_w) < 1e-4

    # Regime 2: Available power == demand
    m2 = AGMDModel()
    s2 = m2.step(dt=1.0, available_thermal_power_w=q_dem)
    assert math.isclose(s2.actual_heat_supplied_w, q_dem, rel_tol=1e-5)
    assert s2.unmet_heat_demand_w == 0.0
    assert math.isclose(s2.vapor_flux_kg_m2_s, unconstrained.vapor_flux_kg_m2_s, rel_tol=1e-5)
    assert abs(s2.energy_balance_residual_w) < 1e-4

    # Regime 3a: Available power < demand but > conductive heat (partial latent production)
    m3a = AGMDModel()
    p_mid = q_cond + 0.5 * (q_dem - q_cond)
    s3a = m3a.step(dt=1.0, available_thermal_power_w=p_mid)
    assert math.isclose(s3a.actual_heat_supplied_w, p_mid, rel_tol=1e-5)
    assert s3a.unmet_heat_demand_w > 0.0
    assert 0.0 < s3a.freshwater_production_rate_kg_s < unconstrained.freshwater_production_rate_kg_s
    assert s3a.latent_heat_flux_w > 0.0
    assert abs(s3a.energy_balance_residual_w) < 1e-4

    # Regime 3b: Available power < conductive heat (conductive throttled, zero latent production)
    m3b = AGMDModel()
    p_low = 0.5 * q_cond
    s3b = m3b.step(dt=1.0, available_thermal_power_w=p_low)
    assert math.isclose(s3b.actual_heat_supplied_w, p_low, rel_tol=1e-5)
    assert s3b.latent_heat_flux_w == 0.0
    assert s3b.freshwater_production_rate_kg_s == 0.0
    assert math.isclose(s3b.conductive_heat_flux_w, p_low, rel_tol=1e-5)
    assert abs(s3b.energy_balance_residual_w) < 1e-4

    # Regime 4: Available power == 0.0 W (complete shutoff)
    m4 = AGMDModel()
    s4 = m4.step(dt=1.0, available_thermal_power_w=0.0)
    assert s4.actual_heat_supplied_w == 0.0
    assert s4.latent_heat_flux_w == 0.0
    assert s4.conductive_heat_flux_w == 0.0
    assert s4.freshwater_production_rate_kg_s == 0.0
    assert s4.cold_plate_heat_rejection_w == 0.0
    assert s4.unmet_heat_demand_w == q_dem
    assert abs(s4.energy_balance_residual_w) < 1e-6
    # Boundary temperatures remain at bulk temperatures when zero heat is transferred
    assert math.isclose(s4.hot_membrane_temp_c, s4.bulk_feed_temp_c, abs_tol=1e-4)
    assert math.isclose(s4.cold_condensing_temp_c, s4.cold_plate_temp_c, abs_tol=1e-4)


def test_16_depleted_inventory_behavior():
    """Test 16: When feed water mass reaches zero, production stops gracefully."""
    params = AGMDParameters(initial_feed_mass_kg=1e-6)
    model = AGMDModel(params)
    step = model.step(dt=1.0)

    # Next step should find inventory depleted
    step2 = model.step(dt=1.0)
    assert step2.freshwater_production_rate_kg_s == 0.0
    assert step2.feed_inventory_mass_kg == 0.0
    assert step2.vapor_flux_kg_m2_s == 0.0


# ---------------------------------------------------------------------------
# Validation & Numerical Diagnostics Tests
# ---------------------------------------------------------------------------

def test_17_parameter_validation_and_rejection():
    """Test 17: Non-finite numbers, negative dimensions, time step > 5s, etc. are rejected."""
    # Negative pore diameter
    with pytest.raises(ValueError, match="Membrane pore diameter must be strictly positive"):
        AGMDParameters(membrane_pore_diameter_m=-1e-6)

    # Porosity outside (0, 1)
    with pytest.raises(ValueError, match="Membrane porosity must be between 0 and 1"):
        AGMDParameters(membrane_porosity=1.5)

    # Time step > 5 s in Pydantic schema
    with pytest.raises(ValueError):
        AGMDRequest(time_step_s=6.0)

    # Steps > 100,000 in Pydantic schema
    with pytest.raises(ValueError, match="exceeds the safety limit of 100,000 steps"):
        AGMDRequest(simulation_duration_s=1000.0, time_step_s=0.005)


def test_18_simulation_determinism():
    """Test 18: Identical simulation inputs produce deterministic, bit-exact results."""
    req = AGMDRequest(initial_feed_temp_c=65.0, cold_plate_temp_c=20.0, simulation_duration_s=10.0)
    service = AGMDService()

    res1 = service.run_simulation(req)
    res2 = service.run_simulation(req)

    assert res1.total_freshwater_produced_kg == res2.total_freshwater_produced_kg
    assert res1.total_thermal_energy_consumed_j == res2.total_thermal_energy_consumed_j
    assert len(res1.time_series) == len(res2.time_series)


def test_19_model_reset():
    """Test 19: Reset clears elapsed time, freshwater yield, and restores initial feed mass."""
    model = AGMDModel(AGMDParameters(initial_feed_mass_kg=10.0))
    for _ in range(10):
        model.step(dt=1.0)

    assert model.elapsed_time_s == 10.0
    assert model.cumulative_freshwater_mass_kg > 0.0

    model.reset()
    assert model.elapsed_time_s == 0.0
    assert model.cumulative_freshwater_mass_kg == 0.0
    assert model.current_feed_mass_kg == 10.0


# ---------------------------------------------------------------------------
# API Endpoint Integration Tests
# ---------------------------------------------------------------------------

client = TestClient(app)


def test_20_api_agmd_simulate_and_reset():
    """Test 20: Test POST /api/agmd/simulate and POST /api/agmd/reset endpoints."""
    # 1. Normal simulation
    res = client.post("/api/agmd/simulate", json={"initial_feed_temp_c": 65.0, "simulation_duration_s": 10.0})
    assert res.status_code == 200
    data = res.json()

    assert data["step_count"] == 10
    assert len(data["time_series"]) == 10
    assert data["total_freshwater_produced_kg"] > 0.0
    assert data["total_freshwater_produced_l"] > 0.0

    step_0 = data["time_series"][0]
    assert "bulk_feed_temp_c" in step_0
    assert "hot_membrane_temp_c" in step_0
    assert "cold_condensing_temp_c" in step_0
    assert "vapor_flux_kg_m2_s" in step_0
    assert "freshwater_production_rate_kg_s" in step_0
    assert "energy_balance_residual_w" in step_0

    # 2. Validation error response on negative dimensions (422)
    res_bad = client.post("/api/agmd/simulate", json={"air_gap_thickness_m": -0.01})
    assert res_bad.status_code == 422

    # 3. Reset endpoint
    res_reset = client.post("/api/agmd/reset")
    assert res_reset.status_code == 200
    reset_data = res_reset.json()
    assert reset_data["status"] == "success"
    assert reset_data["elapsed_time_s"] == 0.0
