import { useState } from 'react';
import {
  Layers,
  Eye,
  EyeOff,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Droplets,
  Zap,
  Network,
  Server,
  Flame,
  Activity,
} from 'lucide-react';
import { LayerVisibilityState, DEFAULT_LAYER_VISIBILITY } from './facilityData.ts';

interface LayerControlPanelProps {
  layers: LayerVisibilityState;
  onChangeLayers: (layers: LayerVisibilityState) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSoloCategory?: (category: 'cooling' | 'electrical' | 'network' | 'it' | 'all') => void;
}

export default function LayerControlPanel({
  layers,
  onChangeLayers,
  isOpen,
  onToggleOpen,
}: LayerControlPanelProps) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    facility: false,
    it: false,
    cooling: false,
    electrical: false,
    network: false,
    agmd: false,
    overlays: false,
  });

  const toggleSection = (sec: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const setLayer = (key: keyof LayerVisibilityState, value: boolean) => {
    onChangeLayers({ ...layers, [key]: value });
  };

  const handleShowAll = () => {
    const allTrue: any = {};
    for (const k of Object.keys(DEFAULT_LAYER_VISIBILITY)) {
      allTrue[k] = true;
    }
    onChangeLayers(allTrue);
  };

  const handleHideAll = () => {
    const allFalse: any = {};
    for (const k of Object.keys(DEFAULT_LAYER_VISIBILITY)) {
      allFalse[k] = false;
    }
    // Keep at least basic floors visible
    allFalse.floorsAndAisles = true;
    onChangeLayers(allFalse);
  };

  const handleResetDefaults = () => {
    onChangeLayers({ ...DEFAULT_LAYER_VISIBILITY });
  };

  if (!isOpen) {
    return (
      <button
        className="dc-layer-toggle-btn"
        onClick={onToggleOpen}
        title="Open Infrastructure Layer Controls"
      >
        <Layers size={16} />
        <span>Layers & Overlays</span>
      </button>
    );
  }

  return (
    <div className="dc-layer-panel">
      <div className="dc-layer-header">
        <div className="dc-layer-title">
          <Layers size={16} />
          <strong>Infrastructure Layers</strong>
        </div>
        <button className="dc-layer-close" onClick={onToggleOpen} title="Minimize">
          ✕
        </button>
      </div>

      {/* Global Quick Action Toolbar */}
      <div className="dc-layer-actions">
        <button onClick={handleShowAll} title="Enable all layers">
          <Eye size={12} /> Show All
        </button>
        <button onClick={handleHideAll} title="Hide all infrastructure layers">
          <EyeOff size={12} /> Hide All
        </button>
        <button onClick={handleResetDefaults} title="Restore standard facility view">
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <div className="dc-layer-scroll">
        {/* GROUP 1: LIQUID COOLING INFRASTRUCTURE */}
        <div className="dc-layer-group">
          <div className="dc-group-header" onClick={() => toggleSection('cooling')}>
            <div className="dc-group-title">
              <Droplets size={14} style={{ color: '#06b6d4' }} />
              <span>Liquid Cooling System</span>
            </div>
            {collapsedSections.cooling ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>
          {!collapsedSections.cooling && (
            <div className="dc-group-items">
              <label className="dc-layer-item">
                <input
                  type="checkbox"
                  checked={layers.coolingPiping}
                  onChange={(e) => setLayer('coolingPiping', e.target.checked)}
                />
                <span>All Cooling Piping</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.primarySupply}
                  onChange={(e) => setLayer('primarySupply', e.target.checked)}
                />
                <span style={{ color: '#38bdf8' }}>Primary Supply (28°C)</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.primaryReturn}
                  onChange={(e) => setLayer('primaryReturn', e.target.checked)}
                />
                <span style={{ color: '#f97316' }}>Primary Return (39.5°C)</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.rackCoolantBranches}
                  onChange={(e) => setLayer('rackCoolantBranches', e.target.checked)}
                />
                <span>Rack Coolant Headers</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.pumpsAndCdu}
                  onChange={(e) => setLayer('pumpsAndCdu', e.target.checked)}
                />
                <span>Pumps & Central CDU</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.heatExchanger}
                  onChange={(e) => setLayer('heatExchanger', e.target.checked)}
                />
                <span style={{ color: '#10b981' }}>Plate Heat Exchanger</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.bufferTank}
                  onChange={(e) => setLayer('bufferTank', e.target.checked)}
                />
                <span style={{ color: '#0284c7' }}>15,000 L Thermal Buffer Tank</span>
              </label>
            </div>
          )}
        </div>

        {/* GROUP 2: ELECTRICAL DISTRIBUTION */}
        <div className="dc-layer-group">
          <div className="dc-group-header" onClick={() => toggleSection('electrical')}>
            <div className="dc-group-title">
              <Zap size={14} style={{ color: '#eab308' }} />
              <span>Electrical Power (415V 2N)</span>
            </div>
            {collapsedSections.electrical ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>
          {!collapsedSections.electrical && (
            <div className="dc-group-items">
              <label className="dc-layer-item">
                <input
                  type="checkbox"
                  checked={layers.electricalDistribution}
                  onChange={(e) => setLayer('electricalDistribution', e.target.checked)}
                />
                <span>Electrical Distribution</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.feedA}
                  onChange={(e) => setLayer('feedA', e.target.checked)}
                />
                <span style={{ color: '#eab308' }}>Feed A Busways (Primary)</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.feedB}
                  onChange={(e) => setLayer('feedB', e.target.checked)}
                />
                <span style={{ color: '#f59e0b' }}>Feed B Busways (2N Redundant)</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.substation}
                  onChange={(e) => setLayer('substation', e.target.checked)}
                />
                <span>11 kV Substation Transformer</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.rackPdus}
                  onChange={(e) => setLayer('rackPdus', e.target.checked)}
                />
                <span>Rack PDUs & Power Drops</span>
              </label>
            </div>
          )}
        </div>

        {/* GROUP 3: HIGH-SPEED NETWORK */}
        <div className="dc-layer-group">
          <div className="dc-group-header" onClick={() => toggleSection('network')}>
            <div className="dc-group-title">
              <Network size={14} style={{ color: '#a855f7' }} />
              <span>Network Infrastructure</span>
            </div>
            {collapsedSections.network ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>
          {!collapsedSections.network && (
            <div className="dc-group-items">
              <label className="dc-layer-item">
                <input
                  type="checkbox"
                  checked={layers.networkInfrastructure}
                  onChange={(e) => setLayer('networkInfrastructure', e.target.checked)}
                />
                <span>All Network Cabling</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.coreSpine}
                  onChange={(e) => setLayer('coreSpine', e.target.checked)}
                />
                <span style={{ color: '#c084fc' }}>800G Core Spine Switch</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.cableTrays}
                  onChange={(e) => setLayer('cableTrays', e.target.checked)}
                />
                <span>Overhead Cable Ladders & Trays</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.leafSwitches}
                  onChange={(e) => setLayer('leafSwitches', e.target.checked)}
                />
                <span>Hall Distribution Leaves & ToRs</span>
              </label>
            </div>
          )}
        </div>

        {/* GROUP 4: IT EQUIPMENT & RACKS */}
        <div className="dc-layer-group">
          <div className="dc-group-header" onClick={() => toggleSection('it')}>
            <div className="dc-group-title">
              <Server size={14} style={{ color: '#38bdf8' }} />
              <span>IT Hardware (24 Racks / 144 GPUs)</span>
            </div>
            {collapsedSections.it ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>
          {!collapsedSections.it && (
            <div className="dc-group-items">
              <label className="dc-layer-item">
                <input
                  type="checkbox"
                  checked={layers.racks}
                  onChange={(e) => setLayer('racks', e.target.checked)}
                />
                <span>Server Cabinets (42U)</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.serverChassis}
                  onChange={(e) => setLayer('serverChassis', e.target.checked)}
                />
                <span>4U GPU Server Trays</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.gpus}
                  onChange={(e) => setLayer('gpus', e.target.checked)}
                />
                <span>GPU Cold Plates</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.torSwitches}
                  onChange={(e) => setLayer('torSwitches', e.target.checked)}
                />
                <span>Top-of-Rack Switches</span>
              </label>
            </div>
          )}
        </div>

        {/* GROUP 5: AGMD DESALINATION PLANT */}
        <div className="dc-layer-group">
          <div className="dc-group-header" onClick={() => toggleSection('agmd')}>
            <div className="dc-group-title">
              <Flame size={14} style={{ color: '#06b6d4' }} />
              <span>AGMD Thermal Desalination</span>
            </div>
            {collapsedSections.agmd ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>
          {!collapsedSections.agmd && (
            <div className="dc-group-items">
              <label className="dc-layer-item">
                <input
                  type="checkbox"
                  checked={layers.agmdPlant}
                  onChange={(e) => setLayer('agmdPlant', e.target.checked)}
                />
                <span>AGMD Membrane Cassette</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.feedwaterPiping}
                  onChange={(e) => setLayer('feedwaterPiping', e.target.checked)}
                />
                <span style={{ color: '#10b981' }}>Hot Feedwater Loop (36.5°C)</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.freshwaterTank}
                  onChange={(e) => setLayer('freshwaterTank', e.target.checked)}
                />
                <span style={{ color: '#38bdf8' }}>Freshwater Collection Reservoir</span>
              </label>
              <label className="dc-layer-item indent">
                <input
                  type="checkbox"
                  checked={layers.brineDrain}
                  onChange={(e) => setLayer('brineDrain', e.target.checked)}
                />
                <span style={{ color: '#b45309' }}>Brine Reject Drain</span>
              </label>
            </div>
          )}
        </div>

        {/* GROUP 6: LIVE ANIMATIONS & OVERLAYS */}
        <div className="dc-layer-group">
          <div className="dc-group-header" onClick={() => toggleSection('overlays')}>
            <div className="dc-group-title">
              <Activity size={14} style={{ color: '#22c55e' }} />
              <span>Simulation Visual Effects</span>
            </div>
            {collapsedSections.overlays ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>
          {!collapsedSections.overlays && (
            <div className="dc-group-items">
              <label className="dc-layer-item">
                <input
                  type="checkbox"
                  checked={layers.flowAnimations}
                  onChange={(e) => setLayer('flowAnimations', e.target.checked)}
                />
                <span>Coolant Fluid Pulses</span>
              </label>
              <label className="dc-layer-item">
                <input
                  type="checkbox"
                  checked={layers.powerPulses}
                  onChange={(e) => setLayer('powerPulses', e.target.checked)}
                />
                <span>Electrical Power Pulses</span>
              </label>
              <label className="dc-layer-item">
                <input
                  type="checkbox"
                  checked={layers.networkActivity}
                  onChange={(e) => setLayer('networkActivity', e.target.checked)}
                />
                <span>Network Data Traffic</span>
              </label>
              <label className="dc-layer-item">
                <input
                  type="checkbox"
                  checked={layers.labelsAndAnnotations}
                  onChange={(e) => setLayer('labelsAndAnnotations', e.target.checked)}
                />
                <span>3D Equipment Placards</span>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
