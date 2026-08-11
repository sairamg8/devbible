---
title: "Outbound timeouts"
sidebar_label: "06 · Outbound timeouts"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**A `fetch` with no timeout has no upper bound. Not a long one — none. That is the
single most common way one slow dependency takes down a service that does not
depend on it.**

```js
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

One argument. Add it to every outbound call you write.

## Why "it will eventually fail" is wrong

There is no default request timeout in `fetch`. The OS will give up on a TCP
connect eventually — on Linux around 130 s — but once the connection is
established and the server simply never responds, nothing times out. Meanwhile:

1. The request holds a pooled connection ([page 07](07-keep-alive-and-agents.md)).
2. The handler that called it holds its own inbound socket, its request context,
   and whatever it has already loaded into memory.
3. The pool exhausts. New outbound calls queue behind the stuck ones.
4. Health checks that call the same client start failing. The orchestrator
   restarts the pod. The new pod does the same thing.

A dependency that is *slow* is more dangerous than one that is *down*, because
"down" fails in microseconds with `ECONNREFUSED` and slow fails never.

## `AbortSignal.timeout` covers the whole exchange

The interesting part is that the deadline does not stop when headers arrive:

```console
$ node timeout.mjs
timeout(500) on connect+headers -> TimeoutError: The operation was aborted due to timeout after 508 ms
headers arrived at 25 ms, status 200
  ...but reading the body -> TimeoutError after 802 ms
```

The second case got a `200` in 25 ms and *still* aborted at 802 ms, because the
body was dribbling. The signal stays armed until the response is fully consumed.
That is what you want: a server can pass your header timeout and then send one
byte per second forever.

`AbortSignal.timeout(ms)` is unref'd — a pending timeout never keeps the process
alive on its own.

## Combining a deadline with a caller-initiated abort

```js
const res = await fetch(url, {
  signal: AbortSignal.any([req.signal, AbortSignal.timeout(5000)]),
});
```

```console
$ node timeout.mjs
any([user, deadline]) -> Error after 201 ms | reason: client went away
```

`AbortSignal.any` fires on whichever comes first. The rejection carries **the
reason of the signal that won**, so a custom `abort(new Error('client went away'))`
surfaces as that exact error rather than a generic `AbortError` — which is how
you tell "the user closed the tab" apart from "the upstream is slow" in a log.

The full cancellation model — `signal.reason`, `throwIfAborted`, why `abort()`
does not roll anything back — is [Phase 2, page
19](../phase-2-async/19-abortcontroller.md).

## One deadline for the whole operation, not per call

A handler that makes three sequential calls with a 5 s timeout each has a 15 s
worst case, and whoever is waiting gave up long ago. Derive the budget once:

```js
async function handler(req, res) {
  const deadline = AbortSignal.timeout(3000);            // for the whole request

  const user = await json(`${API}/users/${id}`, { signal: deadline });
  const prefs = await json(`${API}/prefs/${id}`, { signal: deadline });
  const feed = await json(`${API}/feed/${id}`, { signal: deadline });
  res.end(JSON.stringify({ user, prefs, feed }));
}
```

Every call shares one clock, so the total is bounded by 3 s no matter how the time
is distributed. Where the calls are independent, run them together
([Phase 2, page 10](../phase-2-async/10-sequential-vs-parallel.md)) and the
deadline covers the slowest rather than the sum.

Timeouts must also be **shorter as you go deeper**. If your caller gives up at
2 s, a 5 s timeout on your own upstream is dead work: you are holding resources to
produce a response nobody is waiting for. Budget downward — 3 s inbound, 2 s to
the next hop, 1 s to the one after.

## Choosing the number

| Call | Starting point |
|---|---|
| Same-cluster service | 1–3 s |
| Third-party API (payments, email) | 5–10 s, and never on the request path if avoidable |
| Anything a user is waiting on | Under the client's own timeout, always |

Set it from the dependency's **p99 plus headroom**, not from its average. A
timeout below p99 turns a healthy dependency into an error rate; a timeout at 30 s
is the same as having none.

## Timeout, retry, cancel are three different things

An abort does not undo anything on the server — the request may well have been
processed. Timing out a `POST /charge` and retrying it charges twice unless the
call is idempotent ([page 08](08-outbound-client-discipline.md)). Treat a timeout
on a non-idempotent write as *unknown*, not *failed*.

## Gotchas

**Symptom:** One slow third-party API takes the whole service down
**Cause:** No timeout on the outbound call; pooled connections and handlers pile
up until nothing is free.
**Fix:** `AbortSignal.timeout` on every call, plus a bounded pool.

**Symptom:** Requests still hang after adding a timeout
**Cause:** The timeout was on the `fetch` but the code then streamed the body
after the response resolved — with a separate, unsignalled read.
**Fix:** Pass the same signal through, or consume the body inside the deadline.

**Symptom:** Timeouts fire on a healthy dependency
**Cause:** The value was chosen from average latency.
**Fix:** p99 plus headroom.

**Symptom:** Cancelled requests still cost the upstream full CPU
**Cause:** Abort closes your connection; it does not stop work already started.
**Fix:** Nothing on the client side — this is why deadlines must be propagated to
the upstream as a header if it supports one.

**Symptom:** Duplicate side effects after a timeout
**Cause:** A timed-out write was retried without an idempotency key.
**Fix:** [Page 08](08-outbound-client-discipline.md).

**Symptom:** Every abort logs as `AbortError` and you cannot tell why
**Cause:** The default reason was used.
**Fix:** `controller.abort(new Error('…'))`, and log `signal.reason`.

## Interview questions

**★ What is the default timeout for `fetch` in Node?**
There is none. Nothing bounds the request once the socket is connected. Without
`AbortSignal.timeout` a stalled upstream holds a pooled connection and a handler
indefinitely, which is how a slow dependency becomes a full outage.

**★ Does `AbortSignal.timeout` cover the response body?**
Yes — the deadline applies to the whole exchange. Verified: a response whose
headers arrived in 25 ms still aborted at 802 ms under an 800 ms timeout, because
the body was still streaming.

**★ Why is a slow dependency worse than a dead one?**
A dead one fails immediately with `ECONNREFUSED`, so resources are released and
the failure is visible. A slow one holds a connection, a handler and its memory
for as long as it likes, and the saturation shows up as unrelated endpoints
timing out.

**★ How do you bound a handler that makes several upstream calls?**
Create one `AbortSignal.timeout` for the whole handler and pass it to every call,
so the total is bounded rather than the sum of per-call timeouts. Combine it with
the inbound request's signal using `AbortSignal.any` so a departed client cancels
the work too.

**Is a timed-out request a failed request?**
No — it is an unknown one. The upstream may have completed it. That distinction
decides whether retrying is safe, and it is why non-idempotent writes need
idempotency keys.

**Why should timeouts shrink as you go deeper into the call graph?**
Because the caller's deadline is the real budget. Work done after the caller has
given up is pure load with no consumer.

---

← Prev: [fetch](05-fetch.md) · Next → [Keep-alive and agents](07-keep-alive-and-agents.md)
