---
name: progress-java-p11-completion-run-20260831
description: Java phase 11 completion run of 2026-08-31 (session 3e4f455e) — the three-fork dispatch that finishes topics 10, 11 and 12, what has landed on disk so far, and what the coordinator still owes at close. Open this before touching phase-11 topics 10, 11 or 12.
metadata:
  type: project
---

# Java · Phase 11 — the completion run, 2026-08-31 (session `3e4f455e`)

Picks up exactly where [[progress-java-p11-fork-run-20260831]] stopped. That run was halted by
the user mid-flight; this one was ordered to finish the phase.

## What the user authorised

> *"Pick java phase 11 where we left off and deploy upto 3 sub agents to complete it phase by
> phase only"* — then, immediately after dispatch, **"Do not deploy more than 3"**.

🔴 **THREE IS A HARD CEILING, not a target.** It covers replacements too: if a fork dies or comes
back short, the **coordinator finishes its remaining chunks itself** rather than dispatching a
fourth agent. Confirmed to the user in the same turn.

**"Phase by phase only"** — stop at the phase-11 close and report. Do not roll into phase 12.

## 🔴 STANDING ORDER AS OF 2026-09-01 — ONE LANE, ONE AGENT, THEN THE NEXT SMALLEST

The user narrowed the run twice and then extended it, and **the later words win**:

> *"I do not have soo much usage pick one lane only deploy one more agent split task between
> you and that agent to complete that lane"*

then, the same night:

> *"I think we might be able to push it so once complete current phase if usage not exhausted
> please pick next smallest one till completion please and good night i am trusting on you"*

**The operating shape is therefore:**
1. **ONE lane at a time**, chosen as the **smallest remaining** — fewest dangling links.
2. **ONE agent, plus the coordinator writing alongside it.** Not three. The earlier
   *"Do not deploy more than 3"* still stands as an absolute ceiling, but the live instruction
   is tighter than that: one.
3. When a lane closes, **pick the next smallest and keep going until usage is exhausted.**
4. 🔴 The user is asleep and said *"i am trusting on you"*. That raises the bar on the cadence,
   not on the pace: **commit every file as it lands**, keep the store current, and never leave a
   half-written file uncommitted. Do not silently overrun — if usage runs out mid-lane, wind
   down the same way as before and leave the cursor pointing at the exact next file.

**Lane order by size (dangling links), smallest first:**
`10-property-based` (5) → `11-mutation-testing` (9) → `12-real-world-scenarios` (9, but also
3 unwritten plan items **and** the contiguous renumber, so genuinely the largest).

🔴 **THE RULE THAT MAKES A LANE ACTUALLY CLOSE — link only to files that already exist.**
The 2026-08-31 run added ~4,500 good lines and moved the blocker only 26 → 23, because every
fork wrote forward links faster than it backfilled them. Both the coordinator and the agent are
now under a standing instruction: `ls` before writing any link, and refer to anything unwritten
in **plain bold prose with no link**. Under that rule the dangling count can only go down.

## The split — one topic per fork, disjoint directories

| Fork | Topic | State at dispatch | Owed |
|---|---|---|---|
| **A** | `10-property-based` | 13 chunks, 2,911 lines | 7 dangling + `README.md` |
| **B** | `11-mutation-testing` | 10 chunks, 2,611 lines | 8 dangling + `07-what-this-phase-taught.md` (the closing argument for the WHOLE phase) + `README.md` |
| **C** | `12-real-world-scenarios` | 17 chunks, 4,195 lines | 11 dangling + 3 owed by its `_plan.md` + `README.md` |

Each fork owns its whole directory **including its own `README.md`** — unlike the previous run,
where topic 12 was split across two forks and neither could write the index.

🔴 **Every fork was told to run NO git commands at all.** The coordinator commits. The previous
run hit `index.lock` contention with live forks twice; this removes the race entirely.

Sibling-link rule given to all three: **directory-level links only** to other topics
(`../04-mockito/`), never a chunk filename — the sibling forks are writing those files right now
and a guessed filename is a broken link.

## Landed and committed so far

| Commit | Files | Lines | ★ |
|---|---|---|---|
| `153a9a22` | fork A: `04-finding-properties`, `04b-invariants-and-order-independence`, `04c-when-no-law-is-obvious` | 699 | 34 |
| `3016612b` | fork A: `04d-models-and-oracles`, `04e-metamorphic-and-contract-tests` + forward-link backfill into 04/04b/04c | 512 | 23 |
| `881618e1` | fork C: `03-mocking-an-outbound-http-api`, `03a-what-the-mock-server-does-not-run` | 466 | 21 |

**Running total this session: 7 chunks, 1,677 lines, 78 ★, 0 over the 300-line cap.**
Fork A is at 18 chunks / 4,125 lines; fork C at 18 / 4,432; **fork B had emitted nothing at
23:46** — it was still on primary sources (pitest docs, JDK 25 support), which is the right thing
to be slow about.

⚠️ **Forks REVISE files after first writing them** — fork A went back and backfilled forward
links into 04/04b/04c once 04d/04e existed, so those three showed as ` M` after already being
committed. That is normal; recommit rather than treating it as a conflict. Line counts went **up**
on all three, which is the split-not-trim proof.

⚠️ Fork A **split chunk 04 three ways** (04 / 04b / 04c) rather than writing one file to the cap —
a real split, positions 14/15/16, 0 over 300.

## ⏸ WOUND DOWN AT THE 80% USAGE LINE, 2026-08-31 23:5x

The user called the ceiling (*"we are reached 80% of usage"*). All three forks were stopped with
`TaskStop`, every complete file preserved and committed, working tree clean, **0 scratch files,
0 files over the 300-line cap, 0 truncated files**.

🔴 **THEY WERE NOT NEAR DONE. The phase is still 9/12 and the site still does NOT build clean.**
The forks were roughly a third of the way through what they owed when the ceiling hit.

### Where each topic actually stands

| Topic | Chunks | Lines | ★ | Index | Dangling |
|---|---|---|---|---|---|
| `10-property-based` | 22 | 5,177 | 227 | ❌ none | **5** |
| `11-mutation-testing` | 13 | 3,432 | 142 | ❌ none | **9** |
| `12-real-world-scenarios` | 23 | 5,485 | 263 | ❌ none | **9** |

**This session added 18 chunks, ~4,568 lines, ~200 ★** across seven commits: `153a9a22`,
`3016612b`, `881618e1`, `3854a0cc`, `04296569`, `5ef86029`, board stamp `ba0f150f`.

### 🔴🔴 THE BLOCKER IS STILL THE BLOCKER — 23 DANGLING LINKS (down from 26)

The count barely moved because **each fork wrote forward faster than it backfilled**: fork A
closed 7 of its original 7 but opened 5 new ones, fork B closed 2 and opened 4, fork C closed 4
and opened 3. **Writing more chunks does not shrink this list on its own.** The next session
should expect the same and plan to finish a directory, not merely advance it.

**`10-property-based/` (5):** `05c-composing-arbitraries.md` · `06-shrinking.md` ·
`07-reproducibility.md` · `08-edge-cases-exhaustive-and-data.md` · `09-statistics.md`

**`11-mutation-testing/` (9):** `03d2-the-optional-operator-inventory.md` ·
`03d3-the-research-operators.md` · `04-reading-a-report.md` · `04a-the-html-report.md` ·
`04b-equivalent-mutants.md` · `05-wiring-it-up.md` · `05b-gradle.md` ·
`05c-scoping-and-incremental.md` · `06-the-cost.md`
⚠️ Still owes `07-what-this-phase-taught.md` — the closing argument for the WHOLE phase.

**`12-real-world-scenarios/` (9):** `02d-vendor-clients-and-private-methods.md` ·
`02e-the-agent-tax-and-the-decision-table.md` · `03d-asserting-what-you-sent.md` ·
`03f-the-failures-with-no-status-code.md` · `07-async-scheduled-and-eventual.md` ·
`08-a-message-consumer.md` · `08b-the-container-poison-messages-and-redelivery.md` ·
`09-caching-and-idempotency.md` · `09b-idempotency-and-the-double-charge.md`
⚠️ Still owes `10-json-contracts-and-approval-tests.md`, `11-the-legacy-class-with-no-seams.md`
and `12-the-checklist.md` from its plan.

**Re-run the audit from `docs/java/pages/phase-11-testing`:**

```bash
for t in 10-property-based 11-mutation-testing 12-real-world-scenarios; do
  grep -oh '](0[0-9][a-z0-9]*-[a-z0-9-]*\.md)' $t/*.md | sed 's/.*](//;s/)//' | sort -u \
    | while read x; do [ -f "$t/$x" ] || echo "$t -> DANGLING $x"; done
done
```

### What the forks proved works

- Fork B **split `03c` on the cap correctly** when told to (306 → `03c` + `03c2`), totals up.
- Fork A split planned chunk 04 **five ways** (04/04b/04c/04d/04e) — the plan is a floor.
- ⚠️ Fork C invented **out-of-sequence letters** (`03e`, `03g`, skipping `03d`/`03f` which it had
  already linked forward to). Harmless but it means letters are NOT a reliable reading order there.
- ⚠️ `10-property-based/01-the-case-you-did-not-think-of.md` has **no `{/* FOOTER */}` marker**
  (pre-existing, from the earlier run; content is complete). Cosmetic, left alone deliberately.

## 🔴 What the COORDINATOR still owes at close

0. 🔴 **Resolve the 23 dangling links above** — write them or demote to plain bold prose
   (phase-13 precedent, commit `39ad34bc`). Nothing else closes the phase.
1. **Renumber `12-real-world-scenarios/` contiguously.** Its positions are deliberately gappy —
   1–8 and 30–38 from the previous two-fork band split, with fork C filling 9–29 and 39+.
   Collapse to 1..N **without renaming any file**; inbound links point at exact filenames.
2. **The four UI boards** (per completed topic, not per file): `src/data/progress.js` — both
   `pages` and `pagesPlanned` — the phase `README.md`, `docs/java/pages/README.md`, and
   `docs/README.md`. `pages` counts CLOSED TOPICS.
3. **The final dangling audit across all three directories must print nothing.**

## Environment

⚠️ Several sessions share this checkout. **Never `git add -A`.** Lane declared to the cadence
hook as `docs/java`.

See [[java-board]] for claim state, [[progress-java-p11-fork-run-20260831]] for the previous run
and the original 26-link blocker list, [[cursor-java]] for the standing order.
