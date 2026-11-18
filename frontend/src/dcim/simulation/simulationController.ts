/**
 * CondensAI Master Simulation Controller
 *
 * Coordinates time-stepping, subsystem execution order, workload scenario injection,
 * parameter controls, and time-series telemetry buffering.
 */

import { ENGINEERING_ASSUMPTIONS } from './engineeringAssumptions.ts';
import type { IntegratedEngineeringState } from './engineeringState.ts';
import { initializeEngineeringState } from './engineeringState.ts';
import { updateHydraulics } from './hydraulicsEngine.ts';
import { updateElectrical } from './electricalEngine.ts';
import { updateThermal } from './thermalEngine.ts';
import { updateAGMD } from './agmdEngine.ts';

export interface TelemetrySnapshot {
  timeSeconds: number;
  totalITPowerKw: number;
  facilityTotalPowerKw: number;
  pue: number;
  avgGpuTempC: number;
  maxGpuTempC: number;
  primarySupplyTempC: number;
  primaryReturnTempC: number;
  bufferTankTempC: number;
  hxHeatTransferKw: number;
  freshwaterRateL_H: number;
  cumulativeFreshwaterL: number;
  energyResidualPercent: number;
}

export class SimulationController {
  private state: IntegratedEngineeringState;
  private telemetryHistory: TelemetrySnapshot[] = [];
  private maxHistoryLength = 120; // 120 historical seconds

  constructor() {
    this.state = initializeEngineeringState();
    this.recordSnapshot();
  }

  public getState(): IntegratedEngineeringState {
    return this.state;
  }

  public getHistory(): TelemetrySnapshot[] {
    return this.telemetryHistory;
  }

  /**
   * Advances simulation by dt seconds
   */
  public step(dtSeconds = 1.0): IntegratedEngineeringState {
    if (!this.state.clock.isRunning) {
      return this.state;
    }

    const effectiveDt = dtSeconds * this.state.clock.playbackSpeed;
    this.state.clock.simTimeSeconds += effectiveDt;

    // Check experiment mode completion
    if (
      this.state.clock.mode === 'experiment' &&
      this.state.clock.simTimeSeconds >= this.state.clock.experimentDurationSeconds
    ) {
      this.state.clock.isRunning = false;
      this.state.clock.isComplete = true;
    }

    // Step 1: Update Primary Coolant Hydraulics
    this.state.hydraulics = updateHydraulics(this.state);

    // Step 2: Update Electrical Distribution & Power
    this.state.electrical = updateElectrical(this.state);

    // Step 3: Update GPU Thermal Solver, Heat Exchanger & Thermal Buffer
    this.state.heatRecovery = updateThermal(this.state, effectiveDt);

    // Step 4: Update AGMD Desalination & Freshwater Permeation
    this.state.agmd = updateAGMD(this.state, effectiveDt);

    // Step 5: Record Telemetry History
    this.recordSnapshot();

    return this.state;
  }

  /**
   * Sets the workload scenario
   */
  public applyScenario(scenarioName: string): void {
    this.state.selectedWorkloadPreset = scenarioName;

    let hallAUtil = 0.92;
    let hallBUtil = 0.68;
    let hallCUtil = 0.85;
    let hallDUtil = 0.55;

    switch (scenarioName) {
      case 'High-Intensity Training Surge':
        hallAUtil = 1.0;
        hallBUtil = 0.95;
        hallCUtil = 0.98;
        hallDUtil = 0.85;
        break;
      case 'AI Inference Production':
        hallAUtil = 0.65;
        hallBUtil = 0.95; // heavy inference
        hallCUtil = 0.70;
        hallDUtil = 0.40;
        break;
      case 'Scientific HPC Simulation':
        hallAUtil = 0.75;
        hallBUtil = 0.50;
        hallCUtil = 1.0; // max HPC compute
        hallDUtil = 0.60;
        break;
      case 'Eco-Water Recovery Optimization':
        hallAUtil = 0.90;
        hallBUtil = 0.80;
        hallCUtil = 0.90;
        hallDUtil = 0.70;
        break;
      case 'AI Training Baseline':
      default:
        hallAUtil = 0.92;
        hallBUtil = 0.68;
        hallCUtil = 0.85;
        hallDUtil = 0.55;
        break;
    }

    // Update GPU entity workloads and power
    for (const gpu of Object.values(this.state.gpus)) {
      let targetUtil = 0.8;
      if (gpu.hallId === 'HALL-A') targetUtil = hallAUtil;
      else if (gpu.hallId === 'HALL-B') targetUtil = hallBUtil;
      else if (gpu.hallId === 'HALL-C') targetUtil = hallCUtil;
      else if (gpu.hallId === 'HALL-D') targetUtil = hallDUtil;

      gpu.utilization = targetUtil;
      const powerW =
        ENGINEERING_ASSUMPTIONS.gpu.idlePowerW +
        targetUtil * (ENGINEERING_ASSUMPTIONS.gpu.thermalDesignPowerW - ENGINEERING_ASSUMPTIONS.gpu.idlePowerW);
      gpu.powerW = powerW;
      gpu.heatDissipationW = powerW * ENGINEERING_ASSUMPTIONS.gpu.thermalDissipationFraction;
    }

    // Immediately update electrical and thermal states to reflect new workload
    this.state.electrical = updateElectrical(this.state);
    this.state.heatRecovery = updateThermal(this.state, 0.1);
  }

  /**
   * Adjust pump speed fraction (0.1 to 1.0)
   */
  public setPumpSpeed(fraction: number): void {
    this.state.hydraulics.pumpSpeedFraction = Math.max(0.0, Math.min(1.0, fraction));
    this.state.hydraulics = updateHydraulics(this.state);
  }

  /**
   * Set coolant inlet setpoint
   */
  public setCoolantSupplyTempSetpoint(tempC: number): void {
    this.state.hydraulics.primarySupplyTempC = Math.max(18.0, Math.min(35.0, tempC));
  }

  /**
   * Set AGMD Feed Flow rate (kg/s)
   */
  public setAgmdFeedFlow(flowKgS: number): void {
    this.state.agmd.feedFlowKgS = Math.max(0.5, Math.min(5.0, flowKgS));
  }

  /**
   * Toggle rack valve
   */
  public setRackValve(rackId: string, state: 'Open' | 'Throttled' | 'Closed'): void {
    this.state.hydraulics.valves[rackId] = state;
    this.state.hydraulics = updateHydraulics(this.state);
  }

  public pause(): void {
    this.state.clock.isRunning = false;
  }

  public resume(): void {
    this.state.clock.isRunning = true;
  }

  public reset(): void {
    const wasRunning = this.state.clock.isRunning;
    const mode = this.state.clock.mode;
    const duration = this.state.clock.experimentDurationSeconds;

    this.state = initializeEngineeringState();
    this.state.clock.isRunning = wasRunning;
    this.state.clock.mode = mode;
    this.state.clock.experimentDurationSeconds = duration;
    this.telemetryHistory = [];
    this.recordSnapshot();
  }

  public setPlaybackSpeed(speed: number): void {
    this.state.clock.playbackSpeed = speed;
  }

  public setMode(mode: 'live' | 'experiment', durationSeconds = 120): void {
    this.state.clock.mode = mode;
    this.state.clock.experimentDurationSeconds = durationSeconds;
    this.state.clock.isComplete = false;
  }

  private recordSnapshot(): void {
    const allGpus = Object.values(this.state.gpus);
    const avgGpuTemp = allGpus.reduce((s, g) => s + g.temperatureC, 0) / allGpus.length;
    const maxGpuTemp = Math.max(...allGpus.map((g) => g.temperatureC));

    this.telemetryHistory.push({
      timeSeconds: Math.round(this.state.clock.simTimeSeconds),
      totalITPowerKw: Math.round(this.state.electrical.facilityITPowerKw * 10) / 10,
      facilityTotalPowerKw: Math.round(this.state.electrical.facilityTotalPowerKw * 10) / 10,
      pue: Math.round(this.state.electrical.instantaneousPUE * 100) / 100,
      avgGpuTempC: Math.round(avgGpuTemp * 10) / 10,
      maxGpuTempC: Math.round(maxGpuTemp * 10) / 10,
      primarySupplyTempC: Math.round(this.state.hydraulics.primarySupplyTempC * 10) / 10,
      primaryReturnTempC: Math.round(this.state.hydraulics.primaryReturnTempC * 10) / 10,
      bufferTankTempC: Math.round(this.state.heatRecovery.bufferTankTempC * 10) / 10,
      hxHeatTransferKw: Math.round(this.state.heatRecovery.heatTransferredKw * 10) / 10,
      freshwaterRateL_H: Math.round(this.state.agmd.freshwaterProductionRateL_H * 10) / 10,
      cumulativeFreshwaterL: Math.round(this.state.agmd.cumulativeFreshwaterL * 100) / 100,
      energyResidualPercent: Math.round(this.state.heatRecovery.energyBalanceResidualPercent * 100) / 100,
    });

    if (this.telemetryHistory.length > this.maxHistoryLength) {
      this.telemetryHistory.shift();
    }
  }
}

// Singleton Simulation Controller Instance
export const simulationController = new SimulationController();
