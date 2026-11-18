/**
 * CondensAI Air-Gap Membrane Distillation (AGMD) Subsystem Engine
 *
 * Models Knudsen and molecular diffusion through hydrophobic porous PTFE membranes,
 * temperature polarization across stagnant air gaps, Antoine vapor pressure depression with salinity,
 * freshwater permeate production rate, and brine concentration balance.
 */

import { ENGINEERING_ASSUMPTIONS } from './engineeringAssumptions.ts';
import type { AgmdState, IntegratedEngineeringState } from './engineeringState.ts';

/**
 * Calculates water vapor saturation pressure via modified Antoine relation (Pa)
 */
function vaporPressurePa(tempC: number, salinityG_Kg: number): number {
  const T_kelvin = tempC + 273.15;
  // Pure water saturation vapor pressure in Pa
  const pPurePa = Math.exp(23.1964 - (3816.44 / (T_kelvin - 46.13)));
  // Salinity depression factor via Raoult's law (approx 0.0537% depression per g/kg TDS)
  const salinityFactor = 1.0 - 0.000537 * salinityG_Kg;
  return pPurePa * Math.max(0.7, salinityFactor);
}

export function updateAGMD(state: IntegratedEngineeringState, dtSeconds: number): AgmdState {
  const current = state.agmd;
  const bufferTankTempC = state.heatRecovery.bufferTankTempC;
  const condenserTempC = ENGINEERING_ASSUMPTIONS.agmd.coolantCondenserTempC;

  // The AGMD feed loop draws thermal energy from the secondary buffer tank
  // Feed temperature entering hot membrane channel:
  const feedInletTempC = current.feedPumpActive ? Math.min(bufferTankTempC, 68.0) : 22.0;

  // Temperature gating: requires positive thermal driving force across membrane (T_feed > T_condenser + 2°C)
  if (!current.feedPumpActive || feedInletTempC <= condenserTempC + 2.0) {
    return {
      ...current,
      systemStatus: current.feedPumpActive ? 'Warning' : 'Offline',
      feedInletTempC,
      membraneHotSideTempC: feedInletTempC,
      membraneColdSideTempC: condenserTempC,
      vaporPressureDifferentialKPa: 0,
      distillateFluxKgM2H: 0,
      freshwaterProductionRateL_H: 0,
      brineOutletTempC: feedInletTempC,
      brineSalinityG_Kg: current.feedSalinityG_Kg,
    };
  }

  // Thermal polarization across boundary layers:
  // T_hot_membrane is ~1.2°C lower than bulk feed due to boundary layer thermal resistance
  const membraneHotC = feedInletTempC - 1.2;
  const membraneColdC = condenserTempC + 1.0;

  // Vapor pressure driving force (Pa -> kPa)
  const pHotPa = vaporPressurePa(membraneHotC, current.feedSalinityG_Kg);
  const pColdPa = vaporPressurePa(membraneColdC, 0); // Pure distillate side has 0 salinity
  const deltaPPa = Math.max(0, pHotPa - pColdPa);
  const deltaPKPa = deltaPPa / 1000.0;

  // Combined membrane mass transfer coefficient B_m (kg / m²·h·kPa)
  // Knudsen diffusion + molecular diffusion across stagnant air gap
  const bM = 1.15; // kg/(m²·h·kPa)
  const distillateFluxKgM2H = bM * deltaPKPa;

  // Unconstrained mass-transfer production across 24 m² membrane
  const membraneAreaM2 = ENGINEERING_ASSUMPTIONS.agmd.membraneAreaM2;
  const unconstrainedKgH = distillateFluxKgM2H * membraneAreaM2;

  // First-Law Thermal Energy Boundary:
  // Evaporation cannot consume more thermal power than supplied by heat recovery
  const h_fg = ENGINEERING_ASSUMPTIONS.agmd.latentHeatOfVaporizationJ_Kg;
  const qAvailableKw = Math.max(0, state.heatRecovery.heatTransferredKw);
  const maxThermalKgH = (qAvailableKw * 1000.0 / h_fg) * 3600.0; // max kg/h allowed by 100% latent conversion
  const productionRateKgH = Math.min(unconstrainedKgH, maxThermalKgH);
  const productionRateL_H = productionRateKgH / 0.997; // clean water density ~ 0.997 kg/L

  // Cumulative freshwater volume integration
  const deltaFreshwaterL = (productionRateL_H / 3600.0) * dtSeconds;
  const nextCumulativeL = current.cumulativeFreshwaterL + deltaFreshwaterL;

  // Exact Mass Conservation & Salt Balance:
  // m_feed = m_distillate + m_brine
  // m_feed * X_feed = m_brine * X_brine  (assuming X_distillate = 0)
  const feedFlowKgH = current.feedFlowKgS * 3600.0;
  const brineFlowKgH = Math.max(0.001, feedFlowKgH - productionRateKgH);
  const brineSalinityG_Kg = current.feedSalinityG_Kg * (feedFlowKgH / brineFlowKgH);

  // Sensible cooling of brine from latent heat extraction:
  // Q_evap = m_dot_feed * cp * deltaT_feed
  const cp = ENGINEERING_ASSUMPTIONS.fluid.coolantSpecificHeatJ_KgK;
  const qLatentW = (productionRateKgH / 3600.0) * h_fg;
  const deltaTFeed = current.feedFlowKgS > 0 ? qLatentW / (current.feedFlowKgS * cp) : 0;
  const brineOutletTempC = Math.max(condenserTempC, feedInletTempC - deltaTFeed);

  // Specific Thermal Energy Consumption (STEC in kWh/m³)
  const stecKwhM3 = productionRateKgH > 0
    ? (qLatentW / 1000.0) / (productionRateKgH / 1000.0)
    : 0;

  return {
    ...current,
    systemStatus: 'Normal',
    feedInletTempC,
    membraneHotSideTempC: membraneHotC,
    membraneColdSideTempC: membraneColdC,
    vaporPressureDifferentialKPa: deltaPKPa,
    distillateFluxKgM2H: productionRateKgH / membraneAreaM2,
    freshwaterProductionRateL_H: productionRateL_H,
    cumulativeFreshwaterL: nextCumulativeL,
    brineOutletTempC,
    brineSalinityG_Kg,
    specificThermalEnergyConsumptionKwh_M3: Math.round(stecKwhM3),
  };
}
