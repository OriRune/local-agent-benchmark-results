import { useEffect, useState } from 'react';
import type { OverviewData } from '../lib/public-types';
import type { Object as EvidenceObject } from '../lib/public-contract';
import { loadEdition, requestedEdition } from '../lib/edition-client';
import Compare from './Compare';
import ComparisonPicker from './ComparisonPicker';
type Context = { index: OverviewData; releaseId: string; questionObjects: Record<string, EvidenceObject> };

export default function PinnedCompare(initial: Context) {
  const [context, setContext] = useState<Context | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let version = 0;
    async function restore() {
      const request = ++version; setContext(null); setError('');
      try {
        if (!location.search || !new URLSearchParams(location.search).size) { setContext(initial); return; }
        const id = requestedEdition(location.search);
        if (id === initial.releaseId) { setContext(initial); return; }
        const edition = await loadEdition(id);
        if (request !== version) return;
        const questionObjects = Object.fromEntries(Object.entries(edition.release.question_objects).map(([key, object]) => {
          const record = edition.objects.get(object); if (!record) throw new Error('Missing archived question object.'); return [key, record];
        }));
        setContext({ index: edition.index, releaseId: id, questionObjects });
      } catch (e) { if (request === version) setError((e as Error).message); }
    }
    void restore(); window.addEventListener('popstate', restore);
    return () => { version++; window.removeEventListener('popstate', restore); };
  }, [initial.releaseId, retry]);
  if (!context) return <section className="panel"><p role={error ? 'alert' : 'status'}>{error || 'Loading the pinned results edition…'}</p>{error && <button onClick={() => setRetry(n => n + 1)}>Retry edition</button>} <a href="/">Choose configurations from the current overview →</a></section>;
  const query=new URLSearchParams(location.search),suite=query.get('suite');
  if (!query.has('selection') && (!suite || query.getAll('suite').length===1 && context.index.suites.some(s=>s.id===suite))) return <ComparisonPicker data={context.index} releaseId={context.releaseId} suiteId={suite??undefined}/>;
  return <Compare key={context.releaseId} {...context}/>;
}
