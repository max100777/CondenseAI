"""
Automated closed-loop integration test suite for CondensAI Module 4:
Coupled GPU Thermal -> Heat Exchanger -> Storage Reservoir -> AGMD Desalination.

Tests cover:
1. Integrated closed-loop simulation with enable_agmd=True.
2. Dynamic reservoir temperature T_s directly supplies AGMD feed.
3. AGMD heat extraction cools the secondary reservoir compared to uncoupled system.
4. Complete First-Law energy conservation holds across all 4 modules.
5. Permeate freshwater accumulates continuously over time.
6. Cooldown behavior: zero GPU power causes production to decline and cease at ambient.
7. Thermal throttling at min_secondary_temp_c prevents overcooling the reservoir.
8. API endpoint POST /api/system/simulate with enable_agmd=True returns valid freshwater analytics.
"""

from __future__ import annotations

import math
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.circulation_model import CirculationModel, CirculationParameters
from backend.schemas.circulation_schema import SystemSimulationRequest
from backend.services.circulation_service import CirculationService


def test_1_coupled_agmd_produces_freshwater():
    """Test 1: Coupled system simulation produces freshwater when AGMD is enabled."""
    params = CirculationParameters(
        gpu_power_w=500.0,
        primary_initial_temp_c=50.0,
        secondary_initial_temp_c=45.0,
        enable_agmd=True,
        agmd_cold_plate_temp_c=20.0,
        simulation_duration_s=30.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)

    for _ in range(30):
        step = model.step()

    assert step.freshwater_production_rate_kg_s is not None
    assert step.freshwater_production_rate_kg_s > 0.0
    assert step.cumulative_freshwater_mass_kg is not None
    assert step.cumulative_freshwater_mass_kg > 0.0
    assert step.cumulative_freshwater_volume_l is not None
    assert step.cumulative_freshwater_volume_l > 0.0


def test_2_dynamic_reservoir_temp_drives_agmd():
    """Test 2: AGMD hot bulk temperature matches the secondary reservoir temperature."""
    params = CirculationParameters(
        gpu_power_w=800.0,
        primary_initial_temp_c=40.0,
        secondary_initial_temp_c=35.0,
        enable_agmd=True,
        simulation_duration_s=10.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)

    for _ in range(10):
        step = model.step()
        # Hot membrane temperature must be less than reservoir temperature due to boundary layer
        assert step.agmd_hot_membrane_temp_c is not None
        assert step.agmd_hot_membrane_temp_c <= step.secondary_reservoir_temp_c


def test_3_agmd_heat_extraction_cools_reservoir():
    """Test 3: Secondary reservoir temperature is lower when AGMD heat extraction is enabled."""
    # Simulation without AGMD
    params_no_agmd = CirculationParameters(
        gpu_power_w=400.0,
        primary_initial_temp_c=40.0,
        secondary_initial_temp_c=40.0,
        enable_agmd=False,
        simulation_duration_s=60.0,
        time_step_s=1.0,
    )
    model_no_agmd = CirculationModel(params_no_agmd)
    for _ in range(60):
        step_no_agmd = model_no_agmd.step()

    # Simulation with AGMD enabled
    params_with_agmd = CirculationParameters(
        gpu_power_w=400.0,
        primary_initial_temp_c=40.0,
        secondary_initial_temp_c=40.0,
        enable_agmd=True,
        agmd_cold_plate_temp_c=20.0,
        simulation_duration_s=60.0,
        time_step_s=1.0,
    )
    model_with_agmd = CirculationModel(params_with_agmd)
    for _ in range(60):
        step_with_agmd = model_with_agmd.step()

    assert step_with_agmd.secondary_reservoir_temp_c < step_no_agmd.secondary_reservoir_temp_c
    assert step_with_agmd.heat_to_agmd_w > 0.0


def test_4_first_law_energy_conservation_coupled():
    """Test 4: System energy conservation residual is ~0 J across all 4 coupled components."""
    params = CirculationParameters(
        gpu_power_w=600.0,
        primary_initial_temp_c=50.0,
        secondary_initial_temp_c=45.0,
        enable_agmd=True,
        simulation_duration_s=60.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)

    for _ in range(60):
        step = model.step()
        assert abs(step.energy_balance_residual_j) < 1e-3


def test_5_zero_gpu_power_cooldown():
    """Test 5: When GPU power is 0 W, system cools towards ambient and production stops."""
    params = CirculationParameters(
        gpu_power_w=0.0,
        primary_initial_temp_c=30.0,
        secondary_initial_temp_c=25.0,
        ambient_temp_c=20.0,
        enable_agmd=True,
        agmd_cold_plate_temp_c=25.0,
        simulation_duration_s=20.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)

    for _ in range(20):
        step = model.step()

    # Once secondary drops to/below cold plate (25°C), vapor flux must be 0
    assert step.freshwater_production_rate_kg_s == 0.0


def test_6_min_secondary_temp_throttling_coupled():
    """Test 6: AGMD heat extraction cannot force the secondary reservoir below min_secondary_temp_c."""
    params = CirculationParameters(
        gpu_power_w=0.0,
        primary_initial_temp_c=22.0,
        secondary_initial_temp_c=21.0,
        min_secondary_temp_c=20.0,
        enable_agmd=True,
        agmd_cold_plate_temp_c=10.0,
        simulation_duration_s=40.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)

    for _ in range(40):
        step = model.step()
        # Secondary reservoir must not drop below min_secondary_temp_c due to AGMD
        assert step.secondary_reservoir_temp_c >= 20.0 - 1e-4


def test_8_secondary_reservoir_reaching_tmin_throttles_agmd():
    """
    Test 8: Detailed verification of Scenario 5 when secondary reservoir reaches min permitted temp:
    - Reservoir is at or reaches T_min = 20.0°C.
    - Available power drops to 0.0 W.
    - AGMD heat extraction is throttled to 0.0 W.
    - Secondary reservoir does not drop below T_min.
    - Total energy balance across all 4 modules remains exact.
    """
    params = CirculationParameters(
        gpu_power_w=0.0,
        initial_gpu_temp_c=20.0,
        primary_initial_temp_c=20.0,
        secondary_initial_temp_c=20.0,
        min_secondary_temp_c=20.0,
        ambient_temp_c=20.0,
        enable_agmd=True,
        agmd_cold_plate_temp_c=10.0,
        simulation_duration_s=30.0,
        time_step_s=1.0,
    )
    model = CirculationModel(params)

    for _ in range(30):
        step = model.step()
        assert step.secondary_reservoir_temp_c >= 20.0 - 1e-6
        assert abs(step.energy_balance_residual_j) < 1e-3
        # When reservoir is at T_min, thermal extraction must be 0 W
        assert step.heat_to_agmd_w == 0.0
        assert step.freshwater_production_rate_kg_s == 0.0

    assert step.secondary_reservoir_temp_c == 20.0


client = TestClient(app)


def test_7_api_system_simulation_with_agmd():
    """Test 7: POST /api/system/simulate with enable_agmd=True returns full freshwater analytics."""
    payload = {
        "gpu_power_w": 500.0,
        "primary_initial_temp_c": 50.0,
        "secondary_initial_temp_c": 45.0,
        "enable_agmd": True,
        "agmd_cold_plate_temp_c": 20.0,
        "simulation_duration_s": 20.0,
    }
    res = client.post("/api/system/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["step_count"] == 20
    assert data["total_freshwater_produced_kg"] is not None
    assert data["total_freshwater_produced_kg"] > 0.0
    assert data["total_freshwater_produced_l"] is not None
    assert data["total_freshwater_produced_l"] > 0.0
    assert abs(data["system_energy_balance_residual_j"]) < 1e-3

    first_step = data["time_series"][0]
    assert "freshwater_production_rate_kg_s" in first_step
    assert first_step["freshwater_production_rate_kg_s"] is not None
    assert "feed_salinity_g_l" in first_step
    assert "agmd_hot_membrane_temp_c" in first_step
