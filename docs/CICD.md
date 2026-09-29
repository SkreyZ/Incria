# CI/CD + agent Claude

## Le principe : l'agent ne touche jamais la prod

```
                 @claude / label "claude"          (agent)                       (humain)
 issue ───────────────────────────────▶ branche claude/* ──▶ PR → dev ──CI + review Claude──▶ merge dans dev
                                                                                                  │
            ┌─────────────────────────────────────────────────────────────────────────────────────┘
            ▼
     push sur dev ──▶ CI ──▶ déploiement STAGING ──▶ smoke tests ──▶ PR de release dev → main (auto)
                                                                                 │ (humain : review + merge)
                                                                                 ▼
     push sur main ──▶ vérif "même code que staging" ──▶ hors fenêtre reset ──▶ ⏸ approbation humaine ──▶ PROD
```

| Qui | dev | main / prod |
|---|---|---|
| Agent Claude | ouvre des PR vers dev, jamais de merge | ❌ aucun accès (ni push, ni merge, ni déploiement) |
| Humain | relit + merge les PR vers dev | merge la PR de release, puis approuve le déploiement |

### 4 verrous indépendants

1. **Protections de branches GitHub** (serveur) : `dev` et `main` n'acceptent que des PR ; `main` exige les checks
   produits par le pipeline staging sur le même commit, le garde-fou « source = dev » et l'approbation du code owner.
   `enforce_admins` est activé sur main : même un admin ne peut pas pousser directement.
2. **Environnement `production`** : le déploiement attend l'approbation manuelle d'un reviewer, et n'est autorisé que depuis `main`.
3. **`deploy-prod.yml`** refuse de déployer un code dont l'arbre git n'a jamais été déployé avec succès en staging,
   et refuse de déployer ±60 min autour du reset hebdo (lundi 00:00 UTC).
4. **Côté agent** : `CLAUDE.md` (règles), `--allowedTools`/`--disallowedTools` dans chaque workflow, et le hook
   `.claude/hooks/guard.mjs` qui bloque : push vers main/dev, commit sur main/dev, force-push, `gh pr merge`,
   PR vers autre chose que dev, `gh workflow run`, `deploy.sh`, et toute modification des fichiers de garde-fous.
   Le hook s'applique aussi si vous utilisez Claude Code en local sur ce repo. Il est testé (`.claude/hooks/guard.test.mjs`).

## Les workflows

| Fichier | Déclencheur | Rôle |
|---|---|---|
| `ci.yml` | PR vers dev/main, appel | lint, typecheck, tests, build |
| `deploy-staging.yml` | push sur dev | CI → déploiement staging → smoke tests |
| `release-pr.yml` | staging vert | ouvre/maj la PR `dev → main` (jamais de merge auto) |
| `guard-main.yml` | PR vers main | échoue si la source n'est pas `dev` |
| `deploy-prod.yml` | push sur main | vérifs + approbation humaine + déploiement prod |
| `claude.yml` | `@claude` ou label `claude` | **implémente une issue** → PR vers dev ; répond aux questions dans les PR |
| `claude-review.yml` | chaque PR (non draft) | **review** : bugs, anti-triche, reset hebdo, tests, équilibrage |
| `claude-ci-fix.yml` | CI rouge | **répare** : sur branche `claude/*` (ou label `ci-autofix`) pousse le correctif, 3 essais max ; sur dev ouvre une PR de correctif |
| `claude-scheduled.yml` | lundi 01:07 UTC, mercredi 05:23 UTC | **tâches planifiées** : rapport hebdo post-reset (issue), mise à jour des dépendances (PR vers dev) |

## Mise en place (≈ 15 min)

1. Créer le repo GitHub et pousser ce contenu sur `main` (puis `npm install` en local et committer `package-lock.json`).
2. `gh auth login` puis `./scripts/setup-github.sh` : crée `dev` (branche par défaut), labels, protections, environnements,
   et remplit `CODEOWNERS`. Committer `CODEOWNERS` via une PR vers dev.
3. Installer l'app GitHub **Claude** sur le repo : <https://github.com/apps/claude> (ou `/install-github-app` dans Claude Code).
4. Secrets : `gh secret set ANTHROPIC_API_KEY`
   (alternative abonnement Pro/Max : `claude setup-token` → secret `CLAUDE_CODE_OAUTH_TOKEN`, et remplacer
   `anthropic_api_key:` par `claude_code_oauth_token:` dans les 4 workflows `claude*.yml`).
5. Déploiement : implémenter `scripts/deploy.sh` pour votre hébergeur, `gh secret set DEPLOY_TOKEN`,
   `gh variable set STAGING_URL`, `gh variable set PROD_URL`. Ajouter un script `test:e2e` (ex. Playwright) qui teste `BASE_URL`.
6. Tester : créer une issue avec le template « Feature pour l'agent Claude » → une PR `claude/…` vers dev doit apparaître.

## Utilisation au quotidien

- **Nouvelle feature** : issue avec le label `claude` (template fourni), critères d'acceptation précis → PR vers dev.
- **Itérer sur une PR de l'agent** : commenter `@claude <demande>` dans la PR.
- **Review** : automatique ; `@claude` dans un commentaire pour une question ciblée.
- **Mise en prod** : merger la PR « Release … » (dev → main), puis approuver le job *Deploy production* dans l'onglet Actions.
- **Hotfix** : même chemin (branche → dev → staging → main). Pas de raccourci vers main, par construction.

## Points d'attention

- **Repo privé** : protections de branches et reviewers d'environnement nécessitent GitHub Pro/Team (gratuit sur repo public).
- **Noms des checks** : `setup-github.sh` exige `Lint · Typecheck · Test · Build` (dev) et
  `ci / Lint · Typecheck · Test · Build`, `Smoke tests staging`, `Guard: source = dev` (main). Après le premier run,
  vérifier dans *Settings → Branches* qu'ils correspondent exactement aux checks affichés sur les PR.
- **Pushs de l'agent** : ils passent par le token de l'app Claude, ce qui redéclenche la CI. Si ce n'est pas le cas
  sur votre repo, fournir un token d'app GitHub/PAT via l'input `github_token` de l'action.
- **Coût** : chaque run d'agent consomme des tokens API. Limites en place : `--max-turns`, `timeout-minutes`,
  3 tentatives max de réparation CI, review annulée si nouveau push.
- **Dev solo** : vous ne pouvez pas approuver vos propres PR. Les PR de l'agent et la PR de release (auteur `github-actions`)
  sont approuvables ; pour vos PR vers dev, `enforce_admins` est désactivé sur dev (bypass admin possible),
  ou lancer le script avec `DEV_APPROVALS=0`.
