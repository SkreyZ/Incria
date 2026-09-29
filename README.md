# Incrémental compétitif

Jeu web incrémental compétitif (TypeScript) avec saisons hebdomadaires et améliorations permanentes.

```bash
npm install
npm run lint && npm run typecheck && npm test && npm run build
```

- Règles de contribution de l'agent : [CLAUDE.md](CLAUDE.md)
- Pipeline CI/CD et agent Claude : [docs/CICD.md](docs/CICD.md)

Branches : `dev` (intégration, déployée en staging) → `main` (production). Toute modification passe par une PR vers `dev`.
