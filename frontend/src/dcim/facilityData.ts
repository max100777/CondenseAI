/**
 * CondensAI Multi-Hall Data Center Digital Twin — Facility Configuration & Data Model
 * Phase 1 Foundation
 *
 * Strict Architecture:
 * - 4 Data Halls (Hall A: AI Training, Hall B: AI Inference, Hall C: HPC & Research, Hall D: Experimental)
 * - 6 Racks per Hall (A01-A06, B01-B06, C01-C06, D01-D06) = 24 Racks Total
 * - 6 GPU Placeholders per Rack = 144 GPUs Total
 * - Coherent spatial geometry with corridors, aisles, and reserved infrastructure plant zones.
 */

export type HallId = 'HALL-A' | 'HALL-B' | 'HALL-C' | 'HALL-D';
export type HallCode = 'A' | 'B' | 'C' | 'D';

export type WorkloadProfileType =
  | 'ai_training'
  | 'ai_inference'
  | 'hpc_research'
  | 'experimental';

export type SelectionLevel = 'campus' | 'hall' | 'rack' | 'gpu' | 'infrastructure';

export type InfrastructureComponentType =
  | 'CDU'
  | 'PRIMARY_PUMP'
  | 'PRIMARY_SUPPLY'
  | 'PRIMARY_RETURN'
  | 'HEAT_EXCHANGER'
  | 'SECONDARY_BUFFER'
  | 'AGMD_MODULE'
  | 'DISTILLATE_TANK'
  | 'BRINE_OUTLET'
  | 'SUBSTATION_XFR'
  | 'MAIN_SWITCHGEAR'
  | 'UPS_A'
  | 'UPS_B'
  | 'BUSWAY_A'
  | 'BUSWAY_B'
  | 'PDU_A'
  | 'PDU_B'
  | 'CORE_SWITCH'
  | 'CABLE_TRAY'
  | 'LEAF_SWITCH'
  | 'TOR_SWITCH';

export interface InfrastructureComponentRef {
  id: string;
  type: InfrastructureComponentType;
  name: string;
  category: 'cooling' | 'electrical' | 'network' | 'desalination';
  hallId?: HallId;
  rackId?: string;
  position: [number, number, number];
}

export interface GpuPlaceholder {
  id: string; // e.g., "GPU A01-GPU01"
  name: string; // "GPU A01-GPU01"
  rackId: string; // "Rack A01"
  hallId: HallId; // "HALL-A"
  indexInRack: number; // 0 to 5
  gpuNumber: number; // 1 to 6
  slotU: number; // rack U slot (e.g. 6, 12, 18, 24, 30, 36)
  status: 'Placeholder (Ready)';
  telemetryConnected: false;
  telemetryStatus: 'Telemetry Disconnected (Phase 1 Placeholder)';
  specs: {
    formFactor: '4U Accelerator Module';
    acceleratorType: string;
    coolingDesign: 'Direct-to-Chip Liquid Cold-Plate Ready';
    designPowerW: number;
  };
}

export interface RackConfig {
  id: string; // e.g. "Rack A01"
  code: string; // "A01"
  name: string; // "Rack A01"
  hallId: HallId;
  hallCode: HallCode;
  rackNumber: number; // 1 to 6
  row: number; // 1 or 2
  colInRow: number; // 1, 2, or 3
  position: [number, number, number]; // [x, y, z] world space
  localPos: [number, number, number]; // [x, y, z] relative to hall
  facingZ: number; // 1 = facing +Z (North), -1 = facing -Z (South)
  ruHeight: number; // 42U
  occupiedU: number; // 24U (6 x 4U)
  status: 'Operational' | 'Ready' | 'Standby';
  coolingManifoldStatus: 'Dual-manifold quick-disconnect ready (Future Loop 2/3)';
  electricalFeedStatus: 'Dual-feed 415V A/B ready (Future Substation Loop)';
  gpus: GpuPlaceholder[]; // exactly 6 GPUs
}

export interface HallConfig {
  id: HallId;
  code: HallCode;
  name: string; // "Hall A — AI Training"
  shortName: string; // "Hall A"
  subTitle: string; // "AI Training"
  workloadProfile: string; // "High-intensity compute"
  profileType: WorkloadProfileType;
  description: string;
  visualIdentity: string;
  anticipatedPowerDensity: string;
  targetAisleTempC: number;
  accentColor: string; // Hex color for lighting/badges
  center: [number, number, number]; // [x, y, z]
  dimensions: [number, number, number]; // [width, height, depth]
  racks: RackConfig[]; // exactly 6 racks
}

export interface FacilityInfrastructureZone {
  id: string;
  name: string;
  category: 'Thermal Recovery & Desalination' | 'Chilled-Water Plant' | 'Electrical Substation' | 'Standby Power';
  description: string;
  futureIntegration: string;
  position: [number, number, number]; // [x, y, z]
  dimensions: [number, number, number]; // [width, height, depth]
  accentColor: string;
}

export interface FacilityData {
  id: string;
  name: string;
  campusCode: string;
  description: string;
  halls: HallConfig[];
  infrastructureZones: FacilityInfrastructureZone[];
  totalHalls: number;
  totalRacks: number;
  totalGpus: number;
}

export interface SelectionState {
  level: SelectionLevel;
  hallId: HallId | null;
  rackId: string | null;
  gpuId: string | null;
  infraComponent?: InfrastructureComponentRef | null;
}

export interface LayerVisibilityState {
  // Facility structure
  facilityEnvelope: boolean;
  floorsAndAisles: boolean;
  structuralColumns: boolean;
  // IT infrastructure
  racks: boolean;
  serverChassis: boolean;
  gpus: boolean;
  torSwitches: boolean;
  // Liquid Cooling
  coolingPiping: boolean;
  primarySupply: boolean;
  primaryReturn: boolean;
  rackCoolantBranches: boolean;
  pumpsAndCdu: boolean;
  heatExchanger: boolean;
  secondaryLoop: boolean;
  bufferTank: boolean;
  // Electrical Power
  electricalDistribution: boolean;
  substation: boolean;
  feedA: boolean;
  feedB: boolean;
  upsAndGenset: boolean;
  rackPdus: boolean;
  // Network Cabling
  networkInfrastructure: boolean;
  coreSpine: boolean;
  cableTrays: boolean;
  leafSwitches: boolean;
  // AGMD & Water
  agmdPlant: boolean;
  feedwaterPiping: boolean;
  freshwaterTank: boolean;
  brineDrain: boolean;
  // Overlays & Animations
  flowAnimations: boolean;
  powerPulses: boolean;
  networkActivity: boolean;
  labelsAndAnnotations: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: LayerVisibilityState = {
  facilityEnvelope: true,
  floorsAndAisles: true,
  structuralColumns: true,
  racks: true,
  serverChassis: true,
  gpus: true,
  torSwitches: true,
  coolingPiping: true,
  primarySupply: true,
  primaryReturn: true,
  rackCoolantBranches: true,
  pumpsAndCdu: true,
  heatExchanger: true,
  secondaryLoop: true,
  bufferTank: true,
  electricalDistribution: true,
  substation: true,
  feedA: true,
  feedB: true,
  upsAndGenset: true,
  rackPdus: true,
  networkInfrastructure: true,
  coreSpine: true,
  cableTrays: true,
  leafSwitches: true,
  agmdPlant: true,
  feedwaterPiping: true,
  freshwaterTank: true,
  brineDrain: true,
  flowAnimations: true,
  powerPulses: true,
  networkActivity: true,
  labelsAndAnnotations: true,
};

/**
 * Raw Hall Definitions according to Master Prompt specification
 */
const HALL_DEFINITIONS: Array<{
  id: HallId;
  code: HallCode;
  name: string;
  subTitle: string;
  workloadProfile: string;
  profileType: WorkloadProfileType;
  description: string;
  visualIdentity: string;
  anticipatedPowerDensity: string;
  accentColor: string;
  center: [number, number, number];
  dimensions: [number, number, number];
}> = [
  {
    id: 'HALL-A',
    code: 'A',
    name: 'Hall A — AI Training',
    subTitle: 'AI Training',
    workloadProfile: 'High-intensity compute',
    profileType: 'ai_training',
    description: 'High-intensity foundational compute environment optimized for large-scale AI distributed model training.',
    visualIdentity: 'High-performance AI compute hall with direct-to-chip liquid distribution headers',
    anticipatedPowerDensity: 'High (35–45 kW per rack design envelope)',
    accentColor: '#38bdf8', // Cyan/Sky blue
    center: [-20, 0, -14],
    dimensions: [20, 5.5, 20],
  },
  {
    id: 'HALL-B',
    code: 'B',
    name: 'Hall B — AI Inference',
    subTitle: 'AI Inference',
    workloadProfile: 'Variable workload environment',
    profileType: 'ai_inference',
    description: 'Dynamic compute environment handling production inference workloads with burst-like throughput profiles.',
    visualIdentity: 'Inference/production compute hall with adaptive dynamic cooling response',
    anticipatedPowerDensity: 'Medium-High (20–30 kW per rack design envelope)',
    accentColor: '#34d399', // Emerald/Green
    center: [-20, 0, 14],
    dimensions: [20, 5.5, 20],
  },
  {
    id: 'HALL-C',
    code: 'C',
    name: 'Hall C — HPC & Research',
    subTitle: 'HPC & Research',
    workloadProfile: 'Sustained computational workload',
    profileType: 'hpc_research',
    description: 'Scientific computing and numerical simulation hall running sustained, long-running batch job profiles.',
    visualIdentity: 'Scientific computing hall with continuous-duty thermal recovery buffering',
    anticipatedPowerDensity: 'High (25–35 kW per rack design envelope)',
    accentColor: '#818cf8', // Indigo/Violet
    center: [20, 0, -14],
    dimensions: [20, 5.5, 20],
  },
  {
    id: 'HALL-D',
    code: 'D',
    name: 'Hall D — Experimental Hall',
    subTitle: 'Experimental Hall',
    workloadProfile: 'Configurable workload',
    profileType: 'experimental',
    description: 'Flexible test and optimization hall for next-generation cooling fluid trials and AGMD integration prototypes.',
    visualIdentity: 'Flexible test and optimization hall with reconfigurable hydraulic manifolds',
    anticipatedPowerDensity: 'Configurable (10–40 kW per rack experimental envelope)',
    accentColor: '#fbbf24', // Amber/Orange
    center: [20, 0, 14],
    dimensions: [20, 5.5, 20],
  },
];

/**
 * Reserved Infrastructure Plant Zones (Spatial placeholders for future engineering modules)
 */
const INFRASTRUCTURE_ZONES: FacilityInfrastructureZone[] = [
  {
    id: 'PLANT-AGMD-DESAL',
    name: 'Thermal Recovery & AGMD Desalination Yard',
    category: 'Thermal Recovery & Desalination',
    description: 'Reserved skid for secondary thermal storage tanks, plate heat exchangers, and Air-Gap Membrane Distillation modules.',
    futureIntegration: 'Couples waste heat from secondary coolant loops (45–60°C) to drive clean water desalination.',
    position: [-20, 0, -32],
    dimensions: [18, 4.2, 12],
    accentColor: '#06b6d4', // Cyan
  },
  {
    id: 'PLANT-CHILLED-CDU',
    name: 'Chilled-Water & CDU Mechanical Yard',
    category: 'Chilled-Water Plant',
    description: 'Industrial facility water plant housing primary coolant distribution units (CDUs), hydronic pumps, and headers.',
    futureIntegration: 'Houses Primary Cooling Distribution Units (CDUs) circulating coolant to direct-to-chip cold plates.',
    position: [20, 0, -32],
    dimensions: [18, 4.2, 12],
    accentColor: '#60a5fa', // Blue
  },
  {
    id: 'PLANT-ELECTRICAL-SUB',
    name: 'High-Voltage Electrical Substation',
    category: 'Electrical Substation',
    description: 'Main utility intake, 11 kV to 415 V step-down transformers, power metering, and primary switchgear.',
    futureIntegration: 'Feeds dual A/B electrical distribution paths to all 24 server rack PDUs.',
    position: [-20, 0, 32],
    dimensions: [18, 3.8, 12],
    accentColor: '#f59e0b', // Amber
  },
  {
    id: 'PLANT-GENSET-UPS',
    name: 'Standby Generator & Central UPS Yard',
    category: 'Standby Power',
    description: 'Emergency diesel generators with acoustic enclosures, fuel storage, and central battery UPS banks.',
    futureIntegration: 'Provides 2N emergency power backup with sub-10ms automatic transfer during utility interruptions.',
    position: [20, 0, 32],
    dimensions: [18, 3.8, 12],
    accentColor: '#ef4444', // Red
  },
];

/**
 * Generate 6 GPU placeholders for a rack
 */
function createGpuPlaceholders(hallId: HallId, rackId: string, rackCode: string): GpuPlaceholder[] {
  const gpus: GpuPlaceholder[] = [];
  const slotPositions = [6, 12, 18, 24, 30, 36]; // 4U chassis mounted at 6U pitch

  for (let i = 0; i < 6; i++) {
    const gpuNumber = i + 1;
    const gpuNumberStr = String(gpuNumber).padStart(2, '0');
    // Stable ID: e.g. "GPU A01-GPU01"
    const id = `GPU ${rackCode}-GPU${gpuNumberStr}`;
    const name = `GPU ${rackCode}-GPU${gpuNumberStr}`;

    gpus.push({
      id,
      name,
      rackId,
      hallId,
      indexInRack: i,
      gpuNumber,
      slotU: slotPositions[i],
      status: 'Placeholder (Ready)',
      telemetryConnected: false,
      telemetryStatus: 'Telemetry Disconnected (Phase 1 Placeholder)',
      specs: {
        formFactor: '4U Accelerator Module',
        acceleratorType: 'High-Density Tensor Acceleration Unit',
        coolingDesign: 'Direct-to-Chip Liquid Cold-Plate Ready',
        designPowerW: 700,
      },
    });
  }
  return gpus;
}

/**
 * Build the complete facility configuration
 */
export function buildFacilityConfig(): FacilityData {
  const halls: HallConfig[] = HALL_DEFINITIONS.map((def) => {
    const racks: RackConfig[] = [];

    // Spatial layout inside hall:
    // 6 Racks arranged in 2 opposing rows of 3 racks facing a central cold aisle!
    // Row 1 (Racks 01, 02, 03): facing +Z (toward aisle at Z=0)
    // Row 2 (Racks 04, 05, 06): facing -Z (toward aisle at Z=0)
    // Rack X positions: -3.0m, 0m, +3.0m relative to hall center
    // Row 1 Z: -2.2m (facing +Z)
    // Row 2 Z: +2.2m (facing -Z)
    // Cold aisle width between rows: 4.4m (generous for technician walk and camera framing)

    const xOffsets = [-3.2, 0, 3.2];

    for (let r = 1; r <= 6; r++) {
      const rackNumStr = String(r).padStart(2, '0');
      const rackCode = `${def.code}${rackNumStr}`; // e.g. "A01"
      const rackId = `Rack ${rackCode}`; // e.g. "Rack A01"

      const isRow1 = r <= 3;
      const row = isRow1 ? 1 : 2;
      const colInRow = isRow1 ? r : r - 3;
      const localX = xOffsets[colInRow - 1];
      const localZ = isRow1 ? -2.2 : 2.2;
      const facingZ = isRow1 ? 1 : -1;

      const worldX = def.center[0] + localX;
      const worldY = 0;
      const worldZ = def.center[2] + localZ;

      const gpus = createGpuPlaceholders(def.id, rackId, rackCode);

      racks.push({
        id: rackId,
        code: rackCode,
        name: rackId,
        hallId: def.id,
        hallCode: def.code,
        rackNumber: r,
        row,
        colInRow,
        position: [worldX, worldY, worldZ],
        localPos: [localX, 0, localZ],
        facingZ,
        ruHeight: 42,
        occupiedU: 24, // 6 GPUs x 4U
        status: 'Operational',
        coolingManifoldStatus: 'Dual-manifold quick-disconnect ready (Future Loop 2/3)',
        electricalFeedStatus: 'Dual-feed 415V A/B ready (Future Substation Loop)',
        gpus,
      });
    }

    return {
      ...def,
      shortName: `Hall ${def.code}`,
      targetAisleTempC: 22.0,
      racks,
    };
  });

  return {
    id: 'CONDENSAI-CAMPUS-01',
    name: 'CondensAI Hyperscale Digital Twin Campus',
    campusCode: 'CAMPUS-01',
    description: 'Multi-hall hyperscale liquid-cooled AI data center digital twin foundation with waste-heat desalination integration.',
    halls,
    infrastructureZones: INFRASTRUCTURE_ZONES,
    totalHalls: halls.length,
    totalRacks: halls.reduce((sum, h) => sum + h.racks.length, 0),
    totalGpus: halls.reduce((sum, h) => sum + h.racks.reduce((rSum, r) => rSum + r.gpus.length, 0), 0),
  };
}

// Singleton facility configuration instance
export const facilityData = buildFacilityConfig();

// Accessor helper functions
export function getFacilityData(): FacilityData {
  return facilityData;
}

export function getAllHalls(): HallConfig[] {
  return facilityData.halls;
}

export function getHallById(id: string): HallConfig | undefined {
  return facilityData.halls.find((h) => h.id === id || h.code === id);
}

export function getAllRacks(): RackConfig[] {
  return facilityData.halls.flatMap((h) => h.racks);
}

export function getRackById(id: string): RackConfig | undefined {
  return getAllRacks().find((r) => r.id === id || r.code === id);
}

export function getAllGpus(): GpuPlaceholder[] {
  return getAllRacks().flatMap((r) => r.gpus);
}

export function getGpuById(id: string): GpuPlaceholder | undefined {
  return getAllGpus().find((g) => g.id === id);
}

export function getParentRackOfGpu(gpuId: string): RackConfig | undefined {
  const gpu = getGpuById(gpuId);
  if (!gpu) return undefined;
  return getRackById(gpu.rackId);
}

export function getParentHallOfRack(rackId: string): HallConfig | undefined {
  const rack = getRackById(rackId);
  if (!rack) return undefined;
  return getHallById(rack.hallId);
}
