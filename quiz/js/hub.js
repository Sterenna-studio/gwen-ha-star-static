const sectionsContainer = document.getElementById('quiz-sections');
const search = document.getElementById('quiz-search');
const themeFilter = document.getElementById('theme-filter');
const moduleCount = document.getElementById('module-count');
const resultCount = document.getElementById('result-count');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');

let quizzes = [];

const PLAYER_DATA_SOURCE = 'data/players.json';
const collections = [
  {
    id: 'player-data',
    title: 'Quiz liés aux joueurs',
    description: 'Expériences alimentées par la base joueurs partagée : statistiques, champions et profils de la team.',
    matches: (quiz) => quiz.data_sources?.includes(PLAYER_DATA_SOURCE),
  },
  {
    id: 'other',
    title: 'Tous les autres quiz',
    description: 'Tests de profil, connaissances League of Legends et autres formats indépendants de la base joueurs.',
    matches: (quiz) => !quiz.data_sources?.includes(PLAYER_DATA_SOURCE),
  },
];

function createMeta(text, className = '') {
  const item = document.createElement('span');
  item.className = className;
  item.textContent = text;
  return item;
}

function createCard(quiz) {
  const card = document.createElement('article');
  card.className = 'quiz-card';
  card.style.setProperty('--card-accent', quiz.accent || '#72e7ef');

  const meta = document.createElement('div');
  meta.className = 'quiz-card-meta';
  meta.append(createMeta(quiz.theme, 'theme'));
  if (quiz.duration) meta.append(createMeta(quiz.duration));
  if (quiz.question_count) meta.append(createMeta(`${quiz.question_count} questions`));
  if (quiz.pool_size) meta.append(createMeta(`pool de ${quiz.pool_size}`));
  if (quiz.data_sources?.includes(PLAYER_DATA_SOURCE)) meta.append(createMeta('Données joueurs', 'data-source'));

  const title = document.createElement('h3');
  title.textContent = quiz.title;
  const description = document.createElement('p');
  description.textContent = quiz.description;
  const link = document.createElement('a');
  link.href = quiz.path;
  link.innerHTML = '<span>Lancer le quizz</span><span aria-hidden="true">→</span>';
  link.setAttribute('aria-label', `Lancer : ${quiz.title}`);

  card.append(meta, title, description, link);
  return card;
}

function createCollection(collection, items) {
  const section = document.createElement('section');
  section.className = 'catalog-group';
  section.setAttribute('aria-labelledby', `${collection.id}-title`);

  const heading = document.createElement('div');
  heading.className = 'catalog-group-heading';
  const copy = document.createElement('div');
  const title = document.createElement('h3');
  title.id = `${collection.id}-title`;
  title.textContent = collection.title;
  const description = document.createElement('p');
  description.textContent = collection.description;
  const count = createMeta(`${items.length} quiz${items.length > 1 ? 'z' : ''}`, 'catalog-group-count');
  copy.append(title, description);
  heading.append(copy, count);

  const grid = document.createElement('div');
  grid.className = 'quiz-grid';
  grid.replaceChildren(...items.map(createCard));
  section.append(heading, grid);
  return section;
}

function render() {
  const query = search.value.trim().toLocaleLowerCase('fr');
  const theme = themeFilter.value;
  const filtered = quizzes.filter((quiz) => {
    const haystack = `${quiz.title} ${quiz.description} ${quiz.theme}`.toLocaleLowerCase('fr');
    return (!query || haystack.includes(query)) && (!theme || quiz.theme === theme);
  });

  const renderedCollections = collections
    .map((collection) => ({ collection, items: filtered.filter(collection.matches) }))
    .filter(({ items }) => items.length > 0)
    .map(({ collection, items }) => createCollection(collection, items));

  sectionsContainer.replaceChildren(...renderedCollections);
  sectionsContainer.setAttribute('aria-busy', 'false');
  emptyState.hidden = filtered.length !== 0;
  resultCount.textContent = `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`;
}

async function init() {
  try {
    const response = await fetch('data/quizzes.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    quizzes = await response.json();
    const themes = [...new Set(quizzes.map((quiz) => quiz.theme))].sort((a, b) => a.localeCompare(b, 'fr'));
    themes.forEach((theme) => {
      const option = document.createElement('option');
      option.value = theme;
      option.textContent = theme;
      themeFilter.append(option);
    });
    moduleCount.textContent = `${quizzes.length} modules jouables`;
    render();
  } catch (error) {
    sectionsContainer.replaceChildren();
    sectionsContainer.setAttribute('aria-busy', 'false');
    moduleCount.textContent = 'Catalogue indisponible';
    errorState.hidden = false;
    console.error(error);
  }
}

search.addEventListener('input', render);
themeFilter.addEventListener('change', render);
init();
