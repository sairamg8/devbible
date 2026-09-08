---
title: "A shared design-system package consumed as source needs excluding from optimizeDeps or its edits stop triggering HMR, and the real test for separate apps versus one multi-page build is whether the pieces deploy on the same schedule"
sidebar_label: "04b · Shared packages & deploy decision"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Dependency Optimization Options](https://vite.dev/config/), [Shared Options](https://vite.dev/config/shared-options.md), [Build Options — Multi-Page App](https://vite.dev/guide/build.md). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

# ⚡ Shared Packages and the Build/Deploy Decision

**[04](04-one-repo-many-vite-apps.md) sets up the workspace; this chunk is where the shared
design-system package actually gets consumed, where that consumption breaks, and the test for
when a workspace of separate apps is the wrong shape entirely.** Two failure modes dominate —
a stale pre-bundled copy of a package meant to hot-reload, and duplicate framework instances
from a resolution mismatch — plus the one question worth asking before splitting anything into
separate apps in the first place.

## Source vs. built, and `optimizeDeps`

`packages/design-system` can be consumed two ways, and mixing them by accident is where this
shape breaks.

**Consuming built output** — `design-system`'s `package.json` has a `main`/`exports` field
pointing at a compiled `dist/`, and every app imports it like any other npm dependency. Vite's
dependency pre-bundler (`optimizeDeps`) treats it exactly like `react` or `lodash`: a stable,
already-compiled dependency graph it pre-bundles once and caches.

**Consuming source directly** — the app imports `design-system`'s `src/` TypeScript files via
the workspace symlink, with no build step for the package. This is faster in dev (no watch
step for the shared package) but changes what `optimizeDeps` needs to do with it: pre-bundling
a package whose exports change on every keystroke defeats the point of pre-bundling, and
excluding it from optimisation is what keeps HMR working across the workspace boundary:

```ts
// apps/orders-ui/vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: ['@design-system'],
  },
})
```

The symptom of getting this backwards — leaving a source-consumed workspace package inside
`optimizeDeps`'s default pre-bundling — is that edits inside `packages/design-system/src`
stop triggering HMR in the consuming app: Vite served the pre-bundled, now-stale copy from its
dep cache instead of re-resolving the live source file, and a full page reload (or a cache
clear) is needed to see the change.

## `resolve.preserveSymlinks` and the linked workspace package

Package managers link workspace packages into `node_modules` as **symlinks** by default
(npm/yarn/pnpm workspaces). Vite's resolver has to decide whether to resolve a symlinked
import against the symlink's location or against its real, linked-to location — that is what
`resolve.preserveSymlinks` controls, and its default is `false`: Vite resolves through the
symlink to the package's real path. That matters for a monorepo specifically because it means
Vite treats `design-system`'s source files as living under `packages/design-system/src`, not
under `apps/orders-ui/node_modules/@design-system` — so its own `resolve.alias`, its own
`tsconfig.json`, and its own dependency graph resolve relative to the *real* location, which is
almost always the behaviour a monorepo wants. Flipping it to `true` makes Vite resolve relative
to the symlink's apparent location instead, which is a deliberate, uncommon choice for
container setups where the real path is not meaningful inside the build environment.

## Duplicated React across two `node_modules` trees

Two apps each install `react`, a package-manager quirk (a hoisting boundary, a version
mismatch between an app and the shared design-system package) leaves two separate copies in
two separate `node_modules` trees, and an app that ends up bundling both gets two React
instances at runtime — broken Context, broken hooks, the classic symptom being a provider and
its consumer disagreeing about which React they're each talking to. `resolve.dedupe` is the
documented fix: it forces the listed packages to resolve to a single copy.

```ts
// apps/orders-ui/vite.config.ts
export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})
```

## Build parallelism and independent deploy units

Each app builds independently — `vite build` inside `apps/orders-ui` knows nothing about
`apps/payments-ui` — which is what makes this shape scale in CI: a monorepo task runner
(Turborepo, Nx, or a plain shell loop) fans the builds out in parallel, and a change to
`orders-ui` alone triggers only its own build and its own deploy, not a rebuild of every app in
the workspace. Each app gets its own `base` matching its own CDN prefix
(`/orders-ui/`, `/payments-ui/`), so all five can be served from the same static host under
different paths, or from five entirely separate hosts, without coordination between them.

## When one multi-page app beats five separate apps

A single Vite app with several HTML entry points is the better answer when the pieces are
never deployed independently of each other — the documented shape for multiple entries:

```js
// vite.config.js — one app, several HTML entries, one build, one deploy.
export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        nested: resolve(import.meta.dirname, 'nested/index.html'),
      },
    },
  },
})
```

The test is deploy schedule, not team boundary or bundle size: **do the pieces deploy on the
same schedule?** If `orders-ui` and `payments-ui` are always released together, from the same
CI run, to the same environment, at the same time, splitting them into separate apps buys
nothing but coordination overhead — a single multi-page build, sharing one `vite.config.ts`
and one `node_modules` resolution, is simpler and has no cross-app version-skew surface at all.
If they are released on genuinely different schedules — payments ships a hotfix Tuesday while
orders is mid-feature-freeze — separate apps are what makes that possible, because a
multi-page build has no concept of shipping one entry without rebuilding and redeploying the
whole thing.

## Gotchas

**★ Symptom: editing a file in `packages/design-system/src` does not trigger HMR in any
consuming app, and only a hard reload picks it up.** Cause: the design-system package is
consumed as source but was left inside `optimizeDeps`'s default pre-bundling scope — Vite
served the cached pre-bundled copy instead of re-resolving the live file. Fix: add the package
to `optimizeDeps.exclude` in every app that consumes it as source, as shown above.

**★ Symptom: two components rendered by the same page silently disagree about React Context
— a value set by a `Provider` in one is `undefined` in a consumer that should see it.** Cause:
`orders-ui` and `packages/design-system` resolved to two separate copies of `react` in two
separate `node_modules` trees (a hoisting mismatch or a version drift between them), so the
bundle contains two React instances with two separate module-level Context registries. Fix:
`resolve.dedupe: ['react', 'react-dom']` in the app's `vite.config.ts`, and align the version
ranges so the package manager stops installing two copies in the first place.

**Symptom: `orders-ui` builds and deploys fine alone, but a CI pipeline that runs all five
apps' builds sequentially takes five times as long as building just one.** Cause: the task
runner treats the workspace as one build instead of fanning independent app builds out in
parallel. Fix: use a monorepo task runner (Turborepo, Nx, or a parallel shell loop) that
detects each `apps/*` directory as an independent build target and runs them concurrently.

**Symptom: `resolve.preserveSymlinks: true` was set "to be safe" and workspace package
resolution started behaving unpredictably — `tsconfig.json` paths inside the design-system
package no longer resolve the way they do for every other consumer.** Cause: flipping
`preserveSymlinks` to `true` makes Vite resolve relative to the symlink's apparent location in
`node_modules` instead of the package's real path under `packages/`, which is the opposite of
what a workspace-linked package usually wants. Fix: leave it at its default `false` unless a
specific containerised build environment requires the opposite.

**Symptom: two apps ship visually inconsistent components because one is using an older
cached build of the design-system package.** Cause: the design-system package is consumed as
**built** output (`dist/`), and one app's `node_modules` install is stale relative to a newer
published version while the other app was reinstalled more recently. Fix: pin the
design-system package to a workspace protocol version (`workspace:*`) rather than a fixed
semver range, so every app in the monorepo always resolves the same, current copy.

**Symptom: a team splits a two-screen flow into two separate Vite apps for "micro-frontend"
reasons, and every release now requires manually coordinating two deploys to keep the flow
working.** Cause: the split apps deploy on the same schedule in practice, so the split bought
organisational overhead (two builds, two CI pipelines, two version histories to keep in sync)
without buying any of the independent-deploy benefit that justifies the shape. Fix: fold them
back into one multi-page app with shared `rolldownOptions.input` entries — the "do the pieces
deploy on the same schedule" test would have caught this before the split.

## Interview questions

**Why does consuming the design-system package as source instead of built output change how
`optimizeDeps` must be configured?**
`optimizeDeps` pre-bundles dependencies on the assumption they are stable, already-compiled
code — worth caching because it doesn't change during a dev session. A source-consumed
workspace package changes on every edit, so pre-bundling it is actively wrong: the cached copy
goes stale the moment a file changes, and HMR for that package breaks. Excluding it from
`optimizeDeps` tells Vite to treat it like the app's own source instead of a dependency to cache.

**★ Why does `resolve.dedupe` fix a broken React Context, and why doesn't `resolve.alias`
solve the same problem?**
Duplicate React copies happen because two different resolution paths through `node_modules`
each find their own installed `react`, producing two separate module instances with two
separate internal registries (Context, hooks' internal state). `resolve.dedupe` forces every
resolution of the listed package names to converge on one copy regardless of which
`node_modules` tree found it first. `resolve.alias` only rewrites specifiers to *other*
targets — it doesn't force multiple existing resolutions of the same specifier to collapse to
one, so it isn't the tool for a duplication problem caused by installation topology.

**What does `resolve.preserveSymlinks: false` (the default) actually do for a workspace-linked
package, in plain terms?**
It tells Vite to resolve a symlinked import — like a workspace package linked into
`node_modules` — against the file the symlink *points to*, not against the symlink's own
location. For a monorepo, that means Vite treats `@design-system`'s files as living at their
real path under `packages/design-system/src`, so its own relative imports, its own
`tsconfig.json`, and its own dependency resolution all work as if you'd imported it directly
from that real directory — which is almost always the behaviour a workspace expects.

**★ What is the actual test for choosing separate Vite apps over one multi-page app with
several `rolldownOptions.input` entries?**
Whether the pieces deploy on the same schedule. If two screens always ship together, from the
same CI run, at the same time, a single multi-page build is simpler — one `vite.config.ts`,
one dependency resolution, one deploy, no risk of two independently-versioned pieces drifting
out of sync with each other. Separate apps only pay for themselves when the pieces genuinely
need to release independently — a hotfix to one without touching or redeploying the other.

---

{/* FOOTER */}
