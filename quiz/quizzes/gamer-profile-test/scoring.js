function conditionMatches(condition, profile, answerId) {
  if (!condition) return false;
  if (condition.all) return condition.all.every((item) => conditionMatches(item, profile, answerId));
  if (condition.profile_field) return profile[condition.profile_field] === condition.equals;
  if (condition.answer_in) return condition.answer_in.includes(answerId);
  return false;
}

function conditionCanMatch(condition, profile) {
  if (!condition) return false;
  if (condition.all) return condition.all.every((item) => conditionCanMatch(item, profile));
  if (condition.profile_field) return profile[condition.profile_field] === condition.equals;
  if (condition.answer_in) return condition.answer_in.length > 0;
  return false;
}

export function randomizeAnswers(answers, random = Math.random) {
  const shuffled = [...answers];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function calculateScores(quizData, answers, axisOrder, profile = {}) {
  const totals = Object.fromEntries(axisOrder.map((axis) => [axis, { earned: 0, maximum: 0 }]));
  let basePoints = 0;
  const appliedBonuses = [];

  quizData.questions.forEach((question) => {
    const answerId = answers.get(question.id);
    const answer = question.answers.find((candidate) => candidate.id === answerId);
    if (!answer) throw new Error(`Réponse manquante pour la question ${question.id}`);
    if (!totals[question.axis]) throw new Error(`Axe inconnu : ${question.axis}`);

    const roundPoints = Number.isFinite(answer.round_points) ? answer.round_points : 2 - answer.carre_points;
    basePoints += roundPoints;
    totals[question.axis].earned += roundPoints;
    totals[question.axis].maximum += 2;

    (question.context_bonuses || []).forEach((bonus) => {
      if (conditionMatches(bonus.when, profile, answerId)) {
        appliedBonuses.push({ id: bonus.id, label: bonus.label, points: bonus.round_points || 0 });
      }
    });
  });

  const axes = Object.fromEntries(axisOrder.map((axis) => [
    axis,
    Math.round((totals[axis].earned / totals[axis].maximum) * 100),
  ]));
  const baseMaxPoints = quizData.questions.length * 2;
  const contextMaxPoints = quizData.questions.reduce((maximum, question) => maximum
    + (question.context_bonuses || [])
      .filter((bonus) => conditionCanMatch(bonus.when, profile))
      .reduce((sum, bonus) => sum + (bonus.round_points || 0), 0), 0);
  const maxPoints = baseMaxPoints + contextMaxPoints;
  const bonusPoints = appliedBonuses.reduce((sum, bonus) => sum + bonus.points, 0);
  const totalPoints = basePoints + bonusPoints;
  const rond = Math.round((totalPoints / maxPoints) * 100);

  return {
    basePoints,
    bonusPoints,
    totalPoints,
    maxPoints,
    appliedBonuses,
    rond,
    carre: 100 - rond,
    axes,
  };
}

export function findRange(items, score) {
  return items.find((item) => score >= item.min && score <= item.max) ?? items.at(-1);
}
