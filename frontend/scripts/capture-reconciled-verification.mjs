import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/Yash/.gemini/antigravity/brain/0ce2dbd6-1432-4711-b887-05d2468b73ec/screenshots/reconciled';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching Chrome with SwiftShader for Reconciled Topology & 3D Routing Verification...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });

  const page = await context.newPage();
  console.log('Navigating to http://127.0.0.1:3000/ ...');
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // 1. Full Facility Campus Overview
  console.log('1. Capturing 01-full-facility.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-full-facility.png') });

  // 2. Individual Hall (Focus on Hall A)
  console.log('2. Focusing on Hall A...');
  await page.getByPlaceholder(/Search Hall/).fill('Hall A');
  await page.waitForTimeout(600);
  const hallAItem = page.locator('.dc-search-item').first();
  if (await hallAItem.count() > 0) {
    await hallAItem.click({ force: true });
  }
  await page.waitForTimeout(1500);
  console.log('Capturing 02-individual-hall.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-individual-hall.png') });

  // 3. Cooling Supply and Return
  console.log('3. Activating Cooling Trace Mode...');
  const traceCoolingBtn = page.locator('button:has-text("Trace Rack Coolant")').first();
  if (await traceCoolingBtn.count() > 0) {
    await traceCoolingBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 03-cooling-supply-return.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-cooling-supply-return.png') });

  // 4. Electrical Dual A/B Feeds
  console.log('4. Activating Electrical Dual A/B Trace...');
  const traceElecBtn = page.locator('button:has-text("Trace Dual A/B")').first();
  if (await traceElecBtn.count() > 0) {
    await traceElecBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 04-electrical-ab-feeds.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-electrical-ab-feeds.png') });

  // 5. Network Topology Trace
  console.log('5. Activating Network Fabric Trace...');
  const traceNetBtn = page.locator('button:has-text("Trace ToR Network")').first();
  if (await traceNetBtn.count() > 0) {
    await traceNetBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 05-network-topology.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-network-topology.png') });

  // 6. GPU Connectivity Path (Select Rack A01 and GPU A01-GPU01)
  console.log('6. Selecting Rack A01 and GPU A01-GPU01...');
  await page.getByPlaceholder(/Search Hall/).fill('Rack A01');
  await page.waitForTimeout(600);
  const rackItem = page.locator('.dc-search-item').first();
  if (await rackItem.count() > 0) {
    await rackItem.click({ force: true });
  }
  await page.waitForTimeout(1200);

  const firstGpuRow = page.locator('.dc-gpu-row').first();
  if (await firstGpuRow.count() > 0) {
    await firstGpuRow.click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 06-gpu-connectivity-path.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-gpu-connectivity-path.png') });

  // 7. GPU Tray Inspection (Slide out tray)
  console.log('7. Extending Compute Sled...');
  const slideOutBtn = page.locator('.dc-tray-toggle-btn').first();
  if (await slideOutBtn.count() > 0) {
    await slideOutBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 07-gpu-tray-inspection.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-gpu-tray-inspection.png') });

  // 8. Light Mode
  console.log('8. Toggling to Light Mode...');
  const themeBtns = page.locator('.dc-theme-btn');
  if (await themeBtns.count() >= 2) {
    // Index 1 is Light mode (Sun icon)
    await themeBtns.nth(1).click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 08-light-mode.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-light-mode.png') });

  // 9. Dark Mode
  console.log('9. Toggling back to Dark Mode...');
  if (await themeBtns.count() >= 1) {
    // Index 0 is Dark mode (Moon icon)
    await themeBtns.nth(0).click({ force: true });
    await page.waitForTimeout(1500);
  }
  console.log('Capturing 09-dark-mode.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-dark-mode.png') });

  console.log('All 9 visual verification screenshots successfully captured!');
  await browser.close();
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
