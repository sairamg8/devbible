---
title: "When two libraries collide"
sidebar_label: "03 · When two libraries collide"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the JAR File Specification for JDK 25
> (signature files, sealing, `META-INF/services`), the
> `java.util.ServiceLoader` and `java.sql.DriverManager` javadoc, the
> Apache Maven Shade Plugin 3.6.x documentation
> (`ServicesResourceTransformer`, `AppendingTransformer`,
> `ApacheNoticeResourceTransformer`, relocation, `minimizeJar`, filters),
> and the Maven Assembly Plugin's `metaInf-services` container descriptor
> handler.

**A flat merge is a copy into one namespace, and a zip archive has exactly
one entry per path. Every conflict below is that one sentence playing out
in a different corner of the archive: two classes at one path, two service
files at one path, two signature manifests describing entries that no
longer exist. The classpath tolerates all of it because a class loader
searches an ordered list of archives; a fat jar cannot, because there is
only one archive left.**

## 1. The same class in the same package, from two jars

`commons-logging` and a repackaged copy of it. `javax.annotation` from
three different artifacts. Two versions of the *same* library dragged in
by different transitive paths and never mediated away. The merge writes
both to the same path, so **one wins — whichever was processed last, which
follows the packaging order derived from the classpath** — and the other
is simply gone. Shade logs a duplicate-class warning. Nobody reads build
logs.

What you get at runtime is *not* `ClassNotFoundException`. The class is
present. It is the **wrong build** of the class, so you get
`NoSuchMethodError`, `AbstractMethodError`, `IncompatibleClassChangeError`
or a bare `LinkageError`, usually thrown from deep inside a library on a
code path that worked yesterday. See
[classloaders and the two errors](../../phase-0-platform-jvm/05-packages-classpath/03-classloaders-and-the-two-errors.md)
for why "present but wrong" produces a different error family from
"absent".

The tell is the asymmetry: **it works from the IDE and from `mvn
exec:java`, and fails from the packaged jar.** Those two runs have
different classpaths — one is an ordered list of jars where the winner is
found first and the loser is simply shadowed; the other is one archive
where the loser was overwritten.

The real fix is upstream. Settle the version with a BOM or an exclusion so
only one copy is ever resolved — **Transitive dependencies and mediation**
*(not written yet)* is where that decision lives. Shading is the fix only
when you genuinely need two incompatible versions to coexist in one
process, and then the tool is relocation, not luck.

## 2. `META-INF/services/` overwritten instead of merged

This is the canonical "two libraries collide inside one jar", and it is
worth being precise about.

Suppose the fat jar contains both PostgreSQL's and H2's JDBC drivers.
Each ships one file:

```
META-INF/services/java.sql.Driver
```

Same path, because the path is derived from the interface name. In a flat
jar there can be one file at that path, so whichever dependency the
packager wrote last is the file that survives. `ServiceLoader` — and
therefore `DriverManager` — now sees exactly **one** driver, and
`DriverManager.getConnection("jdbc:h2:mem:test")` fails with `No suitable
driver found`. From the same set of jars on a classpath, both worked,
because `ClassLoader.getResources()` returns *every* matching resource
rather than the first one.

The same shape hits everything built on `ServiceLoader`:

| Ecosystem | The file that gets lost | What you see |
|---|---|---|
| JDBC | `java.sql.Driver` | `No suitable driver found for jdbc:…` |
| SLF4J / Log4j2 | the provider/binding file | logging silently reverts to a no-op, or to the wrong backend |
| Jackson | `com.fasterxml.jackson.databind.Module` | `findAndRegisterModules()` misses `JavaTimeModule`; dates serialize as arrays |
| Servlet / Jakarta | `jakarta.servlet.ServletContainerInitializer` | half the framework never boots, with no error |
| NIO / scripting / time | `java.nio.file.spi.FileSystemProvider`, `javax.script.ScriptEngineFactory`, `java.time.zone.ZoneRulesProvider` | a provider you installed is simply not there |

The fix is one line, and it must be **configured** — it is not a default:

```xml
<transformer implementation="org.apache.maven.plugins.shade.resource.ServicesResourceTransformer"/>
```

It **appends** the provider entries from every jar into a single file at
that path. And — the half people miss — it also **rewrites the class names
inside those files** to match any relocation you configured. Without that
second half, a relocated provider is still listed under its old name and
`ServiceLoader` throws `ServiceConfigurationError: Provider … not found`.

The assembly plugin's equivalent is the `metaInf-services` container
descriptor handler, which is likewise off by default. If you are using
`jar-with-dependencies` with no handler configured, assume the service
files are wrong.

Other resources share the "must concatenate" property and need
`AppendingTransformer` or a framework-specific transformer:

- Typesafe Config's `reference.conf` — the reason Akka/Pekko fat jars
  famously fail with "No configuration setting found for key …".
- Spring's `spring.handlers`, `spring.schemas`, `spring.factories` and
  `META-INF/spring/aot.factories`.
- Netty's `META-INF/native-image/**` descriptors, and GraalVM
  reflection/resource configuration generally.
- `META-INF/LICENSE` and `META-INF/NOTICE` — merged with
  `ApacheLicenseResourceTransformer` / `ApacheNoticeResourceTransformer`,
  which exists because attribution is a legal obligation, not tidiness.

Every one of these is silently truncated to whichever jar was written
last. None of them fails the build.

## 3. Relocation moves the bytecode, not the strings

Relocation is the only real answer to "I need Guava 20 and Guava 33 in the
same process". It rewrites the package name in the class files **and** in
every constant-pool reference and resource path, so
`com.google.common.collect.ImmutableList` becomes
`com.acme.shaded.guava.collect.ImmutableList` everywhere the compiler
recorded it.

It cannot rewrite what the compiler never saw:

- `Class.forName("com.google.common.…")` where the name is a **string
  literal**, or worse, assembled at runtime from parts.
- Class names in configuration — Log4j2 plugin and appender declarations,
  Hibernate dialect names, JDBC driver class names in a properties file,
  Spring `@ComponentScan` base packages given as strings, JAXB
  `ObjectFactory` lookups.
- **JNI and native symbol names**, which encode the package directly in
  the C symbol; a relocated class can no longer find its native method.
- Resource lookups with a computed path, e.g.
  `getResource("/" + pkg.replace('.', '/') + "/messages.properties")`.
- Serialized forms, cached class-name tables, and anything downstream that
  matches on the old name — a log alert, a monitoring rule, a stack-trace
  grep in a runbook.

Shade's `<includes>`/`<excludes>` inside a `<relocation>` and the services
transformer cover the mechanical cases. The string cases you find in
production, usually at 3 a.m., because a relocated class *exists* — it is
only unreachable by the name someone wrote down.

State the standing costs too, even when relocation works: **stack traces
now name `com.acme.shaded.guava`**, so every search result about the real
library is one mental rename away, and your CVE scanner no longer
recognises the library at all — a relocated Log4j 2.14 is a log4shell you
cannot find by scanning the artifact.

`<minimizeJar>true</minimizeJar>` belongs in the same warning. It removes
classes with no *static* reference, which is precisely the set that
reflection, DI containers and `ServiceLoader` need. It is a size
optimisation that trades a measurable megabyte for an unmeasurable risk.

## Gotchas

**Symptom:** the app runs from the IDE and from `mvn exec:java`, but the fat jar fails with `NoSuchMethodError` inside a third-party class
**Cause:** two copies of that class were merged to one path; the packager kept the older one, and a class loader search order that used to shadow it no longer exists
**Fix:** list the archive and read shade's duplicate warnings to find it, then remove the extra copy upstream with an exclusion or a BOM — do not "fix" it by reordering dependencies

**Symptom:** `No suitable driver found for jdbc:…`, only when running the packaged jar
**Cause:** both drivers ship `META-INF/services/java.sql.Driver`; the flat jar kept one file at that path
**Fix:** add `ServicesResourceTransformer` (shade) or the `metaInf-services` handler (assembly) so provider files are appended rather than overwritten

**Symptom:** `ServiceConfigurationError: Provider com.x.Impl not found` appeared right after relocation was configured
**Cause:** the classes were relocated but the `META-INF/services` file still lists the pre-relocation names
**Fix:** `ServicesResourceTransformer` again — it renames inside the service files as well as merging them; a plain `AppendingTransformer` will not

**Symptom:** dates serialize as `[2026,8,19]` in production but as `"2026-08-19"` locally
**Cause:** `ObjectMapper.findAndRegisterModules()` is `ServiceLoader`; the packaged jar kept only one `com.fasterxml.jackson.databind.Module` file and `JavaTimeModule` was not the survivor
**Fix:** merge the service files, or stop relying on discovery and register modules explicitly — see [JSON with Jackson](../../phase-7-io-time-stdlib/05-json-jackson/README.md)

**Symptom:** a `Class.forName` in a config file throws `ClassNotFoundException` in the shaded build
**Cause:** relocation renamed the class in the bytecode but not in the string that names it
**Fix:** update the configuration to the relocated name, or exclude that package from relocation; treat every string-based class reference as a manual step

**Symptom:** GraalVM native-image or a Spring AOT build fails on the shaded jar with missing reflection metadata
**Cause:** `META-INF/native-image/**` and `META-INF/spring/aot.factories` are per-library resources at shared paths, and were overwritten rather than merged
**Fix:** add appending transformers for those paths, or do not shade an artifact you intend to AOT-compile

## Interview questions

**★ Two libraries in your fat jar both provide `META-INF/services/java.sql.Driver`. What happens, and why is it different from the classpath?**
On a classpath, `ClassLoader.getResources()` returns *every* matching
resource, so `ServiceLoader` reads both files and finds both drivers.
Inside one flat jar there is exactly one entry per path, so the packager's
last write wins and only one driver is discoverable — surfacing as `No
suitable driver found`. The fix is a resource transformer
(`ServicesResourceTransformer` in shade) that concatenates the provider
entries into one file and rewrites the class names in it when relocation
is in play.

**★ A fat jar throws `NoSuchMethodError` from inside a library. Walk through the diagnosis.**
`NoSuchMethodError` means the class was found and the member was not, so
it is a version mismatch, not a missing dependency. Two copies of that
class were merged and the wrong one survived. Diagnose by listing the
archive and by looking at the resolved dependency graph for two artifacts
that both contain that package — often the same library under two
coordinates (a repackaged or shaded fork). Fix upstream with an exclusion
or a BOM so only one is resolved; relocate only if both versions are
genuinely required.

**★ What does relocation actually change, and name three things it silently misses.**
It rewrites package names in the class files and in every constant-pool
reference and resource path, so two incompatible versions of a library can
coexist. It misses anything the compiler never recorded as a type
reference: class names in string literals or built at runtime for
`Class.forName`; class names in configuration files (Log4j2 plugins,
Hibernate dialects, Spring component-scan bases); and JNI/native symbol
names, which encode the package in the C symbol. `META-INF/services`
entries are a fourth, which is why the services transformer also renames.
Standing costs: unfamiliar stack traces and CVE scanners that no longer
recognise the library.

**★ Why is `minimizeJar` risky when the whole point is a smaller artifact?**
Because it computes reachability from static references only. Every class
loaded reflectively is invisible to that analysis: `ServiceLoader`
providers, Spring beans found by component scan, JPA entities, JDBC
drivers named in configuration, Jackson mixins. The build succeeds, the
artifact shrinks, and a code path nobody exercised in CI throws
`ClassNotFoundException` in production. If you use it, pair it with
explicit include filters for every reflectively-loaded package — at which
point you are maintaining a manual reachability list.


---

← Prev: [Fat jars: three strategies](02-fat-jars.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Signatures, sealing and modules](04-signatures-sealing-modules.md)
