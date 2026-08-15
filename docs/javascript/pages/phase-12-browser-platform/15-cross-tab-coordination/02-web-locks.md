---
title: "02 · Web Locks"
sidebar_label: "02 · Web Locks"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [`LockManager.request()`](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request), [`LockManager.query()`](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/query), [`Lock`](https://developer.mozilla.org/en-US/docs/Web/API/Lock) — and the [Web Locks API specification](https://w3c.github.io/web-locks/). Documentation-validated; **no timings and no console output**.

[01 · The channels](./01-the-channels.md) covered telling the other tabs. This is the harder half:
**deciding which tab acts.** Five tabs open, one token to refresh, one migration to run, one
WebSocket worth keeping — broadcasting solves none of them, because every tab broadcasts at the
same instant.

## The API in one shape

```js
await navigator.locks.request('refresh-token', async (lock) => {
  // 🔴 nothing else in this ORIGIN — any tab, any worker — holds 'refresh-token'
  // while this callback is running.
  await doTheThing();
});                                     // released the moment the callback settles
```

`navigator.locks.request(name, options?, callback)` returns a promise that **resolves with the
callback's return value, after the lock has been released**. There is no `unlock()` to forget and
no `finally` to write: the lock's lifetime *is* the callback's lifetime, and it is released whether
the callback returns or throws.

| Option | Default | What it does |
|---|---|---|
| `mode: 'exclusive'` | ✅ default | one holder at a time |
| `mode: 'shared'` | | many readers together, but no exclusive holder alongside them |
| `ifAvailable: true` | `false` | 🔴 do **not** queue — the callback is invoked with **`null`** if the lock is held |
| `steal: true` | `false` | ⚠️ release whoever holds it and take it, preempting the queue |
| `signal` | — | an `AbortSignal`; if it fires before the grant, the request is dropped and the promise rejects with **`AbortError`** |

The `lock` argument the callback receives carries just `name` and `mode` — the object is the grant,
not a handle you operate.

## The three properties that make it the right tool

**It is origin-wide.** The lock manager belongs to the storage bucket, so pages and workers of the
same origin share it *"even if they are in unrelated browsing contexts"*. Tabs, iframes, dedicated
workers, shared workers, the service worker — one queue. And the spec requires that *"locks do not
span origins"*, so the boundary is exactly the one you would expect.

🔴 **It cannot leak.** The spec terminates an agent's locks when the agent goes away — close the
tab, navigate away, crash the renderer, and the lock is released for the next waiter. **This is the
whole argument against a `localStorage` "isRefreshing" flag:** a flag survives the crash that set
it and wedges every other tab forever, with no way to tell "held" from "abandoned".

**It is fair.** Requests queue and *"only the first item in a queue is grantable"* — first come,
first served, in request order, with no starvation and no thundering herd when the holder finishes.

⚠️ It is a **secure-context** feature (HTTPS or `localhost`) and available in workers. It is not
persistent: the spec introduces *"no new state for an origin that persists across browsing
sessions"*, so nothing survives a restart — which is correct for a lock and worth saying out loud,
because it is the opposite of what a database lock does.

## The exceptions worth recognising

| Thrown | When |
|---|---|
| `NotSupportedError` | the name starts with `-`, or `steal` and `ifAvailable` are **both** true, or `signal` is combined with either |
| `AbortError` | the `signal` fired before the lock was granted |
| `InvalidStateError` | the document is not fully active |
| `SecurityError` | no lock manager can be obtained for this environment |

The `NotSupportedError` row is the one that surprises people: those option combinations are
**illegal by specification**, not merely discouraged. `steal` and `ifAvailable` contradict each
other, and a `signal` is meaningless when the request is never going to wait.

## `steal`, and why it is a last resort

```js
navigator.locks.request('leader', { steal: true }, async () => { /* I am the leader now */ });
```

`steal` releases the current holder's lock and preempts the queue. ⚠️ **It does not stop the code
that was holding it.** That callback keeps running — now without exclusivity — which is exactly the
double execution the lock existed to prevent. Treat it as a recovery tool for a state you already
know is wedged, never as a coordination primitive. Reaching for it usually means the real bug is a
callback that never settles.

## Inspecting: `query()` is for humans

```js
const { held, pending } = await navigator.locks.query();
// each entry: { name, mode, clientId }
```

`query()` returns a **snapshot** of the manager for this origin, and by the time you read it the
world may have moved on. It is for a debug panel and a bug report — never for a decision.
`if (!held.length) doTheThing()` is a race with no lock in it at all. `clientId` matches the
service worker's `Client.id`, so you can tell *which* context is holding what.

## Deadlock, honestly

The specification carries a non-normative warning that *"deadlocks scoped to a particular lock
manager can be introduced by this API"*. Two tabs, one takes `a` then wants `b`, the other takes
`b` then wants `a` — both queue forever. The mitigations are the textbook ones:

1. **Do not nest locks.** One lock per operation covers nearly every browser use case.
2. If you must nest, **always acquire in the same order**, everywhere, without exception.
3. Put a `signal` timeout on anything that could wait, so a deadlock degrades into a retry.

The consolation is that the blast radius is small: a deadlocked lock manager stalls the code that
uses those locks. The page, the browser and every other script keep running.

## What locks do not do

- **They are cooperative.** A lock only excludes code that *asks* for the same name. Nothing stops
  a tab from writing straight to `localStorage` without asking first.
- **They do not protect storage.** `localStorage` is already synchronous and per-key atomic, and
  IndexedDB has its own transactions. A lock coordinates your *logic* — a read, decide, write
  sequence — not the individual writes.
- **They are one device, one browser profile.** Two devices are two lock managers. Only the server
  can make a claim that covers both.
- **They do not survive a restart**, by design.

⚠️ **Feature-detect** (`'locks' in navigator`) and design the fallback around the fact that you
cannot rebuild this. A `localStorage` flag with a timestamp is the usual substitute and it is
unreliable in precisely the case that matters — a tab that died holding it. So make the *unlocked*
path merely wasteful rather than harmful: an idempotency key on the request means a duplicate
refresh or a duplicate submit is absorbed by the server instead of doubling the order
([13 · What belongs on the server](../13-what-belongs-on-the-server/README.md)).

## Gotchas

**Symptom: every tab hangs waiting for a lock that is never released.**
Cause — the callback returned a promise that never settles (a leader-election lock reused for
ordinary work), or a nested-lock deadlock.
Fix — one lock per operation, a fixed acquisition order, and a `signal` timeout on the wait.

**Symptom: `NotSupportedError` from `request()`.**
Cause — `steal` with `ifAvailable`, a `signal` alongside either, or a name starting with `-`.
Fix — those combinations are illegal by spec; pick one strategy per request.

**Symptom: `navigator.locks` is undefined.**
Cause — an insecure context (plain `http://` on a LAN address), or an engine without support.
Fix — feature-detect, serve over HTTPS, and make the unlocked path idempotent rather than dangerous.

**Symptom: the lock is "held" by a tab the user closed an hour ago.**
Cause — that is not possible with Web Locks; it is a hand-rolled `localStorage` flag.
Fix — this is the bug Web Locks exists to remove.

**Symptom: `query()` says the lock is free, but the request still waits.**
Cause — a snapshot read between the check and the request; another context took it in between.
Fix — never branch on `query()`; request the lock and let the queue answer.

**Symptom: it works between tabs but not between a page and a third-party iframe.**
Cause — the lock manager belongs to the storage bucket, and an embedded frame may be partitioned.
Fix — coordinate through the embedder with `postMessage`, or through the server.

## Interview questions

**★ How do you release a Web Lock?**
You do not. The lock is held for exactly as long as the callback's promise is pending and is
released when it settles, either way. Holding one deliberately means returning a promise that never
resolves.

**★ Why not a `localStorage` flag as a lock?**
Because it outlives the tab that set it. A crash or a closed tab leaves the flag set, every other
tab waits forever, and nothing distinguishes "held" from "abandoned". The spec terminates a Web
Lock with the agent holding it.

**★ What does `ifAvailable` do?**
It asks instead of waiting: the callback runs immediately with `null` when the lock is held, so the
"no" path is a branch rather than a `catch`.

**★ What does `steal` do, and when would you use it?**
It releases the current holder and preempts the queue — but the previous holder's code keeps
running, so two paths can execute at once. It is a recovery tool for a wedged lock, not a
coordination primitive.

**★ Can Web Locks give you exactly-once across tabs?**
No. They serialise within one browser profile on one device, with a handover window when a holder
disappears and no reach to another device. Idempotency on the server is what actually guarantees
it.

**★ How would you deadlock this API, and how do you avoid it?**
Two contexts acquiring two lock names in opposite orders. Avoid it by not nesting locks at all,
acquiring in a consistent order if you must, and giving every wait an `AbortSignal` timeout.

---

← [01 · The channels](./01-the-channels.md) · [Topic index](./README.md) · [03 · The patterns](./03-the-patterns.md) →
