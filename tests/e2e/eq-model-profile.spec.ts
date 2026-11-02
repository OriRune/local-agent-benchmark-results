import {test,expect} from '@playwright/test';
test('EQ profile charts explain scores and fit the viewport',async({page})=>{
 await page.goto('/eq/models/or-gemma-4-31b/');
 await expect(page.locator('.rating-dot.current')).toHaveCount(2);
 await expect(page.locator('#abilities .eq-metric')).toHaveCount(6);
 await expect(page.locator('#style .eq-metric')).toHaveCount(12);
 const yielding=page.locator('.eq-metric').filter({has:page.getByText('Yields under pressure',{exact:true})});
 await expect(yielding).toContainText('Higher = readily yields');
 await yielding.locator('summary').click();
 await expect(yielding.locator('details[open]')).toContainText('not whether it was appropriate');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('.record-track').first()).toBeVisible();
 await page.goto('/eq/models/gemma4_e2b/');
 await expect(page.getByText('Not scored',{exact:true}).first()).toBeVisible();
});
