---
title: "03.1 · Composing the client"
sidebar_label: "01 · Composing the client"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers), [`Response.clone()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone). Documentation-validated; **no timings**.

**The mechanics of the wrapper are
[Phase 11 · 03](../../phase-11-network-storage/03-fetch-wrapper/README.md)** — the `ok` check, the
typed error, the header merge, the timeout, the retry policy. This topic is what changes when it
becomes the *one* client a whole storefront depends on, and the answer is mostly **layering** and
one new capability: **single-flight deduplication**.

## The layers, in order

🔴 **Each layer wraps the next, and the order is not arbitrary:**

```
call site
  └── deduplication      ← identical in-flight GETs share one request
        └── retry        ← backoff, jitter, only idempotent methods
              └── auth   ← token injection, single-flight 401 refresh
                    └── timeout + abort
                          └── fetch
```

- **Deduplication is outermost** so a deduplicated call also shares the retries — otherwise five
  callers each retry the same failing request.
- **Retry sits above auth** so a refreshed token is used by the retry. Below it, the retry would
  reuse the expired one.
- **Timeout is innermost** so it measures the actual network attempt, not the retry sequence. 🔴
  **A timeout wrapped around the retries would abort mid-backoff**, which looks like a flaky API
  and is the client's own bug.

⚠️ **Getting the order wrong produces behaviour that is hard to attribute** — every symptom points
at the server. Being able to state the ordering and the reason for each is the substance of this
topic.

## Single-flight deduplication

**The problem the storefront has:** a page mounts a header, a cart badge and a mini-cart, and all
three request `GET /cart` in the same tick. Three identical requests, three responses, one of which
is used.

```js
const inFlight = new Map();

function dedupe(key, run) {
  if (inFlight.has(key)) return inFlight.get(key);        // 🔴 share the promise

  const promise = run().finally(() => inFlight.delete(key));   // 🔴 clear in finally
  inFlight.set(key, promise);
  return promise;
}
```

Three rules, and each is load-bearing:

- 🔴 **Only `GET`/`HEAD`.** Deduplicating a `POST` means two logically distinct orders collapse
  into one. The key must include the method, and non-idempotent methods must bypass the map
  entirely.
- 🔴 **Clear in `finally`, not `then`.** A failed request left in the map poisons every later caller
  with the same rejection, and the only recovery is a reload — the same trap as the 401 refresh
  ([Phase 11 · 03 · 04](../../phase-11-network-storage/03-fetch-wrapper/04-auth-and-refresh.md)).
- 🔴 **Every caller gets the *same promise*, therefore the same resolved object.** If one consumer
  mutates the result, every other consumer sees the mutation. Either freeze it, or hand out a copy
  per caller — and say which you chose.

**The key must capture everything that changes the response:**

```js
const key = `${method} ${url} ${credentialsMode} ${relevantHeaders}`;
```

⚠️ **Two requests to the same URL with different `Authorization` headers are different requests.**
A key of URL alone will serve one user's cart to another after a login switch — the worst class of
bug in this file.

## This is not a cache

🔴 **Deduplication and caching are different, and conflating them is the mistake.** Dedupe shares
*in-flight* requests and forgets immediately; a cache retains *completed* responses for a
lifetime.

| | Deduplication | Cache |
|---|---|---|
| Lifetime | until the request settles | a TTL |
| Staleness | impossible — it is the live request | the whole design problem |
| Invalidation | none needed | required, and hard |
| Risk | shared mutable result | serving stale data |

**Dedupe is safe to add today; caching is a design decision.** If you find yourself adding a TTL to
the dedupe map, you are building a cache and should say so — and then handle invalidation on
mutation, which is the part that makes it hard.

## What the storefront needs on top

**A base URL and a versioned prefix** —
[Phase 11 · 03 · 02](../../phase-11-network-storage/03-fetch-wrapper/02-urls-and-parsing.md), with
the two resolution rules that make a version prefix disappear.

**A request id per call**, echoed in a header, so a client error and a server log line can be
matched:

```js
headers.set("X-Request-Id", crypto.randomUUID());
```

⚠️ **A new id per *attempt*, but the idempotency key stays constant across retries** — they answer
different questions ([07 · Idempotency from the client](../07-idempotency/README.md)).

**Typed errors the UI can branch on** — `HttpError` with `status` and `body`, so a 409 opens a
conflict dialog and a 503 shows a retry banner without the UI parsing messages.

**One place that knows about auth**, so a 401 refresh happens once for a burst rather than once per
widget — the single-flight pattern again, applied to a different problem.

## What to leave out

⚠️ **Do not add interceptors "for later".** A request/response interceptor chain is where a client
becomes a framework and where a stack trace stops telling you which code changed the request. Add
one when a second concrete need appears.

⚠️ **Do not put UI in the client.** A client that shows a toast on every 401 cannot be used by the
login form, which needs to show the 401 inline.

🔴 **And know when to stop.** Once you need response caching, revalidation and cache invalidation
across mutations, you are rebuilding a data-fetching library — and the library is the better answer.
The value of writing these ~120 lines is knowing exactly what each of them prevents.

## Gotchas

**Symptom:** Retries reuse an expired token
**Cause:** Retry is layered below auth.
**Fix:** Retry above auth, so the refreshed token is used.

**Symptom:** Requests abort mid-backoff
**Cause:** The timeout wraps the retry sequence instead of the attempt.
**Fix:** Timeout innermost, per attempt.

**Symptom:** Five callers each retry the same failing request
**Cause:** Deduplication inside the retry layer.
**Fix:** Dedupe outermost.

**Symptom:** After a login switch, one user sees another's data
**Cause:** The dedupe key was the URL only.
**Fix:** Include the method, credentials mode and auth-relevant headers.

**Symptom:** One failed request breaks every later call to that URL
**Cause:** The in-flight entry was cleared in `then`, not `finally`.
**Fix:** `finally`.

**Symptom:** Mutating a fetched object changes it for another component
**Cause:** Deduped callers share one resolved object.
**Fix:** Freeze it, or return a copy per caller.

**Symptom:** Two orders are created as one
**Cause:** A `POST` was deduplicated.
**Fix:** Dedupe `GET`/`HEAD` only.

**Symptom:** Stale data appears after a mutation
**Cause:** The dedupe map grew a TTL and became a cache without invalidation.
**Fix:** Decide deliberately; a cache needs invalidation on mutation.

**Symptom:** A client error cannot be matched to a server log
**Cause:** No request id.
**Fix:** `X-Request-Id` per attempt — distinct from the idempotency key.

## Interview questions

**★ In what order do you layer dedupe, retry, auth and timeout, and why?**
Dedupe outermost (so callers share retries too), then retry (so a refreshed token is used by the
retry), then auth, then timeout innermost — **a timeout around the retry sequence would abort
mid-backoff**, which presents as a flaky API and is actually the client's bug.

**★ Implement single-flight deduplication.**
A `Map` from request key to the in-flight promise; return the existing one if present; clear the
entry in **`finally`** so a failure does not poison later callers. `GET`/`HEAD` only.

**★ What must the dedupe key contain?**
Everything that changes the response: method, full URL, credentials mode, and any auth-relevant
header. A URL-only key serves one user's data to another after a login switch.

**★ Why is deduplicating a `POST` dangerous?**
Two logically distinct writes collapse into one — two orders become one order. Idempotency is what
makes repeated `POST`s safe, and that is a different mechanism.

**★ Is deduplication a cache?**
No. It shares an **in-flight** request and forgets immediately, so staleness is impossible and no
invalidation is needed. A cache retains **completed** responses for a lifetime and must be
invalidated. Adding a TTL to a dedupe map means you have built a cache — say so and handle
invalidation.

**★ What is the risk of every caller sharing one promise?**
They share the same resolved object, so one consumer's mutation is visible to all of them. Freeze
the result or hand out copies — and state which.

**When do you stop building the client?**
When you need response caching, revalidation and cross-mutation invalidation. At that point a
data-fetching library is the better answer, and the value of the hand-written client was knowing
what each of its parts prevents.

---

[Topic index](./README.md) · Next → [02 · Failing well](./02-failing-well.md)
