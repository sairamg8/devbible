---
title: "A React/Vite frontend"
sidebar_label: "12 · A React/Vite frontend"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Vite — env variables and modes](https://vite.dev/guide/env-and-mode),
> [the Vite server options](https://vite.dev/config/server-options),
> [the official `nginx` image documentation](https://hub.docker.com/_/nginx),
> [the Compose `build` section](https://docs.docker.com/reference/compose-file/build/) and
> [multi-stage builds](https://docs.docker.com/build/building/multi-stage/).
> **No sandbox** — no console output on this page.

**The frontend is two completely different containers wearing one name.** In
development it is a Node process watching files; in production it is a directory of
static assets and a web server that has never heard of React. Almost every
frontend-in-Docker problem is treating one as if it were the other.

## The two shapes

| | Development | Production |
|---|---|---|
| What runs | the **Vite dev server**, a Node process | **nginx**, serving files |
| Where the code is | bind-mounted from your working tree | copied into the image at build time |
| Node in the image | yes | ⛔ **no** |
| Changing the API URL | edit and reload | ⛔ **rebuild** |

🔴 **That last row is the whole topic.** Everything else follows from it.

## One Dockerfile, both shapes

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM deps AS dev
CMD ["npm", "run", "dev"]

FROM deps AS build
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.29-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
```

Two targets from one file, which is
[topic 02](02-dev-vs-prod-image.md)'s argument applied to the frontend: two
Dockerfiles drift, and the drift shows up in production.

- **`runtime` contains no Node, no `node_modules` and no source** — just `dist/` and
  nginx. The image documentation gives `/usr/share/nginx/html` as the directory the
  default configuration serves.
- **`ARG` promoted to `ENV` before `RUN npm run build`** puts the value into the
  environment the build runs in. ⚠️ Whether your Vite version reads plain
  environment variables in addition to `.env` files is worth checking against its
  own docs; what this page relies on is only the part that is documented — that the
  value is fixed **when the build runs**, not when a container starts.

## The build-time env problem

Vite's own documentation is unambiguous. `import.meta.env` constants are
*"statically replaced at build time"* — which is what makes dead-branch
tree-shaking work, and what makes runtime configuration impossible. Only variables
carrying the prefix are exposed: `VITE_SOME_KEY=123` reaches the client,
`DB_PASSWORD=foobar` does not.

🔴 **And the warning that follows from it, quoted:** *"`VITE_*` variables should not
contain sensitive information such as API keys."* They are not configuration
delivered to a running process — **they are text in a JavaScript file the browser
downloads**. There is no such thing as a private one.

The `.env` loading order is documented as:

```
.env                # all cases
.env.local          # all cases, git-ignored
.env.[mode]         # that mode only
.env.[mode].local   # that mode only, git-ignored
```

with mode-specific files overriding the generic ones and the `*.local` variants
belonging in `.gitignore`.

⚠️ **None of that is Compose's `.env`.** They are unrelated mechanisms with the same
filename — Vite's feeds the *bundle*, Compose's feeds `${...}` interpolation *in the
compose file* ([Phase 8 · Environment and
interpolation](../phase-8-compose/10-environment-and-interpolation.md)). Having both
in one repository is normal and is a reliable source of confusion.

## Why `/api` is the right answer

```yaml
    build:
      args:
        VITE_API_URL: /api
```

A relative path is the only value that is correct in every environment, because the
browser resolves it against whatever origin served the page. Set it once and:

- **No per-environment build.** The same image is byte-identical on a laptop, in CI
  and in production — which is what makes "the image you tested is the image you
  deployed" true.
- **No CORS.** One origin means there is no cross-origin request to configure, no
  preflight, and no `Access-Control-Allow-*` to get wrong.
- **No secrets to leak**, because there is nothing environment-specific in the
  bundle at all.

The cost is that something has to put the API on that origin, which is the reverse
proxy in [topic 07](07-the-whole-stack/06-the-proxy.md) and
[topic 13](13-nginx-in-front.md). That is one small nginx configuration against a
rebuild per environment, forever.

**If per-environment values are genuinely unavoidable** — a third-party analytics
key that differs by environment, say — the pattern is a small JSON file fetched
before the app starts:

```js
const config = await fetch('/config.json').then((r) => r.json())
```

serving a different `config.json` per environment from a mount. It works, and it
costs a round trip before first render plus a second source of truth. Reach for it
when a relative path genuinely cannot express the value, not by default.

## The development container

```yaml
  web:
    build:
      context: ./web
      target: dev
    command: ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--strictPort"]
    volumes:
      - ./web:/app
      - /app/node_modules
    networks: [edge]
```

Three container-specific settings, all established in
[topic 05](05-hot-reload/02-making-it-noticed.md):

- 🔴 **`server.host` defaults to `'localhost'`**, and the docs say to *"set this to
  `0.0.0.0` or `true` to listen on all addresses"*. Inside a container `localhost`
  is that container, so a published port reaches nothing — the identical trap as the
  Node inspector in [topic 11](11-debugging-node.md).
- **`strictPort` is `false` by default**, and *"if the port is already being used,
  Vite will automatically try the next available port so this may not be the actual
  port the server ends up listening on"* — which silently breaks a fixed Compose
  mapping. Set it to `true` so a conflict is an error rather than a mystery.
- **The anonymous volume at `/app/node_modules`** shields the image's dependencies
  from the bind mount. ⚠️ It is **sticky**: adding a dependency and rebuilding does
  nothing until `up -d --build -V` or `down -v`, which is the "I installed it and it
  is not there" report.

⚠️ **File watching may need help.** `server.watch` passes options through to
chokidar; the documented case is WSL2 with Windows-side files, where watching
*"fails when Windows applications edit files"* and the fallback `{ usePolling: true }`
*"significantly increases CPU usage"* — with the note that *"network filesystem
limitations also apply similarly"*. Polling is a fix, not a default.

## Gotchas

**Symptom:** The dev server starts, the port is published, and the browser gets
nothing.
**Cause:** Vite bound `localhost`, which inside the container is the container.
**Fix:** `--host 0.0.0.0` (or `server.host` in the config), and add `--strictPort`
so a port fallback cannot silently move the target.

**Symptom:** The production bundle calls `http://localhost:3000`.
**Cause:** `VITE_API_URL` was supplied as a runtime `environment:` value. Vite
replaced `import.meta.env.VITE_API_URL` at build time with whatever was set *then*,
and the runtime value was never consulted.
**Fix:** Pass it as a build `arg`, and prefer `/api` so there is nothing to
configure per environment.

**Symptom:** An API key intended for the backend appears in the browser bundle.
**Cause:** It was given a `VITE_` prefix — the documented rule is that prefixed
variables are exposed to client code, and the docs warn outright that they *"should
not contain sensitive information such as API keys."*
**Fix:** Remove the prefix and keep it server-side. And rotate it, because it was
published in an artefact — the same rule as a build `ARG`
([topic 06](06-secrets-dev-vs-prod.md)).

**Symptom:** A newly installed dependency is missing inside the container even
after a rebuild.
**Cause:** The anonymous volume at `/app/node_modules` was populated from the old
image and is reused by the recreated container.
**Fix:** `docker compose up -d --build -V`, or `down -v`. `--force-recreate` alone
does not renew anonymous volumes.

## Interview questions

**★ Why is the frontend's API URL a build-time problem, and what do you do about
it?**
Because Vite replaces `import.meta.env.VITE_*` statically at build time — the values
end up inside the JavaScript the browser downloads, so no runtime environment
variable can change them. The clean answer is to make the value environment-agnostic:
use the relative path `/api` and put a reverse proxy in front so the API is on the
same origin. One image is then correct everywhere and CORS never enters the project.
If a value genuinely must differ per environment, fetch a small `config.json` at
startup and accept the extra round trip and the second source of truth.

**★ How does one Dockerfile produce both a dev server and a production frontend?**
With build stages. A shared `deps` stage installs dependencies; a `dev` target stops
there and runs the Vite dev server against bind-mounted source; a `build` target
copies the source and runs `npm run build`; and a `runtime` target starts from
`nginx` and copies only `dist/` out of the build stage. The production image
therefore contains no Node, no `node_modules` and no source — and both targets come
from one file, so they cannot drift the way two Dockerfiles do.

**★ Someone put a secret in a `VITE_` variable. What now?**
Rotate it, then remove the prefix. Vite documents that prefixed variables are
exposed to client code and warns explicitly that they *"should not contain sensitive
information such as API keys"* — the value is not configuration passed to a process,
it is text in a downloadable file. Rebuilding does not unpublish a bundle any more
than it unpublishes an image layer, which is the same lesson as a credential passed
as a build `ARG`.

**Why does the Vite dev server need `--host 0.0.0.0` in a container?**
Because `server.host` defaults to `localhost`, and inside a container that is the
container's own loopback — the published port maps to an address nothing is
listening on from outside the namespace. Binding all addresses is safe here because
the namespace is the boundary, and what actually controls exposure is which host
interface the port is published to. It is the same shape as the Node inspector, and
the same shape as a database that only listens on its own loopback.

**What is `--strictPort` for?**
Vite's default is to try the next available port when the configured one is taken,
and the docs note this *"may not be the actual port the server ends up listening
on"*. That is fine on a laptop and wrong in a container, where a Compose mapping
names a fixed port: the server quietly moves and the mapping now points at nothing.
`strictPort: true` converts a silent relocation into a startup error.

**Why is there an anonymous volume on `node_modules`?**
Because the bind mount of the working tree over `/app` hides the `node_modules` the
image built, and a second mount at `/app/node_modules` layers over that one path and
is populated from the image because it starts empty. The trap is that it is sticky —
it persists across recreations, so a new dependency will not appear until the
anonymous volumes are renewed with `-V` or removed with `down -v`.

---

← Prev: [Debugging Node inside a container](11-debugging-node.md) · Index: [Phase 9](README.md) · Next → **Nginx in front of the API** *(not written yet)*
