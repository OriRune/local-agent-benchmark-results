import { useState } from 'react';
import type { OverviewData } from '../lib/public-types';
import { comparisonUrl, selectionKey, type Selection } from '../lib/comparison';
import { visibleCondition, conditionLabel } from '../lib/reasoning';
import { useComparisonSelection } from './ComparisonTray';

export default function ComparisonPicker({data,releaseId,initial,suiteId}: {data:OverviewData;releaseId:string;initial?:Selection[];suiteId?:string}) {
  const saved=useComparisonSelection(data,releaseId);
  const [edited,setEdited]=useState<Selection[]|undefined>(initial), [search,setSearch]=useState(''), [candidate,setCandidate]=useState('');
  const selected=edited ?? saved.selected;
  const options=data.conditions.filter(c=>c.kind==='baseline'&&visibleCondition(c)).flatMap(c=>{const config=data.configurations.find(x=>x.id===c.configuration_id);if(!config)return [];const value=selectionKey({configurationId:config.id,conditionId:c.id});return [{value,label:`${config.name} · ${conditionLabel(c)} · ${config.status}`,selection:{configurationId:config.id,conditionId:c.id}}]});
  const filtered=options.filter(o=>o.label.toLowerCase().includes(search.toLowerCase())&&!selected.some(s=>selectionKey(s)===o.value)).sort((a,b)=>a.label.localeCompare(b.label));
  const active=filtered.find(o=>o.value===candidate) ?? filtered[0];
  return <section className="comparison-picker" aria-label="Choose models to compare"><h2>{initial?'Edit your comparison':'Choose two to four tested setups'}</h2><p>Compare a task, then open the actual answers. Quantizations and thinking settings stay separate.</p>
    <div className="toolbar"><label htmlFor="compare-search">Find a model</label><input id="compare-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or quantization"/><label htmlFor="compare-candidate">Tested setup</label><select id="compare-candidate" value={active?.value ?? ''} onChange={e=>setCandidate(e.target.value)}>{filtered.length?filtered.map(o=><option key={o.value} value={o.value}>{o.label}</option>):<option value="">No matching setups</option>}</select><button disabled={!active||selected.length>=4||!saved.ready} onClick={()=>active&&setEdited([...selected,active.selection])}>Add setup</button></div>
    <ul className="selection-list">{selected.map(s=><li key={selectionKey(s)}>{options.find(o=>o.value===selectionKey(s))?.label}<button onClick={()=>setEdited(selected.filter(x=>selectionKey(x)!==selectionKey(s)))} aria-label={`Remove ${options.find(o=>o.value===selectionKey(s))?.label}`}>Remove</button></li>)}</ul>
    <p role="status">{selected.length}/4 selected</p>{selected.length>=2?<a className="primary button-link" href={comparisonUrl({releaseId,suiteId:suiteId??data.suites.find(s=>s.family_id==='basic')?.id??data.suites[0]!.id,selections:selected})}>Open comparison →</a>:<p className="muted">{selected.length?'Choose one more setup.':'Start with a model you know, then add one you are considering.'}</p>}
  </section>;
}
