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
  previous: document.getElementById('previous-button'),
  next: document.getElementById('next-button'),
  scoreRing: document.getElementById('score-ring'),
  scoreValue: document.getElementById('carre-score'),
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
const state = { current: 0, answers: new Map() };

function installScoreUi() {
  elements.scoreRing.classList.add('score-ring--round');
  elements.scoreRing.setAttribute('aria-label', 'Points Rond');
  elements.scoreRing.querySelector('span').textContent = 'POINTS ROND';

  elements.resultSummary = document.createElement('p');
  elements.resultSummary.className = 'result-summary';
  elements.resultLevel.before(elements.resultSummary);

  elements.scoreBreakdown = document.createElement('div');
  elements.scoreBreakdown.className = 'score-breakdown';
  elements.scoreBreakdown.innerHTML = '<span>Score des 30 questions : <strong id="total-points">0 / 60</strong></span>';
  elements.bonusResult.before(elements.scoreBreakdown);
  elements.totalPoints = elements.scoreBreakdown.querySelector('#total-points');

  const axisNote = document.createElement('p');
  axisNote.className = 'axis-note';
  axisNote.innerHTML = 'Chaque axe indique ta tendance <strong>Rond</strong> : plus le score monte, plus tu fonctionnes à l’instinct.';
  document.getElementById('axis-title').after(axisNote);
}

function showScreen(name) {
  const screens = { intro: elements.intro, quiz: elements.quiz, result: elements.result };
  Object.entries(screens).forEach(([key, element]) => { element.hidden = key !== name; });
}

function startQuiz() {
  state.current = 0;
  state.answers.clear();
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
    button.innerHTML = `<span class="answer-key">${index + 1}</span><span class="answer-content"><span class="answer-behavior"></span><span class="answer-quote"></span></span>`;
    button.querySelector('.answer-behavior').textContent = answer.behavior;
    button.querySelector('.answer-quote').textContent = answer.quote;
    elements.answers.append(button);
  });
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
  elements.next.textContent = position === quizData.questions.length ? 'Voir mon score →' : 'Suivante →';
  renderAnswers(question);
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
  renderResult(calculateScores(quizData, state.answers, axisOrder));
}

function renderAxisCards(scores) {
  elements.axisGrid.replaceChildren();
  axisOrder.forEach((axis) => {
    const roundScore = scores.axes[axis];
    const label = quizData.axes.find((item) => item.id === axis).label;
    const profile = findRange(resultsData.subprofiles[axis], 100 - roundScore);
    const card = document.createElement('article');
    card.className = 'axis-card';
    card.innerHTML = `<div class="axis-head"><span>${label}</span><span>${roundScore} % Rond</span></div><div class="axis-bar" aria-hidden="true"><span></span></div><p class="axis-profile"></p>`;
    card.querySelector('.axis-bar span').style.width = `${roundScore}%`;
    card.querySelector('.axis-profile').textContent = `${profile.name} — ${profile.description}`;
    elements.axisGrid.append(card);
  });
}

function renderResult(scores) {
  const profile = findRange(resultsData.profiles, scores.carre);
  lastResult = scores;
  elements.scoreRing.style.setProperty('--score', `${scores.rond}%`);
  elements.scoreValue.textContent = scores.totalPoints;
  elements.balanceCarre.textContent = `${scores.carre} %`;
  elements.balanceRond.textContent = `${scores.rond} %`;
  elements.resultSummary.textContent = `Tu obtiens ${scores.totalPoints} points Rond sur ${scores.maxPoints}.`;
  elements.resultLevel.textContent = profile.level;
  elements.resultName.textContent = profile.name;
  elements.resultTagline.textContent = profile.tagline;
  elements.resultDescription.textContent = profile.description;
  elements.resultQuote.textContent = profile.quote;
  elements.totalPoints.textContent = `${scores.totalPoints} / ${scores.maxPoints}`;
  elements.bonusResult.hidden = true;
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
  url.searchParams.set('points', String(scores.totalPoints));
  url.searchParams.set('max', String(scores.maxPoints));
  axisOrder.forEach((axis) => url.searchParams.set(axis, String(scores.axes[axis])));
  return url.toString();
}

async function shareResult() {
  if (!lastResult) return;
  const profile = findRange(resultsData.profiles, lastResult.carre);
  const url = buildShareUrl(lastResult);
  const shareData = {
    title: 'Mon profil gamer Carré ou Rond',
    text: `J’ai ${lastResult.totalPoints}/${lastResult.maxPoints} points Rond : ${profile.name}.`,
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
  if (!params.has('points') || !params.has('max') || axisOrder.some((axis) => !params.has(axis))) return null;
  const maxPoints = quizData.questions.length * 2;
  const totalPoints = Number(params.get('points'));
  const sharedMaximum = Number(params.get('max'));
  const axes = Object.fromEntries(axisOrder.map((axis) => [axis, Number(params.get(axis))]));
  if (sharedMaximum !== maxPoints || !Number.isFinite(totalPoints) || totalPoints < 0 || totalPoints > maxPoints) return null;
  if (Object.values(axes).some((score) => !Number.isFinite(score) || score < 0 || score > 100)) return null;
  const rond = Math.round((totalPoints / maxPoints) * 100);
  return { basePoints: totalPoints, bonusPoints: 0, totalPoints, maxPoints, appliedBonuses: [], rond, carre: 100 - rond, axes };
}

function bindEvents() {
  elements.start.addEventListener('click', startQuiz);
  elements.previous.addEventListener('click', movePrevious);
  elements.next.addEventListener('click', moveNext);
  elements.restart.addEventListener('click', startQuiz);
  elements.share.addEventListener('click', shareResult);
  document.addEventListener('keydown', (event) => {
    if (elements.quiz.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    if (['1', '2', '3'].includes(event.key)) {
      selectAnswer(quizData.questions[state.current].answers[Number(event.key) - 1].id);
    } else if (event.key === 'ArrowLeft') {
      movePrevious();
    }
  });
}

async function init() {
  installScoreUi();
  bindEvents();
  try {
    const responses = await Promise.all([fetch('questions.json'), fetch('results.json')]);
    if (responses.some((response) => !response.ok)) throw new Error('Données V0.1 indisponibles');
    [quizData, resultsData] = await Promise.all(responses.map((response) => response.json()));
    elements.start.disabled = false;
    elements.start.textContent = 'Lancer les 30 questions →';
    const sharedResult = readSharedResult();
    if (sharedResult) renderResult(sharedResult);
  } catch (error) {
    elements.start.textContent = 'Chargement impossible';
    elements.loadError.hidden = false;
    elements.loadError.textContent = 'Les 30 questions V0.1 n’ont pas pu être chargées.';
    console.error(error);
  }
}

init();
