import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import type { PublicResultsReleaseV1 } from '../../src/lib/public-release';

test('long real evidence is fully paginated, searchable and downloadable', async ({ page }) => {
  const selected = JSON.parse(await readFile('public/data/latest.json', 'utf8'));
  const release: PublicResultsReleaseV1 = JSON.parse(await readFile(`public/data/releases/${selected.release_id}/release.json`, 'utf8'));
  const object = release.objects.find(object => object.bytes > 48_000 && object.bytes < 80_000);
  expect(object, 'Representative release must contain long evidence').toBeTruthy();
  const stored = await readFile(`public/data/${object!.path}`);
  const bytes = object!.encoding === 'gzip' ? gunzipSync(stored) : stored;
  const text = new TextDecoder().decode(bytes);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/evidence/?release=${release.release_id}&object=${object!.id}`);
  const pre = page.locator('pre[aria-label="Saved object text"]');
  await expect(pre).toBeVisible();
  let reconstructed = '';
  do {
    const part = await pre.textContent();
    expect(part!.length).toBeLessThanOrEqual(24_000);
    reconstructed += part;
    if (await page.getByRole('button', { name: 'Next part', exact: true }).isDisabled()) break;
    const before = await page.getByRole('group', { name: 'Saved object parts' }).textContent();
    await page.getByRole('button', { name: 'Next part', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Saved object parts' })).not.toHaveText(before!);
  } while (reconstructed.length < text.length);
  expect(reconstructed).toBe(text);
  const query = text.slice(-40).trim();
  await page.getByLabel('Find in saved object (case-sensitive)').fill(query);
  await page.getByRole('button', { name: 'Find next', exact: true }).click();
  await expect(pre.locator('mark')).not.toBeEmpty();
  await page.getByLabel('Find in saved object (case-sensitive)').fill('no-such-evidence-phrase-4bd6ab8e');
  await page.getByRole('button', { name: 'Find next', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No match in the complete text.');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download original saved object', exact: true }).click();
  const result = await download;
  expect(createHash('sha256').update(await readFile((await result.path())!)).digest('hex')).toBe(object!.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('long public question IDs fit the screen and both evidence downloads remain clickable', async ({ page }) => {
  const selected = JSON.parse(await readFile('public/data/latest.json', 'utf8'));
  const release: PublicResultsReleaseV1 = JSON.parse(await readFile(`public/data/releases/${selected.release_id}/release.json`, 'utf8'));
  async function bytes(id: string) {
    const object = release.objects.find(o => o.id === id)!;
    const stored = await readFile(`public/data/${object.path}`);
    return object.encoding === 'gzip' ? gunzipSync(stored) : stored;
  }
  const index = JSON.parse((await bytes(release.index_object_id)).toString());
  const q = [...index.questions].sort((a, b) => b.source_id.length - a.source_id.length)[0];
  const data = JSON.parse((await bytes(release.question_objects[q.id]!)).toString());
  const attempt = data.attempts.find((a: { canonical: boolean; status: string; components: { answer: { object_ids: string[] } } }) => a.canonical && a.status === 'scored' && a.components.answer.object_ids.length);
  expect(attempt).toBeTruthy();
  await page.goto(`/questions/${q.id}/?attempt=${attempt.id}`);
  await expect(page.locator('.selected-attempt')).toHaveAttribute('data-attempt-id', attempt.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(page.viewportSize()!.width);
  for (const [label, component] of [['Question', data.question.components.prompt], ['Final answer', attempt.components.answer]] as const) {
    const pre = page.getByRole('region', { name: `${label} text`, exact: true });
    await expect(pre).toBeVisible();
    const evidence = page.locator('.evidence').filter({ has: pre });
    const downloaded = page.waitForEvent('download');
    await evidence.getByRole('button', { name: component.object_ids.length === 1 ? `Download original ${label.toLowerCase()}` : `Download original ${label.toLowerCase()}, part 1 of ${component.object_ids.length}`, exact: true }).click();
    expect(await readFile((await (await downloaded).path())!)).toEqual(await bytes(component.object_ids[0]));
  }
});
