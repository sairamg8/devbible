---
title: "Trusting the wrapper — and what it does not pin"
sidebar_label: "2 · Supply chain and toolchains"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Gradle User Manual *Gradle Wrapper* and
> *Best Practices for Security* (docs.gradle.org/current), the `Wrapper` task
> javadoc (`--gradle-distribution-sha256-sum`), the `gradle/actions`
> wrapper-validation documentation and blog.gradle.org's *Verifying Gradle
> Wrappers with GitHub Actions*; the Apache Maven Wrapper documentation for
> `distributionSha256Sum` and `wrapperSha256Sum` (parameters since wrapper
> 3.2.0); and gradle.org/whats-new/gradle-9 for Gradle 9's Java 17 runtime
> requirement.

**A committed `gradle-wrapper.jar` is an executable that runs on every
developer machine and every CI agent before any of your build logic does, in
a binary file no reviewer inspects. That is a real supply-chain exposure with
two independent defences, and most repositories deploy only one of them. It
is also the point at which people notice the wrapper's limits: it pins the
build tool, and nothing else — the JDK is a separate mechanism entirely.**

## The exposure

Gradle's own blog states the scale plainly: the wrapper jar is a binary blob
of executable code checked into millions of GitHub repositories, and a pull
request that "only upgrades the Gradle version" legitimately touches exactly
that file. A modified jar could download, install and execute arbitrary code
while otherwise behaving like a completely normal wrapper — and the diff a
reviewer sees is "binary file changed".

Notice what makes this attractive as an attack: the change is **expected**.
Nobody is suspicious of a wrapper jar changing in a version-bump PR, because
that is precisely what a version bump does.

## Defence one — verify the jar

Check every `gradle-wrapper.jar` in the repository against the SHA-256
checksums published for official Gradle releases, and fail the build on
anything unknown. That is what the recurring "Gradle wrapper validation"
GitHub Action does, and it exists for exactly this reason.

Since v4, `gradle/actions/setup-gradle` performs the validation on every
execution, so most repositories no longer need a standalone step. Any CI
system can implement the same check against the published checksum list — the
mechanism is not GitHub-specific, only the packaging is.

This defence protects the **repository**: it makes a substituted bootstrap
fail loudly rather than run silently.

## Defence two — pin the download

Checksums in the properties file make the *download* verifiable rather than
trusted.

```properties
# gradle/wrapper/gradle-wrapper.properties
distributionUrl=https\://services.gradle.org/distributions/gradle-9.7.0-bin.zip
distributionSha256Sum=<64 lowercase hex characters>
```

```properties
# .mvn/wrapper/maven-wrapper.properties  (both since wrapper 3.2.0)
distributionSha256Sum=<64 lowercase hex characters>
wrapperSha256Sum=<64 lowercase hex characters>
```

Gradle can write its value for you at generation time:

```bash
./gradlew wrapper --gradle-version 9.7.0 --gradle-distribution-sha256-sum <sha256>
```

Without a checksum the wrapper trusts whatever the URL returns. This defence
protects the **network path**: a compromised mirror, a hijacked DNS entry or a
man in the middle cannot substitute a different distribution.

## Why you want both

| | Protects against | Blind to |
|---|---|---|
| Wrapper-jar validation | a malicious commit replacing the bootstrap | a tampered *distribution* served from the URL |
| `distributionSha256Sum` | a tampered download from any source | a malicious jar that never reaches the download step |

They cover different attackers, and each is blind to the other's. Doing one
is common; doing both is correct, and neither is expensive.

⚠️ One related hygiene point that belongs in code review: the properties file
should point at the official distribution host over HTTPS. A wrapper quietly
repointed at an internal mirror is a legitimate configuration in many
companies — and an excellent hiding place in a malicious PR. It deserves the
same review attention as the jar, and it is a one-line diff that *is* human
readable, so there is no excuse for missing it.

## Wrappers vs toolchains — the confusion worth clearing

These solve adjacent problems, and people substitute one for the other
constantly.

| | Pins | Mechanism | Fails without it |
|---|---|---|---|
| **Wrapper** | the **build tool** — Maven or Gradle | a committed script + properties file | a plugin behaves differently on someone's older Maven; CI and the laptop disagree |
| **Toolchain** | the **JDK** used to compile, test and run | a declaration inside the build, with auto-provisioning | code compiles against whatever JDK is on `PATH`; bytecode targets the wrong release |

They are complementary and you want both. The wrapper guarantees everyone
runs Gradle 9.7.0; the toolchain guarantees that Gradle 9.7.0 compiles with
JDK 25 regardless of what is installed on the machine.

The wrapper structurally *cannot* do the toolchain's job. Gradle 9 requires
Java 17 or newer to run, and the JVM it runs on is simply whichever one
launched `./gradlew` — the wrapper downloads Gradle, not a JDK. That gap is
exactly why toolchains exist as a separate mechanism, and it gets its own
topic: [Toolchains](../12-toolchains.md).

```kotlin
// the two pins, side by side
// gradle/wrapper/gradle-wrapper.properties  →  which Gradle
java {
    toolchain { languageVersion = JavaLanguageVersion.of(25) }   // which JDK
}
```

A third, overlapping tool is the per-project JDK version manager covered in
**[version managers](../../phase-0-platform-jvm/09-version-managers.md)**.
It is genuinely useful for the *developer's shell* — but it is not committed
to the repository, so it pins nothing for CI. Only the toolchain declaration
does that.

## What a wrapper does not reproduce

Being honest about the limits, because the wrapper is often sold as more than
it is. It pins the build tool. It does not pin:

- **the JDK** — that is the toolchain;
- **your dependency versions** — that is a BOM/platform and a lock or
  verification file;
- **the OS, shell, locale or filesystem case-sensitivity** — a build can
  still differ across platforms for reasons nothing in the build tool sees;
- **the network** — a repository that serves a different artifact for the
  same coordinate defeats every pin above it;
- **plugin versions**, unless they are pinned in the build itself.

A build can be irreproducible in all five dimensions with a perfect wrapper
in place. The wrapper is the cheapest and most universally applicable of the
pins, not a completeness claim — and reaching for containerised builds,
`--release`-based compilation and dependency verification for the rest is
proportionate, not paranoid.

## Gotchas

**Symptom:** a pull request titled "bump Gradle" changes `gradle-wrapper.jar` and nobody can meaningfully review the diff
**Cause:** the jar is executable code, and a version bump legitimately changes it — which is exactly what makes it a good hiding place
**Fix:** run wrapper validation in CI (`gradle/actions/setup-gradle` v4+ does it automatically) so an unknown jar fails the build, and set `distributionSha256Sum` so the download is pinned too

**Symptom:** `distributionUrl` was bumped to a new version and the build now fails on a checksum mismatch
**Cause:** `distributionSha256Sum` still holds the checksum of the *old* distribution
**Fix:** update both lines together — the failure is the mechanism working exactly as designed, and deleting the checksum to "fix" it throws the defence away

**Symptom:** wrapper validation passes on CI, and a developer still ran a tampered jar
**Cause:** validation runs in the pipeline, after the developer has already built locally; the jar executes on `git checkout` plus the first `./gradlew`, not on merge
**Fix:** validate on pull requests before review, not only on `main`; treat wrapper-jar changes as requiring an explicit reviewer, the same as a CI configuration change

**Symptom:** two developers get different results and both are "on the same Gradle version"
**Cause:** the wrapper pinned Gradle but not the JDK, and they are compiling on different Java versions
**Fix:** declare a toolchain; the wrapper was never going to solve this, and expecting it to is the confusion the comparison table above exists to clear

**Symptom:** `distributionUrl` points at an internal mirror and nobody can say when that changed
**Cause:** a one-line properties edit that looks like routine configuration and receives no scrutiny
**Fix:** review the properties file as security-relevant, keep it on HTTPS, and pair a mirrored URL with a checksum so the mirror's contents are still verified

**Symptom:** a team adds a toolchain and concludes the wrapper is now redundant
**Cause:** the two pins were read as alternatives rather than as different layers
**Fix:** keep both — without the wrapper, a different Gradle version can change plugin behaviour, resolution and configuration-cache compatibility, none of which the JDK pin touches

## Interview questions

**★ What attack does wrapper-jar validation defend against?**
Replacement of the committed `gradle-wrapper.jar` with a modified one that
executes arbitrary code while otherwise behaving normally — delivered as a
pull request that looks like a routine version bump, in a binary file no
reviewer inspects. Validation checks every wrapper jar's SHA-256 against the
checksums published for official Gradle releases and fails on anything
unknown; `setup-gradle` v4+ does it on every run.

**★ Checksum in the properties file, or wrapper-jar validation in CI — which do you need?**
Both, because they cover different attackers and each is blind to the other.
`distributionSha256Sum` protects the download: a compromised mirror or a man
in the middle cannot substitute a different distribution. Wrapper-jar
validation protects the repository: a malicious commit cannot substitute a
different bootstrap. Either alone leaves a real path open.

**★ Wrapper or toolchain — which pins the JDK?**
The toolchain. The wrapper pins the build tool; the JVM running the wrapper
is simply whatever is on `PATH`, and Gradle 9 only requires it to be 17 or
newer. The toolchain declares which JDK compiles and tests your code, and can
provision it. They are complementary layers, and conflating them is the most
common cause of "we pinned everything and builds still differ".

**★ Why can the wrapper not just download the right JDK too?**
Because that is a different job with a different lifetime: the JDK a project
compiles *against* is a property of the code, changes on its own schedule,
and may differ per source set or per task. Folding it into the build tool's
bootstrap would tie the two together permanently. Toolchains keep the
decision in the build, where it can be declared per project and provisioned
on demand.

**★ Name three things a wrapper does not reproduce.**
The JDK (toolchain's job), the dependency versions (a platform/BOM plus
dependency verification), and the operating environment — OS, locale,
filesystem case-sensitivity, network. A build can differ in all of those with
a perfect wrapper in place, which is why the wrapper is the cheapest pin
rather than a reproducibility guarantee.

**★ A reviewer sees `distributionUrl` changed from `services.gradle.org` to an internal host. Concern or not?**
Worth a question either way. It is a completely legitimate configuration —
most enterprises mirror distributions — and it is also the one human-readable
place a wrapper can be repointed at something hostile. Because it is a
one-line, reviewable diff, there is no reason to let it pass unexamined, and
pairing it with `distributionSha256Sum` keeps the mirror's contents verified
regardless of who runs it.

---

← Prev: [What a wrapper is, and why it is committed](01-what-a-wrapper-is.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Layout and multi-module projects](../06-layout-and-multi-module/README.md)
