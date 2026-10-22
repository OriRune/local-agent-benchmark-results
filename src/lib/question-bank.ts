import type { OverviewData, TestDescription } from './public-types';
export type BankQuestion = OverviewData['questions'][number];
export type BankView = { search: string; status: 'all' | BankQuestion['scoring_status']; page: number; outcome?: string };
export const BANK_PAGE_SIZE = 20;
export const defaultBankView = (): BankView => ({ search: '', status: 'all', page: 1 });
export function parseBankView(search: string): BankView {
  const query = new URLSearchParams(search);
  for (const key of ['bank_q', 'bank_status', 'bank_page', 'bank_outcome']) if (query.getAll(key).length > 1) throw new Error('Duplicate question-bank filter.');
  const status = query.get('bank_status') ?? 'all', page = query.get('bank_page') ?? '1';
  if (!['all', 'primary', 'excluded', 'review'].includes(status) || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page))) throw new Error('Invalid question-bank filter.');
  const outcome = query.get('bank_outcome');
  if (outcome && !BANK_OUTCOMES.includes(outcome)) throw new Error('Invalid question outcome filter.');
  return { ...(outcome ? { outcome } : {}), search: query.get('bank_q') ?? '', status: status as BankView['status'], page: Number(page) };
}
export function bankQuery(search: string, view: BankView): string {
  const query = new URLSearchParams(search);
  for (const key of ['bank_q', 'bank_status', 'bank_page', 'bank_outcome']) query.delete(key);
  if (view.search) query.set('bank_q', view.search);
  if (view.status !== 'all') query.set('bank_status', view.status);
  if (view.outcome) query.set('bank_outcome', view.outcome);
  if (view.page !== 1) query.set('bank_page', String(view.page));
  return query.toString();
}
export const BANK_OUTCOMES = ['full', 'partial', 'incorrect', 'failed_to_finish', 'technical_error', 'untested', 'unresolved', 'zero', 'blocked', 'review', 'infra_error', 'context_limit', 'interrupted', 'pending', 'not_scheduled'];
export type BankSearch = { version: number; suite_id: string; questions: { question_id: string; prompt: string; availability: string; outcomes: { configuration_id: string; condition_id: string; status: string; credit: string; category?: string; count: number }[] }[] };
export function bankPage(questions: BankQuestion[], view: BankView, search?: BankSearch, configurationId?: string, conditionId?: string, descriptions:Record<string,TestDescription> = {}) {
  const needle = view.search.trim().toLowerCase();
  const matching = questions.filter(question => {
    const extra = search?.questions.find(row => row.question_id === question.id);
    return (view.status === 'all' || question.scoring_status === view.status)
      && `${question.source_id} ${question.title} ${descriptions[question.id]?.title ?? ''} ${descriptions[question.id]?.description ?? ''} ${extra?.prompt ?? ''}`.toLowerCase().includes(needle)
      && (!view.outcome || extra?.outcomes.some(outcome => (!configurationId || outcome.configuration_id === configurationId) && (!conditionId || outcome.condition_id === conditionId) && (outcome.credit === view.outcome || outcome.status === view.outcome || outcome.category === view.outcome)));
  });
  const pages = Math.max(1, Math.ceil(matching.length / BANK_PAGE_SIZE));
  const page = Math.min(view.page, pages), start = (page - 1) * BANK_PAGE_SIZE;
  return { rows: matching.slice(start, start + BANK_PAGE_SIZE), page, pages, start, count: matching.length, total: questions.length };
}
