import { describe, expect, it } from "vitest";
import { checkCommand, checkPath } from "./guard.mjs";

// Résolveur factice : PR 12 et branche feat/x -> dev, PR 99 -> main, sinon inconnue.
const fakeBase = (target) => ({ "12": "dev", "feat/x": "dev", "99": "main" })[target ?? "feat/x"] ?? null;
const blocked = (cmd, branch = "claude/feature-x") => checkCommand(cmd, branch, fakeBase) !== null;

describe("guard: git push", () => {
  it("autorise le push de la branche claude/* courante", () => {
    expect(blocked("git push")).toBe(false);
    expect(blocked("git push -u origin HEAD")).toBe(false);
    expect(blocked("git push origin claude/feature-x")).toBe(false);
  });
  it("bloque le push vers main ou dev, sous toutes les formes", () => {
    expect(blocked("git push origin main")).toBe(true);
    expect(blocked("git push origin dev")).toBe(true);
    expect(blocked("git push origin HEAD:main")).toBe(true);
    expect(blocked("git push origin HEAD:refs/heads/dev")).toBe(true);
    expect(blocked("git push origin claude/x:main")).toBe(true);
    expect(blocked("npm test && git push origin main")).toBe(true);
    expect(blocked("git -C . push origin dev")).toBe(true);
  });
  it("bloque un push implicite quand on est sur main/dev", () => {
    expect(blocked("git push", "dev")).toBe(true);
    expect(blocked("git push origin HEAD", "main")).toBe(true);
  });
  it("bloque le force-push", () => {
    expect(blocked("git push --force")).toBe(true);
    expect(blocked("git push -f origin claude/feature-x")).toBe(true);
    expect(blocked("git push origin +claude/feature-x")).toBe(true);
    expect(blocked("git push --all")).toBe(true);
  });
});

describe("guard: commit / branches", () => {
  it("bloque les commits directement sur dev/main", () => {
    expect(blocked('git commit -m "fix"', "dev")).toBe(true);
    expect(blocked('git commit -m "fix"', "main")).toBe(true);
    expect(blocked('git commit -m "fix"')).toBe(false);
  });
  it("bloque la suppression d'une branche protégée", () => {
    expect(blocked("git branch -D dev")).toBe(true);
  });
});

describe("guard: gh", () => {
  it("autorise le merge d'une PR vers dev", () => {
    expect(blocked("gh pr merge 12 --squash --delete-branch")).toBe(false);
    expect(blocked("gh pr merge --squash")).toBe(false); // PR de la branche courante
    expect(blocked('gh pr merge 12 --squash --subject "feat: grille"')).toBe(false);
  });
  it("bloque le merge vers main, inconnu, ou en --admin", () => {
    expect(blocked("gh pr merge 99 --squash")).toBe(true);
    expect(blocked("gh pr merge 123 --merge")).toBe(true);
    expect(blocked("gh pr merge 12 --squash --admin")).toBe(true);
  });
  it("bloque workflow run, release, merge par l'API", () => {
    expect(blocked("gh workflow run deploy-prod.yml")).toBe(true);
    expect(blocked("gh release create v1")).toBe(true);
    expect(blocked("gh api -X PUT repos/o/r/pulls/3/merge")).toBe(true);
  });
  it("PR vers dev, ou vers main uniquement depuis dev", () => {
    expect(blocked('gh pr create --base dev --title "x" --body "y"')).toBe(false);
    expect(blocked('gh pr create --base main --head dev --title "Release"')).toBe(false);
    expect(blocked('gh pr create --base=main --head=dev --fill')).toBe(false);
    expect(blocked('gh pr create --base main --title "x"')).toBe(true);
    expect(blocked('gh pr create --base main --head feat/x')).toBe(true);
    expect(blocked('gh pr create --base staging')).toBe(true);
    expect(blocked('gh pr create --title "x"')).toBe(true);
  });
  it("laisse passer les commandes de lecture", () => {
    expect(blocked("gh pr view 3")).toBe(false);
    expect(blocked("gh pr comment 3 --body 'ok'")).toBe(false);
  });
});

describe("guard: déploiement", () => {
  it("bloque deploy.sh", () => {
    expect(blocked("./scripts/deploy.sh production")).toBe(true);
    expect(blocked("bash scripts/deploy.sh staging")).toBe(true);
  });
});

describe("guard: fichiers protégés", () => {
  const dir = "/repo";
  it("bloque la modification des garde-fous", () => {
    expect(checkPath("/repo/.claude/settings.json", dir) !== null).toBe(true);
    expect(checkPath(".claude/hooks/guard.mjs", dir) !== null).toBe(true);
    expect(checkPath("/repo/.github/workflows/deploy-prod.yml", dir) !== null).toBe(true);
    expect(checkPath("/repo/.github/workflows/pilot.yml", dir) !== null).toBe(true);
    expect(checkPath("/repo/.github/workflows/claude-ci-fix.yml", dir) !== null).toBe(true);
    expect(checkPath("/repo/.github/CODEOWNERS", dir) !== null).toBe(true);
    expect(checkPath("/repo/scripts/deploy.sh", dir) !== null).toBe(true);
  });
  it("autorise le code du jeu et la CI classique", () => {
    expect(checkPath("/repo/packages/core/src/season.ts", dir)).toBe(null);
    expect(checkPath("/repo/.github/workflows/ci.yml", dir)).toBe(null);
  });
});
