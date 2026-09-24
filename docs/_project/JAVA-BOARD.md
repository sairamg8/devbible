---
name: java-board
description: THE single Java board — every phase, every topic, its state, and which session holds it. A session told "continue with java" claims a row HERE first, then writes. Replaces hunting through progress_* files to find what is pending.
metadata:
  type: project
---

# ☕ Java — the one board

**Created 2026-08-31**, on the user's instruction:

> *"in new session if i say continue with java it need to be marked as picked by session
> and so there were other pending chapters will be given to different sessions … rather
> than saving each progress to memory and looking to find what was pending or complete i
> want to have all in single file"*

**This file is the answer to "what is pending and who has it".** It is the only file a
session must read before claiming Java work. Counted off disk 2026-08-31, not from memory:
`233 topics · 180 done · 53 pending` (recounted off disk **2026-09-03 03:20** after phase 12 topics 08 and 12 closed)  
🔴 **233, not 232** — phase 11 gained **topic 12 · Real-world testing scenarios** on the user's
instruction, 2026-08-31 (*"please keep a section or phase for testing real world scenarios concepts
like mocking class or api response just like how javascript or react testing real world scenarios
involved"*)..

The per-topic memories (`progress_java_p*.md`, `research_java_p*.md`) are **not** deleted —
they hold the banked documentation research, which is the expensive thing. They just stop
being the place you go to find out *what is left*. That is here.

---

## ⏸ PAUSED 2026-09-05 — session `1f23d6f4`: 3 forks deployed, then STOPPED on the user's signal before any of them wrote

User order: *"Complete pending java please deploy 3 agents and split the work and use devbible skill
and you monitor them"*. Standing order from 2026-09-02 still holds: **phase 12 → 13 → 14 → 15 → 16 →
Python**. Three forks on **disjoint directories**, **forks run no git commands**; the coordinator
QCs, commits explicit paths, wires the boards and writes the real footers.

| Worker | Directory, in order |
|---|---|
| fork A | **p12 · 13 · JVM flags** — `05f` (pos 12) → `06`, `06b`, `07`, `08`, `09`, `README.md` (pos 0) |
| fork B | **p12 · 11 · GraalVM native image** — `08-testing-a-native-image.md` (pos 19) → `09`, `10`, `README.md` (pos 0) |
| fork C | **p12 correctness defects** (topics 01, 02, 09 + `_PHASE-NOTES.md`) → **p13 · 09 · Spring as OAuth2 *client*** from a new `_plan.md` |

🔴 Research for the two phase-12 rows is **COMPLETE and banked** in
[[progress-java-p12-run-20260904]] and [[progress-java-p12-run-20260902]]. **Do not re-fetch.**

**Stopped on *"wait enough please save session progress and wait for my signal to continue"*.**
All three forks killed while still in their reading/research phase — **none wrote a page, and
there is nothing to salvage.** The three rows are **left claimed** so the session can resume;
if it does not, take them after the usual staleness check. Full record:
[[progress-java-p12-run-20260905]].

### 🔴🔴 THIS BOARD IS WRONG ABOUT PHASE 12 — twelve `✅ done` rows are not done

**311 pages across the twelve phase-12 topics marked `✅ done` still end at a bare
`{/* FOOTER */}` marker and have no navigation at all.** Only topic 09 has real footers.
Counted off disk 2026-09-05; the same systemic defect phase 13 had repaired on 2026-09-04.
Per the project's own rule — *a topic is not closed while a `{/* FOOTER */}` remains in it* —
**phase 12 is not 13/15 closed; it is 1/15.**

Fix with **`shared/scripts/wire-footers.py`** (footer-only, idempotent, never touches a
README's content). 🔴 **NEVER point `wire-topic.py` at these topics** — it regenerates
`README.md` from a template and all twelve indexes are hand-written. ⚠️ Wire topics **10 and
12 last**, after 11 and 13 have READMEs, or their last chunk's `Next topic →` skips the gap.

✅ Also fixed 2026-09-05 (devbible `3f89e101`): the `:=` `PrintFlagsFinal` defect in
`01-memory-layout/09d`, and the **five** missing `_category_.json` (05, 11, 13, 14, 15 — not
the two the defect list recorded).

## ▶️ (historic) LIVE 2026-09-02 — session `67176b1d` + 3 `devbible-author` forks running phase 12 to completion

User order: *"Complete java pending tasks and deploy max 3 agents and make sure they follow hard
rules"*, then mid-run: *"If you complete all pending jobs in java then please pick python"*.
🔴 **That second sentence supersedes the 2026-09-01 "do not start new phase" order**: after phase
12 closes, the pending phases 13 → 14 → 15 → 16 follow, and only after Java is 233/233 does
this session (or its successor) move to Python. Three forks on **disjoint topic directories**,
**forks run no git commands**, the coordinator commits on the cap + footer gate:

| Worker | Topics, in order |
|---|---|
| fork A | **10** `README.md` → **09** tracing (honour the 9 filenames its earlier author linked) + index |
| fork B | **08** `11`, `12`, `README.md` → **13** JVM flags + index |
| fork C | **12** graceful shutdown `06` onward + index → **11** GraalVM native image + index |

## ⏸ (historic) SESSION ENDED CLEANLY 2026-09-01 — session `f413d97a` + 2 forks. EVERY ROW IS FREE

> User called it for the day (*"Only current file and enough for the day"*). Working tree clean,
> everything committed, **`yarn build` SUCCEEDS** (92 broken-link warnings site-wide, none in
> phase 12's closed topics; phase 14's in-flight forward refs account for them).
> 🔴 **Two build-breaking MDX defects were found and fixed**: literal `{`/`}` in prose in
> `p12/07-logging-done-right/04-parameterised-messages.md` (killed the build outright) and
> `{moduleName}` in `p14/01-monolith-first/11f-nested-modules.md` (killed SSG rendering).
> Escape them as `\{` `\}` — `mdxcheck.py` does NOT catch this pattern.
>
> **This session closed topics 14 (JMH) and 15 (CRaC) and wrote 8 chunks of topic 12.**
> Cheapest close on the board now: **topic 10 needs only its `README.md`.**

## ▶️ (historic) LIVE 2026-09-01 — session `f413d97a` + 2 forks running phase 12 to completion

User order: *"Deploy max 3 more agents including you split work all of them and finish it"*.
Three workers, disjoint topic directories, **coordinator commits, forks never run git**:

| Worker | Topics |
|---|---|
| fork A (`devbible-author`) | **10** finish + index → **11** GraalVM *(12 reassigned to coordinator)* |
| fork B (`devbible-author`) | **08** finish + index → **09** finish + index → **13** JVM flags |
| coordinator `f413d97a` | ✅ **14** JMH → ✅ **15** CRaC → **12** graceful shutdown, plus QC/commits/boards |

## ▶️ (historic) LIVE 2026-09-01 — session `d3dcf9f3` running phase 12 to completion

User order: *"cookit up please and complete java"*. Working phase 12 top-down from topic 02.
Rows not marked `🚧 picked` below are still free.

## ⏸ (historic) SESSION ENDED CLEANLY 2026-09-01 — every row was FREE at that point

🔴 **Read [[cursor-java]] FIRST.** It carries the standing order, the exact next file, what each
partial topic owes, and the QC commands. Session `d7d5224e` stopped on the user's request with a
**clean working tree** — everything complete is committed, nothing to salvage.

**Standing order still in force:** *"After completing current phase do not start new"* — finish all
15 phase-12 topics, then STOP.

## ▶️ Java is LIVE again — unparked 2026-08-31

The 2026-08-31 park (*"lets park java here"*) was lifted the same day by the user picking
Java in session `63dbad0f`. The standing order — **run Java to completion, do not stop to ask at
a phase boundary** — is in force again. A successor session resumes from this board without
asking.

---

## 🔴 THE CLAIM PROTOCOL — six steps, do all six

1. **Pull, then recount.** `cd /mnt/Storage/my-learning/claude && git pull --rebase`, then
   run the recount below. Never edit a stale copy, and never trust a `🚧 picked` row without
   checking whether the session holding it is still alive.

   ```bash
   python3 /mnt/Storage/my-learning/claude/shared/scripts/java-board-recount.py
   ```

2. **Pick the topmost row that is neither `✅ done` nor live-claimed** in the phase you were
   given. If no phase was named, take the topmost such row on the whole board. A row the
   recount lists under `ABANDONED CLAIMS` is yours to take — see the reclaim rule below.
3. **Write your claim into the row**: state `🚧 picked`, holder = your session id
   (`echo $CLAUDE_CODE_SESSION_ID`, first 8 chars) + today's date. Update the phase header
   line's holder and percentage at the same time.
4. **Commit the board alone, immediately** — `git add devbible/JAVA-BOARD.md && git commit`.
   Claim before writing a word of content. An uncommitted claim is not a claim, and a second
   session will take the same topic.
5. **Work the topic to close** (all chunks + `README.md` index + the four UI boards).
   Cadence stays **per file**: chunk → boards → commit explicit paths in devbible → memory.
   🔴 **Re-stamp your holder cell on every one of those commits** (`date '+%Y-%m-%d %H:%M'`).
   That stamp is the heartbeat — it is the only thing that lets a later session tell "still
   working" from "died four hours ago".
6. **Release**: flip the row to `✅ done`, clear the holder, bump the phase percentage,
   commit. Then claim the next row.

**Dying mid-topic is normal — say so in the row.** Change `🚧 picked` to
`⚠️ partial (N chunks, next: <exact filename>)` and leave the holder in place with the date.
The next session reads that as "resume here", not "start over". A row that still says
`🚧 picked` with a date more than a day old is **stale — take it**, after checking disk.

⛔ **Never clear another session's claim without checking `git log` and the topic directory.**

---

## Legend

| Mark | Means |
|---|---|
| ✅ done | Chunks written **and** a `README.md` index exists. The only state that counts. |
| 🚧 picked | A live session holds it. Holder column says who and since when. |
| ⚠️ partial | Chunks on disk, no index — the row names the next file. |
| 📋 planned | `_plan.md` written, zero chunks. Cheap to start: the chunk list exists. |
| ⬜ open | Nothing on disk but the phase README row. Needs a `_plan.md` first. |

---

## Roll-up — 178 / 233 topics · **76%**  ·  *recount 2026-09-01 12:19 · re-verified off disk 2026-09-01 (status report), phase-12 cells corrected*

| Phase | Topics | Done | State | Held by |
|---|---|---|---|---|
| 0 · Platform & JVM | 13 | 13 | ✅ **100%** | — |
| 1 · Language core | 16 | 16 | ✅ **100%** | — |
| 2 · Classes & objects | 15 | 15 | ✅ **100%** | — |
| 3 · Generics & collections | 16 | 16 | ✅ **100%** | — |
| 4 · Lambdas & streams | 13 | 13 | ✅ **100%** | — |
| 5 · Exceptions | 8 | 8 | ✅ **100%** | — |
| 6 · Concurrency | 17 | 17 | ✅ **100%** | — |
| 7 · I/O, time, stdlib | 13 | 13 | ✅ **100%** | — |
| 8 · Build & dependencies | 12 | 12 | ✅ **100%** | — |
| 9 · Spring Boot | 16 | 16 | ✅ **100%** | — |
| 10 · Data access | 14 | 14 | ✅ **100%** | — |
| 11 · Testing | 12 | 12 | ✅ **100%** — closed 2026-09-01 by `a3339484`, 0 dangling links | — |
| **12 · JVM in production** | 15 | 10 | ⏸ **67%** — t01–t07, t10, t14, t15 ✅ closed; 08/09/12 partial (all released 2026-09-02 14:52), 11/13 planned; **all 5 remaining rows claimed by `67176b1d` + 3 forks (2026-09-02)** | `67176b1d` (live) |
| **13 · OAuth2 & OIDC** | 14 | 8 | ⏸ **57% — 01–08 closed; 09–14 untouched, every row FREE** | *(released — `e7ea206c` wound down 2026-09-04 09:40)* |
| **14 · Microservice architecture** | 12 | 1 | ⏸ **8% — 02 CLOSED + audited (Gemini-written, repaired `c364141d`); 01 and 04 partial with no index; 9 planned** | *(free)* |
| **15 · Messaging & event-driven** | 14 | 0 | 🔴 **0%** | *(unclaimed)* |
| **16 · Resilience & operations** | 13 | 0 | 🔴 **0%** | *(unclaimed)* |

Phases 0–10 are closed and are **not** work. Do not reopen one to fix a link or a count.

---

## Phase 11 · Testing — ✅ **12/12 · 100% · COMPLETE 2026-09-01** by session `a3339484`

✅ **Nothing is owed.** All twelve topics have chunks + a `README.md` index; the four UI boards
are wired; every cross-topic reference that was held as bold prose is promoted to a link.
**Phase QC at close, measured off disk:** 0 files over the 300-line cap · 0 MDX hazards ·
`fixlinks.py` 0 unresolved links · every chunk and index footered.
**Final tally, counted off disk: 470 chunks + 12 indexes, 114,665 lines, 5,985 ★.** This session added 128 chunks and ~29,700 lines
across topics 10, 11 and 12.

✅ **SUPERSEDED 2026-09-01 — the phase closed.** The 2026-08-31 wind-down banner (23 dangling
links, "the phase did NOT close") is history: all 12 topics carry an index and the phase-11
dangling-link count measured off disk on 2026-09-01 is **0**. Kept for the record only.

Originally **claimed 2026-08-31** on the user's order *"Pick java phase 11 where we left off and deploy upto 3 sub agents to complete it phase by phase only"*. Three `devbible-author` forks dispatched, **one topic each**: A→`10-property-based`, B→`11-mutation-testing`, C→`12-real-world-scenarios`. Each fork owns its whole directory including its `README.md`; each was told to resolve **every** dangling forward link in its own directory and to run **no git commands at all** — the coordinator commits. The coordinator still owes topic 12 its **contiguous `sidebar_position` renumber** at close.

`docs/java/pages/phase-11-testing/` · 🔴 read `_PHASE-NOTES.md` first (69 lines, binding).
Topics 01–09 closed: **349 chunks, ~84,300 lines**. ✅ **09 CLOSED 2026-08-31 — 22 chunks + index, 5,306 lines, 304 ★, positions 0–22, 0 over cap, 0 dangling links, one proven split (324/16 → 407/23).**

🔴 **2026-08-31 — the user authorised forks to close the phase**: *"You can deploy agents make
sure to adhere instructions and especially hard rules and finish the current picked phase just
split the work"*. The split is **one topic per agent**, not bands inside one topic — the four
remaining topics are disjoint directories, so there is no renumbering to collapse at close.
Coordinator `01cb3b13` holds 09; forks A/B/C hold 10, 11 and 12.

⏸ **STOPPED BY THE USER 2026-08-31** (*"At the moment please stop"*). All four forks were stopped
cleanly, every complete file was preserved and committed, scratch files deleted, working tree clean.

🔴🔴 **BEFORE ANY NEW WRITING IN THIS PHASE: 26 DANGLING FORWARD LINKS BLOCK A CLEAN BUILD.**
Topics 10, 11 and 12 all link to chunks their forks never reached. Each must be written or demoted
to plain bold prose (the phase-13 precedent, commit `39ad34bc`). **The exact 26 filenames, the
audit command, and what the coordinator still owes topic 12 (a contiguous renumber of its gappy
1–29 / 30–59 bands, plus its `README.md`) are all in [[progress-java-p11-fork-run-20260831]].
Read that file first.**

| # | Topic | Tier | State | Held by |
|---|---|---|---|---|
| 01 | JUnit 5 | Understand | ✅ **done (63 chunks + index)** | — |
| 02 | AssertJ | Understand | ✅ **done (25 chunks + index)** | — |
| 03 | Parameterized tests | Understand | ✅ done (38) | — |
| 04 | Mockito | Master | ✅ **done (58 chunks + index)** | — |
| 05 | The test pyramid in Spring | Understand | ✅ done (23) | — |
| 06 | Web-layer tests with `MockMvc` | Understand | ✅ done (35) | — |
| 07 | Testcontainers | Understand | ✅ done (51) | — |
| 08 | Test data patterns | Understand | ✅ **done (34 chunks + index, ~8,999 lines, 450 ★)** | — |
| 09 | Coverage with JaCoCo | Understand | ✅ **done (22 chunks + index, 5,306 lines, 304 ★, positions 0–22, 0 over cap, 0 dangling links)** | — |
| 10 | Property-based testing | When | ✅ **done (40 chunks + index, 9,469 lines, 389 ★, contiguous 1–40, 0 dangling, 0 over cap)** | — |
| 11 | Mutation testing | When | ✅ **done (38 chunks + index, 10,083 lines, 437 ★, contiguous 1–38, 0 dangling, 0 over cap)** | — |
| 12 | Real-world testing scenarios | Understand | ✅ **done (50 chunks + index, 11,818 lines, 598 ★, contiguous 1–50)** | — |

⚠️ Topics 10 and 11 use the tier class `t-when` in the phase README, not `t-when-needed`.
**Match the README; do not "fix" it** — that is a whole-corpus rename, not a phase-11 job.

## Phase 12 · The JVM in production — 13/15 · **87%** · held by: 🚧 **`1f23d6f4` from 2026-09-05** *(both remaining rows claimed; previously released 2026-09-04 09:15 by `77cb65cf` — all tasks killed on the user's instruction; everything committed, nothing to salvage)*. Both remaining rows are `⚠️ partial` and each names its exact next file and position. **13 · JVM flags** at 11 chunks (next `05f-the-live-list-jdk-25.md`, pos 12) · **11 · GraalVM** at 18 chunks (next `08-testing-a-native-image.md`, pos 19). Research for BOTH is complete and banked — see [[progress-java-p12-run-20260904]]. Closing them takes the phase to 15/15; the four UI boards move only then.

| # | Topic | Tier | State | Held by |
|---|---|---|---|---|
| 01 | Memory layout | Understand | ✅ **done — 46 chunks + index, 11,267 lines, 691 ★, contiguous 1–46, 0 over cap, 0 dangling links** | — |
| 02 | GC in practice | Understand | ✅ **done — 42 chunks + index, 10,652 lines, 537 ★, contiguous 1–42, 0 over cap, 0 within-topic dangling links** (closed 2026-09-01 by `d3dcf9f3`) | — |
| 03 | Heap sizing in containers | Understand | ✅ **done — 16 chunks + index, 3,860 lines, 213 ★, positions 0–16, 0 over cap, 121 links 0 dangling** | — |
| 04 | `OutOfMemoryError` | Understand | ✅ **done — 23 chunks + index, 6,130 lines, 316 ★, positions 0–23, 0 over cap, 0 broken links** | — |
| 05 | Thread dumps | Understand | ✅ **done — 15 chunks + index, 3,757 lines, 248 ★, contiguous 0–15, 0 over cap, 0 dangling** | — |
| 06 | JFR, Mission Control and async-profiler | Understand | ✅ **done — 19 chunks + index, 4,628 lines, 320 ★** (closed 2026-09-01, commit `50b9289c`) | — |
| 07 | Logging done right | Master | ✅ **done — 28 chunks + index, 7,275 lines, 435 ★, contiguous 1–28, 0 over cap, 0 within-topic dangling links** (closed 2026-09-01 by `d3dcf9f3`) | — |
| 08 | Metrics with Micrometer | Understand | ✅ **done — 33 chunks + index, 8,372 lines, 493 ★, contiguous 0–33, 0 over cap, 0 broken links, 0 MDX hazards** (closed 2026-09-03 02:35 by `c246d8d8`; chunk 11 drafted at 341 and SPLIT into `11` + `11b`, proven up 341→514 lines / 25→45 ★ / 10→19 gotchas / 9→16 Q) | — |
| 09 | Distributed tracing | Know | ✅ **done — 15 chunks + index, 3,042 lines, 117 ★, 0 over cap, 0 duplicate positions, 0 `{/* FOOTER */}` markers** (closed 2026-09-03 by `c246d8d8`; measured off disk 2026-09-04 by `77cb65cf`) | — |
| 10 | Packaging for deploy | Understand | ✅ **done — 29 chunks + index, 7,647 lines, 0 over cap, 0 MDX hazards; 2 forward links to 11/12 indexes resolve this run** (closed 2026-09-02 14:37 by `67176b1d` fork A) | — |
| 11 | GraalVM native image | Know | ⚠️ **partial — 18 chunks, positions 1-18 contiguous, 0 over cap, 0 MDX hazards, 124 links 0 broken. NEXT: `08-testing-a-native-image.md` at pos 19**, then `09-when-it-pays.md` (20), `10-the-checklist.md` (21), `README.md` (**pos 0**), `_category_.json`, and 🔴 **replace all 18 `{/* FOOTER */}` markers with real navigation**. Fork KILLED mid-topic 2026-09-04 09:05 on the user's instruction; its 07c/07ca/07d/07e were salvaged and its 5 forward links de-linked. 🔴 **RESEARCH IS COMPLETE — do not re-fetch.** Sources and the itemised contents of every remaining chunk are in [[progress-java-p12-run-20260904]]. ⚠️ **09 must NOT duplicate `../15-checkpoint-restore-crac/07-crac-vs-native-image-vs-aot-cache.md`** — link it | 🚧 **picked 2026-09-05 by `1f23d6f4` (fork B)** |
| 12 | Graceful shutdown | Understand | ✅ **done — 16 chunks + index, 3,282 lines, 232 ★, contiguous 0–16, 0 over cap, 156 links 0 broken, 0 MDX hazards** (closed 2026-09-03 03:20 by `c246d8d8`) | — |
| 13 | JVM flags that matter in 2026 | Know | ⚠️ **partial — 11 chunks, positions 1-11 contiguous, 0 over cap, 0 MDX hazards, 21 links 0 broken. NEXT: `05f-the-live-list-jdk-25.md` at pos 12**, then `06-the-retired-list.md` (13), `06b-the-flag-that-stops-your-jvm-booting.md` (14), `07-where-flags-come-from.md` (15), `08-the-discipline.md` (16), `09-the-checklist.md` (17), `README.md` (**pos 0**), `_category_.json`, and 🔴 **replace all 11 `{/* FOOTER */}` markers**.** 🔴 FIVE CORRECTIONS ARE IN THESE PAGES — do not revert:** (a) PrintFlagsFinal does NOT print `:=` on JDK 25 (plain `=` + origin column); (b) PrintFlagsFinal is **not in the JDK 25 java man page** at all; (c) `-XX:-ZGenerational` is OBSOLETE, not unparseable (`_PHASE-NOTES.md` item 1 is wrong); (d) 🔴 **BOTH `-XX:+HeapDumpOnOutOfMemoryError` AND `-XX:OnOutOfMemoryError` apply ONLY to Java-heap exhaustion** — verbatim — so metaspace/direct-buffer/native-thread exhaustion get no dump and no hook; (e) `-XX:MaxDirectMemorySize` defaults to the max heap. 🔴 **The 05x series was renumbered twice**: 05 heap sizing · 05b ceilings-not-the-heap · 05c GC · 05d diagnostics · 05e armed instrumentation · planned 05f JDK 25 | 🚧 **picked 2026-09-05 by `1f23d6f4` (fork A)** |
| 14 | Benchmarking with JMH | Know | ✅ **done — 19 chunks + index, 3,976 lines, 151 ★, contiguous 0–19, 0 over cap, 117 links 0 broken** (closed 2026-09-01 by `f413d97a`) | — |
| 15 | Checkpoint/restore (CRaC) | When | ✅ **done — 13 chunks + index, 2,304 lines, 89 ★, contiguous 0–13, 0 over cap, 81 links 0 broken** (closed 2026-09-01 by `f413d97a`) | — |

## Phase 13 · OAuth2 & OIDC — 8/14 closed · **57%** · held by: 🚧 **`1f23d6f4` from 2026-09-05 — topic 09 only** (rows 10–14 remain FREE)

🔴🔴 **START HERE FOR PHASE 13 — topics 01–08 are CLOSED. Every remaining row (09–14) is
FREE and has nothing on disk; each needs a `_plan.md` first.**

**2026-09-04, session `e7ea206c`** (wound down on the user's instruction, working tree clean,
everything committed):

1. Wrote the four owed indexes — **03, 05, 06, 08** — plus one for 07. Phase 21% → 50%.
2. 🔴 **Wired real footers into all 76 existing chunks.** Every one had ended at a bare
   `{/* FOOTER */}` marker: a valid MDX comment with no link, so the cap check, `mdxcheck.py`
   **and** the link resolver all passed pages that had **no navigation at all** — including
   the three topics already marked closed.
3. Repointed **41** stale `*(not written yet)*` markers that named topics now on disk, and
   added the **seven missing `_category_.json`** files (only 05 had one).
4. Split `08/05-the-request-path.md` (302 lines once footered) into `05d`; topic 08 chunks
   3,480 → 3,604 lines and 167 → 172 ★, **both UP**.
5. 🔴 **Closed topic 07 · OpenID Connect** — was 1 chunk, now **14 chunks + index, 3,415
   lines, 202 ★**. Four pages were drafted over the cap and split (343→474, 342→440,
   313→416, 316→400 lines); every split proved UP on both counts.

**QC at wind-down, whole phase:** 0 over the 300-line cap · 0 `{/* FOOTER */}` markers ·
**569 links, 0 dangling** · 0 MDX hazards · no duplicate `sidebar_position` in any topic ·
every content page badged and `> Verified:`-stamped.

🔴 **Research for topic 07 is BANKED — [[research-java-p13-t07-oidc]]. Do not re-fetch.**
⚠️ **Provenance limit to inherit:** the published HTML of OIDC Core 1.0 **truncates before
§5**. §5.1 (Standard Claims), §5.3/§5.3.2 (UserInfo), §5.4 (scope→claims) and §8 (subject
identifier types) could **not** be read — two attempts, both empty. Chunks 10, 11 and 12 say
so on their own `> Verified:` lines and present that material as well-established practice
rather than as quotation. The four **logout** specifications (RP-Initiated, Front-Channel,
Back-Channel, Session Management) are separate documents and were **not fetched**; chunk 14
describes the layers without quoting their parameter tables. **A later pass with a readable
copy should upgrade those four pages to verbatim citation.**

⚠️ **Closed ≠ exhausted.** Each of 03, 05, 06 and 08's indexes carries a **Still owed**
section naming chunks the 2026-08-31 author referenced in prose but never wrote — 2 in topic
03, 7 in 05, ~12 in 06, ~10 in 08. Those are extension work on closed topics, not blockers.


**Verified off disk at hand-off, not from memory:**

| Topic | Chunks | Lines | ★ | Index? |
|---|---|---|---|---|
| 01 · Why OAuth2 exists | 5 | 1,214 | 73 | ✅ **closed** |
| 02 · The four roles | 6 | 1,590 | 106 | ✅ **closed** |
| 03 · Authorization code + PKCE | 20 | 4,711 | 256 | ✅ index written 2026-09-04 |
| 04 · Client credentials | 3 | 716 | 44 | ✅ **closed** |
| 05 · The three tokens | 16 | 3,982 | 188 | ✅ index written 2026-09-04 |
| 06 · JWT anatomy and validation | 11 | 3,005 | 150 | ✅ index written 2026-09-04 |
| 07 · OpenID Connect | **14** | **3,415** | **202** | ✅ **CLOSED 2026-09-04** |
| 08 · Spring Security resource server | **15** | **3,604** | **172** | ✅ index written 2026-09-04, `05d` split out |
| **Phase total** | **76 + 3 indexes** | **18,886** | **1,001** | |

✅ **The phase is committed and QC-clean.** ~~Every chunk carries its `{/* FOOTER */}` end
marker~~ — 🔴 **that was the defect, not the reassurance**: all 76 shipped with no navigation
at all. Fixed 2026-09-04. Current state: 0 files over the 300-line cap · 0 MDX hazards ·
**569 links, 0 dangling** · 0 footer markers.

⚠️ **Forward references in the part-written topics are deliberately PROSE, not links.** When
the forks were stopped they had linked ahead to 87 chunks they never wrote, which fails the
Docusaurus build; every one was demoted to `**Title** *(not written yet)*`. **As you write a
missing chunk, convert its prose mention back into a link** — grep the topic for
`(not written yet)` to find them.

🔴 **Read `docs/java/pages/phase-13-oauth2-oidc/_PHASE-NOTES.md` (149 lines) before writing.**
Binding, and **corrected mid-run** when verification caught the first draft overstating RFC
9700: implicit is **SHOULD NOT** (§2.1.2), only the password grant is **MUST NOT** (§2.4),
and PKCE is **MUST for public / RECOMMENDED for confidential** (§2.1.1). It also pins Spring
Security **7.x** (the phase README said 6.x — corrected) and the cite-by-RFC-section rule.
Full record: [[progress-java-p13-oauth2]].

**Topics 09–14 are untouched** — nothing on disk; each needs a `_plan.md` first.

`docs/java/pages/phase-13-oauth2-oidc/`


| # | Topic | Tier | State | Held by |
|---|---|---|---|---|
| 01 | Why OAuth2 exists | Understand | ✅ **done** (5 chunks + index, 1,214 lines, 73 ★) | — |
| 02 | The four roles | Master | ✅ **done** (6 chunks + index, 1,590 lines, 106 ★) | — |
| 03 | Authorization code flow with PKCE | Master | ✅ **done** (20 chunks + index, 4,711 lines, 256 ★ — index written 2026-09-04; its **Still owed** section names 2 unwritten chunks: 16 implicit grant, 17 password grant) | — |
| 04 | Client credentials flow | Understand | ✅ **done** (3 chunks + index, 716 lines, 44 ★) | — |
| 05 | The three tokens | Master | ✅ **done** (16 chunks + index, 3,982 lines, 188 ★ — index written 2026-09-04; **Still owed**: 7 chunks — refresh rotation, the rotation race, reuse detection/RFC 7009, revocation reach, RFC 7662 introspection, opaque-vs-JWT, the ID token role) | — |
| 06 | JWT anatomy and validation | Master | ✅ **done** (11 chunks + index, 3,005 lines, 150 ★ — index written 2026-09-04; **Still owed**: time claims, RFC 9068 profile, the algorithm table, `kid` lookup, key rotation, the five classic attacks, the validator chain, `JwtEncoder`) | — |
| 07 | OpenID Connect | Understand | ✅ **done** (14 chunks + index, 3,415 lines, 202 ★ — closed 2026-09-04 by `e7ea206c`; four chunks drafted over cap and split, every split proved UP). ⚠️ Three pages carry an explicit provenance limit for OIDC Core §5/§8 and one for the logout specs — see the index's "What this topic does not cover" | — |
| 08 | Spring Security as resource server | Master | ✅ **done** (15 chunks + index, 3,604 lines, 172 ★ — index 2026-09-04, `05-the-request-path` split into `05d`; **Still owed**: audience/validator-bean/clock-skew/RFC 9068 chunks, authorities mapping + the converters, introspection, multi-tenancy, error responses, actuator) | — |
| 09 | Spring as OAuth2 *client* | Understand | 🚧 **picked 2026-09-05 by `1f23d6f4` (fork C)** — nothing on disk; needs a `_plan.md` first | `1f23d6f4` |
| 10 | Method security | Understand | ⬜ open | — |
| 11 | Running vs buying the AS | Know | ⬜ open | — |
| 12 | Token relay across microservices | Understand | ⬜ open | — |
| 13 | Sessions vs tokens, honestly | Understand | ⬜ open | — |
| 14 | mTLS and workload identity | Know | ⬜ open | — |

## Phase 14 · Microservice architecture — 1/12 · **8%** · held by: *(free)*

🔴🔴 **TOPIC 02 IS CLOSED AND AUDITED, 2026-09-04.** It was written by **Gemini**, an external
agent, under `PROMPT-gemini-java-phase-14.md`; committed as `5c2dc1b0` (61 chunks, 12,509 lines,
581 ★, after 145 numbering repairs), then **audited line by line and repaired** as `c364141d`
(→ 12,624 lines, ★ intact). 🔴 **Read [[progress-java-p14-t02-gemini-review]] before extending
this topic or before handing another topic to an external agent** — it carries the four
hardening clauses the next brief needs. The one finding left open is the **templated tail band,
chunks 34–60**: 22 consecutive files at exactly 4 gotchas / 4 questions and ~150 lines against
the head band's ~249. That is missing depth, which needs an authoring pass against fetched
sources, not a repair; the topic's README discloses it to the reader in the meantime.

⚠️ **Recount 2026-09-04:** **02 is closed** (61 chunks + index). **01 and 04 remain `⚠️ partial`
with no index** — 01 at 39 chunks / 9,166 lines / 437 ★ and 04 at 34 chunks / 7,933 lines / 385 ★,
their forward links to unwritten chunks still in `*(not written yet)*` form. Nothing is over the
300-line cap anywhere in the phase. Fork session `af46ba56` is long gone; **rows 01 and 04 are
free to reclaim**, and each needs its index, its footers and its markers re-linked to close.

🔴 **PRIORITISED 2026-09-01 on the user's instruction:**

> *"I feel like at this moment we need 14 · Microservice architecture and rest 15 and 16 will
> pick it up some other time"*

**Phase 14 is the next phase after 11 closes.** Phases 15 (messaging) and 16 (resilience) are
**deferred, not cancelled** — leave their rows untouched and do not let a session drift into them
because they are adjacent. Phase 12 (JVM in production) and phase 13 (OAuth2) keep their existing
state and are not reordered by this; the instruction named 14 against 15 and 16 only.

🔴 **RUN STARTED 2026-09-01, session `af46ba56`** — on the user's instruction *"continue with java
and microservices"* and then *"Please deploy max 3 more agents split work between all of you"*.
**Four workers: coordinator + 3 `devbible-author` forks, one whole topic directory each** (the
user's cap of 3 additional agents overrides the playbook's 3-including-coordinator ceiling).

✅ **`_PHASE-NOTES.md` is WRITTEN and BINDING** (commit `2a060fde`, 174 lines) — do not re-derive
it. It pins the verified spine (**Spring Cloud 2025.1.x "Oakwood", every component 5.0.x, Boot
4.1 compat from 2025.1.2 onward, Spring gRPC 1.0.3, Spring Modulith 2.1.1**), **eight breaking
changes that invalidate most published samples** (Gateway's old artifacts REMOVED, no
`spring-cloud-starter-parent`, Jackson 3, REST Assured out of Contract 5.0, `RestTemplate` out of
Netflix 5.0, gRPC now inside Boot, dead Stream/Function modules, Retry circuit-breaker
maintenance-only), the **twelve fixed directory names** and the twelve topic boundaries.

⚠️ **The phase README's banner said "Spring Boot 3.x / Spring Cloud 2023+ era"** — three trains
stale. The coordinator corrects the banner only; **no directory or topic title is renamed.**

**Fork split:** A→`01-monolith-first` · B→`02-service-boundaries` · C→`04-sync-vs-async`.
Disjoint directories, each fork owns its own `README.md` and numbers its chunks 1..N — so there
is **no cross-fork renumbering at close**. Forks run **no git commands**; the coordinator commits.
Coordinator's own share: the README banner and the **nine remaining `_plan.md` files** (03,
05–12), which take those rows from `⬜ open` to `📋 planned`.

✅ **COORDINATOR'S SHARE DONE 2026-09-01.** All **nine** `_plan.md` files are written and
committed (`a095d01c`, `43633fd0`, `3344edcf`, `5a9011d8`, `661459f9`, `4191642c` and the t10–t12
commits), and the phase README banner is corrected (`5edafa6d`). **Every phase-14 topic except
the three the forks hold is now `📋 planned` — any cold session can take one.** Each plan carries
a fixed boundary paragraph, a chunk table and a **"verify, do not assume"** list naming the
Oakwood trap that topic must defuse. 🔴 **Topic 12 is written LAST** — its whole value is linking
back to 02/03/04/05, so writing it early guarantees dangling links.

| # | Topic | Tier | State | Held by |
|---|---|---|---|---|
| 01 | Monolith first — honestly | Understand | ⚠️ **partial — 39 chunks / 9,166 lines / 437 ★, no index.** Next `sidebar_position` 40; needs index + footers + `*(not written yet)*` re-link to close | *(free — `af46ba56` gone)* |
| 02 | Service boundaries from bounded contexts | Master | ✅ **CLOSED · AUDITED · DEPTH-PASSED ×2 — 76 chunks + index, 17,598 lines, 797 ★, max file 300, positions 0–76 contiguous, 0 FOOTER markers, 0 MDX hazards, 527 links 0 broken.** Written by **Gemini** (`5c2dc1b0`), audited and repaired (`c364141d`), then **both depth passes completed 2026-09-04** — chunks 34–60 (+7 siblings) and the head band 12–23 (+9 siblings), **60 → 76 chunks, 12,624 → 17,598 lines, 581 → 797 ★**. 🔴 **Longest identical gotcha/question run anywhere in the topic is now 3, from 22.** Nothing open. Research banked at [[research-java-p14-t02-depth-pass]], **do not re-fetch**; record at [[progress-java-p14-t02-gemini-review]] | — |
| 03 | Database-per-service | Understand | 📋 **planned** (18 chunks) | — |
| 04 | Sync vs async as the coupling decision | Master | ⚠️ **partial — 34 chunks / 7,933 lines / 385 ★, no index.** Next `sidebar_position` 35; needs index + footers + `*(not written yet)*` re-link to close | *(free — `af46ba56` gone)* |
| 05 | Inter-service REST that survives change | Understand | 📋 **planned** (20 chunks) | — |
| 06 | gRPC | Know | 📋 **planned** (16 chunks) | — |
| 07 | API gateway with Spring Cloud Gateway | Understand | 📋 **planned** (21 chunks) | — |
| 08 | Service discovery | Understand | 📋 **planned** (`_plan.md` only, 0 chunks) | — |
| 09 | Centralized configuration | Know | 📋 **planned** (`_plan.md` only, 0 chunks) | — |
| 10 | Correlation across services | Understand | 📋 **planned** (16 chunks) | — |
| 11 | Consumer-driven contract testing | Understand | 📋 **planned** (18 chunks) | — |
| 12 | The distributed monolith | Understand | 📋 **planned** (`_plan.md` only, 0 chunks) | — |

## Phase 15 · Messaging & event-driven — 0/14 · **0%** · held by: *(unclaimed)* — ⏸ **DEFERRED 2026-09-01**

⏸ Deferred on the user's instruction of 2026-09-01 (*"rest 15 and 16 will pick it up some other
time"*). Not cancelled. Phase 14 comes first.

| # | Topic | Tier | State | Held by |
|---|---|---|---|---|
| 01 | Why queues | Understand | ⬜ open | — |
| 02 | RabbitMQ model | Master | ⬜ open | — |
| 03 | Kafka is a log, not a queue | Master | ⬜ open | — |
| 04 | Producing from Spring | Understand | ⬜ open | — |
| 05 | Consuming and rebalancing | Understand | ⬜ open | — |
| 06 | Spring Kafka in practice | Understand | ⬜ open | — |
| 07 | Delivery semantics, honestly | Master | ⬜ open | — |
| 08 | Idempotent consumers | Master | ⬜ open | — |
| 09 | The transactional outbox | Master | ⬜ open | — |
| 10 | Sagas | Understand | ⬜ open | — |
| 11 | Event design | Know | ⬜ open | — |
| 12 | Schema evolution on the wire | Know | ⬜ open | — |
| 13 | Spring Cloud Stream | Know | ⬜ open | — |
| 14 | Choosing the broker | Understand | ⬜ open | — |

## Phase 16 · Resilience & operations — 0/13 · **0%** · held by: *(unclaimed)* — ⏸ **DEFERRED 2026-09-01**

⏸ Deferred on the user's instruction of 2026-09-01, alongside phase 15. Not cancelled.

| # | Topic | Tier | State | Held by |
|---|---|---|---|---|
| 01 | Timeouts first, everywhere | Master | ⬜ open | — |
| 02 | Retries without making it worse | Master | ⬜ open | — |
| 03 | Circuit breakers with Resilience4j | Master | ⬜ open | — |
| 04 | Bulkheads and rate limiting | Understand | ⬜ open | — |
| 05 | Composing the decorators | Understand | ⬜ open | — |
| 06 | Load shedding and backpressure | Know | ⬜ open | — |
| 07 | Health checks that don't lie | Understand | ⬜ open | — |
| 08 | Deploying without downtime | Understand | ⬜ open | — |
| 09 | Kubernetes for the Java developer | Understand | ⬜ open | — |
| 10 | Service mesh | Know | ⬜ open | — |
| 11 | Observability across the fleet | Understand | ⬜ open | — |
| 12 | Distributed locks and leader election | Know | ⬜ open | — |
| 13 | Chaos engineering | When | ⬜ open | — |

---

## 🔴 WHEN A SESSION DIES — reclaiming an abandoned chapter

**A session that dies abruptly writes nothing on its way out.** Usage exhausted mid-topic,
terminal closed, OS reset — the row keeps saying `🚧 picked` forever and the chapter is
frozen. So **reclaim never depends on the dead session having done anything.** It is
decided from evidence that exists either way: the filesystem and `git log`.

### The heartbeat

🔴 **Every per-file commit re-stamps your own holder cell** with `date '+%Y-%m-%d %H:%M'`.
You are committing anyway — the cadence is per file — so the stamp costs nothing and it is
what makes "how long has this been dead" a measurable question instead of a guess.

### One command decides it

```bash
python3 /mnt/Storage/my-learning/claude/shared/scripts/java-board-recount.py --stale-hours 8
```

It ignores the board and rebuilds the truth from disk and git, then prints three lists:

- **`BOARD DISAGREES WITH DISK`** — a row claiming `done` with no `README.md` index, or the
  reverse. **Disk wins. Fix the board.**
- **`ABANDONED CLAIMS`** — `🚧 picked` with no commit under that topic for `--stale-hours`.
  Each line names the holder and how long it has been idle.
- **`PARTIAL topics`** — chunks on disk, no index. For each: the path, the chunk count, the
  **next free `sidebar_position`**, and the last commit. That is everything needed to
  *resume* rather than restart, and it is derived, not remembered.

### The reclaim rule

1. Run the recount. If your intended topic is not listed as abandoned, **it is live — take
   a different one.**
2. If it is: `git log --oneline -5 -- <that topic path>` and `ls` the directory. Confirm the
   chunk count and the last file written.
3. Flip the row to `⚠️ partial (N chunks, next: <exact next filename>)`, then claim it with
   **your** session id and today's stamp. Note the previous holder in the commit message —
   never delete their history.
4. **Resume at the next free `sidebar_position`.** Do not renumber, do not rewrite finished
   chunks, do not restart the topic. Read every chunk already there first.
5. ⚠️ **A chunk with no `{/* FOOTER */}` marker was cut off mid-write.** Finish that one file
   before starting any new one — a half-written file is worse than no file.

**8 hours is the default, not a law.** A session that has held a row across two days with no
commit is dead whatever the flag says; one that committed twenty minutes ago is alive even
if it has been quiet since.

---

## How to actually do the work

🔴 **[`JAVA-PLAYBOOK.md`](JAVA-PLAYBOOK.md)** — the four-step phase recipe (`_PHASE-NOTES.md`
→ bulk `_plan.md` → banked research → author one topic at a time), the measured sizing
(25–68 chunks per topic, so **one session ≈ one topic**), the standing orders (the 300-line
cap, prove-a-split, never `git add -A`, the 80% kill switch, the version spine) and which
of the other memory files are worth opening. **Read it once you hold a row.**
