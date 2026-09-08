---
title: "The most common micro-frontend in production is not Module Federation at all — it is five independently deployable Vite apps in one workspace sharing a design-system package, and it works because nothing at runtime is shared"
sidebar_label: "04 · One repo, many Vite apps"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Shared Options](https://vite.dev/config/shared-options.md), [Configuring Vite](https://vite.dev/config/). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

# ⚡ One Repo, Many Vite Apps

**Ask most teams to point at their "micro-frontend architecture" and what they show is not
Module Federation, import maps, or anything that shares code at runtime — it is a monorepo
with several independent Vite apps, each with its own `vite.config.ts`, each built and
deployed on its own schedule, sharing a design-system package only at build time.** That shape
works precisely because it refuses to share anything once the browser is involved: each app
is its own bundle, its own deploy artefact, its own failure domain. This chunk covers the
workspace layout and the shared config; how the shared package is actually consumed, and where
that consumption breaks, is
[04b · Shared packages and the build/deploy decision](04b-shared-packages-and-the-deploy-decision.md).
The actual Module Federation runtime-sharing story is
[16 · Migrating Module Federation off webpack](../16-migration-recipes/01n-module-federation-migration.md).

## Workspace layout

```
repo/
├── package.json              # workspaces field, root tooling only
├── apps/
│   ├── orders-ui/
│   │   ├── vite.config.ts
│   │   ├── .env.production
│   │   └── src/
│   ├── payments-ui/
│   │   ├── vite.config.ts
│   │   ├── .env.production
│   │   └── src/
│   └── shell/
│       ├── vite.config.ts
│       └── src/
└── packages/
    ├── design-system/
    │   ├── package.json
    │   └── src/
    └── vite-config-base/
        └── index.ts
```

Root `package.json`:

```json
{
  "name": "repo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

Each entry under `apps/` is a complete, independently buildable and independently deployable
Vite app. Nothing under `apps/` imports another app's `src/` directly — the only shared code
lives in `packages/`.

## A shared config factory, consumed two ways

`packages/vite-config-base/index.ts` centralises the settings every app agrees on — plugin
list, build target, shared `resolve.alias` — without forcing every app onto identical values
for the settings that legitimately differ per app (`root`, `base`, `server.port`). It is a
real workspace package with its own `package.json` and a name (`@repo/vite-config-base`), not
a file reached with a relative path — a point the first gotcha below explains:

```ts
// packages/vite-config-base/index.ts
import type { UserConfig } from 'vite'
import react from '@vitejs/plugin-react'

export function baseConfig(): UserConfig {
  return {
    plugins: [react()],
    build: {
      target: 'es2022',
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@design-system': '/../../packages/design-system/src',
      },
    },
  }
}
```

Consumed with `mergeConfig`, when an app just needs to layer its own settings on top:

```ts
// apps/orders-ui/vite.config.ts
import { defineConfig, mergeConfig } from 'vite'
import { baseConfig } from '@repo/vite-config-base'

export default mergeConfig(
  baseConfig(),
  defineConfig({
    server: { port: 5001 },
    base: '/orders-ui/',
  }),
)
```

Consumed with the conditional `defineConfig` form, when the per-app settings themselves depend
on `command` or `mode` — for example, a different `base` in dev than in a staged preview:

```ts
// apps/payments-ui/vite.config.ts
import { defineConfig, mergeConfig } from 'vite'
import { baseConfig } from '@repo/vite-config-base'

export default defineConfig(({ command, mode }) => {
  return mergeConfig(
    baseConfig(),
    {
      server: { port: 5002 },
      base: command === 'build' ? '/payments-ui/' : '/',
    },
  )
})
```

The two forms answer different questions: `mergeConfig` combines two already-known config
objects; the conditional function form is for values that cannot be known until `command` or
`mode` is available, which a plain merged object has no way to branch on.

## Per-app `root` and `envDir`

Each app's `root` defaults to the directory its `vite.config.ts` lives in — `apps/orders-ui`,
`apps/payments-ui` — so each app naturally reads its own `.env.production` sitting alongside
its config. `envDir` only needs to be set explicitly when that default is wrong — most often
when several apps should share one `.env` file instead of duplicating the same keys:

> *"The directory from which `.env` files are loaded. Can be an absolute path, or a path
> relative to the project root. `false` will disable the `.env` file loading."* —
> [Shared Options](https://vite.dev/config/shared-options.md)

```ts
// apps/orders-ui/vite.config.ts — opting into a repo-root shared .env
// instead of the per-app default.
export default defineConfig({
  envDir: '../../',
})
```

The trade-off is the one covered from the other direction in
[03 · Service URLs are baked in](03-service-urls-are-baked-in-at-build-time.md): a shared
`.env` at the repo root means one file to keep in sync across every app, but it also means
every app bakes in whatever that one file says for the environment being built — there is no
way for `envDir` alone to give `orders-ui` a different `VITE_ORDERS_API` than `payments-ui`
sees for the same key name in the same file. Per-app `.env` files (the default) are almost
always the better choice in a services monorepo, precisely because each app's env genuinely
differs from its siblings'.

## Gotchas

**Symptom: a new app scaffolded by copy-pasting an existing `vite.config.ts` fails to start in
dev, and the error points at another app's dev server already holding the port.** Cause: the
copy-paste carried over the source app's `server.port`, and two apps in the same workspace
both try to bind it when run concurrently. Fix: assign each app an explicit, unique port in
its own config rather than relying on Vite's automatic fallback to guess correctly across a
whole workspace of apps.

**Symptom: moving `orders-ui` one directory deeper breaks its build with a module-not-found
error pointing at `vite-config-base`.** Cause: the shared config was imported by a relative
path (`../../packages/vite-config-base`) baked into every app's `vite.config.ts`, so the
import breaks the moment an app's location in the tree changes. Fix: give the shared config
package a real name in its own `package.json` and import it by that name
(`@repo/vite-config-base`) through the workspace's own resolution, the way it's imported above
— an app's location stops mattering.

**★ Symptom: a repo-root `.env.production` was supposed to be the single source of truth for
every app's service URLs, and now every app bakes in the same value for a key that should have
differed per app.** Cause: `envDir` pointed every app at one shared file, and a shared file
cannot give two apps two different values for the same key name. Fix: go back to the per-app
default (`envDir` unset) unless every value in the shared file is genuinely meant to be
identical across apps.

**Symptom: `envDir: '../../'` resolves correctly on a developer's machine but points at the
wrong directory once the same config runs inside a CI container.** Cause: `envDir` is
documented as relative to the project **root**, and `root` itself can differ between a local
checkout and a CI job if the CI job invokes `vite build` from a different working directory or
with an explicit `--root` override. Fix: set `root` explicitly in the app's config (or the CLI
invocation) before relying on a relative `envDir`, so both are anchored the same way in every
environment.

## Interview questions

**★ What makes a workspace of several independent Vite apps qualify as a micro-frontend
architecture, given that it doesn't involve Module Federation at all?**
Independent deployability. Each app builds, versions and ships on its own schedule with its
own `vite.config.ts`, its own `base`, and its own CDN prefix — the defining property of a
micro-frontend is organisational and deployment independence, not a specific runtime-sharing
mechanism. Module Federation is one way to let independently deployed pieces share code *at
runtime*; a monorepo of separate Vite apps sharing only build-time packages is a simpler
answer to the same organisational problem, and is what most teams that say "micro-frontends"
actually run.

**Why does a shared `vite-config-base` factory use both `mergeConfig` and the conditional
`defineConfig(({ command, mode }) => …)` form across different apps, instead of picking one?**
Because they solve different problems. `mergeConfig` is for combining two static config
objects — the shared defaults plus an app's fixed overrides. The conditional function form is
for settings that must themselves branch on `command` or `mode` — a `base` that differs
between `vite dev` and `vite build`, for instance — which a plain merged object can't express
because it has no way to know which command produced it.

**Why should the shared config package be imported by its workspace package name rather than a
relative path?**
A relative path (`../../packages/vite-config-base`) encodes each app's location in the tree
into its own config file — move the app, and the import breaks. A named workspace package
(`@repo/vite-config-base`, resolved through the package manager's workspace linking) is
location-independent: every app resolves the same name to the same package regardless of
where in `apps/` it happens to sit.

**Why might a shared repo-root `.env` undermine the independence a services monorepo is
trying to achieve, even though it reduces duplication?**
Because `envDir` only controls *where* `.env` files are read from, not how their values are
scoped — one shared file cannot hand two apps two different values for the same key name.
Since the entire reason each app has its own env is that its service URLs genuinely differ
from its siblings', pointing every app at one shared file removes exactly the per-app
distinction the workspace was built to preserve, defeating the reason to run several apps at
all rather than one.

---

{/* FOOTER */}
