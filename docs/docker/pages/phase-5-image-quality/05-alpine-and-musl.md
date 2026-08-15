---
title: "Alpine and musl"
sidebar_label: "05 · Alpine and musl"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [musl release notes](https://musl.libc.org/releases.html),
> [PEP 656 — the `musllinux` platform tag](https://peps.python.org/pep-0656/),
> [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/) and
> [Docker — multi-stage builds](https://docs.docker.com/build/building/multi-stage/).
> **No sandbox** — no console output on this page.

**Alpine is small because it replaces two things you were relying on: glibc, and
the GNU userland.** The size saving is real and so is the substitution, which is
why "just use Alpine" is a decision rather than an optimisation.

## What actually changes

| | A Debian-based image | Alpine |
|---|---|---|
| C library | **glibc** | **musl** |
| Core utilities | GNU coreutils | BusyBox |
| Package manager | `apt` | `apk` |
| Shell | bash present in most images | `ash` — **no bash** unless installed |

The base is a few megabytes rather than tens or hundreds. Everything below is a
consequence of the first two rows.

## Consequence 1: prebuilt binaries do not apply

This is the big one, and it is not a musl bug — it is that the ecosystem's
prebuilt artefacts target glibc.

**Python** made it explicit with a separate platform tag. PEP 656 introduces
`musllinux` because distributions "based on musl, a different libc
implementation from glibc… cannot use the existing `manylinux` platform tags".
A wheel tagged `manylinux_2_28_x86_64` will not be installed on Alpine; a
`musllinux_1_2_x86_64` wheel will. Where no musllinux wheel is published, pip
falls back to building from source — which needs a compiler in the image, which
is most of the size you were trying to save.

**Node** has the same shape without a tag system: many native modules ship
prebuilt glibc binaries and fall back to `node-gyp` compiling from source on
Alpine. That means `build-base`/`python3` in the build stage, a slower install,
and — if you are not staging — a much larger final image.

**The pattern to recognise:** an Alpine image that needs a compiler to install
its dependencies has usually given back its size advantage and added build time.
A multi-stage build fixes the size half
([Phase 4](../phase-4-build-strategy/04-multi-stage-builds.md)); nothing fixes
the "we now compile native modules on every cold build" half except a base with
prebuilt binaries available.

## Consequence 2: DNS resolution — and what is actually true now

musl's stub resolver has a long reputation for DNS trouble, and much of what is
repeated about it predates the fix. What the release notes actually say, for
**musl 1.2.4 (May 2023)**:

> "This release adds TCP fallback to the DNS stub resolver, fixing the
> longstanding inability to query large DNS records and incompatibility with
> recursive nameservers that don't give partial results in truncated UDP
> responses."

and, in the same release:

> "…making both the modern and legacy API results differentiate between
> `NODATA` and `NxDomain` conditions so that the caller can handle them
> differently."

So the two most-cited musl DNS complaints — no TCP fallback for large responses,
and indistinguishable "no such name" versus "no records of this type" — were
**fixed in 1.2.4**. An Alpine release carrying musl 1.2.4 or later does not have
them.

:::note What this page will not claim
Whether *your* image is affected depends on the musl version in the Alpine
release you pin, and on your resolver's behaviour. This track has no sandbox, so
nothing here was tested. **Check the musl version in the base you actually use**
rather than trusting either the old reputation or this paragraph — and treat
undated blog posts about musl DNS as probably describing pre-1.2.4 behaviour.
:::

## Consequence 3: performance differences exist and are workload-specific

musl and glibc make different implementation choices, most discussed around
memory allocation, and the difference shows up for allocation-heavy workloads.
This is genuinely a real phenomenon and it is also the claim most often stated
with a made-up number attached.

**What is honest to say:** the two libcs are different implementations with
different performance characteristics; whether that matters is a property of your
workload; and it is measurable on your own service in an afternoon. Anything more
specific than that, from this page or any other, should be treated as a
hypothesis until you have measured it.

## Consequence 4: the userland is BusyBox

BusyBox implements a compact subset of the GNU utilities. Most of the time this
is invisible; when it is not, it is a script that relied on a GNU-only flag, or
on bash rather than `ash`. Debugging tooling is thinner too. The fixes are small
(`apk add bash coreutils`) and each one gives back some of the saving.

## When Alpine is the right answer

**Good fit:**

- A **Go or Rust** service — a static or near-static binary that does not care
  about the libc at all, where Alpine is really just "a tiny userland to put a
  binary in" (**page 10 · static binaries**, *not written yet*).
- A **shell-tooling image** — a CI helper, a small utility container.
- Anything where you have checked that every dependency has a musllinux (or
  equivalent) build.

**Poor fit:**

- Native modules with no musl build, so the image compiles them.
- Workloads sensitive to allocator behaviour that you have not measured.
- A team that will lose more hours to one strange incompatibility than the
  megabytes are worth.

**The middle option people forget:** a `-slim` variant of the glibc image.
`node:22-slim` and `python:3.13-slim` are the same glibc userland with
documentation, headers and optional packages removed — a large part of the saving
with **none** of the substitution risk. Try that before Alpine, and only go
further if the remaining size genuinely matters.

## Do the size work in the right order

Switching base image is step 4 of the list in
[page 01](01-where-size-goes.md), not step 1. Multi-stage removes the toolchain,
`.dockerignore` removes the context junk, same-layer cleanup removes the package
caches — and those three are risk-free. Alpine trades compatibility for
megabytes, so it should be spending a budget the earlier steps could not.

## Podman

The base image is the same artefact under either engine, so everything here is
unchanged. One Podman-specific note carried from earlier phases: spell the base
fully qualified (`docker.io/library/alpine:3.23`) because short-name resolution
differs
([Phase 4 · docker vs podman vs buildah](../phase-4-build-strategy/14-docker-vs-podman-vs-buildah.md)).

## Gotchas

**Symptom:** `pip install` on Alpine starts compiling and needs a C compiler.
**Cause:** No `musllinux` wheel published for that package, so pip builds from
source; manylinux wheels do not apply to musl.
**Fix:** Build in a stage that has the toolchain and ship the result, or use a
`-slim` glibc base where manylinux wheels install directly.

**Symptom:** A Node native module fails to load at runtime after switching bases.
**Cause:** The module was compiled against a different libc — glibc modules do not
load under musl, and copying `node_modules` between mismatched bases is the usual
route ([Phase 4 · multi-stage](../phase-4-build-strategy/04-multi-stage-builds.md)).
**Fix:** Install dependencies on the base you ship on.

**Symptom:** A shell script that worked on Debian fails on Alpine.
**Cause:** BusyBox implements a subset; the script used a GNU-only flag, or
`#!/bin/bash` where only `ash` exists.
**Fix:** `apk add bash coreutils` if you need them, or write to the POSIX subset.

**Symptom:** Someone blames a DNS problem on musl.
**Cause:** Possibly correct on an old musl; TCP fallback and `NODATA`/`NxDomain`
distinction landed in **1.2.4**.
**Fix:** Check the musl version in your base before accepting the diagnosis, and
look for a more ordinary cause first.

## Interview questions

**★ What is the real trade-off in choosing Alpine?**
Size against compatibility. Alpine substitutes musl for glibc and BusyBox for the
GNU userland, so it is a few megabytes instead of tens or hundreds — but prebuilt
native binaries target glibc, so some dependencies must be compiled from source,
and some shell scripts and debugging habits stop working.

**★ Why do Python wheels sometimes not install on Alpine?**
Because manylinux wheels target glibc. PEP 656 added the `musllinux` tag series
precisely because musl-based distributions "cannot use the existing `manylinux`
platform tags". Without a musllinux wheel, pip builds from source and the image
needs a compiler.

**★ Is musl's DNS resolver still a reason to avoid Alpine?**
Much less than its reputation suggests. musl 1.2.4 "adds TCP fallback to the DNS
stub resolver", fixing the large-record and truncated-response problems, and made
`NODATA` and `NxDomain` distinguishable. Check the musl version in your base
rather than repeating pre-2023 advice.

**What should you try before Alpine?**
A `-slim` variant of the glibc image — the same userland with documentation,
headers and optional packages removed. Most of the saving, none of the
substitution risk. And before that, multi-stage and `.dockerignore`, which are
larger wins and carry no risk at all.

**Which workloads suit Alpine best?**
Ones that do not depend on the libc: a static Go or Rust binary, or a small
shell-tooling image. It suits a Node or Python service least when that service
has native dependencies with no musl builds published.

---

← Prev: [Measuring](04-measuring.md) · Index: [Phase 5](README.md) · Next → **Distroless and `scratch`** *(not written yet)*
