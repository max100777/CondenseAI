import React from 'react';

export const DigitalTwinLegend: React.FC = () => {
  return (
    <details className="absolute bottom-3 left-3 z-10 max-w-xs space-y-3 rounded-lg border border-slate-700 bg-slate-900/95 p-2.5 text-xs text-white"><summary className="cursor-pointer">Thermal and fluid legend</summary>
      {/* 1. Thermal Spectrum Bar */}
      <div>
        <div className="text-[11px] font-semibold text-slate-300 mb-1 flex justify-between">
          <span>Thermal Spectrum</span>
          <span className="text-slate-400 font-mono">20°C – 80°C</span>
        </div>
        <div
          className="h-2.5 w-full rounded-full border border-slate-700/60"
          style={{
            background:
              'linear-gradient(to right, rgb(30, 58, 138), rgb(2, 132, 199), rgb(16, 185, 129), rgb(245, 158, 11), rgb(220, 38, 38), rgb(153, 27, 27))',
          }}
        />
        <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
          <span>20°C</span>
          <span>35°C</span>
          <span>50°C</span>
          <span>65°C</span>
          <span>80°C</span>
        </div>
      </div>

      {/* 2. Fluid Stream Identification */}
      <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]">
        <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
          Fluid Streams &amp; Isolation
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-300" />
          <span className="text-slate-300">
            <strong className="text-white">Primary Loop:</strong> Dielectric Coolant (Closed)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-300" />
          <span className="text-slate-300">
            <strong className="text-white">Secondary Loop:</strong> Saline Feed Water
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-cyan-200" />
          <span className="text-slate-300">
            <strong className="text-white">Distillate:</strong> Pure Drinking Water
          </span>
        </div>
      </div>
    </details>
  );
};
