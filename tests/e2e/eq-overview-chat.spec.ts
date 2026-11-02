import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../../src/data/eq/leaderboard.json',import.meta.url),'utf8'));

test('overview heatmap sorts, filters and fits',async({page})=>{
 await page.goto('/eq/');
 const board=page.locator('.leaderboard');
 await expect(board.locator('thead')).not.toContainText('Coverage');
 await expect(board.locator('.heat-cell')).toHaveCount(data.models.length*6);
 if(await board.getByRole('button',{name:'Sort by Rapport',exact:true}).isVisible()) await board.getByRole('button',{name:'Sort by Rapport',exact:true}).click();
 else await page.getByRole('combobox',{name:'Sort Leaderboard'}).selectOption('3');
 const sorted=await board.locator('tbody tr').evaluateAll(rows=>rows.map(r=>(r as HTMLTableRowElement).cells[3].dataset.sort).filter(Boolean).map(Number));
 expect(sorted).toEqual([...sorted].sort((a,b)=>b-a));
 await page.getByRole('searchbox').fill('gemma');
 expect(await board.locator('tbody tr:visible').count()).toBe(data.models.filter((m:any)=>m.name.toLowerCase().includes('gemma')).length);
 await page.getByRole('searchbox').fill('impossible model');await expect(page.locator('[data-filter-empty]')).toBeVisible();
 await page.getByRole('searchbox').fill('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).include('.eq').analyze()).violations).toEqual([]);
 await page.emulateMedia({colorScheme:'dark'});
 expect((await new AxeBuilder({page}).include('.eq').analyze()).violations).toEqual([]);
});

test('persona summaries and chat thinking preserve full prompts',async({page})=>{
 await page.goto('/eq/personas/');
 await expect(page.locator('.persona-card')).toHaveCount(24);
 await expect(page.locator('.persona-intro').first()).toContainText(data.persona_cards[0].summary);
 await expect(page.locator('.persona-intro').first()).not.toContainText('Presenting issue (what begins');
 await page.getByText("Tested model's initial instructions",{exact:true}).first().click();
 await expect(page.locator('.persona-card').first().locator('details[open] pre')).toHaveText(data.persona_cards[0].tested_prompt);
 const c=data.conversations.find((c:any)=>c.transcript.some((t:any)=>t.thinking_kind==='model_reasoning')&&c.transcript.some((t:any)=>t.thinking_kind==='persona_monologue'));
 await page.goto(`/eq/conversations/${c.id}/`);
 await expect(page.locator('.opening .message-bubble')).toHaveText(c.opening);
 await expect(page.locator('.thinking-text').first()).toBeHidden();
 await page.locator('.message-thinking summary').first().click();
 await expect(page.locator('.thinking-text').first()).toBeVisible();
 expect(await page.locator('.message-thinking').count()).toBe(c.transcript.filter((t:any)=>t.thinking).length);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).include('.eq').analyze()).violations).toEqual([]);
});

test('sorting radar values keeps dimensions aligned when comparison changes',async({page})=>{
 await page.goto('/eq/models/or-gemma-4-31b/');
 const radar=page.locator('[data-radar]').first();
 await radar.getByText('View chart values',{exact:true}).click();
 await radar.getByRole('button',{name:'Sort by This model',exact:true}).click();
 const selector=radar.locator('[data-compare]');
 const id=await selector.locator('option').nth(1).getAttribute('value');
 await selector.selectOption(id!);
 const expected=data.models.find((m:any)=>m.id===id).abilities;
 for(const row of await radar.locator('tbody tr').all()){
  const cell=row.locator('[data-axis-index]');const index=Number(await cell.getAttribute('data-axis-index'));
  await expect(cell).toHaveText(expected[data.dimensions[index]]?.toFixed(1)??'Not scored');
 }
 await expect(radar.locator('thead th').nth(2).getByRole('button')).toBeVisible();
});
