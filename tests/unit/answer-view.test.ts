import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QuestionAnswers from '../../src/components/QuestionAnswers';
import { availabilitySummary, checkEntries, NO_MATCH, outcomeView, resolveSelection } from '../../src/lib/answer-view';
import { runHardware } from '../../src/lib/hardware';
import { EvidenceError, evidenceErrorKind, retryable } from '../../src/lib/evidence-error';
import { validateOutcomeAssessment, validateScoringReview } from '../../scripts/task-outcomes.mjs';
import type { Attempt, Component, Configuration } from '../../src/lib/public-contract';
import type { OverviewData, QuestionData } from '../../src/lib/public-types';

const root = new URL('../../public/data/', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const release = json(`releases/${json('latest.json').release_id}/release.json`);
const object = <T>(id: string): T => { const o = release.objects.find((x: { id: string }) => x.id === id), b = readFileSync(new URL(o.path, root)); return JSON.parse((o.encoding === 'gzip' ? gunzipSync(b) : b).toString()); };
const index = object<OverviewData>(release.index_object_id);
const data = object<QuestionData>(release.question_objects['q-93852fae313a9aeb23584dc1']);
const GEMMA = 'attempt-45b22a57def6507de835af2e';
const originalGemma = data.attempts.find(a => a.id === GEMMA)!;
const currentGemma = data.attempts.find(a => a.canonical && a.trial_id === originalGemma.trial_id)!;

describe('exact answer links', () => {
  it('selects exactly the named answer, or nothing', () => {
    expect(resolveSelection(data, '?configuration=config-cloud-gemma31-coreweave-cloud&condition=condition-3da38f0ffe89d9e6d8f8e4f7')).toEqual({ id: currentGemma.id, error: '' });
    expect(resolveSelection(data, `?attempt=${GEMMA}`)).toEqual({ id: GEMMA, error: '' });
    expect(resolveSelection(data, `?attempt=${GEMMA}&configuration=config-does-not-match`)).toEqual({ id: null, error: NO_MATCH });
    expect(resolveSelection(data, '?attempt=attempt-missing')).toEqual({ id: null, error: NO_MATCH });
    expect(resolveSelection(data, `?attempt=${GEMMA}&attempt=${GEMMA}`)).toEqual({ id: null, error: NO_MATCH });
    expect(resolveSelection(data, '').id).toBeTruthy();
  });
  it('server markup never presents a default model before the link is resolved', () => {
    const html = renderToStaticMarkup(createElement(QuestionAnswers, { data, index }));
    expect(html).toContain('Opening the requested recorded answer');
    expect(html).not.toContain('selected-attempt');
    expect(html).not.toContain('Read final answer');
    expect(html).not.toContain('Final answer text');
    expect(html).toContain(`href="/questions/${data.question.id}/?attempt=${currentGemma.id}&amp;configuration=config-cloud-gemma31-coreweave-cloud&amp;condition=condition-3da38f0ffe89d9e6d8f8e4f7"`);
  });
});

describe('recorded outcomes', () => {
  const base = data.attempts.find(a => a.id === GEMMA)!;
  const with_ = (category: NonNullable<Attempt['assessment']>['category'], score: number | null): Attempt => ({ ...base, score, assessment: { ...base.assessment!, category } });
  it('keeps the recorded zero for the 76.8% answer and labels the credit separately', () => {
    expect(base.score).toBe(0);
    expect(outcomeView(base)).toMatchObject({ label: 'Incorrect', unscored: false, credit: '0.0% credit awarded' });
  });
  it('selects a new reviewed grade while keeping the same answer and original history', () => {
    expect(currentGemma.score).toBe(1);
    expect(currentGemma.scoring_review?.source_attempt_id).toBe(GEMMA);
    expect(currentGemma.components.answer).toEqual(originalGemma.components.answer);
    expect(currentGemma.supersedes_attempt_ids).toContain(GEMMA);
    expect(originalGemma.canonical).toBe(false);
    expect(outcomeView(currentGemma)).toMatchObject({label:'Full credit',credit:'100.0% credit awarded'});
  });
  it('consumer validation checks the reviewed grade against immutable answer history', () => {
    expect(()=>validateOutcomeAssessment(currentGemma)).not.toThrow();
    expect(()=>validateScoringReview(currentGemma,originalGemma,data.question.id)).not.toThrow();
    const changed=structuredClone(currentGemma);changed.components.answer.object_ids=['wrong'];
    expect(()=>validateScoringReview(changed,originalGemma,data.question.id)).toThrow();
    const forged=structuredClone(currentGemma);forged.score=0;
    expect(()=>validateOutcomeAssessment(forged)).toThrow();
  });
  it('separates incorrect, unfinished and unscored outcomes; only assessed results show credit', () => {
    expect(outcomeView(with_('failed_to_finish', 0)).label).toBe('Failed to finish');
    for (const category of ['technical_error', 'untested', 'review', 'unresolved'] as const) expect(outcomeView(with_(category, null))).toMatchObject({ unscored: true, credit: 'Unscored · no credit assessed' });
    expect(outcomeView({ ...base, assessment: undefined, status: 'infra_error', score: null })).toMatchObject({ label: 'Infra error', unscored: true });
  });
  it('shows small saved checks readably without interpreting them', () => {
    expect(checkEntries('{"exact_match":0,"f1":0,"reference":["76.8","76.8"],"score":0}')).toEqual([['exact_match', '0'], ['f1', '0'], ['reference', '["76.8","76.8"]'], ['score', '0']]);
    expect(checkEntries('not json')).toBeNull();
    expect(checkEntries('[1,2]')).toBeNull();
  });
});

describe('evidence availability and errors', () => {
  const component = (availability: Component['availability'], object_ids: string[] = []): Component => ({ availability, object_ids, reason: null, origin: 'captured', source: null, redaction_rule_ids: [] });
  const objects = [{ id: 'a'.repeat(64), path: '', media_type: 'text/plain' as const, bytes: 3 * 1024 * 1024, availability: 'redacted' as const, encoding: 'identity' as const }, { id: 'b'.repeat(64), path: '', media_type: 'text/plain' as const, bytes: 0, availability: 'full' as const, encoding: 'identity' as const }];
  it('states availability before anything is opened', () => {
    expect(availabilitySummary(component('not_recorded'), objects)).toBe('not recorded');
    expect(availabilitySummary(component('withheld'), objects)).toBe('withheld');
    expect(availabilitySummary(component('redacted', ['a'.repeat(64)]), objects)).toBe('redacted · 3.0 MB');
    expect(availabilitySummary(component('full', ['b'.repeat(64)]), objects)).toBe('empty');
    expect(availabilitySummary(component('full', ['c'.repeat(64)]), objects)).toBe('size unknown');
  });
  it('never offers a withdrawal or invalid location as a retryable failure', () => {
    expect(evidenceErrorKind(new EvidenceError('withdrawn', 'x'))).toBe('withdrawn');
    expect(evidenceErrorKind(new Error('x'))).toBe('network');
    expect(['withdrawn', 'invalid', 'missing'].some(kind => retryable(kind as never))).toBe(false);
    expect(['network', 'integrity', 'status'].every(kind => retryable(kind as never))).toBe(true);
  });
});

describe('hardware disclosure', () => {
  const config = (values: Partial<Configuration>) => ({ ...index.configurations[0]!, execution_kind: undefined, cloud_provider: undefined, ...values }) as Configuration;
  it('uses each local run’s recorded RAM group and never assigns the current OS to it', () => {
    for (const [hardware_id, ram] of [['desktop-32gb', '32 GB'], ['desktop-128gb', '128 GB']] as const) {
      const machine = runHardware(config({ hardware_id }));
      expect(machine.summary).toBe(`Local test desktop · ${ram} RAM group`);
      expect(machine.rows.find(([k]) => k === 'System RAM')![1]).toContain(ram);
      expect(machine.rows.find(([k]) => k === 'Operating system')![1]).toMatch(/^Exact version not recorded for this run/);
    }
  });
  it('gives hosted and unknown setups no local specifications', () => {
    const cloud = runHardware(config({ execution_kind: 'cloud', cloud_provider: 'CoreWeave', hardware_id: null }));
    expect(cloud.summary).toBe('Hosted by CoreWeave');
    expect(JSON.stringify(cloud.rows)).not.toMatch(/Ryzen|Radeon|Linux Mint|\b(32|128) GB\b/);
    const unknown = runHardware(config({ hardware_id: null }));
    expect(unknown.kind).toBe('unrecorded');
    expect(JSON.stringify(unknown.rows)).not.toMatch(/Ryzen|Radeon|Linux Mint|GB/);
  });
});
