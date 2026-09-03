---
title: "The user tapped Save while offline, and nothing in Next.js will remember it for them — a mutation only survives a closed tab if you wrote it to disk yourself"
sidebar_label: "10r · The offline write queue"
sidebar_position: 27
description: "Why experimental.useOffline's retry loop stops at the tab boundary, what a queued mutation record must actually hold, and why the store has to be IndexedDB."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js [offline support guide](https://nextjs.org/docs/app/guides/offline-support),
> [`useOffline`](https://nextjs.org/docs/app/api-reference/functions/use-offline) and
> [`experimental.useOffline`](https://nextjs.org/docs/app/api-reference/config/next-config-js/useOffline),
> and MDN [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Everything the previous seventeen chunks built — the manifest, the install prompt, the service
worker, the runtime caches, the cache budget — is about the *read* path. It makes an offline app
readable. None of it makes an offline app *writable*. The moment a user taps Save with no network
you own a piece of state that exists nowhere except in a JavaScript variable in one tab, and every
ordinary thing a phone does next — locking, backgrounding the browser, killing the tab to reclaim
memory — destroys it silently. The fix is not a smarter retry, because a retry that lives in the
page dies with the page. The fix is to write the mutation to disk *before* attempting it, and to
treat the network call as a separate, resumable job over a durable queue.**

## Where `experimental.useOffline` stops

Next.js 16 ships a real offline story on the read side, and it is easy to over-read what it
covers. With `experimental.useOffline` enabled the router listens for `offline` and `online`,
detects network failures on navigation, prefetch and Server Action calls, probes connectivity with
a 200 ms-aborted `HEAD` to the current URL carrying the RSC header, and retries blocked requests on
a backoff of 500 ms → 1 s → 2 s → 3 s, capped there, never giving up. That is a genuine retry loop
and it will carry a Server Action through a thirty-second tunnel without the user noticing.

Its documented boundary is exact:

> *"This feature only applies to soft navigations into prefetched routes and Server Action calls from the current page."*

Three words in that sentence do the damage: **from the current page**. The retry queue is in-memory
state belonging to one router instance in one document. It has no persistence layer, and the
documentation claims none.

| What happens next | Does the pending mutation survive? |
|---|---|
| User stays on the page, network returns after four seconds | ✅ retried and delivered |
| User soft-navigates to another *prefetched* route | ✅ same router instance, same queue |
| User hard-reloads, or relaunches from the Home Screen icon | ❌ new document, queue gone |
| iOS discards the backgrounded tab to reclaim memory | ❌ gone, with no event you can catch |
| User closes the tab and the phone is offline for two hours | ❌ gone |
| Device reboots | ❌ gone |

"Never gives up" is a promise about the loop, not about the lifetime of the thing running it. A
loop that never gives up, running inside a process that can be terminated at any moment, composes
to *at most once, and usually not at all*.

The same reasoning kills every homegrown variant. `setTimeout` retries die with the document. A
`beforeunload` handler cannot reliably perform an async fetch and does not fire at all when iOS
kills a backgrounded tab. Holding the payload in React state, in `useOptimistic`, in Zustand or in
a Server Action's closure is the same failure with different syntax: it is memory, and memory is
not a queue.

There is a second, subtler boundary. `useOffline` tells you the *router's* opinion of connectivity —
it is documented to return `true` when *"a network request has failed, or the browser has fired an
`offline` event"*. That is a signal, and a good one for painting a banner. It is not a delivery
guarantee, and no hook can be, because delivery has to outlive the component that called the hook.

## The outbox: what a queued mutation record must hold

An outbox record is not "the arguments to `fetch`". It is everything a *different execution
context, at an unknown later time, possibly after an application upgrade* needs in order to finish
the job and then tell the user what happened.

| Field | Why it is not optional |
|---|---|
| `id` | The primary key **and** the idempotency key sent to the server. One value, so a replay is provably the same write. |
| `createdAt` | Ordering, staleness checks, and the "queued 40 minutes ago" the UI owes the user. |
| `status` | `pending` / `sending` / `failed`. Without it, two drains race and send the same record twice. |
| `leaseUntil` | Epoch ms. A `sending` record whose lease expired is reclaimable — whatever claimed it was killed mid-flight. |
| `attempts` | Drives backoff and the give-up decision. Nothing in the platform counts attempts for you. |
| `lastError` | What you render on the failed card, and what you log. |
| `target` | `{ url, method }`. The route must still be resolvable months later — which is why a Server Action is not a valid target. |
| `headers` | Only the ones you set. Never a cookie, never an `Authorization` value. |
| `body` | Structured-cloneable data. Not a `Request`, not a live `FormData`. |
| `entity` | `{ type, id }` — what the UI renders as pending, and what a conflict is measured against. |
| `baseVersion` | The version of the row the user was looking at when they edited it. Without it, the queued write is a blind overwrite. |

`entity` and `baseVersion` are the two fields people leave out, and they are the two that turn a
queue into a *correct* queue. Without `entity`, pending state cannot be drawn next to the thing it
mutates, so the user sees an unchanged screen and assumes the app lost their edit. Without
`baseVersion`, the server cannot tell "the user changed this" from "the user overwrote a colleague's
change made while they were in a lift" — last-write-wins becomes the policy by omission rather than
by decision.

`target` deserves its own warning. A Server Action is invoked as a POST to the current URL carrying
a `next-action` header whose value is a build-time action ID. That ID is not stable across
deployments, so a record queued before a deploy and replayed after one is addressed to something
that no longer exists. Queue against a Route Handler you named yourself; a Server Action is the
*online* path only.

## Why the store is IndexedDB and not `localStorage`

This is not a preference. `localStorage` is a property of `Window`. A service worker's global is
`ServiceWorkerGlobalScope` — it has no `Window`, therefore no `localStorage`. A queue the service
worker cannot read is a queue that can never be drained in the background, which forfeits the whole
design before it starts. IndexedDB has the opposite property, stated as a note on MDN's API page:
the feature is available in Web Workers, and a `sync` event handler runs in exactly such a scope.

Three further reasons, all from the same page:

- **Asynchronous.** MDN: operations *"are done asynchronously, so as not to block applications."*
  `localStorage` is synchronous, and every read blocks the main thread — on a queue you consult on
  each render, that is a jank source you built on purpose.
- **Structured clone, not strings.** MDN: *"Any objects supported by the structured clone algorithm
  can be stored"*, including files and blobs — which is exactly what an offline photo upload is.
  `localStorage` stores strings, so a file must be base64-encoded, inflating it by a third before it
  meets a quota measured in single-digit megabytes.
- **Transactional.** MDN calls IndexedDB *"a transactional database system"*. Claiming a batch of
  records and marking them `sending` has to be one atomic step, or two drains claim the same
  record. `localStorage` offers read-modify-write with no transaction at all.

Neither store is durable in the sense a server database is. MDN is explicit that how much space a
browser allocates and what it deletes under pressure *"is not simple, and differs between
browsers"*, and points at its *Browser storage quotas and eviction criteria* page rather than
stating a rule. On iOS, WebKit's seven-day script-writable-storage cap covers IndexedDB along with
service worker registrations and caches — see
[10q · iOS storage and installed app containers](10q-ios-storage-and-installed-app-containers.md).
So an outbox is small, drained eagerly, and never treated as a system of record.

The implementation — the module both the page and the service worker import, the enqueue-then-send
ordering, and the server contract that makes the idempotency key mean something — is
[10s · The outbox store](10s-the-outbox-module-and-idempotent-delivery.md).

## Gotchas

**★ Symptom: `useOffline()` returns `false` on the first render even though the device has no
network, so the offline banner flashes the wrong state.** Cause: the documented return table says
`false` means *"the app is online, or rendering on the server"*, and that it is *"also the initial
value before hydration completes"*. Offline is a client-only fact discovered after hydration. Fix:
treat the first value as "unknown", not "online", and render the queue depth instead of the
connectivity state — the count of unsent records is true on the server render too, because you can
pass it in, and it is what the user actually wants to know.

**★ Symptom: you enabled the hook, the device is plainly offline, and it always returns `false`.**
Cause: the hook is inert without the config flag — `experimental.useOffline` in `next.config.js` is
what installs the listeners, the probe and the retry queue. There is no warning; the import
succeeds and the hook returns a constant. Fix: enable the flag, and treat its own banner seriously —
the API reference marks the feature *"currently experimental and subject to change"* and not
recommended for production, which is a reason to keep your durability story independent of it.

```js
// next.config.js
module.exports = { experimental: { useOffline: true } };
```

**★ Symptom: the optimistic comment appears instantly, the user closes the app pleased, and it is
gone when they come back.** Cause: `useOptimistic` state exists for the lifetime of one action on
one mounted component. It is a rendering convenience, not a write log, and it disappears on unmount,
on navigation and on reload. Fix: render pending state *from the outbox*, so the optimistic row and
the durable record are the same fact rather than two copies that can disagree.

**★ Symptom: `enqueue()` throws `DataCloneError`.** Cause: the record holds something outside the
structured clone algorithm — a `Request`, a live `FormData`, a function, a DOM node, or a class
instance with methods. Fix: normalise to clonable values at the boundary and rebuild the wrapper at
send time. A `Blob` clones; the `FormData` around it does not.

```js
const body = {
  text: form.get('text'),
  attachment: form.get('file') instanceof File ? form.get('file') : null,
};
```

**★ Symptom: the outbox is empty after the user cleared site data or left the app alone for a week
on iOS, and nobody noticed the writes vanished.** Cause: IndexedDB is client storage — subject to
quota eviction, to WebKit's seven-day cap, and to the user's own "Clear website data" button. Fix:
treat the outbox as a delivery buffer and never as the record of truth. Drain aggressively while
online, surface the queue depth in the UI so a growing queue is visible, and never let a "Saved"
label depend on a row that exists only in IndexedDB.

**★ Symptom: the queued record targets a Server Action and 404s or 500s when replayed after a
deploy.** Cause: you stored the POST that the Server Action client made — same URL, plus a
`next-action` header carrying a build-scoped action ID and a body in React's serialisation format.
None of that is a stable public contract, and the response is an RSC payload only the router can
consume. Fix: queue a plain JSON intent against a Route Handler you own, and reserve the Server
Action for the online path.

```js
// queue this, not the Server Action call
target: { url: `/api/tasks/${taskId}/comments`, method: 'POST' },
body: { text },
```

**★ Symptom: the write queue works perfectly in `next dev` and never drains in production.** Cause:
the mirror image of the read-side trap — prefetching is disabled in development, and the service
worker serving the drain in production is not the one the dev server hands you. Fix: exercise the
queue against a production build over HTTPS, with DevTools throttled to offline *and* with the tab
genuinely closed, not merely backgrounded, and while developing drive the drain
directly from the foreground rather than waiting on the browser to choose a moment.

**★ Symptom: pending badges are correct on one screen and stale on another.** Cause: the queue was
read once into component state instead of being read per entity, so a record enqueued elsewhere in
the app never reaches this screen. Fix: index the store by entity — `store.createIndex('byEntity',
['entity.type', 'entity.id'])` — and read the pending records for the entity being rendered, rather
than caching a snapshot of the whole queue.

**★ Symptom: two writes to the same field land in the wrong order and the older one wins.** Cause:
the queue was drained in whatever order the store returned, which for a key-path of `id` is UUID
order — effectively random. Fix: `createdAt` exists for this. Drain in `createdAt` order via an
index, and where two records touch the same entity, either coalesce them at enqueue time or send
them strictly sequentially.

## Interview questions

**★ Why is `experimental.useOffline`'s retry loop not an offline write queue, even though it is
documented as never giving up?**
Because "never gives up" describes the loop, and the loop is in-memory state on one router instance
in one document. Its documented scope — soft navigations into prefetched routes and Server Action
calls from the current page — presupposes that page is still alive. Close the tab, hard reload, or
let the OS reclaim the browser, and the retry state is collected with the rest of that JavaScript
heap. Durability needs the intent written to disk before the attempt is made, which is a different
mechanism at a different layer, not a longer timeout.

**★ Why can't the outbox live in `localStorage`?**
Three independent reasons, any one of them fatal. It is a `Window` property, so a service worker
cannot see it, which rules out draining in the background — the reason the queue exists. It is
synchronous, so every poll blocks the main thread. And it stores strings with no transactions, so
claiming a record is a read-modify-write two tabs can interleave, and a file attachment has to be
base64'd into a quota an order of magnitude smaller than what IndexedDB negotiates.

**★ Why does the record store `entity` and `baseVersion` rather than just the request?**
`entity` is what the UI renders against: without it you cannot draw "this task has one unsent
comment" beside the task, so pending state is invisible and the user concludes the app dropped
their edit. `baseVersion` is what the server needs to distinguish an intentional edit from an
accidental overwrite — the queued write will land against a row that may have moved, and without
the version the user was looking at, last-write-wins is the only available policy and it was chosen
by omission.

**Why is a Server Action the wrong thing to put in `target`?**
Because a Server Action invocation is not addressable in the way a queued job needs. It is a POST
to the current route carrying a `next-action` header whose value is a build-time identifier, with a
body in React's internal serialisation format and a response in the RSC wire format. The identifier
is not stable across deploys, so a record queued on Monday's build and replayed against Tuesday's
is pointed at nothing; and even when it resolves, the response is meant for the router, not for
your drain code. A Route Handler you named yourself is a URL, a method and JSON — a contract that
still means the same thing next week.

**What is the correct ordering of "write to IndexedDB" and "attempt the network", and what breaks
if you invert it?**
Write first. If you attempt the network first and only enqueue on failure, a tab killed *during*
the request loses the mutation outright — a small window, but exactly the window that is open when
the network is bad, which is when this matters at all. Writing first means the worst case is a
duplicate delivery, which an idempotency key absorbs, instead of a lost write, which nothing
absorbs.

**If IndexedDB can be evicted, in what sense is the outbox "durable" at all?**
Durable against the failure modes it was built for — process termination, tab closure, navigation,
reboot — and not against the user or the browser deciding to reclaim the origin's storage. That
distinction has to be visible in the design: the outbox never holds the only copy of something the
UI has already called saved, its depth is shown to the user so an undrained queue is noticed rather
than discovered, and the drain runs at every opportunity rather than waiting for a convenient one.
An outbox that reliably survives a killed tab and occasionally loses to a storage sweep is still
the difference between "works offline" and "pretends to".

---

← [10q · iOS storage and installed app containers](10q-ios-storage-and-installed-app-containers.md) · [Chapter 12 overview](01-explanation.md) · Next → [10s · The outbox store](10s-the-outbox-module-and-idempotent-delivery.md)
