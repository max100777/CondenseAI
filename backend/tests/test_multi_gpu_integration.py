"""
Integration tests for Multi-GPU Scaling API and Endpoints (Module 5).

Verifies:
- POST /api/multi-gpu/simulate with 1 GPU, 2 GPUs, and 4 GPUs.
- Automated calculation of Module 5 analytics within the multi-GPU response.
- POST /api/multi-gpu/reset endpoint.
- Error handling for invalid parameters (e.g., duplicate GPU IDs, excessive steps).
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_api_multi_gpu_simulate_single_gpu(client):
    """Test multi-GPU simulation endpoint with 1 GPU."""
    payload = {
        "gpus": [
            {
                "gpu_id": "GPU-1",
                "power_w": 350.0,
                "heat_conversion_fraction": 0.95,
                "initial_temp_c": 35.0,
                "thermal_resistance_k_per_w": 0.12,
                "thermal_capacitance_j_per_k": 250.0,
            }
        ],
        "simulation_duration_s": 30.0,
        "time_step_s": 1.0,
        "enable_agmd": False,
    }

    res = client.post("/api/multi-gpu/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["gpu_count"] == 1
    assert data["aggregate_power_w"] == 350.0
    assert len(data["gpu_comparison"]) == 1
    assert data["gpu_comparison"][0]["gpu_id"] == "GPU-1"
    assert len(data["time_series"]) == 30
    assert abs(data["system_energy_balance_residual_j"]) < 1e-6


def test_api_multi_gpu_simulate_four_gpus_with_agmd_and_analytics(client):
    """Test multi-GPU simulation with 4 GPUs coupled with AGMD and automated analytics."""
    payload = {
        "gpus": [
            {"gpu_id": "GPU-1", "power_w": 350.0, "initial_temp_c": 55.0},
            {"gpu_id": "GPU-2", "power_w": 350.0, "initial_temp_c": 55.0},
            {"gpu_id": "GPU-3", "power_w": 250.0, "initial_temp_c": 50.0},
            {"gpu_id": "GPU-4", "power_w": 250.0, "initial_temp_c": 50.0},
        ],
        "primary_initial_temp_c": 50.0,
        "secondary_initial_temp_c": 45.0,
        "agmd_cold_plate_temp_c": 20.0,
        "simulation_duration_s": 60.0,
        "time_step_s": 1.0,
        "enable_agmd": True,
    }

    res = client.post("/api/multi-gpu/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["gpu_count"] == 4
    assert data["aggregate_power_w"] == 1200.0  # 350 + 350 + 250 + 250
    assert len(data["gpu_comparison"]) == 4

    # Verify analytics were calculated automatically
    assert data["analytics"] is not None
    analytics = data["analytics"]
    assert analytics["total_freshwater_volume_l"] > 0.0
    assert analytics["heat_exchanger_recovery_percent"] > 0.0
    assert analytics["gpu_to_agmd_efficiency_percent"] > 0.0
    assert analytics["specific_thermal_energy_kwh_m3"] is not None
    assert analytics["specific_thermal_energy_kwh_m3"] > 0.0
    assert abs(data["system_energy_balance_residual_j"]) < 1e-6


def test_api_multi_gpu_reset(client):
    """Test POST /api/multi-gpu/reset endpoint."""
    res = client.post("/api/multi-gpu/reset")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "reset"
    assert "Multi-GPU simulation state has been reset" in data["message"]


def test_api_multi_gpu_rejects_duplicate_gpu_ids(client):
    """Test rejection of duplicate GPU IDs with 422 Unprocessable Entity."""
    payload = {
        "gpus": [
            {"gpu_id": "GPU-1", "power_w": 350.0},
            {"gpu_id": "GPU-1", "power_w": 250.0},
        ]
    }
    res = client.post("/api/multi-gpu/simulate", json=payload)
    assert res.status_code == 422
    assert "GPU IDs must be unique" in str(res.json())


def test_api_multi_gpu_rejects_excessive_steps(client):
    """Test rejection when simulation steps exceed 100,000 safety limit."""
    payload = {
        "gpus": [{"gpu_id": "GPU-1", "power_w": 350.0}],
        "time_step_s": 0.01,
        "simulation_duration_s": 2000.0,  # 200,000 steps > 100,000
    }
    res = client.post("/api/multi-gpu/simulate", json=payload)
    assert res.status_code == 422
    assert "exceeds the safety limit of 100,000 steps" in str(res.json())
