import fs from "node:fs/promises";
import path from "node:path";

const siteRoot = process.cwd();
const atlasPath = path.join(siteRoot, "repo-directory.html");
const repoIndexPath = process.env.REPO_INDEX_README
  ? path.resolve(process.env.REPO_INDEX_README)
  : path.resolve(siteRoot, "..", "Whatisthisgithub", "README.md");
const checkOnly = process.argv.includes("--check");

async function main() {
  const repoIndex = await fs.readFile(repoIndexPath, "utf8");
  const activeRepos = extractRepoTable(repoIndex, "## Active Repositories", "## Archived Repositories");
  const archivedRepos = extractRepoTable(repoIndex, "## Archived Repositories", "<!-- AUTO-GENERATED-INDEX:END -->");
  const existingAtlas = await fs.readFile(atlasPath, "utf8");
  const updatedAtlas = updateAtlas(existingAtlas, activeRepos, archivedRepos, new Date());

  if (updatedAtlas === existingAtlas) {
    console.log("Repo Atlas is already current.");
    return;
  }

  if (checkOnly) {
    throw new Error("Repo Atlas is out of date. Run node scripts/generate-repo-atlas.mjs.");
  }

  await fs.writeFile(atlasPath, updatedAtlas, "utf8");
  console.log(`Updated Repo Atlas with ${activeRepos.length} active and ${archivedRepos.length} archived repositories.`);
}

function extractRepoTable(markdown, startHeading, endHeading) {
  const start = markdown.indexOf(startHeading);
  const end = markdown.indexOf(endHeading, start);

  if (start === -1 || end === -1) {
    throw new Error(`Could not find repository table section between "${startHeading}" and "${endHeading}".`);
  }

  return markdown
    .slice(start, end)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map(parseRepoRow);
}

function parseRepoRow(row) {
  const [repoCell, description = "", language = "", updated = ""] = row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  const match = repoCell.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

  if (!match) {
    throw new Error(`Could not parse repository table row: ${row}`);
  }

  return { name: match[1], url: match[2], description, language: language || "Unspecified", updated };
}

function updateAtlas(html, activeRepos, archivedRepos, generatedAt) {
  const activeCards = activeRepos.map((repo) => repoCard(repo, "Active")).join("\n");
  const archivedCards = archivedRepos.map((repo) => repoCard(repo, "Archived")).join("\n");
  const snapshotDate = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Brisbane",
  }).format(generatedAt);

  let updated = html;
  updated = replaceOnce(
    updated,
    /(<p class="card-kicker">Active repositories<\/p>\s*<h2>)\d+(<\/h2>)/,
    `$1${activeRepos.length}$2`,
    "active repository count",
  );
  updated = replaceOnce(
    updated,
    /(<p class="card-kicker">Archived repositories<\/p>\s*<h2>)\d+(<\/h2>)/,
    `$1${archivedRepos.length}$2`,
    "archived repository count",
  );
  updated = replaceOnce(
    updated,
    /(<h2>Active repositories<\/h2>\s*<\/div>\s*<div class="repo-directory-grid">)[\s\S]*?(<\/div>\s*<\/section>\s*<section class="page-section">\s*<div class="section-heading">\s*<p class="eyebrow">Historical lanes<\/p>)/,
    `$1\n${activeCards}\n        $2`,
    "active repository cards",
  );
  updated = replaceOnce(
    updated,
    /(<h2>Archived repositories<\/h2>\s*<\/div>\s*<div class="repo-directory-grid">)[\s\S]*?(<\/div>\s*<\/section>\s*<\/main>)/,
    `$1\n${archivedCards}\n        $2`,
    "archived repository cards",
  );

  if (updated !== html) {
    updated = replaceOnce(
      updated,
      /(<p class="eyebrow">Snapshot refreshed from Whatisthisgithub on )[^<]+(<\/p>)/,
      `$1${snapshotDate}$2`,
      "snapshot date",
    );
  }

  return updated;
}

function replaceOnce(text, pattern, replacement, label) {
  if (!pattern.test(text)) {
    throw new Error(`Could not locate ${label} in ${path.basename(atlasPath)}.`);
  }

  return text.replace(pattern, replacement);
}

function repoCard(repo, status) {
  return `          <article class="repo-card">
            <div class="repo-card-header">
              <h3>${escapeHtml(repo.name)}</h3>
              <span class="repo-pill">${escapeHtml(status)}</span>
            </div>
            <p>${escapeHtml(repo.description)}</p>
            <div class="repo-meta">
              <span class="repo-pill">Language: ${escapeHtml(repo.language)}</span>
              <span class="repo-pill">Updated: ${escapeHtml(repo.updated)}</span>
            </div>
            <p class="card-links">
              <a href="${escapeHtml(repo.url)}">Open repository</a>
            </p>
          </article>`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
