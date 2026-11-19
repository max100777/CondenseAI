import test from 'node:test';
import assert from 'node:assert/strict';
import { runConnectivityValidation } from '../../scripts/validate-connectivity.mjs';

test('1. Machine-readable connectivity validation passes all structural assertions', () => {
  const report = runConnectivityValidation();
  assert.equal(report.reportMetadata.validationStatus, 'PASSED');
  assert.equal(report.reportMetadata.readyForScenePolish, true);
  assert.equal(report.graphMetrics.orphanNodeCount, 0);
  assert.equal(report.facilitySummary.totalHalls, 4);
  assert.equal(report.facilitySummary.totalRacks, 24);
  assert.equal(report.facilitySummary.totalComputeSleds, 144);
  assert.equal(report.facilitySummary.totalGpuAccelerators, 144);
});

test('2. Hydraulic primary cooling loop preserves continuity across all 144 GPUs', () => {
  const report = runConnectivityValidation();
  const hydCheck = report.verificationChecks.find((c) => c.domain === 'Hydraulic Cooling');
  assert.ok(hydCheck);
  assert.equal(hydCheck.status, 'PASSED');

  const hydronicsCheck = report.verificationChecks.find((c) => c.domain === 'Hydraulic Hydronics');
  assert.ok(hydronicsCheck);
  assert.equal(hydronicsCheck.status, 'PASSED');
});

test('3. Electrical distribution provides 2N concurrent redundancy to all 144 servers', () => {
  const report = runConnectivityValidation();
  const elecCheck = report.verificationChecks.find((c) => c.domain === 'Electrical Distribution');
  assert.ok(elecCheck);
  assert.equal(elecCheck.status, 'PASSED');
});

test('4. Network spine-and-leaf fabric reaches all 144 compute sleds without disconnected components', () => {
  const report = runConnectivityValidation();
  const netCheck = report.verificationChecks.find((c) => c.domain === 'Network Infrastructure');
  assert.ok(netCheck);
  assert.equal(netCheck.status, 'PASSED');
});

test('5. Thermal recovery and AGMD desalination forms a continuous closed-loop circuit', () => {
  const report = runConnectivityValidation();
  const thermalCheck = report.verificationChecks.find((c) => c.domain === 'Thermal Recovery & AGMD');
  assert.ok(thermalCheck);
  assert.equal(thermalCheck.status, 'PASSED');
});
