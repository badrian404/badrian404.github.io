# badrian404.github.io

My personal landing page: a single welcome page that links to every public site I've
published, each with a one-sentence description. Live at **https://badrian404.github.io/**.

## How it stays current

`index.html` is **generated**, not hand-edited. A GitHub Action
([`.github/workflows/update.yml`](.github/workflows/update.yml)) runs every day (and on
demand) and:

1. asks the GitHub API for every public, non-fork repo on this account that has GitHub
   Pages enabled,
2. keeps the ones with a built Pages site,
3. rewrites `index.html` with a card per site, and
4. commits the result if anything changed.

So when I publish a new Pages site, it shows up here on its own within a day — no manual
step.

## Changing a description

One-sentence descriptions live in [`descriptions.json`](descriptions.json), keyed by repo
name. Edit a line there (or add a new repo) and the next run picks it up. A repo not listed
in that file falls back to its GitHub "About" description.

## Run it locally

```bash
node scripts/generate.mjs        # no token: works but may hit API rate limits
GH_TOKEN=xxxx node scripts/generate.mjs   # authenticated, recommended
```
