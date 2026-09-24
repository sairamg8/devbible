---
name: devbible-javascript-build-progress
description: Live resume pointer for the JavaScript corpus — where the build stopped, what is next, and the traps that cost time
metadata:
  type: progress
---

:::danger SUPERSEDED 2026-08-15 — JavaScript is now FOUR chunks, A B C D
The two-lane split this file describes is **closed**, and its letters are **dead**
("lane A = phases 3–8", "lane B = phases 9–12, 17, 18" mean nothing now). The live cursor is
[[devbible-javascript-split-4way]] — **A** phases 5+11 · **B** 6+17 · **C** 7+8 · **D** 12+18.
Read this file for traps, concepts and history only, never for "which phases are mine".
:::

:::danger CONSOLIDATED 2026-08-15 — THE WORKTREE IN THIS FILE NO LONGER EXISTS
Every devbible worktree and branch was **merged into `main` and DELETED** on 2026-08-15
(*"commit every uncommitted branch to main and delete everything"*). **All the content
described below is on `main`** at `/run/media/sairam/Storage/Backup/Knowledge/devbible`
— nothing was lost, every branch was verified at 0 unique commits first. Ignore any
"worktree", "branch", "not merged" or "merge at the phase close" instruction below and
**work on `main`**. `main` builds 0 warnings / 0 broken links, so a break there is yours.
Full record: `progress_worktree_consolidation_20260815.md`.
:::

**Live cursor for the JavaScript build.** Kept small ([[devbible-memory-file-cap]]);
the *content* of what is written lives in [[devbible-javascript-concepts]] and its
per-phase children. This file answers only **"where exactly did it stop"**.

🔴 **Split 2026-08-14 at 654 lines** — over the memory-file cap. The per-session narratives for
`ec7d13f7`, `016cfc46`, `01ECVvH5` and `c5329658`, plus the syllabus audit and the old remaining-scope
measurement, moved to [[devbible-javascript-lane-a-history]]. **Nothing was deleted.** What stays
here: the cursor, the current session, the two-lane split, the scope cut, phase status, the trap
list and the standing rules.

## Cursor — 2026-08-14 (session `edbfba95`, **lane A: phases 3–8**)

| | |
|---|---|
| **Last completed** | ✅ **Phase 5 topic 17 · `Set`** (203, single) `f09459c6`. Before it: **15 · Regular expressions — the syntax** (2 chunks + index / 445) `96f77704` and **16 · in practice** (2 chunks + index / 454) `bd6a6141`. Before them: **13 · Non-mutating counterparts** (186, single) `461b2255` and **14 · `flat`/`flatMap`/`fill`/`copyWithin`** (202, single) `2ae54175`. Before them: **12 · String searching** (**2 chunks + index / 428**) `04e700fa`. Before it: **11 · `Number` and `Math`** (Understand, **2 chunks + index / 478 lines**) `c37dc8af`. Before it: **08 · Template literals** (Understand, **2 chunks + index / 412 lines**) `0c048dd9`. Before it: **phase 5 topic 03 · `slice` vs `splice` vs `at`** (Understand, 235 lines, single file) `6f957f3a`. Before those: 🎉 **PHASE 4 COMPLETE — 20 of 20, EVERY TIER** (Master 7/7 · Understand 9/9 · Know 4/4), closed 2026-08-15 by **topic 20 · Private state before `#`** (Know, **2 chunks + index / 425 lines**) `080d94f0`. Before it: **19 · `Proxy` and `Reflect`** (Know, **2 chunks + index / 473 lines**) `70be24ff`. Before it: **18 · Mixins and composition over inheritance** (Know, **2 chunks + index / 453 lines**) `eecb1b80`. Before it: **17 · `toString`, `valueOf`, `Symbol.toPrimitive`** (Know, **2 chunks + index / 444 lines**) `35aa2e07`. Before it: 🎉 **16 · Prototype patterns to avoid** (Understand, **2 chunks + index / 492 lines**) `6f559272` — **that closed phase 4's UNDERSTAND TIER, 9 of 9** (02, 09–16). Before it: **15 · Normalising untrusted shapes** (Understand, **2 chunks + index / 508 lines**) `e9b78c1f`. Before it: **14 · Object creation patterns** (Understand, **2 chunks + index / 520 lines**) `2dc2a98f`. Before it: **13 · `instanceof` and `Symbol.hasInstance`** (Understand, **2 chunks + index / 521 lines**) `6a211485` — **first topic written in the worktree**. Before it: **12 · `Object.freeze` and `seal`** (Understand, **3 chunks + index / 734 lines**) `d3761a8f`. Before it: **11 · Property descriptors** (Understand, 246 lines) `088ea644`. Before it: **10 · Getters and setters** (284) `e344528f`. Before it: **09 · `extends` and `super`** (2 chunks / 521) `cf439b56`. Before it: **02 · Property access** (266) `50a10999`. Before it: ✅🎉 **PHASE 3 COMPLETE — 20 of 20, every tier** (Master 8/8 · Understand 9/9 · Know 3/3). Closing topic: **20 · `new.target` and constructor guards** (Know, 244 lines) `65778dfa`. Before it: **19 · Function properties** (236) `29408309`. Before it: ✅ **18 · IIFE and the module pattern** (Know, 276 lines) `1256acb1`. Before it: ✅ **topic 17 · Closure and default-parameter gotchas, 5 chunks / 1,254 lines** (216/262/197/247/279 + 53-line README). Committed inside **other sessions'** commits `6a72c26` and `57b26ca` (see the trap below). Boards all updated; `progress.js` phase 3 is `pages: 17, pagesPlanned: 20` |
| **Resume at** | 🔴 **Phase 5 topic 18 · `Object` statics** (Understand) — `assign`, `entries`, `create`, `getOwnPropertyNames`, `groupBy` and `Map.groupBy`. Then **13** Non-mutating array counterparts, **14** `flat`/`flatMap`/`fill`, **15–16** Regular expressions, **17** `Set`, **18** `Object` statics, **19** `Date`, **20** `Intl`, **21** `structuredClone`, **22** Array-likes (all Understand), then the four **Know** topics 23–26. **Phase 5 is 17 of 26, 9 left** |
| **🔴 WHERE TO WRITE** | **The worktree `/run/media/sairam/Storage/Backup/Knowledge/devbible-js-lane-a`, branch `js-lane-a`** — on the user's instruction 2026-08-14 (*"Can you write now onwards all your explanations in complete new worktree?"*). **Not `main`.** See the worktree section below |
| **Phases 3 and 4** | ✅ **BOTH COMPLETE at every tier, 20/20 each.** `pagesPlanned` is dropped from both rows in `progress.js` — that is what makes `phaseStatus()` report complete rather than 'writing' |
| **Lane A left** | **44 topics** — phase 3: ✅ 0 · phase 4: ✅ 0 · phase 5: 9 · phase 6: 10 · phase 7: 11 · phase 8: 14 |
| **Previously completed** | **Phase 3 topic 16 · There is no function overloading**, commit `e7eb24a` — 249 lines. Before it: 15 · Pure functions (`6c5ba31`, 219), 14 · Recursion (`b279810`, 256), Also 12 · Composition (`c408b08`, 276) and 13 · Memoization (`67bdb54`, 248). 🔴 **Every Master tier, phases 0–18, is COMPLETE** |
| **Standing rules** | 🔴 **TIER LOCKED 2026-08-14 — Understand and Know only** (*"lock in understand know tier"*): Master is **closed at 99/99, do not reopen a Master topic to deepen it**. 🔴 **SCOPE CUT** (see the scope section below; 21 dropped, 34 parked). Order is **phase by phase, and inside a phase Understand → Know → When Needed**. ⚠️ **Where an Understand topic overlaps a Master one, write the CONCEPT and CHOICE and link to the implementation — topic 17 is now the fullest worked example of that shape, topic 10 the smallest.** Documentation-validated; **no sandbox, no timings** |
| **Totals** | **138 of 316 in scope · 244 pages** (non-`README.md` `.md`; 352 counting every README — includes lane B's), 328 carrying `> Verified:`, **0 files over 300 lines**, **0 broken links under `docs/javascript/`**. ⚠️ The old "253 pages / 311 verified" was wrong — see the audit below |
| **Claim** | session `ec7d13f7` (took over from `016cfc46` ← `c5329658` ← `01ECVvH5`), recorded in `docs/README.md` **and** `docs/javascript/pages/README.md`. Both refreshed 2026-08-14 |
| **UI** | `src/data/progress.js` javascript rows now carry real counts and `pagesPlanned` for phases 3–7 |

## 🔴🔴 SESSION `edbfba95` — 2026-08-14, lane A, **and lane A now writes in a WORKTREE**

Took lane A over from `ec7d13f7` on *"go though this project and pick javascript plan a"*; claim
rewritten in `docs/README.md` and `docs/javascript/pages/README.md`. Lane B moved to `75e511e6`,
then to its own worktree the same night.

### 🔴 The worktree — where lane A writes from now on

> *"Can you write now onwards all your explanations in complete new worktree ?"* — 2026-08-14

| | |
|---|---|
| **Path** | `/run/media/sairam/Storage/Backup/Knowledge/devbible-js-lane-a` |
| **Branch** | `js-lane-a`, branched from `main` at `d3761a8f` |
| **Lane B did the same** | `devbible-js-lane-b`, branch `js-lane-b` — **never write there** |
| **node_modules** | hardlinked from the main checkout with `cp -al` (seconds, ~no disk). `rm -rf node_modules/.cache` before every build, which the standing command already does |

⚠️ **The old `/mnt/Storage` worktree registrations were stale and pruned** — `git worktree list`
showed `devbible-frontend` and `devbible-react` as `prunable` under the dead mount path. Pruning
them did not touch the directories, which still exist and are already merged.

✅ **STOPPED CLEAN 2026-08-15 on the user's word (*"enough"*), and MERGED** — `main..js-lane-a` is **empty**, pushed, whole-site build **green with 0 broken links anywhere**. 🔴 **Merge back at every phase boundary, and say plainly that the branch exists.** An unmerged
worktree is worse than none — that is the React lesson, and it cost a whole session's audit. Do not
let `js-lane-a` accumulate a phase's worth of work without merging into `main`.

⚠️ **A worktree isolates the CHECKOUT, not the BUILD.** `yarn build` there still compiles every
language, so another session's committed breakage still fails it (see below). What the worktree
does buy is real and worth having: **no other session can commit your staged files** (that happened
twice tonight), and your working tree stays clean of their mid-write edits.

### ✅ Written this session — 17 topics, 41 files, ~8,300 lines

🔴 **Phase 4 CLOSED at 20/20 (every tier); phase 5 taken from 8/26 to 17/26.**

**Phase 5 (Understand tier):** 03 slice/splice/at (235, single) `6f957f3a` · 08 template literals
(2ch, 412) `0c048dd9` · 11 Number and Math (2ch, 478) `c37dc8af` · 12 String searching (2ch, 428)
`04e700fa` · 13 non-mutating counterparts (186, single) `461b2255` · 14 flat/flatMap/fill (202,
single) `2ae54175` · 15 regex syntax (2ch, 445) `96f77704` · 16 regex in practice (2ch, 454)
`bd6a6141` · 17 Set (203, single) `f09459c6`.

**Phase 4 (topics 12–20), the earlier half of the session** — 12 freeze/seal (3ch, 734) · 13
instanceof (2ch, 521) · 14 object creation (2ch, 520) · 15 normalising (2ch, 508) · 16 prototype
patterns (2ch, 492) · 17 toPrimitive (2ch, 444) · 18 mixins (2ch, 453) · 19 Proxy/Reflect (2ch, 473)
· 20 private state (2ch, 425), closing commit `080d94f0`.

🔴 **Every topic's load-bearing facts are in [[devbible-javascript-concepts-phase4b]]** — per rule 9
the concepts live in the per-phase reference, not here.

🔴 **MERGED TO `main` at the phase boundary** — `a7a92fec`, after which `git log main..js-lane-a` was **empty** and the push succeeded. The merge was done the safe way: **`main` merged INTO `js-lane-a` first**, so conflicts (if any) were resolved in my own worktree and the merge into the shared checkout was a clean fast-forward that could not leave `main` in a conflicted state for the other sessions. It merged with **no conflicts** despite the MongoDB session having moved `docs/README.md` and `progress.js`.

✅ **And the whole-site build is GREEN again** — React Part A fixed its committed MDX error, so `yarn build` reached `[SUCCESS]`. Broken links are now **javascript 4 (all lane B's `phase-9-dom`) + typescript 14**, and react is at **0**, down from 59.

🔴 **Their load-bearing facts live in [[devbible-javascript-concepts-phase4b]]** — per rule 9, the
concepts belong in a per-phase reference, not in the cursor file.

### ✅ Build state at the phase 4 close

**Whole-site `yarn build` is GREEN** — React Part A fixed the committed MDX error that had been
failing it all night. Broken links: **javascript 4 (all lane B's `phase-9-dom`) · typescript 14 ·
react 0** (down from 59). Lane A's phases 3–8 are at **0**, and **0 files over 300 lines**.

🔴 **While another session's committed breakage fails the build, the link tally still works**,
because warnings are emitted before the bundle fails:

```bash
yarn build > build.log 2>&1
grep "source file" build.log | sed 's#.*source file "docs/##' | cut -d/ -f1 | sort | uniq -c
grep "source file" build.log | grep 'docs/javascript' | sed 's#.*pages/##' | cut -d/ -f1 | sort | uniq -c
```

### 🔴 Trap confirmed again: another session committed my `progress.js` edit

`src/data/progress.js` showed **no diff** after I set phase 4 to `pages: 12` — React Part B's commit
`6d34b321` had already swept it into HEAD. Verified by path (`git log --oneline -1 -- <file>`), and
the content is correct. **This is the third recorded sighting.** It is also the concrete reason the
worktree instruction is a good one.

## 🔴🔴 TWO LANES — JavaScript is split between two sessions (2026-08-14)

> *"i want to split your javascript work with another session so we can have less to work"*

| Lane | Phases | Left | Held by |
|---|---|---|---|
| **A · the language** | 3, 4, 5, 6, 7, 8 | **69** | session `ec7d13f7` — **this file** |
| **B · platform + applied** | 9, 10, 11, 12, 17, 18 | **75** | [[devbible-javascript-lane-b]] |

**This file is lane A from here on.** The seam is the language itself versus the browser
platform, chosen because the two sides barely cross-reference each other.

⛔ **Lane A never writes in phases 9–12, 17 or 18.** Where a lane-A page needs one of those
topics, write it as **bold plain text with *(not written yet)*** — a link to a page the other
lane has not written yet breaks the build.

**Shared files:** `src/data/progress.js` (own phases' rows only), `docs/README.md` (the lane A
row only), the claim notice (the lane table plus your own block). **Never `git add -A`** —
expect the other lane's rows in your diff and leave them.

## 🔴🔴 SCOPE CUT — 2026-08-14. Read this before writing anything

The user cut the corpus down to a **language focus**. Four instructions, verbatim:

> *"Dynamic programming and the harder set - Drop Completly"* ·
> *"Park Data structures completly for now mostly language focus"* ·
> *"Even algorythms also park it out not now"* ·
> *"Complexity and JavaScript's real costs remove this one too"*

and for the storefront, keep **11 · Infinite scroll and lazy images**, **12 · Long lists
without freezing**, **15 · Review uploads** — *"Thoose 3 in store front i want to keep … rest
drop"*.

| | Phases | Topics |
|---|---|---|
| 🚫 **Dropped** | 16 (04–16), 18 (08–10, 13, 14, 16–18) | **21** |
| ⏸ **Parked** — reversible, *"not now"* | 13 (04–10), 14 (06–17), 15 (05, 07–20) | **34** |
| ✅ **Active queue** | everything else | **145** — Understand 98 · Know 44 · When Needed 3 |

**In-scope total is 316, not 337** (337 syllabus rows − 21 dropped). 136 written = 43%.

🔴 **NOTHING WRITTEN WAS DELETED, and that was explicit** — *"incase of if any already
developed … let it be"*. Every drop and park lands on **unwritten** rows; phases 13–16 and 18
keep every Master topic. If a later session sees a "dropped" phase with written pages, that is
correct and intended.

🔴 **Phase 17 · Machine coding deliberately STAYS in scope.** It implements JavaScript's own
library functions from an empty file (EventEmitter, deep clone, a Promise, curry/pipe/compose,
promisify) — that is language work, not algorithm practice, and it is the one DSA-part phase
that survives. Do not park it by association.

🔴 **The original syllabus is preserved** at `docs/javascript/syllabus/*.md.bak` — taken from
git HEAD and verified byte-identical *before* any edit, on the user's instruction (*"for now
this original javascript syllabus create .bak one for future reference"*). The live syllabus
keeps every row and carries scope banners; the `.bak` is the pre-cut reference.

Scope commit `f915c5a`. The scope map also lives in the board script's `DROPPED`/`PARKED`
dicts, which is what recomputes these totals.

## Phase status

| Phase | Topics | Written | State |
|---|---|---|---|
| 0 · How JavaScript runs | 12 | 12 | ✅ complete |
| 1 · Values, types and coercion | 17 | 17 | ✅ complete |
| 2 · Operators, control flow | 15 | 15 | ✅ complete |
| 3 · Functions, scope, closures | 20 | 16 | ✅ Master complete (01–08); 🔨 **Understand 09–16 done — only 17 left, then Know 18–20** |
| 4 · Objects and classes | 20 | 7 | ✅ **Master tier complete** (01, 03–08); rest deferred |
| 5 · The built-in library | 26 | 8 | ✅ **Master tier complete** (01, 02, 04–07, 09, 10); rest deferred |
| 6 · Iteration and destructuring | 13 | 3 | ✅ **Master tier complete** (01–03); rest deferred |
| 7 · Asynchronous JavaScript | 22 | 11 | ✅ **Master tier COMPLETE** (all 11); 12–22 deferred |
| 8 · Modules, errors, memory | 18 | 4 | ✅ **Master tier COMPLETE** (all 4); 05–18 deferred |
| 9 · The DOM | 19 | 6 | ✅ **Master tier COMPLETE** (all 6); 07–19 deferred |
| 10 · Events and user input | 14 | 4 | ✅ **Master tier COMPLETE** (all 4); 05–14 deferred |
| 11 · Network, storage, data transfer | 21 | 5 | ✅ **Master tier COMPLETE** (01–05); 06–21 deferred |
| 12 · The browser platform | 21 | 2 | ✅ **Master tier COMPLETE** (01–02); 03–21 deferred |
| 13 · Complexity and real costs | 10 | 3 | ⏸ **PARKED** beyond Master (01–03) |
| 14 · Core data structures | 17 | 5 | ⏸ **PARKED** beyond Master (01–05) |
| 15 · Algorithmic patterns | 20 | 5 | ⏸ **PARKED** beyond Master (01–04, 06) |
| 16 · Dynamic programming | 16 | 3 | 🚫 **DROPPED** beyond Master (01–03) |
| 17 · Machine coding | 18 | 4 | ✅ **Master tier COMPLETE** (01–04); rest deferred |
| 18 · Applied storefront | 18 | 7 | ✂️ **TRIMMED** — Master (01–07) done; only 11, 12, 15 still to write |

****Master-first is the strategy, and it is now finished.**** Understand/Know topics in phases 3–6 are deliberately
deferred, not forgotten. Phase 7 has **eleven** Master topics — more than any phase — and
is the syllabus's stated centre of gravity.

## Traps found, in cost order

🔴 **An MDX build FAILURE from a nested backtick (2026-08-14).** ``seen.add(`${r},${c}`)``
written with single backticks ends the code span at the inner backtick, so `{r}` reaches MDX as a
**JSX expression** → `ReferenceError: r is not defined`, and unlike a broken link this **fails the
build**. Fix: double backticks. No link grep will ever find it — the signature is
`[ERROR] Docusaurus static site generation failed` naming one path.

🔴 **The cap-clustering tell fired on phase 11 topic 03 (2026-08-14) and was acted on.**
The first draft came out as three chunks of **301 / 319 / 300** lines — over the cap *and*
sitting exactly in the band rule 1 names as evidence of writing to fit. The correct response
was **not** to trim the two over-length files: the topic was re-split on concept boundaries
into **six** chunks (201/244/255/268/266/254 = 1,538 lines), each grown with its own Gotchas
and Interview questions. Total went **up by ~570 lines**. If a draft lands at 290–320, assume
the split is wrong, not the content.

🔴 **This file was ~100 pages stale when a powercut ended the 2026-08-13 session.** It
still said "Phase 3 page 01" while the corpus had reached Phase 7. Nothing was lost —
every page was committed — but the recovery cost a full audit of git plus the filesystem.
**Rule 9 exists for exactly this. Update after every 3 files, not at a phase boundary.**

🔴 **Forward links to unwritten topics are the standing source of broken links.** Six of
them sat in Phase 3 (to deferred topics 11, 13, 17, 18) through several builds. Delinked
2026-08-14. **Write cross-references as bold plain text with *(not written yet)*** until
the target exists.

🔴 **`rm -rf .docusaurus build` is NOT enough — clear `node_modules/.cache` too.** A
rebuild without it reported a brand-new topic's own **sibling links** (`./README.md`,
`./02-….md`) as broken. Adding `node_modules/.cache` cleared the report with no content
change. Second sighting of this false positive; the JS claim notice now carries the full
command. **Never delete a file to "fix" a link the cache invented.**

🔴 **A topic README that links a sibling topic as `../README.md` is silently wrong** —
it resolves to the phase index, not the topic. Found in `02-the-event-loop/README.md`
pointing at topic 03. It does not break the build, so only reading catches it.

**Both chunks of a first draft came out at 311 and 327 lines.** Correct response was to
**split into four chunks (177/235/205/256)**, never to trim. Total went *up*, to 921.
That is the rule working, not failing.

**Other sessions commit your staged-adjacent files.** The React session's commit
`4277725` swept up the javascript rows of `src/data/progress.js` because it is a shared
file. Not harmful — but do not assume an uncommitted change is still yours to commit.

🔴 **A claim written from knowledge slipped through and had to be corrected.** Topic 03
said twice that validation before the first `await` "throws synchronously". It does not —
an `async` function converts a throw into a **rejection**. Caught only when topic 07 sent
me to the `async function` reference. **Re-read earlier pages when a later topic covers the
same mechanism**; that is where rule 8's "re-review load-bearing claims" pays.

## Measured pace — 2026-08-14

**~8 minutes per Master topic** of 3 chunks (~750 lines), including full clean rebuild,
board updates, commit and memory. From commit timestamps: 05 at 07:09, 06 at 07:17,
07 at 07:25. Use this for estimates rather than guessing.

## 🔴 Save cadence — PER FILE (tightened 2026-08-14 at ~90% usage)

> *"make sure to save each file progress the moment it completes"*

**Every completed file: update the boards, commit the project, update and commit this memory.**
Not every 2–3 files. A session that dies must lose at most one file. Detail:
[[devbible-javascript-only-20260814]].

## 🔴 STANDING FOLLOW-ON ORDER — after lane A is finished (2026-08-14)

> *"if you complete current please pick new languages and just like how the node js have syllabus
> create like that and work it on and only do this incase if completee current task"*

**Conditional, and the condition is not met yet — lane A has 58 topics left.** Do not start a new
language while any lane A phase is unwritten; this does not reopen rule 11, it queues after it.

**When lane A IS finished:** pick a technology not yet in `docs/`, **build its syllabus in the
Node.js shape first** (`docs/<lang>/syllabus/*.md` — parts, phases, one row per topic with a tier
badge, a phase gate per phase, and a "Where this connects" section), claim it in `docs/README.md`,
then write it phase by phase under the same rules. Node.js is the reference to copy because it is
the one the user named: 13 phases, 248 topics, parts as separate syllabus files.

⚠️ **Ask nothing, choose sensibly.** Candidates already discussed in this store, in rough order of
fit: **Redis** (a syllabus draft already exists — [[devbible-redis-syllabus]]), **Docker/containers**
(the machine runs Podman, see [[machine-environment]]), **Next.js**, **GraphQL**, **testing**. Say
which was picked and why in the claim row.

## Standing authorisation — 2026-08-14

> *"continue with topic 05 promises do not wait for confirm you task is to complete
> javascript"*

**Do not pause for confirmation between topics.** Write, cap-check, clean-rebuild,
commit, update the boards and the UI, save memory every 3 files, move to the next topic.

## Standing rules for this build

- **Delink before building.** Unwritten pages must not be linked.
- **`progress.js`**: `pages` counts **topics written** (it is compared against `topics`
  pro rata), not `.md` files. The coverage table in `docs/README.md` counts **`.md` files
  excluding `README.md`**. Two different units; do not mix them.
- **Never `git add -A`.** Stage explicit paths. `docs/README.md` and `src/data/progress.js`
  are shared with every other session.
- **A build failure is usually another session's.** Tally by language first:
  `yarn build 2>&1 | grep "source page path" | sed 's#.*/devbible/docs/##' | cut -d/ -f1 | sort | uniq -c`

Related: [[devbible-javascript-syllabus]] · [[devbible-javascript-concepts]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-parallel-sessions]]
