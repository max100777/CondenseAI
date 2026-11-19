import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/Yash/.gemini/antigravity/brain/0ce2dbd6-1432-4711-b887-05d2468b73ec/screenshots/gpu-realism';
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
  await page.waitForTimeout(2500);

  // 1. Full GPU Rack (Search and select Rack A01)
  console.log('1. Selecting Rack A01...');
  await page.getByPlaceholder(/Search Hall/).fill('Rack A01');
  await page.waitForTimeout(600);
  const searchItem = page.locator('.dc-search-item').first();
  if (await searchItem.count() > 0) {
    await searchItem.click({ force: true });
  }
  await page.waitForTimeout(1500);

  console.log('Capturing 01-full-gpu-rack.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-full-gpu-rack.png') });

  // 2. Rack with all six trays visible (Front view)
  console.log('2. Opening all trays or inspecting front view...');
  const openAllBtn = page.locator('.dc-rack-action-btn').first();
  if (await openAllBtn.count() > 0) {
    await openAllBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 02-rack-six-trays-visible.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-rack-six-trays-visible.png') });

  // Retract all trays
  if (await openAllBtn.count() > 0) {
    await openAllBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // 3. One Tray Extended (Select Tray 01 / GPU A01-GPU01)
  console.log('3. Selecting individual GPU A01-GPU01 to slide out tray...');
  const firstGpuRow = page.locator('.dc-gpu-row').first();
  if (await firstGpuRow.count() > 0) {
    await firstGpuRow.click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 03-one-tray-extended.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-one-tray-extended.png') });

  // 4. Close-Up of Actual GPU Hardware
  console.log('4. Close-up view of GPU hardware...');
  // Camera focuses close-up on the extracted compute tray
  await page.waitForTimeout(1000);
  console.log('Capturing 04-closeup-gpu-hardware.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-closeup-gpu-hardware.png') });

  // 5. GPU Cold Plate & Coolant Connections
  console.log('5. Capturing 05-gpu-cold-plate-coolant.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-gpu-cold-plate-coolant.png') });

  // 6. GPU Inspection Panel (Focusing on the right sidebar)
  console.log('6. Capturing 06-gpu-inspection-panel.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-gpu-inspection-panel.png') });

  // 7. Rack-Level Six-GPU Telemetry Table
  console.log('7. Returning to Rack view to capture 6-GPU telemetry table...');
  const returnToRackBtn = page.getByRole('button', { name: /Return to Rack/i });
  if (await returnToRackBtn.count() > 0) {
    await returnToRackBtn.click({ force: true });
    await page.waitForTimeout(1200);
  }
  console.log('Capturing 07-rack-six-gpu-telemetry.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-rack-six-gpu-telemetry.png') });

  // 8. Light-Mode Facility
  console.log('8. Toggling Light Mode in header...');
  const lightThemeBtn = page.locator('.dc-theme-btn[title="Light Theme"]');
  if (await lightThemeBtn.count() > 0) {
    await lightThemeBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }
  // Return to Campus overview
  const campusCrumb = page.getByRole('button', { name: 'Campus' });
  if (await campusCrumb.count() > 0) {
    await campusCrumb.click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 08-light-mode-facility.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-light-mode-facility.png') });

  // 9. Light-Mode GPU Close-Up
  console.log('9. Selecting GPU A01-GPU01 in Light Mode...');
  await page.getByPlaceholder(/Search Hall/).fill('GPU A01-GPU01');
  await page.waitForTimeout(600);
  const searchGpuItem = page.locator('.dc-search-item').first();
  if (await searchGpuItem.count() > 0) {
    await searchGpuItem.click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 09-light-mode-gpu-closeup.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-light-mode-gpu-closeup.png') });

  // 10. Dark-Mode GPU Close-Up
  console.log('10. Switching back to Dark Mode for close-up...');
  const darkThemeBtn = page.locator('.dc-theme-btn[title="Dark Theme"]');
  if (await darkThemeBtn.count() > 0) {
    await darkThemeBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 10-dark-mode-gpu-closeup.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-dark-mode-gpu-closeup.png') });

  console.log('Console Errors:', consoleErrors);
  await browser.close();
  console.log('All 10 GPU Realism & Light Mode screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Failed to capture GPU realism screenshots:', err);
  process.exit(1);
});
