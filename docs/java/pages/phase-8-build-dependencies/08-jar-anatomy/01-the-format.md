---
title: "The format"
sidebar_label: "01 · The format"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the JAR File Specification for JDK 25
> (docs.oracle.com/en/java/javase/25/docs/specs/jar/jar.html), the JDK 25
> `java` and `jar` tool reference pages, the `java.util.ServiceLoader`
> javadoc, JEP 238 (Multi-Release JAR Files), JEP 261
> (`Automatic-Module-Name`) and JEP 472 (`Enable-Native-Access` as a
> manifest attribute).

**Nothing in the jar format is clever. It is a zip archive plus a
directory of conventions, and the conventions are what the JVM, the
module system, `ServiceLoader` and every packaging tool read. Learn the
five files that matter and most "why does the jar behave differently"
questions answer themselves.**

## The layout

```
app.jar
├── META-INF/
│   ├── MANIFEST.MF                       ← must be the first entry
│   ├── services/
│   │   └── java.sql.Driver               ← ServiceLoader provider list
│   ├── versions/21/com/acme/Impl.class   ← multi-release override
│   ├── MYKEY.SF  MYKEY.RSA               ← signature + signature block
│   └── LICENSE  NOTICE
├── module-info.class                     ← at the ROOT, not in META-INF
└── com/acme/App.class
```

Command syntax to look inside — run them yourself; no output is reproduced
here because a listing is specific to the artifact on your disk:

```bash
jar tf app.jar                        # list entries
jar --describe-module --file app.jar  # module descriptor, or the automatic name
unzip -l app.jar                      # the same listing, via zip tooling
unzip -p app.jar META-INF/MANIFEST.MF # print the manifest
```

## `MANIFEST.MF` — the attributes that carry weight

| Attribute | What it does |
|---|---|
| `Main-Class` | Entry point for `java -jar`. Fully qualified, dots, **no** `.class` suffix |
| `Class-Path` | Space-separated *relative URLs* to other jars, resolved against this jar's own location |
| `Automatic-Module-Name` | Names the automatic module when a non-modular jar lands on the module path (JEP 261) |
| `Multi-Release` | `true` enables the `META-INF/versions/N/` overrides (JEP 238) |
| `Launcher-Agent-Class` | An `agentmain` run before `main`, from within the same jar |
| `Add-Opens` / `Add-Exports` | Honoured for executable jars, so a `java -jar` launch needs no extra flags |
| `Enable-Native-Access` | Only legal value is `ALL-UNNAMED`; lifts JNI/FFM restrictions for an executable jar (JEP 472) |
| `Sealed` | `true` in a `Name:` section means every class in that package must come from this jar |
| `Implementation-Title` / `-Version` | What `Package.getImplementationVersion()` returns — the usual "what version am I actually running" source |

The format is older than most of the people using it, and it is
unforgiving:

- **Lines are limited to 72 bytes**, and a continuation line must start
  with a **single leading space**. A long `Class-Path` wrapped by a text
  editor without that space silently loses everything after the break.
- A **blank line** ends the main section. Attributes after it belong to a
  named entry (`Name: com/acme/`), not to the jar as a whole — which is
  exactly how `Sealed: true` is scoped to one package.
- The file **must end with a newline**. A manifest whose last line has no
  terminator loses that last attribute.
- Values are read as UTF-8, and the manifest is written first in the
  archive because tools expect to find it without scanning.

Do not hand-write manifests. `maven-jar-plugin`'s `<manifestEntries>`,
Gradle's `manifest { attributes(...) }` and `jar --main-class` all get the
wrapping right; you will not.

## `java -jar` ignores `-cp`. All of it.

```bash
java -jar app.jar                     # classpath = app.jar + its manifest Class-Path. Nothing else.
java -cp app.jar:lib/* com.acme.App   # -cp honoured, Main-Class ignored
```

With `-jar`, the `-cp`/`-classpath` option **and** the `CLASSPATH`
environment variable are ignored entirely. This is documented launcher
behaviour, not a bug, and it still catches people every year — usually
someone adding a JDBC driver or an agent jar to a working command and
watching nothing change.

If you need more on the classpath, either drop `-jar` and name the main
class, or extend the manifest's `Class-Path`. That attribute has its own
sharp edges:

- Entries are **relative URLs**, so a space must be `%20`.
- There is **no globbing**. `lib/*` is looked up as a file literally named
  `*`. (The `-cp` option *does* expand `lib/*`; the manifest does not.)
- A directory of loose classes needs a **trailing `/`**.
- Missing entries are **silently ignored** — you find out at
  `NoClassDefFoundError` time, on the code path that needed them.
- `Class-Path` is honoured for any jar on the classpath, not only
  executable ones, which is how a library can quietly drag in a sibling.

## `META-INF/services/` — how `ServiceLoader` finds anything

One file per service interface. The **filename is the fully-qualified
interface name**; each line names a fully-qualified implementation with a
public no-arg constructor (or a static `provider()` method). Blank lines
and `#` comments are allowed:

```
# file: META-INF/services/java.sql.Driver
org.postgresql.Driver
```

`ServiceLoader.load(Driver.class)` reads every such file visible to the
class loader and instantiates lazily what it finds. This is the mechanism
behind JDBC driver auto-registration, SLF4J/Log4j2 backend binding,
Jackson modules (`ObjectMapper.findAndRegisterModules()`),
`java.nio.file.spi` filesystem providers, `Charset` providers,
`ScriptEngineFactory`, and — on the module path — JPMS `provides … with`
declarations, which `ServiceLoader` reads instead of the file.

The structural fact that matters later: **the path is derived from the
interface name, so every library implementing the same interface ships a
file at exactly the same path.** On a classpath that is fine —
`ClassLoader.getResources()` returns *all* of them. Inside one merged jar
there can be only one file per path. That is the collision, and it gets a
[whole chunk](03-the-collision.md).

## Multi-release jars

`Multi-Release: true` in the manifest turns on `META-INF/versions/N/`. A
class at `META-INF/versions/21/com/acme/Impl.class` replaces the
root-level `com/acme/Impl.class` when running on JDK 21 or later; the
runtime picks the **highest** `N` that is ≤ its own feature version, and
ignores the directory entirely if the manifest attribute is absent.

The rules that keep it safe, and the ways it bites:

- A versioned class **must** have a base (root) version, and the public
  API of every version must match. `jar --create --release` validates some
  of this; a jar assembled by a zip tool gets no checking at all.
- **Flattening loses it.** A shade or assembly step that copies
  `META-INF/versions/…` into the merged jar but does not carry
  `Multi-Release: true` into the merged manifest produces an artifact that
  silently uses the base implementation forever — often the older,
  reflection-based, slower one the library kept for JDK 8.
- The reverse is worse: versioned entries copied to the **root**, so a
  class compiled for a newer JDK is loaded on an older one and fails
  verification.
- Naive consumers — unzip-and-scan classpath scanners, old bytecode
  rewriters, some agents — see two copies of a class and either complain
  or pick the wrong one.

## When the format is not the answer

Manifest `Class-Path` is a real alternative to fat jars for
server-deployed applications: ship `app.jar` plus a `lib/` directory and
let the manifest list it. It is smaller, debuggable, and every dependency
stays identifiable. The honest downsides are that the list is manual
unless the build generates it, the relative paths must survive
deployment, and one missing file fails at first use rather than at launch.
It is the right shape for an artifact you install; it is the wrong shape
for something you `curl` and run.

## Gotchas

**Symptom:** `java -cp extra.jar -jar app.jar` cannot find `extra.jar`'s classes
**Cause:** `-jar` makes the launcher ignore `-cp` and `CLASSPATH` entirely; the classpath is the jar plus its manifest `Class-Path`
**Fix:** drop `-jar` and name the main class (`java -cp app.jar:extra.jar com.acme.App`), or add the jar to the manifest `Class-Path`

**Symptom:** a manifest `Class-Path: lib/*` finds nothing, though `-cp lib/*` works
**Cause:** `Class-Path` entries are relative URLs, not shell globs — the launcher looks for a file literally named `*`
**Fix:** list the jars individually (generate the list from the build), or point at a directory entry with a trailing `/` for loose classes

**Symptom:** a hand-edited manifest's long `Class-Path` truncates after about seventy characters
**Cause:** manifest lines cap at 72 bytes and continuation lines must begin with a single space; the editor wrapped without one
**Fix:** stop editing manifests by hand — `maven-jar-plugin` `<manifestEntries>` or Gradle's `manifest {}` handle the wrapping

**Symptom:** `Main-Class` is set but the jar reports `Could not find or load main class com.acme.App.class`
**Cause:** the attribute was written with a `.class` suffix or with slashes instead of dots
**Fix:** `Main-Class: com.acme.App` — binary class name, dots, no extension

**Symptom:** a packaged app is measurably slower on a modern JDK than the same code run from a classpath
**Cause:** a multi-release dependency was flattened without `Multi-Release: true` reaching the merged manifest, so the JDK-8-era base implementation is what runs
**Fix:** carry the attribute through the packaging step, or keep the dependency intact (see [Fat jars](02-fat-jars.md))

**Symptom:** a class in the jar fails verification on an older JDK with `UnsupportedClassVersionError`, but only for one or two classes
**Cause:** versioned entries were extracted to the archive root instead of staying under `META-INF/versions/N/`
**Fix:** repackage with `jar --create --release N`, and never assemble a multi-release jar with a generic zip tool

## Interview questions

**★ What is actually in a jar file, and what makes one "executable"?**
A jar is a zip archive with a `META-INF/` directory. "Executable" is not a
file-format property: it means `META-INF/MANIFEST.MF` carries a
`Main-Class` attribute naming a class with a `public static void
main(String[])`. Nothing else about the archive changes, which is why the
same jar can be a library on someone else's classpath and a runnable
artifact at the same time.

**★ Why does adding a jar with `-cp` do nothing when you launch with `-jar`?**
Because `-jar` declares that the application classpath comes from the jar
itself — the jar plus whatever its manifest `Class-Path` names. The
`-cp`/`-classpath` option and the `CLASSPATH` environment variable are
documented to be ignored in that mode. To add jars, either launch with
`-cp` and the main class name, or extend the manifest.

**★ How does `ServiceLoader` discover providers, and where does the list live?**
For classpath jars it reads `META-INF/services/<fully-qualified-interface-name>`,
one implementation class per line, from **every** such resource the class
loader can see (`getResources`, not `getResource`), instantiating them
lazily. For modular jars on the module path it reads `provides … with`
from `module-info.class` instead. Everything from JDBC drivers to Jackson
modules to logging backends rides on this one convention.

**★ Explain multi-release jars and one way a build can silently break one.**
`Multi-Release: true` plus `META-INF/versions/N/` lets a jar ship
JDK-version-specific implementations of the same class; the runtime picks
the highest `N` ≤ its own feature version, and every versioned class must
have a base version with a matching public API. The silent break is
repackaging: if a fat-jar step copies the versioned entries but drops the
manifest attribute, the JVM ignores the whole directory and runs the base
implementation forever. Nothing fails — the artifact is just permanently
on the compatibility path.

**★ Name three manifest attributes beyond `Main-Class` that change how the JVM treats a jar.**
`Class-Path` extends the application classpath from inside the archive;
`Automatic-Module-Name` fixes the module name a non-modular jar gets on
the module path, so consumers are not bound to a filename-derived name;
`Enable-Native-Access: ALL-UNNAMED` (JEP 472) lifts native-access
restrictions for an executable jar without a command-line flag.
`Add-Opens`/`Add-Exports` and `Launcher-Agent-Class` belong on the same
list, and `Sealed` constrains where a package's classes may come from.

---

← Prev: [Jar anatomy](README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Fat jars: three strategies](02-fat-jars.md)
