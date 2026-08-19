---
title: "Jar anatomy"
sidebar_label: "08 · Jar anatomy"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the JAR File Specification for JDK 25
> (docs.oracle.com/en/java/javase/25/docs/specs/jar/jar.html — manifest
> format, `Main-Class`, `Class-Path`, sealing, signature files,
> `META-INF/services`), the JDK 25 `java` and `jar` tool reference, JEP 238
> (Multi-Release JAR Files), JEP 261 (`Automatic-Module-Name`), JEP 472
> (`Enable-Native-Access` as a manifest attribute), the Apache Maven Shade
> Plugin 3.6.x documentation (relocation, resource transformers,
> `ServicesResourceTransformer`), the Maven Assembly Plugin
> `jar-with-dependencies` descriptor, and the Spring Boot reference
> documentation on the executable jar format (nested jars, `JarLauncher`,
> `layers.idx`, the `tools` jar mode introduced in 3.3).

**A jar is a zip file with a `META-INF/` directory, and every property you
think of as belonging to the jar — "it is runnable", "it is a module", "it
is signed", "it provides a `ServiceLoader` implementation" — is really a
short text file inside that directory. A fat jar merges the `META-INF/`
trees of fifty libraries into one, and merging is where those text files
collide: same path, one file, last writer wins. That is not an exotic
failure. It is the single most common reason a fat jar behaves differently
from the classpath it was built from.**

## The chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The format](01-the-format.md)** | The zip layout, the `MANIFEST.MF` attributes that carry weight and the format's sharp edges, why `java -jar` ignores `-cp`, `META-INF/services/` and how `ServiceLoader` reads it, multi-release jars and the ways they are lost |
| 2 | **[Fat jars: three strategies](02-fat-jars.md)** | maven-shade-plugin vs maven-assembly-plugin vs the Spring Boot repackager, a real shade configuration, why Boot nests instead of flattening, layered jars for containers, and when not to build one at all |
| 3 | **[When two libraries collide](03-the-collision.md)** | Duplicate classes and last-one-wins, `META-INF/services` overwritten instead of merged, what relocation rewrites and what it silently misses, `minimizeJar` |
| 4 | **[Signatures, sealing and modules](04-signatures-sealing-modules.md)** | Signed jars and the digest that no longer matches, package sealing, `module-info.class` and the lost `Automatic-Module-Name`, and reading a suspect artifact |

## Why this runs to four chunks

The topic looks like trivia — "a jar is a zip" — and then every production
packaging incident traces back to one of its details. The `META-INF/`
contents are a small, closed set of conventions, but they are the exact
things a fat-jar build has to merge, and the merge has no correct default.
Chunks 3 and 4 are the payload: two pages on the collision, because `No
suitable driver found` from a jar that worked on the classpath is the
canonical "I do not understand my own artifact" bug — and because the
metadata collisions (signature, sealing, module descriptor) are each fixed
by deleting a guarantee, which deserves to be said out loud rather than
copied from a Stack Overflow answer.

## Where this connects

- **[Phase 0 · The classpath](../../phase-0-platform-jvm/05-packages-classpath/02-the-classpath.md)**
  — a jar is one classpath entry; a fat jar is an attempt to make it the
  only one.
- **[Phase 0 · Classloaders and the two errors](../../phase-0-platform-jvm/05-packages-classpath/03-classloaders-and-the-two-errors.md)**
  — `NoClassDefFoundError` vs `ClassNotFoundException` is how a broken jar
  announces itself; Spring Boot's nesting works by supplying its own loader.
- **[Phase 0 · The module system](../../phase-0-platform-jvm/11-module-system.md)**
  — `module-info.class` and `Automatic-Module-Name` are jar contents, and
  both are casualties of flattening.
- **[Phase 7 · JSON with Jackson](../../phase-7-io-time-stdlib/05-json-jackson/README.md)**
  — `findAndRegisterModules()` is `ServiceLoader`, so Jackson is where the
  services collision usually shows up first.
- [Transitive dependencies and mediation](../03-transitive-and-mediation/README.md) — the
  duplicate class that a fat jar exposes was already on the classpath;
  mediation is where it should have been settled.
- **Phase 12 · Delivery, packaging and containers** *(not written yet)* —
  layered jars and container image caching.

---

← Prev: [Versioning, updates and CVE scanning](../07-versioning-updates-cve/README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [The format](01-the-format.md)
