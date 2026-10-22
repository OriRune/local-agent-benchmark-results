export type ReadingCheck = { label: string; state: 'pass' | 'fail' | 'note'; detail: string };

// Explain recorded checks, without judging a screenshot or changing a grade.
// This is the original R6 check_books rule, not a new partial-credit rubric.
export function readingPageChecks(text: string): { page: boolean; items: ReadingCheck[] } | null {
  let record: any;
  try { record = JSON.parse(text); } catch { return null; }
  if (!record || typeof record !== 'object') return null;
  const c = record.check;
  if (c === 'no HTML file was written') return {page: false, items: [{label: 'HTML file', state: 'fail', detail: 'The saved check found no HTML file. This run did not deliver the requested file; it does not establish that the model cannot write HTML.'}]};
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
  if (!c || typeof c !== 'object' || typeof c.page !== 'string' || !strings(c.titles_missing) || !strings(c.invented) || typeof c.reply_mentions_data_issues !== 'boolean' || typeof c.duplicate_shown_twice !== 'boolean' || !(c.page_errors == null || strings(c.page_errors))) return null;
  const items: ReadingCheck[] = [
    {label: 'HTML file', state: 'pass', detail: 'An HTML file was created. This is different from producing no page.'},
    {label: 'Book titles in the rendered page', state: c.titles_missing.length ? 'fail' : 'pass', detail: c.titles_missing.length ? `The checker did not find: ${c.titles_missing.join(', ')}. This is a recorded text check, not a fresh visual assessment.` : 'The checker found every expected book title in the rendered text.'},
    {label: 'Added facts disclosed in the reply', state: c.invented.length ? 'fail' : 'pass', detail: c.invented.length ? `The checker flagged: ${c.invented.join('; ')}.` : 'The checker did not flag its specific author/page-count substitutions. This is not a complete factual audit.'},
    {label: 'Data issues mentioned in the final reply', state: c.reply_mentions_data_issues ? 'pass' : 'fail', detail: c.reply_mentions_data_issues ? 'The final reply matched the checker’s data-issue keywords.' : 'The final reply did not match the checker’s data-issue keywords. This alone could cause a zero, even when the page looked correct.'},
    {label: 'Duplicate entry', state: 'note', detail: c.duplicate_shown_twice ? 'The checker detected the repeated book. This was diagnostic only: it did not independently change the score.' : 'The checker did not detect an extra occurrence of the repeated book. This was diagnostic only.'},
    {label: 'Browser errors', state: 'note', detail: c.page_errors?.length ? `${c.page_errors.length} browser error(s) were recorded. See the original check for details. Errors did not independently set the grade, but could prevent titles from rendering.` : 'No browser error was listed in this check. Visual design was not scored.'},
  ];
  return {page: true, items};
}
