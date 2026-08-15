---
title: "Phase 4 — Build strategy: cache, multi-stage, BuildKit"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · BuildKit v0.32.1 · Dockerfile frontend v1.26.0 ·
> Podman 6.1.0.** Every page is **documentation-validated** against docs.docker.com,
> docs.podman.io and the relevant release notes, with sources named per page.
> **No sandbox** — nothing was run, so no page carries console output.

The difference between a 40-second rebuild and an 11-minute one is entirely in
this phase, and none of it is exotic. Phase 3 taught the instructions; this phase
is about the **order** you put them in and the builder that executes them.

🚧 **2 of 16 pages written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[How the layer cache decides](01-how-the-cache-decides.md)** | <span className="db-tier t-master">Master</span> | Instruction text plus parent layer — and for `COPY`/`ADD`, a checksum of the files |
| 02 | **[Instruction ordering](02-instruction-ordering.md)** | <span className="db-tier t-master">Master</span> | Slow and stable first, fast and volatile last |
| 03 | **The dependency-install pattern** *(not written yet)* | <span className="db-tier t-master">Master</span> | Manifest, install, *then* source — so an edit does not reinstall 900 packages |
| 04 | **Multi-stage builds** *(not written yet)* | <span className="db-tier t-master">Master</span> | The toolchain builds it; the runtime stage ships without the toolchain |
| 05 | **`RUN --mount=type=secret`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Readable during one `RUN`, present in no layer |
| 06 | **`--target`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | One Dockerfile serving dev, test and prod |
| 07 | **`COPY --from`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | From an earlier stage, or straight out of another image |
| 08 | **BuildKit** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Parallel stages, skipped stages, and the mount types |
| 09 | **`RUN --mount=type=cache`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | A package cache that survives builds without entering a layer |
| 10 | **`RUN --mount=type=bind`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Read from the context without `COPY`ing into a layer |
| 11 | **`buildx` and platforms** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Builders, drivers, `--platform`, and why QEMU is slow |
| 12 | **Cache import and export** *(not written yet)* | <span className="db-tier t-know">Know</span> | `--cache-from` / `--cache-to` — what makes CI builds fast |
| 13 | **Build args versus runtime env** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The value baked at build time that cannot be changed without a rebuild |
| 14 | **`docker build` vs `podman build` vs `buildah`** *(not written yet)* | <span className="db-tier t-know">Know</span> | Same Dockerfile, different builder |
| 15 | **The build context** *(not written yet)* | <span className="db-tier t-know">Know</span> | A directory, `-`, or a git URL — and the gigabyte upload |
| 16 | **Reproducible builds** *(not written yet)* | <span className="db-tier t-when">When Needed</span> | Digest-pinned bases, `SOURCE_DATE_EPOCH`, and how close you can get |

## Coverage

Sixteen syllabus topics across sixteen pages — nothing merged, nothing dropped.

| Syllabus topic | Page |
|---|---|
| How the layer cache decides | 01 |
| Instruction ordering | 02 |
| The dependency-install pattern | 03 |
| Multi-stage builds | 04 |
| `RUN --mount=type=secret` | 05 |
| `--target` to stop at a stage | 06 |
| `COPY --from` | 07 |
| BuildKit — the default builder | 08 |
| `RUN --mount=type=cache` | 09 |
| `RUN --mount=type=bind` | 10 |
| `buildx`: builders, drivers, `--platform` | 11 |
| Cache import/export | 12 |
| Build args vs runtime env | 13 |
| `docker build` vs `podman build` vs `buildah` | 14 |
| The build context | 15 |
| Reproducible builds | 16 |

## Phase gate

Move on to Phase 5 when you can **look at a Dockerfile and say which line will be
the first cache miss on a typical source edit, and move it.** If the answer is
"`COPY . .`, and it sits above the install", you have the phase.

## Where this connects

- **Phase 2** supplied the mechanism — [layers](../phase-2-images-and-registries/04-layers.md)
  are what the cache stores and reuses.
- **Phase 3** supplied the instructions. [`.dockerignore`](../phase-3-dockerfile/08-dockerignore.md)
  decides what the cache hashes, and [`ENV` versus `ARG`](../phase-3-dockerfile/07-env-vs-arg.md)
  is why a build arg can move a cache key.
- **Phase 5 — Image quality** is the other half of the same Dockerfile: this phase
  decides how fast it builds, phase 5 decides what ends up inside it. Multi-stage
  is the answer in both.

---

← Syllabus: [Part 2 — Building images](../../syllabus/02-building-images.md) · Prev phase: [Phase 3](../phase-3-dockerfile/README.md) · Start → [How the layer cache decides](01-how-the-cache-decides.md)
