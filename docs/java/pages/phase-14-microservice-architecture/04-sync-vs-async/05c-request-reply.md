---
title: "Request/reply is the default because it is the easiest thing to write, and every one of its costs is deferred to production — so the case for it has to be made positively, not arrived at by not making a case"
sidebar_label: "20 · Request/reply"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io "Pattern: Remote Procedure Invocation (RPI)"
> ([microservices.io](https://microservices.io/patterns/communication-style/rpi.html)), the
> Spring Framework 7.0.x reference "REST Clients"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html)),
> and RFC 9110 §9.2.2 ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html)).
> 🔴 **No sandbox.** Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Request/reply gets a bad press in microservice writing, and most of it is unearned. It is the
right shape whenever the caller genuinely cannot proceed without the answer, its properties are
excellent — immediate, ordered, attributable, debuggable — and the alternatives cost real
operational money. The problem is not that people choose it; it is that they arrive at it
without choosing, because it is what an IDE autocompletes. This chunk states its properties
honestly so that choosing it can be a decision.**

## What you get, stated positively

The RPI pattern lists three benefits and they are all true:

> *"Simple and familiar"* · *"Request/reply is easy"* · *"Simpler system since there in no
> intermediate broker"*

Expanded, because the third one is worth more than it sounds:

- **The result is available where you needed it**, in the same method, with the type you wanted.
  No correlation identifier, no reply channel, no state machine.
- **Failure is attributable and immediate.** An exception, with a status code, naming a
  dependency, on the thread that made the call, inside the trace of the request that caused it.
  Compare that with debugging a message that was consumed, failed, and dead-lettered ninety
  seconds later in another service.
- **Ordering is trivially preserved.** Sequential calls happen in sequence. There is no
  partition key, no reordering, no duplicate delivery.
- **There is no broker to operate.** No cluster, no partitions, no consumer groups, no lag
  dashboards, no upgrade plan, no 3am question about whether the broker or the consumer is
  behind. The messaging pattern's own drawback line is *"Additional complexity of message
  broker, which must be highly available"*, and that complexity is a standing cost paid by
  whoever is on call.
- **Backpressure is implicit.** When the callee is saturated it rejects or slows, and the caller
  feels it immediately. With a queue, the caller feels nothing and the backlog grows silently.

None of these is a small thing. A team that replaces every synchronous call with events buys
availability and pays in all five.

## What it costs, stated honestly

The RPI page's drawbacks:

> *"Usually only supports request/reply and not other interaction patterns"* ·
> *"Reduced availability since the client and the service must be available for the duration of
> the interaction"*

and the issue it lists:

> *"Client needs to discover locations of service instances"*

Expanded into the bill this topic has been itemising:

| Cost | Where it is worked through |
|---|---|
| Availability multiplies | [05](03-availability-multiplication.md), [06](03b-what-it-does-to-an-slo.md) |
| Your latency includes theirs, and their tail | [11](04-the-latency-budget.md), [17](04f-tail-latency-under-fan-out.md) |
| You inherit timeouts as an obligation | [13](04c-timeouts-in-spring.md), [15](04d-the-timeout-that-is-not-a-timeout.md) |
| You inherit retries, and therefore idempotency | [31](07b-retries-and-amplification.md), [33](07d-idempotency-on-the-wire.md) |
| A slow callee consumes your capacity | [16](04e-bimodal-latency-and-exhaustion.md) |
| You must decide what a timeout means | [35 · The unknown outcome](07f-the-unknown-outcome.md) |

**Six obligations, all of which land on the caller, none of which the callee's team pays for.**
That asymmetry is the real reason request/reply is over-used: the cost is externalised onto
whoever adds the call, and it arrives later.

## The minimum honest implementation

A synchronous hop is not "done" when it compiles. On Boot 4.1 the floor is:

```java
public interface PricingClient {

    @GetExchange("/quote")
    Money quote(@RequestParam String sku, @RequestParam int quantity);
}
```

```java
@SpringBootApplication
@ImportHttpServices(group = "pricing", types = PricingClient.class)
public class OrderServiceApplication { /* ... */ }
```

```yaml
spring:
  http:
    serviceclient:
      pricing:
        base-url: "https://pricing.internal"
        connect-timeout: 500ms      # bounded — see chunk 13
        read-timeout: 250ms         # from the budget, not from a guess
```

plus, in code and in the design document:

1. **A classification** — hard or soft ([10](03e-hard-and-soft-dependencies.md)).
2. **A defined behaviour on failure**, which for a soft dependency is a value and for a hard one
   is a specific error the caller's caller can act on.
3. **A retry policy or an explicit decision not to retry**, and if retries exist, an idempotency
   story ([33](07d-idempotency-on-the-wire.md)).
4. **An outcome metric per dependency**, so a change in its behaviour is visible before it is an
   incident.

If any of the four is missing, the hop is not implemented; it is merely written.

## Reading the response: `retrieve()` versus `exchange()`

The Spring Framework reference notes that by default clients raise an exception for 4xx and 5xx
status codes, and that status handlers customise that. This is a coupling decision in disguise:
**which statuses are your problem and which are the dependency's?**

```java
Money quote = restClient.get()
        .uri("/quote?sku={sku}&quantity={q}", sku, quantity)
        .retrieve()
        .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
            throw new PricingRejectedException(res.getStatusCode());   // our request was wrong
        })
        .onStatus(HttpStatusCode::is5xxServerError, (req, res) -> {
            throw new PricingUnavailableException(res.getStatusCode()); // their problem, retryable
        })
        .body(Money.class);
```

The distinction matters because it determines what happens next. RFC 9110's framing of the two
classes is the basis for it, and Brooker states the consequence:

> *"HTTP provides a clear distinction between client and server errors. It indicates that client
> errors should not be retried with the same request because they aren't going to succeed later,
> while server errors may succeed on subsequent tries."*

with the caveat that saves you from over-applying it:

> *"Unfortunately, eventual consistency in systems significantly blurs this line. A client error
> one moment may change into a success the next moment as state propagates."*

A collapsed `catch (Exception e)` erases this distinction and produces either retrying things
that will never succeed, or failing on things that would have.

## Gotchas

**★ Request/reply is chosen by default, not by argument, and the costs arrive later.** The
person who adds the call gets the benefit immediately and pays none of the cost; the on-call
engineer pays it in six months. The countermeasure is procedural: make the availability
arithmetic a required field in the design template, so the choice has to be stated.

**★ A `catch (Exception e)` around a client call throws away the 4xx/5xx distinction.**
A malformed request will be retried forever and a transient server error may not be retried at
all. Handle status classes separately, and remember Brooker's caveat that eventual consistency
blurs the line — a 404 for a resource that was created a moment ago is not permanent.

**★ The callee's team has no incentive to reduce your coupling cost.** Their SLO is about their
service; the multiplication happens in yours. If you need them at a higher availability, that has
to be an explicit agreement with a number, derived as in
[06 · What it does to an SLO](03b-what-it-does-to-an-slo.md) — not an expectation.

**★ Sequential request/reply calls make the latency budget unallocatable.** Three hops in
sequence each need a third of the remaining budget, which is often less than any of them can
deliver. If you are keeping the calls, at least stop making them sequentially —
[07](03c-chains-fan-out-and-composition.md).

**★ Implicit backpressure is a benefit right up until it becomes a cascade.** The callee slowing
down does push back on you, which is good, and it does so by consuming your threads, which is
catastrophic past a point. The benefit only holds if you have bounded the wait — a timeout and a
concurrency cap — as in [16](04e-bimodal-latency-and-exhaustion.md).

**★ "We'll switch to events later" is rarely done, because the caller's code is shaped around
having the answer.** Once the response is threaded through five methods and into a DTO, moving
to an asynchronous shape means restructuring the caller, not swapping a client. Choose the shape
when the coupling is cheap to change, which is at the start.

## Interview questions

**★ Make the positive case for request/reply.**
The result arrives where it is needed, in the type it is needed, with no correlation machinery.
Failures are immediate, attributable and inside the causing request's trace, which makes
debugging an order of magnitude cheaper than chasing a dead-lettered message through another
team's service. Ordering is trivially preserved. Backpressure is implicit. And there is no broker
to cluster, monitor, upgrade and be woken up by — the messaging pattern's own drawback is
precisely that a broker adds complexity and must itself be highly available. Those are real
benefits, and a team that eliminates all synchronous calls pays for every one of them.

**★ What obligations does a synchronous hop hand to the caller?**
Setting and budgeting a timeout; deciding whether to retry and therefore whether the operation is
idempotent; deciding what the operation does when the dependency is unavailable; bounding
concurrency so a slow dependency cannot exhaust the caller; interpreting a timeout, which is an
unknown outcome rather than a failure; and monitoring the dependency's behaviour from the
caller's side. None of these are the callee's responsibility, and none of them are done for you
by the framework.

**★ Why should you distinguish 4xx from 5xx when calling another service?**
Because they imply different next actions. A 4xx says the request was wrong and will be wrong
again, so retrying wastes capacity and delays surfacing a real bug; a 5xx says the callee failed
this time and may not next time, so a retry is reasonable. Brooker's caveat is important though:
eventual consistency blurs the boundary, so a 404 for something just created may become a
success shortly after. Encode the classification explicitly with status handlers rather than
catching a bare exception.

**★ Your service makes one synchronous call and it is on the critical path. Is that acceptable?**
Usually yes, and the arithmetic says so: one hard dependency at 99.9% caps you at 99.9%, which is
the same as having no dependency and being 99.9% yourself. The Guardian's rule of one synchronous
call per user request exists because one is affordable and five are not. What makes it acceptable
is that the one call has a budgeted timeout, a defined failure behaviour, a concurrency bound and
its own metric — not that there is only one of it.

**★ When would you keep a synchronous call even though you could make it asynchronous?**
When the caller genuinely needs the answer to decide — an authorisation, a price that gates a
charge, a uniqueness check that protects an invariant — or when the operational cost of the
alternative exceeds the availability gain. A two-team shop that would have to stand up, cluster,
monitor and be paged by a broker in order to make one notification asynchronous has probably made
things worse. Price both sides; the answer is not always "events".

{/* FOOTER */}
