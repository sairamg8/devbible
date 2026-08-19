---
title: "Versioning, updates and CVE scanning"
sidebar_label: "07 · Versioning, updates & CVEs"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against semver.org 2.0.0, the JLS SE 25 chapter on
> binary compatibility, the japicmp and Revapi project documentation, the
> Maven documentation on SNAPSHOT versions and dependency version ranges, the
> MojoHaus versions-maven-plugin goal reference, the OWASP Dependency-Check
> documentation (report format, suppression, `failBuildOnCVSS`, NVD API key),
> the CycloneDX Maven plugin documentation (`makeBom`, `makeAggregateBom`),
> and the Apache Log4j 2 security page for CVE-2021-44228, CVE-2021-45046 and
> CVE-2021-45105.

**Semantic versioning on the JVM is a promise made by policy, not a contract
enforced by anything — MAJOR bumps do break, MINOR bumps sometimes do too, and
no tool stops a library from lying about it. Everything useful in this topic
follows from accepting that: you assess upgrades with tools that read the
*bytecode*, not the version string, and you assess your exposure with tools
that answer "do we ship this, and where" — because log4shell was not a
patching crisis, it was an inventory crisis, and most organisations lost days
to the question *do we even use it*.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Semver as practiced, and how to upgrade](01-semver-as-practiced.md)** | What semver promises vs what JVM libraries do, binary vs source compatibility and the JLS distinction, japicmp/Revapi, deprecation cycles (`@Deprecated(forRemoval)`, `-Xlint:removal`), how you actually assess an upgrade, SNAPSHOT and reproducibility, version ranges and `LATEST`/`RELEASE`, the versions plugins, and why "upgrade everything" is not a strategy |
| 2 | **[CVE scanning and SBOMs](02-cve-scanning-and-sboms.md)** | OWASP Dependency-Check and how CPE/NVD matching produces its false-positive character, suppression files, `failBuildOnCVSS` and the political problem a gated build creates, Dependabot and Renovate as PR-raising bots, CVSS severity vs your actual risk, reachability and VEX, and SBOMs (CycloneDX, SPDX) plus the regulation that made them mandatory-ish |
| 3 | **[The log4shell lesson](03-the-log4shell-lesson.md)** | CVE-2021-44228 told accurately — mechanism, affected and fixed versions, the follow-on CVEs — then the part that actually matters: why "are we affected?" took days, `dependency:tree` as an operational tool, the shading and fat-jar blind spot, and what to institutionalise so the next one costs hours |

## Why this topic is chunked

The first chunk is about *change* — how a library signals it, how you verify
the signal, how you take an upgrade without breaking. The second is about
*exposure* — tooling that maps what you ship to what is known-vulnerable, and
the organisational failure modes of wiring that into a build gate. The third
is a single incident used as a case study, and it exists to make the first two
concrete: every practice in them is something an organisation adopted after
December 2021 because they could not answer a simple question fast enough.

## Where this connects

- **[Transitive dependencies and mediation](../03-transitive-and-mediation/README.md)**
  — topic 03 in this phase. `dependency:tree` and mediation rules are the mechanism this
  topic uses operationally.
- **[Jar anatomy](../08-jar-anatomy/README.md)** — topic 08. Shading and fat jars are the
  reason a dependency you demonstrably ship can be invisible to a scanner.
- [Artifact repositories](../10-artifact-repositories/README.md) — topic 10. A proxy repository
  is where an organisation gets a chokepoint it can inventory and block at.
- **[The release model](../../phase-0-platform-jvm/03-release-model.md)** —
  the JDK's own versioning and LTS cadence is the same problem solved with an
  unusual amount of discipline; it is a useful contrast to library practice.

---

← Prev: [Layout and multi-module projects](../06-layout-and-multi-module/README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Semver as practiced, and how to upgrade](01-semver-as-practiced.md)
