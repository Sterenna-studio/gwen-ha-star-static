import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../quizzes/gamer-profile-test/', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const [base, v02Additions, v03Extensions, v03Additions, v03Scoring, v03Results, v03Version] = await Promise.all([
  readJson('questions.json'),
  readJson('v0.2/questions-additions.json'),
  readJson('v0.3/answer-extensions.json'),
  readJson('v0.3/questions-additions.json'),
  readJson('v0.3/scoring.json'),
  readJson('v0.3/results.json'),
  readJson('v0.3/version.json'),
]);

function composeV03() {
  const extensions = new Map(v03Extensions.extensions.map((entry) => [entry.question_id, entry.answer]));
  const inherited = [...base.questions, ...v02Additions.questions].map((question) => {
    const extra = extensions.get(question.id);
    if (!extra) throw new Error(`Réponse V0.3 manquante pour la question ${question.id}`);
    return { ...question, answers: [...question.answers, extra] };
  });
  return [...inherited, ...v03Additions.questions];
}

const questions = composeV03();

test('V0.3 compose exactement 40 questions uniques', () => {
  assert.equal(questions.length, 40);
  assert.equal(new Set(questions.map((question) => question.id)).size, 40);
  assert.deepEqual(questions.map((question) => question.id), Array.from({ length: 40 }, (_, index) => index + 1));
});

test('V0.3 possède quatre réponses par question avec l’échelle 0 / 0.5 / 1 / 2', () => {
  for (const question of questions) {
    assert.equal(question.answers.length, 4, `Q${question.id}`);
    const points = question.answers
      .map((answer) => Number.isFinite(answer.round_points) ? answer.round_points : 2 - answer.carre_points)
      .sort((a, b) => a - b);
    assert.deepEqual(points, [0, 0.5, 1, 2], `Q${question.id}`);
  }
});

test('V0.3 équilibre les cinq axes à huit questions chacun', () => {
  const counts = Object.fromEntries(base.axes.map((axis) => [axis.id, 0]));
  questions.forEach((question) => { counts[question.axis] += 1; });
  assert.deepEqual(counts, {
    organisation: 8,
    anticipation: 8,
    maintenance: 8,
    hygiene_numerique: 8,
    setup: 8,
  });
});

test('les métadonnées de score V0.3 correspondent au questionnaire', () => {
  assert.equal(v03Version.question_count, 40);
  assert.equal(v03Version.answer_count_per_question, 4);
  assert.equal(v03Scoring.base_max_points, 80);
  assert.equal(v03Scoring.effective_max_points, 82);
});

test('les intervalles V0.3 couvrent tous les scores possibles de 0 à 82 par pas de 0.5', () => {
  for (let score = 0; score <= 82; score += 0.5) {
    const matches = v03Results.profiles.filter((profile) => score >= profile.min && score <= profile.max);
    assert.equal(matches.length, 1, `score ${score}`);
  }
});
