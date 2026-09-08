---
title: "Externalisation moves a resolution decision out of Vite's hands entirely and into whatever runtime actually executes the import, which is why the same option means different things in a client build, an SSR build and library mode"
sidebar_label: "01k · Externalisation & the two builds"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [SSR Options — `ssr.external`, `ssr.noExternal`](https://vite.dev/config/ssr-options), [Shared Options — `resolve.alias`, `resolve.dedupe`](https://vite.dev/config/shared-options), [Build Options — `build.lib`, `build.rolldownOptions`](https://vite.dev/config/build-options), [Migration from v7 — Require Calls For Externalized Modules](https://vite.dev/guide/migration#require-calls-for-externalized-modules). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Externalisation: What Stays Out of the Bundle, and Why That Changes Resolution

**"External" means one thing everywhere it appears: Vite stops resolving the import itself
and leaves the specifier for something else to resolve at runtime. What that "something
else" is — the browser's own module loader, Node's `require`, or a consumer's own bundler —
changes completely between a client build, an SSR build, and library mode, and each one has
its own default and its own option name. Getting this wrong looks identical in every case:
an import that resolved fine in dev throws at runtime because the file it needs was never
put in the output.**

## The client production build: bundle everything by default, external is opt-in

For a normal app build (not library mode), Vite bundles `node_modules` into the output the
same way it pre-bundles for dev — there is no default externalisation concept on the client
side at all. Anything left external is something *you* named, via the underlying bundler's
own option, now under the v8 name:

```js
// vite.config.js — deliberately keeping a CDN-hosted dependency out of the bundle
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rolldownOptions: {
      external: ['react', 'react-dom'],
    },
  },
})
```

> *"Directly customize the underlying Rolldown bundle. This is the same as options that can
> be exported from a Rolldown config file and will be merged with Vite's internal Rolldown
> options."*

`build.rollupOptions` still works as a deprecated alias of `build.rolldownOptions` — both
names, and the full v7→v8 rename story for the rest of the build/optimizer options, are
covered in
[../11-optimization-and-performance/01a-dependency-pre-bundling.md](../11-optimization-and-performance/01a-dependency-pre-bundling.md). Once a
specifier is external here, the browser is expected to resolve it itself — via an import map,
a global, or a `<script type="module" src="...">` the app supplies separately. Nothing about
`resolve.conditions` or `resolve.mainFields` applies to it anymore; Vite never looks inside
it at all.

## Library mode: the opposite default, for the opposite reason

`build.lib` exists to produce a package for *other* projects to consume, and a library that
bundled its own dependencies would duplicate every consumer's copy of React, lodash, and
so on. Library mode's own defaults lean toward marking dependencies external rather than
bundling them — the exact default set and how to override it is `build.rolldownOptions.external`
again, but the *reason* for reaching for it is inverted from the CDN case above: here it is
about not shipping duplicate copies of a consumer's own dependencies, not about relying on a
runtime module loader.

## SSR: external by default, and the default has a name

SSR is the one build type where Vite has an explicit, named, on-by-default externalisation
policy — because the SSR output runs inside Node, where `require`-ing a dependency from
`node_modules` at runtime is free, and re-bundling it into the SSR output would only cost
build time and duplicate work Node already does for you:

> *"Externalize the given dependencies and their transitive dependencies for SSR. By
> default, all dependencies are externalized except for linked dependencies (for HMR). If
> you prefer to externalize the linked dependency, you can pass its name to this option."*
> — `ssr.external`

> *"Prevent listed dependencies from being externalized for SSR, which they will get
> bundled in build. By default, only linked dependencies are not externalized (for HMR). If
> you prefer to externalize the linked dependency, you can pass its name to the
> `ssr.external` option."* — `ssr.noExternal`

Both accept `true` to flip the default for every dependency, with one binding rule when both
are set:

> *"Note that if both `ssr.noExternal: true` and `ssr.external: true` are configured,
> `ssr.noExternal` takes priority and no dependencies are externalized."*

And Node built-ins get special-cased even when you have opted everything else in:

> *"If `ssr.target: 'node'` is set, Node.js built-ins will also be externalized by default"*
> — even under `ssr.noExternal: true`.

```js
// vite.config.js — an SSR app bundling most things, but keeping a native-addon dependency
// (and Node itself) external, since neither can be usefully bundled
import { defineConfig } from 'vite'

export default defineConfig({
  ssr: {
    noExternal: true,             // bundle everything into the SSR output by default...
    external: ['sharp'],          // ...except this native-addon package, which must stay
                                   // a real require() so Node can load its compiled binary
  },
})
```

The full resolution-condition consequences of the externalised/bundled split on SSR — which
of the four `ssr.resolve.*` options applies to which side of that line — are worked through
completely in
[../10-ssr-support/01e-ssr-target-and-resolve-conditions.md](../10-ssr-support/01e-ssr-target-and-resolve-conditions.md); this page only needs the
externalisation decision itself, not the condition mechanics that follow from it.

## `resolve.alias` and SSR-externalised dependencies point at different things

An alias set for a package that ends up externalised for SSR does not get the treatment a
bundled import gets — the docs flag this explicitly as its own warning:

> *"If you have configured aliases for SSR externalized dependencies, you may want to alias
> the actual `node_modules` packages. Both Yarn and pnpm support aliasing via the `npm:`
> prefix."*

```js
// vite.config.js — aliasing a package name to a pinned version, for a dependency that
// will be externalized under SSR and therefore resolved by Node's own require(), not Vite
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      // 'npm:' form so the ACTUAL node_modules entry changes — a path-based alias here
      // would only redirect Vite's own resolution, which SSR-externalised code bypasses.
      'date-utils': 'npm:date-utils@2.1.0',
    },
  },
})
```

A path-based alias (`{ 'date-utils': './src/shims/date-utils.ts' }`) works fine for a
dependency Vite bundles itself, but is invisible to Node's own `require` once that
dependency is externalised — Node resolves the real package from `node_modules`, unaware
Vite's config ever mentioned it.

## `dedupe` stops working for one specific SSR output shape

[01d](01d-resolve-dedupe.md) covers the option in general; the
one SSR-specific caveat belongs here, next to the rest of the externalisation story:

> *"For SSR builds, deduplication does not work for ESM build outputs configured from
> `build.rolldownOptions.output`. A workaround is to use CJS build outputs until ESM has
> better plugin support for module loading."*

This is a narrow but sharp trap: a project that switches its SSR build to an ESM output
format for other reasons (top-level `await`, cleaner interop) can silently lose `dedupe`'s
protection against the "two copies of React" class of bug on exactly the build type where it
was added to fix that problem.

## `require()` for an externalised module stays a `require()` call in Vite 8

Before v8, Vite would sometimes rewrite a `require()` call targeting an externalised module
into an `import` statement in the output. That rewrite is gone:

> *"`require` calls for externalized modules are now preserved as `require` calls and not
> converted to `import` statements. This is to preserve the semantics of `require` calls. If
> you want to convert them to `import` statements, you can use Rolldown's built-in
> `esmExternalRequirePlugin`, which is re-exported from `vite`."*

```js
// vite.config.js — opting back into the old rewrite behaviour where needed
import { defineConfig, esmExternalRequirePlugin } from 'vite'

export default defineConfig({
  plugins: [
    esmExternalRequirePlugin({
      external: ['react', 'vue', /^node:/],
    }),
  ],
})
```

The practical effect without that plugin: code that does `const pkg = require('some-external-pkg')` inside an otherwise-ESM output keeps behaving like `require` —
synchronous, CJS interop semantics intact — rather than being silently turned into an
`import` with its different timing and different default-export shape. This mainly matters
for hand-written interop shims or older transpiled output that still contains literal
`require()` calls the bundler used to "fix" on your behalf.

## Gotchas

**★ Symptom: a dependency resolves fine in `vite build` for the client, but the same import throws `Cannot find module` in the SSR build's Node process.** Cause: the client build
bundled the dependency (client builds have no default externalisation), while SSR
externalised it by default — and the SSR output's `node_modules` (the actual deployed
`node_modules`, not the one present during the build) does not actually contain the
package, commonly because it was a `devDependency` or got pruned in a production install.
Fix: either move the package to real `dependencies` so it ships with the deployed
`node_modules`, or force it to be bundled instead with `ssr.noExternal`.
```js
export default defineConfig({ ssr: { noExternal: ['some-package'] } })
```

**★ Symptom: `resolve.alias` for a package works in the client build and does nothing under SSR.** Cause: the package is externalised for SSR, so Node's own `require`/`import`
resolves it directly from `node_modules` — Vite's alias table was never consulted for that
specifier on that build. Fix: alias the real `node_modules` entry with the package manager's
`npm:` prefix rather than a filesystem path, per the documented SSR warning.

**★ Symptom: `resolve.dedupe` is configured, and two copies of React still turn up in an SSR build's output, though the client build is fine.** Cause: the SSR build's output format
was switched to ESM via `build.rolldownOptions.output`, and deduplication is documented to
not work for that specific output shape. Fix: switch the SSR output back to CJS until the
docs' own caveat is resolved upstream, or accept manual dependency alignment instead of
relying on `dedupe` for that build.

**★ Symptom: after upgrading to Vite 8, a hand-written interop shim using `require()` inside otherwise-ESM code starts behaving differently.** Cause: v8 stopped rewriting
`require()` calls targeting externalised modules into `import` statements — the shim's
`require()` now runs as a literal, synchronous `require`, which is a behaviour change if the
old rewrite's `import` semantics (different timing, different default-export unwrapping) were
being relied on, even accidentally. Fix: use `esmExternalRequirePlugin` to restore the old
conversion for the specific specifiers that need it, rather than rewriting every call site by
hand.

**★ Symptom: `ssr.noExternal: true` is set to force everything into the SSR bundle, and a native-addon dependency still fails to load.** Cause: under `ssr.target: 'node'`, Node
built-ins stay externalised even when `noExternal: true` is set, but native-addon packages
(compiled `.node` binaries) are not built-ins — they need their own explicit `ssr.external`
entry, since a bundler cannot meaningfully inline a compiled binary the way it inlines JS.
Fix: list the native-addon package explicitly in `ssr.external`, which — per the documented
precedence — wins even under a blanket `noExternal: true`.
```js
export default defineConfig({ ssr: { noExternal: true, external: ['sharp'] } })
```

## Interview questions

**★ Why does the client build have no equivalent to `ssr.external`/`ssr.noExternal`?**
Because the browser has no built-in way to resolve a bare specifier like `require` or a
Node-style `node_modules` lookup does — an "externalised" dependency on the client has to be
supplied some other way, via an import map or a global the app wires up itself, which is
opt-in and unusual rather than a sensible default. SSR's default externalisation makes sense
specifically because the SSR output runs in Node, where a `require()` against `node_modules`
at runtime is free and simply re-uses Node's own module cache; there is no equivalent free
resolution mechanism available to ship into a browser bundle, so bundling is the client
default and staying external is the exception, configured per-dependency through the
underlying bundler's own `external` option rather than a Vite-specific SSR-style toggle.

**★ A package resolves correctly in dev and in the client build, but the SSR build throws `Cannot find module` for it in production. What's the first thing to check?**
Whether it is a real `dependency` or only a `devDependency`. SSR externalises most packages
by default, which means the *deployed* `node_modules` — not the one present at build time —
has to actually contain it, because Node resolves it at runtime via a genuine `require`/
`import`, not something Vite baked into the output. A package installed only as a
`devDependency` is commonly present during `vite build` (which runs in the full dev
environment) but absent after a production install that only installs `dependencies`. This
is a very different failure than a resolution *condition* mismatch, and checking `package.json`'s dependency section first avoids chasing `ssr.resolve.conditions`/`externalConditions` for a problem that is really about what got installed, not how it resolves.

**★ Why did Vite 8 stop converting `require()` calls into `import` statements for externalised modules, and what is the escape hatch?**
Because the conversion silently changed semantics — `require()` is synchronous and returns
`module.exports` as-is; an `import` the bundler substituted for it has different timing
(hoisted, asynchronous module graph resolution) and, per the v8 default-import interop
change, a different unwrapping rule for what counts as the "default" export of a CJS module.
Preserving `require()` calls as written keeps that code doing exactly what it says, at the
cost of losing an automatic modernisation some projects relied on. `esmExternalRequirePlugin`,
re-exported from `vite` itself, restores the old rewrite behaviour for specifiers you name
explicitly, rather than applying it blanket the way the removed default behaviour did.

---

← [01j · Node built-ins in the browser](01j-node-builtins-in-browser-code.md) · [Vite overview](../../README.md) · Next → [01l · CJS/ESM interop & dual packages](01l-cjs-esm-interop-and-dual-packages.md)
