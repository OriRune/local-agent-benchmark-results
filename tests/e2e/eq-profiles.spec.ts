import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync} from 'node:fs';
const raw = JSON.parse(readFileSync(new URL('../../src/data/eq/leaderboard.json', import.meta.url), 'utf8')) as {models:{id:string;abilities:Record<string,number>}[];dimensions:string[]};

test('profiles support comparisons, definitions and narrow screens without premature summaries', async ({page}) => {
  await page.goto('/eq/models/or-gemma-4-31b/');
  await expect(page.locator('[data-radar]')).toHaveCount(3);
  await expect(page.locator('#summary')).toContainText('Waiting for complete results');
  const radar = page.locator('[data-radar]').first();
  const select = radar.getByRole('combobox');
  const target = await select.locator('option').nth(1).getAttribute('value');
  const before = await radar.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL());
  await select.selectOption(target!);
  expect(await radar.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL())).not.toBe(before);
  const selectedName = await select.locator('option:checked').textContent();
  await expect(radar.locator('[data-comparison-note]')).toContainText(selectedName!);
  await radar.getByText('View chart values', {exact:true}).click();
  await expect(radar.locator('[data-comparison-header]')).toHaveText(selectedName!);
  const expected = raw.models.find(m=>m.id===target)!.abilities as Record<string,number>;
  expect(await radar.locator('[data-comparison-value]').allTextContents()).toEqual(raw.dimensions.map(d=>expected[d]?.toFixed(1) ?? 'Not scored'));
  await page.getByText('Exact trait scores, uncertainty and definitions', {exact:true}).click();
  await page.getByText('What does “Pushback” mean?', {exact:true}).click();
  await expect(page.locator('#style .metric-help[open]')).toContainText('This describes a tendency');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const issues = await new AxeBuilder({page}).include('#abilities').include('#style').include('#summary').analyze();
  expect(issues.violations).toEqual([]);
  await page.emulateMedia({colorScheme:'dark'});
  expect((await new AxeBuilder({page}).include('#abilities').include('#style').analyze()).violations).toEqual([]);
});

test('an unscored model has no fabricated subject scores', async ({page}) => {
  const empty = raw.models.find(m=>Object.keys(m.abilities).length===0);
  test.skip(!empty, 'All exported models have scores');
  await page.goto(`/eq/models/${empty!.id}/`);
  const radar = page.locator('[data-radar]').first();
  await expect(radar).toContainText('No scores for this model yet');
  await expect(radar.locator('canvas')).toHaveAttribute('data-subject-scored', '0');
  await radar.getByText('View chart values', {exact:true}).click();
  expect(await radar.locator('tbody tr td:first-of-type').allTextContents()).toEqual(raw.dimensions.map(()=> 'Not scored'));
});
