---
title: "Vite Builds One Static Artefact and Hands It to a CDN — 'Microservices' Is a Property of What That Artefact Talks To, and It Reaches the Build in Exactly Three Shapes"
sidebar_label: "01 · What microservices mean to a build"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against [Vite — Server Options](https://vite.dev/config/server-options.md),
> [Vite — Backend Integration](https://vite.dev/guide/backend-integration.md), [Vite — Environment
> API](https://vite.dev/guide/api-environment.md), [Vite — Build Options](https://vite.dev/guide/build.md),
> and [Module Federation — Vite integration](https://module-federation.io/integrations/build-tool/vite.html).
> Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ /
> 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**A `vite build` produces `dist/` — HTML, JS chunks, CSS, a manifest — and that output has no
idea how many services sit behind it or how many teams deployed it. "Microservices
architecture" is not a Vite feature; it is a property of the systems a build's output talks
to and the org chart that shipped the pieces. It reaches a Vite config in exactly three
shapes, each touching a different, narrow config surface, and the rest of what "microservices"
usually means — service boundaries, the gateway, the mesh, the deploy topology — never enters
`vite.config.ts` at all.** This page draws the line between the two so the rest of the topic
knows which side of it each chunk lives on.

## The three shapes, and where each one touches Vite

### 1. Many backend services, one frontend

The common case: a React or Vue SPA calls `/api/users`, `/api/orders`, `/api/payments` — each
routed by a gateway or an API composition layer to a different backend service, but the
browser sees one origin. Vite's stake here is entirely in **development**: the dev server
needs to forward `/api/*` somewhere real, and that "somewhere" is `server.proxy`.

```ts
// vite.config.ts
export default {
  server: {
    proxy: {
      '/api/users': 'http://localhost:4001',
      '/api/orders': 'http://localhost:4002',
    },
  },
}
```

In production this proxy does not exist — Vite ships static files, and the routing job moves
to whatever serves them (nginx, a gateway, a CDN edge function). The dev-only nature of
`server.proxy` is the single most consequential fact in this shape, and it gets its own chunk:
[The dev proxy across services](02-the-dev-proxy-against-many-services.md).

### 2. One frontend split into independently deployed pieces

Micro-frontends: a shell application composes fragments that are built, versioned and
deployed independently — sometimes by different teams, sometimes on different release
schedules. This is the shape that actually touches the most Vite surface area:

- **`base`** and **`server.origin`** — a fragment served from its own origin must emit
  absolute URLs for its own chunks, or a shell loading it resolves those chunks against the
  *shell's* origin and 404s. Per the docs:
  > *"If you are deploying your project under a nested public path, simply specify the `base`
  > config option and all asset paths will be rewritten accordingly."*
- **`environments`** (the Environment API, introduced in Vite 6) — lets one config define
  multiple named build/dev targets (`server`, `edge`, a federation remote) instead of one
  implicit client/SSR pair. Per the docs:
  > *"Until Vite 5, there were two implicit Environments (`client`, and optionally `ssr`).
  > The new Environment API allows users and framework authors to create as many
  > environments as needed to map the way their apps work in production."*
- **`build.rolldownOptions.input`** — a multi-page app's explicit entry map, one way to
  produce several independently loadable HTML/JS bundles from one config.
- **A federation plugin** (`@module-federation/vite`) — the mechanism for one bundle to
  expose modules another, separately built and deployed bundle imports at runtime.

Each of these gets its own chunk later in this topic — named below.

### 3. Many independent frontends in one repo

A monorepo housing several apps (admin dashboard, marketing site, customer portal) that share
a design system, lint config and CI pipeline but ship as separate artefacts with separate
`vite.config.ts` files. Vite's stake is **config sharing** — a base config extended per app,
shared `resolve.alias` entries, a shared `optimizeDeps.include` list — not anything unique to
"microservices"; it is workspace tooling (Turborepo, Nx, pnpm workspaces) plus ordinary Vite
config composition.

## What Vite has an opinion on, and what it does not

A build tool cannot have an opinion on where a service boundary belongs — that is a systems
design question, covered in `docs/system-design/` (see the request-path and method phases
there) and, for the backend services themselves, `docs/nodejs/`. What Vite *does* have an
opinion on is narrower and mechanical:

- **URLs** — `base`, `server.origin`, `renderBuiltUrl`: where does a chunk think it lives,
  and where does the browser actually fetch it from.
- **Origins** — `server.proxy`, `server.cors`: does the browser see one origin or several,
  and in dev, does Vite forward cross-origin calls so the browser never has to know.
- **Shared dependencies** — federation's `shared` config, `resolve.dedupe`, `optimizeDeps`:
  when do two independently built bundles agree to load one copy of React instead of two.
- **When a value is frozen** — build-time `define`/env replacement versus a value read at
  runtime; this determines whether a config value survives being deployed to a different
  environment than it was built for. Covered in depth at
  [Environment system](../07-env-variables-and-modes/01-environment-system.md).

Everything else — how many services exist, which team owns which one, how they discover each
other, how a request is authenticated across a mesh, how a deploy is rolled out — is decided
before a `vite.config.ts` file is ever opened, and stays decided regardless of what that file
says.

## What does NOT change

This is worth stating plainly because it is where over-thinking a "microservices" topic starts:
**routing, code splitting, HMR and the `import.meta.env` mechanics work identically whether
the backend is one monolith or forty independently deployed services.** A `<Route>` component
does not know how many services answer its fetch calls. `import('./Heavy.js')` splits into its
own chunk the same way regardless of what backend serves the data it renders. Vite's dev
server HMR graph — see [Native ESM and HMR](../04-dev-server-mechanics/01-native-esm-and-hmr.md)
— tracks module boundaries in the frontend's own module graph, not service boundaries on the
backend. And `import.meta.env.VITE_*` variables are baked at build time the same way whether
they hold one API base URL or configuration describing which of forty gateways to call — see
[Build-time vs runtime config](../07-env-variables-and-modes/01a-build-time-vs-runtime-config.md).
A team redesigning its backend into services and expecting the frontend build to need a
parallel redesign is solving a problem Vite does not have.

## What this topic covers, chunk by chunk

This page is the map. The chunks below fill it in, grouped by the three shapes above.

**Shape 1 — many backend services, one frontend**

- [01a · The BFF and browser fan-out](01a-the-bff-and-the-browser-fan-out.md) — what N origins
  cost the browser, and why no bundler option fixes it.
- [02 · The dev proxy across services](02-the-dev-proxy-against-many-services.md) —
  `server.proxy` mechanics, `changeOrigin`, `rewrite`, RegExp keys, and why none of it ships.
- [02a · CORS, cookies and websockets](02a-cors-cookies-and-websockets-through-the-proxy.md) —
  what happens to preflights and auth tokens once there is no proxy to hide behind.
- [02a2 · Websocket origin checks and the preview recipe](02a2-websocket-origin-checks-and-the-preview-verification-recipe.md)
  — 🔴 Vite does not check websocket origins before proxying, and how to prove a build before it ships.
- [02b · Websockets, `configure` and the dev-only scope](02b-websockets-configure-and-the-proxys-dev-only-scope.md)
  — the escape hatch, and the production replacement the proxy is standing in for.
- [03 · Service URLs are baked in](03-service-urls-are-baked-in-at-build-time.md) — 🔴
  `import.meta.env` is replaced at build time, so one artefact cannot be promoted across
  environments.
- [03b · Runtime configuration](03b-runtime-configuration-and-the-fix.md) — the fix, in code,
  and the rule for what to bake and what to inject.

**Shape 2 — one frontend split into independently deployed pieces**

- [05 · Module Federation on Vite](05-module-federation-on-vite.md) —
  `@module-federation/vite`, the `build.target` requirement, and the two documented
  limitations. The stale-plugin trap is cross-referenced, not re-argued, from
  [Migrating Module Federation off webpack](../16-migration-recipes/01n-module-federation-migration.md).
- [05a · Shared deps and singletons](05a-shared-dependencies-and-singleton-breakage.md) — why
  two copies of a framework is a correctness bug, not a size regression.
- [05a2 · Shared dependency versioning](05a2-shared-dependency-versioning-and-the-optimizedeps-gap.md)
  — and what is *not* documented about how `shared` meets Vite's own pre-bundling.
- [05b · Worked example and the version spine](05b-worked-example-and-the-version-spine.md).
- [05c · Version skew and the manifest](05c-version-skew-and-the-remote-manifest.md) — the
  mutable `remoteEntry.js` in the caching hot path.
- [05d · `exposes`, SRI and observability](05d-exposes-sri-and-build-observability.md) — a
  runtime boundary with no compile-time check across repos.
- [06 · Import maps and the alternatives](06-import-maps-and-the-other-answers.md) and
  [06b · Composition alternatives](06b-composition-alternatives-and-the-decision.md) — the
  three lighter answers, two of them browser-native.
- [07 · `base` and asset URLs](07-base-and-asset-urls-across-origins.md) and
  [07b · `server.origin`, manifest and the router basename](07b-server-origin-manifest-and-the-router-basename.md)
  — the absolute-URL requirement for anything served from its own origin.

**Shape 3 — many independent frontends in one repo**

- [04 · One repo, many Vite apps](04-one-repo-many-vite-apps.md) — workspaces, a shared config
  factory, per-app `envDir`.
- [04b · Shared packages and the deploy decision](04b-shared-packages-and-the-deploy-decision.md)
  — and the test for which shape you actually have.
- [08 · The Environment API](08-the-environment-api-and-many-build-targets.md) and
  [08b · Many deployables is not microservices](08b-many-deployables-is-not-microservices.md)
  — `environments`, `consumer`, and its release-candidate stability status.

**The closing argument**

- [09 · When not to split](09-when-not-to-split-the-frontend.md) and
  [09b · The decision framework](09b-the-decision-framework.md) — 🔴 read these before adopting
  anything in shape 2.

For the webpack-side equivalent of the federation material, see
[Architecture patterns and topologies](../../../webpack/pages/11-module-federation/04-architecture-patterns-and-topologies.md).
For where this fits against the larger 2026 bundler landscape, see
[Choosing a bundler](../17-the-2026-toolchain-landscape/01a-choosing-a-bundler.md). For the
scale-architecture reasoning that motivates splitting a frontend at all, see
[Architecting for scale](../../../frontend-architecture/pages/14-performance-and-scalability-patterns/01-architecting-for-scale.md).

## Gotchas

**★ Symptom: a proposal titled "move to microservices" lists no Vite config changes and the
reviewer assumes something was missed.** Cause: nothing was missed — a backend re-architecture
that keeps the same API shape at the same origin touches zero lines of `vite.config.ts`. Fix:
state explicitly in the proposal which of the three shapes (if any) applies to the frontend,
and if none does, say so instead of leaving a silence for someone to second-guess.

**★ Symptom: `server.proxy` rules are copied into an nginx config and "it still doesn't work
in production."** Cause: `server.proxy` is a dev-server-only feature of Vite's Node process;
it has no build output and ships nothing to `dist/`. Fix: the production equivalent is a real
reverse proxy or gateway config, written independently — treat the Vite proxy rules as a
*specification* of the routes needed, not a config file to deploy.

**★ Symptom: a team on a federation-based micro-frontend architecture reports "everything
loads at `http://localhost:2000` in dev but 404s once deployed to a real domain."** Cause:
`base` (and, in dev, `server.origin`) were left at defaults, so built chunk URLs are relative
and resolve against whichever origin *loaded* them — usually the shell's — not the origin
they were actually deployed to. Fix: covered in the not-yet-written `base`/`server.origin`
chunk; the mechanism is that a remote must emit absolute URLs pointing at its own deployed
origin, which `base` set to that origin's full URL provides.

**★ Symptom: someone asks "does Vite support microservices?" as a yes/no question and gets a
yes/no answer either way.** Cause: the question conflates a build tool with an architecture.
Fix: answer with the three shapes — Vite has config surface for each of them, but "supports
microservices" is not a coherent claim about a frontend bundler in the way it is about, say,
a service mesh.

**★ Symptom: HMR is reported as "broken" after a backend split into services.** Cause:
nothing about HMR reads from the backend topology — the dev-server module graph that drives
HMR is built from the frontend's own `import` statements. If HMR broke, the backend split is
coincidental; look at the actual module graph or a recently changed `server.proxy`/`server.cors`
rule instead.

## Interview questions

**★ What does "microservices architecture" actually change in a `vite.config.ts` file?**
Nothing, in the common case where the frontend still talks to one logical origin (a gateway
or BFF) regardless of how many services sit behind it. Config changes only appear when one of
three specific shapes applies: the frontend needs the dev server to proxy several backend
origins (`server.proxy`), the frontend itself is split into independently deployed pieces that
need to resolve each other's URLs across origins (`base`, `server.origin`, a federation
plugin, the Environment API), or a monorepo houses several independent frontends sharing
config. Everything else that "microservices" usually implies — service boundaries, a gateway,
a mesh, deploy topology — is decided outside the build tool entirely.

**★ A junior engineer says "we can't move to microservices because Vite doesn't support
Module Federation like webpack does." How do you correct that?**
Two things are wrong. First, the premise: `@module-federation/vite` exists, is maintained by
the official Module Federation org, and published as recently as the day before this page was
verified — the confusion usually comes from finding `@originjs/vite-plugin-federation`
instead, which has not shipped in well over a year. Second, the framing: Module Federation is
one specific technique for shape 2 (an independently-deployed-pieces frontend), not a
prerequisite for "microservices" in general — a frontend calling many backend services through
one gateway (shape 1) needs no federation plugin at all.

**★ Why doesn't a build tool have an opinion on where a service boundary should sit?**
Because a service boundary is a statement about team ownership, data consistency and
independent deployability on the *backend*, and a bundler's job is to turn frontend source
into browser-loadable assets. The two concerns meet only at the surface where the frontend
issues a request or loads a remote chunk — which is exactly the surface Vite does have config
for (`server.proxy`, `base`, `server.origin`, federation's `remotes`). Everything upstream of
that surface — how the backend is decomposed, how it discovers itself, how it is deployed — is
invisible to Vite by construction, the same way a text editor has no opinion on your database
schema.

**★ Why is it misleading to say routing or code splitting "changes" under a microservices
architecture?**
Because both are properties of the frontend's own module graph and route table, built from
`import()` calls and router config, not from anything the backend exposes. A `<Route
path="/orders">` component splits into its own chunk based on whether it is dynamically
imported, and it fetches from whatever URL its code names — the router and the bundler never
inspect how many backend services exist behind that URL. Conflating "the backend became
distributed" with "the frontend build must change" is a category error worth naming directly
in review rather than letting a proposal imply changes that would not actually happen.

---

← [The Adjacent Toolchain](../17-the-2026-toolchain-landscape/03-the-adjacent-toolchain.md) · [Vite overview](../../README.md) · Next → [The BFF and browser fan-out](01a-the-bff-and-the-browser-fan-out.md)
