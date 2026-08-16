import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { calculateScores, findRange, randomizeAnswers } from '../quizzes/gamer-profile-test/scoring.js';

const axisOrder = ['organisation', 'anticipation', 'maintenance', 'hygiene_numerique', 'setup'];
const root = new URL('../quizzes/gamer-profile-test/', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const [baseQuiz, resultsData, contextBonuses] = await Promise.all([
  readJson('questions.json'),
  readJson('results.json'),
  readJson('context-bonuses.json'),
]);
const patchesByQuestion = new Map(contextBonuses.patches.map((patch) => [patch.question_id, patch]));
const quizData = {
  ...baseQuiz,
  context_bonus_max_points: contextBonuses.maximum_points,
  questions: baseQuiz.questions.map((question) => ({
    ...question,
    context_bonuses: patchesByQuestion.get(question.id)?.context_bonuses || [],
  })),
};
const answerEverything = (answerId) => new Map(quizData.questions.map((question) => [question.id, answerId]));

test('la version jouable utilise exactement les 30 questions V0.1', () => {
  assert.equal(quizData.questions.length, 30);
  assert.deepEqual(quizData.questions.map((question) => question.id), Array.from({ length: 30 }, (_, index) => index + 1));
});

test('le profil tout A vaut 0 point Rond et 100 % Carré', () => {
  const result = calculateScores(quizData, answerEverything('a'), axisOrder, { has_pets: false });
  assert.equal(result.totalPoints, 0);
  assert.equal(result.maxPoints, 60);
  assert.equal(result.rond, 0);
  assert.equal(result.carre, 100);
  assert.equal(findRange(resultsData.profiles, result.carre).level, 'Très Carré');
});

test('le profil tout B vaut 30 points sur 60', () => {
  const result = calculateScores(quizData, answerEverything('b'), axisOrder, { has_pets: false });
  assert.equal(result.totalPoints, 30);
  assert.equal(result.rond, 50);
  assert.equal(findRange(resultsData.profiles, result.carre).level, 'Rond-Carré');
});

test('le profil tout C avec animal atteint le maximum de 62 points Rond', () => {
  const result = calculateScores(quizData, answerEverything('c'), axisOrder, { has_pets: true });
  assert.equal(result.basePoints, 60);
  assert.equal(result.bonusPoints, 2);
  assert.equal(result.totalPoints, 62);
  assert.equal(result.maxPoints, 62);
  assert.equal(result.rond, 100);
  assert.equal(result.carre, 0);
  assert.equal(findRange(resultsData.profiles, result.carre).level, 'Très Rond');
});

test('les bonus animaux modifient le score sans ajouter de question', () => {
  const result = calculateScores(quizData, answerEverything('b'), axisOrder, { has_pets: true });
  assert.equal(quizData.questions.length, 30);
  assert.equal(result.basePoints, 30);
  assert.equal(result.bonusPoints, 2);
  assert.equal(result.totalPoints, 32);
  assert.equal(result.maxPoints, 62);
  assert.equal(result.appliedBonuses.length, 2);
});

test('le mélange change l’ordre affiché sans modifier les points des réponses', () => {
  const answers = quizData.questions[0].answers;
  const shuffled = randomizeAnswers(answers, () => 0);
  assert.notDeepEqual(shuffled.map((answer) => answer.id), answers.map((answer) => answer.id));
  assert.deepEqual(new Set(shuffled.map((answer) => answer.id)), new Set(['a', 'b', 'c']));
  assert.deepEqual(shuffled.map((answer) => 2 - answer.carre_points).sort(), [0, 1, 2]);
});

test('le calcul refuse un questionnaire incomplet', () => {
  assert.throws(() => calculateScores(quizData, new Map(), axisOrder, { has_pets: false }), /Réponse manquante/);
});
