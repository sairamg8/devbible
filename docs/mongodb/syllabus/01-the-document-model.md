---
title: "Part 1 — The document model"
sidebar_label: "01 · The document model"
sidebar_position: 1
---

> Verified: 2026-08-14 against the **MongoDB 8.0** manual. Tiers are assigned for
> fullstack application development.

**Phases 0–3 · 22 topics.** What a document actually is, how the server stores and
returns it, and how to design collections around the queries you will run.

The part exists to prevent the single most expensive MongoDB mistake: arriving
with relational instincts, normalising into six collections, and then discovering
that every screen needs four round trips and there are no joins to lean on.

---

## Phase 0 — How MongoDB runs

*5 topics.* The architecture, and the sentence the rest of the syllabus is
downstream of: **the unit of atomicity is the single document.**

| Topic | Tier |
|---|---|
| **What MongoDB actually is** — a document store that trades joins for locality. Why "schemaless" is wrong and actively harmful as a mental model: there is always a schema, it just lives in your application instead of the server | <span className="db-tier t-master">Master</span> |
| **The single-document atomicity guarantee** — the one thing you get for free, why it is the reason embedding is the default, and why every design question reduces to "can this be one document?" | <span className="db-tier t-master">Master</span> |
| **BSON** — the binary format used on the wire and on disk; what it adds over JSON (types, ordering, length prefixes) and what it costs | <span className="db-tier t-master">Master</span> |
| **Document, collection, database** — the three levels, what each does and does not enforce | <span className="db-tier t-master">Master</span> |
| 🔴 **MongoDB vs PostgreSQL — the actual trade** — locality vs joins, document atomicity vs ACID transactions, flexible fields vs constraints. Cross-linked to the finished PostgreSQL phases rather than re-argued | <span className="db-tier t-master">Master</span> |

*Cut from this phase: 9 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate — move on when:** you can explain, without notes, why a MongoDB write to
one document is atomic but a write to two documents is not, and what that implies
for how you would model an order with line items.

---

## Phase 1 — Documents, BSON types and `_id`

*6 topics.* The type system. Most "why didn't my query match?" bugs are type
bugs, and they are invisible until you look for them.

| Topic | Tier |
|---|---|
| **The BSON types, completely** — the full list, what each is for, and the ones that surprise people | <span className="db-tier t-master">Master</span> |
| **`_id`** — the one mandatory field, the one index you never create, and the one you cannot change | <span className="db-tier t-master">Master</span> |
| **`ObjectId`** — its structure, the embedded timestamp, and 🔴 what it does **not** guarantee (it is not a sequence, and not safe to sort by for strict ordering across writers) | <span className="db-tier t-master">Master</span> |
| 🔴 **Numbers: `int32`, `int64`, `double`, `Decimal128`** — why JavaScript hands you doubles by default, what that does to money, and when `Decimal128` is mandatory | <span className="db-tier t-master">Master</span> |
| **Dates vs Timestamps** — two different BSON types, only one of which you want; time zones and storage | <span className="db-tier t-master">Master</span> |
| **Arrays as a first-class type** — why an array field is not a join table, and what indexing one implies | <span className="db-tier t-master">Master</span> |

*Cut from this phase: 7 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate — move on when:** you can predict which documents `{price: {$gt: 100}}`
matches in a collection where some prices are strings, some are `Decimal128`, some
are missing and some are `null` — and say what you would do about it.

---

## Phase 2 — `mongosh`, mastered

*5 topics.* The shell is the debugging tool. Being fluent in it is the
difference between diagnosing a slow query in two minutes and guessing at it.

| Topic | Tier |
|---|---|
| **Connecting** — connection string anatomy, `mongodb+srv`, options, and connecting to Atlas | <span className="db-tier t-master">Master</span> |
| **Navigating** — `show dbs`, `use`, `db`, `show collections`, and why a database that does not exist still lets you type `use` | <span className="db-tier t-master">Master</span> |
| **Cursors** — what `find()` returns, batching, `it`, and why a cursor is not a result set | <span className="db-tier t-master">Master</span> |
| 🔴 **`explain()` from the shell** — the three verbosity levels and how to read the winning plan. The single most useful skill in this syllabus | <span className="db-tier t-master">Master</span> |
| ⚠️ **Shell safety on production** — the commands that do not ask twice, and read-only connection habits | <span className="db-tier t-master">Master</span> |

*Cut from this phase: 7 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate — move on when:** you can take a slow query someone reports, run it under
`explain("executionStats")`, and say whether the problem is the index, the
selectivity or the document count — without guessing.

---

## Phase 3 — Schema design and modelling

*6 topics.* The phase that decides whether the application is pleasant or awful
to work on, and the one where relational experience actively misleads.

| Topic | Tier |
|---|---|
| 🔴 **Schema design is a query exercise** — you design for the reads you will perform, not for a normal form. The complete reversal from PostgreSQL, and why | <span className="db-tier t-master">Master</span> |
| 🔴 **Embed vs reference — the decision procedure** — the actual questions in order: is it bounded, is it queried alone, does it change independently, does it exceed 16 MB | <span className="db-tier t-master">Master</span> |
| **One-to-few** — embed. The default, and why | <span className="db-tier t-master">Master</span> |
| **One-to-many** — reference, or embed the ids; the read cost of each | <span className="db-tier t-master">Master</span> |
| **One-to-squillions** — reference from the *many* side; the unbounded-array trap this avoids | <span className="db-tier t-master">Master</span> |
| **The extended reference pattern** — duplicating the two fields you always display, and accepting the update cost knowingly | <span className="db-tier t-master">Master</span> |

*Cut from this phase: 10 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate — move on when:** given a product catalogue with variants, reviews and
inventory, you can produce a schema, justify every embed and every reference
against the queries the application will run, and name the write cost of each
denormalisation you chose.

---

Next → **[Part 2 — Querying](02-querying.md)**
