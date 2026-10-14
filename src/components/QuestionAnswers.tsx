import { conditionLabel } from '../lib/reasoning';
import { useEffect, useState } from 'react';
import type { OverviewData, QuestionData } from '../lib/public-types';
import EvidenceViewer from './EvidenceViewer';
import AttemptPicker from './AttemptPicker';
import AttemptHistory from './AttemptHistory';
export default function QuestionAnswers({ data, index, editionId }: { data: QuestionData; index: OverviewData; editionId?: string }) {
  const choices = data.attempts.filter(a => a.canonical);
  const defaultId = choices.find(a => a.status === 'scored')?.id || choices[0]?.id || '';
  const [attemptId, setAttempt] = useState(defaultId); const [error, setError] = useState('');
  useEffect(() => {
    function restore() {
      const query = new URLSearchParams(location.search); const requested = query.get('attempt');
      const configuration = query.get('configuration'); const condition = query.get('condition');
      const matches = (id: string) => { const trial = data.trials.find(t => t.id === id)!; return (!configuration || trial.configuration_id === configuration) && (!condition || trial.condition_id === condition); };
      const selected = requested ? data.attempts.find(a => a.id === requested && matches(a.trial_id)) : configuration || condition ? choices.find(a => matches(a.trial_id)) : data.attempts.find(a => a.id === defaultId);
      if (!selected && (requested || configuration || condition)) { setAttempt(''); setError('No recorded answer matches this exact configuration, condition or attempt.'); }
      else { setAttempt(selected?.id || ''); setError(''); }
    }
    restore(); window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);
  }, [data.question.id]);
  function choose(id: string) { const selected = data.attempts.find(a => a.id === id)!; const trial = data.trials.find(t => t.id === selected.trial_id)!; const query = new URLSearchParams(location.search); query.set('attempt', id); query.set('configuration', trial.configuration_id); query.set('condition', trial.condition_id); if (editionId) { query.set('release', editionId); query.set('question', data.question.id); } history.pushState(null, '', `?${query}`); setAttempt(id); setError(''); }

  const attempt = data.attempts.find(a => a.id === attemptId);
  const label = (id: string) => { const trial = data.trials.find(t => t.id === id)!; const config = index.configurations.find(c => c.id === trial.configuration_id)!; const condition = index.conditions.find(c => c.id === trial.condition_id)!; return `${config.name} · ${conditionLabel(condition)} · ${trial.kind} seed ${trial.seed}`; };
  return <section className="panel"><h2>Recorded model answers</h2>{!choices.length ? <p className="empty">No canonical answer has been recorded yet.</p> : <><AttemptPicker key={data.question.id} attempts={data.attempts} selectedId={attemptId} label={label} choose={choose}/>{error && <p className="warning" role="alert">{error}</p>}{attempt && <><p>{!attempt.canonical && <span className="badge">Historical · not counted in current score</span>} <span className="badge">{attempt.status.replaceAll('_', ' ')}</span> {attempt.score === null ? 'No assessed quality score' : `${(attempt.score * 100).toFixed(1)}% credit`} · {attempt.wall_s === null ? 'Time unavailable' : `${attempt.wall_s.toFixed(1)} seconds`}</p><h3>Original final answer</h3><EvidenceViewer key={attempt.id} component={attempt.components.answer} objects={data.objects} label="Final answer" auto/>{attempt.branches.map(b => <details key={b.id}><summary>{b.name} branch</summary><EvidenceViewer component={b.answer} objects={data.objects} label={`${b.name} answer`}/></details>)}{(['checks', 'input', 'reasoning', 'tools', 'artifacts'] as const).map(key => <details key={key}><summary>{({ checks: 'Recorded grading checks', input: 'Captured input and tool schemas', reasoning: 'Captured reasoning', tools: 'Tool calls and results', artifacts: 'Code and saved file changes' })[key]}</summary><EvidenceViewer component={attempt.components[key]} objects={data.objects} label={key}/></details>)}<AttemptHistory key={attempt.id} ids={attempt.supersedes_attempt_ids} data={data} choose={choose}/></>}</>}</section>;
}
