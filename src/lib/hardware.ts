import type { Configuration } from './public-contract';

// Owner-verified desktop facts (answer-page audit, 21 Oct 2026). Public run
// metadata records only the RAM group, so per-run details below never borrow
// the current OS point release or RAM for a run that did not record them.
export const TEST_MACHINE = {
  cpu: 'AMD Ryzen 5 5600X (6 cores / 12 threads)',
  gpu: 'AMD Radeon RX 6700 XT (12 GB VRAM)',
  ramGroups: ['32 GB', '128 GB'],
  currentRam: '128 GB',
  earlierRam: '32 GB',
  currentOs: 'Linux Mint 22.3 “Zena” (Ubuntu noble base)',
  observed: '21 October 2026',
} as const;

export type RunHardware = { kind: 'local' | 'cloud' | 'unrecorded'; summary: string; ram: string | null; rows: [string, string][] };

export function runHardware(config: Configuration): RunHardware {
  if (config.execution_kind === 'cloud') {
    const provider = config.cloud_provider ?? 'a cloud provider';
    return { kind: 'cloud', ram: null, summary: `Hosted by ${provider}`, rows: [
      ['Where it ran', `Hosted by ${provider}${config.runtime ? ` (recorded runtime: ${config.runtime})` : ''}`],
      ['Provider hardware', 'Not disclosed. The local test machine’s CPU, GPU, RAM and OS do not apply.'],
      ['Speed comparison', 'Excluded. Hosted runs are quality references only.'],
    ] };
  }
  const ram = config.hardware_id === 'desktop-32gb' ? '32 GB' : config.hardware_id === 'desktop-128gb' ? '128 GB' : null;
  if (!ram) return { kind: 'unrecorded', ram: null, summary: 'Hardware profile not recorded', rows: [
    ['Hardware', config.hardware_id ? `Recorded profile “${config.hardware_id}” has no published specification.` : 'Not recorded for this setup.'],
  ] };
  return { kind: 'local', ram, summary: `Local test desktop · ${ram} RAM group`, rows: [
    ['CPU', TEST_MACHINE.cpu],
    ['GPU', TEST_MACHINE.gpu],
    ['System RAM', `${ram} (the RAM group recorded for this run)`],
    ['Operating system', `Exact version not recorded for this run. The desktop ran ${TEST_MACHINE.currentOs} when observed on ${TEST_MACHINE.observed}.`],
  ] };
}
