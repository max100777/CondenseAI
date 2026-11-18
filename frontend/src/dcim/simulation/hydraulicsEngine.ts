/**
 * CondensAI Primary Coolant Hydraulics & Distribution Engine
 *
 * Models conservation of mass across piping networks, pump affinity curves,
 * branch hydraulic resistance, valve throttling, and pressure drops.
 */

import { ENGINEERING_ASSUMPTIONS } from './engineeringAssumptions.ts';
import type { HydraulicState, IntegratedEngineeringState } from './engineeringState.ts';

export function updateHydraulics(state: IntegratedEngineeringState): HydraulicState {
  const current = state.hydraulics;
  const pumpSpeedFraction = current.pumpSpeedFraction;
  const isPumpOperational = current.pumpStatus === 'Normal' || current.pumpStatus === 'Warning';

  if (!isPumpOperational || pumpSpeedFraction <= 0.05) {
    // Zero-flow condition when pump is tripped or stopped
    const zeroRackFlows: Record<string, number> = {};
    for (const rId of Object.keys(state.racks)) {
      zeroRackFlows[rId] = 0;
    }
    return {
      ...current,
      pumpStatus: current.pumpStatus === 'Normal' ? 'Offline' : current.pumpStatus,
      pumpSpeedRpm: 0,
      totalSystemFlowKgS: 0,
      pumpHeadPressureBar: 0,
      hallFlowsKgS: { 'HALL-A': 0, 'HALL-B': 0, 'HALL-C': 0, 'HALL-D': 0 },
      rackFlowsKgS: zeroRackFlows,
    };
  }

  // Calculate actual pump head pressure via pump affinity law
  // Head ~ (N / N_rated)^2
  const ratedHeadBar = (ENGINEERING_ASSUMPTIONS.hydraulics.pumpRatedHeadM * 9.81 * 997.0) / 100000.0; // ~3.42 bar
  const pumpHeadPressureBar = ratedHeadBar * Math.pow(pumpSpeedFraction, 2);

  // Sum active rack conductance based on valve positions
  const rackConductances: Record<string, number> = {};
  let totalFacilityConductance = 0;

  for (const rId of Object.keys(state.racks)) {
    const valveState = current.valves[rId] || 'Open';
    let valveFactor = 1.0;
    if (valveState === 'Throttled') valveFactor = 0.4;
    else if (valveState === 'Closed') valveFactor = 0.0;

    // Base conductance per rack
    const baseConductance = 1.0; // Normalized
    const effConductance = baseConductance * valveFactor;
    rackConductances[rId] = effConductance;
    totalFacilityConductance += effConductance;
  }

  // Base nominal total system flow proportional to pump speed and circuit conductance
  const nominalTotalFlow = ENGINEERING_ASSUMPTIONS.hydraulics.pumpRatedFlowKgS * pumpSpeedFraction;
  const conductanceRatio = totalFacilityConductance / 24.0; // 24 racks nominal
  const totalSystemFlowKgS = nominalTotalFlow * Math.sqrt(conductanceRatio);

  // Distribute mass flow across racks with strict mass conservation: sum(m_rack) = m_total
  const rackFlowsKgS: Record<string, number> = {};
  const hallFlowsKgS: Record<string, number> = {
    'HALL-A': 0,
    'HALL-B': 0,
    'HALL-C': 0,
    'HALL-D': 0,
  };

  for (const [rId, rack] of Object.entries(state.racks)) {
    const rackFlow = totalFacilityConductance > 0
      ? (rackConductances[rId] / totalFacilityConductance) * totalSystemFlowKgS
      : 0;

    rackFlowsKgS[rId] = rackFlow;
    hallFlowsKgS[rack.hallId] = (hallFlowsKgS[rack.hallId] || 0) + rackFlow;
  }

  return {
    ...current,
    pumpSpeedRpm: ENGINEERING_ASSUMPTIONS.hydraulics.nominalPumpSpeedRpm * pumpSpeedFraction,
    totalSystemFlowKgS,
    pumpHeadPressureBar,
    hallFlowsKgS,
    rackFlowsKgS,
  };
}
