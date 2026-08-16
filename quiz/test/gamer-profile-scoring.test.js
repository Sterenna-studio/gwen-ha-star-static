import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { calculateScores, findRange } from '../quizzes/gamer-profile-test/scoring.js';

const axisOrder = ['organisation', 'anticipation', 'maintenance', 'hygiene_numerique', 'setup'];
const root = new URL('../quizzes/gamer-profile-test/', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const [quizData, resultsData] = await Promise.all([
  readJson('questions.json'),
  readJson('results.json'),
]);
const answerEverything = (answerId) => new Map(quizData.questions.map((question) => [question.id, answerId]));

test('la version jouable utilise exactement les 30 questions V0.1', () => {
  assert.equal(quizData.questions.length, 30);
  assert.deepEqual(quizData.questions.map((question) => question.id), Array.from({ length: 30 }, (_, index) => index + 1));
});

test('le profil tout A vaut 0 point Rond et 100 % Carré', () => {
  const result = calculateScores(quizData, answerEverything('a'), axisOrder);
  assert.equal(result.totalPoints, 0);
  assert.equal(result.maxPoints, 60);
  assert.equal(result.rond, 0);
  assert.equal(result.carre, 100);
  assert.equal(findRange(resultsData.profiles, result.carre).level, 'Très Carré');
});

test('le profil tout B vaut 30 points sur 60', () => {
  const result = calculateScores(quizData, answerEverything('b'), axisOrder);
  assert.equal(result.totalPoints, 30);
  assert.equal(result.rond, 50);
  assert.equal(findRange(resultsData.profiles, result.carre).level, 'Rond-Carré');
});

test('le profil tout C vaut le maximum de 60 points Rond', () => {
  const result = calculateScores(quizData, answerEverything('c'), axisOrder);
  assert.equal(result.totalPoints, 60);
  assert.equal(result.maxPoints, 60);
  assert.equal(result.rond, 100);
  assert.equal(result.carre, 0);
  assert.equal(findRange(resultsData.profiles, result.carre).level, 'Très Rond');
});

test('le calcul refuse un questionnaire incomplet', () => {
  assert.throws(() => calculateScores(quizData, new Map(), axisOrder), /Réponse manquante/);
});
