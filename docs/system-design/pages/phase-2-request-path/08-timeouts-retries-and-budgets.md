---
title: "Timeouts along a path must shrink at every hop or the client gives up while the server keeps working; retries multiply through layers — three at each of three hops is twenty-seven — and the only safe retry is idempotent, jittered, and drawn from a budget; the slow dependency becomes the outage when neither rule is kept"
sidebar_label: "08 · Timeouts, retries and budgets"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.2.2
> (idempotent methods and the sentence about automatic retry after a connection failure) and
> §10.2.3 / §15.6.4 (Retry-After, 503), and [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html)
> §4 (429) — verbatim below. Deadline propagation, retry budgets, jitter and circuit breaking are
> common practice, stated as such; the worked outage is arithmetic on illustrative timeouts, not
> a measurement. **No sandbox run.**

**Every hop on the request path has two decisions that are usually left to defaults, and the
defaults are how a slow dependency becomes an outage: how long to wait, and whether to try
again.** Timeouts that do not shrink along the path let a client give up at two seconds while
the gateway waits five, the service seven and the database keeps executing a query nobody will
read — so the abandoned work piles up behind the live work and the database is the first thing
to fall. Retries that are not budgeted multiply: a client that tries three times, through a
gateway that tries three times, to a service that tries three times, sends the database
twenty-seven queries for one request — precisely when the database is already slow, which is
why it was slow. The rules are short: the deadline is set once at the edge and *propagated*,
each hop's timeout is what remains of it; a retry is allowed only for idempotent requests, only
after a jittered backoff, and only while a budget — a fraction of live traffic — has room; and a
dependency that keeps failing is *not called* until it recovers. This page is the timeout
arithmetic with the gate's own example worked, the retry multiplication and the three rules that
bound it, the budget and the breaker, and the storefront's numbers.

## Timeouts: the deadline shrinks along the path

A timeout is a promise to the caller about how long they will wait, and the promise is only
kept if every hop's timeout is *shorter* than its caller's — otherwise the caller gives up
first, and the work continues without anyone to receive it.

**Deadline propagation.** The client (or the gateway, on its behalf) sets a deadline for the
whole request — "answer by t + 2 s" — and every hop passes the *remaining* time downstream as a
header or a metadata field. Each hop sets its own timeout to what remains minus its own
overhead, and a hop that receives a deadline already in the past fails immediately rather than
starting work that cannot be delivered. gRPC carries deadlines natively; over HTTP it is a
header the services agree on.

**The gate's example, worked.** A 2-second timeout at the client became a 14-second outage at
the database. Illustrative timeouts, and the arithmetic:

```text
client   timeout 2 s, retries once                     → up to 2 requests to the gateway over ~4 s
gateway  timeout 5 s per attempt, retries twice         → up to 3 attempts per client request → up to 6 to the service
service  timeout 7 s per query, no retries              → each attempt runs its query for up to 7 s
database a slow query plan today: each query takes ~7 s

t = 0     client sends; gateway attempt 1; service query 1 starts
t = 2     client times out — nobody will read the answer — and RETRIES: gateway request 2, attempt 1; query 2 starts
t = 4     client gives up for good. It has been waiting 4 s and has an error.
t = 5     gateway request 1 attempt 1 times out (5 s); gateway retries → query 3 starts
t = 7     query 1 finishes — result discarded (the gateway already timed out; the client is long gone); gateway request 2 attempt 1 times out → query 4 starts
t = 10    gateway request 1 attempt 2 times out → attempt 3, query 5 starts
t = 12    gateway request 2 attempt 2 times out → attempt 3, query 6 starts
t = 14    query 3 finishes — discarded; ... the last query, started at t = 12, finishes at t = 19

one client request that failed at t = 4 kept the database busy with six 7-second queries until t = 19,
and every other client did the same — which is why the database is slow, which is why every query takes 7 s.
```

With propagation: the client's 2-second deadline arrives at the gateway as "1.9 s remaining",
at the service as "1.8 s", and the database query is cancelled at 1.8 s. One query, cancelled
early, and no retries because the deadline has expired. The 14 seconds (or 19) become two, and
the database sees one query per client request instead of six.

**Two more timeout rules.** A *connect* timeout is separate from a *request* timeout and much
shorter — a host that does not accept a connection in a hundred milliseconds in-region is
down, and waiting five seconds to learn it is five seconds of a pool slot. And every timeout
must be *enforced*, which means the work is actually cancelled — a query cancelled at the
driver, a request aborted with its signal — not merely abandoned by the caller while it runs to
completion.

## Retries: the multiplication

Retries are correct for transient failures — a connection reset, a single replica's blip — and
catastrophic for capacity failures, because they add load to a system that is failing for lack
of capacity. Three layers each retrying three times is 3 × 3 × 3 = 27 attempts at the bottom for
one request at the top, arriving during the outage:

```text
client ×3 → gateway ×3 → service ×3 → database: 27 queries for one request
```

The RFC says exactly when an *automatic* retry is safe:

> *"A request method is idempotent if the intended effect on the server of multiple identical
> requests with that method is the same as the effect for a single such request"* — *"PUT,
> DELETE, and the safe methods are idempotent"* — *"Clients may be able to automatically retry
> requests with idempotent methods following a connection failure, since the intended effect
> should be equivalent"* — RFC 9110, §9.2.2

Which excludes `POST` — and therefore `POST /orders` — unless the application makes it
idempotent with a key ([phase 1's API page](../phase-1-the-method/05-the-api-sketch.md)). A
retry of a non-idempotent request after a timeout is a duplicate order, because a timeout says
nothing about whether the server did the work.

**The three rules that bound retries:**

1. **Retry only what is safe to repeat** — idempotent by method, or by key; and only on
   failures that a retry can fix: connection errors, 503 with Retry-After, a timeout *on an
   idempotent request*. Never on 4xx (the request is wrong), never on 429 except after the
   Retry-After, never on a 500 that means "I did half of it".
2. **Retry at one layer**, with the others passing failures through. If the gateway retries,
   the client does not; if the client does, the gateway does not. The 27 becomes 3.
3. **Back off with jitter, from a budget.** Exponential backoff spreads retries over time;
   *jitter* — a random component — spreads them across clients, so a thousand clients that
   failed at the same instant do not retry at the same instant. And a **retry budget** — retries
   may be at most, say, ten percent of live requests over the last minute — caps the total: when
   the budget is spent, failures are returned, not retried. A budget is what makes retries safe
   under a capacity failure, because it turns "each request retries three times" into "the
   system as a whole adds at most ten percent".

```ts
// retry with exponential backoff, full jitter, a retry budget, and an idempotency check
export type Budget = { allow(): boolean };                 // e.g. a token bucket refilled at 10 % of the live request rate

export async function withRetry<T>(
  attempt: (signal: AbortSignal) => Promise<T>,
  opts: { idempotent: boolean; maxAttempts: number; baseMs: number; capMs: number; deadlineMs: number; budget: Budget },
): Promise<T> {
  const start = Date.now();
  for (let n = 0; ; n++) {
    const remaining = opts.deadlineMs - (Date.now() - start);
    if (remaining <= 0) throw new Error('deadline exceeded');   // propagate: never start work that cannot be delivered
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), remaining);     // the attempt's timeout is what remains of the deadline
    try {
      return await attempt(ctl.signal);
    } catch (err) {
      if (!opts.idempotent || n + 1 >= opts.maxAttempts || !isRetryable(err) || !opts.budget.allow()) throw err;
      const backoff = Math.min(opts.capMs, opts.baseMs * 2 ** n);
      await sleep(Math.random() * backoff);                     // full jitter: uniform in [0, backoff]
    } finally {
      clearTimeout(timer);
    }
  }
}

function isRetryable(err: unknown): boolean {
  const e = err as { code?: string; status?: number };
  return e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED' || e.status === 503 || e.code === 'ABORT_ERR';
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
```

The `Retry-After` from the server overrides the backoff when present — RFC 9110 §10.2.3 defines
it as how long a client should wait before retrying, and RFC 6585's 429 and RFC 9110's 503 both
carry it — and a client that ignores it is the herd the header exists to prevent.

## The circuit breaker: stop calling what is down

Retries answer "this attempt failed"; a breaker answers "this dependency is failing". When the
error rate to a dependency crosses a threshold, the breaker *opens*: calls fail immediately
without being sent, for a cooling period, then a few trial calls are let through (*half-open*)
and success closes it. Three things it buys: the failing dependency gets no load while it
recovers; the callers fail fast — in microseconds instead of at the timeout — so their own pools
and threads are not held; and the failure is *visible* as a breaker state rather than as a
latency. The design question is what to do while it is open: a fallback (a cached catalogue, a
"try later" for search), a degraded product ([phase 1's failure walk](../phase-1-the-method/11b-the-load-walk-and-the-price-of-redundancy.md)),
or an honest error — decided per dependency, not left to the default.

## The slow dependency that became an outage

The pattern, in the storefront: the recommendations service gets slow — not down, slow: two
seconds instead of twenty milliseconds. The product page calls it synchronously with a
five-second timeout and no breaker. Every product-page request now holds a service thread or
connection for two seconds instead of twenty milliseconds — a hundredfold increase in
concurrency for the same request rate, by the formula of [phase 1](../phase-1-the-method/11b-the-load-walk-and-the-price-of-redundancy.md)
— the pool is exhausted, the product page times out, the gateway retries, and the catalogue
service, which was healthy, is down because a *non-essential* dependency was slow. The
prevention is four decisions: a timeout for recommendations that is a fraction of the page's
budget (200 ms, not 5 s); a breaker that opens when it is slow; a fallback that renders the
page without recommendations; and no retry, because a retry of a slow call doubles its cost.

## Budgets along the path

Put the rules together and the path has a budget at every hop, all derived from the one
deadline at the edge:

| Hop | Deadline received | Own timeout | Retries | Notes |
|---|---|---|---|---|
| client (browser) | — | 2 s for a page, 10 s for checkout | none for `POST` without a key; one for idempotent `GET`s | shows a "still working" state rather than retrying checkout |
| gateway | 2 s | 1.9 s to the service | one, idempotent methods only, from a budget of 10 % | passes the deadline down; returns 503 + Retry-After when shedding |
| catalogue service | 1.9 s | 1.8 s to the store; **200 ms** to recommendations; 300 ms to the cache | none | breaker on recommendations; fallback renders without them |
| order service | 9.8 s (checkout) | 1 s to the database; **the provider call is outside the transaction** and has its own 30 s with the pending state | none — the idempotency key makes the *client's* retry safe | a timeout on the provider moves the order to pending, never to failed |
| store | 1.8 s | query cancelled at the driver at 1.8 s | none | a cancelled query frees the connection |

The provider row is the one that shows the shape: a dependency whose latency you cannot bound
is taken *off* the synchronous path — commit first, call after, reconcile later — rather than
given a long timeout that holds a transaction.

## Gotchas

**★ Symptom: the client times out at 2 s; the database is busy for 14 s.** Cause: timeouts that
grow along the path and retries at every layer; abandoned work is not cancelled. Fix: one
deadline at the edge, propagated; each hop's timeout is what remains; cancel the work at the
driver.

**★ Symptom: twenty-seven queries for one request during the outage.** Cause: three layers each
retrying three times. Fix: retry at one layer, with backoff and jitter, from a budget; the
others pass failures through.

**★ Symptom: a duplicate order after a timeout.** Cause: a retried `POST` without an idempotency
key. Fix: RFC 9110 — automatic retry is for idempotent methods; make `POST /orders` idempotent
with a key, or do not retry it.

**Symptom: a thousand clients retry at the same instant.** Cause: backoff without jitter. Fix:
full jitter — a random delay in [0, backoff] — so the retries spread.

**Symptom: retries made the outage longer.** Cause: retrying a capacity failure. Fix: a retry
budget — at most a fixed fraction of live traffic — and a breaker that stops calling a failing
dependency.

**Symptom: the product page is down because recommendations are slow.** Cause: a non-essential
dependency with a long timeout and no breaker holding the page's threads. Fix: a timeout that
is a fraction of the page's budget, a breaker, a fallback without recommendations, no retry.

**Symptom: a five-second wait to learn a host is down.** Cause: no separate connect timeout.
Fix: a connect timeout of ~100 ms in-region; the request timeout is for the work.

**Symptom: the timeout fired and the query kept running.** Cause: the caller abandoned the work
without cancelling it. Fix: an abort signal to the request, a cancel to the driver; a timeout
is enforced, not merely observed.

**Symptom: a retry on a 500 did half the work twice.** Cause: retrying a failure that is not
transient. Fix: retry connection errors, 503 with Retry-After and idempotent timeouts; never
4xx; 5xx only when the operation is idempotent.

**Symptom: Retry-After ignored; the herd returns exactly on schedule.** Cause: the client's own
backoff used instead of the server's hint. Fix: honour Retry-After when present; jitter around
it.

**Symptom: the provider call inside the transaction, with a 30-second timeout.** Cause: an
unboundable latency given a long timeout instead of a different shape. Fix: commit first, call
after, pending state, reconciliation.

## Interview questions

**★ Why did a 2-second timeout at the client become a 14-second outage at the database?**
Because timeouts grew along the path and every layer retried: the client gave up at 2 s and
retried; the gateway waited 5 s per attempt and retried twice; the service ran each query for
up to 7 s and never cancelled it. One client request that failed at 4 s generated six
seven-second queries, the last finishing around 19 s, and every client did the same — so the
database was busy with abandoned work, which is why queries took 7 s. Deadline propagation
fixes it: the 2 s is set once, passed down as remaining time, each hop's timeout is what
remains, the query is cancelled at the driver, and an expired deadline is never retried.

**★ What are the rules for a safe retry?**
Retry only what is safe to repeat — idempotent by method, per RFC 9110, or by an idempotency
key — and only on failures a retry can fix: connection errors, 503 with Retry-After, timeouts on
idempotent requests; never 4xx, never a 5xx that may have done partial work. Retry at one layer
only, so three layers do not multiply to twenty-seven. Back off exponentially with jitter so
clients spread out, honour Retry-After when the server sends it, and draw every retry from a
budget — a fixed fraction of live traffic — so a capacity failure is not amplified.

**★ How does a slow, non-essential dependency take down a healthy service?**
Through concurrency: a call that took twenty milliseconds now takes two seconds, so every
request holds a thread or a pool slot a hundred times longer at the same request rate — the
pool exhausts, the healthy service's own requests time out, the gateway retries, and the
outage is now the service's. The prevention: a timeout for the dependency that is a fraction of
the request's budget, a circuit breaker that opens when it is slow, a fallback that serves
without it, and no retry — because retrying a slow call doubles its cost.

**What is a retry budget, and why is it better than a retry count?**
A count says each request may retry three times, which under a capacity failure means the
system as a whole sends up to four times its traffic to the thing that is failing. A budget
says retries across all requests may be at most a fraction — ten percent — of live traffic
over a window; when it is spent, failures are returned, not retried. It bounds the amplification
at the system level: transient failures still get their retries, and a real outage gets ten
percent more load rather than three hundred percent.

**What does a circuit breaker add that timeouts and retries do not?**
A memory. Timeouts and retries decide per attempt; a breaker observes the error rate to a
dependency and, past a threshold, stops sending calls for a cooling period, then probes with a
few before closing. The dependency recovers without load, callers fail in microseconds instead
of at the timeout so their pools are not held, and the failure is visible as a state rather
than a latency. The design decision is what happens while it is open — a fallback, a degraded
page, or an honest error — chosen per dependency.

**Where does the payment provider's latency go, given it can take thirty seconds?**
Off the synchronous path. The order is committed as pending with its reservation and outbox
row in a local transaction with a one-second database timeout; the provider is called
afterwards with its own thirty-second timeout; a timeout leaves the order pending — not failed,
because a timeout does not say whether the charge happened — for the reconciliation job to
resolve; and the client's retry of the checkout is safe because the idempotency key returns the
existing order. A long timeout inside the transaction would hold a row lock for thirty seconds
per checkout, which is the sale-day outage.

---

← Prev: [07 · Rate limiting](07-rate-limiting.md) · Index: [Phase 2 — The request path](README.md) · Next → [09 · DNS as a component](09-dns-as-a-component.md)
