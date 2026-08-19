---
title: "The standard layout and resources"
sidebar_label: "1 · Layout & resources"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Apache Maven "Introduction to the Standard
> Directory Layout", the Maven POM reference (`<build><resources>`,
> `<sourceDirectory>`), and the maven-resources-plugin "Filtering" and
> "Binaries Filtering" pages (default `nonFilteredFileExtensions`:
> `jpg`, `jpeg`, `gif`, `bmp`, `png`). Maven 3.9.16 GA line, JDK 25 target.

**The layout is the configuration. `src/main/java` is a default declared in
the super POM and every plugin in the ecosystem binds its defaults to that
tree, so following the convention is how you avoid writing configuration at
all. The two things that actually bite here are both about *resources*, not
sources: filtering rewrites the bytes of every file in a directory whether or
not that file is text, and a test resource shadows a main resource by whole
file rather than by key.**

## The directory table

| Path | What lives there |
|---|---|
| `src/main/java` | Application/library sources |
| `src/main/resources` | Non-Java files packaged into the artifact |
| `src/main/filters` | Property files feeding resource filtering |
| `src/main/webapp` | Web application sources (WAR packaging) |
| `src/test/java` | Test sources — compiled, never packaged |
| `src/test/resources` | Test-only resources |
| `src/test/filters` | Filter files for test resources |
| `src/it` | Integration tests (mostly a plugin-authoring convention) |
| `src/assembly` | Assembly descriptors |
| `src/site` | Site documentation |
| `target/` | *All* build output |

At the project root Maven also expects `pom.xml`, and conventionally
`README`, `LICENSE` and `NOTICE` files. In a multi-module build every module
repeats this same structure under its own directory.

Everything above is a *default*, and every default is overridable
(`<build><sourceDirectory>`, `<testSourceDirectory>`, `<outputDirectory>`).
Doing so is legal and almost always a mistake. You inherit the maintenance of
every plugin that assumed the default; IDE import stops guessing correctly;
static-analysis and coverage tools need bespoke configuration; and the next
engineer reads a layout that matches no documentation anywhere. Convention
here buys you configuration you never have to write, and the discount is
large.

## Two consequences people trip over

**`target/` is disposable by definition.** `mvn clean` deletes it, and CI
starts without it. Anything you cannot regenerate must not live there, and
nothing in `target/` belongs in version control — a generated-sources
directory under `target/generated-sources` is still generated, and committing
it produces a tree where the committed copy and the regenerated copy silently
diverge.

**Test sources are not shipped.** `src/test/java` compiles to
`target/test-classes`, which is on the *test* classpath only and is not part
of the jar. Production code that needs a test helper is therefore a design
signal, not a packaging problem: either the helper belongs in `src/main` (and
you have decided to ship and support it), or the dependency is backwards.
Maven can publish a `test-jar` for the genuine case where downstream modules
share test fixtures — but that is a deliberate published artifact with its own
compatibility obligations, not a shortcut.

## Resource filtering

Filtering substitutes Maven properties into resource files as they are copied
into `target/classes`:

```xml
<build>
  <resources>
    <resource>
      <directory>src/main/resources</directory>
      <filtering>true</filtering>
    </resource>
  </resources>
</build>
```

A `${project.version}` or `${build.timestamp}` in a properties file is then
replaced at build time. That is how a build version gets stamped into a
banner or a `build-info.properties` without a code generator.

Property values come from the POM's `<properties>`, the built-in `project.*`
and `settings.*` trees, system properties, and any file listed under
`<filters>`.

## The binary-file trap

`<filtering>true</filtering>` applies to **the whole directory**, including
files that are not text. Filtering a keystore, a font, a PDF, a `.p12`, a
`.zip` or a compiled resource rewrites any byte sequence that happens to look
like a property reference. The file is silently corrupted — and the failure
surfaces at *runtime*, in whichever environment first loads it, long after the
build went green.

maven-resources-plugin ships a default non-filtered extension list —
`jpg`, `jpeg`, `gif`, `bmp`, `png`. That covers common images and nothing
else. Either extend it:

```xml
<configuration>
  <nonFilteredFileExtensions>
    <nonFilteredFileExtension>p12</nonFilteredFileExtension>
    <nonFilteredFileExtension>jks</nonFilteredFileExtension>
    <nonFilteredFileExtension>woff2</nonFilteredFileExtension>
    <nonFilteredFileExtension>pdf</nonFilteredFileExtension>
  </nonFilteredFileExtensions>
</configuration>
```

…or, better, make the filtered set an *allow-list* by splitting the resource
declaration in two, so a new binary format added next year is unfiltered by
default rather than corrupted by default:

```xml
<resources>
  <resource>
    <directory>src/main/resources</directory>
    <filtering>true</filtering>
    <includes><include>**/*.properties</include></includes>
  </resource>
  <resource>
    <directory>src/main/resources</directory>
    <filtering>false</filtering>
    <excludes><exclude>**/*.properties</exclude></excludes>
  </resource>
</resources>
```

The second shape is the one to reach for. It fails safe; the extension list
fails open.

## `${...}` belongs to two systems

Maven's filtering delimiter and Spring's runtime placeholder syntax are the
same characters. Filter a Spring config file and the build eats
`${DB_URL}` — the placeholder Spring was supposed to resolve from the
environment at startup — usually replacing it with an empty string and a
warning nobody reads.

This is why `spring-boot-starter-parent` reconfigures the delimiter to
`@...@`. With it, `@project.version@` is substituted at build time and
`${DB_URL}` is passed through untouched for the runtime to handle. If you are
not on that parent and you filter Spring config, set the delimiter yourself:

```xml
<configuration>
  <delimiters><delimiter>@</delimiter></delimiters>
  <useDefaultDelimiters>false</useDefaultDelimiters>
</configuration>
```

`useDefaultDelimiters` matters — leaving it `true` keeps `${...}` active
alongside `@...@`, which reintroduces exactly the collision you were fixing.

## Test resources shadow main resources — by whole file

On the test classpath `target/test-classes` precedes `target/classes`. A file
with the same path in both is therefore resolved from `src/test/resources`.
That is the mechanism behind a cut-down `application.properties` or a
`logback-test.xml` under `src/test/resources`, and it is genuinely useful.

The part that catches people: **it shadows whole files, not keys.** A test
`application.properties` containing three settings does not override three
settings — it replaces the file, and every other setting in the main file
disappears for tests. Its inverse is worse: a test file created for one test
class, whose path happens to match a main resource, silently disables that
main config for *every* test in the module.

The reliable shapes are (a) make the test file complete, accepting that it is
now a second copy to maintain, or (b) give it a different name and activate it
explicitly — `@TestPropertySource`, a Spring profile, an explicit
`ClassLoader.getResource("test-config.properties")`. Never treat a same-named
test resource as an overlay; the classpath has no merge semantics.

## Gotchas

**Symptom:** a keystore, font or `.p12` in `src/main/resources` is corrupt in the packaged jar but fine in the source tree
**Cause:** `<filtering>true</filtering>` on the whole resource directory rewrote bytes in a binary file; the plugin's default non-filtered list covers only `jpg`, `jpeg`, `gif`, `bmp`, `png`
**Fix:** split the `<resource>` blocks so filtering is an allow-list over text formats, rather than extending the exclusion list every time a new binary type appears

**Symptom:** Spring placeholders like `${DB_URL}` resolve to empty at runtime, and the build logged an unresolved-property warning
**Cause:** resource filtering consumed `${...}` at build time — Maven and Spring share the placeholder syntax
**Fix:** switch the delimiter to `@...@` (what `spring-boot-starter-parent` configures) *and* set `useDefaultDelimiters` to `false`, or exclude the Spring config from filtering entirely

**Symptom:** a setting present in `src/main/resources/application.properties` is missing in every test in that module
**Cause:** a same-named file in `src/test/resources` shadows it — `target/test-classes` precedes `target/classes` on the test classpath, and shadowing replaces the whole file
**Fix:** make the test copy complete, or rename it and activate it explicitly; the classpath does not merge same-named resources

**Symptom:** a generated source file is in git, and rebuilding produces a diff nobody made
**Cause:** something under `target/generated-sources` was committed; the generator still runs and regenerates it into a directory `mvn clean` wipes
**Fix:** keep generated output in `target/` and out of version control; if it must be committed, generate it into `src/` deliberately and turn the generator off

**Symptom:** a `.sql`, `.json` or `.properties` file sitting next to the class that loads it is missing from the jar and `getResourceAsStream` returns `null`
**Cause:** it was put under `src/main/java`; the compiler plugin copies `.java` output, not arbitrary files, so nothing ever placed it in `target/classes`
**Fix:** move it to `src/main/resources` under the *same package path* — the classpath layout mirrors the package, so `src/main/resources/com/example/shop/queries.sql` is what `Shop.class.getResourceAsStream("queries.sql")` finds

**Symptom:** a new coverage or static-analysis plugin reports zero sources
**Cause:** the project overrode `<sourceDirectory>` years ago; the plugin uses the convention it was written against
**Fix:** move the tree back to `src/main/java`. Every override of a layout default is a permanent tax on every tool you adopt afterwards

## Interview questions

**★ Why does Maven insist on `src/main/java` — what breaks if you move it?**
Nothing breaks *immediately*: `<sourceDirectory>` is configurable and the
build will work. What breaks is everything downstream that assumed the
default — IDE project import, coverage and static-analysis plugins,
code-generation plugins that write into `target/generated-sources` and expect
the standard root, and every piece of documentation and Stack Overflow answer.
The convention is not aesthetic; it is a shared default that lets a hundred
plugins ship with zero configuration.

**★ What does `<filtering>true</filtering>` actually do, and why is it dangerous?**
It performs textual property substitution on every file in that resource
directory as it is copied to `target/classes`. It is dangerous because
"every file" includes binary ones: a keystore or font containing a byte
sequence resembling a property reference gets rewritten and becomes invalid,
with the failure appearing at runtime rather than at build time. The default
protection is a five-extension exclusion list. The safe pattern inverts it —
filter an explicit include-list of text formats and copy everything else
unfiltered.

**★ Both Maven and Spring use `${...}`. How do they coexist?**
By moving one of them. Spring Boot's parent POM configures the resource
plugin's delimiter to `@...@`, so build-time substitution uses
`@project.version@` and `${...}` survives into the packaged file for Spring to
resolve at startup. If you configure this yourself, you must also set
`useDefaultDelimiters` to `false`; otherwise `${...}` remains an active
build-time delimiter and the collision is still there.

**★ A property is set in `src/main/resources/application.properties` but absent in tests. Explain.**
`target/test-classes` comes before `target/classes` on the test classpath, so
a same-named file under `src/test/resources` is found first — and resource
resolution returns the *first* match, it does not merge. The test file
replaced the main file wholesale, taking every setting it did not itself
restate with it. Fix by completing the test file or by naming it differently
and loading it explicitly.

---

← Prev: [Layout and multi-module projects](README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Multi-module and the reactor](02-multi-module-and-the-reactor.md)
