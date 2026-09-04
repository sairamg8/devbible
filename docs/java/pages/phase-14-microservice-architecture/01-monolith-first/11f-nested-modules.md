---
title: "Nested modules let a large module govern its own internal structure, and their access rules are deliberately asymmetric — a nested module can reach into its parent's internals, but nothing outside can reach into it"
sidebar_label: "11f · Nested modules"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Fundamentals* — "Nested
> Application Modules"
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)) —
> and *Production-ready Features* — the actuator's `parent` and `nested` JSON fields
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/production-ready.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith **2.1.1**; feature available
> since Spring Modulith **1.3**. **No sandbox.**

**Some modules are genuinely large. Inventory in a real commerce system might contain stock
levels, reservations, replenishment and stock-take, each of which wants its own boundary
without becoming a peer of ordering and payment. Nested modules give you a second level of
the hierarchy, with access rules that are not symmetric — and the asymmetry is the whole
design.**

## Declaring one

> *"As of version 1.3, Spring Modulith application modules can contain nested modules. This
> allows governing the internal structure in case a module contains parts to be logically
> separated in turn. To define nested application modules, explicitly annotate packages that
> are supposed to constitute with `@ApplicationModule`."*

The layout from the reference:

> ```
>  Example
> ╰─ src/main/java
>  │
>  ├─ example
>  │ ╰─ Application.java
>  │
>  │ -> Inventory
>  │
>  ├─ example.inventory
>  │ ├─ InventoryManagement.java
>  │ ╰─ SomethingInventoryInternal.java
>  ├─ example.inventory.internal
>  │ ╰─ SomethingInventoryInternal.java
>  │
>  │ -> Inventory > Nested
>  │
>  ├─ example.inventory.nested
>  │ ├─ package-info.java // @ApplicationModule
>  │ ╰─ NestedApi.java
>  ├─ example.inventory.nested.internal
>  │ ╰─ NestedInternal.java
>  │
>  │ -> Order
>  │
>  ╰─ example.order
>  ├─ OrderManagement.java
>  ╰─ SomethingOrderInternal.java
> ```
>
> *"In this example inventory is an application module as described above. The
> @ApplicationModule annotation on the nested package caused that to become a nested
> application module in turn."*

So the mechanism is: an ordinary sub-package of a module becomes a **nested module** simply
by carrying `@ApplicationModule`. Without the annotation it would be an internal package.

## The three access rules, and why they are not symmetric

> *"The code in Nested is only available from Inventory or any types exposed by sibling
> application modules nested inside Inventory."*
>
> *"Any code in the Nested module can access code in parent modules, even internal. I.e., both
> NestedApi and NestedInternal can access inventory.internal.SomethingInventoryInternal."*
>
> *"Code from nested modules can also access exposed types by top-level application modules.
> Any code in nested (or any sub-packages) can access OrderManagement."*

Reading them as a table, with `inventory` as parent and `reservations` as nested:

| From | To | Allowed? |
|---|---|---|
| `ordering` | `inventory.reservations` (anything) | **No** — nested is not visible outside its parent |
| `inventory` | `inventory.reservations` API | Yes |
| `inventory.replenishment` (sibling nested) | `inventory.reservations` API | Yes |
| `inventory.reservations` | `inventory.internal.*` | **Yes, including internals** |
| `inventory.reservations` | `ordering` API | Yes |
| `inventory.reservations` | `ordering.internal.*` | No |

**The asymmetry is deliberate and it is the right one.** A nested module is *part of* its
parent, so it may see the parent's internals — the parent has not encapsulated anything from
its own sub-parts. But the outside world sees only the parent, so the nested structure can
be rearranged freely without any external consequence. That is exactly the property you want
from a private sub-decomposition.

## When to use it, and when not to

**Use it when** one module is large enough that a single team wants internal boundaries — and
when those boundaries are genuinely private, meaning no other top-level module needs to know
they exist. Inventory decomposed into reservations, stock levels and replenishment is the
canonical shape.

**Do not use it when** the nested parts have different owners. Nested modules are still one
module for extraction purposes: they share the parent's API package, they deploy together
obviously, and no other module can address them individually. If two teams own two nested
modules, promote them to top level so the boundary is externally visible and declarable.

**Do not use it to fix a detection mistake.** If your feature packages ended up one level too
deep — `com.acme.commerce.core.inventory` — the answer is to fix the package layout or the
detection strategy, not to annotate them as nested modules of `core`. Nesting them under a
meaningless parent makes `core` an unaddressable god-module.

## Applied to the running example

```java
// com/acme/commerce/inventory/reservations/package-info.java
@org.springframework.modulith.ApplicationModule
package com.acme.commerce.inventory.reservations;
```

```java
// com/acme/commerce/inventory/replenishment/package-info.java
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "inventory.reservations" }
)
package com.acme.commerce.inventory.replenishment;
```

Note the qualified name form for a nested module in `allowedDependencies`. **Verify the exact
name the model assigns** by printing it — `modules.forEach(System.out::println)` reports each
module's logical name, and guessing at the separator is a fast way to get a confusing
verification failure.

## How nesting shows up in the runtime model

The actuator's `modulith` resource carries the hierarchy explicitly:

> *"$.\{moduleName\}.parent | (optional) The name of the parent module."*
>
> *"$.\{moduleName\}.nested | The names of nested modules, if any."*

So the nesting is visible at runtime as well as at verification time, which makes it
reviewable — **51 · Actuator and observability** *(not written yet)*.

## Gotchas

**★ A nested module can read its parent's internals, including packages the parent hides
from everyone else.** This is documented and intended, and it means nesting is *not* a way
to protect the parent from its own sub-parts. If you want mutual protection between two
parts, they are two top-level modules, not a parent and a nested child.

**★ Nested modules are invisible from outside the parent, which is the feature and the
limitation.** No other top-level module can reference them at all, so you cannot expose a
nested module's API selectively to a peer. If a peer needs it, promote the nested module to
top level or expose the type through the parent's API package.

**★ Nesting does not create an extraction boundary.** A nested module ships with its parent
and cannot be addressed independently, so from the perspective of a future service split it
is a package arrangement, not a seam. Treat top-level modules as extraction candidates and
nested modules as internal organisation.

**★ Two owners means two top-level modules.** If different teams own the nested parts, the
boundary between them is exactly the kind that needs to be externally visible and
declarable — and nesting deliberately makes it invisible. This is one of the few places
where the technical mechanism and the organisational requirement pull in opposite
directions, and the organisation should win.

**★ Do not use nesting to paper over a detection problem.** Feature packages one level too
deep under a `core` or `domain` package should be moved up, or the detection strategy
changed to `explicitly-annotated`. Annotating them as nested modules of `core` technically
works and produces a god-module that no other module can address any part of.

**★ Get the nested module's logical name from the model rather than guessing it.** The name
appears in `allowedDependencies` declarations, in the actuator output and in verification
failure messages. Print the model once and copy the exact string; inventing the separator is
a common way to spend twenty minutes on a failure that says a module does not exist.

**★ The `@ApplicationModule` annotation on a sub-package changes it from internal to a nested
module, which *widens* access from siblings.** Before annotation, `inventory.reservations`
was internal and unreachable from `inventory.replenishment` unless replenishment was also
internal to inventory. After annotation, sibling nested modules may use its exposed types.
Adding the annotation is not a purely organisational change.

## Interview questions

**★ What are nested modules and what are their access rules?**
Since Spring Modulith 1.3, a sub-package of a module that carries `@ApplicationModule`
becomes a nested module rather than an internal package. Three rules apply, and they are
asymmetric. Code in the nested module is only visible from its parent or from types exposed
by sibling nested modules inside the same parent — nothing outside the parent can reach it.
The nested module can access its parent's code including internal packages. And it can access
the exposed API of top-level modules. The asymmetry is intentional: a nested module is part
of its parent, so the parent has not hidden anything from it, while the outside world sees
only the parent and the internal decomposition can change freely.

**★ When should you use nesting, and when should you promote to a top-level module?**
Use nesting when one module is large enough that its owning team wants internal boundaries
and those boundaries are genuinely private — inventory decomposed into reservations, stock
levels and replenishment, with no other module needing to know those parts exist. Promote to
top level when the parts have different owning teams, because a boundary between teams needs
to be externally visible and declarable and nesting deliberately hides it; or when another
module legitimately needs to address one part directly. Also promote rather than nest if the
nesting would only exist to work around feature packages sitting one level too deep.

**★ Does nesting help with a future extraction?**
No. A nested module ships with its parent, shares the parent's externally visible API and
cannot be referenced by name from outside, so from an extraction standpoint it is package
organisation rather than a seam. Extraction candidates are top-level modules — those are the
ones with their own API package, their own declarable dependency edges and their own entry
in the module model that other modules reference. If you expect to extract a part of a large
module later, make it top level now, even if one team owns both.

**★ What changes when you add `@ApplicationModule` to a sub-package that was previously
internal?**
It stops being internal and becomes a nested module, which *widens* its accessibility rather
than narrowing it: sibling nested modules inside the same parent may now use its exposed
types, whereas before it was reachable only from the parent's own base package. It also
gains its own identity in the module model — its own logical name, its own entry in the
actuator output with a `parent` field, and its own ability to declare
`allowedDependencies`. So it is a modelling change with real access consequences, not a
documentation annotation.

{/* FOOTER */}
