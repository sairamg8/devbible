---
title: "The image config"
sidebar_label: "07 · The image config"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the
> [OCI Image Specification — image configuration](https://github.com/opencontainers/image-spec/blob/main/config.md),
> [docker image inspect](https://docs.docker.com/reference/cli/docker/inspect/) and the
> [Dockerfile reference](https://docs.docker.com/reference/dockerfile/).
> **No sandbox** — no console output on this page.

**An image is layers *plus a config*, and the config is what makes it
runnable.** It holds the default command, the environment, the user and the
working directory — everything a container needs that is not a file.

## What is in it

Per the OCI image spec's config object:

| Field | Set by | What it does |
|---|---|---|
| `Entrypoint` | `ENTRYPOINT` | The program to run |
| `Cmd` | `CMD` | Its default arguments |
| `Env` | `ENV` | Environment variables present in every container |
| `User` | `USER` | The UID/GID the process starts as |
| `WorkingDir` | `WORKDIR` | The starting directory |
| `Labels` | `LABEL` | Arbitrary metadata |
| `ExposedPorts` | `EXPOSE` | Documented ports (publishes nothing) |
| `Volumes` | `VOLUME` | Paths that get an anonymous volume automatically |
| `StopSignal` | `STOPSIGNAL` | The signal `docker stop` sends first |
| `Healthcheck` | `HEALTHCHECK` | The probe and its timings |

Alongside it the config records `architecture`, `os`, the layer diff IDs, and the
build history that `docker history` reads.

## Reading it

```bash
docker image inspect node:24-slim
docker image inspect --format '{{json .Config}}' node:24-slim
docker image inspect --format '{{.Config.User}}' myapi:1.4.2       # empty = root
docker image inspect --format '{{json .Config.Env}}' myapi:1.4.2
docker image inspect --format '{{.Architecture}}/{{.Os}}' myapi:1.4.2
```

Two of these are worth running on any image before you trust it:

- **`.Config.User`** — an empty value means it runs as **root**. That is still
  the default for a surprising number of images.
- **`.Config.Env`** — occasionally contains a credential somebody baked in.

## Image config vs container config

`docker image inspect` shows the image's defaults. `docker inspect <container>`
shows what that container **actually** got after run-time overrides were applied.

They differ whenever a flag overrode a default — `-e`, `--user`, `--entrypoint`,
`-w`. When behaviour surprises you, compare the two: the image says what was
intended, the container says what happened
([Phase 1, page 03](../phase-1-running-containers/03-ps-inspect-logs-stats.md)).

## This is what `export` loses

The distinction explains a recurring confusion, covered fully on
[page 11](11-save-load-export-import.md):

- **`docker save`** writes the image — layers **and** config — so `load` restores
  something runnable.
- **`docker export`** writes a container's **filesystem only**. `import` produces
  an image with no `Entrypoint`, no `Cmd`, no `Env`. It "loses its start
  command", because that never lived in the filesystem.

## Labels worth setting

`LABEL` is free and makes an image traceable back to the source that built it.
The OCI annotation keys are the conventional ones:

```dockerfile
LABEL org.opencontainers.image.source="https://github.com/myorg/api" \
      org.opencontainers.image.revision="$GIT_SHA" \
      org.opencontainers.image.version="1.4.2" \
      org.opencontainers.image.licenses="Apache-2.0"
```

`image.source` is the one with immediate practical value: several registries
(GHCR among them) use it to link a package to its repository, and it answers
"where did this image come from" months later without archaeology.

## Podman

`podman image inspect` returns the same structure with the same field names,
because both engines read the OCI config. `podman inspect --format` uses the same
Go template syntax, so scripts port directly.

## Gotchas

**Symptom:** A container runs as root although the Dockerfile has a `USER` line.
**Cause:** `USER` applies to instructions **after** it, and a later `USER root`
or a run-time `--user` overrides it.
**Fix:** Check both sides — `docker image inspect --format '{{.Config.User}}'`
for the image's intent, `docker inspect` on the container for what happened.

**Symptom:** An environment variable exists in the container that appears nowhere
in your Compose file.
**Cause:** It came from the image's `Env`, inherited from the base image.
**Fix:** `docker image inspect --format '{{json .Config.Env}}'`. Base images set
plenty — `PATH`, `NODE_VERSION`, and language-specific ones.

**Symptom:** An imported image does not start: "no command specified".
**Cause:** It came from `docker export`/`import`, so it has a filesystem but no
config.
**Fix:** Supply the command at run time, or use `save`/`load` instead, which
preserves the config.

**Symptom:** `EXPOSE` is set and the port is not reachable.
**Cause:** `EXPOSE` is metadata in `ExposedPorts`. It publishes nothing.
**Fix:** `-p`, or Compose's `ports:`
([Phase 1, page 05](../phase-1-running-containers/05-publishing-ports.md)).

## Interview questions

**★ What is in an image besides its layers?**
A configuration object: `Entrypoint`, `Cmd`, `Env`, `User`, `WorkingDir`,
`Labels`, `ExposedPorts`, `Volumes`, `StopSignal` and `Healthcheck`, plus
architecture, OS and build history. That config is what makes an image runnable
rather than merely unpackable.

**★ Why does an exported-and-imported container lose its start command?**
`export` writes the filesystem only. `Entrypoint` and `Cmd` live in the image
config, not in any file, so they are not part of what was exported. `save`/`load`
preserves both.

**★ How do you check whether an image runs as root?**
`docker image inspect --format '{{.Config.User}}' <image>` — an empty value means
root. Compare with `docker inspect` on a running container to see whether a
run-time `--user` changed it.

**Which Dockerfile instructions change the config rather than the filesystem?**
`ENV`, `WORKDIR`, `USER`, `LABEL`, `EXPOSE`, `CMD`, `ENTRYPOINT`, `VOLUME`,
`STOPSIGNAL` and `HEALTHCHECK`. `RUN`, `COPY` and `ADD` are the ones that produce
filesystem layers.

**Why set OCI labels on your images?**
They make an image traceable to the repository, commit and version that produced
it, and registries such as GHCR use `org.opencontainers.image.source` to link a
package to its repository. It costs one instruction and saves an archaeology
session later.

---

← Prev: [Reading docker history](06-history.md) · Index: [Phase 2](README.md) · Next → [Registries and rate limits](08-registries.md)
