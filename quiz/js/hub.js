const grid = document.getElementById('quiz-grid');
const search = document.getElementById('quiz-search');
const themeFilter = document.getElementById('theme-filter');
const moduleCount = document.getElementById('module-count');
const resultCount = document.getElementById('result-count');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');

let quizzes = [];

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

function render() {
  const query = search.value.trim().toLocaleLowerCase('fr');
  const theme = themeFilter.value;
  const filtered = quizzes.filter((quiz) => {
    const haystack = `${quiz.title} ${quiz.description} ${quiz.theme}`.toLocaleLowerCase('fr');
    return (!query || haystack.includes(query)) && (!theme || quiz.theme === theme);
  });

  grid.replaceChildren(...filtered.map(createCard));
  grid.setAttribute('aria-busy', 'false');
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
    grid.replaceChildren();
    grid.setAttribute('aria-busy', 'false');
    moduleCount.textContent = 'Catalogue indisponible';
    errorState.hidden = false;
    console.error(error);
  }
}

search.addEventListener('input', render);
themeFilter.addEventListener('change', render);
init();
