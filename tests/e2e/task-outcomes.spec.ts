import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const root=new URL('../../public/data/',import.meta.url);
const read=(p:string)=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const release=read(`releases/${read('latest.json').release_id}/release.json`);
const object=(id:string)=>{const o=release.objects.find((x:any)=>x.id===id),b=readFileSync(new URL(o.path,root));return JSON.parse((o.encoding==='gzip'?gunzipSync(b):b).toString());};
const index=object(release.index_object_id);
const questionFor=(source:string)=>index.questions.find((q:any)=>q.source_id===source);
const failed=(()=>{for(const q of index.questions.filter((q:any)=>q.source_id.startsWith('rg-')||index.suites.find((s:any)=>s.id===q.suite_id)?.family_id==='reasoning_gym')){const data=object(release.question_objects[q.id]);const a=data.attempts.find((a:any)=>a.canonical&&a.assessment?.reason==='output_limit'&&a.assessment?.recorded_status==='no_answer');if(a)return {q,a};}throw Error('Expected saved output-limit example');})();
const passed=(()=>{const q=questionFor('basic-H1'),data=object(release.question_objects[q.id]);const a=data.attempts.find((a:any)=>a.canonical&&a.assessment?.reason==='saved_agent_checks');if(!a)throw Error('Expected recovered artifact check');return {q,a};})();

test('model profile shows outcome distributions and remains usable on narrow screens',async({page})=>{
 await page.goto('/models/cloud-gemma31-coreweave-cloud/');
 await expect(page.locator('#capabilities .outcome-track').first()).toBeVisible();
 await expect(page.locator('#capabilities')).toContainText('failed to finish');
 await expect(page.locator('#capabilities')).toContainText('Incorrect answers and failures to finish both earn zero');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('failed-to-finish answers expose zero credit and retain the original status',async({page})=>{
 await page.goto(`/questions/${failed.q.id}/?attempt=${failed.a.id}`);
 await expect(page.locator('.outcome-explanation')).toContainText('exhausted its output allowance');
 await expect(page.locator('.badge').filter({hasText:'Failed to finish'}).first()).toBeVisible();
 await page.getByText('How this outcome was assessed',{exact:true}).click();
 await expect(page.locator('.outcome-explanation')).toContainText('Original recorded status: no answer');
 await expect(page.locator('.outcome-explanation')).toContainText('original score: unscored');
 await page.getByLabel('Answer outcome',{exact:true}).selectOption('failed_to_finish');
 const badges=page.locator('.answer-rows .outcome-badge');
 await expect(badges.first()).toHaveText('Failed to finish');
 expect(new Set(await badges.allTextContents())).toEqual(new Set(['Failed to finish']));
});
test('passing saved work retains credit and links to its original checks',async({page})=>{
 await page.goto(`/questions/${passed.q.id}/?attempt=${passed.a.id}`);
 await expect(page.locator('.outcome-explanation')).toContainText('saved task checks accepted the work');
 await page.getByText('How this outcome was assessed',{exact:true}).click();
 await expect(page.locator('.outcome-explanation')).toContainText('Saved task check: pass');
 await expect(page.locator('.grade-block .check-values')).toBeVisible();
 await expect(page.locator('.grade-block')).toContainText('recovered by task-outcomes-v1');
});
