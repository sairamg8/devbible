---
title: "Semver as practiced, and how to upgrade"
sidebar_label: "1 · Semver & upgrading"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against semver.org 2.0.0, the JLS SE 25 chapter on
> binary compatibility, the japicmp documentation (including its
> `--semantic-versioning` reporting) and the Revapi project documentation,
> the JDK 25 javadoc for `java.lang.Deprecated` (`since`, `forRemoval`;
> both added in JDK 9) and the `javac` `-Xlint:removal` option, the Maven
> documentation on SNAPSHOT versions, dependency version ranges and
> `LATEST`/`RELEASE`, "Maven CI Friendly Versions", and the MojoHaus
> versions-maven-plugin goal reference.

**Nothing enforces semantic versioning. It is a promise a maintainer makes in
prose, and on the JVM it is broken often enough that the version number is a
hint, not a guarantee. The practical consequence is that upgrading is a
*verification* activity, not a lookup: you read the release notes, you check
binary compatibility against the bytecode, and you run your tests — and the
one thing you never do is let a tool bump everything because newer numbers
exist.**

## What semver promises, and what libraries do

Semver 2.0.0 says `MAJOR.MINOR.PATCH`: MAJOR for incompatible API changes,
MINOR for backwards-compatible additions, PATCH for backwards-compatible
fixes. That is a clean contract. Real JVM practice diverges in four
predictable ways.

- **MAJOR bumps really do break, and sometimes catastrophically.** Log4j 1.x
  to 2.x was a rewrite with a different API and different configuration — not
  an upgrade, a migration. The Jakarta EE `javax.*` → `jakarta.*` namespace
  change touched every import in every affected library; downstream projects
  had to move in lockstep, and a jar built against `javax.servlet` simply does
  not link against `jakarta.servlet`.
- **Some projects version by policy or cadence, not by contract.** A MAJOR
  number can mark an era, a support window, or a marketing line as easily as a
  breaking change; some libraries use date-based versions where the leading
  number carries no compatibility meaning at all. Read the project's stated
  policy before assuming its numbers mean what semver.org says.
- **MINOR releases break things by accident.** Adding a method to an interface
  is source-compatible for implementers only if it has a default; changing a
  return type from a concrete class to an interface compiles fine and breaks
  every already-compiled caller at link time. Nobody intends these; they ship
  anyway.
- **The version you upgrade is not the only version that changed.** Bumping
  one library bumps whatever it depends on, and mediation may hand you a
  transitive version you never chose.

**The upshot: the number tells you how much attention to pay, not whether you
are safe.** MAJOR means read the migration guide. MINOR means read the release
notes. PATCH means read the changelog anyway, because that is where a security
fix hides alongside a behaviour change someone considered a fix.

## Binary compatibility is not source compatibility

The JLS defines *binary compatibility* precisely, and it is the property that
matters for dependencies — because you do not recompile your dependencies'
callers, you link against their jars.

| | Source-compatible | Binary-compatible |
|---|---|---|
| Question | Does calling code still **compile**? | Does already-compiled code still **link and run**? |
| Broken by | removing a method, narrowing a parameter, adding an abstract interface method without a default | removing/renaming a method or field, changing a method's return type or parameter types, changing a field's type, reducing visibility |
| Sneaky case | adding an overload can make a previously unambiguous call ambiguous | changing a `public static final` primitive/`String` constant — it was **inlined** into the caller at compile time, so the old value persists |

That last row is the one people find surprising: a compile-time constant is
copied into every class that referenced it, so bumping the library does not
change the value already baked into your jar. It is binary-compatible in the
sense that nothing crashes — and semantically wrong, silently.

Two tools automate the check by comparing bytecode across two versions of a
jar rather than trusting the version number:

- **japicmp** — a CLI and Maven plugin that diffs two jars, distinguishes
  source- from binary-incompatible changes, and can report which semver
  component you *should* have incremented (`--semantic-versioning`). Adopted
  by projects such as OpenTelemetry to gate their own releases.
- **Revapi** — the same idea with a Maven and a Gradle plugin, oriented toward
  failing your build when your library's public API or ABI breaks.

Both are worth running on *your own* published libraries, not just on your
dependencies. A library that gates its releases this way is a library whose
version numbers you can actually trust.

## Deprecation is the signal that upgrading is coming

Java's deprecation vocabulary got precise in JDK 9:

```java
@Deprecated(since = "21", forRemoval = true)
public void oldApi() { … }
```

`forRemoval = true` is a terminal deprecation: the API is scheduled to go.
`javac -Xlint:removal` warns on uses of it — and unlike ordinary deprecation
warnings, this is the one worth failing the build on, because it is the only
compile-time notice you will get before the method vanishes in some future
release. `since` tells you how long you have had.

A library with a deprecation cycle is telling you the upgrade path in advance.
A library that removes things without one is telling you something too.

## SNAPSHOT versions and reproducibility

A version ending in `-SNAPSHOT` is explicitly **mutable**: it names "the
current state of that branch", not a fixed artifact. Maven treats it
specially — deployed snapshots get timestamped filenames in the remote
repository, and the local repository re-checks for a newer one on a schedule
governed by the repository's `<updatePolicy>` (`-U` forces the check now).

That is exactly what you want for your *own* modules mid-development, and
exactly what you must not have in a dependency, because:

- **The build is not reproducible.** The same commit built today and next
  Tuesday can resolve different bytes. When something breaks, "what changed?"
  has no answer, because the change is not in your history.
- **You cannot release.** The maven-release-plugin refuses to release a
  project with SNAPSHOT dependencies, for this reason.
- **It is a supply-chain hole.** A mutable artifact you re-fetch is an
  artifact somebody else can change after you reviewed it.

The same reasoning condemns **version ranges** (`[1.2,2.0)`) and the
`LATEST`/`RELEASE` pseudo-versions — deprecated in Maven 3 and long
discouraged. They make resolution depend on when you built, which is the
definition of non-reproducible. The correct shape is pinned versions in
`<dependencyManagement>` (or a Gradle version catalog), changed by a commit
you can point at.

⚠️ The `${revision}` CI-friendly-versions pattern is the *legitimate* use of a
version property, and it is not the same thing: the value is pinned at build
time and the flatten plugin bakes the resolved value into the published POM.

## The versions plugins

Maven, via MojoHaus versions-maven-plugin:

```bash
mvn versions:display-dependency-updates   # what has newer releases
mvn versions:display-plugin-updates       # the half everyone forgets
mvn versions:display-property-updates     # for versions held in <properties>
mvn versions:use-latest-releases          # rewrite the POM to the newest release
mvn versions:set -DnewVersion=1.5.0       # bump this project's own version
```

Gradle's equivalents are the `com.github.ben-manes.versions` plugin's
`dependencyUpdates` task, and — more importantly — **version catalogs**
(`gradle/libs.versions.toml`), which give a single declared place for every
version across every module.

Both ecosystems also support a lockfile-ish discipline: Gradle has dependency
locking; Maven's nearest equivalent is a fully-pinned `dependencyManagement`
plus the maven-enforcer-plugin's `requireUpperBoundDeps` and banned-dependency
rules.

## Why "upgrade everything" is not a strategy

`versions:use-latest-releases` will happily rewrite forty versions at once. The
resulting commit is unreviewable, and that is the whole problem:

- **You lose the bisect.** Forty upgrades in one commit means a regression has
  forty candidate causes and no cheap way to narrow them.
- **It optimises the wrong variable.** Being current is not a goal; being
  *supported and not-known-vulnerable* is. A dependency two minors behind with
  no open CVEs and an active maintainer is fine. A dependency on the newest
  release of an abandoned project is not.
- **Churn has a cost and no owner.** Every bump is a chance to break something
  in a way tests do not catch — behaviour changes, logging changes, default
  changes — spent on libraries nobody asked to change.
- **It does not tell you which upgrades were security-relevant**, which is the
  only category with a deadline attached.

The workable shape is boring: keep everything *supported*, upgrade in small
reviewable batches on a schedule, upgrade immediately for security, and let
the scanning tooling in
[chunk 2](02-cve-scanning-and-sboms.md) tell you which is which. Bots
(Dependabot, Renovate) fit this well precisely because they raise **one PR per
dependency** with the changelog attached — the unit of review matches the unit
of change.

## Gotchas

**Symptom:** a PATCH upgrade of a library changes behaviour in production
**Cause:** the maintainer classified a behaviour change as a bug fix; semver says nothing about behaviour that was never specified, and nothing enforces the classification anyway
**Fix:** read the changelog even for PATCH; version numbers rank how much attention to pay, they do not grant permission to skip reading

**Symptom:** you bump a library's `<version>` and a completely different library's version changes too
**Cause:** the bump changed that library's own transitive dependencies, and mediation picked a different winner across the whole tree
**Fix:** diff the resolved tree before and after (`dependency:tree`), not just the POM; pin the versions you care about in `<dependencyManagement>` so mediation cannot move them

**Symptom:** a constant read from a dependency still has its old value after the upgrade
**Cause:** `public static final` primitives and `String`s are compile-time constants and get inlined into the *calling* class file; swapping the jar does not change the copy in your bytecode
**Fix:** recompile against the new version, and prefer a static accessor method over a public constant in APIs you own

**Symptom:** code compiles against the new library but throws `NoSuchMethodError` at runtime
**Cause:** a binary-incompatible change — a return type or parameter type changed — combined with something else on the classpath still compiled against the old signature
**Fix:** this is a binary- versus source-compatibility gap; check the tree for a second copy of the library, and use japicmp/Revapi on your own artifacts to catch it before publication

**Symptom:** the same commit builds green one day and fails the next, with no change in git
**Cause:** a `-SNAPSHOT` dependency, a version range, or `LATEST`/`RELEASE` — the resolution depends on *when* you built
**Fix:** pin every dependency to a released version; SNAPSHOT is for your own modules mid-development and nothing else

**Symptom:** the release plugin refuses to cut a release
**Cause:** at least one dependency (often a forgotten internal one) is still on a SNAPSHOT version
**Fix:** release the dependency first. The refusal is correct — a release referencing mutable artifacts is not reproducible and its provenance cannot be attested

**Symptom:** `versions:display-dependency-updates` looks clean, and the build is still using ancient plugins
**Cause:** it reports *dependency* updates; plugin versions are a separate goal
**Fix:** run `versions:display-plugin-updates` too, and pin every plugin version in `<pluginManagement>` — an unpinned plugin version is the same reproducibility hole as an unpinned dependency

**Symptom:** an automated "update all dependencies" PR passes CI and breaks staging, and nobody can say which bump did it
**Cause:** forty upgrades in one commit; the failing change has forty candidates
**Fix:** one dependency per PR, which is exactly what Dependabot and Renovate produce; reserve bulk rewrites for a deliberate, tested migration with a rollback plan

**Symptom:** an API you use disappears in the next MINOR release with no warning you noticed
**Cause:** it had been annotated `@Deprecated(forRemoval = true)` for two releases and the warning was one of hundreds in the build log
**Fix:** turn on `-Xlint:removal` and fail the build on it. Terminal deprecation is the only advance notice the language gives you

## Interview questions

**★ Does a MAJOR version bump mean the API broke?**
It means the maintainer said so, and nothing checks. Plenty of JVM projects
version by cadence, support window or marketing era rather than by
compatibility contract, and plenty of MINOR releases break something by
accident. Treat the number as a signal of how carefully to read the release
notes, and verify the actual claim with a bytecode-level tool — japicmp or
Revapi — if the upgrade matters.

**★ Binary compatibility versus source compatibility — why does the distinction matter for dependencies?**
Because you compile *your* code but you link against *their* jars. Source
compatibility asks whether calling code still compiles; binary compatibility
asks whether already-compiled code still links and runs. A change can be one
without the other in both directions: adding a default method is
binary-compatible and can break source compilation via ambiguity, while
changing a return type compiles fine for anyone rebuilding and throws
`NoSuchMethodError` for anyone who did not. Since your build is full of jars
you did not rebuild, binary compatibility is the property that governs.

**★ Why is a SNAPSHOT dependency a problem, when a SNAPSHOT of your own module is normal?**
Because the two answer different questions. Your own module's SNAPSHOT is
"the current state of the branch I am working on", which is exactly right
mid-development. A SNAPSHOT *dependency* means the same commit can resolve
different bytes on different days, so the build is not reproducible, "what
changed?" has no answer in your history, and the artifact is mutable after you
reviewed it. The release plugin refuses to release with one, which is the
tooling agreeing.

**★ Why is a compile-time constant a versioning hazard?**
`public static final` primitives and `String`s are inlined by `javac` into
every class that references them. Swapping in a new version of the library
does not update the copy already baked into your bytecode, so you get the old
value with no error anywhere — a silent, binary-"compatible" wrong answer. It
is why public constants are a poor API shape and an accessor method is better.

**★ Talk me through how you actually take a non-trivial upgrade.**
Read the release notes and migration guide for every version you are jumping
over, not just the target. Diff the resolved dependency tree before and after,
because the bump moves transitives too. Run a binary-compatibility report if
the library is one you link deeply against. Run the test suite, then run it
against a realistic dataset, because the failures that matter are behavioural.
Ship it on its own commit or PR so it can be bisected and reverted. And if the
upgrade is being taken for a CVE, note that the *only* reliable fix is the
upgrade — configuration mitigations for a known vulnerability have a poor
historical record.

**★ Your team wants to auto-merge all dependency updates. Argue the other side.**
Being current is not the goal; being supported and not-known-vulnerable is.
Auto-merging everything spends unbounded review risk on churn nobody
requested, destroys bisectability if bumps are batched, and gives no signal
about which updates had a security deadline. A defensible policy separates the
two lanes: security updates get an SLA and a fast path; everything else gets a
schedule, one PR per dependency, and a human who reads the changelog. Bots are
good at producing that shape — the mistake is removing the human, not using
the bot.

---

← Prev: [Versioning, updates and CVE scanning](README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [CVE scanning and SBOMs](02-cve-scanning-and-sboms.md)
