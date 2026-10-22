import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import type { QuestionData } from '../../src/lib/public-types';

test('saved transcript is lazy inert evidence with exact downloadable bytes', async ({ page }) => {
  const releaseId = JSON.parse(await readFile('public/data/latest.json', 'utf8')).release_id;
  const release = JSON.parse(await readFile(`public/data/releases/${releaseId}/release.json`, 'utf8'));
  async function bytes(id: string) {
    const object = release.objects.find((o: { id: string }) => o.id === id);
    const stored = await readFile(`public/data/${object.path}`);
    return object.encoding === 'gzip' ? gunzipSync(stored) : stored;
  }
  let selected: { data: QuestionData; attemptId: string; objectId: string; part: number; count: number } | undefined;
  for (const id of Object.values(release.question_objects)) {
    const data: QuestionData = JSON.parse((await bytes(id as string)).toString());
    for (const attempt of data.attempts) {
      if (!attempt.canonical) continue;
      const ids = attempt.components.artifacts.object_ids;
      const part = ids.findIndex(id => data.objects.find(o => o.id === id)?.media_type === 'text/plain');
      if (part >= 0) { selected = { data, attemptId: attempt.id, objectId: ids[part]!, part, count: ids.length }; break; }
    }
    if (selected) break;
  }
  expect(selected, 'Real release must include a permitted saved transcript').toBeTruthy();
  const { data, attemptId, objectId, part, count } = selected!;
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto(`/questions/${data.question.id}/?attempt=${attemptId}`);
  await expect(page.locator('.selected-attempt')).toHaveAttribute('data-attempt-id', attemptId);
  const details = page.locator('details').filter({ has: page.getByText('Code and saved file changes', { exact: true }) });
  await expect(page.getByRole('region', { name: 'Final answer text', exact: true }).or(page.locator('.reading-answer > .evidence').first().locator('.evidence-empty, .evidence-status'))).toBeVisible();
  expect(requests.some(url => url.includes(objectId))).toBe(false);
  await details.locator('summary').click();
  await expect(details.locator('pre')).toBeVisible();
  await expect(details).toContainText('not an original starting workspace');
  expect(await details.locator('pre script, pre iframe, pre img').count()).toBe(0);
  const download = page.waitForEvent('download');
  await details.getByRole('button', { name: count === 1 ? 'Download original code and saved files' : `Download original code and saved files, part ${part + 1} of ${count}`, exact: true }).click();
  const saved = await download;
  expect(await readFile((await saved.path())!)).toEqual(await bytes(objectId));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
