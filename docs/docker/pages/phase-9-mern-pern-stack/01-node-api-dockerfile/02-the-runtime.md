---
title: "The runtime"
sidebar_label: "02 · The runtime"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Docker — Containerize a Node.js application](https://docs.docker.com/guides/nodejs/containerize/),
> [the Dockerfile reference](https://docs.docker.com/reference/dockerfile/)
> (`USER`, `EXPOSE`, `CMD`, `HEALTHCHECK`),
> [the Node.js `process` documentation](https://nodejs.org/api/process.html) and
> [`docker container run`](https://docs.docker.com/reference/cli/docker/container/run/).
> **No sandbox** — no console output on this page.

**The runtime stage is defined by what it leaves out.** Two directories, a user,
and a command — and the two lines that most often go wrong are the last two.

```dockerfile
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps  --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist         ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## `USER node`, and why `--chown` is on every `COPY`

The official Node images already contain a **`node`** user, so you do not create
one — you switch to it. Everything before `USER` runs as root, which is correct:
install as root, run as somebody else
([Phase 3 · `USER`](../../phase-3-dockerfile/09-user.md)).

🔴 **`COPY --chown` at copy time, not `RUN chown -R` afterwards.** A recursive
`chown` on `node_modules` rewrites every file, and because a layer is a diff,
that produces a second full copy of the directory inside the image — a permission
fix that doubles the layer ([Phase 2 · Layers](../../phase-2-images-and-registries/04-layers.md)).
Docker's own guide uses `--chown=node:node` on the production stage's copies for
this reason.

Two more consequences worth knowing before they bite:

- **Directories created by `WORKDIR` are root-owned**, even after a `USER`. If
  the application writes anywhere at run time — an upload directory, a cache — it
  needs `mkdir` plus `chown` **before** the `USER` line, or a `tmpfs`/volume
  mounted with the right ownership ([Phase 6 · Storage](../../phase-6-storage/README.md)).
- **A numeric UID is what orchestrator policies can check.** `USER node` is
  readable; `USER 1000` is what a `runAsNonRoot` policy can verify without
  resolving a name. Where a platform enforces that, prefer the number — and note
  that the two are the same user in the official images.

⚠️ **Non-root does not mean unprivileged everywhere.** Under rootless Podman,
`node` inside the container maps to some high UID on the host, which is what makes
bind-mounted files unreadable in the way phase 6 describes
([Phase 0 · Rootless](../../phase-0-what-a-container-is/11-rootless.md)).

## `CMD ["node", "dist/index.js"]` — not `npm start`

This is the single most consequential line in the file.

**Exec form** (a JSON array) makes your process **PID 1** directly. Shell form
(`CMD node dist/index.js`) puts `/bin/sh` at PID 1 with node as its child, and
`sh` does not forward `SIGTERM` — so every `docker stop` waits out the full grace
period and then kills the process outright
([Phase 3 · exec versus shell form](../../phase-3-dockerfile/06-exec-vs-shell-form.md)).

🔴 **`CMD ["npm", "start"]` is the same bug wearing a friendlier name.** npm is
another process between the engine and yours, and the signal has to survive the
extra hop. Run `node` directly. Docker's guide does exactly this: the development
stage uses `npm run dev`, and the production stage runs `node` on the built
entry point.

The two facts that make this concrete, both from the Node documentation and
already established in this track:

- **Node installs default handlers for `SIGTERM` and `SIGINT`**, so a plain
  exec-form `CMD ["node", …]` really does exit cleanly on `docker stop`.
- 🔴 **Adding `process.on('SIGTERM', …)` removes that default behaviour.** From
  the moment you register a handler, exiting is *your* job — and a handler that
  logs but never calls `server.close()` and `process.exit()` turns a clean stop
  into a ten-second wait. That is the production trap, and it is the hand-off
  into **[Phase 10 · Graceful shutdown](../../phase-10-production/02-graceful-shutdown/README.md)**.

## `ENV NODE_ENV=production`

It is not decoration. Express and much of its ecosystem change behaviour on it —
caching view templates, terser error output — and some packages skip development
machinery entirely when it is set.

⚠️ **Setting it in the image is a default, not a lock.** Run time beats image
`ENV`, so `-e NODE_ENV=development` or a Compose `environment:` entry overrides it
([Phase 1 · Environment](../../phase-1-running-containers/06-environment.md)).
That is the correct layering: the image says what it is *for*, the deployment says
what it *is*.

⛔ **`NODE_ENV` is not what makes `--omit=dev` unnecessary.** They are different
mechanisms — one changes runtime behaviour, the other decides what was installed.
Do both.

## `EXPOSE 3000` publishes nothing

`EXPOSE` is documentation that travels with the image. It opens no port, and
container-to-container traffic needs neither it nor `-p`
([Phase 3 · `EXPOSE`](../../phase-3-dockerfile/10-expose.md)). Keep it because it
tells the next person — and `docker compose run --service-ports` — which port the
process listens on.

**The application must listen on `0.0.0.0`, not `127.0.0.1`.** A server bound to
loopback inside a container is reachable only from that container, which is the
"the port is published and I get connection refused" report
([Phase 7 · `localhost` inside a container](../../phase-7-networking/03-localhost-is-the-container.md)).

## Healthcheck: in the image or in Compose?

Both are available and they mean slightly different things:

```dockerfile
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --start-interval=2s \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

- **In the image**, it travels with the artefact — anyone running it gets the
  check, including a plain `docker run`.
- **In Compose**, it is visible to the person reading the stack and easy to tune
  per environment, and it is what `depends_on: condition: service_healthy` reads
  ([Phase 8 · Healthchecks](../../phase-8-compose/06-healthchecks/README.md)).

The defaults are wrong for an API — 30 s interval, 30 s timeout, 3 retries means
roughly 90 seconds of a wedged service reporting healthy — so set them either
way. **Use the runtime already in the image** rather than installing `curl` just
to check yourself, and **check your own readiness, not your dependencies**: a
check that pings the database marks every replica unhealthy at once when the
database blips.

## What must not ship

| Not in the runtime stage | Why |
|---|---|
| Source `.ts`, tests, fixtures | Not needed to run; they are attack surface and size |
| Development dependencies | The `deps` stage exists precisely to keep them out |
| `.env`, keys, tokens | A layer is published; rotation is the only fix |
| `git`, `curl`, a package manager, a compiler | Every tool present is a tool available after a compromise |
| A `VOLUME` instruction | It silently defeats `--read-only`, and there is no way to un-declare it ([Phase 3 · `VOLUME`](../../phase-3-dockerfile/13-volume.md)) |

## Podman

Nothing on this page is Docker-specific — the Dockerfile is built by Buildah or
BuildKit alike, and `USER`, `EXPOSE`, `CMD` and `HEALTHCHECK` mean the same
thing. Two differences already established: **Buildah does not fetch BuildKit
frontends**, so the `# syntax=` line is accepted and ignored
([Phase 3 · The syntax directive](../../phase-3-dockerfile/15-syntax-directive.md)),
and **Podman runs healthchecks from systemd timers** rather than a daemon loop,
so a check may not run at all without a systemd user session
([Phase 3 · `HEALTHCHECK`](../../phase-3-dockerfile/11-healthcheck.md)).

## Gotchas

**Symptom:** Every deploy takes exactly ten seconds and drops in-flight requests.
**Cause:** Shell-form `CMD`, or `CMD ["npm", "start"]` — something other than
your process is PID 1, and `SIGTERM` is not reaching node.
**Fix:** Exec form, running `node` directly. Time a `docker stop`: instant means
the signal arrived, ten seconds means it did not.

**Symptom:** The application handles `SIGTERM` and *still* takes ten seconds.
**Cause:** Registering a handler removed Node's default exit behaviour, and the
handler never finishes the job.
**Fix:** Close the server, drain, then `process.exit()`. Phase 10 is the full
treatment.

**Symptom:** `EACCES` writing a file at run time, after adding `USER node`.
**Cause:** Directories created by `WORKDIR` or `RUN mkdir` are root-owned, and
the switch to `node` happens afterwards.
**Fix:** `mkdir` and `chown` before the `USER` line, or mount the writable path
as a volume or `tmpfs` with the right ownership.

**Symptom:** The port is published, and connections are refused.
**Cause:** The server binds `127.0.0.1`, which inside a container means that
container only.
**Fix:** Listen on `0.0.0.0`. `EXPOSE` is unrelated — it publishes nothing.

## Interview questions

**★ Why `CMD ["node", "dist/index.js"]` rather than `CMD ["npm", "start"]`?**
Because whatever is at PID 1 receives the signals. Running node directly makes
your process PID 1, and Node's default `SIGTERM` handling exits cleanly. With
`npm start`, npm is PID 1 and the signal has an extra hop to survive; with shell
form, `sh` is PID 1 and does not forward `SIGTERM` at all — and as PID 1 with no
handler it is not killed by it either, so the full grace period elapses on every
stop.

**★ You added a `SIGTERM` handler and shutdown got worse. Why?**
Because registering a handler replaces Node's default disposition. Before, the
default behaviour exited the process; now exiting is your responsibility, and a
handler that logs without closing the server and exiting leaves the process
running until the engine's `SIGKILL`. The fix is to finish the sequence — stop
accepting, drain, exit.

**★ Why `COPY --chown` instead of `RUN chown -R` after copying?**
Because a layer is a diff. Changing ownership of every file in `node_modules`
writes a second full copy of that directory into the image, so a permissions fix
doubles the size of the largest layer. `--chown` sets ownership as the files are
written, in one layer.

**What does `EXPOSE` actually do, and what does the application still have to do?**
Nothing at the network level — it is metadata that documents the listening port
and is read by tools such as `compose run --service-ports`. The application must
still bind `0.0.0.0`; binding loopback makes it reachable only from inside its own
container regardless of any published port.

**Image healthcheck or Compose healthcheck?**
The image one travels with the artefact and applies to anyone who runs it; the
Compose one is visible in the stack file, tunable per environment, and is what
`depends_on: condition: service_healthy` consults. Either way the defaults are
too slow for an API, the check should use a runtime already present in the image,
and it must test only this service — checking the database from every replica
turns one blip into a stack-wide outage.

---

← Prev: [The build](01-the-build.md) · Index: [Containerising a Node/Express API](README.md) · Next → [Dev image vs prod image](../02-dev-vs-prod-image.md)
