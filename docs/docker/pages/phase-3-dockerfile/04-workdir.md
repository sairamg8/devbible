---
title: "WORKDIR"
sidebar_label: "04 · WORKDIR"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the [Dockerfile reference — WORKDIR](https://docs.docker.com/reference/dockerfile/#workdir)
> and [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/).
> **No sandbox** — no console output on this page.

**`WORKDIR` sets the working directory for every instruction that follows, and
for the container at run time.** Small instruction, one classic mistake.

## Why `RUN cd` does not work

```dockerfile
# ❌ Each RUN is its own shell. The cd is gone by the next instruction.
RUN cd /app
RUN npm ci               # runs in / — not in /app

# ✅
WORKDIR /app
RUN npm ci               # runs in /app
```

Every `RUN` starts a fresh shell in a fresh layer. A `cd` affects that shell and
nothing else. `WORKDIR` changes the image's configuration, so it persists across
instructions and into the container.

Within a single `RUN` a `cd` is fine, because it is one shell:

```dockerfile
RUN cd /tmp && curl -fsSL https://example.com/x.tar.gz | tar -xz
```

## It applies to more than `RUN`

`WORKDIR` sets the directory for `RUN`, `CMD`, `ENTRYPOINT`, `COPY` and `ADD` —
so relative destinations resolve against it:

```dockerfile
WORKDIR /app
COPY package*.json ./     # → /app/package.json
RUN npm ci                # → in /app
CMD ["node", "server.js"] # → /app/server.js
```

It also becomes the container's starting directory, which is why
`docker exec -it api sh` drops you in `/app` rather than `/`.

## Relative paths stack

```dockerfile
WORKDIR /app
WORKDIR src               # now /app/src
```

Legal, and usually a readability problem. **Use absolute paths** so a reader does
not have to track state through the file.

## It creates the directory

`WORKDIR /app` creates `/app` if it does not exist — including intermediate
directories. Convenient, and it means a typo produces an empty directory rather
than an error, so the failure surfaces later as "my files are not there".

⚠️ **Directories created by `WORKDIR` are owned by root**, even if a `USER`
instruction came earlier. For an image that runs non-root and needs to write
there, create it explicitly:

```dockerfile
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
WORKDIR /app
```

## Set it early, once

Two habits worth adopting:

- **Absolute, near the top**, right after `FROM`. Everything below then reads
  relative to a single known location.
- **Do not use `/`.** Running in the root directory means relative paths resolve
  against the whole filesystem, and mistakes get expensive. A dedicated `/app`
  costs nothing.

`WORKDIR` is metadata: it changes the image config, not the filesystem, so it
adds no filesystem layer
([Phase 2, page 07](../phase-2-images-and-registries/07-image-config.md)).

## Podman

Identical, and `podman run -w` overrides it at run time exactly as `docker run
-w` does
([Phase 1, page 14](../phase-1-running-containers/14-user-workdir-hostname.md)).

## Gotchas

**Symptom:** A `RUN` runs in the wrong directory although a `cd` precedes it.
**Cause:** The `cd` was in an earlier `RUN`, so it applied to a shell that has
exited.
**Fix:** `WORKDIR`. Use `cd` only within a single `RUN`.

**Symptom:** A non-root container cannot write to its working directory.
**Cause:** `WORKDIR` created it as root.
**Fix:** `mkdir` and `chown` explicitly before switching `USER`.

**Symptom:** `COPY . .` put files somewhere unexpected.
**Cause:** The relative destination resolved against the current `WORKDIR`,
which an earlier relative `WORKDIR` had changed.
**Fix:** Absolute `WORKDIR` paths, set once.

**Symptom:** A typo'd `WORKDIR` produced an empty directory and a confusing
runtime error instead of a build failure.
**Cause:** `WORKDIR` creates what does not exist.
**Fix:** Nothing to configure — just know that the failure appears later, at run
time, as missing files.

## Interview questions

**★ Why does `RUN cd /app` not affect the next instruction?**
Each `RUN` executes in its own shell in its own layer; the `cd` dies with that
shell. `WORKDIR` changes the image configuration, so it persists across
instructions and into the running container.

**★ What does `WORKDIR` affect besides `RUN`?**
`CMD`, `ENTRYPOINT`, `COPY` and `ADD` — relative paths in all of them resolve
against it — and it becomes the container's starting directory at run time.

**★ Why can a non-root container fail to write to its `WORKDIR`?**
Because `WORKDIR` creates missing directories owned by root, regardless of any
earlier `USER`. Create and `chown` the directory explicitly before switching
users.

**Does `WORKDIR` create a layer?**
No filesystem layer — it changes the image config. It can create a directory as a
side effect, which does affect the filesystem, but the instruction itself is
metadata.

---

← Prev: [COPY versus ADD](03-copy-vs-add.md) · Index: [Phase 3](README.md) · Next → [CMD versus ENTRYPOINT](05-cmd-vs-entrypoint.md)
