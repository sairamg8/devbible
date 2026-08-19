---
title: "What a wrapper is, and why it is committed"
sidebar_label: "1 · What a wrapper is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Gradle User Manual *Gradle Wrapper*
> (docs.gradle.org/current) and the `Wrapper` task javadoc; the **Apache
> Maven Wrapper** documentation (maven.apache.org/tools/wrapper/) and the
> `wrapper:wrapper` goal reference, which gives `only-script` as the default
> `distributionType` since wrapper 3.2.0; maven.apache.org's release history
> (**Maven 3.9.16**, 2026-05-13, is current). Command syntax only — no build
> was run and no output is reproduced.

**A wrapper is three committed artefacts: a launcher script, a properties
file naming a distribution URL, and — for the forms that need one — a tiny
bootstrap downloader. Together they move the build tool version out of
everyone's `PATH` and into the source tree, where a commit can change it and
a reviewer can see it.**

## The three pieces

1. **A launcher script** — `mvnw`/`mvnw.cmd`, `gradlew`/`gradlew.bat`.
   Committed, executable, and hand-written by nobody.
2. **A properties file** naming the distribution — a URL, optionally a
   checksum. This is the actual version pin.
3. **A bootstrap downloader**, where required: Gradle's
   `gradle-wrapper.jar`, or Maven's `maven-wrapper.jar` /
   `MavenWrapperDownloader.java` depending on the distribution type.

Run `./gradlew build` and the script reads the properties file, checks
whether that distribution is already unpacked under the Gradle user home,
downloads and unpacks it if not, then delegates the build to it. `./mvnw
verify` does the same for Maven, caching under the Maven user home. The first
run on a fresh machine downloads; every subsequent run does not.

### Gradle's files

```
gradlew
gradlew.bat
gradle/wrapper/gradle-wrapper.jar
gradle/wrapper/gradle-wrapper.properties
```

```properties
# gradle/wrapper/gradle-wrapper.properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-9.7.0-bin.zip
distributionSha256Sum=<64 lowercase hex characters>
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
```

`distributionUrl` is the pin. `bin` is the runtime-only distribution; `all`
additionally ships sources and documentation, which some IDEs use for better
completion inside build scripts and which costs a much larger download.
`networkTimeout` defaults to 10000 ms, and `validateDistributionUrl` — on by
default — checks the configured URL before using it.

### Maven's files

```
mvnw
mvnw.cmd
.mvn/wrapper/maven-wrapper.properties
.mvn/wrapper/maven-wrapper.jar        # only when distributionType=bin
```

```properties
# .mvn/wrapper/maven-wrapper.properties
wrapperVersion=3.3.4
distributionType=only-script
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.16/apache-maven-3.9.16-bin.zip
distributionSha256Sum=<64 lowercase hex characters>
```

Maven's wrapper versions **two** things independently: `distributionUrl` pins
the Maven you build with, `wrapperVersion` pins the wrapper implementation
itself. They move separately, and reviewers routinely read one as the other.

## The Maven distribution types, and why `only-script` matters

Maven's wrapper takes a `type` (persisted as `distributionType`), and the
default has been **`only-script`** since wrapper 3.2.0:

| Type | Ships | Bootstraps Maven by |
|---|---|---|
| `only-script` | scripts only — **the default** | the shell script itself, using `curl`/`wget`/PowerShell |
| `script` | scripts only, older lite form | the script |
| `bin` | scripts + `maven-wrapper.jar` | running that jar |
| `source` | scripts + `MavenWrapperDownloader.java` | compiling that source on the fly, then running it |

`only-script` exists precisely to remove the committed binary. If your
repository has a policy against binaries in version control — or you simply
do not want an executable jar in the tree that nobody reads — this is the
answer, and it is what you get by default today. `bin` is still common in
older repos because it used to be the default.

Gradle has no equivalent: `gradle-wrapper.jar` is required. That asymmetry is
why the supply-chain discussion in the next chunk is a Gradle story first.

## Generating and upgrading one

```bash
# Maven — uses the running Maven's version unless you name one
mvn wrapper:wrapper
mvn wrapper:wrapper -Dmaven=3.9.16
mvn wrapper:wrapper -Dmaven=3.9.16 -Dtype=bin

# Gradle — run the wrapper task, then run it AGAIN through ./gradlew
gradle wrapper --gradle-version 9.7.0
./gradlew wrapper --gradle-version 9.7.0 --distribution-type bin \
          --gradle-distribution-sha256-sum <sha256>
```

The Gradle two-step catches everyone once. `gradle wrapper --gradle-version
X` writes the properties file, but the *scripts and the jar* are still the
ones produced by the Gradle you invoked. Running `./gradlew wrapper` a second
time regenerates them with version X. Upgrading a wrapper is therefore two
commands, and skipping the second leaves a mismatched pair that mostly works
and occasionally does not.

Maven's trap is different: with no `-Dmaven=`, `mvn wrapper:wrapper` pins
whatever Maven you happened to be running. That records an accident rather
than a decision.

## Why these files are committed

Because a wrapper that is not in the repository pins nothing.

- **A clone builds.** No install step, no version instructions in a README
  that drifts, no "which Maven do I need?" on someone's first day.
- **A commit can change the build tool version.** Upgrading Gradle becomes a
  reviewable diff of one properties line, with CI proving it on the same PR.
  Without the wrapper, upgrading means asking every engineer to run a command
  and hoping.
- **`git bisect` still works.** Check out a commit from last year and you get
  last year's build tool, because it was recorded next to the code that
  needed it.
- **CI and the laptop agree by construction.** This is the failure the
  wrapper exists to prevent: a build that works locally and fails on CI — or
  passes CI and fails for a new hire — because a plugin behaves differently
  under the developer's Maven 3.6, or the CI image shipped a newer Gradle
  whose plugin compatibility differs. Neither machine is misconfigured;
  nothing pinned them.

So `.gitignore` must not exclude `gradle-wrapper.jar`, and the scripts must
keep their executable bit.

## What this means for CI

**CI invokes `./mvnw` and `./gradlew`, never `mvn` or `gradle`.** A pipeline
step that calls the bare command has silently opted out of everything above
and now depends on whatever the runner image ships — which changes without
your involvement, on someone else's schedule.

```yaml
# correct
- run: ./mvnw -B verify
- run: ./gradlew build --no-daemon
```

Two practical notes. `-B` (batch mode) keeps Maven's output free of the
progress spinner that makes CI logs unreadable. And `--no-daemon` on CI is
conventional because the daemon's warm-JVM benefit needs repeated builds in
one workspace, which an ephemeral runner never provides — though on a
persistent, reused runner the daemon is worth keeping.

## Gotchas

**Symptom:** `./gradlew: Permission denied` on a fresh clone, on Linux and macOS only
**Cause:** the script was committed without its executable bit, usually from Windows
**Fix:** `git update-index --chmod=+x gradlew` and commit; the fix belongs in the repo, not in every clone's `chmod`

**Symptom:** a CI job builds with a different Gradle version than developers do, with no configuration difference anywhere
**Cause:** the pipeline calls `gradle`, not `./gradlew`, so it uses whatever the runner image ships
**Fix:** invoke `./gradlew` and `./mvnw` everywhere; treat a bare `mvn`/`gradle` in a pipeline file as a review blocker

**Symptom:** `gradle wrapper --gradle-version 9.7.0` runs, the properties file updates, and the wrapper still behaves like the old version
**Cause:** the scripts and `gradle-wrapper.jar` were written by the Gradle you invoked; only the properties file names the new version
**Fix:** run `./gradlew wrapper --gradle-version 9.7.0` a second time, through the wrapper itself, and commit all four files together

**Symptom:** a `.gitignore` rule for `*.jar` silently drops `gradle-wrapper.jar` and clones fail with a missing-class error
**Cause:** a broad binary-exclusion rule caught the one jar that must be committed
**Fix:** add an explicit negation (`!gradle/wrapper/gradle-wrapper.jar`) — or, on Maven, use the default `only-script` type, where the problem does not exist

**Symptom:** the first build on a locked-down corporate network hangs and then fails
**Cause:** the wrapper is trying to reach the public distribution host and cannot
**Fix:** point `distributionUrl` at the internal mirror and supply credentials through the supported environment variables (`MVNW_USERNAME`/`MVNW_PASSWORD` for Maven; Gradle's wrapper user/password system properties) — over HTTPS only, never plain HTTP

**Symptom:** a repo's `maven-wrapper.properties` pins Maven 3.8.1 and nobody remembers deciding that
**Cause:** `mvn wrapper:wrapper` was run with no `-Dmaven=`, so it recorded whatever Maven the author happened to have installed
**Fix:** name the version explicitly and re-run; a pin is only useful when it was chosen

**Symptom:** developers on Windows report the wrapper works and Linux CI cannot find `mvnw`
**Cause:** only `mvnw.cmd` was committed, or line endings were mangled by an aggressive `.gitattributes` rule so the shell cannot parse the script
**Fix:** commit both scripts, and keep LF endings for `mvnw`/`gradlew` (`* text=auto` plus explicit `eol=lf` for those two files)

## Interview questions

**★ What is a wrapper, mechanically, and what does it pin?**
A committed launcher script plus a properties file naming a distribution URL
(and optionally its checksum), with a small bootstrap downloader for the
forms that need one. On invocation the script resolves that distribution,
downloads and caches it if absent, and delegates the build to it. What it
pins is the **build tool version** — nothing else.

**★ Concretely, what failure does the wrapper prevent?**
The build that works on a developer's machine and fails on CI, or passes CI
and fails for a new hire, because a plugin behaves differently on the older
Maven that happened to be installed or the CI image shipped a Gradle with
different plugin compatibility. Neither environment is wrong; nothing pinned
them. With a wrapper, the version is a line in a reviewed file and identical
everywhere.

**★ Why does Maven ship an `only-script` wrapper and Gradle does not?**
Because Maven found a way to bootstrap without a binary: the script itself
downloads the distribution with `curl`, `wget` or PowerShell, so nothing
executable is committed. It has been the default `distributionType` since
wrapper 3.2.0. Gradle's `gradle-wrapper.jar` is still required, which is why
Gradle needs a validation story that Maven's default type does not.

**★ Why is upgrading the Gradle wrapper two commands?**
Because the first run writes the new `distributionUrl` into the properties
file using the Gradle you invoked, which also produced the scripts and jar.
Running `./gradlew wrapper --gradle-version X` a second time — now through
the new version — regenerates the scripts and jar to match. Committing only
the properties change leaves a mismatched set.

**★ Should the wrapper files be in `.gitignore`?**
Never. Committing them is the entire mechanism: an uncommitted wrapper pins
nothing, a fresh clone cannot build, and `git bisect` loses the build tool
that went with old commits. The common accident is a blanket `*.jar` rule
catching `gradle-wrapper.jar`, which needs an explicit negation.

**★ Why `--no-daemon` on CI but not locally?**
The daemon's value is a warm JVM and in-memory caches reused across
invocations in one workspace. An ephemeral CI runner builds once and is
destroyed, so the daemon costs startup and memory for a benefit it never
collects. On a persistent, reused runner the calculation flips and keeping
the daemon is right.

---

← Prev: [Wrappers](README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Trusting the wrapper — and what it does not pin](02-supply-chain-and-toolchains.md)
