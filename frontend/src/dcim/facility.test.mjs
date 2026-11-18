import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFacilityConfig,
  getFacilityData,
  getAllHalls,
  getAllRacks,
  getAllGpus,
  getHallById,
  getRackById,
  getGpuById,
  getParentRackOfGpu,
  getParentHallOfRack,
} from './facilityData.ts';

test('1. Facility generates exactly 4 halls, 24 racks, and 144 GPUs', () => {
  const facility = buildFacilityConfig();
  assert.equal(facility.totalHalls, 4);
  assert.equal(facility.halls.length, 4);
  assert.equal(facility.totalRacks, 24);
  assert.equal(facility.totalGpus, 144);

  const allHalls = getAllHalls();
  assert.equal(allHalls.length, 4);

  const allRacks = getAllRacks();
  assert.equal(allRacks.length, 24);

  const allGpus = getAllGpus();
  assert.equal(allGpus.length, 144);
});

test('2. Hall definitions and workload profiles are strictly configured', () => {
  const halls = getAllHalls();
  const expectedHalls = [
    { id: 'HALL-A', code: 'A', name: 'Hall A — AI Training', profile: 'High-intensity compute' },
    { id: 'HALL-B', code: 'B', name: 'Hall B — AI Inference', profile: 'Variable workload environment' },
    { id: 'HALL-C', code: 'C', name: 'Hall C — HPC & Research', profile: 'Sustained computational workload' },
    { id: 'HALL-D', code: 'D', name: 'Hall D — Experimental Hall', profile: 'Configurable workload' },
  ];

  for (let i = 0; i < 4; i++) {
    const h = halls[i];
    const exp = expectedHalls[i];
    assert.equal(h.id, exp.id);
    assert.equal(h.code, exp.code);
    assert.equal(h.name, exp.name);
    assert.equal(h.workloadProfile, exp.profile);
    assert.equal(h.racks.length, 6);
    assert.ok(h.accentColor.startsWith('#'));
    assert.ok(h.dimensions.length === 3);
  }
});

test('3. Exactly 6 racks per hall with unique IDs and consistent naming', () => {
  const halls = getAllHalls();
  const rackCodes = ['A', 'B', 'C', 'D'];
  const allRackIds = new Set();

  halls.forEach((hall, hIdx) => {
    assert.equal(hall.racks.length, 6);
    for (let r = 1; r <= 6; r++) {
      const rack = hall.racks[r - 1];
      const expectedCode = `${rackCodes[hIdx]}${String(r).padStart(2, '0')}`;
      const expectedId = `Rack ${expectedCode}`;

      assert.equal(rack.id, expectedId);
      assert.equal(rack.code, expectedCode);
      assert.equal(rack.hallId, hall.id);
      assert.equal(rack.hallCode, hall.code);
      assert.equal(rack.rackNumber, r);
      assert.equal(rack.ruHeight, 42);
      assert.equal(rack.gpus.length, 6);

      assert.ok(!allRackIds.has(rack.id), `Duplicate rack id: ${rack.id}`);
      allRackIds.add(rack.id);
    }
  });

  assert.equal(allRackIds.size, 24);
});

test('4. Exactly 6 GPUs per rack with unique IDs matching GPU <RackID>-GPU<01-06>', () => {
  const allGpus = getAllGpus();
  assert.equal(allGpus.length, 144);
  const allGpuIds = new Set();

  for (const gpu of allGpus) {
    assert.ok(!allGpuIds.has(gpu.id), `Duplicate GPU id: ${gpu.id}`);
    allGpuIds.add(gpu.id);

    // Verify format: "GPU <RackCode>-GPU<01-06>"
    const match = gpu.id.match(/^GPU ([A-D]\d{2})-GPU(0[1-6])$/);
    assert.ok(match, `Invalid GPU ID format: ${gpu.id}`);

    const rackCode = match[1];
    const gpuNum = parseInt(match[2], 10);
    assert.equal(gpu.gpuNumber, gpuNum);
    assert.equal(gpu.rackId, `Rack ${rackCode}`);
    assert.equal(gpu.telemetryConnected, false);
    assert.ok(gpu.telemetryStatus.includes('Placeholder'));
  }

  assert.equal(allGpuIds.size, 144);
});

test('5. Parent-child relationships and lookup helpers are consistent', () => {
  const testGpu = getGpuById('GPU A01-GPU03');
  assert.ok(testGpu);
  assert.equal(testGpu.name, 'GPU A01-GPU03');
  assert.equal(testGpu.indexInRack, 2);

  const parentRack = getParentRackOfGpu('GPU A01-GPU03');
  assert.ok(parentRack);
  assert.equal(parentRack.id, 'Rack A01');
  assert.equal(parentRack.code, 'A01');

  const parentHall = getParentHallOfRack('Rack A01');
  assert.ok(parentHall);
  assert.equal(parentHall.id, 'HALL-A');
  assert.equal(parentHall.name, 'Hall A — AI Training');

  assert.equal(getHallById('HALL-B')?.code, 'B');
  assert.equal(getRackById('Rack C04')?.code, 'C04');
});

test('6. Spatial coordinates and plant infrastructure zones are defined and separated', () => {
  const facility = getFacilityData();
  assert.ok(facility.infrastructureZones.length >= 4);

  // All 24 rack world positions must be unique and non-overlapping
  const positions = new Set();
  for (const rack of getAllRacks()) {
    const key = rack.position.map((v) => v.toFixed(2)).join(',');
    assert.ok(!positions.has(key), `Overlapping rack position at: ${key}`);
    positions.add(key);
  }
  assert.equal(positions.size, 24);

  // Check infrastructure zones
  const desal = facility.infrastructureZones.find((z) => z.id === 'PLANT-AGMD-DESAL');
  assert.ok(desal);
  assert.ok(desal.name.includes('AGMD'));
  assert.ok(desal.position.length === 3);
});
