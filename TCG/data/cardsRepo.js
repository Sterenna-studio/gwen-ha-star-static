// data/cardsRepo.js — v1
export async function saveCards(supabase, userId, cards) {
  if (!cards?.length) return;
  for (const card of cards) {
    const cardId = card.id ?? card.card_id;
    if (!cardId) continue;
    const { data: existing } = await supabase
      .from('player_cards')
      .select('id, qty')
      .eq('player_id', userId)
      .eq('card_id', cardId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from('player_cards')
        .update({ qty: existing.qty + 1 })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('player_cards')
        .insert({ player_id: userId, card_id: cardId, qty: 1 });
    }
  }
}

export async function loadMyCards(supabase, userId) {
  const { data, error } = await supabase
    .from('player_cards')
    .select('*')
    .eq('player_id', userId);
  if (error) console.error('loadMyCards error:', error);
  return data ?? [];
}
