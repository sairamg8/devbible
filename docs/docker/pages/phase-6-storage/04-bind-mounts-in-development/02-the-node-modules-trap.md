---
title: "The node_modules trap"
sidebar_label: "02 · The node_modules trap"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — bind mounts](https://docs.docker.com/engine/storage/bind-mounts/),
> [Docker — volumes](https://docs.docker.com/engine/storage/volumes/) and
> [Node.js — modules: CommonJS modules, `LOAD_NODE_MODULES`](https://nodejs.org/api/modules.html#all-together).
> **No sandbox** — no console output on this page.

**`Cannot find module 'express'`, immediately after adding a bind mount to a
container that worked a second ago.** Nothing was deleted, nothing failed to
install, and rebuilding will not help. This page is that one error and the four
ways out of it.

## What actually happened

The Dockerfile installed dependencies into the image:

```dockerfile
WORKDIR /app
COPY package*.json ./
RUN npm ci                 # creates /app/node_modules inside the image
COPY . .
CMD ["node", "src/server.js"]
```

Then the run mounted the project over the same path:

```bash
docker run -v "$(pwd)":/app myapp:dev
```

A bind mount **obscures** the container's existing content at that path — the
rule from [topic 02](../02-volumes-bind-mounts-tmpfs/02-bind-mounts-and-tmpfs.md):

> *"the directory's existing contents are obscured by the bind mount"*

So `/app` is now your host project. Your host project has no `node_modules` (or
worse, has one built for macOS). The image's `/app/node_modules` still exists,
untouched, in the read-only layers — it is simply not reachable while the mount
is there.

**This is not a Docker quirk.** Mounting over a non-empty directory hides it on
any Unix. The surprise comes from the contrast with volumes, which *copy* the
content in instead. One mount type merges, the other covers. That is the entire
bug.

## Fix 1 — shadow the path with a volume

Mount something *deeper* than the bind mount, at the exact path you need back:

```bash
docker run \
  --mount type=bind,src="$(pwd)",dst=/app \
  --mount type=volume,dst=/app/node_modules \
  myapp:dev
```

```yaml
services:
  api:
    volumes:
      - .:/app
      - /app/node_modules        # the classic short-syntax form: an anonymous volume
```

A more specific mount point wins, so `/app` is your host tree and
`/app/node_modules` is a volume. And because it is a **volume** rather than a
bind mount, the pre-population rule applies: on first use it is empty, so the
image's `node_modules` is **copied into it**. The container gets its
dependencies back.

**This is the most common fix, and it has a real failure mode.** The volume is
populated *once*. Add a dependency, rebuild the image, restart — and the volume
is not empty any more, so the new package is never copied in. You get
`Cannot find module` again, for the opposite reason, and this time rebuilding
genuinely does not help.

```bash
docker compose down -v          # removes the volume, so it repopulates
docker compose up --build
```

Use a **named** volume rather than the anonymous form if you plan to live with
this — `- api_node_modules:/app/node_modules` — because then you can remove
exactly that one volume instead of everything the project declares.

## Fix 2 — put the dependencies outside the mounted path

Node resolves `require('express')` by walking **up** the directory tree looking
for a `node_modules` at each level. Install one level above the mount and the
mount cannot cover it:

```dockerfile
WORKDIR /deps
COPY package*.json ./
RUN npm ci                 # dependencies land in /deps/node_modules

WORKDIR /deps/app          # the app runs one level below them
COPY . .
CMD ["node", "src/server.js"]
```

```bash
docker run --mount type=bind,src="$(pwd)",dst=/deps/app myapp:dev
```

`/deps/app` is your source, `/deps/node_modules` is untouched by the mount, and
resolution finds it on the way up. **No shadowing volume, nothing to invalidate,
and a rebuild is enough to pick up a new dependency** — which is exactly what
fix 1 cannot do.

The costs are honest ones: an unusual layout that surprises the next reader, and
tooling that assumes `node_modules` sits beside `package.json` (some bundler
resolution settings, some editor integrations) may need configuring. Say what
you are doing in a comment.

## Fix 3 — mount only what you edit

The trap needs a mount over `/app`. Do not have one:

```bash
docker run --mount type=bind,src="$(pwd)/src",dst=/app/src myapp:dev
```

`/app/node_modules`, `/app/package.json` and everything else stay as the image
built them. This is the simplest correct answer for a service whose source lives
in one directory, and it is why chunk 01 recommends mounting narrowly by
default. The limitation: anything you edit outside `src/` — a config at the
project root, a new top-level directory — is invisible until you rebuild.

## Fix 4 — do not bind-mount at all

Sync the files instead of mounting them. `docker compose watch` copies changed
files into the container and rebuilds when the dependency manifest changes, so
`node_modules` is never covered by anything. That is chunk 03, and for a Node
service it is usually the best answer available today.

## Which to choose

| | Fix 1 · shadow volume | Fix 2 · deps outside | Fix 3 · narrow mount | Fix 4 · `watch` |
|---|---|---|---|---|
| Effort | one line | a Dockerfile change | one line | a Compose block |
| New dependency picked up by | `down -v` + rebuild | **rebuild** | **rebuild** | **automatic** (`rebuild` action) |
| Surprises the next reader | a little | yes | no | no |
| Host `node_modules` needed | no | no | no | no |
| Editor sees `node_modules` | no | no | **yes**, the host copy | no |

⚠️ **"Editor sees `node_modules`" is the argument people actually make**, and it
is a real one — IDE autocomplete and type checking need the packages on the
host. The answer is to install them on the host *as well*, for the editor only,
and never let that copy into the container. Which brings us to the worst version
of this bug.

## The architecture mismatch

If your host `node_modules` is not hidden — because you used fix 3, or because
you removed the shadowing volume — the container will happily load packages your
host installed. Most are pure JavaScript and will work. **Native modules will
not.**

A package with a compiled binding (`bcrypt`, `sharp`, `better-sqlite3`,
`node-gyp`-built anything) ships or builds a `.node` binary for a specific
platform and CPU architecture. Installed on macOS arm64 and loaded inside a
`linux/amd64` container, it fails — and the error is about an invalid ELF header
or a missing symbol, not about Docker.

Optional dependencies make it worse: npm records platform-specific optional
packages in the lockfile for the platform that ran the install, so a
host-installed tree can be *missing* the Linux variant entirely.

**The rule that avoids all of it: dependencies are installed inside the
container, by the build, for the container's platform. The host copy exists for
your editor and never enters the image or the mount.**

## Gotchas

**Symptom:** `Cannot find module 'express'` the moment a bind mount is added.
**Cause:** The mount obscured the image's `/app/node_modules`.
**Fix:** Any of the four above. Shadow it with a volume for the quickest result;
move the dependencies out of the mounted path for the most durable one.

**Symptom:** You installed a new package, rebuilt, and the container still
cannot find it.
**Cause:** A shadowing volume at `/app/node_modules` that is no longer empty, so
pre-population does not re-run.
**Fix:** `docker compose down -v` (or `docker volume rm` the specific one) and
bring it back up. If this keeps happening, that is the argument for fix 2 or 4.

**Symptom:** "invalid ELF header", or a native module failing to load, inside the
container only.
**Cause:** Host-installed native modules built for the host's OS and
architecture, visible to the container through the mount.
**Fix:** Install inside the container. Keep the host copy out with a shadowing
volume, a narrower mount, or `.dockerignore` plus `watch`.

**Symptom:** The container's `npm install` rewrote `package-lock.json` in your
repository and git shows a large diff.
**Cause:** The project root is bind-mounted read-write, and the lockfile
regenerated under a different platform or npm version.
**Fix:** Use `npm ci` in the container, which respects the lockfile rather than
rewriting it, and keep installs out of the running container's normal flow.

## Interview questions

**★ Why does adding a bind mount break `node_modules`?**
Because a bind mount obscures the container's existing content at that path, and
the image installed `node_modules` there. The files are still in the image's
read-only layers, just unreachable. It is ordinary Unix mount behaviour; the
surprise comes from volumes doing the opposite and copying the image's content
into an empty volume.

**★ How does mounting an anonymous volume at `/app/node_modules` fix it, and
when does that fix break?**
A more specific mount point wins, so the volume covers the bind mount at exactly
that path, and because it is a volume the image's `node_modules` is copied into
it while it is empty. It breaks the next time you add a dependency: the volume
is no longer empty, so nothing is copied in, and no amount of rebuilding helps
until you remove the volume.

**★ What is the most durable fix, and what does it cost?**
Installing dependencies one level above the mounted directory — `/deps/node_modules`
with the app at `/deps/app` — so the mount cannot cover them and Node's upward
resolution still finds them. A plain rebuild then picks up new dependencies. The
cost is an unfamiliar layout and some tooling that assumes `node_modules` sits
beside `package.json`.

**Why should you never share the host's `node_modules` with the container?**
Native modules are compiled for a specific OS and CPU architecture, so a tree
installed on macOS arm64 fails inside a `linux/amd64` container with a low-level
loader error. Lockfiles also record platform-specific optional dependencies for
the platform that ran the install, so the tree may be missing the Linux variants
outright.

**Your editor needs `node_modules` for autocomplete. How do you reconcile
that?**
Install on the host for the editor, and make sure that copy never reaches the
container — a shadowing volume, a narrower mount, or file sync with
`node_modules` ignored. The container's dependencies come from its own build,
for its own platform.

---

← Prev: [The development loop](01-the-development-loop.md) · Index: [Bind mounts in development](README.md) · Next → [Compose in development, and `watch`](03-compose-and-watch.md)
