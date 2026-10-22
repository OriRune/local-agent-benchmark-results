import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import type { QuestionData } from '../../src/lib/public-types';

for (const archived of [false, true]) test(`${archived ? 'archived' : 'current'} answer pages keep selected attempts and filters through reload and Back`, async ({ page }) => {
  const releaseId = JSON.parse(await readFile('public/data/latest.json', 'utf8')).release_id;
  const release = JSON.parse(await readFile(`public/data/releases/${releaseId}/release.json`, 'utf8'));
  let data: QuestionData | undefined;
  for (const id of Object.values(release.question_objects)) {
    const record = release.objects.find((o: { id: string }) => o.id === id);
    const bytes = await readFile(`public/data/${record.path}`);
    const candidate: QuestionData = JSON.parse((record.encoding === 'gzip' ? gunzipSync(bytes) : bytes).toString());
    if (candidate.attempts.filter(a => a.canonical).length > 25 && candidate.attempts.some(a => a.canonical && a.supersedes_attempt_ids.length)) { data = candidate; break; }
  }
  expect(data, 'Representative question needs more than one list page and historical attempts').toBeTruthy();
  const selected = data!.attempts.find(a => a.canonical && a.supersedes_attempt_ids.length)!;
  const query = new URLSearchParams({ attempt: selected.id });
  if (archived) { query.set('release', releaseId); query.set('question', data!.question.id); }
  await page.goto(`${archived ? '/archive/' : `/questions/${data!.question.id}/`}?${query}`);
  const list = page.locator('.answer-list'), open = page.locator('.selected-attempt');
  await expect(open).toHaveAttribute('data-attempt-id', selected.id);
  const firstRow = await list.locator('.answer-rows a').first().getAttribute('href');
  await list.getByRole('button', { name: 'Next 25 answers', exact: true }).click();
  await expect(page).toHaveURL(/answer_page=2/);
  await expect(list.locator('.answer-list-range')).toContainText('Showing recorded answers 26–');
  expect(await list.locator('.answer-rows a').first().getAttribute('href')).not.toBe(firstRow);
  await expect(open).toHaveAttribute('data-attempt-id', selected.id);
  expect(await list.locator('.answer-rows li').count()).toBeLessThanOrEqual(25);
  await page.reload();
  await expect(open).toHaveAttribute('data-attempt-id', selected.id);
  await expect(list.getByRole('navigation')).toContainText('List page 2');
  await list.getByRole('searchbox').fill('no such recorded model 123456');
  await expect(list.locator('.answer-list-range')).toContainText('No recorded answers match these filters.');
  await expect(open).toHaveAttribute('data-attempt-id', selected.id);
  await expect(list.locator('.answer-rows li')).toHaveCount(0);
  await list.getByRole('button', { name: 'Reset answer filters', exact: true }).click();
  const category = selected.assessment?.category ?? selected.status;
  await list.getByLabel('Answer outcome', { exact: true }).selectOption(category);
  await expect(open).toHaveAttribute('data-attempt-id', selected.id);
  await page.reload();
  await expect(list.getByLabel('Answer outcome', { exact: true })).toHaveValue(category);
  const history = page.locator('details').filter({ has: page.getByText(`Previous attempts and grades (${selected.supersedes_attempt_ids.length})`, { exact: true }) });
  await history.locator('summary').click();
  const historicalId = selected.supersedes_attempt_ids[0]!;
  await history.getByRole('link', { name: `Open historical attempt ${historicalId}`, exact: true }).click();
  await expect(open).toHaveAttribute('data-attempt-id', historicalId);
  await expect(page.getByText('Historical · not counted in current score', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('answer_status')).toBe(category);
  if (archived) expect(new URL(page.url()).searchParams.get('release')).toBe(releaseId);
  await page.goBack();
  await expect(open).toHaveAttribute('data-attempt-id', selected.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
