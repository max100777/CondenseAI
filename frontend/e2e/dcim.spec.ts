import { test, expect } from "@playwright/test";
test("campus operations, equipment, scenarios and reporting", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Campus overview" }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".dc-kpis")).toContainText("10.752");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.screenshot({ path: info.outputPath("campus.png") });
  await page
    .getByRole("button", { name: "Cooling systems", exact: true })
    .click();
  await page.getByLabel("Locate rack").selectOption("17");
  await page
    .getByLabel("Fault at selected asset")
    .selectOption("CRAH shutdown");
  await page.getByLabel("Replay time (s)").fill("180");
  await expect(page.locator(".dc-inspect")).toContainText("Active warning");
  await page
    .getByRole("button", { name: "Electrical paths", exact: true })
    .click();
  await page
    .getByLabel("Fault at selected asset")
    .selectOption("UPS A failure");
  await expect(page.locator(".dc-controls")).not.toHaveCount(0);
  await expect(page.getByText(/PDU A · 0 \/ 12 kW/)).toBeVisible();
  await page
    .getByRole("button", { name: "Rack explorer", exact: true })
    .click();
  await page.getByRole("button", { name: "View rear" }).click();
  await page.getByRole("button", { name: "X-ray off" }).click();
  await page.getByLabel("Installed device").selectOption({ index: 1 });
  await page.screenshot({ path: info.outputPath("rack.png") });
  await page
    .getByRole("button", { name: "Capacity planning", exact: true })
    .click();
  await page.getByLabel("IT allocation (kW)").fill("10");
  await page.getByRole("button", { name: "Apply & save locally" }).click();
  await expect(page.locator(".dc-kpis")).toContainText("15.358");
  await page
    .getByRole("button", { name: "Energy report", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export rack inventory CSV" }).click();
  expect((await download).suggestedFilename()).toBe(
    "simulated-rack-inventory.csv",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
