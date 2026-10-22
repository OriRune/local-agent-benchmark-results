import {expect,it} from 'vitest';
import {timingGroups,creditLabel,type ChartRow} from '../../src/lib/chart-data';
function row(id:string):ChartRow{return {id,name:id,href:'/',config:{id,execution_kind:'local',hardware_id:'machine',runtime:'vulkan',concurrency:1,compatibility:'known'},condition:{kind:'baseline',protocol_id:'fixed',reasoning_requested:'off',seed:0,temperature:0,max_tokens:4000,thinking_tokens:null,reasoning_effort:null,agent_steps:20,agent_seconds:60,question_seconds:60},result:{suite_id:'coding',planned:16,scored:16,timed:16,eligible:true,score:.75,full_credit:12,median_task_s:4}} as ChartRow;}
it('keeps cloud, incomplete, unknown-hardware and explicitly ineligible timings off the plot',()=>{
 const a=row('a'),b=row('b');
 for(const mutate of [(r:ChartRow)=>r.config.execution_kind='cloud',(r:ChartRow)=>r.config.speed_eligible=false,(r:ChartRow)=>r.config.hardware_id=null,(r:ChartRow)=>r.result.scored=15,(r:ChartRow)=>r.result.timed=15,(r:ChartRow)=>r.result.eligible=false]){const bad=row('bad');mutate(bad);expect(timingGroups([a,b,bad])[0]![1].map(r=>r.id)).toEqual(['a','b']);}
});
it('never merges hardware or test-control changes into the same timing group',()=>{
 for(const mutate of [(r:ChartRow)=>r.config.hardware_id='other',(r:ChartRow)=>r.config.concurrency=2,(r:ChartRow)=>r.condition.protocol_id='other',(r:ChartRow)=>r.condition.max_tokens=8000,(r:ChartRow)=>r.condition.reasoning_requested='on',(r:ChartRow)=>r.result.suite_id='reading']){const b=row('b');mutate(b);expect(timingGroups([row('a'),b])).toHaveLength(0);}
});
it('allows labeled runtime setup differences but retains exact quality and nulls',()=>{
 const b=row('b');b.config.runtime='cpu';expect(timingGroups([row('a'),b])).toHaveLength(1);
 expect(creditLabel(row('a').result,true)).toBe('12/16 passed');
 expect(creditLabel({...row('a').result,score:null},true)).toBe('Not scored');
});
