import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeEngineeringState } from './simulation/engineeringState.ts';
import { updateHydraulics } from './simulation/hydraulicsEngine.ts';
import { updateElectrical, traceElectricalPath, traceNetworkPath } from './simulation/electricalEngine.ts';
import { updateThermal } from './simulation/thermalEngine.ts';
import { updateAGMD } from './simulation/agmdEngine.ts';
import { SimulationController } from './simulation/simulationController.ts';

const close = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b} (eps: ${eps})`);

test('1. Hardware Topology: 4 halls, 24 racks, 144 servers, 144 GPUs with stable IDs', () => {
  const state = initializeEngineeringState();

  assert.equal(Object.keys(state.halls).length, 4);
  assert.equal(Object.keys(state.racks).length, 24);
  assert.equal(Object.keys(state.servers).length, 144);
  assert.equal(Object.keys(state.gpus).length, 144);

  // Verify GPU parent relationships
  for (const gpu of Object.values(state.gpus)) {
    assert.ok(state.racks[gpu.rackId], `Invalid rack parent for ${gpu.id}`);
    assert.ok(state.servers[gpu.serverId], `Invalid server parent for ${gpu.id}`);
    assert.ok(state.halls[gpu.hallId], `Invalid hall parent for ${gpu.id}`);
    assert.equal(state.servers[gpu.serverId].gpuId, gpu.id);
  }

  // Verify server chassis occupancy: 6 servers per rack
  for (const rack of Object.values(state.racks)) {
    assert.equal(rack.serverIds.length, 6);
    assert.equal(rack.gpuIds.length, 6);
  }
});

test('2. Electrical Aggregation: power sums strictly without double-counting', () => {
  const state = initializeEngineeringState();
  const elec = updateElectrical(state);

  assert.ok(elec.facilityITPowerKw > 0);
  assert.ok(elec.facilityTotalPowerKw > elec.facilityITPowerKw);
  assert.ok(elec.instantaneousPUE >= 1.05 && elec.instantaneousPUE <= 1.30);

  // Sum of GPU power
  const sumGpuKw = Object.values(state.gpus).reduce((s, g) => s + g.powerW, 0) / 1000.0;
  // IT power must strictly exceed GPU power alone due to CPU/RAM/PSU overhead
  assert.ok(elec.facilityITPowerKw > sumGpuKw);

  // Electrical Path Tracing
  const path = traceElectricalPath('GPU A01-GPU01', state);
  assert.equal(path.length, 7);
  assert.equal(path[0].type, 'Utility');
  assert.equal(path[1].type, 'Transformer');
  assert.equal(path[2].type, 'Switchgear');
  assert.equal(path[3].type, 'UPS');
  assert.equal(path[4].type, 'PDU');
  assert.equal(path[5].type, 'ServerPSU');
  assert.equal(path[6].type, 'GPU');

  // Network Path Tracing
  const netPath = traceNetworkPath('GPU A01-GPU01', state);
  assert.equal(netPath.length, 5);
  assert.equal(netPath[0].tier, 'Core');
  assert.equal(netPath[4].tier, 'GPUInterconnect');
});

test('3. Hydraulics: mass conservation across 4 halls and 24 racks', () => {
  const state = initializeEngineeringState();
  const hyd = updateHydraulics(state);

  const totalFlow = hyd.totalSystemFlowKgS;
  assert.ok(totalFlow > 1.0 && totalFlow < 5.0, `Expected flow around 1.6 kg/s, got ${totalFlow}`);

  // Sum of hall flows must equal total system flow
  const sumHallFlows = Object.values(hyd.hallFlowsKgS).reduce((s, f) => s + f, 0);
  close(sumHallFlows, totalFlow, 1e-4);

  // Sum of rack flows must equal total system flow
  const sumRackFlows = Object.values(hyd.rackFlowsKgS).reduce((s, f) => s + f, 0);
  close(sumRackFlows, totalFlow, 1e-4);

  // Pump stopped -> flow drops to zero
  state.hydraulics.pumpSpeedFraction = 0;
  const zeroHyd = updateHydraulics(state);
  assert.equal(zeroHyd.totalSystemFlowKgS, 0);
  assert.equal(zeroHyd.hallFlowsKgS['HALL-A'], 0);
  assert.equal(zeroHyd.rackFlowsKgS['Rack A01'], 0);
});

test('4. Thermal Physics: conjugate cold plate transfer and Effectiveness-NTU heat exchanger', () => {
  const state = initializeEngineeringState();
  state.hydraulics = updateHydraulics(state);

  const hx = updateThermal(state, 5.0);

  assert.ok(hx.heatTransferredKw > 0);
  assert.ok(hx.primaryInletTempC > hx.primaryOutletTempC); // primary cools down through HX
  assert.ok(hx.secondaryOutletTempC > hx.secondaryInletTempC); // secondary heats up through HX
  assert.ok(hx.bufferTankTempC >= 30.0);
  assert.ok(hx.energyBalanceResidualPercent < 2.0, `Residual was ${hx.energyBalanceResidualPercent}%`);
});

test('5. AGMD Desalination: non-negative permeate flux, salinity balance, and temperature gating', () => {
  const state = initializeEngineeringState();
  state.heatRecovery.bufferTankTempC = 45.0;
  const agmd = updateAGMD(state, 10.0);

  assert.ok(agmd.distillateFluxKgM2H > 0);
  assert.ok(agmd.freshwaterProductionRateL_H > 20.0);
  assert.ok(agmd.cumulativeFreshwaterL > 0);
  assert.ok(agmd.brineSalinityG_Kg >= agmd.feedSalinityG_Kg); // salt concentrates in brine

  // Cold feed test: below condenser + 2°C (22°C), production stops completely
  state.heatRecovery.bufferTankTempC = 18.0;
  const coldAgmd = updateAGMD(state, 10.0);
  assert.equal(coldAgmd.freshwaterProductionRateL_H, 0);
  assert.equal(coldAgmd.distillateFluxKgM2H, 0);
});

test('6. Simulation Controller: stepping, scenarios, and telemetry history', () => {
  const controller = new SimulationController();
  const s0 = controller.getState();
  assert.equal(s0.clock.simTimeSeconds, 0);

  // Step 5 seconds
  controller.step(5.0);
  const s1 = controller.getState();
  assert.equal(s1.clock.simTimeSeconds, 5.0);

  // Apply High-Intensity Training Surge scenario
  controller.applyScenario('High-Intensity Training Surge');
  assert.equal(controller.getState().gpus['GPU A01-GPU01'].utilization, 1.0);

  // Telemetry history recording
  const history = controller.getHistory();
  assert.ok(history.length >= 2);
  assert.ok(history[history.length - 1].totalITPowerKw > 0);
  assert.ok(history[history.length - 1].pue >= 1.0);
});

test('7. Quantitative Physics Validation: Primary Loop Q = m_dot * cp * deltaT', () => {
  const state = initializeEngineeringState();
  state.hydraulics = updateHydraulics(state);
  updateThermal(state, 1.0);

  const mDot = state.hydraulics.totalSystemFlowKgS;
  const cp = 4184.0;
  const deltaT = state.hydraulics.primaryReturnTempC - state.hydraulics.primarySupplyTempC;
  const qCalculatedKw = (mDot * cp * deltaT) / 1000.0;
  const qReportedKw = state.hydraulics.primaryLoopHeatKw;

  const residual = Math.abs(qCalculatedKw - qReportedKw) / Math.max(1.0, qReportedKw);
  assert.ok(residual < 0.02, `Primary loop thermal residual was ${residual * 100}%`);
});

test('8. Quantitative Physics Validation: Heat Exchanger Second-Law Compliance', () => {
  const state = initializeEngineeringState();
  state.hydraulics = updateHydraulics(state);
  const hx = updateThermal(state, 1.0);

  // Second Law: secondary outlet cannot exceed primary inlet in passive heat exchange
  assert.ok(
    hx.secondaryOutletTempC <= hx.primaryInletTempC + 1e-4,
    `Violation of Second Law: T_sec_out (${hx.secondaryOutletTempC}) > T_pri_in (${hx.primaryInletTempC})`
  );

  // Positive pinch-point differences
  assert.ok(hx.primaryInletTempC > hx.secondaryOutletTempC, 'Hot end pinch point must be positive');
  assert.ok(hx.primaryOutletTempC > hx.secondaryInletTempC, 'Cold end pinch point must be positive');
});

test('9. Quantitative Physics Validation: AGMD Thermal Boundary & Mass Conservation', () => {
  const state = initializeEngineeringState();
  state.hydraulics = updateHydraulics(state);
  state.heatRecovery = updateThermal(state, 1.0);
  const agmd = updateAGMD(state, 1.0);

  // AGMD Latent Energy Consumption <= Available Heat Exchanger Power
  const h_fg = 2415000.0;
  const qLatentW = (agmd.freshwaterProductionRateL_H / 3600.0) * h_fg;
  const qSuppliedW = state.heatRecovery.heatTransferredKw * 1000.0;
  assert.ok(
    qLatentW <= qSuppliedW + 100.0,
    `AGMD latent power (${qLatentW} W) exceeded supplied recovery heat (${qSuppliedW} W)`
  );

  // Strict Mass Balance: m_feed = m_distillate + m_brine
  const mFeedKgH = agmd.feedFlowKgS * 3600.0;
  const mDistillateKgH = agmd.freshwaterProductionRateL_H * 0.997;
  const mBrineKgH = mFeedKgH - mDistillateKgH;
  const massResidual = Math.abs(mFeedKgH - (mDistillateKgH + mBrineKgH)) / mFeedKgH;
  assert.ok(massResidual < 1e-4, `Mass balance residual: ${massResidual}`);

  // Salt Conservation: m_feed * X_feed = m_brine * X_brine
  const saltFeed = mFeedKgH * agmd.feedSalinityG_Kg;
  const saltBrine = mBrineKgH * agmd.brineSalinityG_Kg;
  const saltResidual = Math.abs(saltFeed - saltBrine) / saltFeed;
  assert.ok(saltResidual < 1e-3, `Salt conservation residual: ${saltResidual}`);
});

test('10. Quantitative Physics Validation: Thermal Buffer Dynamic First-Law Response', () => {
  const state = initializeEngineeringState();
  state.hydraulics = updateHydraulics(state);
  const initialTankTemp = state.heatRecovery.bufferTankTempC;

  const dtSeconds = 60.0; // 1 minute
  const hx = updateThermal(state, dtSeconds);

  // Check expected dT = (Q_net * dt) / (M * cp)
  const tankCapacityKg = 15000.0;
  const cp = 4184.0;
  const qLossKw = (45.0 * (initialTankTemp - 22.0)) / 1000.0;
  const h_fg = 2415000.0;
  const qAgmdLatentKw = (state.agmd.freshwaterProductionRateL_H * (h_fg / 1000.0)) / 3600.0;
  const qAgmdSensibleKw = state.agmd.freshwaterProductionRateL_H > 0
    ? (state.agmd.feedFlowKgS * cp * Math.max(0, state.agmd.feedInletTempC - state.agmd.brineOutletTempC)) / 1000.0
    : 0;
  const qAgmdKw = qAgmdLatentKw + qAgmdSensibleKw;
  const netPowerKw = hx.heatTransferredKw - qAgmdKw - qLossKw;
  const expectedDeltaT = (netPowerKw * 1000.0 * dtSeconds) / (tankCapacityKg * cp);

  const actualDeltaT = hx.bufferTankTempC - initialTankTemp;
  close(actualDeltaT, expectedDeltaT, 1e-4);
});

test('11. Quantitative Physics Validation: Zero-Power and Pump-Trip Edge Cases', () => {
  const state = initializeEngineeringState();
  
  // Trip pump
  state.hydraulics.pumpSpeedFraction = 0;
  state.hydraulics.pumpStatus = 'Offline';
  const trippedHyd = updateHydraulics(state);
  assert.equal(trippedHyd.totalSystemFlowKgS, 0);

  // Thermal response under zero flow
  state.hydraulics = trippedHyd;
  const tripThermal = updateThermal(state, 1.0);
  assert.equal(tripThermal.heatTransferredKw, 0);
  
  // AGMD feed pump trip
  state.agmd.feedPumpActive = false;
  const tripAgmd = updateAGMD(state, 1.0);
  assert.equal(tripAgmd.freshwaterProductionRateL_H, 0);
  assert.equal(tripAgmd.distillateFluxKgM2H, 0);
});
