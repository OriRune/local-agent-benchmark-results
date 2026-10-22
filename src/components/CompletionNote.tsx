export default function CompletionNote() {
  return <details className="completion-note"><summary>What counts as completed, and why can a model fail to finish?</summary>
    <p>Completed means an assessable answer or saved task output was produced; it can still be wrong or earn partial credit. Pass rate counts full-credit outcomes across assessed tasks, including confirmed failures to finish. Correct / completed looks only at completed, assessed outputs. Technical failures, untested tasks and unresolved reviews are excluded from these rates, and shown separately.</p>
    <p>“Failed to finish” means the run stopped at a recorded token, step, time or context limit, or in a repeated tool loop, without an accepted result. It does not prove the model could never solve the task. More time, a larger reasoning budget or another attempt may help, but these results do not measure that recovery.</p>
    <p>For interactive work, a slow or unfinished attempt may be recoverable. For unattended work, needing another attempt matters. Read completion and correctness together: neither a high score on a few completed answers nor a low completion rate tells the whole story. <a href="/methodology/#completion-and-retries">Limits and retry policy →</a></p>
  </details>;
}
