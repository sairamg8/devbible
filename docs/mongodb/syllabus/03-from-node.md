---
title: "Part 3 — MongoDB from Node"
sidebar_label: "03 · From Node"
sidebar_position: 3
---

> Verified: 2026-08-14 against the **MongoDB 8.0** manual and the **Node.js driver**
> and **Mongoose** documentation. Tiers are assigned for fullstack application
> development.

**Phases 8–10 · 46 topics.** The half of MongoDB that runs in your application
rather than on the server — and the phase where most production incidents are
actually created.

Phase 10 exists mainly to talk you *out* of transactions. Single-document
atomicity covers far more than people expect, and a transaction is usually the
signal that Phase 3's modelling decision was wrong.

---

## Phase 8 — The Node.js driver, end to end

*16 topics.* The driver is not a thin wrapper. Connection pooling, retries and
timeouts are where a working application becomes an unreliable one.

| Topic | Tier |
|---|---|
| **`MongoClient`** — installing, constructing, and connecting | <span className="db-tier t-master">Master</span> |
| 🔴 **One client, reused** — the client *is* the connection pool. Creating one per request is the most common and most damaging driver mistake | <span className="db-tier t-master">Master</span> |
| **Pool options** — `maxPoolSize`, `minPoolSize`, `maxIdleTimeMS`, and how to size them against your host | <span className="db-tier t-understand">Understand</span> |
| **Connection strings in practice** — `mongodb+srv`, replica set names, `authSource`, `retryWrites`, `appName` | <span className="db-tier t-master">Master</span> |
| ⚠️ **Serverless and Lambda** — why the one-client rule needs care when the process may be frozen, and the connection storm it prevents | <span className="db-tier t-know">Know</span> |
| **`db()` and `collection()`** — cheap handles, and what they do not do (no I/O) | <span className="db-tier t-master">Master</span> |
| **The CRUD API from the driver** — the same operations as Phase 4, and where the signatures differ from the shell | <span className="db-tier t-master">Master</span> |
| 🔴 **Cursors in Node** — `for await`, `toArray()`, streaming, and why `toArray()` on an unbounded result is how you exhaust memory | <span className="db-tier t-master">Master</span> |
| **Aggregation from the driver** — and typing the output | <span className="db-tier t-master">Master</span> |
| **BSON in Node** — `ObjectId`, `Decimal128`, `Long`, and converting at the API boundary rather than deep in the app | <span className="db-tier t-master">Master</span> |
| 🔴 **Error handling** — `MongoServerError`, error codes, and handling duplicate key (11000) as a *control-flow* case rather than a crash | <span className="db-tier t-master">Master</span> |
| **Retryable reads and writes** — what the driver retries by default, what it does not, and what that means for idempotency | <span className="db-tier t-master">Master</span> |
| **Timeouts** — `serverSelectionTimeoutMS`, `socketTimeoutMS`, `maxTimeMS`, and which one actually stops a slow query on the server | <span className="db-tier t-master">Master</span> |
| **Write concern, read concern, read preference from the driver** — set per client, per database, per collection, per operation | <span className="db-tier t-understand">Understand</span> |
| **Change streams** — watching a collection, resume tokens, and what they replace (polling, tailing the oplog) | <span className="db-tier t-understand">Understand</span> |
| **TypeScript with the driver** — generics on `Collection<T>`, and where the types stop protecting you | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can explain what happens to an in-flight
`insertOne` when the primary steps down, whether it is retried, and what your
application must do to be safe either way.

---

## Phase 9 — Mongoose

*18 topics.* The ODM most MERN applications use. Worth knowing properly,
including the parts that cost you.

| Topic | Tier |
|---|---|
| 🔴 **What Mongoose is, and what it costs** — schemas, casting, validation and middleware in exchange for a layer between you and the query you actually sent | <span className="db-tier t-master">Master</span> |
| **Schemas and SchemaTypes** — types, options, defaults, `required` | <span className="db-tier t-master">Master</span> |
| **Models and documents** — the difference, and what a hydrated document carries | <span className="db-tier t-master">Master</span> |
| **Validation** — built-in validators, custom, async, and where validation does *not* run | <span className="db-tier t-master">Master</span> |
| **The Query builder** — chaining, and the fact that a query is not executed until awaited | <span className="db-tier t-master">Master</span> |
| 🔴 **`lean()`** — returning plain objects instead of hydrated documents; the large, easy performance win people miss for years | <span className="db-tier t-master">Master</span> |
| 🔴 **Middleware** — `pre` / `post`, and the **document vs query middleware** distinction that decides whether your hook runs on `findOneAndUpdate` at all | <span className="db-tier t-master">Master</span> |
| **Virtuals** — derived fields, and making them serialise | <span className="db-tier t-understand">Understand</span> |
| **Instance and static methods** — where domain logic legitimately lives | <span className="db-tier t-understand">Understand</span> |
| 🔴 **`populate()`** — the ORM join. What it actually issues (a second query, not a `$lookup`), and when to use `$lookup` instead | <span className="db-tier t-master">Master</span> |
| **Subdocuments** — single nested vs document arrays, their `_id`s, and validation behaviour | <span className="db-tier t-master">Master</span> |
| **Discriminators** — polymorphic models in one collection | <span className="db-tier t-know">Know</span> |
| ⚠️ **Indexes declared in the schema** — and why `autoIndex` must be off in production; the deploy that quietly rebuilds every index | <span className="db-tier t-master">Master</span> |
| **Transactions in Mongoose** — sessions threaded through every operation, and the one you forgot | <span className="db-tier t-understand">Understand</span> |
| **Connection management** — `mongoose.connect`, buffering, and readiness | <span className="db-tier t-master">Master</span> |
| **Plugins** — timestamps, soft delete, pagination, and writing your own | <span className="db-tier t-know">Know</span> |
| **TypeScript with Mongoose** — inferring document types, and the friction that remains | <span className="db-tier t-understand">Understand</span> |
| 🔴 **When *not* to use Mongoose** — the driver is a legitimate choice; the decision criteria, honestly stated | <span className="db-tier t-master">Master</span> |

**Gate — move on when:** you can say which Mongoose middleware runs for
`findOneAndUpdate` and which does not, why `lean()` changes the result type, and
what `populate()` costs compared with `$lookup` for a list of 50 items.

---

## Phase 10 — Transactions, sessions and consistency

*12 topics.* The guarantees you can ask for, what each costs, and why the answer
is usually "you do not need a transaction".

| Topic | Tier |
|---|---|
| 🔴 **Single-document atomicity covers most cases** — the Phase 0 guarantee, applied. Most "I need a transaction" instincts are answered by `findOneAndUpdate` or by a better schema | <span className="db-tier t-master">Master</span> |
| **Multi-document transactions** — what they are, and the requirement that surprises people: a replica set, even for a single node | <span className="db-tier t-master">Master</span> |
| **Sessions** — the object transactions hang off, and threading it through every operation in the transaction | <span className="db-tier t-master">Master</span> |
| **`withTransaction`** — the helper that handles the retry loop, and why hand-rolled `startTransaction`/`commitTransaction` is usually wrong | <span className="db-tier t-master">Master</span> |
| 🔴 **`TransientTransactionError` and retries** — transactions can fail for reasons that are not your fault, and the retry is *your* responsibility unless you use the helper | <span className="db-tier t-master">Master</span> |
| ⚠️ **Transaction limits** — the default time limit, the oplog size implication, and why a long transaction is a design error rather than a tuning problem | <span className="db-tier t-understand">Understand</span> |
| **Write concern** — `w: 1` vs `w: "majority"`, `j`, `wtimeout`; what "the write succeeded" means under each | <span className="db-tier t-master">Master</span> |
| **Read concern** — `local`, `available`, `majority`, `snapshot`, `linearizable`; what each protects you from | <span className="db-tier t-master">Master</span> |
| 🔴 **Read preference** — `primary`, `primaryPreferred`, `secondary`, `nearest`, and the stale read you just agreed to when someone said "read from secondaries to scale" | <span className="db-tier t-master">Master</span> |
| **Causal consistency** — read-your-own-writes across a session, and the case it fixes | <span className="db-tier t-understand">Understand</span> |
| 🔴 **When a transaction means the schema is wrong** — the diagnostic questions, and the modelling fixes that remove the need | <span className="db-tier t-master">Master</span> |
| **Compared with PostgreSQL** — MVCC, isolation levels and `SERIALIZABLE` against MongoDB's snapshot transactions; cross-linked to the finished PG phases rather than re-argued | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** given "decrement stock and create an order", you can
give both the transactional answer and the schema-level answer that avoids the
transaction, and say which you would ship and why.

---

← Prev: **[Part 2 — Querying](02-querying.md)** ·
Next → **[Part 4 — Production](04-production.md)**
