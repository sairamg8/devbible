---
title: "The classpath"
sidebar_label: "2 · The classpath"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 `java` launcher documentation
> (classpath specification and `-jar` semantics), the `jar` tool reference
> (manifest `Class-Path`), and the Spring Boot executable-jar documentation
> for the nested-jar contrast.

**The classpath is an ordered list of directories and jars in which classes
and resources are searched by name, first match wins. Every deployment
mystery in this topic's family reduces to one question: *what exactly is on
the classpath, in what order, in this particular way of launching the
process?* The IDE, the test runner, the fat jar and the container can each
answer differently — which is precisely how "works here, fails there" is
manufactured.**

## What it is and how it's set

For `com.acme.billing.Invoice`, each classpath entry is checked for
`com/acme/billing/Invoice.class` — as a file under a directory entry, or an
entry inside a jar. Three ways to set it, in precedence order:

```bash
java -cp "out:lib/*" com.acme.Main        # 1. the flag (or -classpath / --class-path)
CLASSPATH=out java com.acme.Main          # 2. the env var — used only if no flag
java com.acme.Main                        # 3. neither → default is "." only
```

Rules that generate real bugs:

- **`-cp` beats `CLASSPATH`; `CLASSPATH` beats the default.** A forgotten
  `export CLASSPATH=...` in a shell profile haunts every `java` invocation on
  that machine that doesn't pass `-cp` — a classic "only fails on this one
  server" source.
- **Separator is `:` on Unix, `;` on Windows** — scripts that hardcode one
  break on the other (topic 01 chunk 3's portability theme).
- **`lib/*` expands to every jar in `lib`** — jars only (not `.class`
  dirs), *not recursive*, and expansion order is not guaranteed
  alphabetical. If order matters between those jars, the wildcard is the
  wrong tool.
- **Directories mean *roots of package trees*, not "the folder the class is
  in"**: for `out/com/acme/Main.class` the entry is `out`, full stop.

## The `-jar` trap

```bash
java -jar app.jar             # classpath = app.jar. Period.
```

In `-jar` mode **the jar is the entire classpath — `-cp` and `CLASSPATH` are
silently ignored** (documented launcher behaviour). Extra jars can only come
via the manifest's `Class-Path:` attribute — relative-to-the-jar paths baked
in at build time:

```text
Main-Class: com.acme.Main
Class-Path: lib/postgres.jar lib/jackson.jar
```

This one rule explains a whole support-forum genre: "I added the driver with
`-cp` next to `-jar` and it still says `ClassNotFoundException`". The
alternatives when you need launch-time classpath control: skip `-jar` and use
`java -cp "app.jar:lib/*" com.acme.Main`, or build a proper fat jar.

**Fat jars** (Phase 8) sidestep the multi-jar problem by merging everything
into one archive — with their own hazard: two dependencies shipping a
same-named resource or service file collide during the merge, silently,
first-or-last-wins depending on the plugin. **Spring Boot jars** are a third
design: dependencies stay *nested* as jar-inside-jar, loaded by Boot's own
launcher classloader — which is why generic "read the jar" tooling doesn't
see Boot dependencies, and why Boot jars are run with `java -jar` only.

## Ordering: first match wins

The search stops at the first entry containing the name. Consequences:

- **Two versions of a library on the classpath** → whichever entry comes
  first supplies *every* class both jars contain — and if the jars differ in
  contents (a refactor moved a class), you can get a **mixed** result: some
  classes from v1, some from v2, failing later with `NoSuchMethodError`
  (chunk 3). The classpath does not deduplicate, warn, or version-resolve —
  that is the build tool's job *before* the classpath exists (Phase 8's
  nearest-wins mediation).
- **Deliberate shadowing** — putting a patched class file ahead of the jar
  it patches — works and is occasionally a legitimate emergency tool, which
  is exactly why accidental shadowing is so confusing.

## Resources ride the same path

`getResource`/`getResourceAsStream` search the classpath by the same rules:

```java
// src/main/resources/config/defaults.yml → on the classpath as config/defaults.yml
try (var in = Main.class.getResourceAsStream("/config/defaults.yml")) { ... }
```

- With `Class.getResourceAsStream`, a **leading `/` means classpath root**;
  without it, the path is relative to the class's own package. The
  `ClassLoader` variant takes no leading slash at all. Mixing these
  conventions up produces `null` streams, not exceptions — check for null.
- Maven copies `src/main/resources` to the classpath root; a resource
  "missing in the jar" usually sat outside that directory or was filtered by
  the build.

## Where the IDE diverges from the server

The IDE assembles its Run-button classpath from the project model —
dependencies, module outputs, resource dirs — and it is *correct*. The server
runs a manifest, a start script, or a container entrypoint. Divergences that
recur: a dependency marked test/provided scope (present in the IDE run,
absent at runtime), resources outside the conventional directory, a stale
`CLASSPATH` on the host, `-cp` alongside `-jar`, and version mixes the build
resolved but the deploy didn't. Chunk 3 turns this list into a diagnostic
sequence.

## Gotchas

**Symptom:** `java -cp lib/driver.jar -jar app.jar` still throws `ClassNotFoundException` for the driver
**Cause:** `-jar` mode ignores `-cp` and `CLASSPATH` entirely — the manifest is the only classpath source
**Fix:** manifest `Class-Path:`, a fat jar, or drop `-jar`: `java -cp "app.jar:lib/*" com.acme.Main`

**Symptom:** a program behaves differently on one server than everywhere else, same jar
**Cause:** a `CLASSPATH` env var exported in that host's shell profile, silently prepending entries to non-`-cp` launches
**Fix:** `echo $CLASSPATH` on the box; always pass `-cp` explicitly in start scripts so the env var can't matter

**Symptom:** `NoSuchMethodError` at runtime for a method that compiles fine and exists in the sources you read
**Cause:** two versions of the library on the classpath; first-match-wins served the older class
**Fix:** this is a build-hygiene bug surfacing at runtime — `mvn dependency:tree`, find the duplicate, exclude it (Phase 8). Chunk 3 has the full error taxonomy

**Symptom:** `getResourceAsStream` returns null in the jar but worked in the IDE
**Cause:** resource not under `src/main/resources` (so never packaged), or the leading-slash convention mixed up between the `Class` and `ClassLoader` variants
**Fix:** `jar tf app.jar | grep <name>` to see what actually shipped and at what path; then fix the location or the lookup string

**Symptom:** `java -cp "lib/*/*"` or nested wildcard finds nothing
**Cause:** classpath wildcards are single-level and jars-only by specification
**Fix:** flatten jars into one directory, list entries explicitly, or let the build tool emit the classpath (`mvn dependency:build-classpath`)

**Symptom:** the same command works on Linux, fails on a Windows dev machine with "class not found"
**Cause:** classpath separator — `:` on Unix, `;` on Windows; the Unix form makes Windows see one long garbage path
**Fix:** build-tool-generated launch scripts handle this; hand-written docs should show both forms

**Symptom:** unzipping a Spring Boot jar and putting its contents on a plain classpath fails bizarrely
**Cause:** Boot jars are nested-jar archives with their own launcher; the layout is not a plain classpath layout
**Fix:** run Boot jars with `java -jar`. For classpath-style consumption, Boot offers exploded-mode and layered-jar tooling (Phase 12's packaging topic)

**Symptom:** an emergency-patched class file "wasn't picked up"
**Cause:** it was placed *after* the jar containing the original — first match wins, and the jar matched first
**Fix:** patched entries must precede the jar on the classpath. (And retire the patch with the next real release — deliberate shadowing is a flare, not architecture)

## Interview questions

**★ How does the JVM find a class at run time?**
It asks the classloader hierarchy (chunk 3); the application loader searches
the classpath — an ordered list of directories and jars — for
`package/path/Name.class`, first match wins. The classpath comes from `-cp`,
else the `CLASSPATH` env var, else `.` — unless `-jar` mode, where the jar
plus its manifest `Class-Path` is the whole universe.

**★ Why is `-cp` ignored when using `java -jar`?**
By launcher specification, `-jar` mode takes the application's classpath
exclusively from the jar and its manifest `Class-Path` attribute — making the
jar self-describing and the launch reproducible. Needing external entries
means using the manifest, a fat jar, or class mode with `-cp`.

**★ What happens if two jars on the classpath contain the same class?**
The earlier entry wins for each individual class name — no error, no warning,
no version logic. If the jars are two versions with different contents, you
can load a *mixture*, producing `NoSuchMethodError`/`LinkageError` far from
the cause. Preventing duplicates is the build tool's job before launch.

**★ A resource loads in the IDE and is null in production. Walk through the diagnosis.**
First `jar tf app.jar` — is the resource in the artifact at all, and at what
path? If absent: it lived outside `src/main/resources` or was excluded by the
build. If present: compare the lookup — `Class.getResourceAsStream` with a
leading `/` is classpath-root-relative, without is package-relative, and the
`ClassLoader` variant never takes the slash. The null return (not an
exception) is why these linger.

**How do classpath wildcards behave?**
`dir/*` includes every jar directly in `dir` — not class directories, not
subdirectories, and with no guaranteed ordering among the matched jars. Fine
for "all my deps, order-independent"; wrong the moment inter-jar order
matters.

**What's the difference between a fat jar and a Spring Boot jar?**
A fat jar unpacks all dependencies into one flat archive (merge collisions
possible on same-named resources); a Boot jar keeps dependencies *nested* and
ships its own classloader to read them — cleaner isolation, but only Boot's
launcher understands the layout.

**How do resources and classes relate on the classpath?**
Same search, same roots, same ordering rules — a resource is just a
non-`.class` entry. Which is why resource shadowing (two jars shipping
`logback.xml`) follows the identical first-match logic as class shadowing.

---

← Prev: [Packages and imports](01-packages-and-imports.md) · Next → [Classloaders and the two errors](03-classloaders-and-the-two-errors.md)
