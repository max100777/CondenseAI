import test from "node:test";
import assert from "node:assert/strict";
import {
  inventory,
  sample,
  amps,
  totals,
  integratedEnergy,
  interpolate,
} from "./model.ts";
const racks = inventory(),
  first = racks[0];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, a + " vs " + b);
test("facility geometry and inventory", () => {
  assert.equal(racks.length, 8 * 10 * 16);
  assert.equal(new Set(racks.map((r) => r.id)).size, 1280);
  assert.equal(new Set(racks.map((r) => [r.x, r.z].join(","))).size, 1280);
  for (const r of racks) {
    const slots = new Set();
    for (const d of r.devices)
      for (let u = d.start; u < d.start + d.u; u++) {
        assert.ok(u <= r.ru && !slots.has(u));
        slots.add(u);
      }
    assert.equal(slots.size, r.occupied);
  }
  close((first.occupied / first.ru) * 100, 71.428571);
  close(
    racks.reduce((n, r) => n + r.allocation, 0),
    15360,
  );
});
test("reference engineering totals", () => {
  const s = totals(
    racks.map((r) => sample(r, first, "Normal", 0.7, 0)),
    24,
    8,
    0.5,
  );
  for (const [key, v] of Object.entries({
    it: 10752,
    facility: 14515.2,
    overhead: 3763.2,
    energy: 348364.8,
    pue: 1.35,
    cost: 2786918.4,
    carbon: 174182.4,
  }))
    close(s[key], v);
  close(s.energy * 365, 127153152);
  close(s.tons, 10752 / 3.51685);
  assert.equal(totals([], 0, 0, 0).pue, null);
});
test("feed and cooling fault boundaries", () => {
  for (const rack of [first, racks[160]]) {
    const r = sample(rack, first, "UPS A failure", 0.7, 120);
    close(r.a + r.b, r.kw);
    close(r.a, rack.hall === 0 ? 0 : 4.2);
  }
  assert.ok(sample(first, first, "CRAH shutdown", 0.7, 120).inlet > 27);
  assert.ok(sample(racks[32], first, "CRAH shutdown", 0.7, 120).inlet < 27);
  close(sample(first, first, "Utility loss", 0.7, 20).kw, 0);
  assert.equal(sample(first, first, "Switch failure", 0.7, 20).network, false);
});
test("electrical and energy units and validation", () => {
  close(amps(1, 100, 1, 1), 10);
  close(amps(1, 100, 1), 10 / Math.sqrt(3));
  close(
    integratedEnergy([
      { t: 0, kw: 2 },
      { t: 3600, kw: 4 },
    ]),
    3,
  );
  const sensors = [
    { x: 0, z: 0, value: 20 },
    { x: 2, z: 0, value: 30 },
  ];
  close(interpolate(0, 0, sensors), 20);
  close(interpolate(1, 0, sensors), 25);
  assert.throws(() => amps(1, 0));
  assert.throws(() => amps(1, 230, 1.1));
  assert.throws(() => sample(first, first, "Normal", -1, 0));
  assert.throws(() => inventory(-1));
  assert.throws(() => totals([], 1, -1, 0));
  assert.throws(() =>
    integratedEnergy([
      { t: 2, kw: 0 },
      { t: 1, kw: 1 },
    ]),
  );
});
