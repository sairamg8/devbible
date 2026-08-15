---
title: "LABEL and image metadata"
sidebar_label: "12 · LABEL and metadata"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the [Dockerfile reference — LABEL](https://docs.docker.com/reference/dockerfile/#label),
> [Dockerfile reference — MAINTAINER (deprecated)](https://docs.docker.com/reference/dockerfile/#maintainer-deprecated),
> the [OCI Image Specification — annotations](https://github.com/opencontainers/image-spec/blob/main/annotations.md) and
> [GHCR — connecting a repository](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
> **No sandbox** — no console output on this page.

**Labels are arbitrary key–value metadata attached to an image.** They cost one
instruction and answer, months later, the question nobody can otherwise answer:
*where did this image come from?*

> **This page also covers `MAINTAINER`**, which is deprecated and replaced by a
> label — the two topics are one paragraph apart in practice.

## The instruction

```dockerfile
LABEL org.opencontainers.image.source="https://github.com/myorg/api"
```

Several in one instruction is one config change rather than several:

```dockerfile
LABEL org.opencontainers.image.source="https://github.com/myorg/api" \
      org.opencontainers.image.description="Order service API" \
      org.opencontainers.image.licenses="Apache-2.0"
```

Labels are metadata, so they add no filesystem layer
([Phase 2, page 07](../phase-2-images-and-registries/07-image-config.md)).
They are inherited from the base image, and a label you set with the same key
overrides the inherited value.

## The OCI annotation keys

The `org.opencontainers.image.*` namespace is the conventional set. The ones
worth setting:

| Key | Value |
|---|---|
| `.source` | URL of the source repository |
| `.revision` | The exact commit the image was built from |
| `.version` | Human version — a tag or semver |
| `.created` | RFC 3339 build timestamp |
| `.title` / `.description` | Name and one-line description |
| `.licenses` | SPDX identifier |
| `.documentation` | URL to the docs |
| `.base.name` / `.base.digest` | The base image used |

**`.source` earns its place immediately**: GHCR uses it to link a published
package to its repository, so the image appears on the repo page and inherits its
visibility settings. Without it, packages float unattached.

**`.revision` is the one that saves an incident.** Given a running container, it
tells you exactly which commit is deployed:

```bash
docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' myapi
```

## Filling them in at build time

The dynamic ones come from the build:

```dockerfile
ARG GIT_SHA=unknown
ARG BUILD_DATE
ARG VERSION=dev
LABEL org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.version="${VERSION}"
```

```bash
docker build \
  --build-arg GIT_SHA="$(git rev-parse HEAD)" \
  --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --build-arg VERSION="1.4.2" \
  -t myorg/api:1.4.2 .
```

⚠️ **A timestamp label makes the image non-reproducible** — the same source
produces a different image each build. That is usually an acceptable trade for
traceability; if bit-for-bit reproducibility matters, use `SOURCE_DATE_EPOCH`
instead (Phase 4). Worth deciding on purpose rather than discovering later.

In GitHub Actions, `docker/metadata-action` generates the whole OCI set from the
event context, which is less error-prone than hand-rolling it.

## Reading and filtering

```bash
docker image inspect --format '{{json .Config.Labels}}' myorg/api:1.4.2
docker images --filter "label=org.opencontainers.image.source"
docker ps --filter "label=com.myorg.team=payments"
```

Labels also work on **containers** (`docker run --label`), networks and volumes,
where they are useful for grouping and cleanup — Compose uses them internally to
track which objects belong to a project.

## `MAINTAINER` is deprecated

```dockerfile
MAINTAINER alice@example.com                              # ❌ deprecated
LABEL org.opencontainers.image.authors="alice@example.com" # ✅
```

It still parses, so old Dockerfiles keep working, but it is a single-purpose
instruction that a general mechanism replaced. Nothing needs migrating urgently;
just do not write new ones.

In practice, an individual's email address is a poor maintainer record anyway —
people change teams. `.source` pointing at the repository is more durable, and
the repository knows who owns it.

## Podman

Identical: `LABEL` is part of the OCI config, `podman image inspect` reads it,
and `podman build --label` adds one at build time. Quay and other registries read
the same annotation keys.

## Gotchas

**Symptom:** A label is empty in the built image.
**Cause:** It referenced an `ARG` that was not declared in that stage, or was
declared after use (page 07).
**Fix:** Declare `ARG` inside the stage, above the `LABEL` that uses it.

**Symptom:** A GHCR package is not linked to its repository.
**Cause:** No `org.opencontainers.image.source` label.
**Fix:** Add it. GHCR uses it to associate the package and apply the repo's
visibility.

**Symptom:** The build cache misses on every build after adding labels.
**Cause:** A `BUILD_DATE` build arg changes every time, invalidating that
instruction and everything after it.
**Fix:** Put the timestamp label **last** in the Dockerfile so only the final
metadata layer is affected.

**Symptom:** An inherited label from the base image is wrong for your image.
**Cause:** Labels are inherited.
**Fix:** Set the same key with your own value; yours wins.

## Interview questions

**★ What are image labels for?**
Arbitrary key–value metadata in the image config — most usefully source
repository, commit revision, version and licence, using the
`org.opencontainers.image.*` annotation keys. They make an image traceable to the
code that produced it.

**★ Which label would you not ship without, and why?**
`org.opencontainers.image.revision` — it identifies the exact commit deployed,
which is the question you cannot otherwise answer during an incident. `.source`
is a close second, since GHCR uses it to link the package to its repository.

**★ What replaced `MAINTAINER`?**
`LABEL org.opencontainers.image.authors`. `MAINTAINER` is deprecated — a
single-purpose instruction superseded by the general labelling mechanism. It
still parses, so existing files are not broken.

**Why can labels hurt the build cache?**
A label whose value changes every build — a timestamp or commit SHA — invalidates
that instruction and everything after it. Put such labels last so only the final
metadata layer is affected.

**Do labels add a layer?**
No filesystem layer; they modify the image configuration. They are inherited from
the base image, and setting the same key overrides the inherited value.

---

← Prev: [HEALTHCHECK](11-healthcheck.md) · Index: [Phase 3](README.md) · Next → [VOLUME in a Dockerfile](13-volume.md)
