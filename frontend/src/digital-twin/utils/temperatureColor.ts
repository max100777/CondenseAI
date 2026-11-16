/**
 * Temperature to Color Palette Mapping for Digital Twin.
 * Scientific color gradient:
 * <= 20 °C : Deep Cool Blue  (Cold plate / ambient baseline)
 * ~ 30 °C  : Cyan            (Primary / Secondary cold inlet)
 * ~ 45 °C  : Emerald / Teal  (Secondary reservoir warm)
 * ~ 60 °C  : Amber / Orange  (GPU nominal running temp / hot water)
 * >= 75 °C : Red / Crimson   (GPU thermal peak)
 */

export function getTemperatureColor(
  tempC: number | null | undefined,
  minTemp: number = 20.0,
  maxTemp: number = 80.0
): string {
  if (tempC === null || tempC === undefined || !Number.isFinite(tempC)) {
    return '#64748b'; // Slate 500 fallback for unavailable
  }

  const clamped = Math.max(minTemp, Math.min(maxTemp, tempC));
  const t = (clamped - minTemp) / (maxTemp - minTemp); // 0.0 to 1.0

  if (t < 0.25) {
    // 20 to 35 °C: Deep Blue (#1d4ed8) to Cyan (#06b6d4)
    const factor = t / 0.25;
    return interpolateHex('#1d4ed8', '#06b6d4', factor);
  } else if (t < 0.5) {
    // 35 to 50 °C: Cyan (#06b6d4) to Emerald (#10b981)
    const factor = (t - 0.25) / 0.25;
    return interpolateHex('#06b6d4', '#10b981', factor);
  } else if (t < 0.75) {
    // 50 to 65 °C: Emerald (#10b981) to Amber (#f59e0b)
    const factor = (t - 0.5) / 0.25;
    return interpolateHex('#10b981', '#f59e0b', factor);
  } else {
    // 65 to 80+ °C: Amber (#f59e0b) to Crimson Red (#ef4444)
    const factor = (t - 0.75) / 0.25;
    return interpolateHex('#f59e0b', '#ef4444', factor);
  }
}

function interpolateHex(hex1: string, hex2: string, factor: number): string {
  const c1 = parseInt(hex1.replace('#', ''), 16);
  const c2 = parseInt(hex2.replace('#', ''), 16);

  const r1 = (c1 >> 16) & 255;
  const g1 = (c1 >> 8) & 255;
  const b1 = c1 & 255;

  const r2 = (c2 >> 16) & 255;
  const g2 = (c2 >> 8) & 255;
  const b2 = c2 & 255;

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
