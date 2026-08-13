# 05 · Real-world scenarios for PostgreSQL

Answers ask **3g** — beyond the language concepts, what real project scenarios should this
technology carry, in the shape of your example:

> *"Using Node.js and raw `pg` we can write a whole session CRUD operation, filter,
> searching various text."*

That example is well chosen because it is not one topic — it is a **spine** that pulls
`citext`, partial unique indexes, `ON CONFLICT`, transactions, keyset pagination, FTS and
`SKIP LOCKED` into one thing a reader actually builds. Below are twelve such spines,
ordered by how early a real product hits them.

**How to use this file:** these are not proposed pages. The syllabus already teaches every
concept; what it lacks is the assembly. My recommendation is **one scenario per phase
group, as a capstone page at the end of the phase** — a "build this" that uses only
concepts already taught. Nine of the twelve need no new syllabus rows at all.

---

## The twelve

### 1 · Session and auth store — *your example, expanded*
**Phases 2, 3, 4, 9, 11** · needs no new rows

`users` with `citext` email (case-insensitive uniqueness without `lower()` everywhere),
`sessions` with a hashed refresh token, rotation on use, and revoke-all-on-password-change.

Exercises: `citext` vs an expression index on `lower(email)` · a **partial unique index**
`WHERE revoked_at IS NULL` so a user can hold one active session per device but unlimited
expired ones · `INSERT … ON CONFLICT` for the rotation · `DELETE … USING` for the expiry
sweep · `timestamptz` throughout · `23505` → HTTP 409 mapping.

The lesson the schema teaches: refresh-token rotation is a **read-modify-write**, so it is
the lost-update bug (Phase 11) wearing an auth costume. `UPDATE … WHERE token_hash = $1
AND revoked_at IS NULL RETURNING …` with `rowCount = 0` meaning "already used — this is a
replay" is the whole security property, in one statement.

### 2 · Product catalogue: filter, sort, search, paginate
**Phases 4, 5, 6, 9, 10, 12** · needs no new rows

The endpoint every product has, and the one the syllabus is best equipped for.

Exercises: safe dynamic `WHERE` with a parameter array · sort/filter **allowlists**
(identifiers cannot be parameterised) · keyset pagination via tuple comparison with a
matching composite index · `count(*)` vs `limit + 1` for "has more" · `tsvector` + GIN for
text search · `pg_trgm` for typo tolerance · `jsonb` for variable per-category attributes,
with the column-vs-JSON decision made explicitly.

This is the scenario that proves the 90% claim on its own — it touches six phases and is
almost entirely SQL.

### 3 · Checkout: inventory, pricing, idempotency
**Phases 9, 11** · needs no new rows

Reserve stock, apply a discount, create an order, all atomically, when two customers want
the last unit.

Exercises: `CHECK (quantity >= 0)` as the last line of defence · `SELECT … FOR UPDATE` in a
**fixed key order** to prevent deadlocks · the lost-update demo made concrete ·
`40001`/`40P01` retry · idempotency keys so a double-submitted checkout charges once ·
`numeric` money and why the total is computed in SQL, not JS floats.

The measured SERIALIZABLE-vs-`FOR UPDATE` comparison in
`phase-11-mvcc/06-isolation-levels.md` (12.4 s vs 71 ms) is *this* decision, and the page
would land harder if the reader had already written the checkout.

### 4 · Background job queue in PostgreSQL
**Phases 11, 12** · needs no new rows

Before reaching for Redis or SQS — most applications never need to.

Exercises: `SELECT … FOR UPDATE SKIP LOCKED LIMIT $1` as the claim · a visibility timeout
via `locked_until` · retry counts and a dead-letter state · `LISTEN`/`NOTIFY` to cut poll
latency, with the honest caveat that it is at-most-once and therefore an *optimisation*,
never the transport · partial index on `WHERE state = 'pending'`.

The trade-off to state plainly: this is correct and free up to a few thousand jobs/minute,
and the point where it stops being the right answer is when the queue table's vacuum load
starts hurting the rest of the database.

### 5 · Transactional outbox — **needs a new syllabus row**
**Phases 9, 11, 12** · see [01-syllabus-review.md](01-syllabus-review.md) §3.1

The moment the app has both a database and anything external — an email, a payment, a
second service — "write the row and publish the event" is two systems and cannot be atomic.

Exercises: outbox insert in the **same transaction** as the business write · a relay
draining with `SKIP LOCKED` · at-least-once delivery and therefore consumer idempotency ·
`NOTIFY` for latency · why a two-phase commit is not the answer here.

This is the single most valuable addition available to the corpus, and it is one page
assembling four things already taught.

### 6 · Multi-tenant SaaS — **needs a new syllabus row**
**Phases 3, 13** · see [01-syllabus-review.md](01-syllabus-review.md) §3.2

Exercises: `tenant_id` on every table and in **every index as the leading column** · RLS
policies with `current_setting('app.tenant_id')` · `SET LOCAL` to scope it to the
transaction (and why `SET` without `LOCAL` leaks across a pooled connection — a genuine
security bug that only appears under pooling) · the shared-table vs schema-per-tenant vs
database-per-tenant decision and its migration cost.

The pooling interaction is the part no tutorial covers and this corpus is uniquely placed
to teach, because it already owns both `pool.connect()` semantics and RLS.

### 7 · Audit trail / change history — **needs a new syllabus row**
**Phase 12** · see [01-syllabus-review.md](01-syllabus-review.md) §3.3

Exercises: one generic `AFTER INSERT OR UPDATE OR DELETE` trigger writing
`to_jsonb(OLD)`/`to_jsonb(NEW)` · carrying the acting user from Node via
`SET LOCAL app.user_id` · the retention question, and range partitioning by month once the
audit table outgrows the tables it audits.

### 8 · Analytics dashboard
**Phases 6, 12** · needs no new rows

Exercises: `date_trunc` + `generate_series` **left-joined to fill gaps** (a dashboard that
silently omits zero-signup days is a bug, and this is the standard fix) · window functions
for running totals and period-over-period via `lag` · `FILTER (WHERE …)` for
conditional aggregation · materialized views with `REFRESH … CONCURRENTLY` when the
honest answer is "this query is too slow to run live".

Gap: `generate_series` is currently taught only as a way to build test data
(`04-crud` row 18). Its dashboard use — gap-filling — is the one readers actually need.

### 9 · Soft delete, GDPR erasure, and data retention
**Phases 3, 4, 9** · needs no new rows

Exercises: `deleted_at` and the **partial unique index** `WHERE deleted_at IS NULL` that
lets a deleted user's email be reused · partial indexes matching the predicate exactly ·
the difference between soft delete (recoverable) and erasure (anonymise in place, keep the
row for referential integrity) · `ON DELETE` action choice as a product decision.

The gotcha worth its own section: every query in the codebase now needs
`AND deleted_at IS NULL`, and the one that forgets is a data leak. The honest options are a
view, RLS, or discipline — name the cost of each.

### 10 · File and media metadata
**Phases 2, 3** · needs no new rows

Exercises: why the bytes go to object storage and the *metadata* goes in PostgreSQL ·
`bytea` and its actual limits · content hash with a unique constraint for deduplication ·
the orphan problem — the upload succeeded, the row insert failed — which is the outbox
pattern again, in reverse.

### 11 · Rate limiting and quota counters
**Phases 4, 11, 12** · needs no new rows

Exercises: `INSERT … ON CONFLICT DO UPDATE SET count = t.count + 1` as an atomic counter ·
**advisory locks** for a mutex that costs no row · why a fixed-window counter is racy under
concurrency and the upsert is not · and the honest trade-off — this is the right answer at
moderate scale and Redis is right above it, because counter updates create dead tuples at
a rate vacuum will notice.

### 12 · Reporting export without exhausting memory
**Phases 7, 8** · needs no new rows

Exercises: `pg-cursor` streaming vs buffering 2 million rows into `rows` · `COPY … TO
STDOUT` piped straight into an HTTP response via `pg-copy-streams` · the pool
consequence — a long export holds a connection, so it belongs on a dedicated pool or a
replica · `statement_timeout` interaction.

---

## Coverage check — how much of the syllabus do these exercise?

| Phase | Covered by scenarios |
|---|---|
| 0 Architecture | indirect (pooling in 6, 12) |
| 1 psql | verification tool for all |
| 2 Types | 1, 2, 3, 10 |
| 3 DDL | 1, 6, 9, 10 |
| 4 CRUD | 1, 2, 3, 9, 11 |
| 5 Joins | 2, 8 |
| 6 Aggregation | 2, 8 |
| 7 pg driver | 1, 12 |
| 8 Schema from Node | 6, 12 |
| 9 API CRUD | 1, 2, 3, 5, 9 |
| 10 Indexes | 2, 6, 9 |
| 11 MVCC | 1, 3, 4, 5, 11 |
| 12 Beyond tables | 2, 4, 5, 7, 8, 11 |
| 13 Ops | 6 |

**Twelve scenarios reach thirteen of fourteen phases.** Only Phase 0 is not directly
exercised, which is expected — it is background, and its job is to make the pooling
decisions in scenarios 6 and 12 make sense.

That coverage is the strongest available evidence for your ask 2: a syllabus whose
concepts assemble this cleanly into real product features is a syllabus aligned with
building fullstack applications.

---

## Recommendation

Do **not** write twelve capstone pages now — that is a large scope increase and the corpus
has a shorter, higher-payoff fix list in [06-work-order.md](06-work-order.md).

Instead:

1. **Add the three missing syllabus rows** (outbox, multi-tenancy, audit) — scenarios 5, 6
   and 7 are the argument for them.
2. **Add a `## Where you will use this` block, 4–6 lines, to existing Master pages**,
   naming the scenario. `SKIP LOCKED` → "this is the job queue"; tuple comparison → "this
   is the catalogue's next page"; partial unique index → "this is how soft delete lets an
   email be reused". Cheap, and it converts a reference into something with a through-line.
3. **Consider one capstone later** — scenario 2 (catalogue: filter, sort, search,
   paginate) is the best single candidate, because it spans six phases and is the endpoint
   every reader will actually write.

---

← [04 · Ratings](04-ratings.md) · Next → [06 · Work order](06-work-order.md)
