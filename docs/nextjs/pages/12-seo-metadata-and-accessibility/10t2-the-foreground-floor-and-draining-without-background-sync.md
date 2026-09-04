---
title: "Background Sync is the optimisation; the drain your users actually get runs in the page — on app start, on the online event, and on the return to visibility"
sidebar_label: "10t2 · The foreground floor"
sidebar_position: 51
description: "The three foreground triggers that drain the outbox without Background Sync, why the online event is not a connectivity test, one drain function in two contexts, and what Workbox and Serwist add."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Chrome's [workbox-background-sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync),
> MDN [Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API),
> the Next.js [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) and
> [`experimental.useOffline`](https://nextjs.org/docs/app/api-reference/config/next-config-js/useOffline).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**A queue that only drains when the browser feels like waking a service worker is a queue that
never drains for the users whose browser does not implement that API, and for the users who
switched it off. The floor underneath Background Sync is unglamorous and it is the part that has to
be right: the same `drainOutbox` from [10t](10t-background-sync-registering-and-draining.md), called
from the page, at every moment a queued write can plausibly succeed — at the call site, on app
start, when the browser says the network is back, and when the user brings the app to the front. Everything
Background Sync adds sits on top of that, and nothing depends on it.**

## The three triggers

Mount this once, high in the tree — in the root layout's client shell, not per route, or you get one
set of listeners per page you visit.

```jsx
// app/outbox-runner.jsx
'use client';
import { useEffect } from 'react';
import { drainOutbox } from '@/lib/drain';
import { requestOutboxSync } from '@/lib/request-sync';

export function OutboxRunner({ onDrained }) {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const delivered = await drainOutbox();
      if (!cancelled && delivered > 0) onDrained?.(delivered);
    };

    void run();                                   // app start, including after a reboot
    const onOnline = () => { void run(); };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    void requestOutboxSync();                     // best effort; may be denied or unsupported

    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [onDrained]);

  return null;
}
```

Each trigger covers a case the others miss. **App start** is the only one that recovers a write
queued before a device reboot or before the tab was discarded — the case Background Sync is
supposed to own, and the one it is least dependable for. **`online`** is the cheap, immediate signal
for the user who walks back into signal with the app open. **`visibilitychange`** covers the phone
that regained connectivity while the browser was backgrounded, where the `online` event may have
fired against a document that was frozen, or not fired in a way you observed.

## The fourth trigger is the write itself

The three listeners above recover writes that are already queued. The first and most important drain
happens immediately, at the call site, because most offline writes are made seconds before the
network comes back — and because a write that is attempted straight away is one the user watches
succeed.

```js
// lib/submit.js
import { enqueue, remove, release } from './outbox';
import { sendOne } from './send-one';

export async function submitComment({ taskId, text, baseVersion }) {
  const record = await enqueue({
    target: { url: `/api/tasks/${taskId}/comments`, method: 'POST' },
    headers: { 'Content-Type': 'application/json' },
    body: { text },
    entity: { type: 'task', id: taskId },
    baseVersion,
  });

  try {
    const result = await sendOne(record);
    await remove(record.id);
    return { status: 'sent', result };
  } catch (error) {
    await release(record.id, { failed: Boolean(error.permanent), error });
    return { status: error.permanent ? 'failed' : 'queued', id: record.id };
  }
}
```

The ordering is the whole design: the record is on disk before the request is made, so a tab killed
mid-flight costs a duplicate delivery — which the idempotency key absorbs — rather than a lost
write, which nothing absorbs. Note also that this path deliberately does not go through
`claimBatch`: the record was created by this call and has not been offered to any other context yet.

## `online` is a claim about the network interface, not about your server

The `online` event and `navigator.onLine` tell you the device believes it has a network. They do not
tell you that your origin is reachable — captive portals, a VPN that came up without a route, a
server that is down, and a corporate proxy that resolves everything to a login page all present as
"online". Next.js's own connectivity logic is the evidence: rather than trusting the event, it
issues a `HEAD` request to the current page URL with the RSC header and aborts it at 200 ms,
treating both a response *and* an abort as online, because a genuinely offline request fails at DNS
or TCP almost immediately. It then retries blocked requests on a 500 ms → 1 s → 2 s → 3 s backoff.

The practical consequence for the outbox is that you do not need a probe of your own. The drain *is*
the probe: `sendOne` either succeeds or throws, and a throw is more informative than any heuristic,
because it is a statement about the exact request you care about. What you must not do is gate the
drain behind `navigator.onLine === true` — that turns a false negative in the browser's heuristic
into a queue that refuses to try.

```js
// wrong: a heuristic decides whether the user's write is allowed to be attempted
if (navigator.onLine) await drainOutbox();

// right: attempt it, and let the failure classify itself
await drainOutbox();
```

## One drain, two contexts, one lease

The page and the service worker run the *same* `drainOutbox` from `lib/drain.js`. They will
sometimes run it at the same moment — the `online` event in the tab and the `sync` event in the
worker are driven by the same underlying change — and the lease taken inside `claimBatch` is what
makes that harmless: whichever context claims a record first owns it until the lease expires, and
the other finds nothing to do.

The remaining asymmetry is that only the worker can tell the page anything. `notifyClients` in
[10t](10t-background-sync-registering-and-draining.md) posts to every window; the page listens and
refreshes the affected data:

```jsx
// app/outbox-listener.jsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function OutboxListener() {
  const router = useRouter();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event) => {
      if (event.data?.type === 'outbox-drained' && event.data.delivered > 0) {
        router.refresh();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [router]);
  return null;
}
```

Without that message the worst outcome in this whole design becomes possible: the write was
delivered, the server has it, and the open tab still shows the stale value with a pending badge
beside it. The user retypes it.

## What Workbox and Serwist add

Chrome's `workbox-background-sync` packages exactly the pairing described across these chunks — a
queue in IndexedDB plus a `sync` registration — behind a `Queue` you push failed requests onto, and
a `BackgroundSyncPlugin` that hooks the `fetchDidFail` callback so failures are queued without any
call site knowing. The line worth remembering is its fallback:

> *"In browsers that don't natively support the BackgroundSync API, Workbox Background Sync will automatically attempt a replay whenever your service worker starts up."*

That is the same floor this chunk builds by hand, with the same limitation, which Workbox's own
documentation states plainly: a replay on worker startup needs an active page controlling the
worker, so it is not as effective as the native event.

🔴 **Next.js ships no first-party helper for any of this.** The PWA guide's only offline pointer is
Serwist, which is built on Workbox and has `next-basic` and `next-turbo-basic` examples. Choosing a
library here is reasonable; what is not reasonable is assuming the framework has an opinion, because
it does not, and the idempotency contract on the server is yours either way.

## Gotchas

**★ Symptom: records burn through their attempts in seconds and land in `failed` while the device is
merely between cells.** Cause: the drain re-claims a record the moment its lease expires, with no
regard to how recently it failed. Fix: make the claim consult `attempts` so the backoff lives in the
store rather than in whichever context happens to run next.

```js
const backoffMs = Math.min(30_000, 500 * 2 ** record.attempts);
const cooling = record.attempts > 0 && now - record.leaseUntil < backoffMs;
if (!cooling && (record.status === 'pending' || abandoned)) {
  // …claim it
}
```

**★ Symptom: a record is claimed, the fetch succeeds, and the delete never happens — or a write
lands in the store that you never made.** Cause: the network call was made *inside* an open
IndexedDB transaction. A transaction auto-commits once it goes idle, and awaiting anything that is
not an IndexedDB request lets it do exactly that, so the later `put` or `delete` runs against a
transaction that has already finished. Fix: never `await` a `fetch`, a `caches` call or a timer
between two operations on one transaction — claim in one transaction, do the network work outside
it, then open a fresh transaction to record the outcome. `claimBatch`, `release` and `remove` are
three separate transactions for this reason.

**★ Symptom: in development the drain runs twice on every mount and each record is claimed,
released and re-claimed.** Cause: React's Strict Mode deliberately mounts, unmounts and remounts an
effect in development to surface missing cleanup. Both passes call `run()`. Fix: this is a
correctness test you should pass rather than an inconvenience to silence — the lease makes the
second pass a no-op, and the `cancelled` flag stops the unmounted first pass from calling back into
React. If the second pass sends anything, your claiming is wrong, not Strict Mode.

**★ Symptom: navigating between routes accumulates listeners and each `online` event triggers five
drains.** Cause: `OutboxRunner` was mounted inside a page or a per-route layout, so a new instance
registers each time and the old ones only unmount on a full reload. Fix: mount it once in the root
layout's client shell, and always return the cleanup function — the version above removes both
listeners and flips `cancelled`.

**★ Symptom: the user pulls the app to the front, the drain succeeds, and the list is still
stale.** Cause: the drain that succeeded ran in the service worker, which has no access to React
state, and nothing told the page. Fix: `notifyClients` in the worker plus the `message` listener
above; the page calls `router.refresh()` and the server components re-render against the data the
drain just wrote.

**★ Symptom: `drainOutbox()` is called on every keystroke because a component re-created the
callback.** Cause: `onDrained` is an inline arrow, so the effect's dependency array changes on every
render and the effect tears down and re-runs — draining each time. Fix: wrap the callback in
`useCallback` at the call site, or drop it from the props entirely and use the `message`/refresh
path instead of a callback.

**★ Symptom: you gate the whole feature behind a background-sync feature check, and browsers without
it never queue anything at all.** Cause: the check was placed around `enqueue` rather than around
`register`. Fix: enqueueing is unconditional — it is just IndexedDB — and only `requestOutboxSync`
is feature-detected. A browser without Background Sync should still queue, still drain on the three
triggers, and differ only in not draining while closed.

## Interview questions

**★ Why does the foreground drain have three triggers rather than one?**
Because each covers a failure the others cannot see. The call on mount is the only one that recovers
a write queued before a reboot or before the tab was discarded — no event fires for "the app is
being opened again after being gone". The `online` event is the immediate one for a user standing
still while signal returns, and it is the cheapest. `visibilitychange` covers the very common mobile
shape where connectivity returned while the browser was backgrounded and the document was frozen, so
whatever `online` did was not observed by your listener. Removing any one of them leaves a class of
user whose queue drains late or not at all.

**★ Why not gate the drain on `navigator.onLine`?**
Because it answers a different question than the one you are asking. It reports whether the device
believes it has a network interface, not whether your origin is reachable — captive portals, dead
VPN routes and an origin that is simply down all report online, and some configurations report
offline while requests succeed. Gating on it converts a heuristic's false negative into a queue that
refuses to attempt delivery at all. The attempt itself is a better test: it either succeeds or
produces an error you can classify, and Next's own connectivity logic makes the same choice by
probing with a real request rather than trusting the flag.

**★ What stops the page drain and the service worker drain from sending the same record twice?**
The lease taken inside `claimBatch`, in the same transaction as the read. Both contexts run the
identical `drainOutbox`, and they genuinely do run at the same moment, because the `online` event in
the tab and the `sync` event in the worker are triggered by the same change in connectivity.
Whichever transaction commits first marks the record `sending` with an expiry; the other sees a
leased record and skips it. The idempotency key is the second line of defence for the case the lease
cannot cover — a delivery whose response was lost — not a substitute for claiming.

**Why does the service worker have to message the page after a successful drain?**
Because the two live in different worlds and only one of them renders. The worker can write to
IndexedDB and to the HTTP caches, but it cannot invalidate a React tree, so a drain that succeeds
while a tab is open leaves the UI showing a pending badge on a write that has already landed. That
is the specific failure that makes users retype things. `clients.matchAll` plus `postMessage` is the
documented route out of the worker, and on the page a `router.refresh()` re-renders the server
components against the data that now exists.

**What does Workbox actually give you over the code in these chunks, and what does it not?**
It gives you the plumbing: a `Queue` backed by IndexedDB, a `BackgroundSyncPlugin` that captures
failures at the `fetchDidFail` hook so call sites do not have to know about queueing, and a
documented fallback that replays on service worker startup where the native API is missing. What it
does not give you is the half that actually decides correctness — the idempotency key contract with
your server, the conflict policy for a write that lands against data that has moved, and the UI that
tells the user a queued write failed. Those are yours whichever library you pick, and they are the
parts that fail in production.

**Where does this leave a user on a browser with no Background Sync at all?**
With a queue that is durable and drains on every occasion the app is in front of them — which is
most of the value. What they lose is delivery while the app is closed: a write made offline sits
until the next launch. That is a real limitation and it belongs in the UI rather than in a comment,
because a user who queued something important should be told it is unsent, not shown a tick. The
design goal is not to pretend the platform difference does not exist; it is to make the difference
be "later" instead of "never".

---

← [Background Sync](10t-background-sync-registering-and-draining.md) · [Chapter 12 overview](01-explanation.md) · Next → [The Lighthouse PWA category is gone](10u-the-lighthouse-pwa-category-is-gone.md)
