---
title: "Declaring allowedDependencies turns a module from \"may talk to anything that exposes an API\" into a whitelist a build can enforce — and the clause that matters most is the one about code not assigned to any module, which is a hole you have to close yourself"
sidebar_label: "11e · Explicit allowed dependencies"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Fundamentals* — "Explicit
> Application Module Dependencies" and "Named Interfaces"
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)) —
> and *Verifying Application Module Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith **2.1.1**. **No sandbox.**

**Out of the box, verification stops a module reaching into another module's *internals* but
says nothing about which modules may talk to each other at all. Any module may call any
other module's API, and the resulting dependency graph is whatever accumulated. Declaring
`allowedDependencies` inverts that: a module states who it is allowed to depend on, and
everything else becomes a build failure. It is the single highest-value annotation in the
framework and it is opt-in per module.**

## The declaration

> *"A module can opt into declaring its allowed dependencies by using the `@ApplicationModule`
> annotation on the package, represented through the package-info.java file. As, for example,
> Kotlin lacks support for that file, you can also use the annotation on a single type located
> in the application module's root package."*

> ```java
> @org.springframework.modulith.ApplicationModule(
>  allowedDependencies = "order"
> )
> package example.inventory;
> ```

And what verification then enforces:

> *"Explicitly allowed application module dependencies only (optional) — an application module
> can optionally define allowed dependencies via `@ApplicationModule(allowedDependencies = …)`.
> If those are configured, dependencies to other application modules are rejected."*

Note **(optional)**. A module with no such annotation is unconstrained: it may reference the
API of every other module. So the graph is only as tight as the number of modules that opted
in.

## The clause you must not skip

> *"In this case code within the inventory module was only allowed to refer to code in the
> order module (and code not assigned to any module in the first place)."*

**"(and code not assigned to any module in the first place)"** — that parenthesis is a hole
big enough to drive a shared-utilities package through. Any class that lives outside a
detected module package is freely referenceable from every module, forever, with no
violation reported. In a typical codebase that includes:

- Classes in the main application package itself (`com.acme.commerce.SomeHelper`).
- Anything under a package the detection strategy does not treat as a module — a `common`,
  `util` or `shared` package, or an intermediate layer package.
- Anything you excluded with a package predicate.

The result is the *classic* modular-monolith failure: teams add a `common` package for
"things everyone needs", it accumulates domain types, and verification passes throughout
because none of it belongs to a module. Two closures:

1. **Make the shared area a module too.** Then the dependency on it is explicit and
   declarable, and its own internals are protected.
2. **Assert its emptiness.** A separate ArchUnit rule that fails if
   `com.acme.commerce.common` contains anything but a small, listed set of types.

Neither is provided for you.

## Applied to the running example

```java
// com/acme/commerce/ordering/package-info.java
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "catalogue", "customer" }
)
package com.acme.commerce.ordering;
```

```java
// com/acme/commerce/inventory/package-info.java
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "catalogue" }
)
package com.acme.commerce.inventory;
```

```java
// com/acme/commerce/catalogue/package-info.java
/** Depends on nothing. A leaf module — the ideal shape. */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = {}
)
package com.acme.commerce.catalogue;
```

Three things this arrangement buys immediately:

- `ordering` cannot call `inventory`. If it needs inventory to react to something, it must
  publish an event — which is exactly the design **45 · Events instead of bean
  references** *(not written yet)* argues for, now enforced rather than
  encouraged.
- `catalogue` with an empty list is pinned as a leaf. Any future dependency it acquires
  fails the build, which is how you protect the one module everybody depends on from
  becoming the module that depends on everybody.
- The graph is **readable**: seven `package-info.java` files tell you the architecture, in
  the repository, versioned, next to the code.

## The Kotlin-style form in Java

`package-info.java` is genuinely awkward — invisible in most IDE trees, mishandled by some
tooling. The alternative the reference offers for Kotlin works in Java too:

```java
package com.acme.commerce.ordering;

import org.springframework.modulith.ApplicationModule;
import org.springframework.modulith.PackageInfo;

@PackageInfo
@ApplicationModule(allowedDependencies = { "catalogue", "customer" })
class OrderingModuleMetadata {}
```

A package-private class, discoverable by search, easy to comment. Choose one form and use it
consistently — mixing them means half your architecture is in files nobody opens.

## Combining with named interfaces

The `::` syntax from [30 · Named interfaces](11d-named-interfaces.md) composes here:

```java
@ApplicationModule(allowedDependencies = { "catalogue", "ordering :: spi" })
package com.acme.commerce.promotions;
```

`promotions` may implement ordering's SPI and may **not** call `OrderManagement`. And
`"ordering :: *"` grants all of ordering's declared named interfaces.

## Adoption order that actually works

Declaring `allowedDependencies` on all seven modules at once, in an existing codebase,
produces an unreadable failure list. The order that works:

1. **Print the current graph.** `modules.forEach(System.out::println)`, or the actuator's
   `modulith` resource at runtime (**51** *(not written yet)*), which reports
   each module's outgoing dependencies and their kind — `DEFAULT`, `USES_COMPONENT` or
   `EVENT_LISTENER`.
2. **Start with the leaves.** Declare `allowedDependencies = {}` on modules that genuinely
   depend on nothing. Cheap, and it pins the most valuable invariant.
3. **Declare the true dependencies of one module at a time**, fixing or accepting each
   violation as you go.
4. **Only then** start removing entries — each removal is a design change requiring an event
   or an SPI, not a annotation edit.

## Gotchas

**★ Code not assigned to any module is referenceable from everywhere, and the documentation
tells you so in a parenthesis.** A `common` or `util` package outside the module packages
accumulates domain types and verification never objects. Either make the shared area a
module — so the dependency is declarable — or add an ArchUnit rule asserting what may live
there. Doing neither reproduces the exact failure mode the tooling was adopted to prevent.

**★ `allowedDependencies` is opt-in per module, so a graph is only as tight as its most
permissive module.** One module without the annotation may call every other module's API,
and it is usually the oldest and largest one. Track which modules have declared, and treat
undeclared modules as a debt item with an owner.

**★ An empty `allowedDependencies = {}` is a meaningful and under-used declaration.** It
pins a module as a leaf, so any future dependency fails the build. Apply it to the modules
everybody else depends on — catalogue, customer, shared reference data — because those are
precisely the ones whose accidental outbound dependency creates a cycle.

**★ Denying a dependency is a design decision, not a configuration change.** Removing
`inventory` from `ordering`'s allowed list means ordering must stop calling inventory, which
means publishing an event and moving the logic. Declaring the annotation is five minutes;
honouring it is the work. Do not let the annotation land in a pull request that does not also
contain the redesign.

**★ Mixing `package-info.java` and `@PackageInfo` classes hides half your architecture.**
Both work. `package-info.java` is invisible in most IDE navigation and is inconsistently
handled by some code-generation setups; an annotated package-private class is searchable and
commentable. Pick one and enforce it in review, or nobody will be able to find the
declarations.

**★ Declaring dependencies does not stop cycles — the acyclicity rule is separate and always
on.** Verification's first rule is that module dependencies form a directed acyclic graph,
independent of any `allowedDependencies`. So `A → B` and `B → A` fails even if both declare
each other, which is correct and occasionally surprises people who think the whitelist is the
only rule in play.

**★ The dependency kinds in the model are not all equal, and the annotation does not
distinguish them.** The actuator reports `DEFAULT`, `USES_COMPONENT` and `EVENT_LISTENER`. A
bean dependency is much harder to extract than an event listener, so two modules with the
same declared dependency can be in very different shape. Read the kinds, not just the edges,
when judging extraction readiness.

**★ Declaring the graph you have is easy; the value is in declaring the graph you want.**
The first pass should record reality so violations are visible; the second should tighten it
deliberately. A team that stops after the first pass has documentation with a build attached,
which is worth something, and not the architectural constraint that was the point.

## Interview questions

**★ What does `@ApplicationModule(allowedDependencies = …)` change?**
Without it, verification only prevents references into other modules' *internal* packages —
any module may call any other module's API, so the dependency graph is whatever accumulated.
With it, the annotated module declares a whitelist and verification rejects references to any
other module. It is declared on `package-info.java` or on a type annotated `@PackageInfo`, it
is opt-in per module, and it composes with named interfaces through the `::` syntax so a
module can be permitted to use another's SPI while being denied its ordinary API.

**★ What is the biggest hole in the allowed-dependencies mechanism?**
Code that belongs to no module. The reference says a module with declared dependencies may
refer to those dependencies *and to code not assigned to any module in the first place* — so
anything in the main application package, in an intermediate layer package the detection
strategy does not treat as a module, or in an excluded package, is referenceable from
everywhere with no violation. In practice that becomes a `common` or `util` package which
accumulates domain types while verification stays green. The closures are to make the shared
area a module, so the dependency becomes declarable, or to add a separate ArchUnit rule
asserting what may live there.

**★ How would you introduce allowed dependencies into an existing codebase?**
Print the current module model first, or read the actuator's `modulith` resource, so you know
the real graph including the kind of each dependency. Then declare
`allowedDependencies = {}` on the genuine leaf modules — that pins the most valuable
invariant, since a leaf acquiring an outbound dependency is how cycles start. Then take one
module at a time, declare its actual dependencies, and fix or consciously accept each
violation. Only after the graph is fully declared should you start removing entries, and
each removal is a design change — publishing an event or introducing an SPI — not an
annotation edit.

**★ Your ordering module currently calls inventory directly. You want to forbid that. What
is the work?**
Removing `inventory` from ordering's allowed list is the last step, not the first. The
redesign is: identify what ordering is asking inventory to do, express it as a domain event
ordering publishes — `OrderPlaced` carrying the lines — and move the reservation logic into
an `@ApplicationModuleListener` in inventory. Then ordering no longer imports inventory at
all, its module test stops needing an inventory mock, and the direction of the dependency is
inverted to inventory-knows-about-ordering's-event. Only then does the annotation change
compile. The annotation is the assertion that the work is done, which is why it should land
in the same pull request as the work.

{/* FOOTER */}
