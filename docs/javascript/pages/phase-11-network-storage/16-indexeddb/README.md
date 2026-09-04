---
title: "16 · IndexedDB"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). Documentation-validated; **no timings**.

**IndexedDB is the browser's transactional, indexed, asynchronous database** — the answer
when `localStorage` runs out of size, types, or the ability to run off the main thread.

🔴 **Know-tier: the goal is to recognise its shape and its two traps**, not to memorise the
API. The traps are that **the schema can only change inside `onupgradeneeded`**, and that **a
transaction goes inactive the moment you return to the event loop without a pending
request** — which is why an unrelated `await` inside one breaks it.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The shape of it](./01-the-shape-of-it.md)** | Why it exists next to web storage; databases, object stores, indexes, requests; opening with a version and running migrations in `onupgradeneeded`; the multi-tab `blocked`/`versionchange` case; 🔴 **transaction lifetime and auto-commit**; reads, cursors and key ranges; what may be a key and what may be a value; and quota and eviction |

## The shape in twelve lines

```js
const req = indexedDB.open("shop", 1);

req.onupgradeneeded = (e) => {                        // the ONLY place schema changes
  const store = e.target.result.createObjectStore("orders", { keyPath: "id" });
  store.createIndex("by_customer", "customerId");
};

req.onsuccess = (e) => {
  const tx = e.target.result.transaction("orders", "readwrite");
  tx.objectStore("orders").put({ id: "a1", customerId: 7 });
  tx.oncomplete = () => console.log("committed");     // success is here, not on the request
};
```

## Phase gate

You are done with this topic when you can say **why an `await` inside a transaction throws
`TransactionInactiveError`**, and **where a schema change is allowed to happen**.

## Where this connects

- [10 · `localStorage` and `sessionStorage`](../10-web-storage/README.md) — the small synchronous alternative, and why it is not enough
- [12 · `Blob`, `File` and object URLs](../12-blob-file-filereader/README.md) — blobs are stored directly, with no base64
- [Phase 5 · 21 · `structuredClone`](../../phase-5-built-in-library/21-structuredclone.md) — the algorithm that decides what a value may be
- **17 · Service workers and the Cache API** *(next in this phase)* — the other half of an offline app

---

Start → [1 · The shape of it](./01-the-shape-of-it.md)
