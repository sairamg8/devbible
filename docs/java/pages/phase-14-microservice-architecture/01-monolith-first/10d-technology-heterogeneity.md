---
title: "The polyglot argument is usually decoration and occasionally decisive, and the version of it that actually bites has nothing to do with languages: it is the one module pinned to an old library that stops the other eleven from upgrading"
sidebar_label: "10d · Technology heterogeneity"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Chris Richardson, *Pattern: Microservice Architecture* and
> *Pattern: Monolithic Architecture*
> ([microservices.io](https://microservices.io/patterns/microservices.html)); Martin Fowler,
> *Microservice Premium*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Spring Modulith
> 2.1.1. **No sandbox.**

**Richardson's fourth force has two clauses and they behave completely differently. The
first — different languages per service — is either overwhelming or worthless with almost
nothing in between, and in a Java shop it is usually worthless. The second — independent
upgrade — is the one that quietly strangles long-lived monoliths, applies even when every
line of code is Java, and is the honest form of this argument.**

## The force, both clauses

> *"Support multiple technology stacks - subdomains are sometimes implemented using a variety
> of technologies; and developers need to evolve the application's technology stack, e.g. use
> current versions of languages and frameworks"*

> *"Support multiple technology stacks - different services can use different technology
> stacks and can be upgraded independently"*

And the monolith's corresponding drawback:

> *"Multiple technology stacks - the application uses a single technology stack, which might
> not be ideal for all subdomains. Also, if the application is large upgrading the technology
> stack might be very time consuming"*

Three sentences, two distinct problems: **which stack**, and **when you can move it**.

## Clause one: different languages. Rarely, but decisively

The cases where this is genuinely decisive:

- **A model server.** The libraries are Python; there is no JVM equivalent and pretending
  otherwise means reimplementing and revalidating a model.
- **A component with a hard startup or memory constraint** that a JVM cannot meet — an edge
  binary, a function invoked per request in a cold-start-sensitive environment.
- **An acquired system.** You bought a company; their product is Rails; nobody is rewriting
  it.
- **A vendor component** shipped as a binary or a container.

The cases where it is quoted and does not apply:

- "We might want to use Go someday." Nobody has a Go engineer, and a boundary created for a
  hypothetical stack is a boundary created for nothing.
- "Different teams prefer different languages." This is a cost, not a benefit: it fragments
  hiring, tooling, libraries, security review and on-call handover. Richardson's *"Simple
  components"* benefit does not extend to a heterogeneous estate that nobody can move between.

The test is concrete: **name the subdomain, name the language, name the library that
requires it, and name the person who will write it.** If all four have answers, the force is
real and it justifies that one boundary.

## Clause two: independent upgrade. The one that actually bites

This is the version that applies to a codebase where every line is Java, and it is why
long-lived monoliths get stuck.

The mechanism: one module depends on a library that has not been updated for the current
framework generation. Because there is one classpath, that module's constraint becomes the
whole application's constraint. Real, common shapes of it:

- A reporting module using an old PDF or Excel library that binds to an old Servlet API.
- An integration module against a vendor SDK that pins an old HTTP client.
- A module with a transitive dependency on a Jackson 2 API, when the platform has moved to
  **Jackson 3** — which is the case on Spring Boot 4 and is one of this phase's named
  breaking changes. One module's un-migrated code blocks the whole application's Boot
  upgrade.

The consequences compound. A blocked framework upgrade means unpatched CVEs, missing JDK
features, and an ever-growing migration when you finally do it — and it can eventually mean
you are on an unsupported version, which is a security posture rather than an engineering
inconvenience.

## What you can do about clause two without splitting

**1. Make the constraint visible.** Maintain, per module, a list of dependencies that are
not on the current generation, and review it. Spring Modulith's Application Module Canvas
gives you part of this for free, since it enumerates each module's components and configuration
properties — **50 · Documenter and the canvas** *(not written yet)*. The
dependency half needs your build tool: phase 8 owns Maven dependency analysis.

**2. Put an anti-corruption layer around the offending library.** If the vendor SDK lives
behind an interface that only that module's internals touch, replacing it is a contained
change rather than a survey of the codebase. This is exactly what module-internal packages
buy you — [29 · API and internal packages](11c-api-and-internal-packages.md).

**3. Shade it.** Relocate the conflicting library's packages so both versions coexist. It
works, it is unpleasant, and it is a maintenance commitment. Phase 8 owns the mechanics.

**4. Extract that one module.** If a module genuinely cannot move and the platform must,
that is a legitimate, specific reason to split — one boundary, for a stated cause.

**5. Delete it.** Frequently the blocking module is a low-value feature nobody has evaluated
in years. Costing the upgrade against the feature's actual usage is a conversation worth
having before it is an architectural one.

## The cost of heterogeneity that the force does not mention

Every additional stack multiplies:

- Build tooling and CI images.
- Security scanning and CVE response, per ecosystem.
- Observability instrumentation — every language needs its own tracing and metrics setup.
- Deployment templates and base images.
- Hiring pools, and the ability to move engineers between teams.
- On-call: whoever is paged must be able to read the code.

Richardson names support for multiple stacks as a *benefit*, and it is one. The
corresponding cost lands in the platform team — [19 · The organisational
costs](09-the-organizational-costs.md) — and is a good reason to keep the number of stacks
to the smallest set that satisfies a real requirement, even in a microservice estate.

## Gotchas

**★ The polyglot argument is usually decoration, and the upgrade argument is usually real —
teams cite the first and suffer the second.** Ask which is meant. "We might use Go" justifies
nothing. "The reporting module's PDF library blocks our Boot 4 upgrade" justifies a specific,
bounded action.

**★ One module's transitive dependency pins the whole application's framework
generation.** The Jackson 2 to Jackson 3 move on Spring Boot 4 is the current concrete
example: a single module with un-migrated serialisation code blocks everyone. Audit
transitive dependencies per module *before* a framework upgrade, not during.

**★ A blocked upgrade compounds into a security problem, not just a tidiness problem.**
Unpatched CVEs, an eventually unsupported version, and a migration that grows every quarter
you defer it. Frame the blocked module as a risk item with an owner and a date, because
framed as technical debt it will never be prioritised.

**★ Extracting the blocking module is legitimate and justifies exactly one boundary.** If a
module genuinely cannot move to the current stack and the platform must, that is a real
requirement with a real answer. It is not a reason to split the other eleven, and the
proposal should say so explicitly, because "we're upgrading anyway" is a powerful excuse for
scope creep.

**★ Deleting the blocking feature is an option that is almost never evaluated.** The module
holding you back is often a low-usage feature whose upgrade cost exceeds its value. Get the
usage numbers before you get the architecture diagram.

**★ Each additional stack is a permanent multiplier on platform work.** Build images, CVE
scanning, tracing instrumentation, deployment templates, hiring, and the requirement that
whoever is on call can read the code. "Different services can use different technology
stacks" is a benefit with a recurring bill, and a two-language estate is very different from
a five-language one.

**★ An anti-corruption layer inside a module makes the eventual fix contained, and it costs
nothing to add early.** If the vendor SDK is only ever touched from `…inventory.internal`,
replacing it is one module's problem. If its types leak into other modules' signatures, the
replacement is a codebase-wide survey. This is the practical, day-one payoff of module
internals being genuinely internal.

## Interview questions

**★ When is "we need different technology stacks" a real argument?**
When you can name the subdomain, the language, the specific library or runtime constraint
that requires it, and the person who will write it. A Python model server whose libraries
have no JVM equivalent, a component with a startup or memory profile a JVM cannot meet, an
acquired system nobody will rewrite, or a vendor component shipped as a binary. It is not
real when it is "we might want to use Go someday", and it is a cost rather than a benefit
when it is "different teams prefer different languages", because that fragments tooling,
security review, hiring and on-call.

**★ What is the version of this argument that applies to an all-Java codebase?**
Independent upgrade. One classpath means one version of every library, so a single module
depending on something that has not moved to the current framework generation blocks the
whole application. The concrete current example is Jackson 2 to Jackson 3 on Spring Boot 4:
one module with un-migrated serialisation code stops everybody's upgrade. The consequences
compound into unpatched CVEs, missing platform features and an ever-growing migration, which
makes it a security risk rather than tidiness debt.

**★ A module's old vendor SDK is blocking your Spring Boot upgrade. What are the options?**
Five, roughly in order of cost. Make the constraint visible with a per-module dependency
audit so the decision is explicit. Wrap the SDK behind an interface inside that module's
internal package, so replacing it is contained rather than codebase-wide. Shade the
conflicting library so both versions coexist, which works and is a permanent maintenance
commitment. Extract that one module as a service, which is a legitimate, specific
justification for exactly one boundary. Or delete the feature, which is worth evaluating
first because the blocking module is often low-usage and its upgrade cost may exceed its
value.

**★ What is the recurring cost of technology heterogeneity, even in a microservice estate?**
Every additional stack multiplies build tooling and CI images, security scanning and CVE
response per ecosystem, observability instrumentation since each language needs its own
tracing and metrics setup, deployment templates and base images, the hiring pool and the
ability to move engineers between teams, and the on-call requirement that whoever is paged
can read the code. That bill lands on the platform team. So even where the freedom is
available, the right practice is to keep the number of stacks to the smallest set that
satisfies a stated requirement, rather than treating heterogeneity as a benefit to be
maximised.

{/* FOOTER */}
