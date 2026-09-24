---
name: devbible-tracking-moved-to-docs-project
description: 2026-09-24 — all devbible tracking (513 files) moved from the memory store into the devbible repo at docs/_project/; the store's devbible/ is now a symlink; which tools were changed so nothing breaks; the public-repo caveat
metadata:
  type: reference
---

# devbible tracking lives in the repo at `docs/_project/` (since 2026-09-24)

**The user's order, 2026-09-24:** *"All the project related tracking etc will be move to single
folder inside docs in root"*. Asked to choose, they picked **`docs/_project/`**, **all devbible
tracking from the store**, and **"You do it now"**.

## What moved and how

- The whole store folder `claude/devbible/` — 513 files: LOCKS, every CURSOR, progress, research
  banks, ledgers, indexes, the interview bank, the version-coverage audit. `rsync -a`, then a
  second rsync + swap in one command; `diff -r` against the pre-move copy: **IDENTICAL**.
- The store's `devbible` entry is now a **symlink** → the repo's `docs/_project/`. Every path in
  every memory, hook, script and agent brief that says `devbible/LOCKS.md` still resolves.
- The files' history stays in the store repo (commit `156339d` there removed them from its index).
- The pre-move copy sits **outside both repos** at `my-learning/.devbible-premove-20260924/` as a
  safety net. Deleting it is the user's call, not a session's.

## Why the leading `_`

`docusaurus.config.js` excludes `**/_*/**` from the docs plugin, so the folder is **never built,
never in the sidebar, never on the site**. Nothing in it can fail the build.

## Tools changed so the move breaks nothing

| Tool | Change |
|---|---|
| `shared/scripts/store-commit.sh` | Resolves each path; anything landing in the devbible checkout is committed **there** (same flock as `py-commit.sh`, `Co-Authored-By` trailer), the rest in the store. Callers unchanged — git refuses a path "beyond a symbolic link", so this routing is what keeps them working. |
| `shared/scripts/recall.sh` | `find -L` — follows the symlink, so recall still searches devbible. |
| the four doc hooks (300-line cap, MDX hazards, docs-guard-bash, cadence-guard) | Skip `docs/_*` — tracking files are not pages; 88 of them exceed 300 lines by design. |
| `scripts/linkcheck.mjs`, `validate.mjs`, `ensure-search-index.mjs` | Skip `_` dirs, mirroring the build's exclude. `validate.mjs`'s ledger default is now `docs/_project`. |
| `.github/workflows/deploy.yml` | `paths-ignore: docs/_project/**` — a tracking-only push does not start the ~13-minute Pages build. |
| repo `CLAUDE.md`, both `.agents/skills`, `validation-pipeline.md`, `hook-session-start.sh`, global `CLAUDE.md` §3 + its backup, store `MEMORY.md` | Name `docs/_project/` as the home. |

`memcheck.sh devbible` needs no change — its `*/` glob follows the symlink.

## ⚠️ Known leftovers

- **Relative links that escaped the folder** (`](../shared/…)`, `](../MEMORY.md)` in ~10 index and
  board files) now dangle. Cosmetic — the folder is never built and linkcheck skips it. Rewriting them
  to absolute local paths was **refused by the auto-mode classifier** as publishing local paths into a
  public repo; `[[wiki-links]]` and in-folder links are unaffected.
- 🔴 **The devbible repo is PUBLIC** (`gh repo view` → `PUBLIC`). Pushing puts every tracking file on
  GitHub — including the interview-prep bank (compensation targets) and the user's quoted words. The
  site never shows them; the repo does. **The first push of this move waits for the user's explicit
  yes.**

Related: [[cursor-version-coverage]] · [[devbible-locks]] · [[feedback-never-run-local-build-or-check-ci]]
