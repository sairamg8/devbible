---
title: "Phase 2 — Images, layers and registries"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · Podman 6.1.0 · OCI image spec v1.1.0 ·
> distribution spec v1.1.0.** Every page is **documentation-validated** against
> the OCI specifications and the two engines' references, with sources named per
> page. **No sandbox** — nothing was run, so no page carries console output.

Where images come from, what they are made of, and how to refer to one such that
you get the same bytes tomorrow. Phase 0 explained what an image *is*; this phase
is about handling them.

Fifteen pages. **Pages 01–04 are the load-bearing set** — references, digests,
the five verbs and layers. Everything after builds on those.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Image references](01-image-references.md)** | <span className="db-tier t-master">Master</span> | `node:24` is four defaults plus one thing you typed |
| 02 | **[Tags move, digests do not](02-tags-vs-digests.md)** | <span className="db-tier t-master">Master</span> | A tag is a subscription, not a version |
| 03 | **[pull, push, images, tag, rmi](03-pull-push-tag.md)** | <span className="db-tier t-master">Master</span> | `tag` creates a name and copies nothing |
| 04 | **[Layers](04-layers.md)** | <span className="db-tier t-master">Master</span> | Diffs, shared and immutable — so cleanup happens per layer, not per image |
| 05 | **[Choosing a base image](05-choosing-a-base-image.md)** | <span className="db-tier t-understand">Understand</span> | Size, debuggability, compatibility — and the honest Alpine answer |
| 06 | **[Reading docker history](06-history.md)** | <span className="db-tier t-understand">Understand</span> | How to find the 400 MB nobody meant to ship |
| 07 | **[The image config](07-image-config.md)** | <span className="db-tier t-understand">Understand</span> | The half of an image that is not files, and why `export` loses it |
| 08 | **[Registries and rate limits](08-registries.md)** | <span className="db-tier t-understand">Understand</span> | 100 pulls per 6 hours **per IP** — the number that breaks CI |
| 09 | **[Authentication](09-authentication.md)** | <span className="db-tier t-understand">Understand</span> | Scoped short-lived tokens, which is why "logged in but denied" happens |
| 10 | **[Multi-arch images](10-multi-arch.md)** | <span className="db-tier t-understand">Understand</span> | One tag, many platforms — and where `exec format error` comes from |
| 11 | **[save/load vs export/import](11-save-load-export-import.md)** | <span className="db-tier t-know">Know</span> | One moves an image, the other a filesystem |
| 12 | **[Podman's registries.conf](12-podman-registries-conf.md)** | <span className="db-tier t-know">Know</span> | Short names, mirrors, redirects and blocks |
| 13 | **[Where layers live on disk](13-storage-on-disk.md)** | <span className="db-tier t-know">Know</span> | The storage root, and why rootless fills your home directory |
| 14 | **[Running your own registry](14-your-own-registry.md)** | <span className="db-tier t-know">Know</span> | Usually no — except for a pull-through cache or an air gap |
| 15 | **[Image signing](15-image-signing.md)** | <span className="db-tier t-know">Know</span> | Provenance, not safety — and verification must pin the identity |

## Coverage

Fifteen syllabus topics, fifteen pages — one to one.

| Syllabus topic | Page |
|---|---|
| Image references: registry/namespace/repo:tag@digest | 01 |
| Tags are mutable, digests are not | 02 |
| `pull`, `push`, `images`, `rmi`, `tag` | 03 |
| Layers: how each instruction becomes one, and sharing | 04 |
| Choosing a base image: slim, Alpine, distroless, scratch | 05 |
| `history` and reading an image's construction | 06 |
| The image config: env, entrypoint, labels, exposed ports | 07 |
| Registries and Docker Hub rate limits | 08 |
| Authentication, `login`, credential helpers | 09 |
| Multi-arch images and the manifest list | 10 |
| `save`/`load` vs `export`/`import` | 11 |
| Podman's `registries.conf` and short-name resolution | 12 |
| Where layers live on disk; storage drivers | 13 |
| Running your own registry | 14 |
| Image signing basics: cosign/Sigstore | 15 |

## Phase gate

Move on to Phase 3 when you can:

- **pin one of your project's base images by digest**, and say what breaks when
  the upstream tag moves and how you would find out;
- read `docker history` on an unfamiliar image and name the instruction
  responsible for most of its size;
- and explain why a CI job that pulls `node:24` a hundred times an hour
  eventually fails.

## Where this connects

- **Phase 0** supplied the mechanism: layers and copy-up in
  [OverlayFS](../phase-0-what-a-container-is/07-overlayfs.md), and the standards
  in [the OCI specs](../phase-0-what-a-container-is/08-oci-specs.md).
- **Phase 3 — The Dockerfile** is how these images get built; page 04's cache
  behaviour is the reason instruction order matters there.
- **Phase 4 — Build strategy** takes the cache, multi-stage and multi-arch
  material further.
- **Phase 5 — Image quality** picks up base-image choice, size and the supply
  chain, of which page 15 is the beginning.
- **Phase 12 — Delivery** is where digests, tags and registry authentication
  become a pipeline.

---

← Syllabus: [Part 1 — How containers work](../../syllabus/01-how-containers-work.md) · Prev phase: [Phase 1](../phase-1-running-containers/README.md) · Start → [Image references](01-image-references.md)
