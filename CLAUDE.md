# CLAUDE.md — règles pour l'agent

Jeu web **incrémental compétitif** en TypeScript (monorepo npm workspaces).
Saisons hebdomadaires : la progression de campagne est remise à zéro chaque **lundi 00:00 UTC** ;
les **améliorations permanentes** (méta-progression) sont conservées d'une semaine à l'autre.

## Règles Git — NON NÉGOCIABLES

1. **Tu ne pousses jamais directement sur `main` ni sur `dev`.** Tu ne déploies jamais. Pas de force-push.
2. **Une branche par feature**, créée depuis `origin/dev` : `feat/<n° issue>-<sujet>` (ou `fix/…`, `chore/…`).
   L'agent GitHub Actions utilise `claude/<sujet>`.
3. Tu ouvres une PR **vers `dev`** (`gh pr create --base dev`, avec `Closes #<n>` dans la description).
4. **Merge vers `dev`** : autorisé pour tes PR, uniquement quand la CI est verte. Le plus simple :
   active l'auto-merge juste après avoir ouvert la PR (`gh pr merge <n> --auto --squash --delete-branch`),
   GitHub merge tout seul quand la CI passe. Jamais `--admin`.
5. **`main` = production.** Tu peux ouvrir la PR `dev → main` (`gh pr create --base main --head dev`),
   **jamais la merger** : c'est l'humain qui relit, merge, puis approuve le déploiement.
6. Pas de modification des garde-fous (`.claude/`, workflows de déploiement et des agents, `CODEOWNERS`, `scripts/deploy.sh`).
   Si un changement de ces fichiers te semble nécessaire, explique-le dans la PR ou une issue.

Ces règles sont aussi appliquées techniquement (hook `.claude/hooks/guard.mjs`, protections de branches GitHub,
environnement `production` avec approbation manuelle). Si une commande est bloquée, ne cherche pas à la contourner.

## Flux

```
issue → branche feat/<n>-<sujet> depuis dev → code + tests → PR vers dev → CI verte → merge (squash) dans dev
→ déploiement staging + smoke tests → PR dev → main → merge HUMAIN → approbation prod → prod
```

## Agents et pilote

Le code est écrit par des agents, une issue à la fois (`.github/workflows/pilot.yml`) :
une issue = une branche `claude/issue-<n>-<sujet>` = une PR vers `dev` en auto-merge.

| Label | Sens |
| --- | --- |
| `en-cours` | un agent travaille sur l'issue (posé par le pilote) |
| `humain` | l'agent s'arrête : question, fichier protégé ou échec. Sautée par le pilote ; retirer le label la relance |
| `claude` | déclenche l'agent à la demande sur une issue, hors pilote |

Si une issue est ambiguë ou trop grosse, ne devine pas : commente-la et pose le label `humain`.

## Tests de non-régression

- Chaque feature ajoute ses tests ; **toute** la suite (`npm test`) doit rester verte avant la PR et avant le merge.
- Un bug corrigé = un test qui le reproduit.
- Les générateurs déterministes (carte, économie…) ont un test d'**empreinte** (ex. `mapFingerprint`) :
  s'il casse, c'est un changement de comportement. Ne mets à jour l'empreinte que si c'est voulu, et dis-le dans la PR.
- Avant d'ouvrir la PR `dev → main`, relance toute la suite sur `dev` à jour.

## Avant de committer

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Tout doit être vert. N'affaiblis jamais un test ou une règle de lint pour faire passer la CI : corrige la cause.

## Conventions de code

- TypeScript strict, pas de `any` sans justification.
- La **logique de jeu pure** (formules de production, coûts, prestige, saisons) vit dans `packages/core`,
  sans I/O, et est **testée** (vitest, fichiers `*.test.ts` à côté du code).
- **Serveur autoritaire** : le client affiche, le serveur calcule/valide ressources, scores et classements.
  Jamais de confiance dans une valeur envoyée par le client (anti-triche).
- Temps : toujours en **UTC** ; utiliser `nextReset` / `currentSeasonStart` de `@game/core`.
- Le reset hebdo doit être **idempotent** (rejouable sans double effet) et couvert par des tests.
- Grands nombres : attention aux dépassements de `Number` — documenter le choix (ex. break_infinity.js) avant de l'introduire.
- Commits : style Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`…), en français ou anglais.
- Correctifs CI automatiques : message préfixé par `[ci-fix]`.

## Structure

```
packages/core/     logique de jeu pure + tests
apps/              (à venir) web (front) et server (API, classements, job de reset)
scripts/           déploiement, garde-fous CI
.github/workflows/ CI/CD + workflows de l'agent
```
