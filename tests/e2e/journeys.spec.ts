import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import type { OverviewData } from '../../src/lib/public-types';

test('overview reaches a model and exact recorded evidence without eager evidence downloads', async ({ page }, testInfo) => {
  const objectRequests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => { if (request.url().includes('/data/objects/')) objectRequests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByLabel('Find a model')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true });
  await page.getByLabel('Find a model').fill('qwen');
  await expect(page.getByLabel('Find a model')).toHaveValue('qwen');
  expect(objectRequests).toEqual([]);
  await page.locator('table a[href^="/models/"]').first().click();
  await expect(page.getByRole('heading', { name: 'Tested weights' })).toBeVisible();
  await page.locator('table a[href^="/tests/"]').first().click();
  await page.locator('a[href^="/questions/"]').first().click();
  await expect(page.locator('.evidence pre').first()).toBeVisible();
  await expect(page.locator('.evidence pre').first()).not.toBeEmpty();
  expect(objectRequests.length).toBeGreaterThan(0);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download text', exact: true }).first().click();
  const download = await downloaded;
  const bytes = await readFile((await download.path())!);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(download.suggestedFilename().replace('.txt', ''));
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('comparison retains its selection and suite through direct links and browser history', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Compare / }).nth(0).click();
  await page.getByRole('button', { name: /^Compare / }).nth(1).click();
  await page.getByRole('link', { name: 'Compare →', exact: true }).click();
  const pinned = page.url();
  const initialSuite = await page.getByLabel('Test suite', { exact: true }).inputValue();
  const nextSuite = await page.locator('#compare-suite option').evaluateAll(options => (options as HTMLOptionElement[]).find(o => !o.selected)!.value);
  await page.getByLabel('Test suite', { exact: true }).selectOption(nextSuite);
  await expect(page).not.toHaveURL(pinned);
  await page.goBack();
  await expect(page.getByLabel('Test suite', { exact: true })).toHaveValue(initialSuite);
  await page.reload();
  await expect(page.locator('.comparison-grid').first().locator('section')).toHaveCount(2);
  await page.getByRole('button', { name: 'Open recorded answers' }).click();
  await expect(page.getByRole('heading', { name: 'Original question', exact: true })).toBeVisible();
  await expect(page.locator('.evidence pre').first()).toBeVisible();
  const linkedQuestion = await page.getByLabel('Question', { exact: true }).inputValue();
  await page.reload();
  await expect(page.getByLabel('Question', { exact: true })).toHaveValue(linkedQuestion);
  await expect(page.locator('.evidence pre').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('comparison.png'), fullPage: true });
  expect(new URL(page.url()).searchParams.getAll('selection')).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('unavailable pinned editions explain the failure', async ({ page }) => {
  await page.goto('/compare/?release=unavailable&suite=unknown');
  await expect(page.getByText('This results edition is unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Test suite', { exact: true })).toHaveCount(0);
});

test('theme choice overrides the system and survives navigation', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByLabel('Color theme').selectOption('light');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await page.getByRole('link', { name: 'Models', exact: true }).click();
  await expect(page.getByLabel('Color theme')).toHaveValue('light');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await page.getByLabel('Color theme').selectOption('system');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
});

test('model selection restores its condition and links to that exact answer', async ({ page }, testInfo) => {
  await page.goto('/models/qwen2b/');
  await expect(page.getByRole('heading', { name: 'Thinking tradeoff', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sampled repetitions', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Suggested comparisons', exact: true })).toBeVisible();
  const selectionRule = page.getByText('Selection rule and evidence IDs', { exact: true }).first();
  await selectionRule.click();
  await expect(selectionRule.locator('..')).toContainText('comparisons-v3');
  await expect(selectionRule.locator('..')).toContainText('Template ');
  await page.screenshot({ path: testInfo.outputPath('model.png'), fullPage: true });
  const conditionSelect = page.getByLabel('Thinking condition', { exact: true });
  const before = await conditionSelect.inputValue();
  const after = await conditionSelect.locator('option').evaluateAll(options => (options as HTMLOptionElement[]).find(o => !o.selected)!.value);
  await conditionSelect.selectOption(after);
  await page.reload();
  await expect(conditionSelect).toHaveValue(after);
  await expect(page.getByRole('heading', { name: 'This model’s answers, code and tool activity', exact: true })).toBeVisible();
  const evidence = page.locator('a[href^="/questions/"]').first();
  const expectedCondition = new URL((await evidence.getAttribute('href'))!, page.url()).searchParams.get('condition');
  await evidence.click();
  await expect(page.getByLabel('Tested configuration and trial')).not.toHaveValue('');
  await expect(page.locator('#answer-model option:checked')).toContainText(/thinking on/i);
  expect(new URL(page.url()).searchParams.get('condition')).toBe(expectedCondition);
  await page.goBack();
  await page.goBack();
  await expect(conditionSelect).toHaveValue(before);
});

test('saved thinking diagnoses stay specific while the prior edition retains its labels', async ({ page }) => {
  async function edition(id: string) {
    const manifest = await (await page.request.get(`/data/releases/${id}/release.json`)).json();
    const object = manifest.objects.find((o: { id: string }) => o.id === manifest.index_object_id);
    const bytes = await (await page.request.get(`/data/${object.path}`)).body();
    // The HTTP client may already have decoded Content-Encoding: gzip.
    const decoded = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
    expect(createHash('sha256').update(decoded).digest('hex')).toBe(object.id);
    const index = JSON.parse(decoded.toString()) as OverviewData;
    return { manifest, index };
  }
  const latest = await (await page.request.get('/data/latest.json')).json();
  const current = await edition(latest.release_id);
  for (const slug of ['lfm1b', 'lfm8b']) {
    await page.goto(`/models/${slug}/`);
    const conditionId = await page.getByLabel('Thinking condition', { exact: true }).inputValue();
    const diagnosis = current.index.conditions.find(c => c.id === conditionId)!.verification.replaceAll('_', ' ');
    await expect(page.locator('#model-condition option:checked')).toContainText(diagnosis);
    await page.getByText('Recorded settings and thinking verification', { exact: true }).click();
    await expect(page.getByText(`Thinking status: ${diagnosis}`, { exact: false })).toBeVisible();
    await page.goto('/');
    const actual = current.index.conditions.find(c => c.id === conditionId)!;
    await page.getByLabel('Thinking', { exact: true }).selectOption(actual.observed_reasoning === 'enabled' ? 'on' : actual.reasoning_requested);
    await page.getByRole('button', { name: 'Show all results', exact: true }).click();
    const row = page.locator('tr').filter({ has: page.locator(`a[href^="/models/${slug}/"]`) });
    await expect(row.getByText(`Thinking control: ${diagnosis}`, { exact: true })).toBeVisible();
    await row.getByText('Setup and weight sources', { exact: true }).click();
    await expect(row.getByText('Requested off does not prove an absence of reasoning.', { exact: false })).toBeVisible();
    await expect(row.getByText('Weight identity:', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  const previous = current.manifest.changes.previous_release_id;
  expect(previous).toMatch(/^release-/);
  const old = await edition(previous);
  const checkpoint = old.index.checkpoints.find(c => c.slug === 'lfm1b')!;
  await page.goto(`/archive/?release=${previous}&checkpoint=${checkpoint.id}`);
  const conditionId = await page.getByLabel('Thinking condition', { exact: true }).inputValue();
  const priorDiagnosis = old.index.conditions.find(c => c.id === conditionId)!.verification.replaceAll('_', ' ');
  await expect(page.locator('#model-condition option:checked')).toContainText(priorDiagnosis);
  expect(new URL(page.url()).searchParams.get('release')).toBe(previous);
});

test('overview filters round trip and the shared tray allows deliberate removal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Reasoning', exact: true }).click();
  await page.getByLabel('Find a model').fill('qwen');
  await page.reload();
  await expect(page.getByLabel('Find a model')).toHaveValue('qwen');
  await expect(page.getByRole('button', { name: 'Reasoning', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Coding & tools', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Compare / }).first().click();
  await page.locator('table a[href^="/models/"]').first().click();
  await expect(page.getByRole('button', { name: 'Remove from comparison', exact: true })).toBeVisible();
  await page.getByText('Review or remove selections', { exact: true }).click();
  await page.getByRole('button', { name: /^Remove .*, thinking/i }).click();
  await expect(page.getByLabel('Comparison selection')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add to comparison', exact: true })).toBeVisible();
});

test('edition contents preserve model and question links and reject mismatched suites', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/editions/');
  await page.locator('a[href^="/archive/"]').first().click();
  const edition = new URL(page.url()).searchParams.get('release');
  await expect(page.getByRole('heading', { name: 'Models in this edition' })).toBeVisible();
  await page.locator('a[href*="checkpoint="]').first().click();
  await expect(page.getByLabel('Thinking condition', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This model’s answers, code and tool activity', exact: true })).toBeVisible();
  await page.locator('a[href*="question="]').first().click();
  await expect(page.getByRole('heading', { name: 'Original question', exact: true })).toBeVisible();
  await expect(page.locator('.evidence pre').first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get('release')).toBe(edition);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const invalid = new URL(page.url()); invalid.searchParams.set('suite', 'missing');
  await page.goto(invalid.toString());
  await expect(page.getByRole('alert')).toContainText('test version is unavailable');
  expect(errors).toEqual([]);
});
