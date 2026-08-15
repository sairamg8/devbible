---
title: "buildx and platforms"
sidebar_label: "11 · buildx and platforms"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Docker — multi-platform builds](https://docs.docker.com/build/building/multi-platform/),
> [Docker — builders](https://docs.docker.com/build/builders/),
> [the Dockerfile reference — automatic platform args](https://docs.docker.com/reference/dockerfile/#automatic-platform-args-in-the-global-scope),
> [`docker buildx build`](https://docs.docker.com/reference/cli/docker/buildx/build/) and
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html).
> **No sandbox** — no console output on this page.

**An image is built for a specific CPU architecture, and `buildx` is how you
build for one you are not sitting in front of.** The Apple-silicon laptop
producing an image that must run on an amd64 server is the everyday case, and
there are three ways to do it with very different costs.

## Builders, and why `buildx use` sometimes seems ignored

> "A builder is a BuildKit daemon that you can use to run your builds."

Docker creates a **default** builder using "the BuildKit library bundled with the
daemon", which "requires no configuration". Four drivers exist
([page 08](08-buildkit.md)): `docker`, `docker-container`, `kubernetes` and
`remote`.

```bash
docker buildx ls                       # * marks the selected builder
docker buildx create --name multi --driver docker-container --use
docker buildx build --builder multi .
```

The trap, straight from the documentation:

> "Even though `docker build` is an alias for `docker buildx build`, there are
> subtle differences."

`docker build` uses the bundled default builder for backwards compatibility;
`docker buildx build` honours the one you selected. If a `buildx create --use`
appears to have done nothing, that is why.

## What `--platform` means

> "A multi-platform build refers to a single build invocation that targets
> multiple different operating system or CPU architecture combinations."

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t app:1.0 --push .
```

The result is a manifest list — one tag whose entries point at per-architecture
images, so `docker pull app:1.0` fetches the right one on each machine
([Phase 2 · manifests](../phase-2-images-and-registries/README.md)).

**Not every builder can produce that.** The `containerd` image store — the
default in Docker Desktop and Docker Engine 29.0+ — and the `docker-container`
driver support multi-platform output; the plain `docker` driver with the classic
image store does not. If a multi-platform build fails with a complaint about the
output, that is the reason, and `docker buildx create --driver docker-container`
is the fix.

## The three strategies

### 1. QEMU emulation — easiest, slowest

Emulation "is the easiest way to get started if your builder already supports
it": you change nothing in the Dockerfile and pass `--platform`. The whole
foreign-architecture build runs under emulation.

The cost is real and the documentation says so plainly:

> "Emulation with QEMU can be much slower than native builds, especially for
> compute-heavy tasks like compilation and compression or decompression."

Which is exactly what a build is. Emulation is fine for an interpreted service
whose "build" is an `npm ci`; it is painful for anything that compiles.

:::note No numbers here
This track has no sandbox, so this page quotes the documentation's
characterisation — "much slower" — rather than inventing a multiplier. Measure it
on your own build before deciding whether it matters.
:::

### 2. Cross-compilation — fast, needs a toolchain

Build **natively** on the builder's architecture and have the compiler emit code
for the target. BuildKit provides the platform information as automatic build
arguments:

| ARG | Meaning |
|---|---|
| `BUILDPLATFORM` | The platform the build is executing on |
| `BUILDOS`, `BUILDARCH`, `BUILDVARIANT` | Its parts |
| `TARGETPLATFORM` | "platform of the build result. Eg `linux/amd64`" |
| `TARGETOS`, `TARGETARCH`, `TARGETVARIANT` | Its parts |

```dockerfile
# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM golang:1.26 AS build
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY . .
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /bin/app ./cmd/app

FROM alpine:3.23
COPY --from=build /bin/app /bin/app
CMD ["/bin/app"]
```

Two details that are easy to get wrong:

- **`FROM --platform=$BUILDPLATFORM` pins the build stage to the builder's own
  architecture**, which is what stops the toolchain itself running under
  emulation. Without it, the build stage is emulated and you have gained nothing.
- **The automatic args are global-scope.** To use them *inside* a stage you must
  redeclare them — `ARG TARGETOS TARGETARCH` — after the `FROM`. Omit that line
  and the variables are empty, and the build silently produces the wrong
  architecture.

This is the right answer for Go and Rust, which cross-compile well. It is awkward
for anything with native dependencies compiled against the target's libraries.

### 3. Multiple native nodes — fastest, most infrastructure

Attach real machines of each architecture to one builder — "you can add
additional nodes to a builder using the `--append` flag" — and each platform
builds natively. No emulation, no cross-compilation toolchain, and every stage
runs at full speed. The cost is that you now maintain an arm64 machine as well as
an amd64 one. Docker Build Cloud is the managed version of the same idea.

## Choosing

| Situation | Strategy |
|---|---|
| Interpreted app, occasional cross-arch build | QEMU |
| Go or Rust, CI that must be fast | Cross-compilation |
| Native modules, compiled languages, heavy CI | Native nodes |
| One architecture only | None — do not pass `--platform` at all |

The last row matters. Multi-platform doubles or triples build time; only build
the architectures you actually deploy.

## Output, and why `--load` bites

A multi-platform result is a manifest list, and the local image store
historically could not hold one. In practice:

- `--push` sends the manifest list straight to a registry, and is the normal
  choice for multi-platform.
- `--load` brings the result into the local image store — straightforward for a
  single platform, and dependent on the containerd image store being in use for
  a multi-platform one.

If a multi-platform build succeeds and the image is nowhere to be found locally,
the output flag is the thing to look at first.

## Podman

`podman build --platform` accepts the same `os/arch` form, and Podman also offers
`podman manifest` for assembling a multi-architecture manifest list explicitly —
building each architecture and then adding it to a manifest, rather than one
invocation producing everything. Emulation depends on the host having the
appropriate `qemu-user-static` binaries registered, exactly as it does for
Docker.

The automatic platform arguments come from the frontend, and Buildah ignores the
`# syntax=` directive ([page 08](08-buildkit.md)), so confirm `TARGETARCH`
support in your Buildah version before writing a cross-compilation Dockerfile
that must build under both engines.

## Gotchas

**Symptom:** `--platform linux/amd64,linux/arm64` fails complaining about the
output or the driver.
**Cause:** The default `docker` driver with the classic image store cannot produce
multi-platform output.
**Fix:** Use the containerd image store, or
`docker buildx create --driver docker-container --use`.

**Symptom:** A cross-compilation Dockerfile produces an image of the wrong
architecture.
**Cause:** `ARG TARGETOS TARGETARCH` was not redeclared inside the stage, so the
variables were empty and the compiler used its defaults.
**Fix:** Redeclare the automatic args after the `FROM` that needs them.

**Symptom:** The build is dramatically slower than usual.
**Cause:** The build stage is running under QEMU because `FROM` was not pinned
with `--platform=$BUILDPLATFORM`.
**Fix:** Pin the build stage to the build platform and cross-compile.

**Symptom:** `docker buildx create --use` seems to have no effect.
**Cause:** You are running `docker build`, which uses the bundled builder
regardless.
**Fix:** `docker buildx build`, or pass `--builder`.

## Interview questions

**★ What does a multi-platform build produce?**
A manifest list — one tag whose entries point at per-architecture images — so a
pull on any machine fetches the matching one. It needs a builder that can emit
that: the containerd image store or a `docker-container` builder.

**★ What are the three ways to build for another architecture, and their
trade-offs?**
QEMU emulation (no changes, but "much slower than native builds", especially for
compilation); cross-compilation using `BUILDPLATFORM`/`TARGETPLATFORM` (fast,
needs a toolchain that supports it); and multiple native nodes appended to one
builder (fastest, most infrastructure).

**★ Why is `FROM --platform=$BUILDPLATFORM` important in a cross-compiling
Dockerfile?**
It pins the build stage to the builder's own architecture, so the toolchain runs
natively instead of under emulation. Without it you are emulating the compiler
and the cross-compilation setup buys nothing.

**Why might `TARGETARCH` be empty inside a stage?**
The automatic platform args exist in the global scope; to use them after a `FROM`
you must redeclare them with `ARG` in that stage. Otherwise they expand to
nothing and the build silently targets the wrong architecture.

**Why does `docker build` sometimes ignore the builder you selected?**
It defaults to the bundled builder for backwards compatibility even though it is
an alias for `docker buildx build`. Use `docker buildx build` or `--builder`.

---

← Prev: [`RUN --mount=type=bind`](10-mount-type-bind.md) · Index: [Phase 4](README.md) · Next → **Cache import and export** *(not written yet)*
