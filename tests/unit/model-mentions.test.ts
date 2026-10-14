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
