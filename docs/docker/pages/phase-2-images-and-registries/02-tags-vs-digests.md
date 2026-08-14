---
title: "Tags move, digests do not"
sidebar_label: "02 · Tags vs digests"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the
> [OCI Image Specification](https://github.com/opencontainers/image-spec/blob/main/spec.md),
> the [OCI Distribution Specification](https://github.com/opencontainers/distribution-spec/blob/main/spec.md)
> and [docker image pull](https://docs.docker.com/reference/cli/docker/image/pull/).
> **No sandbox** — no console output on this page.

**A tag is a mutable pointer. A digest is the content's own hash.** One of them
can silently become a different image overnight; the other cannot, by
construction.

## The difference

| | Tag | Digest |
|---|---|---|
| Example | `node:24` | `node@sha256:9f2c…` |
| Points to | Whatever the publisher last pushed under that name | Exactly one set of bytes |
| Can change | **Yes, at any time** | **No** — the name *is* the content hash |
| Readable | Yes | No |
| Right for | Humans, docs, "give me the current one" | Builds, deploys, anything reproducible |

A digest is the SHA-256 of the image manifest. Change one byte anywhere in the
image and the manifest changes, so the digest changes. The registry cannot serve
different content under the same digest — not by policy, but because the name
would no longer match.

```bash
docker pull node:24
docker inspect --format '{{index .RepoDigests 0}}' node:24   # the digest it resolved to
docker pull node@sha256:9f2c…                                # exact, forever
```

## Why this matters more than it sounds

**`node:24` is not a version. It is a subscription.** The publisher moves it on
every patch release, every base-image security update, every rebuild. Pulling it
today and tomorrow can legitimately give you two different images.

That is usually *desirable* — you want security patches. It is a problem when:

- **A build stops being reproducible.** The same Dockerfile, the same commit,
  built a month apart, produces different images. Debugging "it worked last
  week" then means diffing two images you cannot identify.
- **CI and production disagree.** CI pulled `node:24` on Monday; production
  pulled it on Wednesday, after the tag moved. You tested a different image from
  the one you shipped.
- **`latest` is worst of all.** It is a tag like any other with no special
  meaning, but it is the one that moves most often and says least about what it
  is.

## The habit: pin what you ship, float what you develop

```dockerfile
# Reproducible: the exact image, whatever happens upstream
FROM node:24.9.0-slim@sha256:9f2c…

# Readable and current: fine for a scratch experiment
FROM node:24
```

Two supporting practices make digest pinning livable rather than painful:

1. **Keep the human-readable tag next to the digest**, as above. The tag
   documents what it is; the digest is what actually resolves. Docker uses the
   digest and ignores the tag when both are present.
2. **Automate the bump.** Renovate or Dependabot open a pull request when the
   upstream tag moves, so you get patches *deliberately* and with a diff, rather
   than silently. Without this, pinning becomes "we are three years behind on
   security updates", which is a worse failure than the one it prevents.

## Digests inside your own pipeline

The same idea applies to images you build:

```bash
# Build, push, and capture the digest that was pushed
docker buildx build --push -t ghcr.io/myorg/api:1.4.2 .
docker buildx imagetools inspect ghcr.io/myorg/api:1.4.2   # shows the digest
```

Then **deploy the digest, not the tag.** Promoting a digest through dev →
staging → production guarantees the bytes are identical at every step. Promoting
a tag guarantees only that the name is the same, which is exactly the property
that fails when someone rebuilds and re-pushes. Phase 12.

## Podman

Identical semantics — `podman pull image@sha256:…` works the same way, and
`podman image inspect` reports `RepoDigests`. Both engines implement the OCI
distribution spec's content addressing, so a digest is portable between them.

## Gotchas

**Symptom:** The same Dockerfile produces different images on different days.
**Cause:** An unpinned base image tag moved.
**Fix:** Pin by digest, and automate the bump so you still get patches. Note that
`apt-get install` and similar are a second, separate source of drift — Phase 4.

**Symptom:** "It worked in CI but failed in production" with identical code.
**Cause:** Different images behind the same tag, pulled at different times.
**Fix:** Build once, push once, and deploy the **digest** everywhere. This is the
single most effective fix for that class of bug.

**Symptom:** A digest-pinned build fails with "manifest unknown".
**Cause:** The image was deleted from the registry, or the registry garbage-
collected an untagged manifest.
**Fix:** Keep a tag pointing at anything you pin, so it is not eligible for
collection. Mirror critical base images into your own registry if the upstream
retention policy is not under your control.

**Symptom:** Pinning by digest and never updating.
**Cause:** Pinning without automation.
**Fix:** Renovate or Dependabot. Pinning is only half the practice; the other
half is a scheduled, reviewable bump. Frozen and unpatched is not "reproducible",
it is stale.

## Interview questions

**★ What is the difference between a tag and a digest?**
A tag is a mutable pointer the publisher can move at any time; a digest is the
SHA-256 of the image manifest, so it names exactly one set of bytes and cannot be
reassigned. Tags are for humans, digests are for reproducibility.

**★ Why is `FROM node:24` a risk in a production Dockerfile?**
The tag moves. The same Dockerfile built at two different times can produce
different images, so builds stop being reproducible and what you tested may not
be what you shipped. Pin by digest and automate the bump.

**★ How do you guarantee that what you tested is what you deployed?**
Build the image once, push it, and promote it by **digest** through every
environment. Promoting a tag only guarantees the name matches; the content behind
it can change.

**Is pinning by digest enough for a reproducible build?**
No. The base image is one input among many — package installs, `npm install`
without a lockfile, and network-fetched files all drift. Pinning the base is
necessary, not sufficient. Phase 4.

**What is the downside of digest pinning, and how do you handle it?**
You stop receiving upstream patches automatically. Handle it with Renovate or
Dependabot raising a pull request when the tag moves, so updates arrive
deliberately with a review, rather than silently or not at all.

---

← Prev: [Image references](01-image-references.md) · Index: [Phase 2](README.md) · Next → [pull, push, images, tag, rmi](03-pull-push-tag.md)
