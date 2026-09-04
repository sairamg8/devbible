---
title: "Debugging and testing reactive code"
sidebar_label: "9 · Debugging and testing"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Reactor 3 reference guide — *Debugging
> Reactor* (`Hooks.onOperatorDebug()` described as "the easiest but also the
> slowest way… because it captures the stacktrace on every operator" and "only
> to be activated in a controlled manner, as a last resort", the `reactor-tools`
> `ReactorDebugAgent` as the same output "without the runtime performance
> overhead", and `checkpoint()`) and *Testing* (`StepVerifier`,
> `StepVerifier.withVirtualTime`)
> (projectreactor.io/docs/core/release/reference/debugging.html and
> .../testing.html) — plus the Spring Framework reference on `WebTestClient`
> and the Spring Boot 4.0 migration guide's replacement of `@MockBean` with
> `@MockitoBean`. Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**The stack trace is the single largest day-to-day cost of the reactive model,
and it is not a tooling gap that will be fixed — it is inherent. A stack
describes how a thread got where it is, and in a reactive pipeline the thread
that fails is not the thread that assembled the chain, is not the thread that
subscribed, and has no record of either. Every debugging technique below exists
to reconstruct information the model structurally discards.**

## Why the trace is useless

When an exception is thrown inside an operator, the stack you get describes the
*subscription and delivery* path: Reactor's internal operator classes, the
scheduler that delivered the signal, and the network callback that started it.
What it cannot contain is the code that built the chain, because that code
returned long ago and its frames are gone.

The practical effect is that a failure tells you *which operator* and *which
exception*, but not *which request*, *which endpoint*, or *which of the eleven
call sites that build a similar chain*. In an imperative service, the same
exception would have named the controller method in the third frame.

## The four tools, in the order you should reach for them

**1. `log()`.** Cheap, local, and the most under-used. Insert it anywhere in a
chain and every signal passing through is logged — `onSubscribe`, `request(n)`,
each `onNext`, and the terminal signal or cancellation. Because it shows demand
and cancellation, it distinguishes the three failure modes that look identical
from outside: never subscribed, subscribed but requesting nothing, and
completed empty.

**2. `checkpoint()`.** Marks a point in the chain so that a later error carries
an "assembly trace" identifying it. The `checkpoint("description")` form skips
capturing a stack trace altogether and just attaches the description, which the
Reactor reference notes has less processing cost than a plain `checkpoint()`.
Put them at the boundaries you care about — around a downstream call, at the
top of a shared helper — and you get a breadcrumb without instrumenting the
world.

**3. `ReactorDebugAgent`** (from `reactor-tools`). A Java agent that instruments
operator assembly at class-load time, so errors carry assembly information
pointing at the line that built the chain. The reference presents it as giving
similar output to the debug hook "but without the runtime performance
overhead", which makes it the sane default for development and, unlike the
hook, defensible in production.

**4. `Hooks.onOperatorDebug()`.** The global switch. It captures a stack trace
at *every* operator assembly so that any later error can be decorated with
where it was assembled. The reference is unusually blunt: it is "the easiest
but also the slowest way", creating a stack trace is costly, and it should be
"activated in a controlled manner, as a last resort". Reserve it for a
reproducible bug you cannot pin down any other way.

Note the shape of that list: **the good tools require foresight and the
comprehensive tool is too expensive to leave on.** That is the debugging cost,
stated plainly.

## What a debugger can and cannot do

Breakpoints inside a lambda work — the lambda is a real method and it is really
called. What does not work is everything around it:

- **Step-over does not follow the data.** Stepping out of a `map` lands you in
  Reactor's internals, not in the next operator, because the next operator will
  be called later, possibly by another thread.
- **Variables from the assembling method are gone** unless the lambda captured
  them, and captured variables are the only context you get.
- **Conditional breakpoints on request identity are hard**, because there is no
  thread-bound request to test against — the identity has to be in the
  pipeline's data or in the Reactor `Context`, which is chunk 10's subject.

The workable habit is to log signals and rely on assembly traces rather than to
step. That is a genuine change to how a developer works, and it is a large part
of why teams report a long slowdown after adopting the stack.

## Testing with `StepVerifier`

Reactor's test module gives you an expectation DSL over a publisher:

```java
@Test
void emitsTwoViewsThenCompletes() {
    StepVerifier.create(service.page(0))
                .expectNext(firstView)
                .expectNext(secondView)
                .verifyComplete();          // ← subscribes and blocks the test thread
}

@Test
void mapsMissingOrderToNotFound() {
    StepVerifier.create(service.view("nope"))
                .expectErrorMatches(e -> e instanceof OrderNotFound)
                .verify();
}
```

Two properties are worth knowing:

- **`verify()` (or `verifyComplete`/`verifyError`) is what subscribes.** A
  `StepVerifier` chain without a terminal `verify*` call subscribes to nothing
  and asserts nothing — the same "nothing happens until you subscribe" trap,
  now in your test suite, where it produces a green test that tested nothing.
- **Virtual time makes delays instant.** `StepVerifier.withVirtualTime(() ->
  pipeline)` swaps in a `VirtualTimeScheduler`, and `thenAwait(Duration.ofHours(1))`
  advances it without waiting. Testing a retry-with-backoff or a long timeout
  is genuinely easier here than with blocking code and a clock abstraction —
  one of the few places where the reactive stack makes testing *better*.

## Testing the endpoint

`WebTestClient` is the reactive analogue of `MockMvc`, and it works against
either a mock server binding or a running one:

```java
@WebFluxTest(OrderController.class)
class OrderControllerTests {

    @Autowired WebTestClient client;

    @MockitoBean OrderService orders;      // ← Boot 4: @MockBean was REMOVED

    @Test
    void returnsTheView() {
        given(orders.view("42")).willReturn(Mono.just(view));

        client.get().uri("/orders/42")
              .exchange()
              .expectStatus().isOk()
              .expectBody(OrderView.class).isEqualTo(view);
    }
}
```

The Boot 4 note matters and breaks every sample written before 2026:
`@MockBean` and `@SpyBean` were **removed**, replaced by Spring Framework's
`@MockitoBean` and `@MockitoSpyBean`. `WebTestClient` itself also works against
a Spring MVC application, so it is not a reason to choose either stack.

## The trade-off

You gain a genuinely good assertion DSL and virtual time, which make
time-dependent behaviour easier to test than in blocking code. You pay with a
debugging story where the default tool — the stack trace — is close to useless,
the comprehensive replacement is too expensive to leave enabled, and the good
replacements require you to have anticipated the problem. Expect the team's
throughput to drop for months rather than weeks, and expect the drop to fall
hardest on whoever is on call.

## Gotchas

### A `StepVerifier` test that asserts nothing

**Symptom.** A test passes while the code it covers is obviously broken.

**Cause.** No terminal `verify()`, `verifyComplete()` or `verifyError()`. The
verifier was assembled and never subscribed.

**Fix.** Every `StepVerifier.create(...)` chain must end in a `verify*` call.
It is worth a review checklist item, and static analysis that flags ignored
return values catches it too.

### Leaving `Hooks.onOperatorDebug()` on

**Symptom.** Throughput drops noticeably after a debugging session, sometimes
weeks later, when someone finds the call in a configuration class.

**Cause.** The hook captures a stack trace at every operator assembly, on every
request. The reference calls it the slowest option and a last resort.

**Fix.** Use `ReactorDebugAgent` for a permanently-enabled assembly trace, and
`checkpoint()` where you already suspect trouble. If the hook goes in, it goes
in behind a property that is off by default.

### Debugging a `Flux` by adding `System.out.println` between operators

**Symptom.** The print statement fires once, at startup, and never again.

**Cause.** It runs at assembly time. Only code inside an operator runs per
signal.

**Fix.** `log()` for signals, `doOnNext(v -> log.debug(...))` for elements, and
`doFinally` for terminations — and remember that a `doOn*` callback runs on
whichever thread delivered the signal, so a slow logger there is a blocking
call on an event loop.

### Tests that pass because they blocked

**Symptom.** A test suite is green, and production behaves differently.

**Cause.** Tests written with `.block()` exercise the pipeline on the test
thread, where there is no event loop to starve, no scheduler hop, and no
cancellation. Anything that depends on threading — a `ThreadLocal`, a
context-dependent lookup — behaves differently there.

**Fix.** Prefer `StepVerifier` over `block()`, and use `WebTestClient` against a
real binding for anything involving filters, security or context propagation.

### Assuming an error's stack trace names the failing endpoint

**Symptom.** An incident where the trace identifies an operator and an
exception, and nobody can tell which request path produced it.

**Cause.** The assembling frames are gone by the time the signal is delivered.

**Fix.** Put the identity into the pipeline: `checkpoint("orders.view")` at
each boundary, correlation ids carried in the Reactor `Context` (chunk 10), and
per-endpoint metrics. In reactive code, observability has to be designed in
rather than recovered from a trace.

## Interview questions

**★ Why are stack traces unhelpful in reactive code?**
Because a stack describes how one thread reached a point, and in a reactive
pipeline the thread that fails is neither the thread that assembled the chain
nor necessarily the one that subscribed. The assembling frames returned long
ago, so the trace shows Reactor's internal operator classes and the scheduler
or network callback that delivered the signal. You learn the operator and the
exception, but not the endpoint, the request, or which of several similar call
sites built the chain.

**★ What is `Hooks.onOperatorDebug()` and why should you not leave it on?**
It is a global hook that captures a stack trace at every operator *assembly*,
so any later error can be annotated with where it was built. Reactor's own
documentation calls it the easiest but slowest option, notes that creating a
stack trace is costly, and says to activate it in a controlled manner as a last
resort. The production-appropriate alternative is `reactor-tools`'
`ReactorDebugAgent`, which instruments at class-load time and gives similar
information without the per-assembly cost.

**★ What does `checkpoint()` give you that a log statement does not?**
It attaches assembly information to any error that passes through, so the
failure itself carries the marker rather than requiring you to correlate it
with a log line. The `checkpoint("description")` variant is cheaper still,
because it records only the description and does not capture a stack trace.
It is the targeted, foresight-based tool: cheap, but only helpful where you
already suspected trouble.

**★ How do you test that a `Flux` emits three elements and completes?**
`StepVerifier.create(flux).expectNext(a, b, c).verifyComplete()`. The important
detail is that the terminal `verify*` call is what subscribes — a verifier
without it asserts nothing and passes, which is the "nothing happens until you
subscribe" trap reappearing in the test suite.

**★ How do you test a retry with a five-minute backoff without waiting five minutes?**
`StepVerifier.withVirtualTime(() -> pipeline)`, which installs a
`VirtualTimeScheduler`, then `thenAwait(Duration.ofMinutes(5))` to advance the
clock instantly. The supplier form matters: the pipeline must be *assembled*
inside the lambda so that it picks up the virtual scheduler. This is one of the
few areas where reactive code is genuinely easier to test than blocking code,
which normally needs an injected clock and a mockable sleep.

**★ What replaced `@MockBean` for a `@WebFluxTest` on Spring Boot 4?**
`@MockitoBean`, and `@SpyBean` became `@MockitoSpyBean` — Boot's own
annotations were removed in 4.0 in favour of the Spring Framework ones. It is
worth knowing because every tutorial and Stack Overflow answer written before
that uses the removed names, and the failure is a compile error rather than
something subtle.

**★ Can you use a debugger on a reactive pipeline?**
You can set breakpoints inside lambdas, and they work. What does not work is
the workflow: stepping out of an operator lands in Reactor's internals rather
than in the next stage, variables from the assembling method are gone unless
captured, and there is no thread-bound request identity to write a conditional
breakpoint against. The practical habit is to instrument with `log()`,
`checkpoint()` and the debug agent rather than to step.

---

← Prev: [The colour of your functions](08-the-colour-of-functions.md) · Index: [WebFlux and reactive](README.md) · Next → [Context: what `ThreadLocal` used to do](10-context-and-threadlocals.md)
