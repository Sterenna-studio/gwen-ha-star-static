import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { calculateScores, findRange } from '../quizzes/gamer-profile-test/scoring.js';

const axisOrder = ['organisation', 'anticipation', 'maintenance', 'hygiene_numerique', 'setup'];
const root = new URL('../quizzes/gamer-profile-test/', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const [baseQuiz, additions, patches, resultsData] = await Promise.all([
  readJson('questions.json'),
  readJson('v0.2/questions-additions.json'),
  readJson('v0.2/question-patches.json'),
  readJson('v0.2/results.json'),
]);
const patchesByQuestion = new Map(patches.patches.map((patch) => [patch.question_id, patch]));
const quizData = {
  ...baseQuiz,
  questions: [
    ...baseQuiz.questions.map((question) => ({
      ...question,
      context_bonuses: patchesByQuestion.get(question.id)?.context_bonuses || [],
      answers: question.answers.map((answer) => ({ ...answer, round_points: 2 - answer.carre_points })),
    })),
    ...additions.questions,
  ],
};
const answerEverything = (answerId) => new Map(quizData.questions.map((question) => [question.id, answerId]));

test('la V0.2 contient 35 questions', () => {
  assert.equal(quizData.questions.length, 35);
});

test('le profil tout A vaut 0 point Rond', () => {
  const result = calculateScores(quizData, answerEverything('a'), axisOrder, { has_pets: false });
  assert.equal(result.basePoints, 0);
  assert.equal(result.bonusPoints, 0);
  assert.equal(result.totalPoints, 0);
  assert.equal(result.rond, 0);
  assert.equal(result.carre, 100);
  assert.equal(findRange(resultsData.profiles, result.totalPoints).level, 'très Carré');
});

test('le profil tout B vaut 35 points avant bonus', () => {
  const result = calculateScores(quizData, answerEverything('b'), axisOrder, { has_pets: false });
  assert.equal(result.basePoints, 35);
  assert.equal(result.totalPoints, 35);
  assert.equal(findRange(resultsData.profiles, result.totalPoints).level, 'Rond-Carré');
});

test('le profil tout C avec animal atteint le maximum de 72 points', () => {
  const result = calculateScores(quizData, answerEverything('c'), axisOrder, { has_pets: true });
  assert.equal(result.basePoints, 70);
  assert.equal(result.bonusPoints, 2);
  assert.equal(result.totalPoints, 72);
  assert.equal(result.rond, 100);
  assert.equal(result.appliedBonuses.length, 2);
  assert.equal(findRange(resultsData.profiles, result.totalPoints).level, 'très Rond');
});

test('le calcul refuse un questionnaire incomplet', () => {
  assert.throws(() => calculateScores(quizData, new Map(), axisOrder, { has_pets: false }), /Réponse manquante/);
});
