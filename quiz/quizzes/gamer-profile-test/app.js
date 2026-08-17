import { canvasToBlob, createResultImage, renderVisibleRadar } from './result-card.js';
import { buildResultInsight } from './result-insights.js';
import { calculateScores, findRange, randomizeAnswers } from './scoring.js';

const axisOrder = ['organisation', 'anticipation', 'maintenance', 'hygiene_numerique', 'setup'];
const axisShortLabels = {
  organisation: 'Organisation', anticipation: 'Anticipation', maintenance: 'Maintenance',
  hygiene_numerique: 'Hygiène num.', setup: 'Setup',
};

const elements = {
  intro: document.getElementById('intro-screen'), quiz: document.getElementById('quiz-screen'),
  result: document.getElementById('result-screen'), start: document.getElementById('start-button'),
  loadError: document.getElementById('load-error'), versionSelect: document.getElementById('version-select'),
  versionDescription: document.getElementById('version-description'), progressLabel: document.getElementById('progress-label'),
  progressPercent: document.getElementById('progress-percent'), progressTrack: document.querySelector('.progress-track'),
  progressFill: document.getElementById('progress-fill'), questionNumber: document.getElementById('question-number'),
  questionTitle: document.getElementById('question-title'), answers: document.getElementById('answers'),
  previous: document.getElementById('previous-button'), next: document.getElementById('next-button'),
  scoreRing: document.getElementById('score-ring'), scoreValue: document.getElementById('carre-score'),
  balanceCarre: document.getElementById('balance-carre'), balanceRond: document.getElementById('balance-rond'),
  resultLevel: document.getElementById('result-level'), resultName: document.getElementById('result-name'),
  resultTagline: document.getElementById('result-tagline'), resultDescription: document.getElementById('result-description'),
  resultQuote: document.getElementById('result-quote'), resultInsight: document.getElementById('result-insight'),
  bonusResult: document.getElementById('bonus-result'), axisGrid: document.getElementById('axis-grid'),
  radar: document.getElementById('result-radar'), share: document.getElementById('share-button'),
  download: document.getElementById('download-button'), restart: document.getElementById('restart-button'),
  shareStatus: document.getElementById('share-status'), shareLink: document.getElementById('share-link'),
  saveStatus: document.getElementById('save-status'),
};

let versionCatalog;
let currentVersion;
let quizData;
let resultsData;
let lastResult;
let lastPresentation;
const state = {
  current: 0, answers: new Map(), answerOrders: new Map(), resultId: null,
  profile: { name: '', age: null, sex_or_gender: '', has_pets: false, pet_types: '' },
};

function installScoreUi() {
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
      <p class="privacy-note profile-field--wide">Le pseudo, la version et les scores sont enregistrés pour les statistiques globales. L’âge exact, le genre et le nom des animaux ne quittent pas ton navigateur.</p>
      <div class="profile-actions profile-field--wide"><button class="secondary-button" id="profile-back" type="button">← Retour</button><button class="primary-button" id="profile-submit" type="submit">Commencer →</button></div>
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
  elements.profileSubmit = profile.querySelector('#profile-submit');

  elements.scoreRing.classList.add('score-ring--round');
  elements.scoreRing.setAttribute('aria-label', 'Points Rond');
  elements.scoreRing.querySelector('span').textContent = 'POINTS ROND';

  elements.resultSummary = document.createElement('p');
  elements.resultSummary.className = 'result-summary';
  elements.resultLevel.before(elements.resultSummary);
  elements.scoreBreakdown = document.createElement('div');
  elements.scoreBreakdown.className = 'score-breakdown';
  elements.scoreBreakdown.innerHTML = '<span>Questions : <strong id="base-points">0</strong></span><span>Bonus animaux : <strong id="bonus-points">0</strong></span><span>Total : <strong id="total-points">0</strong></span>';
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

function getAxes() {
  return axisOrder.map((id) => ({ ...quizData.axes.find((item) => item.id === id), shortLabel: axisShortLabels[id] }));
}

function getResultProfile(scores) {
  const score = currentVersion.profile_scale === 'round_points' ? scores.totalPoints : scores.carre;
  return findRange(resultsData.profiles, score);
}

function updateVersionUi() {
  const baseMaximum = currentVersion.question_count * 2;
  const maxMaximum = baseMaximum + (quizData.context_bonus_max_points || 0);
  document.querySelector('.intro-facts').innerHTML = `<span>${currentVersion.question_count} questions V${currentVersion.id}</span><span>5 axes</span><span>${currentVersion.duration}</span><span>${maxMaximum} points max.</span>`;
  elements.versionDescription.textContent = `${currentVersion.description}${currentVersion.recommended ? ' · Version recommandée.' : ''}`;
  elements.profileSubmit.textContent = `Commencer les ${currentVersion.question_count} questions →`;
  elements.start.textContent = `Lancer la V${currentVersion.id} →`;
  elements.start.disabled = false;
}

function openProfile() {
  showScreen('profile');
  elements.profileName.focus({ preventScroll: true });
}

function startQuiz() {
  state.current = 0;
  state.answers.clear();
  state.answerOrders.clear();
  state.resultId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('version', currentVersion.id);
  history.replaceState({}, '', url);
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
  elements.questionNumber.textContent = `Question ${String(position).padStart(2, '0')} · V${currentVersion.id}`;
  elements.questionTitle.textContent = question.title;
  elements.previous.disabled = state.current === 0;
  elements.next.disabled = !state.answers.has(question.id);
  elements.next.textContent = position === quizData.questions.length ? 'Voir mon score →' : 'Suivante →';
  renderAnswers(question);
  elements.questionTitle.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function movePrevious() { if (state.current > 0) { state.current -= 1; renderQuestion(); } }

function moveNext() {
  if (!state.answers.has(quizData.questions[state.current].id)) return;
  if (state.current < quizData.questions.length - 1) { state.current += 1; renderQuestion(); return; }
  renderResult(calculateScores(quizData, state.answers, axisOrder, state.profile), state.profile.name || 'Joueur', { save: true });
}

function renderAxisCards(scores) {
  elements.axisGrid.replaceChildren();
  getAxes().forEach((axis) => {
    const roundScore = scores.axes[axis.id];
    const profile = findRange(resultsData.subprofiles[axis.id], 100 - roundScore);
    const card = document.createElement('article');
    card.className = 'axis-card';
    card.innerHTML = `<div class="axis-head"><span>${axis.label}</span><span>${roundScore} % Rond</span></div><div class="axis-bar" aria-hidden="true"><span></span></div><p class="axis-profile"></p>`;
    card.querySelector('.axis-bar span').style.width = `${roundScore}%`;
    card.querySelector('.axis-profile').textContent = `${profile.name} — ${profile.description}`;
    elements.axisGrid.append(card);
  });
}

function renderResult(scores, displayName = 'Joueur', options = {}) {
  const resultProfile = getResultProfile(scores);
  const insight = buildResultInsight(scores, getAxes(), resultProfile);
  lastResult = scores;
  lastPresentation = { displayName, resultProfile, insight };
  elements.scoreRing.style.setProperty('--score', `${scores.rond}%`);
  elements.scoreValue.textContent = scores.totalPoints;
  elements.balanceCarre.textContent = `${scores.carre} %`;
  elements.balanceRond.textContent = `${scores.rond} %`;
  elements.resultSummary.textContent = `${displayName}, tu obtiens ${scores.totalPoints} points Rond sur ${scores.maxPoints}, soit ${scores.rond} % sur le gradient.`;
  elements.resultLevel.textContent = `${resultProfile.level} · V${currentVersion.id}`;
  elements.resultName.textContent = resultProfile.name;
  elements.resultTagline.textContent = resultProfile.tagline;
  elements.resultDescription.textContent = resultProfile.description;
  elements.resultQuote.textContent = resultProfile.quote;
  elements.resultInsight.textContent = insight.text;
  elements.basePoints.textContent = `${scores.basePoints} / ${quizData.questions.length * 2}`;
  elements.bonusPoints.textContent = `+${scores.bonusPoints} / ${quizData.context_bonus_max_points || 0}`;
  elements.totalPoints.textContent = `${scores.totalPoints} / ${scores.maxPoints}`;
  elements.bonusResult.replaceChildren();
  elements.bonusResult.hidden = scores.appliedBonuses.length === 0;
  scores.appliedBonuses.forEach((bonus) => {
    const item = document.createElement('div'); item.className = 'bonus-pill'; item.textContent = `🐾 ${bonus.label}`; elements.bonusResult.append(item);
  });
  elements.shareStatus.textContent = '';
  elements.shareLink.hidden = true;
  elements.saveStatus.textContent = options.save ? 'Enregistrement pseudonymisé du résultat…' : 'Résultat partagé : aucune nouvelle réponse enregistrée.';
  elements.saveStatus.dataset.state = options.save ? 'saving' : 'shared';
  renderVisibleRadar(elements.radar, getAxes(), scores.axes);
  renderAxisCards(scores);
  showScreen('result');
  elements.resultName.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (options.save) saveResult(scores, resultProfile);
}

function buildShareUrl(scores) {
  const url = new URL(location.href); url.search = '';
  url.searchParams.set('version', currentVersion.id); url.searchParams.set('points', String(scores.totalPoints));
  url.searchParams.set('max', String(scores.maxPoints)); url.searchParams.set('base', String(scores.basePoints));
  url.searchParams.set('bonus', String(scores.bonusPoints));
  axisOrder.forEach((axis) => url.searchParams.set(axis, String(scores.axes[axis])));
  return url.toString();
}

function imageFileName() {
  const safeName = lastPresentation.displayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'joueur';
  return `profil-gamer-${safeName}-v${currentVersion.id}.png`;
}

async function makeResultFile() {
  const canvas = createResultImage({ ...lastPresentation, versionLabel: `V${currentVersion.id}`, scores: lastResult, axes: getAxes() });
  return new File([await canvasToBlob(canvas)], imageFileName(), { type: 'image/png' });
}

function downloadFile(file) {
  const link = document.createElement('a'); const objectUrl = URL.createObjectURL(file);
  link.href = objectUrl; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function shareResult() {
  if (!lastResult) return;
  try {
    const file = await makeResultFile();
    const shareData = { title: 'Mon profil gamer Carré ou Rond', text: `${lastPresentation.displayName} est ${lastPresentation.resultProfile.level} : ${lastPresentation.resultProfile.name}.`, files: [file] };
    if (navigator.share && navigator.canShare?.(shareData)) { await navigator.share(shareData); elements.shareStatus.textContent = 'Image partagée.'; return; }
    downloadFile(file);
    elements.shareStatus.textContent = 'Le partage direct d’image n’est pas disponible ici : le PNG a été téléchargé.';
  } catch (error) {
    if (error.name === 'AbortError') return;
    elements.shareLink.value = buildShareUrl(lastResult); elements.shareLink.hidden = false; elements.shareLink.select();
    elements.shareStatus.textContent = 'Création de l’image impossible. Tu peux copier ce lien de résultat.';
  }
}

async function downloadResult() {
  if (!lastResult) return;
  try { downloadFile(await makeResultFile()); elements.shareStatus.textContent = 'Image PNG téléchargée.'; }
  catch (error) { elements.shareStatus.textContent = 'Le navigateur n’a pas pu créer le PNG.'; console.error(error); }
}

async function saveResult(scores, resultProfile) {
  const payload = {
    client_result_id: state.resultId, quiz_id: 'gamer-profile-test', quiz_version: currentVersion.id,
    pseudonym: state.profile.name.slice(0, 60), global_level: resultProfile.level, global_profile: resultProfile.name,
    total_points: scores.totalPoints, max_points: scores.maxPoints, rond_percent: scores.rond,
    carre_percent: scores.carre, axis_scores: scores.axes, bonus_points: scores.bonusPoints,
    has_pets: state.profile.has_pets,
  };
  try {
    const { supabase } = await import('../../../shared/supabase-client.js');
    const { error } = await supabase.from('quiz_results').insert(payload);
    if (error) throw error;
    elements.saveStatus.textContent = 'Résultat enregistré pour les statistiques globales.'; elements.saveStatus.dataset.state = 'saved';
  } catch (error) {
    elements.saveStatus.textContent = 'Résultat affiché, mais la sauvegarde serveur est momentanément indisponible.'; elements.saveStatus.dataset.state = 'error';
    console.warn('[quiz-results] save failed:', error?.message || error);
  }
}

function readSharedResult() {
  const params = new URLSearchParams(location.search);
  if (!params.has('points') || !params.has('max') || !params.has('base') || !params.has('bonus') || axisOrder.some((axis) => !params.has(axis))) return null;
  const baseMaximum = quizData.questions.length * 2;
  const totalPoints = Number(params.get('points')); const sharedMaximum = Number(params.get('max'));
  const basePoints = Number(params.get('base')); const bonusPoints = Number(params.get('bonus'));
  const axes = Object.fromEntries(axisOrder.map((axis) => [axis, Number(params.get(axis))]));
  if (![baseMaximum, baseMaximum + quizData.context_bonus_max_points].includes(sharedMaximum) || !Number.isFinite(totalPoints) || totalPoints < 0 || totalPoints > sharedMaximum) return null;
  if (!Number.isFinite(basePoints) || basePoints < 0 || basePoints > baseMaximum || !Number.isFinite(bonusPoints) || bonusPoints < 0 || bonusPoints > quizData.context_bonus_max_points || basePoints + bonusPoints !== totalPoints) return null;
  if (Object.values(axes).some((score) => !Number.isFinite(score) || score < 0 || score > 100)) return null;
  const rond = Math.round((totalPoints / sharedMaximum) * 100);
  return { basePoints, bonusPoints, totalPoints, maxPoints: sharedMaximum, appliedBonuses: [], rond, carre: 100 - rond, axes };
}

function applyContextPatches(baseQuiz, patches) {
  const patchesByQuestion = new Map(patches.map((patch) => [patch.question_id, patch]));
  return baseQuiz.questions.map((question) => ({ ...question, context_bonuses: patchesByQuestion.get(question.id)?.context_bonuses || [] }));
}

async function loadVersion(versionId) {
  elements.start.disabled = true; elements.start.textContent = 'Chargement…'; elements.loadError.hidden = true;
  const version = versionCatalog.versions.find((item) => item.id === versionId) || versionCatalog.versions.find((item) => item.id === versionCatalog.default_version);
  const [baseQuizResponse, baseResultsResponse] = await Promise.all([fetch('questions.json'), fetch('results.json')]);
  if (!baseQuizResponse.ok || !baseResultsResponse.ok) throw new Error('Données de base indisponibles');
  const [baseQuiz, baseResults] = await Promise.all([baseQuizResponse.json(), baseResultsResponse.json()]);
  if (version.id === '0.2') {
    const responses = await Promise.all([fetch('v0.2/questions-additions.json'), fetch('v0.2/question-patches.json'), fetch('v0.2/results.json')]);
    if (responses.some((response) => !response.ok)) throw new Error('Données V0.2 indisponibles');
    const [additions, contextBonuses, versionResults] = await Promise.all(responses.map((response) => response.json()));
    const mergedQuiz = { ...baseQuiz, questions: [...baseQuiz.questions, ...additions.questions] };
    quizData = { ...mergedQuiz, context_bonus_max_points: 2, questions: applyContextPatches(mergedQuiz, contextBonuses.patches) };
    resultsData = { ...versionResults, subprofiles: baseResults.subprofiles };
  } else {
    const contextResponse = await fetch('context-bonuses.json');
    if (!contextResponse.ok) throw new Error('Bonus V0.1 indisponibles');
    const contextBonuses = await contextResponse.json();
    quizData = { ...baseQuiz, context_bonus_max_points: contextBonuses.maximum_points, questions: applyContextPatches(baseQuiz, contextBonuses.patches) };
    resultsData = baseResults;
  }
  currentVersion = version; elements.versionSelect.value = version.id; updateVersionUi();
}

function bindEvents() {
  elements.start.addEventListener('click', openProfile);
  elements.versionSelect.addEventListener('change', async () => {
    try {
      await loadVersion(elements.versionSelect.value);
      const url = new URL(location.href); url.search = ''; url.searchParams.set('version', currentVersion.id); history.replaceState({}, '', url);
    } catch (error) { elements.loadError.hidden = false; elements.loadError.textContent = 'Cette version ne peut pas être chargée.'; console.error(error); }
  });
  elements.profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const petChoice = elements.profileForm.querySelector('input[name="has_pets"]:checked');
    if (!elements.profileForm.reportValidity() || !petChoice) return;
    const customGender = elements.profileGender.value === 'other' ? elements.profileGenderCustom.value.trim() : '';
    state.profile = { name: elements.profileName.value.trim(), age: Number(elements.profileAge.value), sex_or_gender: customGender || elements.profileGender.value, has_pets: petChoice.value === 'yes', pet_types: elements.profilePetTypes.value.trim() };
    startQuiz();
  });
  document.getElementById('profile-back').addEventListener('click', () => showScreen('intro'));
  elements.profileGender.addEventListener('change', () => { elements.customGenderField.hidden = elements.profileGender.value !== 'other'; });
  elements.profileForm.querySelectorAll('input[name="has_pets"]').forEach((input) => input.addEventListener('change', () => { elements.petTypesField.hidden = input.value !== 'yes' || !input.checked; }));
  elements.previous.addEventListener('click', movePrevious); elements.next.addEventListener('click', moveNext);
  elements.restart.addEventListener('click', openProfile); elements.share.addEventListener('click', shareResult); elements.download.addEventListener('click', downloadResult);
  document.addEventListener('keydown', (event) => {
    if (elements.quiz.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    if (['1', '2', '3'].includes(event.key)) {
      const question = quizData.questions[state.current]; const answerOrder = state.answerOrders.get(question.id) || randomizeAnswers(question.answers);
      if (!state.answerOrders.has(question.id)) state.answerOrders.set(question.id, answerOrder);
      selectAnswer(answerOrder[Number(event.key) - 1].id);
    } else if (event.key === 'ArrowLeft') movePrevious();
  });
}

async function init() {
  installScoreUi(); bindEvents();
  try {
    const catalogResponse = await fetch('versions.json');
    if (!catalogResponse.ok) throw new Error('Catalogue de versions indisponible');
    versionCatalog = await catalogResponse.json();
    elements.versionSelect.replaceChildren(...versionCatalog.versions.map((version) => {
      const option = document.createElement('option'); option.value = version.id; option.textContent = `${version.label}${version.recommended ? ' — recommandée' : ''}`; return option;
    }));
    elements.versionSelect.disabled = false;
    const requestedVersion = new URLSearchParams(location.search).get('version') || versionCatalog.default_version;
    await loadVersion(requestedVersion);
    const sharedResult = readSharedResult(); if (sharedResult) renderResult(sharedResult, 'Joueur', { save: false });
  } catch (error) {
    elements.start.textContent = 'Chargement impossible'; elements.loadError.hidden = false;
    elements.loadError.textContent = 'Les données du test n’ont pas pu être chargées.'; console.error(error);
  }
}

init();
