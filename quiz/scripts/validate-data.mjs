import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
const manifest = readJson('data/quizzes.json');
const directories = readdirSync(join(root, 'quizzes'));
const publishedDirectories = new Set(manifest.map((quiz) => quiz.path.split('/')[1]));

if (manifest.length === 0) throw new Error('Le manifeste est vide');
for (const quiz of manifest) {
  const directory = quiz.path.split('/')[1];
  if (!existsSync(join(root, quiz.path))) throw new Error(`Page manquante : ${quiz.path}`);
  if (!existsSync(join(root, 'quizzes', directory, 'quiz.json'))) throw new Error(`Métadonnées manquantes : ${directory}`);
  for (const dataSource of quiz.data_sources ?? []) {
    if (!existsSync(join(root, dataSource))) throw new Error(`Source de données manquante pour ${quiz.id} : ${dataSource}`);
  }
}

for (const directory of directories) {
  const metadata = join(root, 'quizzes', directory, 'quiz.json');
  if (existsSync(metadata) && !publishedDirectories.has(directory)) {
    const quiz = JSON.parse(readFileSync(metadata, 'utf8'));
    if (quiz.status !== 'draft') throw new Error(`Module absent du manifeste : ${directory}`);
  }
}

const lolQuestions = readJson('quizzes/bzh-pw-lol/questions.json');
if (lolQuestions.length < 200) throw new Error(`Pool LoL trop petit : ${lolQuestions.length}`);
const lolMetadata = manifest.find((quiz) => quiz.id === 'bzh-pw-lol');
if (lolMetadata.pool_size !== lolQuestions.length) {
  throw new Error(`pool_size LoL incohérent : ${lolMetadata.pool_size} / ${lolQuestions.length}`);
}
for (const [index, question] of lolQuestions.entries()) {
  if (!question.id || !question.question || !['radio', 'match'].includes(question.type)) {
    throw new Error(`Question LoL invalide à l'index ${index}`);
  }
  if (question.type === 'radio') {
    if (!Array.isArray(question.options) || question.options.length < 2 || !question.answer) {
      throw new Error(`Question radio invalide : ${question.id}`);
    }
    if (!question.options.includes(question.answer)) throw new Error(`Réponse absente des options : ${question.id}`);
  } else if (!Array.isArray(question.pairs) || question.pairs.length < 2) {
    throw new Error(`Question d'association invalide : ${question.id}`);
  }
}

const gamerBase = readJson('quizzes/gamer-profile-test/questions.json');
const gamerMetadata = manifest.find((quiz) => quiz.id === 'gamer-profile-test');

if (gamerBase.questions.length !== 30) throw new Error('Gamer Profile V0.1 doit contenir exactement 30 questions jouables');
if (gamerMetadata.question_count !== 30 || gamerMetadata.version !== '0.1') {
  throw new Error('Métadonnées Gamer Profile V0.1 incohérentes');
}

const ids = new Set();
for (const question of gamerBase.questions) {
  if (ids.has(question.id)) throw new Error(`Question Gamer Profile dupliquée : ${question.id}`);
  ids.add(question.id);
  if (!gamerBase.axes.some((axis) => axis.id === question.axis)) throw new Error(`Axe Gamer Profile inconnu : ${question.axis}`);
  if (question.answers.length !== 3) throw new Error(`Question Gamer Profile ${question.id} : 3 réponses attendues`);
}

const players = readJson('data/players.json');
const lore = readJson('data/questions-static.json');
if (!players.last_sync || players.players.length < 2) throw new Error('Données joueurs invalides');
if (lore.length < 10) throw new Error('Pool de lore insuffisant');

console.log(`Validated ${manifest.length} modules, ${lolQuestions.length} LoL questions and ${gamerBase.questions.length} Gamer Profile V0.1 questions`);
