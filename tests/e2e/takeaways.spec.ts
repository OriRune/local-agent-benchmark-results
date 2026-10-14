import { expect, test } from '@playwright/test';

test('homepage observations disclose scope and lead to pinned comparable evidence', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.stamp')).toContainText('Campaign started');
  const region = page.getByRole('region', { name: 'Recorded takeaways', exact: true });
  await expect(region.getByRole('heading', { name: 'Highest observed score in this group', exact: true })).toBeVisible();
  await expect(region).toContainText('complete baseline setups with matching test controls');
  const first = region.locator('article').first();
  await first.getByText('How this observation was selected', { exact: true }).click();
  await expect(first).toContainText('takeaways-v1');
  await expect(first).toContainText('Supporting facts: fact-');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const href = await first.getByRole('link', { name: 'Inspect this comparison →', exact: true }).getAttribute('href');
  const query = new URL(href!, 'http://localhost').searchParams;
  expect(query.get('release')).toMatch(/^release-[a-f0-9]{64}$/);
  expect(query.getAll('selection')).toHaveLength(2);
  const text = await region.innerText();
  await page.getByLabel('Find a model', { exact: true }).fill('no-such-model-xyz');
  await expect.poll(() => region.innerText()).toBe(text);
  await first.getByRole('link', { name: 'Inspect this comparison →', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('release=' + query.get('release')));
  await page.getByRole('button', { name: 'Open recorded answers', exact: true }).click();
  await expect(page.locator('.evidence pre').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
