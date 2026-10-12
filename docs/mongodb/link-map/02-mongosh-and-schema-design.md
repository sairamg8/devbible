---
title: "Link map · MongoDB · T12–T22 (phases 2–3)"
sidebar_label: "02 · MongoDB · T12–T22 (phases 2–3)"
sidebar_position: 2
---

# Link map · MongoDB · T12–T22 (phases 2–3)

All 11 topics are ✅ written. Numbering continues from [01-how-it-runs-and-bson.md](01-how-it-runs-and-bson.md): T12–T16 are phase 2
(`docs/mongodb/pages/phase-2-mongosh/01–05`), T17–T22 are phase 3 (`…/phase-3-schema-design/01–06`). Manual links carry no `#anchors`
(the Manual exposes no heading ids). *read* = I read the passage; *headings only* = page fetched, headings and size checked.

---

### T12 · Connecting — Master · ✅ `docs/mongodb/pages/phase-2-mongosh/01-connecting.md`
- **Read this (1/2):** [Connection Strings](https://www.mongodb.com/docs/manual/reference/connection-string/) · mongodb.com · the formats, with `mongodb+srv://` described as simplifying connection by auto-including the seed list (*read*) · covers our angle: **partial** — anatomy and SRV yes; the full option list was **not read** · fetched 2026-10-12
- **Read this (2/2):** [Connect to a Deployment — mongosh](https://www.mongodb.com/docs/mongodb-shell/connect/) · mongodb.com · ≈3k words: Atlas, local default and non-default port, remote host, authentication, replica set, TLS, switching deployments (headings only) · covers our angle: full for "connecting to Atlas" · fetched 2026-10-12

### T13 · Navigating — Master · ✅ `…/02-navigating.md`
- **Read this:** [Run Commands — mongosh](https://www.mongodb.com/docs/mongodb-shell/run-commands/) · mongodb.com · `use <db>`, `show dbs`, and that `use` followed by an insert creates the database and collection (*read*) · covers our angle: full for "why a database that does not exist still lets you type `use`" · fetched 2026-10-12
- **Also good:** [mongosh Help](https://www.mongodb.com/docs/mongodb-shell/reference/access-mdb-shell-help/) · mongodb.com · how to list databases, collections and methods from the shell and get per-method help (headings only) · fetched 2026-10-12

### T14 · Cursors — Master · ✅ `…/03-cursors.md`
- **Read this:** [Iterate a Cursor in mongosh](https://www.mongodb.com/docs/manual/tutorial/iterate-a-cursor/) · mongodb.com · a cursor returns documents in batches; mongosh shows 20 per iteration by default, changed with `displayBatchSize`; `toArray()` returns all as an array (*read*) · covers our angle: **partial** — batching and `it` yes; "a cursor is not a result set" is implied, not argued · fetched 2026-10-12
- **Also good:** [cursor.batchSize()](https://www.mongodb.com/docs/manual/reference/method/cursor.batchsize/) · mongodb.com · the server-side batch knob, distinct from the shell's display batch (headings only) · fetched 2026-10-12

### T15 · 🔴 `explain()` from the shell — Master · ✅ `…/04-explain.md`
- **Read this (1/2):** [Interpret Explain Plan Results](https://www.mongodb.com/docs/manual/tutorial/analyze-query-plan/) · mongodb.com · a worked `find().explain("executionStats")`: `winningPlan` stage `COLLSCAN` vs the counters `nReturned`, `totalKeysExamined`, `totalDocsExamined` (*read*) · covers our angle: full for reading the plan · fetched 2026-10-12
- **Read this (2/2):** [cursor.explain()](https://www.mongodb.com/docs/manual/reference/method/cursor.explain/) · mongodb.com · the three verbosity modes — `queryPlanner` (default), `executionStats`, `allPlansExecution` (*read*) · covers our angle: full for the three levels · fetched 2026-10-12
- **Also good:** [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/) · mongodb.com · the field-by-field reference, ≈6.5k words — look things up, do not read it through (headings only) · fetched 2026-10-12

### T16 · ⚠️ Shell safety on production — Master · ✅ `…/05-shell-safety.md`
- **Read this:** **none found** — tried: the mongosh docs index and `run-commands`, `access-mdb-shell-help` (no page on destructive helpers or read-only habits), and the Manual's Built-In Roles page (the `read` role is the mechanism, but the text I extracted for it was nav noise, so I cannot cite what it says). No article explaining "the commands that do not ask twice" was found.
- **Also good:** [Built-In Roles](https://www.mongodb.com/docs/manual/reference/built-in-roles/) · mongodb.com · where the read-only role is defined — *not read* for the claim; listed as the place to verify, not as proof · fetched 2026-10-12
- **Our delta:** this topic is ours to own outright.

### T17 · 🔴 Schema design is a query exercise — Master · ✅ `docs/mongodb/pages/phase-3-schema-design/01-schema-design-is-a-query-exercise.md`
- **Read this:** [Designing Your Schema](https://www.mongodb.com/docs/manual/data-modeling/schema-design-process/) · mongodb.com · the Manual's process page, ≈1.3k words, with a child page on creating indexes (headings only) · covers our angle: **partial** — I did not confirm it says "design for the reads, not a normal form" · fetched 2026-10-12
- **Also good:** [Data Modeling in MongoDB](https://www.mongodb.com/docs/manual/data-modeling/) · mongodb.com · includes "Schema Design: Differences Between Relational and Document Databases" (heading) · fetched 2026-10-12
- **Our delta:** the explicit reversal from the PostgreSQL normal-form habit.

### T18 · 🔴 Embed vs reference — the decision procedure — Master · ✅ `…/02-embed-vs-reference.md`
- **Read this:** [Best Practices for Data Modeling in MongoDB](https://www.mongodb.com/docs/manual/data-modeling/best-practices/) · mongodb.com · "Link Related Data" and "Duplicate Data" sections, plus atomicity and small-documents considerations (headings; ≈3.3k words; 22 mentions of "embed") · covers our angle: **partial** — a discussion, not the ordered question list (bounded? queried alone? changes independently? 16 MB?) · fetched 2026-10-12
- **Also good:** [6 Rules of Thumb for MongoDB Schema Design](https://www.mongodb.com/company/blog/mongodb/6-rules-of-thumb-for-mongodb-schema-design) · mongodb.com blog · published 2014-06-11, modified 2022-11-02, ≈4.7k words: sorts one-to-N into few / many / squillions and picks a model for each (*read* the framing) · fetched 2026-10-12
- **Our delta:** the *ordered* procedure — nobody I opened gives it as a checklist.

### T19 · One-to-few — Master · ✅ `…/03-one-to-few.md`
- **Read this:** [6 Rules of Thumb → Modeling one-to-few](https://www.mongodb.com/company/blog/mongodb/6-rules-of-thumb-for-mongodb-schema-design) · mongodb.com blog · the example is a person's addresses, embedded as an array — "a good use case for embedding" (*read*); dated 2014, modified 2022 · covers our angle: full · fetched 2026-10-12
- **Also good:** [Model One-to-One Relationships with Embedded Documents](https://www.mongodb.com/docs/manual/tutorial/model-embedded-one-to-one-relationships-between-documents/) · mongodb.com · the Manual's embedded shape (headings only) · fetched 2026-10-12

### T20 · One-to-many — Master · ✅ `…/04-one-to-many.md`
- **Read this (1/2):** [Model One-to-Many Relationships with Embedded Documents](https://www.mongodb.com/docs/manual/tutorial/model-embedded-one-to-many-relationships-between-documents/) · mongodb.com · the embed side, ≈1.4k words (headings only) · covers our angle: partial · fetched 2026-10-12
- **Read this (2/2):** [Model One-to-Many Relationships with Document References](https://www.mongodb.com/docs/manual/tutorial/model-referenced-one-to-many-relationships-between-documents/) · mongodb.com · the reference side, ≈1.6k words (headings only) · covers our angle: partial — "the read cost of each" is not confirmed · fetched 2026-10-12
- **Also good:** [6 Rules of Thumb](https://www.mongodb.com/company/blog/mongodb/6-rules-of-thumb-for-mongodb-schema-design) · the one-to-many section for the parts-in-an-array-of-ids case · fetched 2026-10-12

### T21 · One-to-squillions — Master · ✅ `…/05-one-to-squillions.md`
- **Read this:** [Avoid Unbounded Arrays](https://www.mongodb.com/docs/manual/data-modeling/design-antipatterns/unbounded-arrays/) · mongodb.com · an unlimited array can push a document past the 16 MB BSON limit and hurt index performance; the fix is subsetting and referencing (*read*) · covers our angle: **partial** — the trap is covered; "reference from the many side" is the Reference Data heading, not read in full · fetched 2026-10-12
- **Also good:** [6 Rules of Thumb → one-to-squillions](https://www.mongodb.com/company/blog/mongodb/6-rules-of-thumb-for-mongodb-schema-design) · the original statement of the pattern (*read* the framing) · fetched 2026-10-12

### T22 · The extended reference pattern — Master · ✅ `…/06-extended-reference.md`
- **Read this:** [Building with Patterns: The Extended Reference Pattern](https://www.mongodb.com/company/blog/building-with-patterns-the-extended-reference-pattern) · mongodb.com blog · published 2019-03-07, ≈1.3k words, one sample use case (headings only) · covers our angle: **partial** — the body, and whether it states the update cost, was **not read** · fetched 2026-10-12
- **Also good:** [Schema Design Patterns](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/) · mongodb.com · the Manual's current pattern index; **the extended reference pattern is not on it** (the page text has no "extended" or "duplicate") · fetched 2026-10-12
- **Our delta:** the update cost, named knowingly.
