---
title: "BuildKit"
sidebar_label: "08 · BuildKit"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Docker — BuildKit](https://docs.docker.com/build/buildkit/),
> [Docker — builders](https://docs.docker.com/build/builders/),
> [Docker — multi-stage builds](https://docs.docker.com/build/building/multi-stage/) and
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html).
> **No sandbox** — no console output on this page.

**BuildKit is the thing that actually executes your Dockerfile, and it does not
execute it as a list of instructions — it compiles it into a dependency graph and
solves that.** Nearly every feature in this phase exists because of that one
design decision.

## What it is

> "BuildKit is the builder backend used by Docker."

It is the default for Docker Desktop and Docker Engine; the documentation notes
the legacy builder remains in use for **Windows containers**. Everything on this
page assumes Linux containers on a current engine, where BuildKit is what you
get without asking for it.

## The graph, and what falls out of it

BuildKit converts the Dockerfile into a **Low-Level Build (LLB) definition** —
"a content-addressable dependency graph that can be used to put together complex
build definitions". Four documented consequences, and each is something you
noticed before you knew why:

**Parallel execution.** A "fully concurrent build graph solver" runs independent
build stages simultaneously. Two stages that do not reference each other are
built at the same time, so wall-clock is the longest path through the graph, not
the sum of the stages.

**Unused stages are skipped.** BuildKit can "detect and skip executing unused
build stages" — the property that makes a `test` stage free in a production build
([page 06](06-target.md)).

**The context transfer is incremental.** It "incrementally transfer[s] only the
changed files in your build context between builds" and can "detect and skip
transferring unused files in your build context". The context is no longer a full
tarball upload every time — though `.dockerignore` still matters, because the
files it excludes never enter the calculation at all.

**A precise cache.** The rewritten caching model "directly tracks the checksums
of build graphs and content mounted to specific operations", rather than
comparing chains of committed layers. This is why `--mount=type=cache` can exist:
the builder can reason about content mounted into a step, not just the layer the
step produced.

## Frontends — where the Dockerfile language comes from

> "A frontend is a component that takes a human-readable build format and
> converts it to LLB."

Frontends "distribute as container images", so the Dockerfile *language* is
versioned separately from the engine. That is the whole meaning of the line at
the top of every example in this phase:

```dockerfile
# syntax=docker/dockerfile:1
```

It pins which frontend image parses the file, so `--parents`, `--link` and the
mount types are available because of the **frontend**, not because of the
Docker version installed ([Phase 3 · the syntax directive](../phase-3-dockerfile/15-syntax-directive.md)).
Pin `:1` and you receive compatible improvements automatically; pin a minor
version when you need a specific feature to be guaranteed present.

## The mount types

The graph model is what allows a `RUN` to have inputs that never become part of
its output layer. Three of them matter, each with its own page:

| Mount | What it gives the `RUN` | Page |
|---|---|---|
| `type=cache` | A directory that persists across builds and is in no layer | [09](09-mount-type-cache.md) |
| `type=bind` | A file read from the context or another stage without `COPY` | [10](10-mount-type-bind.md) |
| `type=secret` | A value present for one instruction only | [05](05-mount-type-secret.md) |

There is also `type=ssh`, covered alongside secrets, and `type=tmpfs` for scratch
space you explicitly do not want persisted.

## Builders and drivers, briefly

> "A builder is a BuildKit daemon that you can use to run your builds."

Docker creates a **default** builder that "uses the BuildKit library bundled with
the daemon" and "requires no configuration". Beyond it, buildx supports four
drivers:

| Driver | What it is |
|---|---|
| `docker` | The BuildKit library bundled into the Docker daemon |
| `docker-container` | A dedicated BuildKit container, created by Docker |
| `kubernetes` | BuildKit pods in a Kubernetes cluster |
| `remote` | A manually managed BuildKit daemon you connect to |

```bash
docker buildx ls              # list builders; * marks the selected one
docker buildx use <name>      # switch
docker buildx build --builder <name> .
```

One subtlety that catches people, documented plainly:

> "Even though `docker build` is an alias for `docker buildx build`, there are
> subtle differences."

`docker build` defaults to the bundled builder for backwards compatibility, while
`docker buildx build` respects the builder you selected. So `buildx use` appears
to have no effect if you keep typing `docker build`. The driver detail — and why
multi-platform builds need `docker-container` — is
**page 11 · `buildx` and platforms** *(not written yet)*.

## Reading the output

`--progress=plain` prints each step on its own line rather than redrawing a live
tree, which is what you want in CI logs and when you are looking for the first
cache miss ([page 02](02-instruction-ordering.md)). The accepted values are
`auto`, `none`, `plain`, `quiet`, `rawjson` and `tty`; `rawjson` "marshals the
solve status events from BuildKit to JSON lines" for tooling to consume.

## Podman

Podman does **not** use BuildKit. `podman build` is Buildah, a separate
implementation of the same Dockerfile language, so the comparison is
feature-by-feature rather than "the same thing renamed":

| Capability | BuildKit | Buildah / `podman build` |
|---|---|---|
| Skip unused stages | Yes | Yes — `--skip-unused-stages`, default **true** |
| Layer caching | Always | `--layers`, default **true** (`BUILDAH_LAYERS`) |
| Remote cache | `--cache-from` / `--cache-to` | Same flags, **ignored unless `--layers`** |
| `# syntax=` frontend | Fetches the pinned frontend image | **Ignored** — features follow the Buildah version |
| Mount types | `cache`, `bind`, `secret`, `ssh`, `tmpfs` | `--secret` and `--ssh` are documented; others vary by version |

The practical rule for a cross-engine Dockerfile: **the language is portable, the
newest frontend features are not.** Confirm anything beyond the classic
instruction set against your installed Buildah version before depending on it.

## Gotchas

**Symptom:** A new Dockerfile feature fails to parse.
**Cause:** No `# syntax=docker/dockerfile:1` line, so the bundled frontend is used
— or Buildah, which ignores the directive entirely.
**Fix:** Add the syntax directive for Docker builds; for Podman, check the Buildah
version rather than the directive.

**Symptom:** `docker buildx use mybuilder` seems to be ignored.
**Cause:** `docker build` defaults to the bundled builder, unlike `docker buildx
build`.
**Fix:** Use `docker buildx build`, or pass `--builder`.

**Symptom:** Every stage in the file executes, including ones the target does not
need.
**Cause:** A legacy builder — the documented behaviour is to process all stages up
to the target.
**Fix:** Confirm which builder is running. On Linux containers with a current
engine, BuildKit is the default.

**Symptom:** The first line of the build takes a long time on a repository that
has not changed.
**Cause:** A very large build context. Incremental transfer helps between builds
on the same builder, but a cold builder still reads it.
**Fix:** `.dockerignore` — excluded files are never considered at all
([Phase 3 · .dockerignore](../phase-3-dockerfile/08-dockerignore.md)).

## Interview questions

**★ What does BuildKit do differently from the legacy builder?**
It compiles the Dockerfile into a content-addressable dependency graph (LLB) and
solves it, rather than executing instructions in sequence. That gives concurrent
execution of independent stages, skipping of unused stages, incremental build
context transfer, and a cache that tracks checksums of graphs and mounted content
rather than chains of committed layers.

**★ What is a frontend, and why does `# syntax=docker/dockerfile:1` matter?**
A frontend converts a human-readable build format into LLB, and frontends are
distributed as container images. The syntax directive pins which one parses your
file, so newer Dockerfile features become available without upgrading the engine.

**★ Does Podman use BuildKit?**
No. `podman build` is Buildah — a separate implementation of the same language.
It reaches similar behaviour by different means (`--layers`,
`--skip-unused-stages`) and ignores the `# syntax=` directive, so frontend-gated
features depend on the Buildah version.

**Why does `docker buildx use` appear not to work?**
Because `docker build` defaults to the bundled builder for backwards
compatibility even though it is an alias for `docker buildx build`. Use `docker
buildx build` or `--builder`.

**What are the mount types and why can they exist at all?**
`cache`, `bind`, `secret`, `ssh` and `tmpfs`. They exist because BuildKit tracks
content mounted into a specific operation separately from the layer that
operation produces — so a `RUN` can read something that never lands in the image.

---

← Prev: [`COPY --from`](07-copy-from.md) · Index: [Phase 4](README.md) · Next → [`RUN --mount=type=cache`](09-mount-type-cache.md)
