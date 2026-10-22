import type { OverviewData } from './public-types';
export type ChartRow = {
  id: string; name: string; href: string;
  config: OverviewData['configurations'][number];
  condition: OverviewData['conditions'][number];
  result: OverviewData['aggregates'][number];
};

// Same full bank, hardware and requested controls. Runtime/placement differences
// remain labeled setup comparisons, never isolated model-speed effects.
export function timingGroups(rows: ChartRow[]) {
  const groups = new Map<string, ChartRow[]>();
  for (const row of rows) {
    const { config: c, condition: t, result: a } = row;
    if (c.status === 'withdrawn' || c.execution_kind === 'cloud' || c.speed_eligible === false || !c.hardware_id || !c.runtime || c.concurrency == null || c.compatibility !== 'known' || !a.eligible || !a.planned || a.scored !== a.planned || a.timed !== a.planned || a.score == null || a.median_task_s == null || a.median_task_s <= 0) continue;
    const key = JSON.stringify([a.suite_id, a.planned, c.hardware_id, c.concurrency, t.kind, t.protocol_id, t.observed_reasoning ?? t.reasoning_requested, t.reasoning_requested, t.seed, t.temperature, t.max_tokens, t.thinking_tokens, t.reasoning_effort, t.agent_steps, t.agent_seconds, t.question_seconds]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].filter(([, values]) => values.length >= 2).sort((a,b) => b[1].length-a[1].length || a[0].localeCompare(b[0]));
}

export function creditLabel(result: OverviewData['aggregates'][number] | undefined, binary: boolean) {
  if (result?.score == null) return 'Not scored';
  return binary ? `${result.full_credit}/${result.scored} passed` : `${(result.score*100).toFixed(1)}% credit`;
}
