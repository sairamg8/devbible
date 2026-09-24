---
name: cursor-java-p11-audit-history
description: Cold history rotated out of CURSOR-JAVA-P11-AUDIT.md — superseded session blocks, verbatim. Opened by name or by recall.sh, never on the hot path
metadata:
  type: progress
---

# CURSOR-JAVA-P11-AUDIT.md — history

---

<!-- rotated out of CURSOR-JAVA-P11-AUDIT.md on 2026-09-08 -->

# Moved out of `CURSOR-JAVA.md` at the 300-line cap, 2026-08-31

The cursor is what you need to **start writing**; this file is the **proof of what is already
done**. Nothing below was trimmed — it was moved verbatim when the cursor crossed 300 lines
after the topic-08 close.

## Where it stopped — a CLEAN boundary, nothing half-written

✅ **Phase 11 · Topic 07 · Testcontainers CLOSED 2026-08-31** — 50 chunks + `README.md` index,
~11,900 lines, 657 ★, positions contiguous **1–50**, all four UI boards wired, committed and
**pushed**. Built by four agents in one topic on disjoint bands.

✅ **The whole site BUILDS GREEN.** Isolated build 2026-08-31: **4,820 pages, 2,152 Java,
0 `[ERROR]`, 0 `[WARNING]`, 0 broken links.** Registry row claimed before and cleared after;
artefacts deleted. Baseline recorded in `shared/session_build_devserver_registry.md`.

✅ **Working tree clean, `main` pushed to origin, one worktree only, no branches, no stashes.**

## What the topic-07 run established, for whoever resumes

🔴 **Sixteen splits, every one proven** by recording `wc -l` and `grep -c '^\*\*★'` **before**
and demanding both after. The working pattern: **write the chunk to exhaustion, let the
PostToolUse cap hook flag it, then split on the concept boundary the page already has** and
redistribute the gotchas and questions to the half each belongs to. Record both numbers in the
commit message — that is what makes a trim impossible to pass off as a split.

🔴 **FOUR times the source contradicted a brief or the banked research, and every time the
author who verified rather than complied was right.** Details in
`progress_java_p11_t07_testcontainers.md`. **Keep "verify the brief, do not trust it" in every
fork brief** — it is now the highest-value sentence in it.

⚠️ **A sibling Claude session writes to this checkout.** Commit `43404358` came from one, and
its account of an agent this session owned was wrong. A `git index.lock` race also dropped nine
of thirteen files from one commit. 🔴 **Always `git status --porcelain` after committing here.**

⚠️ **Build-verification trap:** Docusaurus emits `<route>.html`, **not** `<route>/index.html`,
and **strips the numeric prefix** — so `find build -name 'index.html'` and
`find build -path '*07-testcontainers*'` both return ~nothing on a perfectly good build.

⚠️ **Still unfixed, still the user's call:**
`phase-10-data-access/05-sql-first-access/12g-testcontainers-and-serviceconnection.md` is written
against Testcontainers **1.x** and does not compile on the pinned 2.0.5. Phase 10 is closed; a
correction pass is not a drive-by edit.


## 🔴 Phase 11 · Testing — the live board, counted off disk 2026-08-28 12:39

`docs/java/pages/phase-11-testing/` — **209 chunks, ~50,000 lines**, 0 over the cap,
0 MDX hazards. `_PHASE-NOTES.md` is BINDING — read it (it is short).
**Re-counted 2026-08-28 18:12, session `eb985f67`.**
**Re-counted 2026-08-30, session `460b1fa8` — see the cap-violation note below.**

🔴 **A CAP VIOLATION WAS FOUND AND FIXED 2026-08-30.** `06-mockmvc/06-validation-errors.md` was
left at **314 lines** by the fork that died mid-run — the only over-cap file in all 1,355 Java
pages. Split on the mechanism/practice boundary into `06-validation-errors.md` (204 lines, 6 ★)
+ **`06b-asserting-the-error-contract.md`** (143, 10 ★). Proven a split, not a trim: 314 → 347
combined lines, 16 → 16 ★, **0 source lines unaccounted for**. Stubs 07/08/09 shifted to
positions 17/18/19. Commit `1b07e505`.

| # | Topic | Chunks | State |
|---|---|---|---|
| 01 | JUnit 5 | **62** | ✅ **CLOSED 2026-08-28** — index written, positions 0–62 gap-free |
| 02 | AssertJ | 25 | ✅ CLOSED |
| 03 | Parameterized tests | 38 | ✅ CLOSED |
| 04 | Mockito | **57** | ✅ **CLOSED 2026-08-28** — index written, positions 0–57 contiguous, 758 ★ |
| 05 | The test pyramid | **22** | ✅ **CLOSED 2026-08-28** — index written, positions 0–22 contiguous, 300 ★ |
| 06 | MockMvc | **34** | ✅ **CLOSED 2026-08-30** — 34 chunks + `README.md` index, ~8,000 lines, 406 ★, positions 0–34 contiguous. Four boards wired, all committed |
| 07 | Testcontainers | 3 | 🔴 **IN FLIGHT 2026-08-31 with 4 agents — see THE LANE MAP above, which supersedes this row.** The three `draft: true` STUBS (`03-the-junit-integration`, `04-serviceconnection`, `09-the-cost`, 15 lines each) are each assigned to a lane to be REPLACED, not skipped. Resolve every link with `ls`, never from this table |
| 08–11 | test data · JaCoCo · jqwik · PIT | 0 | ⬜ plans only |

🔴 **A topic is NOT closed without a `README.md` index** (`sidebar_position: 0`,
`sidebar_label: "Overview"`). Copy `02-assertj/README.md`'s shape exactly.

### 📁 The phase-11 audit trail lives beside this file

🔴 **`CURSOR-JAVA-P11-AUDIT.md`** — split out of this cursor 2026-08-31 at the 300-line cap,
on a concept boundary: **this file is what you need to START WRITING; that file is the proof
of what is already done.** It holds the written-index record, topic 05's `sidebar_position`
map, the phase-10 Testcontainers 1.x defect, the dangling-link inventory, and 🔴 **the
split-versus-trim incident record that must go into every fork brief.** Read it before
dispatching anyone or splitting anything.

### 🔴 THE RESEARCH IS ALREADY DONE — READ IT BEFORE DISPATCHING ANYONE

Four forks were wound down with their topics unfinished. Their documentation research is
banked and must not be re-derived:

- `research_java_p11_t04_mockito_strictness_spies_injectmocks.md` — everything for
  **`08-spies` and `09-injectmocks`** (07/07b are written).
- `research_java_p11_t05_spring_test_context.md` — bean overrides, the ten-part context
  cache key, the 19 relocated slice annotations. Covers T05 chunks 03–13.
- `research_java_p11_t06_mockmvc.md` — `MockMvcTester` vs classic, and what `@WebMvcTest`
  does to Spring Security. Covers T06 chunks 02–10.
- `research_java_p11_t07_testcontainers.md` — what 2.x broke, `@ServiceConnection` coverage,
  reuse opt-in, Podman. Covers T07 chunks 02–10.

Superseded blocks from [CURSOR-JAVA-P11-AUDIT.md](CURSOR-JAVA-P11-AUDIT.md), verbatim, newest first. Nothing here was dropped;
it was moved so the live file stays inside its 160-line budget.

Search rather than read: `shared/scripts/recall.sh --cold <terms>`

