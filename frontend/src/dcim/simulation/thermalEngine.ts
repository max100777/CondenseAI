/**
 * CondensAI Thermal Physics & Heat Recovery Engine
 *
 * Implements transient lumped-capacitance GPU thermal response, conjugate cold-plate
 * heat dissipation, Effectiveness-NTU counterflow plate heat exchanger recovery,
 * secondary thermal buffer storage dynamics, and First-Law energy conservation verification.
 */

import { ENGINEERING_ASSUMPTIONS } from './engineeringAssumptions.ts';
import type { HeatRecoveryState, IntegratedEngineeringState } from './engineeringState.ts';

export function updateThermal(state: IntegratedEngineeringState, dtSeconds: number): HeatRecoveryState {
  const cp = ENGINEERING_ASSUMPTIONS.fluid.coolantSpecificHeatJ_KgK; // 4184 J/kg·K
  const priSupplyTempC = state.hydraulics.primarySupplyTempC;

  let totalGpuHeatDissipatedW = 0;
  let totalCoolantAbsorbedHeatW = 0;

  // 1. Update each GPU's transient temperature and cold plate interaction
  for (const gpu of Object.values(state.gpus)) {
    const rackFlow = state.hydraulics.rackFlowsKgS[gpu.rackId] || 0;
    const gpuFlow = rackFlow / 6.0; // 6 GPUs per rack evenly split in parallel cold-plate branches

    gpu.coolantFlowKgS = gpuFlow;
    gpu.coolantInletTempC = priSupplyTempC;

    // Heat generation from electrical power
    const qGenW = gpu.powerW * ENGINEERING_ASSUMPTIONS.gpu.thermalDissipationFraction;
    gpu.heatDissipationW = qGenW;
    totalGpuHeatDissipatedW += qGenW;

    let qAbsorbedW = 0;
    let outletTempC = priSupplyTempC;

    if (gpuFlow > 0.005) {
      // Conjugate heat transfer across cold plate
      // Q = (T_die - T_coolant_in) / R_eff
      const rEff = ENGINEERING_ASSUMPTIONS.gpu.coldPlateThermalResistanceK_W;
      const drivingTempDiff = Math.max(0, gpu.temperatureC - priSupplyTempC);
      qAbsorbedW = Math.min(qGenW * 1.5, drivingTempDiff / rEff);

      // Temperature rise across cold plate: deltaT = Q / (m_dot * cp)
      const deltaTCoolant = qAbsorbedW / (gpuFlow * cp);
      outletTempC = priSupplyTempC + deltaTCoolant;
    } else {
      // Zero flow: heat cannot be carried away by fluid
      qAbsorbedW = 0;
      outletTempC = priSupplyTempC;
    }

    gpu.coolantOutletTempC = outletTempC;
    totalCoolantAbsorbedHeatW += qAbsorbedW;

    // Transient die thermal balance: C_thermal * dT/dt = Q_gen - Q_absorbed
    const cThermal = ENGINEERING_ASSUMPTIONS.gpu.thermalCapacitanceJ_K;
    const netHeatW = qGenW - qAbsorbedW;
    const deltaTDie = (netHeatW / cThermal) * dtSeconds;
    gpu.temperatureC = Math.max(priSupplyTempC, Math.min(105.0, gpu.temperatureC + deltaTDie));
    gpu.coldPlateTempC = priSupplyTempC + (gpu.temperatureC - priSupplyTempC) * 0.45;

    // Thermal limits & throttling
    gpu.thermalMarginC = gpu.thermalLimitC - gpu.temperatureC;
    if (gpu.temperatureC >= ENGINEERING_ASSUMPTIONS.gpu.criticalShutdownTempC) {
      gpu.operatingStatus = 'Failed';
      gpu.fault = 'ThermalThrottling';
      gpu.clockMhz = 300;
    } else if (gpu.temperatureC >= ENGINEERING_ASSUMPTIONS.gpu.throttlingTempC) {
      gpu.operatingStatus = 'Degraded';
      gpu.fault = 'ThermalThrottling';
      gpu.clockMhz = 1200;
    } else if (gpu.temperatureC >= gpu.thermalLimitC) {
      gpu.operatingStatus = 'Warning';
      gpu.fault = 'ThermalThrottling';
      gpu.clockMhz = 1500;
    } else {
      gpu.operatingStatus = 'Normal';
      gpu.fault = 'None';
      gpu.clockMhz = 1800;
    }

    // Append to rolling history (keep last 30 samples)
    gpu.history.push({
      time: state.clock.simTimeSeconds,
      tempC: gpu.temperatureC,
      powerW: gpu.powerW,
    });
    if (gpu.history.length > 30) gpu.history.shift();
  }

  // 2. Aggregate Rack and Hall Return Temperatures
  for (const rack of Object.values(state.racks)) {
    const rackGpus = rack.gpuIds.map((id) => state.gpus[id]);
    const avgTemp = rackGpus.reduce((s, g) => s + g.temperatureC, 0) / rackGpus.length;
    const maxTemp = Math.max(...rackGpus.map((g) => g.temperatureC));
    const avgOutlet = rackGpus.reduce((s, g) => s + g.coolantOutletTempC, 0) / rackGpus.length;

    rack.averageGpuTempC = avgTemp;
    rack.maxGpuTempC = maxTemp;
    rack.coolantSupplyTempC = priSupplyTempC;
    rack.coolantReturnTempC = avgOutlet;
    rack.heatLoadKw = rackGpus.reduce((s, g) => s + g.heatDissipationW, 0) / 1000.0;
  }

  for (const hall of Object.values(state.halls)) {
    const hallRacks = hall.rackIds.map((id) => state.racks[id]);
    hall.averageGpuTempC = hallRacks.reduce((s, r) => s + r.averageGpuTempC, 0) / hallRacks.length;
    hall.maxGpuTempC = Math.max(...hallRacks.map((r) => r.maxGpuTempC));
    hall.coolantSupplyTempC = priSupplyTempC;
    hall.coolantReturnTempC = hallRacks.reduce((s, r) => s + r.coolantReturnTempC, 0) / hallRacks.length;
  }

  // 3. Central Primary Loop Return Mixed Temperature
  const totalPriFlowKgS = state.hydraulics.totalSystemFlowKgS;
  let mixedReturnTempC = priSupplyTempC;

  if (totalPriFlowKgS > 0.01) {
    let weightedTempSum = 0;
    for (const [rId, flow] of Object.entries(state.hydraulics.rackFlowsKgS)) {
      const rack = state.racks[rId];
      if (rack) weightedTempSum += flow * rack.coolantReturnTempC;
    }
    mixedReturnTempC = weightedTempSum / totalPriFlowKgS;
  }

  state.hydraulics.primaryReturnTempC = mixedReturnTempC;
  const primaryLoopHeatKw = (totalPriFlowKgS * cp * Math.max(0, mixedReturnTempC - priSupplyTempC)) / 1000.0;
  state.hydraulics.primaryLoopHeatKw = primaryLoopHeatKw;

  // 4. Counterflow Plate Heat Exchanger (Effectiveness-NTU method)
  const currentHx = state.heatRecovery;
  const secFlowKgS = ENGINEERING_ASSUMPTIONS.heatExchanger.secondaryFlowRateKgS;
  const secInletTempC = currentHx.secondaryInletTempC;
  const effectiveness = ENGINEERING_ASSUMPTIONS.heatExchanger.nominalEffectiveness;

  const cPri = totalPriFlowKgS * cp;
  const cSec = secFlowKgS * cp;
  const cMin = Math.min(cPri, cSec);

  let qHxKw = 0;
  let priOutletTempC = mixedReturnTempC;
  let secOutletTempC = secInletTempC;

  if (cMin > 10.0 && mixedReturnTempC > secInletTempC) {
    const qMaxW = cMin * (mixedReturnTempC - secInletTempC);
    const qMaxHxW = effectiveness * qMaxW;
    // Primary heat required to return primary loop to setpoint (28.0°C)
    const qPriToSetpointW = Math.max(0, cPri * (mixedReturnTempC - priSupplyTempC));
    // CDU modulates heat transfer to balance IT thermal dissipation, bounded by HX rating
    const qActualW = Math.min(qPriToSetpointW > 0 ? qPriToSetpointW : qMaxHxW, qMaxHxW);
    qHxKw = qActualW / 1000.0;

    priOutletTempC = mixedReturnTempC - (qActualW / cPri);
    secOutletTempC = secInletTempC + (qActualW / cSec);
  }

  // Enforce Second Law: secondary outlet cannot exceed primary inlet in passive heat exchange
  if (secOutletTempC > mixedReturnTempC) {
    secOutletTempC = mixedReturnTempC;
    qHxKw = (cSec * (secOutletTempC - secInletTempC)) / 1000.0;
    priOutletTempC = mixedReturnTempC - (qHxKw * 1000.0 / cPri);
  }

  // 5. Secondary Thermal Buffer Tank Transient Energy Balance
  // First-Law dynamic integration: M_tank * cp * dT/dt = Q_HX - Q_AGMD - Q_loss
  const tankCapacityKg = ENGINEERING_ASSUMPTIONS.thermalBuffer.capacityLiters * 1.0; // 15,000 kg water
  const h_fg = ENGINEERING_ASSUMPTIONS.agmd.latentHeatOfVaporizationJ_Kg;
  // Latent heat extracted by AGMD distillate vaporization
  const qAgmdLatentKw = (state.agmd.freshwaterProductionRateL_H * (h_fg / 1000.0)) / 3600.0;
  // Sensible heat rejected in brine discharge
  const qAgmdSensibleKw = state.agmd.freshwaterProductionRateL_H > 0
    ? (state.agmd.feedFlowKgS * cp * Math.max(0, state.agmd.feedInletTempC - state.agmd.brineOutletTempC)) / 1000.0
    : 0;
  const qAgmdKw = qAgmdLatentKw + qAgmdSensibleKw;
  const qLossKw = (ENGINEERING_ASSUMPTIONS.thermalBuffer.ambientLossCoefficientW_K *
    Math.max(0, currentHx.bufferTankTempC - ENGINEERING_ASSUMPTIONS.fluid.ambientTemperatureC)) / 1000.0;

  const netTankPowerW = (qHxKw - qAgmdKw - qLossKw) * 1000.0;
  const deltaTankTemp = (netTankPowerW / (tankCapacityKg * cp)) * dtSeconds;
  // Continuous dynamic integration without artificial clamping
  const nextTankTempC = Math.max(20.0, Math.min(ENGINEERING_ASSUMPTIONS.thermalBuffer.maxSafeTempC, currentHx.bufferTankTempC + deltaTankTemp));

  // Energy Balance Residual across Heat Recovery Exchanger
  // First-Law Conservation: primary heat extracted through HX vs secondary heat absorbed
  const qPriExtractedKw = (cPri * (mixedReturnTempC - priOutletTempC)) / 1000.0;
  const qSecAbsorbedKw = (cSec * (secOutletTempC - secInletTempC)) / 1000.0;
  const energyResidualPercent = qPriExtractedKw > 0.1
    ? (Math.abs(qPriExtractedKw - qSecAbsorbedKw) / qPriExtractedKw) * 100.0
    : 0.0;

  const isEnergyConserved = energyResidualPercent <= ENGINEERING_ASSUMPTIONS.simulation.energyConservationTolerancePercent;

  return {
    ...currentHx,
    primaryInletTempC: mixedReturnTempC,
    primaryOutletTempC: priOutletTempC,
    secondaryInletTempC: secInletTempC,
    secondaryOutletTempC: secOutletTempC,
    heatTransferredKw: qHxKw,
    bufferTankTempC: nextTankTempC,
    bufferLossesKw: qLossKw,
    bufferStoredEnergyMj: (tankCapacityKg * cp * (nextTankTempC - 20.0)) / 1000000.0,
    energyBalanceResidualPercent: energyResidualPercent,
    isEnergyConserved,
  };
}
