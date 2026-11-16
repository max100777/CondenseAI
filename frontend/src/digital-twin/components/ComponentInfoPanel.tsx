import React from 'react';
import { X, ShieldCheck, Activity, Cpu, RefreshCw, Database, Droplets } from 'lucide-react';
import { ComponentType, TelemetryState } from '../types';

interface Props {
  selectedComponent: ComponentType | null;
  onClose: () => void;
  telemetry: TelemetryState;
}

export const ComponentInfoPanel: React.FC<Props> = ({
  selectedComponent,
  onClose,
  telemetry,
}) => {
  if (!selectedComponent) return null;

  const renderContent = () => {
    switch (selectedComponent) {
      case 'gpu':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
              <Cpu className="w-4 h-4" />
              <span>Multi-GPU Compute Rack</span>
            </div>
            <p className="text-xs text-slate-300">
              Lumped-capacitance transient thermal model simulating GPU die heat generation and
              microchannel cold plate thermal transfer to the primary liquid coolant loop.
            </p>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Telemetry Readout
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-400">Total Power</div>
                  <div className="text-white font-mono font-medium">{telemetry.gpuTotalPowerW.toFixed(0)} W</div>
                </div>
                <div>
                  <div className="text-slate-400">Heat to Coolant</div>
                  <div className="text-amber-400 font-mono font-medium">{telemetry.gpuHeatToCoolantW.toFixed(0)} W</div>
                </div>
                <div>
                  <div className="text-slate-400">Coolant Inflow</div>
                  <div className="text-blue-300 font-mono font-medium">{telemetry.primaryInletTempC.toFixed(1)} °C</div>
                </div>
                <div>
                  <div className="text-slate-400">Coolant Outflow</div>
                  <div className="text-red-400 font-mono font-medium">{telemetry.primaryOutletTempC.toFixed(1)} °C</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Per-Die Temperatures
              </div>
              <div className="grid grid-cols-2 gap-2">
                {telemetry.gpuTemperatures.map((temp, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-900/60 px-2 py-1.5 rounded text-xs">
                    <span className="text-slate-400">GPU {i + 1}</span>
                    <span className="text-white font-mono font-semibold">{temp.toFixed(1)} °C</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded border border-slate-800">
              <div className="text-slate-300 font-medium mb-1">Governing Physics</div>
              <code className="text-cyan-300 block font-mono">C_th * (dT/dt) = P_elec - Q_coolant</code>
              <div className="mt-1 text-[10px] text-slate-400">
                Primary and secondary loops are physically isolated. Coolant never touches secondary saline water.
              </div>
            </div>
          </div>
        );

      case 'hx':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
              <RefreshCw className="w-4 h-4" />
              <span>Counterflow Plate Heat Exchanger</span>
            </div>
            <p className="text-xs text-slate-300">
              High-efficiency countercurrent plate heat exchanger transferring thermal energy from the primary GPU loop
              to the secondary water distillation circuit using the Effectiveness–NTU method.
            </p>

            <div className="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/50 flex items-center gap-2 text-xs text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Strict physical boundary: Primary and secondary fluids never mix.</span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Heat Exchanger Performance
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-400">Heat Transferred</div>
                  <div className="text-amber-400 font-mono font-medium">{telemetry.hxHeatTransferredW.toFixed(0)} W</div>
                </div>
                <div>
                  <div className="text-slate-400">Effectiveness (ε)</div>
                  <div className="text-cyan-300 font-mono font-medium">{(telemetry.hxEffectiveness * 100).toFixed(1)} %</div>
                </div>
                <div>
                  <div className="text-slate-400">Primary In / Out</div>
                  <div className="text-white font-mono font-medium">
                    {telemetry.primaryOutletTempC.toFixed(1)} → {telemetry.primaryInletTempC.toFixed(1)} °C
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Secondary In / Out</div>
                  <div className="text-white font-mono font-medium">
                    {telemetry.reservoirTempC.toFixed(1)} → {telemetry.secondaryOutletTempC.toFixed(1)} °C
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded border border-slate-800">
              <div className="text-slate-300 font-medium mb-1">Governing Equations</div>
              <code className="text-cyan-300 block font-mono">ε = (1 - exp(-NTU*(1 - C_r))) / (1 - C_r*exp(-NTU*(1 - C_r)))</code>
              <code className="text-cyan-300 block font-mono mt-0.5">Q_hx = ε * C_min * (T_h_in - T_c_in)</code>
            </div>
          </div>
        );

      case 'reservoir':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
              <Database className="w-4 h-4" />
              <span>Thermal Storage Reservoir</span>
            </div>
            <p className="text-xs text-slate-300">
              Well-mixed insulated saline water reservoir buffering recovered heat. Acts as the thermal capacitor
              feeding hot water to the AGMD desalination stage.
            </p>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Reservoir State
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-400">Reservoir Temp (T_s)</div>
                  <div className="text-amber-400 font-mono font-medium">{telemetry.reservoirTempC.toFixed(1)} °C</div>
                </div>
                <div>
                  <div className="text-slate-400">Minimum Floor</div>
                  <div className="text-blue-400 font-mono font-medium">20.0 °C</div>
                </div>
                <div>
                  <div className="text-slate-400">Heat to AGMD</div>
                  <div className="text-cyan-300 font-mono font-medium">{telemetry.agmdHeatExtractedW.toFixed(0)} W</div>
                </div>
                <div>
                  <div className="text-slate-400">Ambient Loss</div>
                  <div className="text-slate-300 font-mono font-medium">{telemetry.ambientLossW.toFixed(1)} W</div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded border border-slate-800">
              <div className="text-slate-300 font-medium mb-1">Thermal Integration</div>
              <code className="text-cyan-300 block font-mono">m_s*c_p*(dT_s/dt) = Q_HX - Q_AGMD - Q_loss</code>
              <div className="mt-1 text-[10px] text-slate-400">
                AGMD cannot extract thermal energy if T_s ≤ 20°C (ambient safety clamp).
              </div>
            </div>
          </div>
        );

      case 'agmd':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
              <Activity className="w-4 h-4" />
              <span>AGMD Desalination Module</span>
            </div>
            <p className="text-xs text-slate-300">
              Air-Gap Membrane Distillation unit. Hot saline feed vaporizes through a hydrophobic microporous
              PTFE membrane across a stagnant air gap and condenses on a cold plate.
            </p>

            {telemetry.agmdThrottled && (
              <div className="bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/50 text-xs text-amber-300">
                ⚠️ <b>Power Throttled:</b> Heat demand exceeds available thermal power from secondary loop.
              </div>
            )}

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Membrane Interface Telemetry
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-400">Feed Temp (T_feed)</div>
                  <div className="text-amber-400 font-mono font-medium">{telemetry.agmdFeedTempC.toFixed(1)} °C</div>
                </div>
                <div>
                  <div className="text-slate-400">Cold Plate Temp</div>
                  <div className="text-blue-400 font-mono font-medium">{telemetry.agmdColdPlateTempC.toFixed(1)} °C</div>
                </div>
                <div>
                  <div className="text-slate-400">Membrane Hot (T_mh)</div>
                  <div className="text-white font-mono font-medium">{telemetry.agmdMembraneHotTempC.toFixed(1)} °C</div>
                </div>
                <div>
                  <div className="text-slate-400">Membrane Cold (T_mc)</div>
                  <div className="text-white font-mono font-medium">{telemetry.agmdMembraneColdTempC.toFixed(1)} °C</div>
                </div>
                <div>
                  <div className="text-slate-400">Vapor Flux (J_m)</div>
                  <div className="text-cyan-300 font-mono font-medium">{telemetry.agmdVaporFluxLMH.toFixed(2)} LMH</div>
                </div>
                <div>
                  <div className="text-slate-400">Salinity</div>
                  <div className="text-slate-200 font-mono font-medium">{telemetry.agmdSalinityGKg.toFixed(1)} g/kg</div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded border border-slate-800">
              <div className="text-slate-300 font-medium mb-1">Distillation Physics</div>
              <code className="text-cyan-300 block font-mono">J_m = B_m * (P_v(T_mh, S) - P_v(T_mc))</code>
              <code className="text-cyan-300 block font-mono mt-0.5">B_m = (1/B_membrane + 1/B_airgap)⁻¹</code>
              <div className="mt-1 text-[10px] text-slate-400">
                Pure vapor diffusion. Salt ions (Na⁺, Cl⁻) are 100% rejected by hydrophobic pore surface tension.
              </div>
            </div>
          </div>
        );

      case 'freshwater':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Droplets className="w-4 h-4" />
              <span>Freshwater Collection & Analytics</span>
            </div>
            <p className="text-xs text-slate-300">
              Condensed pure water stream collected from the AGMD cold plate drainage trough.
              Free of dissolved solids, heavy metals, and salts.
            </p>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Production Metrics
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-400">Cumulative Distillate</div>
                  <div className="text-emerald-400 font-mono font-medium">
                    {telemetry.freshwaterVolumeL < 0.1
                      ? `${(telemetry.freshwaterVolumeL * 1000).toFixed(2)} mL`
                      : `${telemetry.freshwaterVolumeL.toFixed(4)} L`}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Current Production Rate</div>
                  <div className="text-cyan-300 font-mono font-medium">
                    {(telemetry.freshwaterRateLh * 1000).toFixed(2)} mL/h
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Water Purity</div>
                  <div className="text-white font-mono font-medium">&gt; 99.9% (&lt; 5 ppm)</div>
                </div>
                <div>
                  <div className="text-slate-400">Thermal Source</div>
                  <div className="text-amber-300 font-mono font-medium">100% GPU Waste Heat</div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded border border-slate-800">
              <div className="text-slate-300 font-medium mb-1">Energy Impact</div>
              <div className="text-xs text-slate-300">
                By co-locating AGMD with datacenter liquid cooling, high-temperature waste heat is transformed
                directly into clean drinking water without supplementary grid power for distillation.
              </div>
            </div>
          </div>
        );

      case 'primary-loop':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
              <RefreshCw className="w-4 h-4" />
              <span>Primary Coolant Loop (GPU Circuit)</span>
            </div>
            <p className="text-xs text-slate-300">
              High-purity liquid coolant (deionized water / dielectric fluid) circulated at 0.05 kg/s through GPU cold plates.
            </p>
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Mass Flow Rate:</span>
                <span className="text-white font-mono font-medium">0.050 kg/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hot Leg (GPU → HX):</span>
                <span className="text-red-400 font-mono font-medium">{telemetry.primaryOutletTempC.toFixed(1)} °C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cold Leg (HX → GPU):</span>
                <span className="text-blue-400 font-mono font-medium">{telemetry.primaryInletTempC.toFixed(1)} °C</span>
              </div>
            </div>
          </div>
        );

      case 'secondary-loop':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
              <RefreshCw className="w-4 h-4" />
              <span>Secondary Water Loop (Desalination Circuit)</span>
            </div>
            <p className="text-xs text-slate-300">
              Saline feed water circulated at 0.02 kg/s through the cold side of the heat exchanger into the thermal storage reservoir.
            </p>
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Mass Flow Rate:</span>
                <span className="text-white font-mono font-medium">0.020 kg/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Heated Leg (HX → Reservoir):</span>
                <span className="text-amber-400 font-mono font-medium">{telemetry.secondaryOutletTempC.toFixed(1)} °C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Reservoir Temperature:</span>
                <span className="text-cyan-400 font-mono font-medium">{telemetry.reservoirTempC.toFixed(1)} °C</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="absolute top-4 right-4 z-20 w-84 max-w-[calc(100vw-2rem)] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4 text-white animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold text-sm tracking-wide text-slate-200">Component Inspector</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {renderContent()}
    </div>
  );
};
