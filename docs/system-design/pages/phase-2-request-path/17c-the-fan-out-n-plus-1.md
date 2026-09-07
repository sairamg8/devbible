---
title: "A list of fifty items and one per-item field turn a single client call into a hundred and one internal ones with a green status code and nothing in any log, which is why batch endpoints have to exist upstream before an aggregating edge is safe at all — and why the only fix that catches the next occurrence is a metric counting internal calls per client request"
sidebar_label: "17c · The fan-out N+1"
sidebar_position: 17.4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. The fan-out N+1, batch endpoints and per-request batching are **method
> with no single primary source** and are written as such — no vendor, no product, no benchmark;
> the counts below are arithmetic done in front of you, not a measurement. The safe/idempotent
> rule that keeps a batch read a `GET` is
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.2.1 / §9.2.2, quoted in
> [17b](17b-aggregation-and-partial-failure.md). Batch-endpoint *contract* design belongs to
> [phase 6's syllabus](../../syllabus/06-api-design-and-contracts.md). Continues
> [17](17-gateway-patterns.md) and [17b](17b-aggregation-and-partial-failure.md); where the
> composition belongs at all is [17d](17d-routing-versus-orchestration.md). **No sandbox run.**

**One client request asks for a list of fifty products; the aggregate calls catalogue once, then
pricing once per product and inventory once per product, and one client call has become a hundred
and one internal ones — with a green status code, no error anywhere, and a screen that is merely
a bit slower than it was yesterday.** That is the fan-out N+1, and nobody writes it on purpose: it
arrives the day somebody adds one field to a list response. It has a mechanical fix upstream, a
mechanical fix inside the aggregate, and an operational fix that is only a metric — and the first
of those is a prerequisite, not an option, because an aggregating edge built over services with
no batch endpoint does not remove the N+1, it hides it behind one `200`.

## The amplification, counted

```text
one client request:  GET /catalogue?category=shoes&limit=50

  naive aggregate
    1   × GET /catalogue?...                       the list
    50  × GET /prices/{id}                         one per item
    50  × GET /stock/{id}                          one per item
    ───────────────────────────────────────────────
    101 internal calls for 1 client call
    100 concurrent clients on this screen → 10,100 internal calls in flight

  batched aggregate
    1   × GET /catalogue?...
    1   × GET /prices?ids=1,2,…,50
    1   × GET /stock?ids=1,2,…,50
    ───────────────────────────────────────────────
    3 internal calls for 1 client call
```

This is [08](08-timeouts-retries-and-budgets.md)'s amplification with no retry anywhere in sight,
landing on services whose connection pools ([14](14-connection-pooling-and-keep-alive.md)) were
sized for a fraction of that concurrency. Nothing in the naive column errors while it happens.
The screen gets slower — and by [17b](17b-aggregation-and-partial-failure.md)'s rule it gets
slower by the *slowest* of a hundred and one calls, not the average — the upstreams get busier, a
database three hops away receives a load nobody asked it about, and the cause is one field.

## Fix one: batch endpoints upstream

The services expose a plural, id-taking read: `GET /prices?ids=1,2,…,50`, which runs one query and
returns fifty rows, so the aggregate makes one call per service instead of fifty. Four things make
a batch endpoint a real contract rather than a convenience:

- **A maximum batch size**, enforced with a 4xx rather than silently truncated — otherwise the
  endpoint is a way for one caller to ask for a hundred thousand rows in a single request, and
  the request-shaping rule of [03](03-reverse-proxies-and-api-gateways.md) applies here too.
- **Partial results are explicit.** Forty-eight of fifty ids resolved: the response names the
  missing ids rather than returning a shorter list the caller has to diff. Same principle as
  [17b](17b-aggregation-and-partial-failure.md)'s `degraded` field — silence is not a result.
- **Order is not implied.** The caller matches by id, never by position, because a response that
  drops one id while keeping positional order is an off-by-one that ships.
- **It stays a `GET`.** Ids in the query string keep the request safe, cacheable at the edge
  ([05](05-cdns.md)) and automatically retryable under RFC 9110 §9.2.2 — all of which a
  `POST /prices` with a body of ids gives away. The trade is URL length: past a few hundred ids
  the URL stops being reasonable and a `POST` becomes necessary, and at that point you have
  chosen to lose edge caching and safe retry for that route deliberately rather than by accident.

The contract details — pagination, cursoring, partial-result shapes, error semantics — belong to
[phase 6's syllabus](../../syllabus/06-api-design-and-contracts.md), and the sketch belongs to
[phase 1's API sketch](../phase-1-the-method/05-the-api-sketch.md). The point for this page is
the ordering: **the upstream contract comes first**, or the pattern you adopt to make a screen
faster makes your services busier and tells nobody.

## Fix two: per-request batching inside the aggregate

Even with batch endpoints, the code that renders a screen tends to ask for one key at a time — a
template asks each row for its price. The loader pattern collects the keys asked for within a tick
and issues one upstream call:

```ts
// one tick's worth of key lookups collapse into ONE upstream call
// constructed PER REQUEST — a process-wide instance is a cross-user data leak; see the gotchas
export function createBatchLoader<K, V>(fetchMany: (keys: K[]) => Promise<Map<K, V>>) {
  let pending: K[] = [];
  let flush: Promise<Map<K, V>> | null = null;
  return (key: K): Promise<V | undefined> => {
    pending.push(key);
    flush ??= new Promise((resolve) => setTimeout(() => {
      const keys = pending; pending = []; flush = null;
      resolve(fetchMany(keys));                  // ONE call for every key collected this tick
    }, 0));
    return flush.then((byKey) => byKey.get(key));
  };
}
```

Three properties are load-bearing, and each is a way this goes wrong. **Per request**: the loader
is constructed inside the request scope and dies with it, because its memo of key → value is
scoped to one user's authorisation context, and a process-wide instance hands one user's data to
the next. **Deduplication is a feature**: fifty rows that all reference the same seller collapse
to one key, which is frequently a bigger win than the batching itself. **The batch is still one
call with one deadline**: it inherits the envelope of
[17b](17b-aggregation-and-partial-failure.md), so an over-large batch is simply a slow leg — which
is why the maximum batch size exists on both sides of the call, not just at the server.

## Fix three: the metric that makes it visible

**Internal calls per client request**, per route, on the dashboard, alerting when it moves. It is
the only one of the three fixes that catches the *next* regression rather than this one, because
an N+1 is a change in a number that no error rate, latency alert or status code reflects until it
is already bad. Two companions belong beside it: **fan-out width per route** — how many distinct
services one request touches, which is the number that says a screen has quietly grown a fifth
dependency — and **calls received per calling service** at each upstream, which is where a looping
BFF shows up from the other side and is the input to the per-caller limits of
[07](07-rate-limiting.md).

## The storefront

```text
the 50-item list screen, done correctly
  GET /catalogue?category=shoes&limit=50           1 call
  GET /prices?ids=…      (batch, max 100 ids)      1 call
  GET /stock?ids=…       (batch, max 100 ids)      1 call
  internal calls per client request: 3 — on the dashboard, alerting if it moves
  partial batch: 48 of 50 prices resolved → the response names the 2 missing ids,
                 those rows render degraded rather than the whole screen failing (17b)

the loader inside the mobile BFF
  built per request; dedupes the 50 rows' 7 distinct sellers into 7 keys, then ONE /sellers?ids= call
  dies with the request — no memo survives to the next user

the limits that catch the failure from the other side
  catalogue and price limit by CALLING SERVICE (07): "mobile-bff" has its own budget
  calls received per calling service on each upstream's dashboard — a looping BFF is visible in seconds

the regression to expect
  someone adds "sellerRating" to the list row; without a loader that is +50 calls
  the alert that fires is internal-calls-per-client-request going 3 → 53, not an error rate
```

The last block is the page in one line: the thing that catches an N+1 is a counter, because an
N+1 does not fail.

## Gotchas

**★ Symptom: one product-list request became a hundred and one internal calls.** Cause: a per-item
field resolved in a loop over a list. Fix: batch endpoints upstream (`?ids=…`), a per-request
batch loader inside the aggregate, and *internal calls per client request* on the dashboard —
nothing errors when that number grows, which is exactly why it grows.

**★ Symptom: the batch loader served one user's data to another.** Cause: a loader with a memo
constructed once per process instead of once per request. Fix: build it in request scope and let
it die with the request; a genuinely cross-request cache must be explicit, keyed on the
authorisation context and given a TTL somebody chose — never a memoisation side effect nobody
reviewed.

**★ Symptom: aggregation adopted first, batch endpoints "later".** Cause: the pattern treated as a
gateway change rather than an API change. Fix: the upstream contract comes first — an aggregating
edge over per-item endpoints does not remove the N+1, it moves it inside your infrastructure
behind one green status code where no client-visible signal reflects it.

**Symptom: the batch endpoint silently returned thirty rows for fifty ids.** Cause: partial
results left implicit and positional. Fix: return the resolved rows plus an explicit list of
unresolved ids; callers match by id, never by position; and enforce a maximum batch size with a
4xx rather than truncating.

**Symptom: a batch endpoint became a `POST` and the edge cache stopped working for it.** Cause:
ids moved into a body to escape a long URL. Fix: keep ids in the query string while they fit and
cap the batch so they do; if a `POST` is genuinely necessary, name what you gave up — edge caching
([05](05-cdns.md)) and RFC 9110's automatic-retry allowance — and choose it rather than discover
it in an incident.

**Symptom: one BFF's retry loop saturated the catalogue service for every client.** Cause: no
per-caller limit at the upstream, so the amplification had nothing to hit. Fix: upstream limits
keyed by calling service ([07](07-rate-limiting.md)) plus *calls received per calling service* on
the upstream's dashboard; a looping caller has to be visible and throttleable from the side it is
hurting.

**Symptom: the batch call is the slowest leg of the fan-out.** Cause: an unbounded batch turned
one call into one very large query. Fix: a maximum batch size on both sides, and chunking in the
aggregate — several bounded batch calls in parallel beat one unbounded one, and each still
inherits the same envelope ([17b](17b-aggregation-and-partial-failure.md)).

**Symptom: the loader batches, but the same key is fetched on every request of the same screen.**
Cause: per-request deduplication mistaken for caching. Fix: they are different tools — the loader
removes duplicates *within* one request, and a shared cache with an explicit key and TTL removes
repeats *across* requests; a screen that needs both has both, and neither substitutes for the
other.

## Interview questions

**★ How do you stop an aggregating gateway from turning one request into hundreds?**
Recognise it as an N+1 with a network in the middle: a list of fifty items, one per-item field, and
one client call becomes a hundred and one internal ones. The upstream fix is batch endpoints —
`GET /prices?ids=…` with a maximum batch size, explicit unresolved ids and matching by id rather
than position — which is an API-design decision that must exist before aggregation is safe and
which keeps the call a safe, cacheable `GET`. The gateway-side fix is a per-request batch loader
that collects the keys requested within a tick, issues one call and deduplicates repeats,
constructed per request so its memo cannot cross users. The operational fix is a metric: internal
calls per client request, per route, alerting when it moves — because the number grows the day
somebody adds a field, and nothing anywhere returns an error while it does.

**★ Why do batch endpoints have to exist before you adopt an aggregating edge?**
Because aggregation does not remove per-item calls, it relocates them. Without a plural endpoint
the aggregate still makes fifty calls for a fifty-item list; the difference is that they now happen
inside your infrastructure, behind one client-visible request that returns `200`, so the
amplification is invisible from outside and the upstreams absorb a concurrency nobody sized their
connection pools for. With a plural endpoint the same screen is three calls. So the upstream
contract is the prerequisite, and it has four properties worth naming: a maximum batch size
enforced with a 4xx, unresolved ids named explicitly, matching by id rather than position, and ids
in the query string so the call stays a safe, cacheable `GET`.

**★ What breaks if the batch loader is shared across requests?**
Its memo of key to value is scoped to whatever authorisation context filled it, so a later request
asking for the same key gets an answer computed for a different user — a cross-user data leak that
no test catches, because both requests succeed. It also becomes a cache with no invalidation
policy, serving values whose freshness nobody reasoned about, and a memory leak whose size is the
union of every key any request ever asked for. The rule is that a loader is constructed inside the
request and dies with it; anything that genuinely should outlive a request is an explicit cache
with a key that includes the authorisation context and a TTL somebody chose on purpose.

**Your list screen got measurably slower the week after someone added a seller name to each row.
What happened, and how would you have caught it before the users did?**
Almost certainly an N+1: the new field resolves per row, so a fifty-row screen gained fifty calls
to the seller service, and because a parallel fan-out waits for its slowest leg the screen's
latency moved to the worst of fifty rather than the average. Nothing failed, so no error alert
fired. It is caught before users notice by having internal calls per client request on the
dashboard with an alert on change, which turns "3 → 53" into a page; and it is prevented by a
per-request loader that dedupes the fifty rows down to the handful of distinct sellers, plus a
batch endpoint at the seller service so even those become one call.

← Prev: [17b · Aggregation and partial failure](17b-aggregation-and-partial-failure.md) · Index: [Phase 2 — The request path](README.md) · Next → [17d · Routing versus orchestration](17d-routing-versus-orchestration.md)
