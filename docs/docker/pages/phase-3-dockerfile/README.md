---
title: "Phase 3 — The Dockerfile"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · Dockerfile frontend v1.26.0 · Podman 6.1.0.**
> Every page is **documentation-validated** against the Dockerfile reference,
> Docker's build documentation and the two engines' behaviour, with sources named
> per page. **No sandbox** — nothing was run, so no page carries console output.

Every instruction, what it costs, and the ones that behave differently from how
they read. Phase 2 was about handling images; this phase is about **authoring**
them.

Seventeen pages covering eighteen syllabus topics. **Pages 02, 03, 05, 06, 07 and
08 are the load-bearing set** — they decide whether your image is small, safe,
and able to shut down cleanly.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[FROM](01-from.md)** | <span className="db-tier t-understand">Understand</span> | Starts a *stage*, and inherits the base's config — including the `USER` that breaks your install |
| 02 | **[RUN](02-run.md)** | <span className="db-tier t-master">Master</span> | Clean in the same layer; `apt-get update` and `install` must share one |
| 03 | **[COPY versus ADD](03-copy-vs-add.md)** | <span className="db-tier t-master">Master</span> | Use `COPY`. `ADD`'s extras happen implicitly and depend on the file |
| 04 | **[WORKDIR](04-workdir.md)** | <span className="db-tier t-understand">Understand</span> | Why `RUN cd` does nothing to the next instruction |
| 05 | **[CMD versus ENTRYPOINT](05-cmd-vs-entrypoint.md)** | <span className="db-tier t-master">Master</span> | The program and its default arguments — and what a user can override |
| 06 | **[Exec versus shell form](06-exec-vs-shell-form.md)** | <span className="db-tier t-master">Master</span> | Decides whether your process is PID 1, and therefore gets `SIGTERM` |
| 07 | **[ENV versus ARG](07-env-vs-arg.md)** | <span className="db-tier t-master">Master</span> | Build-time versus run-time — and why `ARG` is not a secret |
| 08 | **[.dockerignore](08-dockerignore.md)** | <span className="db-tier t-master">Master</span> | Upload time, cache invalidation, and the `.env` you just shipped |
| 09 | **[USER](09-user.md)** | <span className="db-tier t-understand">Understand</span> | Root by default; install as root, run as somebody else |
| 10 | **[EXPOSE publishes nothing](10-expose.md)** | <span className="db-tier t-understand">Understand</span> | Documentation. `-p` publishes |
| 11 | **[HEALTHCHECK](11-healthcheck.md)** | <span className="db-tier t-understand">Understand</span> | Docker reports health and acts on nothing — something else must consume it |
| 12 | **[LABEL and image metadata](12-label-and-metadata.md)** | <span className="db-tier t-know">Know</span> | Which commit is deployed, answerable months later |
| 13 | **[VOLUME in a Dockerfile](13-volume.md)** | <span className="db-tier t-know">Know</span> | Anonymous volumes forever, and no way to undo it downstream |
| 14 | **[Heredocs](14-heredocs.md)** | <span className="db-tier t-know">Know</span> | Readable multi-line `RUN` — and why every one needs `set -e` |
| 15 | **[The syntax directive](15-syntax-directive.md)** | <span className="db-tier t-understand">Understand</span> | The frontend defines the language, so new features need no engine upgrade |
| 16 | **[STOPSIGNAL and SHELL](16-stopsignal-and-shell.md)** | <span className="db-tier t-know">Know</span> | The first signal, and `pipefail` for pipelines |
| 17 | **[ONBUILD](17-onbuild.md)** | <span className="db-tier t-when">When Needed</span> | Instructions that fire in someone else's build |

## Coverage

Eighteen syllabus topics across seventeen pages. **One pair is merged** —
`LABEL` and the deprecated `MAINTAINER` are one paragraph apart in practice, so
they share page 12. Nothing is dropped.

| Syllabus topic | Page |
|---|---|
| `FROM` — the base image and multiple stages | 01 |
| `RUN` — every `RUN` is a layer | 02 |
| `COPY` vs `ADD` | 03 |
| `WORKDIR`, and why `RUN cd` does not work | 04 |
| `CMD` vs `ENTRYPOINT` — the four combinations | 05 |
| Exec form vs shell form — signal delivery | 06 |
| `ENV` vs `ARG` — scope, and why `ARG` secrets leak | 07 |
| `.dockerignore` — context, cache, secrets | 08 |
| `USER` — running as non-root | 09 |
| `EXPOSE` publishes nothing | 10 |
| `HEALTHCHECK` and its options | 11 |
| `LABEL` and OCI annotation keys | 12 |
| `MAINTAINER` is deprecated — use a `LABEL` | 12 |
| `VOLUME` in a Dockerfile | 13 |
| Heredocs in `RUN`/`COPY` | 14 |
| The `# syntax=docker/dockerfile:1` parser directive | 15 |
| `STOPSIGNAL`, `SHELL` | 16 |
| `ONBUILD` | 17 |

## Phase gate

Move on to Phase 4 when you can write a Dockerfile for a Node service that:

- **runs as a non-root user** and can still write everywhere it needs to;
- **receives `SIGTERM` in the application process**, so `docker stop` returns in
  milliseconds rather than ten seconds;
- **has no secrets in `docker history`**;
- and whose `.dockerignore` keeps `.git`, `node_modules` and `.env` out of the
  context.

If the ten-second stop is still happening, reread pages 05 and 06 — that symptom
is the whole of this phase in one measurement.

## Where this connects

- **Phase 2** supplied the mechanism: [layers](../phase-2-images-and-registries/04-layers.md)
  explain why cleanup happens per layer, and
  [the image config](../phase-2-images-and-registries/07-image-config.md) is what
  the metadata instructions write to.
- **Phase 1** is the run-time mirror of this phase:
  [overriding the entrypoint](../phase-1-running-containers/11-overriding-entrypoint.md),
  [environment variables](../phase-1-running-containers/06-environment.md) and
  [the two signals](../phase-1-running-containers/08-stop-is-two-signals.md).
- **Phase 4 — Build strategy** takes `RUN`, ordering and the cache seriously, and
  is where `--mount=type=cache`, `--mount=type=secret` and multi-stage builds get
  their full treatment.
- **Phase 5 — Image quality** picks up size, non-root and the supply chain.
- **Phase 10 — Production** is where PID 1, `STOPSIGNAL` and `HEALTHCHECK` stop
  being trivia.

---

← Syllabus: [Part 2 — Building images](../../syllabus/02-building-images.md) · Prev phase: [Phase 2](../phase-2-images-and-registries/README.md) · Start → [FROM](01-from.md)
