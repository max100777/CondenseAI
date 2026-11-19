import test from 'node:test';
import assert from 'node:assert/strict';
import { runConnectivityValidation } from '../../scripts/validate-connectivity.mjs';
import { runGeometricValidation } from '../../scripts/validate-geometry.mjs';

test('1. Machine-readable connectivity validation passes all structural assertions', () => {
  const report = runConnectivityValidation();
  assert.equal(report.reportMetadata.validationStatus, 'PASSED');
  assert.equal(report.reportMetadata.readyForScenePolish, true);
  assert.equal(report.graphMetrics.orphanNodeCount, 0);
  assert.equal(report.facilitySummary.totalHalls, 4);
  assert.equal(report.facilitySummary.totalRacks, 24);
  assert.equal(report.facilitySummary.totalComputeSleds, 144);
  assert.equal(report.facilitySummary.totalGpuAccelerators, 144);
  assert.equal(report.facilitySummary.totalServerPsus, 288);
  assert.equal(report.facilitySummary.totalServerNicPorts, 288);
  assert.equal(report.graphMetrics.totalNodes, 1330);
  assert.equal(report.graphMetrics.totalEdges, 2191);
});

test('2. Hydraulic primary cooling loop preserves continuity across all 144 GPUs', () => {
  const report = runConnectivityValidation();
  const hydCheck = report.verificationChecks.find((c) => c.domain === 'Hydraulic Cooling');
  assert.ok(hydCheck);
  assert.equal(hydCheck.status, 'PASSED');

  const hydronicsCheck = report.verificationChecks.find((c) => c.domain === 'Hydraulic Hydronics');
  assert.ok(hydronicsCheck);
  assert.equal(hydronicsCheck.status, 'PASSED');
  assert.equal(report.physicsReconciliation.primaryFacilityFlowKgS, 1.60);
});

test('3. First-Law thermal transport matches GPU heat generation and HX recovery', () => {
  const report = runConnectivityValidation();
  const thermalCheck = report.verificationChecks.find((c) => c.domain === 'Thermal Energy Reconciliation');
  assert.ok(thermalCheck);
  assert.equal(thermalCheck.status, 'PASSED');

  const diff = Math.abs(
    report.physicsReconciliation.calculatedThermalTransportKw -
      report.physicsReconciliation.gpuAggregateThermalDissipationKw
  );
  assert.ok(diff < 0.1, `Thermal power mismatch: ${diff} kW`);
});

test('4. AGMD desalination rate is bounded by First-Law recovered heat without auxiliary energy', () => {
  const report = runConnectivityValidation();
  const agmdCheck = report.verificationChecks.find((c) => c.domain === 'AGMD Energy Balance');
  assert.ok(agmdCheck);
  assert.equal(agmdCheck.status, 'PASSED');

  assert.ok(
    report.physicsReconciliation.agmdLatentHeatConsumedKw <=
      report.physicsReconciliation.calculatedThermalTransportKw,
    'AGMD latent heat exceeds recovered heat'
  );
  assert.equal(report.physicsReconciliation.auxiliaryHeatingRequired, false);
  assert.equal(report.physicsReconciliation.closedLoopWaterConsumptionLiters, 0);
});

test('5. Electrical distribution provides 2N concurrent redundancy with independent dual PSUs', () => {
  const report = runConnectivityValidation();
  const elecCheck = report.verificationChecks.find((c) => c.domain === 'Electrical 2N Redundancy');
  assert.ok(elecCheck);
  assert.equal(elecCheck.status, 'PASSED');

  // Verify all 5 fault scenarios pass with 0 dropped servers
  for (const scenario of report.electrical2NAnalysis.faultScenariosTested) {
    assert.equal(scenario.droppedServers, 0, `Scenario ${scenario.scenario} failed`);
    assert.equal(scenario.status, 'PASSED');
  }
});

test('6. Network spine-and-leaf fabric reaches all 288 NIC ports with non-blocking oversubscription', () => {
  const report = runConnectivityValidation();
  const netCheck = report.verificationChecks.find((c) => c.domain === 'Network Fabric & Oversubscription');
  assert.ok(netCheck);
  assert.equal(netCheck.status, 'PASSED');
  assert.equal(report.networkFabricAnalysis.torOversubscription, '1.0:1.0 (Strictly Non-Blocking)');
});

test('7. 3D Geometric routing validator certifies zero layer separation violations', () => {
  const geoReport = runGeometricValidation();
  assert.equal(geoReport.reportMetadata.validationStatus, 'PASSED');
  assert.equal(geoReport.geometricSummary.layerSeparationViolations, 0);
  assert.equal(geoReport.geometricSummary.portConnectedRoutes, geoReport.geometricSummary.totalPhysicalRoutes);
  assert.equal(geoReport.geometricSummary.geometricallyRoutedValid, geoReport.geometricSummary.totalPhysicalRoutes);
});
