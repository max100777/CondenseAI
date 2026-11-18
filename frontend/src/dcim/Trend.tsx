import { sample, type Rack, type Fault } from "./model";
export function Trend({
  rack,
  target,
  fault,
  load,
  tick,
}: {
  rack: Rack;
  target: Rack;
  fault: Fault;
  load: number;
  tick: number;
}) {
  const start = Math.max(0, tick - 60);
  const points = Array.from(
    { length: Math.min(tick, 60) + 1 },
    (_, i) => sample(rack, target, fault, load, start + i).inlet,
  );
  const lo = Math.min(18, ...points),
    hi = Math.max(28, ...points);
  const y = (v: number) => 55 - ((v - lo) / (hi - lo)) * 50;
  return (
    <section className="dc-controls">
      <div className="dc-tools">
        <b>Rack inlet trend · {rack.id}</b>
        <span>
          {start}–{tick} s · °C
        </span>
      </div>
      <svg
        width="100%"
        height="62"
        viewBox="0 0 600 62"
        preserveAspectRatio="none"
        role="img"
        aria-label="Simulated inlet temperature over the last minute"
      >
        <line
          x1="0"
          x2="600"
          y1={y(27)}
          y2={y(27)}
          stroke="#a47c4a"
          strokeDasharray="5 5"
        />
        <polyline
          fill="none"
          stroke="#6be4cf"
          strokeWidth="2"
          points={points
            .map(
              (v, i) => (600 * i) / Math.max(1, points.length - 1) + "," + y(v),
            )
            .join(" ")}
        />
      </svg>
      <small>Dotted line · 27 °C inlet alarm</small>
    </section>
  );
}
