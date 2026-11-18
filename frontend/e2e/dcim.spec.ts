import { test, expect } from '@playwright/test';

test('Integrated Engineering Digital Twin: Campus -> Hall -> Rack -> GPU -> Simulation & Analytics', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 1. Load Campus Overview (Route: /)
  await page.goto('/');
  await expect(page.locator('.dc-brand')).toContainText('CONDENSAI');
  await expect(page.locator('.dc-version-badge')).toContainText('INTEGRATED');

  // Verify KPI summary tiles
  const kpis = page.locator('.dc-kpis');
  await expect(kpis).toContainText('Total IT Power');
  await expect(kpis).toContainText('Heat Exchanger Transfer');
  await expect(kpis).toContainText('AGMD Distillate Rate');

  // Verify 3D canvas is present
  await expect(page.locator('canvas')).toBeVisible();

  // 2. Select Hall A (AI Training)
  await page.getByRole('button', { name: /Hall A/ }).first().click();
  await expect(page.locator('.dc-breadcrumb')).toContainText('Hall A');
  await expect(page.locator('.dc-inspect')).toContainText('Hall A — AI Training');
  await expect(page.locator('.dc-inspect')).toContainText('High-intensity compute');

  // 3. Select Rack A01 inside Hall A
  await page.getByRole('button', { name: 'Rack A01' }).click();
  await expect(page.locator('.dc-breadcrumb')).toContainText('Rack A01');
  await expect(page.locator('.dc-inspect')).toContainText('42U Liquid-Cooled Server Cabinet');

  // 4. Select GPU A01-GPU01 inside Rack A01
  await page.getByRole('button', { name: /GPU A01-GPU01/ }).click();
  await expect(page.locator('.dc-breadcrumb')).toContainText('GPU A01-GPU01');
  await expect(page.locator('.dc-placeholder-alert')).toContainText('Physics Simulation Connected');
  await expect(page.locator('.dc-inspect')).toContainText('Die Junction Temp');

  // 5. Test Path Tracing & Heatmap Selection
  await page.getByRole('button', { name: 'Trace Coolant Circuit' }).click();
  await page.getByRole('combobox', { name: '3D Heatmap' }).selectOption('gpuTemp');

  // 6. Test Run Summary Report Modal
  await page.getByRole('button', { name: 'Run Report' }).click();
  await expect(page.locator('.dc-modal-box')).toContainText('CondensAI Facility Run Summary');
  await expect(page.locator('.dc-modal-box')).toContainText('TOTAL FRESHWATER PRODUCED');
  await page.getByRole('button', { name: 'Close Report' }).click();
  await expect(page.locator('.dc-modal-box')).toHaveCount(0);

  // 7. Back navigation via breadcrumb to Campus
  await page.getByRole('button', { name: 'Campus' }).click();
  await expect(page.locator('.dc-inspect')).toContainText('CAMPUS ENGINEERING CONTEXT');

  // 8. Verify GPU Thermal Lab route (/?lab)
  await page.goto('/?lab');
  await expect(page.getByText('Campus operations')).toBeVisible();

  // Verify no uncaught page errors
  expect(errors).toEqual([]);
});
