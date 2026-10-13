---
title: "Link map · MongoDB · T01–T11 (phases 0–1)"
sidebar_label: "01 · MongoDB · T01–T11 (phases 0–1)"
sidebar_position: 1
---

# Link map · MongoDB · T01–T11 (phases 0–1)

All 11 topics are ✅ written. Numbering follows `docs/mongodb/syllabus/01-the-document-model.md`, in row order
(T01–T05 phase 0, T06–T11 phase 1). Manual links are the `v8.0`-era pages on `mongodb.com/docs/manual/`. The Manual does
not expose heading `id`s in its HTML, so **no `#anchors` are given** for it — an unverifiable anchor is never listed.

🔴 **Depth honesty for this file.** Where a claim rests on exact wording I read the passage (marked *read*). Where I only
fetched the page and checked its headings, word count and keyword counts, the block says *headings only*. No block is
marked "full" on headings alone.

---

### T01 · What MongoDB actually is — Master · ✅ `docs/mongodb/pages/phase-0-how-mongodb-runs/01-what-mongodb-actually-is.md`
- **Read this:** [Data Modeling in MongoDB](https://www.mongodb.com/docs/manual/data-modeling/) · mongodb.com · the Manual's own statement of the model: documents in one collection need not share fields, a field's type can differ between documents (*read*) · covers our angle: **partial** — it says "flexible data model", never confronts "schemaless" or says the schema moves into the application · fetched 2026-10-12
- **Also good:** [Schema Validation](https://www.mongodb.com/docs/manual/core/schema-validation/) · mongodb.com · the server-side half of "there is always a schema": rules for allowed types and value ranges; after rules exist, all inserts must match, and the validation level decides how existing documents and updates are treated; the page itself opens by stating the default flexible model (*read*) · fetched 2026-10-12
- **Also good (opinion):** [Stop Claiming that you're Using a Schemaless Database](https://blog.jooq.org/stop-claiming-that-youre-using-a-schemaless-database/) · blog.jooq.org · posted 2014-10-20, modified 2022; quotes MongoDB's own "why schemaless" text and answers that varying fields do not mean there is no schema — several schemas exist, and the work of defining one just moves into the application (*read*, opening section) · covers our angle: **partial** — it is the right argument but from a SQL-tooling vendor, 2014-era, and not MongoDB-specific advice · fetched 2026-10-12
- **Our delta:** the "schemaless is the wrong mental model" argument tied to the server-side validation the Manual describes — the jOOQ post makes the argument, no MongoDB page does.
- *Checked, not chosen:* MongoDB "What is a Document Database?" (vendor explainer, modified 2026-07-31, ≈3k words) — good on documents vs tables, calls it a "flexible schema", but is marketing-shaped.
- *Not opened:* 9 SEO pages on embedding/referencing (oneuptime, kitemetric, leyaa and similar) — T01 is not their topic.

### T02 · The single-document atomicity guarantee — Master · ✅ `…/02-single-document-atomicity.md`
- **Read this:** [Atomicity and Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/) · mongodb.com · single-document writes are atomic; `updateMany` is atomic per document but not as a whole; distributed transactions cost more and are "not a replacement for effective schema design", so denormalized embedded data stays the norm (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [MongoDB vs PostgreSQL → ACID transactions in each system](https://www.mongodb.com/resources/compare/mongodb-postgresql) · mongodb.com · the vendor's own framing: a document write is atomic because the data is clustered, so transactions are only needed across documents (*read*) — vendor page, no date found · fetched 2026-10-12

### T03 · BSON — Master · ✅ `…/03-bson.md`
- **Read this:** [MongoDB BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/) · mongodb.com · the types BSON adds over JSON, with numeric ids and `$type` aliases (*read*) · covers our angle: **partial** — types yes; length prefixes, ordering and the size/speed cost are not discussed there, but the two bsonspec.org pages below cover prefixes, ordering and field-name overhead (no size-versus-JSON numbers found) · fetched 2026-10-12
- **Also good (1/2):** [bsonspec.org](https://bsonspec.org/) · bsonspec.org · the format's own landing page: names three design goals (lightweight, traversable, efficient) and admits BSON carries overhead for field names inside the serialized data (*read*) — that is the cost half of our angle · fetched 2026-10-12
- **Also good (2/2):** [BSON specification 1.1](https://bsonspec.org/spec.html) · bsonspec.org · a document is an int32 total byte count, then the element list, then a zero byte; each element is a type byte, a name and a value; ordered key/value pairs, little-endian (*read*) — that is the length-prefix half of our angle · fetched 2026-10-12
- **Beyond the docs:** [BSON](https://en.wikipedia.org/wiki/BSON) · Wikipedia · a worked hex example of `{"hello": "world"}` showing the length prefix and end marker, plus an Efficiency section that says BSON can use more space than JSON because of length prefixes and explicit array indices — the size-versus-JSON caveat the official pages leave out · fetched 2026-10-13 (*read*)
- **Our delta:** what BSON costs (field names repeated in every document, size vs JSON) and why length prefixes make it traversable.

### T04 · Document, collection, database — Master · ✅ `…/04-document-collection-database.md`
- **Read this (1/2):** [Documents](https://www.mongodb.com/docs/manual/core/document/) · mongodb.com · structure, dot notation, the 16 MiB limit section, field order (`_id` always first — *read*) · covers our angle: full for "document" · fetched 2026-10-12
- **Read this (2/2):** [Databases and Collections](https://www.mongodb.com/docs/manual/core/databases-and-collections/) · mongodb.com · collections are created implicitly by `insertOne` or `createIndex` if absent (*read*), explicit creation, schema validation, the immutable collection UUID · covers our angle: full for "collection"; "what each does and does not enforce" is split across both pages · fetched 2026-10-12

### T05 · 🔴 MongoDB vs PostgreSQL — the actual trade — Master · ✅ `…/05-mongodb-vs-postgresql.md`
- **Read this:** [Postgres vs MongoDB](https://www.tinybird.co/blog/postgres-vs-mongodb) · tinybird.co · dated 2026-06-08, ≈3.2k words; sections "Where Postgres wins" (joins, schema enforcement, cross-collection transactions) and "Where MongoDB wins" (variable structure, nested writes) match the trade we name; I read the passages on transactions and variable structure: multi-document transactions arrived in 4.0 with notable overhead, and the advice is to design for single-document atomicity (*read*) · covers our angle: **partial** — atomicity vs ACID, constraints vs flexible fields and joins are covered; "locality" is only implied by the nested-writes section, and Tinybird is an analytics vendor · fetched 2026-10-12
- **Also good:** [Comparing MongoDB vs PostgreSQL](https://www.mongodb.com/resources/compare/mongodb-postgresql) · mongodb.com · terminology map, ACID in each system, query-language map — **vendor-authored**, read it for the vocabulary, not the verdict · fetched 2026-10-12
- **Our delta:** locality vs joins as the organizing idea, and the cross-link to our finished PostgreSQL phases.
- *Not opened:* instaclustr, plesk, stackshare comparisons (search hits only).

### T06 · The BSON types, completely — Master · ✅ `docs/mongodb/pages/phase-1-documents-and-bson/01-the-bson-types.md`
- **Read this:** [MongoDB BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/) · mongodb.com · the full table (Double 1 … Decimal128 19, MinKey −1, MaxKey 127), deprecated types flagged, `$type` and its `number` alias (*read*) · covers our angle: full for the list; "the ones that surprise people" is partial · fetched 2026-10-12
- **Also good:** [Comparison/Sort Order](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/) · mongodb.com · the cross-type sort order (MinKey, Null, Numbers, String, Object, Array … MaxKey); all numeric types compare as equivalent; query predicates only match values of the operand's BSON type, called type bracketing (*read*) — exactly the mixed-type surprise the phase gate asks about · fetched 2026-10-12

### T07 · `_id` — Master · ✅ `…/02-the-id-field.md`
- **Read this:** [Documents → The _id Field](https://www.mongodb.com/docs/manual/core/document/) · mongodb.com · every document in a standard collection requires a unique `_id`; it is always the first field; the server creates a unique index on `_id` at collection creation; `_id` is reserved as the primary key and immutable; any type except array or regex (*read*) · covers our angle: full — mandatory, default index and immutability are all stated on this page · fetched 2026-10-12
- **Also good:** [Single Field Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-single/) · mongodb.com · the index chapter, its opening says every collection has an index on `_id` by default (*read*) · fetched 2026-10-12

### T08 · `ObjectId` — Master · ✅ `…/03-objectid.md`
- **Read this:** [ObjectId() (mongosh method)](https://www.mongodb.com/docs/manual/reference/method/objectid/) · mongodb.com · 12 bytes = 4-byte seconds timestamp + 5-byte random value per client process + 3-byte counter initialised randomly (*read*) · covers our angle: **partial** — structure only. The current page text I fetched has **no** "not strict insertion order" warning (a search summary said it did; I did not find it) · fetched 2026-10-12
- **Also good:** [Community thread: ObjectId and absolute insertion order](https://www.mongodb.com/community/forums/t/objectid-guarantees-absolute-insertion-order-if-just-one-replica-set-and-no-sharding-throughout-lifetime/16902) · mongodb.com forums · question dated 2021-03-03; the answer says ObjectIds from one second have no predictable order and offers a capped collection for strict insertion order, with its restrictions (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 the "not a sequence, not safe to sort for strict ordering across writers" warning — the one official source for it is a forum answer.
- *Checked, not chosen:* slingacademy and leyaa.ai describe ObjectIds as sortable by insertion order — an overstatement; not listed.

### T09 · 🔴 Numbers: `int32`, `int64`, `double`, `Decimal128` — Master · ✅ `…/04-numbers.md`
- **Read this:** [Model Monetary Data](https://www.mongodb.com/docs/manual/tutorial/model-monetary-data/) · mongodb.com · binary floating point cannot represent exact decimal fractions, so it is unsuitable for monetary arithmetic (*read*); the numeric model (Decimal BSON type, or a scale factor) vs the non-numeric model · covers our angle: **partial** — money yes; "why JavaScript hands you doubles by default" is not covered · fetched 2026-10-12
- **Also good:** [How to Store Money in MongoDB: Decimal128 vs Integer Cents](https://techearl.com/store-money-mongodb) · techearl.com · 2026-05-30, ≈3.3k words; sections "Why you must never use a double", "The NumberDecimal("string") gotcha", "Keep doubles out of the application and the drivers too" — matches the Node angle; I read the gotcha section (pass a string to `NumberDecimal`, never a numeric literal, since a literal is already a double) and the driver advice (JS numbers are all IEEE 754 doubles, so build `Decimal128` with `fromString` from the bson package; integer cents are safe only up to `Number.MAX_SAFE_INTEGER`) (*read*) — covers the "JavaScript hands you doubles" half of the angle · fetched 2026-10-12 · anchors `#the-numberdecimalstring-gotcha`, `#keep-doubles-out-of-the-application-and-the-drivers-too` verified as heading ids
- **Also good:** [NODE-4948 (Node driver Jira)](https://jira.mongodb.org/browse/NODE-4948) · jira.mongodb.org · a Jira task in the Node driver project (user-story format, labelled node-internal): JS numbers that are integers within int32 range are serialized as int32, so an arithmetic result like 1.7 + 0.3 can be stored as int32; always using doubles would raise storage (*read*) — a ticket (unresolved, no fix version), not an explainer; behaviour in your driver version is not confirmed · fetched 2026-10-12
- **Our delta:** the full Node serialization rule (int32 vs double vs int64 for a JS number) is stated by no official guide I found; the Jira ticket is the closest primary source.
- *Checked, not chosen:* a web search for an official driver doc on this rule found none; NODE-3123 (promoteValues is poorly documented) appeared in results but was not opened.

### T10 · Dates vs Timestamps — Master · ✅ `…/05-dates-vs-timestamps.md`
- **Read this:** [MongoDB BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/) · mongodb.com · the Timestamps section (internal type, 64 bits: 32-bit seconds + counter, "use the BSON date type" for applications) and the Date section (64-bit signed ms since the epoch, the spec calls it UTC datetime) (*read*) · covers our angle: **partial** — "time zones and storage" beyond UTC not covered · fetched 2026-10-12
- **Also good:** [Date() and Datetime (mongosh method)](https://www.mongodb.com/docs/manual/reference/method/date/) · mongodb.com · constructing dates in mongosh; repeats that the spec's Date holds a UTC datetime as 64-bit milliseconds since the epoch (*read*) — but it calls that integer *unsigned*, while the BSON Types page and bsonspec.org say signed/int64, so cite the latter · covers our angle: **partial** — UTC storage only; no time-zone handling guidance found on either page · fetched 2026-10-12
- **Also good:** [Why MongoDB Dates Display in UTC and How to Model Local Dates Correctly](https://itime.day/articles/mongodb-date-utc) · itime.day · 2026-06-29, modified 2026-07-12, ≈890 words; a BSON Date is a signed 64-bit millisecond count identifying an instant with no zone name stored, display zone is the client's job, and a birthday-style calendar date should not be forced into UTC midnight (*read*) — fills the "time zones and storage" gap; third-party site, not official · fetched 2026-10-12

### T11 · Arrays as a first-class type — Master · ✅ `…/06-arrays.md`
- **Read this (1/2):** [Query an Array](https://www.mongodb.com/docs/manual/tutorial/query-arrays/) · mongodb.com · ≈1.3k words: exact-array match is order-sensitive, `$all` ignores order, a bare value matches if any element equals it, and `$elemMatch` is needed so one element meets all conditions (*read*) · covers our angle: **partial** — how arrays are queried, not why an array is not a join table · fetched 2026-10-12
- **Read this (2/2):** [Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/) · mongodb.com · indexing an array field makes it multikey automatically, with one index entry per distinct array value, each pointing back to the same document; unique multikey allows repeats within one document (*read*) · covers our angle: full for "what indexing one implies" · fetched 2026-10-12
- **Our delta:** "an array field is not a join table" — nobody I opened argues it.
