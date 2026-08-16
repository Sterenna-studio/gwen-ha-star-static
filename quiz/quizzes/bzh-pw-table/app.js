const tableBody = document.getElementById('table-body');
const validateButton = document.getElementById('validate-button');
const result = document.getElementById('result-text');
let displayData = [];

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function render(players) {
  const names = players.map((player) => player.id).sort((a, b) => a.localeCompare(b, 'fr'));
  displayData = shuffle(players);
  tableBody.replaceChildren();

  displayData.forEach((player, index) => {
    const row = document.createElement('tr');
    const status = document.createElement('td');
    status.className = 'status-cell';
    status.id = `status-${index}`;
    status.textContent = '[ ]';

    const identity = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'cyber-select';
    select.id = `select-${index}`;
    select.dataset.correct = player.id;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '-- UNDEFINED --';
    select.append(placeholder);
    names.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.append(option);
    });
    identity.append(select);

    const values = [player.total, `${player.wr}%`, player.sr, player.aram].map((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      return cell;
    });
    values[1].style.color = 'var(--neon-green)';
    values[1].style.fontWeight = 'bold';
    row.append(status, identity, ...values);
    tableBody.append(row);
  });

  validateButton.disabled = false;
  validateButton.textContent = 'EXÉCUTER LA COMPARAISON HASH';
}

function validateTable() {
  let correctCount = 0;
  displayData.forEach((player, index) => {
    const select = document.getElementById(`select-${index}`);
    const status = document.getElementById(`status-${index}`);
    const correct = select.value === player.id;
    status.textContent = correct ? '[OK]' : '[ERR]';
    status.style.color = correct ? '#00ff66' : '#ff7777';
    if (correct) correctCount += 1;
  });

  result.style.display = 'block';
  if (correctCount === displayData.length) {
    result.className = 'result-msg success';
    result.textContent = 'SYSTÈME RESTAURÉ À 100 %. INTÉGRITÉ VÉRIFIÉE.';
    document.querySelectorAll('.cyber-select').forEach((select) => {
      select.disabled = true;
      select.style.borderColor = '#00ff66';
    });
  } else {
    result.className = 'result-msg error';
    result.textContent = `ANOMALIE DÉTECTÉE. MATCHING RÉUSSI : ${correctCount} / ${displayData.length}`;
  }
}

validateButton.addEventListener('click', validateTable);

fetch('../../data/players.json')
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => render(data.players))
  .catch((error) => {
    validateButton.textContent = 'DONNÉES INDISPONIBLES';
    result.style.display = 'block';
    result.className = 'result-msg error';
    result.textContent = 'IMPOSSIBLE DE CHARGER LA BASE JOUEURS.';
    console.error(error);
  });
