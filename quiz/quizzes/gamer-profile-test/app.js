import { calculateScores, findRange, randomizeAnswers } from './scoring.js';

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
const state = {
  current: 0,
  answers: new Map(),
  answerOrders: new Map(),
  profile: { name: '', age: null, sex_or_gender: '', has_pets: false, pet_types: '' },
};

function installScoreUi() {
  document.querySelector('.intro-facts').innerHTML = '<span>30 questions V0.1</span><span>5 axes</span><span>≈ 5 minutes</span><span>62 points max.</span>';

  const profile = document.createElement('section');
  profile.className = 'screen profile-screen';
  profile.id = 'profile-screen';
  profile.hidden = true;
  profile.innerHTML = `
    <p class="eyebrow">// AVANT DE COMMENCER</p>
    <h2 id="profile-title">Ton profil de joueur</h2>
    <p class="profile-intro">Le nom personnalise le résultat. Seule la présence d’un animal peut ajouter jusqu’à deux petits points Rond contextuels.</p>
    <form id="profile-form" class="profile-form">
      <label class="profile-field"><span>Nom ou pseudo <strong>*</strong></span><input id="profile-name" name="name" type="text" maxlength="60" required placeholder="Ton nom ou ton pseudo"></label>
      <label class="profile-field"><span>Âge <strong>*</strong></span><input id="profile-age" name="age" type="number" min="10" max="120" required placeholder="Ex. 28"></label>
      <label class="profile-field profile-field--wide"><span>Sexe / genre <small>(facultatif)</small></span><select id="profile-gender" name="sex_or_gender"><option value="">— Je préfère ne pas préciser —</option><option value="woman">Femme</option><option value="man">Homme</option><option value="non_binary">Non-binaire</option><option value="intersex">Intersexe</option><option value="genderfluid">Genre fluide</option><option value="other">Autre / je préfère me définir</option><option value="prefer_not">Je préfère ne pas répondre</option></select></label>
      <label class="profile-field profile-field--wide" id="custom-gender-field" hidden><span>Comment souhaites-tu te définir ?</span><input id="profile-gender-custom" type="text" maxlength="60" placeholder="Libre"></label>
      <fieldset class="profile-field profile-field--wide pet-fieldset"><legend>As-tu un ou plusieurs animaux de compagnie ? <strong>*</strong></legend><div class="choice-row"><label><input type="radio" name="has_pets" value="yes" required> Oui</label><label><input type="radio" name="has_pets" value="no" required> Non</label></div><p>Ce choix peut activer deux bonus humoristiques sur la poussière et la vie du setup.</p></fieldset>
      <label class="profile-field profile-field--wide" id="pet-types-field" hidden><span>Quels compagnons ? <small>(facultatif)</small></span><input id="profile-pet-types" type="text" maxlength="100" placeholder="Chat, chien, lapin, oiseau…"></label>
      <div class="profile-actions profile-field--wide"><button class="secondary-button" id="profile-back" type="button">← Retour</button><button class="primary-button" type="submit">Commencer les 30 questions →</button></div>
    </form>`;
  elements.quiz.before(profile);
  elements.profile = profile;
  elements.profileForm = profile.querySelector('#profile-form');
  elements.profileName = profile.querySelector('#profile-name');
  elements.profileAge = profile.querySelector('#profile-age');
  elements.profileGender = profile.querySelector('#profile-gender');
  elements.customGenderField = profile.querySelector('#custom-gender-field');
  elements.profileGenderCustom = profile.querySelector('#profile-gender-custom');
  elements.petTypesField = profile.querySelector('#pet-types-field');
  elements.profilePetTypes = profile.querySelector('#profile-pet-types');

  elements.scoreRing.classList.add('score-ring--round');
  elements.scoreRing.setAttribute('aria-label', 'Points Rond');
  elements.scoreRing.querySelector('span').textContent = 'POINTS ROND';

  elements.resultSummary = document.createElement('p');
  elements.resultSummary.className = 'result-summary';
  elements.resultLevel.before(elements.resultSummary);

  elements.scoreBreakdown = document.createElement('div');
  elements.scoreBreakdown.className = 'score-breakdown';
  elements.scoreBreakdown.innerHTML = '<span>Questions : <strong id="base-points">0 / 60</strong></span><span>Bonus animaux : <strong id="bonus-points">+0 / 2</strong></span><span>Total : <strong id="total-points">0 / 62</strong></span>';
  elements.bonusResult.before(elements.scoreBreakdown);
  elements.basePoints = elements.scoreBreakdown.querySelector('#base-points');
  elements.bonusPoints = elements.scoreBreakdown.querySelector('#bonus-points');
  elements.totalPoints = elements.scoreBreakdown.querySelector('#total-points');

  const axisNote = document.createElement('p');
  axisNote.className = 'axis-note';
  axisNote.innerHTML = 'Chaque axe indique ta tendance <strong>Rond</strong> : plus le score monte, plus tu fonctionnes à l’instinct.';
  document.getElementById('axis-title').after(axisNote);
}

function showScreen(name) {
  const screens = { intro: elements.intro, profile: elements.profile, quiz: elements.quiz, result: elements.result };
  Object.entries(screens).forEach(([key, element]) => { element.hidden = key !== name; });
}

function openProfile() {
  showScreen('profile');
  elements.profileName.focus({ preventScroll: true });
}

function startQuiz() {
  state.current = 0;
  state.answers.clear();
  state.answerOrders.clear();
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
  if (!state.answerOrders.has(question.id)) state.answerOrders.set(question.id, randomizeAnswers(question.answers));
  const answerOrder = state.answerOrders.get(question.id);
  elements.answers.replaceChildren();
  answerOrder.forEach((answer, index) => {
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
  renderResult(calculateScores(quizData, state.answers, axisOrder, state.profile), state.profile.name || 'Joueur');
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

function renderResult(scores, displayName = 'Joueur') {
  const resultProfile = findRange(resultsData.profiles, scores.carre);
  lastResult = scores;
  elements.scoreRing.style.setProperty('--score', `${scores.rond}%`);
  elements.scoreValue.textContent = scores.totalPoints;
  elements.balanceCarre.textContent = `${scores.carre} %`;
  elements.balanceRond.textContent = `${scores.rond} %`;
  elements.resultSummary.textContent = `${displayName}, tu obtiens ${scores.totalPoints} points Rond sur ${scores.maxPoints}, soit ${scores.rond} % sur le gradient.`;
  elements.resultLevel.textContent = resultProfile.level;
  elements.resultName.textContent = resultProfile.name;
  elements.resultTagline.textContent = resultProfile.tagline;
  elements.resultDescription.textContent = resultProfile.description;
  elements.resultQuote.textContent = resultProfile.quote;
  elements.basePoints.textContent = `${scores.basePoints} / 60`;
  elements.bonusPoints.textContent = `+${scores.bonusPoints} / 2`;
  elements.totalPoints.textContent = `${scores.totalPoints} / ${scores.maxPoints}`;
  elements.bonusResult.replaceChildren();
  elements.bonusResult.hidden = scores.appliedBonuses.length === 0;
  scores.appliedBonuses.forEach((bonus) => {
    const item = document.createElement('div');
    item.className = 'bonus-pill';
    item.textContent = `🐾 ${bonus.label}`;
    elements.bonusResult.append(item);
  });
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
  url.searchParams.set('base', String(scores.basePoints));
  url.searchParams.set('bonus', String(scores.bonusPoints));
  axisOrder.forEach((axis) => url.searchParams.set(axis, String(scores.axes[axis])));
  return url.toString();
}

async function shareResult() {
  if (!lastResult) return;
  const profile = findRange(resultsData.profiles, lastResult.carre);
  const url = buildShareUrl(lastResult);
  const shareData = {
    title: 'Mon profil gamer Carré ou Rond',
    text: `J’ai ${lastResult.totalPoints}/${lastResult.maxPoints} points Rond (${lastResult.rond} %) : ${profile.name}.`,
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
  if (!params.has('points') || !params.has('max') || !params.has('base') || !params.has('bonus') || axisOrder.some((axis) => !params.has(axis))) return null;
  const baseMaximum = quizData.questions.length * 2;
  const totalPoints = Number(params.get('points'));
  const sharedMaximum = Number(params.get('max'));
  const basePoints = Number(params.get('base'));
  const bonusPoints = Number(params.get('bonus'));
  const axes = Object.fromEntries(axisOrder.map((axis) => [axis, Number(params.get(axis))]));
  if (![baseMaximum, baseMaximum + quizData.context_bonus_max_points].includes(sharedMaximum)
    || !Number.isFinite(totalPoints) || totalPoints < 0 || totalPoints > sharedMaximum) return null;
  if (!Number.isFinite(basePoints) || basePoints < 0 || basePoints > 60 || !Number.isFinite(bonusPoints) || bonusPoints < 0 || bonusPoints > 2 || basePoints + bonusPoints !== totalPoints) return null;
  if (Object.values(axes).some((score) => !Number.isFinite(score) || score < 0 || score > 100)) return null;
  const rond = Math.round((totalPoints / sharedMaximum) * 100);
  return { basePoints, bonusPoints, totalPoints, maxPoints: sharedMaximum, appliedBonuses: [], rond, carre: 100 - rond, axes };
}

function bindEvents() {
  elements.start.addEventListener('click', openProfile);
  elements.profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const petChoice = elements.profileForm.querySelector('input[name="has_pets"]:checked');
    if (!elements.profileForm.reportValidity() || !petChoice) return;
    const customGender = elements.profileGender.value === 'other' ? elements.profileGenderCustom.value.trim() : '';
    state.profile = {
      name: elements.profileName.value.trim(),
      age: Number(elements.profileAge.value),
      sex_or_gender: customGender || elements.profileGender.value,
      has_pets: petChoice.value === 'yes',
      pet_types: elements.profilePetTypes.value.trim(),
    };
    startQuiz();
  });
  document.getElementById('profile-back').addEventListener('click', () => showScreen('intro'));
  elements.profileGender.addEventListener('change', () => {
    elements.customGenderField.hidden = elements.profileGender.value !== 'other';
  });
  elements.profileForm.querySelectorAll('input[name="has_pets"]').forEach((input) => input.addEventListener('change', () => {
    elements.petTypesField.hidden = input.value !== 'yes' || !input.checked;
  }));
  elements.previous.addEventListener('click', movePrevious);
  elements.next.addEventListener('click', moveNext);
  elements.restart.addEventListener('click', openProfile);
  elements.share.addEventListener('click', shareResult);
  document.addEventListener('keydown', (event) => {
    if (elements.quiz.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    if (['1', '2', '3'].includes(event.key)) {
      const question = quizData.questions[state.current];
      const answerOrder = state.answerOrders.get(question.id) || randomizeAnswers(question.answers);
      if (!state.answerOrders.has(question.id)) state.answerOrders.set(question.id, answerOrder);
      selectAnswer(answerOrder[Number(event.key) - 1].id);
    } else if (event.key === 'ArrowLeft') {
      movePrevious();
    }
  });
}

async function init() {
  installScoreUi();
  bindEvents();
  try {
    const responses = await Promise.all([fetch('questions.json'), fetch('results.json'), fetch('context-bonuses.json')]);
    if (responses.some((response) => !response.ok)) throw new Error('Données V0.1 indisponibles');
    const [baseQuiz, resultProfiles, contextBonuses] = await Promise.all(responses.map((response) => response.json()));
    const patchesByQuestion = new Map(contextBonuses.patches.map((patch) => [patch.question_id, patch]));
    quizData = {
      ...baseQuiz,
      context_bonus_max_points: contextBonuses.maximum_points,
      questions: baseQuiz.questions.map((question) => ({
        ...question,
        context_bonuses: patchesByQuestion.get(question.id)?.context_bonuses || [],
      })),
    };
    resultsData = resultProfiles;
    elements.start.disabled = false;
    elements.start.textContent = 'Lancer les 30 questions →';
    const sharedResult = readSharedResult();
    if (sharedResult) renderResult(sharedResult, 'Joueur');
  } catch (error) {
    elements.start.textContent = 'Chargement impossible';
    elements.loadError.hidden = false;
    elements.loadError.textContent = 'Les 30 questions V0.1 n’ont pas pu être chargées.';
    console.error(error);
  }
}

init();
