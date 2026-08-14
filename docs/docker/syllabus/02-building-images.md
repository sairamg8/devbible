---
title: "Part 2 — Building images"
sidebar_label: "2 · Building images"
sidebar_position: 2
---

> Phases 3–5 · The Dockerfile, build strategy and cache, image quality

Anyone can write a Dockerfile that works. This part is about writing one that is
**small, cached, safe and reproducible** — the four properties that decide
whether your CI takes 40 seconds or 11 minutes, and whether a leaked image
hands someone your database password.

---

## Phase 3 — The Dockerfile

Every instruction, what it costs, and the ones that behave differently from how
they read.

| Topic | Tier |
|---|---|
| **`FROM`** — the base image is your dependency, your attack surface and most of your size, all at once. Multiple `FROM`s start multiple stages | <span className="db-tier t-understand">Understand</span> |
| **`RUN`** — every `RUN` is a layer; chaining with `&&` and cleaning in the *same* layer is why `rm -rf /var/lib/apt/lists/*` must not be its own line | <span className="db-tier t-master">Master</span> |
| **`COPY` vs `ADD`** — use `COPY`; `ADD` only earns its place for remote URLs and auto-extracting a local tarball, and both are usually the wrong idea | <span className="db-tier t-master">Master</span> |
| **`WORKDIR`** — and why `RUN cd /app` does nothing to the next instruction | <span className="db-tier t-understand">Understand</span> |
| **`CMD` vs `ENTRYPOINT`** — the four combinations, and the mental model: `ENTRYPOINT` is the program, `CMD` is its default arguments | <span className="db-tier t-master">Master</span> |
| **Exec form vs shell form** — `["node", "server.js"]` gets your process PID 1 and your `SIGTERM`; `node server.js` wraps it in `/bin/sh -c` and swallows the signal | <span className="db-tier t-master">Master</span> |
| **`ENV` vs `ARG`** — build-time vs run-time, scope across stages, and why an `ARG` secret is visible in `docker history` | <span className="db-tier t-master">Master</span> |
| **`.dockerignore`** — it controls the build *context*, so it decides upload time, cache behaviour, and whether `.env` and `.git` end up in your image | <span className="db-tier t-master">Master</span> |
| **`USER`** — running as non-root, creating the user, and the ownership problem it creates for `COPY` | <span className="db-tier t-understand">Understand</span> |
| **`EXPOSE` publishes nothing.** It is metadata. `-p` publishes | <span className="db-tier t-understand">Understand</span> |
| **`HEALTHCHECK`** — `--interval`, `--timeout`, `--retries`, `--start-period`; what "unhealthy" does and does not cause on its own | <span className="db-tier t-understand">Understand</span> |
| **`LABEL`** and the OCI annotation keys (`org.opencontainers.image.source`, `.revision`) that make an image traceable to a commit | <span className="db-tier t-know">Know</span> |
| **`VOLUME` in a Dockerfile** — creates an anonymous volume for every container, silently defeats `--read-only`, and usually should not be there | <span className="db-tier t-know">Know</span> |
| **Heredocs** — `RUN <<EOF` for multi-line scripts without `&& \` chains | <span className="db-tier t-know">Know</span> |
| **The `# syntax=docker/dockerfile:1` parser directive** — how you get new Dockerfile features without upgrading the engine | <span className="db-tier t-understand">Understand</span> |
| `STOPSIGNAL` and `SHELL` | <span className="db-tier t-know">Know</span> |
| `MAINTAINER` is deprecated — use a `LABEL` | <span className="db-tier t-know">Know</span> |
| `ONBUILD` — triggers that fire in the *child* build, and why they surprise everyone | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** a Dockerfile for a Node service that runs as a non-root
user, receives `SIGTERM` in the application process, and has no secrets in
`docker history`.

---

## Phase 4 — Build strategy: cache, multi-stage and BuildKit

The difference between a 40-second rebuild and an 11-minute one is entirely in
this phase, and none of it is exotic.

| Topic | Tier |
|---|---|
| **How the layer cache decides** — the instruction text plus, for `COPY`/`ADD`, a checksum of the copied files. One miss invalidates everything after it | <span className="db-tier t-master">Master</span> |
| **Instruction ordering** — slow and stable first, fast and volatile last. This one idea is most of build performance | <span className="db-tier t-master">Master</span> |
| **The dependency-install pattern**: copy the manifest and lockfile, install, *then* copy source — so editing a component does not reinstall 900 packages | <span className="db-tier t-master">Master</span> |
| **Multi-stage builds** — a build stage with the toolchain, a runtime stage with the artefact and nothing else | <span className="db-tier t-master">Master</span> |
| **`RUN --mount=type=secret`** — a secret readable during one `RUN` and present in no layer; the correct answer to private registry tokens | <span className="db-tier t-understand">Understand</span> |
| **`--target`** to stop at a stage — one Dockerfile serving dev, test and prod | <span className="db-tier t-understand">Understand</span> |
| **`COPY --from`** — from an earlier stage, or straight out of another image | <span className="db-tier t-understand">Understand</span> |
| **BuildKit** — the default builder: parallel independent stages, skipped unused stages, real progress output, and the mount types below | <span className="db-tier t-understand">Understand</span> |
| **`RUN --mount=type=cache`** — a persistent package cache (`~/.npm`, apt lists, Go module cache) that survives across builds without entering a layer | <span className="db-tier t-understand">Understand</span> |
| **`RUN --mount=type=bind`** — read a file from the context without `COPY`ing it into a layer | <span className="db-tier t-understand">Understand</span> |
| **`buildx`**: builders and drivers, `--platform`, and building an arm64 image on an amd64 laptop via QEMU (and why it is slow) | <span className="db-tier t-understand">Understand</span> |
| **Cache import/export** — `--cache-from` / `--cache-to`, registry and GHA backends; the thing that makes CI builds fast | <span className="db-tier t-know">Know</span> |
| **Build args vs runtime env** — the confusion that ships a build-time value into production and cannot be changed without a rebuild | <span className="db-tier t-understand">Understand</span> |
| **`docker build` vs `podman build` vs `buildah`** — same Dockerfile, different builder; what Podman does and does not implement of BuildKit | <span className="db-tier t-know">Know</span> |
| **The build context** — a directory, `-`, or a git URL; and why `docker build .` at the repo root can upload a gigabyte | <span className="db-tier t-know">Know</span> |
| Reproducible builds: digest-pinned bases, `SOURCE_DATE_EPOCH`, and how close you can actually get | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can look at a Dockerfile and say which line will be
the first cache miss on a typical source edit, and move it.

---

## Phase 5 — Image quality, size and supply chain

An image is a build artefact you are shipping to strangers. This phase is about
what is in it.

| Topic | Tier |
|---|---|
| **Where size actually goes** — base image, package manager caches, dev dependencies, build toolchain left in the final stage | <span className="db-tier t-understand">Understand</span> |
| **The classic mistakes**: `apt` lists, `npm` cache, `.git`, `node_modules` copied *then* reinstalled, secrets in an early layer | <span className="db-tier t-master">Master</span> |
| **Least privilege in the image** — a non-root `USER`, a read-only root filesystem, and dropped capabilities as the default posture | <span className="db-tier t-master">Master</span> |
| **Measuring** — `docker images`, `docker history`, and layer-by-layer analysis; deleting a file in a later layer does not shrink the image | <span className="db-tier t-understand">Understand</span> |
| **Alpine and musl** — the real trade: tiny, but native modules, DNS resolution and some performance characteristics differ from glibc | <span className="db-tier t-understand">Understand</span> |
| **Distroless and `scratch`** — no shell, no package manager, no debugger; what you gain and how you debug afterwards | <span className="db-tier t-understand">Understand</span> |
| **Vulnerability scanning** — Trivy, Grype, Docker Scout; reading a report without drowning in unfixable base-image CVEs | <span className="db-tier t-know">Know</span> |
| **Pinning base images by digest** and automating the bump — the tension between reproducible and patched | <span className="db-tier t-understand">Understand</span> |
| **Supply-chain risk** — what `FROM some-user/some-image` actually means you have agreed to | <span className="db-tier t-know">Know</span> |
| Static binaries: why Go and Rust services can ship on `scratch` and Node cannot | <span className="db-tier t-know">Know</span> |
| **SBOMs and provenance attestations** — what BuildKit can attach, and who consumes it | <span className="db-tier t-know">Know</span> |
| Signing and verifying images in a pipeline | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** take one of your own images, cut its size by at least
half, and be able to justify every remaining megabyte.

---

← Prev: [Part 1 — How containers work](01-how-containers-work.md) · Index: [Docker & Podman](../README.md) · Next → [Part 3 — Running a real stack](03-running-a-stack.md)
