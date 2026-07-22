import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// widget-slot-machine.js importe ../supabase.js, qui remonte jusqu'à un
// import réseau https://esm.sh/... pensé pour le navigateur. On l'intercepte
// avant de charger le module testé (voir probe-radio-site.test.js).
mock.module('../js/supabase.js', { exports: { supabase: {} } });
const { SlotMachine } = await import('../js/star/widget-slot-machine.js');

// Instancie sans passer par le constructeur (qui touche le DOM via
// document.getElementById) : Object.create garde l'accès aux vraies méthodes
// du prototype tout en laissant tester leur logique isolément.
function makeFake(overrides = {}) {
  return Object.assign(Object.create(SlotMachine.prototype), overrides);
}

test('_buildPool : chaque symbole apparaît "rare" fois', () => {
  const fake = makeFake();
  const pool = fake._buildPool();
  const totalRare = SlotMachine.SYMBOLS.reduce((sum, s) => sum + s.rare, 0);
  assert.strictEqual(pool.length, totalRare);
  for (const sym of SlotMachine.SYMBOLS) {
    const count = pool.filter(p => p.id === sym.id).length;
    assert.strictEqual(count, sym.rare, `symbole ${sym.id}`);
  }
});

test('_roll : pioche dans le pool selon Math.random', (t) => {
  const fake = makeFake({ _pool: SlotMachine.SYMBOLS });
  t.mock.method(Math, 'random', () => 0);
  assert.strictEqual(fake._roll(), SlotMachine.SYMBOLS[0]);
  t.mock.method(Math, 'random', () => 0.999999);
  assert.strictEqual(fake._roll(), SlotMachine.SYMBOLS.at(-1));
});

test('_buildReel : construit REEL_LEN symboles via _roll', (t) => {
  const fake = makeFake({ _pool: SlotMachine.SYMBOLS });
  t.mock.method(Math, 'random', () => 0);
  const reel = fake._buildReel();
  assert.strictEqual(reel.length, SlotMachine.REEL_LEN);
  assert.ok(reel.every(s => s === SlotMachine.SYMBOLS[0]));
});

test('_getSymAt : lit la bonne case, y compris avec repli négatif (modulo)', () => {
  const reel = Array.from({ length: SlotMachine.REEL_LEN }, (_, i) => i);
  const fake = makeFake({ _reels: [reel], _reelPos: [0] });

  assert.strictEqual(fake._getSymAt(0, 0), SlotMachine.ACTIVE_ROW);
  assert.strictEqual(fake._getSymAt(0, -SlotMachine.ACTIVE_ROW), 0);

  // Repli au-delà du début de bande → doit boucler en fin de bande.
  const wrapped = (SlotMachine.ACTIVE_ROW - 5 + SlotMachine.REEL_LEN) % SlotMachine.REEL_LEN;
  assert.strictEqual(fake._getSymAt(0, -5), wrapped);
});

test('_evaluateLines : ligne MILIEU gagnante, isolée des autres lignes', () => {
  assert.strictEqual(SlotMachine.SYMBOLS.length, SlotMachine.COLS,
    'ce test suppose autant de symboles que de colonnes pour garantir des bandes distinctes par colonne');

  const winningSymbol = SlotMachine.SYMBOLS[0];
  const reels = Array.from({ length: SlotMachine.COLS }, (_, col) => {
    // Bande de remplissage UNIQUE par colonne (symbole `col`) : garantit que
    // toute ligne autre que MILIEU lira des valeurs différentes par colonne,
    // donc ne peut jamais matcher par accident.
    const filler = SlotMachine.SYMBOLS[col % SlotMachine.SYMBOLS.length];
    const reel = Array(SlotMachine.REEL_LEN).fill(filler);
    reel[SlotMachine.ACTIVE_ROW] = winningSymbol;
    return reel;
  });

  const fake = makeFake({ _reels: reels, _reelPos: Array(SlotMachine.COLS).fill(0), bet: 10 });
  const wins = fake._evaluateLines();

  assert.strictEqual(wins.length, 1);
  const [win] = wins;
  assert.strictEqual(win.line.id, 'L0');
  assert.strictEqual(win.sym.id, winningSymbol.id);
  assert.strictEqual(win.gain, Math.round(10 * winningSymbol.mult * win.line.mult));
});

test('_evaluateLines : aucune ligne gagnante si chaque colonne a un symbole distinct', () => {
  assert.strictEqual(SlotMachine.SYMBOLS.length, SlotMachine.COLS,
    'ce test suppose autant de symboles que de colonnes pour garantir des bandes distinctes par colonne');

  // Chaque colonne est une bande uniforme d'un symbole différent : quelle que
  // soit la géométrie de la ligne (horizontale ou diagonale), les 5 valeurs
  // lues seront toujours les 5 symboles distincts → jamais de match.
  const reels = SlotMachine.SYMBOLS.map(sym => Array(SlotMachine.REEL_LEN).fill(sym));
  const fake = makeFake({ _reels: reels, _reelPos: Array(SlotMachine.COLS).fill(0), bet: 10 });

  assert.deepStrictEqual(fake._evaluateLines(), []);
});
