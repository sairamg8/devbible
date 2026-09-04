---
title: "Java's package-private boundary stops at one flat package — the moment a bounded context needs sub-packages, javac gives up, Spring Modulith inverts the rule, and JPMS is the only mechanism that makes `public` mean anything at all"
sidebar_label: "24b · When one flat package is not enough"
sidebar_position: 36
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against *The State of the Module System*
> ([openjdk.org](https://openjdk.org/projects/jigsaw/spec/sotms/)); the Spring Modulith reference,
> *Fundamentals* ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html));
> the ArchUnit user guide ([archunit.org](https://www.archunit.org/userguide/html/000_Index.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[24 · Package structure is the boundary](24-package-structure-is-the-boundary.md) makes the case for one flat package per bounded context, and that case is sound until the context gets big. Then the structure that made the compiler your ally starts making the code unreadable, and every escape from it — a sub-package — silently deletes the protection you were relying on. This chunk is the ladder out: what javac actually guarantees, why Spring Modulith's rule for sub-packages is the exact inverse of Java's, and why JPMS is the only mechanism on the JVM under which `public` is a claim about who may call you rather than a claim about everybody.**

## The Java subpackage trap

A frequent mistake when transitioning to package-by-feature is introducing subpackages inside the feature:

```text
com.retailer.order
├── api
│   └── OrderPlacementApi.java
├── internal
│   ├── OrderPlacementService.java
│   ├── Order.java
│   └── OrderRepository.java
```

According to Java Language Specification §6.6.1, package-private access does not cross package boundaries. In Java, subpackages are strictly namespace conventions; `com.retailer.order.internal` is a completely separate package from `com.retailer.order`.

If `OrderPlacementService` in `.internal` implements `OrderPlacementApi` in `.api`, both the implementation and its internal dependencies must be declared `public` for the service to be instantiated and wired across packages. The moment you introduce technical subpackages, package-private encapsulation collapses and you recreate the problems of package-by-layer.

**So the language gives you one flat level of protection and no more.** That is the whole reason the
next three chunks exist. You have three ways out, and they buy different things:

| Mechanism | Enforced by | Granularity | Caught when |
|---|---|---|---|
| Package-private | **the compiler** | one flat package | you type the import |
| Spring Modulith / ArchUnit | a **test** | package trees, named interfaces, layers | the test runs |
| JPMS `exports` | **the compiler and the runtime** | whole modules | compile and launch |

### 🔴 Spring Modulith inverts the subpackage rule — do not carry this section's conclusion into it

Everything above is true of **javac**. It stops being the operative rule the moment you add Spring
Modulith, and this catches people who learned the flat-package discipline first. Modulith treats each
direct sub-package of the main package as a module, and then says the opposite of what Java says
about what is inside it:

> *"Internal Packages: Any sub-packages of the module base package — code cannot be referred to from
> other modules."*

**Under javac, `com.retailer.order.internal` is a stranger to `com.retailer.order` and its `public`
types are visible to the entire application. Under Modulith verification, that same package is the
one place a type can be public and still be private to the module.** The sub-package you were told
to avoid becomes the mechanism. The catch is where enforcement now lives: javac rejects the illegal
import at keystroke time, Modulith rejects it when a test runs. See
[25 · Verifying the boundary](25-verifying-the-boundary.md), and
[26 · ArchUnit rules](26-archunit-rules.md) for the same trick without Spring.

## The third rung: JPMS says `public` is not a promise

Package-private is a boundary the compiler enforces inside one package. JPMS is a boundary the
compiler and the runtime enforce around a whole module, and the specification states the consequence
in one sentence:

> *"Thus, even when a type is declared `public`, if its package is not exported in the declaration of
> its module then it will only be accessible to code in that module."*

That is the strongest in-process boundary available on the JVM, and it is the only one on this list
that survives reflection by default. It also costs the most to adopt, which is why
[27 · Build modules and JPMS](27-build-modules-and-jpms.md) treats it as the last rung rather than
the first — but it is worth knowing while you read the rest of this chunk that `public` has meant
"public **to my module**" since JDK 9, not "public to the world".

## Gotchas

**★ Symptom: Creating subpackages like `com.retailer.order.repository` forces repository interfaces to be declared `public`.**
Cause: Java subpackages do not inherit or share package-private visibility with parent packages.
Fix: Keep repository interfaces and entity definitions in the root feature package `com.retailer.order` alongside domain services, or enforce subpackage visibility rules using ArchUnit or Spring Modulith named interfaces.

**★ Symptom: the architecture test is green, and a test class is reaching straight into another module's aggregate.**
Cause: test sources compile into the same package namespace. `src/test/java/com/retailer/order/OrderHackTest.java`
is in `com.retailer.order` as far as javac is concerned and can touch every package-private type in
it — that is deliberate, and it is what makes package-private testing pleasant. It also means a
boundary violation can live in test code indefinitely.
Fix: this is what ArchUnit's importer flag is for. Scan production classes only, and add a second,
looser rule set for tests if you want them governed at all.
```java
@AnalyzeClasses(
    packages = "com.retailer",
    importOptions = {ImportOption.DoNotIncludeTests.class})
class BoundaryRulesTest { }
```

**★ Symptom: the package is flat and correct, and it now holds ninety files.**
Cause: flatness is a constraint imposed by javac's visibility rules, not a claim that the module is
small. A genuinely large bounded context in one flat package is uncomfortable to navigate, and the
discomfort is real rather than imagined.
Fix: this is the point at which you stop paying for javac's version of the boundary and start paying
for a verified one. Sub-package freely and let Spring Modulith or ArchUnit enforce what the compiler
now cannot — trading *when* a violation is caught (keystroke → test run) for how the code reads. Past
a certain size that trade is worth making.

**★ Symptom: a colleague "fixes" a compile error by declaring their class in your feature package.**
Cause: package-private is enforced by package **membership**, and package membership is owned by
nobody. Nothing in javac stops a second team declaring a class in `com.retailer.order` from a
completely different source tree.
Fix: package-private is a boundary against accident, not against intent. Anything that must hold
against a determined colleague needs a rule naming the package tree and its owner —
[26 · ArchUnit rules](26-archunit-rules.md) — or a JPMS module, where a package may be declared in
exactly one module and the compiler says so.

## Interview questions

**★ How does Java's treatment of subpackages affect modular design?**
Unlike languages where namespaces or modules provide hierarchical encapsulation, the Java Language Specification treats package names as entirely flat. The package `com.app.order.internal` has no special visibility privileges into `com.app.order`; they are treated as two unrelated packages. Consequently, creating subpackages within a module forces any class that needs to be accessed across those subpackages to be declared `public`, exposing it to the rest of the application as well. Architectural boundaries that span subpackages must therefore be guarded by external tooling such as ArchUnit, Spring Modulith, or the Java Platform Module System (JPMS).

**★ If package-private already enforces the boundary at compile time, why add Spring Modulith or ArchUnit?**
Because package-private buys exactly one flat package and nothing else. The moment a bounded context
is large enough to want sub-packages — and most real ones are — javac's protection evaporates,
because `com.retailer.order.internal` is an unrelated package to javac and its public types are
visible application-wide. Modulith and ArchUnit re-establish the boundary over a package *tree* and
add things the compiler has no concept of: cycle detection between modules, allow-lists of permitted
dependencies, and named interfaces exposing different APIs to different consumers. The cost is that
enforcement moves from keystroke time to test time.

**★ Java has had JPMS since 9. Why is package-private, not `module-info.java`, the default advice for drawing service boundaries in a monolith?**
Because the boundary you are drawing is provisional and JPMS is not. `module-info.java` gives the
strongest guarantee available — *"even when a type is declared `public`, if its package is not
exported … it will only be accessible to code in that module"* — and charges for it in build
restructuring, reflective-access declarations, and a dependency graph that must be right before
anything compiles at all. During decomposition the boundary still moves weekly. Package-private costs
one keystroke to change and gives most of the signal; JPMS is what you reach for once the boundary
has stopped moving, or when shipping a library whose internals must stay internal against reflection
as well as against imports.

**★ Your architecture tests are green and a class in another module is calling your repository. How?**
Three ways, in order of likelihood. The caller is a **test** class declared in your package and the
rules were imported with `DoNotIncludeTests`. The caller is in a **sub-package** of your module and
you assumed Java's flat package rule protects you when it does not. Or the type is reached
**reflectively** — by a serialiser, a mapper, or Spring itself — in which case no compile-time
mechanism short of JPMS was ever going to see it. Each has a different fix, so the first move is
finding out which one it is rather than tightening a rule at random.

---

← [Package structure is the boundary](24-package-structure-is-the-boundary.md) · [Topic index](README.md) · Next → [Verifying the boundary](25-verifying-the-boundary.md)
