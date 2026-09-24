---
name: devbible-mongodb-syllabus
description: MongoDB syllabus — 15 phases, 204 topics, 4 parts, written 2026-08-14; zero pages, unclaimed, ready for any session to start at Phase 0
metadata:
  type: project
---

**Written 2026-08-14 by session `6ffd754d`.** `docs/mongodb/` — README + 4 syllabus
part files + empty `pages/`. Committed `26890be`.

🟢 **UNCLAIMED and ready.** The syllabus **is** the approved plan (rule 5's
"syllabus first, approved, then content" step is done), so a free session can
start writing Phase 0 pages immediately without re-planning. Claims table row in
`docs/README.md` says so explicitly.

## Shape — 15 phases, 204 topics

| Part | Phases | Topics |
|---|---|---|
| 1 The document model | 0 How MongoDB runs (14) · 1 Documents, BSON, `_id` (13) · 2 `mongosh` (12) · 3 Schema design (16) | 55 |
| 2 Querying | 4 CRUD (16) · 5 Query operators (14) · 6 Aggregation (20) · 7 Indexes (12) | 62 |
| 3 From Node | 8 Node driver (16) · 9 Mongoose (18) · 10 Transactions (12) | 46 |
| 4 Production | 11 Replication/sharding (12) · 12 Performance/ops (11) · 13 Security (10) · 14 Storefront (8) | 41 |

Rows already added to `src/data/progress.js` under `mongodb`, all `pages: 0`.

## 🔴 Version pin and the evidence constraint

- **Target MongoDB 8.0** — the Major Release (two-year cadence, five-year
  lifecycle). **8.2** is the current minor supported on Atlas *and* on-premises;
  **8.3** ships on Atlas clusters set to auto-upgrade. Verified 2026-08-14 from
  mongodb.com lifecycle/release pages.
- ⚠️ **No MongoDB server is installed on this machine**, and under rule 8 none
  will be. The README states this inline: **every page is documentation-validated
  and there will be no console blocks.** Do not let a later session decide to
  "just spin up a container to check" — that is the closed sandbox path.

## The spine of the syllabus

**"The unit of atomicity is the single document."** Everything is downstream of
that one sentence, and the README says so:
- it is why **embedding is the default**;
- why **schema design is a query exercise, not a normalisation exercise** — the
  complete reversal from PostgreSQL, and the single most expensive mistake
  incoming relational developers make;
- why **transactions exist but are a last resort** (Phase 10 is written mostly to
  talk you *out* of them — `findOneAndUpdate` or a better schema usually wins);
- why the `_id` index is the only one you never think about.

**Phase 7 (Indexes) is flagged as the highest-value phase** — nothing else changes
application performance by two orders of magnitude. **ESR (Equality, Sort, Range)**
is the rule to lead with.

**Sharding is deliberately `Know`, not `Master`** — a MERN app reaches a replica
set long before it needs a shard key, and the shard key is effectively permanent.
The syllabus README uses this as the worked example of how tiers are assigned.

## Deliberate cross-links to PostgreSQL

PostgreSQL is COMPLETE (298 pages), so several rows are written as *comparisons*
rather than re-arguments: "MongoDB vs PostgreSQL — the actual trade" (Phase 0),
and "Compared with PostgreSQL" in Phase 10 (MVCC and isolation levels vs snapshot
transactions). **Link to the finished PG pages instead of re-explaining relational
behaviour.**

## Traps recorded in the topic rows themselves

Worth knowing before writing the pages — each already has a row:
- `{tags: "a"}` matches an array *containing* `"a"`; `{tags: ["a"]}` matches only
  the exact array. **The most common MongoDB query bug.**
- `$elemMatch` vs dot notation on arrays of embedded documents — "some element
  matches all conditions" vs "conditions satisfied across different elements".
- `{field: null}` **matches documents that lack the field entirely.**
- Two concurrent `upsert`s on a non-unique field **both insert**; the unique index
  is the fix, not a retry.
- `$` only ever updates the **first** matching array element; `$[]` and
  `$[<id>]` + `arrayFilters` are the others.
- An update without operators is a **replacement**.
- `skip` is the wrong pagination primitive at any real size.
- Mongoose: **document vs query middleware** decides whether your hook runs on
  `findOneAndUpdate` at all; `lean()` is the big easy win; `autoIndex` must be off
  in production; `populate()` issues a second query, it is not `$lookup`.
- Driver: **one `MongoClient`, reused** — it *is* the pool.
- NoSQL injection: `{"$ne": null}` arriving as a JSON body is a real Express auth
  bypass (Phase 13 gate).

## Out of scope (stated in the README)

Analytics-warehouse use, Realm/Device Sync, Atlas Search beyond an introduction,
and C++ internals below the storage engine's observable behaviour.
