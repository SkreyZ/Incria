#!/usr/bin/env bash
# Point d'entrée unique du déploiement. À adapter à votre hébergeur
# (Fly.io, Railway, Render, VPS + Docker, Cloudflare…).
# Usage : ./scripts/deploy.sh <staging|production>
set -euo pipefail

ENV="${1:?usage: deploy.sh <staging|production>}"
case "$ENV" in
  staging|production) ;;
  *) echo "Environnement inconnu: $ENV" >&2; exit 1 ;;
esac

# Garde-fou local : la prod ne se déploie que depuis la CI, sur main.
if [ "$ENV" = "production" ]; then
  if [ "${GITHUB_ACTIONS:-}" != "true" ] || [ "${GITHUB_REF:-}" != "refs/heads/main" ]; then
    echo "⛔ La production ne se déploie que depuis GitHub Actions sur main." >&2
    exit 1
  fi
fi

# TODO : remplacer par la vraie commande, ex :
#   flyctl deploy --config "fly.$ENV.toml" --remote-only
echo "::warning::scripts/deploy.sh n'est pas encore configuré — aucun déploiement réel vers $ENV."
