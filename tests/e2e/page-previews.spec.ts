import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { deploymentConfig, localHeaders } from '../../scripts/deployment-config.mjs';
import { index, releaseId } from './answer-data';
const root = new URL('../../public/previews/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('index.json', root), 'utf8'));
const packets = catalog.previews.map((ref: { sha256: string }) => JSON.parse(readFileSync(new URL(ref.sha256 + '.json', root), 'utf8')));
const available = packets.filter((p: { status: string }) => p.status === 'available');
const absent = packets.find((p: { status: string }) => p.status === 'unavailable');
const path = (id: string) => `/questions/${catalog.question_id}/?attempt=${id}`;

test('retired sheet-music task is absent from current browsing and preserves archived evidence', async ({ page }) => {
  const q = index.questions.find(q => q.source_id === 'real_linux2-R5')!;
  expect(index.suites.find(s => s.id === q.suite_id)!.primary_question_ids).not.toContain(q.id);
  await page.goto(`/tests/${q.suite_id}/`);
  await expect(page.getByRole('searchbox', { name: 'Find a question' })).toBeEnabled();
  await page.getByRole('searchbox', { name: 'Find a question' }).fill('sheet music');
  await expect(page.locator('.question-list a')).toHaveCount(0);
  await expect(page.getByText('No matching questions.', { exact: false })).toBeVisible();
  await page.goto(`/questions/${q.id}/`);
  await expect(page.getByRole('heading', { name: 'Task retired' })).toBeVisible();
  await expect(page.locator('.selected-attempt')).toHaveCount(0);
  await page.getByText('Historical evidence', { exact: true }).click();
  const link = page.getByRole('link', { name: 'View archived task and answers' });
  await expect(link).toHaveAttribute('href', new RegExp(`release=${releaseId}`));
  await link.click();
  await expect(page.locator('.selected-attempt')).toHaveCount(1);
});

test('saved page has correct desktop/mobile images, HTML download and no executable model content', async ({ page }) => {
  const target = available[0], file = target.files[0];
  const config = deploymentConfig(JSON.parse(readFileSync('deployment-scan.json', 'utf8')));
  await page.route('**/questions/**', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...localHeaders(config, new URL(route.request().url()).pathname) } });
  });
  await page.goto(path(target.attempt_id));
  const section = page.locator('.generated-page');
  await expect(section.getByRole('heading', { name: 'The page this model made' })).toBeVisible();
  const image = section.getByRole('img');
  await expect(image).toHaveAttribute('src', 'data:image/png;base64,' + file.views.find((v: { name: string }) => v.name === 'desktop').png_base64);
  await section.getByRole('button', { name: 'Mobile', exact: true }).click();
  await expect(image).toHaveAttribute('width', '390');
  await expect(image).toHaveAttribute('src', 'data:image/png;base64,' + file.views.find((v: { name: string }) => v.name === 'mobile').png_base64);
  await section.getByRole('button', { name: 'Inspect at full size' }).click();
  await expect(section.getByRole('button', { name: 'Fit to column' })).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const pending = page.waitForEvent('download');
  await section.getByRole('button', { name: 'Download saved HTML' }).click();
  const download = await pending; expect(download.suggestedFilename()).toBe(file.filename.split('/').pop());
  const stream = await download.createReadStream(), chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString('utf8')).toBe(file.html);
  await expect(section.locator('iframe, script, object, embed')).toHaveCount(0);
  expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(390);
  await section.screenshot({ path: test.info().outputPath('reading-page.png') });
});

test('switching to an attempt without a saved page clears the previous visual output', async ({ page }) => {
  await page.goto(path(available[0].attempt_id));
  await expect(page.locator('.generated-page img')).toHaveCount(1);
  const search = page.getByRole('searchbox', { name: 'Find model, setup, seed or attempt ID' });
  await search.fill(absent.attempt_id);
  await page.locator('.answer-list a[href*="attempt=' + absent.attempt_id + '"]').click();
  await expect(page.locator('.selected-attempt')).toHaveAttribute('data-attempt-id', absent.attempt_id);
  await expect(page.locator('.generated-page')).toContainText(absent.reason);
  await expect(page.locator('.generated-page img')).toHaveCount(0);
});

test('corrupt preview bytes fail closed and can be retried', async ({ page }) => {
  const target = available[0], ref = catalog.previews.find((r: { attempt_id: string }) => r.attempt_id === target.attempt_id);
  await page.route(`**/previews/${ref.sha256}.json`, route => route.fulfill({ contentType: 'application/json', body: '{}' }));
  await page.goto(path(target.attempt_id));
  await expect(page.locator('.generated-page [role="alert"]')).toContainText('checksum mismatch');
  await expect(page.locator('.generated-page img')).toHaveCount(0);
  await page.unroute(`**/previews/${ref.sha256}.json`);
  await page.getByRole('button', { name: 'Retry preview' }).click();
  await expect(page.locator('.generated-page img')).toHaveCount(1);
});

test('withdrawing source evidence blocks an already loaded HTML download and clears its preview', async ({ page }) => {
  const target = available[0];
  await page.goto(path(target.attempt_id));
  await expect(page.locator('.generated-page img')).toHaveCount(1);
  const id = target.evidence_object_ids[0], reason = 'Source evidence retired for this test.', withdrawn_at = '2026-10-22T00:00:00.000Z';
  await page.route('**/data/withdrawals.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, objects: { [id]: { reason, withdrawn_at, release_ids: [releaseId] } }, editions: { [releaseId]: { reason, withdrawn_at, object_ids: [id] } } }) }));
  let downloads = 0; page.on('download', () => downloads++);
  await page.getByRole('button', { name: 'Download saved HTML' }).click();
  await expect(page.locator('.generated-page [role="alert"]')).toContainText('intentionally withdrawn');
  await expect(page.locator('.generated-page img')).toHaveCount(0);
  expect(downloads).toBe(0);
});
