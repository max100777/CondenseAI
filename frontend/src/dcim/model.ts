export type Fault =
  | "Normal"
  | "Workload spike"
  | "CRAH shutdown"
  | "Fan restriction"
  | "Containment open"
  | "Warm chilled water"
  | "UPS A failure"
  | "Rack PDU A trip"
  | "Switch failure"
  | "Utility loss"
  | "Generator online";
export const faults: Fault[] = [
  "Normal",
  "Workload spike",
  "CRAH shutdown",
  "Fan restriction",
  "Containment open",
  "Warm chilled water",
  "UPS A failure",
  "Rack PDU A trip",
  "Switch failure",
  "Utility loss",
  "Generator online",
];
export function inventory(halls = 8, rows = 10, bays = 16, ru = 42) {
  if (
    ![halls, rows, bays].every((n) => Number.isInteger(n) && n > 0) ||
    ![42, 48].includes(ru)
  )
    throw Error("Invalid layout");
  return Array.from({ length: halls * rows * bays }, (_, index) => {
    const hall = Math.floor(index / (rows * bays)),
      row = Math.floor(index / bays) % rows,
      bay = index % bays;
    const id = ["H" + (hall + 1), "R" + (row + 1), "C" + (bay + 1)].join("-");
    const type = ["Compute", "Storage", "Network", "Accelerator"][index % 4];
    const u = [2, 4, 1, 4][index % 4],
      count = [15, 8, 24, 9][index % 4];
    const devices = Array.from({ length: count }, (_, d) => ({
      id: id + "-D" + (d + 1),
      start: d * u + 1,
      u,
      type,
      allocation: 12 / count,
    }));
    const hx = ((hall % 4) - 1.5) * (bays * 0.68 + 7),
      hz = (Math.floor(hall / 4) - 0.5) * (rows * 2.7 + 7);
    return {
      id,
      index,
      hall,
      row,
      bay,
      type,
      devices,
      ru,
      occupied: u * count,
      allocation: 12,
      x: hx + (bay - (bays - 1) / 2) * 0.68,
      z: hz + (row - (rows - 1) / 2) * 2.7,
      hx,
      hz,
      front: row % 2 === 0 ? 1 : -1,
      zone: "H" + (hall + 1) + "-CRAH" + (Math.floor(row / 2) + 1),
      switchId: "H" + (hall + 1) + "-ToR" + (row + 1),
    };
  });
}
export type Rack = ReturnType<typeof inventory>[number];
export function amps(kw: number, volts = 415, pf = 0.95, phases: 1 | 3 = 3) {
  if (
    ![kw, volts, pf].every(Number.isFinite) ||
    kw < 0 ||
    volts <= 0 ||
    pf <= 0 ||
    pf > 1
  )
    throw Error("Invalid electrical input");
  return (kw * 1000) / (volts * pf * Math.sqrt(phases));
}
export function sample(
  r: Rack,
  target: Rack,
  fault: Fault,
  load: number,
  seconds: number,
) {
  if (
    !Number.isFinite(load) ||
    load < 0 ||
    load > 1 ||
    !Number.isFinite(seconds) ||
    seconds < 0
  )
    throw Error("Invalid simulation inputs");
  const zone = r.zone === target.zone;
  const powered = fault !== "Utility loss";
  const kw = powered
    ? r.devices.reduce((n, d) => n + d.allocation, 0) *
      load *
      (fault === "Workload spike" && zone ? 1.5 : 1)
    : 0;
  const feedA = !(
    (fault === "UPS A failure" && r.hall === target.hall) ||
    (fault === "Rack PDU A trip" && r.id === target.id)
  );
  const a = feedA ? kw / 2 : 0,
    b = kw - a;
  const fan = zone && fault === "Fan restriction" ? 0.55 : 1;
  const cooling = !powered || (zone && fault === "CRAH shutdown") ? 0 : 1;
  const airflow = 0.84 * fan * cooling;
  const supply = 21 + (zone && fault === "Warm chilled water" ? 5 : 0);
  const rise = kw / (1.006 * (airflow || 0.12));
  const equilibrium =
    supply +
    rise * (zone && fault === "Containment open" ? 0.6 : 0.13) +
    (powered && !cooling ? 8 : 0);
  const inlet = 22.29 + (equilibrium - 22.29) * (1 - Math.exp(-seconds / 60));
  const network =
    powered && !(fault === "Switch failure" && r.switchId === target.switchId);
  return {
    kw,
    a,
    b,
    amps: amps(kw),
    inlet,
    exhaust: inlet + rise,
    rh: Math.min(90, 45 * Math.exp(-0.04 * (inlet - 22.29))),
    airflow,
    network,
    throughput: network ? kw * 2.5 : 0,
    cooling,
    alert:
      !powered ||
      !network ||
      inlet > 27 ||
      kw > r.allocation + 1e-8 ||
      b > 12 ||
      !feedA ||
      !cooling,
  };
}
export type Reading = ReturnType<typeof sample>;
export function interpolate(
  x: number,
  z: number,
  sensors: { x: number; z: number; value: number }[],
) {
  if (!sensors.length) throw Error("At least one sample is required");
  let sum = 0,
    weight = 0;
  for (const s of sensors) {
    const d2 = (s.x - x) ** 2 + (s.z - z) ** 2;
    if (d2 === 0) return s.value;
    sum += s.value / d2;
    weight += 1 / d2;
  }
  return sum / weight;
}
export function totals(
  readings: Reading[],
  hours: number,
  tariff: number,
  factor: number,
) {
  if (![hours, tariff, factor].every((n) => Number.isFinite(n) && n >= 0))
    throw Error("Invalid projection inputs");
  const it = readings.reduce((n, r) => n + r.kw, 0),
    cooling = readings.reduce((n, r) => n + r.kw * r.cooling, 0) / 4,
    overhead = cooling + it * 0.1,
    facility = it + overhead;
  const energy = facility * hours;
  return {
    it,
    cooling,
    overhead,
    facility,
    pue: it ? facility / it : null,
    energy,
    cost: energy * tariff,
    carbon: energy * factor,
    tons: it / 3.51685,
  };
}
export function integratedEnergy(samples: { t: number; kw: number }[]) {
  let result = 0;
  samples.forEach(({ t, kw }, i) => {
    if (
      !Number.isFinite(t) ||
      !Number.isFinite(kw) ||
      kw < 0 ||
      t < 0 ||
      (i && t <= samples[i - 1].t)
    )
      throw Error("Invalid energy sample");
    if (i)
      result +=
        ((kw + samples[i - 1].kw) * 0.5 * (t - samples[i - 1].t)) / 3600;
  });
  return result;
}
