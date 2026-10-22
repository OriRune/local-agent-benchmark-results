import { expect, it } from 'vitest';
import { heatmapRows, sortHeatmapRows } from '../../src/lib/heatmap';
import type { OverviewData } from '../../src/lib/public-types';

const fixture=()=>({
  checkpoints:[{id:'model',name:'Model',baseline_artifact_id:'baseline'}],
  artifacts:[{id:'baseline',checkpoint_id:'model'},{id:'quant',checkpoint_id:'model'}],
  configurations:[{id:'old',artifact_id:'baseline',compatibility:'known'},{id:'new',artifact_id:'quant',compatibility:'known'}],
  conditions:['old','new'].map(id=>({id:id+'-off',configuration_id:id,kind:'baseline',reasoning_requested:'off'})),
  aggregates:['old','new'].flatMap(id=>['coding','reading'].map(s=>({configuration_id:id,condition_id:id+'-off',suite_id:s,eligible:id==='new'||s==='coding',scored:id==='new'?10:5,planned:10,score:id==='new'?.2:1})))
}) as unknown as OverviewData;
it('chooses a whole setup by coverage, unaffected by scores or sorted category',()=>{
  const d=fixture();const rows=heatmapRows(d,'off');expect(rows).toHaveLength(1);expect(rows[0]!.config.id).toBe('new');expect(rows[0]!.results.every(r=>r.configuration_id==='new')).toBe(true);
  d.aggregates.forEach(r=>r.score=r.configuration_id==='old'?0:1);expect(heatmapRows(d,'off')[0]!.config.id).toBe('new');
  expect(sortHeatmapRows(rows,'reading')[0]!.config.id).toBe('new');
});
it('preserves modes, explicit setup alternatives and withdrawal exclusion',()=>{
 const d=fixture();expect(heatmapRows(d,'on')).toHaveLength(0);expect(heatmapRows(d,'off',true)).toHaveLength(2);
 d.conditions[0]!.observed_reasoning='enabled';expect(heatmapRows(d,'on')[0]!.config.id).toBe('old');
 d.configurations[1]!.status='withdrawn';expect(heatmapRows(d,'off',true)).toHaveLength(0);
});
it('keeps qualified results below eligible scores even when sorting low to high',()=>{
 const rows=heatmapRows(fixture(),'off',true);
 for(const ascending of [false,true]) expect(sortHeatmapRows(rows,'reading',ascending).map(r=>r.config.id)).toEqual(['new','old']);
});
