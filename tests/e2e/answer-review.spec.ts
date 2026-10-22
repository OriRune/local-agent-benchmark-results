import {expect,test} from '@playwright/test';
import {question} from './answer-data';
const qid='q-93852fae313a9aeb23584dc1';
const data=question(qid);
const current=(original:string)=>data.attempts.find(a=>a.canonical&&a.trial_id===data.attempts.find(b=>b.id===original)!.trial_id)!.id;
const gemma=current('attempt-45b22a57def6507de835af2e'),qwen=current('attempt-e41312434110135aaa5b4370');
const target=`/questions/${qid}/?attempt=${gemma}`;

test('cached evidence stays hidden while withdrawal status is pending or unavailable',async({page})=>{
 await page.goto(target);
 const answer=page.getByRole('region',{name:'Final answer text',exact:true});
 await expect(answer).toHaveText('76.8%');
 const search=page.getByRole('searchbox',{name:'Find model, setup, seed or attempt ID'});
 await search.fill(qwen);await page.locator('.answer-rows a').click();
 await expect(answer).toHaveText('76.8');
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 let reached!:()=>void;const requested=new Promise<void>(r=>reached=r);
 await page.route('**/data/withdrawals.json',async route=>{reached();await gate;await route.fulfill({status:503}).catch(()=>{});});
 try {
  await search.fill(gemma);await page.locator('.answer-rows a').click();await requested;
  await expect(page.locator('.selected-attempt')).toHaveAttribute('data-attempt-id',gemma);
  await expect(answer).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Download original final answer',exact:true})).toHaveCount(0);
 }finally{release();}
 await expect(page.locator('.reading-answer > .evidence').getByRole('alert')).toContainText('Withdrawal status could not be checked');
 await expect(answer).toHaveCount(0);
 await page.unroute('**/data/withdrawals.json');
 await page.getByRole('button',{name:'Retry loading the final answer',exact:true}).click();
 await expect(answer).toHaveText('76.8%');
});

test('legacy scored filter links display their meaning and keep the requested answer',async({page})=>{
 await page.goto(target+'&answer_status=scored');
 const status=page.getByLabel('Answer outcome',{exact:true});
 await expect(status).toHaveValue('scored');
 await expect(status.locator('option:checked')).toContainText('Recorded status: scored');
 await expect(page.locator('.selected-attempt')).toHaveAttribute('data-attempt-id',gemma);
 await expect(page.locator('.answer-list-range')).toContainText('matching');
});
