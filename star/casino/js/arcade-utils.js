export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[0];
}

export function formatChronicles(value) {
  return Number(value ?? 0).toLocaleString('fr-FR');
}
