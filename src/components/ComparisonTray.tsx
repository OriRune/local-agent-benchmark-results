import { conditionLabel } from '../lib/reasoning';
import { useEffect, useState } from 'react';
import type { OverviewData } from '../lib/public-types';
import { addSelection, comparisonUrl, selectionKey, type Selection } from '../lib/comparison';

export function useComparisonSelection(data: OverviewData, releaseId: string) {
  const [selected, setSelected] = useState<Selection[]>([]); const [ready, setReady] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agentbench-comparison') || 'null');
      if (saved?.releaseId === releaseId && Array.isArray(saved.selections)) {
        const valid: Selection[] = [];
        for (const s of saved.selections) {
          if (!s || !data.conditions.some(c => c.id === s.conditionId && c.configuration_id === s.configurationId)) continue;
          if (!valid.some(v => selectionKey(v) === selectionKey(s)) && valid.length < 4) valid.push(s);
        }
        setSelected(valid);
      }
    } catch { /* Optional local preference. */ }
    setReady(true);
  }, [releaseId]);
  useEffect(() => { if (ready) { try { localStorage.setItem('agentbench-comparison', JSON.stringify({ releaseId, selections: selected })); } catch {} } }, [selected, ready, releaseId]);
  function toggle(next: Selection) {
    setError('');
    if (selected.some(s => selectionKey(s) === selectionKey(next))) setSelected(selected.filter(s => selectionKey(s) !== selectionKey(next)));
    else { try { setSelected(addSelection(selected, next)); } catch (e) { setError((e as Error).message); } }
  }
  function clear() { setSelected([]); setError(''); }
  return { selected, toggle, clear, error, ready };
}

export default function ComparisonTray({ data, releaseId, suiteId, selected, toggle, clear, error }: { data: OverviewData; releaseId: string; suiteId: string; selected: Selection[]; toggle: (selection: Selection) => void; clear: () => void; error: string }) {
  if (!selected.length) return null;
  return <aside className="tray" aria-label="Comparison selection"><div><strong aria-live="polite">{selected.length}/4 configurations selected</strong><details><summary>Review or remove selections</summary><ul className="tray-list">{selected.map(s => { const config = data.configurations.find(c => c.id === s.configurationId)!; const condition = data.conditions.find(c => c.id === s.conditionId)!; return <li key={selectionKey(s)}><span>{config.name} · {conditionLabel(condition)}</span> <button onClick={() => toggle(s)} aria-label={`Remove ${config.name}, ${conditionLabel(condition)}`}>Remove</button></li>; })}</ul></details>{error && <p role="alert" className="warning">{error}</p>}</div><div className="toolbar"><button onClick={clear}>Clear</button>{selected.length >= 2 ? <a className="primary" href={comparisonUrl({ releaseId, suiteId, selections: selected })}>Compare →</a> : <button disabled>Choose one more</button>}</div></aside>;
}
