---
title: "A fan-out is as slow as its slowest branch, so widening it samples every dependency's tail once more per request — and Dean and Barroso's paper shows a one-in-a-hundred slow response turning into 63% of user requests being slow at a fan-out of a hundred"
sidebar_label: "17 · Tail latency under fan-out"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Jeffrey Dean and Luiz André Barroso, "The Tail at Scale",
> *Communications of the ACM* 56(2), February 2013
> ([barroso.org PDF](https://www.barroso.org/publications/TheTailAtScale.pdf)), and the Google
> SRE book, "Addressing Cascading Failures"
> ([sre.google](https://sre.google/sre-book/addressing-cascading-failures/)).
> 🔴 **Arithmetic and quoted figures only.** The percentages below are either computed from a
> stated assumption or reproduced from the paper with attribution. Nothing was measured here.
> Version spine: JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[07 · Chains, fan-out and composition](03c-chains-fan-out-and-composition.md) says a
fan-out's latency is the slowest branch, which sounds like good news. It is, until you notice
what "slowest of n" does to a distribution. Every branch is an independent draw from that
dependency's latency distribution, so widening the fan-out means drawing from the tail more
often, and the probability that *at least one* branch is slow rises fast. This is the reason
that services which are individually fine compose into a service that is not, and it is
arithmetic you can do before you build the thing.**

## The paper's own example, verbatim

Dean and Barroso set it up like this:

> *"Variability in the latency distribution of individual components is magnified at the
> service level; for example, consider a system where each server typically responds in 10ms
> but with a 99th-percentile latency of one second. If a user request is handled on just one
> such server, one user request in 100 will be slow (one second)."*

and then the consequence:

> *"If a user request must collect responses from 100 such servers in parallel, then 63% of
> user requests will take more than one second."*

> *"Even for services with only one in 10,000 requests experiencing more than one-second
> latencies at the single-server level, a service with 2,000 such servers will see almost one
> in five user requests taking more than one second."*

The paper also reports what the effect looks like in a real Google service, and this is the
sentence to remember when someone proposes "just wait for all of them":

> *"The 99th-percentile latency for a single random request to finish, measured at the root, is
> 10ms. However, the 99th-percentile latency for all requests to finish is 140ms, and the
> 99th-percentile latency for 95% of the requests finishing is 70ms, meaning that waiting for
> the slowest 5% of the requests to complete is responsible for half of the total
> 99%-percentile latency."*

## The arithmetic, so you can do it for your own fan-out

Let `q` be the probability that a single branch exceeds your threshold. If the branches are
independent, the probability that **at least one** exceeds it is:

```text
P(request is slow) = 1 - (1 - q)ⁿ
```

Evaluated:

| Branches (n) | q = 1% | q = 0.1% |
|---|---|---|
| 1 | 1.0000% | 0.1000% |
| 2 | 1.9900% | 0.1999% |
| 3 | 2.9701% | 0.2997% |
| 5 | 4.9010% | 0.4990% |
| 10 | 9.5618% | 0.9955% |
| 20 | 18.2093% | 1.9811% |
| 50 | 39.4994% | 4.8794% |
| 100 | 63.3968% | 9.5208% |

The bottom-left cell is the paper's 63%, reproduced from the formula, which is a useful check
that you have the model right.

**Compare that table to the availability table in
[05 · Availability multiplication](03-availability-multiplication.md) and notice they are the
same shape.** Availability is `pⁿ`; tail exposure is `1 - (1-q)ⁿ`, which is `1 - pⁿ` with
`p = 1 - q`. They are the same arithmetic applied to two different bad events. A hop costs you
a multiplicative bite of availability and a multiplicative bite of your latency budget, and
both compound in n.

## Why this bites microservices specifically

The paper is about fan-outs of hundreds of leaf servers, which is not most people's
architecture. The reason it applies anyway is that **n is not just the width of one fan-out.
It is the number of independent latency draws in the whole request tree.**

A request that touches five services, each of which queries a database and calls a cache, is
drawing from fifteen distributions. A serial chain draws just as many times as a parallel
fan-out; the chain is worse, because its latencies *add* rather than being max'd. And every
retry is another draw.

The corollary is uncomfortable and worth stating plainly: **you cannot have a tight p99 on an
operation that touches many components, no matter how good each component is.** If the product
requires a tight tail, the architecture has to reduce the number of draws — a local read model,
a cached copy, a merged endpoint — rather than tuning the components.

## What the paper offers as remedies, and which ones transfer

**Hedged requests.** Quoted:

> *"A simple way to curb latency variability is to issue the same request to multiple replicas
> and use the results from whichever replica responds first. We term such requests 'hedged
> requests' because a client first sends one request to the replica believed to be the most
> appropriate, but then falls back on sending a secondary request after some brief delay. The
> client cancels remaining outstanding requests once the first result is received."*

with the cost stated honestly:

> *"Although naive implementations of this technique typically add unacceptable additional
> load, many variations exist that give most of the latency-reduction effects while increasing
> load only modestly."*

and the specific tuning that makes it affordable:

> *"That extra work can be capped by waiting for the 95th-percentile expected latency before
> issuing the hedged request."*

**Whether hedging transfers to your system depends entirely on idempotency.** Issuing the same
request twice and taking the first answer is safe for a read and potentially catastrophic for a
write. That makes hedging a technique that belongs to the idempotency discussion in
[07d · Idempotency on the wire](07d-idempotency-on-the-wire.md) as much as to the latency one.
It is also a form of retry, so everything in
[07b · Retries and amplification](07b-retries-and-amplification.md) applies: hedge with a
budget, not unconditionally.

**Returning "good enough" results.** The paper's other transferable idea: if the fan-out is
gathering contributions and one branch is slow, return what you have. That is exactly the
soft-dependency argument from [10](03e-hard-and-soft-dependencies.md), arriving from the
latency side rather than the availability side, and it is the single most reliable fix — it
converts `max(branches)` into "the budget", full stop.

## Reading it as a design constraint

Two rules fall out, and both are about *deciding before building*:

1. **Every branch you add spends tail budget, not average budget.** Adding a fast dependency to
   a fan-out does not cost you its mean latency; it costs you `q` more chances of being slow. A
   dependency with a great p50 and a bad p99 is worse for a fan-out than one with a mediocre
   p50 and a tight distribution — **variance matters more than the mean.**
2. **If the operation has a tail requirement, cap n at design time.** "One synchronous call per
   user request" — the Guardian's rule from
   [05](03-availability-multiplication.md) — is a tail-latency rule as much as an availability
   rule.

## Gotchas

**★ Optimising p50 on the dependency does nothing for a wide fan-out.** What matters is `q`,
the probability of exceeding the threshold, which is a property of the tail. A change that
halves the median and leaves the p99 alone leaves the composed latency essentially unchanged.
Ask for tail improvements specifically, and measure the dependency's p99 rather than its
average.

**★ n counts the whole request tree, not the widest fan-out.** Five services each doing a
database call and a cache call is fifteen draws. Retries add more. People compute `1-(1-q)ⁿ`
with n = 3 because their controller has three clients, and then wonder why the observed tail is
worse than the model.

**★ Hedging a non-idempotent operation duplicates it.** The technique is "send it twice and
take the first answer" — which for a `POST` that charges a card means two charges when both
arrive. Hedging is safe for reads and for writes with an idempotency key, and unsafe
everywhere else. It is also load amplification, which is the AWS caution about retries wearing
a different hat.

**★ A slow branch you are willing to drop still costs you if you wait for it.** If the design
says "loyalty tier is optional", but the code waits for the loyalty call before rendering, the
tail is unchanged. Optionality has to be implemented as *not waiting past the budget*, which
means a per-branch deadline and a partial result — not just a try/catch.

**★ Adding replicas of a dependency does not reduce `q` proportionally.** More instances behind
a load balancer help with queueing delay and with single-instance faults, and they do nothing
about tail causes that are shared: garbage collection patterns, a slow shard, a hot key, a
saturated database. The paper's list of causes is mostly shared-resource contention, which
replication does not remove.

**★ Both compounding effects are invisible in staging.** With one user and one instance, `q` is
effectively zero: no queueing, no GC pressure, no contention, no cold caches. The tail is a
production-only phenomenon, which is why it must be reasoned about arithmetically before
release rather than discovered afterwards.

## Interview questions

**★ Why does a fan-out to many services have a worse tail than any of the services
individually?**
Because the request completes only when the slowest branch does, so each branch is an
independent chance to draw from the tail. With per-branch probability `q` of exceeding a
threshold, the request exceeds it with probability `1 - (1-q)ⁿ`, which grows quickly in n. Dean
and Barroso's example is a server with a 99th-percentile latency of one second: at a fan-out of
100, 63% of user requests take more than a second, even though 99% of individual calls are
fast.

**★ You need a tighter p99 on an endpoint that fans out to eight services. Where do you start?**
Not with the services. Reduce the number of independent draws: merge calls, precompute a joined
read model so the query touches one store, cache what is cacheable, or make branches optional
so the endpoint returns at its budget with a partial result instead of waiting for the slowest.
Tuning the individual services helps only if you improve their *tails* specifically, and
improving eight tails is eight times the work of removing four draws.

**★ What is a hedged request, and when must you not use one?**
Sending the same request to a second replica after a short delay and taking whichever answer
returns first, cancelling the other — Dean and Barroso's technique for curbing tail latency,
with the delay typically set around the 95th-percentile expected latency so the extra load is
small. You must not use it for a non-idempotent operation: two in-flight copies of a card
charge means two charges if both are processed. It is safe for reads and for writes carrying an
idempotency key, and it is load amplification in every case, so it needs a budget like any other
retry.

**★ Two dependencies have the same mean latency; one has a much longer tail. Which is worse in a
fan-out and why?**
The one with the longer tail, decisively. The composed latency depends on `q`, the probability
of exceeding the threshold, which lives entirely in the tail — the mean is nearly irrelevant to
`max(branches)`. This is why a service-level agreement expressed as an average is close to
useless for a caller that fans out, and why the number to ask a dependency team for is a high
percentile.

**★ How is the tail-latency arithmetic related to the availability arithmetic?**
They are the same formula applied to different events. Availability is `pⁿ`, the probability
that no dependency has failed; tail exposure is `1 - (1-q)ⁿ`, the probability that at least one
dependency was slow — which is `1 - pⁿ` with `p = 1 - q`. Both compound in the number of hops,
which is why "how many services does this request touch" is the single most informative number
about an endpoint, and why every remedy in this topic is ultimately about reducing it.

{/* FOOTER */}
