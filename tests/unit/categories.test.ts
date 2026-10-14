import { expect, it } from 'vitest';
import { categoryPolicy, parameterBand, memoryFits, validateCategories } from '../../src/lib/categories.mjs';
import type { Checkpoint, MemoryFit, Configuration } from '../../src/lib/public-contract';
import { overviewViewQuery, parseOverviewView } from '../../src/lib/overview-view';
const checkpoint = {parameters:{total_billions:5,provenance:'header'},architecture:'dense'} as Checkpoint;
it('categorizes boundary values and accepts future category definitions', () => {
 const policy=structuredClone(categoryPolicy({}));
 expect(parameterBand(checkpoint,policy)).toBe('medium');
 expect(parameterBand({...checkpoint,parameters:{...checkpoint.parameters,total_billions:20}},policy)).toBe('large');
 policy.parameter_bands[2].max_billions=70;policy.parameter_bands.push({id:'huge',label:'70B+',min_billions:70,max_billions:null});
 expect(parameterBand({...checkpoint,parameters:{...checkpoint.parameters,total_billions:90}},policy)).toBe('huge');
 expect(parameterBand({...checkpoint,parameters:{...checkpoint.parameters,provenance:null}},policy)).toBeNull();
});
it('includes smaller verified tiers, keeps quants separate and labels estimates', () => {
 const make=(id:string,configuration_id:string,budget_gb:number,status:MemoryFit['status'])=>({id,configuration_id,budget_gb,status,memory_type:'system_ram'} as MemoryFit);
 const data={memory_fits:[make('a','q4',8,'verified'),make('b','q8',16,'verified'),make('c','estimate',12,'estimated')]};
 expect(memoryFits(data,'q4',{budget:16})).toHaveLength(1);
 expect(memoryFits(data,'q8',{budget:8})).toHaveLength(0);
 expect(memoryFits(data,'unknown',{budget:32})).toHaveLength(0);
 expect(memoryFits(data,'estimate',{budget:16})).toHaveLength(0);
 expect(memoryFits(data,'estimate',{budget:16,estimates:true})[0].status).toBe('estimated');
 expect(memoryFits(data,'q4',{budget:16,type:'gpu_vram'})).toHaveLength(0);
});
it('rejects memory evidence for a different context or runtime', () => {
 const config={id:'c',runtime:'llama',runtime_build:'v1',concurrency:1,observed:{context:4096,gpu_layers:0}} as Configuration;
 const fit={id:'fit',configuration_id:'c',budget_gb:8,status:'verified',memory_type:'system_ram',headroom_gb:2,profile:{runtime:'llama',runtime_build:'v1',concurrency:1,context_tokens:4096,gpu_layers:0,other_memory_gb:0}} as MemoryFit;
 const data={configurations:[config],memory_fits:[fit]};expect(()=>validateCategories(data)).not.toThrow();
 fit.profile.context_tokens=8192;expect(()=>validateCategories(data)).toThrow('profile');
});
it('round-trips hardware choices in shareable overview URLs', () => {
 const view={suiteId:'basic',mode:'on' as const,search:'',showAll:true,grouping:'memory' as const,architecture:'moe' as const,budget:16,memoryType:'unified_memory' as const,estimates:true};
 expect(parseOverviewView(overviewViewQuery(view),['basic'],'basic')).toEqual(view);
 for(const query of ['budget=-1','budget=NaN','architecture=guessed','group=bad','memory=combined','budget=8&budget=16'])expect(()=>parseOverviewView(query,['basic'],'basic')).toThrow();
});
