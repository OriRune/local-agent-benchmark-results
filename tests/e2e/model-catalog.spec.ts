import { expect, test } from '@playwright/test';

test('full catalog search survives direct links and returning from a configuration', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/data/objects/')) requests.push(request.url()); });
  await page.goto('/models/');
  const catalog = page.getByRole('region', { name: 'Model catalog', exact: true });
  const count = await catalog.locator('article').count();
  expect(count).toBeGreaterThan(1);
  const first = catalog.locator('article').first();
  await first.getByText('Configurations and status', { exact: true }).click();
  const config = first.locator('details a').last();
  const href = await config.getAttribute('href');
  const identity = new URL(href!, 'http://localhost').searchParams.get('configuration')!;
  await page.getByLabel('Search all models and configurations', { exact: true }).fill(identity);
  await expect(catalog.locator('article')).toHaveCount(1);
  await expect(page).toHaveURL(new RegExp(`q=${identity}`));
  await page.reload();
  await expect(page.getByLabel('Search all models and configurations', { exact: true })).toHaveValue(identity);
  await expect(catalog.locator('article')).toHaveCount(1);
  expect(requests).toEqual([]);
  await catalog.locator(`a[href="${href}"]`).click();
  await expect(page.getByLabel('Configuration', { exact: true })).toHaveValue(identity);
  await page.goBack();
  await expect(catalog.locator('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear model search', exact: true }).click();
  await expect(catalog.locator('article')).toHaveCount(count);
  await page.getByLabel('Search all models and configurations', { exact: true }).fill('no-such-model-xyz');
  await expect(catalog.getByRole('status')).toContainText('No matching models');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('full catalog retains configuration links without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4321/models/');
    await expect(page.getByLabel('Search all models and configurations', { exact: true })).toBeDisabled();
    expect(await page.locator('details a[href*="configuration="]').count()).toBeGreaterThan(1);
  } finally { await context.close(); }
});
