---
name: devbible-postgresql-review-remediation
description: Session 7 — the cross-phase correctness review's 14 findings, which 13 are fixed, the two review claims that failed verification, and the item-14 re-split queue
metadata:
  type: progress
---

# PostgreSQL cross-phase review — remediation (2026-08-13, session 7)

Child of [[devbible-postgresql-rewrite-handoff]]. That file is the resume point for *writing*
phases; this one covers the **defect list against the five already written phases**
(1, 2, 5, 10, 11).

The review itself is committed in the devbible repo at
`docs/reviews/postgresql/2026-08-13-cross-phase-correctness.md`, and now carries a
resolution-status block at the top plus in-place corrections to its own two bad claims.

## State: items 1–13 done, item 14 not started

Work-order items 1–13 of 14 are fixed in the working tree of devbible. **Nothing is
committed there** — devbible needs an explicit instruction to commit. Clean rebuild after:
`rm -rf .docusaurus build node_modules/.cache && yarn build 2>&1 | grep -iE 'warning|broken|anchor'`
→ grep exit 1.

Fixed, by class:

- **Code that failed when pasted** — `SET LOCAL TIME ZONE $1` (impossible; `SET` is a utility
  statement with no parameter slots) → `SELECT set_config($1,$2,true)`; the `ids.sort()`
  before a multi-row `UPDATE` that never affected lock order; a session advisory lock leaking
  back into the pool on unlock failure; a backoff `sleep` inside `try`/`finally` holding a
  pooled connection; an unbounded `for (;;)` optimistic-retry loop.
- **Factual** — merge join cannot serve a range predicate (needs a *mergejoinable* btree
  equality clause), so a range join has **only** the nested loop, corrected at 3 sites;
  `count(DISTINCT …)` *survives* fan-out while `sum()` does not (the page claimed both
  broke); the phase fixture is five orders not four; a duplicate-column list in the wrong
  order.
- **Cosmetic** — sidebar label `03 · EXISTS` → `03 · Semi and anti joins`; a sentence naming
  `USING` where it meant a `HAVING` predicate.

## Two of the review's own claims did not survive verification

This is the [[devbible-verify-your-own-measurements]] habit applied to a **review** rather
than to a benchmark, and it is the main transferable lesson of the session: a finding that
correctly identifies a defect can still attach a wrong justification to it, and the
justification is what ends up written on the page.

**A5 — pool starvation was overstated.** The finding claimed the page's measured 12.4 s was
"retry cost plus pool starvation" against a default `max: 10`. Both halves were wrong:

- `ex28-mvcc-isolation.mjs` opens its pool with **`max: 25`**, not 10, against 20 concurrent
  transfers — so every sleeper had its own connection and *none* of the 12.4 s was queueing.
- A probe at `max: 10` did not show the predicted slowdown. Capping the pool also caps how
  many transactions conflict at once, which **cut the retry count**, and the unfixed
  (sleep-inside) variant came out **faster** — 8.3 s vs 12.4 s — while retry counts swung
  **71–156 between runs** on this near-total-conflict workload.

The code fix still stands: holding a pooled connection while deliberately idle is wrong on
its face. But the page now says exactly that and cites **no** probe numbers, because the
probe was a throwaway script, not a committed sandbox one.

**A2 — "this invalidates committed output" was wrong.** The finding warned that adding
`created_at` to `j_orders` would alter every `SELECT *` and `console.log(rows)` block in the
phase. In fact `ex35-joins.mjs` contains no `SELECT *` or `o.*` against `j_orders` at all —
the only `SELECT *` output on any phase-5 page is the `j_u1`/`j_u2` duplicate-column demo.
Before/after runs were identical apart from `EXPLAIN ANALYZE` timing jitter; every plan shape
and row count unchanged. **Check whether output is actually reachable before budgeting a
re-paste.**

## Fixture change (affects any future phase-5 work)

`j_orders` now has `created_at timestamptz NOT NULL DEFAULT now()`, with **fixed** timestamps
in the inserts rather than `now()`, so console blocks stay reproducible:

```
10 → 2026-03-01 09:15+00   11 → 2026-03-03 14:40+00   12 → 2026-03-01 11:00+00
13 → 2026-03-04 08:05+00   14 → 2026-03-05 16:20+00  (the orphan, customer_id NULL)
```

2026-03-02 is deliberately empty — that is the gap the calendar-spine example fills. Five
page queries that previously errored `42703 column o.created_at does not exist` now execute.

`ex35-joins.mjs` gained a gap-fill section, so `07-cross-join.md` now shows **measured**
output for a pattern that was previously "presented as runnable" with none — including the
`count(*)` counterexample that reports `1` order on *every* day including the empty ones.
That one is worth reusing: a uniformly wrong report reads as a quiet steady week.

Order 14 is inserted mid-section-3 by the script, so it cannot be folded into the base
fixture block without falsifying the section 1–2 pages. The `01-inner-join/README.md` fixture
documents it as an explicit **second stage** instead, naming which pages depend on it.

## Item 14 — the re-split, NOT started

The clustering tell fired again: **81 of 81 pages across phases 1/2/5/10/11 fell inside
169–269 lines**, none over 270. Third recurrence of [[devbible-never-compress-to-fit-cap]].

⚠️ **This item is scoped to PostgreSQL, but the defect is not.** Measured across every
technology on 2026-08-13 (non-README content pages, `reviews/` and `syllabus/` excluded):

```
postgresql  n=270  median=226  p90=275  max=299   77% in the 200–299 band
typescript  n=37   median=215  p90=248  max=264   78%
javascript  n=45   median=209  p90=235  max=272   71%
react       n=14   median=228  p90=247  max=252   71%
nodejs      n=232  median=208  p90=262  max=300   58%
css         n=28   median=180  p90=195  max=200    3%
git         n=14   median=166  p90=191  max=195    0%
expressjs   n=78   median=45   p90=124  max=163    0%  (thin, not chunked — a different defect)
```

PostgreSQL is the **worst** case, not the only one — TypeScript, JavaScript and React
were written to the same shape, and Node's two 300-line pages
(`phase-8-security/17-input-validation.md`, `phase-6-data-access/06-transactions.md`) sit
exactly on the cap. CSS and Git are clean, which is what a corpus sized by topic rather
than by cap looks like. **When item 14's method is settled, it applies to TS/JS/React
too** — do not close this as a PostgreSQL-only job.

The queue is **20 Master-tier pages still single files** — full table is in the review doc
under "Item 14 — the re-split queue". Worst: `phase-10-indexes/05-index-not-used.md` (260),
`phase-2-types/06-null.md` (255), `phase-11-mvcc/04-lost-update.md` (222).

**Do not read this as "split 20 files".** Splitting a 199-line page yields two 100-line pages
and fixes nothing — the cap was never the constraint. The task is writing each topic to the
depth a Master topic deserves (typically 400–1000+ lines, measured output behind every
claim), and chunking on concept boundaries as the *consequence*. Expect new sandbox scripts
per topic. One topic at a time, per [[devbible-incremental-scope]].

## Still outstanding beyond item 14

The per-phase **rubric** review (`docs/reviews/review-prompt.md` §11 — D1–D5 scores, syllabus
coverage, missing topics) has **not** been run for any of phases 1, 2, 5, 10, 11. The
correctness sweep is not a substitute: it read changed pages for what is *wrong*, not every
page for whether it is *deep enough*. Phases 12, 13, 6 and 9 were not read at all.

**Partly closed 2026-08-13** by [[devbible-fable-postgresql-review]] — a corpus-wide rubric
pass (`reviews/fable/` in the devbible repo root). It scored 10 topics in full and measured
all 228 structurally, so it is not the per-phase review this section asks for, but it does
supply:

- **Item 14's evidence.** Master topics run a median of **530 lines where the phase chunks
  and 220 where it does not** — `count(*)` variants 821, `EXPLAIN` 186. Max file 299 across
  269 files, zero over 300. It also names the four highest-payoff splits and warns that the
  capped pages are *good* (9.2–9.6), so this is a chunk-the-named-topics job, **not** a
  rewrite of phases 1/2/3/4/7/10/11.
- **One new factual error** the correctness sweep missed: `phase-4-crud/13-merge.md` says
  seven times that `MERGE` has no `RETURNING` on PG18. **It does** — `RETURNING` +
  `merge_action()` arrived in PG17, verified on `devbible-pg`.
- A warning that matters for any future audit: **the 12 phase-13 stamps carry fake Gotchas
  and Q&A sections**, so a structural grep for missing sections returns zero hits
  corpus-wide and proves nothing.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-phase5-joins]] ·
[[devbible-postgresql-phase11-mvcc]] · [[devbible-verify-your-own-measurements]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-review-system]] ·
[[devbible-fable-postgresql-review]]
