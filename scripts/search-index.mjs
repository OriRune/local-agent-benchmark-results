// Derived search material never includes answers, traces or withheld prompt bytes.
export async function searchRecords(dataset, readObject) {
  const trials = new Map(dataset.trials.map(t => [t.id, t]));
  const counts = new Map();
  for (const attempt of dataset.attempts) {
    if (!attempt.canonical) continue;
    const trial = trials.get(attempt.trial_id);
    const credit = attempt.score === null ? 'unassessed' : attempt.score === 1 ? 'full' : attempt.score === 0 ? 'zero' : 'partial';
    const values = [trial.configuration_id, trial.condition_id, attempt.status, credit, attempt.assessment?.category ?? ''];
    if (!counts.has(trial.question_id)) counts.set(trial.question_id, new Map());
    const group = counts.get(trial.question_id), key = values.join('\0');
    group.set(key, { values, count: (group.get(key)?.count || 0) + 1 });
  }
  const suites = Object.fromEntries(dataset.suites.map(s => [s.id, { version: 1, suite_id: s.id, questions: [] }]));
  for (const question of dataset.questions) {
    const component = question.components.prompt;
    const prompt = ['full', 'redacted'].includes(component.availability)
      ? (await Promise.all(component.object_ids.map(async id => new TextDecoder().decode(await readObject(id))))).join('\n') : '';
    const outcomes = [...(counts.get(question.id)?.entries() || [])].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([, { values: [configuration_id, condition_id, status, credit, category], count }]) => ({ configuration_id, condition_id, status, credit, count, ...(category ? {category} : {}) }));
    suites[question.suite_id].questions.push({ question_id: question.id, prompt, availability: component.availability, outcomes });
  }
  return suites;
}
