---
title: "Parallelising your dependency calls fixes the latency and does nothing whatsoever for the availability, because a chain and a fan-out multiply identically — a distinction people confidently get backwards"
sidebar_label: "07 · Chains, fan-out, composition"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io "Pattern: API Composition"
> ([microservices.io](https://microservices.io/patterns/data/api-composition.html)),
> "Pattern: Remote Procedure Invocation (RPI)"
> ([microservices.io](https://microservices.io/patterns/communication-style/rpi.html)), and
> the Spring Framework 7.0.x reference for `RestClient` and `WebClient`
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html)).
> 🔴 **All numbers on this page are arithmetic from assumed inputs, not measurements.**
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**There are two topologies for a request that needs several services: a chain, where A calls
B which calls C, and a fan-out, where A calls B, C and D itself. They behave completely
differently on latency and identically on availability. Getting this right matters because
"we'll do them in parallel" is the most common response to an availability objection, and it
is an answer to a different question. It is still worth doing — the latency argument is
real — but it must not be allowed to close the availability discussion.**

## The two shapes

```text
Chain (depth 3)                  Fan-out (breadth 3)

client → A → B → C               client → A ─┬→ B
                                             ├→ C
                                             └→ D
```

## Availability: identical

Both need all the services. `A(op) = p_A × p_B × p_C`. Rearranging the topology does not
change which conjunctions are required, and the product of a set of probabilities does not
depend on the order you multiply them in. Three hard dependencies is three hard dependencies
whether they are stacked or spread.

**The only thing that changes availability is removing a dependency from the required set**,
by deleting it, deferring it, or defining a degraded answer for it. Topology is not one of
the levers.

## Latency: completely different

Write `Lᵢ` for the time contributed by hop i, including its own downstream work.

```text
Chain:    L_total = L_A + L_B + L_C          (sum)
Fan-out:  L_total = L_A + max(L_B, L_C, L_D) (the slowest one)
```

That is the whole argument for parallelising, and it is a strong one. A fan-out's latency is
governed by its slowest branch; a chain's is governed by the sum of all of them. Converting
a three-deep chain into a three-wide fan-out is often the single largest latency improvement
available in a microservice request path.

It comes with two costs that are easy to miss:

- **You sample the tail more often.** With three parallel calls, the request is slow if *any*
  of them is slow, so you are exposed to each dependency's tail latency rather than to an
  average. [04f · Tail latency under fan-out](04f-tail-latency-under-fan-out.md) does that
  arithmetic.
- **You raise the instantaneous load.** Three calls issued at once is a burst; three issued
  in sequence is a trickle. Capacity coupling, from
  [02c](02c-the-five-things-coupling-means.md), gets worse.

## Parallel fan-out in Spring, without pretending it is free

`RestClient` is synchronous by design — the Spring Framework reference describes it as
*"a synchronous HTTP client that exposes a modern, fluent API"* and notes that *"Once
created, a `RestClient` is safe to use in multiple threads."* Parallelising with it means
running the calls on separate threads, which on JDK 25 means virtual threads:

```java
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
        try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
            var customer = scope.fork(() -> customers.byId(command.customerId()));
            var stock    = scope.fork(() -> inventory.check(command.sku(), command.quantity()));
            var price    = scope.fork(() -> pricing.quote(command.sku(), command.quantity()));

            scope.join();
            scope.throwIfFailed();

            return new OrderContext(customer.get(), stock.get(), price.get());
        }
    }
}
```

Read what `ShutdownOnFailure` encodes: **the first failure cancels the others and the whole
assembly fails.** That is precisely the availability product, made explicit in code. The
structure is honest — it says out loud that all three are hard dependencies — and that
honesty is the reason to prefer it to three sequential calls that fail one at a time in an
order nobody chose.

If one of the three is *not* a hard dependency, the structure has to say so, and
`ShutdownOnFailure` is then the wrong scope. See
[09d · Degrading instead of failing](09d-degrading-instead-of-failing.md) for the version
where a branch is allowed to fail.

The reactive equivalent with `WebClient` composes the same way with `Mono.zip`, and carries
the same semantics: if any source errors, the combined `Mono` errors.

## A service you call twice is one term, not two

A subtlety that changes real answers. If your request calls Customer Service twice — once
for the customer and once for their addresses — the availability term for Customer Service
appears **once**, not squared. The two calls are not independent events: if Customer Service
is down, both fail; if it is up, both succeed. Perfect correlation collapses them.

```text
Wrong:  A = p_customer² × p_inventory
Right:  A = p_customer  × p_inventory
```

The practical consequence is the opposite of the obvious one: **merging two calls to the
same service into one endpoint improves latency and chattiness but not availability.** That
is still worth doing — fewer round trips, less capacity coupling — but do not book an
availability gain for it, and do not let it substitute for removing a *distinct* dependency,
which is where the availability actually is.

The general rule: count **distinct failure domains**, not calls. Two calls to one service is
one domain. Two calls to two services that share a database is arguably also close to one
domain — see [03d · Where the arithmetic lies](03d-where-the-arithmetic-lies.md).

## API composition is the fan-out with a name

The microservices.io pattern for querying across services describes exactly this:

> *"Implement a query by defining an API Composer, which invoking the services that own the
> data and performs an in-memory join of the results."*

Its stated drawback is about efficiency —

> *"Some queries would result in inefficient, in-memory joins of large datasets."*

— and that is the drawback the pattern page names. **The availability drawback is the one
this topic adds**: an API composer over k services has an availability of the product of all
k, so a "read-only, harmless" composed query is one of the least available operations in the
system. Composers tend to be built for dashboards and list pages, which are the pages users
see most often, which is how a system ends up with its most-visited page also being its most
fragile.

The two mitigations are both about removing terms, not about the composer:

- Let branches fail and render a partial result — a missing badge on a card is a better
  outcome than a 500 for the whole page. This turns k hard dependencies into k soft ones and
  removes the product entirely.
- Maintain a read model that already contains the joined data, so the query touches one
  store. That is CQRS, and **03 · Database-per-service** *(not written yet)* owns the pattern;
  what belongs here is that its availability profile is the reason to reach for it.

## Depth is worse than breadth, for reasons other than availability

The product is the same, but a deep chain is operationally worse than a wide fan-out on
every other axis:

| | Chain of 3 | Fan-out of 3 |
|---|---|---|
| Latency | sum | slowest branch |
| Latency budget | must be split across depths — see [04b](04b-deadline-propagation.md) | each branch gets the whole remaining budget |
| Blast radius of a slow service | back-pressures every service above it | back-pressures only the composer |
| Debuggability | the failure surfaces three services away from its cause | the failure is one hop from the composer |
| Change impact | a new field may need three services changed | one service changed |

The last row is design-time coupling, and it is the reason "chatty synchronous chains" is one
of the named tells of a distributed monolith in **12 · The distributed monolith**
*(not written yet)*.

So: flatten chains into fan-outs where you can, and understand that you did it for latency,
blast radius and debuggability. The availability number is unmoved and that is fine — you
made three real improvements.

## Gotchas

**★ "We'll call them in parallel" is offered as an availability fix and is not one.**
Parallelism changes `L_A + L_B + L_C` into `L_A + max(...)`. It leaves `p_A × p_B × p_C`
exactly where it was. Accept the latency improvement, then repeat the availability question.

**★ A parallel fan-out with `ShutdownOnFailure` fails faster, which reads as a regression in
your metrics.** Previously a request that was going to fail did so after three sequential
timeouts; now it fails after one. Error *count* is unchanged, error *latency* drops, and a
dashboard that tracks "slow requests" will look better while nothing improved. Track outcome
per dependency, not aggregate latency, or you will mis-attribute the change.

**★ Fan-out multiplies your load on the downstream services by the fan-out width, all at
once.** Ten parallel branches from a page that is rendered on every session is ten times the
request rate of the sequential version at the same page-view rate — the same total, delivered
in a burst. If a downstream service is sized on average rate rather than peak, the switch to
parallel is what breaks it.

**★ Counting calls instead of distinct services overstates the product and undermines the
argument.** Someone will check, find that you double-counted a service you call twice, and
conclude the whole analysis is inflated. Count failure domains.

**★ An in-memory join in a composer is a memory risk as well as an availability risk.**
The pattern page's drawback about *"inefficient, in-memory joins of large datasets"* is real:
a composer that fetches all orders and all customers to join them holds both in heap. On a
service with a modest container limit that is an OOM, which is an availability event caused
by the composer itself and not by any dependency.

**★ Structured concurrency does not give you per-branch timeouts for free.** `scope.join()`
waits for all branches; the deadline for the whole assembly has to be applied explicitly, and
each client still needs its own read timeout or a hung branch holds the scope open. See
[04c · Timeouts in Spring](04c-timeouts-in-spring.md) and
[04d](04d-the-timeout-that-is-not-a-timeout.md).

## Interview questions

**★ Does calling three dependencies in parallel instead of in sequence improve availability?**
No. All three are still required, so the availability is still the product of the three. What
changes is latency — the total becomes the slowest branch instead of the sum — plus blast
radius and debuggability, all of which are worth having. The availability only moves if a
dependency leaves the required set, which means deleting the call, deferring it, or defining a
degraded response for it.

**★ Your request calls Customer Service twice. How many terms does that contribute to the
availability product?**
One. The two calls are perfectly correlated: the service is either up for both or down for
both, so squaring its availability would model an independence that does not exist. Merging
the two calls into one endpoint is still worth doing for latency and load, but it is not an
availability improvement, and presenting it as one is a mistake a reviewer will catch.

**★ What is the availability cost of an API composer, and why is it usually discovered late?**
Its availability is the product across every service it composes, so a composer over five
services is the least available operation in the system. It is discovered late because
composers are built for read-only dashboards and list pages, which feel harmless, and because
in staging every dependency is always up so the composed query never fails. The fix is either
to make the branches optional and render a partial result, or to precompute the join into a
read model so the query touches one store.

**★ Chain or fan-out — which would you rather inherit, and why?**
Fan-out, on almost every axis except one. Latency is the slowest branch rather than the sum;
the latency budget does not have to be subdivided across depths; a slow service back-pressures
only the composer rather than every service above it; a failure surfaces one hop from its
cause instead of three; and a new field usually touches one service instead of three.
Availability is identical, which is the only axis on which the chain is not worse.

**★ When is a chain actually the right shape?**
When each hop genuinely owns a decision the one above it must not make. A gateway calling an
order service that calls a payment service is a chain because the order service owns the
"should this payment be attempted, and for how much" decision, and hoisting that into the
gateway would put business logic at the edge — which
**07 · API gateway** *(not written yet)* forbids for good reasons. The rule is not "never
chain"; it is "chain only where the intermediate hop is making a decision, never where it is
merely forwarding".

{/* FOOTER */}
