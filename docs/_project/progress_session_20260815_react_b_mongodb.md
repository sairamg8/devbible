---
name: devbible-session-20260815-react-b-mongodb
description: Session record 2026-08-14/15 — React Part B (Phase 14) finished and merged, then MongoDB picked up and taken from 5 to 34 of 82 topics; worktree workflow, per-topic board cadence, and the traps found
metadata:
  type: progress
---

:::danger CONSOLIDATED 2026-08-15 — THE WORKTREE IN THIS FILE NO LONGER EXISTS
Every devbible worktree and branch was **merged into `main` and DELETED** on 2026-08-15
(*"commit every uncommitted branch to main and delete everything"*). **All the content
described below is on `main`** at `/run/media/sairam/Storage/Backup/Knowledge/devbible`
— nothing was lost, every branch was verified at 0 unique commits first. Ignore any
"worktree", "branch", "not merged" or "merge at the phase close" instruction below and
**work on `main`**. `main` builds 0 warnings / 0 broken links, so a break there is yours.
Full record: `progress_worktree_consolidation_20260815.md`.
:::

# Session 2026-08-14 → 2026-08-15 — React Part B closed, MongoDB to 34/82

Session `05921047`. Started on *"pick react b"*, ran overnight on *"complete the assigned task
… do not wait for me … take recommended action to finish the job"*, then on *"Incase if you
finish please pick mongodb … make sure to create new worktree"*. Ended on *"save current
session to memory and enough"*.

## What was delivered

| | |
|---|---|
| **React Phase 14 · Testing React** | ✅ **COMPLETE 14/14** — 28 markdown files, 4,986 lines, 0 over the 300-line cap, 0 broken links in `docs/react/`, **merged into `main`** |
| **MongoDB Phases 1–5** | ✅ **COMPLETE** — Phase 1 types (6), Phase 2 mongosh (5), Phase 3 schema design (6), Phase 4 CRUD (6), Phase 5 query operators (6) = **29 topics written**, taking MongoDB from **5 → 34 of 82**, all **merged into `main`** |
| **Builds** | clean at every phase close; `docs/mongodb/` and `docs/react/` both **0 broken links** (6 remain in `javascript`/`typescript` — other sessions', deliberately untouched) |

Detail lives in [[devbible-react-phase14]] and [[devbible-mongodb-pages-progress]]; this file
is the session-level record.

## 🔴 The worktree change, mid-session

The user asked all sessions to move: *"Can you write now onwards all your explanations in
complete new worktree ?"*. Two were created:

| Worktree | Branch | For | State |
|---|---|---|---|
| `devbible-react-p14` | `react-phase-14` | React Part B | ✅ merged into `main` |
| `devbible-mongodb` | `mongodb-pages` | MongoDB | ✅ merged into `main` after every phase |

**`node_modules`:** React's was installed with `yarn install` (~minutes); MongoDB's was
**symlinked** to the main checkout's, which is instant and worked for every build. **Symlink
it.**

**Isolated builds:** `DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-<name> yarn build
--out-dir build-<name>`, then tally by language:
`grep "source page path" | sed 's#.*/devbible/docs/##' | cut -d/ -f1 | sort | uniq -c`.

⚠️ **Merge back at every phase close, not at the end.** Five small merges were painless; the
one large React merge conflicted in all three shared board files
(`docs/README.md`, `docs/react/pages/README.md`, `src/data/progress.js`) and each was resolved
by **keeping both sides' rows**.

## Traps found, in the order they cost time

🔴 **A directory conversion orphans inbound links.** Every chunked React topic broke 4–8 links
in sibling bodies, footers and the phase README. **Grep and repoint before creating the
directory.** Automated with `close-topic.py` (see below).

🔴 **`git commit --only <paths>` silently skips untracked files** — it committed 5 of 6 files
that way once. `git add` the new file first.

🔴 **A build failure in another part's directory is a merge question, not a debugging one.**
The React build failed on a Part A file; the fix was already on `main`, so merging `main` in
resolved it. Do not edit another session's directory to fix a build.

🔴 **Cite only pages actually fetched.** Twice a page was drafted citing documentation from
memory — the Jest snapshot page and the MongoDB BSON Types page. Fetching confirmed most of it
and **contradicted one claim** (`--ci` reporting obsolete snapshots), which was replaced with
the documented behaviour. **Fetch first, then cite.**

⚠️ **A `cd` inside a compound Bash command changes the directory for everything after it** —
two memory-writing scripts ran in the devbible checkout instead of the store and failed with
`FileNotFoundError`. Harmless, but re-run them from the store.

## What the docs would not settle — and was left uncertain rather than invented

Recording these because *not* answering them was the correct call under rule 8:

- The mongosh **`it`** cursor continuation; a cursor **first-batch size**; a cursor **idle
  timeout** — absent from the pages consulted, so the pages say so.
- **Built-in role privileges** — `built-in-roles` renders behind a deployment-type selector and
  the `.md` variant 404s, so MongoDB Phase 2 topic 05 states the read-only principle without
  quoting role definitions.
- The Query Documents page does not explicitly say "multiple conditions imply AND", so the page
  shows it via the documented filter shape instead of quoting.

## Tooling worth recreating

`close-topic.py` (session scratchpad) — run from a worktree root after each topic:

1. repoints every inbound `NN-name.md` link if the topic became a directory,
2. updates all six board spots with **asserted** regex replaces (a drifted board fails loudly
   rather than silently doing nothing),
3. reports any file over 300 lines,
4. stages the four paths.

It removed the entire class of "board says 4/14 while disk says 6" errors.

## Cadence that worked

Write a topic → run the closer (boards + links + cap check) → commit with `git commit -F -` and
a quoted heredoc → memory every 2–3 files → phase close: clean isolated build, merge to `main`,
memory. **Boards were never more than one topic behind disk.**

Related: [[devbible-react-phase14]] · [[devbible-mongodb-pages-progress]] ·
[[devbible-react-split-parts-ab]] · [[devbible-feedback-ui-progress-and-build-cadence]] ·
[[devbible-no-new-sandbox-scripts]] · [[devbible-never-compress-to-fit-cap]]
