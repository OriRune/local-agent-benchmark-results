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
    if (candidate.attempts.filter(a => a.canonical).length > 20 && candidate.attempts.some(a => a.canonical && a.supersedes_attempt_ids.length)) { data = candidate; break; }
  }
  expect(data, 'Representative question needs multiple answer pages and historical attempts').toBeTruthy();
  const selected = data!.attempts.find(a => a.canonical && a.supersedes_attempt_ids.length)!;
  const query = new URLSearchParams({ attempt: selected.id });
  if (archived) { query.set('release', releaseId); query.set('question', data!.question.id); }
  await page.goto(`${archived ? '/archive/' : `/questions/${data!.question.id}/`}?${query}`);
  const picker = page.locator('.answer-picker'), select = page.getByLabel('Tested configuration and trial', { exact: true });
  await expect(select).toHaveValue(selected.id);
  await picker.getByRole('button', { name: 'Next answers', exact: true }).click();
  await expect(page).toHaveURL(/answer_page=2/);
  await expect(select).toHaveValue(selected.id);
  expect(await select.locator('option').count()).toBeLessThanOrEqual(21);
  await page.reload();
  await expect(select).toHaveValue(selected.id);
  await expect(picker.getByRole('navigation')).toContainText('Page 2');
  await picker.getByRole('searchbox').fill('no such recorded model 123456');
  await expect(picker.getByRole('status')).toContainText('No matching answers.');
  await expect(select).toHaveValue(selected.id);
  await expect(select.locator('option')).toHaveCount(1);
  await picker.getByRole('button', { name: 'Reset answer filters', exact: true }).click();
  await picker.getByLabel('Answer outcome', { exact: true }).selectOption('scored');
  await expect(select).toHaveValue(selected.id);
  await page.reload();
  await expect(picker.getByLabel('Answer outcome', { exact: true })).toHaveValue('scored');
  const history = page.locator('details').filter({ has: page.getByText(`Previous attempts and grades (${selected.supersedes_attempt_ids.length})`, { exact: true }) });
  await history.locator('summary').click();
  const historicalId = selected.supersedes_attempt_ids[0]!;
  await history.getByRole('button', { name: `Open historical attempt ${historicalId}`, exact: true }).click();
  await expect(select).toHaveValue(historicalId);
  await expect(page.getByText('Historical · not counted in current score', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('answer_status')).toBe('scored');
  if (archived) expect(new URL(page.url()).searchParams.get('release')).toBe(releaseId);
  await page.goBack();
  await expect(select).toHaveValue(selected.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
