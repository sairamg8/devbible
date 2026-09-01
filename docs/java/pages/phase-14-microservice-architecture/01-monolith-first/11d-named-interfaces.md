---
title: "A named interface is how a module exposes a second package on purpose, with a name other modules must ask for by that name — which turns \"we have an SPI\" from a comment into something the verification test can check"
sidebar_label: "11d · Named interfaces"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Fundamentals* — "Named
> Interfaces" and "Customizing Named Interface detection"
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith **2.1.1**. **No sandbox.**

**By default a module has exactly one entrance: its base package. That is usually right and
occasionally too blunt — a module may legitimately need to expose a second, differently
shaped surface, most often a service-provider interface that other modules implement rather
than call. Named interfaces make that second surface explicit, name it, and let a dependent
module declare which surface it is allowed to use.**

## The default, and why you need an escape from it

> *"By default and as described in Advanced Application Modules, an application module's base
> package is considered the API package and thus is the only package to allow incoming
> dependencies from other modules. In case you would like to expose additional packages to
> other modules, you need to use named interfaces. You achieve that by annotating the
> package-info.java file of those packages with `@NamedInterface` or a type explicitly
> annotated with `@org.springframework.modulith.PackageInfo`."*

The realistic motivation is not "we want more entrances". It is that **two kinds of exposure
have different stability contracts**:

- The **API** — what other modules call. Changes here break callers.
- The **SPI** — what other modules implement, and this module calls. Changes here break
  implementers, in the opposite direction, and often need a different deprecation policy.

Putting both in the base package makes them indistinguishable to a reviewer.

## Declaring one

> ```
>  Example
> ╰─ src/main/java
>  ├─ example
>  │ ╰─ Application.java
>  ├─ …
>  ├─ example.order
>  │ ╰─ OrderManagement.java
>  ├─ example.order.spi
>  │ ├— package-info.java
>  │ ╰─ SomeSpiInterface.java
>  ╰─ example.order.internal
>  ╰─ SomethingOrderInternal.java
> ```

With `package-info.java`:

> ```java
> @org.springframework.modulith.NamedInterface("spi")
> package example.order.spi;
> ```

And the effect:

> *"The effect of that declaration is twofold: first, code in other application modules is
> allowed to refer to SomeSpiInterface. Application modules are able to refer to the named
> interface in explicit dependency declarations."*

In the commerce example, a pricing hook the promotions module implements:

```java
// com/acme/commerce/ordering/spi/package-info.java
@org.springframework.modulith.NamedInterface("spi")
package com.acme.commerce.ordering.spi;
```

```java
// com/acme/commerce/ordering/spi/OrderTotalAdjuster.java
package com.acme.commerce.ordering.spi;

import com.acme.commerce.ordering.Money;

/** Implemented by other modules; called by ordering. */
public interface OrderTotalAdjuster {

    Money adjust(Money subtotal, AdjustmentContext context);
}
```

The `spi` package is now a second legal entrance to `ordering`, and it is legal *by name*.

## Referring to it from a dependent module

> ```java
> @org.springframework.modulith.ApplicationModule(
>  allowedDependencies = "order :: spi"
> )
> package example.inventory;
> ```
>
> *"Note how we concatenate the named interface's name spi via the double colon `::`. In this
> setup, code in inventory would be allowed to depend on SomeSpiInterface and other code
> residing in the order.spi interface, but not on OrderManagement for example."*

**That last clause is the powerful part.** `order :: spi` grants access to the SPI and
*denies* access to the module's ordinary API. A module that only needs to implement a hook
can be prevented, mechanically, from also calling the service. That is a genuinely finer
boundary than a package structure alone can express.

And the default when a module declares no dependencies at all:

> *"For modules without explicitly described dependencies, both the application module root
> package and the SPI one are accessible."*

So declaring a named interface widens what an *undeclared* module may reach. It only narrows
things for modules that opt into explicit dependency declarations —
[31 · Explicit allowed dependencies](11e-explicit-allowed-dependencies.md).

## The wildcard

> *"If you wanted to express that an application module is allowed to refer to all explicitly
> declared named interfaces, you can use the asterisk (`*`) as follows"*
>
> ```java
> @org.springframework.modulith.ApplicationModule(
>  allowedDependencies = "order :: *"
> )
> package example.inventory;
> ```

Useful when a module has several named interfaces and you do not want to enumerate them.
Note that `order :: *` covers the declared named interfaces; if you want the base package as
well, list `order` too.

## The Kotlin form, and why it matters even in Java

Kotlin has no `package-info.java`, so the annotations go on a type marked
`@PackageInfo`:

> ```kotlin
> package example.order.spi
>
> import org.springframework.modulith.PackageInfo
> import org.springframework.modulith.NamedInterface
>
> @PackageInfo
> @NamedInterface("spi")
> class ModuleMetadata {}
> ```

The same mechanism is available in Java, and it is occasionally the better choice: some
build setups and code-generation tools handle a regular class more predictably than
`package-info.java`, and a class is easier to find in an IDE than a file most developers
never open.

## Programmatic detection, for a convention across many modules

If every module should expose a package called `api`, declaring it 30 times is worse than
declaring the convention once:

> ```java
> class CustomApplicationModuleDetectionStrategy implements ApplicationModuleDetectionStrategy {
>
>  @Override
>  public Stream<JavaPackage> getModuleBasePackages(JavaPackage basePackage) {
>  // Your module detection goes here
>  }
>
>  @Override
>  NamedInterfaces detectNamedInterfaces(JavaPackage basePackage, ApplicationModuleInformation information) {
>  return NamedInterfaces.builder()
>  .recursive()
>  .matching("api")
>  .build();
>  }
> }
> ```
>
> *"In the detectNamedInterfaces(…) implementation shown above, we build up a NamedInterfaces
> instance for all packages named api underneath the given application module's base package.
> The Builder API exposes additional methods to select packages as named interfaces or
> explicitly exclude them from that."*

With an important note about what is always present:

> *"Note, that the builder will always include the unnamed named interface containing all
> public methods located in the application module's base package as that interface is
> required for application modules."*

So the base package is always an interface — the **unnamed** one — and named interfaces are
additions to it, never replacements. [34 · Module detection](11h-module-detection.md) covers
registering a custom strategy.

## Gotchas

**★ A named interface widens the module's surface, and the default grant is generous.** For
modules that have *not* declared explicit dependencies, both the base package and the SPI
package are accessible. So adding a named interface without also adopting explicit allowed
dependencies gives every module access to it. The narrowing only happens for modules that opt
in with `allowedDependencies`.

**★ `order :: spi` denies the base package, and that is the feature — but it will surprise
whoever wrote it.** A module declaring only `order :: spi` cannot call `OrderManagement` at
all. That is usually exactly right for a module that only implements a hook, and it will
produce a verification failure the first time someone adds an ordinary call. Say so in a
comment next to the declaration.

**★ The base package is always an interface and cannot be removed.** The builder always
includes the unnamed named interface containing the base package's public types. You cannot
declare a module that is *only* reachable through a named interface; if you want that, the
base package must contain nothing public.

**★ Named interfaces are for genuinely different exposure contracts, not for organising
code.** If you find yourself declaring `order :: reads`, `order :: writes` and
`order :: admin`, the module is probably three modules. Two is the number that is usually
justified — an API and an SPI — because they have opposite change-impact directions.

**★ `package-info.java` is invisible in practice.** Almost nobody opens it, IDEs hide it,
and some code-generation and build setups treat it inconsistently. An annotated
`@PackageInfo` class is functionally equivalent, discoverable in search, and easier to
comment. Either is fine; pick one convention and apply it everywhere.

**★ A convention repeated in thirty `package-info.java` files will drift.** If every module
exposes an `api` sub-package, express that once as a custom
`ApplicationModuleDetectionStrategy` overriding `detectNamedInterfaces`, rather than as
thirty annotations that somebody will forget on module thirty-one.

**★ Named interfaces do not change runtime behaviour at all.** Nothing is hidden at runtime;
this is purely a verification-time concept over ArchUnit's view of the bytecode. A
reflective lookup or a bean-by-name injection into a "denied" module will work fine and pass
verification — see [38 · What verification cannot see](12d-what-verification-cannot-see.md).

## Interview questions

**★ What is a named interface and what problem does it solve?**
By default a module's only legal entrance is its base package, so anything another module
needs must live there. A named interface annotates an additional package with
`@NamedInterface("someName")` — via `package-info.java` or a type annotated `@PackageInfo` —
making it a second, named entrance. The problem it solves is that a module often has two
kinds of exposure with opposite change semantics: an API that other modules call, where a
change breaks callers, and an SPI that other modules implement, where a change breaks
implementers. Putting both in one package makes them indistinguishable; naming them lets a
dependent module declare which one it uses, and lets verification enforce that.

**★ What does `allowedDependencies = "order :: spi"` permit and forbid?**
It permits the declaring module to reference types in `order`'s named interface called
`spi`, and it forbids everything else in `order` — including the base package, so
`OrderManagement` becomes unreachable from that module. That asymmetry is the point: a
promotions module that only implements an ordering hook can be mechanically prevented from
also calling ordering's service. If you want both, name both, or use the asterisk form
`"order :: *"` for all declared named interfaces plus `order` itself if the base package is
also needed.

**★ Does declaring a named interface make a module more or less encapsulated?**
Less, by default, and more only in combination with explicit allowed dependencies. The
reference states that for modules without explicitly described dependencies, both the base
package and the SPI package are accessible — so on its own, a named interface simply adds a
second legal entrance available to everybody. It becomes a narrowing tool when consuming
modules opt in with `@ApplicationModule(allowedDependencies = …)` and name which interface
they are permitted to use.

**★ How would you apply a named-interface convention across thirty modules?**
Not with thirty `package-info.java` files, because one will be forgotten and the drift is
invisible. Implement `ApplicationModuleDetectionStrategy` and override
`detectNamedInterfaces(JavaPackage, ApplicationModuleInformation)` to build a
`NamedInterfaces` from the convention — for example
`NamedInterfaces.builder().recursive().matching("api").build()` to treat every package named
`api` beneath a module base package as a named interface. Register the strategy through the
`spring.modulith.detection-strategy` property. Note that the builder always includes the
unnamed named interface for the base package, so the base package remains reachable
regardless.

{/* FOOTER */}
