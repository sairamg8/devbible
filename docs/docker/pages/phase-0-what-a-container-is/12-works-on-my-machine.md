---
title: "Why \"works on my machine\" stops being a sentence"
sidebar_label: "12 · Works on my machine"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the
> [OCI Image Specification](https://github.com/opencontainers/image-spec/blob/main/spec.md)
> and [Docker — build overview](https://docs.docker.com/build/concepts/overview/).
> **No sandbox** — no console output on this page.

**The image ships the filesystem *and* the configuration.** Not the code, not a
package list, not a README of setup steps — the actual assembled userspace, plus
the environment, the working directory, the user and the command. That is the
whole reason containers displaced the alternatives.

## What used to vary, and no longer does

Before containers, "it works on my machine" was a statement about a long list of
invisible differences:

| The difference | What containers do with it |
|---|---|
| Language runtime version | Pinned in the base image — `node:24.9.0-slim`, not "whatever is installed" |
| System libraries (OpenSSL, glibc, libpq) | Part of the image layers |
| Native build tools | Present at build time, absent from the runtime image if you use multi-stage |
| Environment variables | Baked as `ENV`, or supplied explicitly at run time |
| Working directory and user | `WORKDIR` and `USER` in the image config |
| The start command | `ENTRYPOINT` / `CMD` in the image config |
| Installed packages | The layers, exactly |
| Filesystem layout | The image's own root |

What remains variable is short and worth memorising, because it is where the
remaining surprises live:

- **The kernel.** Shared with the host, always. A workload sensitive to kernel
  version or kernel modules is still host-sensitive.
- **The CPU architecture.** An `amd64` image does not run natively on `arm64`.
  Phase 2 covers multi-arch images and the `exec format error`.
- **What you mount in.** Bind mounts, volumes and config files are deliberate
  holes in the isolation, and they are host-specific by definition.
- **The network around it.** DNS, proxies, firewalls, and whatever the container
  needs to reach.
- **Resources.** A 512 MB limit on a laptop and 8 GB in production is a real
  difference in behaviour.

## The config is the underrated half

People describe an image as "a packaged filesystem", and then are surprised when
a filesystem-only export behaves differently. The OCI image config carries:

`Env` · `Entrypoint` · `Cmd` · `User` · `WorkingDir` · `Labels` · `ExposedPorts`
· `Volumes` · `StopSignal`

This is why `docker export` (filesystem only) and `docker save` (image with
config and layers) are not interchangeable, and why an exported-then-imported
container "loses its command". Phase 2 covers the pair in detail; the reason is
here.

## What it does not fix

Being honest about the boundary is what keeps the promise credible:

- **It does not make your application correct.** A race condition ships fine.
- **It does not pin what you did not pin.** `FROM node:24` moves as the tag
  moves; `apt-get install curl` installs whatever is current on build day. A
  build is only as reproducible as its inputs — Phases 2 and 4.
- **It does not remove environment differences you chose.** A different database
  URL in staging is still a different database.
- **It does not survive `latest`.** An image tag that moves is the modern version
  of "works on my machine", just relocated into the registry.

The last two are the ones that actually recur in professional work. Containers
converted an *implicit* environment problem into an *explicit* one; the
discipline of pinning is what keeps it solved.

## Gotchas

**Symptom:** The image works on a colleague's laptop and fails on yours with
`exec format error`.
**Cause:** Architecture mismatch — an `amd64` image on `arm64`, or the reverse.
**Fix:** Build multi-arch (`buildx --platform linux/amd64,linux/arm64`) or pull
the right platform. Phase 2 and Phase 4.

**Symptom:** "The image is the same, so the behaviour must be the same" — and it
is not.
**Cause:** Same image, different mounts, different environment variables,
different resource limits, different network.
**Fix:** Diff the *run-time* inputs, not the image: `docker inspect` on both
sides and compare `Env`, `Mounts`, `HostConfig`. The image being identical is
exactly what makes this the right place to look.

**Symptom:** A rebuild of the same Dockerfile produces a different image weeks
later.
**Cause:** Unpinned inputs — a moving base tag, a package manager fetching
current versions.
**Fix:** Pin the base by digest and use a lockfile for application
dependencies. Full reproducibility is harder still; Phase 4 is honest about how
far you can get.

## Interview questions

**★ Why do containers solve "works on my machine"?**
Because the image ships the assembled userspace *and* the runtime configuration —
libraries, runtime version, environment, user, working directory and start
command — so the parts that used to vary silently between machines are now build
artefacts.

**★ What still varies between hosts?**
The kernel (shared with the host), the CPU architecture, whatever is mounted in,
the surrounding network, and the resource limits. Everything else comes from the
image.

**★ Does using containers make a build reproducible?**
No. It makes the *environment* reproducible. Reproducibility of the build still
depends on pinning inputs: a digest-pinned base image, a lockfile, and package
sources that do not drift. `FROM node:24` plus `apt-get install` is not a
reproducible build.

**Why does `docker export` lose the container's start command?**
Because it exports the filesystem only. The `Entrypoint`, `Cmd`, `Env`, `User`
and the rest live in the image *config*, which `save` preserves and `export`
does not.

---

← Prev: [Rootless containers](11-rootless.md) · Index: [Phase 0](README.md) · Next → [Containers vs VMs vs serverless](13-containers-vs-vms.md)
