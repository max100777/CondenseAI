import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/Yash/.gemini/antigravity/brain/0ce2dbd6-1432-4711-b887-05d2468b73ec/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching system Chrome with SwiftShader for WebGL...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  console.log('Navigating to http://127.0.0.1:3000/ ...');
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Default 3D Digital Twin View
  console.log('1. Capturing Default 3D Digital Twin...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-default-3d-digital-twin.png') });

  // 2. Camera Top-Down View
  console.log('2. Capturing Top-Down Preset...');
  await page.getByRole('button', { name: 'Top-Down' }).click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-camera-top-down.png') });

  // Reset to Isometric
  await page.getByRole('button', { name: 'Isometric' }).click({ force: true });
  await page.waitForTimeout(1000);

  // 3. Rack X-Ray Mode
  console.log('3. Capturing Rack X-Ray Mode...');
  await page.getByRole('button', { name: 'Rack X-Ray' }).click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-rack-xray-mode.png') });
  // Toggle off X-Ray
  await page.getByRole('button', { name: 'Rack X-Ray' }).click({ force: true });
  await page.waitForTimeout(500);

  // 4. Trace Coolant Loop
  console.log('4. Capturing Coolant Loop Trace...');
  await page.getByRole('button', { name: 'Coolant Loop' }).click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-trace-coolant-loop.png') });

  // 5. Trace 2N Power Path
  console.log('5. Capturing 2N Power Path Trace...');
  await page.getByRole('button', { name: '2N Power Path' }).click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-trace-electrical-2n.png') });

  // 6. Trace Network Fiber
  console.log('6. Capturing Network Fiber Trace...');
  await page.getByRole('button', { name: 'Network Fiber' }).click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-trace-network-fiber.png') });

  // Reset Trace
  await page.getByRole('button', { name: 'Network Fiber' }).click({ force: true });
  await page.waitForTimeout(500);

  // 7. Thermal Heatmap Overlay
  console.log('7. Capturing Thermal Heatmap Overlay...');
  await page.getByRole('button', { name: 'Thermal Heatmap' }).click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-overlay-thermal-heatmap.png') });

  // 8. Power Density Overlay
  console.log('8. Capturing Power Density Overlay...');
  await page.getByRole('button', { name: 'Power Density' }).click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-overlay-power-density.png') });

  // 9. Hall Selection & Inspection
  console.log('9. Capturing Hall A Selection...');
  await page.getByPlaceholder(/Search Hall/).fill('HALL-A');
  await page.waitForTimeout(600);
  const searchItem = page.locator('.dc-search-item').first();
  if (await searchItem.count() > 0) {
    await searchItem.click({ force: true });
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-hall-inspection-hall-a.png') });

  // 10. Operations Dashboard
  console.log('10. Capturing Operations Dashboard...');
  await page.getByRole('button', { name: 'Operations Dashboard' }).click({ force: true });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-operations-dashboard.png') });

  // 11. Hall Analytics
  console.log('11. Capturing Hall Analytics...');
  await page.getByRole('button', { name: 'Hall Analytics' }).click({ force: true });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-hall-analytics.png') });

  // 12. Charts & Telemetry
  console.log('12. Capturing Charts & Telemetry...');
  await page.getByRole('button', { name: 'Charts & Telemetry' }).click({ force: true });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-charts-telemetry.png') });

  // 13. Physics Verification
  console.log('13. Capturing Physics Verification...');
  await page.getByRole('button', { name: 'Physics Verification' }).click({ force: true });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13-physics-verification.png') });

  // 14. GPU Thermal Lab (/?lab)
  console.log('14. Capturing GPU Thermal Lab (/?lab)...');
  await page.goto('http://127.0.0.1:3000/?lab', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14-gpu-thermal-lab.png') });

  console.log('Console Errors encountered during capture:', consoleErrors);
  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Failed to capture verification screenshots:', err);
  process.exit(1);
});
