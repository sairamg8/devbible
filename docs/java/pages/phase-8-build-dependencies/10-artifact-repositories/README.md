---
title: "Artifact repositories"
sidebar_label: "10 · Artifact repositories"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Maven settings reference
> (maven.apache.org/settings.html), the Maven Central documentation at
> central.sonatype.org — Requirements, "Can I change, modify, delete… a
> component on Central?", the OSSRH Sunset announcement (EOL 30 June 2025),
> Register a Namespace, and Publishing Portal Snapshots — plus the Maven
> guide to using mirrors and repository-manager vendor docs (Sonatype Nexus
> routing rules, JFrog Artifactory exclude patterns).

**A dependency does not come from "the internet" — it comes from an ordered
list of repositories, cached in a directory on your disk, and every build
problem people describe as "Maven being weird" is one of those two layers
behaving exactly as documented. The local repository is a cache with no
integrity story, remote repositories are consulted in order, Maven Central is
append-only forever, and an internal proxy exists because both of those facts
are business risks.**

| # | Chunk | What it covers |
|---|---|---|
| 01 | [The local cache, remote repositories and Maven Central](01-local-remote-central.md) | `~/.m2/repository` and why `rm -rf ~/.m2` is superstition; `<repositories>` vs `<pluginRepositories>`; publishing to Central via the Portal; namespace verification, GPG, immutability; snapshots |
| 02 | [Internal proxies, `settings.xml` and dependency confusion](02-proxies-settings-confusion.md) | What Nexus/Artifactory actually do; mirrors, servers, profiles; keeping credentials out of the repo; the confusion attack and the structural mitigation |

## Why this is two files

The topic has a natural seam. Chunk 01 is **how resolution works and where
artifacts come from** — mechanics you need on day one, including the fact
that a Central release can never be taken back. Chunk 02 is **what an
organisation puts in front of that** — the proxy, its credentials, and the
supply-chain attack the arrangement is designed to prevent. You can read 01
alone and build; you cannot make the security argument in 02 without it.

## Where this connects

- **[Phase 0 · Packages and the classpath](../../phase-0-platform-jvm/05-packages-classpath/README.md)**
  — the classpath is what these downloads end up on.
- [Transitive dependencies and mediation](../03-transitive-and-mediation/README.md) — mediation
  decides *which* version; this topic decides *where it comes from*.
- [Versioning, updates and CVE scanning](../07-versioning-updates-cve/README.md) — a repository
  manager is where an organisation answers "what do we depend on?".
- [Wrappers](../05-wrappers/README.md) — the wrapper pins the build tool; the
  mirror pins where everything else comes from.

---

← Prev: [Annotation processing](../09-annotation-processing/README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [`javac` flags that matter](../11-javac-flags/README.md)

Start here → [The local cache, remote repositories and Maven Central](01-local-remote-central.md)
