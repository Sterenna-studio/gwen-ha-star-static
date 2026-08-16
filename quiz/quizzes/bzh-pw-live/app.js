const screens = {
  start: document.getElementById('start-screen'),
  quiz: document.getElementById('quiz-screen'),
  result: document.getElementById('result-screen'),
};
const startButton = document.getElementById('start-button');
const actionButton = document.getElementById('action-button');
const restartButton = document.getElementById('restart-button');
const questionTitle = document.getElementById('question-title');
const answersElement = document.getElementById('answers');
const feedback = document.getElementById('feedback');

let playersData;
let loreQuestions;
let session = [];
let current = 0;
let score = 0;
let selected = null;
let locked = false;

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => { screen.hidden = key !== name; });
}

function otherPlayers(correct, count) {
  return shuffle(playersData.players.map((player) => player.id).filter((id) => id !== correct)).slice(0, count);
}

function makeTrueFalse() {
  const player = shuffle(playersData.players)[0];
  const [metric, label, suffix] = shuffle([
    ['total', 'parties totales', ''],
    ['wr', 'de winrate', ' %'],
    ['sr', 'parties sur la Faille', ''],
    ['aram', 'parties en ARAM', ''],
  ])[0];
  const truthful = Math.random() >= 0.5;
  const actual = player[metric];
  const delta = metric === 'wr' ? 4.5 : 37;
  const displayed = truthful ? actual : Math.max(0, Math.round((actual + delta) * 10) / 10);
  return {
    category: 'Vrai / Faux',
    question: `${player.id} possède ${displayed}${suffix} ${label}.`,
    options: ['Vrai', 'Faux'],
    answer: truthful ? 'Vrai' : 'Faux',
    explanation: `La valeur enregistrée est ${actual}${suffix}.`,
  };
}

function makeComparison() {
  const [first, second] = shuffle(playersData.players).slice(0, 2);
  const [metric, label, suffix] = shuffle([
    ['total', 'parties totales', ''],
    ['wr', 'meilleur winrate', ' %'],
    ['sr', 'parties sur la Faille', ''],
    ['aram', 'parties en ARAM', ''],
  ])[0];
  const winner = first[metric] >= second[metric] ? first : second;
  return {
    category: 'Statistiques',
    question: `Qui possède le plus de ${label} ?`,
    options: shuffle([first.id, second.id]),
    answer: winner.id,
    explanation: `${first.id} : ${first[metric]}${suffix} · ${second.id} : ${second[metric]}${suffix}.`,
  };
}

function makeChampion() {
  const player = shuffle(playersData.players.filter((item) => item.top_champs?.length))[0];
  const champion = shuffle(player.top_champs)[0];
  return {
    category: 'Champion',
    question: `Qui est le spécialiste de ${champion.name} dans la base de la team ?`,
    options: shuffle([player.id, ...otherPlayers(player.id, 3)]),
    answer: player.id,
    explanation: `${player.id} compte ${champion.games} parties sur ${champion.name}, avec ${champion.wr} % de winrate.`,
  };
}

function makeLore() {
  const lore = shuffle(loreQuestions)[0];
  return {
    category: 'Lore LoL',
    question: lore.q,
    options: shuffle(lore.options),
    answer: lore.a,
    explanation: lore.exp,
  };
}

function generateSession() {
  return shuffle([
    makeTrueFalse(), makeTrueFalse(), makeTrueFalse(),
    makeComparison(), makeComparison(), makeComparison(),
    makeChampion(), makeChampion(),
    makeLore(), makeLore(),
  ]);
}

function renderAnswers(question) {
  answersElement.replaceChildren();
  question.options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer';
    button.textContent = option;
    button.setAttribute('aria-pressed', String(option === selected));
    button.disabled = locked;
    button.addEventListener('click', () => {
      selected = option;
      actionButton.disabled = false;
      renderAnswers(question);
    });
    answersElement.append(button);
  });
}

function renderQuestion() {
  const question = session[current];
  const position = current + 1;
  selected = null;
  locked = false;
  feedback.hidden = true;
  feedback.className = 'feedback';
  document.getElementById('question-counter').textContent = `Question ${position} / ${session.length}`;
  document.getElementById('category-label').textContent = question.category;
  document.getElementById('progress-fill').style.width = `${(position / session.length) * 100}%`;
  document.querySelector('.progress').setAttribute('aria-valuenow', String((position / session.length) * 100));
  questionTitle.textContent = question.question;
  actionButton.textContent = 'Valider la réponse';
  actionButton.disabled = true;
  renderAnswers(question);
  questionTitle.focus({ preventScroll: true });
}

function validateAnswer() {
  const question = session[current];
  if (!selected) return;
  if (!locked) {
    locked = true;
    const correct = selected === question.answer;
    if (correct) score += 1;
    feedback.hidden = false;
    feedback.className = `feedback ${correct ? 'correct' : 'incorrect'}`;
    feedback.textContent = `${correct ? '✓ Bonne réponse.' : `✗ La réponse était ${question.answer}.`} ${question.explanation}`;
    actionButton.textContent = current === session.length - 1 ? 'Voir le résultat' : 'Question suivante';
    renderAnswers(question);
    return;
  }
  current += 1;
  if (current < session.length) renderQuestion();
  else showResult();
}

function start() {
  session = generateSession();
  current = 0;
  score = 0;
  showScreen('quiz');
  renderQuestion();
}

function showResult() {
  showScreen('result');
  document.getElementById('final-score').textContent = `${score} / ${session.length}`;
  document.getElementById('result-message').textContent = score >= 8
    ? 'Les archives n’ont presque plus de secrets pour toi.'
    : score >= 5
      ? 'Une bonne lecture de la base, avec encore quelques fragments à décrypter.'
      : 'Le Datadock demande une nouvelle synchronisation. Relance une partie !';
}

async function init() {
  try {
    const [playersResponse, loreResponse] = await Promise.all([
      fetch('../../data/players.json'),
      fetch('../../data/questions-static.json'),
    ]);
    if (!playersResponse.ok || !loreResponse.ok) throw new Error('Données indisponibles');
    [playersData, loreQuestions] = await Promise.all([playersResponse.json(), loreResponse.json()]);
    document.getElementById('sync-label').textContent = `Données du ${playersData.last_sync}`;
    startButton.disabled = false;
    startButton.textContent = 'Générer une partie →';
  } catch (error) {
    document.getElementById('load-error').hidden = false;
    document.getElementById('load-error').textContent = 'Impossible de charger la base joueurs.';
    startButton.textContent = 'Chargement impossible';
    console.error(error);
  }
}

startButton.addEventListener('click', start);
restartButton.addEventListener('click', start);
actionButton.addEventListener('click', validateAnswer);
init();
