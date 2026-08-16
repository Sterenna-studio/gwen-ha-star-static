import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcesRoot = join(root, 'sources', 'lol-team-stats');
const sourceFiles = [
  'gwen-pool.json',
  'advanced-pool-v1.json',
  'advanced-pool-v2.json',
  'stats-v1.json',
  'stats-v2.json',
];

const bySignature = new Map();

for (const source of sourceFiles) {
  const questions = JSON.parse(readFileSync(join(sourcesRoot, source), 'utf8'));
  for (const raw of questions) {
    const question = raw.question?.trim();
    const type = raw.type || 'radio';
    if (type === 'match') {
      const pairs = raw.pairs?.map((pair) => ({ left: String(pair.left).trim(), right: String(pair.right).trim() }));
      if (!question || !Array.isArray(pairs) || pairs.length < 2 || pairs.some((pair) => !pair.left || !pair.right)) {
        throw new Error(`${source} contient une association invalide : ${question || '<sans titre>'}`);
      }
      const signature = JSON.stringify([type, question, pairs]);
      const existing = bySignature.get(signature);
      if (existing) {
        existing.sources.push(source);
        continue;
      }
      bySignature.set(signature, {
        id: `lol-${createHash('sha1').update(signature).digest('hex').slice(0, 10)}`,
        type,
        question,
        pairs,
        explanation: raw.explanation?.trim() || 'Associations validées.',
        sources: [source],
      });
      continue;
    }
    const options = raw.options?.map((option) => String(option).trim());
    const answer = String(raw.answer ?? '').trim();
    if (!question || !Array.isArray(options) || options.length < 2 || !options.includes(answer)) {
      throw new Error(`${source} contient une question invalide : ${question || '<sans titre>'}`);
    }
    const signature = JSON.stringify([question, options, answer]);
    const existing = bySignature.get(signature);
    if (existing) {
      existing.sources.push(source);
      if (!existing.explanation && raw.explanation) existing.explanation = raw.explanation.trim();
      continue;
    }
    bySignature.set(signature, {
      id: `lol-${createHash('sha1').update(signature).digest('hex').slice(0, 10)}`,
      type,
      question,
      options,
      answer,
      explanation: raw.explanation?.trim() || `Bonne réponse : ${answer}.`,
      sources: [source],
    });
  }
}

const output = [...bySignature.values()];
writeFileSync(join(root, 'quizzes', 'bzh-pw-lol', 'questions.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Generated bzh-pw-lol/questions.json (${output.length} unique questions)`);
