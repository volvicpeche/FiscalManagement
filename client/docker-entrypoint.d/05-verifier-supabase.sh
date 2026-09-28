#!/bin/sh
# Refuse de démarrer sans projet Supabase.
#
# nginx relaie /supabase/auth/v1/ vers SUPABASE_URL (voir nginx.conf.template).
# Sans elle, la page de connexion ne pourrait joindre personne. Mieux vaut un
# conteneur arrêté, avec un message clair dans les journaux, qu'un site qui
# répond mais où personne ne peut se connecter.
#
# Lancé avant 20-envsubst-on-templates.sh, qui écrit la configuration.
set -e

case "${SUPABASE_URL:-}" in
  "")
    echo "ERREUR : SUPABASE_URL absente." >&2
    echo "Renseignez-la dans ~/patrimonia/web/.env sur le VPS (voir DEPLOY.md), puis relancez." >&2
    exit 1
    ;;
esac

# Origine seule, sans chemin ni barre finale : nginx y ajoute /auth/v1/...
if ! echo "$SUPABASE_URL" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$'; then
  echo "ERREUR : SUPABASE_URL invalide ($SUPABASE_URL)." >&2
  echo "Attendu : https://<ref>.supabase.co, sans barre finale." >&2
  exit 1
fi
