export function calculateScores(quizData, answers, axisOrder) {
  const totals = Object.fromEntries(axisOrder.map((axis) => [axis, { earned: 0, maximum: 0 }]));

  quizData.questions.forEach((question) => {
    const answerId = answers.get(question.id);
    const answer = question.answers.find((candidate) => candidate.id === answerId);
    if (!answer) throw new Error(`Réponse manquante pour la question ${question.id}`);
    if (!totals[question.axis]) throw new Error(`Axe inconnu : ${question.axis}`);
    totals[question.axis].earned += answer.carre_points;
    totals[question.axis].maximum += 2;
  });

  const axes = Object.fromEntries(
    axisOrder.map((axis) => {
      if (totals[axis].maximum === 0) throw new Error(`Aucune question pour l'axe ${axis}`);
      return [axis, Math.round((totals[axis].earned / totals[axis].maximum) * 100)];
    }),
  );
  const carre = Math.round(axisOrder.reduce((sum, axis) => sum + axes[axis], 0) / axisOrder.length);
  return { carre, rond: 100 - carre, axes };
}

export function findRange(items, score) {
  return items.find((item) => score >= item.min && score <= item.max) ?? items.at(-1);
}
