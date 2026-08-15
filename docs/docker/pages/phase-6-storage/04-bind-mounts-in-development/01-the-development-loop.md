---
title: "The development loop"
sidebar_label: "01 · The development loop"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — bind mounts](https://docs.docker.com/engine/storage/bind-mounts/),
> [Docker — volumes](https://docs.docker.com/engine/storage/volumes/) and
> [Podman — podman-run](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**The point of a development bind mount is to make the image stop mattering
between saves.** Without one, every edit costs a build and a container recreate.
With one, the source the container executes *is* the source on your disk, and
the only thing the image still supplies is the runtime and the dependencies.

## The pattern

```bash
docker run --rm -it \
  --mount type=bind,src="$(pwd)/src",dst=/app/src \
  -p 3000:3000 \
  myapp:dev
```

Three things are true of that command and all of them matter:

1. **The image is still doing work.** Node, the installed dependencies, the
   entrypoint and the user all come from the image. You have replaced *your
   code*, not the environment.
2. **The mount is narrow.** `src/` and not the whole project. Everything you do
   not mount stays exactly as the image built it — which is the point of the
   next chunk.
3. **It is a development-only flag.** A production image contains its code. If
   your deployment bind-mounts source from the host, you have a directory on a
   server that nothing versions, and the image no longer describes what is
   running.

## What belongs where

| Thing | Where it lives | Why |
|---|---|---|
| Application source | **the mount** | it is what you are editing |
| `node_modules` (or `.venv`, `vendor/`) | **the image** | built for the container's OS and architecture |
| Build output (`dist/`, `.next/`, `build/`) | either, but pick one | writing it into the mount pollutes your host tree; keeping it in the container hides it from your editor |
| Config files | mount them **`readonly`** | you want to edit them, the container has no business rewriting them |
| Secrets, `.env` | mount `readonly`, or use environment variables | never bake them into the image ([Phase 3, page 07](../../phase-3-dockerfile/07-env-vs-arg.md)) |
| Database data | a **named volume**, never a host directory | page 02, and page 12 for the performance reason |

**Mount config files read-only, always.** A container that can rewrite the
`nginx.conf` in your repository is one bad entrypoint script away from a
confusing `git diff`:

```bash
--mount type=bind,src="$(pwd)/nginx.conf",dst=/etc/nginx/nginx.conf,readonly
```

## Why your file watcher does not fire

The most common complaint after "it can't find my modules" is "it doesn't
reload". The cause is almost always the same: **`inotify` events do not
reliably cross the host/VM boundary.**

- **Linux host, Linux container.** A bind mount is the *same* filesystem, so
  `inotify` works natively and watchers behave exactly as they do outside a
  container. Nothing to configure.
- **Docker Desktop on macOS or Windows.** The host filesystem is reached through
  a translation layer into a Linux VM. Filesystem *contents* propagate;
  filesystem *event* propagation has historically been the weak point, and it is
  why polling flags exist at all.
- **Podman machine on macOS or Windows.** Same shape, same caveat.

When events do not arrive, the fix is to stop waiting for them and poll:

```yaml
environment:
  CHOKIDAR_USEPOLLING: "true"     # chokidar — nodemon, many CLIs
  CHOKIDAR_INTERVAL: "1000"
  WATCHPACK_POLLING: "true"       # webpack 5 / Next.js
```

```js
// vite.config.js
export default {
  server: {
    watch: {usePolling: true, interval: 1000},
  },
}
```

⚠️ **Polling costs CPU in proportion to the number of files watched**, and it
will happily walk into `node_modules` if you let it. Set an interval rather than
taking the default, exclude what you can, and turn polling **off** on a Linux
host — there it is pure waste.

A second, subtler cause: **editors that save by rename.** Vim's default
`writebackup`, and several IDEs, write a temporary file and rename it over the
original. That produces a different `inotify` event than a write, and some
watchers miss it. If polling fixes it on a Linux host, this is usually why.

## Writes go the other way too

A bind mount is not read-only by default, and everything the container writes
into it lands in your working tree with the container's ownership. On a
rootless engine that means a UID you do not have, and `rm -rf node_modules`
then fails on your own laptop. That is page 05, and it is the single most
common rootless complaint.

Two habits that avoid most of it:

- **Mount narrowly.** `src/` rather than the project root means generated files
  have nowhere to land.
- **Run as you.** `--user "$(id -u):$(id -g)"` on Docker, or
  `--userns=keep-id` on rootless Podman (page 09).

## Gotchas

**Symptom:** Edits on the host are visible inside the container, but the server
never restarts.
**Cause:** The watcher relies on `inotify`, and events are not crossing the
host/VM boundary on Docker Desktop or a Podman machine.
**Fix:** Enable polling for that tool (`CHOKIDAR_USEPOLLING`,
`WATCHPACK_POLLING`, `server.watch.usePolling`) and set an explicit interval.
Leave it off on Linux hosts.

**Symptom:** The container is pinned at high CPU while idle.
**Cause:** Polling with the default interval over a large tree — usually because
`node_modules` is inside the watched path.
**Fix:** Raise the interval, restrict the watched paths, and exclude
`node_modules`. On Linux, turn polling off entirely.

**Symptom:** `dist/` and `.next/` keep appearing in `git status`.
**Cause:** The build runs inside the container and writes into the bind-mounted
project directory.
**Fix:** Either `.gitignore` them deliberately, or keep the output off the mount
by building to a path the mount does not cover.

**Symptom:** A config file in your repository was rewritten by the container.
**Cause:** It was bind-mounted read-write, and the image's entrypoint templates
it at start-up.
**Fix:** Mount it `readonly`, and have the entrypoint write its rendered copy
somewhere else — `/tmp` under a `tmpfs` is the usual answer (page 08).

## Interview questions

**★ What does a development bind mount actually change, and what stays the
image's job?**
It replaces the source the container executes with the source on your disk, so
an edit takes effect without a rebuild. The runtime, the installed dependencies,
the entrypoint and the user all still come from the image — you have swapped out
your code, not the environment. It is a development-only arrangement: a
production image contains its code, or the image no longer describes what is
running.

**★ Why does hot reload work on a Linux host and not on a Mac?**
On Linux the bind mount is the same filesystem, so `inotify` events are native.
On Docker Desktop and Podman machine the host filesystem is reached through a
translation layer into a Linux VM; contents propagate reliably, filesystem
events historically do not. The workaround is polling —
`CHOKIDAR_USEPOLLING`, `WATCHPACK_POLLING`, `server.watch.usePolling` — with an
explicit interval, and it should be off on Linux.

**★ What should never be on a development bind mount?**
Dependencies built for the container (`node_modules`, `.venv`, `vendor/`),
because they are compiled for the container's OS and architecture; and database
data, which belongs in a named volume for both persistence and performance.
Config files should be there but mounted read-only.

**Why mount `src/` rather than the whole project directory?**
Because a mount obscures everything under it. Mounting only the code you edit
leaves the image's `node_modules`, build output and metadata intact, and gives
container-generated files nowhere to land in your working tree.

**Your watcher polls correctly and still misses one editor's saves. Why?**
Some editors save by writing a temporary file and renaming it over the original,
which produces a different `inotify` event than a plain write; watchers that
only listen for modification miss it. Polling papers over it because it compares
state rather than listening for events.

---

Index: [Bind mounts in development](README.md) · Next → [The `node_modules` trap](02-the-node-modules-trap.md)
