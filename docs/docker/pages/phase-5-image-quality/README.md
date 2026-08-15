---
title: "Phase 5 — Image quality, size and supply chain"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · BuildKit v0.32.1 · Podman 6.1.0.** Every page is
> **documentation-validated** against docs.docker.com, docs.podman.io, the OCI
> specifications and the relevant release notes, with sources named per page.
> **No sandbox** — nothing was run, so no page carries console output.

An image is a build artefact you are shipping to strangers. Phase 4 decided how
fast it builds; this phase is about **what is inside it** — how big, how
privileged, and how much of it you did not write.

🚧 **2 of 12 pages written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Where size actually goes](01-where-size-goes.md)** | <span className="db-tier t-understand">Understand</span> | Base, package caches, dev dependencies, toolchain — never your code |
| 02 | **[The classic mistakes](02-classic-mistakes.md)** | <span className="db-tier t-master">Master</span> | `apt` lists, npm cache, `.git`, `node_modules`, secrets in an early layer |
| 03 | **Least privilege in the image** *(not written yet)* | <span className="db-tier t-master">Master</span> | Non-root `USER`, read-only root filesystem, dropped capabilities |
| 04 | **Measuring** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `docker history` layer by layer — and why deletion does not shrink |
| 05 | **Alpine and musl** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Tiny, and a genuinely different libc |
| 06 | **Distroless and `scratch`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | No shell, no package manager — and how you debug afterwards |
| 07 | **Vulnerability scanning** *(not written yet)* | <span className="db-tier t-know">Know</span> | Trivy, Grype, Scout — reading a report without drowning |
| 08 | **Pinning base images by digest** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Reproducible against patched, and how to have both |
| 09 | **Supply-chain risk** *(not written yet)* | <span className="db-tier t-know">Know</span> | What `FROM some-user/some-image` means you agreed to |
| 10 | **Static binaries** *(not written yet)* | <span className="db-tier t-know">Know</span> | Why Go and Rust ship on `scratch` and Node cannot |
| 11 | **SBOMs and provenance** *(not written yet)* | <span className="db-tier t-know">Know</span> | What BuildKit attaches, and who consumes it |
| 12 | **Signing and verifying** *(not written yet)* | <span className="db-tier t-when">When Needed</span> | Making "this image is ours" checkable in a pipeline |

## Coverage

Twelve syllabus topics across twelve pages — nothing merged, nothing dropped.

| Syllabus topic | Page |
|---|---|
| Where size actually goes | 01 |
| The classic mistakes | 02 |
| Least privilege in the image | 03 |
| Measuring — `docker images`, `docker history`, layer analysis | 04 |
| Alpine and musl | 05 |
| Distroless and `scratch` | 06 |
| Vulnerability scanning | 07 |
| Pinning base images by digest | 08 |
| Supply-chain risk | 09 |
| Static binaries | 10 |
| SBOMs and provenance attestations | 11 |
| Signing and verifying images in a pipeline | 12 |

## Phase gate

**Take one of your own images, cut its size by at least half, and be able to
justify every remaining megabyte.** If you cannot say what the largest layer is
and why it is there, page 04 is the one to reread.

## Where this connects

- **Phase 2** is the mechanism: [layers](../phase-2-images-and-registries/04-layers.md)
  are why deleting a file in a later instruction does not shrink anything.
- **Phase 3** supplied [`USER`](../phase-3-dockerfile/09-user.md) and
  [`.dockerignore`](../phase-3-dockerfile/08-dockerignore.md), both of which this
  phase treats as posture rather than syntax.
- **Phase 4** is the other half of the same Dockerfile:
  [multi-stage builds](../phase-4-build-strategy/04-multi-stage-builds.md) are the
  single largest size reduction available, and
  [build secrets](../phase-4-build-strategy/05-mount-type-secret.md) are why a
  credential should never be in a layer to begin with.

---

← Syllabus: [Part 2 — Building images](../../syllabus/02-building-images.md) · Prev phase: [Phase 4](../phase-4-build-strategy/README.md) · Start → [Where size actually goes](01-where-size-goes.md)
