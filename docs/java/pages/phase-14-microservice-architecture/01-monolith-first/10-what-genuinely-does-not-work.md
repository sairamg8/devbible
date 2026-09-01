---
title: "The honest list: seven things a monolith cannot do, stated without hedging — because an argument for the monolith that pretends it has no limits is an argument nobody competent will accept"
sidebar_label: "10 · What genuinely does not work"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Chris Richardson, *Pattern: Monolithic Architecture*
> ([microservices.io](https://microservices.io/patterns/monolithic.html)); Martin Fowler,
> *Microservice Premium*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)); Stefan
> Tilkov, *Don't start with a monolith*
> ([martinfowler.com](https://martinfowler.com/articles/dont-start-monolith.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox.**

**Everything up to here has argued that the split's costs are systematically under-priced.
That argument only survives if the benefits are stated at full strength. Here is the list of
things a single deployable genuinely cannot do — no qualifications, no "you could probably
work around it". If a system needs one of these, the split is not a preference; it is the
requirement, and the rest of this topic is about doing it deliberately rather than
enthusiastically.**

## The seven

### 1. Independent release cadence between teams

**Not achievable in one deployable, at all.** If ordering and reporting ship from one
artefact, they ship together. You can decouple *release* from *deploy* with feature flags,
and you can make the pipeline fast — but the artefact version is shared, so a bad change
anywhere blocks everyone's release until it is reverted or fixed. This is Richardson's
*"Team autonomy"* force and it is the only one of the five with no in-process substitute.

It is also the one that matters, which is why [04 · Conway's law](02-conways-law-is-the-real-driver.md)
and [06 · Teams and the two-team shop](02c-team-topologies-and-the-two-team-shop.md) sit
where they do.

### 2. A genuinely different technology stack

If a subdomain must be Python because the model libraries are Python, or Go because the
binary must start in milliseconds, no packaging trick puts it in your JVM. There are
partial in-process answers — polyglot runtimes, native calls, embedding a script engine —
and every one of them costs more than a separate process and gives you a worse version of
it. This is Richardson's *"Support multiple technology stacks"*, and when it applies it
applies decisively.

### 3. Hard security or regulatory isolation

Cardholder data in a separately deployed service means: its own network segment, its own
credentials, its own audit boundary, and a much smaller set of people who can deploy to it.
Inside one process every module shares a heap, a classpath, a set of credentials and a
deployment permission set. You can partition responsibilities logically; you cannot make
one module unable to read another module's in-memory secrets. When an auditor asks "who can
reach cardholder data", "everyone with commit access" is the honest answer for a monolith,
and it is sometimes not an acceptable one.

### 4. Data residency and jurisdictional separation

If EU customer data must be stored and processed in the EU while the rest of the system runs
elsewhere, the boundary must be a **deployment** boundary. One deployable, one database, one
region. This is not a scaling argument and it is not negotiable by architecture; it is a
legal constraint that dictates topology.

### 5. Independent failure and blast-radius isolation

One `OutOfMemoryError` ends the process, and with it every module in it. One runaway query
saturates the shared connection pool. One thread-pool exhaustion in a slow integration stalls
unrelated request handling. There are in-process mitigations — separate pools, separate
executors, bounded queues — and they are meaningfully weaker than a process boundary,
because the JVM's own resources are not partitionable. [23 · Blast radius](10c-blast-radius.md)
goes through what you can and cannot do.

### 6. Independent resource shape and scaling by characteristic

A nightly report that allocates gigabytes and a checkout API with a tight latency budget
want different heaps, different collectors and different pod limits. In one process they
share all three. The partial answer — several deployables from one codebase, selected by
profile — is real, underused and covered in [22 · Independent scaling](10b-independent-scaling.md);
what it cannot give you is independent *release*.

### 7. A build and pipeline that stays fast as the codebase and team grow

Richardson names it:

> *"Fast deployment pipeline - the deployment pipeline is potentially slow since there's a
> single large application that needs to be built and tested"*

The mitigations are real and should be exhausted first ([25 · The build and the
pipeline](10e-the-build-and-the-pipeline.md)), but they have a limit. Past some size the
whole-artefact build and test cycle is a constraint you cannot engineer away without
splitting the artefact.

## Richardson's own qualifier is the decision rule

> *"These drawbacks become more severe as the application grows in size and complexity and
> the number of teams developing it increases."*

Three variables: **size**, **complexity**, **team count**. Every item above gets worse along
at least one of them, and items 1, 5, 6 and 7 get worse along team count specifically — which
is the same conclusion Conway's law reaches from the other direction.

## How to use the list

For each of the seven, answer for **your** system: does it apply, to which subdomain, and
what specifically is the requirement?

- Items 2, 3 and 4 are **binary and decisive**. If they apply, split that subdomain, and
  split only it. They also usually justify exactly one boundary, not twelve.
- Items 5 and 6 are **matters of degree**, with partial in-process answers you should try
  first.
- Item 7 is a **measurement**. Get the number before arguing.
- Item 1 is the **real one**, and it is a question about the org chart, not about the code.

A proposal that cites none of the seven is not making an architectural argument. A proposal
that cites one of them, for one subdomain, is usually correct — and usually proposes far
fewer services than the original plan.

## Gotchas

**★ Items 2, 3 and 4 justify a boundary around one subdomain, not a rearchitecture.** A
Python model server, a cardholder-data service, an EU-resident data store — each is one
service. The common error is to use one genuine requirement as the justification for
splitting everything, when the honest conclusion is "extract that one thing and leave the
rest alone".

**★ Feature flags decouple release from deploy and do not give you item 1.** They let you
ship code dark and turn it on later, which is genuinely useful. They do not let a team ship
while another team's broken change is in the shared artefact, and they accumulate: every
flag doubles the number of theoretically live code paths, and the removal ticket is never
prioritised.

**★ In-process isolation is weaker than process isolation and the gap is not closable.**
Separate thread pools, bounded queues and per-module executors all help, and none of them
survives an `OutOfMemoryError`, a JVM-wide GC pause or a saturated shared connection pool.
Be precise about which failures your mitigations actually cover.

**★ "We can scale it separately" is a claim about *release*, not about *resources*, and
people conflate them.** Running the same artefact with different profiles and different
memory limits gives you resource segregation today, for the price of a deployment manifest.
It does not give you independent deployability. If the requirement is genuinely the former,
you do not need a split.

**★ Item 7 is the only one you can measure before deciding, and almost nobody does.** Get
the build duration, the test duration, the queue depth and the split between compile time
and waiting-for-other-teams. If the constraint is queueing, the split helps a lot; if it is
compile-and-test, caching and incremental builds are dramatically cheaper. Measure before
arguing.

**★ The list is a reason to split *that subdomain*, and never a reason to stop enforcing
module boundaries in what remains.** A team that extracts the payments service and lets the
rest of the monolith go back to being unstructured has taken on a distributed system and
kept the ball of mud. The modular discipline applies to the remainder more, not less.

**★ Security isolation is a claim you will have to defend to someone outside
engineering.** "Only four people can deploy to the cardholder service, and it runs in its own
network segment with its own credentials" is an answer an auditor accepts. "Everyone with
commit access to the monolith can read those secrets, but our code review is careful" is
not, and no amount of architectural elegance changes that.

**★ The absence of any item from the list is itself a finding, and should be written down.**
If none of the seven applies, the proposal's real justification is one of the myths in
[26 · What is not on the list](10f-what-is-not-on-the-list.md), or it is
[03 · who pays](01c-who-pays-for-them.md) asymmetry doing its work. Say so in the review
notes.

## Interview questions

**★ What can a monolith genuinely not do?**
Seven things. Give two teams independent release cadence, since one artefact ships as one
unit. Run a subdomain on a genuinely different technology stack. Provide hard security or
regulatory isolation, because one process shares a heap, a classpath, a credential set and a
deployment permission set. Satisfy data-residency constraints that require a subdomain to
live in a different jurisdiction. Isolate failure — an `OutOfMemoryError` or a saturated
connection pool takes everything down with it. Give subdomains genuinely different resource
shapes and independent scaling. And keep the build and pipeline fast indefinitely as the
codebase and team grow. Richardson's qualifier is the decision rule: all of these get worse
as size, complexity and team count increase.

**★ Which of those is the one that actually decides most real cases?**
Independent release cadence, because it is the only one with no in-process substitute at
all, and because it is a function of team count rather than of anything technical. The
technology-stack, security-isolation and data-residency items are decisive when they apply
but they apply to one subdomain and justify one boundary. Failure isolation and resource
shape have partial in-process answers — separate pools, several deployables from one
codebase — that should be tried first. Build speed is measurable and has cheap mitigations.
That leaves autonomy, which is why the split decision is really an organisational one.

**★ A team cites "we need to scale checkout independently". How do you probe that?**
Ask whether they mean resources or release. If resources — checkout needs more instances, a
different heap, a different latency budget — you can deploy the same artefact twice with
different profiles and different limits, which costs a manifest and no architecture change.
If they mean release — the checkout team needs to ship without waiting for the reporting
team — that is item 1 and no in-process arrangement gives it to them. The two get conflated
constantly, and the answers are completely different in cost.

**★ Someone extracts the payments service for PCI reasons and proposes splitting the other
eight modules "for consistency". What do you say?**
That the requirement justified exactly one boundary and consistency is not an architectural
argument. The isolation requirement applied to cardholder data, so extract that and leave
the rest as one deployable with enforced module boundaries. Splitting the other eight incurs
the whole bill — pipelines, correlation, contract tests, lost transactions, deploy
coordination — for none of the seven reasons. The genuine follow-on work is the opposite: the
remaining monolith needs its module discipline tightened, not relaxed, because it is now
integrating with something across a network.

{/* FOOTER */}
