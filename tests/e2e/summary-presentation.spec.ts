import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ModelSummary from '../../src/components/ModelSummary';
import { summaryView } from '../../src/lib/summary-view';
import { readerFixture } from '../fixtures/reader-presentation';
import { readObject } from '../../scripts/public-data.mjs';

const root=fileURLToPath(new URL('../fixtures/summary-release-v1/',import.meta.url));
const release=JSON.parse(await readFile(`${root}/release.json`,'utf8'));
const ref=release.summary_objects[0];
const summary=JSON.parse((await readObject(root,release.objects.find((o:{id:string})=>o.id===ref.object_id))).toString('utf8'));
const packet=JSON.parse((await readObject(root,release.objects.find((o:{id:string})=>o.id===ref.facts_object_id))).toString('utf8'));
const fixture=readerFixture(summary,packet);
const css=await readFile(new URL('../../src/styles/global.css',import.meta.url),'utf8');
const markup=renderToStaticMarkup(createElement(ModelSummary,{analysis:summaryView(fixture.summary,fixture.packet),configurationId:ref.configuration_id}));

test('reader evidence and peer charts work on small screens and with keyboard navigation',async({page})=>{
  await page.setContent(`<!doctype html><html lang="en"><head><title>Summary presentation fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><main class="wrap"><h1>Model results</h1>${markup}</main></body></html>`);
  await expect(page.locator('.summary-peer-chart')).toBeVisible();
  await expect(page.locator('.peer-subject')).toContainText('This model');
  await expect(page.locator('.peer-bars > li')).toHaveCount(3);
  const evidence=page.locator('.summary-evidence').first();
  await evidence.locator('summary').focus();await page.keyboard.press('Enter');
  await expect(evidence).toHaveAttribute('open','');
  await expect(evidence.locator('table').first()).toBeVisible();
  await expect(evidence.locator('pre')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('speed comparisons keep timing and task quality readable and accessible',async({page})=>{
 const f=readerFixture(summary,packet),p=f.packet.inputs.reader_context!.records[0]!;
 p.kind='speed';p.subject_timing={median_task_s:5,timed:8,generated_tokens_per_s:100,generation_timed:8,full_credit:6};
 Object.assign(p.members[0]!,{median_task_s:1,timed:8,generated_tokens_per_s:null,generation_timed:3,full_credit:0});
 Object.assign(p.members[1]!,{median_task_s:7,timed:8,generated_tokens_per_s:200,generation_timed:8,full_credit:6});
 const html=renderToStaticMarkup(createElement(ModelSummary,{analysis:summaryView(f.summary,f.packet),configurationId:ref.configuration_id}));
 await page.setContent(`<!doctype html><html lang="en"><head><title>Speed comparison fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><main class="wrap"><h1>Model results</h1>${html}</main></body></html>`);
 await page.getByText('Compare timings and outcomes',{exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('.summary-speed-chart table')).toBeVisible();
 await expect(page.locator('.summary-speed-chart tbody tr').first()).toContainText('Zero peer');
 await expect(page.locator('.summary-speed-chart tbody tr').first()).toContainText('0.0/100');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
