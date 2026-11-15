#!/usr/bin/env node
// Regenerates index.html from the owner's public GitHub repos that publish a Pages site.
// Runs in GitHub Actions (uses GITHUB_TOKEN to avoid rate limits) or locally (set GH_TOKEN).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const OWNER = process.env.GITHUB_REPOSITORY_OWNER || "badrian404";
const SELF = `${OWNER.toLowerCase()}.github.io`; // the aggregator repo itself — never list it
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "sites-aggregator",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`GitHub API ${res.status} for ${path}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Hand-written one-sentence descriptions override whatever the repo's own description says.
// Add a repo name here to control exactly how it reads on the welcome page.
let overrides = {};
try {
  overrides = JSON.parse(readFileSync(join(ROOT, "descriptions.json"), "utf8"));
} catch {
  overrides = {};
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function listPublicRepos() {
  const repos = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh(`/users/${OWNER}/repos?per_page=100&type=owner&sort=full_name&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.filter((r) => !r.private && !r.fork && !r.archived && r.has_pages);
}

async function pagesUrl(repo) {
  try {
    const p = await gh(`/repos/${OWNER}/${repo.name}/pages`);
    if (p.status === "built" || p.status === "building") return p.html_url;
    return null;
  } catch (e) {
    if (e.status === 404) return null; // Pages toggled on the repo but nothing built
    throw e;
  }
}

function describe(repo) {
  if (overrides[repo.name]) return overrides[repo.name];
  if (repo.description && repo.description.trim()) return repo.description.trim();
  return "A published site — no description yet.";
}

function card(site) {
  return `      <li class="card">
        <a class="card-link" href="${escapeHtml(site.url)}">
          <h2>${escapeHtml(site.title)}</h2>
          <p>${escapeHtml(site.description)}</p>
          <span class="go">Open site &rarr;</span>
        </a>
      </li>`;
}

function render(sites) {
  const updated = new Date().toISOString().slice(0, 10);
  const cards = sites.map(card).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(OWNER)} — sites</title>
  <meta name="description" content="A directory of ${OWNER}'s public sites." />
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0f17;
      --bg-grad: radial-gradient(1200px 600px at 20% -10%, #15213a 0%, transparent 60%),
                 radial-gradient(900px 500px at 100% 0%, #1a2b22 0%, transparent 55%);
      --card: #121826;
      --card-hover: #182133;
      --border: #222c40;
      --text: #e8edf6;
      --muted: #9aa7bd;
      --accent: #5e9bff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg-grad), var(--bg);
      color: var(--text);
      font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      padding: 16px;
    }
    .wrap { max-width: 760px; margin: 0 auto; padding: 48px 0 64px; }
    header { margin-bottom: 36px; }
    h1 { font-size: clamp(28px, 6vw, 40px); margin: 0 0 8px; letter-spacing: -0.02em; }
    .lede { color: var(--muted); margin: 0; font-size: 17px; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
    .card { border: 1px solid var(--border); border-radius: 14px; background: var(--card); transition: background .15s, border-color .15s, transform .15s; }
    .card:hover { background: var(--card-hover); border-color: var(--accent); transform: translateY(-2px); }
    .card-link { display: block; padding: 20px 22px; text-decoration: none; color: inherit; }
    .card h2 { margin: 0 0 6px; font-size: 20px; }
    .card p { margin: 0 0 10px; color: var(--muted); }
    .go { color: var(--accent); font-size: 14px; font-weight: 600; }
    footer { margin-top: 40px; color: var(--muted); font-size: 13px; text-align: center; }
    footer a { color: var(--accent); }
  </style>
</head>
<body>
  <main class="wrap">
    <header>
      <h1>${escapeHtml(OWNER)}</h1>
      <p class="lede">Everything I've published to the web, in one place.</p>
    </header>
    <ul>
${cards}
    </ul>
    <footer>
      ${sites.length} site${sites.length === 1 ? "" : "s"} · updated ${updated} ·
      <a href="https://github.com/${escapeHtml(OWNER)}">github.com/${escapeHtml(OWNER)}</a>
    </footer>
  </main>
</body>
</html>
`;
}

async function main() {
  const repos = await listPublicRepos();
  const sites = [];
  for (const repo of repos) {
    if (repo.name.toLowerCase() === SELF) continue; // don't list the home page itself
    const url = repo.homepage?.startsWith("http") ? repo.homepage : await pagesUrl(repo);
    if (!url) continue;
    sites.push({ name: repo.name, title: repo.name, url, description: describe(repo) });
  }
  sites.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  writeFileSync(join(ROOT, "index.html"), render(sites));
  console.log(`Wrote index.html with ${sites.length} site(s):`);
  for (const s of sites) console.log(`  - ${s.title}: ${s.url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
