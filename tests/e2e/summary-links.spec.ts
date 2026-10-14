import {expect,test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readObject} from '../../scripts/public-data.mjs';
import SummaryEvidence from '../../src/components/SummaryEvidence';
import {summaryView,type SummaryPacket} from '../../src/lib/summary-view';
import type {PublicBenchmarkSummaryV1} from '../../src/lib/public-summary';
import type {OverviewData,QuestionData} from '../../src/lib/public-types';

test('summary category evidence opens exact model answers and code in the pinned edition',async({page})=>{
 const rid=JSON.parse(await readFile('public/data/latest.json','utf8')).release_id;
 const release=JSON.parse(await readFile(`public/data/releases/${rid}/release.json`,'utf8'));
 async function object(id:string){return JSON.parse((await readObject('public/data',release.objects.find((o:{id:string})=>o.id===id))).toString());}
 const data:OverviewData=await object(release.index_object_id);
 const a=data.aggregates.find(a=>a.eligible&&a.suite_id.startsWith('basic-')&&a.configuration_id.includes('lingtiny'))??data.aggregates.find(a=>a.eligible&&a.suite_id.startsWith('basic-'))!;
 const config=data.configurations.find(c=>c.id===a.configuration_id)!;
 const cp=data.checkpoints.find(c=>c.id===data.artifacts.find(x=>x.id===config.artifact_id)!.checkpoint_id)!;
 // Rendering-only claim backed by this edition's actual identifiers; no approval or release write.
 const fact={id:'fact-test',record_id:a.id,metric:'score',value:a.score,unit:'normalized_credit',condition_id:a.condition_id,suite_id:a.suite_id};
 const claim={text:'Small coding tasks.',evidence_refs:[fact.id],numeric_facts:[],condition_ids:[a.condition_id],scope:'measured_fact',illustration:false};
 const summary={subject:{configuration_id:config.id,checkpoint_id:cp.id},content:{output_schema_version:1,verdict:claim,strengths:[],weaknesses:[],thinking_tradeoffs:[],limitations:[]}} as unknown as PublicBenchmarkSummaryV1;
 const packet:SummaryPacket={inputs:{suites:data.suites,conditions:data.conditions,numeric_facts:[fact],limitations:[],examples:[]}};
 const view=summaryView(summary,packet,{releaseId:rid,checkpointId:cp.id});
 await page.goto('/');
 await page.setContent(renderToStaticMarkup(createElement(SummaryEvidence,{ids:[fact.id],references:view.references})));
 await page.getByText('Evidence for this judgment',{exact:true}).click();
 await page.getByRole('link',{name:'View this model’s answers, code and tool activity →',exact:true}).click();
 await expect(page.locator('#recorded-answers')).toBeVisible();
 await expect(page.getByLabel('Configuration',{exact:true})).toHaveValue(config.id);
 await expect(page.getByLabel('Thinking condition',{exact:true})).toHaveValue(a.condition_id);
 const link=page.locator('#recorded-answers .question-list a').first();
 const target=new URL((await link.getAttribute('href'))!,'http://example');
 expect(target.searchParams.get('release')).toBe(rid);
 expect(target.searchParams.get('configuration')).toBe(config.id);
 expect(target.searchParams.get('condition')).toBe(a.condition_id);
 const question:QuestionData=await object(release.question_objects[target.searchParams.get('question')!]);
 const trialIds=new Set(question.trials.filter(t=>t.configuration_id===config.id&&t.condition_id===a.condition_id).map(t=>t.id));
 const attempt=question.attempts.find(x=>x.canonical&&trialIds.has(x.trial_id))!;
 await link.click();
 await expect(page.getByLabel('Tested configuration and trial',{exact:true})).toHaveValue(attempt.id);
 await expect(page.getByRole('heading',{name:'Original final answer',exact:true})).toBeVisible();
 await expect(page.getByText('Code and saved file changes',{exact:true})).toBeVisible();
 await page.getByText('Code and saved file changes',{exact:true}).click();
 await expect(page.getByRole('button',{name:'Read artifacts',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Read artifacts',exact:true}).click();
 await expect(page.locator('details[open] .evidence pre').first()).toBeVisible();
});
