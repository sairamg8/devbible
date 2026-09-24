---
name: devbible-postgresql-syllabus
description: The PostgreSQL syllabus proposal — 14 phases, 228 topics, awaiting user approval; the three instructions that shaped it and the four open questions
metadata:
  type: project
---

Drafted 2026-08-11 on the user's instruction, **before** finishing Node Phase 9 —
they explicitly reordered the work. Awaiting approval; **no pages until signed off**.

## Where it lives

`docs/postgresql/reviews/proposed-syllabus/` — README + 4 part files. Sits under
`reviews/`, which `docusaurus.config.js` excludes (`**/reviews/**`), so it is **not
built and not in the sidebar**. Verified: build stayed at 327 pages after adding it.
Same convention Express used before promotion.

## Shape

**14 phases · 228 topics · 4 parts.** Master 60 (26%) · Understand 124 (54%) ·
Know 35 (15%) · When Needed 9 (4%). Master is inside the brief's 25–30% band.

| Part | Phases | Topics |
|---|---|---|
| 1 Foundations — architecture, **psql**, types, DDL | 0–3 | 63 |
| 2 SQL — CRUD/DML, joins, aggregation/windows/CTEs | 4–6 | 49 |
| 3 **Node + raw `pg`** — driver, schema/seeding, API CRUD patterns | 7–9 | 48 |
| 4 Performance & production — planner, MVCC, advanced, security/ops | 10–13 | 68 |

## The three instructions that shaped it — all mid-turn, all applied

1. **A dedicated Node + raw `pg` part**, not a row bolted on — "CRUD operations,
   table creations, data insertions, whatever we need for fullstack".
   → Part 3, three whole phases.
2. **"Not only raw pg and node — a dedicated chapter to master `psql`."**
   → Phase 1, 15 rows, shell skills only.
3. **"Every concept … all the examples with node js and postgresql."**
   → An **example policy** in the README, stricter than Node's or Express's: every
   page carries *both* the SQL and the `pg` code that issues it, plus real output
   and the failure as seen from Node (SQLSTATE / `error.code`). A page with only a
   `psql` transcript is defined as incomplete.

Tiers are the same four as Node/Express — the user confirmed this explicitly.

## Verified before writing (not recalled)

**PostgreSQL 18.4** is the target, confirmed by running `postgres:18-alpine` under
podman and reading `select version()`. Local `psql` client is also **18.4**. Note
the existing Node phase 6/7 pages were measured on **17.10** — re-check any
version-sensitive cross-link. Container `devbible-pg18` on **:5444**, `--rm`,
stopped at the end of the session.

## The boundary exception — this is the thing to decide

Part 3 **deliberately overlaps Node Phase 6**, which already owns written pages for
pooling, parameterized queries, `Pool` vs `Client`, transaction propagation, N+1,
repository pattern, migrations, ORMs, replicas, cursors. That contradicts
[[devbible-scope-boundaries]], whose rule is *pick the layer, never split a concept*.

Resolution proposed: Node 6 keeps **runtime concerns** (pool
sizing, transaction propagation, N+1, repository rationale, ORM comparison);
PG Part 3 takes **writing the actual SQL through the driver**, DDL/seeding/bulk
load/migrations from Node, and CRUD/pagination/filtering/upsert query patterns —
none of which exist anywhere today. The two genuinely duplicated rows (`Pool` vs
`Client`, placeholders) are marked **"short recap plus a link"**, not a second
treatment.

### Status 2026-08-12: in force in practice, still not formally approved

**The user has never answered open question 1**, but the exception has been *acted on*
across four completed phases — **3 (19), 4 (20), 7 (16), 8 (16) = 71 pages shipped under
it**. Treat it as the working rule and keep applying it; do not re-open it unprompted.

Phase 7 is where it bit hardest: six of its sixteen pages (01 partly, **02, 04, 07, 13,
15**) are recap-plus-link because Node Phase 6 already owns pooling, placeholders,
lifecycle and cursors properly. They still carry measured output, Trade-off, Gotchas and
Interview sections — they defer the *runtime argument*, not the whole topic.

**Before writing any Part 3 page, read the matching page in
`docs/nodejs/pages/phase-6-data-access/`.** That directory is the overlap zone:
`01-connection-pooling`, `02-parameterized-queries`, `03-driver-lifecycle`, `16-cursors`
are the four that repeatedly collide.

If the user ever answers "shrink Part 3 instead", the cost is a rewrite of those six
pages, not of the phase.

## Four open questions put to the user

1. Approve the boundary exception, or shrink Part 3 and grow Node 6 instead?
   — **still unanswered; being applied as proposed. See the status note above.**
2. 228 topics ≈ 150–170 pages — accept, or cut? Two cuts offered and **not**
   applied: defer Part 4, or demote Phase 12 to an appendix.
3. Confirm the **raw-SQL-first** stance (Prisma/Drizzle stay as a Node 6
   comparison row).
4. Should `pgvector` be more than one When Needed row?

## Grok reviewed it, I audited the review — 2026-08-11

`docs/postgresql/reviews/grok-recommendation.md` (Grok 4.5, 240 lines) — verdict
*approve with bounded amendments*. My audit is `reviews/audit-claude.md` (188 lines).

**The review is accurate** — every falsifiable claim re-checked and true. That is a
first; previous external reviews of this project were confidently wrong. It caught a
**real contradiction I wrote**: `04-performance-and-production.md:105` says "Backups
are Master" while the table has `pg_dump` at Understand and the disaster drill at Know.

Verified-absent gaps it found: **FK columns need their own index** (PostgreSQL does not
create one), **`INCLUDE`/covering indexes**, the **nested-transaction illusion**. And a
real duplication: `$1` placeholders are **Master in both** Phase 4 and Phase 7.

**Its R5 (granularity) is entirely already-satisfied** — string/date functions and the
psql meta-commands are already single grouped rows. Classic audit-rule catch.

**Two things it missed**, both flagged in the proposal itself: the Node 6/7 pages were
measured on **PG 17.10** while this targets 18.4 (every cross-link crosses a major), and
its Wave A includes Part 3's Testcontainers row, which the proposal says must be written
**after** Node Phase 9.

Agreed amendments: **228 → 229 topics, Master 60 → 61 (26.6%)** — add the FK-index row,
fold `INCLUDE` into the index-only-scan row, promote `pg_dump` to Master, split the `$1`
duplication by layer, record the nested-TX gotcha. Plus R1's **≤40-line recap rule** and
R3's **two-wave delivery** (A: Parts 1–3 + Phase 10; B: Phases 11–13), nothing dropped.

**Escalated, not decided:** Grok's R2 would soften the example policy for Phase 1 —
but that policy *is* the user's own instruction ("every concept … all the examples with
node js and postgresql"), so it is theirs to relax. My counter-proposal: group the
shell-only rows (`\e`, `.psqlrc`, `HISTFILE`, prompt) into one honestly-shell-only page
instead. Also: R6 wants `instructions.md` §11 updated on promotion — **ask first**.

## After approval

Promote the 4 part files to `docs/postgresql/syllabus/`, add
`docs/postgresql/README.md` + sidebar entry, add `postgresql` to
`src/data/progress.js` with every phase at `pages: 0`. Then **stop** — pages one
phase at a time, per [[devbible-incremental-scope]].
