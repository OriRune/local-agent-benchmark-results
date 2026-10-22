import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('heatmap filters, sorts and links to the exact setup and answers',async({page})=>{
 await page.goto('/');await page.getByRole('link',{name:'Try the heatmap demo'}).click();
 await expect(page.getByRole('heading',{name:'Models at a glance'})).toBeVisible();
 await page.getByLabel('Find a model').fill('Ornith');
 const rows=page.locator('.heatmap-table tbody tr');expect(await rows.count()).toBeGreaterThan(0);
 const initial=await rows.count();await page.getByLabel('Show every quant, setup & mode').check();expect(await rows.count()).toBeGreaterThan(initial);
 await page.getByRole('button',{name:'Sort by Everyday coding tasks',exact:true}).click();
 await page.getByRole('button',{name:'Sort by Everyday coding tasks',exact:true}).click();
 await expect(page.locator('th[aria-sort="ascending"]')).toContainText('Everyday coding');
 const row=rows.first(), modelHref=await row.locator('th a').getAttribute('href');
 await row.locator('.heatmap-cell').nth(1).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 const answer=page.getByRole('link',{name:'View this model’s answers'});const href=await answer.getAttribute('href');
 expect(href).toContain(modelHref!);expect(href).toContain('&suite=');
 await answer.click();await expect(page.getByLabel('Configuration',{exact:true})).toHaveValue(new URL(href!,'http://localhost').searchParams.get('configuration')!);
});
test('heatmap is accessible in both themes and scrolls without page overflow',async({page})=>{
 await page.goto('/heatmap/');await expect(page.locator('.heatmap-cell').first()).toBeVisible();
 const first=await page.locator('.heatmap-cell').first().boundingBox();expect(first!.y+30).toBeLessThan(800);
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  const scan=await new AxeBuilder({page}).analyze();expect(scan.violations).toEqual([]);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.heatmap-cell').first().click();await expect(page.getByRole('dialog')).toBeVisible();
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByLabel('Find a model').fill('no-such-model-xyz');await expect(page.getByText('No models match these filters.')).toBeVisible();
});

test('default views expose cloud models and the instruction column links to the actual campaign',async({page})=>{
 for(const path of ['/','/heatmap/']){
  await page.goto(path);await expect(page.getByLabel('Thinking',{exact:true})).toHaveValue('all');
  for(const name of ['GPT-6 Luna','Gemma 4 31B · CoreWeave','Qwen3.8 27B']){
   await page.getByLabel('Find a model').fill(name);
   await expect(page.locator(path==='/'?'.overview-results tbody tr':'.heatmap-table tbody tr').first()).toContainText(name);
  }
 }
 await page.getByLabel('Find a model').fill('GPT-6 Luna');await page.getByLabel('Show every quant, setup & mode').check();
 await expect(page.locator('.heatmap-table tbody tr')).toHaveCount(5);
 await page.getByLabel('Show every quant, setup & mode').uncheck();await page.getByLabel('Find a model').fill('Ornith 1.5 35B');
 await expect(page.getByRole('button',{name:'Sort by Following exact instructions',exact:true})).toHaveCount(1);
 await page.locator('.heatmap-table tbody tr').first().getByRole('button',{name:/Following exact instructions:/}).click();
 await expect(page.getByRole('dialog')).toContainText('23 of 23 planned tasks scored');
 await expect(page.getByRole('link',{name:'View this model’s answers'})).toHaveAttribute('href',/suite=ifeval-a08b1f61cf6ddde8/);
 await page.getByRole('button',{name:'Close score details'}).click();
 await page.getByLabel('Find a model').fill('GPT-6 Luna');await page.locator('.heatmap-table tbody tr .heatmap-cell').first().click();
 await expect(page.getByRole('dialog')).toContainText('Unranked: incomplete or qualified');
 await expect(page.getByRole('dialog')).toContainText('It is not a confidence interval.');
});
