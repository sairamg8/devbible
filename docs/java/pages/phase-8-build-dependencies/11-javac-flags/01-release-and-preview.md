---
title: "Targeting a release: --release, -source/-target, --enable-preview"
sidebar_label: "01 · Targeting a release"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the JDK 25 `javac` tool specification
> (docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html), JEP 247
> (Compile for Older Platform Versions), JEP 182 (Policy for Retiring javac
> `-source` and `-target` Options), JEP 12 (Preview Features), the Apache
> Maven Compiler Plugin `release` documentation, and the Gradle user guide
> (`options.release`, toolchains).

**`-source`/`-target` describe the *language* and the *class-file version*
and nothing else — the compiler still resolves your method calls against the
JDK it is running on, so a jar built that way can compile cleanly today and
throw `NoSuchMethodError` on the target runtime tomorrow. `--release N` adds
the missing half: it also restricts the visible API to what release N
actually shipped. That is the entire reason it exists, and it is why
`-source`/`-target` should be considered a legacy pairing.**

## What each option actually controls

| Option | Controls | Does **not** control |
|---|---|---|
| `-source N` | which language constructs are accepted | the API you may call; the class-file version |
| `-target N` | the class-file major version written | the API you may call; the language accepted |
| `--release N` | language, class-file version **and the visible Java SE + JDK API** | the JVM you actually run on |

The specification is explicit that `--release` "compiles source code
according to the rules of the Java programming language for the specified
Java SE release, generating class files which target that release", with
source compiled "against the combined Java SE and JDK API for the specified
release" — and that you **cannot** combine `--release` with `-source`/
`-target`.

The mechanism is a file that ships with every JDK: `$JAVA_HOME/lib/ct.sym`
holds historical API *signatures* for the releases the compiler supports. With
`--release 17`, `javac` resolves against the Java 17 signature set rather than
the running JDK's `java.base`, so a method that did not exist in 17 is a
compile error, in your build, on your machine.

## The failure `-source`/`-target` produces, concretely

The canonical example is `java.nio.ByteBuffer`. In Java 8, `ByteBuffer.flip()`
was inherited from `Buffer` and returned `Buffer`. In Java 9 the `ByteBuffer`
subclasses gained covariant overrides returning `ByteBuffer`. A method call is
compiled into the class file with the *descriptor* the compiler resolved, so
code compiled on JDK 9+ emits a reference to `ByteBuffer.flip()ByteBuffer` —
a method that does not exist on a Java 8 runtime. `-source 8 -target 8`
happily produces that class file, because neither flag has any opinion about
which overload was resolved. The result is a build that is green, an artifact
whose class-file version says "Java 8", and a `NoSuchMethodError` the first
time that line executes on Java 8 — possibly months later, in whichever code
path nobody tested. `--release 8` rejects it at compile time.

A second, quieter consequence: `--release` also hides JDK-internal packages.
Code that reaches for `sun.misc.*` or a `jdk.internal.*` class compiles under
`-source`/`-target` and fails under `--release`, which is usually what you
want to find out.

**When `-source`/`-target` is still the answer:** only when you genuinely need
them to differ (compiling old language level while emitting a newer class-file
version — rare, and usually a smell), or when `--release` no longer supports
the release you need. The spec's wording for all three is "the current Java SE
release and a limited number of previous releases"; JEP 182 sets the retiring
policy. Run `javac --help` on the JDK in front of you for the list it accepts
rather than trusting a number from a blog post — it moves every few releases.

## How the build tools spell it

Maven, via the compiler plugin — the property form is the one you will see
most:

```xml
<properties>
  <maven.compiler.release>25</maven.compiler.release>
</properties>
```

or explicitly, which is where you also add raw flags:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-compiler-plugin</artifactId>
  <configuration>
    <release>25</release>
    <compilerArgs>
      <arg>-Xlint:all</arg>
    </compilerArgs>
  </configuration>
</plugin>
```

Setting `<source>`/`<target>` instead — or the old
`maven.compiler.source`/`maven.compiler.target` properties — reproduces the
`NoSuchMethodError` hazard above. Spring Boot's parent POM exposes a
`<java.version>` property that feeds `release`; that is the same mechanism,
one layer up.

Gradle:

```kotlin
java {
    toolchain { languageVersion = JavaLanguageVersion.of(25) }
}

tasks.withType<JavaCompile>().configureEach {
    options.release = 21          // API level, independent of the toolchain
}
```

The Gradle documentation is direct that `release` "ensures the specified
language level is used regardless of which compiler actually performs the
compilation", and that `sourceCompatibility`/`targetCompatibility` are the
older, weaker pair. Note the two are orthogonal and often both wanted: the
toolchain says *which JDK compiles and runs the tests*, `release` says *which
API that JDK is allowed to expose to you*. That composition is the subject of
[topic 12](../12-toolchains.md).

## `--enable-preview` — and why it never ships

Preview features are complete language or VM features shipped for feedback,
not for production, and JEP 12 enforces that with a mechanism rather than a
policy document.

- It must be passed at **compile time and again at run time**. `javac
  --release 25 --enable-preview` and `java --enable-preview -jar app.jar`.
  Forgetting the runtime half is a `UnsupportedClassVersionError`-shaped
  failure at class load, not a warning.
- With `--release`, **N must be the current release**. You cannot preview a
  feature "for Java 21" on a Java 25 compiler.
- The class file is stamped: major version for the release, `minor_version`
  with **all 16 bits set** (65535). A JDK 25 preview class file is `69.65535`.
- The JVM **refuses to load** such a class file unless `--enable-preview` is
  given, and **refuses outright** if its own major version differs. Preview
  code compiled on JDK 25 does not run on JDK 26 — it is not deprecated, not
  warned about, it does not load.

Which yields the operational rule: **preview features do not belong in a
published artifact.** Anything you deploy will eventually be run by someone
on a JDK you did not choose — a base image bump, an ops upgrade, a consumer's
runtime — and on that day the class file simply fails to load. Use previews in
a spike, in a scratch module, in a test you are willing to delete. Not in a
library, and not in a service whose base image is patched by someone else.
`javac` also emits mandatory preview warnings; `-Xlint:preview` controls the
detail.

## Gotchas

**Symptom:** a jar with class-file version 52 (Java 8) throws `NoSuchMethodError: java.nio.ByteBuffer.flip()Ljava/nio/ByteBuffer;` on a Java 8 JVM
**Cause:** built on a newer JDK with `-source 8 -target 8`; those flags set the language level and class-file version but let the compiler resolve against the *building* JDK's API, so a Java 9+ covariant override was baked into the call site
**Fix:** `--release 8` (Maven `<release>`, Gradle `options.release`) so the API surface matches the target too; the same class of bug hides behind any method whose signature changed

**Symptom:** switching from `<source>/<target>` to `<release>` breaks the build with "package sun.misc does not exist"
**Cause:** `--release` restricts you to the documented API for that release and hides JDK-internal packages
**Fix:** this is the flag working — replace the internal API (`VarHandle`, the FFM API, a supported alternative) rather than reverting; if you truly cannot, that dependency is now visible and dated instead of silent

**Symptom:** `javac` refuses with an error about combining options
**Cause:** `--release` cannot be used together with `-source`/`-target`; build tools that set both (often one via a property inherited from a parent POM) hit this
**Fix:** pick one — `release` — and remove the inherited `maven.compiler.source`/`target` properties rather than layering another override

**Symptom:** an application built with `--enable-preview` fails to start after a base-image upgrade, with no code change
**Cause:** preview class files pin `minor_version` 65535 to one major version; a JDK of any other release refuses to load them
**Fix:** rebuild on the new JDK, and then remove the preview feature from anything you ship — the incident recurs on every upgrade otherwise

**Symptom:** tests pass locally and the packaged app throws at class load in CI or production
**Cause:** `--enable-preview` was configured on the compile task only; the runtime JVM was never given it
**Fix:** add it to the launcher too — Maven Surefire `<argLine>`, Gradle `tasks.test { jvmArgs("--enable-preview") }`, and the actual start command; and treat needing it in three places as the signal not to ship preview code

**Symptom:** `--release 25` compiles code the team believed was Java 21-compatible
**Cause:** `release` was set to the JDK's own version, so nothing constrains you to the deployment target
**Fix:** set `release` to the *lowest runtime you support*, not to the JDK you happen to have installed — that is the only setting that turns a runtime failure into a compile error

**Symptom:** a library builds and publishes fine, and consumers on an older Java report `UnsupportedClassVersionError` at class load
**Cause:** `release` was never set, so the class-file version is that of the building JDK — the artifact is simply newer than the consumer's runtime
**Fix:** set `release` to the oldest Java you claim to support and state it in the README; for a published library this is a compatibility contract, not a build detail

## Interview questions

**★ What is the difference between `-source`/`-target` and `--release`, and why does it matter in production?**
`-source` sets the language level, `-target` the class-file version — neither
changes which API the compiler resolves against, so it resolves against the
JDK running the build. `--release` sets both *and* restricts the visible Java
SE and JDK API to what that release shipped, using the historical signature
data in `ct.sym`. The production consequence is concrete: with
`-source 8 -target 8` on a modern JDK you can compile a call to a method that
does not exist on Java 8, ship a jar that claims to be Java 8, and get a
`NoSuchMethodError` at runtime. `--release 8` makes that a compile error.

**★ Give the canonical example of the `-target`-only failure.**
`ByteBuffer.flip()`. On Java 8 it is inherited from `Buffer` and returns
`Buffer`; from Java 9 `ByteBuffer` declares a covariant override returning
`ByteBuffer`. Compiling on JDK 9+ emits a call site with the newer
descriptor, which does not resolve on a Java 8 runtime. It is a good example
because nothing about the source code looks version-specific and the build is
green.

**★ Why can `--release` not be combined with `-source`/`-target`?**
Because they are competing answers to the same question. `--release N` is
defined as "language, class-file version and API of release N" — a single
coherent configuration. Allowing `-source`/`-target` alongside would let you
express incoherent combinations (an API surface from one release, a class-file
version from another) which is exactly the class of mistake `--release` was
introduced to remove.

**★ What does `--enable-preview` do to the artifact, and what follows?**
It stamps the class file's `minor_version` with all 16 bits set (65535)
against the current major version, and the JVM refuses to load such a file
unless `--enable-preview` is passed *and* its own major version matches. So a
preview-compiled class runs on exactly one JDK release — the one it was
compiled on. It follows that preview features must not appear in published
libraries or in services whose runtime someone else upgrades: the failure
mode is not a deprecation warning, it is a class that will not load after a
base-image bump.

**★ If you use a JDK 25 toolchain but deploy on Java 21, what do you set?**
Both. The toolchain (or `JAVA_HOME`) determines which compiler binary and
which test JVM run; `--release 21` determines which API and class-file
version that compiler produces. Setting only the toolchain gives you Java 25
bytecode that will not load on 21; setting only `release` leaves the actual
compiler and — crucially — the *test* JVM as whatever the machine happened to
have. See [topic 12](../12-toolchains.md).

**★ Where do you get the authoritative list of releases your `javac` accepts?**
From that JDK: `javac --help` prints the supported `--release`/`-source`/
`-target` values. The specification only says "the current Java SE release
and a limited number of previous releases", and JEP 182 defines the policy by
which old ones are retired, so any specific number is a fact about one JDK
version rather than about Java.

---

Index: [`javac` flags that matter](README.md) · Next → [Parameter names and debug info](02-parameters-and-debug-info.md)
