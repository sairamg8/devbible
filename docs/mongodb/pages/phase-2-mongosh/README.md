---
title: "Phase 2 — mongosh, mastered"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-15 against the **MongoDB Manual** (v8.0). Sources named per page.
> **Documentation-validated** under the no-new-sandboxes rule — and note that **no MongoDB
> server is installed on this machine**, so these pages carry **no console blocks**. Commands
> are shown; their output is described, never fabricated.

**✅ 5 of 5 topics written — COMPLETE.** The shell is the debugging tool. Fluency in it is the
difference between diagnosing a slow query in two minutes and guessing at it.

> **Scope:** the syllabus was cut to the critical path on 2026-08-14 — **204 → 82 topics**,
> Master tier only, capped at 6 per phase. This phase went from 12 to 5.

| # | Page | Tier | State |
|---|---|---|---|
| 01 | [Connecting](./01-connecting.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 02 | [Navigating](./02-navigating.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 03 | [Cursors](./03-cursors.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 04 | [`explain()` from the shell](./04-explain.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 05 | [Shell safety on production](./05-shell-safety.md) | <span className="db-tier t-master">Master</span> | ✅ written |

## Coverage

| | |
|---|---|
| Topics written | **5 of 5 — COMPLETE** |
| Pages on disk | **5** |
| Evidence | MongoDB Manual, named per page; **no console blocks** |

## Why the shell matters more here than in most databases

MongoDB has no query planner hints you can read from a schema, no `EXPLAIN ANALYZE` habit
baked into every ORM, and no static types to tell you a field is sometimes a string. **The
shell is where you find out what is actually in the collection and what the planner actually
did** — and topic 04 is the single most useful skill in this syllabus.

`mongosh` is also a **full JavaScript environment**, which is a genuine advantage over
`psql`: a one-off migration, an audit loop, a bulk fix are all just JavaScript, with the
driver already connected.

## Phase gate

You can take a slow query someone reports, run it under `explain("executionStats")`, and say
whether the problem is the index, the selectivity or the document count — without guessing.

## Where this connects

- **← [Phase 1 · Types](../phase-1-documents-and-bson/README.md)** — the type audits in that
  phase are shell work; `$type` queries are how you find the drift.
- **→ Phase 7 · Indexes and the query planner** — `explain()` is introduced here as a skill
  and used there as the measuring instrument.
- **→ Phase 12 · Performance and operations** — the safety habits in topic 05 are the same
  ones that keep a production incident from becoming two.

---

Start → [01 · Connecting](./01-connecting.md)
