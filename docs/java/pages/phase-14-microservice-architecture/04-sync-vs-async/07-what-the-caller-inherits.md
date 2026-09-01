---
title: "Adding one synchronous call adds six obligations to the caller and none to the callee, which is why hops accumulate — the person who adds them never pays, and the bill arrives in someone else's on-call rotation"
sidebar_label: "31 · What the caller inherits"
sidebar_position: 31
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io "Pattern: Remote Procedure Invocation (RPI)"
> ([microservices.io](https://microservices.io/patterns/communication-style/rpi.html)), Marc
> Brooker, "Timeouts, retries, and backoff with jitter", Amazon Builders' Library
> ([aws.amazon.com](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)),
> and the Google SRE book, "Addressing Cascading Failures"
> ([sre.google](https://sre.google/sre-book/addressing-cascading-failures/)).
> 🔴 **No sandbox.** Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**The availability arithmetic is the visible cost of a synchronous hop. This chunk is the
invisible one: the set of things the caller must now build, decide and operate, none of which the
framework does for you and none of which the callee's team is responsible for. There are six of
them, they are all decisions rather than code, and a hop where any of them is undecided is not
finished. The reason this list matters is that it is the actual reason "just add a call" is
expensive, and it is not on anyone's estimate.**

## The six

| # | Obligation | The question it answers | Chunk |
|---|---|---|---|
| 1 | **Timeout** | how long am I willing to wait, given my budget? | [13](04c-timeouts-in-spring.md), [15](04d-the-timeout-that-is-not-a-timeout.md) |
| 2 | **Retry policy** | is a second attempt worth the load it causes? | [32](07b-retries-and-amplification.md), [33](07c-backoff-jitter-and-budgets.md) |
| 3 | **Idempotency** | is a second attempt *safe*? | [34](07d-idempotency-on-the-wire.md) |
| 4 | **Failure semantics** | what does the operation do when this fails? | [10](03e-hard-and-soft-dependencies.md) |
| 5 | **Unknown-outcome handling** | what does a timeout *mean* about what happened? | [36](07f-the-unknown-outcome.md) |
| 6 | **Concurrency bound** | how much of me can this dependency consume? | [16](04e-bimodal-latency-and-exhaustion.md), [37](07g-circuit-breaking-as-a-consequence.md) |

Six decisions. **A hop with fewer than six answers is a hop with defaults chosen by whoever wrote
the HTTP library**, and none of those defaults were chosen with your budget or your SLO in mind.

## Why they all land on the caller

Because the caller is where the consequences are. The callee experiences your timeout as a closed
connection and your retry as extra load; it experiences your unknown-outcome problem not at all.
Concretely:

- The callee's SLO is about the callee. Your multiplication is not in it.
- The callee's capacity plan assumes callers behave; your retry storm is a surprise to them and a
  self-inflicted wound to you.
- The callee returning a 500 is one event in their error budget and a failed user operation in
  yours.

The asymmetry is structural, not cultural. **The team that adds a dependency inherits its
operational consequences and has no authority over its behaviour.** That is worth stating in a
design review, because it explains why "we'll ask them to be more reliable" is not a plan and why
an explicit availability agreement — [06](03b-what-it-does-to-an-slo.md) — is.

## Obligation 5 is the one nobody expects

Obligations 1 to 4 and 6 are at least well known. Obligation 5 — deciding what a timeout *means* —
is the one that produces real defects, because a timeout is not a failure. It is an **unknown
outcome**: the request may have been fully processed, partially processed, or never received, and
the caller cannot tell which. For a read that is uninteresting. For a write it is the whole
problem, and it is [36 · The unknown outcome](07f-the-unknown-outcome.md).

## What a fully-specified hop looks like

Not code — a record. This belongs beside the client, in the design document, and ideally in the
inventory of [48](10b-the-interaction-inventory.md):

```text
Dependency:        Pricing Service · GET /quote
Classification:    soft
Timeout:           250 ms read, 500 ms connect        (budget: 400 ms total; this hop's share)
Retries:           1, on 5xx and connect failure only; skip if < 120 ms budget remains
Idempotency:       safe — GET, no side effects
On failure:        use list price from local catalogue copy; increment pricing.fallback.used
Unknown outcome:   n/a for a read
Concurrency bound: 20 in flight; reject beyond
Owner agreement:   Pricing team, 99.95% monthly, reviewed 2026-06
```

Eight lines. Writing them takes fifteen minutes and it is the difference between a hop that has
been engineered and one that has been typed.

## The obligations do not disappear when you go asynchronous — they change

A useful check on whether an asynchronous redesign has actually helped:

| Obligation | Synchronous | Asynchronous (durable handoff) |
|---|---|---|
| Timeout | on the call | on the *handoff* only — a short, local one |
| Retry | yours to implement | the broker's or the drainer's |
| Idempotency | yours, because you retry | **still yours** — at-least-once delivery guarantees duplicates |
| Failure semantics | what the user sees | what the *consumer* does; the user already left |
| Unknown outcome | the hard one | mostly gone — the handoff either committed or did not |
| Concurrency bound | protects your threads | protects the consumer; becomes a lag problem |

**Two rows are the honest summary.** The unknown-outcome problem largely disappears, which is a
large and under-appreciated benefit: a local transaction either committed or it did not, and you
know which. And idempotency does *not* disappear — it moves to the consumer, where at-least-once
delivery makes duplicates a certainty rather than a possibility.
[35 · Idempotent consumers](07e-idempotent-consumers.md).

## The rule that follows

**Every hop should have an owner in your team who can answer all six questions.** Not "the team
that owns Pricing" — someone on *your* team, because these are your decisions about your service's
behaviour.

When nobody can answer them, that is the finding. It usually means the hop was added under time
pressure with framework defaults, which means: no explicit timeout (so whatever the classpath
selected — [13](04c-timeouts-in-spring.md)), no retry policy, no idempotency analysis, an
exception propagating to a 500, no thought about timeouts on writes, and no concurrency bound. Six
defaults, none chosen.

## Gotchas

**★ The framework's defaults are not answers to your six questions.** Boot documents no default
connect or read timeout, exception-on-4xx-and-5xx is a transport decision rather than a domain
one, and there is no default retry, idempotency or concurrency policy at all. "We didn't change
anything" means "six decisions were made by the classpath".

**★ The person adding the hop pays none of the cost.** They ship a feature; on-call inherits an
availability term. Estimation and review are the only places this can be corrected, which is why
the availability arithmetic belongs in the design template as a required field.

**★ Obligations compound with hop count, not with service count.** Five hops means thirty
decisions. That is the real reason the Guardian's one-synchronous-call-per-request rule is
tractable and a five-hop endpoint is not — not the arithmetic alone, but the amount of ongoing
judgement each hop demands.

**★ An asynchronous redesign that skips the idempotency question has moved the bug, not fixed
it.** At-least-once delivery means the consumer *will* see duplicates. A synchronous caller might
retry; an asynchronous consumer is guaranteed redelivery eventually. The obligation got stronger,
not weaker.

**★ Nobody re-reviews the six answers when circumstances change.** A timeout budgeted against a
400 ms operation is wrong once the endpoint's budget becomes 200 ms; a retry policy sized for a
low-traffic endpoint is dangerous once it is on the home page. The record needs a review date, and
that is why the sample above has one.

**★ "The library handles retries" is a common and dangerous belief.** Some clients and SDKs do
retry by default, which means you may have a retry policy you did not choose, stacked on top of
one you did — the multi-layer amplification in [32](07b-retries-and-amplification.md). Find out
what your client does before adding anything.

## Interview questions

**★ What does a caller inherit when it adds a synchronous dependency?**
Six obligations: a timeout derived from the operation's budget; a retry policy or an explicit
decision not to retry; an idempotency analysis, because a retry is only safe if repetition is;
defined failure semantics, meaning what the operation does when the dependency is unavailable; a
policy for unknown outcomes, because a timeout does not tell you whether the work happened; and a
concurrency bound, so a slow dependency cannot consume the caller's capacity. All six land on the
caller and none on the callee.

**★ Why does the asymmetry between caller and callee matter?**
Because the party that adds the dependency bears the consequences and has no control over the
behaviour. The callee's SLO covers the callee, its capacity plan assumes well-behaved callers, and
a 500 it returns is one event in its error budget and a failed user operation in yours. That is
why "we'll ask them to be more reliable" is not a plan: the only effective moves are on the
caller's side — remove the hop, soften it, bound it — or an explicit availability agreement with a
number derived from the operation's target.

**★ Which of the six obligations is most often missed, and why does it matter?**
Deciding what a timeout means. A timeout is not a failure; it is an unknown outcome — the request
may have been fully processed, partially processed, or never received, and the caller cannot
distinguish them. For a read that is harmless. For a write it determines whether retrying
double-charges a customer, and the code that gets written by default — catch, log, return an error
— is silently choosing "assume it did not happen", which is frequently false.

**★ Which obligations survive a move to asynchronous messaging?**
Idempotency, and more strongly than before: at-least-once delivery makes duplicate processing a
certainty rather than a possibility, so the consumer must deduplicate. Failure semantics survive
in changed form — the question becomes what the consumer does and how anyone finds out, since the
user has already been answered. The unknown-outcome problem largely disappears, because a local
transaction either committed or it did not. Timeouts and retries shrink to the durable handoff,
which is local and fast.

**★ You inherit a service with five synchronous dependencies and no documentation. What do you
produce first?**
A table with one row per hop and six columns: timeout, retry policy, idempotency, failure
behaviour, unknown-outcome policy, concurrency bound. Most cells will be empty, and the empty
cells are the work — each one is a decision currently being made by a library default that nobody
chose. Filling it in takes an afternoon and it is the input to every subsequent decision, including
which hops to remove first.

{/* FOOTER */}
