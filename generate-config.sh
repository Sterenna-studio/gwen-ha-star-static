#!/bin/bash
# ════════════════════════════════════════════════════
#  generate-config.sh
#  Génère TCG/config.js à partir des variables dans .env
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

cat > TCG/config.js << EOF
// ════════════════════════════════════════════════════════════════
//  PokéForge — Configuration Supabase
//  ⚠️  Fichier généré automatiquement par generate-config.sh
//  ⚠️  NE PAS COMMITER si ce fichier contient de vraies clés !
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL      = '${SUPABASE_URL}';
const SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';
EOF

echo "✅ TCG/config.js généré avec succès !"
echo "   URL : ${SUPABASE_URL}"
echo "   KEY : ${SUPABASE_ANON_KEY:0:20}..."
