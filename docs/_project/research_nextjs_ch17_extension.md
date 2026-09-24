---
name: research-nextjs-ch17-extension
description: Banked primary-source research for Next.js devbible chapter 17 topic 04 (framework extension and plugin development) — the webpack() seam and its semver disclaimer, the turbopack config surface, Turbopack as the 16.0 default bundler and its unsupported-features list, instrumentation.ts register/onRequestError, transpilePackages, and the @next/mdx withX composition pattern. Fetched 2026-09-04; do not re-fetch for this topic.
metadata:
  type: reference
---

# Next.js chapter 17 · framework extension — banked research, 2026-09-04

**Version spine:** Next.js **16.3.4** · React 19.2.8 · Node `>= 20.9`.
Every doc page fetched below carried `version: 16.3.4` in its own metadata block, so the
quotes are the 16.3.4 documentation, not an older snapshot.

**T1 probes run in `/mnt/Storage/Backup/Knowledge/devbible` on 2026-09-04:**

- `node -p "require('next/package.json').version"` → `MODULE_NOT_FOUND`. **`next` is not
  installed in this checkout.** No probe of the Next.js package surface is possible here;
  everything about Next itself is T0/T2.
- `node -p "require('react/package.json').version"` → **19.2.8** (matches the pin).
- `node -p "Object.keys(require('react')).filter(k=>/taint/i.test(k)).length"` → **0**.
  Stable React 19.2.8 exports no `experimental_taint*`. Corroborates the banked
  canary rule in `research_nextjs_ch1_foundations.md`.

## Fetched, all resolved (5 fetches)

1. https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack — *Custom Webpack Config*, lastUpdated 2025-10-17
2. https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack — *turbopack*, lastUpdated 2026-08-25
3. https://nextjs.org/docs/app/api-reference/turbopack — *Turbopack*, lastUpdated 2026-08-03
4. https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation — *instrumentation.js*, lastUpdated 2026-06-09
5. https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages — *transpilePackages*, lastUpdated 2026-05-27

Plus https://nextjs.org/docs/app/guides/mdx (*How to use markdown and MDX in Next.js*,
lastUpdated 2026-08-25) for the `withX` composition pattern.

## The webpack seam

> *"**Good to know**: changes to webpack config are not covered by semver so proceed at your own risk"*

> *"Some commonly asked for features are available as plugins:"* — the list is exactly two,
> `@next/mdx` and `@next/bundle-analyzer`, both linked to `packages/` in the vercel/next.js repo.

Signature:

```js
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

> *"The `webpack` function is executed three times, twice for the server (nodejs / edge runtime)
> and once for the client. This allows you to distinguish between client and server configuration
> using the `isServer` property."*

> *"`nextRuntime`: `String | undefined` - The target runtime for server-side compilation; either
> `"edge"` or `"nodejs"`, it's `undefined` for client-side compilation."*

> *"Notice that `isServer` is `true` when `nextRuntime` is `"edge"` or `"nodejs"`, `nextRuntime`
> `"edge"` is currently for proxy and Server Components in edge runtime only."*
> — independent confirmation that **proxy** is the current name in 16.3.4.

`defaultLoaders.babel` — *"Default `babel-loader` configuration"* — is exposed so a custom rule
can chain onto it; the doc's own example is lifted from the `@next/mdx` source.

## Turbopack is the default bundler

> *"Turbopack is now the **default bundler** in Next.js. No configuration is needed to use Turbopack"*

> *"If you need to use Webpack instead of Turbopack, you can opt-in with the `--webpack` flag"* —
> `next dev --webpack`, `next build --webpack`.

Version table: *"`v16.0.0` | Turbopack becomes the default bundler for Next.js. Automatic support
for Babel when a configuration file is found."* · `v15.5.0` build beta · `v15.3.0` experimental
build · `v15.0.0` dev stable.

WASM platforms (FreeBSD, OpenBSD): *"WASM bindings support core SWC features like compilation and
minification, but **do not support Turbopack**. On these platforms, use the `--webpack` flag"*.

### The load-bearing unsupported entries

> *"**`webpack()` configuration** in `next.config.js` — Turbopack replaces webpack, so `webpack()`
> configs are not recognized. Use the `turbopack` config instead."*

> *"Turbopack does not support webpack plugins. This affects third-party tools that rely on
> webpack's plugin system for integration. We do support webpack loaders. If you depend on webpack
> plugins, you'll need to find Turbopack-compatible alternatives or continue using webpack until
> equivalent functionality is available."*

Also unsupported/unplanned: `sassOptions.functions` (*"Turbopack's Rust-based architecture cannot
directly execute JavaScript functions"*), Yarn PnP (*"Not planned"*), `experimental.urlImports`,
`experimental.esmExternals`, `experimental.nextScriptWorkers`,
`experimental.fallbackNodePolyfills` (*"We plan to implement these in the future"*), automatic root
layout creation (*"Turbopack will instruct you to create it manually"*).

### Babel vs SWC — the 16.0 change

> *"**Babel** | **Supported** | Starting in Next.js 16, Turbopack uses Babel automatically if it
> detects a configuration file. Unlike in webpack, SWC is always used for Next.js's internal
> transforms and downleveling to older ECMAScript revisions. Next.js with webpack disables SWC if a
> Babel configuration file is present. Files in `node_modules` are excluded, unless you manually
> configure `babel-loader`."*

Experimental flag `turbopackUseBuiltinBabel` — *"Enable automatic Babel loader configuration when a
Babel config file is present"* — defaults **`true`** in dev and build.

> *"**JavaScript & TypeScript** | **Supported** | Uses SWC under the hood. Type-checking is not done
> by Turbopack (run `tsc --watch` or rely on your IDE for type checks)."*

### `turbopack` config surface

Options table: `root`, `rules` (*"List of supported webpack loaders to apply when running with
Turbopack"*), `resolveAlias`, `resolveExtensions`, `debugIds`. Renamed from `experimental.turbo`
in 15.3.0; the old key *"still works as an alias"*. Codemod:
`npx @next/codemod@latest next-experimental-turbo-to-turbopack .`

Loader limitations:

> *"Only a core subset of the webpack loader API is implemented."* ·
> *"Only loaders that return JavaScript code are supported. Loaders that transform files like
> stylesheets or images are not currently supported."* ·
> *"Options passed to webpack loaders must be plain JavaScript primitives, objects, and arrays. For
> example, it's not possible to pass `require()` plugin modules as option values."*

Missing loader-context features, verbatim list: `importModule` (no support), `loadModule` (no
support), `fs` (*"Partial support: only `fs.readFile` is currently implemented"*), `emitFile` (no
support), `version`, `mode`, `target`, `utils`, `resolve` (*"use `getResolve` instead"*).

`rules` example, conditions (`all`/`any`/`not`, `path`/`content`/`query`/`contentType`, built-ins
`browser` / `foreign` / `development` / `production` / `node` / `edge-light`), module `type`
(`asset`, `ecmascript`, `typescript`, `css`, `css-module`, `wasm`, `raw`, `bytes`), and inline
import attributes `turbopackLoader` / `turbopackLoaderOptions` / `turbopackAs` /
`turbopackModuleType` — all in the fetched page.

> *"Import attributes with `turbopackLoader` are Turbopack-specific and are not supported by
> webpack."*

Root: *"Turbopack uses the root directory to resolve modules. Files outside of the project root are
not resolved."* Detected from `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`,
`bun.lockb`.

## instrumentation.js

> *"The `instrumentation.js|ts` file is used to integrate observability tools into your application"*
> — placed *"in the **root** of your application or inside a `src` folder if using one"*.

> *"The file exports a `register` function that is called **once** when a new Next.js server
> instance is initiated, and must complete before the server is ready to handle requests. `register`
> can be an async function."*

> *"You can optionally export an `onRequestError` function to track **server** errors to any custom
> observability provider."* ·
> *"If you're running any async tasks in `onRequestError`, make sure they're awaited."* ·
> *"The `error` instance might not be the original error instance thrown, as it may be processed by
> React if encountered during Server Components rendering. If this happens, you can use `digest`
> property on an error to identify the actual error type."*

Full signature (verbatim from the page's Types block):

```ts
export function onRequestError(
  error: unknown,
  request: {
    path: string // resource path, e.g. /blog?name=foo
    method: string // request method. e.g. GET, POST, etc
    headers: { [key: string]: string | string[] }
  },
  context: {
    routerKind: 'Pages Router' | 'App Router' // the router type
    routePath: string // the route file path, e.g. /app/blog/[dynamic]
    routeType: 'render' | 'route' | 'action' | 'proxy' // the context in which the error occurred
    renderSource:
      | 'react-server-components'
      | 'react-server-components-payload'
      | 'server-rendering'
    revalidateReason: 'on-demand' | 'stale' | undefined // undefined is a normal request without revalidation
    renderType: 'dynamic' | 'dynamic-resume' // 'dynamic-resume' for PPR
  }
): void | Promise<void>
```

> *"The `instrumentation.js` file works in both the Node.js and Edge runtime, however, you can use
> `process.env.NEXT_RUNTIME` to target a specific runtime."*

Version history: `v15.0.0` *"`onRequestError` introduced, `instrumentation` stable"* · `v14.0.4`
Turbopack support · `v13.2.0` introduced experimental.

## transpilePackages

> *"Use `transpilePackages` to compile and bundle a dependency instead of treating it as untouched
> runtime code. Values are package names, including scoped names like `@scope/pkg`. Paths and glob
> patterns are not supported."*

> *"This replaces the `next-transpile-modules` package."*

> *"Turbopack transpiles workspace packages (npm, pnpm, or Yarn workspaces) in your monorepo
> automatically under both routers. Webpack does the same for the App Router."*

Add a package when:

> *"**A `node_modules` dependency ships raw TypeScript or JSX.** Next.js does not compile code
> inside `node_modules` by default."* ·
> *"**You build with webpack for the Pages Router and the dependency's source lives outside the next
> app's directory.**"* ·
> *"**You use the Pages Router and want a `node_modules` dependency bundled into the route.** Pages
> Router loads `node_modules` server-side dependencies through Node.js `require` at runtime."*

> *"**Good to know**: A package cannot appear in both `transpilePackages` and
> `serverExternalPackages`; Next.js throws at build start if it does. Packages listed in
> `optimizePackageImports` and the entries in `default-transpiled-packages.json` are added
> automatically; you do not need to repeat them."*

Added in `v13.0.0`.

## The `withX` convention — `@next/mdx`

```js
// next.config.mjs
import createMDX from '@next/mdx'

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
}

const withMDX = createMDX({
  // Add markdown plugins here, as desired
})

// Merge MDX config with Next.js config
export default withMDX(nextConfig)
```

> *"Since the remark and rehype ecosystem is ESM only, you'll need to use `next.config.mjs` or
> `next.config.ts` as the configuration file."*

Turbopack plugin form — plugin **names as strings**, with options as arrays:

```js
const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-gfm', ['remark-toc', { heading: 'The Table' }]],
    rehypePlugins: ['rehype-slug', ['rehype-katex', { strict: true, throwOnError: true }]],
  },
})
```

> *"**Good to know**: remark and rehype plugins without serializable options cannot be used yet with
> Turbopack, because JavaScript functions can't be passed to Rust."*

> *"`mdx-components.tsx` is **required** to use `@next/mdx` with App Router and will not work
> without it."*

Experimental Rust MDX compiler: `experimental.mdxRs` — *"This compiler is still experimental and is
not recommended for production use."*

## What is NOT settled by these sources — write as uncertain

- **No plugin registration API appears in any of the six pages fetched.** The only things the docs
  call *plugins* are `@next/mdx` and `@next/bundle-analyzer`, both of which are config wrappers.
  The `next.config.js` **index** page was not fetched, so the honest claim is *"no plugin
  registration API appears in the extension-point reference pages checked"*, not *"none exists"*.
- **`@next/bundle-analyzer`'s exact option shape was not verified** — only its existence, from the
  webpack page's plugin list. Do not write its API from memory.
- **`next/dist/**` is not documented anywhere as a public entry point** in the pages fetched; no doc
  sentence was found that either blesses or forbids it. The only semver statement found is the
  webpack one above. State the internals ban as reasoning from the absence of a contract plus the
  bundled-canary React mechanism, not as a quoted rule.
- **Pages Router `_document` / `_app` reference was not fetched** in this pass.

Related: the Adapters API (the one real, semver-committed extension API) is already written up in
`docs/nextjs/pages/16-deployment-scaling-and-observability/10-…` through `16-…` — do not re-derive
it. The React-canary rule is banked in `research_nextjs_ch1_foundations.md`.
