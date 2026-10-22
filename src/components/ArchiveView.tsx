import { editionDataset } from '../lib/edition-client';
import { useEffect, useState } from 'react';
import { archiveUrl, editionObject, loadEdition, requestedEdition, type Edition } from '../lib/edition-client';
import type { QuestionData } from '../lib/public-types';
import type { PublicBenchmarkSummaryV1 } from '../lib/public-summary';
import { summaryView, type SummaryPacket, type SummaryView } from '../lib/summary-view';
import ModelResults from './ModelResults';
import { parseModelView } from '../lib/model-view';
import QuestionAnswers from './QuestionAnswers';
import EvidenceViewer from './EvidenceViewer';
import QuestionBank from './QuestionBank';
import TestExplanation from './TestExplanation';
import type { QuantPacket, QuantView } from '../lib/quant-view';
import type { PublicCheckpointQuantSummaryV1 } from '../lib/public-quant-summary';

type View = { edition: Edition; question?: QuestionData; checkpoint?: string; suite?: string; object?: string; analyses: SummaryView[];quantAnalysis?:QuantView };
export default function ArchiveView() {
  const [view, setView] = useState<View | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let version = 0;
    async function restore() {
      const request = ++version; setView(null); setError('');
      try {
        const query = new URLSearchParams(location.search), id = requestedEdition(location.search);
        for (const key of ['checkpoint', 'question', 'suite', 'object', 'attempt', 'configuration', 'condition']) if (query.getAll(key).length > 1) throw new Error('Duplicate archive selection.');
        const edition = await loadEdition(id), result: View = { edition, analyses: [] };
        let questionId = query.get('question'); const checkpoint = query.get('checkpoint'), object = query.get('object');
        if ([questionId, checkpoint, object].filter(Boolean).length > 1) throw new Error('Choose one model, question or object in this edition.');
        if (!questionId && !checkpoint && !object && query.get('attempt')) {
          // An unqualified attempt link needs the full saved inventory. Ordinary
          // question links avoid this download and resolve through a small shard.
          const data = await editionDataset(edition);
          const attempt = data.attempts.find(a => a.id === query.get('attempt'));
          questionId = data.trials.find(t => t.id === attempt?.trial_id)?.question_id ?? null;
          if (!questionId) throw new Error('This attempt is unavailable in the pinned edition.');
        }
        const suiteId = query.get('suite');
        if (suiteId && !edition.index.suites.some(s => s.id === suiteId)) throw new Error('This test version is unavailable in the pinned edition.');
        if (!questionId && !checkpoint && (query.has('configuration') || query.has('condition'))) throw new Error('Choose a model or question for this configuration.');
        if (checkpoint && query.has('attempt')) throw new Error('Choose a question to inspect an attempt.');
        if (object && (query.has('attempt') || suiteId)) throw new Error('Object links cannot include question selections.');
        if (questionId) {
          const objectId = edition.release.question_objects[questionId]; if (!objectId) throw new Error('This question is unavailable in the pinned edition.');
          result.question = await editionObject<QuestionData>(edition, objectId);
          if (result.question.question.id !== questionId) throw new Error('Archived question identity differs.');
          if (suiteId && result.question.question.suite_id !== suiteId) throw new Error('This question does not belong to the selected test version.');
        } else if (checkpoint) {
          if (!edition.index.checkpoints.some(c => c.id === checkpoint)) throw new Error('This model is unavailable in the pinned edition.');
          parseModelView(location.search, edition.index, checkpoint);
          result.checkpoint = checkpoint;
          const artifacts = new Set(edition.index.artifacts.filter(a => a.checkpoint_id === checkpoint).map(a => a.id));
          const configs = new Set(edition.index.configurations.filter(c => artifacts.has(c.artifact_id)).map(c => c.id));
          result.analyses = await Promise.all(edition.release.summary_objects.filter(s => configs.has(s.configuration_id)).map(async ref => {
            const [summary, packet] = await Promise.all([editionObject<PublicBenchmarkSummaryV1>(edition, ref.object_id), editionObject<SummaryPacket>(edition, ref.facts_object_id)]);
            return summaryView(summary, packet, { releaseId: id, checkpointId: checkpoint });
          }));
          const quantRef=edition.release.quant_summary_objects?.find(r=>r.checkpoint_id===checkpoint);
          if(quantRef){const [summary,packet]=await Promise.all([editionObject<PublicCheckpointQuantSummaryV1>(edition,quantRef.object_id),editionObject<QuantPacket>(edition,quantRef.facts_object_id)]);result.quantAnalysis={summary,packet};}
        } else if (object) {
          if (!edition.objects.has(object)) throw new Error('This object is unavailable in the pinned edition.');
          result.object = object;
        } else if (query.get('suite')) {
          const suite = query.get('suite')!;
          if (!edition.index.suites.some(s => s.id === suite)) throw new Error('This test version is unavailable in the pinned edition.');
          result.suite = suite;
        }
        if (request === version) setView(result);
      } catch (e) { if (request === version) setError((e as Error).message); }
    }
    void restore(); window.addEventListener('popstate', restore);
    return () => { version++; window.removeEventListener('popstate', restore); };
  }, [retry]);
  if (!view) return <section className="panel"><p role={error ? 'alert' : 'status'}>{error || 'Loading the exact saved edition…'}</p>{error && <button onClick={() => setRetry(n => n + 1)}>Retry edition</button>} <a href="/editions/">Browse retained editions →</a></section>;
  const { edition, question, checkpoint } = view, { release, index } = edition;
  const suite = index.suites.find(s => s.id === (question?.question.suite_id ?? view.suite));
  return <><section className="facts"><strong>Pinned edition</strong><p style={{ overflowWrap: 'anywhere' }}>{release.release_id}</p><p>These results and analyses belong to this saved edition. <a href="/">Current results →</a> · <a href={archiveUrl(release.release_id)}>Edition contents →</a></p></section>
    {checkpoint && <><h2>{index.checkpoints.find(c => c.id === checkpoint)!.name}</h2><ModelResults key={release.release_id + checkpoint} data={index} checkpointId={checkpoint} releaseId={release.release_id} analyses={view.analyses} quantAnalysis={view.quantAnalysis} archived/></>}
    {question && <QuestionAnswers key={release.release_id + question.question.id} data={question} index={index} editionId={release.release_id}/>}
    {view.object && <section className="panel"><h2>Exact saved object</h2><EvidenceViewer objects={[edition.objects.get(view.object)!]} label="Saved object" auto component={{ object_ids: [view.object], availability: edition.objects.get(view.object)!.availability, origin: 'derived', reason: 'Object bytes from the pinned public release.', redaction_rule_ids: [], source: { name: 'Public results edition', revision: release.release_id, item: view.object, attribution: 'See the source components in this edition for attribution.', url: null, terms_url: null } }}/></section>}
    {!checkpoint && !question && !view.object && <>
      {suite ? <section className="panel"><h2>{suite.name}</h2><p>{suite.description}</p><TestExplanation category explanation={index.test_descriptions?.suites[suite.id]}/><p>{suite.metric} · {suite.scoring}</p><QuestionBank key={release.release_id + suite.id} questions={index.questions.filter(q => q.suite_id === suite.id)} descriptions={index.test_descriptions?.questions} editionId={release.release_id}/></section> : <>
        <section className="panel"><h2>Models in this edition</h2><ul>{index.checkpoints.map(c => <li key={c.id}><a href={archiveUrl(release.release_id, { checkpoint: c.id })}>{c.name}</a></li>)}</ul></section>
        <section className="panel"><h2>Test versions</h2><ul>{index.suites.map(s => <li key={s.id}><a href={archiveUrl(release.release_id, { suite: s.id })}>{s.name}</a></li>)}</ul></section>
        <section className="panel"><h2>Edition changes</h2><p>{release.changes.description}</p><ul>{release.changes.summary_generator_changes.map((change, i) => <li key={i}>{change}</li>)}</ul><a href={`/data/releases/${release.release_id}/release.json`}>Manifest and object checksums</a></section>
      </>}
    </>}
  </>;
}
