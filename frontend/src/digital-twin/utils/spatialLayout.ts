import { CameraPreset } from '../types';

export const SPATIAL_LAYOUT = {
  // 1. GPU Cluster (Left side)
  gpuCluster: {
    position: [-5.0, 0.0, 0.0] as [number, number, number],
    width: 2.2,
    height: 2.8,
    depth: 1.2,
  },

  // 2. Heat Exchanger (Center Left)
  heatExchanger: {
    position: [-1.4, 0.0, 0.0] as [number, number, number],
    width: 1.2,
    height: 2.4,
    depth: 1.0,
  },

  // 3. Thermal Storage Reservoir (Center Right)
  reservoir: {
    position: [1.8, -0.2, 0.0] as [number, number, number],
    radius: 0.9,
    height: 2.0,
  },

  // 4. AGMD Module (Far Right Upper)
  agmdModule: {
    position: [5.2, 0.4, 0.0] as [number, number, number],
    width: 1.6,
    height: 1.8,
    depth: 1.4,
  },

  // 5. Freshwater Collector (Far Right Lower)
  collector: {
    position: [5.2, -1.6, 0.0] as [number, number, number],
    radius: 0.5,
    height: 1.0,
  },
};

export const CAMERA_PRESETS: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number] }> = {
  overview: {
    position: [0.0, 3.5, 11.5],
    target: [0.0, 0.0, 0.0],
  },
  gpu: {
    position: [-5.0, 1.5, 4.0],
    target: [-5.0, 0.0, 0.0],
  },
  hx: {
    position: [-1.4, 1.2, 3.5],
    target: [-1.4, 0.0, 0.0],
  },
  reservoir: {
    position: [1.8, 1.2, 3.5],
    target: [1.8, -0.2, 0.0],
  },
  agmd: {
    position: [5.2, 1.2, 3.5],
    target: [5.2, -0.2, 0.0],
  },
};
