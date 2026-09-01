---
title: "Latency is a budget set once at the edge and spent by everyone downstream, and the reason your request tree has no budget is that every hop invented its own timeout in isolation"
sidebar_label: "11 · The latency budget"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Google SRE book, "Addressing Cascading Failures" —
> the *Latency and Deadlines* section
> ([sre.google](https://sre.google/sre-book/addressing-cascading-failures/)) — and Marc
> Brooker, "Timeouts, retries, and backoff with jitter", Amazon Builders' Library
> ([aws.amazon.com](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)).
> 🔴 **No sandbox and no measurements.** Every duration on this page is either a *chosen
> budget* used to illustrate arithmetic, or a figure attributed to the source it came from.
> No latency, percentile or throughput figure here was observed on a running system.
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Availability is the coupling cost people eventually notice. Latency is the one they notice
first and misdiagnose longest, because it accumulates in a place nobody owns. The user's
patience is a fixed quantity, it is spent by the whole request tree, and in almost every
system nobody has divided it up — each service picked a timeout that seemed reasonable in
isolation, and the sum is a number no product owner ever agreed to. Treating latency as a
budget, allocated top-down, is the difference between a system whose slow path is designed
and one whose slow path is an emergent property of six independent guesses.**

## The budget is a property of the operation, not of any service

Start where the money is: the user, or the caller's SLO. Suppose the product decision is
that checkout must respond within some bound — call it `B`. That is the budget. Every service
in the tree spends from `B`, and `B` does not grow because you added a hop.

For a chain of depth d, the constraint is:

```text
B  ≥  own_work + Σ (hop_i)          for a serial chain
B  ≥  own_work + max(hop_i)         for a parallel fan-out
```

and for each hop, `hop_i` is not the callee's own processing time — it is the callee's *whole
subtree*, plus the network, plus serialisation on both sides, plus connection acquisition,
plus whatever the callee's own dependencies do.

The mistake that produces unbounded latency is subtle and universal: **each service sets its
client timeout based on how long that call usually takes, rather than on how much of the
budget is left.** Three services each choosing "2 seconds seems fine" produce a six-second
worst case for an operation with a one-second budget, and none of the three did anything
locally unreasonable.

## The SRE book's framing, verbatim

The *Latency and Deadlines* section states what a deadline is actually for, and it is not
what most people think:

> *"When a frontend sends an RPC to a backend server, the frontend consumes resources waiting
> for a reply. RPC deadlines define how long a request can wait before the frontend gives up,
> limiting the time that the backend may consume the frontend's resources."*

Read that twice. **A timeout is primarily a resource-protection mechanism for the caller**,
not a user-experience feature. The user-experience part follows, but the reason a system
without timeouts collapses is that unbounded waits consume unbounded caller resources.

On why long deadlines are worse than they look:

> *"Setting either no deadline or an extremely high deadline may cause short-term problems
> that have long since passed to continue to consume server resources until the server
> restarts."*

And the line worth putting on a wall, about work done past the deadline:

> *"A common theme in many cascading outages is that servers spend resources handling
> requests that will exceed their deadlines on the client. As a result, resources are spent
> while no progress is made: you don't get credit for late assignments with RPCs."*

That last sentence is the whole argument for propagating deadlines rather than inventing them
per hop, which is [04b · Deadline propagation](04b-deadline-propagation.md).

## How to allocate a budget, concretely

The procedure, using a chosen budget of 400 ms purely to make the arithmetic legible — **this
is a design input, not a measurement**:

1. **Start with `B`.** 400 ms, agreed with whoever owns the user experience.
2. **Reserve for your own work.** Deserialisation, business logic, your own database, response
   serialisation. Say 100 ms. Remaining: 300 ms.
3. **Reserve a safety margin.** The SRE book suggests reducing the outgoing deadline *"a bit
   (e.g., a few hundred milliseconds) to account for network transit times and
   post-processing in the client."* Say 50 ms. Remaining: 250 ms.
4. **Divide what is left among the hops, according to shape.**
   - Serial chain of two: they must share the 250 ms. Not 250 each.
   - Parallel fan-out of three: each may have up to 250 ms, because they overlap.
5. **Push the number down.** Each callee is told, explicitly, how long it has — see
   [04b](04b-deadline-propagation.md). It then repeats this procedure with its own smaller
   `B`.

Step 4 is where the shape of the tree changes the answer, and it is a second, independent
argument for fan-out over chain: **a fan-out does not have to subdivide the budget.**
[07 · Chains, fan-out and composition](03c-chains-fan-out-and-composition.md) made the
latency case; this is the budgeting case, and it is the sharper one.

## The number you must not pick

There is a strong temptation to set each hop's timeout from the callee's observed latency
distribution. Brooker's article describes exactly that practice at Amazon and it is worth
quoting in full because the caveats are the useful part:

> *"A good practice for choosing a timeout for calls within an AWS Region is to start with
> the latency metrics of the downstream service. So at Amazon, when we make one service call
> another service, we choose an acceptable rate of false timeouts (such as 0.1%). Then, we
> look at the corresponding latency percentile on the downstream service (p99.9 in this
> example)."*

Note what this technique gives you: **a timeout that produces an acceptable rate of false
timeouts.** It does not give you a timeout that fits the budget. Those are two different
constraints and you need both:

```text
timeout_for_hop = min( budget_remaining_for_this_hop,
                       percentile_that_gives_acceptable_false_timeouts )
```

If the percentile-derived number is larger than the budget allows, you have discovered
something important — **the callee is too slow for this operation** — and the honest responses
are to make it faster, to remove the hop, or to change the budget. Silently using the larger
number means the operation misses its budget on a predictable fraction of requests and nobody
finds out until a user complains.

Brooker also names the pitfalls of the percentile approach, and both bite in microservice
systems:

> *"This approach also doesn't work with services that have tight latency bounds, where p99.9
> is close to p50. In these cases, adding some padding helps us avoid small latency increases
> that cause high numbers of timeouts."*

and

> *"There are also implementations where the timeout doesn't cover all remote calls, like DNS
> or TLS handshakes."*

That second one is [04d · The timeout that is not a
timeout](04d-the-timeout-that-is-not-a-timeout.md), and it is the source of more surprise than
any other item in this band.

## What happens when there is no budget

The characteristic failure is not "requests are slow". It is:

1. A dependency four hops down slows by some amount.
2. Every service above it holds its request open, because each one's timeout is generous.
3. Threads, connections and heap fill up **in services that are not slow and have no fault**.
4. Those services start failing health checks or rejecting requests.
5. The incident is now visible in five services, and the one with the actual problem is not
   obviously distinguishable from the four that are collateral.

The SRE book's worked bimodal-latency example in
[04e](04e-bimodal-latency-and-exhaustion.md) shows how violently step 3 can amplify — a small
fault rate producing a large error rate purely through deadline choice.

The diagnosis that follows is genuinely hard, because every service's dashboard shows the
same thing (high latency, exhausted pool) and none of them shows a cause. **A budget that is
allocated top-down and enforced per hop turns that into a much easier incident**: the
services above the fault fail fast with a timeout naming the dependency, and the failure
points at itself.

## Latency and availability are the same decision seen twice

Every hop costs you availability *and* latency budget, and the two constraints usually agree
about which hops to remove. That is convenient, and it has a trap in it: the two constraints
disagree about **timeouts**.

- The availability argument wants a *long* timeout, because a request that eventually
  succeeds is a success.
- The latency-budget argument wants a *short* timeout, because a request that succeeds after
  the budget has expired is a failure the user has already left.
- The resource-protection argument, which is the SRE book's, wants a *short* timeout, because
  waiting consumes the caller.

Two of the three point the same way, and they are the two that determine whether the system
stays up. **When in doubt, the timeout is shorter than feels comfortable**, and the discomfort
you feel is the cost of the availability you were quietly buying with unbounded waits.

## Gotchas

**★ Every hop choosing a locally reasonable timeout produces a globally unreasonable one.**
This is the default state of every system nobody has budgeted, and it is not caused by anyone
making a bad decision — it is caused by the decision being made at the wrong level. The budget
has to be allocated from the top, because only the top knows what the total is.

**★ The timeout you set does not bound the work the callee does.** Your client gives up; the
callee keeps going, still holding a thread, a connection and a transaction, doing work whose
result nobody will read. That is the *"you don't get credit for late assignments"* problem, and
the only fixes are for the callee to know the deadline (propagation) and to check it between
stages. See [04b](04b-deadline-propagation.md).

**★ A retry silently multiplies your latency budget consumption.** A hop with a 250 ms timeout
and two retries can consume 750 ms plus backoff. If the budget was 400 ms, the retry policy has
guaranteed a budget violation on every retried request. Retry budgets must be allocated from
the *hop's* allowance, not added on top of it — see
[07b · Retries and amplification](07b-retries-and-amplification.md).

**★ The connection pool is part of the budget and is invisible in every client timeout.**
Time spent waiting to acquire a connection from an exhausted pool is not connect time and not
read time; on most clients it has its own limit, and if that limit is not set the wait is
unbounded. Under load this is frequently the largest single component of latency, and it
appears in no timeout you configured. [04d](04d-the-timeout-that-is-not-a-timeout.md).

**★ Serialisation is not free and lands on both sides of the hop.** A large JSON response is
CPU on the callee and CPU on the caller, and it scales with payload size, not with the
callee's business logic. An endpoint that returns 500 items because the caller only needs one
field is spending budget on both ends. This is where the tolerant-reader and
field-selection discussions in **05 · Inter-service REST** *(not written yet)* become a
latency argument.

**★ A budget nobody wrote down is not a budget.** If the number lives in one engineer's head,
the next change to the request path will violate it without anyone noticing. It belongs in the
design document and, ideally, as a constant in the code next to the client configuration.

## Interview questions

**★ What is a latency budget and who owns it?**
It is the total time an operation is permitted to take, decided at the top of the request tree
from a product or SLO requirement, and spent by every service beneath. It is owned by the
entry point — the service that faces the user or the caller with the SLO — because only that
service knows the total. Each service downstream receives an allocation, spends part of it on
its own work, and passes the remainder down. Nobody below the top gets to *choose* their
budget; they get to divide the one they were given.

**★ What is the primary purpose of a timeout — is it about the user's experience?**
Not primarily. The SRE book's framing is that deadlines exist to limit *"the time that the
backend may consume the frontend's resources"* — a caller waiting on a reply is holding a
thread, a connection and memory, and unbounded waits mean unbounded resource consumption in
the caller. The user-experience benefit is real but secondary; the reason a system without
timeouts collapses under a slow dependency is resource exhaustion in services that have no
fault of their own.

**★ How would you choose the timeout for a specific hop?**
Two constraints, and take the smaller. First, the budget: how much of the operation's total
time is left for this hop, given the shape of the tree and the safety margin. Second, the
false-timeout rate: pick an acceptable rate — Brooker's article uses 0.1% as an example — and
take the corresponding latency percentile of the downstream service, padding it where p99.9 is
close to p50. If the second number exceeds the first, the design is broken: the callee is too
slow for this operation, and the answer is to speed it up, remove the hop, or renegotiate the
budget — not to quietly use the bigger number.

**★ Why does a fan-out make budgeting easier than a chain?**
Because parallel branches overlap, so each branch can be allocated the whole remaining budget
rather than a fraction of it. In a serial chain of three, the remaining budget has to be
divided three ways, so each hop gets a third — which frequently turns out to be less than the
callee can reliably deliver. That subdivision, not just the summed latency, is the reason deep
chains become unbudgetable and shallow trees stay manageable.

**★ Latency and availability both argue for fewer hops. Where do they disagree?**
On timeout length. The availability argument prefers a long timeout, because a slow success is
still a success. The latency-budget argument prefers a short one, because a response that
arrives after the user has gone is a failure that also consumed resources. The
resource-protection argument agrees with the latency one, and it is the one that determines
whether the caller survives a downstream slowdown. Two of the three point at "shorter", which
is why the default should be shorter than feels comfortable.

**★ Your incident dashboard shows high latency and exhausted thread pools in five services.
How do you find the fault?**
That symptom pattern is what an unbudgeted request tree looks like, and it is deliberately
uninformative — the four healthy services look exactly like the broken one. Work from the
leaves inward rather than from the symptom: find the deepest service whose *own* work is slow
rather than whose waiting is slow, which usually means looking at time spent excluding
outbound calls. The structural fix afterwards is deadline propagation, so that the services
above the fault fail fast with a timeout that names the dependency, instead of all queueing on
it.

{/* FOOTER */}
