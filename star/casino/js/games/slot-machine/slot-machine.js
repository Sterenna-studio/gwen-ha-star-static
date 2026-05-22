import { ArcadeSFX as SFX } from '../../arcade-sfx.js';
import { sleep, weightedPick } from '../../arcade-utils.js';

const ROWS = 3;
const COLS = 5;
const LINES = [
  { id:'mid', name:'MILIEU', rows:[1,1,1,1,1], mult:1.0, color:'#00ff80' },
  { id:'top', name:'HAUT', rows:[0,0,0,0,0], mult:.55, color:'#60a5fa' },
  { id:'bot', name:'BAS', rows:[2,2,2,2,2], mult:.55, color:'#f97316' },
  { id:'d1', name:'DIAG ↘', rows:[0,0,1,2,2], mult:.75, color:'#f472b6' },
  { id:'d2', name:'DIAG ↗', rows:[2,2,1,0,0], mult:.75, color:'#c084fc' },
];
const SYMBOLS = [
  { id:'coin',   name:'COIN',   emoji:'🪙', weight:34, pay:{3:.35, 4:.9,  5:2.5} },
  { id:'leaf',   name:'LEAF',   emoji:'🍃', weight:26, pay:{3:.45, 4:1.2, 5:4} },
  { id:'spirit', name:'SPIRIT', img:'/shared/images/pixel_pp/pixel_pp_spirit.png', weight:18, pay:{3:.7, 4:2.2, 5:7} },
  { id:'abad',   name:'ABAD',   img:'/shared/images/pixel_pp/pixel_pp_abad.png',   weight:11, pay:{3:1.1, 4:4,   5:14} },
  { id:'cowboy', name:'COWBOY', img:'/shared/images/pixel_pp/pixel_pp_cowboy.png', weight:7,  pay:{3:1.7, 4:7,   5:24} },
  { id:'aligax', name:'ALIGAX', img:'/shared/images/pixel_pp/pixel_pp_aligax.png', weight:3,  pay:{3:3.5, 4:18,  5:70} },
  { id:'sniky',  name:'SNIKY',  img:'/shared/images/pixel_pp/pixel_pp_sniky.png',  weight:3,  pay:{3:3.5, 4:18,  5:70} },
  { id:'star',   name:'STAR',   emoji:'⭐', weight:2, pay:{3:6, 4:35, 5:140} },
];

export class SlotMachineGame {
  constructor({ mountId, getBet, debit, credit, addHistory, backToLobby }) {
    this.mountId = mountId;
    this.getBet = getBet;
    this.debit = debit;
    this.credit = credit;
    this.addHistory = addHistory;
    this.backToLobby = backToLobby;
    this.spinning = false;
    this.stats = { spins: 0, wagered: 0, paid: 0 };
  }

  mount() {
    const game = document.getElementById(this.mountId);
    if (!game) return;
    game.innerHTML = `${this.header('SLOT', 'MACHINE')}
      <div class="sl-machine" style="background:var(--c-surface);border:1px solid rgba(255,204,0,.25);border-radius:20px;padding:20px;box-shadow:inset 0 0 50px rgba(0,0,0,.35)">
        <div class="sl-scoreboard" style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:14px">
          <div class="sl-score-block"><span class="sl-score-lbl">GAIN</span><span class="sl-score-val sl-score-gain" id="sl-gain">—</span></div>
          <div class="sl-score-block"><span class="sl-score-lbl">LIGNES</span><span class="sl-score-val" style="color:var(--c-cyan)">5</span></div>
          <div class="sl-score-block"><span class="sl-score-lbl">RÈGLE</span><span class="sl-score-val" style="font-size:.9rem;color:var(--c-text-muted)">3+ gauche → droite</span></div>
        </div>
        <div id="slot-grid" style="display:grid;grid-template-columns:repeat(5,minmax(56px,1fr));gap:10px;max-width:620px;margin:0 auto 14px"></div>
        <div id="slot-lines" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px"></div>
        <div id="slot-breakdown" style="min-height:34px;text-align:center;font-size:10px;letter-spacing:.08em;color:var(--c-text-muted);line-height:1.7"></div>
        <div class="sl-msg" id="sl-msg">MISE TOTALE · 5 LIGNES ACTIVES · RTP ALPHA ~90%</div>
        <div class="action-row"><button class="action-btn primary" id="sl-spin">🎰 LANCER</button></div>
      </div>`;
    document.getElementById('game-back')?.addEventListener('click', () => this.backToLobby());
    document.getElementById('sl-spin')?.addEventListener('click', () => this.spin());
    this.renderGrid(this.randomGrid());
    this.renderLineLegend();
  }

  header(title, accent = '') {
    return `<div class="game-header">
      <button class="game-back-btn" id="game-back">← LOBBY</button>
      <span class="game-title">${title} ${accent ? `<span class="game-title-accent">${accent}</span>` : ''}</span>
    </div>`;
  }

  renderLineLegend(activeIds = []) {
    const wrap = document.getElementById('slot-lines');
    if (!wrap) return;
    wrap.innerHTML = LINES.map(line => `<span style="border:1px solid ${line.color};color:${line.color};border-radius:999px;padding:3px 9px;font-size:8px;letter-spacing:.12em;background:${activeIds.includes(line.id) ? 'rgba(255,255,255,.08)' : 'transparent'}">${line.name} ×${line.mult}</span>`).join('');
  }

  renderGrid(grid, wins = []) {
    const root = document.getElementById('slot-grid');
    if (!root) return;
    const winCells = new Set();
    wins.forEach(win => {
      for (let c = 0; c < win.count; c++) winCells.add(`${win.line.rows[c]}-${c}`);
    });
    root.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const sym = grid[r][c];
        const active = winCells.has(`${r}-${c}`);
        const cell = document.createElement('div');
        cell.style.cssText = `min-height:78px;border-radius:14px;border:1px solid ${active ? '#00ff80' : 'rgba(255,255,255,.08)'};background:${active ? 'rgba(0,255,128,.08)' : 'rgba(255,255,255,.025)'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;box-shadow:${active ? '0 0 18px rgba(0,255,128,.35)' : 'inset 0 0 20px rgba(0,0,0,.35)'};transition:all .18s`;
        cell.innerHTML = this.symbolHTML(sym);
        root.appendChild(cell);
      }
    }
  }

  async spin() {
    if (this.spinning) return;
    const bet = this.getBet();
    if (!(await this.debit(bet))) return this.setMsg('CRÉDITS INSUFFISANTS', 'lose');
    this.spinning = true;
    const btn = document.getElementById('sl-spin');
    if (btn) btn.disabled = true;
    document.getElementById('slot-breakdown').textContent = '';
    document.getElementById('sl-gain').textContent = '—';
    this.setMsg('LES ROULEAUX TOURNENT…', 'neutral');

    let grid = this.randomGrid();
    for (let t = 0; t < 20; t++) {
      grid = this.randomGrid();
      this.renderGrid(grid);
      SFX.tick();
      await sleep(48 + t * 5);
    }

    grid = this.randomGrid();
    const { wins, gain } = this.evaluate(grid, bet);
    this.renderGrid(grid, wins);
    this.renderLineLegend(wins.map(w => w.line.id));

    if (gain > 0) await this.credit(gain);
    const net = gain - bet;
    const status = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
    document.getElementById('sl-gain').textContent = gain > 0 ? `+${gain}` : '—';
    document.getElementById('slot-breakdown').innerHTML = wins.length
      ? wins.map(w => `<span style="color:${w.line.color}">${w.line.name}</span> · ${w.count}× ${w.symbol.name} · +${w.gain} C`).join('<br>')
      : 'Aucune ligne gagnante.';
    this.setMsg(wins.length ? `${wins.length} ligne${wins.length > 1 ? 's' : ''} · ${net >= 0 ? '+' : ''}${net} C` : `PERDU · -${bet} C`, status);
    this.addHistory('SLOTS', bet, status, net);
    this.stats.spins += 1;
    this.stats.wagered += bet;
    this.stats.paid += gain;
    if (wins.some(w => w.symbol.id === 'star' && w.count >= 5)) SFX.jackpot();
    else status === 'win' ? SFX.win() : SFX.lose();
    this.spinning = false;
    if (btn) btn.disabled = false;
  }

  randomGrid() {
    return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => weightedPick(SYMBOLS)));
  }

  evaluate(grid, bet) {
    const wins = [];
    for (const line of LINES) {
      const first = grid[line.rows[0]][0];
      let count = 1;
      for (let c = 1; c < COLS; c++) {
        const sym = grid[line.rows[c]][c];
        if (sym.id === first.id) count += 1;
        else break;
      }
      if (count >= 3) {
        const rawMult = first.pay[count] ?? 0;
        const gain = Math.max(1, Math.round(bet * rawMult * line.mult));
        wins.push({ line, symbol: first, count, gain });
      }
    }
    return { wins, gain: wins.reduce((sum, win) => sum + win.gain, 0) };
  }

  symbolHTML(sym) {
    const label = `<span style="font-size:9px;letter-spacing:.08em;color:var(--c-text-muted)">${sym.name}</span>`;
    if (sym.emoji) return `<span style="font-size:34px;line-height:1">${sym.emoji}</span>${label}`;
    return `<img src="${sym.img}" alt="${sym.name}" width="42" height="42" loading="lazy" onerror="this.style.opacity=.12">${label}`;
  }

  stop() {
    this.spinning = false;
  }

  setMsg(text, type = '') {
    const node = document.getElementById('sl-msg');
    if (!node) return;
    node.textContent = text;
    node.className = 'sl-msg' + (type ? ` sl-msg--${type}` : '');
  }
}
