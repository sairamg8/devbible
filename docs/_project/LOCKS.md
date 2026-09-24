---
name: devbible-locks
description: The LIVE devbible board — which track each session may take, the exact resume file for every track, and the rules every lock carries. Closed lanes live in LOCKS-ARCHIVE.md
metadata:
  type: project
---

# 🔴 devbible — the live board

**Your lock is the language the user named in THIS session.** Never infer it from this
table, from the git log, or from what looks idle. If none was named, **ask** — that is the
one question worth blocking on, because guessing duplicates another live session's work in
this shared checkout.

**Then:** open your track's resume file below and start at the file it names. No plan, no
confirmation, no clarifying question. *"Do not wait for me"* has been said in every one of
these orders.

> 🗄️ **More context exists and is one grep away.** This board carries only what is true
> **now**. Every closed lane, every verbatim user instruction, the chunk-split mechanics
> and the wind-down records were rotated to **[LOCKS-ARCHIVE.md](LOCKS-ARCHIVE.md)** on
> 2026-09-08, nothing dropped. Reach for it when you need *why*, or when a quiet track is
> picked up again:
> ```bash
> grep -n -A30 '§11e' devbible/LOCKS-ARCHIVE.md      # a track's full standing order
> shared/scripts/recall.sh docker chunk               # or search the whole store, cold tier included
> ```

## Not given a language?

| The user asks | Go to | Takes a lock? |
|---|---|---|
| *"what is pending"* · *"checklist"* · *"what do you suggest"* | **[CHECKLIST.md](CHECKLIST.md)** — 🔴 THE one checklist (2026-09-24): pending, upcoming, bugs, features, decisions · older ranked plan: [CURSOR-AUDIT.md](CURSOR-AUDIT.md) | no |
| *"continue DSA"* · *"continue system design"* | **[CURSOR-DSA-SYSTEM-DESIGN.md](CURSOR-DSA-SYSTEM-DESIGN.md)** | yes |
| a version bump · *"is X still current"* | `.agents/skills/devbible-currency/SKILL.md` | no |
| how many pages / how much is done | **[progress_corpus_audit_20260905.md](progress_corpus_audit_20260905.md)** — distrust any count written before it | no |
| *"version coverage"* · *"up to which version"* · *"compare LTS"* · *"free content map"* | **[CURSOR-VERSION-COVERAGE.md](CURSOR-VERSION-COVERAGE.md)** — every track: official LTS syllabus × our pages × free content (LINK/KEEP/WRITE). ⏹️ **stopped 2026-09-24** — batch 1 audits done, verify owed; batch 2 next on the user's word | no |
| *"free resources gap"* · *"w3schools vs devbible"* · *"study map"* | **[CURSOR-FREE-RESOURCES-GAP.md](CURSOR-FREE-RESOURCES-GAP.md)** — paused 2026-09-14, 0 results banked | no |

## The tracks

🟢 done · 🔵 open, unclaimed · 🟡 parked · 🔴 live, another session may hold it

| Track | State | START HERE — the exact file |
|---|---|---|
| **vite** | 🟢 18/18 topics, 188 pages, closed 2026-09-08 | [CURSOR-VITE.md](CURSOR-VITE.md) |
| **tanstack-query** | 🟢 complete, nothing owed | [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md) |
| **redux-toolkit** | 🟢 validated in full | [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md) |
| **toolchain — authoring** | 🔵 **ORM (Prisma + Mongoose)** — syllabus + card only | [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md) |
| **A2 — validating the 164 imported pages** | 🔵 **70 units pending**, eslint-oxlint 01 done 2026-09-08 · sources already banked | `yarn validate --queue --scope imported` · [VALIDATION-LEDGER.md](VALIDATION-LEDGER.md) |
| **framer-motion** | 🔵 validation lane, 8 of 18 units | `yarn validate --queue --track framer-motion --limit 5` · §10b in the archive |
| **dsa + system-design** | 🔵 DSA ph2 closed · SD ph3 scaffolded, un-started | [CURSOR-DSA-SYSTEM-DESIGN.md](CURSOR-DSA-SYSTEM-DESIGN.md) + [BRIEF-sd-phase3-caching.md](BRIEF-sd-phase3-caching.md) |
| **interview** (prep · PERN/MERN → Java → Python · 🔒 bank kept in the private store) | ⏸️ **step 1 paused** — run 1 died at the session limit 2026-09-14; 3 of 16 dims closed, 30 files safe · next **batch 1 of 4** | [CURSOR-INTERVIEW.md](CURSOR-INTERVIEW.md) |
| **angular** | 🔵 **topics 01–07 closed — 387 pages.** Topic 08 scaffolded; ✅ salvage file split + committed 2026-09-10 (`f280f4ab4`: 03–03e) · 🔴 **bank still cut off at 08.04** | [CURSOR-ANGULAR.md](CURSOR-ANGULAR.md) |
| **java** | 🟡 parked 2026-08-31 at a clean boundary, 160/232 | [JAVA-BOARD.md](JAVA-BOARD.md) — **claim a row there first** |
| **python** | 🔵 **paused 2026-09-21 by the user — phase 3 is 7/12 wired** (08 copy-and-deepcopy PARTIAL: 12 chunks committed, unwired · 09 iteration-idioms PARTIAL: 2 chunks · 4 owed defects FIXED) · resume both in *resume* mode, max 3 topics per Workflow · max 3 agents total across both lanes, devbible-topic skill | [progress_python_pages.md](progress_python_pages.md) |
| **python · phase 7** | 🔵 **paused 2026-09-21 by the user — 6/12** (owed defects + CI pins FIXED) · next **07 wheels-and-sdists**: bank complete (19-chunk plan), 0 pages written | [CURSOR-PYTHON-PHASE7.md](CURSOR-PYTHON-PHASE7.md) |
| **mongodb** | 🟡 34/82, paused cleanly | [progress_mongodb_pages.md](progress_mongodb_pages.md) |
| **javascript** | 🔵 **4 chunks A/B/C/D**, one session each · 94 topics left | [progress_javascript_split_4way.md](progress_javascript_split_4way.md) |
| **docker & podman** | 🔵 **4 chunks A/B/C/D** · 129 topics left | [progress_docker_split_4way.md](progress_docker_split_4way.md) |
| **redis** | 🔵 **3 chunks A/B/C** · 74 topics, 0 written | [progress_redis_split_3way.md](progress_redis_split_3way.md) |
| **typescript** | 🔵 **3 parts A/B/C** · 136 in scope, 90 done | [progress_typescript_build.md](progress_typescript_build.md) |
| **nginx** | 🔵 210 topics, phases 0–2 done, phase 3 next | [progress_nginx_build.md](progress_nginx_build.md) |
| **storybook** | 🔵 imported, never brought to house style | [CURSOR-STORYBOOK.md](CURSOR-STORYBOOK.md) — read only this |
| **real world** (PERN/MERN) | 🔵 storefront scenarios | [progress_realworld_run_20260901.md](progress_realworld_run_20260901.md) |
| **react** | 🟡 parked, phases 12–13 open | [progress_react_phase7.md](progress_react_phase7.md) |
| **css** | 🟡 | [progress_css_pages.md](progress_css_pages.md) |
| **express** | 🟢 depth pass 28/28 | [progress_express_master_depth_pass.md](progress_express_master_depth_pass.md) |
| **git** | 🟢 complete, re-scoped to 52 topics 2026-08-14 | [progress_git_pages.md](progress_git_pages.md) |
| **next.js** | 🟢 closed 2026-09-05 at the user's 90% quote bar · 659 pages | [CURSOR-NEXTJS.md](CURSOR-NEXTJS.md) |

🔴 **A split track's chunk mechanics are NOT in this table** — how the user starts a chunk,
what all chunks share, and the 2026-08-14 scope cut are §11b, §11b-common and §11b-scope of
[LOCKS-ARCHIVE.md](LOCKS-ARCHIVE.md). Told *"continue chunk C"*, read those first.

## What every lock carries

**Declare your lane the moment you claim a track**, or the cadence hook counts every other
session's uncommitted work and shouts at you about files you are forbidden to touch (it did
that eleven turns running on 2026-08-28):

```bash
mkdir -p ~/.claude/lanes && echo "docs/<your-track>" > ~/.claude/lanes/$CLAUDE_SESSION_ID
```

- **Work your track and nothing else** — not to fix a broken link, not to correct a stale
  count, not because another track looks idle. When a phase finishes, the next phase of
  **the same track** is the work. Known defects elsewhere belong to their owning sessions.
- **Never `git add -A`.** Several sessions write to this checkout at once — stage explicit
  paths. A build failure you did not cause is something to wait out, not investigate. Tally
  a build by track before reacting:
  ```bash
  yarn build 2>&1 | grep "source page path" | sed 's#.*/devbible/docs/##' | cut -d/ -f1 | sort | uniq -c
  ```
- **`yarn linkcheck` before you report a file done** — per file, not per topic. One
  dangling link fails `build`, which *skips* `deploy`, which shows as one X and blocks
  every other track's publish.
- **Per-file cadence:** write a file → update the boards → commit explicit paths → update
  the store. At 80% usage: stop, wire the boards, commit, repoint the cursor here.
- **300 lines is a file-size cap, never a content budget.** Write it all, then split.

## Keeping this board small

This file is opened by **every** devbible session, so it is budgeted at **160 lines** and
`shared/scripts/memcheck.sh` fails the store if it grows past that.

> **When a lane closes, move its section to [LOCKS-ARCHIVE.md](LOCKS-ARCHIVE.md) in the same
> commit that closes it, and leave one row here.** Do not append a wind-down section to this
> file. That is exactly how it reached 1,416 lines: 18 session sections, ~95% closed, each
> one added by a session that was individually right.

Contract: [../shared/MEMORY-ARCHITECTURE.md](../shared/MEMORY-ARCHITECTURE.md)
