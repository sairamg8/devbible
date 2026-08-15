---
title: "Reproducible builds"
sidebar_label: "16 · Reproducible builds"
sidebar_position: 16
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against
> [Docker — reproducible builds with GitHub Actions](https://docs.docker.com/build/ci/github-actions/reproducible-builds/),
> [the BuildKit project's `build-repro.md`](https://github.com/moby/buildkit/blob/master/docs/build-repro.md),
> [Docker — build cache invalidation](https://docs.docker.com/build/cache/invalidation/) and
> [reproducible-builds.org on `SOURCE_DATE_EPOCH`](https://reproducible-builds.org/docs/source-date-epoch/).
> **No sandbox** — no console output on this page.

**Two builds of the same commit should produce the same image digest.** They
usually do not, and the reasons are worth knowing even if you never chase full
bit-for-bit reproducibility — because each reason is also a reason your build is
less predictable than you think.

## Why it is hard

Same Dockerfile, same commit, an hour apart, different digest. The usual causes,
roughly in order of how often they are the culprit:

| Cause | Why it differs |
|---|---|
| **Timestamps** | Every file's mtime and the image's `created` field record *now* |
| **A moving base tag** | `node:22-alpine` is republished; you built on a different image |
| **Package resolution** | `apt-get install curl` gets whatever version the mirror has today |
| **Unpinned dependencies** | A lockfile-less install resolves fresh |
| **Non-deterministic tooling** | Archives with unsorted entries, embedded build paths, generated ids |

The first is the one a tool can fix for you. The rest are your Dockerfile's
problem.

## `SOURCE_DATE_EPOCH`

The cross-ecosystem standard for "pretend the build happened at this time", and
BuildKit consumes it:

> Setting the environment variable for a build makes "the timestamps in the image
> index, config, and file metadata reflect the specified Unix time."

Two common values:

```bash
# a fixed baseline
docker build --build-arg SOURCE_DATE_EPOCH=0 .

# the commit's own timestamp — reproducible per commit
docker build --build-arg SOURCE_DATE_EPOCH=$(git log -1 --pretty=%ct) .
```

The Dockerfile frontend has consumed it as a special build argument since
BuildKit 0.11, and buildx propagates `$SOURCE_DATE_EPOCH` from the client
environment automatically, so exporting it in CI is often enough.

Applying it to the timestamps of files *inside* the image needs the exporter
option as well:

```bash
docker buildx build \
  --output type=image,name=registry.example.com/app:1.0,push=true,rewrite-timestamp=true .
```

`rewrite-timestamp` is available since BuildKit v0.13.

**The cache interaction, which surprises everyone:** `WORKDIR` takes
`SOURCE_DATE_EPOCH` into account when checking the cache, so feeding it a commit
timestamp invalidates on every commit. The documentation calls that intentional
and suggests a fixed `--build-arg SOURCE_DATE_EPOCH=0` when you want
reproducibility without paying the invalidation
([page 01](01-how-the-cache-decides.md)). You are choosing between
*reproducible per commit* and *cacheable across commits*.

## Pinning the base by digest

A tag is a moving pointer; a digest is not:

```dockerfile
FROM node:22-alpine@sha256:<64 hex characters>
```

Now `FROM` resolves to exactly one image forever, and the "why did the whole
build rebuild?" answer stops being "upstream republished the tag".

The cost is real and is the tension the syllabus names: **a pinned digest does
not receive security patches.** Pinning without automation means shipping a base
image that ages. The workable arrangement is pin **and** automate the bump —
Dependabot, Renovate or an equivalent opening a pull request when the tag moves —
so the update is a reviewed commit rather than an accident of timing. Phase 5
picks this up as a supply-chain question rather than a reproducibility one.

## The other pins

Reproducibility is the sum of every input, and the tool only fixes timestamps:

- **Lockfiles, strictly applied.** `npm ci`, `pip install -r` with hashes,
  `go.sum` — see [page 03](03-dependency-install-pattern.md). An install that
  *resolves* is not reproducible by construction.
- **System packages by version.** `apt-get install -y curl=7.88.1-10+deb12u5`
  rather than `curl`. Painful to maintain, and the only way to make that layer
  deterministic; most projects accept the non-determinism here and pin the base
  image instead.
- **A fixed build context.** A git-URL context at a full 40-character commit hash
  ([page 15](15-the-build-context.md)) removes "what was in the working tree".

## How close can you actually get?

Honestly: **close, with effort, and not always all the way.** Timestamps and
digest-pinned bases remove the large sources of variance, and for a
self-contained Go or Rust binary a byte-identical rebuild is achievable. For a
Node or Python image that installs system packages from a live mirror, the
mirror's contents are outside your control and the last few bytes may not line
up.

:::note What this page does not claim
This track has no sandbox, so nothing here was measured. Whether a *particular*
image rebuilds to an identical digest depends on its base, its package manager
and its toolchain, and the documentation does not enumerate the residual
differences. Test it on the image you care about rather than assuming either
outcome.
:::

The pragmatic target for most teams is not bit-for-bit identity but **explicable
difference**: every input pinned or recorded, so that when two builds differ you
can say why. Digest-pinned base, lockfile-strict install, `SOURCE_DATE_EPOCH`
from the commit, and the commit recorded in a `LABEL`
([Phase 3 · LABEL](../phase-3-dockerfile/12-label-and-metadata.md)) gets you
there and is worth doing regardless.

## Podman

Buildah does not fetch BuildKit frontends ([page 08](08-buildkit.md)), so
`SOURCE_DATE_EPOCH` handling and any exporter option such as `rewrite-timestamp`
depend on the installed Buildah version rather than on a pinned frontend.
Digest-pinning, lockfile discipline and version-pinned system packages are
Dockerfile-level and carry over unchanged — they are the portable part of this
page.

## Gotchas

**Symptom:** Every build produces a different digest although nothing changed.
**Cause:** Timestamps, at minimum; often a moving base tag as well.
**Fix:** `SOURCE_DATE_EPOCH`, plus `rewrite-timestamp=true` for file metadata,
plus a digest-pinned base.

**Symptom:** Adding `SOURCE_DATE_EPOCH` destroyed the build cache.
**Cause:** A commit-derived value, which `WORKDIR` takes into account — so it
changes every commit.
**Fix:** Use a fixed value (`0`) if cacheability matters more than per-commit
reproducibility. You cannot have both from that one variable.

**Symptom:** A digest-pinned image fails a vulnerability scan months later.
**Cause:** Pinning froze the base, including its unpatched libraries.
**Fix:** Automate the bump. Pinning without a renewal process trades one problem
for another.

**Symptom:** Two builds of the same commit install different package versions.
**Cause:** Unpinned system packages resolving against a live mirror.
**Fix:** Pin versions, or accept it and pin the base image digest so at least the
starting point is fixed.

## Interview questions

**★ Why do two builds of the same commit produce different images?**
Timestamps recorded in file metadata and the image config; a moving base tag
resolving to a new image; package managers resolving fresh versions; and
non-deterministic tooling. Only the first is fixed by a build flag.

**★ What does `SOURCE_DATE_EPOCH` do?**
It makes "the timestamps in the image index, config, and file metadata reflect
the specified Unix time". BuildKit consumes it as a build argument, buildx
propagates it from the environment, and `rewrite-timestamp=true` on the image
exporter applies it to files inside the image.

**★ What is the trade-off in pinning a base image by digest?**
Reproducibility against patching. A digest resolves to exactly one image forever,
which is what you want for determinism and terrible for security unless the bump
is automated. Pin and automate the update, or do not pin.

**Why might adding `SOURCE_DATE_EPOCH` slow your builds down?**
Because `WORKDIR` takes it into account for cache checking, so a commit-derived
value invalidates on every commit. A fixed value avoids that at the cost of
per-commit reproducibility.

**Is full bit-for-bit reproducibility achievable?**
For a self-contained static binary, often yes. For an image installing system
packages from a live mirror, the mirror is outside your control. The realistic
goal is that every input is pinned or recorded, so any difference between two
builds is explicable.

---

← Prev: [The build context](15-the-build-context.md) · Index: [Phase 4](README.md) · Next phase → [Phase 5 · Image quality, size and supply chain](../phase-5-image-quality/README.md)
