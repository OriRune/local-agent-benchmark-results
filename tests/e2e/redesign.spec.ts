import {expect,test} from '@playwright/test';

test('results appear in the opening viewport and lead to exact model answers',async({page},info)=>{
 await page.goto('/');
 const row=page.locator('.overview-results tbody tr').first();
 await expect(row).toBeVisible();
 const position=await row.boundingBox();expect(position!.y+50).toBeLessThan(page.viewportSize()!.height);
 await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Compare',exact:true})).toBeVisible();
 await expect(page.getByLabel('Budget',{exact:true})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('home.png')});
 await row.locator('a[href^="/models/"]').first().click();
 await expect(page.locator('.capability-row').first()).toBeVisible();
 await page.screenshot({path:info.outputPath('model.png')});
 await page.getByRole('button',{name:'Inspect Everyday coding tasks',exact:true}).click();
 await expect(page.getByRole('heading',{name:'This model’s answers, code and tool activity'})).toBeVisible();
 await expect(page.locator('.question-outcome').first()).not.toBeEmpty();
 await page.locator('.question-list a').first().click();
 await expect(page.locator('.evidence pre').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('direct comparison supports setup selection and matrix links preserve exact identities',async({page},info)=>{
 await page.goto('/compare/');
 await expect(page.getByRole('heading',{name:'Choose two to four tested setups'})).toBeVisible();
 await page.getByRole('button',{name:'Add setup',exact:true}).click();
 await page.getByRole('button',{name:'Add setup',exact:true}).click();
 await page.getByRole('link',{name:'Open comparison →',exact:true}).click();
 await expect(page.getByRole('region',{name:'Compared scores'})).toBeVisible();
 const matrix=page.getByRole('region',{name:'Question outcomes by model'});
 await expect(matrix.locator('tbody tr').first()).toBeVisible();
 const link=matrix.locator('tbody td a').first();const href=await link.getAttribute('href');
 expect(href).toContain('configuration=');expect(href).toContain('condition=');expect(href).toContain('release=');
 await page.screenshot({path:info.outputPath('compare.png'),fullPage:true});
 await page.reload();await expect(matrix.locator('tbody tr').first()).toBeVisible();
 await page.getByRole('button',{name:'Open recorded answers',exact:true}).click();
 await expect(page.locator('.evidence pre').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

 test('speed plot identifies selected models and retains a linked exact-value table',async({page})=>{
  await page.goto('/');
  await page.getByRole('link',{name:'Speed & quality ↘',exact:true}).click();
  const points=page.locator('.quality-time [role=button]');
  const label=await page.locator('.plot-grid-line > span').first().boundingBox();
  expect(label!.height).toBeLessThan(30);
  expect(await points.count()).toBeGreaterThan(1);
  await points.last().focus();
  await points.last().press('Enter');
  await expect(points.last()).toHaveAttribute('aria-pressed','true');
  const summary=page.locator('.plot-selection');
  await expect(summary.getByRole('link',{name:'Open results →'})).toHaveAttribute('href',/configuration=.*condition=.*suite=/);
  await expect(page.getByRole('region',{name:'Speed and quality data'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
