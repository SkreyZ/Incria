# CLAUDE.md — règles pour l'agent

Jeu web **incrémental compétitif** en TypeScript (monorepo npm workspaces).
Saisons hebdomadaires : la progression de campagne est remise à zéro chaque **lundi 00:00 UTC** ;
les **améliorations permanentes** (méta-progression) sont conservées d'une semaine à l'autre.

## Règles Git — NON NÉGOCIABLES

1. **Tu ne pousses jamais sur `main` ni sur `dev`.** Tu ne merges jamais de PR. Tu ne déploies jamais.
2. Tout travail se fait sur une branche `claude/<sujet-court>` créée **depuis `dev`**.
3. Tu ouvres tes PR **vers `dev`** uniquement : `gh pr create --base dev`.
4. Le passage `dev → main` (prod) est fait par un humain, après tests en staging. Ce n'est pas ton rôle.
5. Pas de force-push. Pas de modification des garde-fous (`.claude/`, workflows de déploiement, `CODEOWNERS`, `scripts/deploy.sh`).
   Si un changement de ces fichiers te semble nécessaire, explique-le dans la PR ou une issue.

Ces règles sont aussi appliquées techniquement (hook `.claude/hooks/guard.mjs`, protections de branches GitHub,
environnement `production` avec approbation manuelle). Si une commande est bloquée, ne cherche pas à la contourner.

## Flux

```
issue (label "claude" ou @claude) → branche claude/* → PR vers dev → CI + review → merge humain dans dev
→ déploiement staging + smoke tests → PR de release dev → main (auto) → merge humain → approbation prod → prod
```

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
