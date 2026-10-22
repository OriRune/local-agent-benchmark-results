import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {index,question,objectBytes} from './answer-data';
import {heatmapRows} from '../../src/lib/heatmap';
import {outcomeMetrics,rateText} from '../../src/lib/outcome-metrics';
const qid='q-bc4a880703cbea599dac4f30';
test('reading-page failure explains delivery separately from final-reply check',async({page})=>{
 const data=question(qid);
 const attempt=data.attempts.find(a=>a.canonical&&a.score===0&&a.components.checks.object_ids.some(id=>{
  const c=JSON.parse(objectBytes(id).toString()).check;
  return c&&typeof c==='object'&&c.titles_missing.length===0&&c.invented.length===0&&!c.reply_mentions_data_issues;
 }))!;
 expect(attempt).toBeTruthy();
 await page.goto(`/questions/${qid}/?attempt=${attempt.id}`);
 const section=page.locator('.reading-page-assessment');
 await expect(section).toContainText('A page was created.');
 await expect(section).toContainText('This alone could cause a zero');
 await expect(section.locator('[data-outcome=incorrect]')).toHaveCount(1);
 await expect(section).toContainText(/diagnostic only/);
 await section.getByText('What passed, what failed, and why',{exact:true}).click();
 await section.screenshot({path:test.info().outputPath('reading-checks.png')});
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  expect((await new AxeBuilder({page}).include('.reading-page-assessment').analyze()).violations).toEqual([]);
 }
});
test('overview shows three evidence-derived rates and outcome colors',async({page})=>{
 await page.goto('/');
 const row=page.locator('.overview-results tbody tr').first();
 await expect(row.locator('.outcome-metrics')).toBeVisible();
 const href=await row.locator('td a').first().getAttribute('href');
 const params=new URL(href!,'http://test').searchParams;
 const r=index.aggregates.find(a=>a.configuration_id===params.get('configuration')&&a.condition_id===params.get('condition')&&a.suite_id===params.get('suite'))!;
 const c=outcomeMetrics(r)!;
 for(const [label,n,d] of [['Pass rate',c.full,c.assessed],['Answers completed',c.completed,c.assessed],['Correct / completed',c.full,c.completed]] as const){
  await expect(row.locator('.outcome-metrics dl>div').filter({has:page.locator('dt',{hasText:label})}).locator('dd')).toHaveText(rateText(n,d));
 }
 await expect(row).not.toContainText('Desktop');
 await expect(row).not.toContainText('GB RAM');
 await page.getByText('What counts as completed, and why can a model fail to finish?',{exact:true}).click();
 await expect(page.locator('.completion-note')).toContainText('recovery');
});
test('heatmap omits no-score setups and expands vertically in the document',async({page},info)=>{
 await page.goto('/heatmap/');
 await expect(page.locator('.heatmap-table tbody tr')).toHaveCount(heatmapRows(index,'all').length);
 await expect(page).not.toHaveTitle(/demo/i);
 await expect(page.locator('.heatmap-qualification')).toContainText('does not mean partial credit');
 const box=page.locator('.heatmap-scroll');
 expect(await box.evaluate(e=>e.scrollHeight-e.clientHeight)).toBeLessThanOrEqual(2);
 if(info.project.name==='desktop') expect(await box.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(2);
 await page.getByLabel('Show every quant, setup & mode').check();
 await expect(page.locator('.heatmap-table tbody tr')).toHaveCount(heatmapRows(index,'all',true).length);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('full, partial and incorrect results have distinct readable colors',async({page})=>{
 await page.goto(`/questions/${qid}/`);
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  const colors=await page.evaluate(()=>['full_credit','partial_credit','incorrect'].map(outcome=>{
   const e=document.createElement('span');e.className='badge outcome-badge';e.dataset.outcome=outcome;e.textContent=outcome;document.body.append(e);
   const color=getComputedStyle(e).color;e.remove();return color;
  }));
  expect(new Set(colors).size).toBe(3);
 }
});
