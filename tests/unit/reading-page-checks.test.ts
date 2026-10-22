import {it, expect} from 'vitest';
import {readingPageChecks} from '../../src/lib/reading-page-checks';
const check = {page:'books.html',titles_missing:[],invented:[],reply_mentions_data_issues:false,duplicate_shown_twice:true,page_errors:[]};
it('explains a created page failing only the unrequested final-reply criterion', () => {
  const result = readingPageChecks(JSON.stringify({score:0,check}))!;
  expect(result.page).toBe(true);
  expect(result.items.filter(i=>i.state==='fail').map(i=>i.label)).toEqual(['Data issues mentioned in the final reply']);
  expect(result.items.find(i=>i.label==='Duplicate entry')!.state).toBe('note');
});
it('does not call diagnostics independent grade failures', () => {
  const result = readingPageChecks(JSON.stringify({check:{...check,reply_mentions_data_issues:true,page_errors:['warning']}}))!;
  expect(result.items.filter(i=>i.state==='fail')).toEqual([]);
});
it('distinguishes no file, missing titles and flagged added facts without judging visual quality', () => {
  expect(readingPageChecks(JSON.stringify({check:'no HTML file was written'}))!.page).toBe(false);
  const result = readingPageChecks(JSON.stringify({check:{...check,titles_missing:['Dune'],invented:['author not disclosed']}}))!;
  expect(result.items.filter(i=>i.state==='fail')).toHaveLength(3);
});
it('fails closed on unknown or damaged check formats', () => {
  for (const text of ['null','bad JSON','{}',JSON.stringify({check:{...check,titles_missing:'Dune'}})]) expect(readingPageChecks(text)).toBeNull();
});
