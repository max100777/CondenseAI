import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Download,
  Layers,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  faults,
  inventory,
  sample,
  totals,
  amps,
  integratedEnergy,
} from "./model";
import type { Fault, Rack } from "./model";
import type { Layer } from "./FacilityScene";
import "./console.css";
import { Trend } from "./Trend";
const Scene = lazy(() => import("./FacilityScene"));
const seed = inventory();
const halls = Array.from({ length: 8 }, (_, i) => i);
const sections = [
  "Campus overview",
  "Cooling systems",
  "Electrical paths",
  "Rack explorer",
  "Network topology",
  "Compute resources",
  "Capacity planning",
  "Energy report",
] as const;
const layers: Layer[] = [
  "Equipment",
  "Temperature",
  "Power",
  "Space",
  "Humidity",
  "Network",
  "Health",
];
const num = (x: number, d = 1) =>
  x.toLocaleString("en-US", { maximumFractionDigits: d });
function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type Plan = { id: string; allocation: number; ru: number };
function valid(p: Plan) {
  return (
    p &&
    seed.some((r) => r.id === p.id) &&
    Number.isFinite(p.allocation) &&
    p.allocation > 0 &&
    p.allocation <= 12 &&
    [42, 48].includes(p.ru)
  );
}
function loadPlans(): Plan[] {
  try {
    const p = JSON.parse(localStorage.getItem("dcim-plans") || "[]");
    return Array.isArray(p) ? p.filter(valid) : [];
  } catch {
    return [];
  }
}
export default function Console() {
  const [section, setSection] =
    useState<(typeof sections)[number]>("Campus overview");
  const [plans, setPlans] = useState(loadPlans),
    [index, select] = useState(0),
    [hall, setHall] = useState(-1);
  const [fault, setFault] = useState<Fault>("Normal"),
    [target, setTarget] = useState(0),
    [load, setLoad] = useState(0.7);
  const [tick, time] = useState(0),
    [running, run] = useState(true),
    [interval, rate] = useState(1000);
  const [layer, setLayer] = useState<Layer>("Equipment"),
    [air, flow] = useState(true),
    [speed, setSpeed] = useState(1),
    [density, setDensity] = useState(28);
  const [roof, shell] = useState(false),
    [top, topDown] = useState(false),
    [flat, setFlat] = useState(() => {
      try {
        return !document.createElement("canvas").getContext("webgl2");
      } catch {
        return true;
      }
    });
  const [device, setDevice] = useState(0),
    [allocation, setAllocation] = useState(12),
    [units, setUnits] = useState(42);
  const [rear, setRear] = useState(false),
    [xray, setXray] = useState(false);
  const interior = section === "Rack explorer";
  const [plant, selectPlant] = useState("");
  const [tariff, cost] = useState(8),
    [factor, carbon] = useState(0.5),
    [currency, money] = useState("INR");
  const racks = useMemo(() => {
    const map = new Map(plans.map((p) => [p.id, p]));
    return seed.map((r) => {
      const p = map.get(r.id);
      return p
        ? {
            ...r,
            ...p,
            devices: r.devices.map((d) => ({
              ...d,
              allocation: p.allocation / r.devices.length,
            })),
          }
        : r;
    });
  }, [plans]);
  const rack = racks[index],
    installed = rack.devices[Math.min(device, rack.devices.length - 1)];
  useEffect(() => {
    if (running) {
      const id = window.setInterval(() => time((t) => t + 1), interval);
      return () => clearInterval(id);
    }
  }, [running, interval]);
  const data = useMemo(
    () => racks.map((r) => sample(r, racks[target], fault, load, tick)),
    [racks, target, fault, load, tick],
  );
  const visible = useMemo(
    () => (hall < 0 ? racks : racks.filter((r) => r.hall === hall)),
    [racks, hall],
  );
  const summary = totals(data, 24, tariff, factor),
    reading = data[index],
    design = racks.reduce((s, r) => s + r.allocation, 0);
  const pick = (r: Rack) => {
    select(r.index);
    setHall(r.hall);
    setDevice(0);
    setAllocation(r.allocation);
    setUnits(r.ru);
  };
  const changeSection = (s: typeof section) => {
    setSection(s);
    if (s === "Cooling systems") {
      setLayer("Temperature");
      flow(true);
      pick(rack);
    }
    if (s === "Electrical paths") {
      setLayer("Power");
      pick(rack);
    }
    if (s === "Rack explorer") pick(rack);
    if (s === "Campus overview") setHall(-1);
  };
  const applyFault = (v: Fault) => {
    setFault(v);
    setTarget(index);
    time(0);
  };
  function report(csv: boolean) {
    const rows = racks.map((r, i) => ({
      id: r.id,
      hall: r.hall + 1,
      row: r.row + 1,
      type: r.type,
      ru: r.ru,
      occupiedU: r.occupied,
      allocation_kW: r.allocation,
      ...data[i],
    }));
    if (csv) {
      const header =
        "sim_seconds,rack_id,hall,row,category,rack_U,occupied_U,allocation_kW,IT_kW,inlet_C,exhaust_C,RH_percent,A_feed_kW,B_feed_kW,alert";
      download(
        "simulated-rack-inventory.csv",
        [
          header,
          ...rows.map((r) =>
            [
              tick,
              r.id,
              r.hall,
              r.row,
              r.type,
              r.ru,
              r.occupiedU,
              r.allocation_kW,
              r.kw,
              r.inlet,
              r.exhaust,
              r.rh,
              r.a,
              r.b,
              r.alert,
            ].join(","),
          ),
        ].join("\n"),
        "text/csv",
      );
    } else
      download(
        "dcim-snapshot.json",
        JSON.stringify(
          {
            source: "Simulated",
            seconds: tick,
            fault,
            target: racks[target].id,
            load,
            projectionHours: 24,
            units: "power kW, energy kWh, temperature °C, airflow kg/s",
            tariff,
            currency,
            kgCO2ePerKWh: factor,
            summary,
            plans,
            racks: rows,
          },
          null,
          2,
        ),
        "application/json",
      );
  }
  return (
    <main className="dcim">
      <header>
        <div className="dc-brand">
          <Layers size={20} /> HYPERSCALE <b>DCIM</b>
        </div>
        <span className="dc-live">● Simulated data</span>
        <span>Campus 01 / Building A</span>
        <a href="?lab">GPU thermal lab ↗</a>
      </header>
      <aside>
        <small>OPERATIONS</small>
        {sections.map((s) => (
          <button
            className={section === s ? "active" : ""}
            key={s}
            onClick={() => changeSection(s)}
          >
            {s}
          </button>
        ))}
        <hr />
        <small>FACILITY NAVIGATOR</small>
        <button onClick={() => setHall(-1)}>All data halls</button>
        {halls.map((i) => (
          <button
            key={i}
            className={hall === i ? "active" : ""}
            onClick={() => pick(racks[i * 160])}
          >
            Hall {String(i + 1).padStart(2, "0")} <em>160</em>
          </button>
        ))}
      </aside>
      <article>
        <div className="dc-title">
          <div>
            <small>INFRASTRUCTURE OPERATIONS</small>
            <h1>{section}</h1>
          </div>
          <button onClick={() => report(false)}>
            <Download size={15} /> Snapshot
          </button>
        </div>
        <div className="dc-kpis">
          {[
            ["IT demand", num(summary.it / 1000, 3), "MW"],
            ["Facility demand", num(summary.facility / 1000, 4), "MW"],
            ["Allocated IT", num(design / 1000, 3), "MW"],
            ["Instantaneous PUE", summary.pue?.toFixed(2) ?? "—", ""],
            ["Rack alerts", data.filter((s) => s.alert).length, ""],
          ].map(([k, v, u]) => (
            <section key={k}>
              <small>{k}</small>
              <strong>
                {v} <em>{u}</em>
              </strong>
            </section>
          ))}
        </div>
        <div className="dc-work">
          <section className="dc-map">
            <div className="dc-tools">
              <b>{hall < 0 ? "Campus cutaway" : "Hall " + (hall + 1)}</b>
              <select
                aria-label="Overlay"
                value={layer}
                onChange={(e) => setLayer(e.target.value as Layer)}
              >
                {layers.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <button onClick={() => topDown(!top)}>
                {top ? "Isometric" : "Top view"}
              </button>
              <button onClick={() => shell(!roof)}>
                {roof ? "Cut away roof" : "Show roof"}
              </button>
              <button onClick={() => setFlat(!flat)}>
                {flat ? "3D" : "2D"}
              </button>
            </div>
            {interior && (
              <div className="dc-tools">
                <b>
                  {rack.id} · U{installed.start}
                </b>
                <button onClick={() => setRear(!rear)}>
                  {rear ? "View front" : "View rear"}
                </button>
                <button aria-pressed={xray} onClick={() => setXray(!xray)}>
                  X-ray {xray ? "on" : "off"}
                </button>
              </div>
            )}
            <div className="dc-canvas">
              {flat ? (
                <div className="dc-floor">
                  {halls
                    .filter((i) => hall < 0 || hall === i)
                    .map((i) => (
                      <section key={i}>
                        <b>Hall {i + 1}</b>
                        <div>
                          {racks.slice(i * 160, i * 160 + 160).map((r) => (
                            <button
                              key={r.id}
                              aria-label={r.id}
                              title={r.id}
                              style={{
                                background: data[r.index].alert
                                  ? "#f08a56"
                                  : r.index === index
                                    ? "#ffe994"
                                    : "#427782",
                              }}
                              onClick={() => pick(r)}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                </div>
              ) : (
                <Suspense fallback={<p>Loading facility geometry…</p>}>
                  <Scene
                    selectPlant={selectPlant}
                    interior={interior}
                    rear={rear}
                    xray={xray}
                    device={device}
                    inspect={setDevice}
                    racks={visible}
                    data={data}
                    selected={rack}
                    hall={hall}
                    layer={layer}
                    roof={roof}
                    top={top}
                    air={air}
                    speed={speed}
                    density={density}
                    trace={section === "Electrical paths"}
                    paused={!running}
                    pick={pick}
                  />
                </Suspense>
              )}
            </div>
            <div className="dc-tools">
              <Activity size={16} />
              <span>{visible.length.toLocaleString()} racks</span>
              <span>•</span>
              <span>
                {layer === "Temperature"
                  ? "Floor: IDW estimate · inlet: cold <18 / target 18–25 / warm 25–27 / alarm >27 °C"
                  : layer + " layer"}
              </span>
            </div>
          </section>
          <section className="dc-inspect">
            {plant && (
              <div>
                <small>PLANT INSPECTOR</small>
                <h2>{plant}</h2>
                <p>
                  {num(
                    plant === "Chilled-water plant"
                      ? summary.it
                      : plant === "Utility intake"
                        ? fault === "Generator online"
                          ? 0
                          : summary.facility
                        : fault === "Generator online"
                          ? summary.facility
                          : 0,
                  )}{" "}
                  kW{" "}
                  {plant === "Chilled-water plant" ? "thermal" : "electrical"}
                </p>
                <button onClick={() => selectPlant("")}>Close details</button>
              </div>
            )}
            <small>ASSET INSPECTOR</small>
            <h2>{rack.id}</h2>
            <label>
              Locate rack
              <select
                value={index}
                onChange={(e) => pick(racks[+e.target.value])}
              >
                {visible.map((r) => (
                  <option key={r.id} value={r.index}>
                    {r.id}
                  </option>
                ))}
              </select>
            </label>
            <dl>
              {Object.entries({
                Equipment: rack.type,
                Power: num(reading.kw, 2) + " kW",
                Space: rack.occupied + " / " + rack.ru + " U",
                "Inlet / outlet":
                  num(reading.inlet) + " / " + num(reading.exhaust) + " °C",
                Humidity: num(reading.rh) + " %",
                "A / B feed": num(reading.a) + " / " + num(reading.b) + " kW",
                "Circuit current": num(amps(reading.kw)) + " A",
                Network: rack.switchId,
                "Cooling zone": rack.zone,
                Status: reading.alert ? "Active warning" : "Operational",
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <label>
              Installed device
              <select
                value={installed.id}
                onChange={(e) =>
                  setDevice(
                    rack.devices.findIndex((d) => d.id === e.target.value),
                  )
                }
              >
                {rack.devices.map((d) => (
                  <option key={d.id}>{d.id}</option>
                ))}
              </select>
            </label>
            <p>
              U{installed.start}–{installed.start + installed.u - 1} ·{" "}
              {installed.type} · {num(reading.kw / rack.devices.length, 3)} kW
            </p>
          </section>
        </div>
        <section className="dc-controls">
          <div className="dc-tools">
            <b>Simulation</b>
            <button onClick={() => run(!running)}>
              {running ? <Pause size={14} /> : <Play size={14} />}{" "}
              {running ? "Pause" : "Resume"}
            </button>
            <button
              onClick={() => {
                time(0);
                setLoad(0.7);
                setFault("Normal");
              }}
            >
              <RotateCcw size={14} /> Reset
            </button>
            <span>T + {tick} s</span>
            <select
              aria-label="Playback speed"
              value={interval}
              onChange={(e) => rate(+e.target.value)}
            >
              <option value={1000}>1× speed</option>
              <option value={250}>4× speed</option>
            </select>
          </div>
          <div className="dc-fields">
            <label>
              Fault at selected asset
              <select
                value={fault}
                onChange={(e) => applyFault(e.target.value as Fault)}
              >
                {faults.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Campus demand · {Math.round(load * 100)}%
              <input
                type="range"
                min="0"
                max="1"
                step=".01"
                value={load}
                onChange={(e) => {
                  setLoad(+e.target.value);
                  time(0);
                }}
              />
            </label>
            <label>
              Replay time (s)
              <input
                type="number"
                min="0"
                value={tick}
                onChange={(e) => {
                  run(false);
                  time(Math.max(0, Number(e.target.value)));
                }}
              />
            </label>
          </div>
          {fault !== "Normal" && (
            <p role="status">
              {fault} · initiated at {racks[target].id} ·{" "}
              {data.filter((s) => s.alert).length} racks with active warnings
            </p>
          )}
        </section>
        {section === "Cooling systems" && (
          <section className="dc-controls">
            <h2>Chilled-water CRAH loop</h2>
            <p>
              Supply aisle → rack intake → exhaust aisle → CRAH return. Markers
              illustrate direction. The model estimates rack temperatures from
              sensible heat and recirculation.
            </p>
            <div className="dc-fields">
              <label>
                <input
                  type="checkbox"
                  checked={air}
                  onChange={(e) => flow(e.target.checked)}
                />{" "}
                Animate airflow
              </label>
              <label>
                Particle count
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={density}
                  onChange={(e) => setDensity(+e.target.value)}
                />
              </label>
              <label>
                Motion speed
                <input
                  type="range"
                  min=".2"
                  max="3"
                  step=".1"
                  value={speed}
                  onChange={(e) => setSpeed(+e.target.value)}
                />
              </label>
            </div>
            <p>
              Selected rack · {num(reading.airflow, 2)} kg/s · campus IT
              sensible heat equivalent {num(summary.tons, 2)} refrigeration tons
              · modeled cooling input {num(summary.cooling)} kW at COP 4.
            </p>
          </section>
        )}
        {section === "Electrical paths" && (
          <section className="dc-controls">
            <h2>Power paths · {rack.id}</h2>
            {["A", "B"].map((feed, i) => (
              <p key={feed}>
                {fault === "Generator online" ? "Generator" : "Utility"} →
                Switchgear → Transformer {feed} → UPS H{rack.hall + 1}-{feed} →
                Row {rack.row + 1} panel → {rack.id} PDU {feed} ·{" "}
                {num(i ? reading.b : reading.a)} / 12 kW
              </p>
            ))}
            <p>
              Balanced 415 V line-to-line · PF 0.95 · {num(reading.kw / 0.95)}{" "}
              kVA at rack.
            </p>
          </section>
        )}
        {section === "Capacity planning" && (
          <section className="dc-controls">
            <h2>Propose rack allocation · {rack.id}</h2>
            <div className="dc-fields">
              <label>
                IT allocation (kW)
                <input
                  type="number"
                  min=".1"
                  max="12"
                  value={allocation}
                  onChange={(e) => setAllocation(+e.target.value)}
                />
              </label>
              <label>
                Rack size
                <select
                  value={units}
                  onChange={(e) => setUnits(+e.target.value)}
                >
                  <option>42</option>
                  <option>48</option>
                </select>
              </label>
              <button
                disabled={!valid({ id: rack.id, allocation, ru: units })}
                onClick={() => {
                  const next = [
                    ...plans.filter((p) => p.id !== rack.id),
                    { id: rack.id, allocation, ru: units },
                  ];
                  localStorage.setItem("dcim-plans", JSON.stringify(next));
                  setPlans(next);
                  time(0);
                }}
              >
                Apply & save locally
              </button>
            </div>
            <p>
              Design allocation {rack.allocation} → {allocation} kW · free space{" "}
              {rack.ru - rack.occupied} → {units - rack.occupied} U · baseline
              daily facility energy change{" "}
              {num((allocation - rack.allocation) * load * 1.35 * 24)} kWh.
            </p>
          </section>
        )}
        {section === "Energy report" && (
          <section className="dc-controls">
            <h2>Constant-load projection</h2>
            <div className="dc-fields">
              {[
                ["Tariff / kWh", tariff, cost],
                ["kg CO₂e / kWh", factor, carbon],
              ].map(([k, v, fn]) => (
                <label key={String(k)}>
                  {String(k)}
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    value={Number(v)}
                    onChange={(e) =>
                      (fn as typeof cost)(Math.max(0, +e.target.value))
                    }
                  />
                </label>
              ))}
              <label>
                Currency
                <select
                  value={currency}
                  onChange={(e) => money(e.target.value)}
                >
                  <option>INR</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </label>
            </div>
            <p>
              24 h · {num(summary.energy)} kWh · {currency} {num(summary.cost)}{" "}
              · {num(summary.carbon)} kg CO₂e. Annual projection{" "}
              {num(summary.energy * 365)} kWh. Tariff and emissions factor are
              assumptions.
            </p>
            <button onClick={() => report(true)}>
              Export rack inventory CSV
            </button>
          </section>
        )}
        {section === "Network topology" && (
          <section className="dc-controls">
            <h2>Row switch · {rack.switchId}</h2>
            <p>
              {reading.network ? "Forwarding" : "Offline"} ·{" "}
              {num(
                data.reduce(
                  (n, s, i) =>
                    n +
                    (racks[i].switchId === rack.switchId ? s.throughput : 0),
                  0,
                ),
              )}{" "}
              Gbit/s modeled row throughput
            </p>
            <p>
              {installed.id} → {rack.id} uplink → {rack.switchId} → Hall{" "}
              {rack.hall + 1} aggregation
            </p>
          </section>
        )}
        {section === "Compute resources" && (
          <section className="dc-controls">
            <h2>Installed inventory · {visible.length} racks</h2>
            <div className="dc-fields">
              {Object.entries(
                visible.reduce(
                  (a, r) => {
                    const n = r.devices.length;
                    if (r.type === "Compute" || r.type === "Accelerator") {
                      a.CPUs += n * 2;
                      a.Cores += n * 64;
                      a["Memory GiB"] += n * 256;
                    }
                    if (r.type === "Accelerator") a.GPUs += n * 4;
                    if (r.type === "Storage") a["Storage TB"] += n * 96;
                    return a;
                  },
                  {
                    CPUs: 0,
                    Cores: 0,
                    GPUs: 0,
                    "Memory GiB": 0,
                    "Storage TB": 0,
                  },
                ),
              ).map(([k, v]) => (
                <p key={k}>
                  {k} · {num(v, 0)}
                </p>
              ))}
            </div>
            <p>
              Simulated specifications per compute device: dual 32-core CPUs and
              256 GiB. Accelerator devices add four GPUs. Storage nodes have 96
              TB.
            </p>
          </section>
        )}
        {section === "Energy report" && (
          <section className="dc-controls">
            <h2>Elapsed scenario energy</h2>
            <p>
              {num(
                integratedEnergy(
                  tick
                    ? [
                        { t: 0, kw: summary.facility },
                        { t: tick, kw: summary.facility },
                      ]
                    : [],
                ),
                4,
              )}{" "}
              kWh facility · {num((tick * summary.it) / 3600, 4)} kWh IT ·
              period PUE{" "}
              {tick && summary.it ? num(summary.facility / summary.it, 2) : "—"}{" "}
              · {tick} simulated seconds at this scenario’s constant demand.
            </p>
          </section>
        )}
        <Trend
          rack={rack}
          target={racks[target]}
          fault={fault}
          load={load}
          tick={tick}
        />
      </article>
    </main>
  );
}
