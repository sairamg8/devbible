# PostgreSQL — syllabus, scenarios and work order · Fable · 2026-08-13

The recommendations half of the review. Findings and ratings are in
[postgresql-review.md](postgresql-review.md).

---

## 1 · Syllabus

**Verified:** 14 phases ✅ · Master **26.3%** (60/228) ✅ inside the 25–30% band ·
Understand 124 ✅ · Know 35 ✅ · When Needed 9 ✅ · Phase 10 before 11 ✅ · tier badge on
228/228 ✅. The tier distribution is honest and is what keeps the fullstack focus intact —
it is the part of the syllabus I would change least.

**Fullstack fit: ~93% — passes.** Going row by row, only **6 of 229** are genuine DBA
territory (`pg_upgrade`, PITR, logical replication, XID wraparound, FDW/`dblink`) — and
every one is already `Know` or `When Needed`. The tiering is doing its job; no change
needed. The gap is what's *missing*, not what's present.

**Off by one, and it's a granularity error.** Phase 2's syllabus lists 17 rows; the folder
has 16 pages. Rows 9 (*boolean and three-valued logic*) and 10 (*date, time, interval*)
were merged into `09-boolean-dates.md`. That fails your own §5 test — nobody reads "why did
`sum(flag::int)` return NULL" and "why is 31 Jan + 1 month = 28 Feb" together. The cost is
visible in the file: `## boolean` is **36 lines** for a concept feeding Master-tier `NULL`
semantics, and the `time` type has **no section at all**. Split into `09-boolean.md` +
`10-date-time-interval.md` and renumber the tail; restores the 229 count.

**Re-tier two rows up:**

| Row | | Why |
|---|---|---|
| **Recursive CTEs** | `Know` → `Understand` | Comment threads, category trees and org charts are ordinary product features. It's the only way to query a self-referencing table to arbitrary depth without N+1 from Node |
| **Row-level security** | `Know` → `Understand` | With the context note the brief allows: *"`Know` for single-tenant, `Understand` the moment a second tenant exists."* In multi-tenant SaaS it's the difference between a missing `WHERE tenant_id = $1` being a bug and being a breach |

**Four missing rows**, each a pattern a real product hits in month one:

| Row | Phase | Est. | Why |
|---|---|---|---|
| **Transactional outbox** | 12, after `13-listen-notify.md` | ~280 | You cannot write to PG and publish to a queue atomically. Every ingredient is already taught — `LISTEN/NOTIFY`, `SKIP LOCKED`, transactions, idempotent writes — and never assembled. Also the honest place to say why `NOTIFY` alone is not a queue, which the Phase 12 row raises and drops. **Highest-value addition available**, and directly relevant to eKommerce moving to microservices |
| **Multi-tenancy as a decision** | 3, after `10-schemas-search-path.md` | ~250 | Currently split across three rows that never meet. The reader never sees shared-table vs schema-per-tenant vs database-per-tenant with its migration cost — or that `SET` without `LOCAL` leaks across a pooled connection, which is a security bug no tutorial covers |
| **Audit / history tables** | 12, after `08-triggers.md` | ~230 | The triggers row uses `updated_at` as "the honest use case" and stops. The other is `to_jsonb(OLD)`/`(NEW)` into a history table, with the acting user carried from Node via `SET LOCAL` |
| **Modelling money** | 2, into `02-numeric-vs-float.md` | +120 | The page says money never goes in a float, then doesn't answer what follows: `numeric(12,2)` or `bigint` minor units? Rounding on tax and discounts, currency as its own column, and what `pg` returns to JS for each — `numeric` arrives as a **string**, which is the whole reason it matters in Node |

---

## 2 · Real-world scenarios

Twelve project spines in the shape of your session-CRUD example, reaching **13 of 14
phases**. Nine need no new syllabus rows.

| Scenario | Phases | Exercises |
|---|---|---|
| **Session & auth store** | 2,3,4,9,11 | `citext`; partial unique index `WHERE revoked_at IS NULL`; rotation as a read-modify-write — `rowCount = 0` means replay, which *is* the security property |
| **Catalogue: filter, sort, search, paginate** | 4,5,6,9,10,12 | dynamic `WHERE` + allowlists; keyset pagination; `tsvector`+GIN; `pg_trgm`; `jsonb` attributes. Six phases — proves the 90% claim on its own |
| **Checkout: inventory, pricing, idempotency** | 9,11 | `FOR UPDATE` in fixed key order; lost update; `40001` retry; idempotency keys; `numeric` money |
| **Job queue in PostgreSQL** | 11,12 | `SKIP LOCKED`; visibility timeout; dead-letter; `NOTIFY` as latency optimisation, never transport |
| **Transactional outbox** ⁿᵉʷ | 9,11,12 | outbox insert in the same transaction; relay with `SKIP LOCKED`; at-least-once → consumer idempotency |
| **Multi-tenant SaaS** ⁿᵉʷ | 3,13 | `tenant_id` leading every index; RLS + `current_setting`; `SET LOCAL` vs the pooled-connection leak |
| **Audit trail** ⁿᵉʷ | 12 | generic trigger, `to_jsonb`, acting user from Node, partition by month |
| **Analytics dashboard** | 6,12 | `date_trunc` + `generate_series` **left-joined to fill gaps**; `lag`; `FILTER`; matviews |
| **Soft delete & GDPR erasure** | 3,4,9 | partial unique index so a deleted email is reusable; the forgotten `AND deleted_at IS NULL` as a data leak |
| **File/media metadata** | 2,3 | bytes to object storage, metadata to PG; content-hash dedup; the orphan problem (outbox in reverse) |
| **Rate limiting / quotas** | 4,11,12 | `ON CONFLICT DO UPDATE` as an atomic counter; advisory locks; where Redis takes over |
| **Streaming export** | 7,8 | `pg-cursor` vs buffering 2M rows; `COPY TO STDOUT`; a long export holds a connection |

Only Phase 0 is not directly exercised, which is expected — its job is to make the pooling
decisions in multi-tenancy and streaming export make sense. That coverage is the strongest
evidence for the 90% question: a syllabus whose concepts assemble this cleanly into real
product features is aligned with building fullstack applications.

Gap this exposes: `generate_series` is taught only for building test data — its dashboard
use, gap-filling so a chart doesn't silently omit zero-signup days, is what readers need.

**Don't write twelve capstone pages.** Add the three syllabus rows above, then a 4–6 line
`## Where you will use this` block on existing Master pages (`SKIP LOCKED` → "this is the
job queue"; tuple comparison → "this is the catalogue's next page"; partial unique index →
"this is how soft delete lets an email be reused"). Cheap, and it gives the reference a
through-line. One capstone later, if any: the catalogue.

---

## 3 · Work order

| # | Target | Action | Script? |
|---|---|---|---|
| **1** | `phase-4-crud/13-merge.md` | Correct the `RETURNING` error; add `NOT MATCHED BY SOURCE` | Yes — extend `ex14-crud.mjs` §8; transcripts already captured in the review |
| **2** | `phase-0/04-shared-buffers.md` | Remove the confounded benchmark :50–78 and the wrong cause at :76 | Yes — or delete outright |
| **3** | `phase-13-ops/07…18` | Strip fake Gotchas and Q&A from 12 stamps | No |
| **4** | `docs/README.md:40` | 269 files / 228 topics / **12** outstanding | No |
| **5** | `phase-10/03-explain.md` | Chunk → `03-explain/`: reading a plan · vs ANALYZE · estimate-vs-actual · from Node. 186 → ~620 | Yes |
| **6** | `phase-2-types/09-boolean-dates.md` | Split (§1); add the missing `time` type. 213 → ~400 | reuse `ex33`/`ex34` |
| **7** | `phase-0/02-client-server-model.md` | Reframe as a budget you spend; rewrite 3 "what is" Q&A; commit the missing `two-backends.mjs` | Yes |
| **8** | `phase-11/03-read-committed.md` | Chunk → statement snapshots · anomalies *shown failing* · the recheck rule. 170 → ~480 | Yes |
| **9** | all 270 pages | Re-star Q&A to one third | No |
| **10** | `phase-2/04-timestamptz.md` · `phase-4/06-on-conflict.md` | Chunk both (~520, ~500) | extend `ex33`, `ex14` |
| **11** | syllabus | Re-tier recursive CTEs + RLS; add the 4 missing rows | Yes, for the pages |
| **12** | `phase-0/` | Rewrite pass — 1398 → ~2600 | Yes, several |

**If you only do five: 1, 2, 3, 5, 7.** The first three are correctness — one page states a
falsehood about the target version, one proves a claim with a measurement of something
else, twelve impersonate finished work. Rows 5 and 7 are the depth fix at its two
highest-value points: `EXPLAIN`, where every performance investigation starts, and Phase 0,
the first thing a reader of this corpus sees.

**Not recommended:** rewriting the capped phases (they score 9.2–9.6 — chunk the named
topics and leave the rest alone), twelve capstone pages, further tier changes, or any
change to the example policy, palette or page template. They work.

When chunking, link the **`.md` file** and keep numeric prefixes —
`../03-explain/README.md`, never `../explain/` — and fix inbound links in the phase README
and neighbouring footers with `shared/scripts/fixlinks.py`, not `sed`. Then verify with a
clean rebuild, since a green build proves nothing on its own:

```bash
rm -rf .docusaurus build node_modules/.cache && yarn build 2>&1 | grep -iE 'warning|broken'
# grep exit 1 = clean
```
