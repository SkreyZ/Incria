#!/usr/bin/env bash
# Démarrage des agents — à lancer UNE fois, par un humain, depuis Git Bash à la racine du repo :
#   ./scripts/bootstrap-agents.sh
#
# 1. installe les fichiers que Claude (Cowork) n'a pas le droit d'écrire (.claude/, .github/) ;
# 2. active l'auto-merge sur le dépôt ;
# 3. pousse tout le travail local sur la branche claude/bootstrap, ouvre la PR vers dev en auto-merge ;
# 4. crée les jalons et les issues.
# Quand la PR est mergée (CI verte), le pilote (pilot.yml) démarre et confie les issues aux agents.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

command -v gh >/dev/null || { echo "❌ gh n'est pas installé"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "❌ gh n'est pas connecté : gh auth login"; exit 1; }
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
echo "▶ Dépôt : $REPO"

if ! gh secret list | grep -q '^CLAUDE_CODE_OAUTH_TOKEN'; then
  echo "❌ Secret CLAUDE_CODE_OAUTH_TOKEN absent : claude setup-token, puis gh secret set CLAUDE_CODE_OAUTH_TOKEN"
  exit 1
fi

# 1. Fichiers protégés préparés par Claude dans _a-appliquer/
if [ -d _a-appliquer ]; then
  [ -d _a-appliquer/hooks ] && cp _a-appliquer/hooks/* .claude/hooks/
  [ -f _a-appliquer/settings.json ] && cp _a-appliquer/settings.json .claude/settings.json
  if [ -d _a-appliquer/workflows ]; then
    mkdir -p .github/workflows
    cp _a-appliquer/workflows/*.yml .github/workflows/
  fi
  rm -rf _a-appliquer
  echo "  fichiers .claude/ et .github/ installés"
fi

# 2. Réglages du dépôt
gh api -X PATCH "repos/$REPO" -F allow_auto_merge=true -F delete_branch_on_merge=true >/dev/null
echo "  auto-merge activé"

# 3. Branche + PR de démarrage
git fetch -q origin
git switch -C claude/bootstrap origin/dev
git add -A
if git diff --cached --quiet; then
  echo "  rien à committer"
else
  git commit -q -m "chore: démarrage des agents (règles, roadmap, core du jalon 1, pilote)"
fi
git push -u origin claude/bootstrap

url=$(gh pr list --head claude/bootstrap --state open --json url --jq '.[0].url // empty')
if [ -z "$url" ]; then
  url=$(gh pr create --base dev --head claude/bootstrap \
    --title "chore: démarrage des agents" \
    --body "Règles (CLAUDE.md, garde-fous), roadmap (docs/roadmap), logique de jeu du jalon 1 (hex, rng, carte, économie, croissance, brouillard, améliorations) et pilote d'agents (pilot.yml).

Si la CI échoue, l'agent de réparation (claude-ci-fix) corrige cette branche. Auto-merge : la PR se merge seule quand la CI est verte.")
fi
gh pr merge "$url" --auto --squash --delete-branch
echo "  PR : $url (auto-merge activé)"

# 4. Jalons et issues (les issues déjà codées sont fermées)
node scripts/create-issues.mjs

git switch -q dev 2>/dev/null || git switch -q -c dev --track origin/dev
cat <<EOF

✅ Terminé. Suite automatique :
   - la PR de démarrage se merge quand la CI est verte ;
   - le pilote confie ensuite les issues aux agents, une par une (onglet Actions → « Pilote (agents) ») ;
   - à la fin d'un jalon : mergez la PR dev → main, approuvez le déploiement, puis fermez le jalon.
   Pause : gh variable set PILOT_PAUSED --body true   (reprise : --body false)
EOF
