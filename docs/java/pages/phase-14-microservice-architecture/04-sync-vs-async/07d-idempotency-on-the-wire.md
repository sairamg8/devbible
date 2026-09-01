---
title: "RFC 9110 makes PUT and DELETE idempotent and says a client SHOULD NOT automatically retry a non-idempotent method, which means retrying a POST is a decision you have to earn with a key the specification never standardised"
sidebar_label: "34 · Idempotency on the wire"
sidebar_position: 34
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against RFC 9110, "HTTP Semantics", §9.2.1 (safe methods) and §9.2.2
> (idempotent methods) ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html)); Marc
> Brooker, "Timeouts, retries, and backoff with jitter", Amazon Builders' Library
> ([aws.amazon.com](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/));
> and `draft-ietf-httpapi-idempotency-key-header`
> ([datatracker.ietf.org](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)).
> ⚠️ **That draft is not an RFC.** As of 2026-09-01 it is at **draft-07, latest revision
> 2025-10-15, and expired.** The header is widely implemented by convention; it is not a
> standard. 🔴 **No sandbox.** Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework
> 7.0.8.

**A retry is only a retry if repeating the request is harmless. Otherwise it is a second
execution wearing the same name. HTTP gives you a small amount of help here — the specification
defines which methods are idempotent and tells clients not to auto-retry the others — and then
stops exactly where microservice writes begin, because the interesting operations are `POST`s
with side effects. The mechanism everyone uses for those is a client-supplied key, and it is
worth knowing that it has never been standardised.**

## What the specification actually says

RFC 9110 §9.2.2:

> *"A request method is considered 'idempotent' if the intended effect on the server of multiple
> identical requests with that method is the same as the effect for a single such request. Of the
> request methods defined by this specification, PUT, DELETE, and safe request methods are
> idempotent."*

The clarification that removes a common objection:

> *"Like the definition of safe, the idempotent property only applies to what has been requested
> by the user; a server is free to log each request separately, retain a revision control history,
> or implement other non-idempotent side effects for each idempotent request."*

The reason it exists:

> *"Idempotent methods are distinguished because the request can be repeated automatically if a
> communication failure occurs before the client is able to read the server's response. For
> example, if a client sends a PUT request and the underlying connection is closed before any
> response is received, then the client can establish a new connection and retry the idempotent
> request. It knows that repeating the request will have the same intended effect, even if the
> original request succeeded, though the response might differ."*

And the normative constraint that decides your retry policy:

> *"A client SHOULD NOT automatically retry a request with a non-idempotent method unless it has
> some means to know that the request semantics are actually idempotent, regardless of the method,
> or some means to detect that the original request was never applied."*

**Read the escape clauses in that last sentence carefully**, because they are the design space:

- *"some means to know that the request semantics are actually idempotent, regardless of the
  method"* — a `POST` that you have made idempotent by design.
- *"some means to detect that the original request was never applied"* — a way to check, after the
  fact, whether the work happened.

Those two are the only legitimate routes to retrying a write, and everything below is one or the
other.

## Brooker says the same thing operationally

> *"In general, our view is that APIs with side effects aren't safe to retry unless they provide
> idempotency. This guarantees that the side effects happen only once no matter how often you
> retry. Read-only APIs are typically idempotent, while resource creation APIs may not be. Some
> APIs, like the Amazon Elastic Compute Cloud (Amazon EC2) RunInstances API, provide explicit
> token-based mechanisms to provide idempotency and make them safe to retry. Good API design, and
> care when implementing clients, is needed to prevent duplicate side-effects."*

Note *"Good API design"*: idempotency is a property of the **API**, chosen by the provider. A
client cannot make somebody else's `POST` idempotent, which means **the retry policy for a hop is
constrained by a decision another team made**, and if they did not make it, your retry policy is
"do not".

## Route 1 · Make the operation naturally idempotent

The best option, because it needs no extra state anywhere.

**Use `PUT` with a client-chosen identifier.** Instead of `POST /orders` returning a
server-generated id, accept `PUT /orders/{clientChosenId}`. Repeating it produces the same order.
The specification says exactly this is why `PUT` is idempotent.

```java
@PutMapping("/orders/{orderId}")
ResponseEntity<OrderResponse> place(@PathVariable String orderId,
                                    @RequestBody PlaceOrder command) {
    Order order = orders.placeIfAbsent(orderId, command);   // upsert-with-check semantics
    return order.wasCreatedNow()
            ? ResponseEntity.created(order.uri()).body(OrderResponse.from(order))
            : ResponseEntity.ok(OrderResponse.from(order));
}
```

The load-bearing part is `placeIfAbsent` and, underneath it, a **unique constraint on the
identifier in the database**. Application-level "check then insert" is a race; the constraint is
what actually makes it idempotent under concurrency, which is the case that matters because retries
arrive concurrently with slow originals.

**Design operations as absolute rather than relative.** `setQuantity(5)` is idempotent;
`addToQuantity(1)` is not. Where the domain permits it, this is free idempotency and it is worth
reaching for during API design rather than after.

## Route 2 · The idempotency key

When the operation is genuinely a `POST` and cannot be restructured, the convention is a
client-supplied key that the server remembers.

⚠️ **This is a convention, not a standard.** The IETF draft
`draft-ietf-httpapi-idempotency-key-header` describes it — *"The HTTP Idempotency-Key request
header field can be used to make non-idempotent HTTP methods such as POST or PATCH
fault-tolerant"* — but as of 2026-09-01 it is at **draft-07, revised 2025-10-15, and expired**. It
never became an RFC. Several major payment APIs implement it and their semantics differ in the
details, so **treat it as a contract you agree with each counterparty, not as something you can
assume.**

```java
@PostMapping("/payments")
ResponseEntity<PaymentResponse> pay(@RequestHeader("Idempotency-Key") String key,
                                    @RequestBody PaymentRequest request) {

    return idempotency.execute(key, request, () -> payments.capture(request));
}
```

What `execute` has to do, and every step matters:

1. **Insert the key first**, in the same transaction as the work, with a unique constraint. If the
   insert fails, this is a replay.
2. **On replay, return the stored response** — not a fresh execution, and not an error.
3. **Fingerprint the request body** and store it with the key. A replay with the *same* key and a
   *different* body is a client bug and must be rejected explicitly (a `4xx`), not silently served
   the old response.
4. **Handle the in-flight case.** A replay arriving while the original is still running cannot
   return a stored response because there is not one yet. Returning `409 Conflict` and letting the
   client retry is the honest answer; blocking is a deadlock risk.
5. **Expire the keys.** A retention window, documented in the API, after which a key may be reused.
   Without one the table grows forever.

Step 4 is the one most implementations get wrong, and it is the common case: retries arrive because
the original was slow, so the original is usually still running.

## Route 3 · Detect whether it was applied

RFC 9110's second escape clause. If you can *ask* whether the work happened, you do not need the
operation to be idempotent — you need a query.

```java
PaymentResult payWithRecovery(PaymentRequest request, String correlationId) {
    try {
        return payments.capture(request, correlationId);
    } catch (TimeoutException unknown) {
        // do not retry blindly — ask
        return payments.findByCorrelationId(correlationId)
                       .orElseGet(() -> payments.capture(request, correlationId));
    }
}
```

This requires the callee to expose a lookup by a client-supplied correlation identifier, which is
an API design commitment. It is strictly weaker than route 2 — the lookup itself can time out, and
there is a race between the lookup and a slow original — but it is often available when route 2 is
not, particularly with third-party APIs you cannot change.

## Gotchas

**★ `POST` is not idempotent and the specification says clients should not auto-retry it.**
Any retry helper applied uniformly across your clients is silently violating that unless every
endpoint it covers is idempotent. Check what your HTTP client library does by default — some retry
on connection failure for methods they consider idempotent, and their notion of which those are may
not match yours.

**★ "Check then insert" is not idempotency.** Two concurrent replays both check, both find nothing,
both insert. The uniqueness has to be enforced by the database, and the code has to handle the
constraint violation as a successful replay rather than as an error. Retries arrive concurrently
with the original by construction, so this race is the normal case rather than an edge one.

**★ The `Idempotency-Key` header is not a standard.** The IETF draft expired at draft-07 without
becoming an RFC. Implementations differ on scope, retention, what happens on a body mismatch and
what happens on a concurrent replay. Agree the semantics explicitly with each counterparty rather
than assuming a shared meaning.

**★ Storing the key outside the work's transaction reopens the window.** If the key is recorded in
one transaction and the payment captured in another, a crash between them leaves a key with no
work, or work with no key. One transaction, or an idempotency store that is the same database as
the work.

**★ The replay that arrives while the original is in flight is the common case, not the edge
case.** Retries happen because things are slow. An implementation that assumes the original has
finished will either execute twice or block. Return a `409` and let the client come back.

**★ Idempotency keys without expiry grow without bound**, and expiry without a documented window is
a contract nobody can rely on. State the retention in the API documentation, because the client's
retry policy has to fit inside it.

**★ Idempotency is the provider's decision, so your retry policy depends on someone else's API
design.** You cannot make a third party's `POST` idempotent. If they offer no key and no lookup,
the correct policy for that hop is not to retry writes, and the correct place to record that is the
inventory in [48](10b-the-interaction-inventory.md).

**★ A retried request can succeed *and* the caller still not know.** The retry itself can time out.
Idempotency makes repetition safe; it does not make the outcome knowable. That is
[36 · The unknown outcome](07f-the-unknown-outcome.md).

## Interview questions

**★ Which HTTP methods are idempotent, and what does the specification say about retrying the
others?**
`PUT`, `DELETE` and the safe methods — `GET`, `HEAD`, `OPTIONS`, `TRACE`. RFC 9110 §9.2.2 states
that a client *"SHOULD NOT automatically retry a request with a non-idempotent method unless it has
some means to know that the request semantics are actually idempotent, regardless of the method, or
some means to detect that the original request was never applied."* Those two escape clauses are
the entire design space for safely retrying writes: make the operation idempotent by design, or
provide a way to ask whether it was applied.

**★ How would you make a `POST /payments` safely retryable?**
Preferably by restructuring it as a `PUT` to a client-chosen identifier, so repetition is idempotent
by the specification's own definition. Where that is not possible, with a client-supplied
idempotency key: insert the key with a unique database constraint in the same transaction as the
work, return the stored response on replay, fingerprint the request body so that a replay with the
same key and different content is rejected rather than silently served, return `409` for a replay
that arrives while the original is still running, and expire keys on a documented schedule.

**★ Is the `Idempotency-Key` header a standard?**
No. There is an IETF draft, `draft-ietf-httpapi-idempotency-key-header`, but as of September 2026
it is at draft-07 with a last revision of 2025-10-15 and it has expired without becoming an RFC.
The header is widely implemented by convention, notably in payment APIs, but the semantics differ
between implementations — scope, retention period, behaviour on a body mismatch, behaviour on a
concurrent replay. Treat it as a bilateral contract to agree explicitly, not as something both
sides can assume.

**★ Why is "check whether it exists, then insert" not sufficient?**
Because two concurrent replays both perform the check before either performs the insert, so both
proceed. And concurrency is the normal case here rather than an edge case, since retries are
triggered by slowness and therefore overlap the original request. Idempotency has to be enforced
by a uniqueness constraint in the database, with the constraint violation handled as a successful
replay rather than as an error.

**★ A third-party API offers no idempotency key and no lookup. What is your retry policy for
writes?**
Do not retry them. RFC 9110's guidance applies directly: without a means to know the semantics are
idempotent or to detect whether the original was applied, an automatic retry is a second execution.
The practical alternatives are to make the timeout generous enough that timeouts are genuinely rare,
to surface the unknown outcome to a human or a reconciliation process rather than resolving it in
code, and to record the constraint in the interaction inventory so that nobody adds a retry helper
across all clients later without noticing.

{/* FOOTER */}
