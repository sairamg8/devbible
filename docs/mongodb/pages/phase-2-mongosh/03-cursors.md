---
title: "Cursors"
sidebar_label: "03 · Cursors"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Iterate a Cursor in mongosh](https://www.mongodb.com/docs/manual/tutorial/iterate-a-cursor/):
> `find()` returns a **cursor**; *"by default, mongosh displays 20 documents per cursor
> iteration"*, adjustable with `config.set("displayBatchSize", <number>)`; a cursor assigned
> with `let` does **not** auto-iterate while an unassigned one does; and the iteration methods
> `next()`, `hasNext()`, `forEach()`, `toArray()` — with `toArray()` documented as loading all
> documents **into RAM** — plus `for-of` support from mongosh 2.1.0.
> ⚠️ The pages consulted do **not** document the `it` continuation, a first-batch size, or a
> cursor idle timeout, so this page does not state values for those.
> **Documentation-validated; no console blocks.**

**`find()` does not return your documents. It returns a cursor** — a handle to a result set
the server is holding, which produces documents as you ask for them. Nearly every surprising
thing about reading data in MongoDB follows from that one fact.

## What the shell shows you is not the result

```js
db.orders.find({ status: "open" });
```

The shell prints a batch and stops. **The default is 20 documents per cursor iteration**, and
the number is configurable:

```js
config.set("displayBatchSize", 50);
```

So the screen shows a window onto the result, not the result. Two consequences people trip
over:

- **The count on screen is not the count.** Use `countDocuments()` when you want a number.
- **Nothing is "the last 20".** It is the first batch the cursor produced, in whatever order
  the plan supplied — which is not a guaranteed order unless you asked for one with `sort()`.

⚠️ **Assigning with `let` changes the behaviour.** An unassigned cursor auto-iterates and
prints; one assigned with `let` does not — it sits there until you iterate it. That is exactly
what you want in a script, and it surprises people who expected output.

```js
let cursor = db.orders.find({ status: "open" });   // nothing printed
cursor.hasNext();                                   // now you drive it
```

## Driving a cursor

| Method | What it does | When |
|---|---|---|
| `hasNext()` / `next()` | manual, one document at a time | precise control, early exit |
| `forEach(fn)` | applies a function to each document | the default for scripts |
| `toArray()` | **loads every document into RAM** | small, bounded results only |
| `for…of` | ordinary JavaScript iteration (mongosh 2.1.0+) | readable loops |

🔴 **`toArray()` is the one that hurts.** The Manual is explicit that it loads all documents
into RAM. On a collection of any size that is a memory spike at best and a dead shell at worst
— and the equivalent in application code is the same mistake with the same result on your API
server. **Stream with `forEach` or `for…of` unless you know the result is small.**

## Shaping the result before it is produced

These are cursor methods, and they are sent to the server as part of the query — they are not
client-side filtering:

```js
db.orders.find({ status: "open" })
  .sort({ createdAt: -1 })
  .skip(20)
  .limit(10)
  .project({ _id: 0, total: 1, createdAt: 1 });
```

Two things worth knowing:

- **`limit()` genuinely limits work**, letting the plan stop early. It is not a `slice` of a
  full result.
- **`skip()` does not.** The server still walks past the skipped documents, so deep pagination
  gets linearly slower — the same trap as `OFFSET` in SQL. **Paginate by range instead**
  (`{createdAt: {$lt: lastSeen}}` plus `limit`), which uses the index and stays flat.

**Projection is a real saving.** Fewer fields is less to read, less to send and less to parse
— and if every field you asked for is in the index, the query can be covered and skip the
documents entirely ([topic 04](./04-explain.md)).

## A cursor is a live thing on the server

A cursor is server-side state that exists while you consume it. Three practical consequences:

- **The result is not a snapshot.** Documents changing while you iterate can be seen in their
  new state; a document can be missed or seen twice if the write moves it. For a consistent
  view of a moving collection, sort by a stable field like `_id`, or read inside a transaction.
- **An abandoned cursor holds resources** until the server cleans it up — which is why leaving
  half-consumed cursors around in application code shows up as server-side memory rather than
  as an application bug.
- **A long-running iteration is a long-running operation**, visible in `db.currentOp()`
  ([topic 05](./05-shell-safety.md)).

## Counting

```js
db.orders.countDocuments({ status: "open" });   // accurate; runs the query
db.orders.estimatedDocumentCount();             // fast; whole collection, from metadata
```

`countDocuments()` takes a filter and gives a true count. `estimatedDocumentCount()` takes no
filter and reads collection metadata — instant, and suitable for "roughly how big is this",
not for a number anyone will act on.

## Gotchas

**Symptom:** a query "returns 20 documents" when the collection clearly has more.
**Cause:** that is the shell's display batch, not the result size.
**Fix:** `countDocuments()` for a number; iterate for the rest; `displayBatchSize` if you
genuinely want a bigger window.

**Symptom:** assigning a cursor to a variable prints nothing.
**Cause:** a cursor assigned with `let` does not auto-iterate — documented behaviour.
**Fix:** iterate it. This is what you want in scripts.

**Symptom:** the shell or a Node process runs out of memory on a large query.
**Cause:** `toArray()`, which loads every document into RAM.
**Fix:** `forEach` or `for…of`, and a projection so each document is smaller.

**Symptom:** page 500 of a paginated list takes seconds while page 1 is instant.
**Cause:** `skip()` walks past every skipped document.
**Fix:** range pagination on an indexed, sortable field with `limit`.

**Symptom:** iterating a large result sees a document twice, or misses one.
**Cause:** the collection is being written to while the cursor is open; a cursor is not a
snapshot.
**Fix:** sort by `_id`, or read inside a transaction if the consistency actually matters.

**Symptom:** the first documents differ between runs of the same query.
**Cause:** no `sort()` — there is no default order.
**Fix:** sort explicitly whenever order matters, including for "just show me a few".

## Interview questions

**★ What does `find()` return?**
A cursor — a handle to a result set the server holds — not the documents. The shell
auto-iterates an unassigned cursor and displays 20 documents per iteration by default, which is
a window onto the result rather than the result. A cursor assigned with `let` does not
auto-iterate at all.

**★ Why is `toArray()` dangerous?**
Because it loads every matching document into RAM, as the Manual states. On a large result that
is a memory spike in the shell, or in an API process the same mistake with worse consequences.
Streaming with `forEach` or `for…of` processes one document at a time and keeps memory flat.

**★ Why is `skip()` a bad way to paginate deeply?**
Because the server still traverses the skipped documents, so cost grows linearly with the page
number — page 500 does five hundred pages' worth of work. Range pagination on an indexed field
(`{createdAt: {$lt: lastSeen}}` with a `limit`) uses the index and stays flat regardless of
depth. `limit()`, unlike `skip()`, genuinely reduces the work done.

**★ Is a cursor a snapshot of the data?**
No. It is live server-side state, and documents can change while you iterate — so a document
may be seen twice or missed if a write moves it. Sorting by a stable field such as `_id`, or
reading inside a transaction, is what you do when that matters.

**What is the difference between `countDocuments()` and `estimatedDocumentCount()`?**
`countDocuments()` accepts a filter and runs a real query, so it is accurate and costs what the
query costs. `estimatedDocumentCount()` reads collection metadata, takes no filter, and is
effectively instant — good for a rough size, not for a number that drives a decision.

**Why might the same query show different documents first on two runs?**
Because there is no default ordering. Without an explicit `sort()`, the order is whatever the
plan produced, and that can change with the plan, the data or the indexes.

---

← Prev: [Navigating](./02-navigating.md) ·
Index: [Phase 2](./README.md) ·
Next → [`explain()` from the shell](./04-explain.md)
