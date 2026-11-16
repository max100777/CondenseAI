export interface GPUConfig {
  gpu_id: string;
  power_w: number;
  heat_conversion_fraction: number;
  initial_temp_c: number;
  thermal_resistance_k_per_w: number;
  thermal_capacitance_j_per_k: number;
  max_temp_c?: number | null;
}

export interface GPUState {
  gpu_id: string;
  power_w: number;
  current_temp_c: number;
  heat_generated_w: number;
  heat_to_coolant_w: number;
  net_heat_w: number;
  stored_energy_j: number;
  status: string;
}

export interface GPUComparisonItem {
  gpu_id: string;
  power_w: number;
  final_temp_c: number;
  heat_generated_w: number;
  heat_to_coolant_w: number;
  stored_energy_j: number;
  status: string;
}

export interface MultiGPUStep {
  time_s: number;
  gpu_states: GPUState[];
  aggregate_heat_generated_w: number;
  aggregate_heat_to_coolant_w: number;
  primary_coolant_temp_c: number;
  primary_heat_loss_w: number;
  hx_heat_transfer_w: number;
  hx_effectiveness: number;
  hx_ntu: number;
  hx_primary_outlet_temp_c: number;
  hx_secondary_outlet_temp_c: number;
  secondary_reservoir_temp_c: number;
  secondary_stored_energy_j: number;
  secondary_heat_loss_w: number;
  heat_to_agmd_w: number;
  unmet_agmd_demand_w: number;
  cumulative_heat_generated_j: number;
  cumulative_heat_to_coolant_j: number;
  cumulative_heat_recovered_hx_j: number;
  cumulative_heat_to_agmd_j: number;
  cumulative_ambient_loss_j: number;
  energy_balance_residual_j: number;
  freshwater_production_rate_kg_s?: number | null;
  freshwater_production_rate_l_h?: number | null;
  cumulative_freshwater_mass_kg?: number | null;
  cumulative_freshwater_volume_l?: number | null;
  feed_salinity_g_l?: number | null;
  agmd_hot_membrane_temp_c?: number | null;
  agmd_cold_condensing_temp_c?: number | null;
  agmd_vapor_flux_kg_m2_s?: number | null;
}

export interface AnalyticsSummary {
  simulation_duration_s: number;
  total_gpu_heat_generated_j?: number | null;
  total_heat_recovered_j?: number | null;
  total_agmd_energy_j: number;
  total_agmd_energy_kwh: number;
  total_freshwater_mass_kg: number;
  total_freshwater_volume_l: number;
  total_freshwater_volume_ml: number;
  instantaneous_production_l_h: number;
  average_production_l_h: number;
  average_flux_lmh: number;
  maximum_flux_lmh: number;
  minimum_flux_lmh: number;
  heat_exchanger_recovery_percent?: number | null;
  heat_utilization_percent?: number | null;
  gpu_to_agmd_efficiency_percent?: number | null;
  specific_thermal_energy_kwh_m3?: number | null;
  water_recovery_percent?: number | null;
  final_feed_salinity_g_l?: number | null;
  energy_balance_residual_j?: number | null;
}

export interface MultiGPUSimulationResponse {
  gpu_count: number;
  aggregate_power_w: number;
  gpu_comparison: GPUComparisonItem[];
  final_primary_coolant_temp_c: number;
  final_secondary_reservoir_temp_c: number;
  total_heat_generated_j: number;
  total_heat_to_coolant_j: number;
  total_heat_recovered_hx_j: number;
  total_heat_to_agmd_j: number;
  total_ambient_loss_j: number;
  system_energy_balance_residual_j: number;
  total_freshwater_produced_kg?: number | null;
  total_freshwater_produced_l?: number | null;
  simulation_duration_s: number;
  step_count: number;
  analytics?: AnalyticsSummary | null;
  time_series: MultiGPUStep[];
}
