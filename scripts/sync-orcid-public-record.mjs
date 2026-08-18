import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteRoot = path.resolve(__dirname, "..");
const publicRecordPath = path.join(siteRoot, "data", "public-record.json");

const orcidId = "0009-0007-5750-5236";
const orcidProfileUrl = `https://orcid.org/${orcidId}`;
const orcidWorksUrl = `https://pub.orcid.org/v3.0/${orcidId}/works`;
const philPeoplePublicationsUrl = "https://philpeople.org/profiles/anthony-paterson/publications";

async function main() {
  const data = JSON.parse(await fs.readFile(publicRecordPath, "utf8"));
  const works = await fetchPublicOrcidWorks();
  const uniqueWorks = uniqueWorksByTitle(works);
  const checkedDate = new Date().toISOString().slice(0, 10);
  const workCount = uniqueWorks.length;
  const workLabel = `${workCount} ORCID-listed ${workCount === 1 ? "work" : "works"}`;

  updateIndexedWritingBadge(data, workLabel);
  updateScholarlyIndexRecord(data, {
    checkedDate,
    workCount,
    workLabel,
    titles: uniqueWorks.map((work) => work.title),
  });

  await fs.writeFile(publicRecordPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Synced ${workLabel} from ${orcidProfileUrl}`);
}

async function fetchPublicOrcidWorks() {
  const response = await fetch(orcidWorksUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "instance001-public-record-sync",
    },
  });

  if (!response.ok) {
    throw new Error(`ORCID works request failed with ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return (data.group || [])
    .flatMap((group) => group["work-summary"] || [])
    .map((summary) => ({
      title: summary.title?.title?.value?.trim() || "",
      putCode: summary["put-code"],
      type: summary.type || "",
    }))
    .filter((work) => work.title);
}

function uniqueWorksByTitle(works) {
  const byTitle = new Map();

  for (const work of works) {
    const key = normalizeTitle(work.title);
    if (!byTitle.has(key)) {
      byTitle.set(key, work);
    }
  }

  return [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,:;!?'"()[\]{}-]/g, "")
    .trim();
}

function updateIndexedWritingBadge(data, value) {
  const badge = data.page.badges.find((item) => item.label === "Indexed writing");
  if (!badge) {
    throw new Error('Could not find "Indexed writing" badge.');
  }

  badge.value = value;
  badge.href = orcidProfileUrl;
  badge.rel = "me";
}

function updateScholarlyIndexRecord(data, { checkedDate, workCount, workLabel, titles }) {
  const record = data.records.find((item) => item.type === "Scholarly index");
  if (!record) {
    throw new Error('Could not find "Scholarly index" record.');
  }

  record.date = `ORCID checked ${checkedDate}`;
  record.datetime = checkedDate;
  record.title = "ORCID scholarly works mirrored through public paper surfaces";
  record.body = `${sentenceCaseCount(workCount)} FMI scholarly works are currently listed on the public ORCID record. FMI treats ORCID as the structured public counter for papers that are also maintained through PhilPapers / PhilArchive-facing publication workflows, with source repositories retained for context, licensing, and public review.`;

  record.facts = [
    {
      label: "ORCID-listed works",
      value: workLabel,
    },
    {
      label: "Current titles",
      value: joinTitles(titles),
    },
    {
      label: "Mirror context",
      value: "PhilPapers / PhilArchive-facing uploads are added to ORCID at the same time where applicable.",
    },
  ];

  record.links = [
    {
      label: "ORCID record",
      href: orcidProfileUrl,
      rel: "me",
    },
    {
      label: "PhilPeople profile",
      href: "https://philpeople.org/profiles/anthony-paterson",
    },
    {
      label: "Publication list",
      href: philPeoplePublicationsUrl,
    },
  ];
}

function joinTitles(titles) {
  const formatter = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  });
  return formatter.format(titles);
}

function sentenceCaseCount(count) {
  const names = new Map([
    [0, "No"],
    [1, "One"],
    [2, "Two"],
    [3, "Three"],
    [4, "Four"],
    [5, "Five"],
    [6, "Six"],
    [7, "Seven"],
    [8, "Eight"],
    [9, "Nine"],
    [10, "Ten"],
  ]);

  return names.get(count) || String(count);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
