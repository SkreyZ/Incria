#!/usr/bin/env node
// Garde-fou PreToolUse pour l'agent Claude.
// Bloque (exit 2) : push vers main/dev, force-push, merge d'une PR ailleurs que vers dev,
// PR vers main qui ne vient pas de dev, déclenchement de déploiement, et modification des fichiers qui définissent ces garde-fous.
// Reçoit sur stdin le JSON de l'appel d'outil (tool_name, tool_input).
import { execFileSync } from "node:child_process";
import path from "node:path";

export const PROTECTED_BRANCHES = ["main", "master", "dev"];

// Fichiers que l'agent ne doit jamais modifier (ils le brident lui-même
// ou pilotent la prod). Un humain peut les modifier normalement.
export const PROTECTED_PATHS = [
  /^\.claude\/settings(\.local)?\.json$/,
  /^\.claude\/hooks\//,
  /^\.github\/workflows\/(deploy-prod|deploy-staging|guard-main|release-pr|pilot|claude[\w-]*)\.yml$/,
  /^\.github\/CODEOWNERS$/,
  /^scripts\/(deploy\.sh|setup-github\.sh|check-reset-freeze\.mjs)$/,
];

function currentBranch(cwd) {
  try {
    return execFileSync("git", ["symbolic-ref", "--short", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return ""; // HEAD détaché
  }
}

/** Découpe une ligne de commande shell en segments (&&, ||, ;, |, retours ligne). */
function segments(cmd) {
  return cmd.split(/&&|\|\||;|\||\n/).map((s) => s.trim()).filter(Boolean);
}

/** Tokenisation simple (gère les guillemets). */
function tokens(seg) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(seg))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const norm = (ref) => ref.replace(/^\+/, "").replace(/^refs\/heads\//, "");

/** Renvoie un message d'erreur si la commande est interdite, sinon null. */
/** Valeur d'une option (`--base dev` ou `--base=dev`). */
function optValue(t, names) {
  for (let i = 0; i < t.length; i++) {
    if (names.includes(t[i])) return t[i + 1];
    for (const n of names) if (n.startsWith("--") && t[i].startsWith(n + "=")) return t[i].slice(n.length + 1);
  }
  return undefined;
}

// Options de `gh pr merge` qui prennent une valeur.
const MERGE_VALUE_OPTS = new Set(["-t", "--subject", "-b", "--body", "-F", "--body-file", "--match-head-commit", "-A", "--author-email", "-R", "--repo"]);

/** PR visée par `gh pr merge` (numéro, URL ou branche), ou undefined = PR de la branche courante. */
function mergeTarget(args) {
  for (let i = 0; i < args.length; i++) {
    if (MERGE_VALUE_OPTS.has(args[i])) { i++; continue; }
    if (!args[i].startsWith("-")) return args[i];
  }
  return undefined;
}

/** Branche cible (base) d'une PR, via gh. null si impossible à déterminer. */
export function defaultPrBase(target) {
  try {
    const args = ["pr", "view", ...(target ? [target] : []), "--json", "baseRefName", "--jq", ".baseRefName"];
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

export function checkCommand(cmd, branch, resolvePrBase = defaultPrBase) {
  for (const seg of segments(cmd)) {
    let t = tokens(seg);
    // retirer préfixes type "env X=1", "sudo", variables d'env
    while (t.length && (/^\w+=/.test(t[0]) || ["env", "sudo", "command"].includes(t[0]))) t = t.slice(1);
    if (!t.length) continue;

    // git -C dir push … → on ignore les options globales de git
    if (t[0] === "git") {
      let i = 1;
      while (i < t.length && t[i].startsWith("-")) i += t[i] === "-C" || t[i] === "-c" ? 2 : 1;
      const sub = t[i];
      const args = t.slice(i + 1);

      if (sub === "push") {
        const opts = args.filter((a) => a.startsWith("-"));
        const pos = args.filter((a) => !a.startsWith("-"));
        if (opts.some((o) => o === "-f" || o === "--force" || /^-[a-z]*f/.test(o) && !o.startsWith("--"))) {
          return "Force-push interdit pour l'agent.";
        }
        if (opts.some((o) => ["--all", "--mirror", "--tags"].includes(o))) {
          return `git push ${opts.join(" ")} interdit pour l'agent.`;
        }
        const refspecs = pos.slice(1); // pos[0] = remote
        const targets = refspecs.length
          ? refspecs.map((r) => {
              if (r.startsWith("+")) return { force: true, dst: norm(r.split(":").pop()) };
              const dst = r.includes(":") ? r.split(":").pop() : r;
              return { force: false, dst: norm(dst === "HEAD" ? branch : dst) };
            })
          : [{ force: false, dst: branch }];
        for (const { force, dst } of targets) {
          if (force) return "Force-push (+refspec) interdit pour l'agent.";
          if (PROTECTED_BRANCHES.includes(dst)) {
            return `Push vers '${dst}' interdit : l'agent travaille sur une branche claude/* et ouvre une PR vers dev.`;
          }
        }
      }

      if (sub === "commit" && PROTECTED_BRANCHES.includes(branch)) {
        return `Commit directement sur '${branch}' interdit : crée d'abord une branche claude/… (git checkout -b claude/<sujet>).`;
      }
      if (sub === "branch" && args.some((a) => ["-D", "-d", "--delete", "-m", "-M"].includes(a)) &&
          args.some((a) => PROTECTED_BRANCHES.includes(a))) {
        return "Suppression/renommage d'une branche protégée interdit.";
      }
    }

    if (t[0] === "gh") {
      const [a, b] = [t[1], t[2]];
      if (a === "pr" && b === "merge") {
        if (t.includes("--admin")) return "gh pr merge --admin interdit : on ne contourne pas les protections de branche.";
        const target = mergeTarget(t.slice(3));
        const base = resolvePrBase(target);
        if (base === null) return "Impossible de vérifier la branche cible de la PR : merge refusé.";
        if (base !== "dev") return `Merge vers '${base}' interdit : l'agent ne merge que vers dev. main est mergée par un humain.`;
      }
      if (a === "pr" && b === "create") {
        const base = optValue(t, ["--base", "-B"]);
        const head = optValue(t, ["--head", "-H"]);
        if (!base) return "Précise --base dev (ou --base main --head dev pour la PR de release) pour gh pr create.";
        if (base === "main" && head !== "dev") {
          return "Une PR vers main doit venir de dev : gh pr create --base main --head dev.";
        }
        if (base !== "dev" && base !== "main") return `PR vers '${base}' interdite.`;
      }
      if (a === "workflow" && b === "run") return "Déclencher un workflow est interdit pour l'agent.";
      if (a === "release") return "Les releases sont gérées par des humains.";
      if (a === "api") {
        const joined = t.join(" ");
        if (/\/merges?\b|\/pulls\/\d+\/merge|git\/refs\/heads\/(main|master|dev)|\/deployments|\/environments|branches\/[^ ]+\/protection|\/rulesets/.test(joined)) {
          return "Appel API GitHub sensible (merge/refs protégées/déploiement/protection) interdit.";
        }
      }
    }

    if (/(^|\/)deploy\.sh$/.test(t[0]) || (t[0] === "bash" && /deploy\.sh$/.test(t[1] ?? ""))) {
      return "Le déploiement ne se fait que via la CI.";
    }
  }
  return null;
}

export function checkPath(filePath, projectDir) {
  if (!filePath) return null;
  const rel = path.relative(projectDir, path.resolve(projectDir, filePath)).split(path.sep).join("/");
  if (PROTECTED_PATHS.some((re) => re.test(rel))) {
    return `Le fichier '${rel}' fait partie des garde-fous CI/CD : modification réservée aux humains.`;
  }
  return null;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return; // entrée illisible : on laisse passer, les protections GitHub restent actives
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const ti = input.tool_input ?? {};
  let err = null;
  if (input.tool_name === "Bash") {
    err = checkCommand(String(ti.command ?? ""), currentBranch(input.cwd || projectDir));
  } else {
    err = checkPath(ti.file_path ?? ti.notebook_path, projectDir);
  }
  if (err) {
    process.stderr.write(`⛔ Bloqué par .claude/hooks/guard.mjs : ${err}\n`);
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
