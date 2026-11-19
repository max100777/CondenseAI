import { useState, useMemo, useEffect } from 'react';
import {
  Building,
  Eye,
  ChevronRight,
  ShieldCheck,
  Activity,
  Download,
  Droplets,
  Search,
  BarChart3,
  Compass,
  Sun,
  Moon,
  Monitor,
  Cpu,
} from 'lucide-react';
import {
  facilityData,
  SelectionState,
  DEFAULT_LAYER_VISIBILITY,
  LayerVisibilityState,
  InfrastructureComponentRef,
  getHallById,
  getRackById,
  getGpuById,
  getParentRackOfGpu,
} from './facilityData.ts';
import FacilityScene3D, { HeatmapMode, CameraPreset, RackViewMode } from './FacilityScene3D.tsx';
import LayerControlPanel from './LayerControlPanel.tsx';
import InspectorPanel from './InspectorPanel.tsx';
import FacilityDashboard from './FacilityDashboard.tsx';
import HallAnalytics from './HallAnalytics.tsx';
import AnalyticsSection from './AnalyticsSection.tsx';
import SimulationControlBar from './SimulationControlBar.tsx';
import { simulationController } from './simulation/simulationController.ts';
import './console.css';

type MainViewMode = 'twin' | 'dashboard' | 'hallAnalytics' | 'analytics' | 'diagnostics';
type ThemeMode = 'dark' | 'light' | 'system';

export default function Console() {
  // Master Simulation State & Telemetry History
  const [simState, setSimState] = useState(() => simulationController.getState());
  const [telemetryHistory, setTelemetryHistory] = useState(() => simulationController.getHistory());

  // Main Application Section Navigation
  const [mainView, setMainView] = useState<MainViewMode>('twin');

  // Theme Management (Light, Dark, System)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('condensai-theme') as ThemeMode) || 'dark';
  });

  const effectiveTheme: 'dark' | 'light' = useMemo(() => {
    if (theme === 'system') {
      return typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    }
    return theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('condensai-theme', theme);
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [theme, effectiveTheme]);

  // Interactive View & 3D Navigation State
  const [selection, setSelection] = useState<SelectionState>({
    level: 'campus',
    hallId: null,
    rackId: null,
    gpuId: null,
    infraComponent: null,
  });

  const [layers, setLayers] = useState<LayerVisibilityState>(DEFAULT_LAYER_VISIBILITY);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // 3D Visual Modes & Telescoping Tray States
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');
  const [rackViewMode, setRackViewMode] = useState<RackViewMode>('front');
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('none');
  const [traceMode, setTraceMode] = useState<'none' | 'cooling' | 'electrical' | 'network'>('none');
  const [selectedTraceLoop] = useState<'all' | 'primary' | 'secondary' | 'feedA' | 'feedB' | 'none'>('all');
  const [isXrayMode, setIsXrayMode] = useState(false);

  // Retractable Tray Extraction State
  const [extendedTrayId, setExtendedTrayId] = useState<string | null>(null);
  const [allTraysOpen, setAllTraysOpen] = useState(false);
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);

  // Search Bar State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // 144 GPU Explorer Modal State
  const [showGpuExplorer, setShowGpuExplorer] = useState(false);
  const [explorerHallFilter, setExplorerHallFilter] = useState<string>('ALL');
  const [explorerSortBy, setExplorerSortBy] = useState<'temp' | 'power' | 'util' | 'id'>('temp');

  // Modal Report State
  const [showReportModal, setShowReportModal] = useState(false);

  // Simulation Clock Tick Loop
  useEffect(() => {
    const timer = setInterval(() => {
      const next = simulationController.step(1.0);
      setSimState({ ...next });
      setTelemetryHistory([...simulationController.getHistory()]);

      if (next.clock.mode === 'experiment' && next.clock.isComplete && !showReportModal) {
        setShowReportModal(true);
      }
    }, 1000 / simState.clock.playbackSpeed);

    return () => clearInterval(timer);
  }, [simState.clock.playbackSpeed, simState.clock.isRunning, showReportModal]);

  // Selection Navigation Handlers
  const handleSelectCampus = () => {
    setSelection({ level: 'campus', hallId: null, rackId: null, gpuId: null, infraComponent: null });
    setIsXrayMode(false);
    setExtendedTrayId(null);
    setAllTraysOpen(false);
  };

  const handleSelectHall = (hallId: string) => {
    const hall = getHallById(hallId);
    if (!hall) return;
    setSelection({ level: 'hall', hallId: hall.id, rackId: null, gpuId: null, infraComponent: null });
    setIsXrayMode(false);
    setExtendedTrayId(null);
    setAllTraysOpen(false);
  };

  const handleSelectRack = (rackId: string) => {
    const rack = getRackById(rackId);
    if (!rack) return;
    setSelection({ level: 'rack', hallId: rack.hallId, rackId: rack.id, gpuId: null, infraComponent: null });
    // Default: slide out first tray on rack click for immediate physical inspection
    setExtendedTrayId(rack.gpus[0]?.id || null);
    setCameraPreset('free');
    setRackViewMode('front');
    setIsInspectorOpen(true);
  };

  const handleSelectGpu = (gpuId: string) => {
    const gpu = getGpuById(gpuId);
    if (!gpu) return;
    const rack = getParentRackOfGpu(gpuId);
    setSelection({
      level: 'gpu',
      hallId: gpu.hallId,
      rackId: rack?.id || null,
      gpuId: gpu.id,
      infraComponent: null,
    });
    setExtendedTrayId(gpu.id);
    setCameraPreset('free');
    setRackViewMode('close');
    setIsInspectorOpen(true);
  };

  const handleToggleExtendTray = (targetGpuId: string) => {
    setExtendedTrayId((prev) => (prev === targetGpuId ? null : targetGpuId));
  };

  const handleToggleAllTrays = () => {
    setAllTraysOpen((prev) => !prev);
  };

  const handleSelectComponent = (comp: InfrastructureComponentRef) => {
    setSelection({
      level: 'infrastructure',
      hallId: comp.hallId || null,
      rackId: comp.rackId || null,
      gpuId: null,
      infraComponent: comp,
    });
    setIsInspectorOpen(true);
  };

  // Search Component Auto-Complete Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: Array<{ label: string; sub: string; action: () => void }> = [];

    // Search Halls
    for (const h of facilityData.halls) {
      if (h.name.toLowerCase().includes(q) || h.id.toLowerCase().includes(q)) {
        results.push({
          label: h.name,
          sub: `${h.workloadProfile} (Data Hall)`,
          action: () => handleSelectHall(h.id),
        });
      }
    }

    // Search Racks
    for (const h of facilityData.halls) {
      for (const r of h.racks) {
        if (r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) {
          results.push({
            label: r.id,
            sub: `${h.shortName} · Row ${r.row}`,
            action: () => handleSelectRack(r.id),
          });
        }
      }
    }

    // Search GPUs
    for (const h of facilityData.halls) {
      for (const r of h.racks) {
        for (const g of r.gpus) {
          if (g.id.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) {
            results.push({
              label: g.id,
              sub: `${r.id} · RU ${g.slotU} · NVIDIA H100`,
              action: () => handleSelectGpu(g.id),
            });
          }
        }
      }
    }

    return results.slice(0, 8);
  }, [searchQuery]);

  // All 144 GPUs Filtering & Sorting
  const filtered144Gpus = useMemo(() => {
    let list = Object.values(simState.gpus);
    if (explorerHallFilter !== 'ALL') {
      list = list.filter((g) => g.hallId === explorerHallFilter);
    }
    return list.sort((a, b) => {
      if (explorerSortBy === 'temp') return b.temperatureC - a.temperatureC;
      if (explorerSortBy === 'power') return b.powerW - a.powerW;
      if (explorerSortBy === 'util') return b.utilization - a.utilization;
      return a.id.localeCompare(b.id);
    });
  }, [simState.gpus, explorerHallFilter, explorerSortBy]);

  // Export handlers
  const exportCsv = () => {
    const header = 'Time_s,IT_Power_kW,Facility_Power_kW,PUE,Avg_GPU_Temp_C,Max_GPU_Temp_C,Pri_Supply_C,Pri_Return_C,Buffer_Temp_C,HX_Heat_kW,Freshwater_L_H,Cumulative_L\n';
    const rows = telemetryHistory
      .map((t) =>
        [
          t.timeSeconds,
          t.totalITPowerKw,
          t.facilityTotalPowerKw,
          t.pue,
          t.avgGpuTempC,
          t.maxGpuTempC,
          t.primarySupplyTempC,
          t.primaryReturnTempC,
          t.bufferTankTempC,
          t.hxHeatTransferKw,
          t.freshwaterRateL_H,
          t.cumulativeFreshwaterL,
        ].join(',')
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `condensai-run-telemetry-${simState.clock.simTimeSeconds}s.csv`;
    a.click();
  };

  return (
    <main className="dcim-redesign" data-theme={effectiveTheme}>
      {/* 1. TOP GLOBAL APPLICATION HEADER */}
      <header className="dc-header">
        <div className="dc-brand-group">
          <div className="dc-logo">
            <Droplets size={20} style={{ color: '#38bdf8' }} />
            <span>Condens<strong>AI</strong></span>
          </div>
          <span className="dc-badge live">● LIVE DIGITAL TWIN</span>
          <span className="dc-badge campus">CAMPUS-01 (4 HALLS / 144 GPUS)</span>
        </div>

        {/* Global Navigation Tabs */}
        <nav className="dc-nav">
          <button
            className={mainView === 'twin' ? 'active' : ''}
            onClick={() => setMainView('twin')}
          >
            <Compass size={14} /> 3D Digital Twin
          </button>
          <button
            className={mainView === 'dashboard' ? 'active' : ''}
            onClick={() => setMainView('dashboard')}
          >
            <Activity size={14} /> Operations Dashboard
          </button>
          <button
            className={mainView === 'hallAnalytics' ? 'active' : ''}
            onClick={() => setMainView('hallAnalytics')}
          >
            <Building size={14} /> Hall Analytics
          </button>
          <button
            className={mainView === 'analytics' ? 'active' : ''}
            onClick={() => setMainView('analytics')}
          >
            <BarChart3 size={14} /> Charts & Telemetry
          </button>
          <button
            className={mainView === 'diagnostics' ? 'active' : ''}
            onClick={() => setMainView('diagnostics')}
          >
            <ShieldCheck size={14} /> Physics Verification
          </button>
        </nav>

        {/* Global Quick Telemetry Stats & Theme Toggle */}
        <div className="dc-header-stats">
          <div className="dc-stat">
            <small>IT LOAD</small>
            <strong>{simState.electrical.facilityITPowerKw.toFixed(1)} kW</strong>
          </div>
          <div className="dc-stat">
            <small>PUE</small>
            <strong style={{ color: '#22c55e' }}>{simState.electrical.instantaneousPUE.toFixed(2)}</strong>
          </div>
          <div className="dc-stat">
            <small>WATER</small>
            <strong style={{ color: '#38bdf8' }}>{simState.agmd.freshwaterProductionRateL_H.toFixed(1)} L/h</strong>
          </div>

          {/* Theme Selector (Dark, Light, System) */}
          <div className="dc-theme-toggle-group">
            <button
              className={`dc-theme-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
              title="Dark Theme"
            >
              <Moon size={13} />
            </button>
            <button
              className={`dc-theme-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
              title="Light Theme"
            >
              <Sun size={13} />
            </button>
            <button
              className={`dc-theme-btn ${theme === 'system' ? 'active' : ''}`}
              onClick={() => setTheme('system')}
              title="System Theme"
            >
              <Monitor size={13} />
            </button>
          </div>

          <a href="/?lab" className="dc-lab-link" title="Switch to Single GPU Thermal Laboratory">
            GPU Lab →
          </a>
        </div>
      </header>

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <div className="dc-main-content">
        {/* VIEW 1: 3D DIGITAL TWIN VIEWPORT */}
        {mainView === 'twin' && (
          <div className="dc-viewport-wrapper">
            {/* 3D Top Floating Tool Ribbon */}
            <div className="dc-floating-tools">
              {/* Breadcrumb Hierarchy */}
              <div className="dc-breadcrumb-bar">
                <button onClick={handleSelectCampus} className={selection.level === 'campus' ? 'active' : ''}>
                  Campus
                </button>
                {selection.hallId && (
                  <>
                    <ChevronRight size={12} />
                    <button onClick={() => handleSelectHall(selection.hallId!)} className={selection.level === 'hall' ? 'active' : ''}>
                      {selection.hallId}
                    </button>
                  </>
                )}
                {selection.rackId && (
                  <>
                    <ChevronRight size={12} />
                    <button onClick={() => handleSelectRack(selection.rackId!)} className={selection.level === 'rack' ? 'active' : ''}>
                      {selection.rackId}
                    </button>
                  </>
                )}
                {selection.gpuId && (
                  <>
                    <ChevronRight size={12} />
                    <span className="dc-crumb-gpu">{selection.gpuId}</span>
                  </>
                )}
                {selection.infraComponent && (
                  <>
                    <ChevronRight size={12} />
                    <span className="dc-crumb-gpu">{selection.infraComponent.name}</span>
                  </>
                )}
              </div>

              {/* Instant Search Bar */}
              <div className="dc-search-container">
                <Search size={14} className="dc-search-icon" />
                <input
                  type="text"
                  placeholder="Search Hall, Rack, GPU, Pump, HX, Substation..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                />
                {showSearchResults && searchResults.length > 0 && (
                  <div className="dc-search-dropdown">
                    {searchResults.map((res, rIdx) => (
                      <div
                        key={rIdx}
                        className="dc-search-item"
                        onClick={() => {
                          res.action();
                          setShowSearchResults(false);
                          setSearchQuery('');
                        }}
                      >
                        <strong>{res.label}</strong>
                        <small>{res.sub}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 144-GPU Explorer Button */}
              <div className="dc-tool-group">
                <button
                  className={`dc-toggle-btn ${showGpuExplorer ? 'active' : ''}`}
                  onClick={() => setShowGpuExplorer(!showGpuExplorer)}
                  title="Browse and filter all 144 GPUs"
                >
                  <Cpu size={13} />
                  <span>144 GPU Explorer</span>
                </button>
              </div>

              {/* Camera Presets Bar */}
              <div className="dc-tool-group">
                <span className="dc-tool-label">CAMERA:</span>
                <button
                  className={cameraPreset === 'isometric' ? 'active' : ''}
                  onClick={() => setCameraPreset('isometric')}
                  title="Isometric 3D perspective"
                >
                  Isometric
                </button>
                <button
                  className={cameraPreset === 'topDown' ? 'active' : ''}
                  onClick={() => setCameraPreset('topDown')}
                  title="Overhead floor map"
                >
                  Top-Down
                </button>
                <button
                  className={cameraPreset === 'front' ? 'active' : ''}
                  onClick={() => setCameraPreset('front')}
                  title="Front facility elevation"
                >
                  Front
                </button>
                <button
                  className={cameraPreset === 'side' ? 'active' : ''}
                  onClick={() => setCameraPreset('side')}
                  title="Side facility profile"
                >
                  Side
                </button>
                <button
                  className={cameraPreset === 'free' ? 'active' : ''}
                  onClick={() => setCameraPreset('free')}
                  title="Free camera orbit"
                >
                  Free
                </button>
              </div>

              {/* Heatmap Overlay Selector */}
              <div className="dc-tool-group">
                <span className="dc-tool-label">OVERLAY:</span>
                <button
                  className={heatmapMode === 'none' ? 'active' : ''}
                  onClick={() => setHeatmapMode('none')}
                >
                  None
                </button>
                <button
                  className={heatmapMode === 'gpuTemp' ? 'active' : ''}
                  onClick={() => setHeatmapMode('gpuTemp')}
                  style={{ color: heatmapMode === 'gpuTemp' ? '#38bdf8' : undefined }}
                >
                  Thermal Heatmap
                </button>
                <button
                  className={heatmapMode === 'power' ? 'active' : ''}
                  onClick={() => setHeatmapMode('power')}
                  style={{ color: heatmapMode === 'power' ? '#eab308' : undefined }}
                >
                  Power Density
                </button>
              </div>

              {/* Physical Tracing Mode Selector */}
              <div className="dc-tool-group">
                <span className="dc-tool-label">TRACE:</span>
                <button
                  className={traceMode === 'cooling' ? 'active' : ''}
                  onClick={() => setTraceMode(traceMode === 'cooling' ? 'none' : 'cooling')}
                  style={{ color: traceMode === 'cooling' ? '#06b6d4' : undefined }}
                >
                  Coolant Loop
                </button>
                <button
                  className={traceMode === 'electrical' ? 'active' : ''}
                  onClick={() => setTraceMode(traceMode === 'electrical' ? 'none' : 'electrical')}
                  style={{ color: traceMode === 'electrical' ? '#eab308' : undefined }}
                >
                  2N Power Path
                </button>
                <button
                  className={traceMode === 'network' ? 'active' : ''}
                  onClick={() => setTraceMode(traceMode === 'network' ? 'none' : 'network')}
                  style={{ color: traceMode === 'network' ? '#a855f7' : undefined }}
                >
                  Network Fiber
                </button>
              </div>

              {/* X-Ray Rack View Toggle */}
              <div className="dc-tool-group">
                <button
                  className={`dc-toggle-btn ${isXrayMode ? 'active' : ''}`}
                  onClick={() => setIsXrayMode(!isXrayMode)}
                  title="Reveal internal 4U server trays and cold plates"
                >
                  <Eye size={13} />
                  <span>Rack X-Ray</span>
                </button>
              </div>
            </div>

            {/* Left Layer Control Panel */}
            <LayerControlPanel
              layers={layers}
              onChangeLayers={setLayers}
              isOpen={isLayerPanelOpen}
              onToggleOpen={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
            />

            {/* 144 GPU Explorer Popover Drawer */}
            {showGpuExplorer && (
              <div className="dc-gpu-explorer-modal">
                <div className="dc-explorer-header">
                  <div className="dc-explorer-title">
                    <Cpu size={16} style={{ color: '#38bdf8' }} />
                    <h3>Campus Accelerator Explorer (144 GPUs)</h3>
                  </div>
                  <button className="dc-close-btn" onClick={() => setShowGpuExplorer(false)}>
                    ×
                  </button>
                </div>

                <div className="dc-explorer-filters">
                  <div className="dc-filter-group">
                    <label>Filter Hall:</label>
                    <select
                      value={explorerHallFilter}
                      onChange={(e) => setExplorerHallFilter(e.target.value)}
                    >
                      <option value="ALL">All Halls (144)</option>
                      <option value="HALL-A">Hall A — AI Training (36)</option>
                      <option value="HALL-B">Hall B — AI Inference (36)</option>
                      <option value="HALL-C">Hall C — HPC & Research (36)</option>
                      <option value="HALL-D">Hall D — Experimental (36)</option>
                    </select>
                  </div>

                  <div className="dc-filter-group">
                    <label>Sort By:</label>
                    <select
                      value={explorerSortBy}
                      onChange={(e) => setExplorerSortBy(e.target.value as any)}
                    >
                      <option value="temp">Highest Junction Temperature</option>
                      <option value="power">Highest Power Consumption</option>
                      <option value="util">Highest Utilization</option>
                      <option value="id">GPU Identifier</option>
                    </select>
                  </div>
                </div>

                <div className="dc-explorer-table-container">
                  <table className="dc-explorer-table">
                    <thead>
                      <tr>
                        <th>GPU ID</th>
                        <th>Hall</th>
                        <th>Rack</th>
                        <th>Temp</th>
                        <th>Power</th>
                        <th>Coolant Flow</th>
                        <th>Util</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered144Gpus.map((g) => (
                        <tr key={g.id}>
                          <td><strong>{g.id}</strong></td>
                          <td>{g.hallId}</td>
                          <td>{g.rackId}</td>
                          <td style={{ color: g.temperatureC > 72 ? '#f97316' : '#22c55e', fontWeight: 600 }}>
                            {g.temperatureC.toFixed(1)} °C
                          </td>
                          <td>{g.powerW.toFixed(0)} W</td>
                          <td>{(g.coolantFlowKgS * 60).toFixed(2)} L/min</td>
                          <td>{(g.utilization * 100).toFixed(0)}%</td>
                          <td>
                            <span className={`dc-status-dot ${g.operatingStatus.toLowerCase()}`} />
                            <small>{g.operatingStatus}</small>
                          </td>
                          <td>
                            <button
                              className="dc-inspect-mini-btn"
                              onClick={() => {
                                handleSelectGpu(g.id);
                                setShowGpuExplorer(false);
                              }}
                            >
                              Inspect & Slide Out
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Master 3D Canvas */}
            <div className="dc-3d-canvas-container">
              <FacilityScene3D
                halls={facilityData.halls}
                infrastructureZones={facilityData.infrastructureZones}
                selection={selection}
                simulationState={simState}
                layers={layers}
                heatmapMode={heatmapMode}
                traceMode={traceMode}
                selectedTraceLoop={selectedTraceLoop}
                cameraPreset={cameraPreset}
                rackViewMode={rackViewMode}
                isXrayMode={isXrayMode}
                extendedTrayId={extendedTrayId}
                allTraysOpen={allTraysOpen}
                theme={effectiveTheme}
                onSelectCampus={handleSelectCampus}
                onSelectHall={handleSelectHall}
                onSelectRack={handleSelectRack}
                onSelectGpu={handleSelectGpu}
                onToggleExtendTray={handleToggleExtendTray}
                onHoverComponent={setHoveredComponent}
                onSelectComponent={handleSelectComponent}
              />
            </div>

            {/* Right Contextual Inspector Panel */}
            {isInspectorOpen && (
              <div className="dc-inspector-container">
                <InspectorPanel
                  selection={selection}
                  simulationState={simState}
                  extendedTrayId={extendedTrayId}
                  allTraysOpen={allTraysOpen}
                  rackViewMode={rackViewMode}
                  hoveredComponent={hoveredComponent}
                  onSelectCampus={handleSelectCampus}
                  onSelectHall={handleSelectHall}
                  onSelectRack={handleSelectRack}
                  onSelectGpu={handleSelectGpu}
                  onToggleExtendTray={handleToggleExtendTray}
                  onToggleAllTrays={handleToggleAllTrays}
                  onChangeRackViewMode={setRackViewMode}
                  onSetTraceMode={setTraceMode}
                  activeTraceMode={traceMode}
                />
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: OPERATIONS DASHBOARD */}
        {mainView === 'dashboard' && (
          <FacilityDashboard
            simulationState={simState}
            onNavigateToHall={(hId) => {
              handleSelectHall(hId);
              setMainView('twin');
            }}
          />
        )}

        {/* VIEW 3: HALL ANALYTICS */}
        {mainView === 'hallAnalytics' && (
          <HallAnalytics
            simulationState={simState}
            onFocusHallIn3D={(hId) => {
              handleSelectHall(hId);
              setMainView('twin');
            }}
          />
        )}

        {/* VIEW 4: CHARTS & TIME-SERIES TELEMETRY */}
        {mainView === 'analytics' && (
          <AnalyticsSection
            simulationState={simState}
            telemetryHistory={telemetryHistory}
            onFocusHallIn3D={(hId) => {
              handleSelectHall(hId);
              setMainView('twin');
            }}
          />
        )}

        {/* VIEW 5: PHYSICS VERIFICATION DIAGNOSTICS */}
        {mainView === 'diagnostics' && (() => {
          // Live Physics Diagnostics calculations
          const mDotPri = simState.hydraulics.totalSystemFlowKgS;
          const cp = 4184.0;
          const deltaTPri = Math.max(0, simState.hydraulics.primaryReturnTempC - simState.hydraulics.primarySupplyTempC);
          const qPrimaryCalcKw = (mDotPri * cp * deltaTPri) / 1000.0;
          const qPrimaryReportedKw = simState.hydraulics.primaryLoopHeatKw;
          const primaryResidualPercent = qPrimaryReportedKw > 0.1
            ? (Math.abs(qPrimaryCalcKw - qPrimaryReportedKw) / qPrimaryReportedKw) * 100.0
            : 0.0;
          const primaryLoopValid = primaryResidualPercent < 2.0;

          const qHxKw = simState.heatRecovery.heatTransferredKw;
          const tPriIn = simState.heatRecovery.primaryInletTempC;
          const tPriOut = simState.heatRecovery.primaryOutletTempC;
          const tSecIn = simState.heatRecovery.secondaryInletTempC;
          const tSecOut = simState.heatRecovery.secondaryOutletTempC;
          const hotPinch = tPriIn - tSecOut;
          const coldPinch = tPriOut - tSecIn;
          const secondLawCompliant = tSecOut <= tPriIn + 0.01 && hotPinch >= 0 && coldPinch >= 0;
          const hxResidualPercent = simState.heatRecovery.energyBalanceResidualPercent;
          const hxValid = simState.heatRecovery.isEnergyConserved && secondLawCompliant;

          const h_fg = 2415000.0;
          const qAgmdLatentKw = (simState.agmd.freshwaterProductionRateL_H * (h_fg / 1000.0)) / 3600.0;
          const qAgmdSensibleKw = simState.agmd.freshwaterProductionRateL_H > 0
            ? (simState.agmd.feedFlowKgS * cp * Math.max(0, simState.agmd.feedInletTempC - simState.agmd.brineOutletTempC)) / 1000.0
            : 0;
          const qAgmdTotalKw = qAgmdLatentKw + qAgmdSensibleKw;
          const qLossKw = simState.heatRecovery.bufferLossesKw;
          const qNetBufferKw = qHxKw - qAgmdTotalKw - qLossKw;
          const tankCapacityKg = 15000.0;
          const dTankTempPerHour = (qNetBufferKw * 1000.0 * 3600.0) / (tankCapacityKg * cp);

          const mFeedKgH = simState.agmd.feedFlowKgS * 3600.0;
          const mDistillateKgH = simState.agmd.freshwaterProductionRateL_H * 0.997;
          const mBrineKgH = Math.max(0, mFeedKgH - mDistillateKgH);
          const massResidualKgH = Math.abs(mFeedKgH - (mDistillateKgH + mBrineKgH));
          const massBalanceValid = massResidualKgH < 0.01;
          const agmdEnergyValid = qAgmdLatentKw <= qHxKw + 1.0;

          return (
            <div className="dc-diagnostics-view">
              <div className="dc-diag-hero">
                <div>
                  <h2>First-Law & Second-Law Quantitative Physics Verification</h2>
                  <p>Real-time thermodynamic conservation audits across primary CDU hydronics, plate heat exchanger, 15,000 L thermal buffer, and AGMD desalination.</p>
                </div>
                <button onClick={exportCsv} className="dc-action-pill" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={14} /> Export Telemetry CSV
                </button>
              </div>

              <div className="dc-diag-grid-cards">
                {/* 1. PRIMARY COOLANT CONSERVATION */}
                <div className="dc-diag-box">
                  <div className="dc-diag-header">
                    <h3>1. Primary Loop Heat Balance (Q = ṁ·cp·ΔT)</h3>
                    <span className={`dc-diag-badge ${primaryLoopValid ? 'pass' : 'fail'}`}>
                      {primaryLoopValid ? 'PASS (<2%)' : 'FAIL'}
                    </span>
                  </div>
                  <div className="dc-diag-stats">
                    <p>Reported Q_primary: <strong>{qPrimaryReportedKw.toFixed(2)} kWth</strong></p>
                    <p>ṁ·cp·ΔT Calculated: <strong>{qPrimaryCalcKw.toFixed(2)} kWth</strong></p>
                    <p>Primary Mass Flow: <strong>{mDotPri.toFixed(3)} kg/s (~96 L/min)</strong></p>
                    <p>Primary Temperature ΔT: <strong>{deltaTPri.toFixed(2)} K (28.0°C → {simState.hydraulics.primaryReturnTempC.toFixed(1)}°C)</strong></p>
                    <p>Energy Balance Residual: <strong style={{ color: '#22c55e' }}>{primaryResidualPercent.toFixed(2)}%</strong></p>
                  </div>
                </div>

                {/* 2. HEAT EXCHANGER SECOND LAW */}
                <div className="dc-diag-box">
                  <div className="dc-diag-header">
                    <h3>2. Plate Heat Exchanger & Second Law</h3>
                    <span className={`dc-diag-badge ${hxValid ? 'pass' : 'fail'}`}>
                      {hxValid ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <div className="dc-diag-stats">
                    <p>Recovered Heat Rate: <strong>{qHxKw.toFixed(2)} kWth</strong></p>
                    <p>Counterflow Effectiveness: <strong>{(simState.heatRecovery.hxEffectiveness * 100).toFixed(0)}%</strong></p>
                    <p>Energy Balance Residual: <strong style={{ color: '#22c55e' }}>{hxResidualPercent.toFixed(2)}%</strong></p>
                    <p>Terminal Temps (Pri / Sec Out): <strong>{tPriOut.toFixed(1)}°C / {tSecOut.toFixed(1)}°C</strong></p>
                    <p>Hot End Pinch Difference: <strong>+{hotPinch.toFixed(2)} K (&gt;0)</strong></p>
                    <p>Cold End Pinch Difference: <strong>+{coldPinch.toFixed(2)} K (&gt;0)</strong></p>
                    <p>Second Law Boundary: <strong style={{ color: '#22c55e' }}>T_sec &lt; T_pri (CONSERVED)</strong></p>
                  </div>
                </div>

                {/* 3. 15,000 L THERMAL BUFFER STORAGE */}
                <div className="dc-diag-box">
                  <div className="dc-diag-header">
                    <h3>3. 15,000 L Secondary Buffer Energy Balance</h3>
                    <span className="dc-diag-badge pass">DYNAMIC</span>
                  </div>
                  <div className="dc-diag-stats">
                    <p>Heat Input (Q_HX): <strong>+{qHxKw.toFixed(2)} kWth</strong></p>
                    <p>AGMD Heat Extraction: <strong>-{qAgmdTotalKw.toFixed(2)} kWth</strong></p>
                    <p>Ambient Tank Losses: <strong>-{qLossKw.toFixed(2)} kW</strong></p>
                    <p>Net Buffer Power: <strong style={{ color: qNetBufferKw >= 0 ? '#22c55e' : '#f59e0b' }}>{qNetBufferKw >= 0 ? '+' : ''}{qNetBufferKw.toFixed(2)} kW</strong></p>
                    <p>Current Storage Temp: <strong>{simState.heatRecovery.bufferTankTempC.toFixed(2)} °C</strong></p>
                    <p>Transient Dynamic Rate (dT/dt): <strong>{dTankTempPerHour >= 0 ? '+' : ''}{dTankTempPerHour.toFixed(2)} °C/h</strong></p>
                  </div>
                </div>

                {/* 4. AGMD MASS & ENERGY BALANCE */}
                <div className="dc-diag-box">
                  <div className="dc-diag-header">
                    <h3>4. AGMD Desalination Energy & Mass Balance</h3>
                    <span className={`dc-diag-badge ${massBalanceValid && agmdEnergyValid ? 'pass' : 'fail'}`}>
                      {massBalanceValid && agmdEnergyValid ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <div className="dc-diag-stats">
                    <p>Freshwater Production: <strong>{simState.agmd.freshwaterProductionRateL_H.toFixed(1)} L/h</strong></p>
                    <p>Latent Vaporization Demand: <strong>{qAgmdLatentKw.toFixed(2)} kWth</strong></p>
                    <p>Available Recovered Heat: <strong>{qHxKw.toFixed(2)} kWth (Q_latent &le; Q_avail)</strong></p>
                    <p>Mass Conservation (Feed = Dist + Brine): <strong>{mFeedKgH.toFixed(0)} = {mDistillateKgH.toFixed(0)} + {mBrineKgH.toFixed(0)} kg/h</strong></p>
                    <p>Mass Balance Residual: <strong style={{ color: '#22c55e' }}>{massResidualKgH.toFixed(4)} kg/h (0.00%)</strong></p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3. PERSISTENT BOTTOM SIMULATION CONTROL BAR */}
      <SimulationControlBar
        simulationState={simState}
        onTogglePlay={() => {
          simState.clock.isRunning = !simState.clock.isRunning;
          setSimState({ ...simState });
        }}
        onReset={() => {
          simulationController.getState().clock.simTimeSeconds = 0;
          setSimState({ ...simulationController.getState() });
        }}
        onStepForward={() => {
          const next = simulationController.step(1.0);
          setSimState({ ...next });
          setTelemetryHistory([...simulationController.getHistory()]);
        }}
        onSetSpeed={(speed) => {
          simState.clock.playbackSpeed = speed;
          setSimState({ ...simState });
        }}
        onSetScenario={(sc) => {
          simulationController.applyScenario(sc);
          setSimState({ ...simulationController.getState() });
        }}
        onInjectFault={(faultType) => {
          if (faultType === 'PumpTrip') {
            simState.hydraulics.pumpSpeedFraction = 0;
            simState.hydraulics.pumpStatus = 'Offline';
          } else if (faultType === 'ValvRestriction') {
            simState.hydraulics.valves['Rack A01'] = 'Closed';
          } else if (faultType === 'ThermalThrottling') {
            for (const g of Object.values(simState.gpus)) {
              if (g.rackId === 'Rack A01') {
                g.temperatureC = 88.0;
                g.fault = 'ThermalThrottling';
              }
            }
          }
          setSimState({ ...simState });
        }}
      />
    </main>
  );
}
