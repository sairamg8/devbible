---
title: "A monolith has one version in production; N independently deployed services have a combination of versions that nobody chose, nobody wrote down and no test ever ran — and the number of such combinations grows faster than anything else in the system"
sidebar_label: "06b · The version matrix"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Chris Richardson, *Pattern: Microservice Architecture*
> ([microservices.io](https://microservices.io/patterns/microservices.html)); Martin Fowler,
> *Microservice Prerequisites*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePrerequisites.html)) and
> *Microservice Premium*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith 2.1.1. **No sandbox** — the
> arithmetic below is arithmetic you can redo, not measurement.

**"What is running in production?" has a one-line answer in a monolith and no answer at all
in a microservice estate. Every service deploys on its own schedule, so the set of versions
live at any instant is a combination that emerged rather than one that was chosen. This is
the direct, unavoidable consequence of the benefit you bought — independent deployability
*means* uncoordinated versions — and it is the reason integration testing stops working as
a strategy.**

## The arithmetic

This is a calculation, not a measurement. With `S` services each having `v` versions
plausibly live at once — during rolling updates, canaries, or a slow rollout — the number of
version combinations is `v^S`.

| Services | Versions each | Combinations |
|---|---|---|
| 1 | 2 | 2 |
| 3 | 2 | 8 |
| 6 | 2 | 64 |
| 12 | 2 | 4,096 |
| 12 | 3 | 531,441 |

You will never test 4,096 combinations, and you do not need to — the vast majority are
irrelevant because most pairs of services do not talk. What matters is the number of
combinations **across each interaction**, which for a pairwise interaction with two live
versions each side is four: old↔old, old↔new, new↔old, new↔new. All four occur during any
rolling update, and three of them are the ones nobody tested.

The point of the table is not the big number. It is that **the number is greater than one**,
where the monolith's is exactly one, and everything that follows comes from that.

## What stops working

**Integration testing as a release gate.** "Deploy everything to staging, run the suite,
ship" tests exactly one combination — the one where every service is at its newest version.
That combination is the *least* likely one in production during a rollout. Worse, using
staging as the gate serialises releases and abolishes the independent deployability you
paid for, as [14 · Deploy coordination](06-deploy-coordination.md) argues.

The replacement is **consumer-driven contract testing**: each consumer states what it
requires of a provider, the provider runs those expectations in its own pipeline, and a
provider cannot ship a change that breaks a live consumer. That gate is per-service, so it
does not serialise anything. **11 · Contract testing** *(not written yet)* owns it in full,
including Spring Cloud Contract 5.0 and Pact.

**"It works on my machine, with the versions I have."** Local development pins a set of
versions — usually whatever was current when the developer last pulled. That combination is
not the production combination. See [17 · Local development](08-local-development.md).

**Bisecting a regression.** In a monolith, `git bisect` over one repository finds the
commit. Across twelve repositories with independent release histories, "when did this
break?" means correlating twelve deployment timelines against an incident window, and the
culprit may be an interaction between two changes that were each fine.

**Reproducing a production bug.** You must reconstruct the exact version combination that
was live, which requires that deployments were recorded with timestamps and versions, in a
place you can query. If you did not build that, the combination is unrecoverable.

## The three things you must build

**1. A deployment record.** Every deployment of every service, with version, timestamp and
commit, queryable by time range. This is the artefact that makes "what was running at
14:32?" answerable. It is trivially cheap to build up front and impossible to build
retroactively.

**2. Version visibility at runtime.** Every service exposes its own version, and — the part
people skip — every response or log line carries enough to attribute it. Spring Boot's
actuator `info` endpoint with build information is the standard answer; phase 9 topic 13
owns actuator.

**3. Contract tests as the per-service gate.** So that "new provider against old consumer"
is a case your pipeline actually runs, rather than a case production runs for you.

## Compatibility windows are a policy decision nobody makes

How long must a provider support a consumer's old expectations? The honest answers:

- **Until every consumer has upgraded** — which requires knowing who your consumers are, so
  you need a consumer registry, and it means a slow consumer blocks your cleanup
  indefinitely.
- **For a fixed window, say 90 days** — which requires telling consumers, and a mechanism to
  detect who is still using the old shape after the deadline.
- **Forever** — the default that happens when nobody decides, and the reason mature estates
  accumulate compatibility code that nobody dares remove.

In a monolith this question does not exist: the compiler enforces that there is exactly one
shape, everywhere, at once.

## The monolith's version story, for contrast

One artefact version. `git bisect` works. "What is in production?" is a tag. A regression
window is a commit range. During a rolling deployment two versions of the *same* artefact
coexist, so you do still need your API and your database schema to be backwards compatible
with the immediately previous version for the duration of the rollout — that is real and it
is one dimension, not `S` dimensions.

This is also the honest limit of the modular monolith rehearsal: modules deploy together, so
you never experience version skew *between* modules. What you can rehearse is the schema
compatibility discipline — see phase 10's Flyway topic and Spring Modulith's per-module
migration support, **52 · Module-aware Flyway** *(not written yet)* — and the habit of
treating event payloads as versioned contracts,
**49 · Externalisation and the seam** *(not written yet)*.

## Gotchas

**★ The combination running in production was never chosen by anyone and was never
tested.** This is not a process failure to be fixed; it is the definitional consequence of
independent deployment. The correct response is to stop trying to test combinations and
start testing contracts pairwise, which is a different testing strategy rather than a
better-executed version of the old one.

**★ Staging as a release gate gives you one tested combination and takes away independent
deployability.** It is the worst of both: you serialise releases behind a shared environment
*and* the single combination you validated is the one least likely to be live during a
rollout. Teams adopt it because it feels like the monolith's safety, and it is not.

**★ Without a deployment record you cannot reconstruct an incident's version
combination, and you cannot build the record retroactively.** Version, timestamp and commit
per deployment, queryable by time range. It costs almost nothing in the service template and
is the first thing you will want during the first serious incident.

**★ "Rolling back" is ambiguous when the failure is an interaction between two
deployments.** Neither service's change is individually bad, so rolling back either one
might fix it — or might not, if the other's change depended on it. Without contract tests
you are guessing, during an outage, with two teams on the call.

**★ The compatibility window is a policy that gets decided by not deciding.** Nobody names
a date, so shims are permanent and the provider's code accumulates branches for consumers
that may no longer exist. Fix it structurally: maintain a consumer registry (contract tests
give you one for free, since each consumer's expectations are a file in your repository) and
make the deprecation window explicit and dated.

**★ Canary and blue-green deployments multiply `v` rather than reducing risk for free.**
Running two versions of a service deliberately is a good practice and it means three
versions can be live at once across a pair of services, not two. The compatibility
requirement gets stronger, not weaker, and the "new consumer against old provider" case
becomes routine rather than transient.

**★ Database migrations have their own version matrix and it is stricter.** Application code
can be rolled back; a migration usually cannot. So every schema change must be compatible
with both the previous and the next application version, in both directions, for the
duration of the rollout. This is true in a monolith too — it is the one place the monolith
does not save you — which makes it the best available in-process rehearsal for the whole
discipline.

## Interview questions

**★ Why does integration testing stop being a viable release gate after a split?**
Because it tests one version combination — everything at its newest — and that combination
is the least likely to be live during a rolling deployment, where old and new instances of
several services serve traffic simultaneously. It also serialises releases behind a shared
environment, which removes the independent deployability the split was supposed to buy. The
replacement is consumer-driven contract testing: each consumer's expectations are executed
in the provider's own pipeline, so a provider cannot ship a change that breaks a live
consumer, and the gate stays per-service.

**★ How many version combinations does a rolling update of two interacting services
produce?**
Four: old consumer with old provider, old with new, new with old, new with new. All four
occur, in unpredictable proportion, for the duration of the rollout — and three of them are
combinations that a "deploy everything to staging and test" strategy never exercised. That
is the practical version of the matrix; the `v^S` figure across the whole estate is
arithmetic that makes the point but is not the thing you test against, because most pairs of
services never interact.

**★ An incident starts at 14:32. What do you need in order to find out what was running?**
A deployment record: every deployment of every service with version, timestamp and commit,
queryable by time range. Plus runtime version visibility — each service reporting its own
build information via actuator, and enough version attribution in logs and responses to tie
a specific failure to a specific instance. Neither can be reconstructed after the fact,
which is why both belong in the service template before service number two exists. Without
them, "which combination was live?" is unanswerable and the investigation reduces to
guesswork over deployment chat messages.

**★ How long should a provider support an old contract?**
It is a policy decision and the failure mode is not making it. The options are: until every
known consumer has migrated, which requires knowing your consumers and lets a slow one block
you indefinitely; for a fixed, announced window with a mechanism to detect stragglers, which
is the workable answer; or forever, which is what happens by default and is why mature
estates accumulate compatibility branches nobody dares delete. Contract testing helps
because each consumer's expectations live as a file in the provider's repository, so the
consumer registry is a by-product rather than a separate thing to maintain.

**★ What part of the version problem exists in a monolith, and why does it matter?**
Database migrations. Application code deploys as one artefact and rolls back as one
artefact, but during a rolling update two versions of that artefact run at once, so the
schema must be compatible with both — and a migration generally cannot be rolled back at
all. That forces the expand/contract discipline: add the nullable column, deploy code that
writes both shapes, backfill, deploy code that reads the new shape, and only then drop the
old one. It is the same discipline the wire format needs after a split, in the one place the
monolith cannot exempt you from it, which makes it the best rehearsal available.

{/* FOOTER */}
