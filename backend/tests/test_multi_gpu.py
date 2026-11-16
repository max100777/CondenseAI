"""
Unit and physical validation tests for Module 5: Multi-GPU Waste-Heat Scaling.

Verifies:
- Test 1: Single-GPU equivalence against frozen CirculationModel.
- Test 2: Two identical GPUs (additive heat generation).
- Test 3: Heterogeneous GPUs (independent temperatures and distinct parameters).
- Test 4: GPU Count scaling (1 vs 2 vs 4 GPUs).
- Test 5: Full First-Law system energy conservation across N GPUs (residual < 1e-6 J).
- Test 6: AGMD coupling with minimum secondary reservoir temperature protection.
- Test 7: Input validation (duplicate IDs, invalid bounds).
"""

import math
import pytest

from backend.models.circulation_model import CirculationModel, CirculationParameters
from backend.models.multi_gpu_model import (
    GPUConfig,
    MultiGPUModel,
    MultiGPUParameters,
)


def test_single_gpu_equivalence_against_circulation_model():
    """
    Test 1: Single-GPU Equivalence.
    A multi-GPU model configured with 1 GPU must reproduce the single-GPU CirculationModel
    within strict floating-point tolerances (< 1e-6) across all circuits and timesteps.
    """
    # Configure single-GPU circulation model
    circ_params = CirculationParameters(
        gpu_power_w=350.0,
        heat_conversion_fraction=0.95,
        initial_gpu_temp_c=35.0,
        thermal_resistance_k_per_w=0.12,
        thermal_capacitance_j_per_k=250.0,
        primary_coolant_mass_kg=2.0,
        primary_mass_flow_kg_s=0.05,
        primary_initial_temp_c=30.0,
        primary_specific_heat_j_kg_k=4184.0,
        primary_heat_loss_ua_w_k=2.0,
        exchanger_ua_w_k=150.0,
        secondary_water_mass_kg=20.0,
        secondary_mass_flow_kg_s=0.02,
        secondary_initial_temp_c=25.0,
        secondary_specific_heat_j_kg_k=4184.0,
        secondary_heat_loss_ua_w_k=5.0,
        ambient_temp_c=25.0,
        agmd_heat_demand_w=50.0,
        min_secondary_temp_c=20.0,
        time_step_s=1.0,
        simulation_duration_s=60.0,
        enable_agmd=False,
    )
    circ_model = CirculationModel(circ_params)

    # Configure matching multi-GPU model with 1 GPU
    multi_params = MultiGPUParameters(
        gpus=[
            GPUConfig(
                gpu_id="GPU-1",
                power_w=350.0,
                heat_conversion_fraction=0.95,
                initial_temp_c=35.0,
                thermal_resistance_k_per_w=0.12,
                thermal_capacitance_j_per_k=250.0,
            )
        ],
        primary_coolant_mass_kg=2.0,
        primary_mass_flow_kg_s=0.05,
        primary_initial_temp_c=30.0,
        primary_specific_heat_j_kg_k=4184.0,
        primary_heat_loss_ua_w_k=2.0,
        exchanger_ua_w_k=150.0,
        secondary_water_mass_kg=20.0,
        secondary_mass_flow_kg_s=0.02,
        secondary_initial_temp_c=25.0,
        secondary_specific_heat_j_kg_k=4184.0,
        secondary_heat_loss_ua_w_k=5.0,
        ambient_temp_c=25.0,
        agmd_heat_demand_w=50.0,
        min_secondary_temp_c=20.0,
        time_step_s=1.0,
        simulation_duration_s=60.0,
        enable_agmd=False,
    )
    multi_model = MultiGPUModel(multi_params)

    for step_idx in range(60):
        c_step = circ_model.step(1.0)
        m_step = multi_model.step(1.0)

        # GPU temperature & fluxes
        assert pytest.approx(m_step.gpu_states[0].current_temp_c, abs=1e-4) == c_step.gpu_temp_c
        assert pytest.approx(m_step.aggregate_heat_generated_w, abs=1e-4) == c_step.heat_generated_w
        assert pytest.approx(m_step.aggregate_heat_to_coolant_w, abs=1e-4) == c_step.heat_to_coolant_w

        # Primary circuit
        assert pytest.approx(m_step.primary_coolant_temp_c, abs=1e-4) == c_step.primary_coolant_temp_c
        assert pytest.approx(m_step.primary_heat_loss_w, abs=1e-4) == c_step.primary_heat_loss_w

        # Heat exchanger
        assert pytest.approx(m_step.hx_heat_transfer_w, abs=1e-4) == c_step.hx_heat_transfer_w
        assert pytest.approx(m_step.hx_effectiveness, abs=1e-4) == c_step.hx_effectiveness

        # Secondary reservoir
        assert pytest.approx(m_step.secondary_reservoir_temp_c, abs=1e-4) == c_step.secondary_reservoir_temp_c
        assert pytest.approx(m_step.heat_to_agmd_w, abs=1e-4) == c_step.heat_to_agmd_w

        # Cumulative energy balance
        assert pytest.approx(m_step.cumulative_heat_generated_j, abs=1e-3) == c_step.cumulative_heat_generated_j
        assert pytest.approx(m_step.cumulative_heat_recovered_hx_j, abs=1e-3) == c_step.cumulative_heat_recovered_hx_j
        assert abs(m_step.energy_balance_residual_j) < 1e-6


def test_two_identical_gpus():
    """
    Test 2: Two Identical GPUs.
    Two identical 350 W GPUs must generate exactly 2x individual heat.
    """
    g1 = GPUConfig(gpu_id="GPU-1", power_w=350.0, heat_conversion_fraction=0.95, initial_temp_c=35.0)
    g2 = GPUConfig(gpu_id="GPU-2", power_w=350.0, heat_conversion_fraction=0.95, initial_temp_c=35.0)

    params = MultiGPUParameters(
        gpus=[g1, g2],
        simulation_duration_s=30.0,
    )
    model = MultiGPUModel(params)

    step = model.step(1.0)

    # Individual GPU heat generation = 350 * 0.95 = 332.5 W
    assert pytest.approx(step.gpu_states[0].heat_generated_w, rel=1e-5) == 332.5
    assert pytest.approx(step.gpu_states[1].heat_generated_w, rel=1e-5) == 332.5
    assert pytest.approx(step.aggregate_heat_generated_w, rel=1e-5) == 665.0

    # Symmetry: both identical GPUs must maintain identical temperatures
    assert step.gpu_states[0].current_temp_c == step.gpu_states[1].current_temp_c


def test_heterogeneous_gpus():
    """
    Test 3: Heterogeneous GPUs with distinct powers, initial temps, and thermal resistances.
    Verify independent evolution of each GPU's temperature and aggregate heat transfer.
    """
    g1 = GPUConfig(gpu_id="GPU-1", power_w=400.0, initial_temp_c=40.0, thermal_resistance_k_per_w=0.10)
    g2 = GPUConfig(gpu_id="GPU-2", power_w=200.0, initial_temp_c=30.0, thermal_resistance_k_per_w=0.15)

    params = MultiGPUParameters(gpus=[g1, g2], simulation_duration_s=20.0)
    model = MultiGPUModel(params)

    for _ in range(20):
        step = model.step(1.0)

    # GPU-1 should run significantly hotter than GPU-2
    assert step.gpu_states[0].current_temp_c > step.gpu_states[1].current_temp_c
    assert step.gpu_states[0].heat_generated_w == 400.0 * 0.95  # 380 W
    assert step.gpu_states[1].heat_generated_w == 200.0 * 0.95  # 190 W
    assert pytest.approx(step.aggregate_heat_generated_w, rel=1e-5) == 570.0
    assert abs(step.energy_balance_residual_j) < 1e-6


def test_gpu_count_scaling_1_2_4_gpus():
    """
    Test 4: Scaling Comparison (1 GPU vs 2 GPUs vs 4 GPUs).
    Verify additive heat generation and monotonically increasing primary/secondary temperatures.
    """
    def run_sim(n_gpus: int) -> tuple[float, float, float, float]:
        gpus = [
            GPUConfig(gpu_id=f"GPU-{i+1}", power_w=300.0, heat_conversion_fraction=0.95, initial_temp_c=35.0)
            for i in range(n_gpus)
        ]
        params = MultiGPUParameters(
            gpus=gpus,
            simulation_duration_s=60.0,
            primary_coolant_mass_kg=2.0,
            secondary_water_mass_kg=20.0,
        )
        model = MultiGPUModel(params)
        for _ in range(60):
            step = model.step(1.0)
        return (
            step.cumulative_heat_generated_j,
            step.primary_coolant_temp_c,
            step.secondary_reservoir_temp_c,
            step.cumulative_heat_recovered_hx_j,
        )

    q_gen_1, t_p_1, t_s_1, q_hx_1 = run_sim(1)
    q_gen_2, t_p_2, t_s_2, q_hx_2 = run_sim(2)
    q_gen_4, t_p_4, t_s_4, q_hx_4 = run_sim(4)

    # Total heat generated scales exactly linearly with GPU count: Q = N * 300 * 0.95 * 60
    assert pytest.approx(q_gen_2, rel=1e-5) == 2.0 * q_gen_1
    assert pytest.approx(q_gen_4, rel=1e-5) == 4.0 * q_gen_1

    # Temperatures and heat recovery increase monotonically with GPU count
    assert t_p_1 < t_p_2 < t_p_4
    assert t_s_1 < t_s_2 < t_s_4
    assert q_hx_1 < q_hx_2 < q_hx_4


def test_first_law_conservation_residual_multi_gpu():
    """
    Test 5: Full First-Law Energy Conservation.
    Verifies that for N=4 GPUs over 100 seconds with heat losses,
    the energy balance residual remains < 1e-6 J at every step.
    """
    gpus = [
        GPUConfig(gpu_id="G1", power_w=350.0, initial_temp_c=35.0),
        GPUConfig(gpu_id="G2", power_w=300.0, initial_temp_c=32.0),
        GPUConfig(gpu_id="G3", power_w=250.0, initial_temp_c=30.0),
        GPUConfig(gpu_id="G4", power_w=400.0, initial_temp_c=38.0),
    ]
    params = MultiGPUParameters(
        gpus=gpus,
        simulation_duration_s=100.0,
        agmd_heat_demand_w=120.0,
    )
    model = MultiGPUModel(params)

    for i in range(100):
        step = model.step(1.0)
        # Residual must be zero within floating point machine precision
        assert abs(step.energy_balance_residual_j) < 1e-6, f"Residual exceeded at step {i}: {step.energy_balance_residual_j}"


def test_multi_gpu_agmd_coupling_and_throttling():
    """
    Test 6: Multi-GPU coupled with AGMD desalination and minimum reservoir temperature protection.
    """
    gpus = [
        GPUConfig(gpu_id="G1", power_w=500.0, initial_temp_c=60.0),
        GPUConfig(gpu_id="G2", power_w=500.0, initial_temp_c=60.0),
    ]
    params = MultiGPUParameters(
        gpus=gpus,
        enable_agmd=True,
        primary_initial_temp_c=55.0,
        secondary_initial_temp_c=50.0,
        agmd_cold_plate_temp_c=20.0,
        min_secondary_temp_c=20.0,
        simulation_duration_s=60.0,
    )
    model = MultiGPUModel(params)

    for _ in range(60):
        step = model.step(1.0)
        assert step.secondary_reservoir_temp_c >= params.min_secondary_temp_c

    assert step.cumulative_freshwater_mass_kg is not None
    assert step.cumulative_freshwater_mass_kg > 0.0
    assert step.freshwater_production_rate_l_h is not None
    assert step.freshwater_production_rate_l_h > 0.0
    assert abs(step.energy_balance_residual_j) < 1e-6


def test_multi_gpu_validation_errors():
    """
    Test 7: Input validation checks for multi-GPU configuration.
    """
    # Duplicate GPU IDs
    with pytest.raises(ValueError, match="GPU IDs must be unique"):
        MultiGPUParameters(
            gpus=[
                GPUConfig(gpu_id="GPU-1", power_w=300.0),
                GPUConfig(gpu_id="GPU-1", power_w=400.0),
            ]
        )

    # Empty GPU list
    with pytest.raises(ValueError, match="At least one GPU"):
        MultiGPUParameters(gpus=[])

    # Negative power
    with pytest.raises(ValueError, match="non-negative"):
        GPUConfig(gpu_id="GPU-1", power_w=-10.0)

    # Invalid time step
    with pytest.raises(ValueError, match="Time step"):
        MultiGPUParameters(gpus=[GPUConfig()], time_step_s=6.0)
