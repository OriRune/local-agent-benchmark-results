import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash } from 'node:crypto';
import { canonical } from '../../src/lib/canonical.mjs';
import { validateDescriptions } from '../../scripts/test-descriptions.mjs';
import TestExplanation from '../../src/components/TestExplanation';
import QuestionBank from '../../src/components/QuestionBank';

const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const question={id:'q1',suite_id:'s1',source_id:'T1',title:'simple',scoring_status:'primary' as const};
const suite={id:'s1',question_ids:['q1']};
const entry={source_sha256:hash(question),title:'Change a project setting',description:'Find the relevant setting and update it.',generator:{model_id_requested:'gpt-6-astra',display_name_at_generation:'GPT Astra'},generated_at:'2026-10-11T00:00:00Z',prompt:{version:'v1',sha256:'a'.repeat(64)}};
const catalogue={version:1,questions:{q1:entry},suites:{s1:{...Object.fromEntries(Object.entries(entry).filter(([key])=>key!=='title')),source_sha256:hash({suite,questions:{q1:hash(question)}})}}};
it('binds descriptions to task content while allowing additional models',()=>{
  expect(()=>validateDescriptions(catalogue,{questions:[question],suites:[suite],configurations:[{id:'new'}]})).not.toThrow();
  expect(()=>validateDescriptions(catalogue,{questions:[{...question,title:'changed'}],suites:[suite]})).toThrow('source version differs');
  expect(()=>validateDescriptions(catalogue,{questions:[],suites:[]})).toThrow('source version differs');
});
it('shows human task labels in lists, keeps exact configuration links and escapes prose',()=>{
  const html=renderToStaticMarkup(createElement(QuestionBank,{questions:[question],descriptions:{q1:entry},configurationId:'quant8',conditionId:'on',editionId:'release-'+ 'a'.repeat(64)}));
  expect(html).toContain('Change a project setting</a>');
  expect(html).toContain('T1 · primary');
  expect(html).toContain(entry.description);
  expect(html).toContain('configuration=quant8');
  expect(html).toContain('condition=on');
  const explanation=renderToStaticMarkup(createElement(TestExplanation,{explanation:{...entry,description:'<script>unsafe</script>'}}));
  expect(explanation).toContain('&lt;script&gt;');
  expect(explanation).toContain('GPT Astra (gpt-6-astra)');
  expect(renderToStaticMarkup(createElement(TestExplanation,{}))).toBe('');
});

import { bankPage } from '../../src/lib/question-bank';
it('finds tasks by their generated explanation without replacing the original title',()=>{
  const view={search:'project setting',status:'all' as const,page:1};
  expect(bankPage([question],view,undefined,undefined,undefined,{q1:entry}).count).toBe(1);
  expect(question.title).toBe('simple');
});
