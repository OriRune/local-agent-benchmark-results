export type OverviewView = { suiteId: string; mode: 'all' | 'off' | 'on'; search: string; showAll: boolean; grouping?: 'parameters' | 'memory' | 'download'; architecture?: 'dense' | 'moe' | 'unknown'; budget?: number; memoryType?: 'system_ram' | 'gpu_vram' | 'unified_memory'; estimates?: boolean };
export function parseOverviewView(search: string, suiteIds: string[], defaultSuite: string): OverviewView {
  const query = new URLSearchParams(search);
  for (const key of ['suite', 'thinking', 'q', 'all', 'group', 'architecture', 'budget', 'memory', 'estimates']) if (query.getAll(key).length > 1) throw new Error('Duplicate overview filter.');
  const suiteId = query.get('suite') ?? defaultSuite;
  if (!suiteIds.includes(suiteId)) throw new Error('The requested test version is unavailable in this edition.');
  const mode = query.get('thinking') ?? 'all';
  if (mode !== 'all' && mode !== 'off' && mode !== 'on') throw new Error('The requested thinking filter is unavailable.');
  const all = query.get('all') ?? '1';
  if (all !== '0' && all !== '1') throw new Error('The requested result view is unavailable.');
  const result: OverviewView = { suiteId, mode, search: query.get('q') ?? '', showAll: all === '1' };
  const grouping = query.get('group'), architecture = query.get('architecture'), memory = query.get('memory'), budget = query.get('budget'), estimates = query.get('estimates');
  if (grouping) { if (!['parameters','memory','download'].includes(grouping)) throw new Error('Unknown model grouping.'); result.grouping = grouping as OverviewView['grouping']; }
  if (architecture) { if (!['dense','moe','unknown'].includes(architecture)) throw new Error('Unknown architecture.'); result.architecture = architecture as OverviewView['architecture']; }
  if (memory) { if (!['system_ram','gpu_vram','unified_memory'].includes(memory)) throw new Error('Unknown memory type.'); result.memoryType = memory as OverviewView['memoryType']; }
  if (budget !== null) { if (!Number.isFinite(Number(budget)) || Number(budget) <= 0) throw new Error('Invalid memory budget.'); result.budget = Number(budget); }
  if (estimates !== null) { if (estimates !== '1') throw new Error('Invalid estimated-fit filter.'); result.estimates = true; }
  return result;
}
export function overviewViewQuery(view: OverviewView): string {
  const query = new URLSearchParams({ suite: view.suiteId, thinking: view.mode });
  if (view.search) query.set('q', view.search);
  query.set('all', view.showAll ? '1' : '0');
  if (view.grouping) query.set('group',view.grouping);
  if (view.architecture) query.set('architecture',view.architecture);
  if (view.budget) query.set('budget',String(view.budget));
  if (view.memoryType) query.set('memory',view.memoryType);
  if (view.estimates) query.set('estimates','1');
  return query.toString();
}
