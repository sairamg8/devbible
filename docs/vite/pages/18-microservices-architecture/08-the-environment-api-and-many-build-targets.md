---
title: "When one codebase has to ship a browser bundle, a Node SSR bundle and an edge-worker bundle at once, Vite 6+ stopped treating that as two hard-coded special cases and made it a configurable list — the Environment API"
sidebar_label: "08 · The Environment API"
sidebar_position: 21
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-08 against the Vite documentation — [Environment API](https://vite.dev/guide/api-environment.md). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**A team that ships one browser bundle and calls it a day never needs this page. A team that
ships a browser bundle, a Node SSR bundle for the same app, *and* an edge-middleware bundle
that pre-renders part of a page before either of the others runs, does — because before Vite 6
those three targets were not three peers in one config, they were "the real config" plus a
parallel, differently-shaped `ssr` object bolted on the side, plus a third build invoked by
hand outside Vite entirely. The Environment API turns that into one list you declare. It does
not make services talk to each other and it is not Module Federation — that distinction is
made explicit and in full in
[08b · Many deployables is not microservices](08b-many-deployables-is-not-microservices.md).
This chunk covers the mechanism itself: the config shape, the interface, the dev/build
asymmetry that bites teams who never read past the happy path, and the stability warning that
governs what to build on top of it.**

## What it replaced

> *"Until Vite 5, there were two implicit Environments (`client`, and optionally `ssr`). The
> new Environment API allows users and framework authors to create as many environments as
> needed to map the way their apps work in production."*

"Implicit" is the word to sit with. It meant SSR was never a build target you configured the
same way as the client — it was a `ssr: true` boolean and a scattering of `ssr.*` options
(`ssr.target`, `ssr.noExternal`, `ssr.resolve.conditions` — see
[10 · `ssr.target` and the resolve knobs](../10-ssr-support/01e-ssr-target-and-resolve-conditions.md))
that shadowed, rather than reused, the shape of the top-level `build` and `resolve` options.
A third target — an edge worker, a React Server Components runtime, anything that is neither
"the browser" nor "the thing named `ssr`" — had no slot at all. Teams that needed one wrote a
second `vite.config.ts` and invoked `vite build` a second time by hand, gluing the two
outputs together with a manifest file on disk. The Environment API replaces both the bolted-on
`ssr.*` object and the hand-rolled second invocation with one `environments` map, each entry
shaped exactly like the top-level config, in the same process, sharing the same plugin
pipeline. The full mechanics of that replacement — isolated module graphs, what `hotUpdate`
does per-environment, the compatibility surface `server.moduleGraph` still provides — are
covered in depth in
[10 · Environments replace the `ssr` boolean](../10-ssr-support/01b-environments-replace-the-ssr-boolean.md);
this page stays on what declaring several environments buys a repo shipping several
deployables, and what it explicitly does not.

## The `environments` config option

```js
export default {
  build: {
    sourcemap: false,
  },
  optimizeDeps: {
    include: ['lib'],
  },
  environments: {
    server: {},
    edge: {
      resolve: {
        noExternal: true,
      },
    },
  },
}
```

Two things are happening in that six-line example. First, the top-level `build` and
`optimizeDeps` are not "the client's config" and "everything else" — they are **defaults**.
An environment that declares nothing, like `server: {}` here, inherits the top-level options
wholesale; `sourcemap: false` applies to it exactly as it applies to the client. Second, `edge`
overrides one field — `resolve.noExternal: true` — and inherits the rest. That single field is
doing real work: `noExternal` controls which dependencies Vite bundles into the output versus
leaves as an external `require`/`import` for the runtime to resolve out of `node_modules` at
request time. An edge runtime (Cloudflare Workers, Vercel Edge Functions and similar) has no
`node_modules` on disk when the code actually executes — there is nothing for an external
import to resolve *against*. Setting `noExternal: true` tells Vite "there is no runtime
filesystem to lean on, put everything in the output," which is the correct default for that
target and the wrong one for a Node SSR target that legitimately wants to leave large,
rarely-changing dependencies external and let Node's own `require` resolve them from
`node_modules` at boot.

## The `EnvironmentOptions` interface, field by field

```ts
interface EnvironmentOptions {
  define?: Record<string, any>
  resolve?: EnvironmentResolveOptions
  optimizeDeps: DepOptimizationOptions
  consumer?: 'client' | 'server'
  dev: DevOptions
  build: BuildOptions
}
```

- **`define`** — the same static-replacement mechanism as the top-level `define`, scoped to
  this environment. A constant that should differ between the browser bundle and the edge
  bundle (a feature flag, a runtime name) belongs here rather than in a shared top-level value
  branched on at runtime.
- **`resolve`** — this environment's module-resolution behaviour: conditions, `noExternal`,
  main fields. The `edge` example above touches exactly this.
- **`optimizeDeps`** — dependency pre-bundling configuration, scoped per environment.
- **`consumer`** — `'client' | 'server'`, and it is a *capability* declaration, not a name.
  An environment named `edge` or `worker` still has to say which of the two resolution
  postures it wants, because Vite's default resolve conditions differ between "code that runs
  in a browser" and "code that runs in a server-shaped runtime" (module fields, the
  `browser` condition, and so on — the concrete condition lists for the built-in `ssr`
  environment are in
  [10 · `ssr.target` and the resolve knobs](../10-ssr-support/01e-ssr-target-and-resolve-conditions.md)).
  `consumer: 'server'` is what lets a plugin branch on "is this environment server-shaped"
  without knowing or caring what the environment happens to be called.
- **`dev`** — dev-time behaviour for this environment (how its dev runtime executes code).
- **`build`** — this environment's `outDir`, target, rollup/rolldown options and the rest of
  the ordinary build surface, scoped per environment — which is how `edge` above can ship to
  `dist/edge` while the client ships to `dist/client` from one `vite build` invocation.

## Which environments exist, and when — the dev/build asymmetry

> *"The `client` and a server environment named `ssr` are always present during dev."*

During **dev**, you get both `client` and `ssr` for free, whether you configured `ssr` or not
— this is what lets `server.ssrLoadModule(url)` and `server.moduleGraph` keep working without
any config at all. During **build**, only `client` gets that treatment; `ssr` (or any other
server environment) exists in the build output **only if you explicitly configured it**,
either under `environments.ssr` or via the legacy `build.ssr` flag.

🔴 **This is the single most dangerous asymmetry in the API, and it produces exactly the bug
class its shape suggests: works in dev, missing from the production build.** A repo that
never wrote `environments: { ssr: {} }` — because dev never complained, `server.ssrLoadModule`
worked fine locally, pages rendered — ships a `vite build` that emits a `client` directory and
nothing else. The SSR entry point that dev quietly supplied for free simply is not there in
`dist/`. There is no error at build time; there is no `ssr` environment to fail, because none
was ever declared. The fix is to declare the environment explicitly wherever it is meant to be
built, not to rely on dev's implicit `client` + `ssr` pair carrying over:

```js
export default {
  environments: {
    ssr: {},          // now `ssr` exists at build time too
    edge: { resolve: { noExternal: true } },
  },
}
```

## The stability warning — quoted in full

> *"The Environment API is generally in the release candidate phase. We'll maintain
> stability in the APIs between major releases to allow the ecosystem to experiment and build
> upon them."*
>
> *"…note that some specific APIs are still considered experimental."*

Read literally, that is two different promises for two different surfaces. **Configuring
`environments` in `vite.config.ts`** — the `environments` map, `EnvironmentOptions`, the
fields above — is the stated-stable-between-majors surface; a team shipping several build
targets from one config is using the part of the API the maintainers are committing to hold
steady. **Building tooling against the programmatic runtime** — reading environments back off
a running dev server, driving the module runner directly, writing a plugin that hooks
per-environment behaviour — sits closer to the "still considered experimental" half. The
practical read for a team: declare `environments` in config with confidence; be more
conservative about a bespoke script or in-house plugin that pokes at the programmatic API
surface directly, because that half is explicitly the one still moving.

⚠️ **Module runners, hot channels and per-environment plugin hooks exist as documented
surface, but the primary-source material verified for this page does not quote their shape.**
The Environment API guide and its companions describe a dev module runner per environment and
a per-environment hot-update channel (`hotUpdate` runs "for each environment independently"),
but this page's sources do not give the runner's API surface in enough detail to demonstrate
it here without guessing at signatures.
[10 · The module runner](../10-ssr-support/01c-the-module-runner.md) is the place that already
covers it — read that, not a reconstruction here.

Continued in
[08b · Many deployables is not microservices](08b-many-deployables-is-not-microservices.md):
what this feature actually buys a repo that ships several deployables, how it compares to
running separate Vite apps, and the explicit, sourced answer to whether it has anything to do
with Module Federation.

## Gotchas

**★ Symptom: `vite build` emits `dist/client` and nothing else, even though the app clearly
renders server-side in dev.** Cause: the dev/build asymmetry above — dev always creates
`client` and `ssr` for free, build only creates `client` unless a server environment is
explicitly declared. Fix: add `environments: { ssr: {} }` (or `build.ssr` for the legacy
single-target flag) so the environment exists at build time too.

**★ Symptom: an edge deployment fails at runtime with a module-not-found error for a package
that is clearly listed in `package.json`.** Cause: the edge environment inherited a
`noExternal` setting meant for a Node target — or never set `noExternal` at all — so Vite left
a dependency external, expecting the runtime to resolve it from `node_modules`. An edge
runtime has no `node_modules` at request time. Fix: set `resolve.noExternal: true` on the edge
environment specifically, as the documented example does.
```js
environments: {
  edge: { resolve: { noExternal: true } },
}
```

**★ Symptom: setting `edge`'s `noExternal: true` balloons the edge bundle far past the
platform's size limit.** Cause: `noExternal: true` bundles *everything*, including large
dependencies the edge code path never actually calls — there is no per-package selectivity in
the boolean form. Fix: use the array form of `noExternal` to bundle only the packages that
genuinely need it, keeping the rest external where the target platform supports it, or split
the code path so the edge entry point does not import the heavy dependency at all.

**★ A top-level option silently does *not* apply to a server environment.** Cause: not every
top-level option is inherited as a default by every environment — `optimizeDeps` in
particular is documented as applying to the `client` environment only, because pre-bundling
behaviour tuned for a browser dev server does not translate to a server target. This is
covered in full, with the fix, in
[10 · Environments replace the `ssr` boolean § Gotchas](../10-ssr-support/01b-environments-replace-the-ssr-boolean.md);
do not assume every top-level field behaves like `build.sourcemap` above and inherits cleanly.

**★ Building an in-house CLI or plugin against the programmatic Environment API and expecting
minor-version stability.** Cause: the stability promise is scoped — *"stability in the APIs
between major releases"* for the configured surface, but *"some specific APIs are still
considered experimental."* The module runner and the per-environment programmatic surface sit
closer to the experimental half. Fix: keep in-house tooling built against `environments` in
config, where the promise is stronger; treat any code reaching into
`server.environments.<name>.runner` or similar as liable to move, and re-check it on every
Vite upgrade rather than assuming it is frozen.

## Interview questions

**★ What did the Environment API replace, and why was the thing it replaced a problem?**
It replaced two implicit, hard-coded targets — `client` and, optionally, `ssr` as a boolean
plus a parallel `ssr.*` options object — with a configurable `environments` map where every
entry has the same shape as the top-level config. The problem with the old shape was that it
could only ever address two targets, and the second one was configured through a differently
structured, bolted-on set of options rather than the same options simply scoped. A third
target — an edge worker, an RSC runtime — had no slot at all and required a hand-rolled second
`vite build` outside Vite's own config system.

**★ Why is only `client` guaranteed to exist in a production build, when dev always gives you
`client` and `ssr` for free?** Dev's implicit `ssr` environment exists purely for backward
compatibility with `server.ssrLoadModule` and `server.moduleGraph` — APIs that predate the
Environment API and that a lot of existing tooling still calls. Build has no such legacy
surface to support, so it makes no assumption about what you are shipping: if you did not
declare a server environment, Vite has no reason to build one, and it does not silently invent
one from the dev-time default.

**★ What does `resolve.noExternal: true` actually do, and why does the documented `edge`
example set it?** It tells Vite not to leave any dependency as an external `require`/`import`
in the output — bundle everything into the emitted file instead. An edge runtime has no
`node_modules` directory on disk at the point the code executes, so an external import has
nothing to resolve against at runtime; `noExternal: true` is the only correct posture for a
target with no runtime filesystem to lean on, even though the same setting would be wasteful
bundling for a Node SSR target that can legitimately resolve externals from `node_modules` at
boot.

**★ The docs call the Environment API a release candidate. What should that change about how
a team uses it?** The stability promise is explicitly scoped to hold between major releases,
but the docs separately flag that "some specific APIs are still considered experimental." A
reasonable reading is to treat the declarative surface — the `environments` map in config — as
safe to build a production deploy pipeline around, and to treat the programmatic runtime
surface (module runners, per-environment hooks reached from custom tooling) as more likely to
move, re-verifying it on upgrade rather than assuming it is frozen the way the config shape is.

---

← [server.origin, manifest & router basename](07b-server-origin-manifest-and-the-router-basename.md) · [Vite overview](../../README.md) · Next → [Many deployables, not microservices](08b-many-deployables-is-not-microservices.md)
