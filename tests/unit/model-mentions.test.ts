import { expect, it } from 'vitest';
import { modelMentionParts } from '../../src/lib/model-mentions';

it('links repeated exact quant names with the longest match and boundaries',()=>{
  const parts=modelMentionParts('Ornith Q8, Ornith Q4; Ornith Q8. XOrnith Q8.',[
    {name:'Ornith',href:'/short'},{name:'Ornith Q8',href:'/q8'},{name:'Ornith Q4',href:'/q4'}]);
  expect(parts.filter(p=>p.href).map(p=>p.href)).toEqual(['/q8','/q4','/q8']);
  expect(parts.map(p=>p.text).join('')).toBe('Ornith Q8, Ornith Q4; Ornith Q8. XOrnith Q8.');
});
it('keeps ambiguous names and unsafe destinations plain without falling back to a shorter name',()=>{
  expect(modelMentionParts('Ornith Q8',[{name:'Ornith',href:'/short'},{name:'Ornith Q8',href:'/one'},{name:'Ornith Q8',href:'/two'}])).toEqual([{text:'Ornith Q8'}]);
  expect(modelMentionParts('Bad',[{name:'Bad',href:'javascript:bad'},{name:'Bad',href:'//bad'}])).toEqual([{text:'Bad'}]);
});

it('links separate reasoning, instruct, local, and hosted checkpoint names to their exact configurations',()=>{
  const mentions=[
    {name:'Ministral 3 8B Instruct Q4_K_M',href:'/models/ministral8b/?configuration=config-ministral8b-2730c589e424#model-analysis'},
    {name:'Ministral 3 8B Reasoning 2512 Q4_K_M',href:'/models/ministral8b_reasoning/?configuration=config-ministral8b_reasoning-2730c589e424#model-analysis'},
    {name:'Nemotron Nano 9B v2 Q4_0',href:'/models/nemotron9b/?configuration=config-nemotron9b-2730c589e424#model-analysis'},
    {name:'Nemotron 3.5 Lightning 30B-A3B (cloud)',href:'/models/cloud-nemotron35/?configuration=config-cloud-nemotron35-cloud#model-analysis'},
    {name:'GPT-OSS 120B (cloud)',href:'/models/cloud-gptoss120/?configuration=config-cloud-gptoss120-cloud#model-analysis'},
  ];
  const text='Ministral 3 8B Instruct Q4_K_M is a separate checkpoint from Ministral 3 8B Reasoning 2512 Q4_K_M. Compare Nemotron Nano 9B v2 Q4_0 with Nemotron 3.5 Lightning 30B-A3B (cloud), then GPT-OSS 120B (cloud).';
  const linked=modelMentionParts(text,mentions).filter(p=>p.href);
  expect(linked.map(p=>[p.text,p.href])).toEqual(mentions.map(m=>[m.name,m.href]));
});
