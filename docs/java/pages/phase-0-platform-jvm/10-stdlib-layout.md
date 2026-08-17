---
title: "The standard library layout"
sidebar_label: "10 · Stdlib layout"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the JDK 25 API documentation
> ([docs.oracle.com/en/java/javase/25/docs/api/](https://docs.oracle.com/en/java/javase/25/docs/api/))
> and its module index — the module → package structure below is read directly
> from it.

**The standard library is organized as modules containing packages, and
`java.base` — the module every program depends on implicitly — holds nearly
everything you touch daily: `java.lang`, `java.util`, `java.io`, `java.time`.
You do not memorize the library; you learn the map, and you make the Javadoc
the first tab you open, not the last.**

## The map: what lives where

The daily packages, all inside the **`java.base`** module:

| Package | What it holds |
|---|---|
| `java.lang` | `Object`, `String`, `Integer` and the wrappers, `Thread`, `Exception`, `Math`, `Record` — **imported automatically**, no `import` line ever needed |
| `java.util` | Collections (`List`, `Map`, `Set`, `Optional`), `UUID`, `Comparator`, `Scanner` |
| `java.util.concurrent` | `ExecutorService`, `CompletableFuture`, `ConcurrentHashMap`, atomics, locks — Phase 6's home |
| `java.util.regex` | `Pattern`, `Matcher` |
| `java.time` | `Instant`, `LocalDate`, `ZonedDateTime`, `Duration` — the *only* date-time API to use (Phase 7) |
| `java.io` / `java.nio.file` | Streams and readers (legacy-ish) / `Path`, `Files` (modern file work) |
| `java.net` | `URI`, sockets |
| `java.math` | `BigDecimal` (money — Phase 1), `BigInteger` |
| `java.security`, `javax.crypto` | Hashing, signatures, ciphers |

Frequently used packages living in **other modules** — visible on the
classpath by default, but a different module when `jlink` or JPMS enters:

| Module | Package | What |
|---|---|---|
| `java.net.http` | `java.net.http` | `HttpClient` — the modern HTTP client (since 11) |
| `java.sql` | `java.sql` | JDBC interfaces (`Connection`, `PreparedStatement`) — drivers are external |
| `java.xml` | `javax.xml.*` | XML parsing |
| `java.logging` | `java.util.logging` | The built-in logger that lost to SLF4J (Phase 12 explains the façade world) |
| `jdk.httpserver` | `com.sun.net.httpserver` | A minimal HTTP server — demos and tests, not production |

## Reading Javadoc as a reflex

The API documentation is generated from the source and is authoritative in a
way blog posts and AI answers are not. The habits that make it fast:

- **URL shape**: module, then package path, then class —
  `.../api/java.base/java/util/List.html`. Once you know the shape, you can
  type your way to any class.
- **The method summary table** first — scan signatures before reading prose.
- **"Since:" tags** tell you the earliest JDK that has the member — decisive
  when the production runtime is older than your laptop (pair with
  `--release`, [chunked topic 01](01-what-java-is/01-source-to-bytecode.md)).
- **`@Deprecated`** annotations distinguish "discouraged" from
  `forRemoval=true` ("will actually be deleted"). Presence in the library is
  not endorsement: `java.util.Date`, `Vector`, `Hashtable` and `Stack` all
  remain for compatibility and all have named modern replacements.
- The **search box** on the API site searches classes and members — faster
  than a web search and never answers for the wrong Java version.

## What is deliberately *not* in the stdlib

The gaps define the ecosystem's must-have dependencies:

- **JSON** — no parser or serializer in the JDK through 25. This single gap
  is why **Jackson** appears in effectively every service (Phase 7 teaches
  it). Gson and JSON-B exist; Jackson is the default answer.
- **A logging façade worth using** — `java.util.logging` exists but the
  ecosystem standardized on **SLF4J + Logback** (Phase 12).
- **Database drivers** — `java.sql` ships interfaces only; the PostgreSQL
  driver is a dependency.
- **YAML, CSV**, dependency injection, HTML templating, test frameworks —
  all third-party by design.

The philosophy: the JDK moves slowly and maintains compatibility for decades,
so fast-moving formats live outside it. Phase 8 (Maven) is how they arrive.

## Gotchas

**Symptom:** imported `Date` and got baffling behaviour around times
**Cause:** two `Date` classes exist — `java.util.Date` (legacy instant) and `java.sql.Date` (legacy date-only for JDBC); both are read-only legacy
**Fix:** neither — `java.time` types for all new code (Phase 7); the IDE's import picker is a place bugs are born

**Symptom:** `List` import pulled `java.awt.List` and nothing compiles sensibly
**Cause:** name collision with the ancient GUI toolkit; IDE auto-import chose wrong
**Fix:** `java.util.List`; configure the IDE to exclude `java.awt.*` and `sun.*` from auto-import candidates

**Symptom:** code uses `Vector`, `Hashtable` or `Stack` because "they're built in, so they must be current"
**Cause:** the stdlib never removes — 1996-era synchronized collections sit beside their replacements
**Fix:** `ArrayList`, `HashMap`, `ArrayDeque`; check the Javadoc's deprecation and "since" story before adopting an unfamiliar stdlib class

**Symptom:** `javax.servlet` or `javax.persistence` won't resolve though "javax is standard library"
**Cause:** those were never JDK packages — they are Jakarta EE, external, and renamed `javax.*` → `jakarta.*` in 2020
**Fix:** the `jakarta.*` dependencies (Spring Boot 3+ uses them); only `javax.crypto`, `javax.net.ssl` and a few others remain genuinely in the JDK

**Symptom:** method exists in the docs you googled but not on the project's runtime
**Cause:** you read the docs for a newer Java than the build targets — e.g. a `List` method added after 17
**Fix:** read the docs *for your version* (the URL contains it) and build with `--release`, which turns these into compile errors

**Symptom:** parsing JSON with string manipulation "to avoid a dependency"
**Cause:** the JDK-has-everything assumption meeting the JSON gap
**Fix:** Jackson (Phase 7). Hand-rolled JSON handling is a correctness and security liability, not a dependency saving

## Interview questions

**★ Which package is imported automatically, and what lives in it?**
`java.lang` — `Object`, `String`, the primitive wrappers, `Math`, `Thread`,
`System`, the core exceptions. Everything else needs an import.

**★ Why does every Java service depend on Jackson (or similar)?**
The JDK contains no JSON support through Java 25. JSON being the wire format
of the era, a third-party library is effectively mandatory; Jackson is the
ecosystem default.

**★ How do you check whether an API exists on the Java version production runs?**
The Javadoc "Since:" tag for the member, read in the docs *for that version*
— and enforce it mechanically by compiling with `--release N`, which fails
the build on newer APIs instead of failing at runtime.

**Where do collections, concurrency utilities, and the modern date-time API live?**
`java.util`, `java.util.concurrent`, and `java.time` — all in the `java.base`
module.

**What is the difference between `javax.crypto` and `javax.servlet`?**
`javax.crypto` is genuinely JDK standard library. `javax.servlet` was Java EE
— external — and is now `jakarta.servlet`. The `javax` prefix alone tells you
nothing; the module list does.

**Is `java.util.logging` the standard way to log?**
It ships with the JDK but the ecosystem standardized on SLF4J as the façade
with Logback underneath — third-party wins over built-in here (Phase 12
covers why and how).

**Why does the JDK keep deprecated classes like `Vector` for thirty years?**
Binary compatibility is a core platform promise — jars compiled decades ago
still run. The cost is that the library contains historical layers, and
"it's in the JDK" is not a currency signal; the Javadoc's deprecation and
"since" metadata is.

---

← Prev: [Version managers](09-version-managers.md) · Next → [The module system (JPMS)](11-module-system.md)
