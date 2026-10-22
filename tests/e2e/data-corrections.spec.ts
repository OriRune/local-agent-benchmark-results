import {test,expect} from '@playwright/test';

test('known parameter metadata and specific qualification labels reach readers',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.overview-results').first()).toBeVisible();
 await expect(page.getByRole('heading',{name:'Unfinished or unassessed results'})).toHaveCount(0);
 await page.getByLabel('Find a model').fill('Qwen3.5 9B');
 await expect(page.locator('.overview-results tbody tr').first()).toContainText('B total');
 await expect(page.locator('.overview-results tbody tr').first()).not.toContainText('Parameters unverified');
 await page.getByLabel('Find a model').fill('Flash-Next Coder');
 await page.getByRole('button',{name:'Show highlights',exact:true}).click();
 await page.getByText('Inspect qualified and unavailable results',{exact:true}).click();
 await expect(page.locator('.overview-results tbody tr')).toContainText('setup comparability unverified');
 await expect(page.locator('.overview-results tbody tr')).toContainText('16/16 scored');
});

test('Ornith admits new quants and keeps both RAM histories available',async({page})=>{
 await page.goto('/models/ornith35/');
 const select=page.getByLabel('Configuration',{exact:true});
 await expect(select).toBeVisible();
 await expect(select.locator('option:checked')).toContainText('128 GB RAM');
 await expect(select.locator('option').filter({hasText:'32 GB RAM'}).first()).toHaveCount(1);
 await expect(select.locator('option').filter({hasText:'128 GB RAM'})).toHaveCount(3);
 await expect(page.locator('.quant-plots')).toContainText('32 GB RAM');
 await expect(page.locator('.quant-plots')).toContainText('128 GB RAM');
 const old=await select.locator('option').filter({hasText:'32 GB RAM'}).first().getAttribute('value');
 await select.selectOption(old!);
 await expect(select).toHaveValue(old!);
 await page.reload();await expect(select).toHaveValue(old!);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
