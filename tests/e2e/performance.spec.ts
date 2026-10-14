import { expect, test } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { comparisonUrl } from '../../src/lib/comparison';

test('real homepage stays within payload budgets under mobile throttling', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'One recorded mobile throttle profile');
  const selected = JSON.parse(await readFile('public/data/latest.json', 'utf8'));
  const release = JSON.parse(await readFile(`public/data/releases/${selected.release_id}/release.json`, 'utf8'));
  const index = release.objects.find((object: { id: string }) => object.id === release.index_object_id);
  const indexStored = await readFile(`public/data/${index.path}`);
  const indexGzipBytes = index.encoding === 'gzip' ? indexStored.length : gzipSync(indexStored).length;
  const scripts: Promise<{ path: string; gzipBytes: number }>[] = [];
  const evidenceRequests: string[] = [], errors: string[] = [];
  page.on('request', request => { if (request.url().includes('/data/objects/')) evidenceRequests.push(request.url()); });
  page.on('response', response => {
    if (new URL(response.url()).pathname.endsWith('.js')) scripts.push(response.body().then(bytes => ({
      path: new URL(response.url()).pathname, gzipBytes: gzipSync(bytes).length,
    })));
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).__renderAudit = { largestContentfulPaintMs: null, layoutShift: 0 };
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) (window as any).__renderAudit.largestContentfulPaintMs = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as any) if (!entry.hadRecentInput) (window as any).__renderAudit.layoutShift += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const begin = Date.now();
  await page.goto('/');
  await page.getByRole('button', { name: /^Compare / }).first().click();
  await expect(page.getByLabel('Comparison selection')).toBeVisible();
  const interactiveMs = Date.now() - begin;
  await page.waitForLoadState('networkidle');
  const scriptSizes = await Promise.all(scripts);
  const inline = await page.locator('script:not([src])').evaluateAll(nodes => nodes
    .filter(node => !node.getAttribute('type') || node.getAttribute('type') === 'module')
    .map(node => node.textContent ?? '').join('\n'));
  const scriptGzipBytes = scriptSizes.reduce((sum, script) => sum + script.gzipBytes, 0) + gzipSync(inline).length;
  const serializedProps = await page.locator('astro-island[props]').evaluateAll(nodes => nodes.map(node => node.getAttribute('props') ?? '').join('\n'));
  const homepagePropsGzipBytes = gzipSync(serializedProps).length;
  const report = {
    releaseId: release.release_id, measuredAt: new Date().toISOString(), viewport: { width: 360, height: 800 },
    profile: { cpuSlowdown: 4, latencyMs: 150, downloadBitsPerSecond: 1_600_000, cache: 'disabled' },
    compression: 'gzip of decoded resources; preview transport compression is not assumed',
    indexGzipBytes, homepagePropsGzipBytes, scriptGzipBytes, scriptSizes, interactiveMs,
    rendering: await page.evaluate(() => (window as any).__renderAudit), evidenceRequests, errors,
    scope: 'One local Chromium mobile-profile run. Not a field Core Web Vitals measurement or universal accessibility certification.',
  };
  await mkdir('.publication-reports', { recursive: true });
  await writeFile('.publication-reports/performance-mobile.json', JSON.stringify(report, null, 2) + '\n');
  await info.attach('performance-mobile', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath('throttled-mobile.png'), fullPage: true });
  expect(indexGzipBytes).toBeLessThanOrEqual(250 * 1024);
  expect(homepagePropsGzipBytes).toBeLessThanOrEqual(250 * 1024);
  expect(scriptGzipBytes).toBeLessThanOrEqual(200 * 1024);
  expect(evidenceRequests).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('keyboard users can skip navigation, filter models and open a result', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to results', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  const search = page.getByLabel('Find a model', { exact: true });
  for (let i = 0; i < 45 && !await search.evaluate(element => element === document.activeElement); i++) await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  await page.keyboard.type('qwen');
  await expect(search).toHaveValue('qwen');
  await expect(page).toHaveURL(/q=qwen/);
  const table = page.locator('.table-scroll').first();
  for (let i = 0; i < 20 && !await table.evaluate(element => element === document.activeElement); i++) await page.keyboard.press('Tab');
  await expect(table).toBeFocused();
  if (await table.evaluate(element => element.scrollWidth > element.clientWidth)) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  }
  const model = page.locator('table a[href^="/models/"]').first();
  for (let i = 0; i < 20 && !await model.evaluate(element => element === document.activeElement); i++) await page.keyboard.press('Tab');
  await expect(model).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Tested weights' })).toBeVisible();
});

test('model, comparison and question remain usable on the throttled mobile profile', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'One recorded mobile throttle profile');
  const selected = JSON.parse(await readFile('public/data/latest.json', 'utf8'));
  const release = JSON.parse(await readFile(`public/data/releases/${selected.release_id}/release.json`, 'utf8'));
  const object = release.objects.find((object: { id: string }) => object.id === release.index_object_id);
  const bytes = await readFile(`public/data/${object.path}`);
  const index = JSON.parse((object.encoding === 'gzip' ? gunzipSync(bytes) : bytes).toString());
  const suite = index.suites.find((suite: any) => suite.family_id === 'basic');
  const selections = index.configurations.slice(0, 2).map((config: any) => ({ configurationId: config.id,
    conditionId: index.conditions.find((condition: any) => condition.configuration_id === config.id && condition.kind === 'baseline' && condition.reasoning_requested === 'off').id }));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const errors: string[] = [], observations = [];
  page.on('pageerror', error => errors.push(error.message));
  const routes = [
    { name: 'model', url: `/models/${index.checkpoints[0].slug}/` },
    { name: 'comparison', url: comparisonUrl({ releaseId: release.release_id, suiteId: suite.id, selections }) },
    { name: 'question', url: `/questions/${index.questions.find((question: any) => question.suite_id === suite.id).id}/` },
  ];
  for (const route of routes) {
    const begin = Date.now();
    await page.goto(route.url);
    if (route.name === 'model') await expect(page.getByRole('heading', { name: 'Tested weights' })).toBeVisible();
    if (route.name === 'comparison') {
      await expect(page.locator('.comparison-grid').first().locator('section')).toHaveCount(2);
      await page.getByRole('button', { name: 'Open recorded answers' }).click();
      await expect(page.locator('.evidence pre').first()).toBeVisible();
    }
    if (route.name === 'question') await expect(page.locator('.evidence pre').first()).toBeVisible();
    const readyMs = Date.now() - begin;
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await page.locator('.evidence pre').evaluateAll(nodes => nodes.every(node => (node.textContent ?? '').length <= 24_000))).toBe(true);
    observations.push({ page: route.name, url: route.url, readyMs,
      horizontallyScrollableTables: await page.locator('.table-scroll').evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth).length) });
    await page.screenshot({ path: info.outputPath(`throttled-${route.name}.png`) });
  }
  const report = { releaseId: release.release_id, measuredAt: new Date().toISOString(),
    profile: '360×800; 4× CPU slowdown; 150 ms latency; 1.6 Mbps download; cache disabled',
    observations, errors, scope: 'Local browser observations; no general accessibility or field performance certification.' };
  await mkdir('.publication-reports', { recursive: true });
  await writeFile('.publication-reports/core-pages-mobile.json', JSON.stringify(report, null, 2) + '\n');
  expect(errors).toEqual([]);
});
