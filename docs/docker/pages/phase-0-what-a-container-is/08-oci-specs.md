---
title: "The OCI specifications"
sidebar_label: "08 · The OCI specifications"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [opencontainers.org](https://opencontainers.org/),
> the [Runtime Specification](https://github.com/opencontainers/runtime-spec),
> the [Image Specification](https://github.com/opencontainers/image-spec) and the
> [Distribution Specification](https://github.com/opencontainers/distribution-spec).
> **No sandbox** — no console output on this page.

**The OCI is the reason this whole track can teach two engines at once.** Docker
and Podman are not compatible by coincidence or by one imitating the other. They
implement the same three published specifications.

## Three specifications, one pipeline

The specs are not overlapping alternatives; each covers one hand-off in the same
pipeline:

```
   registry                       disk                        kernel
      │                            │                            │
 ┌────▼─────────────┐   ┌──────────▼──────────┐   ┌─────────────▼────────┐
 │ Distribution spec │──▶│    Image spec       │──▶│     Runtime spec      │
 │ how you pull it   │   │ what an image IS    │   │ how it becomes a      │
 │ and push it       │   │ layers + config     │   │ running process       │
 └───────────────────┘   └─────────────────────┘   └───────────────────────┘
```

The OCI describes the same flow in a sentence: an implementation downloads an
OCI **Image**, unpacks it into a **Runtime** filesystem bundle, and executes it
using an OCI **Runtime**.

| Spec | Defines | Version |
|---|---|---|
| **Runtime** (`runtime-spec`) | How to run a *filesystem bundle* unpacked on disk: the `config.json`, namespaces, cgroups, capabilities, lifecycle operations | **v1.3.0**, Nov 2025 |
| **Image** (`image-spec`) | The image format: manifest, config, layers, and the index for multi-platform images | **v1.1.0**, Feb 2024 |
| **Distribution** (`distribution-spec`) | The registry HTTP API: pull, push, discovery, content addressing | **v1.1.0**, Feb 2024; conformance suite redesigned Apr 2026 |

The OCI was established in **June 2015 by Docker and others**, and runs under
Linux Foundation governance. Docker donated the container format and runtime that
became `runc` — which is why "the Docker image format" and "the OCI image format"
are, in practice, the same thing.

## What each one buys you, concretely

### Runtime spec — why `runc` and `crun` are swappable

The runtime spec says a container is a **filesystem bundle**: a root directory
plus a `config.json` describing namespaces, mounts, cgroup limits, capabilities,
the process to run, and the lifecycle operations (`create`, `start`, `kill`,
`delete`).

Any program implementing that contract can be dropped in. Which is why:

- Docker uses `runc` by default and can be pointed at others.
- Podman uses `crun` (C, faster startup) or `runc`.
- **Kata Containers** and **gVisor** implement the same spec while running the
  workload in a lightweight VM or a user-space kernel — so you can harden
  isolation without changing a single line of your Dockerfile or Compose file.

That last point is the practical payoff: the isolation mechanism is a
replaceable component behind a standard interface.

### Image spec — why one image runs everywhere

The image spec defines the manifest, the config, the layer format, and the
**index** (a manifest list) that lets one tag point to several
platform-specific images. Because it is a published format:

- An image built by `docker build`, `podman build`, `buildah`, Kaniko, ko, Jib or
  BuildKit is the same kind of artefact.
- Any of them can be run by Docker, Podman, containerd, CRI-O or Kubernetes.
- A registry does not care which tool produced what it stores.

### Distribution spec — why every registry works the same

Pull and push are a defined HTTP API over content-addressed blobs. Docker Hub,
GHCR, Quay, ECR, GAR, ACR, Harbor and a registry you run yourself all speak it.
Switching registries is a URL change and a credential change, not a migration.

The same content-addressing is why **a digest is a real guarantee**:
`@sha256:…` names the exact bytes, and the registry cannot hand you different
ones under that name. Phase 2 turns this into a pinning practice.

## Where the standard stops

Being precise about the boundary prevents false expectations:

- **The Dockerfile is not an OCI spec.** It is Docker's format, adopted by
  everyone else de facto. BuildKit's `# syntax=` directive versions it
  independently. Podman and Buildah parse it because it is universal, not because
  it is standardised.
- **Compose is not an OCI spec.** The Compose Specification is its own project.
  Podman's Compose support is provided rather than guaranteed.
- **Networking is not covered.** Docker's bridge networking and Podman's
  `netavark` are independent implementations, which is exactly why Phase 7 has
  engine-specific corners.
- **Volume drivers and log drivers are not covered.** Engine-specific.

The rule of thumb: **the image and the act of running it are standardised; the
developer experience around them is not.** That maps cleanly onto which parts of
this track say "identical in both engines" and which have a Podman column.

## Gotchas

**Symptom:** "We should migrate off Docker images to OCI images."
**Cause:** Believing they are two formats.
**Fix:** They are the same format. Docker's v2 schema 2 manifest was the basis
of the OCI image spec, and modern tools emit OCI-format images by default.
There is nothing to migrate.

**Symptom:** A Dockerfile using a recent feature fails to build on another tool.
**Cause:** The Dockerfile format is not standardised, and frontend features ship
on BuildKit's schedule.
**Fix:** Pin the frontend with `# syntax=docker/dockerfile:1` and check that your
builder supports the feature. Buildah and Kaniko lag BuildKit on newer `RUN
--mount` options.

**Symptom:** An image pulls fine from one registry and fails on another with a
manifest error.
**Cause:** Older registries may not support the OCI manifest media types or the
artifact types a newer tool pushes.
**Fix:** Check the registry's distribution-spec conformance. Some builders can
be told to emit Docker-schema manifests for compatibility with older registries.

## Interview questions

**★ What are the three OCI specifications?**
Runtime (how to execute an unpacked filesystem bundle), Image (the image format:
manifest, config, layers, index) and Distribution (the registry HTTP API). They
cover the three hand-offs: registry → disk → running process.

**★ Why can Podman run images built by Docker?**
Because the image format is a published specification both implement, and the
registry API is another. Neither engine is reverse-engineering the other; they
target the same standards.

**★ What is a filesystem bundle?**
The runtime spec's unit of work: a directory containing the root filesystem plus
a `config.json` describing namespaces, mounts, cgroups, capabilities and the
process to run. An OCI runtime's job is to turn a bundle into a running
container.

**How can you get stronger isolation without changing your images?**
Swap the OCI runtime. Kata Containers runs the workload in a lightweight VM and
gVisor interposes a user-space kernel; both implement the runtime spec, so the
image, the Dockerfile and the Compose file are unchanged.

**Is the Dockerfile part of the OCI standard?**
No. It is Docker's format that everyone adopted, versioned through BuildKit's
`# syntax=` frontend directive. That is why newer Dockerfile features are not
uniformly available across builders.

**What does a digest guarantee that a tag does not?**
The digest is the content hash, so it names exactly one set of bytes and the
registry cannot substitute others. A tag is a mutable pointer that can be moved
to a different image at any time.

---

← Prev: [OverlayFS and copy-up](07-overlayfs.md) · Index: [Phase 0](README.md) · Next → [Capabilities](09-capabilities.md)
