---
title: "Multi-arch images and the manifest list"
sidebar_label: "10 · Multi-arch images"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — multi-platform builds](https://docs.docker.com/build/building/multi-platform/),
> the [OCI Image Specification — image index](https://github.com/opencontainers/image-spec/blob/main/image-index.md)
> and [docker buildx imagetools](https://docs.docker.com/reference/cli/docker/buildx/imagetools/).
> **No sandbox** — no console output on this page.

**One tag can point at several images, one per platform.** The registry hands
your engine the right one automatically — until it cannot, and then you get
`exec format error`.

## The manifest list

A single-platform image has one manifest pointing at one config and one set of
layers. A multi-platform image has a **manifest list** (the OCI spec calls it an
image **index**) pointing at several manifests, each with its own config and
layers.

```
node:24  ──▶  manifest list
                ├── linux/amd64   → manifest → config + layers
                ├── linux/arm64   → manifest → config + layers
                └── linux/arm/v7  → manifest → config + layers
```

On pull, the registry returns the list and the engine selects the variant
matching the host's architecture. That is why `docker pull node:24` works
identically on an Intel server and an Apple Silicon laptop, with no flags and no
thought.

```bash
docker buildx imagetools inspect node:24     # what platforms a tag offers
docker image inspect --format '{{.Architecture}}/{{.Os}}' node:24
```

## Building for more than one platform

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t myorg/api:1.4.2 --push .
```

Two things about this command are not optional:

- **`buildx`**, not plain `build`. The classic builder produces one platform.
- **`--push`**, not `--load`. A manifest list cannot live in the local image
  store — that store holds one image per name for the host's platform — so a
  multi-platform build must go straight to a registry. `--load` works only when
  building a single platform.

That second point is the one that produces a confusing error the first time.

## Emulation versus native builders

| | QEMU emulation | Native builders |
|---|---|---|
| Setup | None on Docker Desktop; BuildKit detects available emulation | A builder node per architecture |
| Speed | **Much slower**, especially for compilation | Native |
| Correctness | Occasional edge cases in emulated toolchains | Real |
| Good for | Interpreted languages, occasional builds | Compiled languages, CI at scale |

Docker's documentation is explicit that emulation requires no Dockerfile changes
and that BuildKit detects which architectures are emulable — and equally explicit
that it "can be much slower than native builds, especially for compute-heavy
tasks like compilation."

For a Node or Python service, emulation is usually fine. For Go, Rust or anything
with a compile step, cross-compiling in the Dockerfile or using native builders is
the difference between a two-minute and a forty-minute build.

## `exec format error`

The symptom of running an image built for the wrong architecture:

```
exec /usr/local/bin/node: exec format error
```

The usual causes:

- An image built on an Apple Silicon laptop with plain `docker build`, pushed,
  and deployed to an `amd64` server — the image is `arm64` only.
- A single-platform image pulled onto a mismatched host.
- A base image that has no variant for the host's architecture, so the pull
  silently fell back or failed in a confusing way.

```bash
# Force a platform when you need the other one locally
docker pull --platform linux/amd64 myorg/api:1.4.2
docker run --platform linux/amd64 myorg/api:1.4.2

# Check what a tag actually offers before blaming the host
docker buildx imagetools inspect myorg/api:1.4.2
```

**The structural fix is to publish multi-platform images from CI**, so no
developer's laptop architecture decides what production gets. That single change
removes the whole class of problem.

## Podman

Podman supports `--platform` on `run` and `pull`, and `--platform` on `build`
with `buildah` underneath. **`podman manifest`** is the native way to assemble a
manifest list:

```bash
podman manifest create myorg/api:1.4.2
podman manifest add myorg/api:1.4.2 docker://myorg/api:1.4.2-amd64
podman manifest add myorg/api:1.4.2 docker://myorg/api:1.4.2-arm64
podman manifest push --all myorg/api:1.4.2 docker://myorg/api:1.4.2
```

More explicit than `buildx --platform`, and it composes well when the
per-architecture images are built on separate native machines.

## Gotchas

**Symptom:** `exec format error` on deploy, and the image runs fine locally.
**Cause:** Built on `arm64`, deployed to `amd64` (or the reverse).
**Fix:** Build multi-platform in CI. As an immediate workaround,
`docker build --platform linux/amd64` before pushing.

**Symptom:** `docker buildx build --platform linux/amd64,linux/arm64 --load`
fails.
**Cause:** The local image store cannot hold a manifest list.
**Fix:** `--push` to a registry, or build one platform at a time when you need it
locally.

**Symptom:** A multi-platform build takes forty minutes.
**Cause:** QEMU emulation running a compiler for the foreign architecture.
**Fix:** Cross-compile in the Dockerfile using the build platform's toolchain
(`$BUILDPLATFORM` / `$TARGETPLATFORM`), or use native builder nodes. Phase 4.

**Symptom:** One architecture's image is stale after a rebuild.
**Cause:** Per-architecture images were pushed separately and the manifest list
was not updated.
**Fix:** Push the list as an atomic step — `buildx --push` does this, or
`podman manifest push --all`.

## Interview questions

**★ How does one tag serve several architectures?**
Through a manifest list (OCI image index): the tag points at a list, each entry
pointing at a platform-specific manifest with its own config and layers. On pull,
the registry returns the list and the engine picks the entry matching the host.

**★ What causes `exec format error`?**
Running an image built for a different CPU architecture — most often an image
built on an Apple Silicon laptop and deployed to an amd64 server. The fix is to
publish multi-platform images from CI so no laptop decides the target.

**★ Why can't you `--load` a multi-platform build?**
The local image store holds one image per name for the host platform and cannot
represent a manifest list. Multi-platform builds must be pushed to a registry;
`--load` works only for a single platform.

**When is QEMU emulation good enough, and when is it not?**
Fine for interpreted languages and occasional builds. Not fine for compiled
languages — Docker's documentation notes emulation can be much slower for
compute-heavy work — where cross-compilation or native builder nodes are the
answer.

**How do you check which platforms a published tag supports?**
`docker buildx imagetools inspect <ref>`, which prints the manifest list and its
entries. Under Podman, `podman manifest inspect`.

---

← Prev: [Authentication](09-authentication.md) · Index: [Phase 2](README.md) · Next → [save/load versus export/import](11-save-load-export-import.md)
