---
title: "@ApplicationModuleTest is @SpringBootTest sliced vertically instead of horizontally: it limits auto-configuration, component scanning and entity scanning to one module's packages, which is the same isolation an extracted service would have and the reason it is a rehearsal rather than a convenience"
sidebar_label: "13 · The module test slice"
sidebar_position: 39
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Integration Testing
> Application Modules*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/testing.html)) and
> *Fundamentals* — `@Modulithic`'s `sharedModules`
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith **2.1.1**. **No sandbox** — the
> bootstrap log excerpt quoted below is reproduced from the reference documentation, not
> produced by a run.

**Spring Boot's slice tests cut horizontally: `@DataJpaTest` gives you the persistence layer
of the whole application, `@WebMvcTest` the web layer of the whole application.
`@ApplicationModuleTest` cuts the other way — every layer, of one module. That is the same
shape an extracted service would have, which makes it the closest thing to a rehearsal the
modular monolith offers.**

## Setup and use

> ```xml
> <dependency>
>  <groupId>org.springframework.modulith</groupId>
>  <artifactId>spring-modulith-starter-test</artifactId>
>  <scope>test</scope>
> </dependency>
> ```

> *"and place a JUnit test class in an application module package or any sub-package of that
> and annotate it with `@ApplicationModuleTest`"*

```java
package com.acme.commerce.ordering;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.modulith.test.ApplicationModuleTest;

@ApplicationModuleTest
class OrderIntegrationTests {

    @Autowired OrderManagement orders;

    @Test
    void placesAnOrder() {
        // …
    }
}
```

**The module is inferred from the test's package.** There is no attribute naming it. A test
in `com.acme.commerce.ordering` or any sub-package of it tests the `ordering` module; move
the class and you have silently changed what is under test.

## What it actually does

> *"This will run your integration test similar to what @SpringBootTest would have achieved
> but with the bootstrap actually limited to the application module the test resides in."*

And the specific limitations, which are the interesting part:

> *"It creates the application module, finds the module to be run and limits the application
> of auto-configuration, component and entity scanning to the corresponding packages."*

Three separate narrowings:

- **Auto-configuration** is restricted to the module's packages.
- **Component scanning** is restricted, so beans in other modules are not created.
- **Entity scanning** is restricted, so JPA only knows about this module's entities.

That last one is the sharpest, because it is the closest in-process equivalent to a separate
database. If `reporting`'s entity maps a table that `ordering` also reads, an
`@ApplicationModuleTest` on `ordering` will not have that entity registered — and a query
that quietly relied on it will fail, which is exactly the failure you want to discover now
rather than during an extraction.

## Seeing what it did

> *"If you configure the log level for org.springframework.modulith to DEBUG, you will see
> detailed information about how the test execution customizes the Spring Boot bootstrap"*

The reference's own example of that output:

> ```
> … - Bootstrapping @ApplicationModuleTest for example.order in mode STANDALONE (class example.Application)…
> … - ======================================================================================================
> … - ## example.order ##
> … - > Logical name: order
> … - > Base package: example.order
> … - > Direct module dependencies: none
> … - > Spring beans:
> … - + ….OrderManagement
> … - + ….internal.OrderInternal
> … - Re-configuring auto-configuration and entity scan packages to: example.order.
> ```

```properties
# src/test/resources/application.properties
logging.level.org.springframework.modulith=DEBUG
```

**Turn this on the first time and read it.** The `Direct module dependencies` line is a
free, per-module coupling report, and `Re-configuring auto-configuration and entity scan
packages to: …` tells you exactly what the slice narrowed to — which is the fastest way to
diagnose a test that fails with a missing bean or an unmapped entity.

## Shared modules, so you are not mocking the same thing everywhere

Almost every module needs some cross-cutting infrastructure — a configuration module, a
security module, a `Clock`. Mocking it in every test is noise. `@Modulithic` has the answer:

> *"sharedModules | Declares the application modules with the given names as shared modules,
> which means that they will always be included in application module integration tests."*

```java
@Modulithic(sharedModules = { "shared", "security" })
@SpringBootApplication
class CommerceApplication { /* … */ }
```

Two cautions. **Shared modules are included in every module test**, so a slow or
heavyweight shared module makes every test slower. And declaring a module shared does not
grant anyone permission to depend on it — that is still `allowedDependencies`
([31](11e-explicit-allowed-dependencies.md)) — so the two lists can and should differ.

## Why this is a rehearsal and not just a speed optimisation

An extracted service starts with only its own beans, its own configuration and its own
schema. `@ApplicationModuleTest` produces the same conditions. Which means:

- A module that **cannot** be tested in `STANDALONE` mode without a long list of mocks is a
  module you cannot extract without a long list of remote calls.
- A module whose entities will not map because they need another module's tables is a module
  whose data is not actually its own.
- A module whose auto-configuration is provided by another module's `@Configuration` class is
  a module that does not own its own wiring.

Each of those failures is diagnostic. Treat a difficult module test as information about the
boundary, not as a testing problem to be worked around by widening the bootstrap —
[41 · Efferent dependencies and mocks](13c-efferent-dependencies-and-mocks.md).

## Gotchas

**★ The module under test is determined by the test class's package, with no annotation
attribute to override it.** Moving a test class between packages silently changes what it
tests, and a test placed in the application's root package is not a module test at all. Keep
test packages mirroring main packages exactly.

**★ Entity-scan narrowing is the sharpest edge and the most useful.** JPA will only know
about the module's own entities, so any repository method or query that silently relied on
another module's mapping fails. That is not a bug in the slice; it is the slice telling you
the module's data is not self-contained.

**★ Turn on `logging.level.org.springframework.modulith=DEBUG` before you need it.** The
bootstrap log names the mode, the module, its direct module dependencies and the packages the
scan was narrowed to. Almost every confusing module-test failure is answered by that output,
and almost nobody enables it until after an hour of guessing.

**★ Shared modules are added to every module test, so their cost is multiplied.** A shared
module that starts a heavyweight component adds that cost to every test in the codebase.
Keep shared modules small, and prefer mocking a heavy dependency to declaring its module
shared.

**★ `sharedModules` and `allowedDependencies` are different lists with different meanings.**
Declaring a module shared changes test bootstrapping; it grants no architectural permission.
A module can be shared and still be one that nothing is allowed to depend on, and both
statements can be true and correct simultaneously.

**★ A module test that needs many mocks is a boundary report, not a test problem.** The
temptation is to switch bootstrap mode to `ALL_DEPENDENCIES` and move on. The reference
advises against it explicitly, and the number of mocks is a coupling metric you get for free
— see [41](13c-efferent-dependencies-and-mocks.md).

**★ `@ApplicationModuleTest` still starts a Spring context, so it is not a unit test.** It
is faster than `@SpringBootTest` because the context is smaller, and it is far slower than a
plain JUnit test with constructor injection. Phase 11's test-pyramid topic
([the pyramid and the honest version](../../phase-11-testing/05-the-test-pyramid/README.md))
applies unchanged: most of a module's tests should not need Spring at all.

## Interview questions

**★ What is `@ApplicationModuleTest` and how does it differ from Boot's slice tests?**
Boot's slices cut horizontally — `@DataJpaTest` gives the persistence layer of the whole
application, `@WebMvcTest` the web layer. `@ApplicationModuleTest` cuts vertically: every
layer of a single module. Concretely it bootstraps a Spring context like `@SpringBootTest`
but limits auto-configuration, component scanning and entity scanning to the module's
packages. The module is inferred from the test class's package rather than named in an
attribute. The effect is a context with only that module's beans and only that module's
entities registered, which is close to the conditions an extracted service would run in.

**★ Why is entity-scan narrowing the most valuable part of the slice?**
Because it is the nearest in-process analogue to a separate database, and it exposes data
coupling that nothing else catches. If a module's repository quietly depends on another
module's entity mapping — a join, an association, a shared table — the module test fails
because that entity is not registered. Verification cannot see that coupling at all, since it
is expressed in table names and mappings rather than in type references between modules, so
the module test is the only mechanism that surfaces it before an extraction does.

**★ What does it mean when a module test needs eight mocks?**
That the module has eight bean-level dependencies on other modules, which is a coupling
report rather than a testing inconvenience. The reference states the diagnosis directly: a
module depending on too many beans of other modules signals high coupling, and those
dependencies should be reviewed for replacement by domain events. Practically, it means an
extraction of that module would replace those eight injections with eight remote calls, each
with its own timeout, failure mode and contract. The number is worth tracking per module over
time.

**★ What is `sharedModules` for and what is the trap?**
It declares modules that are always included in application module integration tests, which
removes the repetitive mocking of cross-cutting infrastructure — configuration, security, a
clock — from every test. The trap is cost multiplication: a shared module is bootstrapped in
every module test in the codebase, so anything heavyweight in it is paid for everywhere.
The second trap is confusing it with permission: declaring a module shared says nothing about
which modules may depend on it, which remains a matter for `allowedDependencies`.

{/* FOOTER */}
