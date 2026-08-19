---
title: "Wrappers"
sidebar_label: "05 · Wrappers"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Gradle User Manual *Gradle Wrapper* and
> *Best Practices for Security* (docs.gradle.org/current); the **Apache Maven
> Wrapper** documentation (maven.apache.org/tools/wrapper/) and the
> `wrapper:wrapper` goal reference, which gives `only-script` as the
> **default** distribution type since wrapper 3.2.0; the `gradle/actions`
> wrapper-validation docs and blog.gradle.org's *Verifying Gradle Wrappers
> with GitHub Actions*; and maven.apache.org's release history
> (**Maven 3.9.16**, 2026-05-13, current; **4.0.0-rc-6** still RC).

**A wrapper is not a convenience script. It is the mechanism that makes the
build tool version part of the source tree, so a new laptop, a CI runner and
a colleague's five-year-old install all build with the same Maven or Gradle
by construction rather than by instruction. The moment a README says "install
Maven 3.9" you have a build that depends on something no reviewer can see and
no commit can pin.**

This topic splits in two:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What a wrapper is, and why it is committed](01-what-a-wrapper-is.md)** | The launcher script, the properties file and the bootstrap downloader; `gradle/wrapper/gradle-wrapper.properties` and `.mvn/wrapper/maven-wrapper.properties`; Maven's `only-script`/`bin`/`source` types; generating and upgrading one; why the files are committed; `./mvnw` not `mvn` on CI |
| 2 | **[Trusting the wrapper — and what it does not pin](02-supply-chain-and-toolchains.md)** | A committed `gradle-wrapper.jar` is an executable you trust; `distributionSha256Sum` and wrapper-jar validation as two different defences; wrappers vs **toolchains**, which people constantly confuse; the honest limits of what a wrapper reproduces |

## Why this topic runs long

- **The two halves have different audiences.** The first is mechanics every
  engineer needs; the second is a security argument that decides CI policy.
- **The supply-chain half is a real, documented exposure**, not a hygiene
  footnote — Gradle publishes a validation action specifically because a
  wrapper jar is executable code that nobody reviews byte by byte.
- **The toolchain confusion needs room to clear properly.** "We pinned
  everything and builds still differ" is nearly always a wrapper doing its
  job while the JDK went unpinned.

## Where this connects

- **[Gradle](../04-gradle/README.md)** — the wrapper is how `./gradlew` is
  invoked in every command on those pages; it also pins the Gradle version
  whose plugin compatibility and configuration-cache behaviour you rely on.
- [Maven core](../01-maven-core/README.md) — topic 01. `./mvnw` runs exactly the
  lifecycle described there, with a version you chose.
- [Toolchains](../12-toolchains.md) — topic 12. The complementary pin: the
  wrapper fixes the build tool, the toolchain fixes the JDK.
- **[Version managers](../../phase-0-platform-jvm/09-version-managers.md)** —
  the developer-shell equivalent for JDKs, and why it is not a substitute for
  a committed pin.

---

← Prev: [Gradle](../04-gradle/README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [What a wrapper is, and why it is committed](01-what-a-wrapper-is.md)
