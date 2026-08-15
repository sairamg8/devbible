---
title: "docker build vs podman build vs buildah"
sidebar_label: "14 · docker vs podman vs buildah"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html),
> [buildah.io](https://buildah.io/),
> [Docker — BuildKit](https://docs.docker.com/build/buildkit/),
> [Docker — builders](https://docs.docker.com/build/builders/) and the Buildah project's
> [Containerfile versus Dockerfile discussion](https://github.com/containers/buildah/discussions/3170).
> **No sandbox** — no console output on this page.

**Same Dockerfile, three different programs building it.** The language is
portable; the builder is not, and knowing which differences are real saves a lot
of time when a build that works on your laptop fails on a colleague's.

## Who is who

| Tool | What it actually is |
|---|---|
| **`docker build`** | An alias for `docker buildx build`, executed by **BuildKit** ([page 08](08-buildkit.md)) |
| **`podman build`** | Podman's build subcommand — "**podman build** uses code sourced from the `Buildah` project to build container images" |
| **`buildah`** | The build tool itself: "a tool that facilitates building OCI container images", usable directly |

So there are really **two** implementations, not three: BuildKit, and Buildah
(which `podman build` wraps). Buildah and Podman are complementary — Buildah
builds, Podman runs — and both are daemonless and rootless-capable.

## Containerfile and Dockerfile

Podman accepts both names. "A file referred to as a Containerfile can be a file
named either 'Containerfile' or 'Dockerfile' exclusively", and a bare
`podman build .` recognises either — but "any file that has additional extension
attached will not be recognized by `podman build .` unless a `-f` flag is used".
So `Dockerfile.prod` needs `-f` under Podman just as it does under Docker.

The two names are the same language. `Containerfile` exists because the format is
not Docker-specific; there is no syntactic difference to learn.

## What actually differs

The list that matters in practice, all of it established earlier in this phase:

| | BuildKit (`docker build`) | Buildah (`podman build`) |
|---|---|---|
| Layer caching | Always on | `--layers`, default **true**; `BUILDAH_LAYERS` overrides |
| Remote cache | `--cache-from` / `--cache-to`, many backends | Same two flags against a repository — **ignored unless `--layers`** |
| Cache age limit | — | **`--cache-ttl`**; zero "is equivalent to using `--no-cache`" |
| Unused stages | Skipped | Skipped — `--skip-unused-stages`, default **true** |
| `# syntax=` frontend | Fetches the pinned frontend image | **Ignored** — features follow the installed Buildah version |
| Secrets | `--secret id=…,src=…\|env=…` | `--secret id=…[,src=…][,env=…][,type=file\|env]` |
| Multi-platform | `--platform a,b` in one invocation | `--platform`, plus `podman manifest` to assemble a list |
| Daemon | Required (BuildKit in the daemon, or a builder container) | **None** |
| Rootless | Supported | Supported, and the normal mode |

**The `# syntax=` row is the one that bites.** Everything gated behind a newer
frontend — `COPY --parents`, `--link`, the newer mount options — is available
under Docker because the frontend image is fetched, and under Podman only if the
installed Buildah implements it. A Dockerfile that must build under both should
stay close to the classic instruction set, or the differences should be tested
rather than assumed.

## Buildah's other interface

The part that has no Docker equivalent: Buildah can build an image **without a
Dockerfile at all**, through `from`, `run`, `copy` and `commit` commands driven
from a shell script.

```bash
ctr=$(buildah from alpine:3.23)
buildah run "$ctr" -- apk add --no-cache curl
buildah copy "$ctr" ./app /usr/local/bin/app
buildah config --entrypoint '["/usr/local/bin/app"]' "$ctr"
buildah commit "$ctr" myapp:1.0
```

Why anyone would: the build is ordinary shell, so it can branch, loop, read
files and call other tools without the Dockerfile language having to grow a
feature for it. The trade is that you have given up the thing a Dockerfile is
good at — a declarative, cacheable, reviewable description of the image. For
most projects the Dockerfile is right; this is the escape hatch for image
pipelines that are genuinely programmatic.

## Output compatibility

All three produce **OCI-compliant images**, and an image built by any of them
runs under any of the engines and pushes to the same registries. Cross-engine
worry belongs to the *build*, not to the artefact.

One practical detail carried over from earlier phases: Podman's **short-name
resolution** differs from Docker's, so an unqualified `FROM node:22-alpine` or
`COPY --from=nginx:latest` may resolve differently or prompt. Fully qualify
image references (`docker.io/library/node:22-alpine`) in a Dockerfile that must
build under both ([page 07](07-copy-from.md)).

## Choosing

- **On a Docker host, use `docker build`.** BuildKit is the most featureful
  builder and everything in this phase applies directly.
- **On a Podman host, use `podman build`.** It is Buildah with a familiar
  interface, and the defaults (`--layers`, `--skip-unused-stages`) are already
  the ones you want.
- **Reach for `buildah` directly** when you want the daemonless step-by-step
  interface, or when scripting image construction that a Dockerfile would model
  badly.
- **In CI, pick one and pin it.** The failure mode is a pipeline that works
  because of a builder-specific default and breaks when the runner image changes.

## Gotchas

**Symptom:** A Dockerfile using `COPY --parents` or `--link` fails under Podman.
**Cause:** Buildah ignores `# syntax=`, so the pinned frontend does not apply;
the feature exists only if the installed Buildah has it.
**Fix:** Use the portable form, or require a Buildah version and check it.

**Symptom:** A Podman build ignores `--cache-from` entirely.
**Cause:** `--layers` is off — `BUILDAH_LAYERS=false` in the environment is the
usual reason — and the cache flags are then ignored silently.
**Fix:** Ensure `--layers` is on.

**Symptom:** `podman build .` does not find `Dockerfile.prod`.
**Cause:** Only exact `Containerfile` or `Dockerfile` are auto-detected; anything
with an extra extension needs `-f`.
**Fix:** `podman build -f Dockerfile.prod .`

**Symptom:** The same Dockerfile pulls a different base image on the two engines.
**Cause:** Short-name resolution differs.
**Fix:** Fully qualify the registry in `FROM` and `COPY --from`.

## Interview questions

**★ Are `docker build` and `podman build` the same program?**
No. `docker build` is an alias for `docker buildx build` executed by BuildKit;
`podman build` "uses code sourced from the Buildah project". Two independent
implementations of the same Dockerfile language, and both emit OCI images that
run anywhere.

**★ What is the most consequential difference for a shared Dockerfile?**
The `# syntax=` directive. Docker fetches the pinned frontend image, so newer
Dockerfile features are available regardless of engine version; Buildah ignores
the directive, so those features depend on the installed Buildah. Anything
frontend-gated must be tested, not assumed.

**★ What can Buildah do that a Dockerfile cannot?**
Build an image step by step from a shell script — `buildah from`, `run`, `copy`,
`config`, `commit` — with no Dockerfile at all. Useful for genuinely programmatic
image construction; the cost is losing the declarative, cacheable description a
Dockerfile provides.

**What is a Containerfile?**
The same language under a vendor-neutral name. Podman accepts a file named
`Containerfile` or `Dockerfile`; anything with an extra extension needs `-f`.

**Do the engines' caching defaults differ?**
Yes in mechanism, mostly not in effect: BuildKit always caches layers, Buildah
caches when `--layers` is on, which is the default. The real difference is that
Buildah's remote-cache flags are ignored when `--layers` is off, and that Buildah
offers `--cache-ttl`, which Docker has no equivalent for.

---

← Prev: [Build args versus runtime env](13-build-args-vs-runtime-env.md) · Index: [Phase 4](README.md) · Next → [The build context](15-the-build-context.md)
