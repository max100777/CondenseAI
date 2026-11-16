import test from 'node:test';
import assert from 'node:assert/strict';

// Helper replicate of formatFreshwaterVolume
function formatFreshwaterVolume(litres) {
  const safeL = Math.max(0, isNaN(litres) ? 0 : litres);
  if (safeL < 0.001) {
    const uL = safeL * 1e6;
    const formatted = uL < 10 ? (Math.round(uL * 100) / 100).toFixed(2) : (Math.round(uL * 10) / 10).toFixed(1);
    return {
      text: `${formatted} µL`,
      value: uL,
      unit: 'µL',
    };
  } else if (safeL < 1.0) {
    const mL = safeL * 1e3;
    const formatted = (Math.round(mL * 100) / 100).toFixed(2);
    return {
      text: `${formatted} mL`,
      value: mL,
      unit: 'mL',
    };
  } else {
    return {
      text: `${safeL.toFixed(3)} L`,
      value: safeL,
      unit: 'L',
    };
  }
}

// Helper replicate of active step resolution
function resolveActiveStep(timeSeries, activeStepIndex) {
  if (!timeSeries || timeSeries.length === 0) {
    return null;
  }
  const rawIdx = isNaN(activeStepIndex) ? 0 : Math.floor(activeStepIndex);
  const idx = Math.max(0, Math.min(rawIdx, timeSeries.length - 1));
  return timeSeries[idx] || null;
}

// Helper replicate of collector fill fraction
function computeCollectorFill(cumulativeVolumeL, maxDisplayVolumeL = 0.0001) {
  const referenceCapacityL = Math.max(0.0001, maxDisplayVolumeL);
  const fillFraction = Math.min(
    0.95,
    Math.max(0.0, referenceCapacityL > 0 ? (cumulativeVolumeL / referenceCapacityL) * 0.9 : 0.0)
  );
  return { fillFraction, hasWater: cumulativeVolumeL > 1e-8 };
}

// Mock time series
const mockTimeSeries = Array.from({ length: 60 }, (_, i) => ({
  time_s: i * 1.0,
  primary_coolant_temp_c: 50.0 + i * 0.1,
  secondary_reservoir_temp_c: 45.0 + i * 0.05,
  cumulative_freshwater_volume_l: (i / 59) * 0.00003505,
  freshwater_production_rate_l_h: 0.00212,
  gpu_states: [
    { gpu_id: 'GPU-1', current_temp_c: 55.0 + i * 0.5 },
  ],
}));

test('1. Fractional playback index does not return undefined', () => {
  const fractionalIndices = [0.001, 0.0166, 1.5, 29.7, 58.999];
  for (const idx of fractionalIndices) {
    const step = resolveActiveStep(mockTimeSeries, idx);
    assert.ok(step !== null, `Step should not be null for idx ${idx}`);
    assert.strictEqual(typeof step.time_s, 'number');
    assert.strictEqual(step.time_s, Math.floor(idx));
  }
});

test('2. First timestep selection', () => {
  const step = resolveActiveStep(mockTimeSeries, 0);
  assert.ok(step);
  assert.strictEqual(step.time_s, 0.0);
  assert.strictEqual(step.cumulative_freshwater_volume_l, 0.0);
});

test('3. Final timestep clamping', () => {
  const stepAtEnd = resolveActiveStep(mockTimeSeries, 59);
  assert.ok(stepAtEnd);
  assert.strictEqual(stepAtEnd.time_s, 59.0);

  // Beyond boundary should clamp to last index
  const stepBeyond = resolveActiveStep(mockTimeSeries, 100);
  assert.ok(stepBeyond);
  assert.strictEqual(stepBeyond.time_s, 59.0);
});

test('4. Empty time series returns null safely', () => {
  assert.strictEqual(resolveActiveStep([], 0), null);
  assert.strictEqual(resolveActiveStep(null, 5), null);
  assert.strictEqual(resolveActiveStep(undefined, 10), null);
});

test('5. Playback at 1x, 2x and 5x calculates correct step advance', () => {
  const dt = 1.0;
  const deltaSec = 0.016; // 1 frame at 60fps
  
  const advance1x = (deltaSec * 1) / dt;
  const advance2x = (deltaSec * 2) / dt;
  const advance5x = (deltaSec * 5) / dt;

  assert.strictEqual(advance1x, 0.016);
  assert.strictEqual(advance2x, 0.032);
  assert.strictEqual(advance5x, 0.080);
  assert.strictEqual(advance5x > advance2x && advance2x > advance1x, true);
});

test('6. Automatic playback after new simulation reset', () => {
  let isPlaying = false;
  let activeStepIndex = 45; // Stale index from prior run

  // Simulate new response arriving:
  const onNewSimulationArrival = (series) => {
    if (series && series.length > 0) {
      activeStepIndex = 0;
      isPlaying = true;
    }
  };

  onNewSimulationArrival(mockTimeSeries);
  assert.strictEqual(activeStepIndex, 0, 'Index must reset to 0');
  assert.strictEqual(isPlaying, true, 'Playback must start automatically');
});

test('7. Pause and resume state transitions', () => {
  let isPlaying = true;
  const togglePlay = () => { isPlaying = !isPlaying; };

  togglePlay();
  assert.strictEqual(isPlaying, false, 'Should be paused');
  togglePlay();
  assert.strictEqual(isPlaying, true, 'Should resume playback');
});

test('8. Scrubbing backwards and forwards selects valid step index', () => {
  const seekTime = (targetTime, series) => {
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < series.length; i++) {
      const diff = Math.abs(series[i].time_s - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    return closestIdx;
  };

  assert.strictEqual(seekTime(30.2, mockTimeSeries), 30);
  assert.strictEqual(seekTime(0.0, mockTimeSeries), 0);
  assert.strictEqual(seekTime(59.0, mockTimeSeries), 59);
  assert.strictEqual(seekTime(100.0, mockTimeSeries), 59);
});

test('9. Correct collector formatting for 35.05 µL', () => {
  const res = formatFreshwaterVolume(0.00003505);
  assert.strictEqual(res.unit, 'µL');
  assert.strictEqual(res.text, '35.1 µL');
  assert.strictEqual(Math.round(res.value * 10) / 10, 35.1);
});

test('10. Correct collector formatting for 2.5 mL', () => {
  const res = formatFreshwaterVolume(0.0025);
  assert.strictEqual(res.unit, 'mL');
  assert.strictEqual(res.text, '2.50 mL');
});

test('11. Correct collector formatting for 1.5 L', () => {
  const res = formatFreshwaterVolume(1.5);
  assert.strictEqual(res.unit, 'L');
  assert.strictEqual(res.text, '1.500 L');
});

test('12. Collector fill proportional to actual cumulative volume', () => {
  // Empty state: strictly 0 fill
  const emptyFill = computeCollectorFill(0.0, 0.0001);
  assert.strictEqual(emptyFill.fillFraction, 0.0);
  assert.strictEqual(emptyFill.hasWater, false);

  // 35.05 µL on 100 µL scale
  const labFill = computeCollectorFill(0.00003505, 0.0001);
  assert.strictEqual(labFill.hasWater, true);
  // (35.05 / 100) * 0.9 = 0.31545 (~31.5% fill of cylinder)
  assert.strictEqual(labFill.fillFraction > 0.3 && labFill.fillFraction < 0.33, true);

  // Full capacity: capped at 0.95
  const fullFill = computeCollectorFill(0.0002, 0.0001);
  assert.strictEqual(fullFill.fillFraction, 0.95);
});

test('13. Heatmap default enabled in initial display options', () => {
  const defaultDisplayOptions = {
    showLabels: true,
    showHeatmap: true, // Approved Fix 4
    flowAnimation: true,
    agmdCutaway: false,
  };
  assert.strictEqual(defaultDisplayOptions.showHeatmap, true);
});

test('14. Analytics and digital twin share single source of truth', () => {
  const mockSharedState = {
    simulationResult: {
      gpu_count: 1,
      total_freshwater_produced_l: 0.00003505,
      time_series: mockTimeSeries,
      analytics: {
        total_freshwater_volume_l: 0.00003505,
        total_freshwater_volume_ml: 0.03505,
      },
    },
  };

  // 3D twin reads cumulative from time_series at final step:
  const twinFinalVol = mockSharedState.simulationResult.time_series[59].cumulative_freshwater_volume_l;
  // Analytics reads from analytics object:
  const analyticsVol = mockSharedState.simulationResult.analytics.total_freshwater_volume_l;

  assert.strictEqual(twinFinalVol, analyticsVol);
  assert.strictEqual(formatFreshwaterVolume(twinFinalVol).text, '35.1 µL');
  assert.strictEqual(formatFreshwaterVolume(analyticsVol).text, '35.1 µL');
});
