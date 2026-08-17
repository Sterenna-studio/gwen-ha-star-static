const AXIS_COPY = {
  organisation: {
    rond: 'ton organisation reste très instinctive',
    carre: 'ton organisation confirme ton goût des choses bien rangées',
    neutral: 'ton organisation sait alterner méthode et improvisation',
  },
  anticipation: {
    rond: 'tu anticipes rarement les imprévus',
    carre: 'ton anticipation prépare le terrain avant la partie',
    neutral: 'tu anticipes surtout ce qui compte vraiment',
  },
  maintenance: {
    rond: 'ta maintenance attend souvent le signal d’alarme',
    carre: 'ta maintenance évite les mauvaises surprises',
    neutral: 'ta maintenance reste pragmatique',
  },
  hygiene_numerique: {
    rond: 'ton hygiène numérique fonctionne surtout à la mémoire',
    carre: 'ton hygiène numérique sécurise solidement tes habitudes',
    neutral: 'ton hygiène numérique garde un équilibre pratique',
  },
  setup: {
    rond: 'ton setup préfère le vécu au rangement',
    carre: 'ton setup ressemble à un poste de commandement',
    neutral: 'ton setup reste organisé juste comme il faut',
  },
};

function getDirection(score) {
  if (score >= 55) return 'rond';
  if (score <= 45) return 'carre';
  return 'neutral';
}
function pickAxis(entries, direction) {
  if (direction === 'rond') return entries.reduce((best, item) => (item.score > best.score ? item : best));
  if (direction === 'carre') return entries.reduce((best, item) => (item.score < best.score ? item : best));
  return entries.reduce((best, item) => (Math.abs(item.score - 50) > Math.abs(best.score - 50) ? item : best));
}

export function buildResultInsight(scores, axes, resultProfile) {
  const entries = axes.map((axis) => ({ ...axis, score: scores.axes[axis.id] ?? 50 }));
  const globalDirection = getDirection(scores.rond);
  const opposingDirection = globalDirection === 'rond' ? 'carre' : 'rond';
  const opposingAxis = globalDirection === 'neutral' ? null : pickAxis(entries, opposingDirection);
  const hasContradiction = opposingAxis && getDirection(opposingAxis.score) === opposingDirection;
  const featuredAxis = hasContradiction ? opposingAxis : pickAxis(entries, globalDirection);
  const featuredDirection = getDirection(featuredAxis.score);
  const phrase = AXIS_COPY[featuredAxis.id]?.[featuredDirection] ?? `${featuredAxis.label.toLowerCase()} apporte sa propre nuance`;
  const level = resultProfile?.level || (globalDirection === 'neutral' ? 'Rond-Carré' : globalDirection === 'rond' ? 'Rond' : 'Carré');

  if (hasContradiction) {
    const supportingAxis = pickAxis(entries.filter((axis) => axis.id !== featuredAxis.id), globalDirection);
    const side = globalDirection === 'rond' ? 'Rond' : 'Carré';
    return {
      connector: 'mais',
      featuredAxis: featuredAxis.id,
      text: `Tu es globalement ${level}, mais ${phrase}. Le reste de tes stats, notamment ${supportingAxis.label.toLowerCase()}, maintient bien ton résultat du côté ${side}.`,
    };
  }

  const opening = globalDirection === 'neutral' ? 'Ton profil global est équilibré' : `Tu es globalement ${level}`;
  return {
    connector: 'et',
    featuredAxis: featuredAxis.id,
    text: `${opening}, et ${phrase}. Cette tendance s’accorde avec l’ensemble de tes stats.`,
  };
}
