---
title: "A gateway that routes is infrastructure and a gateway that decides is a service in the wrong place, so the useful question is not how to aggregate but who should own the composition — the client, a BFF, or a real service with a domain team and tests — and the four symptoms that say the line has already been crossed are business tests, a blocking pull request, its own database, and a write to two services with nowhere to compensate from"
sidebar_label: "17d · Routing versus orchestration"
sidebar_position: 17.5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. The routing-versus-orchestration line, the distributed-monolith failure
> mode and the three homes for a composition are **method with no single primary source** and are
> written as such — no vendor, no product, no benchmark. The retry constraint that makes a
> multi-service write unsafe is [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.2.2,
> quoted in [17b](17b-aggregation-and-partial-failure.md). Concludes
> [17](17-gateway-patterns.md), [17b](17b-aggregation-and-partial-failure.md) and
> [17c](17c-the-fan-out-n-plus-1.md); the graph at the edge is
> [17e](17e-graphql-at-the-edge.md). **No sandbox run.**

**Every gateway pattern eventually meets the same question, and it is not a technical one: who
should own this composition?** A fan-out is easy to build in whichever box already has the
network connections, and the box that already has them is the gateway — which is why gateways
acquire logic one small, entirely reasonable request at a time until nothing ships without a
coordinated change to them. The distinction that holds is between *transforming* and *deciding*.
A gateway may reshape a payload, call four services and fail over; the moment it contains a rule
the business would want to change, it has become a service without a domain team, without a test
suite that exercises it against real data, and — if it writes — without any durable place to run
a compensation from. This page is the three legitimate homes for a composition, the four symptoms
that say a gateway has crossed the line, and what the storefront puts in each.

## Where the composition should live

Three legitimate homes, and the choice is about who owns the logic — never about which box
happens to have a free CPU and the right network access.

| Home | Right when | Cost |
|---|---|---|
| **the client itself** | few calls, a fast network, and the composition is pure presentation | a mobile client pays a crossing per call ([the ladder](../phase-0-the-interview/05-the-latency-ladder.md)); the logic is duplicated per platform and ships inside app releases you cannot recall |
| **a BFF / aggregating gateway** ([17](17-gateway-patterns.md)) | the composition is screen-shaped: "these four things, laid out like this", changing whenever the screen changes | a service per client type to run, deploy, monitor and be paged for |
| **a real composition service** | the composition contains **rules** — pricing eligibility, availability policy, what "in stock" means for a pre-order — that must be identical for every client and independently testable | one more domain service, owned and on-call by the domain team, which is the correct cost rather than an avoidable one |

The line is one sentence: **if the composition contains a rule the business would want to change,
it is a service, not a gateway.** Two consequences that are worth saying in the round. A rule that
lives in three BFFs is three rules, and they will disagree — usually first noticed as "the app
says out of stock and the website lets you buy it". And a composition service is still a *domain*
service: it owns one bounded set of rules, so a second, unrelated composition does not belong in
the same box merely because that box is called "the composition layer".

## Routing versus orchestration

A gateway that routes is infrastructure; a gateway that decides is a service in the wrong place,
and the end state has a name — a **distributed monolith**: the parts are deployed separately but
cannot be *changed* separately, because every meaningful change touches the shared middle. The
symptoms are diagnosable, in order of severity:

- it has **business tests** — not "does this route reach the order service" but "does a gold-tier
  user get free shipping";
- **a feature cannot ship without a gateway pull request**, so the gateway sits on every team's
  critical path and its review queue becomes everybody's lead time;
- it has **its own database**, which is domain state under a box that
  [03](03-reverse-proxies-and-api-gateways.md) needs to be stateless in order to replicate, drain
  and restart ([04](04-stateless-services-and-where-the-state-went.md));
- it performs **writes to more than one service** in one request, so when the second write fails
  it needs a compensating action — a saga in a box with no durable state to run one from
  (**Sagas and compensating transactions** *(not written yet)*; the durable version is the outbox
  of [phase 1](../phase-1-the-method/08-read-path-and-write-path.md)). RFC 9110 §9.2.2 closes the
  other escape route: the client cannot simply retry, because the composite call is not
  idempotent and there is no single owner holding an idempotency key.

The rule, said out loud: *"the gateway may transform, fan out and fail over; it may not decide,
and it may not own."* The high-level diagram of
[phase 1](../phase-1-the-method/07-the-high-level-diagram.md) is where this shows up first — if
the box in the middle has arrows into four services and a label containing a business noun, it is
a service that has been drawn as infrastructure, and the drawing is the last cheap moment to fix
it.

## The storefront

```text
what the gateway and the BFFs do
  transform:  shape the product payload per client type (17)
  fan out:    four read legs for the product screen, labelled required/degradable (17b)
  fail over:  retry an idempotent leg, serve a degraded section, return 503 + Retry-After
  they decide NOTHING

what the composition service owns instead
  "is this SKU purchasable by this customer right now?"
     = price eligibility + stock policy + regional restrictions + pre-order rules
  it is a RULE: it must be identical on web, app and partner, and it needs its own tests
  → a service the catalogue team owns; every BFF calls it, and none of them reimplements it

the checkout, deliberately NOT composed at the edge
  one client call → order service → its own transaction + outbox + provider call (15)
  a gateway writing to BOTH orders and inventory would need a compensation it cannot run,
  and the client's retry is only safe because ONE owner holds the Idempotency-Key

the tell that the line is being crossed
  "can we add 'if the customer is gold tier, skip the inventory check' to the gateway?"
  small, reasonable, and the first of the four symptoms above
```

The last block is the section in one sentence: the request is always small, always reasonable,
and always the beginning of a gateway that cannot be deployed independently of anything.

## Gotchas

**★ Symptom: the gateway grew a database and a suite of business tests.** Cause: routing drifted
into orchestration one convenient rule at a time, each one too small to argue about. Fix: move the
deciding logic into a composition service the domain team owns and can test; the gateway keeps
transform, fan-out and failover, and gives up deciding — and the database goes with the logic,
because a stateful gateway cannot be drained or replicated the way
[03](03-reverse-proxies-and-api-gateways.md) needs it to be.

**★ Symptom: a BFF wrote to two services and left the second one un-written after a failure.**
Cause: a multi-service write in a box with no durable state and no compensation. Fix: one service
owns the write and its compensation, using an outbox
([phase 1](../phase-1-the-method/08-read-path-and-write-path.md)); the aggregate calls that one
service and forwards its result, and the idempotency key held by that one owner is what makes the
client's retry safe under RFC 9110 §9.2.2.

**★ Symptom: "we'll just aggregate it at the gateway" for a composition that has business rules in
it.** Cause: the fan-out shape mistaken for the whole problem — the calls look identical whether
or not there is a rule between them. Fix: ask whether the business would ever want to change the
logic; if yes, it is a composition service with an owner and tests, and the gateway simply calls
it.

**★ Symptom: the app says out of stock and the website lets you buy it.** Cause: the same rule
implemented independently in two BFFs, drifting apart at two release cadences. Fix: the rule has
exactly one implementation, in the service that owns it; the BFFs call it and shape its answer.
A rule that lives in three places is three rules.

**Symptom: no feature ships without a gateway pull request.** Cause: the gateway on every team's
critical path, which is the definition of a distributed monolith even though everything is
deployed separately. Fix: move the per-feature logic out until gateway changes are routing changes
only; measure it — if the gateway repository changes on most feature branches, that is the number
to act on.

**Symptom: the composition service became the new monolith.** Cause: every composition dumped into
one box because it was "the composition layer". Fix: a composition service is a *domain* service
— it owns one bounded set of rules, and an unrelated composition belongs to whichever domain owns
*its* rules, with its own team and its own deploy.

**Symptom: the gateway evaluates feature flags with business meaning.** Cause: flag evaluation
looks like configuration but "gold tier gets free shipping" is a rule wherever it is evaluated.
Fix: the gateway may route on a flag — send 5% of traffic to a canary — but a flag whose branches
change what the business promises the customer belongs in the service that owns the promise.

**Symptom: the gateway holds an in-flight compensation in memory and a deploy lost it.** Cause: a
saga attempted in a stateless box mid-rolling-restart. Fix: durable state or no saga — an outbox
in the owning service, replayed after restart; a gateway is drained and replaced routinely by
design, so anything it must not forget cannot live in it.

## Interview questions

**★ How do you tell that a gateway has become a service?**
Four symptoms, in order of severity. It has business tests — not "does this route reach orders"
but "does a gold-tier user get free shipping". A feature cannot ship without a gateway change, so
its review queue is every team's lead time. It has its own database, which is domain state in a
box that has to stay stateless to be replicated and drained. And it writes to more than one
service in a request, so a partial failure needs a compensating action it has no durable place to
run from — and the client cannot simply retry, because the composite call is not idempotent and no
single owner holds an idempotency key. The rule is that a gateway may transform, fan out and fail
over, but may not decide and may not own; when the composition contains a rule the business would
want to change, it belongs in a composition service with a team and a test suite, and the gateway
calls it.

**★ Where should the composition live if not the gateway?**
Three homes with three different owners. In the client, when the composition is pure presentation,
the network is fast and there are few calls — the cost is a round trip per call on mobile and
logic duplicated per platform inside app releases you cannot recall. In a BFF, when the
composition is screen-shaped: "these four things, laid out like this", changing whenever the screen
changes. In a real composition service, when the composition contains rules — pricing eligibility,
what "in stock" means for a pre-order — that must be identical across web, app and partner and
testable on their own. The third costs a service, but it puts the rule beside the domain team that
owns it instead of hiding it in infrastructure, where nobody goes looking for business logic and
where two independent copies quietly disagree.

**★ A team wants to add "skip the inventory check for gold-tier customers" to the gateway. What do
you say?**
That it is a business rule, and the gateway is the one place it must not go — because a rule there
has no domain owner, no test suite exercising it against real data, and no way to change without
deploying the box every team depends on. It belongs with whoever owns purchasability: either the
inventory service exposes it, or a composition service that owns "is this SKU purchasable by this
customer" does, and every BFF calls that one implementation. The tell worth naming out loud is
that the request is always small and always reasonable, and accepting a few in a row is exactly
how a routing layer becomes a distributed monolith.

**What is a distributed monolith, and how would you notice you were building one?**
A system whose parts are deployed separately but cannot be *changed* separately, because every
meaningful change touches a shared middle — usually the gateway, sometimes a shared database or a
shared library everyone must upgrade together. You notice it from lead time rather than
architecture: features routinely require coordinated pull requests across repositories, the deploy
order matters and is written down somewhere, one team's release blocks another's, and the shared
box's change history reads like the product roadmap. Concretely, look at how often the gateway
repository appears in feature branches; if it is most of them, the boxes on the diagram are
independent and the system is not.

**Why can a gateway not run a saga?**
Because a saga needs durable state and a gateway is designed to have none. A compensating workflow
has to survive the process that started it: the gateway is replicated, drained and restarted as a
matter of routine ([03](03-reverse-proxies-and-api-gateways.md),
[04](04-stateless-services-and-where-the-state-went.md)), so an in-flight compensation held in its
memory is lost on any ordinary deploy and the system is left half-written with nobody responsible.
The durable version belongs in the service that owns the write, with an outbox committed in the
same transaction as the state change and replayed after a restart; the gateway calls that service
once, and the client's retry is made safe by an idempotency key that the owning service holds.

← Prev: [17c · The fan-out N+1](17c-the-fan-out-n-plus-1.md) · Index: [Phase 2 — The request path](README.md) · Next → [17e · GraphQL at the edge](17e-graphql-at-the-edge.md)
