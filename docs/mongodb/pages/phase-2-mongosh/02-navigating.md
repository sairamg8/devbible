---
title: "Navigating"
sidebar_label: "02 · Navigating"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Databases and Collections](https://www.mongodb.com/docs/manual/core/databases-and-collections/):
> *"MongoDB creates the database when you first store data for it"*, *"if a collection does
> not exist, MongoDB creates the collection when you first store data for that collection"*,
> and that both `insertOne()` and `createIndex()` *"create their respective collection if it
> does not already exist"*.
> **Documentation-validated; no console blocks.**

Four commands cover almost all navigation:

```js
show dbs            // databases that hold data
use shop            // select a database — the `db` variable now points at it
db                  // which database am I in?
show collections    // collections in the current database
```

`db` is a JavaScript variable holding a database handle, which is why everything else is a
method call on it: `db.orders.find(...)`, `db.stats()`, `db.getCollectionNames()`.

## Why `use nosuchdb` works

Because **nothing is created until data is stored.** The Manual: *"MongoDB creates the
database when you first store data for it"*, and the same for collections — *"MongoDB creates
the collection when you first store data for that collection"*.

So `use` is a client-side selection, not a server operation. It always succeeds:

```js
use definitely_a_typo        // succeeds
db.orders.find()             // returns nothing — not an error
db.orders.insertOne({ x: 1 })  // NOW the database and the collection exist
```

🔴 **This is the trap.** A typo'd database name gives you an empty result, not an error — so
"the data is gone" is very often "I am in the wrong database". Confirm with `db` before
concluding anything. The same applies to collections: `db.order.find()` (singular) returns
nothing, silently, forever.

⚠️ **`show dbs` only lists databases that contain data**, so the database you just `use`d may
not appear. That is not evidence it failed.

And the counterpart, worth knowing before you paste a script: `createIndex()` also creates
the collection if it does not exist. A typo in an index script does not fail — it creates a
new empty collection with an index on it.

## Guarding against the typo

```js
db.getCollectionNames();                            // exact names, no guessing
db.getCollectionNames().includes("orders");         // a check you can script
db.orders.countDocuments();                         // 0 means empty, and the name was right
```

**Make the check part of the habit** when working on unfamiliar data: list the collections,
then work. It takes a second and removes an entire category of wasted afternoon.

## It is JavaScript, and that is the point

`mongosh` is a JavaScript REPL with a connected driver. Everything is scriptable in place:

```js
// every collection with its document count
db.getCollectionNames().forEach((name) => {
  print(`${name}: ${db.getCollection(name).countDocuments()}`);
});

// a name that is not a valid identifier, or is held in a variable
db.getCollection("orders-2026").findOne();
```

`db.getCollection(name)` is the form to use whenever the name is dynamic or contains a
character that would break `db.name` syntax — a hyphen, a leading digit, a dot.

## Working across databases

```js
const analytics = db.getSiblingDB("analytics");
analytics.events.countDocuments();
```

`getSiblingDB` gives you a handle to another database **without changing `db`**, which makes
it the right tool inside a script — a `use` in the middle of a loop changes state under the
rest of your code.

## Orientation commands worth knowing

| Command | What it tells you |
|---|---|
| `db.stats()` | size, document count and index size for the current database |
| `db.orders.stats()` | the same for one collection, including per-index sizes |
| `db.orders.getIndexes()` | every index — the first thing to check before blaming a query |
| `db.orders.findOne()` | one real document, which is how you learn the actual shape |
| `db.version()` | server version, which decides which features are available |
| `db.currentOp()` | operations running right now ([topic 05](./05-shell-safety.md)) |

🔴 **`db.orders.findOne()` is the most under-used command in MongoDB.** There is no schema to
read, so a single real document tells you more than any amount of guessing — field names,
actual types, whether that array is really an array. Start every investigation with it.

## Gotchas

**Symptom:** a collection "has no data" and the application clearly writes to it.
**Cause:** wrong database, or a mistyped collection name. Both return empty rather than
erroring.
**Fix:** check `db`, then `db.getCollectionNames()`. Never conclude from an empty result alone.

**Symptom:** a database you just created does not appear in `show dbs`.
**Cause:** it holds no data yet, and `show dbs` lists databases that contain data.
**Fix:** insert something, or trust `db` — it is not a failure.

**Symptom:** an index script created a new empty collection.
**Cause:** `createIndex()` creates the collection if it does not exist, exactly like an insert.
**Fix:** check the name; drop the accidental collection. Verify names before running scripts
against production.

**Symptom:** `db.my-collection.find()` is a syntax error.
**Cause:** the hyphen is a minus sign to JavaScript.
**Fix:** `db.getCollection("my-collection").find()`.

**Symptom:** a script behaves differently after a `use` halfway through.
**Cause:** `use` reassigns `db` for everything that follows.
**Fix:** `getSiblingDB` for a second database inside a script, leaving `db` alone.

## Interview questions

**★ Why does `use somedb` succeed for a database that does not exist?**
Because `use` only selects — it is client-side. The Manual is explicit that MongoDB creates a
database when you first store data for it, and creates a collection the same way. So the
database appears on the first insert (or `createIndex`) and not before. The practical
consequence is that a typo'd name gives you an empty result rather than an error, which is one
of the most common reasons someone thinks their data has disappeared.

**★ How do you check you are looking at the right place before concluding data is missing?**
`db` to confirm the database, `db.getCollectionNames()` to see the exact collection names, and
`db.orders.countDocuments()` for a real count. An empty result on its own proves nothing,
because both a wrong database and a mistyped collection return empty silently.

**★ What does `db.getSiblingDB()` do and why prefer it in scripts?**
It returns a handle to another database without changing `db`. In a script, a `use` changes
state for every line after it, so a loop that switches databases quietly changes what the rest
of the code operates on. `getSiblingDB` keeps the effect local.

**Why is `findOne()` the first command to run on unfamiliar data?**
Because there is no schema to read. One real document shows the field names, the actual BSON
types and the real shape — including the cases where a field is sometimes an array or
sometimes a string, which is what [Phase 1](../phase-1-documents-and-bson/README.md) is about.

**How would you list every collection with its document count?**
`db.getCollectionNames().forEach(...)` with `db.getCollection(name).countDocuments()` inside.
`mongosh` is a JavaScript REPL with the driver in scope, so ad-hoc reporting like this needs no
tooling.

---

← Prev: [Connecting](./01-connecting.md) ·
Index: [Phase 2](./README.md) ·
Next → [Cursors](./03-cursors.md)
