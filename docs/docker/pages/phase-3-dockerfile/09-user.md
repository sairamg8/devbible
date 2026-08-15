---
title: "USER"
sidebar_label: "09 · USER"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the [Dockerfile reference — USER](https://docs.docker.com/reference/dockerfile/#user),
> [Docker — security best practices](https://docs.docker.com/build/building/best-practices/) and
> [podman-run(1) — --userns](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**Containers run as root unless you say otherwise, and most images never say
otherwise.** One instruction fixes it, and the ordering rules around it are where
the friction lives.

## The default is root

With no `USER`, the process runs as UID 0 inside the container. That root is
constrained — 14 capabilities, seccomp, MAC
([Phase 0, pages 09–10](../phase-0-what-a-container-is/09-capabilities.md)) —
but it is still the widest starting position, and it means:

- a container escape starts from root,
- a bind-mounted host directory can be written as root,
- anything that reads `/proc` or `/sys` has more access than it needs.

Rootless Podman softens this a great deal, because root inside is your
unprivileged user outside
([Phase 0, page 11](../phase-0-what-a-container-is/11-rootless.md)). It does not
remove the reason to set `USER`: defence in depth, and your image should not
depend on which engine runs it.

## The instruction

```dockerfile
USER node                 # by name — the user must exist in /etc/passwd
USER 1000                 # by UID — always works
USER 1000:1000            # UID:GID
```

`USER` applies to every `RUN`, `CMD` and `ENTRYPOINT` **after** it, and becomes
the container's default user at run time (overridable with `docker run --user`).

**Prefer the numeric form for the final `USER`.** Some orchestrators enforce
"must not run as root" by checking the numeric UID, and cannot resolve a name.
A numeric UID also survives an image whose user database is minimal.

## Ordering: root to install, non-root to run

Installation needs privileges; running does not.

```dockerfile
FROM node:24-slim
WORKDIR /app

# still root: install and prepare
COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

# drop privileges last
USER node
CMD ["node", "server.js"]
```

Two details that matter:

- **`COPY` writes as root by default**, so a non-root process may not be able to
  write into what it copied. `--chown` at copy time is cheaper than a
  `RUN chown -R`, which duplicates every file into a new layer
  (page 03).
- **Directories the application must write to** — uploads, caches, a socket path
  — need creating and `chown`ing *before* the `USER` switch:

```dockerfile
RUN mkdir -p /app/uploads /app/tmp && chown -R node:node /app
USER node
```

## When the base image already has a user

Many official images ship one — `node` has `node` (UID 1000), `nginx` has
`nginx`, `postgres` has `postgres`. Use it rather than inventing another; it
already owns the directories the image expects.

To create one:

```dockerfile
RUN useradd --system --uid 1001 --gid 0 --create-home appuser   # Debian/Ubuntu
RUN adduser -S -u 1001 appuser                                  # Alpine
```

`--system` avoids consuming a login UID, and a UID above 1000 stays clear of
distribution-reserved ranges.

## The inherited-`USER` trap

If a base image ends with a non-root `USER`, **your** `RUN` instructions inherit
it and package installation fails with permission errors (page 01):

```dockerfile
FROM someimage          # ends with USER appuser
USER root               # ← needed for the install
RUN apt-get update && apt-get install -y curl
USER appuser            # ← switch back
```

Forgetting the switch back leaves a root container, which is the failure mode
that matters.

## Root-owned files and non-root processes

The most common runtime symptom of a good `USER` line:

```
EACCES: permission denied, open '/app/data/cache.json'
```

The process is non-root; the directory is root-owned. The fix is ownership in the
image (above) or, for a mounted volume, ownership on the host side — Phase 6,
where `--userns=keep-id` and the `:z`/`:Z` labels also come in.

## Podman

`USER` is honoured identically. The difference is what the UID *means*: rootless
Podman maps container UIDs into your subordinate range, so a container running as
UID 1000 writes files owned by 100999 on the host
([Phase 0, page 11](../phase-0-what-a-container-is/11-rootless.md)). `USER`
controls the inside; `--userns` controls the mapping. Both matter for bind
mounts, and they are separate settings.

## Gotchas

**Symptom:** `RUN apt-get install` fails with permission denied and there is no
`USER` in your Dockerfile.
**Cause:** Inherited from the base image.
**Fix:** `USER root` before the install, and a non-root `USER` at the end.

**Symptom:** The application cannot write to a directory it created at build
time.
**Cause:** `RUN mkdir` ran as root; the process runs as `node`.
**Fix:** `chown` in the same `RUN`, before switching `USER`.

**Symptom:** A `USER` name fails with "unable to find user".
**Cause:** The name does not exist in the image's `/etc/passwd`.
**Fix:** Create the user, or use the numeric UID.

**Symptom:** An orchestrator rejects the image for running as root although
`USER appuser` is set.
**Cause:** The policy checks a numeric UID and cannot resolve the name.
**Fix:** `USER 1001` — numeric — as the final instruction.

## Interview questions

**★ Why does a container run as root by default, and why change it?**
Because no `USER` means UID 0. Changing it reduces blast radius: an escape starts
unprivileged, bind mounts cannot be written as root, and the process holds only
what it needs. It costs one instruction.

**★ Where does `USER` go in a Dockerfile, and why?**
As late as possible. Installation and file preparation need root; the running
process does not. Everything after `USER` runs unprivileged, so put it
immediately before `CMD`.

**★ Why does a non-root container often fail to write to its own directories?**
`COPY` and `RUN mkdir` execute as root, so the files are root-owned. Use
`COPY --chown` and `chown` inside the `RUN` that creates the directory, before
switching users.

**Name or numeric UID?**
Numeric for the final `USER`. Orchestrator policies that enforce non-root check
the numeric UID and cannot resolve a name, and a numeric UID works in images with
a minimal user database.

**Does rootless Podman make `USER` unnecessary?**
No. Rootless already maps container root to an unprivileged host user, but
`USER` is defence in depth and keeps the image correct regardless of which engine
runs it. The two controls are independent.

---

← Prev: [.dockerignore](08-dockerignore.md) · Index: [Phase 3](README.md) · Next → [EXPOSE](10-expose.md)
