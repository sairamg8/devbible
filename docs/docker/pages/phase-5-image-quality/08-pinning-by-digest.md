---
title: "Pinning base images by digest"
sidebar_label: "08 · Pinning by digest"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [the Dockerfile reference — `FROM`](https://docs.docker.com/reference/dockerfile/#from),
> [`docker buildx imagetools inspect`](https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect/),
> [Docker — build cache invalidation](https://docs.docker.com/build/cache/invalidation/),
> [Docker Scout](https://docs.docker.com/scout/) and
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html).
> **No sandbox** — no console output on this page.

**A tag is a name someone else can repoint; a digest is the content.** Pinning by
digest is how you make `FROM` mean exactly one image forever — and the reason not
everyone does it is that "forever" includes "unpatched forever".

## Tags move, digests do not

```dockerfile
FROM node:22-alpine                                    # a moving pointer
FROM node:22-alpine@sha256:<64 hex characters>         # exactly one image
```

`node:22-alpine` is republished — for a Node patch release, an Alpine update, a
security fix — and the same Dockerfile then builds on different content without
changing a character. The digest form is a content address: it either resolves to
that exact image or fails.

Three things this fixes at once:

| Problem | How the digest fixes it |
|---|---|
| **"Why did the whole build rebuild?"** | The base no longer changes underneath you ([Phase 4 · how the cache decides](../phase-4-build-strategy/01-how-the-cache-decides.md)) |
| **"It works on my machine"** | Two people, two months apart, get the same base |
| **"Which base was that image built on?"** | The Dockerfile says, exactly |

And it makes a supply-chain substitution much harder: a compromised registry
account can repoint a tag, and cannot change what a digest resolves to.

## Getting the digest

Read it from the registry without pulling the image — the command "show[s]
details of an image in the registry":

```bash
docker buildx imagetools inspect node:22-alpine --format '{{.Name}}'
docker buildx imagetools inspect node:22-alpine --raw
```

`--raw` gives the unformatted JSON manifest, which for a multi-architecture tag
is the manifest *list*. Pin the **list** digest, not a per-platform one — that
keeps the multi-architecture behaviour, so an arm64 machine still gets the arm64
image
([Phase 4 · buildx and platforms](../phase-4-build-strategy/11-buildx-and-platforms.md)).

**Keep the tag in the reference.** `node:22-alpine@sha256:…` is strictly better
than `node@sha256:…`: the digest is what resolves, and the tag tells a human what
they are looking at. A bare digest is unreadable and every review of it is a
guess.

## The cost, stated plainly

**A pinned base does not receive security patches.** When upstream publishes a
fix, the tag moves and your digest does not. Six months later your image is
running whatever was current on the day you pinned, and the scanner
([page 07](07-vulnerability-scanning.md)) will tell you so in a long list you
cannot fix without changing the pin.

So digest pinning without an update process is **worse** than not pinning: an
unpinned tag at least picks up patches whenever you happen to rebuild. Pinning
converts an implicit, accidental update into an explicit one — which is an
improvement only if the explicit update actually happens.

## Pin *and* automate — the only workable arrangement

```
pin the digest  →  a bot notices the tag moved  →  a pull request bumps the pin
                →  CI builds and tests it       →  a human merges it
```

Dependabot and Renovate both do the middle steps for Dockerfile `FROM` lines.
What that buys you over an unpinned tag:

- **The update is a commit**, so it is reviewable, revertable and visible in
  `git log` — you can answer "when did the base change?" months later.
- **It is tested before it lands**, rather than arriving in whatever build
  happened next.
- **Nothing changes silently**, including on a Friday.

The cadence is the real decision. Weekly is a reasonable default for most
services; a rebuild triggered by a scanner finding is better still. The
anti-pattern is a repository whose pins were set once, two years ago, and whose
bot pull requests are all still open.

## Pinning is not only for the base

The same argument applies to everything the build pulls in, and the base is
simply the largest:

- **Lockfiles**, strictly applied — `npm ci`, `pip` with hashes, `go.sum`
  ([Phase 4 · the dependency-install pattern](../phase-4-build-strategy/03-dependency-install-pattern.md)).
- **`COPY --from=<image>`**, which is another base image wearing a different hat
  ([Phase 4 · `COPY --from`](../phase-4-build-strategy/07-copy-from.md)) — pin it
  by digest too.
- **The Dockerfile frontend**: `# syntax=docker/dockerfile:1` is itself a moving
  tag, and it can be pinned to a specific version when a build must not change
  language underneath it.
- **CI actions and tool downloads**, which are outside this track but the same
  reasoning.

An image whose base is pinned and whose dependencies float is only partly pinned.

## Where the record goes

Pin the input, and record it in the output. An OCI label makes the built image
self-describing months later
([Phase 3 · LABEL and image metadata](../phase-3-dockerfile/12-label-and-metadata.md)):

```dockerfile
ARG BASE_DIGEST
LABEL org.opencontainers.image.base.digest=$BASE_DIGEST
LABEL org.opencontainers.image.revision=$GIT_SHA
```

Note the placement: build arguments consumed near the bottom of the file so they
do not invalidate everything above them
([Phase 4 · build args versus runtime env](../phase-4-build-strategy/13-build-args-vs-runtime-env.md)).

## Podman

`FROM image:tag@sha256:…` is Dockerfile syntax, so it behaves identically under
`podman build`. Two Podman-specific notes:

- **Fully qualify the registry.** Short-name resolution differs, so
  `docker.io/library/node:22-alpine@sha256:…` rather than the bare name
  ([Phase 4 · docker vs podman vs buildah](../phase-4-build-strategy/14-docker-vs-podman-vs-buildah.md)).
- **`podman manifest inspect`** is the equivalent of the imagetools command for
  reading a manifest list's digest.

## Gotchas

**Symptom:** A digest-pinned image accumulates vulnerabilities over months.
**Cause:** The pin froze the base; upstream patches went to the tag.
**Fix:** Automate the bump. Pinning without a renewal process is the failure
mode, not the pin itself.

**Symptom:** After pinning, arm64 machines pull an amd64 image.
**Cause:** A per-platform manifest digest was pinned instead of the manifest
list's.
**Fix:** Pin the list digest — inspect with `--raw` and take the top-level one.

**Symptom:** The build fails with the base image not found, and it worked
yesterday.
**Cause:** The digest was garbage-collected or the repository was pruned; a
digest that no longer exists cannot be resolved by a fallback.
**Fix:** Re-pin to a current digest, and consider mirroring bases you depend on
into your own registry.

**Symptom:** Nobody can tell what `FROM node@sha256:9f2b…` is.
**Cause:** The tag was dropped from the reference.
**Fix:** Keep both — `node:22-alpine@sha256:…`. The digest resolves; the tag
informs the reader.

## Interview questions

**★ What is the difference between pinning by tag and by digest?**
A tag is a mutable pointer the publisher can repoint, so the same Dockerfile can
build on different content over time. A digest is a content address: it resolves
to exactly one image or fails. Pinning by digest makes the base reproducible and
makes a tag-repointing substitution attack ineffective.

**★ What is the cost, and how do you manage it?**
A pinned base stops receiving security patches, so the image ages. The only
workable arrangement is pin **and** automate — a bot opens a pull request when
the tag moves, CI tests it, a human merges. Without that, pinning is worse than
not pinning, because an unpinned tag at least picks up fixes on rebuild.

**★ Why keep the tag alongside the digest?**
Readability. `node:22-alpine@sha256:…` resolves by digest while telling a reviewer
what the image is; a bare digest makes every review a lookup, and stale bare
digests never get questioned.

**What else should be pinned besides the base?**
Dependency lockfiles applied strictly, any `COPY --from=<image>` source, the
Dockerfile frontend in `# syntax=`, and CI tooling. An image with a pinned base
and floating dependencies is only partly reproducible.

**Which digest do you pin for a multi-architecture image?**
The manifest **list** digest, not a per-platform manifest's — otherwise every
architecture gets the one image you pinned. Read it from the registry with
`docker buildx imagetools inspect --raw`, which needs no pull.

---

← Prev: [Vulnerability scanning](07-vulnerability-scanning.md) · Index: [Phase 5](README.md) · Next → [Supply-chain risk](09-supply-chain-risk.md)
