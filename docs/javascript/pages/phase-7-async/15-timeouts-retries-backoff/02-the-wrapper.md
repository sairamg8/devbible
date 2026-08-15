---
title: "02 · The wrapper — backoff, jitter and a deadline"
sidebar_label: "02 · The wrapper"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [`AbortSignal.throwIfAborted()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted), [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause), [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random) — and the AWS Builders' Library, [*Timeouts, retries and backoff with jitter*](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/). Documentation-validated; **no timings, no console blocks**.

[01](./01-what-is-safe-to-retry.md) decided *whether* to retry. This page is the wrapper that
does it: exponential backoff, jitter, a cap, a deadline, and an `AbortSignal` running through
all of it.

## Why plain exponential backoff is not enough

Doubling the wait after each failure — 100 ms, 200 ms, 400 ms, 800 ms — solves the first
problem: it stops a single client hammering a service that is already struggling.

🔴 **It does not solve the second, and the second is the one that takes services down.** When a
shared dependency fails, *every* client fails at once, and every client computes the *same*
backoff schedule. They retry in lockstep — a synchronised wave at 100 ms, another at 300 ms,
another at 700 ms. The service gets no quiet period in which to recover, and each wave can
knock it back down. This is the thundering herd, and AWS's own guidance on retries exists
largely to describe it.

**Jitter is the fix: randomise the wait so the herd spreads out.** The variant that spreads best
is the simplest — pick uniformly between zero and the current ceiling:

```js
const backoff = (attempt, base = 200, cap = 10_000) =>
  Math.min(cap, base * 2 ** attempt);            // the ceiling: 200, 400, 800, 1600 …

const withJitter = (ms) => Math.random() * ms;   // full jitter: anywhere in [0, ceiling)
```

| Strategy | Wait for attempt *n* | Herd behaviour |
|---|---|---|
| Fixed delay | `d` | 🔴 worst — everyone retries together, forever |
| Exponential, no jitter | `base · 2ⁿ` | still synchronised, just further apart |
| **Full jitter** | `random(0, base · 2ⁿ)` | ✅ spread across the whole window |
| Equal jitter | `half + random(0, half)` | spread, with a guaranteed minimum wait |

**Always cap the ceiling.** Unbounded doubling reaches minutes within a handful of attempts, and
a user is not waiting that long. The cap and the deadline together are what make the wrapper
bounded.

## The wrapper, in full

```js
async function withRetry(attempt, {
  retries = 3,              // extra attempts after the first
  base = 200,               // first backoff ceiling, ms
  cap = 10_000,             // maximum backoff ceiling, ms
  timeoutMs = 5000,         // per-attempt timeout
  deadlineMs = 20_000,      // total budget for the whole sequence
  isRetryable,              // from 01
  signal,                   // the caller's cancellation
} = {}) {
  const deadline = AbortSignal.timeout(deadlineMs);
  const overall = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let last;

  for (let i = 0; i <= retries; i++) {
    overall.throwIfAborted();                                  // 1 · out of budget or cancelled
    const perAttempt = AbortSignal.any([overall, AbortSignal.timeout(timeoutMs)]);

    try {
      const result = await attempt({ signal: perAttempt });    // 2 · the signal goes DOWN
      if (!(result instanceof Response) || result.ok) return result;
      last = result;
      if (!isRetryable(result)) return result;                 // 3 · a permanent 4xx: hand it back
      await sleep(waitFor(result, i), overall);
      continue;
    } catch (err) {
      if (err.name === 'AbortError') throw err;                // 4 · cancelled: never retry
      if (!isRetryable(err) || i === retries) {
        throw new Error(`Failed after ${i + 1} attempt(s)`, { cause: err });
      }
      last = err;
      await sleep(withJitter(backoff(i, base, cap)), overall);
    }
  }
  throw new Error('Retries exhausted', { cause: last });

  function waitFor(res, i) {
    return retryAfterMs(res) ?? withJitter(backoff(i, base, cap));   // the server outranks us
  }
}
```

`sleep` is the cancellable `delay` from
[12 · Tying a timer to an `AbortSignal`](../12-timers/01-the-api.md) — **a backoff that ignores
the signal is a cancel button with a five-second lag**, which users read as broken.

### The five decisions encoded in it

| Line | Decision |
|---|---|
| `overall.throwIfAborted()` at the top of each turn | the deadline and the caller's cancel are checked *before* work, not after |
| `AbortSignal.any([overall, timeout])` | a per-attempt timeout that still respects the total budget |
| `attempt({ signal })` | the signal is **passed down**; the wrapper cannot cancel what it does not reach |
| `err.name === 'AbortError'` first | cancellation escapes immediately and is never retried |
| `new Error(..., { cause })` | the final throw keeps the original failure attached |

🔴 **`{ cause }` is what makes a retry wrapper debuggable.** Without it every failure in the
system arrives as "Failed after 4 attempts" and the actual network error, status code and stack
are gone. It is the same discipline as
[08 · Rejections that vanish](../08-error-handling/02-rejections-that-vanish.md).

## What the wrapper must not swallow

**A 4xx is a result, not a retry.** Notice the wrapper *returns* a non-retryable `Response`
rather than throwing — the caller asked for a request, and a 404 is a real answer. Turning every
non-`ok` response into an exception is a separate design decision, and it belongs to the calling
layer, not the retry layer.

**Do not log per attempt from inside the wrapper.** A wrapper that reports every failed attempt
to your error service multiplies the noise by the retry count and hides the one failure that
mattered. Log once, at the end, with the attempt count and the `cause`.

## Where the retry wrapper goes

```js
const getOrder = (id, opts) =>
  withRetry(({ signal }) => fetch(`/orders/${id}`, { signal }), { ...opts, isRetryable });
```

**Wrap the request, not the render.** The function passed in should do exactly one attempt of
one operation, take a `signal`, and have no side effects of its own — no state updates, no
toasts, no cache writes. Anything that runs per attempt runs *n* times.

⚠️ **Retries and the UI.** A retry sequence with backoff can run for many seconds, during which
the user sees nothing at all. Report the state honestly — "retrying" is more useful than a
spinner that looks identical to a fast request — and always leave the cancel path working, which
is precisely what threading the caller's signal through buys you.

**Do not retry in more than one layer.** The amplification argument is in
[01](./01-what-is-safe-to-retry.md); the practical rule is that if this wrapper is in your data
layer, the components above it call it once and handle the failure.

## Gotchas

**Symptom: a burst of clients all retry at the same instants.**
Cause — exponential backoff with no jitter; every client computes the same schedule.
Fix — full jitter: `Math.random() * ceiling`.

**Symptom: cancelling during a backoff does nothing for several seconds.**
Cause — the sleep is a bare `setTimeout` that ignores the signal.
Fix — a cancellable `delay(ms, { signal })`, and check `throwIfAborted()` each turn.

**Symptom: the wrapper retries a cancelled request forever.**
Cause — `AbortError` was treated as a transient failure.
Fix — rethrow it before the retry decision.

**Symptom: the error report says only "Failed after 4 attempts".**
Cause — the wrapper threw a fresh `Error` with no `cause`.
Fix — `new Error(msg, { cause: err })`, and log once at the end.

**Symptom: backoff reaches minutes.**
Cause — no cap on the ceiling.
Fix — `Math.min(cap, base * 2 ** attempt)`, and a total deadline as the real bound.

**Symptom: a duplicate record appears after a retry.**
Cause — the attempt function had side effects, or the operation was not idempotent.
Fix — one attempt does one call; use an idempotency key for non-idempotent writes.

**Symptom: your error dashboard shows four times the real failure rate.**
Cause — the wrapper reports every attempt.
Fix — report once, at exhaustion, with the attempt count.

## Interview questions

**★ Why add jitter to exponential backoff?**
Because backoff alone keeps every client synchronised — they all fail together and all compute
the same schedule, so they retry in waves. Randomising the wait spreads the load and gives the
dependency a chance to recover.

**★ Write the backoff formula you would use.**
`Math.random() * Math.min(cap, base * 2 ** attempt)` — full jitter over a capped exponential
ceiling — with `Retry-After` taking precedence when the server sends it.

**★ What limits does a retry wrapper need?**
Three: a per-attempt timeout, a total deadline for the whole sequence, and a maximum attempt
count. The per-attempt timeout alone leaves the total time unbounded.

**★ How does cancellation survive a retry loop?**
The caller's signal is composed with the deadline, checked with `throwIfAborted()` before every
attempt, passed down into the attempt itself, and used by the backoff sleep. And `AbortError` is
rethrown rather than retried.

**★ Why wrap the final failure in an `Error` with `cause`?**
So the original network error or status survives. "Failed after 4 attempts" with nothing attached
is unactionable in production.

**★ Where in the stack should retries live?**
In exactly one layer. Nested retries multiply — three layers at three attempts each is 27
requests for one user action.

**Why does the wrapper return a 404 instead of throwing?**
Because it is a real answer to the request, not a transient fault. Deciding that a non-`ok`
response is an exception is the caller's policy, not the retry layer's.

---

← [01 · What is safe to retry](./01-what-is-safe-to-retry.md) · [Topic index](./README.md)
