---
title: "A retry that produces a second charge is not caused by the retry — it is caused by a key that was regenerated on the second attempt, which is why the assertion that matters is not that the call succeeded but that both attempts carried the same idempotency key"
sidebar_label: "09b · Idempotency: the client side"
sidebar_position: 42
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against **RFC 9110** §9.2.2 *Idempotent Methods*
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.txt)) — every RFC sentence quoted
> below is verbatim from that section; **Stripe**'s *Idempotent requests* API reference
> ([docs.stripe.com](https://docs.stripe.com/api/idempotent_requests)) for the reference
> implementation of the server side; the IETF draft
> *The Idempotency-Key HTTP Header Field*
> ([datatracker.ietf.org](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)),
> ⚠️ **an expired Internet-Draft — version 07, 2025-10-15 — not a standard**; and the
> **Spring Framework 7.0.x** `MockRestRequestMatchers` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/match/MockRestRequestMatchers.html))
> for the `header` matcher used here.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**Three chunks in this topic have arrived at the same sentence from different directions.
[03c](03c-the-error-paths-nobody-writes.md) said a 409 often means "you already did this".
[03f](03f-the-failures-with-no-status-code.md) said a read timeout means the outcome is
unknown. [04b](04b-the-adapter-and-the-three-test-populations.md) said a reset after the
request left is not "the charge did not happen". Every one of them ends at a retry, and a
retry of a `POST` is a second charge unless something makes it not one. That something is an
idempotency key, and the test that protects it is not the one you would guess: it is not that
the retry succeeded, it is that both attempts sent the **same key**. This chunk is the client
side — deriving the key, persisting it, and the test. Receiving a retried request is
[09b2](09b2-the-idempotent-receiver.md).**

## What the specification actually says, because the words are load-bearing

RFC 9110 §9.2.2 defines the property:

> *"A request method is considered "idempotent" if the intended effect on the server of
> multiple identical requests with that method is the same as the effect for a single such
> request. Of the request methods defined by this specification, PUT, DELETE, and safe
> request methods are idempotent."*

Note **`POST` is not on that list**, which is the entire problem, since creating a charge is
a `POST`. Then the reason it matters:

> *"Idempotent methods are distinguished because the request can be repeated automatically if
> a communication failure occurs before the client is able to read the server's response. For
> example, if a client sends a PUT request and the underlying connection is closed before any
> response is received, then the client can establish a new connection and retry the
> idempotent request. It knows that repeating the request will have the same intended effect,
> even if the original request succeeded, though the response might differ."*

And the rule that your retry policy is either obeying or violating:

> *"A client SHOULD NOT automatically retry a request with a non-idempotent method unless it
> has some means to know that the request semantics are actually idempotent, regardless of the
> method, or some means to detect that the original request was never applied."*

🔴 **"Some means to know that the request semantics are actually idempotent" is exactly what
an idempotency key is.** It is not a nicety bolted onto the request; it is the precondition
the RFC names for retrying a `POST` at all. Without it, a `@Retryable` on a charge method is
specification-violating behaviour that happens to work most of the time.

The RFC even describes the shortcut people take, and it describes it as riskier:

> *"Some clients take a riskier approach and attempt to guess when an automatic retry is
> possible. For example, a client might automatically retry a POST request if the underlying
> transport connection closed before any part of a response is received, particularly if an
> idle persistent connection was used."*

> *"A proxy MUST NOT automatically retry non-idempotent requests. A client SHOULD NOT
> automatically retry a failed automatic retry."*

⚠️ **The header name is a convention, not a standard.** `Idempotency-Key` is what Stripe,
Adyen, PayPal and most others use, and there is an IETF draft for it —
*"The HTTP Idempotency-Key request header field can be used to make non-idempotent HTTP
methods such as POST or PATCH fault-tolerant."* — but that draft is **expired** (version 07,
dated 2025-10-15). Read the partner's documentation for the header name; do not assume.

## The bug, in four lines

```java
public ChargeResult charge(ChargeCommand command) {
    return http.post()
            .uri("/v1/charges")
            .header("Idempotency-Key", UUID.randomUUID().toString())   // 🔴 here
            .body(new ChargeRequest(command.amountMinorUnits(), command.currency()))
            .retrieve()
            .body(ChargeResult.class);
}
```

Every attempt gets a fresh key, so every attempt is a distinct operation to the partner, so a
retry is a second charge. And it passes every test in
[03d](03d-asserting-what-you-sent.md)'s catalogue that asserts the key is *present*.

The fix is that the key is **derived from the business operation** and travels with it:

```java
public record ChargeCommand(String orderId, long amountMinorUnits, String currency,
                            String idempotencyKey) {

    public static ChargeCommand forOrder(Order order) {
        return new ChargeCommand(order.id(), order.total().minorUnits(), order.currency(),
                order.paymentIdempotencyKey());   // 🔴 persisted on the order, generated once
    }
}
```

Three properties, and each one is a separate failure if you drop it:

1. **Generated once, at the point the *business intent* is formed**, not at the point the HTTP
   call is made. A key created inside the gateway cannot survive a retry above the gateway.
2. **Persisted with the aggregate.** A process crash, a redelivered message, or an operator
   re-running a job an hour later must reuse the same key. A key held only in memory covers
   in-process retries and nothing else — and out-of-process retries are the ones that happen
   during incidents.
3. **Unique per operation, not per order.** An order that is legitimately charged twice — a
   partial capture, a second attempt after a genuine decline — needs a second key, or the
   partner will replay the first response and you will believe a charge succeeded that never
   happened.

Stripe's guidance on the value itself is worth following as a default: *"we suggest using V4
UUIDs, or another random string with enough entropy to avoid collisions. Idempotency keys are
up to 255 characters long. Avoid using sensitive data (for example, email addresses or
personal identifiers) as idempotency keys."*

## 🔴 The test: two attempts, one key

The arrangement is [03a](03a-what-the-mock-server-does-not-run.md)'s fail-then-succeed script
— two separate expectations, in order, with different responses — and the assertion is the
header on *both*:

```java
@Test
void aRetryReusesTheSameIdempotencyKey() {
    ChargeCommand command = ChargeCommand.forOrder(anOrder().withKey("idem-42").build());

    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andExpect(method(HttpMethod.POST))
          .andExpect(header("Idempotency-Key", "idem-42"))
          .andRespond(withServerError());

    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andExpect(method(HttpMethod.POST))
          .andExpect(header("Idempotency-Key", "idem-42"))     // 🔴 the assertion of the page
          .andRespond(withSuccess("""
                  {"id":"ch_1","status":"succeeded"}
                  """, MediaType.APPLICATION_JSON));

    ChargeResult result = retryingGateway.charge(command);

    assertThat(result.id()).isEqualTo("ch_1");
    server.verify();
}
```

⚠️ **`expect(times(2), ...)` is the wrong tool here** and it is the mistake people make. It
binds *one* response to two matches, so the client gets a 500 twice and the retry can never
succeed — the test then fails in a way that looks like broken retry logic. Two separate
expectations, each with its own response, is how you script a sequence.

**The assertion that makes the test a real one is the second `header(...)`.** Delete it and
the test still passes against the broken gateway at the top of this page, because both calls
happen and both succeed in sequence. The key equality across attempts is the only thing being
proved.

## Two more tests the same shape argues for

**The retry after an *unknown* outcome**, which is the case [03f](03f-the-failures-with-no-status-code.md)
built the vocabulary for. A read timeout is not a failure, it is an unknown; the correct
behaviour is to retry *with the same key* rather than to fail the order:

```java
server.expect(requestTo("https://pay.example.com/v1/charges"))
      .andExpect(header("Idempotency-Key", "idem-42"))
      .andRespond(request -> { throw new HttpTimeoutException("read timed out"); });

server.expect(requestTo("https://pay.example.com/v1/charges"))
      .andExpect(header("Idempotency-Key", "idem-42"))
      .andRespond(withSuccess(chargeJson, MediaType.APPLICATION_JSON));
```

**The 409 that is proof of success, not failure.** [03c](03c-the-error-paths-nobody-writes.md)'s
status table flags this as the row that costs money. Many partners answer a replayed
idempotency key with a conflict rather than a replayed response, and a gateway that maps
every 4xx to `PaymentRejected` turns a successful charge into a cancelled order:

```java
@Test
void treatsAConflictOnAReplayedKeyAsSuccess() {
    server.expect(requestTo("https://pay.example.com/v1/charges"))
          .andRespond(withStatus(HttpStatus.CONFLICT)
                  .body("""
                        {"error":{"type":"idempotency_error","charge":"ch_1"}}
                        """)
                  .contentType(MediaType.APPLICATION_JSON));

    assertThat(gateway.charge(command).id()).isEqualTo("ch_1");
}
```

🔴 **Whether that is right depends entirely on the partner**, which is the point: it is a
decision that has to be read out of their documentation and then pinned by a test, because
nothing else in your codebase records it. Stripe, for instance, does not behave this way —
it replays the original response — while other providers return a conflict.

## Where the retry lives, and why it changes the test

[03g](03g-the-429-and-retry-after.md) argued the retry belongs *above* the gateway, so the
caller can decide whether waiting is acceptable. That decision has a direct consequence here:
if the retry is above the gateway, then the **command object is what gets retried**, and the
key survives automatically because it is a field on the command. If the retry is inside the
gateway, the key must be captured before the first attempt and reused explicitly — which is
one more line that somebody will delete during a refactor because nothing obviously depends
on it.

The test above works for either shape, which is a good property: it asserts the outgoing
requests, not the mechanism that produced them.

## Where this connects

- Receiving a retried request: the store, the second call as a no-op, the concurrent
  duplicate, and replaying the original response:
  [09b2 · The idempotent receiver](09b2-the-idempotent-receiver.md).
- The unknown-outcome vocabulary this chunk depends on — connect versus read timeout, and
  the reset: [03f · The failures with no status code](03f-the-failures-with-no-status-code.md).
- The status table that flags 409 as the expensive row, and the translation layer:
  [03c · The error paths nobody writes](03c-the-error-paths-nobody-writes.md).
- Where the retry should live, and why a blanket `@Retryable` is the wrong policy for HTTP:
  [03g · The 429 and Retry-After](03g-the-429-and-retry-after.md).
- Asserting the header at all — and why presence is not the property:
  [03d · Asserting what you sent](03d-asserting-what-you-sent.md).
- Why the adapter is the only place that can make this decision:
  [04b · The adapter and the three test populations](04b-the-adapter-and-the-three-test-populations.md).
- The vendor double that checks the key is present but never enforces its semantics:
  [04c · The SDK's own test double](04c-the-sdks-own-test-double.md).
- Scripting consecutive responses and `ExpectedCount`:
  [03a · What it does not run](03a-what-the-mock-server-does-not-run.md).

## Gotchas

**★ Generating the key inside the gateway method gives every attempt a fresh key, and every test that asserts the key is merely *present* passes.**
`UUID.randomUUID()` on the request-building line is the archetype. It satisfies `header("Idempotency-Key", notNullValue())` and it defeats the entire mechanism. The key has to be an input to the gateway, not a decision it makes.

**★ A key held only in memory covers in-process retries and none of the retries that matter.**
A process restart, a redelivered message, a re-run job, or a user pressing the button again all produce a fresh command object with a fresh key. Those are precisely the retries that happen during an incident, when the process is being restarted and the queue is redelivering. The key must be persisted with the aggregate before the first attempt.

**★ Reusing one key per order rather than per operation makes a legitimate second charge silently return the first one's result.**
A partial capture, a retry after a genuine decline, or a second payment on the same order needs its own key. If the key is `order.id()`, the partner replays the first response, your code records a success, and no money moved. This is the failure mode that looks like the mechanism working.

**★ `expect(times(2), requestTo(...))` binds one response to two matches, so the retry has nothing different to succeed at.**
Scripting fail-then-succeed needs two separate `expect` calls in order, each with its own `andRespond`. Reaching for the count form produces a 500 on both attempts, the retry exhausts, and the failure reads as broken retry logic rather than a broken arrangement.

**★ Deleting the second `header(...)` assertion leaves a test that passes against a gateway that regenerates the key.**
That single line is the test. Everything else — the two expectations, the success assertion, the `verify()` — passes identically whether the keys match or not, because both requests are made and both are answered. It is worth a comment saying so, because it looks like a duplicate of the line above it and reviewers delete duplicates.

**★ A blanket `@Retryable` on a charge method violates RFC 9110's own guidance and looks like good engineering.**
The RFC: a client *"SHOULD NOT automatically retry a request with a non-idempotent method unless it has some means to know that the request semantics are actually idempotent"*. `POST` is not idempotent, and the annotation carries no such means. The retry is only defensible once the key is in place, which makes the key a prerequisite for the annotation rather than an enhancement to it.

**★ Treating a read timeout as a failure rather than as an unknown outcome loses the money either way.**
Fail the order and you may have charged a customer for a cancelled order. Retry it without the key and you charge twice. The only correct handling is a third outcome — the `PaymentOutcomeUnknown` of [03f](03f-the-failures-with-no-status-code.md) — retried with the same key or routed to reconciliation.

**★ A 409 on a replayed key means opposite things at different partners, and your gateway must encode which.**
Some replay the original response with the original status; some return a conflict; some return a conflict only when the parameters differ. Mapping every 4xx to a rejection cancels an order that was actually paid. Read the partner's documentation, write the mapping in the adapter, and pin it with a test — that test is the only place the decision is recorded.

**★ `Idempotency-Key` is a de facto convention and the IETF draft for it has expired.**
The draft — *"The HTTP Idempotency-Key request header field can be used to make non-idempotent HTTP methods such as POST or PATCH fault-tolerant."* — is at version 07, dated 2025-10-15, and expired. Most large providers use that exact header name, but some use `X-Idempotency-Key`, some use a body field, and some scope it differently. Take the name from the partner's docs, not from memory.

**★ Putting an identifier in the key exposes it in the partner's logs, their support tooling and yours.**
Stripe says it plainly: *"Avoid using sensitive data (for example, email addresses or personal identifiers) as idempotency keys."* A key built as `customerEmail + orderId` is convenient, deterministic, and a data-protection finding. A V4 UUID stored alongside the order gives you the same determinism with none of the exposure.

## Interview questions

**★ A charge times out and your retry produces two charges. What went wrong and what test would have caught it?**
The key was regenerated on the second attempt, so the partner saw two distinct operations. Almost always the cause is a `UUID.randomUUID()` on the request-building line inside the gateway, which means the key is a property of the *attempt* rather than of the *operation*. The fix is that the key is created once when the business intent is formed, stored on the order, and passed into the gateway as part of the command. The test that catches it is a fail-then-succeed script — two expectations in order, the first responding with a 500 or an injected timeout and the second with a success — asserting `header("Idempotency-Key", "idem-42")` on **both**. That second assertion is the whole test; without it, the same test passes against the broken code, because both requests are still made and both are still answered.

**★ Why is an idempotency key a prerequisite for retrying a POST rather than an optimisation?**
Because RFC 9110 says so, in the section that defines idempotency. `POST` is not in the list of idempotent methods, and the RFC's rule is that a client *"SHOULD NOT automatically retry a request with a non-idempotent method unless it has some means to know that the request semantics are actually idempotent, regardless of the method, or some means to detect that the original request was never applied."* The key is that means — it is what makes the request semantics idempotent even though the method is not. So a `@Retryable` on a charge method without a stable key is not a robustness feature, it is a specification violation that succeeds most of the time and produces a duplicate charge exactly when the partner is having a bad day. The RFC even names the shortcut people take — guessing that a retry is safe when the connection closed before any response arrived — and calls it riskier.

**★ Where does the key come from and where does it live?**
It is generated once, when the business intent is formed — the moment the order is placed, not the moment the HTTP call is built — and it is persisted with the aggregate. That placement is doing two jobs. Generating it at intent time means every retry, whether it is an in-process backoff, a redelivered message, a restarted process or an operator re-running a job tomorrow, reuses the same value. Persisting it means the key survives the exact conditions retries happen under, which is a process that has just crashed. The subtlety I would raise unprompted is scoping: it must be per *operation*, not per order, because an order can legitimately be charged twice — a partial capture, a retry after a real decline — and a key scoped to the order makes the partner replay the first response so your code records a success for money that never moved.

**★ Your partner returns a 409 when you replay an idempotency key. Is that a failure?**
It depends on the partner, and that dependency is the answer: it is a decision that has to be read out of their documentation and pinned in the adapter, because nothing else in the codebase records it. Some providers replay the original response — Stripe's documentation says it saves *"the resulting status code and body of the first request made for any given idempotency key"* and that subsequent requests return the same result. Others return a conflict carrying the id of the original resource, in which case the 409 is proof that the operation succeeded and the correct handling is to extract the id and treat it as success. Others return a conflict only when the parameters differ from the original, which is a genuine client bug. A gateway that collapses all 4xx into a rejection gets the second case exactly backwards and cancels an order that was paid for — which is why [03c](03c-the-error-paths-nobody-writes.md)'s status table has 409 on its own row.

{/* FOOTER */}
