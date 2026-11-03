import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('EQ heatmaps and profile charts are readable in both themes',async({page})=>{
 for(const theme of ['light','dark']){
  await page.goto('/eq/');
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await expect(page.locator('.trait-heatmap')).toHaveCount(2);
  await expect(page.getByRole('navigation',{name:'EQ Lab'})).toContainText('Conversation transcripts');
  expect((await new AxeBuilder({page}).include('.eq').withRules(['color-contrast']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.goto('/eq/models/or-gemma-4-31b/');
 await expect(page.locator('#judges')).toContainText('Judge reasoning effort:');
 await expect(page.locator('.rating-axis-title').first()).toHaveText('Rating → higher');
 for(const strip of await page.locator('.rating-strip').all()){
  const centers=await strip.locator('.rating-dot').evaluateAll(dots=>dots.map(d=>{const b=d.getBoundingClientRect();return b.y+b.height/2}));
  expect(Math.max(...centers)-Math.min(...centers)).toBeLessThan(1);
 }
 const rows=await page.locator('.opponent').evaluateAll(rows=>rows.map(r=>r.getBoundingClientRect().height));
 expect(Math.max(...rows)).toBeLessThan(95);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#judges').screenshot({path:`/tmp/eq-judges-${test.info().project.name}.png`});
});
