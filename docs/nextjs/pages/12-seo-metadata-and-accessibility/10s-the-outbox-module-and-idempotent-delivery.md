---
title: "The outbox store is one module the page and the service worker both import, and the only two things it must get right are minting the key before the first attempt and claiming a record inside the transaction that reads it"
sidebar_label: "10s · The outbox store"
sidebar_position: 28
description: "Opening the IndexedDB outbox, enqueueing with the idempotency key, lease-based claiming that survives a killed context, and migrating queued records across a schema bump."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against MDN [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API),
> [`IDBDatabase.transaction()`](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction) and the
> [Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**A durable queue is only as good as two properties that are almost impossible to retrofit: the
idempotency key must exist before the first network attempt, and exactly one context may be sending
a given record at any moment. Both are decided inside the store module, before any code that knows
what HTTP is. This chunk is that module — the open, the enqueue, and the lease-based claim that
makes a killed tab cost a delay rather than a permanently stuck queue.**

## One module, two execution contexts

The outbox is read by the page, to render pending state, and by the service worker, to drain in the
background. That is one module with one constraint that outranks everything else in the file: **the
moment it references `window`, `document` or anything imported from `next/navigation`, importing it
into the service worker throws at parse time**, and background sync stops being addable later. Keep
it to `indexedDB`, `crypto` and plain data.

```js
// lib/outbox.js — safe to import from a page AND from the service worker.
const DB_NAME = 'sprintdesk-outbox';
const DB_VERSION = 1;
const STORE = 'mutations';

function openOutbox() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('byStatus', 'status');
        store.createIndex('byEntity', ['entity.type', 'entity.id']);
        store.createIndex('byCreatedAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error('outbox upgrade blocked by another open connection'));
  });
}

function settled(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('outbox transaction aborted'));
  });
}

function requested(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

## Enqueue: where the idempotency key is born

Once, here, before anything is attempted. Every later attempt reuses it. This single line is what
makes a duplicate delivery harmless instead of a duplicate row.

```js
// lib/outbox.js, continued
export async function enqueue({ target, headers = {}, body, entity, baseVersion = null }) {
  const record = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    status: 'pending',
    leaseUntil: 0,
    attempts: 0,
    lastError: null,
    target,
    headers,
    body,
    entity,
    baseVersion,
  };
  const db = await openOutbox();
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).add(record);
  await settled(transaction);
  db.close();
  return record;
}
```

`crypto.randomUUID()` requires a secure context, which an installed PWA and a service worker
already are — the same HTTPS requirement the manifest and the worker registration impose, so it
costs nothing new.

Note `add`, not `put`. `add` rejects on a duplicate key; `put` overwrites one. If a UUID ever
collides — or, far more likely, if a bug reuses a record object — you want the failure, not a
silently overwritten pending write.

## Claiming: one transaction, or two drains send the same record

`claimBatch` reads and writes inside a single `readwrite` transaction, so no other connection can
observe a record between the read that selects it and the write that marks it `sending`. It also
reclaims any record whose lease has expired — the only thing standing between you and a queue stuck
behind a context that was killed mid-flight.

```js
// lib/outbox.js, continued
const LEASE_MS = 60_000;

export async function claimBatch(limit = 25, now = Date.now()) {
  const db = await openOutbox();
  const transaction = db.transaction(STORE, 'readwrite');
  const store = transaction.objectStore(STORE);
  const claimed = [];

  await new Promise((resolve, reject) => {
    const cursorRequest = store.index('byCreatedAt').openCursor();
    cursorRequest.onerror = () => reject(cursorRequest.error);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor || claimed.length >= limit) return resolve();
      const record = cursor.value;
      const abandoned = record.status === 'sending' && record.leaseUntil < now;
      if (record.status === 'pending' || abandoned) {
        const leased = { ...record, status: 'sending', leaseUntil: now + LEASE_MS };
        cursor.update(leased);
        claimed.push(leased);
      }
      cursor.continue();
    };
  });

  await settled(transaction);
  db.close();
  return claimed;
}
```

The cursor walks `byCreatedAt`, so records leave the queue in the order the user created them.
That is not cosmetic: two edits to the same field must be applied in the order they were made, and
the default order of an `id`-keyed store is UUID order, which is effectively random.

Releasing is the mirror image, and it is where `attempts` and `lastError` accumulate:

```js
// lib/outbox.js, continued
export async function release(id, { failed = false, error = null } = {}) {
  const db = await openOutbox();
  const transaction = db.transaction(STORE, 'readwrite');
  const store = transaction.objectStore(STORE);
  const record = await requested(store.get(id));
  if (record) {
    store.put({
      ...record,
      status: failed ? 'failed' : 'pending',
      leaseUntil: 0,
      attempts: record.attempts + 1,
      lastError: error ? String(error.message ?? error) : record.lastError,
    });
  }
  await settled(transaction);
  db.close();
}

export async function remove(id) {
  const db = await openOutbox();
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).delete(id);
  await settled(transaction);
  db.close();
}

export async function pendingFor(type, id) {
  const db = await openOutbox();
  const transaction = db.transaction(STORE, 'readonly');
  const rows = await requested(
    transaction.objectStore(STORE).index('byEntity').getAll([type, id]),
  );
  await settled(transaction);
  db.close();
  return rows;
}
```

The delivery half — turning a claimed record into a request, and the drain that ties `claimBatch`,
`release` and `remove` together — is
[10t · Background Sync](10t-background-sync-registering-and-draining.md).

## Gotchas

**★ Symptom: opening the app in a second tab after a schema change hangs forever, with no error in
the console.** Cause: `indexedDB.open` at a higher `DB_VERSION` fires `onupgradeneeded` only once
every other connection to that database has closed. An old tab holding one blocks it indefinitely,
and with no `onblocked` handler the promise simply never settles — no rejection, no timeout. Fix:
always register `onblocked` (as above) so the failure is loud and reportable, and close connections
instead of caching them.

**★ Symptom: after a deploy, the drain sends garbage or throws on records that were queued by the
previous version.** Cause: `onupgradeneeded` created the new indexes but left the *existing records*
in the old shape — a rename from `payload` to `body`, or a newly required `entity`, applies only to
records written after the upgrade. Fix: migrate the rows inside the upgrade transaction, which is
the only place you are guaranteed exclusive access to the store.

```js
request.onupgradeneeded = (event) => {
  const db = request.result;
  if (event.oldVersion < 1) { /* create store and indexes as above */ }
  if (event.oldVersion < 2) {
    const store = request.transaction.objectStore(STORE);
    store.openCursor().onsuccess = (cursorEvent) => {
      const cursor = cursorEvent.target.result;
      if (!cursor) return;
      const old = cursor.value;
      if (old.payload && !old.body) {
        cursor.update({ ...old, body: old.payload, payload: undefined });
      }
      cursor.continue();
    };
  }
};
```

**★ Symptom: records sit in `sending` forever and the queue never drains again.** Cause: whatever
claimed them was terminated mid-flight — the service worker shut down once its event settled, the
tab killed under memory pressure — so nothing ever released the claim. Fix: `leaseUntil`. A status
flag alone is only ever cleared by the code that set it, so a crash deadlocks that record until the
user clears site data. A lease expires by itself, and `claimBatch` reclaims it on the next pass.

**★ Symptom: `pendingFor('task', id)` returns nothing although records for that task plainly
exist.** Cause: a compound index key must be queried with an array in the declared order —
`getAll(['task', taskId])`, not `getAll(taskId)` — and IndexedDB silently omits from a compound
index any record missing *any* part of the key path. A record enqueued without `entity` is invisible
to that index forever. Fix: make `entity` structurally mandatory at the enqueue boundary rather than
trusting call sites.

```js
export async function enqueue(input) {
  if (!input.entity?.type || !input.entity?.id) {
    throw new Error('outbox: entity {type,id} is required for pending-state rendering');
  }
  // …build and store the record as above
}
```

## Interview questions

**★ Why must claiming happen inside the same IndexedDB transaction as the read?**
Because otherwise there is a window between "I read a `pending` record" and "I wrote it back as
`sending`" during which another context can perform the same read and reach the same conclusion.
IndexedDB provides a transaction precisely so that window can be closed: a cursor in a `readwrite`
transaction reads and updates atomically with respect to every other connection. Splitting it across
two transactions reintroduces the race, and it will never reproduce on a fast desktop — it
reproduces on a phone waking two tabs and a service worker at the same moment the network returns,
which is the only situation this code exists for.

**★ What does the lease buy you that a `sending` status alone does not?**
Crash recovery. A boolean in-flight flag is only ever cleared by the code that set it, so if that
context dies — a service worker shut down after its event settled, a tab killed by the OS — the
record stays claimed by a process that no longer exists, and no future drain will look at it again.
A lease inverts the default: the claim expires on its own, so the cost of a crash is a delay rather
than the queue. Its duration is a genuine trade-off, between how long a legitimately slow upload may
run and how long a crash stalls that record.

**★ Why is the idempotency key minted in `enqueue` rather than in the send function?**
Because the case it exists for is "the server committed and the response was lost on the way back".
The client cannot distinguish that from a total failure, so it must retry, and the only thing
preventing the retry from creating a second row is the server recognising it as the same request. A
key minted per attempt makes the second attempt a genuinely different request by every measure the
server has. Minting it once, at the moment the user expressed the intent, makes the key an
identifier of *the intent* rather than of *a network call*.

**How do you change the record shape safely when there are already records in users' queues?**
Inside `onupgradeneeded`, using `request.transaction` — the version-change transaction is the only
point at which you have exclusive access to the store, so it is the only place a migration cannot
race a drain. Gate each step on `event.oldVersion` so a user upgrading across three releases runs
all three migrations in order. The alternative people reach for — migrating lazily in the drain —
means every consumer carries a compatibility branch forever, and the branch is exercised only by
the users you can least afford to break.

**Why `add` rather than `put` when enqueueing?**
Because they differ exactly where it matters: `put` silently overwrites an existing record with the
same key, `add` rejects. In a queue, an overwrite is the destruction of a mutation the user made and
believes is saved. The scenario is not a UUID collision, which is not worth worrying about; it is a
call site that re-enqueues an object it already stored, or a retry path that reuses a record it
should have cloned. `add` turns that into a visible error at the moment it happens.

---

← [10r · The offline write queue](10r-the-offline-write-queue-and-the-durable-outbox.md) · [Chapter 12 overview](01-explanation.md) · Next → [10t · Background Sync](10t-background-sync-registering-and-draining.md)
