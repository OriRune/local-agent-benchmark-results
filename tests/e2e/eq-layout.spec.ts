import { test, expect } from '@playwright/test';
test('EQ pages fit viewport and expose persona prompts', async ({page}) => {
  for (const route of ['/eq/', '/eq/style/', '/eq/personas/']) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByText("Tested model's initial instructions", {exact:true}).first().click();
  await expect(page.locator('details[open] pre').first()).toBeVisible();
  await page.locator('a[href^="/eq/conversations/"]').first().click();
  await expect(page.getByText('Opening', {exact:true})).toBeVisible();
  await expect(page.getByRole('link', {name:'View persona and initial instructions'})).toBeVisible();
});
