---
title: "Shell safety on production"
sidebar_label: "05 · Shell safety"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [`db.collection.updateMany()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.updateMany/):
> the update parameter must be **update-operator expressions or an aggregation pipeline**, a
> plain replacement document is **not permitted** (*"to update with a replacement document,
> see `db.collection.replaceOne()`"*), *"specify an empty document `{ }` to update all
> documents in the collection"*, and `upsert: true` creates a document from the filter and
> update when nothing matches — and
> [`db.currentOp()`](https://www.mongodb.com/docs/manual/reference/method/db.currentOp/):
> in-progress operations with `opid`, `secs_running` / `microsecs_running`, `op`, `ns`,
> `command`, `active` and `waitingForLock`; MongoDB 6.2+ recommends the **`$currentOp`
> aggregation stage** instead, and it is *"not supported in MongoDB Atlas M0 and Flex
> clusters"*.
> ⚠️ Role definitions were not verifiable from the pages consulted, so this page states the
> read-only principle without quoting role privileges.
> **Documentation-validated; no console blocks.**

**`mongosh` has no undo, no transaction wrapper around your session, and no "are you sure?".**
A command runs the moment you press Enter, against whatever database `db` currently points at
— which, as [topic 02](./02-navigating.md) showed, is easy to be wrong about.

## The commands that do not ask twice

| Command | What it does |
|---|---|
| `db.orders.drop()` | deletes the collection and its indexes |
| `db.dropDatabase()` | deletes the current database — **whichever one that is** |
| `db.orders.deleteMany({})` | an empty filter matches everything |
| `db.orders.updateMany({}, {$set: {...}})` | an empty filter updates every document |
| `db.orders.dropIndex(...)` | removes an index; on a large collection, rebuilding is not quick |

🔴 **The empty filter is the recurring shape.** The Manual documents it plainly for
`updateMany` — *"specify an empty document `{ }` to update all documents in the collection"* —
and the same holds for delete. An empty object is not "no filter, so do nothing"; it is "match
everything". A filter variable that ends up `{}` because a lookup returned undefined has the
same effect as typing it deliberately.

⚠️ **`upsert: true` turns a no-match into an insert.** A filter that matches nothing because
it is wrong then *creates* a document built from the filter and the update — so a typo becomes
a new, malformed record rather than a harmless zero-match.

## One protection MongoDB gives you for free

`updateMany` **rejects a plain replacement document**: the update must be update-operator
expressions or an aggregation pipeline, and the Manual points you at `replaceOne()` if
replacement is what you meant. So the catastrophic classic — replacing every document with a
single field — is refused rather than executed.

`updateOne` and `replaceOne` **do** accept a replacement document, and there the risk is real:
a document without `$set` replaces the whole matched document, dropping every field you did
not mention.

**The habit that follows: type the operator first.** `{$set: {...}}` before you type anything
else, so a forgotten `$set` is impossible rather than unlikely.

## The order of operations on production

**1 · Count before you write.** The filter you are about to mutate with is a filter you can
count with:

```js
db.orders.countDocuments({ status: "pending", createdAt: { $lt: cutoff } });
```

If that number is not what you expected, stop. It is the same filter, so the count is exact.

**2 · Read one of them.**

```js
db.orders.findOne({ status: "pending", createdAt: { $lt: cutoff } });
```

Confirms the filter selects the shape of document you think it does.

**3 · Explain the write.**

```js
db.orders.explain("executionStats").updateMany(filter, { $set: { status: "expired" } });
```

Explaining a write does not perform it ([topic 04](./04-explain.md)). It shows the plan and
the scan cost — so a bulk update that would scan the whole collection is caught before it
locks anything up.

**4 · Then run it**, with the filter in a variable that you already counted, rather than
retyped.

## Read-only by default

**Connect to production with a user that cannot write.** It is the only protection that works
when you are tired, and it costs nothing: the read-only session is the one you use for
investigating, and a separate, deliberate connection is what you use to change something.

Two supporting habits:

- **A distinct `appName` per session** ([topic 01](./01-connecting.md)) so your queries are
  identifiable in the logs and in `currentOp`.
- **`readPreference=secondaryPreferred` for investigation**, so a heavy exploratory query does
  not compete with production traffic on the primary — accepting that the data may be slightly
  stale, which for investigation it usually can be.

## When something is already running

```js
db.currentOp();                     // in-progress operations
db.killOp(<opid>);                  // terminate one
```

Useful fields: **`opid`** (what you pass to `killOp`), **`secs_running`** / `microsecs_running`
(how long it has been going), **`op`** (insert, update, query, command), **`ns`** (which
database and collection), **`command`** (the actual operation), **`active`** and
**`waitingForLock`** — the last two separating "this is working" from "this is stuck behind
something else".

Two operational notes from the Manual: **MongoDB 6.2 and later recommend the `$currentOp`
aggregation stage** rather than `db.currentOp()`, and `db.currentOp()` is **not supported on
Atlas M0 and Flex clusters**.

⚠️ **Killing an operation is not free.** A partially applied multi-document write stays
partially applied — atomicity is per document ([Phase 0](../phase-0-how-mongodb-runs/02-single-document-atomicity.md)).
Know what the operation was doing before terminating it, and be ready to reconcile.

## Scripts, and the `--eval` habit

```bash
mongosh "$URI" --eval 'db.orders.countDocuments({status: "pending"})'
mongosh "$URI" --file ./migration.js
```

A file is better than a long `--eval` for anything real: it is reviewable, it is committed, and
it can be run against staging first. **Make destructive scripts print what they would do and
require a flag to actually do it** — a dry-run mode is trivial to write and has stopped more
incidents than any amount of care.

## Gotchas

**Symptom:** an update touched every document in the collection.
**Cause:** an empty filter — often a variable that was `undefined` and became `{}`.
**Fix:** count with the exact filter first; assert the count before writing. Never retype the
filter between the count and the write.

**Symptom:** a document lost most of its fields after an update.
**Cause:** `updateOne`/`replaceOne` with a plain document rather than `$set` — replacement, not
modification.
**Fix:** type the operator first. Note `updateMany` refuses this outright, which is why the
mistake only bites on single-document writes.

**Symptom:** a typo'd filter created a strange new document.
**Cause:** `upsert: true` with a filter that matched nothing.
**Fix:** confirm matches with `countDocuments` before enabling upsert; treat upsert as a write
mode, not a convenience.

**Symptom:** `dropDatabase()` deleted the wrong database.
**Cause:** `db` pointed somewhere other than you thought.
**Fix:** print `db` immediately before. Better, do not hold a writable connection while
exploring.

**Symptom:** an exploratory query slowed down production.
**Cause:** a full scan on the primary.
**Fix:** `readPreference=secondaryPreferred` for investigation, and `explain()` before running
anything expensive.

**Symptom:** `db.currentOp()` is unavailable.
**Cause:** Atlas M0 and Flex clusters do not support it.
**Fix:** use the Atlas UI's monitoring; on 6.2+ prefer the `$currentOp` aggregation stage where
it is available.

## Interview questions

**★ What makes an empty filter dangerous?**
It matches everything. The Manual states it for `updateMany` — an empty document updates all
documents in the collection — and delete behaves the same way. The realistic failure is not
someone typing `{}` on purpose; it is a filter built from a variable that came back undefined,
so the write silently becomes collection-wide. Counting with the exact filter first is what
catches it.

**★ What protection does `updateMany` have that `updateOne` does not?**
`updateMany` rejects a plain replacement document — the update must be update operators or an
aggregation pipeline, and the docs redirect you to `replaceOne` for replacement. `updateOne`
and `replaceOne` accept a replacement document, so a missing `$set` there replaces the whole
document and drops every unmentioned field.

**★ How do you check a bulk update before running it on production?**
Count with the exact filter, read one matching document, then
`explain("executionStats")` the update — explaining a write does not execute it, so you see the
plan and the scan cost first. Then run it with the filter you already counted, held in a
variable rather than retyped.

**★ Why connect to production with a read-only user?**
Because it is the only safeguard that still works when you are tired or in a hurry, and it
costs nothing during investigation, which is most of what you do on production. Writing then
requires a separate, deliberate connection — which is exactly the moment of attention you want.

**Someone reports a query hammering the database. What do you do?**
`db.currentOp()` — or the `$currentOp` aggregation stage, which the Manual recommends from 6.2
— to find it by `ns` and `secs_running`, check `active` and `waitingForLock` to see whether it
is working or blocked, and `db.killOp(opid)` if it must stop. Know what it was doing first: a
killed multi-document write stays partially applied, because atomicity is per document.

**Why set `appName` on your shell connection?**
So the session is identifiable in the server logs and in `currentOp`. During an incident,
being able to say "that expensive query is my shell, not the checkout service" is worth the
five characters it costs.

---

← Prev: [`explain()` from the shell](./04-explain.md) ·
Index: [Phase 2](./README.md) ·
Next → **Phase 3 · Schema design and modelling** *(not written yet)*
