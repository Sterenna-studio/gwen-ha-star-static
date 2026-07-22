#!/bin/bash
# ════════════════════════════════════════════════════
#  generate-config.sh
#  Génère shared/config.js pour le DÉVELOPPEMENT LOCAL depuis .env.
#  En production, ce fichier est généré par GitHub Actions
#  (.github/workflows/deploy-ovh.yml) à partir des secrets du repo —
#  ce script ne sert qu'à reproduire la même config en local.
#  Usage : bash generate-config.sh
# ════════════════════════════════════════════════════

set -euo pipefail

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

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "❌ SUPABASE_URL ou SUPABASE_ANON_KEY manquant dans .env"
  echo "   (SUPABASE_ANON_KEY = clé publishable sb_publishable_… — voir .env.example)"
  exit 1
fi

# ── shared/config.js — consommé par shared/supabase-config.js ───────────────
# Même format que celui produit au déploiement. Fichier gitignoré.
mkdir -p shared
cat > shared/config.js << EOF
// Runtime config generated locally by generate-config.sh (dev only).
// Do not commit this file.

export const SUPABASE_URL = '${SUPABASE_URL}';
export const SUPABASE_ANON = '${SUPABASE_ANON_KEY}';
EOF

echo "✅ shared/config.js généré"
echo ""
echo "   URL : ${SUPABASE_URL}"
echo "   KEY : ${SUPABASE_ANON_KEY:0:20}..."
