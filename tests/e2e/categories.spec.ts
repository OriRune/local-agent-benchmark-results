import { expect, test } from '@playwright/test';
test('category filters remain shareable and unknown memory fit is not guessed',async({page})=>{
 await page.goto('/');
 await expect(page.getByLabel('Group models by')).toHaveValue('parameters');
 await page.getByLabel('Architecture',{exact:true}).selectOption('moe');
 await expect(page.locator('.overview-results')).not.toHaveCount(0);
 await page.reload();await expect(page.getByLabel('Architecture',{exact:true})).toHaveValue('moe');
 await page.getByLabel('Budget',{exact:true}).selectOption('8');
 await expect(page.getByText('No supported setups match these filters.',{exact:false})).toBeVisible();
 await page.getByLabel('Budget',{exact:true}).selectOption('');
 await page.getByLabel('Group models by').selectOption('memory');
 await expect(page.getByRole('heading',{name:'Memory fit unverified'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
