import { expect, it } from 'vitest';
import { searchRecords } from '../../scripts/search-index.mjs';
it('indexes permitted prompt bytes and canonical outcomes without reading restricted content', async () => {
  const reads: string[] = [];
  const data = { suites: [{ id: 'suite' }], questions: [
    { id: 'visible', suite_id: 'suite', components: { prompt: { availability: 'redacted', object_ids: ['prompt'] } } },
    { id: 'hidden', suite_id: 'suite', components: { prompt: { availability: 'withheld', object_ids: ['must-not-read'] } } }],
    trials: [{ id: 'trial', question_id: 'visible', configuration_id: 'config', condition_id: 'condition' }],
    attempts: [{ trial_id: 'trial', canonical: true, status: 'scored', score: .5 }, { trial_id: 'trial', canonical: false, status: 'scored', score: 1 }] };
  const result = await searchRecords(data, async (id: string) => { reads.push(id); return new TextEncoder().encode('Unicode α\r\n  spacing [redacted]'); });
  expect(reads).toEqual(['prompt']);
  expect(result.suite.questions[0].prompt).toBe('Unicode α\r\n  spacing [redacted]');
  expect(result.suite.questions[0].outcomes).toEqual([{ configuration_id: 'config', condition_id: 'condition', status: 'scored', credit: 'partial', count: 1 }]);
  expect(result.suite.questions[1]).toEqual({ question_id: 'hidden', prompt: '', availability: 'withheld', outcomes: [] });
});
