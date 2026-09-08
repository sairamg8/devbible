---
title: "Module Federation is the only Vite mechanism that shares running code across independently deployed builds, and every one of its config keys exists to solve exactly that one problem"
sidebar_label: "05 · Module Federation on Vite"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against [Module Federation — Vite integration](https://module-federation.io/integrations/build-tool/vite.html) and package facts from **registry.npmjs.org**, fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · `@module-federation/vite` 1.21.5**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**Every other pattern in this topic ships static output — a proxied API, an env-scoped
bundle, a shared design-system package — and the browser only ever sees one build at a
time. Module Federation is different: a host page loads JavaScript that a *separately
built, separately deployed* application shipped, and executes it in the host's own
process, sharing the host's own React instance if you tell it to. That is the one
capability nothing else in this topic has, and every config key below and every gotcha on
this page and the next is a direct consequence of it.**

## What a host, a remote and `remoteEntry.js` actually are at runtime

A federation **remote** is an ordinary Vite build with one extra artefact: a small
JavaScript file — by convention `remoteEntry.js` — that is not part of the app's own UI at
all. It is a manifest: a map from the names the remote chose to **expose** (`./CheckoutFlow`)
to the chunk URL that implements them, plus the remote's own `shared`-dependency
declarations. Nothing in that manifest runs on page load.

A federation **host** does two things at runtime that a normal app doesn't. First, it
fetches one or more remotes' `remoteEntry.js` files — a network request to another
origin, resolved lazily, not bundled in at build time. Second, somewhere in the host's own
code, a `React.lazy(() => import('checkout/CheckoutFlow'))` (or the equivalent dynamic
`import()`) resolves against that manifest instead of against the host's own module graph.
The federation runtime intercepts that specifier, looks it up in the fetched manifest,
fetches the actual chunk from the remote's origin, and evaluates it in the host's page.

The consequence worth sitting with: **the host does not know at build time what code the
remote will serve.** The remote can redeploy tomorrow, exposing a different implementation
behind the same `./CheckoutFlow` name, and the host picks it up on the next page load with
no rebuild of its own. That is the entire value proposition of independently deployable
micro-frontends, and it is also where every one of this page's gotchas comes from.

## The config keys — `name`, `filename`, `exposes`, `remotes`, `shared`

`@module-federation/vite`'s `federation()` plugin takes one config object built from these
keys, on either the host, the remote, or both — a single app can be host to one remote and
itself a remote to another host, and in that case carries both `exposes` and `remotes`.

- **`name`** — the identifier other apps use to address this one. It is the segment before
  the `/` in `checkout/CheckoutFlow` and the key other apps' `remotes` map points at.
- **`filename`** — the name of the manifest file this build emits, conventionally
  `remoteEntry.js`. Only meaningful on a remote; a pure host that exposes nothing doesn't
  need it.
- **`exposes`** — a map from a public import path to a local source file, present on
  anything acting as a remote. `'./CheckoutFlow': './src/CheckoutFlow.tsx'` means another
  app can `import('checkout/CheckoutFlow')` and get that file's default export.
- **`remotes`** — a map from a local name to *where* to fetch that remote's manifest,
  present on anything acting as a host: `checkout: 'checkout@http://localhost:3001/remoteEntry.js'`.
- **`shared`** — which dependencies this build should negotiate with the other side rather
  than bundle privately. This is the deepest and most failure-prone key of the five, and it
  gets its own page: [05a](05a-shared-dependencies-and-singleton-breakage.md).

## The bank's `vite.config` example, verbatim, then line by line

This is the integration page's own configuration example, unmodified:

```ts
import { federation } from '@module-federation/vite';
import mfConfig from './module-federation.config';

module.exports = {
  server: {
    origin: 'http://localhost:2000',
    port: 2000,
  },
  base: 'http://localhost:2000',
  plugins: [federation(mfConfig)],
  build: {
    target: 'chrome89',
  },
};
```

- **`server.port: 2000`** — the dev server this remote listens on. Ordinary Vite config,
  nothing federation-specific.
- **`server.origin: 'http://localhost:2000'` and `base: 'http://localhost:2000'`** — both
  set to the remote's own **absolute origin**, not a path. 🔴 This is the line the doc shows
  and does not explain, so say it here: a remote's chunk URLs are written into
  `remoteEntry.js` and into the chunks it references. If those URLs are relative, they
  resolve **against whatever page loaded them** — which, once a host on a different origin
  fetches this remote's `remoteEntry.js`, is the *host's* origin, not the remote's. A
  relative `base` here means the host tries to fetch `checkout`'s chunks from `shell`'s own
  origin and gets a 404. Setting both `server.origin` (which controls the URLs the dev
  server itself emits, per `server-options.md`) and `base` (which controls the URLs baked
  into the build, per `guide/build.md`) to the remote's own absolute origin is what makes
  the manifest portable across origins at all.
- **`plugins: [federation(mfConfig)]`** — the plugin itself, configured from the
  `name`/`filename`/`exposes`/`remotes`/`shared` object described above.
- **`build.target: 'chrome89'`** — see the next section; this is not an arbitrary
  browser-support floor, it is a hard requirement of how the plugin emits federated chunks.

## `build.target: 'chrome89'` is a top-level-await requirement, not a style choice

The federation runtime resolves a remote's shared dependencies *before* the remote's own
module code runs, and it does that with `await` at the top level of a generated module —
there is no synchronous alternative, because resolving a shared dependency means asking the
host what version it already has loaded, which is itself asynchronous. Top-level `await`
landed in browsers starting around Chrome 89, which is why the doc pins `build.target` there
and not lower.

If the deployment target includes browsers below that line, the integration doc names the
fallback directly:

> *"You can use 'vite-plugin-top-level-await' plugin"*

to transform the top-level `await` into something those browsers can execute. Lowering
`build.target` below `chrome89` without that plugin does not make federation degrade
gracefully — it produces a syntax the target browser cannot parse at all.

## The two documented limitations

The integration page states its scope in one line:

> *"Except for the dev option, all options are supported"*

Read literally: everything else in `@module-federation/enhanced`'s webpack-side
configuration surface — `name`, `filename`, `exposes`, `remotes`, `shared`, and the rest —
carries across to the Vite plugin. The one carved-out exception is dev mode, and the page
is specific about what that means:

**Dev-mode hot updates for remote modules are on the roadmap and are not supported today.**

That single sentence changes the daily development loop for anyone working on a remote.
Editing `checkout/src/CheckoutFlow.tsx` while `shell` (the host) has it loaded via
federation does **not** hot-reload the running instance the way editing `shell`'s own
source does — HMR inside the *checkout* dev server works normally for `checkout`'s own
page, but the *federated* copy the host consumed is a snapshot, not a live-reloading
module. In practice this leaves two working modes: build the remote and point the host at
the built `dist`'s `remoteEntry.js` (correct output, no hot loop), or keep the remote's own
dev server running and reload the host's page after each remote change instead of relying
on the module hot-swapping in place. Neither is HMR in the sense
[the dev server's native-ESM model](../04-dev-server-mechanics/01-native-esm-and-hmr.md)
provides for same-app modules.

This page has stopped at the mechanism and the two documented limitations; the worked
two-app example, the version spine, and the operational gotchas that only surface once code
is actually running across the two apps are split into
[05b](05b-worked-example-and-the-version-spine.md).

## Gotchas

**★ Symptom: a federated remote's assets 404 in production but work in dev.** Cause:
`base` (or `server.origin` in dev) was left relative, or was set to a path instead of the
remote's absolute origin. Every chunk URL the remote emits gets resolved against whatever
page is currently loading it — once a host on a different origin loads the manifest, a
relative URL resolves against the *host's* origin. Fix: set `base` and `server.origin` to
the remote's own absolute origin, exactly as the integration doc's example does.

**★ Symptom: the app throws a syntax error in older browsers, but only in the federated
build.** Cause: `build.target` was lowered below `chrome89` (or left at Vite's default)
without accounting for the top-level `await` the federation runtime generates to resolve
shared dependencies. Fix: keep `build.target: 'chrome89'` or higher, or add
`vite-plugin-top-level-await` if the deployment target requires supporting older browsers.

**Symptom: editing the remote's source doesn't update the running host during
development.** Cause: this is not a misconfiguration — dev-mode hot updates for remote
modules are, per the integration page, on the roadmap and not supported today. Fix: build
the remote and point the host's `remotes` entry at the built `dist`'s `remoteEntry.js`
during integration testing, or accept a full page reload of the host after each remote
change instead of expecting an in-place hot swap.

**Symptom: `npm install` pulls `@originjs/vite-plugin-federation` and nothing in this
page's config shape matches what the installed package expects.** Cause: two differently
maintained packages answer to similar search terms; `@originjs/vite-plugin-federation`
last published 2025-04-12, `@module-federation/vite` published 2026-09-07. Fix: confirm
which package is actually installed with `npm view <pkg> time.modified` before assuming
either the config shape or the limitations on this page apply — see
[Module Federation migration](../16-migration-recipes/01n-module-federation-migration.md)
for the full comparison.

## Interview questions

**★ What does `remoteEntry.js` actually contain, and when is it fetched?**
It is a small manifest, not application code — a map from the names the remote chose to
expose to the actual chunk URLs that implement them, plus the remote's declared `shared`
dependencies. It is fetched by the host at the point the host's code first attempts to
resolve a specifier like `checkout/CheckoutFlow`, not bundled into the host's build. That
lazy, runtime fetch is precisely what lets the remote redeploy independently of the host.

**★ Why must a remote's `base` and `server.origin` be set to its own absolute origin rather
than left as the default relative path?**
Because the chunk URLs a remote emits get resolved against whatever page is currently
loading them. In the remote's own dev server that's harmless — the page and the assets
share an origin. Once a host on a different origin fetches the remote's manifest, a
relative URL resolves against the host's origin instead, and the remote's chunks 404. An
absolute origin makes the URLs portable regardless of who's loading them.

**Why does `build.target` have to be `chrome89` or higher for a federated build
specifically, when a non-federated Vite app has no such floor by default?**
The federation runtime resolves shared dependencies asynchronously before a remote's own
module code executes, and it expresses that as a top-level `await` in the generated code.
Top-level `await` requires browser support that starts around Chrome 89; below that, the
generated module is not valid syntax for the target browser, not merely unsupported at
runtime.

**What does "except for the dev option, all options are supported" actually exclude, in
practice?**
It excludes dev-mode hot updates for remote modules specifically — everything else in the
webpack-side Module Federation configuration surface (`name`, `filename`, `exposes`,
`remotes`, `shared`, and so on) carries across. In practice it means editing a remote's
source does not hot-swap the copy a running host already loaded; the dev loop for
cross-app changes has to route through a rebuild or a full reload rather than in-place HMR.

---

{/* FOOTER */}
