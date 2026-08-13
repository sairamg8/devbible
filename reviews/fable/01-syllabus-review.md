# 01 · Syllabus review — accuracy, and fit to the fullstack goal

Answers asks **1** (verify the syllabus) and **2** (does each part contribute ≥90% to
building a fullstack application).

Source: `docs/postgresql/syllabus/01-foundations.md` … `04-performance-and-production.md`
and `docs/postgresql/README.md`.

---

## 1 · Structural verification

| Check | Claimed | Actual | Verdict |
|---|---|---|---|
| Phases | 14 | 14 | ✅ |
| Topics | 229 | **228 pages** | ⚠️ off by one — see below |
| Master share | 27% (61/229) | **26.3% (60/228)** | ✅ inside the 25–30% band |
| Understand | 124 | 124 | ✅ |
| Know | 35 | 35 | ✅ |
| When Needed | 9 | 9 | ✅ |
| Phase order dependencies | "Phase 10 before Phase 11" | Indexes (10) → MVCC (11) | ✅ correct — MVCC's vacuum/bloat material genuinely needs index concepts |
| Every page carries a tier badge | — | 228/228 | ✅ |
| Every page carries Gotchas + Interview | — | 269/269 files | ✅ |

**The tier distribution is honest and well-judged.** This is the part of the syllabus I
would change least. Master is reserved for things you actually type without looking up
(`SELECT` shape, `RETURNING`, `ON CONFLICT`, FK actions, `EXPLAIN`, lost update), and the
DBA-flavoured material (`pg_upgrade`, PITR, logical replication) is correctly parked at
`Know`. That single decision is what keeps the fullstack focus intact.

### The off-by-one is a granularity error, not a counting error

Phase 2's syllabus lists **17** rows; `docs/postgresql/pages/phase-2-types/` has **16**
pages. Two syllabus rows were merged into one file:

- Row 9 — *`boolean` and three-valued logic*
- Row 10 — *`date`, `time`, `interval`, and date arithmetic*

→ both became `phase-2-types/09-boolean-dates.md` (213 lines).

**This merge fails your own granularity test** (`instructions.md` §5: *"would you ever
want to read one of these without the others? If no, they are one page"*). Boolean
three-valued logic and interval arithmetic have nothing in common — a reader searching
"why did `sum(flag::int)` return NULL" and a reader searching "why is 31 Jan + 1 month =
28 Feb" are different people with different problems.

The consequence is measurable in the file: `## boolean` runs lines 16–52 — **36 lines**
for a concept that feeds directly into `NULL` semantics, which is Master tier. And the
`time` type named in the syllabus row **has no section at all**.

**Fix:** split into `09-boolean.md` (three-valued logic, `sum(flag::int)` vs
`count(*) FILTER`, boolean in `WHERE` vs `CHECK`, the `'maybe'::boolean` cast set) and
`10-date-time-interval.md` (renumber the tail). Restores the 229 count. See
[06-work-order.md](06-work-order.md) row 6.

---

## 2 · Fit to the fullstack goal

> *"each language should contribute to building a fullstack application 90% above"*

**Assessment: ~93%. This syllabus passes.** I went row by row through all 229 and
classified each as "a fullstack backend developer will use this" vs "this belongs to a
DBA".

| Part | Fullstack-relevant | Notes |
|---|---|---|
| 1 · Foundations (63) | **100%** | Even the architecture rows earn their place — process-per-connection is *why* you pool, and `search_path` prevents a week of confusion |
| 2 · SQL (49) | **100%** | This is the part that makes the rest possible |
| 3 · Node + `pg` (48) | **100%** | Directly the job |
| 4 · Perf & production (68) | **~78%** | The only dilution, and it is deliberate |

The Part 4 rows a fullstack dev will genuinely never own: `pg_upgrade` vs dump/restore,
physical backup + WAL archiving + PITR, logical replication for major upgrades, transaction
ID wraparound, FDW/`dblink`. That is **6 rows out of 229 — 2.6%** — and **every one of
them is already tiered `Know` or `When Needed`.** The tiering is doing exactly the job it
was designed to do. No change needed.

**Two rows I would re-tier upward for this goal:**

| Row | Current | Proposed | Why |
|---|---|---|---|
| **Recursive CTEs** (Phase 6) | `Know` | **`Understand`** | Comment threads, category trees, org charts, and "all descendants of this folder" are ordinary product features, not exotica. Any fullstack dev ships one within a year. It is the only way to query a self-referencing table to arbitrary depth without N+1 from Node |
| **Row-level security** (Phase 13) | `Know` | **`Understand`** (context-noted) | If the app is multi-tenant SaaS — which is the default shape of a product in 2026 — RLS is the difference between one missing `WHERE tenant_id = $1` being a bug and being a data breach. Add the one-line context note the brief allows: *"`Know` for a single-tenant app, `Understand` the moment a second tenant exists"* |

Both are cheap changes to the syllabus table; neither requires new pages beyond what is
already planned.

---

## 3 · What is missing — four real-world patterns with no home

These are not exotic. Each is something a fullstack developer building a real product
hits in the first months, and none has a row in the syllabus.

### 3.1 Transactional outbox <span>Understand</span> — **the significant one**

**Where it belongs:** Phase 12, after `13-listen-notify.md`. Est. ~280 lines (2 chunks).

You cannot write to PostgreSQL and publish to a queue atomically. Every app that has both
a database and a message bus — which is every app the moment it sends an email, charges a
card, or talks to a second service — faces this, and most discover it as "the payment
succeeded but the confirmation email never sent."

The syllabus already has every ingredient and never assembles them: `LISTEN`/`NOTIFY`
(Phase 12), `SKIP LOCKED` (Phase 11), transactions (Phase 11), idempotent writes (Phase 9).
The outbox is the pattern that connects them: insert the event into an `outbox` table in
the *same transaction* as the business write, then a poller drains it with `SKIP LOCKED`
and at-least-once delivery, with `NOTIFY` as the latency shortcut rather than the
transport.

Also the honest place to teach why `LISTEN`/`NOTIFY` alone is *not* a queue — the Phase 12
row correctly calls it "at-most-once" but never says what to do instead.

**Directly relevant to your other project**: the `my-learning/` store records eKommerce
moving to microservices. This is the pattern that decision requires.

### 3.2 Multi-tenancy as a decision <span>Understand</span>

**Where it belongs:** Phase 3, after `10-schemas-search-path.md`. Est. ~250 lines.

Currently split across three rows that never meet: *"Schemas as namespaces, `search_path`,
and multi-tenant layouts"* (Phase 3), *"Row-level security"* (Phase 13), and
*"multi-tenant isolation"* mentioned inside the RLS row. A reader is never shown the
actual decision — **shared table + `tenant_id`** vs **schema-per-tenant** vs
**database-per-tenant** — with the costs: migration fan-out, connection count, noisy
neighbour, per-tenant backup/restore, and which one you can still change later.

The tell that this is missing: the reader who chooses schema-per-tenant learns at 400
tenants that every migration is now 400 migrations, and nothing in the syllabus warned them.

### 3.3 Audit and history tables <span>Understand</span>

**Where it belongs:** Phase 12, after `08-triggers.md`. Est. ~230 lines.

The triggers row uses `updated_at` as "the honest use case" — correct, and then stops. The
other honest use case is the audit trail: a generic `AFTER INSERT OR UPDATE OR DELETE`
trigger writing `to_jsonb(NEW)`/`to_jsonb(OLD)` into a history table, `current_setting()`
to carry the acting user from the app, and the retention/partitioning question that follows.
"Who changed this record and when" is a requirement on most business software and a
compliance requirement on some.

### 3.4 Modelling money <span>Master</span>

**Where it belongs:** Phase 2, folded into `02-numeric-vs-float.md` (which currently sits
at 210 lines and has room) or split out. Est. +120 lines.

`02-numeric-vs-float.md` correctly says money never goes in a float. It does not answer
the question that immediately follows: **`numeric(12,2)` or `bigint` minor units?** That
is a real decision with real consequences — rounding on division for tax and discounts,
what `pg` returns to JavaScript for each (`numeric` arrives as a **string**, which is the
whole reason this matters in a Node context), currency codes as a separate column, and why
you never sum a column that mixes currencies. The `bigint`-as-string material already
exists in Phase 7; this is where the reader first needs it.

---

## 4 · Two smaller syllabus notes

- **`docs/README.md:40`** says PostgreSQL has *"270 pages … 13 topics outstanding in phase
  13"*. Actual: **269 files, 228 topics, 12 stamps** (Phase 13 rows 07–18). Off by one in
  both numbers.
- **`docs/postgresql/README.md:43`** warns that Node Phase 6/7 pages were measured on
  PostgreSQL 17.10 and to re-check version-sensitive cross-links. That warning is live and
  correct — and [03-accuracy-findings.md](03-accuracy-findings.md) finding 1 is exactly a
  version-sensitive claim that went stale, though in the other direction (a PG17 feature
  the page believes does not exist in 18).

---

← [Index](README.md) · Next → [02 · The cap and depth](02-the-cap-and-depth.md)
