export function calculateScores(quizData, answers, axisOrder) {
  const totals = Object.fromEntries(axisOrder.map((axis) => [axis, { earned: 0, maximum: 0 }]));
  let basePoints = 0;

  quizData.questions.forEach((question) => {
    const answerId = answers.get(question.id);
    const answer = question.answers.find((candidate) => candidate.id === answerId);
    if (!answer) throw new Error(`Réponse manquante pour la question ${question.id}`);
    if (!totals[question.axis]) throw new Error(`Axe inconnu : ${question.axis}`);

    const roundPoints = Number.isFinite(answer.round_points) ? answer.round_points : 2 - answer.carre_points;
    basePoints += roundPoints;
    totals[question.axis].earned += roundPoints;
    totals[question.axis].maximum += 2;
  });

  const axes = Object.fromEntries(axisOrder.map((axis) => [
    axis,
    Math.round((totals[axis].earned / totals[axis].maximum) * 100),
  ]));
  const maxPoints = quizData.questions.length * 2;
  const rond = Math.round((basePoints / maxPoints) * 100);

  return {
    basePoints,
    bonusPoints: 0,
    totalPoints: basePoints,
    maxPoints,
    appliedBonuses: [],
    rond,
    carre: 100 - rond,
    axes,
  };
}

export function findRange(items, score) {
  return items.find((item) => score >= item.min && score <= item.max) ?? items.at(-1);
}
