import type { OverviewData } from './public-types';
import { displayedMode, visibleCondition } from './reasoning';
import { qualityIndex, qualityColumns, columnResult } from './quality-index';

export type HeatmapRow = ReturnType<typeof heatmapRows>[number];

/** Select a whole setup using coverage only. Never assemble a row from different quants. */
export function heatmapRows(data: OverviewData, mode: string, allSetups = false) {
  return data.checkpoints.flatMap(checkpoint => {
    const candidates = data.configurations.flatMap(config => {
      const artifact = data.artifacts.find(a => a.id === config.artifact_id && a.checkpoint_id === checkpoint.id);
      if (!artifact || config.status === 'withdrawn') return [];
      return data.conditions.filter(c => c.configuration_id === config.id && c.kind === 'baseline' && visibleCondition(c) && (mode === 'all' || displayedMode(c) === mode)).map(condition => {
        const results = data.aggregates.filter(a => a.configuration_id === config.id && a.condition_id === condition.id);
        return { checkpoint, artifact, config, condition, results };
      });
    });
    candidates.sort((a, b) => b.results.filter(r => r.eligible).length - a.results.filter(r => r.eligible).length
      || b.results.reduce((n,r) => n + r.scored / Math.max(1,r.planned),0) - a.results.reduce((n,r) => n + r.scored / Math.max(1,r.planned),0)
      || Number(b.artifact.id === checkpoint.baseline_artifact_id) - Number(a.artifact.id === checkpoint.baseline_artifact_id)
      || Number(b.config.compatibility === 'known') - Number(a.config.compatibility === 'known')
      || a.config.id.localeCompare(b.config.id) || a.condition.id.localeCompare(b.condition.id));
    return allSetups ? candidates : candidates.slice(0, 1);
  });
}

export function sortHeatmapRows(rows: HeatmapRow[], suiteId: string, ascending = false) {
  return [...rows].sort((a,b) => {
    const ar = a.results.find(r => r.suite_id === suiteId), br = b.results.find(r => r.suite_id === suiteId);
    const av = ar?.eligible && ar.score != null ? ar.score : null;
    const bv = br?.eligible && br.score != null ? br.score : null;
    // Unranked/missing results stay last in either direction.
    return Number(bv !== null) - Number(av !== null)
      || (av !== null && bv !== null ? (ascending ? av-bv : bv-av) : 0)
      || a.checkpoint.name.localeCompare(b.checkpoint.name) || a.config.id.localeCompare(b.config.id) || a.condition.id.localeCompare(b.condition.id);
  });
}

export function sortQualityRows(data:OverviewData,rows:HeatmapRow[],columnId:string,ascending=false) {
  const column=qualityColumns(data).find(c=>c.id===columnId);
  const value=(row:HeatmapRow)=>{
    if(columnId==='overall')return qualityIndex(data,row.results).score;
    const result=column&&columnResult(row.results,column);
    return result?.eligible?result.score:null;
  };
  const values=new Map(rows.map(r=>[r,value(r)]));
  return [...rows].sort((a,b)=>{
    const av=values.get(a)??null,bv=values.get(b)??null;
    return Number(bv!==null)-Number(av!==null)||(av!==null&&bv!==null?(ascending?av-bv:bv-av):0)
      || a.checkpoint.name.localeCompare(b.checkpoint.name)||a.config.id.localeCompare(b.config.id)||a.condition.id.localeCompare(b.condition.id);
  });
}

export function heatmapColor(score: number) {
  const value = Math.max(0, Math.min(1, score));
  const low = value < .5 ? [239,197,128] : [240,244,224];
  const high = value < .5 ? [240,244,224] : [23,100,93];
  const t = value < .5 ? value*2 : (value-.5)*2;
  const rgb = low.map((v,i) => Math.round(v+(high[i]!-v)*t));
  const linear = rgb.map(v => v/255 <= .04045 ? v/255/12.92 : ((v/255+.055)/1.055)**2.4);
  const luminance = linear[0]!*.2126+linear[1]!*.7152+linear[2]!*.0722;
  return { backgroundColor: `rgb(${rgb.join(',')})`, color: 1.05/(luminance+.05) >= 4.5 ? '#ffffff' : '#000000' };
}
