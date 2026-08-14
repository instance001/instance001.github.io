import fs from "node:fs/promises";
import path from "node:path";
import { generatePublicRecord } from "./generate-public-record.mjs";

const siteRoot = process.cwd();
const siteUrl = "https://instance001.github.io";
const repoIndexPath = process.env.REPO_INDEX_README
  ? path.resolve(process.env.REPO_INDEX_README)
  : path.resolve(siteRoot, "..", "Whatisthisgithub", "README.md");

const htmlExcludes = [
  /^google[0-9a-f]+\.html$/i,
];

async function main() {
  await generatePublicRecord();

  const repoIndex = await fs.readFile(repoIndexPath, "utf8");
  const activeRepos = extractRepoTable(repoIndex, "## Active Repositories", "## Archived Repositories");
  const archivedRepos = extractRepoTable(repoIndex, "## Archived Repositories", "<!-- AUTO-GENERATED-INDEX:END -->");

  const repoDirectoryHtml = buildRepoDirectoryPage({
    activeRepos,
    archivedRepos,
    generatedAt: new Date().toISOString(),
  });

  await fs.writeFile(path.join(siteRoot, "repo-directory.html"), repoDirectoryHtml, "utf8");

  const urls = await collectPublicUrls(siteRoot);
  const sitemapXml = buildSitemap(urls);
  const sitemapText = buildTextSitemap(urls);
  await fs.writeFile(path.join(siteRoot, "sitemap.xml"), sitemapXml, "utf8");
  await fs.writeFile(path.join(siteRoot, "sitemap.txt"), sitemapText, "utf8");

  console.log(`Generated public-record.html, repo-directory.html, sitemap.xml, and sitemap.txt from ${repoIndexPath}`);
}

function extractRepoTable(markdown, startHeading, endHeading) {
  const start = markdown.indexOf(startHeading);
  const end = markdown.indexOf(endHeading, start);

  if (start === -1 || end === -1) {
    throw new Error(`Could not find repo table section between "${startHeading}" and "${endHeading}"`);
  }

  const section = markdown.slice(start, end);
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const tableLines = lines.filter((line) => line.startsWith("|"));
  const rows = tableLines.slice(2);

  return rows.map((row) => parseRepoRow(row));
}

function parseRepoRow(row) {
  const cells = row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());

  const [repoCell, description = "", language = "", updated = ""] = cells;
  const match = repoCell.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

  if (!match) {
    throw new Error(`Could not parse repo cell: ${repoCell}`);
  }

  return {
    name: match[1],
    url: match[2],
    description,
    language: language || "Unspecified",
    updated,
  };
}

async function collectPublicUrls(rootDir) {
  const urls = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) {
          continue;
        }

        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".html")) {
        continue;
      }

      if (htmlExcludes.some((pattern) => pattern.test(entry.name))) {
        continue;
      }

      const stat = await fs.stat(absolutePath);
      const location = relativePath === "index.html"
        ? `${siteUrl}/`
        : `${siteUrl}/${relativePath}`;

      urls.push({
        location,
        lastmod: stat.mtime.toISOString(),
      });
    }
  }

  await walk(rootDir);
  urls.sort((a, b) => a.location.localeCompare(b.location));
  return urls;
}

function buildSitemap(urls) {
  const entries = urls
    .map(
      ({ location, lastmod }) => `  <url>
    <loc>${escapeXml(location)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

function buildTextSitemap(urls) {
  return `${urls.map(({ location }) => location).join("\n")}\n`;
}

function buildRepoDirectoryPage({ activeRepos, archivedRepos, generatedAt }) {
  const activeCards = activeRepos.map((repo) => repoCard(repo, "Active")).join("\n");
  const archivedCards = archivedRepos.map((repo) => repoCard(repo, "Archived")).join("\n");
  const generatedLabel = formatGeneratedDate(generatedAt);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Repository Directory | Fractal Media Infrastructure</title>
  <meta name="description" content="The full public repository atlas for the instance001 GitHub ecosystem, including current active lanes and archived historical repos.">
  <link rel="canonical" href="${siteUrl}/repo-directory.html">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="icon" type="image/x-icon" href="assets/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="assets/favicon-16.png">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="index.html">
        <img class="brand-mark" src="assets/fmi-mark.png" alt="FMI brand mark">
        <span class="brand-text">Fractal Media Infrastructure</span>
      </a>
      <nav class="topnav" aria-label="Primary">
        <a href="about.html">About</a>
        <a href="branches.html">Branches</a>
        <a href="projects.html">Projects</a>
        <a href="public-record.html">Public Record</a>
        <a href="ai-fair-go.html">AI Fair-Go</a>
        <a href="repo-directory.html" aria-current="page">Repo Atlas</a>
        <a href="independent-convergence.html">Convergence</a>
        <a href="stewardship.html">Stewardship</a>
        <a href="google-play.html">Google Play</a>
        <a href="contact.html">Contact</a>
      </nav>
    </header>

    <main class="page">
      <section class="page-hero">
        <p class="eyebrow">Full public repository atlas</p>
        <h1>The full instance001 repository directory, published on the FMI site.</h1>
        <p>
          This page mirrors the current public repository index for <code>@instance001</code> and republishes it as a stable HTML directory on <code>instance001.github.io</code>. Active repositories represent the current working lanes. Archived repositories remain public for continuity, provenance, and historical context.
        </p>
        <div class="hero-actions">
          <a class="button button-primary" href="https://github.com/instance001">Visit GitHub profile</a>
          <a class="button button-secondary" href="projects.html">Open curated project lanes</a>
          <a class="button button-secondary" href="https://github.com/instance001/Whatisthisgithub">Source index on GitHub</a>
        </div>
      </section>

      <section class="page-section">
        <div class="section-heading">
          <p class="eyebrow">How to use this page</p>
          <h2>A site-native bridge into the whole public corpus.</h2>
        </div>
        <div class="repo-directory-copy">
          <p>
            Search engines can crawl this page directly from <code>instance001.github.io</code>, which gives the wider GitHub ecosystem a clearer discovery surface than a single landing page alone.
          </p>
          <p>
            If you want the strongest current lanes first, start in the active section. If you are tracing evolution, provenance, or superseded work, use the archived section below. For a shorter editorial path, use the curated overview on <a href="projects.html">Projects</a>.
          </p>
          <p class="eyebrow">Synced from Whatisthisgithub on ${escapeHtml(generatedLabel)}</p>
        </div>
      </section>

      <section class="page-section repo-summary-grid">
        <article class="stack-card">
          <p class="card-kicker">Active repositories</p>
          <h2>${activeRepos.length}</h2>
          <p>Current lanes, maintained projects, and present entry points in the ecosystem.</p>
        </article>
        <article class="stack-card">
          <p class="card-kicker">Archived repositories</p>
          <h2>${archivedRepos.length}</h2>
          <p>Historical repos retained for continuity, context, and auditability.</p>
        </article>
        <article class="stack-card">
          <p class="card-kicker">Source of truth</p>
          <h2>Whatisthisgithub</h2>
          <p>The repo list is generated from the public index repo so the site can stay synchronized with minimal manual upkeep.</p>
        </article>
      </section>

      <section class="page-section">
        <div class="section-heading">
          <p class="eyebrow">Current lanes</p>
          <h2>Active repositories</h2>
        </div>
        <div class="repo-directory-grid">
${activeCards}
        </div>
      </section>

      <section class="page-section">
        <div class="section-heading">
          <p class="eyebrow">Historical lanes</p>
          <h2>Archived repositories</h2>
        </div>
        <div class="repo-directory-grid">
${archivedCards}
        </div>
      </section>
    </main>

    <footer class="footer">
      <p>Fractal Media Infrastructure</p>
      <p>Independent public-interest AI research, tooling, and media.</p>
      <p>ABN 37 986 304 856</p>
    </footer>
  </div>
</body>
</html>
`;
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
              <a href="${escapeAttribute(repo.url)}">Open repository</a>
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

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeXml(value) {
  return escapeHtml(value);
}

function formatGeneratedDate(value) {
  return new Intl.DateTimeFormat("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
