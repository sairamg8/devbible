---
title: "A production SSR deploy ships two build outputs and no Vite process at all, and ssr.noExternal decides which dependencies your container image must physically contain versus which ones Node is trusted to require() at runtime"
sidebar_label: "01j · Deploying an SSR/Node app"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Server-Side Rendering](https://vite.dev/guide/ssr). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

**Deploying an SSR app is not "deploy the build output and start it" the way a static SPA is — the production process is a plain Node process you own, and what Vite's build decided to bundle versus leave external determines what that process needs to find in `node_modules` at boot.** The two-build mechanism, `ssr.noExternal` / `ssr.external`'s dev and build semantics, and the SSR manifest are covered in depth in **10 · SSR support** at [`01f-the-two-builds.md`](../10-ssr-support/01f-the-two-builds.md), [`01d-ssr-externals.md`](../10-ssr-support/01d-ssr-externals.md) and [`01g-the-ssr-manifest-and-preload.md`](../10-ssr-support/01g-the-ssr-manifest-and-preload.md); this chunk assumes that mechanism and covers only the deployment consequence — what actually runs in production, what your container image composition has to satisfy, and how you keep that process alive.

## What actually runs — no Vite in production

> *"To ship an SSR project for production, we need to: 1. Produce a client build as normal; 2. Produce an SSR build, which can be directly loaded via `import()` so that we don't have to go through Vite's `ssrLoadModule`"* — [SSR guide](https://vite.dev/guide/ssr)

```json
{
  "scripts": {
    "build:client": "vite build --outDir dist/client",
    "build:server": "vite build --outDir dist/server --ssr src/entry-server.js"
  }
}
```

> *"Note the `--ssr` flag which indicates this is an SSR build."*

The production server file is not `vite.config.ts` or anything Vite invokes — it is your own thin Node entry point, and the guide is explicit about the one line that changes between dev and prod:

> *"Instead of `await vite.ssrLoadModule('/src/entry-server.js')`, use `import('./dist/server/entry-server.js')` (this file is the result of the SSR build)."*

> *"Move the creation and all usage of the `vite` dev server behind dev-only conditional branches, then add static file serving middlewares to serve files from `dist/client`."*

**What this means for a deployment checklist:** `vite` (the package) does not need to be a runtime dependency of your production process at all — it is only ever invoked as a CLI during the build step. A production container that still has the full Vite dev server import path reachable at runtime, unguarded by an `if (import.meta.env.DEV)` or `process.env.NODE_ENV` branch, is carrying dead code and — more importantly — a code path that assumes a Vite instance which was never started in that container.

```javascript
// server.js — the shape the docs describe, condensed to the branch that matters at deploy time
import express from 'express';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

let vite;
if (!isProduction) {
  // Dev-only. Never reached in the production container; keep the import itself
  // dynamic so a bundler for the production entry doesn't even try to pull it in.
  vite = (await import('vite')).createServer;
}

if (isProduction) {
  app.use(express.static('dist/client', { index: false }));
}

app.use('*', async (req, res) => {
  const template = isProduction
    ? await readTemplate('dist/client/index.html')
    : await vite.transformIndexHtml(req.originalUrl, await readTemplate('index.html'));

  const { render } = isProduction
    ? await import('./dist/server/entry-server.js')
    : await vite.ssrLoadModule('/src/entry-server.js');

  const appHtml = await render(req.originalUrl);
  res.status(200).set({ 'Content-Type': 'text/html' }).end(template.replace('<!--ssr-outlet-->', appHtml));
});

app.listen(process.env.PORT ?? 3000);
```

## `ssr.noExternal` decides what your container image has to physically contain

`10/01d` covers `ssr.external` / `ssr.noExternal`'s meaning during dev and build in full. The deployment-specific consequence is this: **a dependency left externalized is not bundled into `dist/server/`, which means the *running* Node process must be able to `require()`/`import` it from `node_modules` at boot** — and whether that `node_modules` exists at all in your production image depends entirely on how you built it.

```typescript
// vite.config.ts — the build-time decision that becomes a runtime requirement
import { defineConfig } from 'vite';

export default defineConfig({
  ssr: {
    // Left external (the default): Node loads these directly. The container
    // MUST ship node_modules containing them, or the process crashes on require().
    // Bundled via noExternal: folded into dist/server/*.js. The container needs
    // nothing extra for these — they travel inside the SSR build output itself.
    noExternal: ['some-esm-only-ui-library'],
  },
});
```

This is the fork in the road for how you build the production image:

- **A full `node_modules` image** (`FROM node:20-alpine`, `COPY --from=build /app/node_modules ./node_modules`, or a fresh `npm ci --omit=dev` in the final stage) — the safe default. Everything `ssr.external` left alone is simply present, exactly as it would be in any Node deployment.
- **A minimal or distroless image with no `node_modules` at all** — every dependency the SSR entry touches at runtime must be in `dist/server/`, which means it must be in `ssr.noExternal`, or the process fails at startup with a module-resolution error the moment it tries to `require()` something that isn't there. Native addons (anything with a compiled `.node` binary — `sharp`, `bcrypt`, certain database drivers) generally **cannot** be `noExternal`-bundled at all, because Rolldown bundles JavaScript, not compiled binaries — those packages have to be physically present in `node_modules` in the runtime image regardless of what `noExternal` says.

```dockerfile
# Dockerfile — an SSR deploy where node_modules travels into the final image.
# This is the version that tolerates leaving most dependencies external.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build:client && yarn build:server

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production   # externalized deps live here
COPY --from=build /app/dist ./dist
COPY server.js ./
EXPOSE 3000
CMD ["node", "server.js"]
```

Skipping the `runtime` stage's `yarn install --production` step and instead trying to run the SSR output against an image with no `node_modules` at all is the single most common way this class of deploy fails — the build succeeds, `dist/server/entry-server.js` exists, and the process crashes on its first request the moment it hits an externalized `import`.

## Process management — what keeps `node server.js` running

Vite's docs stop at "you have a Node process that renders HTML." Keeping that process alive, restarting it on crash, and running more than one of it is entirely your infrastructure's job, and the common options are:

```ini
; systemd unit — /etc/systemd/system/storefront-ssr.service
[Unit]
Description=Storefront SSR
After=network.target

[Service]
ExecStart=/usr/bin/node /app/server.js
Restart=on-failure
RestartSec=2
Environment=NODE_ENV=production
Environment=PORT=3000
User=node

[Install]
WantedBy=multi-user.target
```

```javascript
// ecosystem.config.cjs — PM2, for a multi-core host running several instances
module.exports = {
  apps: [
    {
      name: 'storefront-ssr',
      script: './server.js',
      instances: 'max',       // one process per CPU core, load-balanced by PM2
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
  ],
};
```

In a container orchestrator (Kubernetes, ECS), the equivalent is the container's own restart policy plus a liveness probe hitting a cheap route — the SSR entry point should not be the thing your health check exercises, because rendering a full page on every probe wastes CPU that should be serving real requests.

## Gotchas

**★ Symptom: the production container starts fine, and the very first request crashes with a module-resolution error naming a package that is clearly listed in `package.json`.** Cause: the package was left `ssr.external` (the default), so it was never bundled into `dist/server/` — Node is expected to `require()` it from `node_modules` at runtime, and the production image's `node_modules` was never installed, or was installed with `--production` after a build step that needed a devDependency-only tool. Fix: either install the full dependency set in the runtime image stage, or move the specific package into `ssr.noExternal` if you intend to ship an image with no `node_modules` at all.

**★ Symptom: a package was added to `ssr.noExternal` specifically to avoid shipping `node_modules`, and the build still fails or the runtime still crashes on it.** Cause: the package ships a native addon — a compiled `.node` binary — and Rolldown bundles JavaScript, not compiled machine code. `noExternal` cannot fold a native binary into `dist/server/`. Fix: native-addon dependencies must be physically present in the runtime image's `node_modules` regardless of `noExternal`; there is no bundling escape hatch for them.

**★ Symptom: a staging deploy behaves correctly and a production deploy of the "same" image crashes on `import('./dist/server/entry-server.js')`.** Cause: the two environments were built from different Dockerfile stages or different `--production` flags, so one has the externalized dependencies present and the other doesn't, even though the application source and the SSR build output are identical. Fix: build the runtime image's dependency installation identically for every environment — this is a `node_modules` composition bug, not an application bug, and it will not reproduce by inspecting the app code.

**★ Symptom: the production process is reachable and renders pages, but a crash silently takes the whole service down until someone manually restarts it.** Cause: nothing is managing the Node process — it was started directly (`node server.js &` in a shell, or as a container's bare `CMD` with no orchestrator restart policy configured) with no supervisor watching it. Fix: a `systemd` unit with `Restart=on-failure`, a PM2 `ecosystem.config.cjs`, or, in a container orchestrator, an actual restart policy plus a liveness probe — Vite's docs do not cover this because it is not a Vite concern at all, but it is the single most common gap in a first SSR deploy.

**★ Symptom: CPU usage spikes and request latency degrades under normal traffic, traced back to the health check endpoint.** Cause: the liveness probe was pointed at the SSR rendering route itself, so every probe interval performs a full server-render on top of real traffic. Fix: expose a cheap, separate health endpoint that does not invoke `render()`, and point the probe at that.

## Interview questions

**★ Why does a production SSR deploy not need Vite installed as a runtime dependency, even though the app is undeniably "using Vite"?**
Because Vite's role ends at `vite build`. The SSR build produces `dist/server/entry-server.js`, a plain JavaScript file that the production server `import()`s directly — no `ssrLoadModule`, no dev server, no Vite instance running alongside the process. The documented production pattern moves every use of `vite.ssrLoadModule` and the dev server behind a conditional so it is only ever reached in development. `vite` the package can legitimately stay a devDependency, and a production image that installs only `dependencies` (skipping `devDependencies`) is correct rather than broken, provided the SSR build itself already happened in an earlier build stage.

**★ You are choosing between a production image with a full `node_modules` and a minimal image with none. What does that decision force you to do with `ssr.noExternal`, and what can it never fix?**
A full `node_modules` image tolerates leaving most dependencies external — Node loads them from disk exactly as any Node deployment would, and `ssr.noExternal` only needs to cover packages that genuinely need Vite's transform pipeline (untranspiled ESM syntax the Node version can't parse, for instance). A minimal image with no `node_modules` forces the opposite: everything the SSR entry touches at runtime must be bundled into `dist/server/`, so it must be in `noExternal`, or the process fails at startup on the first `require()` it can't satisfy. What `noExternal` can never fix, in either image strategy, is a package containing a compiled native addon — Rolldown bundles JavaScript source, not machine code, so a `.node` binary has to be physically present in the runtime image's `node_modules` regardless of how the JavaScript dependency graph is configured.

**★ A teammate says "the SSR build passed, so the deploy will work." Where does that reasoning break, specifically for dependencies?**
It breaks at the boundary between build-time and runtime dependency resolution. `vite build --ssr` only has to succeed at bundling and transforming what it decides to touch — externalized dependencies are, by definition, left completely alone, so a missing or broken externalized package produces no build-time signal at all. The failure only appears the moment the running process actually executes the `import`/`require()` for that package, which happens on the first real request in whatever environment is missing it. A green build tells you the SSR entry point compiled; it tells you nothing about whether the container that will run it actually has the dependencies that entry point assumes exist on disk.

---

← [01i · Source maps in production](01i-sourcemaps-in-production.md) · [Vite overview](../../README.md) · Next → [01k · Manifest & backend integration](01k-manifest-and-backend-integration.md)
