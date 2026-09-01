---
title: "The moment a module needs sub-packages, its internal types have to be made public so the module can use them itself — which makes them public to every other module too, and that is the exact hole the verification test exists to close"
sidebar_label: "11c · API and internal packages"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Fundamentals* — "Advanced
> Application Modules"
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)) —
> and *Verifying Application Module Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith **2.1.1**. **No sandbox.**

**A simple module is protected by the Java language. As soon as it grows sub-packages, that
protection evaporates — not because Spring Modulith weakens it, but because Java's
visibility model has no "visible to my sub-packages only". The advanced arrangement is where
almost every real module ends up, and it is precisely why an architecture test is not
optional decoration.**

## The problem, stated by the documentation itself

> *"If an application module package contains sub-packages, types in those might need to be
> made public so that it can be referred to from code of the very same module."*

And the resulting convention:

> *"In such an arrangement, the order package is considered an API package. Code from other
> application modules is allowed to refer to types within that. order.internal, just as any
> other sub-package of the application module base package, is considered an internal one.
> Code within those must not be referred to from other modules."*

Then the sentence that is the entire justification for the verification test:

> *"Note how SomethingOrderInternal is a public type, likely because OrderManagement depends
> on it. This unfortunately means that it can also be referred to from other packages such as
> the inventory one. In this case, the Java compiler is not of much use to prevent these
> illegal references."*

**"The Java compiler is not of much use to prevent these illegal references."** That is the
gap. Java has no package-tree visibility, so a type used across a package boundary within
one module is public to the entire application.

## The layout

> ```
>  Example
> ╰─ src/main/java
>  ├─ example
>  │ ╰─ Application.java
>  ├─ example.inventory
>  │ ├─ InventoryManagement.java
>  │ ╰─ SomethingInventoryInternal.java
>  ├─ example.order
>  │ ╰─ OrderManagement.java
>  ╰─ example.order.internal
>  ╰─ SomethingOrderInternal.java
> ```

The rule in one line: **the module's base package is its API; every sub-package is
internal.** Not by naming convention — the package does not have to be called `internal`.
`com.acme.commerce.ordering.persistence` and `com.acme.commerce.ordering.web` are just as
internal as `com.acme.commerce.ordering.internal`.

## Applied to the running example

```
com/acme/commerce/ordering/
├── OrderManagement.java            ← public, API
├── OrderPlaced.java                ← public, API (an event is part of the provided interface)
├── OrderId.java                    ← public, API (appears in the API's signatures)
├── internal/
│   ├── OrderRepository.java        ← public (OrderManagement needs it), INTERNAL by convention
│   ├── OrderEntity.java            ← public, INTERNAL
│   └── PricingCalculator.java      ← public, INTERNAL
└── web/
    └── OrderController.java        ← public, INTERNAL — nothing should call a controller
```

Every type in `internal/` and `web/` must be `public` for `OrderManagement` to use them.
Every one of them is therefore importable from `com.acme.commerce.inventory`, and javac will
not say a word. The only thing standing between you and
`import com.acme.commerce.ordering.internal.OrderRepository;` in the inventory module is:

```java
ApplicationModules.of(CommerceApplication.class).verify();
```

which the reference describes as rejecting exactly this:

> *"Efferent module access via API packages only — all references to types that reside in
> application module internal packages are rejected."*

## The API-surface discipline this implies

Because everything in the base package is API, the base package should be small and
deliberate. A useful target for a module's base package:

1. **One or two service types** — the module's provided interface as beans.
2. **The events it publishes.**
3. **The value types that appear in those signatures** — `OrderId`, `Money`, `Sku`.
4. **Nothing else.** No entities, no repositories, no controllers, no DTOs used only by its
   own web layer.

Two specific things that should never be in a module's base package:

**Entities.** A JPA entity in the API package means other modules can hold a reference to a
managed entity, navigate its associations, and — worst — write to it outside your
transaction boundary. It also guarantees that extracting the module later requires changing
every caller, because the entity is the thing that cannot cross a wire. Put entities in
`internal/` and expose records or interfaces.

**Repositories.** A `public interface OrderRepository extends JpaRepository<…>` in the base
package is an open invitation for another module to query your data directly. Spring Data
repositories must be public to be proxied usefully within the module, so put them in an
internal sub-package where they are public-but-internal, and let verification stop the
misuse.

## The extraction argument

This arrangement is the one that decides whether a future extraction is mechanical or a
rewrite. If the ordering module's API is three types and an event, extracting it means
implementing those three types over HTTP or a broker. If its API is fourteen types including
two JPA entities and a repository interface, the extraction is a redesign of every caller.

**A concrete, cheap metric: count the public types in each module's base package.** Track it
over time. A module whose base package is growing is a module whose extraction cost is
growing, and unlike almost everything else in this topic it is a number you can put on a
dashboard.

## Gotchas

**★ Sub-packages force types public, and javac then offers no protection at all.** This is
stated in the reference in as many words. The advanced arrangement is where nearly every
non-trivial module ends up, so the verification test is not a nicety for large codebases —
it is the only enforcement that exists the moment a module has more than one package.

**★ "Internal" is a position, not a name.** Any sub-package of the module base package is
internal, whether it is called `internal`, `persistence`, `web`, `jpa` or `impl`. Teams
sometimes believe only a package literally named `internal` is protected and then put
`ordering.repository` in the API by accident — it is not in the API, and referencing it from
another module will correctly fail.

**★ A JPA entity in a module's API package is the single most damaging thing you can put
there.** Other modules can hold managed references, navigate lazy associations outside a
transaction, and mutate state your module believes it owns. It also makes extraction
impossible without changing every caller, because an entity is exactly the thing that cannot
be sent over a wire. Entities belong in an internal sub-package, always.

**★ A public Spring Data repository in the base package invites another module to query your
tables.** Verification will not stop it, because the reference is to a type in your API
package, which is legal. Keep repositories in an internal sub-package so the same reference
becomes a violation.

**★ Making a type public "just to write a test" quietly widens the API.** Tests live in the
same package tree, so a test in `com.acme.commerce.ordering` can already see
package-private types in that package. Reaching for `public` to satisfy a test in a
*different* package is a signal that the test is in the wrong place, not that the type
should be exposed.

**★ The count of public types in a module's base package is a free extraction-cost metric,
and it only moves in one direction unless you watch it.** Three types and an event is a
module you can extract in a sprint; fourteen types including entities is a module you
cannot extract at all. Print it in CI.

**★ Constructors matter as much as classes.** A public class with a public constructor can
be instantiated anywhere, bypassing whatever the module's service layer guarantees. Make
API classes public with package-private constructors where the intended construction path is
through a factory or Spring, and use static factory methods for value types.

**★ Records in the API are not automatically safe.** A public record that embeds an entity,
a mutable collection or a domain type from `internal/` re-exports whatever it contains.
Check the *transitive* surface of every type in the base package, not just the type itself —
this is the same discipline as not returning `List<InternalThing>` from a public method.

## Interview questions

**★ Why does the advanced arrangement need a verification test when the simple one does
not?**
Because Java has no package-tree visibility. In a simple module — one package, no
sub-packages — everything that is not part of the API can be package-private and javac
prevents any other module from naming it. As soon as a module has sub-packages, types in
those sub-packages must be public so the module's own base package can use them, and public
means public to the entire application. The reference says exactly this: the compiler is not
of much use in preventing these illegal references. The verification test is the only
mechanism that rejects a reference into another module's internal packages.

**★ Which packages count as internal?**
Every sub-package of the module's base package, regardless of its name. The base package
itself is the API; `ordering.internal`, `ordering.web`, `ordering.persistence` and
`ordering.impl` are all internal in exactly the same way. The convention is positional
rather than nominal, which surprises teams who assume only a package literally called
`internal` is protected.

**★ What should and should not be in a module's base package?**
Should: the module's service beans, the events it publishes, and the value types appearing
in those signatures — identifiers, money, quantities. Should not: JPA entities, repositories,
controllers, and any DTO used only by the module's own web layer. An entity in the API
package lets other modules hold managed references and mutate state outside your transaction
boundary, and it makes extraction impossible without changing every caller since an entity
cannot cross a wire. A public repository there is an invitation to query your tables
directly, and verification cannot object because the reference is legal.

**★ Give a metric that predicts how hard a module will be to extract.**
The number of public types in its base package, tracked over time. That set is exactly what
another service would have to reimplement as a remote API, so three types plus an event is a
module you can extract in a sprint and fourteen types including entities and a repository is
one you cannot extract without redesigning every caller. It is objective, it costs nothing —
you can compute it from the module model or with a build-time check — and it only ever grows
unless someone is watching it.

{/* FOOTER */}
