import { expect, it } from 'vitest';
import { bankPage, bankQuery, defaultBankView, parseBankView, type BankQuestion } from '../../src/lib/question-bank';
const questions: BankQuestion[] = Array.from({ length: 45 }, (_, i) => ({ id: `q-${i}`, suite_id: 'suite-original', source_id: `task-${i}`, title: i === 42 ? '日本語 & [literal]' : `Question ${i}`, scoring_status: i === 44 ? 'excluded' : 'primary' }));
it('bounds pages without changing the source bank or excluding preview questions', () => {
  const original = structuredClone(questions);
  expect(bankPage(questions, defaultBankView()).rows).toHaveLength(20);
  const last = bankPage(questions, { ...defaultBankView(), page: 999 });
  expect(last.page).toBe(3); expect(last.rows).toHaveLength(5); expect(last.total).toBe(45);
  expect(questions).toEqual(original);
  expect(bankPage(questions, { search: '日本語 & [literal]', status: 'all', page: 1 }).rows[0].id).toBe('q-42');
  expect(bankPage(questions, { search: '', status: 'excluded', page: 1 }).rows[0].id).toBe('q-44');
  expect(bankPage(questions, { search: 'missing', status: 'all', page: 4 }).count).toBe(0);
});
it('preserves pinned edition and exact trial selections when filters round trip', () => {
  const view = { search: '日本語 & [literal]', status: 'excluded' as const, page: 2 };
  const query = bankQuery('release=saved&suite=version1&configuration=quant&condition=on', view);
  expect(parseBankView(query)).toEqual(view);
  const params = new URLSearchParams(query);
  expect(params.get('release')).toBe('saved'); expect(params.get('configuration')).toBe('quant'); expect(params.get('condition')).toBe('on'); expect(params.get('suite')).toBe('version1');
  expect(bankQuery(query, defaultBankView())).not.toContain('bank_');
});
it('rejects invalid or ambiguous explicit filters', () => {
  for (const query of ['bank_page=0', 'bank_page=1e3', 'bank_page=9007199254740992', 'bank_status=unknown', 'bank_q=a&bank_q=b']) expect(() => parseBankView(query)).toThrow();
});

it('searches full permitted prompt text and scopes outcomes to the selected condition', () => {
  const questions = [{ id: 'q', suite_id: 'suite', source_id: 'item', title: 'Title', scoring_status: 'primary' as const }];
  const search = { version: 1, suite_id: 'suite', questions: [{ question_id: 'q', prompt: 'Distinctive Unicode α phrase', availability: 'redacted', outcomes: [
    { configuration_id: 'a', condition_id: 'off', status: 'scored', credit: 'zero', count: 1 },
    { configuration_id: 'b', condition_id: 'on', status: 'scored', credit: 'full', count: 2 }] }] };
  const view = { search: 'unicode α', status: 'all' as const, page: 1, outcome: 'full' };
  expect(bankPage(questions, view, search).count).toBe(1);
  expect(bankPage(questions, view, search, 'a', 'off').count).toBe(0);
  expect(bankPage(questions, { ...view, outcome: 'zero' }, search, 'a', 'off').count).toBe(1);
  expect(bankPage(questions, view, search, 'b', 'on').total).toBe(1);
  expect(parseBankView('?bank_outcome=full').outcome).toBe('full');
  expect(() => parseBankView('?bank_outcome=invented')).toThrow();
});
