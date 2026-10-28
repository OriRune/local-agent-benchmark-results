import { enrichReaderPacket, retainsPriorCohort } from './reader-data.mjs';
/** Public, offline reconstruction of the versioned analyst dependency packet. */
import { createHash } from 'node:crypto';
import { canonical } from '../src/lib/canonical.mjs';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const order = rows => [...rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const same = (a, b) => canonical(a) === canonical(b);
const requireThat = (value, message) => { if (!value) throw new Error(message); };
const EPSILON = 1e-9;

export function buildSummaryPacket(data, configurationId) {
  const config = data.configurations.find(c => c.id === configurationId);
  requireThat(config, 'Unknown summary configuration');
  const artifact = data.artifacts.find(a => a.id === config.artifact_id);
  const checkpoint = data.checkpoints.find(c => c.id === artifact.checkpoint_id);
  const conditions = order(data.conditions.filter(c => c.configuration_id === config.id));
  const trials = new Map(data.trials.filter(t => t.configuration_id === config.id).map(t => [t.id, t]));
  const attempts = order(data.attempts.filter(a => trials.has(a.trial_id)));
  const canonicalAttempts = attempts.filter(a => a.canonical);
  const baselines = canonicalAttempts.filter(a => trials.get(a.trial_id).primary);
  const aggregates = order(data.aggregates.filter(a => a.configuration_id === config.id));
  const comparisons = order(data.comparisons.filter(a => a.configuration_id === config.id));
  const repetitions = order(data.repetitions.filter(a => a.configuration_id === config.id));
  const suiteIds = new Set([...trials.values()].map(t => t.suite_id));
  const suites = order(data.suites.filter(s => suiteIds.has(s.id)));
  const questions = new Map(data.questions.map(q => [q.id, q]));
  const byTrial = new Map(canonicalAttempts.map(a => [a.trial_id, a]));
  const selected = new Set(), selection = [];
  for (const suite of suites) {
    const rows = baselines.filter(a => trials.get(a.trial_id).suite_id === suite.id);
    const groups = {
      full_credit: rows.filter(a => a.status === 'scored' && a.score >= 1 - EPSILON),
      partial_credit: rows.filter(a => a.status === 'scored' && a.score > EPSILON && a.score < 1 - EPSILON),
      zero_credit: rows.filter(a => a.status === 'scored' && a.score <= EPSILON),
      unassessed: rows.filter(a => a.status !== 'scored' && a.attempted === true),
    };
    for (const [stratum, candidates] of Object.entries(groups)) {
      const ids = candidates.map(a => a.id).sort((a, b) => compare(digest(a), digest(b)) || compare(a, b));
      const available = new Set(candidates.filter(a => a.components.answer.object_ids.length).map(a => a.id));
      const chosen = ids.filter(id => available.has(id)).slice(0, 1); chosen.forEach(id => selected.add(id));
      selection.push({ suite_id: suite.id, stratum, candidate_ids: ids, unavailable_ids: ids.filter(id => !available.has(id)), selected_ids: chosen });
    }
    const pairs = comparisons.filter(p => p.suite_id === suite.id && p.verified).flatMap(p => p.pairs).filter(p => Math.abs(p.on_score - p.off_score) > EPSILON);
    pairs.sort((a, b) => Math.abs(b.on_score - b.off_score) - Math.abs(a.on_score - a.off_score) || compare(digest(a.pair_key), digest(b.pair_key)));
    const candidates = pairs.map(p => [byTrial.get(p.off_trial_id).id, byTrial.get(p.on_trial_id).id]);
    const available = new Set(rows.filter(a => a.components.answer.object_ids.length).map(a => a.id));
    const chosen = candidates.filter(pair => pair.every(id => available.has(id))).slice(0, 2);
    chosen.flat().forEach(id => selected.add(id));
    selection.push({ suite_id: suite.id, stratum: 'thinking_change', candidate_pairs: candidates, selected_pairs: chosen });
  }
  const examples = attempts.filter(a => selected.has(a.id)).map(attempt => {
    const trial = trials.get(attempt.trial_id); return { attempt, trial, question: questions.get(trial.question_id) };
  });
  const objectIds = new Set();
  function refs(value) {
    if (Array.isArray(value)) value.forEach(refs);
    else if (value && typeof value === 'object') { (value.object_ids ?? []).forEach(id => objectIds.add(id)); Object.values(value).forEach(refs); }
  }
  refs(examples);
  const objects = order(data.objects.filter(o => objectIds.has(o.id)));
  requireThat(objects.length === objectIds.size, 'Missing summary evidence object');
  const facts = [];
  function numeric(record, metric, value, unit) {
    facts.push({ id: `fact-${digest([record.id, metric]).slice(0, 24)}`, record_id: record.id, metric, value, unit,
      configuration_id: config.id, suite_id: record.suite_id ?? null, condition_id: record.condition_id ?? null });
  }
  for (const record of aggregates) {
    for (const metric of ['planned', 'scored', 'full_credit', 'partial_credit', 'zero_credit', 'timed']) numeric(record, metric, record[metric], 'trials');
    numeric(record, 'score', record.score, 'normalized_credit'); numeric(record, 'median_task_s', record.median_task_s, 'seconds');
    numeric(record, 'generated_tokens_per_s', record.generated_tokens_per_s, 'tokens_per_second');
    for (const outcome of Object.keys(record.states).sort()) numeric(record, `states.${outcome}`, record.states[outcome], 'trials');
    for (const outcome of Object.keys(record.outcome_counts??{}).sort()) numeric(record, `outcome_counts.${outcome}`, record.outcome_counts[outcome], 'trials');
  }
  for (const record of comparisons) {
    for (const metric of ['score_pairs', 'time_pairs', 'planned_pairs', 'improved', 'worsened', 'unchanged']) numeric(record, metric, record[metric], 'pairs');
    for (const metric of ['off_score', 'on_score']) numeric(record, metric, record[metric], 'normalized_credit');
    numeric(record, 'delta_pp', record.delta_pp, 'percentage_points'); numeric(record, 'ratio_summed_time', record.ratio_summed_time, 'ratio');
    for (const metric of ['mean_off_s', 'mean_on_s', 'mean_added_s', 'median_off_s', 'median_on_s', 'median_paired_delta_s', 'total_added_s']) numeric(record, metric, record[metric], 'seconds');
  }
  for (const record of repetitions) {
    for (const metric of ['full_credit_repetitions', 'planned_repetitions', 'scored_repetitions']) numeric(record, metric, record[metric], 'repetitions');
    for (const metric of ['planned_questions', 'complete_questions', 'all_repeats_full_credit']) numeric(record, metric, record[metric], 'questions');
  }
  const limitations = [
    'Results describe these saved tested setups and task banks, not general model ability.',
    'Qualitative examples are a deterministic sample; they do not establish whole-bank behavior.',
    'Scores from different suite metrics cannot establish a strongest capability.',
    'Task timing includes tools and grading; weight download size is not required RAM.',
  ];
  if (aggregates.some(a => !a.eligible)) limitations.push('Some suite/condition results are incomplete or ineligible; their observed scores are previews.');
  if (config.compatibility !== 'known') limitations.push('Execution compatibility is uncertain; causal or superiority claims are unsupported.');
  if(config.execution_kind==='cloud') {
    limitations.push("Hosted provider/precision condition, not a local GGUF run. Cloud timing and memory are excluded from all local speed and memory comparisons. The hosted output allowance includes reasoning; it does not guarantee the separate local thinking cap. No verified thinking-on/off comparison was run.");
    limitations.push(data.outcome_policy ? data.outcome_policy.description+' Authorized infrastructure retries count once per scheduled trial; original failures remain in history.' : "Resolved trials can include unscored no-answer, context-hold, review and provider-error outcomes. Scores summarize only scored trials; missing outcomes are not wrong answers or successes. Authorized infrastructure retries count once per scheduled trial; original failures remain in history.");
    const reasons=canonicalAttempts.map(a=>a.outcome_reason??'').join(' ');
    if(!data.outcome_policy&&(reasons.includes('finish=length')||reasons.includes('output_limit_exhausted'))) limitations.push("Some hosted trials exhausted the output allowance without a visible answer. They remain unscored; high scores among completed answers do not establish success on these missing responses.");
    if(reasons.includes('finish=stop')) limitations.push("Some hosted trials ended normally according to the provider but supplied no visible answer. Their cause is not established by the stop marker; they remain unscored, not confirmed provider outages or ordinary wrong answers.");
  } else {
    if (conditions.some(c => !['verified','native_reasoning'].includes(c.verification))) limitations.push("Some requested reasoning conditions lack verified control.");
    if (conditions.some(c => c.verification === 'native_reasoning')) limitations.push(conditions.some(c => c.reasoning_effort != null) ? "This is a native reasoning condition at its recorded effort, not a matched thinking-on/off experiment." : "This is a native reasoning checkpoint. Its Instruct counterpart is a related checkpoint with different weights, not a matched thinking-off run of this GGUF.");
  }
  if (objects.some(o => o.availability === 'redacted')) limitations.push('Some selected evidence has recorded publication redactions.');
  const investigations=(data.investigations??[]).filter(r=>r.configuration_id===config.id);
  limitations.push(...investigations.map(r=>r.text));
  const counts = rows => rows.reduce((out, a) => { out[a.status] = (out[a.status] ?? 0) + 1; return out; }, {});
  const history = { canonical_outcomes: counts(canonicalAttempts), historical_attempt_incidents: counts(attempts.filter(a => !a.canonical)), unknown_attempt_attribution: attempts.filter(a => a.attempted === null).length };
  const policies = Object.fromEntries(['schema_version', 'export_version', 'aggregation_version', 'publication_policy_hash', 'protocol_id', 'outcome_policy'].filter(key=>key in data).map(key => [key, data[key]]));
  const inputs = { facts_version: 'analyst-facts-v1', selection_policy: 'balanced-examples-v1', policies, subject: { checkpoint, artifact, configuration: config },
    conditions, suites, aggregates, comparisons, repetitions, history, numeric_facts: order(facts), selection, examples, objects,
    limitations: limitations.map(text => ({ id: `limitation-${digest(text).slice(0, 24)}`, text })) };
  if(investigations.length){inputs.investigations=investigations;inputs.context_followups=(data.context_followups??[]).filter(r=>r.configuration_id===config.id);}
  const eligible = config.compatibility === 'known' && aggregates.some(a => a.eligible);
  return { packet_schema_version: 1, configuration_id: config.id, origin_dataset_revision_id: data.dataset_revision_id, analysis_input_hash: digest(inputs),
    generation_eligibility: { eligible, reason: eligible ? null : 'No complete eligible suite in a compatible configuration.', scored_baseline_trials: aggregates.reduce((sum, a) => sum + a.scored, 0) }, inputs };
}

export function verifyEditorialReview(editorial) {
  requireThat(['human', 'agent'].includes(editorial.reviewer_kind), 'Summary reviewer kind is not explicit');
  if (editorial.reviewer_kind === 'agent') {
    const authorization = editorial.publication_authorization;
    requireThat(typeof editorial.reviewer_name === 'string' && editorial.reviewer_name.trim(), 'Agent summary reviewer must be named');
    requireThat(authorization?.authorized_by === 'user' && typeof authorization.instruction === 'string' && authorization.instruction.trim() &&
      typeof authorization.authorized_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(authorization.authorized_at) && Number.isFinite(Date.parse(authorization.authorized_at)), 'Agent summary lacks separate user publication authorization');
  }
}

export function verifySummaryDependencies(summary, packet, data) {
  requireThat(summary.summary_id === `summary-${digest(Object.fromEntries(Object.entries(summary).filter(([key]) => key !== 'summary_id')))}`, 'Summary content identity differs');
  requireThat(summary.editorial.state === 'approved' && ['direct', 'subject_synthesis'].includes(summary.provenance.stage), 'Summary is not an approved final analysis');
  verifyEditorialReview(summary.editorial);
  const source = summary.failed_response_editorial;
  if (source) {
    requireThat(!summary.editorial_basis && source.source_job_id === summary.job_id && source.source_status === 'claims_failed' &&
      source.correction_kind === 'foreign_condition_ids_only' && summary.editorial.reviewer_kind === 'agent' &&
      summary.provenance.stage === 'direct' && summary.provenance.contributors.length === 0 &&
      source.source_validation_errors.split('; ').every(error => /^Claim \d+: wrong subject or condition$/.test(error)) &&
      summary.editorial.edited && summary.editorial.edit_author === 'Codex' && summary.editorial.supersedes_summary_id === null,
      'Offline editorial response provenance differs');
    const claims = new Map([['verdict', summary.content.verdict], ...['strengths','weaknesses','thinking_tradeoffs','limitations','peer_comparisons'].flatMap(section => (summary.content[section] ?? []).map((claim, number) => [`${section}[${number}]`, claim]))]);
    const seen = new Set();
    for (const change of source.changes) {
      const before = change.original_condition_ids, after = change.corrected_condition_ids;
      requireThat(!seen.has(change.claim_path) && claims.has(change.claim_path) && !same(before, after) &&
        same(before.filter(id => after.includes(id)), after) && same(claims.get(change.claim_path).condition_ids, after), 'Offline condition-reference edit provenance differs');
      seen.add(change.claim_path);
    }
  } else requireThat(summary.editorial.supersedes_summary_id !== null, 'Approved revision lacks source draft or failed-response provenance');
  if (summary.editorial_basis) requireThat(summary.editorial.supersedes_summary_id === summary.editorial_basis.source_summary_id && summary.editorial.edit_author === summary.editorial_basis.edit_author, 'Editorial provenance differs from the approved revision');
  const base = buildSummaryPacket(data, summary.subject.configuration_id);
  const expected = summary.summary_schema_version === 2 ? enrichReaderPacket(base, data) : base;
  if (summary.summary_schema_version === 2 && summary.evidence.analysis_input_hash !== expected.analysis_input_hash && retainsPriorCohort(packet.inputs.reader_context,expected.inputs.reader_context)) {
    expected.inputs.reader_context=packet.inputs.reader_context;expected.inputs.numeric_facts=order([...expected.inputs.numeric_facts.filter(f=>f.metric!=='memory_budget'),...packet.inputs.numeric_facts.filter(f=>f.metric==='memory_budget')]);expected.analysis_input_hash=digest(expected.inputs);expected.peer_refresh_needed=true;
  }
  requireThat(same(packet, expected), 'Summary facts differ from the current dataset');
  requireThat(expected.generation_eligibility.eligible, 'Summary subject lacks eligible evidence');
  requireThat(summary.evidence.analysis_input_hash === expected.analysis_input_hash, 'Summary evidence is stale');
  requireThat(summary.subject.checkpoint_id === expected.inputs.subject.checkpoint.id && summary.evidence.selection_policy_version === expected.inputs.selection_policy, 'Summary subject or selection policy differs');
  verifySummaryGraph(summary);
  verifySummaryClaims(summary, expected);
}

function verifySummaryGraph(summary) {
  const provenance = summary.provenance, records = new Map(provenance.contributors.map(c => [c.summary_id, c]));
  const synthesis = new Set(['suite_synthesis', 'intermediate_synthesis', 'subject_synthesis']);
  requireThat(records.size === provenance.contributors.length, 'Duplicate summary contributor');
  requireThat(new Set(provenance.input_summary_ids).size === provenance.input_summary_ids.length, 'Duplicate summary dependency');
  requireThat(synthesis.has(provenance.stage) ? provenance.input_summary_ids.length > 0 : records.size === 0 && provenance.input_summary_ids.length === 0, 'Summary stage differs from its dependencies');
  const visited = new Set(), active = new Set();
  function visit(id) {
    requireThat(!active.has(id), 'Cyclic summary provenance');
    if (visited.has(id)) return;
    const item = records.get(id); requireThat(item, 'Missing summary contributor');
    requireThat(item.configuration_id === summary.subject.configuration_id, 'Summary contributor belongs to another subject');
    requireThat(new Set(item.input_summary_ids).size === item.input_summary_ids.length, 'Duplicate contributor dependency');
    requireThat(Boolean(item.input_summary_ids.length) === synthesis.has(item.stage), 'Contributor stage differs from dependencies');
    active.add(id); item.input_summary_ids.forEach(visit); active.delete(id); visited.add(id);
  }
  provenance.input_summary_ids.forEach(visit);
  requireThat(visited.size === records.size, 'Unreachable summary contributor');
}

export function verifySummaryClaims(summary, packet) {
  const reader = summary.content.output_schema_version === 2;
  requireThat(reader === (summary.validation.validator_version === 'summary-validator-reader-v1'), 'Summary schema and validator differ');
  const inputs = packet.inputs, facts = new Map(inputs.numeric_facts.map(f => [f.id, f]));
  const examples = new Map(inputs.examples.map(e => [e.attempt.id, e]));
  const limits = new Set(inputs.limitations.map(l => l.id)), conditions = new Set(inputs.conditions.map(c => c.id));
  const aggregates = new Map(inputs.aggregates.map(a => [a.id, a])), pairs = new Map(inputs.comparisons.map(p => [p.id, p]));
  const peers = new Map((reader ? inputs.reader_context?.records ?? [] : []).map(r => [r.id, r]));
  const allowed = new Set([...facts.keys(), ...examples.keys(), ...limits, ...peers.keys()]);
  const claims = [['verdict', summary.content.verdict], ...['strengths', 'weaknesses', 'thinking_tradeoffs', 'limitations', ...(reader ? ['peer_comparisons'] : [])].flatMap(section => summary.content[section].map(claim => [section, claim]))];
  const hasAll = (set, values) => values.every(value => set.has(value));
  for (const [section, claim] of claims) {
    const refs = new Set(claim.evidence_refs), conditionIds = new Set(claim.condition_ids);
    requireThat(refs.size > 0 && [...refs].every(ref => allowed.has(ref)), 'Unknown summary evidence reference');
    requireThat(claim.configuration_id === packet.configuration_id && [...conditionIds].every(id => conditions.has(id)), 'Wrong summary claim subject or condition');
    requireThat(claim.text.trim(), 'Empty summary claim');
    const used = new Set(claim.numeric_facts.map(f => f.fact_id)), placeholders = new Set([...claim.text.matchAll(/\{\{(fact-[a-f0-9]+)\}\}/g)].map(m => m[1]));
    requireThat(used.size === claim.numeric_facts.length && (reader ? [...placeholders].every(id => used.has(id)) : used.size === placeholders.size && [...used].every(id => placeholders.has(id))), 'Summary numeric placeholders differ');
    const usedFacts = [];
    for (const number of claim.numeric_facts) {
      const fact = facts.get(number.fact_id);
      requireThat(fact && refs.has(fact.id) && ['metric', 'value', 'unit'].every(key => same(number[key], fact[key])), 'Summary numeric fact differs');
      requireThat(!fact.condition_id || conditionIds.has(fact.condition_id), 'Summary fact belongs to an uncited condition');
      usedFacts.push(fact);
    }
    if (reader) {
      const citedPeers = new Set(claim.comparison_refs);
      requireThat(citedPeers.size === claim.comparison_refs.length, 'Duplicate comparison reference');
      requireThat([...citedPeers].every(id => peers.has(id) && refs.has(id)) && [...refs].filter(id => peers.has(id)).every(id => citedPeers.has(id)), 'Unknown or undeclared peer support');
      requireThat(!(claim.scope === 'peer_comparison' || section === 'peer_comparisons') || citedPeers.size, 'Peer judgment lacks comparison');
      requireThat([...citedPeers].every(id => conditionIds.has(peers.get(id).condition_id)), 'Peer condition is uncited');
      requireThat([...refs].filter(id => facts.has(id)).every(id => used.has(id)), 'Numeric support is not validated');
      requireThat(!/fits? (?:in|within)|memory budget|GB RAM/i.test(claim.text) || [...citedPeers].some(id => peers.get(id).kind === 'memory'), 'Memory judgment lacks verified peers');
      requireThat(!/for (?:its|the) size|among.*(?:peers|models)|outperform|compared (?:with|to)/i.test(claim.text) || citedPeers.size, 'Relative judgment lacks peers');
    }
    let prose = claim.text.replace(/\{\{fact-[a-f0-9]+\}\}/g, '');
    for (const name of [inputs.subject.checkpoint.name, inputs.subject.configuration.name, ...(reader ? claim.comparison_refs.flatMap(id => peers.get(id).members.map(m => m.name)) : [])]) prose = prose.split(name).join('');
    requireThat(!/(?<![\p{L}\p{N}_])[-+]?\p{Nd}+(?:[.,]\p{Nd}+)?/u.test(prose), 'Summary literal numeric claim lacks a fact placeholder');
    requireThat(!(reader ? /better at everything|best in class|universally superior/i : /better at everything|best in class|universally superior|strong for (?:its|the) size/i).test(prose), 'Unsupported summary superiority claim');
    const citedExamples = [...refs].filter(id => examples.has(id)).map(id => examples.get(id));
    if (claim.scope === 'reviewed_examples') {
      const questions = new Set(citedExamples.map(e => e.trial.question_id));
      requireThat(questions.size > 0 && (claim.illustration || questions.size >= 2), 'Summary behavioral pattern lacks distinct questions');
      requireThat(citedExamples.every(e => conditionIds.has(e.trial.condition_id)), 'Summary example belongs to an uncited condition');
    }
    if (claim.scope === 'measured_fact') requireThat([...refs].some(id => facts.has(id)), 'Measured summary claim lacks a fact');
    if (claim.scope === 'limitation') requireThat([...refs].some(id => limits.has(id)), 'Summary limitation lacks a source');
    for (const fact of usedFacts) {
      const aggregate = aggregates.get(fact.record_id), pair = pairs.get(fact.record_id);
      const metrics = new Set(usedFacts.filter(f => f.record_id === fact.record_id).map(f => f.metric));
      if (aggregate && (fact.metric === 'score' || reader && ['full_credit','partial_credit','zero_credit','median_task_s','generated_tokens_per_s'].includes(fact.metric))) {
        requireThat(hasAll(metrics, ['scored', 'planned']), 'Summary score omits coverage');
        requireThat(!reader || !['median_task_s','generated_tokens_per_s'].includes(fact.metric) || metrics.has('timed'), 'Timing claim omits coverage');
        requireThat(aggregate.eligible || claim.text.toLowerCase().includes('preview'), 'Ineligible summary score lacks preview label');
      }
      if (pair) {
        const diagnostic = ['summary-validator-v2','summary-validator-reader-v1'].includes(summary.validation.validator_version) && section === 'limitations' && claim.scope === 'limitation'
          && [...metrics].every(metric => ['score_pairs', 'time_pairs', 'planned_pairs'].includes(metric));
        requireThat((pair.verified || diagnostic) && hasAll(metrics, ['score_pairs', 'time_pairs', 'planned_pairs']), 'Summary thinking claim lacks verified pair coverage');
        requireThat(diagnostic || pair.complete && pair.timing_complete || claim.text.toLowerCase().includes('preview'), 'Incomplete summary thinking claim lacks preview label');
      }
    }
    if (section === 'thinking_tradeoffs') requireThat(usedFacts.some(f => pairs.has(f.record_id)), 'Summary thinking tradeoff lacks paired facts');
  }
  const disclosed = new Set(summary.content.limitations.flatMap(c => c.evidence_refs));
  if (reader) {
    requireThat(new Set(summary.content.shared_limitation_refs).size === summary.content.shared_limitation_refs.length, 'Duplicate shared limitation reference');
    requireThat(same([...summary.content.shared_limitation_refs].sort(), [...inputs.shared_limitation_ids].sort()), 'Shared limitations differ');
    summary.content.shared_limitation_refs.forEach(id => disclosed.add(id));
  }
  requireThat([...limits].every(id => disclosed.has(id)), 'Summary omits required limitations');
  requireThat(['summary-validator-v1', 'summary-validator-v2', 'summary-validator-reader-v1'].includes(summary.validation.validator_version), 'Unsupported summary validator version');
  requireThat(same(summary.validation, { status: 'passed', validator_version: summary.validation.validator_version, semantic_review_required: true, claims: claims.length }), 'Summary validation record differs');
}
