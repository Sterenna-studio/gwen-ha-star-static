import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const readSource = (name) => readFileSync(join(root, name), 'utf8').replace(/\r\n/g, '\n');

const axisByQuestion = new Map([
  ...[1, 4, 5, 13, 14, 28].map((id) => [id, 'organisation']),
  ...[2, 11, 16, 17, 29, 30].map((id) => [id, 'anticipation']),
  ...[3, 15, 22, 23, 25, 27].map((id) => [id, 'maintenance']),
  ...[6, 7, 8, 12, 24, 26].map((id) => [id, 'hygiene_numerique']),
  ...[9, 10, 18, 19, 20, 21].map((id) => [id, 'setup']),
]);

const axisLabels = {
  organisation: 'Organisation',
  anticipation: 'Anticipation',
  maintenance: 'Maintenance',
  hygiene_numerique: 'Hygiène numérique',
  setup: 'Setup',
};

function parseQuestions() {
  const source = readSource('CONTENT_V0.md');
  const headings = [...source.matchAll(/^## (\d+)\. (.+)$/gm)];

  const questions = headings.map((heading, index) => {
    const id = Number(heading[1]);
    const blockStart = heading.index + heading[0].length;
    const blockEnd = headings[index + 1]?.index ?? source.indexOf('\n---', blockStart);
    const block = source.slice(blockStart, blockEnd === -1 ? source.length : blockEnd);
    const answers = [...block.matchAll(/^\*\*([ABC])\.\*\*[ \t]+(.+?)[ \t]*\n\*([^*\n]+)\*/gm)].map(
      ([, key, behavior, quote]) => ({
        id: key.toLowerCase(),
        behavior: behavior.trimEnd(),
        quote: quote.trim(),
        carre_points: { A: 2, B: 1, C: 0 }[key],
        image: { asset: null, prompt_hint: null },
      }),
    );
    const visual = block.match(/^Visuel possible\s*:\s*(.+)$/m)?.[1]?.trim() ?? null;
    const bonusText = block.match(/^Bonus humour facultatif\s*:\s*\*\*(.+?)\*\*$/m)?.[1]?.trim() ?? null;

    if (!axisByQuestion.has(id)) throw new Error(`Axe manquant pour la question ${id}`);
    if (answers.length !== 3) throw new Error(`La question ${id} contient ${answers.length} réponses`);

    return {
      id,
      title: heading[2].trim(),
      axis: axisByQuestion.get(id),
      answers,
      bonus: bonusText
        ? { type: 'humour', label: bonusText, rond_points: 1, affects_score: false }
        : null,
      image: { asset: null, prompt_hint: visual },
      production_notes: visual ? [`Visuel possible : ${visual}`] : [],
    };
  });

  if (questions.length !== 30) throw new Error(`${questions.length} questions trouvées au lieu de 30`);
  for (const axis of Object.keys(axisLabels)) {
    const count = questions.filter((question) => question.axis === axis).length;
    if (count !== 6) throw new Error(`L'axe ${axis} contient ${count} questions au lieu de 6`);
  }

  return {
    schema_version: 1,
    source: 'CONTENT_V0.md',
    title: 'Carré ou Rond ? Le test du profil gamer',
    description: 'Un questionnaire humoristique sur tes habitudes de joueur et ton chaos numérique.',
    scoring: {
      answer_points: { a: 2, b: 1, c: 0 },
      axis_normalization: 100,
      global_method: 'Moyenne à poids égal des cinq axes',
      rond_method: '100 - score Carré',
    },
    axes: Object.entries(axisLabels).map(([id, label]) => ({ id, label })),
    questions,
  };
}

function parseResults() {
  const source = readSource('RESULTS_V0.md');
  const subprofilesStart = source.indexOf('# Sous-profils par axe');
  const globalSource = source.slice(0, subprofilesStart);
  const headings = [...globalSource.matchAll(/^## (\d+)[–-](\d+) — (.+?) — (.+)$/gm)];
  const profiles = headings.map((heading, index) => {
    const blockStart = heading.index + heading[0].length;
    const blockEnd = headings[index + 1]?.index ?? globalSource.length;
    const block = globalSource.slice(blockStart, blockEnd);
    const visual = block.match(/^Visuel résultat\s*:\s*(.+)$/m)?.[1]?.trim() ?? null;

    return {
      min: Number(heading[1]),
      max: Number(heading[2]),
      level: heading[3].trim(),
      name: heading[4].trim(),
      tagline: block.match(/^\*\*Tagline :\*\*\s*(.+)$/m)?.[1]?.trim() ?? '',
      description: block.match(/^\*\*Tagline :\*\*[^\n]*\n\n([^\n]+)$/m)?.[1]?.trim() ?? '',
      quote: block.match(/^\*([^*\n]+)\*$/m)?.[1]?.trim() ?? '',
      image: { asset: null, prompt_hint: visual },
      production_notes: visual ? [`Visuel résultat : ${visual}`] : [],
    };
  });

  const displayToAxis = new Map(Object.entries(axisLabels).map(([id, label]) => [label, id]));
  const axisHeadings = [...source.slice(subprofilesStart).matchAll(/^## (.+)$/gm)];
  const subprofiles = {};

  axisHeadings.forEach((heading, index) => {
    const axis = displayToAxis.get(heading[1].trim());
    if (!axis) return;
    const blockStart = heading.index + heading[0].length;
    const blockEnd = axisHeadings[index + 1]?.index ?? source.length - subprofilesStart;
    const block = source.slice(subprofilesStart).slice(blockStart, blockEnd);
    subprofiles[axis] = [...block.matchAll(/^- \*\*(\d+)[–-](\d+) : (.+?)\*\* — (.+)$/gm)].map(
      ([, min, max, name, description]) => ({
        min: Number(min),
        max: Number(max),
        name: name.trim(),
        description: description.trim(),
      }),
    );
  });

  if (profiles.length !== 5) throw new Error(`${profiles.length} profils globaux trouvés au lieu de 5`);
  for (const axis of Object.keys(axisLabels)) {
    if (subprofiles[axis]?.length !== 3) {
      throw new Error(`Sous-profils incomplets pour ${axis}`);
    }
  }

  return {
    schema_version: 1,
    source: 'RESULTS_V0.md',
    profiles,
    subprofiles,
  };
}

writeFileSync(join(root, 'questions.json'), `${JSON.stringify(parseQuestions(), null, 2)}\n`);
writeFileSync(join(root, 'results.json'), `${JSON.stringify(parseResults(), null, 2)}\n`);
console.log('Generated questions.json and results.json');
