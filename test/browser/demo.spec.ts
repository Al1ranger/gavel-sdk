import { test, expect } from '@playwright/test';

for (const width of [375, 768, 1440]) {
  test(`builder and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    // External availability is tested by live-check.ts; this test checks visible failure handling.
    await page.route('**/api/markets', route => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Provider unavailable' }) }));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('#market-status')).toContainText('Provider unavailable');
    await page.locator('[name=deadline]').fill('2024-01-01T00:00');
    await page.locator('[name=source]').fill('https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us7000m9g4.geojson');
    await page.locator('[name=interpretation]').fill('Read reviewed magnitude for this event.');
    await page.locator('[name=rule]').fill('YES for magnitude at least 7.4; NO otherwise.');
    await page.getByRole('button', { name: 'Generate contract', exact: true }).click();
    await expect(page.locator('#build-status')).toContainText('Contract generated');
    await expect(page.getByRole('button', { name: 'Download Python contract' })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/demo-${width}.png`, fullPage: true });
  });
}
