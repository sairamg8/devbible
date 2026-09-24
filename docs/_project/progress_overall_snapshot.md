---
name: devbible-overall-snapshot
description: Point-in-time board across every devbible technology — refreshed 2026-08-15 (late) and VERIFIED AGAINST DISK, not just progress.js; carries the counting quirks and the three board defects the disk check exposed
metadata:
  type: progress
---

# devbible — overall progress snapshot (all languages)

**Refreshed 2026-08-15 (late)** by session `87ff8c11` on `main`, on the user's request for
a completion report. 🔴 **This refresh differs from every earlier one: the numbers were
verified against the FILESYSTEM (topic directories per phase), not read out of
`src/data/progress.js`.** That check found `progress.js` wrong in three places — see
*Board defects* below. The per-language progress memories stay authoritative for detail
and resume points; this file exists so a cold session sees the whole board in one read.

> ⚠️ **Recompute rather than trust these numbers if a day has passed.** A dozen sessions
> write to this repo at once; this file was found badly stale on 2026-08-15 morning and
> again by 2026-08-15 late (it still showed Docker phase 7 at 11/14 and phase 10 at 10/16;
> both had closed). Both commands to reproduce it are at the bottom.


## 🔴 PARTIAL REFRESH 2026-09-01 — the Java row only

Session `a3339484` closed **Java phase 11 · Testing** and added the Java row below, which did not
exist when this file was written: the Java corpus began after the 2026-08-15 sweep. **Only the
Java row and this banner were refreshed. Every other row and every total in this file is still
the 2026-08-15 measurement and is stale** — a dozen sessions write to this repo. Recompute before
quoting any of it; the commands are at the bottom.

**Java, counted off disk 2026-09-01:** **168 / 233 topics (72%)** · 1,716 `.md` files ·
395,114 lines · 16,158 gotchas and interview questions.
Phases 0–11 complete; 13 partial (3/14 closed, 5 part-written); 12, 14, 15, 16 open.
⚠️ Phase 14 was claimed the same day by session `af46ba56`. Detail: [[java-board]], [[cursor-java]].

## The board — 1,514 of 2,004 in-scope topics, 75.5%

⚠️ **These totals exclude Java entirely and are from 2026-08-15.**

**2,712 `.md` files on disk · ~481,600 lines · 25 technologies.**
Disk-verified 2026-08-15 late. Read the quirks section before quoting a percentage.

| Technology | % | Topics done | Left | State |
|---|---|---|---|---|
| **Node.js** | 100% | 248/248 | 0 | ✅ Complete, audited — 253 files / 48,732 lines |
| **PostgreSQL** | 100% | 233/233 | 0 | ✅ Complete — 367 files / 72,521 lines |
| **JavaScript** | 100% | 269/269 | 0 | 🏁 Active queue empty — 763 files / 128,195 lines; Master 99/99 |
| **Java** *(added 2026-09-01)* | 72% | 168/233 | 65 | 🚧 Phases 0–11 ✅ complete · 1,716 files / 395,114 lines / 16,158 ★ |
| **React** | 100% | 210/210 | 0 | ✅ Phases 0–11 and 14; 12/13 dropped — 308 files / 63,231 lines |
| **Express.js** | 100% | 115/115 | 0 | ✅ Complete, Master depth pass done — 196 files / 32,524 lines |
| **CSS** | 100% | 74/74 | 0 | ✅ Complete at the cut 74-topic scope (of 119) |
| **Git** | 100% | 52/52 | 0 | ✅ Complete at the cut **52-topic** daily-driver scope (of 191) |
| **Docker & Podman** | **100%** | **192/192** | **0** | ✅ **COMPLETE 2026-08-16** — all 13 phases, 271 files / 50,768 lines, 0 over the 300-line cap, 2,233 internal links resolving |
| **MongoDB** | 41% | 34/82 | 48 | 🟡 Paused cleanly — phases 0–5 done, **next phase 6, sources already fetched** |
| **Storybook** | 40% | 23/58 | 35 | ⚪ Phases 0–3 written properly; 4–10 unwritten |
| **TypeScript** | 29% | 54/187 | 133 | 🚧 Paused — phases 0–2 done, **phase 3 Generics at 11/14** |
| **Nginx** | 22% | 46/210 | 164 | 🚧 Paused — phases 0–2 done, **next phase 3 · static files and SPAs** |
| **Redis** | 0% | 0/74 | 74 | ⚪ Syllabus complete, **zero pages — the cleanest cold start** |
| Vite · Webpack · Babel · ESLint/Oxlint · Jest/RTL · Playwright · Redux Toolkit · TanStack Query · Framer Motion · Web Vitals · Frontend Architecture | — | 180 pages | — | ⚠️ **Imported, not converted** — see quirk 4 |

**Where the 490 remaining topics actually are:** Nginx 164 · TypeScript 133 · Redis 74 ·
MongoDB 48 · Docker 36 · Storybook 35.

## 🔴 Board defects found by the disk check — fix before quoting the site

None of these were touched: this session held no language lock and the report was
read-only. **They are still open.**

⚠️ **UPDATE 2026-08-16 (session `8e7b6e12`) — every Docker defect listed below is FIXED.**
Phase 7's `pages: 11, pagesPlanned: 14`, the stale phase-9 count and the stale `docs/README.md`
technology row were all corrected as chunk D closed phases 10, 11 and 12. Docker now reads
**192/192** on every board, and **49 stale `(not written yet)` placeholders** left behind by
chunks A/B/C were repointed to real links (commit `3b51f2dc`). The Docker rows below are kept
as the record of what was wrong, not as open work.

1. 🔴 **`progress.js` UNDER-reports Docker phase 7** — `{n: 7, … pages: 11, pagesPlanned: 14}`
   but phase 7 closed **14/14** at commit `9d94f8a1`. The site shows Networking mid-flight.
2. 🔴 **`progress.js` OVER-reports TypeScript phase 3** — `{n: 3, topics: 14, pages: 14}`
   with **no `pagesPlanned`**, so `phaseStatus()` returns `'written'` and the site shows a
   **phase that is not finished**. Disk has **11** topic directories; the claims table
   agrees at 11/14. TS totals read 57 instead of 54.
   ⚠️ This is the exact failure mode the `pagesPlanned` comment warns about — a mid-phase
   row missing `pagesPlanned` reads as complete.
3. **Docker phase 9 stale** — `progress.js` says 5, disk has **6** (`06-secrets-dev-vs-prod.md`,
   commit `a7ba7f2f`). Chunk C is live and moving, so re-check rather than trusting any number.
4. **`docs/README.md` Docker technology row stale** — says *"153 topics, phases 0–7 and 10
   complete"*; actual is **156** with phase 9 under way.
5. **One content page has no `> Verified:` line** —
   `docs/javascript/pages/phase-0-how-javascript-runs/07-loading-scripts.md`. Every other
   native-track file without one is a `syllabus/` or `reviews/` doc, which is correct.

## 🔴 The quirks — quote a percentage only after reading these

1. **Never derive a percentage from `pages / topics`.** `pages` counts **topics brought to
   standard** in some tracks and **files on disk** in others; chunked topics produce 3–5
   files each. PostgreSQL reads 128% that way. Use `summarise()` from `progress.js`, or
   count topic directories per phase (command at the bottom).
2. **Node.js shows `pages < topics` and is COMPLETE.** Six phases deliberately merge pairs
   of syllabus rows into one page — [[devbible-nodejs-completeness-audit]]. Do not "fix" it.
   React phase 0 (14 pages / 17 topics) is the same thing.
3. **JavaScript's active queue is DONE at 269/269.** Phases 13–15 are **parked** (34 topics)
   and their rows carry `parked: true`, so they sit outside the ratio by design. Do not
   reopen them without a new instruction — [[devbible-javascript-split-4way]].
4. **The 11 imported toolchain technologies read 100% and are NOT devbible-quality.**
   Verified this refresh: **180 of 180 pages carry no `> Verified:` line, no tier badge and
   no interview section.** That is a hidden ~180-topic conversion backlog behind a green bar.
   Storybook phases 0–3 are the one genuinely-written exception.
5. **Git and CSS are 100% of deliberately cut scopes** — Git 52 of 191 daily-driver topics,
   CSS 74 of 119. The rest is parked under banners, not pending.

## Quality gates — measured this refresh

- **300-line cap: 9 files over.** Four are the **imported Storybook corpus**
  (`13-build-and-configuration/02` 596 lines, `/03` 575, `17-theming-colors-and-fonts/01`
  554, `/02` 529, plus `07-accessibility-testing/01` 350, `04-controls-and-args/01` 333,
  `05-interaction-testing/01` 316); the rest are `docs/reviews/*`, which are not doc pages.
  🔴 **Every natively-written track is 0 over the cap.** The Storybook overruns came in with
  the import and were never split.
- **`> Verified:` coverage is effectively total on native tracks** — one real page missing
  it (defect 5 above); all other misses are syllabus and review files.

## Docker & Podman — the only actively-written track

Four chunks, whole phases only, so no two sessions write in the same directory.
Cursor of record: [[devbible-docker-split-4way]].

| Chunk | Phases | State (2026-08-15 late) |
|---|---|---|
| **A** | 4 · 5 | 🏁 **COMPLETE 28/28** — 32 files, 6,692 lines. [[devbible-session-20260815-docker-chunk-a]] |
| **B** | 6 · 7 | 🏁 **COMPLETE 26/26** — phase 7 closed at `9d94f8a1`. [[devbible-docker-chunk-b]] |
| **C** | 8 · 9 | 🚧 **23/31 and LIVE** — phase 8 done 17/17, phase 9 at **6/14**, resume topic 07. [[devbible-docker-chunk-c-findings]] |
| **D** | 10 · 11 · 12 | 🚧 **16/44** — phase 10 closed 16/16; **phases 11 and 12 untouched, the heaviest tail** |

⚠️ **Chunk sessions change hands often** — B, C and D were each taken over by a new session
id during 2026-08-15. Read the split file's cursor table, never an id quoted elsewhere.

## What is genuinely free to pick up

- 🔴 **Redis — the highest-leverage pickup.** Syllabus done (74 topics), zero pages, and
  **39 already-published Node and Express pages defer to it** (sessions, rate limiting,
  denylists, idempotency keys, queues). Those cross-references currently point at nothing.
- **Nginx** — resume at **phase 3 · Serving static files and SPAs**; 164 left, the largest
  single remaining track. [[devbible-nginx-build]]
- **TypeScript** — resume at **phase 3 topic 12 · `const` type parameters** (11/14), then
  phase 4; 133 left. Fix defect 2 when you take it. [[devbible-typescript-build-progress]]
- **MongoDB phases 6–14** — 48 topics, paused not claimed, and **phase 6's four Manual pages
  are already fetched**. [[devbible-mongodb-pages-progress]]
- **Docker chunks A and B are finished** — per the split rules a finished chunk **stops**
  rather than rolling on; reassigning needs an instruction. Chunk D's phases 11–12 are the
  real remaining Docker work.
- **The 180 imported toolchain pages** — converting them to devbible standard is a large,
  well-defined body of work waiting on a **user decision**, not on writing.

## Why this file keeps going stale, and the lesson

Two refreshes on the same day and it was wrong both times by evening: Docker phases 7 and
10 closed and phase 9 opened between them. 🔴 **Treat this file as a cache, never as a
source.** One session writes it at one moment while a dozen others are mid-phase.

🔴 **And do not recompute it from `src/data/progress.js` alone** — that file *is itself*
maintained by hand by those same sessions, and this refresh caught it wrong in three
places. Count topic directories on disk and reconcile the two.

## Reproducing this table

```bash
cd /mnt/Storage/Backup/Knowledge/devbible

# 1. What the SITE believes (uses summarise(), so parked phases are handled right)
node --input-type=module -e "
import {LANGUAGES, summarise} from './src/data/progress.js';
for (const k of Object.keys(LANGUAGES)) { const s = summarise(k);
  console.log(s.label.padEnd(26), (s.percent+'%').padStart(5),
    (s.phasesDone+'/'+s.phasesTotal).padStart(7),
    (s.topicsDone+'/'+s.topicsTotal).padStart(10),
    s.nextPhase ? 'next: P'+s.nextPhase.n : ''); }"

# 2. What is ON DISK — topic count per phase; reconcile against the above
cd docs && for lang in docker typescript nginx mongodb storybook; do echo "== $lang"
  for p in $lang/pages/*/; do [ -d "$p" ] || continue
    echo "  $(basename $p): $(ls -1 "$p" | grep -cE '^[0-9]{2}-')"; done; done

# 3. Quality gates
find . -name '*.md' -exec awk 'END{if(NR>300) print NR"  "FILENAME}' {} \; | sort -rn
find . -name '*.md' -exec grep -L '^> Verified' {} + | grep -v 'README.md'
```

Related: [[devbible-docker-split-4way]] · [[devbible-docker-chunk-b]] ·
[[devbible-docker-chunk-c-findings]] · [[devbible-session-20260815-docker-chunk-a]] ·
[[devbible-javascript-split-4way]] · [[devbible-nginx-build]] ·
[[devbible-mongodb-pages-progress]] · [[devbible-typescript-build-progress]] ·
[[devbible-nodejs-completeness-audit]] · [[devbible-worktree-consolidation-20260815]] ·
[[devbible-progress]]
