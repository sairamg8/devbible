---
title: "Boundaries at scale"
sidebar_label: "3 · Boundaries at scale"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8.4.8.3 (requirements in
> overriding), §6.6 (access control), JEP 409 (sealed classes), and the JDK
> 25 documentation on JPMS `exports` directives.

**Above the single class, Java gives you three walls: the package (free,
compiler-enforced, universally available), the module (`exports` — the wall
around whole package trees), and the sealed hierarchy (the wall around
*who may subtype*). Inheritance is where access rules get their one
asymmetry — widen, never narrow — and package design is where
package-private stops being trivia and becomes architecture.**

## Access in inheritance: widen, never narrow

An override may make a member **more** accessible, never less
(JLS §8.4.8.3): `protected` → `public` is legal, `public` → `protected` is a
compile error. The reason is substitutability — code holding a supertype
reference was promised `public` access, and a subclass cannot revoke a
promise the supertype made. Interfaces are the boundary case: their methods
are implicitly `public`, so every implementation must declare its overrides
`public` — the `attempting to assign weaker access privileges` error when
the keyword is forgotten.

Widening is one-way and permanent: publish an override as `public` on the
subtype and that accessibility is now part of the subtype's API. Widen
deliberately, not because the IDE offered it.

## The package as a module: design with package-private

Cross-package visibility in Java has exactly one member-level lever —
`public`. So the *package layout* is the encapsulation boundary, and the
package-private default is the architecture tool:

```
com.shop.billing
├── BillingService.java        // public  — the feature's surface
├── InvoiceNumbering.java      // (none)  — internal collaborator
├── TaxTableLoader.java        // (none)  — internal collaborator
└── LedgerWriter.java          // (none)  — internal collaborator
```

One package per feature; one or two public types as the surface; everything
else package-private. The compiler now stops outside callers from reaching
the internals — no framework, no convention document, no review vigilance
required. This dies when packages are laid out by *layer*
(`controllers`, `services`, `repositories`): every class then needs `public`
to talk across layers, and the modifier stops encoding anything. Feature
packages are what make package-private worth having.

Tests ride the same boundary: a test class in the same package (under
`src/test`) sees package-private members — deliberate white-box access
without opening the production API.

## When the package isn't enough: JPMS `exports`

Package-private guards *inside* a package; it cannot stop another team from
importing your `public` surface types across the repository. At scale, the
module system is the stronger wall: a `module-info.java` `exports` only the
packages that are API, and every unexported package's `public` types are
inaccessible outside the module — `public` stops meaning "everyone" and
starts meaning "everyone I export to". Most applications stay on the
classpath and never write one ([the module
system](../../phase-0-platform-jvm/11-module-system.md)); the design habit
transfers anyway: know, per package, whether it is surface or internals —
then the day you do adopt modules (or a build-tool enforcement like
ArchUnit rules), the boundary already exists.

## Sealed types: access control over *subtyping*

Access modifiers control who may *call*; `sealed` controls who may
*extend* — the third axis of boundary design (JEP 409):

```java
public sealed interface PaymentResult
        permits Approved, Declined, Failed { }
```

A `public sealed` type is callable by everyone and extendable by no one
outside its `permits` list. That closes the extension surface the way
`private` constructors close the construction surface — and it is what
makes exhaustive `switch` over the hierarchy possible
([sealed types as ADTs](../09-sealed-adts.md)). The related lightweight
lever: a class with only `private` or package-private constructors is
already unextendable from outside, sealed-in-effect without the keyword —
`sealed` adds the compiler-checked, self-documenting `permits` contract.

## Choosing the wall — a decision table

| You want to stop… | Use |
|---|---|
| callers touching a member | `private` / package-private member |
| other packages using a type | package-private top-level type, feature packages |
| other *modules* using a public type | JPMS — don't `exports` the package |
| anyone constructing except you | `private` constructor + static factory |
| anyone subclassing | `final`, or `sealed` + `permits` for a controlled set |
| subclasses narrowing your contract | nothing needed — the compiler already forbids it |

## Gotchas

**Symptom:** compile error `attempting to assign weaker access privileges` on an interface implementation
**Cause:** interface methods are implicitly `public`; the implementing class omitted the modifier, defaulting to package-private — a narrowing
**Fix:** declare the implementation `public`

**Symptom:** widening an override to `public` worked, but callers using the subclass type now bypass the "protected" design
**Cause:** widening is legal and one-way — once published `public` on the subtype, that accessibility is part of its API forever
**Fix:** widen deliberately; it is an API commitment, not a local convenience

**Symptom:** the "internal" class in another package is public and now external teams import it
**Cause:** cross-package visibility has only one lever, `public` — package layout *is* the encapsulation boundary
**Fix:** co-locate the feature in one package and make internals package-private; at scale, JPMS `exports` is the stronger wall ([the module system](../../phase-0-platform-jvm/11-module-system.md))

**Symptom:** layer-based packages (`controllers/`, `services/`) force every class `public`; access modifiers have stopped meaning anything
**Cause:** the package boundary crosses every call path instead of enclosing a feature
**Fix:** package by feature; the layers live as classes inside it, mostly package-private

**Symptom:** a hierarchy meant to be closed keeps growing subclasses in other teams' code
**Cause:** the base type is `public` with an accessible constructor — extension was never restricted
**Fix:** `sealed` with an explicit `permits` list (or `final` if no subtypes belong); switches over the hierarchy become exhaustively checkable too

**Symptom:** module adopted, and `public` utility types other teams relied on vanished from their compile
**Cause:** their package was never `exports`-ed — JPMS turned "public to all" into "public to importers of exported packages"
**Fix:** decide package by package what is API; export those, and treat the breakage list as the true coupling map

## Interview questions

**★ Can an override reduce visibility? Why not?**
No — compile error. Substitutability: through a supertype reference the
member was promised at the supertype's access level; a subtype narrowing it
would break code that never mentions the subtype. Widening is allowed, and
is a one-way API commitment.

**★ When is package-private the right choice?**
For everything inside a feature package that isn't the feature's public
surface: implementations behind an interface, helpers, internal DTOs. It is
Java's zero-cost module system — and the discipline JPMS later formalized.
It only pays off with feature-shaped (not layer-shaped) packages.

**★ How do packages, modules and sealed types divide the boundary work?**
Packages hide members and types from other packages (one keywordless
level); modules hide whole packages' `public` types from other modules
(`exports`); sealed types close the *subtype* set independently of who can
call. Call-access, package-access, extension-access — three orthogonal axes.

**★ Why does `sealed` belong in an access-control discussion?**
It restricts an operation modifiers can't reach: extension. `public sealed`
is "use freely, extend never (outside `permits`)" — the same shape as a
private constructor restricting construction, formalized and
compiler-checked, and the precondition for exhaustive switches
([sealed ADTs](../09-sealed-adts.md)).

**How do you make a class unextendable without `final` or `sealed`?**
Give it only `private` (or package-private) constructors — no accessible
`super(...)` means no subclass can compile outside the class/package. Static
factories then carry construction. `sealed` says the same thing louder and
lets *chosen* subclasses exist.

**Same-package tests seeing package-private members — feature or smell?**
Feature, used consciously: white-box tests co-located with the package under
test. Put contract tests in a *different* package on purpose, so they can
only exercise the public surface.

---

← Prev: [Designing with access](02-designing-with-access.md) · Index: [Encapsulation and access](README.md) · Next → [Inheritance](../03-inheritance/README.md)
