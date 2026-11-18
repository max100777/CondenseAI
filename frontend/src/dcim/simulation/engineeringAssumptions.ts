/**
 * CondensAI Engineering Assumptions & Physical Constants
 *
 * Centralized reference for all engineering parameters, physical properties,
 * numerical integration assumptions, and model limitations used across
 * the digital twin simulation subsystems.
 */

export const ENGINEERING_ASSUMPTIONS = {
  // Facility Topology Assumptions
  facility: {
    hallCount: 4,
    racksPerHall: 6,
    totalRacks: 24,
    gpusPerRack: 6,
    totalGpus: 144,
    serversPerRack: 6, // 6 discrete 4U liquid-cooled GPU chassis per 42U rack
    rackHeightRU: 42,
    occupiedRU: 24, // 6 x 4U = 24U chassis + 1U ToR switch + 1U PDU + 16U reserved
  },

  // Thermophysical Properties of Working Fluids (Water / Glycol mixture)
  fluid: {
    coolantDensityKgM3: 997.0, // Water density at 25°C
    coolantSpecificHeatJ_KgK: 4184.0, // Water specific heat capacity (J/kg·K)
    coolantDynamicViscosityPaS: 0.00089, // Pa·s at 25°C
    ambientTemperatureC: 22.0, // Data hall baseline ambient temperature (°C)
  },

  // GPU Hardware Specifications (NVIDIA H100 SXM5 / Hopper Architecture equivalent)
  gpu: {
    model: 'NVIDIA H100 SXM5 (Tensor Core Accelerator)',
    architecture: 'Hopper 4nm Lithography',
    thermalDesignPowerW: 700.0, // TDP (Watts)
    idlePowerW: 65.0, // Idle power consumption (Watts)
    thermalCapacitanceJ_K: 420.0, // Lumped thermal capacitance of silicon die + copper cold plate (J/K)
    coldPlateThermalResistanceK_W: 0.028, // Thermal resistance between die junction and coolant (K/W)
    maxOperatingTempC: 85.0, // Maximum continuous operating temperature (°C)
    throttlingTempC: 89.0, // Thermal throttling threshold (°C)
    criticalShutdownTempC: 95.0, // Hardware safety shutdown threshold (°C)
    thermalDissipationFraction: 0.985, // 98.5% of electrical power is converted into thermal waste heat
  },

  // Server Chassis Auxiliary Components (per 4U chassis containing 1 GPU)
  server: {
    cpuCount: 2, // Dual 32-core host processors
    cpuPowerW: 150.0, // Dual CPU power (Watts)
    memoryPowerW: 60.0, // 256 GiB DDR5 memory power (Watts)
    nicAndPciePowerW: 40.0, // Dual 400G ConnectX NICs + PCIe switches (Watts)
    psuEfficiency: 0.955, // 80-Plus Titanium server power supply efficiency (95.5%)
  },

  // Primary Coolant Hydraulics & Distribution Network
  hydraulics: {
    nominalPumpSpeedRpm: 1800.0,
    maxPumpSpeedRpm: 3000.0,
    pumpRatedHeadM: 35.0, // Rated head in meters
    pumpRatedFlowKgS: 2.50, // Central primary pump rated flow (~150 L/min)
    nominalRackCoolantFlowKgS: 0.0667, // ~4.0 L/min per 42U rack (total facility = 1.60 kg/s)
    minCoolantFlowPerGpuKgS: 0.0111, // ~0.67 L/min per GPU cold plate branch
    primarySupplyTempSetpointC: 28.0, // Primary supply temperature from CDU (°C)
    maxPermissiblePressureBar: 6.0, // Hydraulic piping pressure limit (bar)
    manifoldPressureDropKPa: 18.0, // Pressure drop across rack distribution header (kPa)
  },

  // Electrical Power Distribution (415V 3-Phase A/B 2N Redundant)
  electrical: {
    utilityVoltageV: 11000.0, // 11 kV medium voltage grid intake
    distributionVoltageV: 415.0, // 415 V line-to-line 3-phase
    lineToNeutralVoltageV: 240.0, // 240 V line-to-neutral
    powerFactor: 0.95, // System power factor (lagging)
    transformerEfficiency: 0.985, // 98.5% efficiency
    upsEfficiency: 0.965, // 96.5% online double-conversion UPS efficiency
    pduEfficiency: 0.990, // 99.0% rack PDU distribution efficiency
  },

  // Counterflow Plate Heat Exchanger (Module 2 Equivalent)
  heatExchanger: {
    type: 'Counterflow Plate & Frame',
    nominalEffectiveness: 0.85, // Heat exchanger effectiveness (85%)
    heatTransferAreaM2: 12.5, // Plate heat transfer surface area (m²)
    overallU_W_M2K: 2850.0, // Overall heat transfer coefficient U (W/m²·K)
    secondaryFlowRateKgS: 1.80, // Secondary circuit water mass flow rate (kg/s)
  },

  // Secondary Thermal Storage Buffer Tank
  thermalBuffer: {
    capacityLiters: 15000.0, // 15 m³ insulated secondary water thermal buffer
    initialTempC: 36.5, // Initial secondary buffer temperature (°C) conforms to passive heat recovery
    ambientLossCoefficientW_K: 45.0, // Thermal insulation loss to ambient (W/K)
    maxSafeTempC: 75.0, // Over-temperature protection limit (°C)
  },

  // Air-Gap Membrane Distillation (AGMD) Subsystem (Module 4 Equivalent)
  agmd: {
    membraneType: 'Hydrophobic PTFE',
    membraneAreaM2: 24.0, // Active distillation membrane surface area (m²)
    membraneThicknessM: 0.00015, // 150 µm thickness
    membranePorosity: 0.78, // 78% porous
    meanPoreSizeM: 0.00000022, // 0.22 µm mean pore diameter
    airGapWidthM: 0.002, // 2.0 mm stagnant air gap
    feedSalinityG_Kg: 35.0, // Standard seawater salinity (35 g/kg or 35,000 ppm TDS)
    nominalFeedFlowKgS: 1.50, // ~90 L/min feedwater flow rate
    coolantCondenserTempC: 20.0, // Condenser cooling plate temperature (°C)
    vaporDiffusionCoefficientM2S: 0.000026, // Water vapor diffusion in air at 35°C
    latentHeatOfVaporizationJ_Kg: 2415000.0, // Latent heat of evaporation at 36°C (J/kg)
  },

  // Numerical Simulation Tolerances
  simulation: {
    timeStepSeconds: 1.0, // Base discrete simulation time step (dt = 1 s)
    energyConservationTolerancePercent: 2.0, // Maximum acceptable energy residual (<2%)
    massConservationToleranceKgS: 0.001, // Hydraulic mass balance tolerance (1 g/s)
  },
} as const;
