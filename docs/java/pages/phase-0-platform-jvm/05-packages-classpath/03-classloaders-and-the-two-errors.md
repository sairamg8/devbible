---
title: "Classloaders and the two errors"
sidebar_label: "3 · Classloaders & the two errors"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JVMS SE 25 §5.3 (creation and loading), the
> `ClassLoader`, `ClassNotFoundException` and `NoClassDefFoundError` Javadoc
> in the JDK 25 documentation, and the Spring Boot executable-jar
> (launcher/classloader) documentation.

**`ClassNotFoundException` and `NoClassDefFoundError` are not two spellings of
one problem — they are two different facts. The exception means *a by-name
lookup asked for a class and no loader could find it*. The error means *a
class that was present at compile time failed to load or link at run time* —
and its single most misleading cause is a static initializer that already
threw, once, earlier in the log. Add `NoSuchMethodError` — the class loaded
fine but it's the wrong version — and you have the complete taxonomy of
"works in the IDE, fails on the server".**

## The delegation model

Three built-in loaders form a parent chain, and lookups go **parent-first**:

| Loader | Loads |
|---|---|
| **Bootstrap** | The core of the JDK itself (`java.base`: `String`, `List`, …) |
| **Platform** | The rest of the JDK's modules |
| **Application (system)** | Your classpath — the one you configure |

A loader asked for a name first delegates to its parent; only if the parent
chain fails does it search its own territory. Two consequences worth
keeping:

1. **You cannot shadow the JDK from the classpath.** A `java.lang.String` in
   your jar is never loaded — bootstrap answers first. (Deliberate core
   patching has its own sanctioned mechanism, `--patch-module`, and is not
   an application technique.)
2. **Class identity = (fully qualified name, loader).** The same bytes
   loaded by two different loaders are two *different classes* to the JVM —
   `instanceof` fails across them, casts throw `ClassCastException` for
   "the same" type. Irrelevant in a plain service with one app loader;
   central in anything with *custom* loaders.

Custom loaders are how the interesting containers work: **Spring Boot's
launcher** (reads dependencies nested inside the jar — chunk 2), **Tomcat**
(one loader per webapp, deliberately breaking parent-first for webapp
classes so apps can bring their own library versions), test frameworks with
isolation features, and plugin systems. When a `ClassCastException` names
the *same class on both sides*, you are in two-loaders territory.

## The taxonomy, precisely

**`ClassNotFoundException`** — checked exception. A *dynamic, by-name* lookup
failed: `Class.forName("com.acme.X")`, `loadClass`, a framework reading a
class name from config. The name never resolved to bytes on the asking
loader's search path.
→ *Diagnosis direction:* the **classpath is missing something** (or the
config string is wrong). What jar should contain this name, and is it there?

**`NoClassDefFoundError`** — an `Error`. The class was there when *the
referencing code* was compiled, but at run time the JVM could not complete
loading/linking at first use. Two very different causes share it:

1. **Missing at run time** — compile-time dependency absent from the deploy:
   Maven `provided`/`test` scope leaking, a manifest `Class-Path` gap, a
   trimmed image. The compile/runtime classpath mismatch, materialized.
2. **Initialization already failed** — the class was found, but its static
   initializer threw earlier; that first failure surfaced as
   `ExceptionInInitializerError` **once**, the class was marked failed
   forever, and every later use gets a bare `NoClassDefFoundError` (often
   with "Could not initialize class" wording). The real cause is at the
   *first* occurrence in the logs — searching for the *last* occurrence
   finds only echoes. (Topic 01 chunk 2 covers the initialization
   machinery.)

**`NoSuchMethodError` / `NoSuchFieldError` / `AbstractMethodError`
(LinkageErrors)** — the class **loaded fine but is the wrong version**: the
caller was compiled against API the loaded class doesn't have. Cause: version
skew — two library versions on the classpath (first-match mixing, chunk 2),
or a transitive downgrade the build resolved differently than you assumed.
→ *Diagnosis direction:* **which jar did this class actually come from?**

```java
// The one-liner that answers "which jar," from anywhere:
Object src = com.acme.X.class.getProtectionDomain().getCodeSource();
// → file:/app/lib/acme-core-1.4.jar  (null for JDK classes)
```

`-verbose:class` at launch prints every load with its source — heavyweight
but definitive when the one-liner can't be injected.

## The "works in the IDE" diagnostic sequence

The IDE assembles a correct classpath from the project model; the server runs
what the manifest/script says. When they disagree:

1. **Read the error type first** — it names the direction:
   `ClassNotFoundException` → missing entry; `NoClassDefFoundError` → scope
   leak or earlier init failure (check the log's *first* related error);
   `NoSuchMethodError` → version skew.
2. **What is actually deployed?** `jar tf app.jar | grep <Class>` — or for
   Boot jars, check `BOOT-INF/lib/` for the dependency jar.
3. **What scope is the dependency?** `provided` and `test` scopes exist in
   the IDE's run config but not in the artifact — the classic leak.
4. **Which jar served the class?** The `getCodeSource()` one-liner or
   `-verbose:class`, when the class exists but misbehaves.
5. **What did the build resolve?** `mvn dependency:tree` — duplicates,
   version mediation, the stale renamed artifact (Phase 8 owns the fix).

## Gotchas

**Symptom:** `NoClassDefFoundError: Could not initialize class com.acme.Config`, repeatedly, all over the logs
**Cause:** not a classpath problem at all — `Config`'s static initializer threw once, earlier; the class is marked failed and every use since echoes the error
**Fix:** search the log for the **first** `ExceptionInInitializerError` / first mention of the class — the real exception is wrapped there. Then make the static initializer trivial (no I/O, no config reads)

**Symptom:** `ClassNotFoundException: org.postgresql.Driver` on the server; the IDE runs fine
**Cause:** the driver jar isn't in the deployed classpath — wrong scope, missing manifest `Class-Path` entry, or the `-jar`-ignores-`-cp` trap (chunk 2)
**Fix:** confirm with `jar tf` / `BOOT-INF/lib` listing; fix the dependency scope to `runtime` or the packaging, not the code

**Symptom:** `NoSuchMethodError` after a minor dependency bump, in code nobody changed
**Cause:** version skew — a transitive dependency was mediated down/up, or two versions coexist and first-match served a mix
**Fix:** `getCodeSource()` names the serving jar; `mvn dependency:tree` names why it's there; exclusion or a BOM pins it (Phase 8)

**Symptom:** `ClassCastException: com.acme.Plugin cannot be cast to com.acme.Plugin` — the same name on both sides
**Cause:** two classloaders each loaded the class; identity is (name, loader), so they are different types
**Fix:** the shared type must live in a loader common to both sides (the parent), with only implementations in the child loaders — a structural fix in plugin/container architectures, not a cast fix

**Symptom:** putting a fixed `java.lang`-adjacent class on the classpath does nothing
**Cause:** parent-first delegation — bootstrap serves JDK names before the application loader is ever consulted
**Fix:** you cannot shadow the JDK from the classpath; that's a guarantee, not a bug. JDK patching goes through `--patch-module` in a lab, or a JDK upgrade in life

**Symptom:** a library that self-configures via `Class.forName("...")` fails only in the native/minimized deployment
**Cause:** by-name dynamic loading is invisible to static analysis — the class was trimmed out (jlink/native-image closed-world), or the config string names an optional dependency that isn't present by design
**Fix:** distinguish the two: optional-by-design needs the dependency added only if the feature is wanted; trimming needs the class registered with the minimizer's config

**Symptom:** in Tomcat, a webapp sees a different library version than the one in its `WEB-INF/lib`
**Cause:** container classloading — the server's shared loader or another layer served the class; webapp delegation rules (child-first for webapp classes, with server-class exceptions) decided differently than plain parent-first intuition
**Fix:** container-specific loader config; or the modern answer — embedded servers (Spring Boot) exist partly to delete this entire problem class by giving each app its own JVM

**Symptom:** `Class.forName("org.postgresql.Driver")` cargo-culted in modern code
**Cause:** pre-JDBC-4 ritual (drivers needed manual loading before 2006); services files (`META-INF/services`) auto-load drivers since
**Fix:** delete it — harmless but archaeological. Recognizing it matters mainly for reading old code honestly

## Interview questions

**★ `ClassNotFoundException` vs `NoClassDefFoundError` — what's the actual difference?**
The exception: a *dynamic by-name lookup* (`Class.forName`, `loadClass`)
found nothing — the name isn't on the asking loader's path. The error: a
class *the compiler saw* couldn't be loaded/linked at first use — either
missing from the runtime classpath (scope leak, packaging gap) or its static
initializer already failed once, poisoning every later use. Different facts,
different diagnoses: "add the jar" territory vs "read the first error in the
log" territory.

**★ Describe the classloader delegation model and one consequence.**
Bootstrap (JDK core) ← platform (rest of JDK) ← application (your
classpath); requests delegate parent-first, so a loader searches its own
territory only after the chain above fails. Consequence: nothing on the
classpath can shadow the JDK — and class identity being (name, loader) means
two loaders can hold two incompatible copies of "the same" class.

**★ How do you find which jar a class was loaded from, live?**
`X.class.getProtectionDomain().getCodeSource()` — prints the jar URL (null
for JDK classes). At launch, `-verbose:class` logs every load with its
source. These two turn `NoSuchMethodError` from an argument into a fact.

**★ What causes `NoSuchMethodError` when everything compiles?**
Compile-time and run-time saw different versions: the caller compiled
against API v2, the classpath served v1 — via duplicate jars with
first-match mixing, or build-time version mediation differing from what got
deployed. It is a build-hygiene failure surfacing at link time, fixed with
`dependency:tree`, exclusions and BOMs, never with try/catch.

**★ Why can `ClassCastException` fire when the class names match exactly?**
Two classloaders each defined the class; the JVM treats them as distinct
types. Seen in plugin systems, app servers and test isolation. The fix is
architectural: shared API types load in the common parent, implementations
in the children.

**Why does the same `NoClassDefFoundError` keep appearing after the "real" error scrolled away?**
Failed initialization is permanent for that class in that loader: the first
use threw `ExceptionInInitializerError` with the cause; every later use gets
the terse error. Log-diving direction: *first* occurrence, not last.

**How does Spring Boot's jar launch relate to classloaders?**
`java -jar` starts Boot's launcher, which installs a custom classloader that
reads dependency jars *nested* under `BOOT-INF/lib/` — impossible for the
plain app loader, which can't read jar-in-jar. That's why Boot jars run only
via their launcher, and why "is the dependency in `BOOT-INF/lib`?" is the
Boot version of `jar tf`.

**When is `Class.forName` legitimate in modern code?**
Frameworks resolving user-configured class names, SPI-style extension
points, and optional-dependency probing ("use the fast codec if present").
The JDBC ritual is dead. Every remaining use should expect and handle
`ClassNotFoundException` as a *normal* outcome, not a crash.

---

← Prev: [The classpath](02-the-classpath.md) · Index: [Packages and the classpath](README.md)
