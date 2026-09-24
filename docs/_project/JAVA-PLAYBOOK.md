---
name: java-playbook
description: HOW to run a Java phase — the four-step recipe, the measured sizing, the standing orders and the QC. Split out of JAVA-BOARD.md at the 300-line cap. The board says WHAT is pending and who holds it; this says how to do it.
metadata:
  type: project
---

# ☕ Java — the playbook

**Split out of [`JAVA-BOARD.md`](JAVA-BOARD.md) on 2026-08-31, at the 300-line cap, on a
concept boundary: the board is the *position and the claims*, this is the *method*.**
Nothing was dropped — everything below is that content verbatim, and the recovery
material that replaced it on the board is new.

🔴 **Claim a row on the board first.** This file is what you read *after* you hold one.

## 🔴 How to run a phase efficiently — the four-step recipe

Measured from phases 10 and 11: recent topics run **25–68 chunks / ~9,000 lines each**.
72 topics at that depth is roughly **2,900 files and ~650,000 lines** — more than the whole
existing Java corpus again. **One session closes about one topic.** That is the real unit,
and it is why the board exists: wall-clock is `72 ÷ (sessions running in parallel)`.

**Step 1 — claim the phase, then write `_PHASE-NOTES.md` (one session, one sitting).**
Copy the shape of `phase-11-testing/_PHASE-NOTES.md`. It pins the version spine, the tier
discipline and the topic boundaries **once**, so fifteen later topic-sessions do not each
re-derive them and contradict each other. Phases 12–16 have none. This is the highest-
leverage hour in the whole phase.

**Step 2 — write every `_plan.md` for the phase in one pass (one session, ~15 topics).**
A `_plan.md` is a boundary paragraph, a chunk table and a "verify, do not assume" list —
see `phase-11-testing/08-test-data-patterns/_plan.md`. It is cheap to write in bulk and it
is what turns a topic from `⬜ open` into `📋 planned`. **A planned topic can be handed to
any session cold**; an open one cannot. Do all fifteen before authoring any of them.

**Step 3 — bank the documentation research per topic cluster, before authoring.**
`research_java_p11_t0*.md` are the model. The phase-11 record's clearest lesson: research
that is re-derived is the largest single waste, and four times the source contradicted a
brief and **the author who verified rather than complied was right**. Put *"verify the
brief, do not trust it"* in every fork brief.

**Step 4 — author one topic at a time, three agents maximum including the coordinator.**
Two `devbible-author` forks plus the coordinator, all inside the **same** topic directory
on disjoint `sidebar_position` bands. Do not open a second topic until the current one is
closed. The ceiling is about **accounting, not tokens** — at the usage limit a wide fleet
leaves half-written files nobody can tell from finished ones.

🔴 **The board is what makes parallel *sessions* safe under that ceiling.** Three agents is
a per-session limit; the board removes the reason it existed across sessions, because every
claim is on disk and committed. Run one session per phase if you like — but never two
sessions in the same phase without the row-level claims in step 3 of the protocol.

**Suggested order if you are choosing:** 11 (four planned topics, lowest cost to finish a
phase) → 12 (self-contained, depends only on the closed phase 0) → 13 (depends on phase 9's
Spring Security, closed) → 15 → 14 → 16 (16 leans on 14 and 15 for context).

---

## Standing orders that still apply

- 🔴 **300 lines is a file-size cap, never a content budget.** Write to exhaustion, then
  split on a concept boundary. **Prove a split**: record `wc -l` and `grep -c '^\*\*★'`
  before, and both totals must go **up** after. A trim is indistinguishable from a split in
  a file listing and has silently destroyed content four times.
- 🔴 **A topic is not closed without a `README.md` index** (`sidebar_position: 0`,
  `sidebar_label: "Overview"`). Copy `02-assertj/README.md` exactly.
- 🔴 **Never `git add -A`** — several sessions write to this checkout. Stage explicit paths,
  and `git status --porcelain` **after** every commit (an `index.lock` race once dropped
  nine of thirteen files).
- 🔴 **At 80% usage**: wind forks down (never kill), wire the four UI boards from disk,
  commit explicit paths, update this board, commit the store.
- **NO sandbox, NO Docker, no invented output.** Documentation-validated only.
- **Version spine** (from `spring-boot-dependencies:4.1.0`): JDK 25 · Spring Boot 4.1.0 /
  Framework 7.0.8 · JUnit Jupiter 6.0.3 · Mockito 5.23.0 · AssertJ 3.27.7 ·
  Testcontainers 2.0.5.

## The other files, and when they are worth opening

| File | Open it when |
|---|---|
| `CURSOR-JAVA.md` | You want the standing order's history and the phase-11 detail. |
| `CURSOR-JAVA-P11-AUDIT.md` | You are splitting a file, or need the proof of what phase 11 did. |
| `research_java_p11_t0*.md` | You are authoring that topic — **read before dispatching**. |
| `progress_java_python_syllabus.md` | Archaeology only. 1,400 lines. |
| `LOCKS.md` §11i | The cross-language lock table. Its Java row now points here. |

⚠️ **Known defect, unfixed, the user's call:**
`phase-10-data-access/05-sql-first-access/12g-testcontainers-and-serviceconnection.md` is
written against Testcontainers **1.x** and does not compile on the pinned 2.0.5. Phase 10
is closed — a correction pass is not a drive-by edit.
