---
title: "Design-time coupling makes releases painful and runtime coupling makes outages contagious — they are independent axes, and a team that fixes one while congratulating itself on the other is the normal case"
sidebar_label: "02 · Design-time vs runtime"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Chris Richardson, "Microservice architecture essentials:
> loose coupling"
> ([microservices.io](https://microservices.io/post/architecture/2023/03/28/microservice-architecture-essentials-loose-coupling.html))
> and "Dark matter force: minimize runtime coupling"
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-runtime-coupling.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · Spring Cloud train
> 2025.1.x. **No sandbox** — no measured figure appears on this page.

**"Loose coupling" is two different properties wearing one name, and they fail in
completely different ways. Design-time coupling is how often two services have to change
together; it shows up as a release you cannot ship without coordinating three teams.
Runtime coupling is how much one service's availability depends on another's; it shows up
as a pager. You can have perfect design-time decoupling — clean contracts, independent
repos, no shared library — and still have an architecture where one dead pod takes down the
checkout page. Keeping these apart is the prerequisite for every decision in this topic.**

## The two definitions, side by side

Richardson defines them in one article, and the phrasing is worth taking literally.

**Design-time coupling** is the likelihood

> *"that they need to change together for the same reason."*

**Runtime coupling** is

> *"the degree to which the availability of one service is affected by the availability of
> another service."*

One is about **change**. The other is about **uptime**. They share nothing mechanically.
A service can be:

| | Loose design-time | Tight design-time |
|---|---|---|
| **Loose runtime** | The goal. Independent releases, independent outages. | Painful to release, but an outage stays local. Common with event-driven systems that share a schema everyone edits. |
| **Tight runtime** | Ships independently, dies together. **The most common real-world shape**, and the most misdiagnosed. | The distributed monolith. See **12 · The distributed monolith** *(not written yet)*. |

The bottom-left cell is where most teams that "did microservices properly" actually sit.
They have separate repositories, separate pipelines, versioned APIs and a tolerant reader,
so they release independently and feel decoupled — and their p50 request still traverses
five services synchronously, so any one of them going down takes the product with it. The
design-time work is visible and gets praised. The runtime work is invisible until 3am.

## Why the two get conflated

Because both are cured by the word "API". Putting a well-versioned HTTP contract between
two services genuinely fixes design-time coupling: the implementation behind it can change
without the caller recompiling, which is Richardson's iceberg point — the visible API is
small, the hidden implementation is large, and you can change the hidden part freely.

But the same act *creates* runtime coupling, because now the caller has to reach across a
network to a live process to get anything at all. **The very move that decouples change
couples availability.** That is not a paradox; it is the actual trade, and it is why "we
introduced a proper API between them" is an answer to one question and an aggravation of
the other.

## Design-time coupling in one paragraph, because it is not this topic

You reduce it by making the contract small and stable relative to the implementation:
additive-only evolution, tolerant readers, no shared domain classes on the wire, no shared
database, and no shared library that encodes business rules. **Topic 05 owns this in full**
— see **05 · Inter-service REST** *(not written yet)* for tolerant reader,
DTO versioning and the deploy-order deadlock. The one thing worth carrying into this topic
is the *tell*: if a change to service A requires a coordinated release of service B, you
have design-time coupling, no matter how asynchronous the runtime path is. Events do not
fix that. An event schema is a contract like any other, and a consumer that breaks when you
add a field is design-time coupled to the producer just as tightly as an RPC client would
be.

## Runtime coupling is the one that has a number

The reason this topic dwells on runtime coupling is that it can be quantified and design-time
coupling largely cannot. You can write down, for one endpoint, the list of services that
must be available for it to succeed, and multiply their availabilities. The result is a
number you can compare to your SLO. There is no equivalent arithmetic for "how often will
these two need to change together" — that is a judgement about the domain.

So: **argue design-time coupling from the domain, argue runtime coupling from arithmetic.**
Design reviews that mix the two produce the worst outcomes, because the domain argument is
subjective and the arithmetic argument is not, and pooling them lets the subjective one
absorb the objective one.

The arithmetic itself is [03 · Availability
multiplication](03-availability-multiplication.md).

## A worked reading of one endpoint

Take the `POST /orders` controller from [01](01-coupling-is-the-decision.md) and read it
along both axes.

**Design-time.** Order Service depends on three DTO shapes: `Customer`, `StockLevel`,
`Money`. If Pricing renames a field in its response, does Order break? With a tolerant
reader and Jackson 3's default of ignoring unknown properties on the way in, adding a field
is safe and renaming one is not. So the design-time coupling is real but manageable, and it
is topic 05's problem.

**Runtime.** All three calls are on the request path, before the save. All three must
answer. `POST /orders` cannot succeed if any of them is unavailable. That is three hard
runtime dependencies on the write path of the most business-critical endpoint in the
system, and it is a fact about the *shape* of the code, not about the DTOs.

Now notice that the two readings suggest opposite remedies. The design-time reading says
"be careful with the DTOs". The runtime reading says "two of these three calls should not
be here at all". Only the second one changes the outage profile.

## Reducing runtime coupling: the three moves, in order of how much they buy

1. **Delete the hop.** If the data is reference data the caller could hold a copy of, the
   best synchronous call is the one that does not happen. This is [06c · The read that could
   have been a copy](06c-the-read-that-could-have-been-a-copy.md), and it is strictly the
   biggest win because it removes the dependency rather than softening it.
2. **Move the hop off the request path.** If the callee only needs to *know* something, not
   to *answer* something, publish and return. The caller's availability stops depending on
   the callee entirely. This is the self-contained service idea in
   [06f](06f-self-contained-services.md).
3. **Degrade instead of failing.** If the hop must stay, decide what you serve when it
   fails. A hard dependency you can serve a partial answer past is a soft dependency, and
   soft dependencies do not enter the availability product. See
   [03e](03e-hard-and-soft-dependencies.md) and **09d · Degrading instead of
   failing** *(not written yet)*.

Circuit breakers, bulkheads and retries are *not* on this list. They change how a failure
manifests — fast rejection instead of a slow pile-up — which matters enormously for blast
radius, but they do not make the endpoint succeed when the dependency is down. They are
covered as an inherited consequence in **07g** *(not written yet)* and
taught in phase 16.

## Gotchas

**★ "We're event-driven, so we're loosely coupled" conflates the two axes.**
Event-driven systems are usually loosely runtime-coupled and can be *catastrophically*
design-time coupled, because event schemas tend to be shared, ownership is unclear, and a
new required field breaks every consumer at once with no compiler to tell you. If the event
payload is your internal domain object serialised, you have published your implementation
and every consumer now changes with you.

**★ A shared client library re-couples you at design time even when the wire protocol is
clean.** If Customer Service publishes a `customer-client` jar with the DTOs in it, then
every consumer upgrades in lockstep with the producer's release, and you have reintroduced
exactly the coordination you built the API to avoid. Whether that is acceptable is a team
decision; what is not acceptable is believing you avoided it.

**★ Independent deployability is a design-time property and gets used as evidence of runtime
decoupling.** "We deploy Order without touching Payment" is true and irrelevant to whether
Order returns 500 when Payment is down. When someone offers deploy independence as proof of
loose coupling, ask them which services must be up for the checkout endpoint to return 200.

**★ Fixing design-time coupling can increase runtime coupling.** Extracting a shared
in-process module into its own service removes the shared-library problem and adds a network
hop with all its availability cost. That is often the right trade — but it is a trade, and
the arithmetic in [03](03-availability-multiplication.md) is what tells you whether it paid.
**01 · Monolith first** *(not written yet)* owns the argument for not making that
trade at all until you must.

**★ The runtime coupling of an endpoint changes silently when someone adds a field.**
Adding "and show the loyalty tier on the confirmation page" adds a fourth client call to a
controller that had three. Nobody thinks of a display field as an availability change. This
is the single most common way an endpoint's dependency count grows, and it is why the
inventory in **10b** *(not written yet)* is worth maintaining rather than
computing once.

## Interview questions

**★ Distinguish design-time coupling from runtime coupling, and give a system that has one
and not the other.**
Design-time coupling is the likelihood that two services must change together for the same
reason; runtime coupling is the degree to which one service's availability depends on
another's. A system with clean versioned REST contracts, independent repos and independent
pipelines, where every page load fans out synchronously to five services, has loose
design-time coupling and tight runtime coupling. The mirror case — a system where all
communication is via durable events, so nothing fails together, but every consumer parses a
shared canonical schema that changes monthly — has loose runtime coupling and tight
design-time coupling.

**★ Which of the two is more dangerous, and why is that the wrong question?**
It is the wrong question because they hurt different people at different times. Design-time
coupling taxes every release, continuously and visibly, and is felt by developers.
Runtime coupling costs nothing until a dependency fails, then costs everything at once, and
is felt by users and on-call. Teams reliably over-invest in the first because its pain is
constant and legible, and under-invest in the second because its pain is rare and someone
else's fault. The useful move is not ranking them but pricing runtime coupling explicitly
so it competes for attention on equal terms.

**★ You introduce a well-versioned HTTP API between two modules that used to be in the same
process. What happened to each kind of coupling?**
Design-time coupling went down: the implementation is now hidden behind a contract you can
evolve additively, so the two can change independently. Runtime coupling went up from zero
to significant: an in-process call could not fail because of a network partition, a rolling
deploy or a full connection pool, and a remote one can. The extraction is worth it when the
design-time and organisational benefits exceed the new availability cost — which is a
calculation, and the reason [03](03-availability-multiplication.md) exists.

**★ Your architect says a circuit breaker will fix the runtime coupling. Is that right?**
No — it changes the failure mode, not the dependency. With a breaker, requests fail fast
instead of piling up on a dead dependency, which protects the caller's threads and stops the
failure spreading further up the stack. That is genuinely valuable. But the endpoint still
does not produce a correct response while the dependency is down; it just produces the wrong
one more cheaply. Runtime coupling is only reduced when the caller can complete the
operation without the callee — by holding a copy, by deferring the work, or by serving a
defined degraded answer.

**★ How would you measure runtime coupling for an existing service without instrumenting
anything?**
Read the code for each externally reachable operation and list the remote calls that must
succeed before a 2xx can be returned, distinguishing those with a real fallback from those
without. That list — per operation, not per service — is the runtime coupling, and its
length is the exponent in the availability arithmetic. It costs an afternoon and it is the
input to every other decision in this topic. **10b · The interaction
inventory** *(not written yet)* is the format.

{/* FOOTER */}
