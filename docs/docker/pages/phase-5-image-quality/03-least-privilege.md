---
title: "Least privilege in the image"
sidebar_label: "03 · Least privilege"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Docker — engine security](https://docs.docker.com/engine/security/),
> [`docker container run`](https://docs.docker.com/reference/cli/docker/container/run/),
> [Docker — running containers](https://docs.docker.com/engine/containers/run/),
> [the Dockerfile reference — `USER`](https://docs.docker.com/reference/dockerfile/#user) and
> [`podman-run(1)`](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**Three properties, and an image should have all three by default: it runs as a
non-root user, it does not need to write to its own root filesystem, and it needs
no Linux capabilities.** Each one is cheap to build in and expensive to retrofit,
because retrofitting means discovering at 3 a.m. which directory your application
writes to.

## Why the default is wrong

> "The default user within a container is `root` (uid = 0)."

So unless the image says otherwise, your application runs as uid 0 inside the
container. That is not the same as root on the host — namespaces and the
capability set constrain it — but it is a much larger blast radius than the
application needs, and it composes badly with everything else: a bind-mounted
host directory, a container escape, a `--privileged` flag someone added to make
a problem go away.

The three properties below each remove one axis of that.

## 1. A non-root `USER`

Create the user in the image and switch to it after everything that needs root
is done:

```dockerfile
FROM node:22-alpine
WORKDIR /app

# install as root
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ownership handed over explicitly
COPY --chown=node:node . .

# and from here on, not root
USER node
CMD ["node", "server.js"]
```

Three details that decide whether this works:

**Order.** `USER` affects the instructions *after* it, so installs happen first
([Phase 4 · instruction ordering](../phase-4-build-strategy/02-instruction-ordering.md)).

**Ownership.** `COPY` creates files owned by uid 0 unless told otherwise, so an
application running as `node` cannot write them. `--chown` on the copy is the
fix ([Phase 4 · `COPY --from`](../phase-4-build-strategy/07-copy-from.md)).

**A numeric UID is more portable than a name.** `USER 1000` works regardless of
whether `/etc/passwd` in the final stage has an entry — which matters for
distroless and scratch bases, where it often does not. Orchestrators that enforce
"must not run as root" typically inspect the numeric value, and cannot resolve a
name.

Many official images ship a suitable non-root user already — `node` in the Node
images, for instance — so the work is often just the `USER` line and the
`--chown`.

## 2. A read-only root filesystem

> `--read-only` — "Mount the container's root filesystem as read only"

An application that never writes outside its data directories can run this way,
and then a compromise cannot drop a binary, edit a config, or persist anything at
all.

The image's job is to **make that possible**: no writes to `/app`, no logs to
`/var/log` inside the container, no scratch files in the working directory. Where
writes are genuinely needed, they get an explicit mount:

```bash
docker run --read-only \
  --tmpfs /tmp \
  -v appdata:/data \
  myapp:1.0
```

> `--tmpfs` — "Mount a tmpfs directory"

`/tmp` on a tmpfs is the usual accommodation, because a surprising number of
libraries write there. Data belongs in a volume, which is
[Phase 6 · Storage](../phase-6-storage/README.md)'s subject.

**Log to stdout, not to a file.** It is the twelve-factor rule and it is also
what makes `--read-only` viable — the engine collects the stream, so the
container needs no writable log directory.

## 3. Dropped capabilities

Docker already narrows root's powers:

> "By default Docker drops all capabilities except those needed", using "an
> allowlist instead of a denylist approach."

The recommendation goes further:

> "Remove all capabilities except those explicitly required for their processes."

```bash
docker run --cap-drop=ALL myapp:1.0
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE myapp:1.0
```

The second form is the one exception most services need: binding a port below
1024. And the better answer is usually **not to need it** — listen on 8080 inside
the container and publish it as 80 outside, which costs nothing and removes the
capability entirely.

The documentation is blunt about the direction of travel: capability removal
enhances security and addition reduces it. `--privileged` — "give extended
privileges to this container" — is the opposite of this entire page, and any
`--privileged` in a compose file or a run script deserves a specific
justification.

## The image cannot enforce any of it

An uncomfortable truth worth being clear about: `USER` in the Dockerfile is a
**default**, and `docker run --user 0` overrides it. `--read-only` and
`--cap-drop` are runtime flags the image cannot require.

So least privilege is a property of the image **and** its deployment:

| Layer | What it can do |
|---|---|
| **The image** | Make non-root and read-only *work* — correct ownership, no writes to the root filesystem, no port below 1024 |
| **The runtime** | Enforce it — `--user`, `--read-only`, `--cap-drop=ALL` |
| **The platform** | Require it — an admission policy, a Compose or Quadlet template everyone inherits |

An image built for this posture makes the runtime flags free to add. An image
that was not will fail with a permission error the first time somebody tries, and
the usual outcome is that the flags get removed instead of the image being fixed.

## Podman and rootless

Podman runs rootless as the normal mode, which changes the shape of the problem
rather than removing it. The container process is mapped through a user namespace
to an unprivileged host uid, so "root inside the container" is not root on the
host even before you set `USER`.

Two consequences worth carrying forward:

- **File ownership on bind mounts is UID-mapped**, so a file created inside the
  container appears with a different owner outside. This is the source of most
  "permission denied on a volume" confusion under Podman, and
  [Phase 11 · 02 · Rootless by default](../phase-11-podman-in-depth/02-rootless-by-default/README.md)
  collects the detail.
- **Privileged ports still need a capability or a sysctl change**, so the
  "listen high, publish low" advice above matters more, not less.

`podman run` accepts `--user`, `--read-only`, `--tmpfs` and `--cap-drop` with the
same meanings, so the runtime half of the table is portable.

## Gotchas

**Symptom:** The container exits immediately with `EACCES` after adding `USER`.
**Cause:** Files copied before the `USER` switch are owned by uid 0, and the
application cannot write them.
**Fix:** `COPY --chown=<user>:<group>`, and keep application writes out of the
image directories entirely.

**Symptom:** `--read-only` makes a previously working image fail.
**Cause:** Something writes inside the container — a temp file, a log, a pid
file, a cache.
**Fix:** `--tmpfs /tmp`, a volume for data, and logs to stdout. Find the writes
before assuming there are none.

**Symptom:** The service cannot bind to port 80 as a non-root user.
**Cause:** Ports below 1024 require `NET_BIND_SERVICE`.
**Fix:** Listen on 8080 and publish `-p 80:8080`. Adding the capability is the
second-best answer.

**Symptom:** An orchestrator rejects the image for "running as root" although the
Dockerfile has a `USER`.
**Cause:** A username the policy cannot resolve to a numeric uid, or a later
stage that reset it.
**Fix:** `USER 1000` numerically, in the final stage.

## Interview questions

**★ What are the three parts of least privilege for a container image?**
Run as a non-root user; do not require a writable root filesystem; and require no
Linux capabilities. The image makes each *possible*; the runtime flags
(`--user`, `--read-only`, `--cap-drop=ALL`) enforce them.

**★ Why is a `USER` instruction not enough on its own?**
Because it is only a default — `docker run --user 0` overrides it. The image
cannot require anything; enforcement lives in the runtime invocation or in a
platform policy that everyone inherits.

**★ What breaks when you add `--read-only`, and how do you fix it properly?**
Anything that writes inside the container: temp files, logs, pid files, caches.
The right fixes are `--tmpfs /tmp` for scratch, a volume for real data, and
logging to stdout so the engine handles it — not removing the flag.

**Why prefer `USER 1000` to `USER appuser`?**
A numeric uid does not depend on an `/etc/passwd` entry, which minimal bases such
as distroless and `scratch` may not have, and policies that check "not root" read
the numeric value and cannot resolve a name.

**How do capabilities relate to running as root in a container?**
Docker already drops all but an allowlist, so container-root is far from host-root
— but the recommendation is to remove everything not explicitly required.
`--cap-drop=ALL` should be the starting point, with `NET_BIND_SERVICE` the one
common addition, better avoided by listening above 1024.

---

← Prev: [The classic mistakes](02-classic-mistakes.md) · Index: [Phase 5](README.md) · Next → [Measuring](04-measuring.md)
