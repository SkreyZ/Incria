#!/usr/bin/env bash
# Configuration unique du dépôt GitHub (à lancer par un admin, avec `gh auth login` fait).
#   ./scripts/setup-github.sh
# Variables optionnelles :
#   REVIEWER=<login>      reviewer obligatoire pour la prod (défaut : vous)
#   DEV_APPROVALS=1       approbations requises pour merger dans dev
#   MAIN_APPROVALS=1      approbations requises pour merger dans main
set -euo pipefail

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
ME=$(gh api user --jq .login)
REVIEWER=${REVIEWER:-$ME}
REVIEWER_ID=$(gh api "users/$REVIEWER" --jq .id)
DEV_APPROVALS=${DEV_APPROVALS:-1}
MAIN_APPROVALS=${MAIN_APPROVALS:-1}

CI_CHECK="Lint · Typecheck · Test · Build"           # job de ci.yml (PR)
STAGING_CI_CHECK="ci / Lint · Typecheck · Test · Build" # même job appelé par deploy-staging.yml
SMOKE_CHECK="Smoke tests staging"
GUARD_CHECK="Guard: source = dev"

echo "▶ Dépôt : $REPO — reviewer prod : $REVIEWER"

# 1. CODEOWNERS
if grep -q '@OWNER' .github/CODEOWNERS; then
  sed -i.bak "s/@OWNER/@$REVIEWER/g" .github/CODEOWNERS && rm -f .github/CODEOWNERS.bak
  echo "  CODEOWNERS → @$REVIEWER (pensez à committer ce fichier)"
fi

# 2. Branche dev = branche par défaut (les PR et l'agent partent de dev)
if ! gh api "repos/$REPO/branches/dev" >/dev/null 2>&1; then
  MAIN_SHA=$(gh api "repos/$REPO/git/ref/heads/main" --jq .object.sha)
  gh api -X POST "repos/$REPO/git/refs" -f ref=refs/heads/dev -f sha="$MAIN_SHA" >/dev/null
  echo "  branche dev créée depuis main"
fi
gh api -X PATCH "repos/$REPO" \
  -f default_branch=dev \
  -F delete_branch_on_merge=true \
  -F allow_auto_merge=false >/dev/null
echo "  branche par défaut = dev, suppression auto des branches mergées, auto-merge désactivé"

# 3. Labels
for l in "claude:7c3aed:Déclenche l'agent Claude" "ci-autofix:f59e0b:L'agent peut réparer la CI de cette PR" \
         "release:16a34a:PR de release dev → main" "rapport:64748b:Rapport hebdo de l'agent" "ci:dc2626:Problème CI/infra"; do
  IFS=: read -r name color desc <<<"$l"
  gh label create "$name" --color "$color" --description "$desc" --force >/dev/null
done
echo "  labels créés"

# 4. Protection de dev : PR obligatoire + CI verte + approbation
protect() { # $1 branche, $2 json
  gh api -X PUT "repos/$REPO/branches/$1/protection" -H "Accept: application/vnd.github+json" --input - <<<"$2" >/dev/null
}
protect dev "$(cat <<JSON
{
  "required_status_checks": { "strict": true, "contexts": ["$CI_CHECK"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": $DEV_APPROVALS,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
)"
echo "  dev protégée (PR + CI + $DEV_APPROVALS approbation(s))"

# 5. Protection de main : uniquement depuis dev, testé en staging, approbation code owner, admins inclus
protect main "$(cat <<JSON
{
  "required_status_checks": { "strict": false, "contexts": ["$STAGING_CI_CHECK", "$SMOKE_CHECK", "$GUARD_CHECK"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": $MAIN_APPROVALS,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
)"
echo "  main protégée (PR depuis dev + checks staging + code owner, admins inclus)"

# 6. Environnements
gh api -X PUT "repos/$REPO/environments/staging" --input - >/dev/null <<JSON
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
gh api -X POST "repos/$REPO/environments/staging/deployment-branch-policies" -f name=dev -f type=branch >/dev/null 2>&1 || true

gh api -X PUT "repos/$REPO/environments/production" --input - >/dev/null <<JSON
{
  "reviewers": [ { "type": "User", "id": $REVIEWER_ID } ],
  "prevent_self_review": false,
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
JSON
gh api -X POST "repos/$REPO/environments/production/deployment-branch-policies" -f name=main -f type=branch >/dev/null 2>&1 || true
echo "  environnements : staging (dev uniquement), production (main uniquement + approbation de @$REVIEWER)"

cat <<EOF

✅ Terminé. Reste à faire à la main :
  1. Installer l'app GitHub Claude : https://github.com/apps/claude  (ou lancer /install-github-app dans Claude Code)
  2. Secret ANTHROPIC_API_KEY  :  gh secret set ANTHROPIC_API_KEY
     (ou CLAUDE_CODE_OAUTH_TOKEN via 'claude setup-token' si abonnement Pro/Max, et adapter les workflows)
  3. Secrets/vars de déploiement : gh secret set DEPLOY_TOKEN ; gh variable set STAGING_URL ; gh variable set PROD_URL
  4. Implémenter scripts/deploy.sh pour votre hébergeur.
  5. Vérifier après le premier run que les noms de checks exigés correspondent (Settings → Branches).
EOF
