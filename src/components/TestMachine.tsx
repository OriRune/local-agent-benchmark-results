import type { Configuration } from '../lib/public-contract';
import { runHardware, TEST_MACHINE } from '../lib/hardware';

// Compact context beside timings. A group's RAM comes from its recorded hardware label.
export function TestMachineNote({ config }: { config?: Configuration }) {
  const group = config ? runHardware(config) : null;
  if (group?.kind === 'cloud') return <p className="test-machine-note">{group.summary} · provider hardware not disclosed; excluded from local speed comparisons. <a href="/methodology/#test-machine">How hardware is recorded</a></p>;
  if (group?.kind === 'unrecorded') return <p className="test-machine-note">{group.summary}. <a href="/methodology/#test-machine">How hardware is recorded</a></p>;
  const ram = group?.kind === 'local' ? `${group.ram} system RAM (this timing group)` : '32 GB or 128 GB system RAM, never mixed in one timing group';
  return <p className="test-machine-note"><strong>Test machine:</strong> {TEST_MACHINE.cpu} · {TEST_MACHINE.gpu} · {ram}. <a href="/methodology/#test-machine">Full test machine details</a></p>;
}

export function TestMachineSpec() {
  return <dl className="spec-list">
    <dt>CPU</dt><dd>{TEST_MACHINE.cpu}</dd>
    <dt>GPU</dt><dd>{TEST_MACHINE.gpu}</dd>
    <dt>System RAM</dt><dd>{TEST_MACHINE.currentRam} now. Earlier campaign runs used {TEST_MACHINE.earlierRam}. Every local run keeps the RAM group it recorded, and speed charts never mix the two groups.</dd>
    <dt>Operating system</dt><dd>{TEST_MACHINE.currentOs}, observed on {TEST_MACHINE.observed}. Earlier runs did not record an OS version, so this observation is not applied to them.</dd>
    <dt>Hosted runs</dt><dd>Cloud runs used provider hardware that the provider did not disclose. They are quality references only and never enter local speed comparisons.</dd>
  </dl>;
}
