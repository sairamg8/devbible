---
title: "01 · The stale response"
sidebar_label: "01 · The stale response"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`AbortSignal.reason`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/reason), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`EventTarget.addEventListener()` § signal](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener). Documentation-validated; **no timings, no console blocks**.

```js
input.addEventListener('input', async (e) => {
  const results = await search(e.target.value);
  render(results);                              // ❌ whichever comes back last wins
});
```

Type `ca`, then `cat`. Two requests are in flight. If the response for `ca` arrives *after* the
response for `cat`, the list shows results for `ca` under the text `cat` — and stays that way
until the user types again.

🔴 **The bug is not the network. The bug is that `render` assumes the response it was handed is
the latest one.** Nothing in the platform guarantees that responses arrive in request order:
they take different routes, hit different cache states, and the slow one may be the one you
started first.

## Where a UI race comes from

Every one has the same shape — **an `await` between reading state and writing it**:

```js
const q = input.value;      // read
const r = await search(q);  // ⏸ the world changes here
render(r);                  // write, using a value that may be stale
```

While the function is suspended the user types, clicks, navigates, or another handler runs. The
suspension point is the seam
([07 · Where it suspends](../07-async-await/02-where-it-suspends.md)), and the write on the far
side of it is what needs defending.

**JavaScript's single thread does not save you.** It guarantees no *interleaved statements* — no
torn reads, no locks needed — but a race between two completions is exactly what it permits, and
that is the whole family of bugs here.

## Three defences, and how they differ

| | Cancel the previous | Ignore mismatched | Sequence number |
|---|---|---|---|
| Mechanism | `AbortController` | compare the response's key against current state | monotonic counter |
| Stops the network work | ✅ | ❌ | ❌ |
| Needs a stable key | ❌ | ✅ | ❌ |
| Handles unkeyed actions ("refresh") | ✅ | ❌ | ✅ |
| Best used | as the default | with caching / dedup | as a backstop |

They are not alternatives so much as layers: **cancel what you can, and check what you cannot
cancel.**

### 1 · Cancel the previous request

```js
let inFlight = null;

async function search(q) {
  inFlight?.abort();                              // the previous one is now irrelevant
  const ac = (inFlight = new AbortController());
  try {
    render(await getResults(q, { signal: ac.signal }));
  } catch (err) {
    if (err.name === 'AbortError') return;        // 🔴 expected — say nothing
    showError(err);
  } finally {
    if (inFlight === ac) inFlight = null;
  }
}
```

This is the strongest fix because it removes the race rather than detecting it: the stale
response never arrives at all, and the server stops working on it. Note the `finally` guard —
clearing `inFlight` unconditionally would erase a *newer* controller that replaced this one.

⚠️ **Cancelling is not free of judgement.** A cancelled request that had almost finished is work
thrown away, and for an expensive query you may prefer to let it complete into a cache and
simply not render it. That is defence 2.

### 2 · Ignore a response that no longer matches

```js
async function search(q) {
  const results = await getResults(q);
  if (q !== input.value) return;        // ✅ the input moved on — drop this result
  render(results);
}
```

One comparison, no controller, and it composes with a cache because the losing response still
lands somewhere useful. Its weakness is that it needs a **stable key** that identifies the
request and can be re-read at completion time — a query string, a route id, a record id.

🔴 **Compare against live state, not a captured copy.** `if (q !== capturedQ)` is always true and
proves nothing; the point is to read what the world looks like *now*.

### 3 · A sequence number, for actions with no key

Refresh buttons, "load more", re-fetch after a mutation — there is nothing to compare, so count
instead:

```js
let latest = 0;

async function refresh() {
  const seq = ++latest;
  const data = await load();
  if (seq !== latest) return;          // a newer refresh started while we waited
  render(data);
}
```

A monotonic counter costs one integer and is the most general of the three: it works for any
action, keyed or not. **It is also the right backstop when several different actions can write
the same region of the screen** — give the region one counter, not each action its own.

## Loading and error state race too

The most-reported symptom is not stale data — it is a spinner that never stops:

```js
setLoading(true);
try { render(await load()); } finally { setLoading(false); }   // ❌ the LAST finally wins
```

Two overlapping calls: the first finishes, sets `loading` to `false`, and the second is still
running — so the UI says "done" while it is not. Then the second finishes and sets `false`
again, this time correctly, by luck.

**Fix it the same way as the data**: only the latest attempt may write shared state.

```js
const seq = ++latest;
setLoading(true);
try {
  const data = await load();
  if (seq === latest) render(data);
} finally {
  if (seq === latest) setLoading(false);
}
```

The same applies to error banners — an error from a superseded request must not be shown, and an
old *success* must not clear the current error.

## Debouncing narrows the window; it does not close it

```js
input.addEventListener('input', debounce((e) => search(e.target.value), 300));
```

Debouncing is worth doing — it cuts the request count enormously — but it is a **rate** control,
not a **correctness** control. Two requests 300 ms apart still overlap whenever the server takes
longer than 300 ms, which is exactly when the network is bad and the user is watching.

🔴 **Never treat a debounce as the fix for a race.** It makes the bug rarer, which mostly means
it survives review and appears in production on a slow connection. Debounce for load; cancel or
sequence for correctness.

## Gotchas

**Symptom: search results briefly show the previous query's matches.**
Cause — responses arrived out of request order and the later handler rendered an older result.
Fix — abort the previous request, or compare the response's key against the current input.

**Symptom: the spinner never stops even though the data loaded.**
Cause — an older call's `finally` cleared the loading flag belonging to a newer one.
Fix — guard every shared-state write with the latest sequence number.

**Symptom: an error banner appears for a request the user already replaced.**
Cause — a superseded rejection wrote shared error state.
Fix — the same latest-only guard, and return early on `AbortError`.

**Symptom: `if (q !== capturedQuery)` never triggers.**
Cause — comparing against the value captured at call time instead of live state.
Fix — read the current value at completion time.

**Symptom: aborting the previous request sometimes cancels the current one.**
Cause — a shared controller variable was cleared or replaced without checking identity.
Fix — `if (inFlight === ac) inFlight = null` in `finally`.

**Symptom: the race still happens, just less often, after adding a debounce.**
Cause — debouncing reduces request rate; it does not order responses.
Fix — add cancellation or a sequence guard; keep the debounce for load.

## Interview questions

**★ A search-as-you-type box sometimes shows results for the previous query. Why?**
Two requests are in flight and responses need not arrive in request order. The later-arriving,
older response renders last and wins.

**★ How do you fix it?**
Cancel the previous request with an `AbortController`, and/or check at completion time that the
response still matches current state — the query string, or a monotonic sequence number for
actions with no natural key.

**★ Why does a single-threaded language have race conditions at all?**
Because the thread guarantees no interleaved *statements*, not ordered *completions*. Any
`await` between reading state and writing it is a window in which the world can change.

**★ Is debouncing a fix?**
No. It reduces how often the race occurs. Two requests spaced 300 ms apart still overlap when
the server is slower than that — precisely when users notice.

**★ Why guard the loading flag as well as the data?**
Because an older call's `finally` clears the flag for a newer one still in flight, so the UI
claims it has finished when it has not.

**★ When would you prefer ignoring a stale response over cancelling it?**
When the response is still useful — it can populate a cache — or when the request was expensive
and nearly complete. Cancelling is stronger; ignoring composes better with caching.

**What is the smallest general defence?**
A monotonic counter per screen region: increment on start, compare before every write.

---

[Topic index](./README.md) · [02 · The other UI races](./02-the-other-races.md) →
