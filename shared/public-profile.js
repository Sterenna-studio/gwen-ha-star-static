// Read-only public contracts, never fall back to the private profiles table.
export const PUBLIC_PROFILE_FIELDS = 'id,username,avatar_url,avatar_frame,bio,specialty,specialty_id,active_title,titles,joined_at,created_at';

export async function loadPublicProfile(client, { id, username }) {
  let query = client.from('public_profile_directory').select(PUBLIC_PROFILE_FIELDS);
  query = id ? query.eq('id', id) : query.eq('username', username);
  const result = await query.maybeSingle();
  if (result.error || !result.data) return result;
  // Public cosmetics have their own existing read policies, not profile joins.
  const [titles, roles] = await Promise.all([
    client.from('profile_titles').select('title_slug,unlocked_at,titles(slug,label_fr,label_en,rarity,category)').eq('profile_id', result.data.id),
    client.from('profile_roles').select('role_slug,agent_roles(label_fr,color,icon)').eq('profile_id', result.data.id),
  ]);
  if (titles.error || roles.error) return { data: null, error: titles.error || roles.error };
  return { data: { ...result.data, profile_titles: titles.data ?? [], profile_roles: roles.data ?? [] }, error: null };
}
