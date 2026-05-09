#!/bin/bash
# ════════════════════════════════════════════════════
#  generate-config.sh
#  Génère config.js (racine) et TCG/config.js depuis .env
#  Usage : bash generate-config.sh
# ════════════════════════════════════════════════════

if [ ! -f .env ]; then
  echo "❌ Fichier .env introuvable."
  echo "   Copie .env.example en .env et remplis tes clés."
  exit 1
fi

# Charge les variables du .env (ignore les commentaires et lignes vides)
set -a
# shellcheck disable=SC1091
source <(grep -v '^#' .env | grep -v '^[[:space:]]*$')
set +a

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ SUPABASE_URL ou SUPABASE_ANON_KEY manquant dans .env"
  exit 1
fi

# ── 1. config.js (racine) — utilisé par js/supabase.js ──────────────────────
cat > config.js << EOF
// ════════════════════════════════════════════════════════════════
//  Gwen Ha Star — Configuration Supabase
//  ⚠️  Fichier généré automatiquement par generate-config.sh
//  ⚠️  NE PAS COMMITER si ce fichier contient de vraies clés !
// ════════════════════════════════════════════════════════════════

export const SUPABASE_URL  = '${SUPABASE_URL}';
export const SUPABASE_ANON = '${SUPABASE_ANON_KEY}';
EOF

echo "✅ config.js (racine) généré"

# ── 2. TCG/config.js — utilisé par le TCG ───────────────────────────────────
cat > TCG/config.js << EOF
// ════════════════════════════════════════════════════════════════
//  PokéForge — Configuration Supabase
//  ⚠️  Fichier généré automatiquement par generate-config.sh
//  ⚠️  NE PAS COMMITER si ce fichier contient de vraies clés !
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL      = '${SUPABASE_URL}';
const SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';
EOF

echo "✅ TCG/config.js généré"
echo ""
echo "   URL : ${SUPABASE_URL}"
echo "   KEY : ${SUPABASE_ANON_KEY:0:20}..."
