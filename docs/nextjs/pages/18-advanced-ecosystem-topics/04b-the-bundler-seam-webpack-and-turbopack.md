---
title: "A webpack() function in next.config.js is not recognised under Turbopack, and Turbopack has been the default bundler since 16.0 — so the most common way to extend a Next.js build silently stopped applying"
sidebar_label: "04b · The bundler seam"
sidebar_position: 15
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [Turbopack](https://nextjs.org/docs/app/api-reference/turbopack), [`turbopack` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack), [Custom Webpack Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack), [How to use markdown and MDX](https://nextjs.org/docs/app/guides/mdx). All four pages carry `version: 16.3.4` in their own metadata. Node `>= 20.9`. Quoted, not run — **no sandbox run**.

**This is the chunk that costs people a day. The `webpack(config, options)` hook is still documented, still supported, and still the answer on every blog post from 2023 — and in a default Next.js 16 project it never executes, because the default bundler is Turbopack and Turbopack does not read it. There is no error. The build succeeds, your loader is not applied, your alias is not resolved, your `DefinePlugin` value is `undefined` at runtime, and the failure surfaces as a broken import or a missing environment value somewhere far from the config file. Extending the build in 16.3.4 means choosing a bundler on purpose and writing the seam that bundler actually reads.**

## Turbopack is the default, and that is a version fact, not a preference

> *"Turbopack is now the **default bundler** in Next.js. No configuration is needed to use Turbopack"*
> — [Turbopack](https://nextjs.org/docs/app/api-reference/turbopack)

The page's own version table dates the change precisely:

> *"`v16.0.0` | Turbopack becomes the default bundler for Next.js. Automatic support for Babel when a configuration file is found."*

with `v15.5.0` build beta, `v15.3.0` experimental build, and `v15.0.0` dev stable before it. Opting back out is a CLI flag, not a config key:

```json
{
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack",
    "start": "next start"
  }
}
```

> *"If you need to use Webpack instead of Turbopack, you can opt-in with the `--webpack` flag"*

⚠️ **Note what that means for a shared repo:** the bundler is selected per invocation. One engineer's `yarn dev` and CI's `next build` can be running different bundlers — and therefore reading different halves of your config — if the scripts disagree. Put the flag in `package.json`, never in a personal shell alias.

## 🔴 The silent failure, stated verbatim

> *"**`webpack()` configuration** in `next.config.js` — Turbopack replaces webpack, so `webpack()` configs are not recognized. Use the `turbopack` config instead."*
> — [Turbopack · Unsupported and unplanned features](https://nextjs.org/docs/app/api-reference/turbopack)

*Not recognized* is doing the work in that sentence. The key is not rejected and does not warn; it is simply a property on an object that the Turbopack code path never reads. Every consequence follows from that:

- A config wrapper whose entire effect is a `webpack` function becomes a no-op the moment someone drops `--webpack`.
- A `DefinePlugin` that injected `process.env.BUILD_SHA` stops injecting it, so the value is `undefined` and your error reporter tags every event with `undefined` instead of a commit.
- An alias that pointed `@sprintdesk/config` at a per-environment file stops resolving, and either the import fails or — worse — resolves to a real package with the same name.

**The tell to look for when a build "changed behaviour after an upgrade":** does `next.config.js` contain a `webpack` function, and does the build command lack `--webpack`? That combination is a no-op, and it is a very common shape for a repo that upgraded 15 → 16 without reading the release notes.

And one warning that applies regardless of bundler:

> *"**Good to know**: changes to webpack config are not covered by semver so proceed at your own risk"*
> — [Custom Webpack Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack)

That sentence is the closest thing Next.js has to a stability policy on build extension: even the documented webpack seam is explicitly *outside* the version guarantee.

## The webpack seam, for the builds that still use it

```js
// next.config.js — signature verbatim from the reference
module.exports = {
  webpack: (
    config,
    { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }
  ) => {
    // Important: return the modified config
    return config
  },
}
```

Three facts about that function change how you write it:

> *"The `webpack` function is executed three times, twice for the server (nodejs / edge runtime) and once for the client. This allows you to distinguish between client and server configuration using the `isServer` property."*

> *"`nextRuntime`: `String | undefined` - The target runtime for server-side compilation; either `"edge"` or `"nodejs"`, it's `undefined` for client-side compilation."*

> *"Notice that `isServer` is `true` when `nextRuntime` is `"edge"` or `"nodejs"`, `nextRuntime` `"edge"` is currently for proxy and Server Components in edge runtime only."*

So any side effect inside the function happens **three times per build**, and any plugin you push unconditionally is instantiated three times — once into a bundle where it may be actively wrong. A bundle analyzer or a source-map uploader that does not gate on `isServer` will produce three reports or three uploads.

```js
// next.config.js
const path = require('path')

module.exports = {
  webpack: (config, { isServer, nextRuntime, buildId, webpack }) => {
    // Client-only: inline the build id so the browser bundle can report it.
    if (!isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.NEXT_PUBLIC_BUILD_ID': JSON.stringify(buildId),
        })
      )
    }

    // Node server only — never the edge compilation, which has no fs.
    if (isServer && nextRuntime === 'nodejs') {
      config.resolve.alias['@sprintdesk/secrets'] = path.join(
        __dirname,
        'src/server/secrets.node.ts'
      )
    }

    // Important: return the modified config
    return config
  },
}
```

`defaultLoaders.babel` is exposed precisely so a custom rule can sit *in front of* the framework's own transform rather than replacing it — the reference's own example is lifted from the `@next/mdx` source:

```js
// Example config for adding a loader that depends on babel-loader
// This source was taken from the @next/mdx plugin source:
// https://github.com/vercel/next.js/tree/canary/packages/next-mdx
module.exports = {
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.mdx/,
      use: [
        options.defaultLoaders.babel,
        {
          loader: '@mdx-js/loader',
          options: pluginOptions.options,
        },
      ],
    })

    return config
  },
}
```

## The Turbopack seam — loaders yes, plugins no

The `turbopack` key (renamed from `experimental.turbo` in 15.3.0, with the old key still working as an alias) exposes five options: `root`, `rules`, `resolveAlias`, `resolveExtensions`, `debugIds`. `rules` is *"List of supported webpack loaders to apply when running with Turbopack"* — the same `@svgr/webpack` job, expressed as data instead of as a callback:

```js
// next.config.js
module.exports = {
  turbopack: {
    rules: {
      '*.svg': {
        loaders: [{ loader: '@svgr/webpack', options: { icon: true } }],
        as: '*.js',
      },
    },
    resolveAlias: {
      underscore: 'lodash',
      mocha: { browser: 'mocha/browser-entry.js' },
    },
    resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
}
```

⚠️ `resolveExtensions` *"overwrites the original resolve extensions with the provided list. Make sure to include the default extensions."* Omitting `.ts` there breaks the whole app, not just your addition.

Conditions replace the `isServer` branching you would have written in a `webpack()` callback, and they are richer:

```js
// next.config.js — restrict a loader by target, path and file content
module.exports = {
  turbopack: {
    rules: {
      '*': {
        condition: {
          all: [
            { not: 'foreign' },
            { path: /^img\/[0-9]{3}\// },
            { any: [{ path: '*.svg' }, { content: /\<svg\W/ }] },
          ],
        },
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
}
```

The built-in conditions are `browser`, `foreign` (*"Matches code in `node_modules`, as well as some Next.js internals. Usually you'll want to restrict loaders to `{not: 'foreign'}`"*), `development`, `production`, `node`, and `edge-light` (deprecated).

### The three limits that decide whether your loader can port

> *"Only a core subset of the webpack loader API is implemented. Currently, there is enough coverage for some popular loaders, and we'll expand our API support in the future."*

> *"Only loaders that return JavaScript code are supported. Loaders that transform files like stylesheets or images are not currently supported."*

> *"Options passed to webpack loaders must be plain JavaScript primitives, objects, and arrays. For example, it's not possible to pass `require()` plugin modules as option values."*

That third one is the quiet killer for plugin authors. Anything whose configuration is *a function or a module instance* cannot cross the Rust boundary. The `@next/mdx` documentation shows the workaround the ecosystem converged on — pass plugin **names as strings** and let the loader resolve them:

```js
// next.config.mjs — the Turbopack-compatible form
import createMDX from '@next/mdx'

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      // Without options
      'remark-gfm',
      // With options
      ['remark-toc', { heading: 'The Table' }],
    ],
    rehypePlugins: ['rehype-slug', ['rehype-katex', { strict: true, throwOnError: true }]],
  },
})

export default withMDX({ pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'] })
```

> *"remark and rehype plugins without serializable options cannot be used yet with Turbopack, because JavaScript functions can't be passed to Rust."*

The loader-context features that are missing, verbatim from the reference: `importModule` and `loadModule` (no support), `fs` (*"Partial support: only `fs.readFile` is currently implemented"*), `emitFile` (no support), `version`, `mode`, `target`, `utils`, and `resolve` (*"No support (use `getResolve` instead)"*).

### 🔴 Webpack plugins have no equivalent at all

> *"Turbopack does not support webpack plugins. This affects third-party tools that rely on webpack's plugin system for integration. We do support webpack loaders. If you depend on webpack plugins, you'll need to find Turbopack-compatible alternatives or continue using webpack until equivalent functionality is available."*

A loader transforms one module's source; a plugin observes the whole compilation. Everything in the second category — Sentry source-map upload wired as a plugin, `DefinePlugin`, `CopyWebpackPlugin`, custom chunk naming, bundle-stats emitters — has **no Turbopack equivalent**. Your three honest options are: find a Turbopack-native integration, move the work out of the bundler entirely (a `postbuild` npm script that reads `.next/`, or an adapter's `onBuildComplete`), or stay on `--webpack` and accept that you are on the non-default path.

Also unsupported or unplanned, and worth checking your config against before you migrate: `sassOptions.functions` (*"Turbopack's Rust-based architecture cannot directly execute JavaScript functions"*), Yarn PnP (*"Not planned"*), `experimental.urlImports`, `experimental.esmExternals`, and — planned but absent — `experimental.nextScriptWorkers` and `experimental.fallbackNodePolyfills`.

## Gotchas

**★ Symptom: after upgrading to 16, a build-time customisation silently stopped applying — no error, no warning.** Cause: it was a `webpack()` function, and Turbopack became the default bundler in 16.0; `webpack()` configs *"are not recognized"*. Fix: express the same thing under `turbopack`, or pin the bundler explicitly in `package.json`:

```json
{ "scripts": { "dev": "next dev --webpack", "build": "next build --webpack" } }
```

**★ Symptom: a webpack plugin you depend on has no `turbopack` equivalent and the docs offer none.** Cause: Turbopack supports loaders, not plugins — a plugin observes the whole compilation, which has no exposed hook. Fix: move whole-build work out of the bundler. A post-build script reading the finished output is bundler-agnostic and cannot be broken by a bundler swap:

```json
{
  "scripts": {
    "build": "next build && node scripts/upload-sourcemaps.mjs"
  }
}
```

**★ Symptom: a Turbopack loader rule throws or is ignored when you pass it a plugin instance.** Cause: *"Options passed to webpack loaders must be plain JavaScript primitives, objects, and arrays"* — a `require()`d module cannot cross into Rust. Fix: pass the plugin **name** and let the loader resolve it, the way `@next/mdx` does:

```js
// ❌ import remarkGfm from 'remark-gfm'; remarkPlugins: [remarkGfm]
// ✅ serializable
const withMDX = createMDX({ options: { remarkPlugins: [['remark-toc', { heading: 'The Table' }]] } })
```

**★ Symptom: your source-map upload or bundle report runs three times per build.** Cause: *"The `webpack` function is executed three times, twice for the server (nodejs / edge runtime) and once for the client."* Fix: gate on `isServer` / `nextRuntime` so the side effect happens exactly once:

```js
webpack: (config, { isServer, nextRuntime }) => {
  if (isServer && nextRuntime === 'nodejs') {
    config.plugins.push(new SprintdeskStatsPlugin())
  }
  return config
}
```

**Symptom: `import` of a linked package outside the repo fails to resolve under Turbopack but worked under webpack.** Cause: *"Turbopack uses the root directory to resolve modules. Files outside of the project root are not resolved."* The root is inferred from a lockfile — `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `bun.lockb`. Fix: widen it deliberately:

```js
const path = require('path')
module.exports = { turbopack: { root: path.join(__dirname, '..') } }
```

**Symptom: `composes` or `@import` in a CSS Module behaves differently after switching bundlers.** Cause: documented behaviour difference — with Turbopack *"the `.css` file will always be global"*, where webpack treated it as a CSS Module. Fix: rename the imported file to `.module.css`, which the reference names as the required change.

**Symptom: computed CSS values differ in the fifth decimal place between the two bundlers.** Cause: Lightning CSS uses 5 digits of decimal precision, webpack's pipeline 10 — the reference gives `line-height: 1.4705882353` versus `line-height: 1.47059` for the same expression. Fix: nothing to fix in the bundler; if a layout depends on that precision, set the value explicitly rather than deriving it.

## Interview questions

**★ A team upgrades from Next.js 15 to 16 and their SVG imports stop rendering as components. Nothing errors. Why?**
Their SVG handling was an `@svgr/webpack` rule inside `webpack(config, options)`. Turbopack became the default bundler in 16.0 and does not read `webpack()` configs — the key is not recognised, so the rule never applies and `.svg` imports fall back to the built-in asset handling. The fix is either a `turbopack.rules` entry mapping `'*.svg'` to `@svgr/webpack` with `as: '*.js'`, or adding `--webpack` to the build scripts. The reason it is confusing is that nothing failed: the build is green and the output is simply different.

**★ What can a webpack plugin do that a Turbopack loader cannot, and how do you replace it?**
A loader is scoped to one module's source and returns code; a plugin taps the compilation lifecycle and can see the whole graph, emit extra assets, rewrite chunk naming, or run at seal time. Turbopack implements loaders and explicitly does not support plugins. Replacements, in order of preference: a Turbopack-native integration if the vendor ships one; a post-build Node script that reads `.next/` (works under either bundler); an adapter's `onBuildComplete`, which is the typed, supported version of "read the finished build"; or staying on `--webpack`.

**★ Why is `isServer` not enough to decide what a webpack customisation should do?**
Because the function runs three times, and two of those are server compilations with different runtimes. `isServer` is `true` for both the Node.js and the edge compilation; `nextRuntime` distinguishes them, and is `undefined` on the client. A Node-only alias — anything touching `fs`, native modules, or secrets loaded from disk — must be gated on `nextRuntime === 'nodejs'`, not merely on `isServer`, or it lands in the edge bundle where it cannot work.

**Why would a team deliberately stay on `--webpack` in 2026?**
Three documented reasons, all of which are statements about missing Turbopack features rather than preferences: they depend on a webpack **plugin** with no alternative; they use `sassOptions.functions`, which cannot work because Turbopack cannot execute JavaScript functions from Rust; or they build on a platform without native bindings — FreeBSD, OpenBSD — where the WASM fallback supports SWC but not Turbopack. Yarn PnP is a fourth, and it is marked *"Not planned"*.

**What is the stability guarantee on the `webpack()` seam?**
There isn't one: *"changes to webpack config are not covered by semver so proceed at your own risk."* That is stated on the reference page for the feature itself. It is a useful calibration for the whole topic — even the most documented build-extension point in Next.js is explicitly outside the version contract, which is why a build customisation should be as small and as declarative as you can make it.

---

← [04 · Framework extension](04-framework-extension-and-plugin-development.md) · [Chapter index](01-explanation.md) · Next → [The seams that are files](04c-the-seams-that-are-files.md)
