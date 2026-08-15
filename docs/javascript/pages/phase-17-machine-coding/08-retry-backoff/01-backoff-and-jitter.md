---
title: "08.1 · Backoff and jitter"
sidebar_label: "01 · Backoff and jitter"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random) and [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout). Documentation-validated; **nothing was run**.

A retry loop is five lines. **The interview is the other three decisions**: what is worth
retrying, how long to wait, and why every client waiting the *same* amount is worse than not
retrying at all.

```js
async function retry(fn, { attempts = 4, base = 300, cap = 10_000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === attempts - 1) throw err;
      const backoff = Math.min(cap, base * 2 ** attempt);
      const delay = Math.random() * backoff;          // full jitter
      await sleep(delay);
    }
  }
  throw lastError;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
```

## 1 · Retry only what can succeed on a retry

**Retrying a deterministic failure is a slower failure.** The classification is the part
people skip:

| Retry | Do **not** retry |
|---|---|
| `429 Too Many Requests` | `400 Bad Request` — the body will not fix itself |
| `502`, `503`, `504` | `401`/`403` — retrying will not create a permission |
| `408 Request Timeout` | `404` — usually genuinely absent |
| Network errors (`fetch` rejects: DNS, connection reset) | `422` and other validation failures |
| An explicit "try again" from your own API | **Anything the user cancelled** |

```js
function isRetryable(err) {
  if (err.name === "AbortError") return false;         // the caller asked to stop
  if (err instanceof TypeError) return true;           // fetch's network failure
  const status = err.status;
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}
```

⚠️ **`fetch` does not reject on an HTTP error status** — a `500` is a *fulfilled* promise with
`res.ok === false`. If your `fn` does not throw for bad statuses, the retry loop never sees
them and never retries
([Phase 11 · 01 · `fetch`](../../phase-11-network-storage/01-fetch/README.md)).

**Non-idempotent requests are the other half of this.** Retrying a `GET` is free; retrying a
`POST` that already reached the server can double-charge a card. Retry writes only when they
carry an idempotency key, or when your API documents them as idempotent.

## 2 · Exponential backoff

`base * 2 ** attempt` — 300 ms, 600, 1200, 2400 — with two guards:

- **A cap** (`Math.min(cap, …)`), or the eighth attempt waits over a minute.
- **An attempt limit**, so failure is eventually reported rather than retried forever.

The reasoning: if a service is overloaded, retrying immediately adds load to a system that is
already failing. Backing off exponentially gives it room to recover, and gives a transient
blip (a dropped connection, a leader election) time to pass.

## 3 · Jitter — the part that is actually load-bearing

Without randomness, **every client that failed at the same moment retries at the same
moment**. A brief outage produces a synchronised stampede that knocks the service over again
the instant it recovers — the thundering herd.

```js
const backoff = Math.min(cap, base * 2 ** attempt);

const noJitter   = backoff;                                   // ⛔ synchronised
const full       = Math.random() * backoff;                   // ✅ the usual default
const equal      = backoff / 2 + Math.random() * backoff / 2; // half fixed, half random
const decorrelated = Math.min(cap, Math.random() * prev * 3); // walks up from the last delay
```

**Full jitter — a uniform random value between 0 and the backoff — is the sensible default.**
It spreads clients evenly and its expected wait is half the backoff, so it is also faster on
average. Equal jitter is worth it when a minimum wait matters (you do not want a retry
landing 5 ms later). Decorrelated jitter suits long-running background work.

The single most important property is simply that **two clients that failed together do not
retry together.**

## 4 · Obey the server before your own arithmetic

If the response says when to come back, that beats any formula:

```js
const retryAfter = res.headers.get("Retry-After");
const delay = retryAfter
  ? (Number(retryAfter) * 1000 || Math.max(0, Date.parse(retryAfter) - Date.now()))
  : Math.random() * Math.min(cap, base * 2 ** attempt);
```

`Retry-After` is either a number of seconds or an HTTP date, which is why both branches are
needed — `Number("Fri, 15 Aug 2026 …")` is `NaN`, and the `||` falls through to the date
parse. **Still cap it**: a server asking you to wait an hour is not something a page-load
retry should honour silently.

## 5 · Where the loop belongs

Retries go **inside** the unit of work, not around a batch:

```js
await mapWithConcurrency(urls, (u) => retry(() => fetchJSON(u)), { concurrency: 5 });
```

Retrying inside the task means a retrying task keeps its slot in the concurrency limiter
([07 · A concurrency-limited task queue](../07-task-queue/README.md)) and only the failing
item is repeated. Wrapping the whole batch in `retry` would redo everything that already
succeeded.

## Gotchas

**Symptom:** A `400` was retried four times before failing
**Cause:** No retryability check — every error treated alike.
**Fix:** Classify: 408/429/5xx and network errors retry; 4xx validation and auth do not.

**Symptom:** Nothing was ever retried, though the server was returning `500`
**Cause:** `fetch` fulfils for error statuses, so nothing threw.
**Fix:** Throw for `!res.ok` inside the task, carrying `status`.

**Symptom:** The service fell over again the moment it recovered
**Cause:** No jitter — every client retried on the same schedule.
**Fix:** Full jitter: `Math.random() * backoff`.

**Symptom:** A payment was taken twice
**Cause:** A non-idempotent `POST` was retried after it had already reached the server.
**Fix:** Retry writes only with an idempotency key.

**Symptom:** The last attempt's error was swallowed and a generic one thrown
**Cause:** The loop ended without re-throwing the captured error.
**Fix:** Keep `lastError` and throw it — or throw immediately on the final attempt, as above.

**Symptom:** Retries waited minutes
**Cause:** Exponential growth with no cap.
**Fix:** `Math.min(cap, base * 2 ** attempt)`, and cap `Retry-After` too.

**Symptom:** A whole batch was re-run because one item failed
**Cause:** The retry wrapped the batch instead of the task.
**Fix:** Retry inside the unit of work.

## Interview questions

**★ Write a retry with exponential backoff.**
Loop up to `attempts`; `await fn()` in a `try`; on failure check retryability and whether this
was the last attempt, then sleep `Math.min(cap, base * 2 ** attempt)` — randomised — before
trying again. Re-throw the last error when attempts run out.

**★ Why is jitter necessary?**
Without it, all clients that failed at the same instant retry at the same instant, so the
service is hit by a synchronised stampede exactly as it recovers. Full jitter — a uniform
random delay between 0 and the backoff — spreads them out and halves the average wait.

**★ Which failures should not be retried?**
Anything deterministic: `400`, `401`, `403`, `404`, validation errors — and anything the
caller cancelled (`AbortError`). Retrying those just fails more slowly. Also do not retry
non-idempotent writes without an idempotency key.

**★ What does `Retry-After` change?**
It overrides your formula: the server states how long to wait, as seconds or an HTTP date.
Parse both forms, and still apply your own cap so a very long value cannot stall the UI.

**Why does `fetch` need special handling in a retry loop?**
Because it only rejects for network-level failures; HTTP error statuses fulfil. Unless the
task throws for `!res.ok`, a `503` looks like success to the retry loop.

**Where should the retry live relative to a concurrency limiter?**
Inside the task. That way a retrying task holds its slot, only the failed item repeats, and
successful work is never redone.

---

[Topic index](./README.md) · Next → [Cancellation and timeouts](./02-cancellation-and-timeouts.md)
