---
title: "Choosing a base image"
sidebar_label: "05 · Choosing a base image"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker Official Images](https://docs.docker.com/trusted-content/official-images/),
> [Docker — base images](https://docs.docker.com/build/building/base-images/),
> [Alpine Linux](https://alpinelinux.org/about/) and
> [GoogleContainerTools/distroless](https://github.com/GoogleContainerTools/distroless).
> **No sandbox** — no console output on this page.

**The base image is your largest dependency, most of your image size, and most
of your CVE report.** It is the single highest-leverage line in a Dockerfile, and
the choice is a triangle: size, debuggability, compatibility.

## The options

| Base | Typical size | Shell? | Package manager? | Notes |
|---|---|---|---|---|
| Full distro (`debian`, `ubuntu`) | ~120–250 MB | Yes | Yes | Everything present. Rarely necessary |
| **`-slim`** (`node:24-slim`) | ~70–200 MB | Yes | Yes | Same distro, docs and extras stripped. **The sane default** |
| **Alpine** (`node:24-alpine`) | ~40–80 MB | Yes (`ash`) | Yes (`apk`) | musl libc, not glibc — see below |
| **Distroless** | ~20–50 MB | **No** | **No** | Runtime and your app. Nothing else |
| **`scratch`** | 0 | No | No | Empty. Static binaries only |

## The Alpine question, honestly

Alpine is small because it uses **musl** instead of **glibc** and BusyBox instead
of GNU coreutils. That is a real difference, not a packaging detail, and it has
consequences:

- **Native modules must be compiled against musl.** Prebuilt binaries targeting
  glibc do not work, so an `npm ci` that installs prebuilt native modules on
  Debian may compile from source on Alpine — slower builds, and sometimes
  failures.
- **DNS resolution has historically differed** from glibc's in edge cases,
  particularly around search domains and concurrent A/AAAA queries.
- **Debugging tools are BusyBox versions** with fewer options than the GNU ones
  your muscle memory expects.

None of this makes Alpine wrong. It makes it a **deliberate** choice rather than
an automatic one:

> **Use Alpine when the size genuinely matters and you have tested your
> dependencies on it. Use `-slim` when you want small without a new libc.**

For a Node or Python service in an ordinary deployment, `-slim` is usually the
better default — you get most of the size win and none of the compatibility
surface.

## Distroless and `scratch`

Distroless images contain the language runtime and your application, and nothing
else: no shell, no package manager, no `ls`. `scratch` contains literally
nothing.

**What you gain:** a much smaller attack surface, far fewer CVEs to triage
(because there are barely any packages to have them), and a smaller image.

**What you pay:** you cannot `exec` in and look around
([Phase 1, page 04](../phase-1-running-containers/04-exec-vs-run.md)). Debugging
moves to `nsenter` from the host, a debug sidecar, or a separate debug image
tagged for the purpose. Many distroless images ship a `:debug` variant with a
BusyBox shell precisely because this is painful.

`scratch` works only for **statically linked** binaries — Go and Rust with the
right flags. A dynamically linked binary in `scratch` fails with "not found",
which is the missing **loader**, not the missing binary
([Phase 1, page 09](../phase-1-running-containers/09-exit-codes.md)).

## Official images, and what "official" means

Docker Official Images are a curated set — `node`, `postgres`, `redis`, `nginx`,
`python`, `alpine` — reviewed by Docker and the upstream projects, rebuilt when
their bases are patched, and documented. They live in the `library` namespace,
which is why they have single-word names
([page 01](01-image-references.md)).

Prefer them over a random user's image with more stars. `FROM someuser/node-app`
means trusting that account with everything your service does, forever
([Phase 5](../../syllabus/02-building-images.md)).

Many upstream projects also publish their own images on GHCR or Quay, which are
equally good and sometimes fresher. What you are looking for is a **maintained,
identifiable publisher**, not the Docker Hub badge specifically.

## A decision rule

1. **Start with the official `-slim` variant** of your language's image.
2. **Move to Alpine** only if size matters and your dependency tree tolerates
   musl — verify, do not assume.
3. **Move to distroless** for production once your service is stable and you have
   a debugging story that does not need a shell.
4. **Use `scratch`** only for a static binary.
5. **Pin by digest** whatever you choose ([page 02](02-tags-vs-digests.md)), and
   automate the bump.

Multi-stage builds make steps 3 and 4 far easier than they sound: build with the
full toolchain, ship on the minimal base. Phase 4.

## Podman

The choice is identical — the base image is a property of the image, not the
engine. The only Podman-specific note is short-name resolution: write
`docker.io/library/node:24-slim` in full rather than `node:24-slim`
([page 01](01-image-references.md)).

## Gotchas

**Symptom:** `npm ci` takes far longer on Alpine than on Debian.
**Cause:** Prebuilt native modules target glibc, so on musl they compile from
source.
**Fix:** Accept the build cost, add the build toolchain to a build stage only, or
use `-slim`. Do not add compilers to the final image to make it work.

**Symptom:** A Go binary in `scratch` fails with "no such file or directory" and
the binary is definitely there.
**Cause:** It is dynamically linked and the loader is absent; the kernel reports
the missing **interpreter**.
**Fix:** Build statically (`CGO_ENABLED=0`), or use distroless, which includes
the necessary runtime pieces.

**Symptom:** A scanner reports 300 CVEs on your image and none in your code.
**Cause:** The base image's packages — most of which your application never
executes.
**Fix:** Move to a smaller base, which genuinely removes the packages. Phase 5
covers reading a scan report without drowning in unfixable base CVEs.

**Symptom:** Production is down and you cannot get a shell in the container.
**Cause:** Distroless, as designed.
**Fix:** Have the debugging story ready **before** you adopt it: a `:debug`
image variant, `nsenter` from the host, or an ephemeral debug container.
Deciding this during an incident is the wrong time.

## Interview questions

**★ What are the trade-offs between Debian-slim, Alpine and distroless?**
`-slim` gives glibc and a package manager at moderate size — the safe default.
Alpine is smaller but uses musl, so native modules and some DNS behaviour differ.
Distroless is smallest and has the least attack surface but no shell, so
debugging must not depend on one.

**★ Why is Alpine not automatically the right choice?**
Because musl is not glibc. Prebuilt native modules must be recompiled, some DNS
edge cases behave differently, and BusyBox tools differ from GNU ones. It is a
deliberate choice justified by size, not a free win.

**★ When can you use `scratch`?**
Only with a statically linked binary — Go or Rust built without dynamic linking.
Anything dynamically linked fails on the missing loader, which reports as "not
found".

**How do you debug a distroless container?**
From outside: `nsenter` into its namespaces from the host, an ephemeral debug
container sharing them, or a `:debug` image variant with a BusyBox shell. Decide
which before adopting distroless, not during an incident.

**Why prefer an official image over a popular community one?**
Official images are curated, rebuilt when their bases are patched, and
documented. A community image means trusting that publisher with everything your
service does, on every rebuild, indefinitely.

---

← Prev: [Layers](04-layers.md) · Index: [Phase 2](README.md) · Next → [Reading docker history](06-history.md)
