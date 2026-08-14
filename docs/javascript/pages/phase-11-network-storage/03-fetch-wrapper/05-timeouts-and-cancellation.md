---
title: "03.5 · Timeouts and cancellation"
sidebar_label: "05 · Timeouts and cancellation"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [`AbortController.abort()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). Documentation-validated.

**`fetch` has no timeout.** Not a long one — none. A request to a server that accepts the
connection and then says nothing will sit there until the browser gives up, which can be
minutes. Every production wrapper adds one, and the mechanism is `AbortSignal`.

## The timeout is one line

```js
await fetch(url, { signal: AbortSignal.timeout(8000) });
```

MDN:

> "The **`AbortSignal.timeout()`** static method returns an `AbortSignal` that will automatically
> abort after a specified time."

> "The signal aborts with a `TimeoutError` `DOMException` on timeout."

🔴 **`TimeoutError`, not `AbortError`** — and that distinction is the whole reason this is worth
learning properly. A user who navigated away and a server that hung look identical to naive
code, and they need opposite handling: one is silence, the other is a retry or an error message.

One caveat MDN calls out:

> "The timeout is based on active rather than elapsed time, and will effectively be paused if the
> code is running in a suspended worker, or while the document is in a back-forward cache
> ('bfcache')."

So a request started before a tab is backgrounded does not necessarily time out on wall-clock
schedule. That is usually what you want — a user returning to a tab should not find everything
timed out — but it means **a timeout is not a promise about elapsed seconds**, and code that
reasons about deadlines (a token expiry, a lock lease) cannot use it as one.

## Distinguishing the three failures

After `await fetch(...)` rejects there are exactly three interesting cases:

```js
try {
  const res = await fetch(url, { signal });
} catch (err) {
  if (err.name === "TimeoutError") …   // the server was too slow
  if (err.name === "AbortError")   …   // someone cancelled deliberately
  if (err.name === "TypeError")    …   // network / CORS / bad URL
  throw err;
}
```

- **`TimeoutError`** — from `AbortSignal.timeout()`. Retryable.
- **`AbortError`** — from `controller.abort()`. MDN: *"If not specified, the reason is set to
  `"AbortError"` `DOMException`."* 🔴 **Never retryable and never shown to the user** — you
  cancelled it on purpose.
- **`TypeError`** — the network-level failure from
  [01 · The critical surprise](../01-fetch/01-the-critical-surprise.md), deliberately vague
  because saying more would leak cross-origin information.

🔴 **Check `err.name`, not `instanceof`.** `TimeoutError` and `AbortError` are both
`DOMException`, so `instanceof DOMException` is true for both and tells you nothing. This is one
of the few places in JavaScript where comparing a string is the correct idiom rather than a
smell — the name *is* the type here.

⚠️ `abort()` takes an optional reason, so `controller.abort(new StaleQueryError())` makes `err`
your own object and `err.name` whatever you set. That is useful — a wrapper that aborts
internally should pass a distinguishable reason rather than reusing the default `AbortError`,
so its own cancellations can be told from the caller's.

`signal.reason` holds it either way — MDN: *"A JavaScript value providing the abort reason, once
the signal has aborted"* — and `signal.throwIfAborted()` *"Throws the signal's abort `reason` if
the signal has been aborted; otherwise it does nothing"*, which is the tidy way to bail out
between steps of a multi-request operation.

## Cancelling deliberately

The two cases that matter in application code:

```js
// a search box: each keystroke supersedes the last request
let controller;
function search(term) {
  controller?.abort();                       // cancel the previous one
  controller = new AbortController();
  return api.get(`search?q=${term}`, { signal: controller.signal });
}
```

```js
// a component unmounting
useEffect(() => {
  const controller = new AbortController();
  load({ signal: controller.signal });
  return () => controller.abort();
}, []);
```

Both produce an `AbortError` that **must be swallowed**, not surfaced. An error toast that says
"request failed" every time a user types a letter, or navigates away, is the classic symptom of
a wrapper that treats every rejection as a failure.

MDN on what `abort()` reaches:

> "The **`abort()`** method of the `AbortController` interface aborts an asynchronous operation
> before it has completed. This is able to abort fetch requests, the consumption of any response
> bodies, or streams."

**"The consumption of any response bodies"** is the part people miss: aborting after the headers
arrived also kills an in-progress `res.json()`. So a long download can be cancelled mid-read,
and the rejection surfaces from the *parse*, not the fetch.

## Combining the caller's signal with the wrapper's timeout

A wrapper needs a timeout. The **caller** also needs to cancel. Both must work, so the two
signals have to be combined. Before `AbortSignal.any()` this meant wiring listeners by hand;
now:

```js
function combine(callerSignal, ms) {
  const timeout = AbortSignal.timeout(ms);
  return callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
}
```

MDN:

> "The **`AbortSignal.any()`** static method takes an iterable of abort signals and returns an
> `AbortSignal`. The returned abort signal is aborted when any of the input iterable abort
> signals are aborted."

> "The abort reason will be set to the reason of the first signal that is aborted. If any of the
> given abort signals are already aborted then so will be the returned `AbortSignal`."

🔴 **"The reason of the first signal that is aborted" is what preserves the distinction above.**
Combine them this way and a timeout still surfaces as `TimeoutError`, a caller cancel still as
`AbortError`. Roll your own combiner with a fresh `AbortController` and both flatten into one
generic `AbortError` — and with them goes the ability to retry the right one.

**Availability:** MDN records `AbortSignal.any()` as **Baseline 2024 — newly available**
("Since March 2024, this feature works across the latest devices and browser versions. This
feature might not work in older devices or browsers."). `AbortSignal.timeout()` is older but not
ancient. An app supporting older browsers needs a fallback for both — a controller plus
`setTimeout`, and manual `addEventListener("abort", …)` forwarding — which is exactly the
boilerplate these two statics removed.

## Version 4 — timeout and cancellation wired in

```js
export function createClient({ baseUrl, getToken, timeout = 8000 } = {}) {
  return async function request(path, { method = "GET", body, headers, signal, ...rest } = {}) {
    const url = new URL(String(path).replace(/^\/+/, ""), baseUrl);
    const { body: encoded, type } = encodeBody(body);

    const res = await fetch(url, {
      method,
      body: encoded,
      headers: mergeHeaders({ Accept: "application/json" },
                            type ? { "Content-Type": type } : null,
                            await authHeader(getToken),
                            headers),
      signal: combine(signal, timeout),
      ...rest,
    });

    if (!res.ok) { /* 01 · typed HttpError */ }
    return parse(res);
  };
}
```

🔴 **`signal` is destructured out by name rather than left in `...rest`.** Leaving it there lets
the caller's signal overwrite the combined one — the wrapper's timeout silently stops existing,
and nobody notices until a hung server takes a page down. It is a one-word bug with a
production-shaped consequence.

**Choosing the number:** 8 seconds is a reasonable default for an API call and far too short for
a file upload. Make it per-call overridable, and remember the timeout covers the *whole*
exchange, headers and body — a slow 50 MB download will trip an 8-second timeout even though
nothing is wrong.

## Gotchas

**Symptom:** A request hangs for minutes
**Cause:** `fetch` has no default timeout.
**Fix:** `signal: AbortSignal.timeout(ms)`.

**Symptom:** A cancelled request shows an error toast
**Cause:** `AbortError` was handled like a failure. The user navigated away or typed another
letter.
**Fix:** Check `err.name === "AbortError"` and return silently.

**Symptom:** Timeouts and cancellations cannot be told apart
**Cause:** They are both `DOMException`, so `instanceof` cannot separate them.
**Fix:** Compare `err.name` — `TimeoutError` from `AbortSignal.timeout()`, `AbortError` from
`controller.abort()`.

**Symptom:** After adding a wrapper timeout, the caller's cancel stops working
**Cause:** The caller's `signal` was overwritten by the wrapper's — or spread through `...rest`
and overwrote the wrapper's.
**Fix:** `AbortSignal.any([callerSignal, timeoutSignal])`, and destructure `signal` explicitly.

**Symptom:** Everything reports `AbortError`, even timeouts
**Cause:** A hand-rolled combiner used a fresh `AbortController`, discarding the original reason.
**Fix:** `AbortSignal.any()` — MDN: *"the abort reason will be set to the reason of the first
signal that is aborted."*

**Symptom:** A large download times out although the connection is fine
**Cause:** The timeout covers the whole exchange including the body, not just the response
headers.
**Fix:** A longer, per-call timeout for downloads and uploads.

**Symptom:** A backgrounded tab's request does not time out on schedule
**Cause:** MDN: *"The timeout is based on active rather than elapsed time"* and is paused in
bfcache or a suspended worker.
**Fix:** Nothing to fix — but do not use it as a deadline for anything time-sensitive.

**Symptom:** A rejection surfaces from `res.json()` rather than `fetch`
**Cause:** The abort landed after the headers arrived. MDN: `abort()` *"is able to abort fetch
requests, the consumption of any response bodies, or streams."*
**Fix:** Handle abort names around the whole operation, not only the `fetch` call.

## Interview questions

**★ What is `fetch`'s default timeout?**
There isn't one. A server that accepts the connection and stalls holds the request until the
browser gives up. Timeouts are opt-in via `AbortSignal.timeout(ms)`, which MDN documents as
aborting *"with a `TimeoutError` `DOMException`"*.

**★ How do you distinguish a timeout from a user cancellation?**
By `err.name`: `TimeoutError` versus `AbortError`. Both are `DOMException`, so `instanceof` does
not help. It matters because a timeout is retryable and worth reporting, while a cancellation
must be silent.

**★ Your wrapper adds a timeout and the caller also passes a signal. How do you honour both?**
`AbortSignal.any([callerSignal, AbortSignal.timeout(ms)])` — the returned signal aborts when
either does, and MDN specifies *"the abort reason will be set to the reason of the first signal
that is aborted"*, so the `TimeoutError`/`AbortError` distinction survives. A hand-rolled
combiner built on a new `AbortController` loses it.

**★ Why is `signal` destructured out of the options instead of spread through?**
Because `{ ...rest }` would let the caller's raw signal overwrite the combined one, removing the
wrapper's timeout without any visible error.

**★ Does an abort stop anything after the response has started?**
Yes — MDN: `abort()` *"is able to abort fetch requests, the consumption of any response bodies,
or streams."* A cancellation during a large `res.json()` rejects the parse.

**Why does a request in a backgrounded tab outlive its timeout?**
The timeout is measured in *active* time and is paused in bfcache or a suspended worker. Useful
behaviour, but it means the timeout is not a wall-clock deadline.

**What does `signal.throwIfAborted()` give you?**
A one-line bail-out between steps of a multi-request operation: it *"throws the signal's abort
reason if the signal has been aborted; otherwise it does nothing"*, so you do not have to
re-check a flag by hand.

---

← [04 · Auth and refresh](./04-auth-and-refresh.md) · [Topic index](./README.md) ·
Next → [06 · Retries](./06-retries.md)
