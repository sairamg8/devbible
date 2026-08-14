---
title: "Running your own registry"
sidebar_label: "14 · Your own registry"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the [CNCF Distribution project](https://distribution.github.io/distribution/),
> the [OCI Distribution Specification](https://github.com/opencontainers/distribution-spec/blob/main/spec.md),
> [Harbor](https://goharbor.io/docs/) and
> [containers-registries.conf(5)](https://github.com/containers/image/blob/main/docs/containers-registries.conf.5.md).
> **No sandbox** — no console output on this page.

**A registry is a small HTTP service, and running one is an afternoon.** Whether
you *should* is a different question, and the honest answer is usually no — with
two exceptions that matter.

## The options

| | What it is | Good for |
|---|---|---|
| **Distribution** (`registry:2`) | The CNCF reference implementation. The thing Docker Hub was built from | A private registry, a pull-through cache, an air-gapped mirror |
| **Harbor** | Distribution plus a UI, RBAC, scanning, replication, signing | An organisation that needs policy and audit |
| **Zot** | A minimal OCI-native registry | A lightweight, spec-focused option |
| **Cloud registries** | ECR, GAR, ACR, GHCR | Almost everyone, almost always |

**Start with a hosted registry.** GHCR is free for public images and integrates
with Actions; the cloud ones integrate with their platform's identity. Running
your own means owning storage, garbage collection, TLS certificates, backups and
availability — for a service that is on the critical path of every deploy.

## The two cases where self-hosting earns its place

### A pull-through cache

One registry in your network that caches upstream images. Every base-image pull
hits it once and is served locally afterwards.

It solves three things at once: Docker Hub's rate limits
([page 08](08-registries.md)), build speed, and dependence on upstream
availability. It is the single best reason to run your own, and it needs no
policy or UI — just Distribution in proxy mode.

Clients are pointed at it without changing any image name — `registry-mirrors`
in Docker's `daemon.json`, or a `[[registry.mirror]]` block in Podman's
`registries.conf` ([page 12](12-podman-registries-conf.md)).

### An air-gapped environment

No internet, so images must be mirrored in deliberately. Here a local registry is
not a convenience, it is the only mechanism — usually fed by `skopeo copy` from a
connected host, or by `docker save` onto media
([page 11](11-save-load-export-import.md)).

## The minimum

```bash
docker run -d -p 5000:5000 --name registry \
  -v registry-data:/var/lib/registry \
  registry:2

docker tag myapi:1.4.2 localhost:5000/myapi:1.4.2
docker push localhost:5000/myapi:1.4.2
```

Note the **named volume**. Without it, every image you push lives in the
container's writable layer and disappears when the container is replaced
([Phase 0, page 04](../phase-0-what-a-container-is/04-image-vs-container.md)).
This is the mistake people make first.

That command is a **development** registry: no TLS and no authentication.
Anything reachable by anyone else needs both.

## What "production" adds

- **TLS.** Without it, clients refuse to connect unless configured to allow
  insecure registries — `insecure-registries` in Docker, `insecure = true` in
  Podman's `registries.conf`. Both are development-only settings; the right fix
  is a certificate.
- **Authentication.** Distribution supports htpasswd and token auth; Harbor adds
  users, robot accounts and RBAC.
- **Storage backing.** S3 or another object store rather than a local volume, so
  the registry is not a single disk.
- **Garbage collection.** Deleting a tag does **not** free space — untagged
  manifests and their blobs remain until GC runs. An un-collected registry grows
  forever, and this is the most common operational surprise.
- **Backups**, because a registry your deploys depend on is production
  infrastructure.

## Gotchas

**Symptom:** Images pushed to a self-hosted registry vanished after a restart.
**Cause:** No volume — the data was in the container's writable layer.
**Fix:** Mount a named volume at `/var/lib/registry`. Recovery is not possible.

**Symptom:** `http: server gave HTTP response to HTTPS client`.
**Cause:** The registry serves plain HTTP and the client expects TLS.
**Fix:** Add TLS. For local development only, add the host to
`insecure-registries` (Docker) or set `insecure = true` in a `[[registry]]` block
(Podman).

**Symptom:** Disk keeps growing although old tags were deleted.
**Cause:** Deleting a tag leaves the manifest and blobs; only garbage collection
removes them.
**Fix:** Run Distribution's garbage collection (with the registry read-only or
stopped), and schedule it. Harbor does this on a policy.

**Symptom:** A pull-through cache was configured and pulls still go upstream.
**Cause:** The mirror configuration does not match the reference being pulled, or
the mirror is unreachable and the client fell back.
**Fix:** Verify the prefix matches the image names you actually use, and test the
mirror directly.

## Interview questions

**★ When should you run your own registry?**
Rarely — a hosted registry is usually better. The two cases that earn it are a
**pull-through cache** (rate limits, build speed, upstream availability) and an
**air-gapped environment** where there is no alternative.

**★ What does a production registry need that `docker run registry:2` does not
have?**
TLS, authentication, durable storage backing (object storage rather than one
disk), scheduled garbage collection, and backups. The one-liner is a development
registry.

**★ Why does deleting tags not free space in a registry?**
Deleting a tag removes the reference, not the content. Untagged manifests and
their blobs remain until garbage collection runs — which is why an
un-collected registry grows indefinitely.

**How do clients use a pull-through cache without changing image names?**
`registry-mirrors` in Docker's `daemon.json`, or a `[[registry.mirror]]` block in
Podman's `registries.conf`. The Dockerfiles keep saying `docker.io/library/node`
and the pull is served locally.

**What is the most common first mistake when self-hosting?**
No volume at `/var/lib/registry`, so everything pushed lives in the container's
writable layer and is lost when the container is replaced.

---

← Prev: [Where layers live on disk](13-storage-on-disk.md) · Index: [Phase 2](README.md) · Next → [Image signing](15-image-signing.md)
