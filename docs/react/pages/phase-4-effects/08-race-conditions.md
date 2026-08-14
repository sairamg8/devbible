---
title: "Race conditions"
sidebar_label: "08 · Race conditions"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useEffect`](https://react.dev/reference/react/useEffect) (§ Fetching data with
> Effects) and
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> (§ Fetching data); MDN
> [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
> and [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
> No sandbox script backs this page; claims are cited, not measured.

**The bug where the screen ends up showing the answer to a question the user has
already moved on from. It produces no error, no warning and no failed request —
just the wrong data, sometimes.**

## The failure

react.dev states the cause in one clause:

> network responses may arrive in a different order than you sent them

Concretely, with an effect keyed on `person`:

1. The user selects **Alice** — request A goes out.
2. Before A returns, they select **Bob** — request B goes out.
3. **B returns first.** `setBio(B)` — the screen correctly shows Bob.
4. **A returns second.** `setBio(A)` — the screen now shows *Alice's* bio while
   the selector says Bob.

Nothing failed. Both requests succeeded, both handlers ran, and the last one to
arrive won. **The most recent response is not the most recent request**, and any
code that assumes otherwise is racing.

It is intermittent by nature — it needs the second request to overtake the first,
so it usually appears on slow connections, on flaky mobile networks, or on the
one endpoint that is slower than its neighbours. Which is why it survives
testing.

## Fix 1 — the `ignore` flag

react.dev's documented answer, and the one in every fetching example on the site:

```jsx
useEffect(() => {
  let ignore = false;
  setBio(null);
  fetchBio(person).then(result => {
    if (!ignore) {
      setBio(result);
    }
  });
  return () => {
    ignore = true;
  };
}, [person]);
```

The mechanism is [topic 04](04-cleanup/README.md)'s cleanup ordering doing exactly
what it is for. When `person` changes, React runs the **old** effect's cleanup
before the new setup, so request A's `ignore` flips to `true` while B is still in
flight. When A eventually resolves, its `.then` sees its own `ignore` and does
nothing.

The detail that makes it work: **`ignore` is a plain `let` inside the setup**, so
every run gets its own. It is not shared state — there is one flag per request,
and a cleanup can only ever invalidate the request its own setup started.

> If the `userId` changes from `'Alice'` to `'Bob'`, cleanup ensures that the
> `'Alice'` response is ignored even if it arrives after `'Bob'`.

**What it does not do is cancel anything.** Request A completes, downloads its
body, and is discarded. The bug is fixed; the bandwidth is not saved.

## Fix 2 — `AbortController`

If you want the request actually stopped, the platform provides it. MDN:

> The **`AbortController`** interface represents a controller object that allows
> you to abort one or more Web requests as and when desired.

```jsx
useEffect(() => {
  const controller = new AbortController();
  setBio(null);

  fetch(`/api/bio/${person}`, { signal: controller.signal })
    .then(response => response.json())
    .then(result => setBio(result))
    .catch(err => {
      if (err.name === 'AbortError') return;   // expected — we cancelled it
      setError(err);
    });

  return () => controller.abort();
}, [person]);
```

Two things to get right:

**The rejection is not an error.** When a fetch is aborted, its promise rejects
with a **`DOMException` named `AbortError`**. If your `.catch` treats every
rejection as a failure, cancelling a request will render an error message —
turning a correctness fix into a visible bug. The `err.name === 'AbortError'`
check is mandatory, not defensive.

**No `ignore` flag is needed**, because the `.then` never runs — the promise
rejects instead of resolving.

`abort()` accepts an optional reason, and the signal exposes what happened:

| Member | What it gives you |
|---|---|
| `signal.aborted` | boolean — has it been aborted |
| `signal.reason` | the abort reason, once aborted |
| `signal.throwIfAborted()` | throws the reason if aborted, otherwise does nothing |
| `AbortSignal.timeout(ms)` | a signal that aborts itself after a time |
| `AbortSignal.any([...])` | aborts when any of the given signals aborts |

`AbortSignal.any()` is the one worth remembering for effects — it composes a
timeout with the cleanup signal, so a request is cancelled by *whichever comes
first*.

## Which one do you actually need?

| | `ignore` flag | `AbortController` |
|---|---|---|
| Fixes the stale render | ✅ | ✅ |
| Stops the request | ❌ — it completes and is discarded | ✅ |
| Frees bandwidth and a connection slot | ❌ | ✅ |
| Works for non-`fetch` async work | ✅ any promise | only APIs that accept a signal |
| Extra error handling | none | must ignore `AbortError` |
| Used in react.dev's examples | ✅ | — |

**Start with `ignore`.** It is what react.dev documents, it is four lines, it
composes with any promise-returning function — including a data layer that does
not expose a signal — and it fixes the actual defect, which is the *render*, not
the request.

**Reach for `AbortController` when the request itself is the cost**: large
payloads, a search-as-you-type box firing on every keystroke, a mobile connection
where six abandoned downloads is a real number, or a server doing expensive work
per request.

They also compose — an `ignore` flag inside a data layer, an `AbortController` at
the fetch boundary — and using both is not redundant, since `ignore` guards the
state update while `abort` guards the network.

## Neither one is a cache

Worth stating plainly, because "we fixed the race condition" often gets heard as
"we fixed data fetching". Both solutions stop the *wrong* data rendering. Neither
deduplicates two components asking for the same thing, neither remembers the
answer when the user navigates back, and neither starts the request any earlier.
Those are [topic 07](07-fetching-data.md)'s downsides, and they are untouched.

## Gotchas

**Symptom:** the wrong record's data appears occasionally, usually on a slow
connection, with no error anywhere.
**Cause:** an unguarded fetch in an effect — responses arriving out of order and
the last one winning.
**Fix:** the `ignore` flag flipped in cleanup.

**Symptom:** an error message flashes whenever the user types quickly in a search
box.
**Cause:** `AbortController` with a `.catch` that treats the `AbortError`
rejection as a real failure.
**Fix:** return early when `err.name === 'AbortError'`.

**Symptom:** the `ignore` flag was hoisted out of the effect — to a ref or a
module variable — and now only one request ever renders.
**Cause:** a shared flag. Every setup and cleanup now writes the same variable,
so one cleanup invalidates a request it never started.
**Fix:** `let ignore = false` **inside** the setup. One flag per run is the whole
mechanism.

**Symptom:** the race guard is in place but the previous record stays on screen
during loading.
**Cause:** the guard prevents the wrong update; it does not clear the old value.
**Fix:** reset the state at the top of the setup — `setBio(null)`
([topic 07](07-fetching-data.md)).

**Symptom:** two fetches appear in the Network tab in development.
**Cause:** `StrictMode`'s extra mount cycle — documented and expected.
**Fix:** nothing. The first effect's cleanup already ran, so its `ignore` is
`true` and its response is discarded
([topic 05](05-strictmode-double-invocation.md)).

**Symptom:** aborting works for `fetch` but not for the app's data-layer
function.
**Cause:** `AbortController` only cancels APIs that accept a signal; an arbitrary
promise cannot be cancelled.
**Fix:** thread a `signal` parameter through the data layer, or use the `ignore`
flag, which works with any promise.

## Interview questions

**★ What is a race condition in a data-fetching effect, and why is it hard to
catch?**
Two requests are in flight and the responses arrive out of order, so an older
response overwrites a newer one and the screen shows data for a selection the
user has already moved past. It is hard to catch because nothing fails — both
requests succeed and both handlers run correctly — and it only manifests when the
second request overtakes the first, which needs a slow or uneven network.

**★ How does the `ignore` flag fix it, and what does it not do?**
`let ignore = false` is declared inside the setup, so each run has its own copy;
the cleanup sets it to `true`, and React runs the old cleanup before the new
setup, so a superseded request's `.then` finds its own flag set and skips the
state update. It fixes the render. It does not cancel anything — the old request
still completes and downloads its body, then gets discarded.

**★ When would you use `AbortController` instead?**
When the request itself is the cost rather than just the stale render — large
payloads, search-as-you-type firing on every keystroke, expensive server work, a
mobile connection where abandoned downloads matter. The trade-off is that an
aborted fetch rejects with a `DOMException` named `AbortError`, so the `.catch`
must ignore that specific name or cancelling will render an error message. It
also only works with APIs that accept a signal, whereas the `ignore` flag works
with any promise.

**Why must the `ignore` variable be declared inside the setup function?**
Because the mechanism depends on one flag per request. Hoisted to a ref or module
scope it becomes shared, so any cleanup can invalidate a request some other setup
started — and after the first cleanup runs, subsequent responses are all
discarded. The per-run closure is what makes a cleanup able to invalidate exactly
its own setup's work.

**Does fixing the race condition fix data fetching?**
No. Both guards stop the wrong data from rendering. Neither deduplicates
concurrent requests for the same resource, caches a response for a return visit,
or starts the request before the component mounts. Those are the downsides that
make react.dev recommend a framework mechanism or a cache library in the first
place.

**Can you use both the flag and the controller?**
Yes, and it is not redundant — they guard different things. `abort()` stops the
network work; `ignore` guards the state update, including for any part of the
pipeline that does not accept a signal. A common arrangement is `ignore` inside a
shared data hook and the controller at the fetch boundary.

---

← Prev: [Fetching data in an effect](07-fetching-data.md) · Index: [Phase 4](README.md) · Next → [An effect has its own lifecycle](09-effect-lifecycle.md)
