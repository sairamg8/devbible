---
title: "Fanning out to three services in Java on JDK 25 means structured concurrency, which is still a preview API and changed shape in this very release — and whichever form you use, the joiner you pick is a statement about which dependencies are hard"
sidebar_label: "08 · Fanning out in Java"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against JEP 505, "Structured Concurrency (Fifth Preview)"
> ([openjdk.org](https://openjdk.org/jeps/505)) — status *Closed / Delivered*, release **25**
> — and the Spring Framework 7.0.x reference for `RestClient` and `WebClient`
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html)).
> 🔴 **No sandbox.** Nothing on this page was executed; there are no timings and no output.
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A fan-out is the right shape for calling three independent services, and on JDK 25 the
Java for it is unsettled in a way worth knowing about before you copy a sample. Structured
concurrency has previewed five times, and the JDK 25 revision removed the exact classes every
tutorial written between JDK 21 and 24 uses. What survives the API churn is the important
part: the joiner you choose is an executable statement about which of your dependencies are
hard, and it is the only place in a codebase where that statement is ever written down.**

## The shape this page implements

[07 · Chains, fan-out and composition](03c-chains-fan-out-and-composition.md) argues that a
fan-out has the same availability as a chain and much better latency, blast radius and
debuggability. This page is how you write one.

`RestClient` is synchronous by design — the Spring Framework reference calls it *"a
synchronous HTTP client that exposes a modern, fluent API"* and notes that *"Once created, a
`RestClient` is safe to use in multiple threads."* Parallelising with it means running the
calls on separate threads, and on JDK 25 the structured way to do that is
`StructuredTaskScope`.

⚠️ **`StructuredTaskScope` is a preview API on JDK 25.** JEP 505 (Structured Concurrency,
Fifth Preview) is explicit: *"`StructuredTaskScope` is a preview API, disabled by default"*,
and *"To use the `StructuredTaskScope` API you must enable preview APIs"* — `javac --release
25 --enable-preview` and `java --enable-preview`. It also **changed shape in JDK 25**: scopes
are now opened by static factory methods, not constructors, and the JDK 21–24 nested classes
`ShutdownOnFailure` / `ShutdownOnSuccess` are gone. Any sample you find using
`new StructuredTaskScope.ShutdownOnFailure()` predates JDK 25.

```java
// requires --enable-preview on JDK 25
import java.util.concurrent.StructuredTaskScope;

@Service
class OrderAssembler {

    private final CustomerClient customers;
    private final InventoryClient inventory;
    private final PricingClient pricing;

    OrderAssembler(CustomerClient customers, InventoryClient inventory, PricingClient pricing) {
        this.customers = customers;
        this.inventory = inventory;
        this.pricing = pricing;
    }

    OrderContext assemble(PlaceOrder command) throws InterruptedException {
        try (var scope = StructuredTaskScope.open()) {
            var customer = scope.fork(() -> customers.byId(command.customerId()));
            var stock    = scope.fork(() -> inventory.check(command.sku(), command.quantity()));
            var price    = scope.fork(() -> pricing.quote(command.sku(), command.quantity()));

            scope.join();   // propagates the first failure, cancelling the others

            return new OrderContext(customer.get(), stock.get(), price.get());
        }
    }
}
```

Read what the zero-argument `open()` encodes. JEP 505 describes it as creating *"a
`StructuredTaskScope` that waits for all subtasks to succeed or any subtask to fail"* — **the
first failure cancels the others and the whole assembly fails.** That is precisely the
availability product, made explicit in code. The structure is honest: it says out loud that
all three are hard dependencies, and that honesty is the reason to prefer it to three
sequential calls that fail one at a time in an order nobody chose.

The whole-assembly deadline belongs on the scope, not on each client. The three-argument
`open` takes a configuration function:

```java
try (var scope = StructuredTaskScope.open(
        StructuredTaskScope.Joiner.<Object>allSuccessfulOrThrow(),
        cf -> cf.withTimeout(Duration.ofMillis(400)))) {
    // ...
}
```

JEP 505 states the semantics precisely: *"If the timeout expires before or while waiting in
the `join()` method then the scope is cancelled, which cancels all incomplete subtasks, and
`join()` throws a `TimeoutException`."* That is a real latency-budget control, and it is the
in-process half of what [04b · Deadline propagation](04b-deadline-propagation.md) argues for.
It does **not** replace per-client read timeouts — see
[04d](04d-the-timeout-that-is-not-a-timeout.md).

If you cannot enable preview features, the same fan-out with a virtual-thread executor is
plain, stable API on JDK 25:

```java
OrderContext assemble(PlaceOrder command) throws Exception {
    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        Future<Customer>   customer = executor.submit(() -> customers.byId(command.customerId()));
        Future<StockLevel> stock    = executor.submit(() -> inventory.check(command.sku(), command.quantity()));
        Future<Money>      price    = executor.submit(() -> pricing.quote(command.sku(), command.quantity()));

        return new OrderContext(customer.get(), stock.get(), price.get());
    }
}
```

This is functionally similar and structurally weaker: nothing cancels the siblings when one
fails, so a failed branch still leaves two calls running to completion, wasting downstream
capacity you are already short of. That difference is exactly what structured concurrency
exists to fix.

If one of the three is *not* a hard dependency, the structure has to say so, and the
all-or-nothing joiner is then the wrong policy. See
[09d · Degrading instead of failing](09d-degrading-instead-of-failing.md) for the version
where a branch is allowed to fail.

The reactive equivalent with `WebClient` composes the same way with `Mono.zip`, and carries
the same semantics: if any source errors, the combined `Mono` errors.


## Gotchas

**★ Every `StructuredTaskScope` sample written before JDK 25 will not compile on JDK 25.**
`new StructuredTaskScope.ShutdownOnFailure()` was the idiom through four previews and is gone;
JEP 505 replaced constructors with `open()` factory methods and moved the policy into a
`Joiner`. Because it is a preview API there is no deprecation cycle and no compatibility
promise — that is what "preview" means. Treat any sample without a JDK version beside it as
unusable.

**★ It is a preview API, so it is a build-configuration decision, not just a code decision.**
`--enable-preview` has to be set for `javac` and for `java`, it applies to the whole
application, and preview class files are tied to the exact JDK release that produced them.
Teams routinely discover this after the code is written. If that is unacceptable, use the
virtual-thread executor form above and accept the weaker cancellation.

**★ A fan-out that fails fast reads as a regression in your latency dashboard.**
Previously a doomed request failed after three sequential timeouts; with an all-or-nothing
joiner it fails after the first. The error *count* is unchanged, the error *latency* drops,
and a dashboard tracking "slow requests" improves while nothing about correctness did. Track
outcome per dependency, not aggregate latency, or you will mis-attribute the change — in
either direction.

**★ The virtual-thread-executor form leaks work on failure.** `Future.get()` on the first
branch throws, you return, and the other two calls run to completion against services you may
already be overloading. Nothing cancels them. That is the concrete cost of not using
structured concurrency, and it is worst exactly when it matters most — during a downstream
incident.

**★ `scope.withTimeout(...)` is a budget for the scope, not a substitute for client
timeouts.** If a branch's HTTP client has no read timeout and the server never responds, the
scope's timeout will cancel the subtask — but cancellation of a thread blocked in a socket
read depends on the client honouring interruption, and the connection may be held until the
transport gives up. Set both: a read timeout per client, and a scope timeout for the whole
assembly. See [04c · Timeouts in Spring](04c-timeouts-in-spring.md) and
[04d](04d-the-timeout-that-is-not-a-timeout.md).

**★ Fan-out multiplies downstream load by the fan-out width, delivered as a burst.**
Ten parallel branches at the same page-view rate is the same total request count as ten
sequential ones, arriving all at once. A downstream service sized on average rate rather than
peak is broken by the switch to parallel even though nothing about the total changed. This is
capacity coupling from [04 · The five couplings](02c-the-five-things-coupling-means.md).

**★ `Mono.zip` has the same all-or-nothing semantics and hides it better.** If any source
errors, the combined `Mono` errors, and the other subscriptions are cancelled. That is usually
what you want and it is never stated at the call site. If one of the sources is optional,
`onErrorResume` on *that source* is where the optionality has to be written — not downstream
of the zip, where it can no longer tell which branch failed.

## Interview questions

**★ You are on JDK 25 and a sample uses `new StructuredTaskScope.ShutdownOnFailure()`. What
do you do?**
Recognise it as pre-JDK-25 and rewrite it. JEP 505 replaced the public constructors with
static `open()` factory methods and moved the completion policy into a `Joiner`; the zero-arg
`open()` is the all-or-nothing case the old `ShutdownOnFailure` covered. It is also still a
preview API, so before writing any of it, confirm the project can set `--enable-preview` for
both compilation and runtime — if it cannot, the fan-out has to be built on a virtual-thread
`ExecutorService` instead.

**★ What does the virtual-thread-executor version give up compared with structured
concurrency?**
Cancellation and structure. With `Executors.newVirtualThreadPerTaskExecutor()` and three
`Future` handles, the first failed `get()` propagates and the other two subtasks keep running
to completion — burning downstream capacity for a result nobody will read, precisely when the
downstream is already struggling. Structured concurrency confines the subtasks' lifetimes to
the lexical scope and cancels the siblings when the policy says the scope is done.

**★ Why is the choice of joiner an architectural statement?**
Because it encodes which dependencies are hard. `allSuccessfulOrThrow` (or the zero-arg
`open()`) says every branch is required, so the operation's availability is the product of all
of them. `anySuccessfulResultOrThrow` says the branches are redundant alternatives, so the
availability is `1 - Π(1 - pᵢ)` and improves with each one added. A policy that allows
individual branches to fail and yields whatever succeeded says the branches are soft
dependencies and do not enter the product at all. Those three lines of code are three
completely different availability models, and the joiner is the only place the difference is
written down.

**★ Where should the deadline for a three-branch fan-out live?**
In two places, and they answer different questions. Each client needs a read timeout so a
single dead socket cannot occupy a thread indefinitely — that bounds one hop. The scope needs
a timeout so the whole assembly cannot exceed the budget the caller was given, regardless of
how the individual hops behave — that bounds the operation. JEP 505 specifies that when the
scope timeout expires the scope is cancelled, incomplete subtasks are cancelled, and `join()`
throws a `TimeoutException`, which is the behaviour you want at the assembly level.

**★ Does using virtual threads for the fan-out change the availability arithmetic?**
No. It changes which resource runs out when a dependency is slow: platform threads no longer
pin, so the caller can hold far more in-flight requests before it degrades. That is a real
capacity improvement and it is not an availability improvement — every one of those in-flight
requests still fails when its deadline expires. See
[09c · Blocking cost and virtual threads](09c-blocking-cost-and-virtual-threads.md).

{/* FOOTER */}
