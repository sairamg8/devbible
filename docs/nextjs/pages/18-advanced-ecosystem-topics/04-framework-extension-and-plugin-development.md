---
title: "Next.js has no plugin API — it has a config object, a function that returns it, and a short list of documented seams; everything people call a 'Next.js plugin' is a function from NextConfig to NextConfig"
sidebar_label: "04 · Framework extension"
sidebar_position: 14
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [Custom Webpack Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack), [Turbopack](https://nextjs.org/docs/app/api-reference/turbopack), [`turbopack` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack), [`instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation), [`transpilePackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages), [How to use markdown and MDX](https://nextjs.org/docs/app/guides/mdx). Every one of those pages carries `version: 16.3.4` in its own metadata. React 19.2.8 · Node `>= 20.9`. Quoted, not run — **no sandbox run**; `next` is **not installed in this checkout**, so nothing here is a probe of the Next.js package.

**Do not study this topic upfront. Read it the day someone on your team says "we should write a Next.js plugin" — because the first useful thing you can tell them is that there is nothing to register it with.** Vite has `plugins: [...]`, Rollup has a hook-per-phase object, Babel has visitors, ESLint has rules. Next.js has none of that. It has a plain configuration object, a set of file conventions the framework looks for by name, two bundler-specific escape hatches, and — since 16.2 — exactly one real, versioned extension API, which is for *deployment platforms*, not for you. Everything else the ecosystem calls a "Next.js plugin" is an npm package exporting a function that takes your config object and returns a modified one. Understanding that is the difference between an extension that survives `next upgrade` and one that a patch release deletes.

## What the documentation calls a "plugin"

The webpack configuration page is the only reference page in the extension surface that uses the word at all, and it uses it for exactly two packages:

> *"Some commonly asked for features are available as plugins:"*
> — [Custom Webpack Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack), listing `@next/mdx` and `@next/bundle-analyzer`

Both are npm packages. Neither registers anything. `@next/mdx` exports a factory that returns a config transformer, and the documented way to "install" it is to call it on your config and export the result:

```js
// next.config.mjs — verbatim shape from the MDX guide
import createMDX from '@next/mdx'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure `pageExtensions` to include markdown and MDX files
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  // Optionally, add any other Next.js config below
}

const withMDX = createMDX({
  // Add markdown plugins here, as desired
})

// Merge MDX config with Next.js config
export default withMDX(nextConfig)
```

That is the entire plugin model. A plugin is a function `(config: NextConfig) => NextConfig`, called once, at config load, by you. There is no registry, no manifest key, no `plugins` array, and no lifecycle the framework drives on your behalf.

⚠️ **I did not fetch the `next.config.js` index page in this pass.** So the accurate statement is: *no plugin registration API appears in any of the six configuration and file-convention reference pages checked*. If one exists somewhere else in the reference, I did not find it — but the shape of `@next/mdx`, which is a first-party Vercel package, is strong evidence that config composition **is** the intended mechanism.

## Why the `withX` convention exists, and what it costs you

Because a plugin is just a function, "installing" two of them is function composition, and composition has an order:

```js
// next.config.mjs
import createMDX from '@next/mdx'

/** @type {import('next').NextConfig} */
const baseConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  reactStrictMode: true,
  transpilePackages: ['@sprintdesk/ui'],
}

const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: ['rehype-slug'],
  },
})

/**
 * Compose right-to-left, like a middleware stack: the LAST wrapper in the
 * array is the OUTERMOST call, so it sees the config every earlier wrapper
 * already produced.
 * @param {Array<(c: import('next').NextConfig) => import('next').NextConfig>} wrappers
 */
function composeConfig(wrappers, config) {
  return wrappers.reduce((acc, wrap) => wrap(acc), config)
}

export default composeConfig([withMDX], baseConfig)
```

Three consequences follow directly from "it is a function", and each of them is a real bug someone has shipped:

- **Wrappers can silently overwrite each other.** Two packages that both set `pageExtensions` do not merge; the outer one wins, or clobbers, depending on how carelessly it was written. Nothing warns you. The framework never sees the intermediate objects.
- **Order is your problem.** There is no `enforce: 'pre'`, no priority field, no dependency declaration between wrappers. If wrapper A needs to see wrapper B's `webpack` function, you must call B first, and nothing checks that you did.
- **A wrapper that chains `webpack` must call the previous one.** `config.webpack` is a single function slot, not a list. A wrapper that assigns `nextConfig.webpack = myFn` instead of calling the existing `nextConfig.webpack` first deletes every earlier customisation.

Here is the chaining a well-behaved wrapper has to do by hand, since the framework will not do it for you:

```js
// packages/next-plugin-sprintdesk/index.js
/**
 * A hand-written config wrapper that adds a webpack rule WITHOUT destroying
 * a `webpack` function some other wrapper already installed.
 * @param {{ verbose?: boolean }} pluginOptions
 */
function withSprintdesk(pluginOptions = {}) {
  return function apply(nextConfig = {}) {
    return Object.assign({}, nextConfig, {
      webpack(config, options) {
        config.module.rules.push({
          test: /\.graphql$/,
          use: [options.defaultLoaders.babel, { loader: 'graphql-tag/loader' }],
        })

        // 🔴 Chain, do not replace. Without this line every wrapper applied
        // before us loses its webpack customisation.
        if (typeof nextConfig.webpack === 'function') {
          return nextConfig.webpack(config, options)
        }
        return config
      },
    })
  }
}

module.exports = withSprintdesk
```

**That pattern — take options, return a function, merge onto a copy of the incoming config, chain any function-valued key — is the whole of "Next.js plugin development" as the ecosystem practises it.** It is not a framework feature. It is a convention, and it holds only as long as every package in your config obeys it.

## The complete list of seams in 16.3.4

Everything below is documented and named in the reference. If your extension does not go through one of these, it is going through an internal — see [04d · Coupling to internals](04d-internals-coupling-and-the-plugin-decision.md).

| Seam | Where it lives | Runs at | Covered here |
|---|---|---|---|
| Config wrapper (`withX`) | `next.config.mjs` | config load | this page |
| `webpack(config, options)` | `next.config.js` | build, **webpack only** | [04b](04b-the-bundler-seam-webpack-and-turbopack.md) |
| `turbopack.rules` / `resolveAlias` / `resolveExtensions` | `next.config.js` | build, **Turbopack only** | [04b](04b-the-bundler-seam-webpack-and-turbopack.md) |
| Babel config file detection | `.babelrc` / `babel.config.js` | build | [04c](04c-the-seams-that-are-files.md) |
| `instrumentation.ts` — `register`, `onRequestError` | project root or `src/` | server start, per error | [04c](04c-the-seams-that-are-files.md) |
| `proxy.ts` | project root | every matched request | [04c](04c-the-seams-that-are-files.md) |
| Route Handlers | `app/**/route.ts` | per request | [04c](04c-the-seams-that-are-files.md) |
| Root `layout.tsx` (App) · `_app` / `_document` (Pages) | `app/` or `pages/` | per render | [04c](04c-the-seams-that-are-files.md) |
| `transpilePackages` | `next.config.js` | build | [04d](04d-internals-coupling-and-the-plugin-decision.md) |
| **Adapters API** — `modifyConfig`, `onBuildComplete` | an adapter module | build | [ch17 · The Adapters API](../17-deployment-scaling-and-observability/10-the-adapters-api-why-it-exists-and-how-a-platform-wires-one-in.md) |
| Codemods (`@next/codemod`) | your source tree, once | authoring time | [04d](04d-internals-coupling-and-the-plugin-decision.md) |

**That table is short on purpose.** Compare it to Vite's plugin hook list and the difference in ambition is the point: Next.js exposes the places where extension is *safe*, and closes the rest so it can keep changing the compiler, the router and the renderer between minors.

## The one API that really is a plugin API — and it is not for you

Since 16.2 there is exactly one extension point in Next.js with a typed interface, documented hooks, and an explicit stability commitment: the **Adapters API**, whose two hooks are `modifyConfig` and `onBuildComplete`. It exists so that hosting platforms can stop reverse-engineering `.next/`.

It is worth knowing about for two reasons, even though you will almost certainly never write one:

1. **It is the shape a real Next.js plugin API takes** — a module the framework loads by path, exporting named lifecycle functions, receiving a typed context object. If you find yourself designing something like that for application concerns, you are designing the wrong thing.
2. **It is where a build-time integration belongs if it is genuinely about deployment output** — asset immutability, function packaging, routing manifests.

This corpus already covers it in depth and it is not re-derived here: start at [ch17 · The Adapters API — why it exists](../17-deployment-scaling-and-observability/10-the-adapters-api-why-it-exists-and-how-a-platform-wires-one-in.md) and [ch17 · `modifyConfig` and `onBuildComplete`](../17-deployment-scaling-and-observability/11-modifyconfig-and-onbuildcomplete-the-two-hooks-in-detail.md).

## Typed config is the cheapest correctness check available

Because a plugin is a function on a plain object, TypeScript is the only thing standing between you and a silently ignored key. Next.js ships the type; use it, and use `next.config.ts` when your wrappers are typed:

```ts
// next.config.ts
import type { NextConfig } from 'next'
import createMDX from '@next/mdx'

const baseConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  transpilePackages: ['@sprintdesk/ui'],
}

const withMDX = createMDX({
  options: { remarkPlugins: ['remark-gfm'] },
})

export default withMDX(baseConfig) satisfies NextConfig
```

An unknown key in a config object is not an error at runtime — it is ignored. `satisfies NextConfig` on the final composed object is the one place a typo in a wrapper's output can still be caught before the build.

⚠️ **The ESM constraint is real and documented.** If any wrapper you compose pulls in an ESM-only ecosystem — remark and rehype are the common case — the config file itself has to be ESM:

> *"Since the remark and rehype ecosystem is ESM only, you'll need to use `next.config.mjs` or `next.config.ts` as the configuration file."*
> — [How to use markdown and MDX in Next.js](https://nextjs.org/docs/app/guides/mdx)

## Gotchas

**★ Symptom: you add a second `withX` wrapper and the first one stops working.** Cause: both wrappers assign to the same key — `webpack`, `pageExtensions`, `redirects` — and the outer call overwrites the inner one's value, because composition is `Object.assign`, not a merge. Fix: chain function-valued keys explicitly and concatenate array-valued ones inside your own wrapper, as `withSprintdesk` above does for `webpack`. For arrays you own, spread the incoming value:

```js
return Object.assign({}, nextConfig, {
  pageExtensions: [...(nextConfig.pageExtensions ?? ['js', 'jsx', 'ts', 'tsx']), 'mdx'],
})
```

**★ Symptom: a config key you added does nothing, and nothing warns.** Cause: an unrecognised key in `NextConfig` is ignored — a wrapper that returns `{ turbopackRules: ... }` instead of `{ turbopack: { rules: ... } }` produces a perfectly valid object that means nothing. Fix: type the composed result, not just the base:

```ts
// ❌ types only the base; the wrapper's output is unchecked
const base: NextConfig = { reactStrictMode: true }
export default withMDX(base)

// ✅ types what actually reaches Next.js
export default withMDX(base) satisfies NextConfig
```

**★ Symptom: `require()` of your plugin from `next.config.mjs` throws.** Cause: an `.mjs` config is ESM; `require` is not defined there. Fix: publish your wrapper with a real `exports` map covering both, or just author the wrapper as ESM and import it:

```json
{
  "name": "@sprintdesk/next-plugin",
  "type": "module",
  "exports": { ".": { "import": "./index.js", "require": "./index.cjs" } }
}
```

**Symptom: the wrapper works locally and its options are ignored in CI.** Cause: the wrapper reads `process.env` at *module* scope, and the config file is evaluated in a process where that variable is not set the same way — CI builds and local dev do not share an environment. Fix: read the environment inside the returned function, where the value is at least evaluated at config-load time in the same process as the build, and fail loudly if it is required:

```js
function withTelemetry(pluginOptions = {}) {
  return function apply(nextConfig = {}) {
    const dsn = process.env.SPRINTDESK_TELEMETRY_DSN
    if (pluginOptions.required && !dsn) {
      throw new Error('withTelemetry: SPRINTDESK_TELEMETRY_DSN is required but unset')
    }
    return Object.assign({}, nextConfig, { env: { ...nextConfig.env, TELEMETRY_DSN: dsn ?? '' } })
  }
}
```

**Symptom: your "plugin" needs to run code at request time and you cannot find the hook.** Cause: you are looking in the wrong half of the framework. `next.config.js` is evaluated by the CLI; it cannot install request-time behaviour. Fix: the request-time seams are files, not config — `instrumentation.ts`, `proxy.ts`, Route Handlers. See [04c · The seams that are files](04c-the-seams-that-are-files.md).

**Symptom: the config file is executed more times than you expect, including under `next dev` and `next start`.** Cause: `next.config.js` is loaded by any CLI command that needs the configuration, not only by `next build`. A wrapper that does real work at module scope — writing files, calling an API, mutating a lockfile — does that work on every command. Fix: do work lazily inside the seam that actually runs during a build (`webpack()`, `turbopack.rules`, or an adapter's `onBuildComplete`), never at config-module scope.

## Interview questions

**★ Why does Next.js not have a `plugins: []` array like Vite?**
Because a plugin array is a commitment to a hook contract, and Next.js changes the parts a hook contract would expose — the compiler (SWC/Turbopack, now the default bundler as of 16.0), the router, and the server renderer — between minor versions. Exposing hooks over those internals would freeze them. What it exposes instead is a data structure (`NextConfig`), a set of file conventions it looks for by name, and one typed API aimed at the audience whose integration genuinely must be stable: hosting platforms, via the Adapters API. The trade-off is deliberate: less extensibility, far fewer upgrade breaks.

**★ What is a "Next.js plugin", mechanically?**
A function from `NextConfig` to `NextConfig`, usually produced by a factory that takes options — `createMDX(options)` returns `withMDX`, and you call `withMDX(nextConfig)` yourself and export the result. Nothing registers it, nothing calls it but you, and it runs once when the config file is evaluated. Everything else the package does happens because the config it returned contains a `webpack` function, a `turbopack.rules` entry, or a plain option the framework already understands.

**★ Two config wrappers both need to modify the webpack config. What has to be true for both to survive?**
Each wrapper must call the incoming `nextConfig.webpack` rather than replacing it — `config.webpack` is a single function slot, not a list. The idiomatic body pushes its own rule onto `config.module.rules`, then returns `nextConfig.webpack(config, options)` if that function exists, otherwise `config`. If either wrapper assigns without chaining, the other's rules disappear and there is no warning, because the framework only ever sees the final function.

**What is the practical downside of the composition model versus a plugin registry?**
No ordering guarantees, no conflict detection, and no introspection. A registry can say "these two plugins both claim the `.svg` extension"; function composition just runs them, and the last write wins. It also means the framework cannot tell you which plugin caused a build to change — there is no plugin identity in the resulting object at all. The upside is that there is nothing to learn and nothing to version: it is one object and a call.

**Where should a build-time integration live if it is really about deployment output?**
In an adapter, not a config wrapper. `modifyConfig` and `onBuildComplete` are the only build-time hooks in Next.js with a typed context and a documented stability commitment, and `onBuildComplete` is the one point where the whole build is describable as data. Writing that as a `webpack()` hack instead means reading `.next/` by hand — exactly the reverse-engineering the Adapters API was created to end.

**Is `next.config.ts` meaningfully safer than `next.config.js` for plugin authors?**
Yes, for one specific failure: unknown keys. Next.js ignores config keys it does not recognise, so a wrapper that returns a subtly misspelled option produces a build that silently does nothing different. Typing the *composed* result with `satisfies NextConfig` catches that; typing only the base object does not, because the wrapper's return value is where the mistake lives.

---

← [Supply-chain vigilance](03b-supply-chain-vigilance.md) · [Chapter index](01-explanation.md) · Next → [The bundler seam](04b-the-bundler-seam-webpack-and-turbopack.md)
