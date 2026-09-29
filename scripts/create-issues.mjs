#!/usr/bin/env node
// Crée sur GitHub les jalons (milestones), labels et issues de docs/roadmap/issues.json.
// Idempotent : un jalon ou une issue qui existe déjà (même titre) est ignoré.
// Usage : node scripts/create-issues.mjs [--dry-run]
// Prérequis : gh installé et connecté (gh auth login).
//
// Volontairement SANS le label "claude" : c'est le pilote (pilot.yml) qui confie les issues
// aux agents une par une. Les issues marquées "status": "done" sont créées puis fermées.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const dryRun = process.argv.includes("--dry-run");
const data = JSON.parse(readFileSync(new URL("../docs/roadmap/issues.json", import.meta.url), "utf8"));

const gh = (args, input) =>
  execFileSync("gh", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "inherit"] }).trim();

const LABELS = {
  core: ["0e8a16", "Logique de jeu (packages/core)"],
  web: ["1d76db", "Client web (apps/web)"],
  server: ["5319e7", "Serveur (apps/server)"],
  ops: ["b60205", "Hébergement, déploiement"],
  "en-cours": ["fbca04", "Un agent travaille sur cette issue"],
  humain: ["d93f0b", "À traiter par un humain : sautée par le pilote"],
};

const repo = gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
console.log(`Dépôt : ${repo}${dryRun ? " (dry-run)" : ""}`);

// Labels
for (const [name, [color, description]] of Object.entries(LABELS)) {
  if (!dryRun) gh(["label", "create", name, "--color", color, "--description", description, "--force"]);
}

// Jalons
const existingMilestones = JSON.parse(gh(["api", `repos/${repo}/milestones?state=all&per_page=100`]));
const milestoneTitle = {};
for (const m of data.milestones) {
  milestoneTitle[m.key] = m.title;
  if (existingMilestones.some((e) => e.title === m.title)) {
    console.log(`= jalon existant : ${m.title}`);
    continue;
  }
  console.log(`+ jalon : ${m.title}`);
  if (!dryRun) {
    gh(["api", "-X", "POST", `repos/${repo}/milestones`, "-f", `title=${m.title}`, "-f", `description=${m.description}`]);
  }
}

// Issues
const existingIssues = new Set(
  JSON.parse(gh(["issue", "list", "--state", "all", "--limit", "500", "--json", "title"])).map((i) => i.title),
);
let created = 0;
for (const issue of data.issues) {
  if (existingIssues.has(issue.title)) {
    console.log(`= issue existante : ${issue.title}`);
    continue;
  }
  console.log(`+ ${issue.id} ${issue.title}`);
  if (!dryRun) {
    const args = ["issue", "create", "--title", issue.title, "--body-file", "-", "--milestone", milestoneTitle[issue.milestone]];
    for (const l of issue.labels) args.push("--label", l);
    const url = gh(args, issue.body);
    console.log("  " + url);
    // Issues déjà implémentées (code livré dans la PR de démarrage) : fermées tout de suite.
    if (issue.status === "done") {
      gh(["issue", "close", url, "--reason", "completed", "--comment", "Déjà implémentée dans la PR de démarrage (claude/bootstrap)."]);
      console.log("  (fermée : déjà faite)");
    }
  }
  created++;
}
console.log(`\n${created} issue(s) ${dryRun ? "à créer" : "créée(s)"}.`);
