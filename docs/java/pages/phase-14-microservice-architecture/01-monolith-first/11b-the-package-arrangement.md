---
title: "The whole module convention is one sentence — each direct sub-package of the main application package is a module — and in the simplest arrangement Java's own package scope, not any framework, is what stops one module reaching into another"
sidebar_label: "11b · The package arrangement"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Fundamentals* — "Simple
> Application Modules" and "The ApplicationModules Type"
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith **2.1.1**. **No sandbox** —
> the console output quoted below is reproduced from the reference documentation, not
> produced by running anything here.

**Spring Modulith's default convention has no annotations, no configuration and no
registry. The main application class's package is the root; every direct sub-package of it
is a module; and if that sub-package has no sub-packages of its own, everything public in it
is the module's API and everything package-private is genuinely unreachable — enforced by
javac, before any framework is involved.**

## The rule, verbatim

> *"The application's main package is the one that the main application class resides in.
> That is the class, that is annotated with `@SpringBootApplication` and usually contains the
> `main(…)` method used to run it. By default, each direct sub-package of the main package is
> considered an application module package."*

> *"If this package does not contain any sub-packages, it is considered a simple one. It
> allows to hide code inside it by using Java's package scope to hide types from being
> referred to by code residing in other packages and thus not subject to dependency injection
> into those. Thus, naturally, the module's API consists of all public types in the package."*

Read the middle sentence carefully. In a **simple** module, the enforcement is the Java
language. A package-private class in `com.acme.commerce.inventory` cannot be imported from
`com.acme.commerce.ordering`, cannot be a constructor parameter there, and — the clause
people miss — is *"not subject to dependency injection into those"*, because a type you
cannot name is a type you cannot ask for.

That is a strictly stronger guarantee than any verification test, because it is a compile
error rather than a test failure, and it costs nothing.

## The arrangement, as the docs draw it

> *"A single inventory application module"*
>
> ```
>  Example
> ╰─ src/main/java
>  ├─ example                      (1)
>  │ ╰─ Application.java
>  ╰─ example.inventory            (2)
>  ├─ InventoryManagement.java
>  ╰─ SomethingInventoryInternal.java
> ```
>
> *"(1) The application's main package example."*
> *"(2) An application module package inventory."*

Applied to the running commerce example:

```
src/main/java
└── com/acme/commerce
    ├── CommerceApplication.java            ← main package
    ├── catalogue/                          ← module
    ├── customer/                           ← module
    ├── inventory/                          ← module
    ├── ordering/                           ← module
    ├── payment/                            ← module
    ├── reporting/                          ← module
    └── shipping/                           ← module
```

Seven modules. No annotations. No configuration property. That is the whole setup.

## Public versus package-private inside a simple module

```java
// com/acme/commerce/inventory/InventoryManagement.java
package com.acme.commerce.inventory;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** PUBLIC — part of the module's API, callable from other modules. */
@Service
public class InventoryManagement {

    private final StockLedger ledger;                 // package-private type, fine here

    InventoryManagement(StockLedger ledger) {         // package-private constructor
        this.ledger = ledger;
    }

    @Transactional
    public void reserve(List<OrderLine> lines) {
        lines.forEach(line -> ledger.hold(line.sku(), line.quantity()));
    }
}
```

```java
// com/acme/commerce/inventory/StockLedger.java
package com.acme.commerce.inventory;

import org.springframework.stereotype.Component;

/** PACKAGE-PRIVATE — invisible outside com.acme.commerce.inventory. */
@Component
class StockLedger {

    void hold(Sku sku, int quantity) { /* … */ }
}
```

`StockLedger` is a Spring bean, it is injected into `InventoryManagement`, and no code in
`com.acme.commerce.ordering` can name it. Not by import, not by `@Autowired` field type, not
by constructor parameter. Note also that `InventoryManagement`'s **constructor** is
package-private: the class is part of the API but only Spring, and code in the same package,
can construct it.

**Design rule that falls out of this: make a type public only when another module needs it.**
The default for everything in a simple module is package-private, and the number of public
types in a module is a decent proxy for how large its API surface actually is.

## Reading the model back

The framework builds an in-memory model you can print, which is the fastest way to check
that your arrangement is what you think it is:

```java
var modules = ApplicationModules.of(CommerceApplication.class);
modules.forEach(System.out::println);
```

The reference shows the shape of that output:

> ```
> ## example.inventory ##
> > Logical name: inventory
> > Base package: example.inventory
> > Spring beans:
>  + ….InventoryManagement
>  o ….SomeInternalComponent
> ```
>
> *"Note how each module is listed, the contained Spring components are identified, and the
> respective visibility is rendered, too."*

The `+` and `o` markers are the visibility: exposed versus internal. A module whose listing
is all `+` has no internals, which usually means every type was made public reflexively.

## Excluding packages from the analysis

Generated code, a vendor package, a legacy area you are not ready to model:

> ```java
> ApplicationModules.of(Application.class, JavaClass.Predicates.resideInAPackage("com.example.db")).verify();
> ```

With the matcher syntax spelled out:

> *"com.example.db — Matches all files in the given package com.example.db."*
>
> *"com.example.db.. — Matches all files in the given package (com.example.db) and all
> sub-packages (com.example.db.a or com.example.db.b.c)."*
>
> *"..example.. — Matches a.example, a.example.b or a.b.example.c.d, but not a.exam.b"*

Note the trailing `..` is what makes it recursive — `com.example.db` alone does **not**
match `com.example.db.jpa`. That is the single most common mistake with these predicates.

## Gotchas

**★ Only *direct* sub-packages of the main package are modules by default.**
`com.acme.commerce.inventory` is a module; `com.acme.commerce.core.inventory` is not — it is
part of a module called `core`. If your codebase has an intermediate layer package such as
`domain`, `service` or `core` between the application class and the feature packages, the
default detection will find one module rather than seven, and every boundary you thought you
had is inside it.

**★ Layer-shaped packages produce layer-shaped modules, and the verification will happily
pass.** `com.acme.commerce.controller`, `.service`, `.repository` gives you three "modules"
that every feature crosses. Verification is a tool for enforcing a decomposition, not for
choosing one — it will enforce a bad one just as diligently.

**★ Package-private is a stronger guarantee than the verification test, and it costs
nothing, so use it first.** A type nobody outside the package can name cannot be imported,
cannot be injected and cannot be referenced reflectively without a string. The verification
test is the backstop for the cases where a type has to be public; it is not a substitute for
using package scope where you can.

**★ The moment a module gains a sub-package, its internals stop being protected by javac.**
Types that `…inventory.internal` needs to expose to `…inventory` must be public, which makes
them public to `…ordering` as well. That is the advanced arrangement and it is where the
verification test becomes load-bearing rather than merely helpful —
[29 · API and internal packages](11c-api-and-internal-packages.md).

**★ A package-matcher without a trailing `..` matches only that package, not its
sub-packages.** `resideInAPackage("com.acme.generated")` will not exclude
`com.acme.generated.jpa`, so an exclusion that looks correct silently excludes almost
nothing. Use `"com.acme.generated.."` when you mean the subtree.

**★ Printing the model is the cheapest sanity check available and almost nobody does it.**
`modules.forEach(System.out::println)` shows exactly which packages became modules and which
beans are exposed versus internal. Running it once, on day one, catches the intermediate-package
mistake and the everything-is-public mistake before either becomes load-bearing.

**★ A module with no package-private types is a module with no encapsulation, whatever the
verification says.** If every class is public because that was the IDE's default, then the
module's "API" is its entire implementation and verification only stops *other* modules
importing across the base package boundary. Count the `o` markers in the model output; a
module with none is a warning sign.

## Interview questions

**★ What is Spring Modulith's default module detection rule?**
The package containing the `@SpringBootApplication` class is the main package, and each
*direct* sub-package of it is an application module package. If such a package has no
sub-packages it is a "simple" module, and its API is exactly its public types — Java's own
package scope hides everything else, including from dependency injection, since a type
another package cannot name is a type it cannot request. There are no annotations and no
configuration involved in the default arrangement.

**★ Why is package-private a stronger guarantee than the verification test?**
Because it is enforced by the compiler at the point of the mistake rather than by a test that
runs afterwards. A package-private class cannot be imported, cannot appear as a parameter or
field type in another package, and cannot be injected there. There is no way to get a
violation past javac and into the repository. The verification test exists for the cases
where package scope cannot help — most importantly the advanced arrangement, where a module
has sub-packages and its internal types must be public in order to be used from the module's
own base package, which incidentally makes them visible to every other module too.

**★ Your team has `com.acme.commerce.core.inventory` and `com.acme.commerce.core.ordering`.
What does Spring Modulith see?**
One module, called `core`, with `inventory` and `ordering` as internal sub-packages of it —
because only direct sub-packages of the main package are modules by default. Every boundary
the team believes it has is inside a single module, so verification will pass while enforcing
nothing at all. The fixes are either to move the feature packages up to be direct
sub-packages of the application package, or to switch to the `explicitly-annotated` detection
strategy and annotate each feature package, or to declare nested modules. Printing the module
model once would have surfaced this immediately.

**★ How do you exclude generated code from the analysis, and what is the usual mistake?**
Pass an ArchUnit predicate to the factory method:
`ApplicationModules.of(Application.class, JavaClass.Predicates.resideInAPackage("com.acme.generated.."))`.
The usual mistake is omitting the trailing `..`, because `"com.acme.generated"` matches only
that exact package and not its sub-packages, so an exclusion that reads correctly excludes
almost nothing and the violations keep appearing. The same matcher syntax supports leading
wildcards, so `"..generated.."` matches the segment anywhere in the package name.

{/* FOOTER */}
