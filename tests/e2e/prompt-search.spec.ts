import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import type { OverviewData } from '../../src/lib/public-types';
import type { BankSearch } from '../../src/lib/question-bank';

for (const archived of [false, true]) test(`${archived ? 'pinned' : 'current'} question search uses full permitted prompts and canonical outcomes`, async ({ page }) => {
  const releaseId = JSON.parse(await readFile('public/data/latest.json', 'utf8')).release_id;
  const release = JSON.parse(await readFile(`public/data/releases/${releaseId}/release.json`, 'utf8'));
  async function object(id: string) {
    const record = release.objects.find((o: { id: string }) => o.id === id);
    const bytes = await readFile(`public/data/${record.path}`);
    return JSON.parse((record.encoding === 'gzip' ? gunzipSync(bytes) : bytes).toString());
  }
  const index: OverviewData = await object(release.index_object_id);
  const suite = index.suites.find(s => s.family_id === 'basic')!;
  const objectId = index.search_objects![suite.id]!;
  const search: BankSearch = await object(objectId);
  const row = search.questions.find(row => row.prompt.length > 20)!;
  const phrase = row.prompt.split('\n').find(line => line.trim().length > 20)!.trim().slice(0, 60);
  const question = index.questions.find(q => q.id === row.question_id)!;
  expect(`${question.source_id} ${question.title}`.toLowerCase()).not.toContain(phrase.toLowerCase());
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  await page.goto(archived ? `/archive/?release=${releaseId}&suite=${suite.id}` : `/tests/${suite.id}/`);
  const bank = page.locator('.question-bank');
  await expect(bank).toBeVisible();
  expect(requests.some(url => url.includes(objectId))).toBe(false);
  await bank.getByRole('searchbox').fill(phrase);
  await expect(bank.getByLabel('Recorded outcome', { exact: true })).toBeEnabled();
  const matching = index.questions.filter(q => q.suite_id === suite.id && `${q.source_id} ${q.title} ${search.questions.find(r => r.question_id === q.id)?.prompt || ''}`.toLowerCase().includes(phrase.toLowerCase()));
  await expect(bank.locator('li')).toHaveCount(Math.min(matching.length, 20));
  await expect(bank).toContainText(question.source_id);
  await bank.getByRole('button', { name: 'Clear question filters', exact: true }).click();
  await bank.getByLabel('Recorded outcome', { exact: true }).selectOption('zero');
  const zero = search.questions.filter(q => q.outcomes.some(o => o.credit === 'zero'));
  await expect(bank.locator('li')).toHaveCount(Math.min(zero.length, 20));
  await page.reload();
  await expect(bank.getByLabel('Recorded outcome', { exact: true })).toHaveValue('zero');
  await expect(bank.getByLabel('Recorded outcome', { exact: true })).toBeEnabled();
  await expect(bank.locator('li')).toHaveCount(Math.min(zero.length, 20));
  if (archived) expect(new URL(page.url()).searchParams.get('release')).toBe(releaseId);
});
