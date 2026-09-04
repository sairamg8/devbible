---
title: "\"The module is ready to extract\" is a judgement teams make by feeling and should make by running four checks — two of which are conclusive on their own, and one of which cannot be fixed by any amount of further preparation"
sidebar_label: "40b · Ready to extract"
sidebar_position: 64
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Spring Modulith reference, *Integration Testing Application
> Modules* ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/testing.html)) and
> *Verifying Application Module Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[40 · Splitting a service](40-splitting-a-service.md) gets the module clean. This chunk is the decision that follows and the one teams get wrong in both directions: extracting a module that was never going to survive alone, or preparing indefinitely because "ready" was never defined and therefore can never be reached. Readiness is four checks you run rather than four things you believe, and their asymmetry is the useful part — two of them describe work with a known shape, and two of them, when they fail, are telling you the boundary is wrong rather than that the module needs more work. Then there is the second half nobody budgets for: four guarantees that hold in-process, stop holding across a network, and turn code that has been correct for two years subtly wrong without anybody editing it.**

## "Ready to extract" needs a definition, not a feeling

The step-by-step above ends with extraction, and the judgement call it hides is *when*. Four checks,
each of which is a thing you run rather than a thing you believe — and the first two are conclusive
on their own.

| # | Check | How you run it | Fails if |
|---|---|---|---|
| 1 | 🔴 **No invariant crosses the line** | Read the module's `@Transactional` methods; does any touch both sides? | Any single transaction spans the boundary — the line is in the wrong place, full stop |
| 2 | 🔴 **The module boots alone** | `@ApplicationModuleTest` in `STANDALONE` — see [25c · Can the module boot alone?](25c-can-the-module-boot-alone.md) | It only comes up under `DIRECT_DEPENDENCIES` or wider |
| 3 | **Owns its data** | Does any other module read its tables? | Another module's query names its tables |
| 4 | **Collaboration is already asynchronous** | Count the `@MockitoBean`s needed to boot it | Double digits — each one becomes a synchronous network call |

**Check 2 is the cheapest high-value signal available and is almost never run**, which is why it is
worth stating separately: a module you can bootstrap alone in a test is a module whose Spring context
closes without help, and that is most of what "extractable" means in practice. A module that needs
its neighbours to start will need them at runtime too, over a network, at start-up, in the wrong
order, during a deployment.

⚠️ **Checks 3 and 4 are improvable; checks 1 and 2 are usually not, quickly.** If another module reads
your tables, that is weeks of work with a known shape. If an invariant spans the line, the boundary
itself is wrong and no amount of preparation fixes it — the answer is to move the line, not to keep
preparing.

## What changes the moment the module is on the far side of a network

The reason for all of the preparation is that four properties silently stop holding, and code that
was correct in-process becomes subtly wrong without changing:

| In-process | After extraction |
|---|---|
| The call either returns or throws | It can also **time out** — you do not know whether it happened |
| An event listener runs after commit, in the same JVM | It runs after commit, elsewhere, **maybe twice, maybe out of order, maybe much later** |
| A `null` return means "not found" | It can also mean "the other side is down" |
| Ordering of two calls is program order | Ordering is whatever the network and the consumer's threading produced |

🔴 **The middle row is the one that breaks working code.** An in-process
`@ApplicationModuleListener` gives at-most-once, in-order, immediate delivery, and handlers written
against it are routinely non-idempotent because they never had to be. The same handler behind a
broker gets at-least-once and out-of-order delivery — so the first thing to change is not the
transport, it is the handler:

```java
// in-process: safe, because it runs once
@ApplicationModuleListener
void on(OrderPlacedEvent event) {
    inventory.reserve(event.orderId(), event.items());
}

// extraction-ready: safe under redelivery and reordering
@ApplicationModuleListener
void on(OrderPlacedEvent event) {
    if (reservations.existsFor(event.orderId())) return;    // idempotent
    inventory.reserve(event.orderId(), event.items());
}
```

**Make the handlers idempotent while they are still in-process**, where a mistake is a failing unit
test rather than a duplicated reservation in production. That is the single highest-value thing to do
in the window between "module is clean" and "module is extracted".

## Gotchas

**★ The extraction is postponed indefinitely because the module 'is not ready', and nobody can say what ready means.**
Cause: readiness is being assessed as a feeling. Without checks that can pass, preparation continues
forever and the team gets the cost of two architectures and the benefit of one.
Fix: write the four checks down and run them. Two are conclusive — no invariant crosses the line, and
the module boots `STANDALONE` — and the other two are improvable work with a known shape. If check 1
fails, stop preparing and move the boundary; more preparation cannot fix a line drawn in the wrong
place.

**★ The module is clean, tested and extracted, and reservations start duplicating in production.**
Cause: the event handlers were written against in-process delivery, which is effectively once and in
order, and now run behind a broker that redelivers.
Fix: make handlers idempotent **before** extraction, while a mistake is a failing test rather than an
incident. An existence check keyed on the aggregate is usually enough, and it costs nothing in-process:
```java
if (reservations.existsFor(event.orderId())) return;
```

**★ A caller treats a timeout as a failure and retries, and the operation happens twice.**
Cause: in-process, a call returns or throws; across a network it can also time out, which means *you
do not know whether it happened*. Code written against the two-outcome model is now wrong.
Fix: give the extracted operation an idempotency key so a retry after an unknown outcome is safe, and
audit the call sites for retries that assume failure:
```java
// the caller supplies the key; a repeat with the same key returns the original result
reservationClient.reserve(new ReserveCommand(orderId, items), idempotencyKey(orderId));
```

## Interview questions

**★ What is your definition of "ready to extract", and which parts of it are not improvable?**
Four checks. No invariant crosses the line; the module boots on its own in a `STANDALONE`
`@ApplicationModuleTest`; no other module reads its tables; and it needs few enough mocked
collaborators that its start-up does not depend on half the application. The last two are ordinary
work with a known shape — weeks, not a rethink. The first two are not improvable in the same sense: a
module that cannot start without its neighbours will need them at runtime over a network during
deployment, and an invariant spanning the line means the line is in the wrong place, which more
preparation cannot fix. When check 1 fails the correct response is to move the boundary, not to keep
getting ready.

**★ Which in-process guarantee, silently lost at extraction, most often breaks previously-correct code?**
Event delivery semantics. An in-process `@ApplicationModuleListener` delivers after commit, once, in
order, immediately — so handlers written against it are routinely non-idempotent, and nothing has ever
punished that. Behind a broker the same handler gets at-least-once and out-of-order delivery, and a
reservation handler that was correct for two years starts double-reserving. The others in the same
family are the disappearance of the two-outcome call — a network call can time out, meaning you do not
know whether it happened — and `null` acquiring a second meaning. The mitigation for all of them is
the same and it belongs *before* the extraction: make the handlers idempotent while a mistake is still
a failing unit test.

---

← [Splitting a service](40-splitting-a-service.md) · [Topic index](README.md) · Next → [Strangler extraction](41-strangler-extraction.md)
