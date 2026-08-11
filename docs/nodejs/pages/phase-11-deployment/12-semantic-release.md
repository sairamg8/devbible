---
title: "Semantic release and versioning strategy"
sidebar_label: "12 · Semantic release"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. Versioning practice for Node packages and services; tools like
> `semantic-release` are optional automation of the same rules.

**Semantic Versioning (SemVer) tells consumers what broke. Semantic-release automates
version bumps and changelogs from commit messages. Services that only ship container
images still need an honest version string for support and rollbacks.**

## SemVer in one table

| Bump | When | Example |
|---|---|---|
| **MAJOR** | Breaking API / contract change | `2.0.0` |
| **MINOR** | Backward-compatible feature | `2.1.0` |
| **PATCH** | Backward-compatible fix | `2.1.1` |

For **libraries**, this is a promise to `package.json` ranges. For **apps**, the image
tag may be git SHA + marketing version — still record what ran.

## Conventional commits → versions

```text
feat: add export CSV          → MINOR
fix: correct timezone drift  → PATCH
feat!: drop legacy webhook    → MAJOR (breaking)
```

Automation (`semantic-release`, release-please, changesets) reads these and publishes.

## Apps vs libraries

| Ship vehicle | Version strategy |
|---|---|
| npm package | SemVer + lockfile discipline for consumers |
| Container only | Immutable digest; optional `v1.4.2` tag for humans |
| Monorepo | Per-package versions or unified train — pick one and document |

## What goes in the release artifact

- Changelog entry humans can read  
- Git tag  
- Build provenance (who/what CI)  
- For npm: the tarball from CI, not a laptop  

## Gotchas

**Symptom:** Consumers break on a "patch"
**Cause:** Accidental breaking change mislabeled
**Fix:** Treat public HTTP and package API as contracts; review for MAJOR

**Symptom:** `^1.2.3` pulls a surprise minor
**Cause:** SemVer range + publish without changelog culture
**Fix:** Renovate/dependabot + CI; pin critical deps when needed

**Symptom:** Cannot tell what version is in prod
**Cause:** Only `latest` tag
**Fix:** Digest + explicit version labels on Deployment

**Symptom:** semantic-release needs write tokens in CI
**Cause:** Automation pushes tags/releases
**Fix:** Least-privilege bot token; protect main branch

## Interview questions

**★ What do MAJOR, MINOR, and PATCH mean?**
Breaking change, backward-compatible feature, backward-compatible fix.

**Why use conventional commits?**
They machine-map to SemVer bumps and generate changelogs.

**How should a Kubernetes app be versioned?**
Immutable image digest for deploy; human version/tag for communication.

**Is semantic-release required?**
No — it automates policy you must still design.

**What is a false patch?**
A release labeled PATCH that changes behaviour consumers relied on — a SemVer violation.

---

← Prev: [Scaling](./11-scaling.md) · Next → [Blue/green and canary](./13-blue-green-canary.md)
