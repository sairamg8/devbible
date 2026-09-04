---
title: "Background Sync is a request that the browser wake your service worker later, not a guarantee that it will — so the drain has to be correct when it runs twice, and there has to be a foreground path for the browsers that never run it at all"
sidebar_label: "10t · Background Sync"
sidebar_position: 50
description: "SyncManager.register and its two documented exceptions, draining the outbox inside waitUntil, and why lastChance is the only documented statement about retry exhaustion."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against MDN — [Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API),
> [`SyncManager.register()`](https://developer.mozilla.org/en-US/docs/Web/API/SyncManager/register),
> [`SyncEvent`](https://developer.mozilla.org/en-US/docs/Web/API/SyncEvent),
> [`ServiceWorkerGlobalScope: sync` event](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/sync_event),
> [`ExtendableEvent.waitUntil()`](https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent/waitUntil)
> — and Chrome's [workbox-background-sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Background Sync is the one platform API that will finish a user's write after their tab is gone.
It is also not Baseline, gives you no documented retry budget, and can be switched off by the user —
so it is the fastest path when it exists and never the plan. Everything below assumes the outbox
from [10s](10s-the-outbox-module-and-idempotent-delivery.md) already guarantees that draining twice
is harmless, because with this API you cannot know how many times you drained.**

MDN's own banner is the design constraint, not a footnote:

> *"This feature is not Baseline because it does not work in some of the most widely-used browsers."*

It is also secure-context only and available only in service workers — both of which you already
satisfy if the manifest and worker from earlier in this chapter are in place.

## Registering the trigger

`registration.sync.register(tag)` returns a promise resolving to `undefined`, and MDN documents
exactly two exceptions: `InvalidStateError` *"if current service worker is not active"*, and
`NotAllowedError` *"if background sync has been disabled by the user."* Both are ordinary, expected
outcomes on real devices, so neither may be swallowed into a `console.log`.

One tag covers the whole queue. The tag is a *topic*, not a job id — `getTags()` exists so you can
avoid re-registering one that is already pending.

```js
// lib/request-sync.js — called from the page after every enqueue.
export const OUTBOX_TAG = 'outbox-drain';

export async function requestOutboxSync() {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const registration = await navigator.serviceWorker.ready;
  if (!registration.sync) return 'unsupported';

  const tags = await registration.sync.getTags();
  if (tags.includes(OUTBOX_TAG)) return 'already-registered';

  try {
    await registration.sync.register(OUTBOX_TAG);
    return 'registered';
  } catch (error) {
    if (error.name === 'NotAllowedError') return 'denied';
    if (error.name === 'InvalidStateError') return 'no-active-worker';
    throw error;
  }
}
```

`navigator.serviceWorker.ready` is what turns `InvalidStateError` from the common case into the
rare one: it resolves only once a registration has an active worker. It never resolves if the user
has service workers disabled, so it belongs behind the feature check, not in front of it.

Every one of those return values is a *fact the caller needs*. `denied` and `unsupported` mean the
foreground path is now the only path; treating them as "registered" is how a queue quietly stops
draining for a subset of users.

## Draining inside `waitUntil`

The `sync` event carries the tag you registered. `waitUntil` is what keeps the worker alive long
enough to finish: MDN describes it as telling the browser *"that work is ongoing until the promise
settles, and it shouldn't terminate the service worker if it wants that work to complete."* Without
it, the handler returns immediately, the runtime is free to shut the worker down, and your fetches
are cancelled somewhere in the middle of the queue.

```js
// lib/service-worker.js
import { drainOutbox } from './drain';

const OUTBOX_TAG = 'outbox-drain';

self.addEventListener('sync', (event) => {
  if (event.tag === OUTBOX_TAG) {
    event.waitUntil(drainOutbox({ lastChance: event.lastChance }));
  }
});
```

`drainOutbox` itself lives in its own module because the page needs the identical function — see
[10t2 · The foreground floor](10t2-the-foreground-floor-and-draining-without-background-sync.md):

```js
// lib/drain.js — imported by the service worker AND by the page.
import { claimBatch, release, remove } from './outbox';
import { sendOne } from './send-one';

export async function drainOutbox({ lastChance = false } = {}) {
  const claimed = await claimBatch(25);
  let delivered = 0;

  for (const record of claimed) {
    try {
      await sendOne(record);
      await remove(record.id);
      delivered += 1;
    } catch (error) {
      const giveUp = Boolean(error.permanent) || lastChance;
      await release(record.id, { failed: giveUp, error });
      if (!error.permanent && !lastChance) break; // network is down again
    }
  }

  await notifyClients({ delivered });
  return delivered;
}

async function notifyClients(payload) {
  if (typeof self === 'undefined' || !self.clients) return; // running in a page
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) {
    client.postMessage({ type: 'outbox-drained', ...payload });
  }
}
```

`sendOne` is the single delivery function, shared with the foreground path so the two can never
diverge on which failures are worth retrying:

```js
// lib/send-one.js — no window, no document.
export async function sendOne(record) {
  const response = await fetch(record.target.url, {
    method: record.target.method,
    headers: {
      ...record.headers,
      'Idempotency-Key': record.id,
      'X-Base-Version': record.baseVersion == null ? '' : String(record.baseVersion),
    },
    body: JSON.stringify(record.body),
    credentials: 'include',
  });
  if (response.ok) return response.json();

  const error = new Error(`${record.target.method} ${record.target.url} -> ${response.status}`);
  error.status = response.status;
  error.permanent = response.status >= 400 && response.status < 500 &&
    response.status !== 408 && response.status !== 429;
  throw error;
}
```

Two details in `drainOutbox` are the whole point. It claims *then* sends, so a second drain running
concurrently in a tab skips the leased records. And it breaks out of the loop on the first transport
failure rather than marching through twenty-five records against a network that is plainly still
down — each of those would otherwise burn an attempt and a lease.

## `lastChance` is the only promise you get

`SyncEvent.lastChance` *"Returns `true` if the user agent will not make further synchronization
attempts after the current attempt."* That single sentence is the entire documented surface of
retry behaviour. It tells you two things: the user agent does retry, and there is a final attempt
you can detect.

🔴 **It does not tell you how many attempts there are, how far apart they are, or how long the
browser will keep trying — and MDN states none of those.** Any number you have seen quoted for this
is someone's measurement of one browser version, not a contract. Design as though the next attempt
may be the last, which is exactly what `lastChance` lets you do: on the final attempt, stop leaving
records `pending` and move them to `failed`, so the UI can tell the user the truth instead of
showing a spinner that will never resolve.

MDN is also silent on what a *rejected* `waitUntil` promise means for a `sync` event. It documents
rejection semantics for `install` only. So do not build a retry strategy out of "throw and the
browser will call me back" — catch your own errors, record them on the record, and let the outbox
be the memory.

There is one more thing the sources do not settle. MDN's `sync` event page words the trigger as
firing when the page or worker that registered it *is running* and connectivity is available, while
Chrome's Workbox documentation describes its non-native fallback as needing an active page *unlike*
native Background Sync. Those two readings differ on the case that matters most — the closed tab.
Treat delivery-after-close as a bonus you cannot rely on, and make sure a queued record is drained
at the next app start regardless.

## Gotchas

**★ Symptom: `register()` throws `InvalidStateError` on first load and the queue is never
registered for sync.** Cause: you called it against a registration whose worker is still
`installing` — MDN's documented condition is *"if current service worker is not active."* On a first
visit that is the normal state, and it is exactly the visit where the user is most likely to be on a
bad connection. Fix: always go through `await navigator.serviceWorker.ready`, which resolves only
when there is an active worker, and treat the error as a signal to drain in the foreground rather
than as a crash.

**★ Symptom: sync works for you and silently never fires for a fraction of users.** Cause: the API
is not Baseline, and `register()` additionally throws `NotAllowedError` when background sync has
been disabled by the user — a per-site permission you do not control and cannot prompt for. Fix:
feature-detect `registration.sync` before use, treat `denied` as a first-class outcome as
`requestOutboxSync` does, and make the foreground triggers unconditional so nothing depends on the
registration succeeding.

**★ Symptom: the same records are delivered twice and the server's idempotency table is doing all
the work.** Cause: a tab and the service worker drained at the same moment — the `online` event and
the `sync` event fire from the same underlying change in connectivity. The key makes the result
correct, not free: it is still two requests per record on a connection the user may be paying for.
Fix: claim before sending. `claimBatch` marks each record `sending` with a lease inside the reading
transaction, so whichever context loses the race finds nothing to do.

**★ Symptom: the drain stops after the first few records and the rest never move.** Cause: the
service worker was terminated mid-drain because the work was not inside `waitUntil` — the handler
returned, the runtime considered the event finished, and the pending fetches went with it. Fix: pass
the whole drain to `waitUntil`, as the handler above does. The leases mean the interrupted records
are reclaimed on the next pass rather than being stuck.

**★ Symptom: `waitUntil` was used and the drain *still* got cut off.** Cause: it was handed a
promise that settles before the work does — the classic being `records.forEach(async (r) => …)`,
which returns immediately and leaves a pile of unawaited promises. Fix: a `for…of` loop with `await`
inside, or `Promise.all` over an array of promises; either way the promise given to `waitUntil` must
be the one that settles last.

**★ Symptom: the code assumes the browser will keep retrying and nothing ever tells the user their
write failed.** Cause: a retry budget was inferred that no specification states — the only
documented statement is `lastChance`. Fix: own the give-up decision. Fail permanently on permanent
statuses, fail on `lastChance`, and fail on an absolute age, then surface it.

```js
const tooOld = Date.now() - record.createdAt > 3 * 24 * 60 * 60 * 1000;
const giveUp = Boolean(error.permanent) || lastChance || tooOld;
await release(record.id, { failed: giveUp, error });
```

**★ Symptom: a module-level `IDBDatabase` handle works in the page and throws in the service
worker.** Cause: the runtime may terminate a service worker between events at its discretion, so a
connection cached in module scope is not reliably alive the next time the module runs — and the path
that exercises it is background sync, the one you cannot easily step through. Fix: open and close a
connection per operation, exactly as the outbox module does. The same discipline also stops a
long-lived connection in an old tab from blocking a future `onupgradeneeded` forever.

## Interview questions

**★ Why is Background Sync an enhancement rather than the design?**
Because three independent things can remove it, none of which you control: the browser may not
implement it at all (MDN's banner is explicit that it is not Baseline), the user may have disabled
it — which surfaces as `NotAllowedError` from `register()` — and even where it exists, the platform
publishes no guarantee about when or how often the event fires. A design that depends on it has a
population of users for whom the queue silently never drains, and they are invisible in your metrics
because nothing errors. Building the foreground flush first, then registering a sync as an
optimisation, inverts that: the worst case is a later delivery rather than none.

**★ What exactly does `lastChance` tell you, and what does it not?**
It tells you the user agent will not make further synchronisation attempts after the current one —
which establishes that retries exist and that they end. It does not tell you how many attempts you
have had, how far apart they were, or how long the browser has been trying, and MDN documents none
of those. So the useful thing to do with it is a state transition, not arithmetic: when
`event.lastChance` is true, stop leaving records `pending` and move whatever fails to `failed`, so
the user sees a truthful "not sent" instead of a spinner nothing will ever resolve.

**★ Why must the drain be safe to re-run from a partially-drained state?**
Because a partial drain is the *expected* outcome, not an edge case. The worker can be terminated
mid-queue, the network can drop between record three and record four, and the browser may fire the
sync event again afterwards without telling you what happened before. That makes the queue's
correctness rest on two properties: each record is individually claimed and individually removed
only after its own success, so progress is never lost wholesale; and every send carries the
idempotency key minted at enqueue time, so a record delivered just before the interruption cannot
produce a second row when it is retried after it.

**Why does the entire drain go inside `waitUntil` rather than just being started in the handler?**
Because a service worker is not a process you own. Between events the runtime may shut it down at
any time, and a `sync` handler that returns after kicking off async work has told the browser it is
finished. `waitUntil` is the only way to say otherwise — MDN describes it as telling the browser
work is ongoing until the promise settles and that it should not terminate the worker if it wants
that work to complete. The corollary is that the promise you pass must genuinely settle last, which
is why an `async` callback inside `forEach` is a bug and not a style choice.

**Why one sync tag for the whole outbox rather than one per queued record?**
Because the tag names a *job*, not an item. One tag means one wakeup that drains everything
available, which is both fewer wakeups and the correct behaviour when three records were queued
while offline. Per-record tags multiply registrations you then have to reconcile with the store —
and since `getTags()` is your only visibility into what is pending, a tag per record turns a simple
dedupe check into a set comparison that can drift from the queue it is supposed to mirror. The
generic tag also survives the record being deleted by a foreground drain before the sync fires: the
handler simply finds nothing to claim and returns.

**The `sync` event fired, the drain ran, and every request failed because the device is offline
again. What should happen?**
The drain should stop at the first transport failure rather than iterating the whole queue, release
that record back to `pending` with its attempt counted, and leave everything else unclaimed. Then it
should re-register the tag so the browser tries again. What it must not do is mark records `failed`:
a transport error carries no information about the request's validity, and turning "the network went
away mid-drain" into a permanent failure shown to the user is worse than a delay, because the user
has no way to distinguish it from a rejected write and will typically retype the whole thing.

---

← [The outbox store](10s-the-outbox-module-and-idempotent-delivery.md) · [Chapter 12 overview](01-explanation.md) · Next → [The foreground floor](10t2-the-foreground-floor-and-draining-without-background-sync.md)
