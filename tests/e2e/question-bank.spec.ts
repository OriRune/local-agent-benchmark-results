import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import type { OverviewData } from '../../src/lib/public-types';

async function bank(archived = false) {
  const edition = archived ? JSON.parse(await readFile('public/data/editions.json', 'utf8'))[0]
    : JSON.parse(await readFile('public/data/latest.json', 'utf8')).release_id;
  const release = JSON.parse(await readFile(`public/data/releases/${edition}/release.json`, 'utf8'));
  const object = release.objects.find((object: { id: string }) => object.id === release.index_object_id);
  const bytes = await readFile(`public/data/${object.path}`);
  const index: OverviewData = JSON.parse((object.encoding === 'gzip' ? gunzipSync(bytes) : bytes).toString());
  const suite = index.suites.find(suite => index.questions.filter(question => question.suite_id === suite.id).length > 20)!;
  expect(suite, 'Representative release must contain a bank with multiple pages').toBeTruthy();
  return { edition, suite, descriptions:index.test_descriptions?.questions, questions: index.questions.filter(question => question.suite_id === suite.id) };
}

for (const archived of [false, true]) test(`${archived ? 'archived' : 'current'} question filters and pages preserve exact links and browser history`, async ({ page }) => {
  const data = await bank(archived);
  const path = archived ? `/archive/?release=${data.edition}&suite=${data.suite.id}` : `/tests/${data.suite.id}/`;
  await page.goto(path);
  const list = page.locator('.question-bank');
  await expect(list.locator('li')).toHaveCount(20);
  await page.getByRole('button', { name: 'Next questions', exact: true }).click();
  await expect(page).toHaveURL(/bank_page=2/);
  await page.reload();
  await expect(list.locator('li').first()).toContainText(data.questions[20].source_id);
  await expect(list.locator('li')).toHaveCount(Math.min(data.questions.length - 20, 20));
  if (archived) expect(new URL(page.url()).searchParams.get('release')).toBe(data.edition);
  const picked = data.questions.at(-1)!;
  await page.getByLabel('Find a question', { exact: true }).fill(picked.source_id);
  await expect(list.locator('li')).toHaveCount(1);
  await expect(page).not.toHaveURL(/bank_page=/);
  const filtered = page.url();
  await list.locator('li a').click();
  if (archived) {
    expect(new URL(page.url()).searchParams.get('release')).toBe(data.edition);
    expect(new URL(page.url()).searchParams.get('question')).toBe(picked.id);
  } else expect(new URL(page.url()).pathname).toBe(`/questions/${picked.id}/`);
  await expect(page.locator('.evidence pre').first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(filtered);
  await expect(page.getByLabel('Find a question', { exact: true })).toHaveValue(picked.source_id);
  await page.getByRole('button', { name: 'Clear question filters', exact: true }).click();
  await page.getByLabel('Question status', { exact: true }).selectOption('excluded');
  const excluded = data.questions.filter(question => question.scoring_status === 'excluded');
  await expect(list.locator('li')).toHaveCount(Math.min(excluded.length, 20));
  if (!excluded.length) await expect(list.getByRole('status')).toContainText('No matching questions.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('static suite pages retain every question link without JavaScript', async ({ browser }) => {
  const data = await bank();
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4321/tests/${data.suite.id}/`);
    await expect(page.locator('a[href^="/questions/"]')).toHaveCount(data.questions.length);
    await expect(page.getByLabel('Find a question', { exact: true })).toBeDisabled();
    await page.locator('a[href^="/questions/"]').last().click();
    const last=data.questions.at(-1)!;
    await expect(page.getByRole('heading', { name: data.descriptions?.[last.id]?.title ?? last.source_id, exact: true })).toBeVisible();
    await expect(page.locator('.question-source')).toContainText(`Source item ${last.source_id}.`);
    expect(new URL(page.url()).pathname).toBe(`/questions/${last.id}/`);
  } finally { await context.close(); }
});
