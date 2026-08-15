---
title: "Making the change noticed"
sidebar_label: "02 · Making it noticed"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the Vite server options](https://vite.dev/config/server-options),
> [Docker — Compose file watch](https://docs.docker.com/compose/how-tos/file-watch/),
> [the Compose `services` element](https://docs.docker.com/reference/compose-file/services/) and
> [`docker container run`](https://docs.docker.com/reference/cli/docker/container/run/).
> **No sandbox** — no console output on this page.

**The file arrived and nothing happened.** That is the second failure class, and
it has two very different sub-cases: the *process* did not notice, or the
*browser* did not. They are fixed in different places.

## Filesystem events do not always cross a mount

A watcher subscribes to kernel notifications for a directory. Whether those
notifications arrive depends on what the mount actually is:

| Setup | Events |
|---|---|
| Linux host, bind mount, native filesystem | ✅ delivered — this just works |
| macOS / Windows (Desktop VM), bind mount | ⚠️ **the usual failure** — events cross a virtualisation boundary |
| WSL2, files on the **Windows** side | ⚠️ Vite's docs: watching *"fails when Windows applications edit files"* |
| Network filesystem (NFS, SMB) | ⚠️ *"Network filesystem limitations also apply similarly"* |
| `develop.watch` sync | ✅ **Compose watches on the host** and copies in — the boundary is not in the path |

🔴 **This is why "hot reload doesn't work in Docker" is mostly a macOS and Windows
sentence.** On a Linux host with a bind mount, it works; the problem is a
virtualised filesystem in between, and no amount of watcher configuration changes
what the kernel is not sending.

## Polling, and what it costs

Every watcher built on chokidar exposes the same escape hatch. Vite documents it
directly, for exactly this case:

> enabling `{ usePolling: true }`, though **polling significantly increases CPU
> usage**

```js
// vite.config.js
export default {
  server: {
    watch: { usePolling: true, interval: 300 },
  },
}
```

Node-side watchers built on the same library take the equivalent switch — commonly
through a `--legacy-watch`-style flag or a `CHOKIDAR_USEPOLLING` environment
variable, depending on the tool. ⚠️ **Check your watcher's own documentation for
the exact spelling** rather than assuming, because the names differ between tools
and change between versions.

**Polling is a last resort with a real cost:** it stats every watched file on every
interval, and with a project of any size that is a laptop fan running for as long
as the container is up. In order of preference:

1. **Move the files to where events work** — the Linux side under WSL2, or a
   Linux host.
2. **`develop.watch`**, which watches on the host and copies in.
3. **Narrow what is watched**, so polling is cheap if you must use it.
4. **Poll everything** — and expect the CPU cost.

## The two ports of a dev server

A framework dev server is easy to get wrong in a container because it needs *two*
things right — and only one of them is a Docker concept.

```yaml
  web:
    build:
      context: .
      target: dev
    command: npm run dev
    ports:
      - "5173:5173"
```

```js
// vite.config.js
export default {
  server: {
    host: true,        // 0.0.0.0 — listen on all addresses
    port: 5173,
    strictPort: true,  // fail rather than silently move
  },
}
```

- 🔴 **`host: true`.** Vite's default is `'localhost'`, and the docs describe the
  setting as *"Specify which IP addresses the server should listen on. Set this to
  `0.0.0.0` or `true` to listen on all addresses"*. Inside a container,
  `localhost` means **that container** — so the published port reaches the
  container and finds nothing listening on the interface it arrived on. This is
  the "port is published, connection refused" case from
  [Phase 7 · `localhost` inside a container](../../phase-7-networking/03-localhost-is-the-container.md).
- 🔴 **`strictPort: true`.** By default *"if the port is already being used, Vite
  will automatically try the next available port so this may not be the actual
  port the server ends up listening on"* — inside a container that silent move
  breaks your published mapping with no error anywhere. Failing loudly is the
  behaviour you want when a port mapping is fixed in a compose file.

⚠️ **HMR needs a WebSocket back from the browser**, and that connection is made
from your machine, not from inside the container. It works when the published
port and the port the server believes it is on agree; when they do not — a
different host port, or a reverse proxy in front — the client-side connection
target has to be configured explicitly. ⚠️ **Vite has consolidated the older
`hmr.protocol` / `hmr.host` / `hmr.port` / `hmr.clientPort` options into a newer
`server.ws` configuration**, so check the version of the documentation matching
your Vite before copying a snippet from a blog post.

**The simple rule that avoids all of it: publish the same port number on both
sides.** `"5173:5173"`, not `"3000:5173"`.

## Restart versus reload

| The change is in | You want |
|---|---|
| Application source the process re-reads | `sync` — the watcher handles it |
| Config read only at start-up (`nginx.conf`, a `.env` the app reads once) | `sync+restart` |
| A dependency manifest, the lockfile, the Dockerfile | `rebuild` |
| Something a command must regenerate (a client, a schema) | `sync+exec` |

Matching these correctly is what makes a watch block feel instant instead of
"sometimes it picks it up". A `rebuild` rule with too broad a `path` — `.` rather
than `package.json` — turns every keystroke into an image build, which reads as
"hot reload is slow" rather than as a misconfiguration.

## Podman

Nothing here is engine-specific: filesystem events are the kernel's, and
`develop.watch` belongs to the compose provider
([Phase 8 · `podman compose`](../../phase-8-compose/15-podman-compose.md)).
The one Podman-flavoured difference is ownership — a rootless bind mount can leave
the watcher unable to read the directory at all, which presents as "no events"
rather than as a permission error, and is worth ruling out with the delivery test
before touching any polling setting.

## Gotchas

**Symptom:** The file is definitely inside the container and nothing rebuilds.
**Cause:** Filesystem events are not crossing the mount — the usual case on
macOS, Windows, WSL2 with files on the Windows side, or a network filesystem.
**Fix:** Move the project to the Linux side, or switch to `develop.watch`. Polling
is the fallback, and Vite's docs warn it *"significantly increases CPU usage"*.

**Symptom:** The dev server is published and the browser says connection refused.
**Cause:** The server is listening on `localhost`, which inside a container means
that container only.
**Fix:** `server.host: true` (or `0.0.0.0`). This is configuration in the
framework, not in Compose.

**Symptom:** It works, then one day the browser connects to nothing.
**Cause:** The port was in use inside the container, and Vite moved to the next
free one without failing — while the published mapping still points at the
original.
**Fix:** `strictPort: true`, and publish the same number on both sides.

**Symptom:** The page reloads fully instead of applying HMR, or the HMR socket
never connects.
**Cause:** The client cannot reach the WebSocket at the address the server
advertises — typically a remapped host port or a proxy in front.
**Fix:** Publish matching ports. If you cannot, configure the client-side
connection explicitly, using the docs for *your* Vite version — the older `hmr.*`
options have been consolidated into `server.ws`.

## Interview questions

**★ The file is in the container and nothing rebuilds. What is happening?**
The watcher is not receiving filesystem events. That is normal when the mount
crosses a virtualisation boundary — Docker Desktop on macOS or Windows, WSL2 with
the files on the Windows side, or a network filesystem — because the kernel
notifications the watcher subscribes to are not delivered across it. The good
fixes are moving the files to where events work or switching to `develop.watch`,
which watches on the host; polling works but Vite's own documentation warns that
it significantly increases CPU usage.

**★ Why does a Vite dev server in a container need `host: true`?**
Because its default is `localhost`, and inside a container `localhost` is that
container's own loopback. The published port delivers traffic on the container's
external interface, where nothing is listening, so you get connection refused
despite a correct `-p`. `host: true` (or `0.0.0.0`) makes it listen on all
addresses. Pair it with `strictPort: true`, because Vite otherwise moves silently
to the next free port and breaks a fixed published mapping.

**★ How do you decide between `sync`, `sync+restart` and `rebuild`?**
By what has to happen for the change to take effect. Source that a running process
or its watcher re-reads needs only `sync`. Configuration read once at start-up
needs the process bounced: `sync+restart`. A change to dependencies, the lockfile
or the Dockerfile needs a new image: `rebuild`. Getting this wrong in the
expensive direction — a `rebuild` rule with `path: .` — makes every keystroke
build an image, which people report as "hot reload is slow".

**Why is HMR harder than the initial page load?**
Because HMR adds a WebSocket connection made *from the browser* back to the dev
server, so it depends on the address the server advertises being reachable from
your machine. A remapped host port or a proxy in front breaks that even though the
page itself loads fine. Publishing the same port number on both sides avoids the
whole class; otherwise the client connection has to be configured explicitly.

---

← Prev: [Getting the file in](01-getting-the-file-in.md) · Index: [Hot reload inside a container](README.md) · Next → [Secrets in dev vs prod](../06-secrets-dev-vs-prod.md)
