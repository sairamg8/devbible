---
title: "01 · What is safe to retry"
sidebar_label: "01 · What is safe to retry"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`fetch()` § Exceptions](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [HTTP request methods § Idempotent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods), [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After), [429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429), [503 Service Unavailable](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/503), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) — and [RFC 9110 § Method properties](https://www.rfc-editor.org/rfc/rfc9110#section-9.2), [§ Retry-After](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3). Documentation-validated; **no timings, no console blocks**.

A retry loop is three lines of code and a large amount of judgement. The code is
[02](./02-the-wrapper.md); this page is the judgement, because **retrying the wrong error is
worse than not retrying at all** — it turns one user's failure into load the server did not ask
for, and it can duplicate a payment.

🔴 **Two questions decide every retry, in this order:**
**1 · Is the failure transient?** Retrying a permanent error just wastes time.
**2 · Is the operation safe to repeat?** If the first attempt may have succeeded invisibly,
a retry can do the work twice.

Both must be yes. Either alone is not enough.

## Question 1 · Transient or permanent

| Failure | Retry? | Why |
|---|---|---|
| Network error / DNS failure / connection reset | ✅ | the request may never have reached the server |
| Timeout (`TimeoutError`) | ⚠️ **maybe** | it may also have *succeeded* slowly — see question 2 |
| **408** Request Timeout, **425** Too Early | ✅ | the server is telling you to try again |
| **429** Too Many Requests | ✅ **but obey `Retry-After`** | you are being rate-limited |
| **500**, **502**, **503**, **504** | ✅ | server-side and usually transient |
| **400**, **401**, **403**, **404**, **422** | ❌ | the request is wrong; repeating it changes nothing |
| **409** Conflict | ❌ mostly | state disagreement, not a transient fault |
| `AbortError` from your own signal | ❌ **never** | you cancelled it on purpose |
| A `TypeError` from your own code | ❌ | a bug does not get better on the second call |

⚠️ **`fetch` does not reject on 4xx or 5xx.** Its promise fulfils with `res.ok === false`, and it
rejects only on a genuine network failure — with a `TypeError`. So a retry predicate that only
inspects rejections will never see a 503, and one that retries every rejection will happily
retry a programming error. Classify **both** the rejection and the response.

```js
function isRetryable(errOrRes) {
  if (errOrRes instanceof Response) return [408, 425, 429, 500, 502, 503, 504].includes(errOrRes.status);
  if (errOrRes?.name === 'AbortError') return false;      // we cancelled: never retry
  if (errOrRes?.name === 'TimeoutError') return true;     // subject to question 2
  return errOrRes instanceof TypeError;                    // fetch's network failure
}
```

🔴 **Never retry your own `AbortError`.** It is the one error that means "stop", and a retry loop
that treats it as a transient failure is a cancel button that does nothing. This is why
[14 · Cancellation](../14-cancellation/02-composing-signals.md) makes `AbortSignal.timeout`
abort with `TimeoutError` instead — the two need opposite handling and must stay
distinguishable.

### `Retry-After` outranks your backoff

When a **429** or **503** carries a `Retry-After` header, the server has told you when to come
back — in **seconds**, or as an **HTTP date**. Honour it; your exponential schedule is a guess
and this is not.

```js
function retryAfterMs(res) {
  const h = res.headers.get('Retry-After');
  if (!h) return null;
  const seconds = Number(h);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(h);                    // HTTP-date form
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}
```

⚠️ **Sanity-check the value before sleeping on it.** A misconfigured service can send a
`Retry-After` of hours; cap it against your own deadline and give up rather than hang.

## Question 2 · Is repeating it safe?

A retry is only safe when doing the operation twice is indistinguishable from doing it once.

**RFC 9110 defines which methods are idempotent**: `GET`, `HEAD`, `PUT`, `DELETE`, `OPTIONS`
and `TRACE` are, and **`POST` and `PATCH` are not**. That is a statement about the *method's
contract*, not a guarantee about a particular server — but it is the right default.

| Operation | Safe to retry? |
|---|---|
| `GET /orders/42` | ✅ — reading twice is reading |
| `PUT /users/7` with a full body | ✅ — the same write, same result |
| `DELETE /session` | ✅ — already-deleted is the same end state |
| `POST /payments` | 🔴 **no** — unless the server deduplicates |
| `POST /search` used as a query | ⚠️ effectively safe, but the method does not say so |

🔴 **The dangerous case is a timeout on a non-idempotent request.** You never learn whether the
server processed it: the response was lost, not the request. Retrying may charge the card twice.

**The fix is server-side and standard practice: an idempotency key.** The client generates a
unique id per *logical* operation, sends it as a header, and reuses the same key on every
retry; the server records it and returns the original result rather than performing the work
again. Several major payment and messaging APIs implement exactly this, and it is what makes a
`POST` retryable at all.

```js
const key = crypto.randomUUID();               // once per operation, NOT per attempt
await withRetry(() => fetch('/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  body: JSON.stringify(payment),
}));
```

**Generating the key inside the retry loop defeats the whole mechanism** — each attempt would
look like a new operation. Generate it once, outside.

## Timeouts come before retries

There is no point retrying a request that will never finish, and no way to retry one that has
not failed yet. **Every retryable call needs a per-attempt timeout**, or the loop can hang on
its first attempt forever.

```js
await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) });
```

Three separate limits are worth keeping distinct, and applications routinely confuse them:

| Limit | Applies to | Typical shape |
|---|---|---|
| **Per-attempt timeout** | one request | `AbortSignal.timeout(ms)` per attempt |
| **Total deadline** | the whole retry sequence | one signal created before the loop |
| **Attempt cap** | the number of tries | `for (let i = 0; i < max; i++)` |

🔴 **A per-attempt timeout without a total deadline is unbounded.** Five attempts of three
seconds plus backoff can easily exceed what the caller is willing to wait, and a user staring
at a spinner has their own deadline. The wrapper in [02](./02-the-wrapper.md) enforces both.

**Choose the per-attempt timeout from what the operation actually needs**, not from a round
number. A timeout shorter than the service's normal response time turns healthy traffic into a
retry storm — every request times out, every one is retried, and the load triples exactly when
the service is already slow.

## Where retries belong: one layer, not every layer

Retries **multiply** when they are nested. A client that retries 3 times, calling a gateway that
retries 3 times, calling a service that retries 3 times, produces **27 requests** for one user
action — and each layer thinks it is being resilient. This retry amplification is the documented
failure mode behind a number of large outages, and it is the reason AWS's own guidance on
timeouts, retries and backoff stresses limiting retries to a single layer.

🔴 **Decide, per system, which layer owns retries — and make every other layer fail fast.**
For a browser application that is almost always the client call itself, closest to the user, who
is the only party that can be told "still trying".

When a dependency is failing persistently, retrying at all is the wrong response: a **circuit
breaker** stops sending traffic for a cooling-off period and fails immediately instead. That
belongs in a service layer rather than a page, but the vocabulary is worth having.

## Gotchas

**Symptom: the retry loop never sees a 503.**
Cause — `fetch` fulfils for 4xx/5xx; only network errors reject.
Fix — classify the `Response` as well as the rejection.

**Symptom: cancelling does nothing; the request keeps coming back.**
Cause — the loop retried its own `AbortError`.
Fix — return immediately on `AbortError`, and check the signal before each attempt.

**Symptom: a payment was taken twice.**
Cause — a non-idempotent `POST` was retried after a timeout, and the first attempt had succeeded.
Fix — an idempotency key generated once per operation, or no retry at all.

**Symptom: retrying makes an overloaded service worse.**
Cause — every client retries immediately and in step, or a `Retry-After` was ignored.
Fix — honour `Retry-After`, back off exponentially, and add jitter ([02](./02-the-wrapper.md)).

**Symptom: one user action produced dozens of requests.**
Cause — retry amplification; several layers each retry.
Fix — pick one layer to own retries; everywhere else fails fast.

**Symptom: the operation hangs for minutes before reporting failure.**
Cause — attempt timeouts but no total deadline.
Fix — one signal for the whole sequence, plus a per-attempt timeout composed with it.

**Symptom: healthy requests time out and are all retried.**
Cause — a per-attempt timeout below the service's normal latency.
Fix — set it from observed behaviour, not a round number.

## Interview questions

**★ Which HTTP failures are safe to retry?**
Transient ones: network errors, 408, 425, 429 (obeying `Retry-After`), and 5xx like 500, 502,
503, 504. Not 4xx client errors — the request is wrong and repeating it changes nothing — and
never your own `AbortError`.

**★ Why can't you just retry every rejected `fetch`?**
Because `fetch` rejects only on network failure, so you would miss every 5xx, and you would also
retry programming errors and deliberate cancellations. Classify the response and the error
separately.

**★ Is it safe to retry a `POST` that timed out?**
Not by default — a timeout does not tell you whether the server processed it, so you may
duplicate the effect. It becomes safe when the server deduplicates on an idempotency key that
you generate once per operation and reuse on every attempt.

**★ What is retry amplification?**
Retries nested at several layers multiply: three layers retrying three times each produce 27
requests for one action. Own retries at exactly one layer and fail fast everywhere else.

**★ What is the difference between a per-attempt timeout and a deadline?**
The per-attempt timeout bounds one request; the deadline bounds the whole sequence including
backoff. Without the deadline the total wait is unbounded.

**★ The server sends `Retry-After: 120`. What do you do?**
Wait that long instead of your computed backoff — it is authoritative — but cap it against your
own deadline and give up rather than sleeping past it. It may also be an HTTP date rather than
seconds.

**When should you stop retrying entirely?**
When the dependency is failing persistently rather than transiently — that is a circuit-breaker
situation, where the right response is to fail fast for a cooling-off period.

---

[Topic index](./README.md) · [02 · The wrapper](./02-the-wrapper.md) →
