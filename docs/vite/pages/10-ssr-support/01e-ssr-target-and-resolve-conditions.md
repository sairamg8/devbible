---
title: "`ssr.target` picks a platform and the platform picks the package entry — which is why the same import resolves to a different file on the server than in the browser"
sidebar_label: "`ssr.target` & Conditions"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [`ssr.target`](https://vite.dev/config/ssr-options#ssr-target), [`ssr.resolve.conditions`](https://vite.dev/config/ssr-options#ssr-resolve-conditions), [`ssr.resolve.externalConditions`](https://vite.dev/config/ssr-options#ssr-resolve-externalconditions), [`ssr.resolve.mainFields`](https://vite.dev/config/ssr-options#ssr-resolve-mainfields), [`resolve.conditions`](https://vite.dev/config/shared-options#resolve-conditions), [SSR § SSR Target](https://vite.dev/guide/ssr). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ The guide and the config reference give **different accounts** of the SSR default conditions. Both are quoted below and the discrepancy is flagged rather than resolved.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `ssr.target` and the Four Resolution Knobs

**A modern package does not have one entry point; it has a table of them keyed by
"condition". Which row gets picked is the difference between loading a browser build on your
server, a Node build in your edge worker, or a development build in production. Vite exposes
four separate knobs for this on the SSR side, and the reason there are four rather than one
is the externalisation split from [chunk 1d](01d-ssr-externals.md).**

---

## 1. Under-The-Hood Mechanics

### `ssr.target` — two values, wide consequences

**Type:** `'node' | 'webworker'` · **Default:** `node` · *"Build target for the SSR server."*

> *"The default target for the SSR build is a node environment, but you can also run the server in a Web Worker. Packages entry resolution is different for each platform. You can configure the target to be Web Worker using the `ssr.target` set to `'webworker'`."*

`target` is not only a label. It changes the **default resolve conditions**, and — per
[chunk 1d](01d-ssr-externals.md) — under `ssr.target: 'node'`, *"Node.js built-ins will also be externalized by default"* even with `ssr.noExternal: true`.

### What a "condition" is

> *"Here, `import` and `require` are "conditions". Conditions can be nested and should be specified from most specific to least specific."*
> *"`development|production` is a special value that is replaced with `production` or `development` depending on the value of `process.env.NODE_ENV`. It is replaced with `production` when `process.env.NODE_ENV === 'production'` and `development` otherwise."*
> *"Note that `import`, `require`, `default` conditions are always applied if the requirements are met."*

### The four knobs, and which code each one touches

| Option | Default | Applies to |
|---|---|---|
| `ssr.resolve.conditions` | `['module', 'node', 'development\|production']` (`defaultServerConditions`); client conditions when `ssr.target === 'webworker'` | non-externalised deps, in the plugin pipeline |
| `ssr.resolve.externalConditions` | `['node', 'module-sync']` | externalised imports, including via `ssrLoadModule` |
| `ssr.resolve.mainFields` | `['module', 'jsnext:main', 'jsnext']` | non-externalised deps only |
| `resolve.conditions` | `['module', 'browser', 'development\|production']` (`defaultClientConditions`) | the client environment |

Note the client's `mainFields` default is `['browser', 'module', 'jsnext:main', 'jsnext']` —
the SSR default drops `browser`. That single removed string is the entire reason a package
with a `browser` field loads its Node build on the server.

The split between the first two options is stated directly:

> *"These conditions are used in the plugin pipeline, and only affect non-externalized dependencies during the SSR build. Use `ssr.resolve.externalConditions` to affect externalized imports."*
> *"Conditions that are used during ssr import (including `ssrLoadModule`) of externalized direct dependencies (external dependencies imported by Vite)."*

⚠️ **The two sources disagree on the default.** The SSR guide says:

> *"By default package entry resolution will use the conditions set in [`resolve.conditions`](https://vite.dev/config/shared-options#resolve-conditions) for the SSR build."*

…while the config reference documents `ssr.resolve.conditions` with its own default of
`defaultServerConditions`. **I could not reconcile these from the documentation.** What is
certain, and enough to work with: a dedicated `ssr.resolve.conditions` option exists, and the
value you set there is what applies. Set it explicitly rather than relying on either account
of the default.

### Node must be told the same thing you told Vite

For custom conditions there is a second half that has nothing to do with Vite:

> *"When using this option, make sure to run Node with [`--conditions` flag](https://nodejs.org/docs/latest/api/cli.html#-c-condition---conditionscondition) with the same values in both dev and build to get a consistent behavior."*
> *"For example, when setting `['node', 'custom']`, you should run `NODE_OPTIONS='--conditions custom' vite` in dev and `NODE_OPTIONS="--conditions custom" node ./dist/server.js` after build."*

### `mainFields` is a fallback, not an override

> *"Note this takes lower precedence than conditional exports resolved from the `exports` field: if an entry point is successfully resolved from `exports`, the main field will be ignored. This setting only affects non-externalized dependencies."*

---

## 2. Real-World Engineering Scenario

**A date library that pulled `window` into the renderer.**

`@acme/formatters` publishes `exports` with `browser`, `node` and `default` conditions; the
browser build reads `Intl` off `window`. The client worked. Under SSR the package was
externalised, so Node resolved it — and Node applies its own conditions, not Vite's. The team
had already added `browser` to `resolve.conditions` months earlier for an unrelated reason,
and assumed that was the cause. Removing it changed nothing, because the option they had
edited only governs the **client** environment; the SSR path needed
`ssr.resolve.externalConditions`, and the fix for a *bundled* copy of the same package would
have been `ssr.resolve.conditions` — a third option again.

The lesson is the one the option table encodes: before changing a condition, decide which of
the three code paths the failing import took.

---

## 3. Production-Grade Code Example

```js
// vite.config.js — an SSR app that ships to Node and to an edge worker
import { defineConfig } from 'vite'

export default defineConfig({
  // Client environment only.
  resolve: {
    conditions: ['module', 'browser', 'development|production'],
  },

  ssr: {
    target: 'node',

    resolve: {
      // Applies to dependencies Vite BUNDLES into the SSR output.
      conditions: ['module', 'node', 'development|production'],

      // Applies to dependencies NODE loads (the externalised ones).
      externalConditions: ['node', 'module-sync'],

      // Only consulted when a package has no usable `exports` field.
      mainFields: ['module', 'jsnext:main', 'jsnext'],
    },
  },

  environments: {
    // The edge build resolves like a browser and bundles everything.
    edge: {
      resolve: { conditions: ['module', 'worker', 'browser'], noExternal: true },
      build: { outDir: 'dist/edge' },
    },
  },
})
```

```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='--conditions acme-dev' node server",
    "build:server": "NODE_OPTIONS='--conditions acme-dev' vite build --outDir dist/server --ssr src/entry-server.js",
    "start": "NODE_OPTIONS='--conditions acme-dev' node ./dist/server/entry-server.js"
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

**`ssr.target: 'webworker'` silently swaps the condition defaults.** The documented default
for `ssr.resolve.conditions` becomes `defaultClientConditions` — `['module', 'browser', 'development|production']` — because a worker is closer to a browser than to Node. Changing
`target` therefore changes which entry every conditional package resolves to.

**`development|production` reads `process.env.NODE_ENV`, not `mode`.** These are separate
concepts in Vite; `vite build --mode staging` still has `NODE_ENV=production` unless you set
it. A package that ships a `development` entry with extra warnings will be chosen or not on
the basis of `NODE_ENV` alone.

**`import`, `require` and `default` are unconditional.** They are *"always applied if the requirements are met"*, so they cannot be removed by trimming your conditions array — only
out-ranked by something more specific listed earlier.

---

## Gotchas

**★ Symptom: a dependency throws `window is not defined` (or `document is not defined`) during SSR.**
Cause: the browser entry of a conditional package was selected on the server. Fix depends on
which path the import took — bundled or externalised — and they are different options.
```js
export default defineConfig({
  ssr: {
    resolve: {
      conditions: ['module', 'node'],          // if Vite bundles the package
      externalConditions: ['node', 'module-sync'], // if Node loads it
    },
  },
})
```

**★ Symptom: you edit `ssr.resolve.conditions` and nothing changes for the failing package.**
Cause: the package is externalised, and that option *"only affect[s] non-externalized dependencies"*. Fix: edit `externalConditions` instead — or bring the package into the
pipeline with `ssr.noExternal` so the first option starts to apply.

**★ Symptom: a custom condition works in dev and resolves differently after build.**
Cause: Node was launched with `--conditions` in one command and not the other. Vite's option
governs what Vite resolves; Node's flag governs what Node resolves, and an SSR app has both.
Fix: set it in every command that runs the app.
```json
{ "scripts": {
  "dev": "NODE_OPTIONS='--conditions custom' node server",
  "start": "NODE_OPTIONS='--conditions custom' node ./dist/server.js"
} }
```

**★ Symptom: `ssr.resolve.mainFields` is set and the package still resolves to the wrong file.**
Cause: the package has an `exports` field and it resolved successfully — *"if an entry point is successfully resolved from `exports`, the main field will be ignored."* Fix: `mainFields` is
the legacy path; use conditions for any package with `exports`.

**★ Symptom: switching `ssr.target` to `'webworker'` changes which files a dozen packages resolve to.**
Cause: intended, and easy to miss — the default conditions flip from server to client. Fix: if
you want the target's built-in and bundling semantics without the resolution change, pin the
conditions explicitly rather than inheriting the default.
```js
export default defineConfig({
  ssr: { target: 'webworker', resolve: { conditions: ['module', 'worker', 'browser'] } },
})
```

**★ Symptom: a library's development build, with its dev-only warnings, ends up in a production server bundle.**
Cause: `development|production` resolves from `process.env.NODE_ENV`, and a custom mode does
not set it. Fix: set `NODE_ENV` in the command, not just `--mode`.
```json
{ "scripts": { "build:server": "NODE_ENV=production vite build --ssr src/entry-server.js --mode staging" } }
```

**★ Symptom: removing `browser` from `resolve.conditions` does not stop the browser build being used on the server.**
Cause: `resolve.conditions` is the **client** environment's option. The SSR side has its own.
Fix: change the SSR option, and treat the client one as untouched.

---

## Interview questions

**★ Why does Vite need two separate condition options for SSR when the client needs only one?**
Because SSR has two resolvers. Dependencies that Vite bundles are resolved by Vite's pipeline
and obey `ssr.resolve.conditions`; dependencies that are externalised are resolved by Node
when it evaluates the import, and Vite's only lever there is what it passes along —
`ssr.resolve.externalConditions`. The client has no externalisation, so one option suffices.
This is the clearest example of the general rule that externalisation moves a decision out of
Vite's reach.

**★ What does `ssr.target` actually change?**
Three things, only one of which is in its name. It selects the build target for the SSR
server; it swaps the default resolve conditions between server defaults and client defaults
(a worker resolves more like a browser); and it decides how Node built-ins are treated —
under `'node'` they stay externalised even when `ssr.noExternal: true`, and under a worker
target `ssr.noExternal: true` throws if any are imported.

**★ Why does a package with a `browser` field load correctly on the server without any configuration?**
Because the SSR default for `mainFields` is `['module', 'jsnext:main', 'jsnext']` while the
client default is `['browser', 'module', 'jsnext:main', 'jsnext']`. Dropping `browser` from
the server list means the legacy field is never consulted there. It is a one-string difference
that quietly does most of the work — and it applies only to packages with no usable `exports`
field, since `exports` outranks `mainFields` entirely.

**★ How does `development|production` decide, and why does that trip people up in CI?**
It is substituted from `process.env.NODE_ENV`: `production` when that value is exactly
`'production'`, `development` otherwise. The trap is that Vite's *mode* and `NODE_ENV` are
different concepts — a build run as `--mode staging` still has `NODE_ENV=production` unless
you say otherwise, and a build run with a custom `NODE_ENV` gets the `development` entry of
every conditional package. If a library's dev build appears in a production artefact, this is
the first thing to check.

**★ You add a custom condition and the app behaves differently before and after build. Where do you look?**
At whether Node was told. Vite's `ssr.resolve.externalConditions` governs Vite's own resolution
of external imports, but once the built server runs, plain Node is doing the resolving and
only its `--conditions` flag applies. The docs make this an explicit instruction: run with
`--conditions` *"with the same values in both dev and build"*, and they give both commands.
The general failure is treating a resolution rule as a build-time concern when it is also a
runtime one.

---

← [SSR Externals](01d-ssr-externals.md) · [Vite overview](../../README.md) · Next → [The Two Builds](01f-the-two-builds.md)
