---
title: "Externalisation is the default because Node can already load npm packages, and every SSR-only parse error is that default being right about the wrong package"
sidebar_label: "SSR Externals"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [SSR § SSR Externals](https://vite.dev/guide/ssr), [`ssr.external`](https://vite.dev/config/ssr-options#ssr-external), [`ssr.noExternal`](https://vite.dev/config/ssr-options#ssr-noexternal), [SSR § SSR Bundle](https://vite.dev/guide/ssr). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ One gotcha below (duplicate module instances) is an **inference from the documented mechanism**, not a documented claim, and is labelled as such inline.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ SSR Externals: Why Vite Skips Your Dependencies on Purpose

**On the client, every dependency must be processed — the browser cannot resolve
`react-dom/server` from `node_modules`. On the server, Node already can. So Vite's SSR
default is the opposite of its client default: dependencies are handed to the runtime
untouched. That single asymmetry produces most of the SSR-only bugs people hit, because a
package that needs Vite's pipeline never gets it.**

> *"Dependencies are "externalized" from Vite's SSR transform module system by default when running SSR. This speeds up both dev and build."* — [SSR guide](https://vite.dev/guide/ssr)

⚠️ Scope note from the config reference, and it is easy to miss:

> *"Unless noted, the options in this section are applied to both dev and build."*

A change made to fix a dev crash also changes the production bundle.

---

## 1. Under-The-Hood Mechanics

### The default, stated three times in three places

From the guide:

> *"If a dependency needs to be transformed by Vite's pipeline, for example, because Vite features are used untranspiled in them, they can be added to [`ssr.noExternal`](https://vite.dev/config/ssr-options#ssr-noexternal)."*
> *"For linked dependencies, they are not externalized by default to take advantage of Vite's HMR. If this isn't desired, for example, to test dependencies as if they aren't linked, you can add it to [`ssr.external`](https://vite.dev/config/ssr-options#ssr-external)."*

From `ssr.external` — **Type:** `string[] | true`:

> *"Externalize the given dependencies and their transitive dependencies for SSR. By default, all dependencies are externalized except for linked dependencies (for HMR). If you prefer to externalize the linked dependency, you can pass its name to this option."*
> *"If `true`, all dependencies including linked dependencies are externalized."*

From `ssr.noExternal` — **Type:** `string | RegExp | (string | RegExp)[] | true`:

> *"Prevent listed dependencies from being externalized for SSR, which they will get bundled in build. By default, only linked dependencies are not externalized (for HMR). If you prefer to externalize the linked dependency, you can pass its name to the `ssr.external` option."*

Note the **type asymmetry**: `noExternal` accepts a `RegExp`; `external` does not. A rule like
"bundle every `@acme/*` package" is expressible one way only.

### Precedence, quoted exactly

Two rules, and they do not point the same direction — read both:

> *"Note that the explicitly listed dependencies (using `string[]` type) will always take priority if they're also listed in `ssr.noExternal` (using any type)."*
> *"If `true`, no dependencies are externalized. However, dependencies explicitly listed in `ssr.external` (using `string[]` type) can take priority and still be externalized. If `ssr.target: 'node'` is set, Node.js built-ins will also be externalized by default."*
> *"Note that if both `ssr.noExternal: true` and `ssr.external: true` are configured, `ssr.noExternal` takes priority and no dependencies are externalized."*

Collapsed into a decision table:

| `ssr.external` | `ssr.noExternal` | Result for a package named in `external` |
|---|---|---|
| `['pkg']` | `['pkg']` or `true` or `/pkg/` | **externalised** — the explicit list wins |
| `true` | `true` | **bundled** — `noExternal: true` wins overall |
| unset | `true` | bundled (plus Node built-ins still external when `ssr.target: 'node'`) |
| unset | unset | externalised, except linked dependencies |

### `ssr.noExternal: true` is also the "SSR bundle" switch

> *"In some cases like `webworker` runtimes, you might want to bundle your SSR build into a single JavaScript file. You can enable this behavior by setting `ssr.noExternal` to `true`. This will do two things:"*
> *"Treat all dependencies as `noExternal`"*
> *"Throw an error if any Node.js built-ins are imported"*

The second bullet is a feature, not a side effect: for an edge or worker target, an import of
`node:fs` anywhere in the graph is a deploy-time failure you want surfaced at build time.

### Aliases and externals interact badly

> *"If you have configured aliases that redirect one package to another, you may want to alias the actual `node_modules` packages instead to make it work for SSR externalized dependencies. Both [Yarn](https://classic.yarnpkg.com/en/docs/cli/add/#toc-yarn-add-alias) and [pnpm](https://pnpm.io/aliases/) support aliasing via the `npm:` prefix."*

The mechanism is straightforward once stated: `resolve.alias` is a **Vite** resolver rule.
An externalised dependency is resolved by **Node**, which has never heard of your config.

---

## 2. Real-World Engineering Scenario

**A design-system package that worked in the browser and crashed the renderer.**

`@acme/ui` is published as untranspiled source: `.tsx` files and components that
`import './button.css'`. On the client this is fine — Vite processes it like any other
module. Under SSR it is externalised by default, so Node receives `button.tsx` and a CSS
import it cannot parse, and the server crashes on the first render of any page using it.

The fix is one line of config, but the *reasoning* is what generalises: externalisation is a
statement that "the runtime can load this as-is." For a package shipping build-time-only
syntax, that statement is false, and `ssr.noExternal` is how you retract it.

The same team hit the mirror image weeks later. `@acme/ui` was `pnpm link`ed for local work,
so it was *not* externalised — Vite processed it and everything passed. CI installed the
published tarball, it was externalised, and the crash came back. Linked and published copies
of the same package take opposite paths by default.

---

## 3. Production-Grade Code Example

```js
// vite.config.js — externalisation policy for a Node SSR app
import { defineConfig } from 'vite'

export default defineConfig({
  ssr: {
    // Packages that ship untranspiled source, CSS imports, or Vite-only
    // syntax must go through the pipeline. RegExp is accepted here.
    noExternal: ['@acme/ui', /^@acme\/design-/],

    // Force-externalise a linked package so local dev matches CI, where
    // the published tarball would be externalised anyway.
    external: ['@acme/analytics'],
  },
})
```

```js
// vite.config.js — an edge/worker target: bundle everything, fail on Node built-ins
export default defineConfig({
  ssr: {
    target: 'webworker',
    noExternal: true, // single-file bundle + error on any node: import
  },
})
```

```js
// vite.config.js — the alias trap, and the documented way out
export default defineConfig({
  resolve: {
    // Applies to modules Vite resolves. An EXTERNALISED dependency is
    // resolved by Node, which never sees this map.
    alias: { 'react': 'preact/compat' },
  },
})

// package.json — alias in the package manager so Node resolves it too
// {
//   "dependencies": {
//     "react": "npm:preact@^10"
//   }
// }
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

**Externalisation is transitive.** `ssr.external` *"Externalize the given dependencies **and their transitive dependencies**"* — naming a package externalises its whole subtree, which is
usually what you want and occasionally not.

**`noExternal` is the only side that takes a `RegExp`.** Scoped-package rules and
`/^@acme\//`-shaped policies are therefore expressible for bundling but not for
externalising; `external` needs the names spelled out.

**`ssr.target: 'node'` changes what `noExternal: true` means.** With that target set, Node
built-ins are still externalised even under `noExternal: true` — which is exactly why the
`webworker` target throws instead: there are no built-ins to fall back to.

---

## Gotchas

**★ Symptom: SSR crashes on a syntax error or an unparseable import inside `node_modules`, while the client build of the same page is fine.**
Cause: the package was externalised, so Node received untranspiled source — the case the docs
describe as *"Vite features are used untranspiled in them"*. Fix: retract the externalisation
for that package only.
```js
export default defineConfig({
  ssr: { noExternal: ['@acme/ui'] },
})
```

**★ Symptom: it works with the package linked locally and breaks in CI.**
Cause: opposite defaults. *"For linked dependencies, they are not externalized by default to take advantage of Vite's HMR"* — so linked, Vite transforms it; installed, Node loads it raw.
Fix: make the two match. Either bundle it in both cases, or externalise the link.
```js
export default defineConfig({
  ssr: { external: ['@acme/analytics'] }, // treat the link as if installed
})
```

**★ Symptom: a package is listed in `ssr.noExternal` and is still externalised.**
Cause: it is also named in `ssr.external` as a string. *"the explicitly listed dependencies (using `string[]` type) will always take priority if they're also listed in `ssr.noExternal` (using any type)"* — including when `noExternal` is a RegExp that happens to match. Fix: remove
the name from `external`; a regex will not out-rank it.

**★ Symptom: `ssr.external: true` was set to force everything external, and nothing is external.**
Cause: `ssr.noExternal: true` is set as well, and *"`ssr.noExternal` takes priority and no dependencies are externalized."* Fix: the two `true` values are not composable — pick one, and
express the exception with the string list on the other side.
```js
export default defineConfig({
  ssr: { noExternal: true, external: ['pg', 'sharp'] }, // list wins per-package
})
```

**★ Symptom: the SSR build fails with an error about a Node built-in after switching to a worker target.**
Cause: intended. `ssr.noExternal: true` will *"Throw an error if any Node.js built-ins are imported"*. Fix: this is a real portability defect — remove the Node dependency from the
server graph rather than silencing the build. A `node:crypto` import usually has a Web Crypto
equivalent; a `node:fs` import usually means data that should be fetched or inlined.

**★ Symptom: `resolve.alias` works on the client and is ignored under SSR for the same package.**
Cause: the aliased package is externalised, so Node resolves it and never consults Vite's
alias map. Fix: alias at the package-manager level, as the docs direct — `npm:` in
`package.json` — so the resolution is real on disk.

**★ Symptom: a fix added to `ssr.noExternal` to stop a dev crash changes bundle size and start-up cost in production.**
Cause: *"Unless noted, the options in this section are applied to both dev and build."* Fix:
there is no dev-only spelling of this option; accept the production effect deliberately, and
prefer fixing the package (ship compiled output) when the entry is large.

**★ Symptom: two instances of a singleton — a context provider, a store, a `Symbol.for` registry — appear inside one SSR render.**
Cause (⚠️ **inferred from the documented mechanism, not stated in the docs**): the same
package is reached by two paths, one externalised and loaded by Node, one bundled by Vite.
Each path produces a separate module instance. Fix: make the policy uniform for that package
and for anything that re-exports it.
```js
export default defineConfig({
  ssr: { noExternal: ['@acme/state', '@acme/ui'] }, // both, not one
})
```

---

## Interview questions

**★ Why does Vite externalise SSR dependencies by default, when it processes every dependency for the client?**
Because the two runtimes have different capabilities. A browser cannot resolve a bare
specifier out of `node_modules`, so the client build has no choice but to process everything.
Node resolves bare specifiers natively and reads the package's own compiled output, so
processing it again is pure cost. The docs give the motive in one sentence — *"This speeds up both dev and build"* — and the corollary is the whole topic: the default is a bet that the
package is loadable as published, and `noExternal` is how you say the bet is wrong.

**★ Why are linked dependencies the exception?**
Because a linked package is source you are actively editing, and the reason to link it is to
see changes immediately. Externalising it would hand it to Node, outside Vite's module graph,
where no HMR or invalidation applies — the docs say the exception exists *"to take advantage of Vite's HMR."* The price is that linked and installed copies of the same package take
different code paths, which is why a local-only pass is not evidence that CI will pass.

**★ A package is listed in both `ssr.external` and `ssr.noExternal`. What happens, and why is the rule shaped that way?**
The `string[]` entry in `external` wins and the package is externalised, *"if they're also listed in `ssr.noExternal` (using any type)"*. The design reads as specific-beats-general: a
name is an explicit statement about one package, while `noExternal` is often a broad rule — a
regex or `true`. Letting the broad rule override the specific one would make an escape hatch
impossible. The one inversion to remember is `true` against `true`, where `noExternal` wins.

**★ Why does `ssr.noExternal: true` throw on Node built-ins instead of leaving them external?**
Because the setting's documented purpose in that context is producing a single-file bundle
for runtimes *"like `webworker`"*, where `node:fs` does not exist. Leaving it external would
produce a bundle that builds cleanly and dies on first request in the deployed runtime.
Throwing converts a production incident into a build failure. Under `ssr.target: 'node'` the
opposite is correct, and the docs say built-ins remain externalised there.

**★ Why does `resolve.alias` silently stop applying to an externalised dependency?**
Because `resolve.alias` is a rule inside Vite's resolver, and an externalised import never
reaches Vite's resolver — Node performs the resolution. The docs' remedy is to move the
aliasing somewhere Node can see it: a package-manager alias via the `npm:` prefix, so the name
resolves on disk to the substituted package. The general lesson is that any Vite-level
resolution feature — aliases, `resolve.conditions`, plugins with `resolveId` — is inert for
externalised code, which is also why [chunk 1e](01e-ssr-target-and-resolve-conditions.md) has
a *separate* option for conditions used on external imports.

**★ How would you decide, for a given package, whether to externalise or bundle?**
Ask what it ships and what it needs. Bundle it when it ships untranspiled source, imports CSS
or assets, relies on Vite features, must be transformed by a plugin, or must be a single
instance shared with bundled code. Externalise it when it ships compiled output, is large,
has native bindings, or must resolve differently at runtime than at build time. The default
already answers "externalise" for you, so in practice the list you maintain is `noExternal`,
and every entry on it should have a reason you could state in one sentence.

---

← [Fetchable & Custom Environments](01ca-fetchable-and-custom-environments.md) · [Vite overview](../../README.md) · Next → [`ssr.target` & Conditions](01e-ssr-target-and-resolve-conditions.md)
