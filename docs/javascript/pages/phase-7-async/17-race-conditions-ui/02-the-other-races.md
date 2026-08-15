---
title: "02 · The other UI races"
sidebar_label: "02 · The other races"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`EventTarget.addEventListener()` § signal](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`ETag`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag), [`If-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Match), [412 Precondition Failed](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/412), [`HTMLButtonElement.disabled`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement) — and [RFC 9110 § Conditional requests](https://www.rfc-editor.org/rfc/rfc9110#section-13). Documentation-validated; **no timings, no console blocks**.

The stale response ([01](./01-the-stale-response.md)) is the famous one. Four more show up just
as often, and each has a different fix — which is why "add a debounce" is not a strategy.

## Double submit

```js
button.addEventListener('click', async () => {
  await createOrder(cart);      // ❌ a second click during the await creates a second order
});
```

The user clicks twice — impatiently, or because the first click gave no feedback. Two orders.

**Disabling the button is necessary and not sufficient.** It is the right *feedback*, but the
handler can still be entered from a keyboard `Enter`, a form submit, a re-render that resets the
attribute, or a test harness. Guard the operation, not just the control:

```js
let pending = null;

button.addEventListener('click', () => {
  pending ??= createOrder(cart).finally(() => { pending = null; });   // 🔴 single-flight
  return pending;
});
```

**Single-flight** — the second click joins the first promise instead of starting a second
operation — is the same in-flight deduplication as
[16 · The bounded pool](../16-concurrency-limiting/02-the-bounded-pool.md), applied to a button.
Combine it with `button.disabled = true` for the visible half.

⚠️ **For anything that spends money, the client-side guard is not the last line of defence.** A
retry, a flaky connection or a refreshed tab can still produce a duplicate; the server must
deduplicate on an idempotency key
([15 · What is safe to retry](../15-timeouts-retries-backoff/01-what-is-safe-to-retry.md)).

## Writing to something that is gone

```js
async function load(el) {
  const data = await fetchThing();
  el.textContent = data.title;     // ❌ el may have been removed while we waited
}
```

The user navigated, the modal closed, the row was deleted. The write either throws, or silently
mutates a detached node that nothing will ever render — and, worse, keeps that node and its
subtree alive
([Phase 8 · 04 · The four leaks](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md)).

**The scope's `AbortSignal` answers this, and it is the same one that cancels the request:**

```js
async function load(el, { signal }) {
  const data = await fetchThing({ signal });
  signal.throwIfAborted();          // ✅ the scope is gone; do not write
  el.textContent = data.title;
}
```

One controller per view, aborted in teardown, checked after every `await`
([14 · The model](../14-cancellation/01-the-model.md)). A framework's cleanup hook is the place
to call `abort()`; the discipline is identical with or without one.

## Optimistic updates that land out of order

Optimistic UI shows the result before the server confirms it. The race is in the *rollback*:

```js
toggleLike(id, true);                       // paint immediately
await api.like(id).catch(() => toggleLike(id, false));   // ❌ undo, based on stale knowledge
```

Click like, unlike, like — three requests, three rollbacks, arriving in any order. A rollback
from the *first* request can undo the state set by the *third*.

**Do not roll back to a remembered value. Reconcile against the latest intent:**

```js
let intent = 0;                                  // a version for this one item

async function setLike(id, want) {
  const v = ++intent;
  paint(want);
  try {
    await api.like(id, want);
  } catch {
    if (v === intent) paint(!want);              // only the newest attempt may correct the UI
  }
}
```

🔴 **The general rule: a response may only write state if it is still the newest request for
that state.** It is the sequence guard from [01](./01-the-stale-response.md), applied per item
rather than per screen.

## Two users, one record — the lost update

Two people open the same record, both edit, both save. The second save silently overwrites the
first, and neither is told.

**Last-write-wins is a decision, not a default** — and if you make it deliberately, say so in
the UI. The alternative is a conditional request, which HTTP has had all along:

```js
const res = await fetch(`/docs/${id}`, {
  method: 'PUT',
  headers: { 'If-Match': etag },        // the ETag from the GET
  body: JSON.stringify(doc),
});
if (res.status === 412) return showConflict();   // someone else changed it first
```

| Strategy | What the user sees |
|---|---|
| Last-write-wins | nothing — the other edit vanishes |
| **`If-Match` + ETag** | a **412**, and a conflict dialogue you can build a merge on |
| Field-level merge | only genuinely conflicting fields are contested |

`ETag` and `If-Match` are the standard mechanism; RFC 9110 defines the conditional-request
semantics and **412 Precondition Failed** is the response when the record moved on.

## Ordering writes that must not overlap

Some sequences are simply not safe to interleave — a create followed by an update to what it
created, or a sequence of PATCHes to one record. Concurrency is the bug here, not the fix.

**Serialise per key**, chaining onto the previous promise for that key:

```js
const chains = new Map();

function queue(key, task) {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(task);      // 🔴 a failure must not break the chain
  chains.set(key, next);
  next.finally(() => { if (chains.get(key) === next) chains.delete(key); });
  return next;
}
```

Different keys still run concurrently; the same key runs in order. The `catch(() => {})` before
`then` is load-bearing — without it, one failed write stops every later write to that key.

## Gotchas

**Symptom: two orders created from one impatient user.**
Cause — the handler was re-entered during the `await`; a disabled button is not a lock.
Fix — single-flight the operation, and deduplicate server-side on an idempotency key.

**Symptom: an error is thrown writing to a DOM node after navigation.**
Cause — the write happened after the scope was torn down.
Fix — check the scope's signal after every `await`, and abort it in teardown.

**Symptom: a "like" toggles back on its own a second after the user set it.**
Cause — a rollback from a superseded request undid the newest state.
Fix — version the intent per item; only the newest attempt may correct the UI.

**Symptom: one user's edits silently disappear.**
Cause — last-write-wins with no conflict detection.
Fix — `If-Match` with the ETag; handle **412** as a conflict the user can resolve.

**Symptom: an update lands before the create it depends on.**
Cause — independent requests to the same record ran concurrently.
Fix — serialise per key by chaining onto the previous promise.

**Symptom: after one failed save, no further saves to that record go through.**
Cause — the per-key chain was left in a rejected state.
Fix — `prev.catch(() => {})` before chaining the next task.

**Symptom: memory grows on a long-lived page that serialises per key.**
Cause — the chain map is never pruned.
Fix — delete the entry in `finally` when it is still the current tail.

## Interview questions

**★ Why is disabling the submit button not enough?**
Because it guards the control, not the operation — keyboard submits, re-renders that reset the
attribute and programmatic calls all get past it. Single-flight the promise, and have the server
deduplicate on an idempotency key.

**★ A component writes state after it has been torn down. What is the fix?**
Give the scope an `AbortController`, abort it in teardown, pass the signal into the request and
check it after every `await` before writing.

**★ How do optimistic updates go wrong?**
The rollback races. A failure from an older request can undo state set by a newer one. Version
the intent and let only the newest attempt correct the UI.

**★ Two users save the same record. What does the second save do?**
By default it overwrites the first — a lost update. Send `If-Match` with the ETag from the read;
the server answers **412 Precondition Failed** and you can show a conflict instead.

**★ How do you stop two writes to the same record interleaving?**
Serialise per key: keep the last promise for that key and chain the next task onto it, catching
first so one failure does not break the chain. Different keys stay concurrent.

**★ What is the single sentence that covers all of these?**
A response may only write shared state if it is still the newest request for that state — and if
the scope it belongs to is still alive.

---

← [01 · The stale response](./01-the-stale-response.md) · [Topic index](./README.md)
