---
title: "Splitting a tree: api, service, domain"
sidebar_label: "3 · Splitting a tree"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Maven POM reference
> (`<dependencyManagement>`, dependency scopes and transitivity), the Gradle
> 9.7 user manual (`settings.gradle(.kts)` `include`, the `java-library`
> plugin's `api` vs `implementation` configurations, composite builds via
> `includeBuild`, convention plugins in `buildSrc`), and the JDK 25
> documentation for the module system (`module-info.java`, `exports`,
> `requires`).

**A module split enforces exactly one thing: which *artifacts* a module may
depend on. That is genuinely valuable — "domain must not import the web
framework" stops being a review convention and becomes a compile error — but
it is also the whole of what you get. It does not restrict which packages
inside a depended-on artifact you may reach into, it does not make the full
build faster, and it costs you release coupling. Split when you can name the
invariant the split enforces; "it felt tidier" is not one.**

## The worked split

```
shop/
├── pom.xml            <packaging>pom</packaging>, aggregator + parent
├── shop-domain/       entities, value objects, rules — no framework
├── shop-service/      use cases, transactions, ports
└── shop-api/          HTTP controllers, DTOs, the runnable jar
```

**The dependency arrow points inward and never back out.**

```
api ──▶ service ──▶ domain
 └──────────────────▶  (api may see domain types directly)
```

`shop-domain` depends on nothing of yours and as little as possible of anyone
else's. `shop-service` depends on `shop-domain`. `shop-api` depends on
`shop-service`, and on `shop-domain` for the types it maps into DTOs.

```xml
<!-- shop-service/pom.xml -->
<parent>
  <groupId>com.example.shop</groupId>
  <artifactId>shop-parent</artifactId>
  <version>1.4.0-SNAPSHOT</version>
</parent>
<artifactId>shop-service</artifactId>

<dependencies>
  <dependency>
    <groupId>com.example.shop</groupId>
    <artifactId>shop-domain</artifactId>
    <!-- version supplied by the parent's dependencyManagement -->
  </dependency>
</dependencies>
```

The value is **enforcement**. In a single module, "domain must not import
`org.springframework`" is a review convention, and review conventions erode
under deadline pressure — one import at 5pm on a Friday, and the boundary is
gone with no record that it was ever a boundary. Split it out and the
*compiler* enforces it, because Spring is simply not on `shop-domain`'s
compile classpath. That is the whole argument for the split, and it is a good
one.

When someone eventually needs `domain` to call into `service`, they will be
tempted to add the dependency. The reactor stops them, loudly, before any
module compiles. The correct fixes are the ordinary ones: declare the
interface in `domain` and implement it in `service` (dependency inversion), or
extract the shared type into a fourth module below both. The pressure the
cycle-refusal creates is a feature — it is the split doing its job.

⚠️ **Maven's `compile` scope is transitive.** If `shop-service` declares
`shop-domain` at `compile` scope, `shop-domain`'s types land on
`shop-api`'s compile classpath too, whether or not `shop-api` declares it.
That is why "we split the modules and everything can still see everything" is
a recurring Maven complaint, and it is one of the few places Gradle is
structurally better (below).

## Maven modules are not JVM modules

A Maven module is a **build** unit: one POM, one artifact. A JPMS module is a
**compile-and-runtime encapsulation** unit: one `module-info.java`, explicit
`exports` and `requires`, enforced by `javac` and the JVM — see
[The module system (JPMS)](../../phase-0-platform-jvm/11-module-system.md).

They are orthogonal, and confused constantly because both are called
"module". Most enterprise Java is many Maven modules and zero
`module-info.java` files, running on the classpath, where JPMS encapsulation
does not apply at all.

The distinction has teeth. Maven's split enforces *which artifacts you may
depend on*; it says nothing about *which packages inside an artifact you may
import*. `shop-api` cannot see `shop-domain` unless something puts it on the
classpath — but once it is there, every `public` type in every package is
reachable, including the ones named `internal`. Closing that gap needs JPMS
`exports`, or an architecture test (ArchUnit) enforcing the same rule in CI.
It is the same point
[encapsulation and access modifiers](../../phase-2-classes-objects/02-encapsulation-access/README.md)
makes about `public` being a coarse instrument, one level up.

## Gradle's equivalent, briefly

Membership lives in `settings.gradle.kts`, not in the build file:

```kotlin
// settings.gradle.kts
rootProject.name = "shop"
include(":shop-domain", ":shop-service", ":shop-api")
```

```kotlin
// shop-service/build.gradle.kts
plugins { `java-library` }

dependencies {
    api(project(":shop-domain"))            // leaks to consumers, on purpose
    implementation("org.some:internal-lib")  // does not leak
}
```

Two things Gradle does differently and better here:

- **`api` vs `implementation` is a first-class distinction.** A dependency
  declared `implementation` is on this module's compile classpath and its
  consumers' *runtime* classpath, but not their compile classpath. Maven's
  `compile` scope always leaks, so the boundary you drew between `service` and
  `api` is only as strong as the discipline of not importing what happens to
  be visible. Note the flip side: `api(project(":shop-domain"))` above is the
  *correct* declaration when `shop-service`'s own method signatures expose
  domain types, and mislabelling it `implementation` produces compile errors
  in consumers that are genuinely confusing until you know the rule.
- **Composite builds** — `includeBuild("../shared-lib")` in settings —
  substitute a separate, independently released build into this one while you
  work on both, with no publishing step at all. Maven's nearest answer is
  `mvn install` into `~/.m2`, which is precisely the mechanism behind the
  stale-snapshot trap.

Shared build logic goes in convention plugins under `buildSrc/` or an included
build — Gradle's analogue of the parent POM, except that plugins compose and
single inheritance does not.

## When it is worth it, and when it is premature

**Worth it when:**

- You can name an invariant the split enforces — the `domain` case above.
- Parts of the tree have genuinely different dependency sets and you want the
  slim one to *stay* slim (a shared library consumed by others, a CLI that
  must not drag in a servlet container).
- Several deployables share code that does not justify its own repository and
  release cycle.
- Most changes touch one module, so `-pl … -amd` — or Gradle's up-to-date
  checks and build cache — turn a full build into a partial one.

**Premature when the boundaries are guesses.** A module split is far harder to
move than a package split: renaming a package is an IDE refactor, moving a
type across modules is a dependency-direction decision that may not have a
legal answer. Wrong boundaries calcify into an import graph nobody volunteers
to unpick. If a package convention plus review is actually holding today, it
is holding.

**The costs, honestly, all four:**

1. **The full build gets slower.** Each module pays fixed overhead — plugin
   setup, jar packaging, a forked test JVM — and parallelism cannot cross a
   dependency edge. `-pl`/`-amd` help only when you are *not* building
   everything, and CI on the main branch usually is.
2. **Release coupling.** One version for the whole tree means a change to
   `domain` bumps `api`'s version though nothing in `api` changed, and every
   artifact is rebuilt and redeployed. The alternative — independently
   versioned modules — hands you an internal compatibility matrix and a manual
   upgrade order. Most teams take one version for everything, and should; just
   know what was bought.
3. **"It keeps refactors atomic" is an argument about repositories, not
   modules.** A rename across three modules in one repo is one commit — but so
   is a rename inside one module. This point is quoted in favour of
   multi-module far more often than it actually applies to it; what it really
   argues against is splitting into three *repositories*.
4. **Tooling friction that exists only because the tree is split** — stale
   reactor state, a module resolving a published snapshot instead of its
   sibling, `-pl` without `-am`, IDE reimports, and a build file per module to
   keep consistent.

**The rule of thumb: split when you can name the invariant the split
enforces, and write that invariant down where the next engineer will find it.**

## Gotchas

**Symptom:** `shop-api` imports `com.example.shop.service.internal.*` and nothing stops it
**Cause:** Maven enforces artifact-level dependencies only; every `public` type in a depended-on artifact is reachable
**Fix:** this is what JPMS `exports` — or an ArchUnit rule in CI — is for. The module split alone was never going to enforce package-level boundaries

**Symptom:** `shop-api` compiles against a class from `shop-domain` that it never declared a dependency on
**Cause:** Maven's `compile` scope is transitive, so `shop-service`'s dependency on `shop-domain` is on `shop-api`'s compile classpath too
**Fix:** declare what you use explicitly (maven-dependency-plugin's `analyze` goal flags used-but-undeclared), and treat the transitive visibility as an accident rather than a contract; on Gradle, use `implementation` so the leak does not happen at all

**Symptom:** on Gradle, consumers of `shop-service` suddenly fail to compile against domain types after a "cleanup" commit
**Cause:** a `project(":shop-domain")` dependency was changed from `api` to `implementation`, but `shop-service`'s own method signatures still expose domain types
**Fix:** a dependency whose types appear in your public signatures is `api` by definition; `implementation` is for what you use internally

**Symptom:** a one-line fix in `shop-domain` forces a version bump, rebuild and redeploy of every artifact in the tree
**Cause:** the tree shares one version — the normal and usually correct choice
**Fix:** accept it, or move to independent module versions and accept the compatibility matrix instead. There is no option without a cost; pick the one whose cost your team can carry

**Symptom:** the split went in, and the CI build time went *up*
**Cause:** fixed per-module overhead (plugin setup, packaging, forked test JVMs) plus serialisation across dependency edges; a full build has more work and less parallelism than before
**Fix:** expect this. The payoff of a split is enforcement and partial builds on feature branches, not a faster full build — and if you cannot point at the enforcement, the split was not worth it

**Symptom:** two years on, nobody can move a class out of `shop-service` because everything depends on it
**Cause:** the boundary was drawn by guesswork, and module boundaries are much harder to move than package boundaries
**Fix:** none that is cheap — which is the argument for splitting late, on an invariant you can articulate, rather than early on an intuition

**Symptom:** working on a shared library and the consuming app means `mvn install`, switch repo, rebuild, repeat
**Cause:** the two are separate builds and Maven's only handoff between them is the local repository
**Fix:** on Gradle, a composite build (`includeBuild`) substitutes the library's project for the published artifact directly. On Maven, temporarily aggregating both under one reactor is the nearest equivalent — and the reason to keep `mvn install` snapshots suspect

## Interview questions

**★ A Maven module and a JPMS module — is one implied by the other?**
Neither implies the other. A Maven module is a build unit producing one
artifact from one POM; a JPMS module is an encapsulation unit declared by
`module-info.java` and enforced by `javac` and the JVM. Most enterprise Java
is many Maven modules and zero JPMS modules on the classpath. Maven enforces
which *artifacts* you may depend on; it places no restriction on which
packages inside them you may import. Only JPMS `exports` — or an architecture
test — does that.

**★ Talk me out of splitting our service into `api`/`service`/`domain`.**
Ask which invariant the split enforces that a package convention does not. If
the answer is "domain must not see the web framework", it is worth it: the
compiler enforces that permanently and review does not. If the answer is "it
looks cleaner", the costs arrive without the benefit — a slower full build
from fixed per-module overhead with no parallelism across dependency edges,
release coupling if you keep one version for the tree or a compatibility
matrix if you do not, and a boundary far harder to move later than a package
is. And "it keeps refactors atomic" is an argument against separate
repositories, not an argument for modules.

**★ `api` vs `implementation` in Gradle, and what is Maven's equivalent?**
`api` puts the dependency on consumers' compile classpaths; `implementation`
puts it only on their runtime classpath. The rule is mechanical: if the
dependency's types appear in your public signatures it is `api`, otherwise
`implementation`. Maven has no equivalent — `compile` scope always leaks
transitively — so the nearest approximations are declaring everything you use
explicitly and letting `dependency:analyze` catch what you did not, or
enforcing it with a banned-dependency rule.

**★ Someone adds a dependency from `domain` to `service`. What happens, and what is the right fix?**
The reactor's graph gains a cycle, so it cannot be topologically sorted and
Maven refuses the build before compiling anything — a hard stop, not a
warning. The right fix is dependency inversion: declare the interface
`domain` needs *in* `domain`, and implement it in `service`, so the arrow
still points inward. If the shared thing is a type rather than a behaviour,
extract it into a module below both. What is never right is merging the
modules back to make the error go away.

---

← Prev: [Aggregator, parent and the reactor](02-multi-module-and-the-reactor.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Versioning, updates and CVE scanning](../07-versioning-updates-cve/README.md)
