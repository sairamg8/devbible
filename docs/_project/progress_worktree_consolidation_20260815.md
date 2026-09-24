---
name: devbible-worktree-consolidation-20260815
description: 2026-08-15 — every devbible worktree and branch merged into main and deleted; main is now the only place work happens, and it builds 0 warnings / 0 broken links
metadata:
  type: project
---

# devbible — EVERYTHING CONSOLIDATED INTO `main` (2026-08-15)

## ✅ RE-VERIFIED 2026-08-16 — still true, nothing to do

Checked by session `8e7b6e12` on the user's instruction (*"make sure every worktree under
devbible has to be merged and deleted"*). **The state is already the desired one** — there was
nothing to merge and nothing to delete:

| Check | Result |
|---|---|
| `git worktree list` | **one entry**, the main checkout `/mnt/Storage/Backup/Knowledge/devbible` |
| `git worktree prune -v` | **no output** — no stale metadata, and `.git/worktrees` does not exist |
| `git branch -vv` | **`main` only** |
| `git branch -r` | **`origin/main` only** (plus `origin/HEAD`) |
| `git branch --no-merged main` | **empty** — nothing unmerged anywhere |
| Sibling directories | `ls -d …/devbible*` returns **only the checkout itself** |

⚠️ **Two corrections to the table below, made in the same pass:**
1. 🔴 **The checkout path said `/run/media/sairam/…`, which does not exist.** The store mounts at
   **`/mnt/Storage`** — the exact trap `~/.claude/CLAUDE.md` warns about. Fixed.
2. 🔴 **"in sync with `origin/main`" is no longer true** — as of 2026-08-16 `main` is **67
   commits ahead and unpushed**, and only ~27 of them are Docker chunk D's. The rest belong to
   **TypeScript Part A (18), TS Part B (14) and Docker chunk C (8)**, some possibly mid-phase.
   **Do not push unasked** — it would publish other live sessions' in-progress work. The sync
   claim is removed from the table rather than updated, because it will go stale again.

🔴🔴 **There are no worktrees and no branches any more. There is only `main`.**

The user's instruction, verbatim:

> *"commit every uncommitted branch to main and delete everything"*

preceded by a request to audit *"memories and every other worktrees which are not merged
to this branch"*.

**Read this before acting on any older memory that names a worktree.** Roughly a dozen
memory files in this store still say "worktree `devbible-…`, branch `…`, ⚠️ not merged".
**Every one of those directories is gone.** The content is not — it is all on `main`.

---

## Final state

| | |
|---|---|
| Checkout | `/mnt/Storage/Backup/Knowledge/devbible` — **the only one** |
| Branches | **`main` only**, local and remote |
| Worktrees | **none** |
| Head | `97b78f5c` *Merge branch 'docker-podman'*, pushed |
| Build | `yarn build` after `rm -rf .docusaurus build node_modules/.cache` → **exit 0, 0 warnings, 0 broken links** |
| Corpus | **2,289 md files · 405,880 lines · 26 technologies** |

⚠️ **9 files exceed the 300-line cap, all pre-existing and none from this merge** — 7 in
the imported Storybook corpus (`13-build-and-configuration`, `17-theming-colors-and-fonts`,
`07-accessibility-testing`, `04-controls-and-args`, `05-interaction-testing`, up to 596
lines) and 2 in `docs/reviews/` (which are review records, not topic pages). They belong
to the unvalidated frontend import, not to any written track.

## What was merged

Three branches carried unmerged commits. Ten branches and eight worktrees existed in total.

| Branch | Unmerged commits | Content | Conflicts |
|---|---|---|---|
| `docker-podman` | **23** | syllabus + phases 0–3, 83 files, **+11,504 lines** | `docs/README.md`, `src/pages/index.js` |
| `nginx` | **16** + uncommitted | syllabus + phases 0–2, 55 files, **+8,068 lines** | none |
| `typescript-pages` | **12** | phase 3 Generics 11/14, 31 files, **+4,452 lines** | `docs/README.md` |
| `js-lane-a` `js-lane-b` `mongodb-pages` `react-p11-part-a` `react-phase-14` `react-phase-7` `frontend-merge` | **0** each | already merged | — |

🔴 **nginx also had ~1,030 lines of finished pages that were never committed** — two whole
chunked topics existing only as untracked files, protected by nothing:

- `phase-2-server-and-location/06-internal-redirects/` (4 files, 499 lines)
- `phase-2-server-and-location/07-error-page/` (4 files, 528 lines)
- plus board updates and two prev/next footer fixes

Committed as `ca4c239` before the merge. **This is the concrete cost of an unmerged
worktree** — see [[devbible-unmerged-worktree-is-worse-than-none]].

## How the conflicts were resolved

All three conflicts were the **same shape**: two sessions each editing their own row in a
shared board file. The resolution was always *keep both sides' own rows*, never pick a side.

- **`docs/README.md` claims table** — `main` had the newer JavaScript lane A/B rows,
  `typescript-pages` the newer TypeScript row; kept 2 + 1. For Docker, kept `main`'s Nginx
  row and the branch's Docker row, and **replaced both "Unclaimed" rows** with *"None —
  every technology in the brief is now claimed, in progress or complete"*, since neither
  technology is unstarted any more.
- **`docs/README.md` technology table** — MongoDB row from `main` (34 pages, newer),
  Docker row from the branch.
- **`src/pages/index.js`** — each side had activated its *own* homepage card and left the
  other's disabled. Kept **both** `summarise()` consts and **both** active cards (Docker
  10, Nginx 11). ⚠️ This is the one that would have silently regressed: naively taking
  either side would have de-activated a live technology's card on the homepage.

`src/data/progress.js` and `sidebars.js` auto-merged correctly in all three cases —
verified afterwards that both `docker:` and `nginx:` keys and both sidebars survived, and
that TypeScript's phase 3 row kept `pagesPlanned: 14` (mid-phase, so `phaseStatus()`
returns `'writing'` not `'written'`).

## Order of operations that worked

1. Record every branch tip to a file first (recovery net).
2. Commit the loose nginx work **on its own branch**, not on `main`.
3. Merge smallest-first: `typescript-pages` (12) → `nginx` (16) → `docker-podman` (23).
   Smallest-first keeps each conflict small and independent.
4. **Clean rebuild + link tally BEFORE deleting anything** — this is the point of no return.
5. **Push `main`** so the consolidated work is not sitting on one disk.
6. `git worktree remove --force` ×8, then `git branch -d` ×10.
   🔴 **`-d`, never `-D`** — `-d` refuses to delete an unmerged branch, so git itself is
   the final check that nothing is lost. All ten deleted without complaint.
7. `git push origin --delete frontend-merge react-phase-7` (both verified at 0 unique
   commits vs `origin/main` first).

## Two orphaned directories, also deleted

`devbible-frontend` (1.5G) and `devbible-react` (1.3G) were **not in `git worktree list`**
— already orphaned before this session, their gitdir pruned, so `git -C … status` returned
*"fatal: not a git repository: (null)"*.

They were verified safe to delete by three independent checks, since git could not speak
for them:

1. Their branches (`frontend-merge`, `react-phase-7`) were at **0 unique commits**.
2. `diff -rq` against `main` showed only **older** structure — flat `.md` files where
   `main` has the chunked directories from the Express depth pass.
3. **Newest file mtimes were 2026-08-14**, matching their branch tips exactly
   (`devbible-react`'s newest files are phase-10 topics 18/19 + README, which *is* the tip
   commit "React Phase 10 COMPLETE — topics 18, 19 and the phase close"), so no post-merge
   edits existed.

**2.8G reclaimed.**

## Also fixed

`.gitignore` had `..docusaurus-` — leading double dot, no wildcard, so it matched
**nothing** and every worktree's cache dir showed as untracked. Now `.docusaurus-*`
(commit `c9d77df`).

## What this changes for future sessions

- **Work on `main`.** Do not recreate a worktree unless the user asks.
- The shared-checkout rules are **live again and matter more**: ⛔ **never `git add -A`**,
  stage explicit paths, touch only your own language's rows in `src/data/progress.js` and
  `docs/README.md`.
- 🔴 **A build break on `main` is now genuinely yours.** The old excuse — *"other sessions'
  committed breakage fails my build too"* — is spent. The baseline is **0 warnings, 0
  broken links**. Earlier memories citing "113 breaks at baseline (React 89 / TypeScript 18
  / JavaScript 6)" are **stale**; those are fixed.
- `~/.claude/CLAUDE.md` rule 11 carries a banner saying all of this, and every worktree
  row in its lock table is corrected. Mirrored to `shared/global-claude-md/`.

## Tracks now free to pick up, all on `main`

| Track | State | Next |
|---|---|---|
| **Docker & Podman** | 63 / 192 | Phase 4 · Build strategy, topic 01 |
| **Nginx** | 48 / 210 | Phase 3 · Serving static files and SPAs |
| **TypeScript** | 54 / 187 | Phase 3 topic 12 · `const` type parameters |
| **MongoDB** | 34 / 82 | Phase 6 · Aggregation pipeline (⚠️ 4 Manual pages already fetched) |
| **JavaScript lane A** | phase 5 at 17/26 | Phase 5 topic 18 · `Object` statics |
| **JavaScript lane B** | phase 11 at 2/21 | Phase 11 topic 08 · Aborting and timing out |
| **React** | phases 0–11, 14 done | Phases 12 (Data and state) and 13 (Routing) |
| **Redis** | syllabus only | Phase 0 · How Redis runs |

Related: [[devbible-progress-overall-snapshot]] · [[devbible-parallel-sessions]] ·
[[devbible-unmerged-worktree-is-worse-than-none]]
