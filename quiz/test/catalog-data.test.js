import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const manifest = await readJson('data/quizzes.json');
const lolQuestions = await readJson('quizzes/bzh-pw-lol/questions.json');

test('le catalogue publie les quatre modules dans l’ordre attendu', () => {
  assert.deepEqual(manifest.map((quiz) => quiz.id), [
    'gamer-profile-test',
    'bzh-pw-live',
    'bzh-pw-lol',
    'bzh-pw-table',
  ]);
});

test('chaque module du catalogue possède une page et des métadonnées', async () => {
  for (const quiz of manifest) {
    const directory = quiz.path.split('/')[1];
    await assert.doesNotReject(readFile(new URL(quiz.path, root), 'utf8'));
    const metadata = await readJson(`quizzes/${directory}/quiz.json`);
    assert.equal(metadata.id, quiz.id);
  }
});

test('le pool LoL consolidé contient 216 entrées uniques et traçables', () => {
  assert.equal(lolQuestions.length, 216);
  assert.equal(new Set(lolQuestions.map((question) => question.id)).size, 216);
  assert.ok(lolQuestions.every((question) => question.sources.length >= 1));
});
