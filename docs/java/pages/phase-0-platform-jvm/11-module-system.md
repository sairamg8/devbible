---
title: "The module system (JPMS)"
sidebar_label: "11 · Module system"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against JEP 261 (Module System), JEP 396/403 (strong
> encapsulation by default / permanently), the `jlink` tool reference in the
> JDK 25 documentation, and the JDK 25 API module index.

**The Java Platform Module System (Java 9) succeeded completely at its first
goal — modularizing the JDK itself — and largely failed at its second —
getting applications to adopt modules. The practical consequence: you will
probably never write a `module-info.java`, but you *will* meet JPMS as the
`--add-opens` flag in your run scripts, the `InaccessibleObjectException`
after a JDK upgrade, and the `jlink`-built slim runtime in a Docker image.**

## What a module is

A module is a jar with a `module-info.java` declaring what it needs and what
it shows:

```java
module com.acme.orders {
    requires java.sql;                  // I use JDBC types
    requires transitive com.acme.core;  // my users need this too
    exports com.acme.orders.api;        // only this package is visible
    opens com.acme.orders.model;        // reflection allowed here (frameworks)
    uses com.acme.spi.PaymentProvider;          // service consumer
    provides com.acme.spi.PaymentProvider
        with com.acme.orders.StripeProvider;    // service implementation
}
```

The two verbs that matter: **`exports`** grants *compile-time and runtime
access to public types*; **`opens`** additionally grants *deep reflection*
(setting private fields — what Hibernate, Jackson and Spring do). A package
that is neither exported nor opened is invisible even though its classes are
`public` — that is the "strong encapsulation" the system exists for.

## The half that worked: the JDK itself

The JDK is ~70 modules (`java.base`, `java.sql`, `jdk.compiler`, …). Two real
wins came from that:

- **Internal APIs became actually internal.** Code reaching into
  `sun.misc.*` or `jdk.internal.*` was cut off — first with warnings (9–15),
  then denied by default (16, JEP 396), then permanently, with the
  `--illegal-access` escape hatch itself removed (17, JEP 403). What remains
  is per-package opt-in via `--add-opens`.
- **`jlink`** can assemble a custom runtime containing only the modules an
  app needs — a smaller-footprint alternative to shipping a full JDK,
  used in slim container images (pairs with the Docker section of this
  bible).

## The half that didn't: application adoption

Most applications, including most Spring Boot services, run everything on the
**classpath**, where all code lands in one "unnamed module" that can read
everything — the pre-9 world, preserved. Why adoption stalled, honestly:

- **The benefit is small for an application.** Encapsulation between your own
  packages is enforced by review; the payoff (reliable configuration, jlink)
  rarely justified migrating a working build.
- **Split packages** — the same package in two jars — are illegal under JPMS
  and common in older dependency trees.
- **Automatic modules** (plain jars placed on the module path) were the
  migration bridge and brought naming instability and weak guarantees.
- Build-tool and framework friction throughout the 9–11 era set the culture;
  by the time tooling caught up, "classpath + strong JDK encapsulation" was
  the settled equilibrium.

Libraries adopted more than applications did — a well-behaved library today
ships a `module-info` (or at least an `Automatic-Module-Name` manifest entry)
so *modular* consumers can depend on it cleanly.

## Where JPMS reaches you anyway

1. **`InaccessibleObjectException` / `IllegalAccessError`** after a JDK
   upgrade — some library reflects into JDK internals that are no longer
   open. The fix that unblocks you is explicit opt-in, e.g.
   `--add-opens java.base/java.lang=ALL-UNNAMED`; the real fix is upgrading
   the library that needed it.
2. **`jlink` images** in Dockerfiles — a build stage produces a runtime with
   only the needed modules; `jdeps` is the tool that computes that module
   list from your jar.
3. **`--add-exports` in build scripts** for tools (annotation processors,
   agents) touching compiler internals.
4. Reading **stack traces** — module names appear as the
   `java.base/java.lang.String` prefix you have already seen.

## Gotchas

**Symptom:** `InaccessibleObjectException: Unable to make field private ... accessible: module java.base does not "opens java.lang"` after moving from Java 8/11 to 17+
**Cause:** a dependency deep-reflects into JDK internals; 16+ denies it by default and 17 removed the global `--illegal-access` escape
**Fix:** upgrade the offending library (the durable fix); until then, the targeted flag it names: `--add-opens java.base/java.lang=ALL-UNNAMED`

**Symptom:** the `--add-opens` flags work in the IDE but the container crashes with the same reflection error
**Cause:** the flags live in the IDE run configuration, not the deploy artifact's launch command
**Fix:** put them where production runs — `JAVA_TOOL_OPTIONS`, the `ENTRYPOINT`, or `Launcher-Agent`/manifest `Add-Opens` entries — and in exactly one agreed place

**Symptom:** migrating an app to the module path fails with "package X is read from two modules"
**Cause:** split packages — two jars claim the same package; legal on the classpath, illegal under JPMS
**Fix:** usually a signal to stay on the classpath; otherwise exclude/merge the offending jars (often `-api` and `-impl` twins)

**Symptom:** a library jar's module name changed between releases and modular consumers broke
**Cause:** it was an automatic module (name derived from the filename) and the project later declared a real `module-info` with a different name
**Fix:** library authors: declare `Automatic-Module-Name` early. Consumers: pin the new `requires` name — and note this is a modular-consumer problem only

**Symptom:** `jlink` refuses with "automatic modules cannot be used"
**Cause:** `jlink` requires every module in the graph to be *explicit*; any plain-jar dependency blocks it
**Fix:** either all-modular dependencies, or build the image for the *JDK modules only* (`jdeps --print-module-deps` to list them) and run the app from the classpath on that slim runtime — the common pattern in Dockerfiles

**Symptom:** `public` class in an exported jar is invisible to a modular consumer
**Cause:** its package isn't `exports`-ed — under JPMS, `public` alone no longer means globally visible
**Fix:** export the package in the library's `module-info`, or consume from the classpath where the old rules apply

## Interview questions

**★ Java 9 introduced modules — why do most applications still not use them?**
The migration cost (split packages, automatic-module churn, tooling friction)
exceeded the application-level benefit; the classpath remains fully
supported, so the ecosystem settled on "modular JDK, classpath apps".
Libraries adopted more than applications, and the JDK's own modularization
delivered the real wins — internal-API encapsulation and `jlink`.

**★ What does `--add-opens` do and when do you need it?**
It opens a named package of a named module for deep reflection to the given
target (commonly `ALL-UNNAMED`, i.e. the classpath). Needed when a dependency
reflects into JDK internals that Java 16+ encapsulates — typically seen after
a JDK upgrade with an older framework/agent version.

**★ What's the difference between `exports` and `opens`?**
`exports` makes a package's public types accessible at compile time and run
time. `opens` grants runtime *deep reflection* — access to private members —
which is what serialization frameworks and DI containers need. `opens`
without `exports` is common for entity/model packages.

**What is the unnamed module?**
Everything on the classpath lands in it. It can read all other modules, so
pre-modules code keeps working unchanged — the compatibility bridge that let
JPMS ship without breaking the world.

**What is `jlink` and what constraint does it impose?**
A tool that assembles a custom runtime image containing only specified
modules, shrinking container images. It requires explicit modules end-to-end
— in practice teams often use it just to slim the *JDK* portion (via `jdeps
--print-module-deps`) and keep the app on the classpath.

**What changed in Java 16 and 17 regarding internal APIs?**
16 (JEP 396) flipped the default from "warn" to "deny" for reflective access
to JDK internals; 17 (JEP 403) removed the `--illegal-access` global override
entirely, leaving only targeted `--add-opens`/`--add-exports`. This pair is
why "it ran on 11 but crashes on 17" almost always ends at a dependency
upgrade.

---

← Prev: [The standard library layout](10-stdlib-layout.md) · Next → [Java vs Kotlin vs the JVM ecosystem](12-java-vs-kotlin.md)
