import { calculateScores, findRange } from './scoring.js';

const axisOrder = ['organisation', 'anticipation', 'maintenance', 'hygiene_numerique', 'setup'];

const elements = {
  intro: document.getElementById('intro-screen'),
  quiz: document.getElementById('quiz-screen'),
  result: document.getElementById('result-screen'),
  start: document.getElementById('start-button'),
  loadError: document.getElementById('load-error'),
  progressLabel: document.getElementById('progress-label'),
  progressPercent: document.getElementById('progress-percent'),
  progressTrack: document.querySelector('.progress-track'),
  progressFill: document.getElementById('progress-fill'),
  questionNumber: document.getElementById('question-number'),
  questionTitle: document.getElementById('question-title'),
  answers: document.getElementById('answers'),
  bonus: document.getElementById('bonus-option'),
  previous: document.getElementById('previous-button'),
  next: document.getElementById('next-button'),
  scoreRing: document.getElementById('score-ring'),
  carreScore: document.getElementById('carre-score'),
  balanceCarre: document.getElementById('balance-carre'),
  balanceRond: document.getElementById('balance-rond'),
  resultLevel: document.getElementById('result-level'),
  resultName: document.getElementById('result-name'),
  resultTagline: document.getElementById('result-tagline'),
  resultDescription: document.getElementById('result-description'),
  resultQuote: document.getElementById('result-quote'),
  bonusResult: document.getElementById('bonus-result'),
  axisGrid: document.getElementById('axis-grid'),
  share: document.getElementById('share-button'),
  restart: document.getElementById('restart-button'),
  shareStatus: document.getElementById('share-status'),
  shareLink: document.getElementById('share-link'),
};

let quizData;
let resultsData;
let lastResult;
const state = { current: 0, answers: new Map(), bonuses: new Set() };

function showScreen(name) {
  for (const [key, element] of Object.entries({ intro: elements.intro, quiz: elements.quiz, result: elements.result })) {
    element.hidden = key !== name;
  }
}

function startQuiz() {
  state.current = 0;
  state.answers.clear();
  state.bonuses.clear();
  history.replaceState({}, '', location.pathname);
  showScreen('quiz');
  renderQuestion();
}

function selectAnswer(answerId) {
  const question = quizData.questions[state.current];
  state.answers.set(question.id, answerId);
  renderAnswers(question);
  elements.next.disabled = false;
}

function renderAnswers(question) {
  const selected = state.answers.get(question.id);
  elements.answers.replaceChildren();

  question.answers.forEach((answer, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-button';
    button.setAttribute('aria-pressed', String(answer.id === selected));
    button.addEventListener('click', () => selectAnswer(answer.id));

    const key = document.createElement('span');
    key.className = 'answer-key';
    key.textContent = String(index + 1);

    const content = document.createElement('span');
    content.className = 'answer-content';
    const behavior = document.createElement('span');
    behavior.className = 'answer-behavior';
    behavior.textContent = answer.behavior;
    const quote = document.createElement('span');
    quote.className = 'answer-quote';
    quote.textContent = answer.quote;
    content.append(behavior, quote);
    button.append(key, content);
    elements.answers.append(button);
  });
}

function renderBonus(question) {
  elements.bonus.replaceChildren();
  elements.bonus.hidden = !question.bonus;
  if (!question.bonus) return;

  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = state.bonuses.has(question.id);
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) state.bonuses.add(question.id);
    else state.bonuses.delete(question.id);
  });
  const text = document.createElement('span');
  text.textContent = `Bonus facultatif : ${question.bonus.label} (badge humoristique, hors calcul du profil)`;
  label.append(checkbox, text);
  elements.bonus.append(label);
}

function renderQuestion() {
  const question = quizData.questions[state.current];
  const position = state.current + 1;
  const percent = Math.round((position / quizData.questions.length) * 100);

  elements.progressLabel.textContent = `Question ${position} / ${quizData.questions.length}`;
  elements.progressPercent.textContent = `${percent} %`;
  elements.progressTrack.setAttribute('aria-valuenow', String(percent));
  elements.progressFill.style.width = `${percent}%`;
  elements.questionNumber.textContent = `Question ${String(position).padStart(2, '0')}`;
  elements.questionTitle.textContent = question.title;
  elements.previous.disabled = state.current === 0;
  elements.next.disabled = !state.answers.has(question.id);
  elements.next.textContent = position === quizData.questions.length ? 'Voir mon profil →' : 'Suivante →';
  renderAnswers(question);
  renderBonus(question);
  elements.questionTitle.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function movePrevious() {
  if (state.current === 0) return;
  state.current -= 1;
  renderQuestion();
}

function moveNext() {
  if (!state.answers.has(quizData.questions[state.current].id)) return;
  if (state.current < quizData.questions.length - 1) {
    state.current += 1;
    renderQuestion();
    return;
  }
  renderResult(calculateScores(quizData, state.answers, axisOrder), state.bonuses.size);
}

function renderAxisCards(scores) {
  elements.axisGrid.replaceChildren();
  axisOrder.forEach((axis) => {
    const score = scores.axes[axis];
    const label = quizData.axes.find((item) => item.id === axis).label;
    const profile = findRange(resultsData.subprofiles[axis], score);
    const card = document.createElement('article');
    card.className = 'axis-card';
    card.innerHTML = `
      <div class="axis-head"><span>${label}</span><span>${score} %</span></div>
      <div class="axis-bar" aria-hidden="true"><span style="width: ${score}%"></span></div>
      <p class="axis-profile"><strong>${profile.name}</strong> — ${profile.description}</p>
    `;
    elements.axisGrid.append(card);
  });
}

function renderResult(scores, bonusCount = 0) {
  const profile = findRange(resultsData.profiles, scores.carre);
  lastResult = scores;
  elements.scoreRing.style.setProperty('--score', `${scores.carre}%`);
  elements.carreScore.textContent = scores.carre;
  elements.balanceCarre.textContent = `${scores.carre} %`;
  elements.balanceRond.textContent = `${scores.rond} %`;
  elements.resultLevel.textContent = profile.level;
  elements.resultName.textContent = profile.name;
  elements.resultTagline.textContent = profile.tagline;
  elements.resultDescription.textContent = profile.description;
  elements.resultQuote.textContent = profile.quote;
  elements.bonusResult.hidden = bonusCount === 0;
  elements.bonusResult.textContent = bonusCount ? '🐾 Bonus Rond débloqué : ton setup bénéficie du chaos animalier.' : '';
  elements.shareStatus.textContent = '';
  elements.shareLink.hidden = true;
  renderAxisCards(scores);
  showScreen('result');
  elements.resultName.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildShareUrl(scores) {
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('result', String(scores.carre));
  axisOrder.forEach((axis) => url.searchParams.set(axis, String(scores.axes[axis])));
  return url.toString();
}

async function shareResult() {
  if (!lastResult) return;
  const url = buildShareUrl(lastResult);
  const profile = findRange(resultsData.profiles, lastResult.carre);
  const shareData = {
    title: 'Mon profil gamer Carré ou Rond',
    text: `Je suis ${profile.name} : ${lastResult.carre} % Carré, ${lastResult.rond} % Rond.`,
    url,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      elements.shareStatus.textContent = 'Profil partagé.';
      return;
    }
    await navigator.clipboard.writeText(`${shareData.text} ${url}`);
    elements.shareStatus.textContent = 'Lien copié dans le presse-papiers.';
  } catch (error) {
    if (error.name === 'AbortError') return;
    elements.shareLink.value = url;
    elements.shareLink.hidden = false;
    elements.shareLink.select();
    elements.shareStatus.textContent = 'Copie ce lien pour partager ton profil.';
  }
}

function readSharedResult() {
  const params = new URLSearchParams(location.search);
  if (!params.has('result') || axisOrder.some((axis) => !params.has(axis))) return null;
  const carre = Number(params.get('result'));
  const axes = Object.fromEntries(axisOrder.map((axis) => [axis, Number(params.get(axis))]));
  const scores = [carre, ...Object.values(axes)];
  if (scores.some((score) => !Number.isFinite(score) || score < 0 || score > 100)) return null;
  return { carre: Math.round(carre), rond: 100 - Math.round(carre), axes };
}

function bindEvents() {
  elements.start.addEventListener('click', startQuiz);
  elements.previous.addEventListener('click', movePrevious);
  elements.next.addEventListener('click', moveNext);
  elements.restart.addEventListener('click', startQuiz);
  elements.share.addEventListener('click', shareResult);
  document.addEventListener('keydown', (event) => {
    if (elements.quiz.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (['1', '2', '3'].includes(event.key)) {
      selectAnswer(quizData.questions[state.current].answers[Number(event.key) - 1].id);
    } else if (event.key === 'ArrowLeft') {
      movePrevious();
    }
  });
}

async function init() {
  bindEvents();
  try {
    const [questionsResponse, resultsResponse] = await Promise.all([
      fetch('questions.json'),
      fetch('results.json'),
    ]);
    if (!questionsResponse.ok || !resultsResponse.ok) throw new Error('Données indisponibles');
    [quizData, resultsData] = await Promise.all([questionsResponse.json(), resultsResponse.json()]);
    elements.start.disabled = false;
    elements.start.textContent = 'Lancer le test →';
    const sharedResult = readSharedResult();
    if (sharedResult) renderResult(sharedResult);
  } catch (error) {
    elements.start.textContent = 'Chargement impossible';
    elements.loadError.hidden = false;
    elements.loadError.textContent = 'Les données du test n’ont pas pu être chargées. Réessaie dans un instant.';
    console.error(error);
  }
}

init();
