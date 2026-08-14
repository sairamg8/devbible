---
title: "03.6 · Retries"
sidebar_label: "06 · Retries"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [`Request.body`](https://developer.mozilla.org/en-US/docs/Web/API/Request/body), [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After). Documentation-validated.

**A retry policy is three decisions, and only the first one is about code.** Getting the second
wrong duplicates orders; getting the third wrong takes down the server you were being nice to.

## 1. What is retryable?

| Failure | Retry? | Why |
|---|---|---|
| `TypeError` (network, offline, DNS) | **yes** | nothing reached the server, or the connection died |
| `TimeoutError` | **yes** | the server was slow — but see the `POST` warning below |
| `AbortError` | 🔴 **never** | the cancellation was deliberate |
| 408 Request Timeout, 429 Too Many Requests | **yes** | the server is explicitly asking |
| 500, 502, 503, 504 | **yes** | transient server-side failure |
| Other 4xx (400, 401, 403, 404, 422…) | **no** | the same input will fail the same way |

```js
function isRetryable(err) {
  if (err.name === "AbortError") return false;
  if (err.name === "TimeoutError" || err.name === "TypeError") return true;
  if (err instanceof HttpError) return err.status === 408 || err.status === 429 || err.status >= 500;
  return false;
}
```

🔴 **`AbortError` first, and by name.** It is the one case where retrying is not merely useless
but actively wrong — the user cancelled, and a retry re-issues a request they explicitly stopped.
The name check comes from
[05 · Timeouts and cancellation](./05-timeouts-and-cancellation.md); `instanceof` cannot
distinguish it from `TimeoutError`.

**Retrying a 401 is not a retry, it is a refresh** — [04 · Auth and the 401
refresh](./04-auth-and-refresh.md) — and it belongs in its own branch with its own once-only
guard.

## 2. Is the *request* safe to repeat?

HTTP defines `GET`, `HEAD`, `PUT` and `DELETE` as idempotent — issuing them twice has the same
effect as once. `POST` and `PATCH` are not.

🔴 **A retried `POST` can create two orders.** The critical insight is about what a timeout
actually means:

> A timeout means **you stopped listening**. It does not mean the server did nothing.

The request may have arrived, the row may have been written, and the response may have been lost
on the way back — or simply been slower than your 8 seconds. Retrying then submits the same
purchase a second time, and the customer is charged twice by the code that was meant to make the
app more reliable.

So: **retry a `POST` only when the endpoint accepts an idempotency key**, and send the *same* key
on every attempt:

```js
const key = crypto.randomUUID();                 // once, per logical operation

await withRetry(() =>
  api.post("orders", order, { headers: { "Idempotency-Key": key } }),
);
```

The server stores the key with the result of the first attempt and returns that stored result for
any repeat — so the duplicate is collapsed on the side that can actually see the database. **The
key must be generated outside the retry loop.** Generated inside, every attempt gets a fresh key
and the server sees genuinely distinct operations, which is the original bug with extra steps.

Without server support, do not retry `POST`. Surface the failure and let the user decide — a
"try again" button is a correct implementation of an idempotency key with a human in the loop.

## 3. How long to wait?

```js
async function withRetry(attempt, { retries = 2, base = 300, cap = 10_000 } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (err) {
      if (i >= retries || !isRetryable(err)) throw err;

      const backoff = Math.min(base * 2 ** i, cap);
      const jitter  = Math.random() * backoff;
      const wait    = err.retryAfterMs ?? backoff + jitter;

      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}
```

**Exponential** because a server that failed 300 ms ago is likely still failing; doubling gives
it room. **Capped** because `2 ** 10` seconds is not a retry, it is a hang.

🔴 **The jitter is not decoration.** Without it, every client that failed against a restarting
server retries at the same instant and knocks it over again — the thundering herd. The retries
are synchronised *by the outage itself*, so a fixed delay preserves the synchronisation
perfectly. Randomising the delay is what turns a spike back into a trickle.

**Honour `Retry-After` when the server sends it.** A 429 or 503 often carries it, and MDN
describes it as indicating *how long the user agent should wait before making a follow-up
request*. The server's number beats your formula — it knows when the rate window resets or when
maintenance ends — and ignoring it is how a client earns a longer ban.

```js
function retryAfterMs(res) {
  const header = res.headers.get("retry-after");
  if (!header) return null;

  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;    // delay-seconds form

  const date = Date.parse(header);                       // HTTP-date form
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}
```

⚠️ **Both forms are legal** — a number of seconds, or an HTTP date — so a parser that assumes one
silently returns `NaN` for the other, and `setTimeout(NaN)` fires immediately. That turns your
polite backoff into the fastest possible retry against a server that just asked you to slow down.

## Two things every attempt must rebuild

**A fresh timeout signal.** `AbortSignal.timeout(8000)` created once and reused across three
attempts is already aborted for attempts two and three — MDN: *"If any of the given abort signals
are already aborted then so will be the returned `AbortSignal`."* The signal must be built
**inside** the attempt function:

```js
// ❌ attempts 2 and 3 fail instantly
const signal = AbortSignal.timeout(8000);
await withRetry(() => fetch(url, { signal }));

// ✅
await withRetry(() => fetch(url, { signal: AbortSignal.timeout(8000) }));
```

The failure mode is nasty: three "attempts" complete in a few milliseconds, the log shows the
retry policy ran, and the request never actually went out twice.

**A fresh body.** From [04 · Auth and the 401 refresh](./04-auth-and-refresh.md), a `Request`
body is read-once, so retries must rebuild from the original inputs. A `ReadableStream` body
cannot be retried at all — refuse rather than silently sending nothing.

**The caller's cancellation must still win.** The wait between attempts should be abortable too,
or a user who navigates away during a 4-second backoff still gets a request fired afterwards.
Passing the caller's signal into the delay — or checking `signal.throwIfAborted()` before the
next attempt — closes that gap.

## What a complete wrapper ends up with

Roughly, in the order the pieces earn their place:

1. `!res.ok` → typed `HttpError` with status and body — **the one that matters**.
2. Base URL through `new URL()`, with the two normalisations.
3. Parse by `Content-Type`, with `204` and empty bodies returning `null`.
4. Header merge through `Headers`, per-call last, **no `Content-Type` for `FormData`**.
5. Auth from a *function*, and a single-flight 401 refresh that retries once.
6. Timeout via `AbortSignal.timeout()`, combined with the caller's signal via `AbortSignal.any()`.
7. Retries for idempotent requests only, with backoff, jitter and `Retry-After`.

That is roughly eighty lines. Beyond it — request/response interceptors, response caching,
deduplication of in-flight `GET`s, revalidation — **you are rebuilding a data-fetching library**,
and at that point the library is the better answer.

**The point of the exercise is knowing what each of those seven items protects you from**, which
is also exactly what the interview is asking. A candidate who writes all seven from memory but
cannot say why `POST` is excluded from retries has memorised the shape and missed the content.

## Gotchas

**Symptom:** Duplicate orders after a slow checkout
**Cause:** A `POST` was retried. The timeout meant "we stopped listening", not "the server did
nothing".
**Fix:** Do not retry non-idempotent requests without an idempotency key sent identically on
every attempt.

**Symptom:** Idempotency keys are in place and duplicates still happen
**Cause:** The key is generated inside the retry loop, so each attempt is a distinct operation.
**Fix:** Generate it once per logical operation, outside the loop.

**Symptom:** Retries two and three fail instantly
**Cause:** One `AbortSignal.timeout()` was created outside the loop and is already aborted.
**Fix:** Create the signal inside each attempt.

**Symptom:** A cancelled request still fires after the user navigates away
**Cause:** The backoff delay is not abortable; the retry proceeds when the timer expires.
**Fix:** Check the caller's signal before the next attempt, or make the delay abortable.

**Symptom:** A recovering server is knocked over again by its own clients
**Cause:** Fixed-delay retries, so every client returns at the same instant.
**Fix:** Exponential backoff **plus jitter**.

**Symptom:** The client is rate-limited harder after retrying a 429
**Cause:** `Retry-After` was ignored, or parsed as a number when it was an HTTP date — `NaN` in
`setTimeout` fires immediately.
**Fix:** Parse both forms and fall back to backoff when neither parses.

**Symptom:** A retry sends an empty body
**Cause:** A `Request` or a stream body was replayed; both are read-once.
**Fix:** Rebuild from inputs; refuse to retry stream bodies.

**Symptom:** A 404 is retried three times before failing
**Cause:** The retry predicate tested `status >= 400`.
**Fix:** Retry 408, 429 and 5xx only.

**Symptom:** A cancelled request is retried
**Cause:** `AbortError` was not excluded, or was tested with `instanceof`.
**Fix:** Check `err.name === "AbortError"` first and return `false`.

## Interview questions

**★ Which failures are safe to retry?**
Network `TypeError`, `TimeoutError`, and 408/429/5xx. Never `AbortError` — the cancellation was
deliberate. Never other 4xx — the same input will fail the same way.

**★ Why is retrying a `POST` dangerous?**
A timeout means you stopped listening, not that the server did nothing. It may have committed the
write and been slow to answer, so the retry creates a second order. Retry `POST` only against an
endpoint that accepts an idempotency key, sending the same key on every attempt.

**★ Where must an idempotency key be generated, and why?**
Outside the retry loop, once per logical operation. Generated per attempt, each retry looks like
a distinct request to the server and the key achieves nothing.

**★ Why add jitter to exponential backoff?**
Because the failure itself synchronises the clients: everyone failed at the same moment, so a
fixed delay brings everyone back at the same moment and re-breaks the recovering service.
Randomising spreads the load.

**★ Why must the timeout signal be created inside the retry loop?**
Because a signal that already aborted stays aborted — MDN: *"If any of the given abort signals
are already aborted then so will be the returned `AbortSignal`."* Attempts two and three would
fail in microseconds while the log shows a retry policy that appeared to run.

**★ What are the two forms of `Retry-After`, and what happens if you assume one?**
Delay-seconds or an HTTP date. Parsing a date with `Number()` yields `NaN`, and `setTimeout(NaN)`
fires immediately — the client hammers a server that just asked it to wait.

**When should you stop writing your own wrapper?**
Once you need interceptors, caching and in-flight deduplication you are rebuilding a
data-fetching library, and the library is the better answer. The value in writing the first
eighty lines is knowing what each of them prevents.

---

← [05 · Timeouts and cancellation](./05-timeouts-and-cancellation.md) ·
[Topic index](./README.md) · Next → [Phase index](../README.md)
