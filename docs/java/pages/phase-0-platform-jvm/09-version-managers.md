---
title: "Version managers: one JDK per project, on purpose"
sidebar_label: "09 · Version managers"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the SDKMAN! usage documentation
> ([sdkman.io/usage](https://sdkman.io/usage)), the Maven Toolchains guide
> ([maven.apache.org/guides/mini/guide-using-toolchains.html](https://maven.apache.org/guides/mini/guide-using-toolchains.html)),
> and the Gradle toolchains documentation
> ([docs.gradle.org — toolchains](https://docs.gradle.org/current/userguide/toolchains.html)).

**A machine accumulates JDKs — the LTS the team targets, the one an old
project needs, the new release someone tried. Which one actually runs is
decided by `JAVA_HOME` and `PATH`, and those are set in at least four
uncoordinated places: the shell, the IDE, the build tool, and CI. Version
managers exist to make the answer *per-project and written down* instead of
*per-machine and remembered*. Every "works on my machine" that involves a
class-file version error is this page.**

## SDKMAN!: the JDK as a managed, switchable tool

SDKMAN! is the de-facto version manager on the JVM (bash/zsh; on Windows it
runs under WSL or Git Bash). The working vocabulary:

```bash
sdk list java                     # every distribution × version, with identifiers
sdk install java 25.0.1-tem       # install: version 25.0.1, Temurin distribution
sdk use java 25.0.1-tem           # this shell only
sdk default java 25.0.1-tem       # every new shell
sdk current java                  # what am I actually on?
```

The identifier encodes *distribution* as well as version — `-tem` (Temurin),
`-amzn` (Corretto), `-zulu`, `-oracle`. Pinning both matters: distributions
differ in support windows and occasionally in bundled extras (topic 02), so
"Java 25" is not a complete answer to "what do we build on".

Mechanically there is no magic: SDKMAN! installs JDKs under
`~/.sdkman/candidates/java/` and repoints a `current` symlink that sits on
your `PATH`, exporting `JAVA_HOME` to match. Everything downstream — `java`,
`javac`, Maven — resolves through those two variables.

## `.sdkmanrc`: the pin that lives in the repo

Per-project pinning is a checked-in `.sdkmanrc` file:

```bash
# .sdkmanrc
java=25.0.1-tem
```

```bash
sdk env install    # install whatever the file names
sdk env            # switch this shell to the file's versions
```

With `sdkman_auto_env=true` in SDKMAN!'s config, `cd`-ing into the project
applies it automatically. The point is sociological as much as technical:
**the JDK version becomes a reviewed artifact in the repository** — new
laptop, new teammate, same JDK, by running one command instead of reading a
wiki page that drifted.

## The four places that must agree

A JDK mismatch is rarely the shell's fault alone — it is disagreement among:

1. **The shell** — SDKMAN!'s `JAVA_HOME`/`PATH`. What `mvn`/`gradle` from a
   terminal use.
2. **The IDE** — IntelliJ's *Project SDK* is configured in the IDE, ignores
   your shell entirely, and (separately!) the *Gradle JVM* setting decides
   what runs Gradle builds inside the IDE. Two settings, both capable of
   disagreeing with the terminal.
3. **The build tool** — which JVM *runs* Maven/Gradle, versus which JDK
   *compiles the code* (toolchains, below).
4. **CI** — whatever the workflow's setup step installs (e.g. a
   `setup-java` action pinning distribution + version).

The failure signature of disagreement is the one from
[topic 01](01-what-java-is/01-source-to-bytecode.md):
`UnsupportedClassVersionError` — *locally*, when the IDE built with 25 and
the terminal runs 17, or CI builds with 21 and a laptop runs older.

## Toolchains: the build-level pin

Maven and Gradle can decouple "the JVM running the build tool" from "the JDK
compiling and testing the code":

- **Gradle toolchains** — the build script declares
  `java { toolchain { languageVersion = JavaLanguageVersion.of(25) } }`;
  Gradle locates a matching installed JDK (and can auto-provision one),
  regardless of which JVM launched Gradle.
- **Maven toolchains** — `~/.m2/toolchains.xml` lists installed JDKs; the
  project's `maven-toolchains-plugin` requests a version.

Toolchains answer *which JDK*; `--release` (topic 01 / Phase 8) answers
*which API level* — they compose: build with 25, target 21 bytecode and API,
and the pin is enforced by the build itself, the only place every
environment (shell, IDE, CI) actually converges.

## Gotchas

**Symptom:** code builds in IntelliJ, then `UnsupportedClassVersionError` when run from the terminal (or vice versa)
**Cause:** IDE Project SDK and shell `JAVA_HOME` point at different JDK majors — two of the four places disagreeing
**Fix:** align them to the `.sdkmanrc`/toolchain pin; check all of: `sdk current java`, IntelliJ Project SDK, IntelliJ's Gradle JVM, and `mvn -version`/`gradle -version` (each prints the JVM it runs on)

**Symptom:** `.sdkmanrc` exists but a teammate is on the wrong JDK anyway
**Cause:** `sdk env` is not applied automatically by default — the file does nothing until `sdk env` runs or `sdkman_auto_env=true` is set
**Fix:** `sdk env install && sdk env` in the project; recommend the auto-env config in the project README

**Symptom:** `sdk use` seems ignored; every new terminal reverts to an old JDK
**Cause:** `JAVA_HOME` is exported in `.bashrc`/`.zshrc` *after* SDKMAN!'s init line, overriding what SDKMAN! set — or `use` was expected to persist (it is shell-local; `default` persists)
**Fix:** remove hand-exported `JAVA_HOME` from shell rc files and let SDKMAN! own it; use `sdk default` for the machine-wide choice

**Symptom:** IntelliJ builds use a different JDK than IntelliJ's terminal tab
**Cause:** the embedded terminal inherits the shell environment; the build uses Project SDK / Gradle JVM settings — different configuration paths by design
**Fix:** treat the IDE settings as first-class config to align, not as something the shell fixes

**Symptom:** Gradle keeps compiling with an old JDK after the machine's default changed
**Cause:** the long-lived Gradle daemon still runs on the JVM it started with
**Fix:** `gradle --stop` (or the toolchain declaration, which makes the daemon's own JVM irrelevant to compilation)

**Symptom:** CI is green, laptops fail — or the reverse — with no code difference
**Cause:** CI's pinned distribution+version differs from the laptops' unpinned one; the pin exists in only one of the four places
**Fix:** one source of truth: toolchain declaration in the build (enforced everywhere the build runs) plus `.sdkmanrc` for humans; CI reads the same version number

**Symptom:** on an ARM Mac, a freshly installed JDK runs but native-adjacent tooling misbehaves or is slow
**Cause:** an x86_64 JDK installed under Rosetta instead of the aarch64 build — the identifier chosen didn't match the architecture
**Fix:** `sdk list java` shows arch-appropriate builds; verify with `java -version` output naming aarch64 — the WORA leak from [topic 01](01-what-java-is/03-write-once-run-anywhere.md) applied to the JDK itself

## Interview questions

**★ How do you make sure a whole team builds a project with the same JDK?**
Pin it where every environment converges: a toolchain declaration in the
build (Gradle `languageVersion` / Maven toolchains) so the build itself
enforces the JDK, plus a checked-in `.sdkmanrc` so humans get the right
default, plus CI reading the same version. The wiki page is not a pin.

**★ What do `JAVA_HOME` and `PATH` each control?**
`PATH` decides which `java`/`javac` binaries a shell finds; `JAVA_HOME` is
the conventional variable tools (Maven, Gradle, servers' start scripts) use
to locate the JDK — many honor it over `PATH`. Version managers keep the two
consistent; hand-editing one and not the other is a classic mismatch source.

**★ IntelliJ runs the code fine; `mvn` in the terminal fails with `UnsupportedClassVersionError`. Diagnose it.**
The IDE compiled with its Project SDK (newer), the terminal Maven runs on
the shell's older `JAVA_HOME` JVM. Confirm with `mvn -version` and the IDE's
Project SDK setting; fix by aligning both to the project's pinned version —
and add a toolchain so the build enforces it regardless.

**What is the difference between a toolchain and `--release`?**
A toolchain selects *which installed JDK* compiles/tests (a machine-level
concern); `--release` selects *which Java API and class-file version* the
compilation targets (an artifact-level concern). Build with the 25 toolchain
and `--release 21` and you've pinned both independently.

**Why pin the distribution and not just the version number?**
Distributions (Temurin, Corretto, Zulu, Oracle) build the same OpenJDK
source but differ in support lifecycles, patch cadence and licensing — and
"Java 25" from two vendors can go end-of-support years apart. The SDKMAN!
identifier (`25.0.1-tem`) captures both halves of the decision (topic 02).

**What does the Gradle daemon have to do with JDK switching?**
The daemon is a long-lived JVM that survives shell changes — switch JDKs and
the daemon keeps its old one until stopped. Toolchains sidestep it by
separating the daemon's JVM from the compilation JDK; otherwise
`gradle --stop` after switching.

---

← Prev: [Garbage collection, the working model](08-garbage-collection.md) · Next → [The standard library layout](10-stdlib-layout.md)
