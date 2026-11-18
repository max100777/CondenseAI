import { GPUState } from '../types';

export type ComponentType =
  | 'gpu'
  | 'hx'
  | 'reservoir'
  | 'agmd'
  | 'primary-loop'
  | 'secondary-loop'
  | 'freshwater'
  | 'collector'
  | 'primary_loop'
  | 'secondary_loop'
  | null;

export type CameraPreset = 'overview' | 'gpu' | 'hx' | 'reservoir' | 'agmd' | 'collector';

export interface DisplayOptions {
  showLabels: boolean;
  showHeatmap: boolean;
  flowAnimation: boolean;
  agmdCutaway: boolean;
  transparentPipes: boolean;
  exploded: boolean;
  plates: boolean;
  energy: boolean;
}

export type DigitalTwinDisplayOptions = DisplayOptions;

export interface SelectedComponentInfo {
  type: ComponentType;
  id?: string;
  name: string;
  description: string;
  telemetry: {
    label: string;
    value: string;
    unit?: string;
    status?: 'nominal' | 'warning' | 'info';
  }[];
}

export interface TelemetryState {
  timeS: number;
  gpuTotalPowerW: number;
  gpuHeatToCoolantW: number;
  gpuTemperatures: number[];
  primaryInletTempC: number;
  primaryOutletTempC: number;
  hxHeatTransferredW: number;
  hxEffectiveness: number;
  secondaryOutletTempC: number;
  reservoirTempC: number;
  reservoirEnergyJ: number;
  agmdHeatExtractedW: number;
  ambientLossW: number;
  agmdFeedTempC: number;
  agmdColdPlateTempC: number;
  agmdMembraneHotTempC: number;
  agmdMembraneColdTempC: number;
  agmdVaporFluxLMH: number;
  agmdSalinityGKg: number;
  agmdThrottled: boolean;
  freshwaterVolumeL: number;
  freshwaterRateLh: number;
  energyResidualJ: number;
}

export interface DigitalTwinTelemetryState {
  time_s: number;
  gpu_states: GPUState[];
  aggregate_power_w: number;
  aggregate_heat_generated_w: number;
  aggregate_heat_to_coolant_w: number;
  primary_coolant_temp_c: number;
  primary_mass_flow_kg_s: number;
  hx_heat_transfer_w: number;
  hx_primary_outlet_temp_c: number;
  hx_secondary_outlet_temp_c: number;
  hx_effectiveness: number;
  secondary_reservoir_temp_c: number;
  secondary_mass_flow_kg_s: number;
  secondary_stored_energy_j: number;
  min_secondary_temp_c: number;
  heat_to_agmd_w: number;
  freshwater_production_rate_l_h: number;
  cumulative_freshwater_volume_l: number;
  cumulative_freshwater_volume_ml: number;
  feed_salinity_g_l: number;
  agmd_hot_membrane_temp_c?: number | null;
  agmd_cold_condensing_temp_c?: number | null;
  agmd_cold_plate_temp_c: number;
  agmd_vapor_flux_lmh: number;
  energy_balance_residual_j: number;
}
