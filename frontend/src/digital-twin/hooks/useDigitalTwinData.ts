import { useMemo } from 'react';
import { MultiGPUSimulationResponse, MultiGPUStep } from '../../types';
import {
  ComponentType,
  DigitalTwinTelemetryState,
  TelemetryState,
  SelectedComponentInfo,
} from '../types';

/**
 * Formats a freshwater volume in litres into a human-readable string with sensible unit scaling:
 * - < 0.001 L (< 1 mL): displayed in µL (e.g. 35.1 µL)
 * - 0.001 L to < 1.0 L (1 mL to < 1000 mL): displayed in mL (e.g. 2.50 mL)
 * - >= 1.0 L: displayed in L (e.g. 1.500 L)
 */
export function formatFreshwaterVolume(litres: number): { text: string; value: number; unit: string } {
  const safeL = Math.max(0, isNaN(litres) ? 0 : litres);
  if (safeL < 0.001) {
    const uL = safeL * 1e6;
    const formatted = uL < 10 ? (Math.round(uL * 100) / 100).toFixed(2) : (Math.round(uL * 10) / 10).toFixed(1);
    return {
      text: `${formatted} µL`,
      value: uL,
      unit: 'µL',
    };
  } else if (safeL < 1.0) {
    const mL = safeL * 1e3;
    const formatted = (Math.round(mL * 100) / 100).toFixed(2);
    return {
      text: `${formatted} mL`,
      value: mL,
      unit: 'mL',
    };
  } else {
    return {
      text: `${safeL.toFixed(3)} L`,
      value: safeL,
      unit: 'L',
    };
  }
}

export function useDigitalTwinData(
  simulationResult: MultiGPUSimulationResponse | null,
  activeStepIndex: number
) {
  const activeStep: MultiGPUStep | null = useMemo(() => {
    if (!simulationResult || !simulationResult.time_series || simulationResult.time_series.length === 0) {
      return null;
    }
    // Floor to guarantee integer indexing and clamp strictly within bounds
    const rawIdx = isNaN(activeStepIndex) ? 0 : Math.floor(activeStepIndex);
    const idx = Math.max(0, Math.min(rawIdx, simulationResult.time_series.length - 1));
    return simulationResult.time_series[idx] || null;
  }, [simulationResult, activeStepIndex]);

  const telemetry: DigitalTwinTelemetryState = useMemo(() => {
    if (!simulationResult || !activeStep) {
      // Nominal un-simulated initial state
      return {
        time_s: 0.0,
        gpu_states: [],
        aggregate_power_w: 0.0,
        aggregate_heat_generated_w: 0.0,
        aggregate_heat_to_coolant_w: 0.0,
        primary_coolant_temp_c: 30.0,
        primary_mass_flow_kg_s: 0.05,
        hx_heat_transfer_w: 0.0,
        hx_primary_outlet_temp_c: 30.0,
        hx_secondary_outlet_temp_c: 25.0,
        hx_effectiveness: 0.763,
        secondary_reservoir_temp_c: 25.0,
        secondary_mass_flow_kg_s: 0.02,
        secondary_stored_energy_j: 20.0 * 4184.0 * 25.0,
        min_secondary_temp_c: 20.0,
        heat_to_agmd_w: 0.0,
        freshwater_production_rate_l_h: 0.0,
        cumulative_freshwater_volume_l: 0.0,
        cumulative_freshwater_volume_ml: 0.0,
        feed_salinity_g_l: 35.0,
        agmd_hot_membrane_temp_c: null,
        agmd_cold_condensing_temp_c: null,
        agmd_cold_plate_temp_c: 20.0,
        agmd_vapor_flux_lmh: 0.0,
        energy_balance_residual_j: 0.0,
      };
    }

    const fwVolL = activeStep.cumulative_freshwater_volume_l ?? 0.0;
    const fwRateLh = activeStep.freshwater_production_rate_l_h ?? 0.0;
    const fluxLmh = (activeStep.agmd_vapor_flux_kg_m2_s ?? 0.0) * 3600.0;

    return {
      time_s: activeStep.time_s,
      gpu_states: activeStep.gpu_states,
      aggregate_power_w: simulationResult.aggregate_power_w,
      aggregate_heat_generated_w: activeStep.aggregate_heat_generated_w,
      aggregate_heat_to_coolant_w: activeStep.aggregate_heat_to_coolant_w,
      primary_coolant_temp_c: activeStep.primary_coolant_temp_c,
      primary_mass_flow_kg_s: simulationResult.parameters?.primary_mass_flow_kg_s ?? 0.05,
      hx_heat_transfer_w: activeStep.hx_heat_transfer_w,
      hx_primary_outlet_temp_c: activeStep.hx_primary_outlet_temp_c,
      hx_secondary_outlet_temp_c: activeStep.hx_secondary_outlet_temp_c,
      hx_effectiveness: activeStep.hx_effectiveness,
      secondary_reservoir_temp_c: activeStep.secondary_reservoir_temp_c,
      secondary_mass_flow_kg_s: simulationResult.parameters?.secondary_mass_flow_kg_s ?? 0.02,
      secondary_stored_energy_j: activeStep.secondary_stored_energy_j,
      min_secondary_temp_c: simulationResult.parameters?.min_secondary_temp_c ?? 20.0,
      heat_to_agmd_w: activeStep.heat_to_agmd_w,
      freshwater_production_rate_l_h: fwRateLh,
      cumulative_freshwater_volume_l: fwVolL,
      cumulative_freshwater_volume_ml: fwVolL * 1000.0,
      feed_salinity_g_l: activeStep.feed_salinity_g_l ?? simulationResult.parameters?.agmd_initial_salinity_g_l ?? 35.0,
      agmd_hot_membrane_temp_c: activeStep.agmd_hot_membrane_temp_c ?? null,
      agmd_cold_condensing_temp_c: activeStep.agmd_cold_condensing_temp_c ?? null,
      agmd_cold_plate_temp_c: simulationResult.parameters?.agmd_cold_plate_temp_c ?? 20.0,
      agmd_vapor_flux_lmh: fluxLmh,
      energy_balance_residual_j: activeStep.energy_balance_residual_j,
    };
  }, [simulationResult, activeStep]);

  // Formatted state for 3D components & info inspector
  const telemetryState: TelemetryState = useMemo(() => {
    if (!simulationResult || !activeStep) {
      return {
        timeS: 0,
        gpuTotalPowerW: 0,
        gpuHeatToCoolantW: 0,
        gpuTemperatures: [30, 30, 30, 30],
        primaryInletTempC: 30,
        primaryOutletTempC: 30,
        hxHeatTransferredW: 0,
        hxEffectiveness: 0.763,
        secondaryOutletTempC: 25,
        reservoirTempC: 25,
        reservoirEnergyJ: 20 * 4184 * 25,
        agmdHeatExtractedW: 0,
        ambientLossW: 0,
        agmdFeedTempC: 25,
        agmdColdPlateTempC: 20,
        agmdMembraneHotTempC: 25,
        agmdMembraneColdTempC: 20,
        agmdVaporFluxLMH: 0,
        agmdSalinityGKg: 35,
        agmdThrottled: false,
        freshwaterVolumeL: 0,
        freshwaterRateLh: 0,
        energyResidualJ: 0,
      };
    }

    const gpuTemps = activeStep.gpu_states && activeStep.gpu_states.length > 0
      ? activeStep.gpu_states.map((g) => g.current_temp_c)
      : [activeStep.primary_coolant_temp_c];

    const fwVolL = activeStep.cumulative_freshwater_volume_l ?? 0;
    const fwRateLh = activeStep.freshwater_production_rate_l_h ?? 0;
    const fluxLmh = (activeStep.agmd_vapor_flux_kg_m2_s ?? 0) * 3600;

    return {
      timeS: activeStep.time_s,
      gpuTotalPowerW: simulationResult.aggregate_power_w,
      gpuHeatToCoolantW: activeStep.aggregate_heat_to_coolant_w,
      gpuTemperatures: gpuTemps,
      primaryInletTempC: activeStep.hx_primary_outlet_temp_c,
      primaryOutletTempC: activeStep.primary_coolant_temp_c,
      hxHeatTransferredW: activeStep.hx_heat_transfer_w,
      hxEffectiveness: activeStep.hx_effectiveness,
      secondaryOutletTempC: activeStep.hx_secondary_outlet_temp_c,
      reservoirTempC: activeStep.secondary_reservoir_temp_c,
      reservoirEnergyJ: activeStep.secondary_stored_energy_j,
      agmdHeatExtractedW: activeStep.heat_to_agmd_w,
      ambientLossW: (activeStep as any).ambient_loss_w ?? 0,
      agmdFeedTempC: activeStep.secondary_reservoir_temp_c,
      agmdColdPlateTempC: simulationResult.parameters?.agmd_cold_plate_temp_c ?? 20,
      agmdMembraneHotTempC: activeStep.agmd_hot_membrane_temp_c ?? activeStep.secondary_reservoir_temp_c,
      agmdMembraneColdTempC: activeStep.agmd_cold_condensing_temp_c ?? 20,
      agmdVaporFluxLMH: fluxLmh,
      agmdSalinityGKg: activeStep.feed_salinity_g_l ?? 35,
      agmdThrottled: Boolean((activeStep as any).agmd_power_throttled),
      freshwaterVolumeL: fwVolL,
      freshwaterRateLh: fwRateLh,
      energyResidualJ: activeStep.energy_balance_residual_j,
    };
  }, [simulationResult, activeStep]);

  const getComponentInfo = (type: ComponentType, id?: string): SelectedComponentInfo | null => {
    if (!type) return null;

    switch (type) {
      case 'gpu': {
        const gpu = telemetry.gpu_states.find((g) => g.gpu_id === id) || telemetry.gpu_states[0];
        if (!gpu) {
          return {
            type: 'gpu',
            name: 'GPU Cold Plate Unit',
            description: 'Lumped-capacitance AI GPU thermal node.',
            telemetry: [{ label: 'Status', value: 'Ready for simulation', status: 'info' }],
          };
        }
        return {
          type: 'gpu',
          id: gpu.gpu_id,
          name: `${gpu.gpu_id} Node & Cold Plate`,
          description: 'High-density GPU die dissipating heat to the closed primary coolant circuit.',
          telemetry: [
            { label: 'Junction Temp', value: `${gpu.current_temp_c.toFixed(2)} °C`, status: gpu.status === 'warning' ? 'warning' : 'nominal' },
            { label: 'Electrical Power', value: `${gpu.power_w.toFixed(1)} W` },
            { label: 'Heat Generated', value: `${gpu.heat_generated_w.toFixed(2)} W` },
            { label: 'Dissipation to Coolant', value: `${gpu.heat_to_coolant_w.toFixed(2)} W` },
            { label: 'Net Heat Absorption', value: `${gpu.net_heat_w.toFixed(2)} W` },
            { label: 'Stored Thermal Enthalpy', value: `${(gpu.stored_energy_j / 1e3).toFixed(2)} kJ` },
            { label: 'Operating Status', value: gpu.status.toUpperCase(), status: gpu.status === 'warning' ? 'warning' : 'nominal' },
          ],
        };
      }

      case 'primary_loop':
      case 'primary-loop': {
        return {
          type: 'primary_loop',
          name: 'Primary Coolant Circuit (Loop 1)',
          description: 'Closed circulating loop transferring heat from GPU cold plates to the heat exchanger.',
          telemetry: [
            { label: 'Coolant Bulk Temp (T_p)', value: `${telemetry.primary_coolant_temp_c.toFixed(2)} °C` },
            { label: 'Mass Flow Rate', value: `${telemetry.primary_mass_flow_kg_s.toFixed(3)} kg/s` },
            { label: 'Aggregate Absorbed Heat', value: `${telemetry.aggregate_heat_to_coolant_w.toFixed(2)} W` },
            { label: 'Loop Inventory Mass', value: `${simulationResult?.parameters?.primary_coolant_mass_kg ?? 2.0} kg` },
            { label: 'Circuit Isolation', value: '100% Isolated (Pure Coolant)', status: 'nominal' },
          ],
        };
      }

      case 'hx': {
        return {
          type: 'hx',
          name: 'Counterflow Heat Recovery Exchanger',
          description: 'Plate heat exchanger recovering thermal energy across an impervious physical wall without fluid mixing.',
          telemetry: [
            { label: 'Thermal Recovery Rate (Q_HX)', value: `${telemetry.hx_heat_transfer_w.toFixed(2)} W`, status: 'nominal' },
            { label: 'Effectiveness (ε)', value: `${(telemetry.hx_effectiveness * 100).toFixed(1)} %` },
            { label: 'Primary Inlet (T_p)', value: `${telemetry.primary_coolant_temp_c.toFixed(2)} °C` },
            { label: 'Primary Outlet (T_h,out)', value: `${telemetry.hx_primary_outlet_temp_c.toFixed(2)} °C` },
            { label: 'Secondary Inlet (T_s)', value: `${telemetry.secondary_reservoir_temp_c.toFixed(2)} °C` },
            { label: 'Secondary Heated Outlet (T_c,out)', value: `${telemetry.hx_secondary_outlet_temp_c.toFixed(2)} °C` },
            { label: 'Fluid Separation', value: 'Physical Wall (Zero Contamination)', status: 'nominal' },
          ],
        };
      }

      case 'secondary_loop':
      case 'secondary-loop': {
        return {
          type: 'secondary_loop',
          name: 'Secondary Water Loop (Loop 2)',
          description: 'Hot water circulation circuit transporting recovered heat to storage and AGMD feed channels.',
          telemetry: [
            { label: 'Reservoir Bulk Temp (T_s)', value: `${telemetry.secondary_reservoir_temp_c.toFixed(2)} °C` },
            { label: 'Circulation Mass Flow', value: `${telemetry.secondary_mass_flow_kg_s.toFixed(3)} kg/s` },
            { label: 'Heat Transferred from HX', value: `${telemetry.hx_heat_transfer_w.toFixed(2)} W` },
            { label: 'Thermal Supply to AGMD', value: `${telemetry.heat_to_agmd_w.toFixed(2)} W` },
          ],
        };
      }

      case 'reservoir': {
        return {
          type: 'reservoir',
          name: 'Secondary Thermal Storage Reservoir',
          description: 'Well-mixed insulated water vessel buffering recovered thermal energy for desalination.',
          telemetry: [
            { label: 'Reservoir Temperature (T_s)', value: `${telemetry.secondary_reservoir_temp_c.toFixed(2)} °C` },
            { label: 'Inventory Mass', value: `${simulationResult?.parameters?.secondary_water_mass_kg ?? 20.0} kg` },
            { label: 'Stored Thermal Energy', value: `${(telemetry.secondary_stored_energy_j / 1e6).toFixed(3)} MJ` },
            { label: 'Min Safety Temperature', value: `${telemetry.min_secondary_temp_c.toFixed(1)} °C` },
            { label: 'Throttling Margin', value: `${Math.max(0, telemetry.secondary_reservoir_temp_c - telemetry.min_secondary_temp_c).toFixed(2)} °C` },
          ],
        };
      }

      case 'agmd': {
        return {
          type: 'agmd',
          name: 'AGMD Desalination Membrane Module',
          description: 'Air-gap membrane distillation assembly evaporating water vapor across a hydrophobic PTFE membrane.',
          telemetry: [
            { label: 'Feed Water Temperature', value: `${telemetry.secondary_reservoir_temp_c.toFixed(2)} °C` },
            { label: 'Hot Membrane Surface (T_mh)', value: telemetry.agmd_hot_membrane_temp_c != null ? `${telemetry.agmd_hot_membrane_temp_c.toFixed(2)} °C` : 'N/A' },
            { label: 'Cold Condensing Surface (T_mc)', value: telemetry.agmd_cold_condensing_temp_c != null ? `${telemetry.agmd_cold_condensing_temp_c.toFixed(2)} °C` : 'N/A' },
            { label: 'Cold Condensing Plate', value: `${telemetry.agmd_cold_plate_temp_c.toFixed(1)} °C` },
            { label: 'Vapor Permeate Flux', value: `${telemetry.agmd_vapor_flux_lmh.toFixed(2)} LMH` },
            { label: 'Freshwater Rate', value: `${telemetry.freshwater_production_rate_l_h.toFixed(4)} L/h` },
            { label: 'Feed Salinity', value: `${telemetry.feed_salinity_g_l.toFixed(2)} g/L` },
            { label: 'Thermal Power Consumed', value: `${telemetry.heat_to_agmd_w.toFixed(2)} W` },
          ],
        };
      }

      case 'collector':
      case 'freshwater': {
        const volMetric = formatFreshwaterVolume(telemetry.cumulative_freshwater_volume_l);
        return {
          type: 'collector',
          name: 'Freshwater Distillate Collector',
          description: 'Graduated collection channel receiving pure condensed permeate water.',
          telemetry: [
            { label: 'Cumulative Distillate Yield', value: volMetric.text, status: 'nominal' },
            { label: 'Instantaneous Inflow', value: `${(telemetry.freshwater_production_rate_l_h * 1000).toFixed(2)} mL/h (${telemetry.freshwater_production_rate_l_h.toFixed(4)} L/h)` },
            { label: 'Purity / Rejection', value: '> 99.9% Salt Rejection', status: 'nominal' },
            { label: 'Thermal Source', value: '100% Recovered GPU Waste Heat', status: 'nominal' },
          ],
        };
      }

      default:
        return null;
    }
  };

  return {
    activeStep,
    telemetry,
    telemetryState,
    getComponentInfo,
  };
}
