---
title: "1 · The shape of it"
sidebar_label: "1 · The shape of it"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [`IDBDatabase`](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase), [`IDBTransaction`](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction), [`IDBObjectStore`](https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore), [`IDBRequest`](https://developer.mozilla.org/en-US/docs/Web/API/IDBRequest), [`IDBKeyRange`](https://developer.mozilla.org/en-US/docs/Web/API/IDBKeyRange), [Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). Documentation-validated; **no timings**.

**IndexedDB is the browser's real database**: asynchronous, transactional, indexed, and able
to store structured values rather than strings. It is what you reach for when web storage
runs out of road — which happens sooner than people expect
([10 · 01](../10-web-storage/01-the-api-and-what-it-costs.md)).

| | `localStorage` | IndexedDB |
|---|---|---|
| Values | **strings only** | anything the **structured clone algorithm** takes |
| API | **synchronous**, blocks the main thread | asynchronous, event-based |
| In workers | ❌ absent | ✅ available |
| Size | a few MB, and `setItem` **throws** | quota-managed, far larger |
| Querying | by key only | keys, **indexes**, ranges, cursors |
| Transactions | none | **yes, with rollback** |

🔴 **The single reason it exists: `localStorage` is synchronous and cannot be used from a
worker.** Everything awkward about IndexedDB's API follows from being asynchronous and
transactional instead.

## The vocabulary, once

```
database ──▶ object store ──▶ record { key, value }
                  └─▶ index ──▶ lookup by some other property
```

- **Database** — named, versioned, **scoped to the origin** ([14 · 01](../14-same-origin-and-postmessage/01-what-an-origin-is.md)).
- **Object store** — the table equivalent. "Whenever a value is stored in an object store, it
  is associated with a key."
- **Index** — a second lookup path into the same records, optionally unique.
- **Transaction** — every read and write happens inside one.
- **Request** — every operation returns an `IDBRequest` that fires `success` or `error`.

## Opening, and the version that runs your migrations

```js
const request = indexedDB.open("shop", 3);

request.onupgradeneeded = (e) => {
  const db = e.target.result;
  const store = db.createObjectStore("orders", { keyPath: "id" });
  store.createIndex("by_customer", "customerId", { unique: false });
  store.createIndex("by_email", "email", { unique: true });
};

request.onsuccess = (e) => use(e.target.result);
request.onerror   = (e) => fail(e.target.error);
request.onblocked = () => warn("Close other tabs with this site open");
```

🔴 **`onupgradeneeded` is "the only place where you can alter the structure of the
database".** Object stores and indexes cannot be created or removed anywhere else — so the
schema is a versioned migration script, and the version number is the migration id.

⚠️ **`onblocked` is the multi-tab case, and it is not rare.** Opening with a higher version
while another tab holds the old one fires `blocked` "until they are closed or reloaded". Any
app that ships a schema change needs to handle it — usually by listening for `versionchange`
on the old connection and closing it:

```js
db.onversionchange = () => { db.close(); showReloadPrompt(); };
```

**Keys come from one of two places**, and you pick per store:

```js
db.createObjectStore("customers", { keyPath: "ssn" });      // key lives in the value
db.createObjectStore("names",     { autoIncrement: true }); // key generated
```

## Transactions — the part that surprises everyone

```js
const tx = db.transaction(["orders"], "readwrite");
const store = tx.objectStore("orders");

store.add(order);                       // returns an IDBRequest
tx.oncomplete = () => refresh();
tx.onerror    = (e) => report(e.target.error);
tx.onabort    = () => rollbackUi();
```

**Three modes:** `readonly` (the default), `readwrite`, and `versionchange` — the last only
inside an upgrade. MDN: "To make changes to an existing object store, the transaction must be
in `readwrite` mode."

🔴 **A transaction dies the moment you return to the event loop without using it.**

> "Transactions are tied very closely to the event loop. If you make a transaction and return
> to the event loop without using it then the transaction will become inactive. The only way
> to keep the transaction active is to make a request on it."

**That is the rule behind the single most common IndexedDB bug**, and it is why mixing
`await` of something *else* into a transaction fails:

```js
const tx = db.transaction("orders", "readwrite");
const data = await fetch("/orders").then((r) => r.json());   // ❌ tx is dead by now
tx.objectStore("orders").put(data);                          // TransactionInactiveError
```

**Fetch first, then open the transaction.** A transaction is not a scope you hold open across
async work — it stays alive only while requests keep chaining onto it, and it
**auto-commits** when they stop.

⚠️ **There is no `commit()` you must call** (though `tx.commit()` exists to end one early).
Success is `oncomplete`; anything else means it did not happen.

**Rollback is real and automatic:** "If you don't handle an error event or if you call
`abort()` on the transaction, then the transaction is rolled back and an `abort` event is
fired." Multi-store writes are therefore genuinely atomic — pass several store names to
`db.transaction([...])` and either all of it lands or none.

## Reading

```js
const store = db.transaction("orders").objectStore("orders");

store.get("order-1").onsuccess = (e) => use(e.target.result);   // undefined if absent
store.getAll(IDBKeyRange.bound("a", "b")).onsuccess = …;        // whole array
store.index("by_customer").getAll(customerId).onsuccess = …;    // via an index
```

**Cursors are for walking large sets without materialising them:**

```js
store.openCursor(IDBKeyRange.lowerBound(cutoff), "prev").onsuccess = (e) => {
  const cursor = e.target.result;
  if (!cursor) return done();
  handle(cursor.value);
  cursor.continue();          // ⚠️ the loop; forgetting it stops after one record
};
```

**Directions are `"next"` (default), `"prev"`, `"nextunique"` and `"prevunique"`.** Key
ranges come from `IDBKeyRange.only`, `.lowerBound`, `.upperBound` and `.bound`, each taking
an optional flag to make the bound exclusive:

```js
IDBKeyRange.bound("Bill", "Donna", false, true);   // [Bill, Donna)
```

⚠️ **`get` resolves to `undefined` for a missing record — it is not an error.** Checking
`request.error` will not tell you the row was absent.

⚠️ **Keys are ordered by IndexedDB's own key ordering**, not by `<`. Valid keys are numbers,
strings, dates, binary and arrays of those — **not booleans, not `null`, not plain objects**,
which is a different and narrower set than what a *value* may contain.

## What a value may be

**Values go through the structured clone algorithm** — the same one behind `postMessage` and
`structuredClone()` ([Phase 5 · 21](../../phase-5-built-in-library/21-structuredclone.md)) —
so objects, arrays, `Date`, `Map`, `Set`, typed arrays, `Blob` and `File` all survive, and
functions, DOM nodes and class prototypes do not.

🔴 **`Blob` and `File` storing directly is the feature that matters.** An offline app keeps
images and attachments in IndexedDB as blobs rather than base64 strings, with none of the
~33% overhead ([Phase 5 · 26 · 02](../../phase-5-built-in-library/26-text-encoding/02-base64.md)).

## Quota and eviction — it is not permanent storage

**IndexedDB is quota-managed**, and the quota is per origin and browser-determined. Two
things follow, and both belong in the design rather than in a comment:

- **A write can fail because there is no room.** Handle `QuotaExceededError` on the request,
  the same way `localStorage`'s `setItem` must be wrapped.
- 🔴 **Data can be evicted under storage pressure.** Treat everything in IndexedDB as a
  **cache that may be gone**, not as a store of record — the server keeps the truth, and
  `navigator.storage.persist()` is a *request*, not a guarantee.

## Gotchas

**Symptom → cause → fix.**

- **`TransactionInactiveError`** → the transaction returned to the event loop without a
  pending request, usually because of an `await` on unrelated work → do the async work first,
  then open the transaction.
- **Writes silently do nothing** → the transaction was `readonly` (the default) → pass
  `"readwrite"`.
- **`createObjectStore` throws** → called outside `onupgradeneeded` → bump the version and do
  it there.
- **The app hangs on a schema change for some users** → another tab holds the old version and
  `onblocked` fired → close on `versionchange` and prompt for a reload.
- **A cursor handles one record and stops** → `cursor.continue()` was not called → call it.
- **`get` returns `undefined` and no error fires** → that is a missing record, not a failure →
  check the result, not `error`.
- **A boolean or object key is rejected** → not a valid key type → use a number, string, date,
  binary or array; store the flag in the value.
- **Everything works until a device fills up** → `QuotaExceededError` unhandled, or the data
  was evicted → handle the error, and treat the store as a cache.
- **The API is unbearable** → it is; it predates promises → wrap it, or use a thin library
  (`idb` is the usual choice) that returns promises over the same primitives.

## Interview questions

**Why does IndexedDB exist when `localStorage` is so much simpler?** Because `localStorage` is
synchronous, string-only, small, and absent from workers. IndexedDB is asynchronous,
transactional, indexed, worker-available, and stores anything the structured clone algorithm
accepts — including `Blob`s.

**Where can the schema be changed?** Only inside `onupgradeneeded`, which runs when the
version number increases. The schema is effectively a versioned migration.

**Why does an `await` inside a transaction break it?** Transactions are tied to the event
loop: returning to it without a pending request makes the transaction inactive, and it then
auto-commits. Any unrelated asynchronous work must happen before the transaction is opened.

**How does IndexedDB handle failure?** An unhandled request error, or an explicit `abort()`,
rolls the whole transaction back and fires `abort`. Success is `oncomplete` on the
transaction, not `onsuccess` on the individual request.

**What can be a key, and what can be a value?** Keys: numbers, strings, dates, binary and
arrays of those. Values: anything structured-cloneable — a much wider set, including `Map`,
`Set`, typed arrays and `Blob`.

**Is data in IndexedDB permanent?** No. It is quota-limited and evictable under storage
pressure; `navigator.storage.persist()` only requests better treatment. Treat it as a cache
whose source of truth is the server.

---

← [Overview](./README.md) · [Phase 11](../README.md)
