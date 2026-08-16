import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const quizzesRoot = join(root, 'quizzes');
const required = ['id', 'title', 'description', 'theme', 'date', 'order'];

const manifest = readdirSync(quizzesRoot)
  .filter((name) => statSync(join(quizzesRoot, name)).isDirectory())
  .map((directory) => {
    const metadataPath = join(quizzesRoot, directory, 'quiz.json');
    let metadata;
    try {
      metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    for (const field of required) {
      if (metadata[field] === undefined || metadata[field] === '') {
        throw new Error(`${directory}/quiz.json : champ requis manquant (${field})`);
      }
    }
    return {
      ...metadata,
      path: `quizzes/${directory}/index.html`,
    };
  })
  .filter(Boolean)
  .filter((quiz) => quiz.status !== 'draft')
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'fr'));

const ids = new Set();
for (const quiz of manifest) {
  if (ids.has(quiz.id)) throw new Error(`Identifiant de quizz dupliqué : ${quiz.id}`);
  ids.add(quiz.id);
}

writeFileSync(join(root, 'data', 'quizzes.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated data/quizzes.json (${manifest.length} modules)`);
