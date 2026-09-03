---
title: "\"Clone the repo and run the tests\" is a sentence that stops being true the day you split, and the infrastructure project that replaces it has no owner, no budget line and no completion criteria"
sidebar_label: "08 · Local development"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Martin Fowler, *Microservice Prerequisites*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePrerequisites.html));
> Chris Richardson, *Pattern: Microservice Architecture*
> ([microservices.io](https://microservices.io/patterns/microservices.html)); the Spring
> Modulith reference, *Integration Testing Application Modules*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/testing.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox** — no
> container output, startup times or memory figures on this page were measured.

**Developer experience is the cost that never appears in a split proposal and shows up in
every retrospective afterwards. It is not one cost but four — running the system, getting
data into it, testing a change, and reproducing a bug — and each of them degrades
independently. The worst part is that the degradation is gradual, so no single day is bad
enough to trigger a response.**

## The four separate problems

### 1. Running the system

In a monolith: start the application and a database. In a twelve-service system, the options
are all bad in different ways.

**Run everything locally.** Twelve JVMs plus their datastores plus a broker plus a gateway.
Every service you add makes this worse for every developer, and the ones with the least
powerful machines feel it first. This does not scale past a handful of services and everyone
knows it, but it is the default because it is the only option that requires no work.

**Run your service, point at a shared environment.** Fast, and it introduces a shared mutable
dependency: your local experiment writes to data other developers are relying on, and their
deployments break your debugging session mid-step. It also stops working the moment you need
to change *both* sides of an interaction.

**Run your service, mock the neighbours.** The right answer, and it requires stubs that stay
faithful — which means generating them from contracts rather than hand-writing them. Stub
runners built from consumer-driven contracts are the mechanism; **11 · Contract testing**
*(not written yet)* owns it. Until that exists, hand-written mocks drift and give you green
tests against a provider that no longer behaves that way.

**Remote development environments.** A per-developer namespace in a cluster. Real, expensive
in money and in platform-team time, and it moves the whole feedback loop over the network.

### 2. Getting data in

A monolith has one database and one seed script. Twelve services have twelve datastores that
must be **mutually consistent**: the customer id in the order service must exist in the
customer service, the SKU in the order must exist in catalogue and have stock in inventory.

Nobody owns this. The seed data becomes a tangle of scripts that break whenever any service's
schema changes, and the common workaround — copying a slice of production down — imports a
data-protection problem into every developer's laptop.

### 3. Testing a change that spans two services

In a monolith this is one test, in one project, that the compiler already validated. Across
services it is: a consumer test with a stub, a provider test against the contract, and — if
you want end-to-end confidence — an environment with both deployed. The first two are the
right answer and they are a capability you have to build. The third is the trap, because it
serialises releases; see [15 · The version matrix](06b-the-version-matrix.md).

### 4. Reproducing a production bug

You need the version combination that was live ([15](06b-the-version-matrix.md)), the data
state across several stores, and the sequence of interactions including asynchronous ones.
Teams underestimate this so consistently that **"cannot reproduce"** becomes a standard
resolution for intermittent distributed bugs — which is not a resolution, it is a decision
to ship the bug.

## The cost nobody assigns

The local-development story is a **product** with users (every engineer, every day), a
maintenance burden, and no owner. Symptoms that it has gone unowned:

- The onboarding document has a section titled "known issues with the local setup".
- New joiners take days rather than hours to make their first change.
- Someone maintains the `docker-compose.yml` "when they get time".
- Engineers debug on the shared development environment because local does not work, which
  makes that environment unstable, which makes more people debug on it.

Every one of those is expensive and none of them shows up in a metric anyone reports.

## What Spring Modulith gives you in-process, and how far it goes

This is the one area where the modular monolith's advantage is a *technical* mechanism
rather than merely "there is only one thing". `@ApplicationModuleTest` narrows the Spring
context to a single module:

```java
package com.acme.commerce.ordering;

import org.springframework.modulith.test.ApplicationModuleTest;

@ApplicationModuleTest
class OrderIntegrationTests {
    // Individual test cases go here
}
```

The reference describes exactly what that changes:

> *"This will run your integration test similar to what @SpringBootTest would have achieved
> but with the bootstrap actually limited to the application module the test resides in."*
>
> *"It creates the application module, finds the module to be run and limits the application
> of auto-configuration, component and entity scanning to the corresponding packages."*

And when the module under test needs a neighbour's bean, the guidance is to mock it rather
than widen the bootstrap:

> *"While a natural reaction might be to expand the scope of the application modules
> included, it is usually a better option to mock the target beans."*

```java
@ApplicationModuleTest
class InventoryIntegrationTests {

    @MockitoBean SomeOtherComponent someOtherComponent;
}
```

With a diagnostic attached that is worth quoting in a design review:

> *"If you find your application module depending on too many beans of other ones, that is
> usually a sign of high coupling between them. The dependencies should be reviewed for
> whether they are candidates for replacement by publishing domain events."*

So: fast module-scoped tests, a mocking discipline identical to what you will need after
extraction, and a coupling metric — the number of `@MockitoBean` declarations a module test
needs. [39 · The module test slice](13-the-module-test-slice.md) through
**44 · Change-aware test execution** *(not written yet)* cover the whole
facility.

**What it does not give you:** running the module in a separate process, version skew,
network failure, or a separate datastore. It rehearses the *isolation* discipline, not the
*distribution* reality.

## Gotchas

**★ "Run everything locally" is the default because it needs no work, and it is the option
that fails first.** Each new service degrades every developer's machine, and the failure is
gradual so no single service triggers a rethink. Decide the local-development strategy
before service number three, when changing it is still cheap.

**★ Pointing local code at a shared environment creates a shared mutable dependency between
developers.** Your experiment corrupts data someone is debugging against; their deployment
restarts a service mid-session. It also fails completely for any change that touches both
sides of an interaction, which is exactly the change you most need to test.

**★ Hand-written stubs drift, and a green test against a drifted stub is worse than no
test.** The only stubs that stay honest are ones generated from the provider's contract and
regenerated in the provider's pipeline. If you cannot generate stubs, the "run your service
and mock the neighbours" strategy is not actually available to you yet.

**★ Consistent seed data across N datastores is an unowned, permanently broken artefact.**
The customer, catalogue, inventory and order stores must agree; each schema change breaks
the scripts; nobody's objective includes fixing them. Assign it an owner or accept that
every developer maintains a private, divergent copy.

**★ Copying production data down solves the seed problem and creates a compliance problem.**
Personal data on developer laptops is a data-protection incident waiting for an audit. If
you go this route you need anonymisation as part of the extract, which is another owned,
maintained artefact.

**★ "Cannot reproduce" becomes a resolution status, and it is a decision to ship the bug.**
Intermittent distributed bugs need the version combination, the multi-store data state and
the interaction sequence — including asynchronous ones. Without a deployment record and
correlated traces you cannot assemble any of that, so the failure gets closed rather than
fixed and recurs monthly.

**★ Engineers debugging on the shared development environment is a feedback loop that gets
worse on its own.** Local is broken, so people debug on shared; shared becomes unstable
because people are debugging on it; so more people give up on local. By the time anyone
notices, fixing local requires undoing a year of workarounds.

**★ The number of `@MockitoBean` declarations in a module test is a coupling metric you get
for free — use it.** The Spring Modulith reference says outright that a module depending on
too many beans from others signals high coupling and suggests replacing those dependencies
with domain events. Track that count per module; it is the cheapest available early warning
that a boundary is in the wrong place.

## Interview questions

**★ What are the four separate local-development problems a split creates?**
Running the system, since a monolith needs one process and a database while twelve services
need twelve of everything. Getting consistent data in, because the datastores must agree —
the customer id in an order must exist in the customer service — and nobody owns the seed
scripts. Testing a change that spans services, which turns one compiler-checked test into a
consumer test with stubs plus a provider test against the contract. And reproducing a
production bug, which requires the live version combination, the data state across several
stores and the interaction sequence. Each degrades independently and gradually, so no single
day is bad enough to prompt a response.

**★ What is wrong with pointing your local service at a shared development environment?**
It creates a mutable dependency shared between developers: your experiment writes data
someone else is debugging against, and their deploy restarts a service in the middle of your
session. It also does not work at all for the change you most need to test — one that alters
both sides of an interaction — because you cannot deploy your unfinished provider change into
the shared environment. And it degrades the shared environment's stability, which pushes
more people onto it as local setups rot, which is a feedback loop that only gets worse.

**★ How much of this does a modular monolith avoid?**
Most of it, and by mechanism rather than by luck. One process and one database means one
run command and one seed script. `@ApplicationModuleTest` limits the Spring bootstrap,
auto-configuration, component scanning and entity scanning to a single module's packages, so
module tests are fast and isolated without any of the process or network machinery. The
prescribed way to handle a bean reference into another module is `@MockitoBean` rather than
widening the bootstrap, which is the same isolation discipline you will need after
extraction. What it does not rehearse is the genuinely distributed part: separate processes,
version skew, network failure and separate datastores.

**★ Give a metric that tells you a module boundary is in the wrong place, for free.**
The number of `@MockitoBean` declarations its module test needs. The Spring Modulith
reference states the diagnosis directly: a module depending on too many beans of other
modules is usually a sign of high coupling, and those dependencies should be reviewed for
replacement by domain events. It is free because you write the mocks anyway, it is objective,
it trends over time, and a module whose mock count is climbing is a module you should not
extract yet — and possibly one whose boundary should be redrawn.

{/* FOOTER */}
