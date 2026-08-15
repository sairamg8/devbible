---
title: "08.2 · Cancellation and timeouts"
sidebar_label: "02 · Cancellation and timeouts"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) and [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch). Documentation-validated; **nothing was run**.

A retry loop without cancellation is a loop that **keeps going after the user has navigated
away** — and, worse, sleeps for seconds between attempts while nothing can stop it. The
`AbortSignal` half is not an extra; it is what makes the retry safe to ship.

## What `AbortSignal` gives you

| Member | What it does |
|---|---|
| `AbortSignal.abort()` | *"Returns an `AbortSignal` instance that is already set as aborted."* |
| `AbortSignal.timeout(ms)` | *"Returns an `AbortSignal` instance that will automatically abort after a specified time"* |
| `AbortSignal.any(signals)` | *"Returns an `AbortSignal` that aborts when any of the given abort signals abort."* |
| `signal.aborted` | whether it has aborted |
| `signal.reason` | *"A JavaScript value providing the abort reason, once the signal has aborted."* |
| `signal.throwIfAborted()` | *"Throws the signal's abort `reason` if the signal has been aborted; otherwise it does nothing."* |

**And the two error names matter**, because they let you tell the cases apart: an aborted
fetch rejects with a `DOMException` named **`AbortError`**, while a signal from
`AbortSignal.timeout()` rejects with a **`TimeoutError`** `DOMException` — MDN notes this
explicitly *"allow[s] code to differentiate between timeouts and user aborts."*

## The retry, made cancellable

```js
const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(id); reject(signal.reason); },
                             { once: true });
  });

async function retry(fn, { attempts = 4, base = 300, cap = 10_000, signal } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    signal?.throwIfAborted();                        // before every attempt
    try {
      return await fn({ attempt, signal });
    } catch (err) {
      if (signal?.aborted) throw signal.reason;      // cancelled, not failed
      if (!isRetryable(err) || attempt === attempts - 1) throw err;
      await sleep(Math.random() * Math.min(cap, base * 2 ** attempt), signal);
    }
  }
}
```

Four things changed, and each one closes a real hole:

1. **The sleep is abortable.** A plain `setTimeout` promise cannot be cancelled, so a
   cancelled retry still waits out its backoff before noticing — the most common version of
   this bug.
2. **`throwIfAborted()` before each attempt**, so a signal that fired during the previous wait
   is honoured without starting new work.
3. **The signal is passed into `fn`**, so the in-flight request aborts too. A retry wrapper
   cannot cancel work it does not hand the signal to.
4. **An abort is never treated as a retryable failure** — the check comes before the
   retryability test, and it throws `signal.reason` so the caller sees a cancellation.

`{ once: true }` on the abort listener, and `clearTimeout` inside it, keep the wrapper from
leaking listeners or timers across attempts
([Phase 10 · 02 · `addEventListener`](../../phase-10-events/02-addeventlistener/README.md)).

## Per-attempt timeout versus overall deadline

These are different, and most APIs need both:

```js
async function fetchWithRetry(url, { signal, perAttemptMs = 5_000, totalMs = 30_000 } = {}) {
  const overall = AbortSignal.any([signal, AbortSignal.timeout(totalMs)].filter(Boolean));

  return retry(
    ({ signal: attemptSignal }) =>
      fetch(url, { signal: AbortSignal.any([attemptSignal, AbortSignal.timeout(perAttemptMs)]) }),
    { signal: overall },
  );
}
```

- **Per-attempt** stops one hung request so the next attempt can happen at all — without it, a
  connection that never answers consumes the entire retry budget.
- **Overall** bounds the whole operation, retries and sleeps included. This is what a UI
  needs: "give up after 30 seconds" is a product decision, not an arithmetic accident of
  attempts × backoff.

`AbortSignal.any` is what composes them — it *"aborts when any of the given abort signals
abort"*, so the caller's cancellation, the per-attempt timeout and the deadline all work
through one signal. Before it existed this needed a hand-rolled controller forwarding several
listeners; do not write that any more.

## Reporting the outcome honestly

Three outcomes, three different things to tell the user:

```js
try {
  await fetchWithRetry(url, { signal });
} catch (err) {
  if (err.name === "AbortError") return;                    // user navigated away — say nothing
  if (err.name === "TimeoutError") show("Took too long. Try again?");
  else show(`Failed after retries: ${err.message}`);
}
```

⚠️ **Reporting a cancellation as an error is a real bug** — the user cancelled, so an error
toast is noise, and in logs it inflates the failure rate with events that were never failures.
The `AbortError`/`TimeoutError` split is exactly why MDN calls out the distinction.

It is also worth surfacing that retries happened at all: an operation that succeeded on
attempt four is healthy from the user's side and a warning sign from the service's. Pass an
`onRetry(attempt, error, delay)` callback and log it.

## Do not build this twice

Retry, timeout, cancellation and concurrency limiting all end up in the same place in a real
codebase — the wrapper around `fetch`
([Phase 11 · 03 · A fetch wrapper](../../phase-11-network-storage/03-fetch-wrapper/README.md)).
Writing `retry` at each call site produces four subtly different policies. **One wrapper, one
policy, configured per call.**

And know what is *not* retry's job: concurrency limiting
([07](../07-task-queue/README.md)), rate limiting (**15 · A rate limiter** *(not written yet)*)
and circuit breaking — a service failing every request does not need each client retrying four
times before giving up.

## Gotchas

**Symptom:** `abort()` did not stop anything until the backoff finished
**Cause:** The sleep is a plain `setTimeout` promise with no abort path.
**Fix:** Reject the sleep on `abort`, and `clearTimeout` in the listener.

**Symptom:** A cancelled request was retried
**Cause:** `AbortError` was classified as a retryable failure.
**Fix:** Check `signal.aborted` (or `err.name === "AbortError"`) **before** the retryability
test.

**Symptom:** One hung request consumed the whole retry budget
**Cause:** No per-attempt timeout.
**Fix:** `AbortSignal.any([callerSignal, AbortSignal.timeout(perAttemptMs)])`.

**Symptom:** The operation took far longer than expected
**Cause:** Attempts × (timeout + backoff) with no overall deadline.
**Fix:** An overall `AbortSignal.timeout` composed with `AbortSignal.any`.

**Symptom:** Error toasts appeared whenever the user navigated away
**Cause:** Cancellations reported as failures.
**Fix:** Return silently on `AbortError`; distinguish `TimeoutError`.

**Symptom:** Listeners accumulated across attempts
**Cause:** An `abort` listener added per sleep without `{ once: true }` or removal.
**Fix:** `{ once: true }`, and clear the timer inside the handler.

**Symptom:** Every module has its own retry policy
**Cause:** Retry written at call sites.
**Fix:** One `fetch` wrapper owning retry, timeout and cancellation.

## Interview questions

**★ How do you make a retry loop cancellable?**
Pass an `AbortSignal` through: check `throwIfAborted()` before each attempt, hand the signal
to the task so the in-flight request aborts, and make the backoff sleep reject on abort
instead of running to completion. Treat an abort as a cancellation, never as a retryable
failure.

**★ What is the difference between `AbortError` and `TimeoutError`?**
`AbortError` means someone called `abort()`; `TimeoutError` comes from a signal created by
`AbortSignal.timeout()`. MDN calls out the distinction precisely so code can tell a user
cancellation from a deadline — and report them differently.

**★ Why do you need both a per-attempt timeout and an overall deadline?**
A per-attempt timeout stops one hung request from eating the entire budget; an overall
deadline bounds the total, including backoff sleeps. `AbortSignal.any` composes them with the
caller's own signal.

**★ What does `AbortSignal.any` do?**
Returns a signal that aborts when any of the given signals abort — the clean way to combine a
caller's cancellation with one or more timeouts, replacing a hand-rolled controller that
forwards events.

**Why must the backoff sleep be abortable?**
Otherwise a cancelled operation still sits out its wait — potentially seconds — before
noticing, which is exactly the window in which the user has already moved on.

**Where should retry live in an application?**
In one place: the `fetch` wrapper, alongside timeouts, cancellation and error normalisation.
Per-call-site retries drift into several inconsistent policies.

---

← Prev [Backoff and jitter](./01-backoff-and-jitter.md) · [Topic index](./README.md)
