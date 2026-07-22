import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// widget-radio-player.js importe ../supabase.js, qui remonte (via
// shared/supabase-client.js) jusqu'à un import réseau https://esm.sh/...
// pensé pour le navigateur. On intercepte cet import AVANT de charger le
// module testé : probeRadioSite n'utilise pas supabase, seule RadioPlayer
// en a besoin, mais l'ESM résout tous les imports statiques du fichier.
mock.module('../js/supabase.js', { exports: { supabase: {} } });
const { probeRadioSite } = await import('../js/star/widget-radio-player.js');

test('probeRadioSite résout true quand le fetch aboutit', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {});
  const ok = await probeRadioSite('https://example.test/radio-ok');
  assert.strictEqual(ok, true);
});

test('probeRadioSite résout false quand le fetch échoue (site down / timeout)', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network down'); });
  const ok = await probeRadioSite('https://example.test/radio-down');
  assert.strictEqual(ok, false);
});

test('probeRadioSite mémorise la promesse par URL (un seul fetch par URL)', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; });
  const url = 'https://example.test/radio-cache';
  await probeRadioSite(url);
  await probeRadioSite(url);
  await probeRadioSite(url);
  assert.strictEqual(calls, 1);
});
