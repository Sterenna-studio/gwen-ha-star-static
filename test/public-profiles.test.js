import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileCardHandler } from '../supabase/functions/profile-card/handler.js';
import { loadPublicProfile, PUBLIC_PROFILE_FIELDS } from '../shared/public-profile.js';
import { readFileSync } from 'node:fs';

const config = { supabaseUrl: 'https://fixture.invalid', publicKey: 'public-fixture-only' };
test('profile-card allowlists public fields even if upstream returns private extras', async () => {
  const requests = [];
  const handler = createProfileCardHandler({ ...config, fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return Response.json(url.pathname.endsWith('public_profile_directory')
      ? [{ id: 'fixture', username: 'Agent', bio: 'Public bio', role: 'superuser', email: 'private', chronicles: 12, lol_id: 'private', gaming_cache: {}, titles: ['Recrue'] }]
      : [{ title_slug: 'recrue', titles: { label_fr: 'Recrue', rarity: 'common', secret: 'private' } }]);
  } });
  const response = await handler(new Request('https://fixture.invalid/functions/v1/profile-card?username=Agent'));
  assert.equal(response.status, 200);
  const card = await response.json();
  assert.equal(card.username, 'Agent');
  assert.equal(card.titles[0].label_fr, 'Recrue');
  for (const key of ['role','email','chronicles','lol_id','rl_id','gaming_cache','lang','games']) assert.equal(Object.hasOwn(card, key), false);
  assert.equal(Object.hasOwn(card.titles[0], 'secret'), false);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(requests[0].options.headers.apikey, config.publicKey);
  assert.equal(requests[0].url.searchParams.get('username'), 'eq.Agent');
  assert.equal(requests.length, 2);
});
test('profile-card validates methods and usernames before querying', async () => {
  const handler = createProfileCardHandler({ ...config, fetchImpl: () => { throw new Error('Must not query'); } });
  assert.equal((await handler(new Request('https://fixture.invalid/profile-card', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await handler(new Request('https://fixture.invalid/profile-card', { method: 'POST' }))).status, 405);
  assert.equal((await handler(new Request('https://fixture.invalid/profile-card'))).status, 400);
  assert.equal((await handler(new Request('https://fixture.invalid/profile-card/%ZZ'))).status, 400);
});
test('profile-card distinguishes absence from database/network failures', async () => {
  for (const [fetchImpl, status] of [
    [async () => Response.json([]), 404],
    [async () => Response.json({ error: 'private details' }, { status: 500 }), 503],
    [async () => { throw new Error('secret network details'); }, 503],
    [async () => Response.json([{},{}]), 503],
  ]) {
    const response = await createProfileCardHandler({ ...config, fetchImpl })(new Request('https://fixture.invalid/profile-card/Agent'));
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /secret|private details/);
  }
});
test('public CIG queries only directory and cosmetic contracts, never profiles', async () => {
  const calls = [];
  const client = { from(table) {
    const query = { select(columns) { calls.push({ table, columns }); return query; }, eq() { return query; },
      maybeSingle() { return Promise.resolve({ data: { id: 'fixture', username: 'Agent' }, error: null }); },
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
    return query;
  } };
  const result = await loadPublicProfile(client, { id: 'fixture' });
  assert.equal(result.data.username, 'Agent');
  assert.deepEqual(calls.map(call => call.table), ['public_profile_directory','profile_titles','profile_roles']);
  assert.doesNotMatch(PUBLIC_PROFILE_FIELDS, /email|role|chronicles|gaming_cache|lol_id|rl_id/);
});
test('all public consumers use the new contracts without private fallbacks', () => {
  const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of ['js/star/crew.js','js/star/cockpit.js','js/star/alt-cockpit.js','star/crew.html','profil.html']) {
    assert.doesNotMatch(source(path), /from\(['"]profiles['"]\)/);
  }
  assert.match(source('js/cig.js'), /from\('public_chronicles_leaderboard'\)/);
  assert.match(source('js/cig.js'), /readOnly\s*\? await loadPublicProfile/);
  assert.doesNotMatch(source('supabase/functions/profile-card/index.ts'), /SERVICE_ROLE/);
});
