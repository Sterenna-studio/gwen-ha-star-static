const fields = 'id,username,avatar_url,avatar_frame,bio,specialty,active_title,titles,joined_at';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};

export function createProfileCardHandler({ supabaseUrl, publicKey, fetchImpl = fetch }) {
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers });
  const read = async (table, params) => {
    const url = new URL(`/rest/v1/${table}`, supabaseUrl);
    url.search = new URLSearchParams(params).toString();
    const response = await fetchImpl(url, {
      headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Public data unavailable');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Invalid public response');
    return rows;
  };
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const url = new URL(request.url);
    const path = url.pathname.split('/').filter(Boolean);
    let username;
    try {
      username = url.searchParams.get('username') ?? (path.at(-1) !== 'profile-card' ? decodeURIComponent(path.at(-1) ?? '') : '');
    } catch { return json({ error: 'Invalid username' }, 400); }
    if (!username?.trim() || username.length > 80) return json({ error: 'Missing or invalid username' }, 400);
    if (!supabaseUrl || !publicKey) return json({ error: 'Public data unavailable' }, 503);
    try {
      const profiles = await read('public_profile_directory', { select: fields, username: `eq.${username}`, limit: '2' });
      if (!profiles.length) return json({ error: 'Profile not found' }, 404);
      if (profiles.length !== 1) throw new Error('Ambiguous public profile');
      const profile = profiles[0];
      const titles = await read('profile_titles', {
        select: 'title_slug,unlocked_at,titles(slug,label_fr,label_en,rarity,category)',
        profile_id: `eq.${profile.id}`,
      });
      // Output allowlist is independent of the database response shape.
      return json({
        username: profile.username, avatar_url: profile.avatar_url,
        avatar_frame: profile.avatar_frame, bio: profile.bio,
        joined_at: profile.joined_at, active_title: profile.active_title,
        titles_count: Array.isArray(profile.titles) ? profile.titles.length : 0,
        specialty: profile.specialty ?? null,
        titles: titles.map(title => ({
          slug: title.title_slug, unlocked_at: title.unlocked_at,
          label_fr: title.titles?.label_fr, label_en: title.titles?.label_en,
          rarity: title.titles?.rarity, category: title.titles?.category,
        })),
      });
    } catch { return json({ error: 'Public data unavailable' }, 503); }
  };
}
