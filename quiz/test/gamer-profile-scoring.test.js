import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { calculateScores, findRange } from '../quizzes/gamer-profile-test/scoring.js';

const axisOrder = ['organisation', 'anticipation', 'maintenance', 'hygiene_numerique', 'setup'];
const root = new URL('../quizzes/gamer-profile-test/', import.meta.url);
const quizData = JSON.parse(await readFile(new URL('questions.json', root), 'utf8'));
const resultsData = JSON.parse(await readFile(new URL('results.json', root), 'utf8'));
const answerEverything = (answerId) => new Map(quizData.questions.map((question) => [question.id, answerId]));

test('le profil tout A vaut 100 % Carré sur chaque axe', () => {
  const result = calculateScores(quizData, answerEverything('a'), axisOrder);
  assert.deepEqual(result, {
    carre: 100,
    rond: 0,
    axes: { organisation: 100, anticipation: 100, maintenance: 100, hygiene_numerique: 100, setup: 100 },
  });
});

test('le profil tout B est équilibré à 50 / 50', () => {
  const result = calculateScores(quizData, answerEverything('b'), axisOrder);
  assert.equal(result.carre, 50);
  assert.equal(result.rond, 50);
  assert.equal(findRange(resultsData.profiles, result.carre).name, "L'Équilibriste Numérique");
});

test('le calcul refuse un questionnaire incomplet', () => {
  assert.throws(() => calculateScores(quizData, new Map(), axisOrder), /Réponse manquante/);
});
