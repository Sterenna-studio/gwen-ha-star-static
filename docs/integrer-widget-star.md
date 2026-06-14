# Intégrer les données d'une app dans le cockpit Star

Guide pour afficher des éléments d'un autre projet de l'écosystème Nitro
(ou d'une app externe) dans le dashboard `star/index.html`.

Exemple de référence : le widget **CLASSEMENT POKEGANG**
(commit `d18ad14`, table publique `pokegang_leaderboard`).

---

## Principe

Les apps Nitro partagent **la même base Supabase**
(`https://nmdjrcswlnydglrxaivx.supabase.co`). Il n'y a généralement
**pas de REST API dédiée** : l'« API » d'une app, c'est ses tables/vues
Supabase. Pour les afficher dans le Star, il suffit de :

1. trouver la table et vérifier qu'elle est **lisible** (RLS) ;
2. ajouter une carte bento dans `star/index.html` ;
3. ajouter un *loader* dans `js/star/dashboard.js` ;
4. styler dans `css/star-dashboard.css` ;
5. vérifier puis déployer.

---

## 1. Découvrir la source de données

La clé **publishable** (publique par design) est servie en clair :

```bash
curl -s https://nitro.sterenna.fr/shared/config.js
# → SUPABASE_URL  = https://nmdjrcswlnydglrxaivx.supabase.co
# → SUPABASE_ANON = sb_publishable_...
```

Sonder l'existence des tables d'une app (`200 []` = existe mais RLS vide ;
`404` = n'existe pas ; `200 [{...}]` = **publiquement lisible**) :

```bash
URL="https://nmdjrcswlnydglrxaivx.supabase.co"
KEY="sb_publishable_dE0SfyUd-Xw4JhuAVy4x1A_NZfB7lcH"
for t in monapp_players monapp_leaderboard monapp_stats; do
  curl -s -m 8 "$URL/rest/v1/$t?select=*&limit=1" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -w "  [$t]\n"
done
```

> 💡 Le message d'erreur `PGRST205` suggère souvent le **vrai nom** d'une
> table proche (`"Perhaps you meant ... monapp_saves"`). Suis la piste.

Inspecter les colonnes d'une ligne réelle :

```bash
curl -s "$URL/rest/v1/monapp_leaderboard?select=*&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | python3 -m json.tool
```

### Deux cas

| Cas | Source | Auth nécessaire |
|---|---|---|
| **Données globales** (classement, top, stats publiques) | table/vue avec RLS lecture ouverte | non — marche pour tous |
| **Données du joueur** (son profil dans l'app) | table filtrée par `user_id` (RLS) | oui — `requireAuth()` fournit l'`user.id` |

Le widget par-joueur PokeGang utilise le 2ᵉ cas (`pokegang_players`),
le classement utilise le 1ᵉʳ (`pokegang_leaderboard`).

> ⚠️ Ne **jamais** hardcoder d'UUID. L'`user.id` vient de `requireAuth()`.
> Pour les droits admin : `profiles.role === 'superuser'`, jamais un ID en dur.

### App externe (autre sous-domaine)

Si l'app n'utilise pas la base partagée (ex. vraie API REST ailleurs),
trouve ses endpoints en inspectant son front :

```bash
curl -s https://monapp.exemple.fr/ | grep -oiE '/api/[a-z/]+'
```

Vérifie le **CORS** : un `fetch` depuis `nitro.sterenna.fr` ne marchera que
si l'API renvoie `Access-Control-Allow-Origin`. Sinon, prévoir un proxy.

---

## 2. Carte bento — `star/index.html`

Le bento est une grille **12 colonnes**. Ajoute une carte là où elle a du sens :

```html
<!-- MONAPP · données (source: table monapp_xxx) -->
<div class="bc bc-monapp">
  <div class="bc-label" style="color:var(--c-amber)">
    <span class="bc-dot"></span>MON APP · TITRE
  </div>
  <div id="monapp-widget"></div>
</div>
```

---

## 3. Loader — `js/star/dashboard.js`

Brancher l'appel dans le `Promise.all` de `initDashboard()` :

```js
await Promise.all([
  _loadVideo(),
  _loadActivity(),
  _loadPokegangFromSupabase(user.id),
  _loadPokegangLeaderboard(user.id),
  _loadMonApp(user.id),          // ← nouveau
]);
```

Puis le loader (toujours : `try/catch`, état vide, **échappement HTML**) :

```js
async function _loadMonApp(userId) {
  const el = document.getElementById('monapp-widget');
  if (!el) return;
  try {
    const { data, error } = await supabase
      .from('monapp_leaderboard')
      .select('user_id, name, score')
      .order('score', { ascending: false })
      .limit(8);
    if (error || !data?.length) { _renderMonAppEmpty(el); return; }
    el.innerHTML = data.map(r => `
      <div class="${userId && r.user_id === userId ? 'is-me' : ''}">
        ${_esc(r.name)} — ${_compactNum(r.score)}
      </div>`).join('');
  } catch { _renderMonAppEmpty(el); }
}
```

Helpers déjà présents et réutilisables dans `dashboard.js` :

- `_esc(s)` — échappe `& < > " '` (anti-XSS, **obligatoire** sur toute
  donnée texte venant de la base).
- `_compactNum(n)` — `650177 → 650K`, `9659 → 9.7K`, `2e9 → 2000M`.

Pour des **sprites Pokémon** (trainers) :
`https://play.pokemonshowdown.com/sprites/trainers/<clé>.png`
avec `onerror="this.remove()"` en filet de sécurité.

---

## 4. Style — `css/star-dashboard.css`

Déclarer la largeur de colonne (et la version mobile) :

```css
.bc-monapp { grid-column:span 7; }
@media(max-width:1100px){
  /* ajoute .bc-monapp à la liste qui passe en span 12 */
}
```

Réutilise les variables du thème (`--c-amber`, `--c-cyan`, `--c-surface-2`,
`--font-display`, `--font-mono`, `--radius-md`…) pour rester cohérent.

---

## 5. Vérifier

1. **Syntaxe** : `cp js/star/dashboard.js /tmp/d.mjs && node --check /tmp/d.mjs`
2. **Rendu sur données réelles** : reproduire la fonction de rendu dans un
   script Node nourri par le `curl` de l'étape 1 (vérifie tri, formats, highlight).
3. **Visuel** : la page Star étant *auth-gated*, générer un HTML de test
   (`star/_test.html`) qui charge les vraies CSS + le HTML rendu, puis
   `preview_start` → screenshot. **Supprimer le fichier de test ensuite.**
4. **Console** : 0 erreur.

---

## 6. Déployer

```bash
git add star/index.html js/star/dashboard.js css/star-dashboard.css
git commit -m "feat(star): widget MonApp"
git pull --rebase origin main && git push origin main
```

Le workflow `deploy-ovh.yml` se déclenche au push → rsync vers `~/nitro/`.
Vérifier en live :

```bash
curl -s https://nitro.sterenna.fr/js/star/dashboard.js | grep -c _loadMonApp
curl -s https://nitro.sterenna.fr/star/ | grep -c monapp-widget
```

---

## Checklist

- [ ] table trouvée + lisibilité RLS confirmée (`curl`)
- [ ] global (public) ou par-joueur (`user.id` via `requireAuth`) ?
- [ ] **aucun UUID hardcodé**
- [ ] carte bento dans `star/index.html`
- [ ] loader dans `dashboard.js` : `try/catch` + état vide + `_esc()`
- [ ] `grid-column` + responsive dans `star-dashboard.css`
- [ ] vérifié (node --check, rendu réel, screenshot, console)
- [ ] fichier de test supprimé
- [ ] déployé + vérifié en live
