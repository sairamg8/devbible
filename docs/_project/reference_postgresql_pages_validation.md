---
name: devbible-postgresql-pages-validation
description: PostgreSQL explanation pages are a template stamped 216 of 228 times — the full mechanical audit, the 12 real pages, and the standing preference to validate-and-improve PostgreSQL over all other work
metadata:
  type: project
---

# PostgreSQL pages — validated 2026-08-11, and the standing priority

## The standing preference (set 2026-08-11)

**PostgreSQL is the critical priority. Validate and improve the existing pages** —
not review-then-decide, not write new sections, not other technologies. The user
stated the reason: raw SQL / `pg` first, ORMs later, so the Node+`pg` half has to
actually teach. Named as must-land-well: **schema creation with raw `pg` from Node,
soft delete, filtering logic, sorting.**

Explicit instruction on method: **do not review page-by-page then fix** — that was
called out as taking too long. Audit mechanically across the whole corpus, then act.

The user also confirmed the learning path is right: raw SQL first, ORMs later, with
the trade-off named (more boilerplate, manual snake→camel mapping, no generated
migrations; but ORM bugs are all diagnosed by reading SQL + `EXPLAIN`). Add a
migration tool (node-pg-migrate) later — that is not an ORM.

## What the validation found

Full audit of all 228 topic pages, written up at
`docs/postgresql/reviews/verification-claude-pages.md` (parked record, build excludes it).

**The syllabus is sound. The pages are one template stamped 216 times.**

| Signal | Count |
|---|---|
| Pages carrying the marker `Hold the model in your head before memorizing syntax.` | **216 / 228** (94.7 %) |
| Pages whose `## How it works` is a verbatim repeat of the bold one-liner above it | 216 |
| Pages whose first interview answer is that same sentence again | 216 |
| **Genuinely hand-written pages** | **12** |
| Distinct code examples across ~200 code-bearing pages | **~5** |
| Distinct gotchas corpus-wide | ~32, nearly all in Phase 0 |
| Pages asserting `> Verified: 2026-08 on PostgreSQL 18.4` | **210** |
| Average page length | **77 lines** (Node.js corpus: 198–267) |

### The 12 real pages

`phase-0-architecture/` 01–10 and 12, plus `phase-10-indexes/18-fk-indexes.md`.
Everything else is a stamp — **including `phase-0-architecture/11-vs-other-databases.md`**,
which sits inside the otherwise-good Phase 0. `05-wal.md` is the model page: real
transcripts, real stdout, an explicit `## Trade-off`, topic-specific questions.

### The five templates, by their `## Why it matters` line

| Variant | Marker text | Pages |
|---|---|---|
| psql/ops | ``​`psql` is how you prove every later claim. <TOPIC> is daily operator skill.`` | 83 |
| SQL | `Correct SQL is the product surface of your API. <TOPIC> shows up in list/detail/write paths constantly.` | 49 |
| Node | `This is the Node-facing half of PostgreSQL: how <TOPIC> shows up in a real process using pg.` | 48 |
| DDL | `DDL is the contract every client (Node, reports, future services) must obey.` | 19 |
| Types | `Type choices are expensive to reverse. Getting <TOPIC> wrong creates classes of bugs (money, time zones, ids)…` | 16 |

Substitution artefacts are visible: *"`psql` is how you prove every later claim.
**XID wraparound** is daily operator skill."*

### The shared code blocks

- `SELECT u.email, count(o.*) … GROUP BY u.email` on **49** pages — same aggregate on
  the ORDER BY, DELETE, CROSS JOIN and TRUNCATE pages. Prefixed
  `-- Example shape on sandbox tables`, which admits it is not the topic's example.
- `insert into measure_users (email) values ($1) returning id, email` in a
  BEGIN/COMMIT on **48** pages — the entire `## From Node` for every Phase 7–9 page.
  The *creating tables from Node* page demonstrates an INSERT.
- `psql … -c "select 1"` on **48** pages as the whole `## Verify in psql first`.

### Shared gotchas

*"It works in a tutorial and fails in your app"* and *"'It is slow' with no evidence"*
appear on **168** pages each; three pool/SQLSTATE ones on **48** each.

### The four critical topics — all stamps

- **Schema from Node** (`phase-8/01-ddl-from-node.md`) — shows an INSERT, no `CREATE TABLE`.
  `create table` in a Node block appears on **1** page corpus-wide.
- **Soft delete** (`phase-9/09`) — **`deleted_at` appears on 1 page in 228.** No partial
  index, no query exclusion, no unique-constraint interaction.
- **Filtering** (`phase-9/02, 03, 04`) — all three have **byte-identical bodies**. The
  Master page on building predicates contains no predicate-building code. `ILIKE`: 2 pages.
- **Sorting** (`phase-4/10-order-by`) — promises `NULLS FIRST/LAST` in its one-liner;
  those keywords appear on **2** pages corpus-wide, not including that one.

## The serious one — false `> Verified:` lines

210 pages assert `> Verified: 2026-08 on PostgreSQL 18.4 / Node 24 / pg`. On the 12 real
pages that is credible (measured output like `{ id: '1', note: 'hello wal' }`). On the
other 210 it is attached to code that cannot have produced the topic's result — 48 assert
it directly beneath a `select 1`.

**Strip every `> Verified:` outside the 12 real pages before anything else**, including
before a partial rewrite, or the false stamps stand on whatever has not been reached yet.

## Also broken

- `docs/postgresql/pages/phase-3-ddl/01-create-table.md` — a code fence was injected into
  the bold one-liner slot and an interview answer, producing malformed markdown
  (`**```sql` … `> Verified: 2026-08 on**`). Only file with this failure; it is DDL page 01.
- `src/data/progress.js` reports every PG phase as `topics: N, pages: N`, so the homepage
  says **PostgreSQL is fully written**. By `instructions.md` §4 it is 12 written, 216
  placeholders. Stop counting stamps as finished pages.

## What to keep

The syllabus (4 parts, 243 rows, real descriptions, 27 % Master — inside the §3 band),
the 15 phase indexes (real chunk indexes with tier, one-liner and a phase gate),
structure/wiring, and Phase 0's 11 pages. The rewrite has its map already.

## Progress — session of 2026-08-12

**Step 1 is DONE.** 198 files stripped of **281** false `> Verified:` lines (the 12
real pages keep theirs); `phase-3-ddl/01-create-table.md`'s injected code fence
fixed; `progress.js` corrected so PG no longer reports as finished.

**Found the cause:** `sandbox/pg-phase-0/gen-phases{,-b,-c}.mjs` are the generators
that stamped the 216 pages, `Verified` line included. **Do not run them again.**

**Five topics rewritten to the Node standard**, every claim measured in
`sandbox/pg-api/` (see that folder's entry in `sandbox/README.md`):

| Page | Headline measured finding |
|---|---|
| `phase-8/01-ddl-from-node/` (chunked, 2 files) | `CREATE TABLE IF NOT EXISTS` races — **228 of 500 fail** with `23505` on `pg_type_typname_nsp_index`; advisory lock → 500/500. A **12 ms `ALTER` blocked two plain `SELECT`s for 2.4 s** via the lock queue |
| `phase-9/02-list-endpoint` | Paging 100 rows without a tiebreaker → **54 distinct, 46 repeats** |
| `phase-9/03-safe-dynamic-where` | Empty params array takes the simple protocol; bare `%`/`_` in an `ILIKE` term matches everything |
| `phase-9/04-allowlists` | **`ORDER BY $1` silently sorts by a constant** — no error, identical output for different columns. Concatenated identifier **dropped the table** (`2 statements executed`) |
| `phase-9/09-delete-soft-hard` | Partial unique index frees a soft-deleted email; a partial index is **unusable** if the query omits its predicate |
| `phase-4/10-order-by` | **musl vs glibc sort differently under an identical declared `en_US.utf8`** — Alpine sorts by byte value. Needs both containers |

### Phase 8 — COMPLETE, 14/14, 2026-08-12

All 14 topics written and measured; zero stamps left in the phase. `01-ddl-from-node`
is a 3-chunk directory. Measured findings now on pages, scripts `ex1`–`ex10`:

- **Bulk load, 10k rows:** per-row autocommit **20165 ms** → per-row in one tx
  **2559 ms** → multi-row VALUES **148 ms** → `unnest` **84 ms** → COPY **244 ms**.
  240× spread.
- **`unnest` beat `pg-copy-streams` 2.7–3× at 10k/100k/500k** — contradicts "COPY is
  the fast path". COPY's real wins from Node are bounded memory (unnest = 201 MB
  heap at 500k) and no size ceiling. Framed carefully: this compares two *Node client
  paths*, not server-side COPY from a file.
- **Parameter ceiling is exactly 65535** (21845 rows × 3 ok, 21846 fails) and the
  error is the useless `08P01 bind message has 2 parameter formats but 0 parameters`.
- **`ON CONFLICT DO NOTHING` still burns identity values** — sequence at 6 after 3
  runs inserting 2 rows.
- **Test reset:** BEGIN/ROLLBACK **0.8 ms** (rows survive) · TRUNCATE **4.4 ms** ·
  DELETE **12.7 ms**. Plain `TRUNCATE` does **not** reset identity (next id 10001).
- **Migration runner:** idempotent 2nd run; a failing file leaves the table untouched
  **and** unrecorded; checksum catches an edited migration; 5 concurrent runners → 1
  applied. **Unpadded filenames sort `1, 10, 11, 2`** — migration 10 before 2.
- **Drift check** catches type change (`character varying, expected text`) and drop.
- Tool versions verified on npm 2026-08-12: node-pg-migrate 9.0.0, graphile-migrate
  1.4.1, prisma 7.9.1, drizzle-kit 0.31.10, kysely 0.29.5.

### Phase 3 — DDL — COMPLETE, 19/19, 2026-08-12

Written and measured (scripts `ex11-ddl-alter.mjs`, `ex12-ddl-rest.mjs`):
02 primary-keys · 03 foreign-keys · 05 alter-table · 08 unique-nulls ·
09 add-not-null · 13 drop-cascade · 14 sequences · 15 generated-columns ·
18 deferrable · 19 inheritance.

All 19 written, zero stamps. Extra measurements in `ex13-constraints-rel.mjs`:

- **`CHECK` passes on NULL** — `CHECK (age >= 18)` accepted a NULL age. Unknown is
  not false, so every CHECK needs a `NOT NULL` beside it.
- **`now()` is transaction-start time** — two inserts 150 ms apart in one
  transaction got identical timestamps. `clock_timestamp()` for per-row wall clock.
- **Explicit `NULL` bypasses a DEFAULT**; only an omitted column or `DEFAULT` uses it.
- **A composite PK indexes the leading column only** — on a 20k-row join table,
  `WHERE post_id` = Index Only Scan, `WHERE tag_id` = **Seq Scan**. Join tables need
  a second index.
- 1-1 enforced by PK-on-FK (`23505`); duplicate join-table pair `23505`.
- TEMP invisible to another pooled connection (`42P01`, schema `pg_temp_64`);
  LOGGED 150 ms vs UNLOGGED 98 ms (~1.5×).
- Verified directly in psql: unquoted ref to `"UserAccounts"` →
  `relation "useraccounts" does not exist`; `max_identifier_length` **63**;
  `SELECT * FROM user` returns the **username**, not a table.

Headline measured findings now on pages:

- **ALTER TABLE rewrite table @200k rows.** Catalog-only 3–4 ms; rewrites 430–902 ms.
  Rewrites: `ADD COLUMN … DEFAULT gen_random_uuid()` (**volatile** default — 902 ms;
  a *constant* default is 4 ms, and `now()` did **not** rewrite), `varchar(50)→(20)`,
  `int→bigint`, `SET UNLOGGED`. No rewrite: plain ADD/DROP/RENAME COLUMN,
  `varchar` widening, `varchar→text`, `numeric(12,2)→(14,2)`, `SET NOT NULL`.
- **`DROP COLUMN` does not reclaim space** — catalog op, 3 ms.
- **All 5 `ON DELETE` actions**, with two different SQLSTATEs: `NO ACTION` → `23503`,
  `RESTRICT` → **`23001`**. The real difference between them: deferred `NO ACTION`
  passes, `RESTRICT` cannot defer.
- **Unindexed FK child**: parent delete 33.6 ms vs 8.7 ms indexed (4×, 300k children).
- **`DROP TABLE … CASCADE` does NOT delete child data** — it dropped the *view* and
  the child's *FK constraint*, leaving the child table unconstrained.
- **Identity vs serial**: `GENERATED ALWAYS` rejects a manual id (`428C9`); serial
  accepts one — the cause of later `23505`. Sequence dropped with table in both.
- **Sequence gaps**: ids 1 and 4 after 4 attempts (rollback + failed insert).
- **3 NULLs allowed in a unique column**; `NULLS NOT DISTINCT` → `23505`.
- **NOT NULL safely**: direct `SET NOT NULL` 36 ms under ACCESS EXCLUSIVE; the
  `NOT VALID` + `VALIDATE` split is 3 ms + 25 ms, the 25 ms under SHARE UPDATE
  EXCLUSIVE (reads+writes continue). **The win is the lock mode, not the time.**
- **Generated columns**: write → `428C9`; volatile expression → `42P17`. STORED only.
- **Inheritance does not inherit the PK** — two rows with id 1 accepted. Partitioning
  enforces it (`23505`) and rejects unmatched rows (`23514`).

Remaining: **143 stamped pages** (2026-08-12, after Phases 4 and 7 landed). Next —
Phase 10 indexes. Live per-phase counts and the regeneration command live in
[[devbible-postgresql-rewrite-handoff]], which supersedes the numbers in this file.

### Route trap, both directions (cost 2 builds)

Inside a chunked topic directory the two link forms differ:
- link to the **directory** (its index) → route form, prefix dropped: `./ddl-from-node/`
- link to a **file** inside it → real on-disk path, prefix kept:
  `./01-ddl-from-node/02-locks-and-blocking.md`

## Recommended order

1. ~~Strip the 210 false `Verified` lines; fix `01-create-table.md`; correct `progress.js`.~~ **Done 2026-08-12.**
2. Keep syllabus + phase indexes as-is.
3. Rewrite pages to the **Node.js corpus standard** (~200 lines, topic-specific code that
   was actually run, real symptom→cause→fix, topic-specific interview questions),
   sequenced by stated priority: **Phase 8 schema-from-Node → Phase 9 CRUD/filter/sort/
   soft-delete → Phase 3 DDL → Phase 4 CRUD** — not by phase number.

Related: [[devbible-postgresql-syllabus]] · [[devbible-progress]] ·
[[devbible-express-verification]] · [[devbible-review-system]] · [[devbible-brief]]
