---
title: "Link map · MongoDB · T23–T40 (phases 4–6)"
sidebar_label: "03 · MongoDB · T23–T40 (phases 4–6)"
sidebar_position: 3
---

# Link map · MongoDB · T23–T40 (phases 4–6)

Continues [02-mongosh-and-schema-design.md](02-mongosh-and-schema-design.md). T23–T28 phase 4 (`docs/mongodb/pages/phase-4-crud/01–06`), T29–T34 phase 5
(`…/phase-5-query-operators/01–06`), T35–T40 phase 6 (`…/phase-6-aggregation/`). **17 are ✅ written; T38 is written as two pages; T40 `$unwind` is 🔲 not written.** *read* = I read the passage; *headings only* = fetched, headings and size checked.

🔴 **Honest scope of this file.** It is a **Manual-first pass**. For most topics here the Manual's own page is the explanation, and the
third-party results I got were a single SEO series (oneuptime, March 2026, all one publisher) and a Cosmos DB tutorial (a different product) —
neither is listed as a "Read this". Where the search surfaced a Jira ticket or forum thread that is the only place a gotcha is stated, it is
listed as "Also good". Manual links carry no `#anchors` (the Manual exposes no heading ids).

---

## Phase 4 — CRUD

### T23 · `insertOne` / `insertMany` — and `ordered` — Master · ✅ `…/phase-4-crud/01-insert.md`
- **Read this:** [db.collection.insertMany()](https://www.mongodb.com/docs/manual/reference/method/db.collection.insertmany/) · mongodb.com · "If `ordered` is true and an insert fails, the server does not continue"; with `false` it continues, and may reorder for speed (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Create Documents](https://www.mongodb.com/docs/manual/tutorial/insert-documents/) · mongodb.com · the gentler tutorial route; static text covers collection creation and the auto-generated `_id` when omitted (*read*); the code examples sit in language tabs not in the fetched HTML · fetched 2026-10-12

### T24 · `find` and the query document — Master · ✅ `…/02-find-and-the-query-document.md`
- **Read this:** [Read Documents](https://www.mongodb.com/docs/manual/tutorial/query-documents/) · mongodb.com · the tutorial on filter shape (≈1.5k words) · covers our angle: **partial** — the fetched text (*read*) has only behaviour notes (a find returns a cursor, not an array; queries over 100 MB spill to disk) because the examples sit in language tabs; implicit `$and` is stated on the `$and` page (*read*: "an implicit AND operation when you specify a comma separated list") · fetched 2026-10-12
- **Also good:** [db.collection.find()](https://www.mongodb.com/docs/manual/reference/method/db.collection.find/) · mongodb.com · full reference, ≈7.4k words — look up, do not read through; its `query` parameter is the selection filter and an empty document returns everything (*read*) · fetched 2026-10-12

### T25 · `findOne` — and how it differs from `find().limit(1)` — Master · ✅ `…/03-findone.md`
- **Read this:** [db.collection.findOne()](https://www.mongodb.com/docs/manual/reference/method/db.collection.findone/) · mongodb.com · returns a document, not a cursor; with 0 matches it returns null, and with 2+ matches it returns the first in natural order for a collection scan, so use a `sort` option for a consistent pick (*read*) · covers our angle: **partial** — the `limit(1)` comparison is not drawn · fetched 2026-10-12
- **Also good:** [Explain() error for findOne query](https://www.mongodb.com/community/forums/t/explain-error-for-findone-query/271834) · mongodb.com forums · question dated 2024-03-19; a community answer says `findOne()` is shorthand for `find().limit(1)` with the same optimisation and execution, and `explain()` belongs to the cursor so it cannot be called on `findOne` (*read*; a community reply, not Manual text — verify against your driver) · fetched 2026-10-12
- **Our delta:** the `findOne` vs `find().limit(1)` difference — the Manual does not draw it; only the forum reply above does.

### T26 · Projection — Master · ✅ `…/04-projection.md`
- **Read this:** [db.collection.find() → projection](https://www.mongodb.com/docs/manual/reference/method/db.collection.find/) · mongodb.com · the projection table: `1`/`true` includes, `0`/`false` excludes; a projection cannot mix include and exclude except `_id: 0`; `_id` is returned unless suppressed (*read*) · covers our angle: **partial** — the include/exclude rule is full; the network and memory argument is not made · fetched 2026-10-12
- **Also good:** [Project Fields to Return from Query](https://www.mongodb.com/docs/manual/tutorial/project-fields-from-query-results/) · mongodb.com · ≈1.4k words (*read*): by default all fields return, and projection limits the data MongoDB sends to the application; the include/exclude examples sit in language tabs not in the fetched text · fetched 2026-10-12
- *Checked, not chosen:* [Projection operators index](https://www.mongodb.com/docs/manual/reference/mql/projection/) — only a list of `$`, `$elemMatch`, `$meta`, `$slice` (*read*).
- **Our delta:** "matters more than it looks" — the network and memory cost argument.

### T27 · `updateOne` / `updateMany` — operators or it is a replacement — Master · ✅ `…/05-update.md`
- **Read this:** [db.collection.updateOne()](https://www.mongodb.com/docs/manual/reference/method/db.collection.updateone/) · mongodb.com · the update argument is either an update-operator document or an aggregation pipeline (`$addFields`/`$set`, `$project`/`$unset`, `$replaceRoot`/`$replaceWith`); a replacement document goes to `replaceOne` (*read*) · covers our angle: **partial** — states what is allowed and that a replacement document goes to `replaceOne` (*read*), not the failure when you pass a bare document · fetched 2026-10-12
- **Also good:** [Error: the update operation document must contain atomic operators](https://www.mongodb.com/community/forums/t/error-the-update-operation-document-must-contain-atomic-operators/224439) · mongodb.com forums · question dated 2023-05-01, the shell error for exactly this mistake (opening post *read*; the answer was not) · fetched 2026-10-12
- *Not opened:* Jira NODE-965 / DRIVERS-1298 (search hits: the Node driver once did not reject operator-less `updateOne`; the driver spec says it must). Check the pinned driver before claiming either behaviour.

### T28 · Field update operators — Master · ✅ `…/06-field-update-operators.md`
- **Read this:** [Update Operators](https://www.mongodb.com/docs/manual/reference/mql/update/) · mongodb.com · the index of `$set`, `$unset`, `$inc`, `$mul`, `$rename`, `$min`, `$max`, `$currentDate`, `$setOnInsert` with one-line descriptions (*read*, `$mul`/`$rename`/`$setOnInsert`) · covers our angle: full for the list · fetched 2026-10-12
- **Also good:** [$inc](https://www.mongodb.com/docs/manual/reference/operator/update/inc/) · [$currentDate](https://www.mongodb.com/docs/manual/reference/operator/update/currentdate/) · mongodb.com · per-operator references (*read*): `$inc` creates a missing field, errors on a null value, and is atomic within one document; `$currentDate` sets a Date by default or a timestamp via `$type` · fetched 2026-10-12

## Phase 5 — Query operators

### T29 · Comparison operators — Master · ✅ `docs/mongodb/pages/phase-5-query-operators/01-comparison-operators.md`
- **Read this (1/2):** [Comparison Query Predicate Operators](https://www.mongodb.com/docs/manual/reference/mql/query-predicates/comparison/) · mongodb.com · all eight operators listed (*read*: `$in`, `$lt`, `$lte`, `$ne`, `$nin`); it defers cross-BSON-type comparison to the comparison-order page (*read*) · covers our angle: **partial** — "across BSON types" is not discussed here · fetched 2026-10-12
- **Read this (2/2):** [Comparison/Sort Order](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/) · mongodb.com · the cross-type order (MinKey, Null, Numbers, String, Object, Array, and so on up to MaxKey); a note says comparison query operators only compare values of the matching BSON type (type bracketing); for sort comparison the page says a non-existent field is treated as null (*read*, stated for sort order, not for query matching) · covers the cross-type angle: full for the order and type bracketing · fetched 2026-10-12

### T30 · Logical operators — Master · ✅ `…/02-logical-operators.md`
- **Read this:** [$and](https://www.mongodb.com/docs/manual/reference/operator/query/and/) · mongodb.com · explicit `$and`, with the note that a comma-separated list is an implicit AND (*read*) · covers our angle: **partial** — "when the explicit `$and` is required" (same field twice, same operator twice) (*read*, on this same page: `$ne` twice on one field at one object level is invalid, use `$nin`; rewrites to implicit AND are "not always possible" when conditions duplicate on the same field) · fetched 2026-10-12
- **Also good:** [Logical Query Predicate Operators](https://www.mongodb.com/docs/manual/reference/mql/query-predicates/logical/) · mongodb.com · the four operators on one page (*read*: an index list with one-line descriptions) · fetched 2026-10-12

### T31 · Element operators — `$exists`, `$type` — Master · ✅ `…/03-element-operators.md`
- **Read this (1/2):** [$exists](https://www.mongodb.com/docs/manual/reference/operator/query/exists/) · mongodb.com · `{ $exists: true }` also matches fields whose value is `null`; sparse-index performance table (*read*) · covers our angle: full for null vs missing · fetched 2026-10-12
- **Read this (2/2):** [$type](https://www.mongodb.com/docs/manual/reference/operator/query/type/) · mongodb.com · ≈3k words, querying by BSON type and alias, or an array of types; on an array field it matches if any element has the type, and `"array"` matches the field itself being an array (*read*) · covers our angle: full · fetched 2026-10-12

### T32 · 🔴 `$regex` and indexes — Master · ✅ `…/04-regex.md`
- **Read this:** [$regex](https://www.mongodb.com/docs/manual/reference/operator/query/regex/) · mongodb.com · Index Use section: case-sensitive queries can scan the index; a "prefix expression" allows a range scan; **case-insensitive indexes do not help `$regex` because it is not collation-aware** (*read*); the `m` option and anchors (*read*) · covers our angle: full · fetched 2026-10-12
- *Checked, not chosen:* a March 2026 oneuptime series (≥6 posts, one publisher) repeats the same points and adds a collation-range workaround; it is derivative of the Manual and I did not read the bodies.

### T33 · `$expr` — Master · ✅ `…/05-expr.md`
- **Read this:** [$expr](https://www.mongodb.com/docs/manual/reference/operator/query/expr/) · mongodb.com · "compare fields from the same document", with a movies example comparing two rating fields (*read*) · covers our angle: full · fetched 2026-10-12

### T34 · 🔴 Array matching: exact vs containment — Master · ✅ `…/06-array-matching.md`
- **Read this (1/2):** [$eq → Match an Array Value](https://www.mongodb.com/docs/manual/reference/operator/query/eq/) · mongodb.com · with an array value the field must match the array exactly **or contain an element that matches it exactly**, and element order matters; the `{ tags: "B" }` form matches any array containing that element, shown as equivalent to `$eq` (*read*) · covers our angle: full for both halves · fetched 2026-10-12
- **Read this (2/2):** [Query an Array](https://www.mongodb.com/docs/manual/tutorial/query-arrays/) · mongodb.com · the tutorial; the examples sit in language tabs and the fetched text has none, so neither half is confirmed here (*read*; demoted) · fetched 2026-10-12
- **Also good:** [$elemMatch](https://www.mongodb.com/docs/manual/reference/operator/query/elemmatch/) · [Query an Array of Embedded Documents](https://www.mongodb.com/docs/manual/tutorial/query-array-of-documents/) · mongodb.com · for conditions that must hold on the *same* element (*read*: `$elemMatch` example matching one element that is both >= 80 and < 85); also [$all](https://www.mongodb.com/docs/manual/reference/operator/query/all/), order-independent containment, shown as equivalent to an `$and` of per-value matches (*read*) · fetched 2026-10-12
- **Beyond the docs:** [elemMatch MongoDB: match multiple conditions on array elements](https://codeforgeek.com/elemmatch-in-mongodb/) · CodeForGeek, Aneesha S (page dated Jul 26, 2024) · states the split-across-elements trap plainly: without `$elemMatch` each condition is checked against the array independently, so different elements can satisfy different conditions, and `$elemMatch` binds them to one element · fetched 2026-10-13 (*read*)
- **Our delta:** the side-by-side `{tags: "a"}` vs `{tags: ["a"]}` table.

## Phase 6 — The aggregation pipeline

### T35 · What a pipeline is — Master · ✅ `docs/mongodb/pages/phase-6-aggregation/01-what-a-pipeline-is.md`
- **Read this:** [Aggregation Pipeline](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/) · mongodb.com · ≈1.7k words (*read*): a pipeline is stages in order, each stage's output feeds the next; `aggregate()` does not modify stored documents unless the pipeline has `$merge` or `$out` · covers our angle: full (concept page) · fetched 2026-10-12
- *Not opened:* the Microsoft Learn aggregation tutorial and Pentaho page the search returned — Cosmos DB and a PDI step reference, not MongoDB.

### T36 · 🔴 `$match` first, always — Master · ✅ `…/02-match-first.md`
- **Read this (1/2):** [Aggregation Pipeline Optimization](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/) · mongodb.com · for a projection stage (`$addFields`/`$project`/`$set`/`$unset`) followed by `$match`, MongoDB moves filters that do not need computed values ahead of the projection; also `$sort`+`$limit` coalescence (*read*) · covers our angle: **partial** — it describes automatic reordering, which softens "always first by hand"; it also moves `$match` ahead of `$sort`, and says the moved filter lets an index on the field be used (*read*) · fetched 2026-10-12
- **Read this (2/2):** [$match](https://www.mongodb.com/docs/manual/reference/operator/aggregation/match/) · mongodb.com · ≈2.6k words (*read*): place `$match` as early as possible; a `$match` at the very beginning can use indexes like `find()`, and `$text` requires `$match` to be the first stage · fetched 2026-10-12
- **Our delta:** (the Manual lists what the optimizer does reorder; what it does not reorder is not confirmed) what the optimizer does *not* reorder, and why a leading `$match` is still the only index-usable position.

### T37 · `$project` vs `$addFields` / `$set` — Master · ✅ `…/03-project-vs-addfields.md`
- **Read this:** [$project](https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/) · mongodb.com · points to `$addFields` for adding fields; "to add a new field or reset an existing one, specify the field name and an expression" (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [$addFields](https://www.mongodb.com/docs/manual/reference/operator/aggregation/addfields/) · [$set (aggregation stage)](https://www.mongodb.com/docs/manual/reference/operator/aggregation/set/) · mongodb.com · the add-only side and its alias (*read*): both keep all existing fields, and a new field with an existing name, `_id` included, overwrites that value · fetched 2026-10-12

### T38 · `$group` and the accumulators — Master · ✅ `…/04-group-and-accumulators.md` + `…/04b-the-accumulators.md`
- **Read this:** [$group](https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/) · mongodb.com · ≈4.5k words; the accumulator list including `$push` ("an array of expression values for documents in each group"); `$group` does not order its output (*read*) · covers our angle: full · fetched 2026-10-12

### T39 · `$sort`, `$limit`, `$skip` in a pipeline — Master · ✅ `…/05-sort-limit-skip.md`
- **Read this (1/2):** [$sort](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sort/) · mongodb.com · "Sort Consistency": `$sort` is not stable — documents with equal values can come back in any order, so add a unique tiebreaker (*read*) · covers our angle: **partial** — the sort-before-group optimisation is not in this page; the optimisation page lists `$sort`+`$match` (the `$match` moves ahead) but no `$sort`+`$group` reordering rule; its index section says a `$sort` can use an index only if no `$project`, `$unwind` or `$group` precedes it, and a `$group` using only `$first`/`$last` can use an index (*read*) · fetched 2026-10-12
- **Read this (2/2):** [Aggregation Pipeline Optimization](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/) · `$sort` + `$limit` coalescence, which does not apply if an intervening `$unwind` or `$group` changes the document count (*read*) · fetched 2026-10-12
- **Also good:** [$limit](https://www.mongodb.com/docs/manual/reference/operator/aggregation/limit/) · [$skip](https://www.mongodb.com/docs/manual/reference/operator/aggregation/skip/) · mongodb.com · both say to include a unique field such as `_id` in the sort before `$limit` or `$skip` for consistent results (*read*) · fetched 2026-10-12

### T40 · `$unwind` — Master · 🔲 **not written** (the one topic owed in phase 6)
- **Read this:** [$unwind](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/) · mongodb.com · `path`, `includeArrayIndex`, `preserveNullAndEmptyArrays`; the bare form outputs nothing when the field is null, missing or an empty array (*read*) · covers our angle: **partial** — "the document multiplication it causes" is shown only by example (an array of three genres yields three output documents, each repeating the other fields) (*read*), not stated as a warning · fetched 2026-10-12
- **Our delta (for when the page is written):** the multiplication, and `preserveNullAndEmptyArrays` as the guard against silently dropping documents.
