import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { localHeaders } from '../../scripts/deployment-config.mjs';
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));

test('browser enforces deployment CSP while overview, archive and evidence remain usable', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => (window as any).__cspViolations.push(event.violatedDirective));
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4321') return route.abort();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...localHeaders(config, url.pathname) } });
  });
  await page.goto('/');
  await page.getByLabel('Color theme').selectOption('dark');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.getByRole('button', { name: /^Compare / }).first().click();
  await expect(page.getByLabel('Comparison selection')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__cspViolations)).toEqual([]);
  await page.goto('/editions/');
  await page.locator('a[href^="/archive/"]').first().click();
  await page.locator('a[href*="checkpoint="]').first().click();
  await expect(page.getByRole('heading', { name: 'This model’s answers, code and tool activity', exact: true })).toBeVisible();
  await page.locator('a[href*="question="]').first().click();
  await expect(page.locator('.evidence pre').first()).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download original / }).first().click();
  expect(await (await download).failure()).toBeNull();
  expect(await page.evaluate(() => (window as any).__cspViolations)).toEqual([]);
  expect(errors).toEqual([]);
  await page.evaluate(() => { const script = document.createElement('script'); script.textContent = 'window.__unexpectedExecution = true'; document.body.append(script); });
  await expect.poll(() => page.evaluate(() => (window as any).__cspViolations.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).__unexpectedExecution)).toBeUndefined();
});
