import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteRoot = path.resolve(__dirname, "..");
const defaultDataPath = path.join(siteRoot, "data", "public-record.json");
const defaultOutputPath = path.join(siteRoot, "public-record.html");

export async function generatePublicRecord(options = {}) {
  const dataPath = options.dataPath ? path.resolve(options.dataPath) : defaultDataPath;
  const outputPath = options.outputPath ? path.resolve(options.outputPath) : defaultOutputPath;
  const data = JSON.parse(await fs.readFile(dataPath, "utf8"));

  validatePublicRecordData(data);
  if (options.checkLinks) {
    await checkLinks(data, {
      checkExternal: options.checkExternal,
      rootDir: path.dirname(outputPath),
    });
  }

  await fs.writeFile(outputPath, buildPublicRecordPage(data), "utf8");
  return { dataPath, outputPath };
}

function validatePublicRecordData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Public record data must be a JSON object.");
  }

  const { page, records } = data;
  requiredObject(page, "page");
  requiredString(page.title, "page.title");
  requiredString(page.description, "page.description");
  requiredString(page.canonical, "page.canonical");
  requiredObject(page.hero, "page.hero");
  requiredArray(page.summary, "page.summary");
  requiredArray(page.badges, "page.badges");
  requiredObject(page.footerPanel, "page.footerPanel");
  requiredArray(records, "records");

  for (const [index, summary] of page.summary.entries()) {
    requiredString(summary.date, `page.summary[${index}].date`);
    requiredString(summary.title, `page.summary[${index}].title`);
    requiredString(summary.body, `page.summary[${index}].body`);
  }

  for (const [index, badge] of page.badges.entries()) {
    requiredString(badge.label, `page.badges[${index}].label`);
    requiredString(badge.value, `page.badges[${index}].value`);
    requiredString(badge.href, `page.badges[${index}].href`);
  }

  for (const [index, record] of records.entries()) {
    requiredString(record.type, `records[${index}].type`);
    requiredString(record.date, `records[${index}].date`);
    requiredString(record.datetime, `records[${index}].datetime`);
    requiredString(record.title, `records[${index}].title`);
    requiredString(record.body, `records[${index}].body`);
    if (record.facts !== undefined) {
      requiredArray(record.facts, `records[${index}].facts`);
    }

    if (record.links !== undefined) {
      requiredArray(record.links, `records[${index}].links`);
    }

    if (record.widget) {
      requiredObject(record.widget, `records[${index}].widget`);
      requiredString(record.widget.loadingText, `records[${index}].widget.loadingText`);
      requiredString(record.widget.fallbackHref, `records[${index}].widget.fallbackHref`);
      requiredString(record.widget.scriptSrc, `records[${index}].widget.scriptSrc`);
    }

    if (record.orcidNote) {
      requiredObject(record.orcidNote, `records[${index}].orcidNote`);
      requiredString(record.orcidNote.text, `records[${index}].orcidNote.text`);
      requiredString(record.orcidNote.label, `records[${index}].orcidNote.label`);
      requiredString(record.orcidNote.href, `records[${index}].orcidNote.href`);
    }
  }
}

function requiredObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function requiredArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

async function checkLinks(data, { checkExternal, rootDir }) {
  const links = collectLinks(data);
  const failures = [];

  for (const link of links) {
    if (isAnchorOrMailto(link.href)) {
      continue;
    }

    if (isExternalUrl(link.href)) {
      if (checkExternal) {
        const ok = await externalLinkLooksReachable(link.href);
        if (!ok) {
          failures.push(`External link did not respond cleanly: ${link.href}`);
        }
      }
      continue;
    }

    const localPath = link.href.split("#")[0];
    if (!localPath) {
      continue;
    }

    const absolutePath = path.resolve(rootDir, localPath);
    try {
      await fs.access(absolutePath);
    } catch {
      failures.push(`Missing local link target: ${link.href}`);
    }
  }

  if (failures.length) {
    throw new Error(`Public record link check failed:\n${failures.join("\n")}`);
  }
}

function collectLinks(data) {
  return [
    ...(data.page.hero.actions || []),
    ...(data.page.badges || []),
    ...(data.page.footerPanel.facts || []),
    ...data.records.flatMap((record) => record.links || []),
    ...data.records
      .filter((record) => record.orcidNote)
      .map((record) => ({ href: record.orcidNote.href })),
    ...data.records
      .filter((record) => record.widget)
      .map((record) => ({ href: record.widget.fallbackHref })),
  ].filter((link) => link.href);
}

function isAnchorOrMailto(href) {
  return href.startsWith("#") || href.startsWith("mailto:");
}

function isExternalUrl(href) {
  return /^https?:\/\//i.test(href);
}

async function externalLinkLooksReachable(href) {
  try {
    const response = await fetch(href, { method: "HEAD", redirect: "follow" });
    if (response.ok || response.status === 403 || response.status === 405) {
      return true;
    }

    const getResponse = await fetch(href, { method: "GET", redirect: "follow" });
    return getResponse.ok || getResponse.status === 403;
  } catch {
    return false;
  }
}

function buildPublicRecordPage(data) {
  const { page, records } = data;

  return `<!DOCTYPE html>
<!-- Generated from data/public-record.json by scripts/generate-public-record.mjs. -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeAttribute(page.description)}">
  <link rel="canonical" href="${escapeAttribute(page.canonical)}">
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
${siteHeader("public-record.html")}

    <main class="page public-record-page">
      <section class="page-hero">
        <p class="eyebrow">${escapeHtml(page.hero.eyebrow)}</p>
        <h1>${escapeHtml(page.hero.heading)}</h1>
        <p>
          ${escapeHtml(page.hero.body)}
        </p>
        <div class="hero-actions">
${page.hero.actions.map((action) => `          ${buttonLink(action)}`).join("\n")}
        </div>
      </section>

      <section class="page-section record-summary-grid" aria-label="Public record summary">
${page.summary.map(summaryCard).join("\n")}
      </section>

      <section class="page-section">
        <div class="section-heading">
          <p class="eyebrow">Record badges</p>
          <h2>At-a-glance signals.</h2>
        </div>
        <div class="record-badge-grid">
${page.badges.map(recordBadge).join("\n")}
        </div>
      </section>

      <section class="page-section" id="record-ledger">
        <div class="section-heading">
          <p class="eyebrow">Dated ledger</p>
          <h2>Public records and what they signal.</h2>
        </div>
        <div class="record-ledger">
${records.map(recordEntry).join("\n\n")}
        </div>
      </section>

      <section class="page-section record-footer-panel">
        <div>
          <p class="eyebrow">${escapeHtml(page.footerPanel.eyebrow)}</p>
          <h2>${escapeHtml(page.footerPanel.heading)}</h2>
          <p>
            ${escapeHtml(page.footerPanel.body)}
          </p>
        </div>
        <div class="record-contact-card">
${page.footerPanel.facts.map(contactFact).join("\n")}
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

function siteHeader(currentPath) {
  const items = [
    ["about.html", "About"],
    ["branches.html", "Branches"],
    ["projects.html", "Projects"],
    ["public-record.html", "Public Record"],
    ["ai-fair-go.html", "AI Fair-Go"],
    ["repo-directory.html", "Repo Atlas"],
    ["independent-convergence.html", "Convergence"],
    ["stewardship.html", "Stewardship"],
    ["google-play.html", "Google Play"],
    ["contact.html", "Contact"],
  ];

  return `    <header class="topbar">
      <a class="brand" href="index.html">
        <img class="brand-mark" src="assets/fmi-mark.png" alt="FMI brand mark">
        <span class="brand-text">Fractal Media Infrastructure</span>
      </a>
      <nav class="topnav" aria-label="Primary">
${items.map(([href, label]) => `        <a href="${href}"${href === currentPath ? ' aria-current="page"' : ""}>${label}</a>`).join("\n")}
      </nav>
    </header>`;
}

function summaryCard(summary) {
  return `        <article class="record-summary-card">
          <p class="record-date">${escapeHtml(summary.date)}</p>
          <h2>${escapeHtml(summary.title)}</h2>
          <p>${escapeHtml(summary.body)}</p>
        </article>`;
}

function recordBadge(badge) {
  return `          <a class="record-badge" href="${escapeAttribute(badge.href)}"${relAttribute(badge)}>
            <span>${escapeHtml(badge.label)}</span>
            <strong>${escapeHtml(badge.value)}</strong>
          </a>`;
}

function recordEntry(record) {
  const classes = record.featured
    ? "record-entry record-entry-featured"
    : "record-entry";

  return `          <article class="${classes}">
            <div class="record-entry-meta">
              <span class="record-pill">${escapeHtml(record.type)}</span>
              <time datetime="${escapeAttribute(record.datetime)}">${escapeHtml(record.date)}</time>
            </div>
            <h3>${escapeHtml(record.title)}</h3>
            <p>
              ${escapeHtml(record.body)}
            </p>
${record.widget ? recordWidget(record.widget) : ""}
${record.orcidNote ? orcidNote(record.orcidNote) : ""}
${record.facts?.length ? `            <dl class="record-facts">
${record.facts.map(recordFact).join("\n")}
            </dl>
` : ""}
${record.links?.length ? `            <p class="card-links">
${record.links.map((link) => `              ${plainLink(link)}`).join("\n")}
            </p>
` : ""}
          </article>`;
}

function recordWidget(widget) {
  return `            <div class="record-widget">
              <div class="ppl-widget-container">${escapeHtml(widget.loadingText)} (or view them <a href="${escapeAttribute(widget.fallbackHref)}">here</a>)</div>
              <script type="text/javascript" src="${escapeAttribute(widget.scriptSrc)}"></script>
            </div>
`;
}

function orcidNote(note) {
  return `            <p class="record-orcid-note">${escapeHtml(note.text)} <a href="${escapeAttribute(note.href)}"${relAttribute(note)}>${escapeHtml(note.label)}</a></p>
`;
}

function recordFact(fact) {
  return `              <div>
                <dt>${escapeHtml(fact.label)}</dt>
                <dd>${escapeHtml(fact.value)}</dd>
              </div>`;
}

function contactFact(fact) {
  const value = fact.href
    ? `<a href="${escapeAttribute(fact.href)}"${relAttribute(fact)}>${escapeHtml(fact.value)}</a>`
    : escapeHtml(fact.value);

  return `          <p class="metric-label">${escapeHtml(fact.label)}</p>
          <p class="metric-value">${value}</p>`;
}

function buttonLink(link) {
  const style = link.style === "primary" ? "button-primary" : "button-secondary";
  return `<a class="button ${style}" href="${escapeAttribute(link.href)}"${relAttribute(link)}>${escapeHtml(link.label)}</a>`;
}

function plainLink(link) {
  return `<a href="${escapeAttribute(link.href)}"${relAttribute(link)}>${escapeHtml(link.label)}</a>`;
}

function relAttribute(link) {
  return link.rel ? ` rel="${escapeAttribute(link.rel)}"` : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = new Set(process.argv.slice(2));
  generatePublicRecord({
    checkLinks: args.has("--check-links") || args.has("--check-external-links"),
    checkExternal: args.has("--check-external-links"),
  })
    .then(({ dataPath, outputPath }) => {
      console.log(`Generated ${path.relative(siteRoot, outputPath)} from ${path.relative(siteRoot, dataPath)}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
