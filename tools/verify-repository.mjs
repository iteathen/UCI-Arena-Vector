import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const requiredFiles = [
  "AGENTS.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "docs/architecture/CONNECTOR_MAP.md",
  "docs/specs/VECTOR-0001-chess-search-product.md",
  "GOVERNANCE.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "STATUS.md",
  "SUPPORT.md",
  "next_step.yaml",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/dependabot.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/architecture-proposal.yml",
  ".github/ISSUE_TEMPLATE/contract-defect.yml",
  ".github/workflows/repository-quality.yml",
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) {
    errors.push(`missing required file: ${file}`);
  }
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (entry === ".git" || entry === "node_modules") continue;
    const absolute = resolve(directory, entry);
    if (statSync(absolute).isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
}

const files = walk(root);
const forbiddenExtensions = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cu",
  ".cuh",
  ".h",
  ".hpp",
  ".ptx",
  ".py",
]);

for (const absolute of files) {
  const relative = absolute.slice(root.length + 1).replaceAll("\\", "/");
  if (forbiddenExtensions.has(extname(relative).toLowerCase())) {
    errors.push(`forbidden Vector source-language file: ${relative}`);
  }

  if (relative.endsWith(".md")) {
    const markdown = readFileSync(absolute, "utf8");
    const links = markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g);
    for (const match of links) {
      const rawTarget = match[1].trim().replace(/^<|>$/g, "");
      if (
        rawTarget === "" ||
        rawTarget.startsWith("#") ||
        /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)
      ) {
        continue;
      }
      const pathTarget = decodeURIComponent(rawTarget.split("#", 1)[0]);
      if (!existsSync(resolve(dirname(absolute), pathTarget))) {
        errors.push(`${relative}: broken local link: ${rawTarget}`);
      }
    }
  }

  if (relative.startsWith(".github/workflows/") && /\.ya?ml$/i.test(relative)) {
    const workflow = readFileSync(absolute, "utf8");
    for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
      if (!/@[0-9a-f]{40}$/.test(match[1])) {
        errors.push(`${relative}: action is not pinned to a full commit: ${match[1]}`);
      }
    }
  }
}

const tracked = execFileSync("git", ["ls-files"], {
  cwd: root,
  encoding: "utf8",
}).split(/\r?\n/).filter(Boolean);

for (const relative of tracked) {
  if (/^(?:secrets\/|\.env(?:\.|$))/i.test(relative)) {
    errors.push(`secret-bearing path must not be tracked: ${relative}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`ERROR: ${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Repository policy verified across ${files.length} files.\n`);
}
