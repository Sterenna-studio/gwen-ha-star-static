import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Support both /profile-card?username=xxx and /profile-card/xxx
  const pathParts = url.pathname.split("/").filter(Boolean);
  const username =
    url.searchParams.get("username") ||
    (pathParts.length > 1 ? pathParts[pathParts.length - 1] : null);

  if (!username) {
    return new Response(
      JSON.stringify({ error: "Missing username. Use ?username=xxx or /profile-card/xxx" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, username, avatar_url, avatar_frame, bio, specialty_id, active_title, titles, chronicles, joined_at, lang, lol_id, rl_id, role"
    )
    .eq("username", username)
    .single();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ error: "Profile not found", username }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch specialty name
  let specialty = null;
  if (profile.specialty_id) {
    const { data: spec } = await supabase
      .from("specialties")
      .select("id, name")
      .eq("id", profile.specialty_id)
      .single();
    specialty = spec ?? null;
  }

  // Fetch unlocked titles with details
  const { data: profileTitles } = await supabase
    .from("profile_titles")
    .select("title_slug, unlocked_at, titles(slug, label_fr, label_en, rarity, category)")
    .eq("profile_id", profile.id);

  // Fetch TCG player info
  const { data: tcgPlayer } = await supabase
    .from("tcg_players")
    .select("total_cards, wins, losses, elo")
    .eq("user_id", profile.id)
    .single();

  // Fetch Pokegang player info
  const { data: pokegangPlayer } = await supabase
    .from("pokegang_players")
    .select("gang_name, boss_name, reputation, total_caught, shiny_count")
    .eq("user_id", profile.id)
    .single();

  const card = {
    username: profile.username,
    avatar_url: profile.avatar_url,
    avatar_frame: profile.avatar_frame,
    bio: profile.bio,
    lang: profile.lang,
    role: profile.role,
    chronicles: profile.chronicles,
    joined_at: profile.joined_at,
    active_title: profile.active_title,
    titles_count: profile.titles?.length ?? 0,
    specialty: specialty?.name ?? null,
    titles: (profileTitles ?? []).map((pt: any) => ({
      slug: pt.title_slug,
      label_fr: pt.titles?.label_fr,
      label_en: pt.titles?.label_en,
      rarity: pt.titles?.rarity,
      category: pt.titles?.category,
      unlocked_at: pt.unlocked_at,
    })),
    games: {
      lol_id: profile.lol_id,
      rl_id: profile.rl_id,
      tcg: tcgPlayer
        ? {
            total_cards: tcgPlayer.total_cards,
            wins: tcgPlayer.wins,
            losses: tcgPlayer.losses,
            elo: tcgPlayer.elo,
          }
        : null,
      pokegang: pokegangPlayer
        ? {
            gang_name: pokegangPlayer.gang_name,
            boss_name: pokegangPlayer.boss_name,
            reputation: pokegangPlayer.reputation,
            total_caught: pokegangPlayer.total_caught,
            shiny_count: pokegangPlayer.shiny_count,
          }
        : null,
    },
  };

  return new Response(JSON.stringify(card, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
