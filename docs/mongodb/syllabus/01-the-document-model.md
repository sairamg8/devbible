---
title: "Part 1 — The document model"
sidebar_label: "01 · The document model"
sidebar_position: 1
---

> Verified: 2026-08-14 against the **MongoDB 8.0** manual. Tiers are assigned for
> fullstack application development.

**Phases 0–3 · 55 topics.** What a document actually is, how the server stores and
returns it, and how to design collections around the queries you will run.

The part exists to prevent the single most expensive MongoDB mistake: arriving
with relational instincts, normalising into six collections, and then discovering
that every screen needs four round trips and there are no joins to lean on.

---

## Phase 0 — How MongoDB runs

*14 topics.* The architecture, and the sentence the rest of the syllabus is
downstream of: **the unit of atomicity is the single document.**

| Topic | Tier |
|---|---|
| **What MongoDB actually is** — a document store that trades joins for locality. Why "schemaless" is wrong and actively harmful as a mental model: there is always a schema, it just lives in your application instead of the server | <span className="db-tier t-master">Master</span> |
| **The single-document atomicity guarantee** — the one thing you get for free, why it is the reason embedding is the default, and why every design question reduces to "can this be one document?" | <span className="db-tier t-master">Master</span> |
| **BSON** — the binary format used on the wire and on disk; what it adds over JSON (types, ordering, length prefixes) and what it costs | <span className="db-tier t-master">Master</span> |
| **Document, collection, database** — the three levels, what each does and does not enforce | <span className="db-tier t-master">Master</span> |
| **How a query reaches the server** — driver → wire protocol → `mongod` → storage engine, and where latency actually accumulates | <span className="db-tier t-understand">Understand</span> |
| **WiredTiger** — the storage engine: document-level concurrency, compression, the cache, and checkpoints | <span className="db-tier t-understand">Understand</span> |
| **Journaling and durability** — what "the write returned" means before you have chosen a write concern | <span className="db-tier t-understand">Understand</span> |
| **`mongod`, `mongos`, `mongosh`** — the three binaries and which one you are actually talking to | <span className="db-tier t-understand">Understand</span> |
| **Namespaces and on-disk layout** — how `db.collection` maps to files, and why dropping a collection is not the same as deleting documents | <span className="db-tier t-know">Know</span> |
| **Versions, cadence and lifecycle** — 8.0 as the Major Release (two-year cadence, five-year lifecycle), 8.2 as the current minor, 8.3 on Atlas auto-upgrade; FCV and why it blocks downgrades | <span className="db-tier t-understand">Understand</span> |
| 🔴 **MongoDB vs PostgreSQL — the actual trade** — locality vs joins, document atomicity vs ACID transactions, flexible fields vs constraints. Cross-linked to the finished PostgreSQL phases rather than re-argued | <span className="db-tier t-master">Master</span> |
| **Atlas vs self-hosted** — what Atlas takes over, what it charges for, and which decisions it removes from you | <span className="db-tier t-know">Know</span> |
| **Running MongoDB locally** — a container, a replica set of one, and why even local development wants a replica set | <span className="db-tier t-understand">Understand</span> |
| **The ecosystem** — Compass, Atlas Search, Charts, the database tools; what each is for and which are optional | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain, without notes, why a MongoDB write to
one document is atomic but a write to two documents is not, and what that implies
for how you would model an order with line items.

---

## Phase 1 — Documents, BSON types and `_id`

*13 topics.* The type system. Most "why didn't my query match?" bugs are type
bugs, and they are invisible until you look for them.

| Topic | Tier |
|---|---|
| **The BSON types, completely** — the full list, what each is for, and the ones that surprise people | <span className="db-tier t-master">Master</span> |
| **`_id`** — the one mandatory field, the one index you never create, and the one you cannot change | <span className="db-tier t-master">Master</span> |
| **`ObjectId`** — its structure, the embedded timestamp, and 🔴 what it does **not** guarantee (it is not a sequence, and not safe to sort by for strict ordering across writers) | <span className="db-tier t-master">Master</span> |
| **Custom `_id` values** — when a natural key is right, and the write-pattern consequences | <span className="db-tier t-understand">Understand</span> |
| 🔴 **Numbers: `int32`, `int64`, `double`, `Decimal128`** — why JavaScript hands you doubles by default, what that does to money, and when `Decimal128` is mandatory | <span className="db-tier t-master">Master</span> |
| **Dates vs Timestamps** — two different BSON types, only one of which you want; time zones and storage | <span className="db-tier t-master">Master</span> |
| **Strings and collation** — case-insensitive matching done properly rather than with a regex | <span className="db-tier t-understand">Understand</span> |
| **Arrays as a first-class type** — why an array field is not a join table, and what indexing one implies | <span className="db-tier t-master">Master</span> |
| **Embedded documents** — dot notation, nesting depth, and reading a nested field that may not exist | <span className="db-tier t-master">Master</span> |
| 🔴 **`null`, missing, and the difference** — the three states a field can be in, and why `{field: null}` matches documents that do not have the field at all | <span className="db-tier t-master">Master</span> |
| **The 16 MB document limit** — where it bites, and why hitting it is a modelling signal rather than a limit to work around | <span className="db-tier t-understand">Understand</span> |
| **Field name rules** — dots, dollars, duplicates and case sensitivity | <span className="db-tier t-know">Know</span> |
| **GridFS** — storing files that exceed the document limit, and why the answer is usually object storage instead | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can predict which documents `{price: {$gt: 100}}`
matches in a collection where some prices are strings, some are `Decimal128`, some
are missing and some are `null` — and say what you would do about it.

---

## Phase 2 — `mongosh`, mastered

*12 topics.* The shell is the debugging tool. Being fluent in it is the
difference between diagnosing a slow query in two minutes and guessing at it.

| Topic | Tier |
|---|---|
| **Connecting** — connection string anatomy, `mongodb+srv`, options, and connecting to Atlas | <span className="db-tier t-master">Master</span> |
| **The shell is JavaScript** — what that buys you, and the async/`await` behaviour that differs from the old `mongo` shell | <span className="db-tier t-understand">Understand</span> |
| **Navigating** — `show dbs`, `use`, `db`, `show collections`, and why a database that does not exist still lets you type `use` | <span className="db-tier t-master">Master</span> |
| **Cursors** — what `find()` returns, batching, `it`, and why a cursor is not a result set | <span className="db-tier t-master">Master</span> |
| **Reading output** — `pretty()`, `toArray()`, `count` vs `countDocuments`, and projections to keep output legible | <span className="db-tier t-understand">Understand</span> |
| 🔴 **`explain()` from the shell** — the three verbosity levels and how to read the winning plan. The single most useful skill in this syllabus | <span className="db-tier t-master">Master</span> |
| **Scripting** — `--eval`, loading a file, and non-interactive use in a deploy step | <span className="db-tier t-understand">Understand</span> |
| **`db.runCommand` and `db.adminCommand`** — the escape hatch under every helper, and why knowing it exists makes the manual readable | <span className="db-tier t-understand">Understand</span> |
| **`mongoimport` / `mongoexport`** — and why they are not backups | <span className="db-tier t-understand">Understand</span> |
| **`mongodump` / `mongorestore`** — what they do capture, and the consistency caveat on a live system | <span className="db-tier t-understand">Understand</span> |
| **Compass** — where a GUI is genuinely faster (schema analysis, index suggestions) and where it misleads | <span className="db-tier t-know">Know</span> |
| ⚠️ **Shell safety on production** — the commands that do not ask twice, and read-only connection habits | <span className="db-tier t-master">Master</span> |

**Gate — move on when:** you can take a slow query someone reports, run it under
`explain("executionStats")`, and say whether the problem is the index, the
selectivity or the document count — without guessing.

---

## Phase 3 — Schema design and modelling

*16 topics.* The phase that decides whether the application is pleasant or awful
to work on, and the one where relational experience actively misleads.

| Topic | Tier |
|---|---|
| 🔴 **Schema design is a query exercise** — you design for the reads you will perform, not for a normal form. The complete reversal from PostgreSQL, and why | <span className="db-tier t-master">Master</span> |
| 🔴 **Embed vs reference — the decision procedure** — the actual questions in order: is it bounded, is it queried alone, does it change independently, does it exceed 16 MB | <span className="db-tier t-master">Master</span> |
| **One-to-few** — embed. The default, and why | <span className="db-tier t-master">Master</span> |
| **One-to-many** — reference, or embed the ids; the read cost of each | <span className="db-tier t-master">Master</span> |
| **One-to-squillions** — reference from the *many* side; the unbounded-array trap this avoids | <span className="db-tier t-master">Master</span> |
| **Many-to-many** — and why the relational answer (a join collection) is usually wrong here | <span className="db-tier t-understand">Understand</span> |
| **The extended reference pattern** — duplicating the two fields you always display, and accepting the update cost knowingly | <span className="db-tier t-master">Master</span> |
| **The subset pattern** — the ten most recent embedded, the rest referenced | <span className="db-tier t-understand">Understand</span> |
| **The computed pattern** — storing an aggregate you would otherwise recompute per read | <span className="db-tier t-understand">Understand</span> |
| **The bucket pattern** — time-series and event data, and how it changes the document count by orders of magnitude | <span className="db-tier t-understand">Understand</span> |
| **The outlier pattern** — designing for the 99% and handling the one document with 40,000 entries | <span className="db-tier t-know">Know</span> |
| **Polymorphic collections and schema versioning** — many shapes in one collection, and migrating shapes without downtime | <span className="db-tier t-understand">Understand</span> |
| 🔴 **Denormalisation is a trade you must name** — every duplicated field is a write you now owe; where that debt comes due | <span className="db-tier t-master">Master</span> |
| **Schema validation with `$jsonSchema`** — putting the schema back on the server, validation levels and actions | <span className="db-tier t-master">Master</span> |
| ⚠️ **The anti-patterns** — unbounded arrays, massive documents, a collection per tenant, too many collections, and the case-sensitivity trap | <span className="db-tier t-master">Master</span> |
| **Modelling the storefront** — a worked schema for products, variants, carts, orders and reviews, with the reasoning for each embed/reference call | <span className="db-tier t-master">Master</span> |

**Gate — move on when:** given a product catalogue with variants, reviews and
inventory, you can produce a schema, justify every embed and every reference
against the queries the application will run, and name the write cost of each
denormalisation you chose.

---

Next → **[Part 2 — Querying](02-querying.md)**
