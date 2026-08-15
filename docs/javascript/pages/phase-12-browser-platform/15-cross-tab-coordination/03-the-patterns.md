---
title: "03 · The patterns"
sidebar_label: "03 · The patterns"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`LockManager.request()`](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request), [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel), [`Window: storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`Document: visibilitychange` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event) — and the [Web Locks API specification](https://w3c.github.io/web-locks/). Documentation-validated; **no timings and no console output**.

The channel tells, the lock decides, storage remembers. Every pattern below is a particular
arrangement of those three, and the arrangement is the design work.

## Pattern 1 · Do it once, and let everyone else wait

The token-refresh problem, which is where most people meet the Web Locks API:

```js
async function getToken() {
  if (isFresh(token)) return token;

  return navigator.locks.request('token-refresh', async () => {
    if (isFresh(token)) return token;        // 🔴 re-check INSIDE the lock
    token = await refreshToken();
    localStorage.setItem('token', JSON.stringify(token));
    channel.postMessage({ v: 1, type: 'auth:token' });
    return token;
  });
}
```

🔴 **The re-check inside the callback is the pattern, not a detail.** Four tabs call `getToken()`
at once; one wins the lock and refreshes; the other three are granted the lock afterwards and find
the work already done. Without the second check they refresh three more times — and with rotating
refresh tokens, the later refreshes invalidate the earlier one and log the user out. The bug
report reads *"random logouts when I have several tabs open"*.

Note what each mechanism contributes, because all three are doing different jobs: the **lock**
serialises, `localStorage` **persists** for a tab opened later, the **channel** notifies the tabs
already running.

## Pattern 2 · Leader election — a lock you never release

Hold the lock for the lifetime of the page and you have elected a leader. Everybody else is queued,
and the queue *is* the succession plan.

```js
let amLeader = false;

navigator.locks.request('leader', () => {
  amLeader = true;
  startPolling();                     // one poll loop for the whole origin
  return new Promise(() => {});       // 🔴 never resolves — held until this tab goes away
});
```

When the leader's tab is closed or crashes, its lock is terminated with the agent and the next
waiter's callback runs. No heartbeat, no timeout tuning, no stale-leader detection — the three
things a hand-rolled election always gets wrong.

This is the cheap alternative to a `SharedWorker` when support is uneven
([01 · The channels](./01-the-channels.md)): one tab owns the WebSocket, the poll loop or the sync,
and broadcasts results to the rest.

⚠️ **A leader is not a guarantee of exactly-once.** There is a window during handover where the old
leader has stopped and the new one has not started, and a leader in a background tab is throttled
like any other page ([03 · Timers and frames](../03-timers-and-frames/README.md)) — which is an
argument for electing the *visible* tab where it matters. Use election to *reduce* duplicate work,
and keep the server idempotent regardless
([13 · What belongs on the server](../13-what-belongs-on-the-server/README.md)).

## Pattern 3 · "Already open in another tab" — `ifAvailable`

```js
await navigator.locks.request('editor', { ifAvailable: true }, async (lock) => {
  if (!lock) {                                  // 🔴 null, not an exception
    showBanner('This document is open in another tab.');
    return;
  }
  await runEditor();
});
```

`ifAvailable` answers a question instead of waiting for an answer. The callback still runs — with
`null` — so the "no" path is a branch, not a `catch`. It is the right shape for anything with a
single-writer assumption baked into it: an editor with local drafts, an IndexedDB migration, a
long import.

## Pattern 4 · A lock with a deadline

```js
const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), 3000);

try {
  await navigator.locks.request('import', { signal: ac.signal }, async () => {
    await importEverything();
  });
} catch (err) {
  if (err.name === 'AbortError') showBanner('Another tab is importing — try again shortly.');
  else throw err;
} finally {
  clearTimeout(timer);
}
```

⚠️ **The signal aborts waiting for the lock, not the work inside it.** Once the callback starts,
the request has been granted and the signal no longer applies. Cancelling the work itself is a
separate `AbortSignal` passed into the work
([Phase 11 · 08 · Aborting and timing out](../../phase-11-network-storage/08-aborting-and-timing-out/README.md)).

## Pattern 5 · Readers and one writer

```js
const read  = (fn) => navigator.locks.request('db', { mode: 'shared' }, fn);
const write = (fn) => navigator.locks.request('db', { mode: 'exclusive' }, fn);
```

Many `shared` holders coexist; an `exclusive` request waits for all of them and then blocks new
ones. It is the classic readers-writer lock. Worth knowing it exists — but reach for it only when
reads genuinely outnumber writes *and* the resource is expensive, because the simpler exclusive
lock is easier to reason about.

## The late joiner, and why storage is always in the design

Every message-based pattern has the same hole: **a tab opened after the event hears nothing.** The
channel has no replay. So the rule is to write state where a new tab will look for it, and treat
the broadcast as an optimisation that makes other tabs notice sooner.

```js
// startup — read the world, do not wait to be told about it
hydrate(JSON.parse(localStorage.getItem('session') ?? 'null'));

// and re-check when the user comes back to this tab
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') revalidate();
});
```

🔴 **`visibilitychange` + revalidate is the baseline that makes everything else optional.** A tab
that was hidden for an hour may have missed messages, been frozen, or been restored from the
back/forward cache. Re-reading on return is one line, has no protocol to get wrong, and is what
most apps should implement *before* any channel or lock.

## Putting it together — "log out everywhere"

```js
async function logout() {
  await navigator.locks.request('auth', async () => {   // one logout at a time
    await api.logout();                                 // server-side revocation
    localStorage.removeItem('session');                 // for tabs opened later
    channel.postMessage({ v: 1, type: 'auth:logout' }); // for tabs open now
  });
  redirectToLogin();
}

channel.onmessage = ({ data }) => {
  if (data?.v === 1 && data.type === 'auth:logout') redirectToLogin();
};

addEventListener('storage', (e) => {                    // the belt to the channel's braces
  if (e.key === 'session' && e.newValue === null) redirectToLogin();
  if (e.key === null) redirectToLogin();                // clear(): everything is gone
});
```

Three mechanisms, three distinct jobs — **the lock decides, storage persists, the channel
notifies** — with server revocation underneath all of it, because a tab that was asleep through the
whole exchange still has to fail its next request. That last point is the honest one: cross-tab
coordination improves the *experience* of logging out. Only the server makes it true.

## Writing this so it can be tested

Cross-tab bugs are the ones that never reproduce, because the second tab only exists in production.
Two habits make the difference:

- **Put the protocol behind one module** — `publish(type, payload)`, `subscribe(handler)`,
  `withLock(name, fn)` — so the rest of the app never touches `BroadcastChannel` or
  `navigator.locks` directly, and a test can substitute an in-memory implementation.
- **Give the unhappy paths a switch.** No lock available, a message from an older app version, a
  message that never arrives. Each is a branch you can exercise on purpose rather than a scenario
  you hope never happens ([12 · Feature detection](../12-feature-detection/README.md) — the same
  capability-module discipline).

Then check the real thing the only way it can be checked: **two real tabs, and a third opened
afterwards** to catch the late joiner.

## Gotchas

**Symptom: two tabs both refreshed the token and the user got logged out.**
Cause — broadcasting the intent instead of serialising it, or no re-check inside the lock.
Fix — a lock around the refresh, and check freshness again *inside* the callback.

**Symptom: the leader keeps polling in a background tab and the data still goes stale.**
Cause — background throttling; the elected leader is a hidden tab.
Fix — revalidate on `visibilitychange` in the tab the user is actually looking at.

**Symptom: everything works with two tabs and breaks with a third opened later.**
Cause — the late joiner missed the broadcast; state lives only in memory.
Fix — persist the state and hydrate from it on startup.

**Symptom: a duplicate order after the user opened a second tab.**
Cause — coordination treated as a correctness guarantee.
Fix — an idempotency key generated once per user intent, enforced server-side.

**Symptom: the second tab applies a change twice.**
Cause — sending a diff (`cart:add`) rather than an event (`cart:changed`) and applying it blind.
Fix — broadcast that something changed and let the receiver re-read the source of truth.

**Symptom: a message from an old tab crashes the new app version.**
Cause — an unversioned envelope and a `switch` with no default.
Fix — a `v` field, ignore what you do not understand, never throw in a channel handler.

## Interview questions

**★ Two tabs both need to refresh an expired token. How do you make it happen once?**
Serialise with `navigator.locks.request('token-refresh', …)` and **re-check freshness inside the
callback**, so the queued tabs find the work done. Persist the new token for tabs opened later and
broadcast for tabs already open.

**★ How do you elect one tab to own a WebSocket?**
Request a lock whose callback returns a promise that never resolves. That tab is the leader; the
others are queued, and when the leader's tab goes away its lock is terminated and the next one
takes over — no heartbeat and no stale-leader logic.

**★ Why does a new tab miss what the others already know?**
Because a channel is a bus with no history. State has to be persisted and read on startup; the
broadcast only makes running tabs notice sooner.

**★ Your app must show "already open in another tab". Which API?**
`navigator.locks.request(name, { ifAvailable: true }, …)` — the callback receives `null` instead of
queueing, so you can show the banner immediately.

**★ Where does cross-tab coordination stop being enough?**
At the device boundary and at correctness. Locks and channels cover one browser profile on one
machine, and only reduce duplicate work; anything that must be exactly-once needs idempotency
enforced by the server.

**★ How would you make this testable?**
Wrap publish/subscribe/withLock in one module so the app never touches the platform APIs directly,
substitute an in-memory version in tests, and exercise the unhappy paths — no lock, old message,
lost message — deliberately.

---

← [02 · Web Locks](./02-web-locks.md) · [Topic index](./README.md)
