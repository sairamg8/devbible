---
title: "Turbopack's configuration surface is small on purpose, and the two things people reach for first — a `webpack()` hook and a Babel config — are the two that behave least like they used to"
sidebar_label: "01b · Configuring the compile pipeline"
sidebar_position: 100
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [Turbopack API reference](https://nextjs.org/docs/app/api-reference/turbopack)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-08-03`). Documentation-verified;
> **no timings, no sandbox run**. Target: **Next.js 16.3.4 · Turbopack default since 16.0**.

**Turbopack's stable configuration surface is five keys, and that is the design rather than an omission.** A single
unified module graph does not expose a compiler lifecycle, so the extension points webpack offered — a `webpack()`
function, a plugin array — have no counterpart and cannot get one. What survives is the subset that maps onto
per-module work: loaders, aliases, extensions, a resolution root. This page covers that surface, the Babel rule that
reversed in 16, and why the loader/plugin distinction is architectural rather than a gap someone will close later.
What Turbopack *is* and how the dev loop works is
[the previous page](01-turbopack-in-dev-and-production-fast-refresh.md); the build-time constants it injects, and
how to profile it, are [the next one](01c-import-meta-env-and-profiling-the-dev-server.md).

## Babel: 16 reversed the rule, and it costs you twice

This is the item most likely to bite a codebase carrying a `.babelrc` from years ago.

> *"Starting in Next.js 16, Turbopack uses Babel automatically if it detects a configuration file. Unlike in webpack, SWC is always used for Next.js's internal transforms and downleveling to older ECMAScript revisions. Next.js with webpack disables SWC if a Babel configuration file is present. Files in `node_modules` are excluded, unless you manually configure `babel-loader`."*

Three separate rules are packed into that paragraph, and they differ per bundler:

| | webpack | Turbopack (16+) |
|---|---|---|
| A Babel config file is present | **SWC is disabled** | **SWC still runs** for internal transforms and downleveling |
| Babel itself | runs | runs, detected automatically |
| `node_modules` | — | **excluded**, unless you configure `babel-loader` manually |

🔴 **The practical read: under Turbopack, Babel is additive rather than a replacement.** You pay for both pipelines
on every matching file — parsed and regenerated twice. Under webpack the same config file *replaced* SWC, so it cost
you one pipeline. This is the mechanism behind the React Compiler's build cost discussed on
[02 · React Compiler](02-react-compiler-retiring-manual-usememo-usecallback.md), and it means a forgotten Babel
config is often the single biggest build-time win available in an upgraded codebase.

The detection itself is a flag — `turbopackUseBuiltinBabel`, default `true` in both dev and build:

```js
// next.config.js — stop auto-detecting a Babel config
module.exports = {
  experimental: {
    turbopackUseBuiltinBabel: false,
  },
}
```

**Before disabling it, work out why the config exists.** If it is there for a transform SWC already does, delete the
file. If it is there for the React Compiler, it is load-bearing and must stay.

## Configuration lives under a `turbopack` key

The stable, non-experimental surface:

```js
// next.config.js
module.exports = {
  turbopack: {
    resolveAlias: {
      underscore: 'lodash',
    },
    resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.json'],
  },
}
```

| Key | What it does |
|---|---|
| `rules` | Define additional **webpack loaders** for file transformations |
| `resolveAlias` | Manual aliases, *"similar to `webpack.resolve.alias`"* |
| `resolveExtensions` | Change or extend extensions for module resolution |
| `ignoreIssue` | *"Suppress specific Turbopack errors and warnings from the CLI output and error overlay"* |
| `root` | The filesystem root used for module resolution |

🔴 **Note what `rules` accepts: webpack *loaders*.** Loaders are supported; plugins are not, and the docs say so
flatly:

> *"Turbopack does not support webpack plugins. This affects third-party tools that rely on webpack's plugin system for integration. We do support webpack loaders. If you depend on webpack plugins, you'll need to find Turbopack-compatible alternatives or continue using webpack until equivalent functionality is available."*

The distinction is not arbitrary. **A loader is a pure function from source to source for one file**, which maps
directly onto a per-module incremental graph — Turbopack can cache its result keyed by that module. **A plugin hooks
into a compiler lifecycle and mutates the build globally**, and there is no such lifecycle to hook, because the
whole point of the unified graph is that there is one incremental computation rather than a staged pipeline.

⚠️ **`resolveExtensions` replaces the default list rather than appending to it.** The documented example spells out
every extension it wants, including the ordinary `.tsx`/`.ts`/`.jsx`/`.js`/`.json` — copy that shape, or module
resolution for the omitted types stops working.

## What is supported out of the box

> *"Turbopack in Next.js has **zero-configuration** for the common use cases."*

Worth knowing without looking it up, because these are the things people reach for a plugin to solve and no longer
need to:

- **JavaScript, TypeScript, ESNext, CommonJS, ESM** — *"Static and dynamic `import` are fully supported."*
- **JSX/TSX, Fast Refresh, React Server Components** — *"Turbopack ensures correct server/client bundling."*
- **Global CSS, CSS Modules, CSS nesting, `@import`** — CSS Modules work natively through Lightning CSS.
- **PostCSS** — *"Automatically processes PostCSS config files (`postcss.config.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`) in a Node.js worker pool. Useful for Tailwind, Autoprefixer, etc."*
- **Sass/SCSS** — supported out of the box in Next.js, with two exceptions (`sassOptions.functions` and the tilde
  import) covered on the migration page.
- **Static assets and JSON imports** — *"Importing `import img from './img.png'` works out of the box. In Next.js, returns an object for the `<Image />` component."*
- **Path aliases** — *"Reads `tsconfig.json`'s `paths` and `baseUrl`, matching Next.js behavior."*

**Less** is *"Planned via plugins"* — *"Not yet supported by default. Will likely require a loader config once custom
loaders are stable."* **AMD** is *"Partially Supported"* — *"Basic transforms work; advanced AMD usage is limited."*

## Gotchas

**★ Symptom: `next.config.js` has a `webpack()` function and the build fails.** Cause: *"Turbopack replaces webpack,
so `webpack()` configs are not recognized"* — and since 16.0 Turbopack is the default, so a config that worked in 15
now runs against a bundler with no such hook. Fix: port to the `turbopack` key, or opt the build back to webpack
explicitly.

```js
// ❌ Not recognized under the default bundler in 16+
module.exports = {
  webpack: (config) => {
    config.resolve.alias['underscore'] = 'lodash'
    return config
  },
}

// ✅ The Turbopack equivalent
module.exports = {
  turbopack: {
    resolveAlias: { underscore: 'lodash' },
  },
}
```

**★ Symptom: a build tool that "just worked" under webpack silently does nothing now.** Cause: it ships a webpack
*plugin*, and *"Turbopack does not support webpack plugins."* Unlike a `webpack()` function, a plugin delivered
through a package's own Next.js wrapper may fail quietly rather than erroring. Fix: check whether the tool offers a
loader or a first-party Turbopack integration; if it only has a plugin, that build stays on webpack.

```json
{
  "scripts": {
    "build": "next build --webpack"
  }
}
```

**★ Symptom: an old `.babelrc` is making builds slow, and deleting it speeds everything up.** Cause: under Turbopack
in 16+, a detected Babel config makes Babel run **in addition to** SWC — *"SWC is always used for Next.js's internal
transforms and downleveling"*. Under webpack the same file disabled SWC, so it cost one pipeline instead of two.
Fix: delete the config if nothing needs it, or turn off detection:

```js
module.exports = {
  experimental: { turbopackUseBuiltinBabel: false },
}
```

**Symptom: setting `resolveExtensions` breaks imports that previously resolved.** Cause: the option *changes* the
extension list rather than extending it, so anything left out of your array stops resolving. Fix: spell out the full
list, using the documented example as the baseline.

```js
module.exports = {
  turbopack: {
    resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.json'],
  },
}
```

**Symptom: Tailwind or Autoprefixer appears not to run.** Cause: PostCSS *is* supported, but through a config file
Turbopack detects — `postcss.config.js`, `.mjs`, `.cjs`, `.ts`, `.mts` or `.cts`. A PostCSS setup expressed only
inside a former `webpack()` hook is never seen. Fix: move it into a real PostCSS config file at the project root.

**Symptom: a noisy Turbopack warning floods the terminal and the error overlay on every reload.** Cause: an issue
Turbopack reports that you have assessed and accepted. Fix: `turbopack.ignoreIssue` exists precisely for this —
*"Suppress specific Turbopack errors and warnings from the CLI output and error overlay"*. Suppress the specific
issue, never the category, and leave a comment saying why.

## Interview questions

**★ Why does Turbopack support webpack loaders but not webpack plugins?**
Because only one of the two fits an incremental module graph. A loader is a pure function from source to source for
a single file, so Turbopack can run it per module and cache the result keyed by that module — that is what
`turbopack.rules` accepts. A plugin hooks into the compiler's lifecycle and mutates the build globally, and
Turbopack has no such lifecycle to expose: the unified graph replaces webpack's staged pipeline. The docs state it
directly and give no migration path other than finding an alternative or staying on webpack.

**★ A colleague deletes `.babelrc` and the build gets noticeably faster. Explain the mechanism.**
Since 16, Turbopack detects a Babel config and runs Babel automatically, but *"SWC is always used for Next.js's
internal transforms and downleveling"* regardless. So the Babel config adds a second pipeline rather than replacing
the first, and every matching file is parsed and regenerated twice. This is the reverse of webpack's rule, where a
Babel config *disables* SWC and you pay for one pipeline. Deleting an unneeded config removes a whole pass.
`node_modules` is excluded either way unless `babel-loader` is configured manually.

**You need a transform that only a webpack plugin provides. What are the actual options?**
Three, and the docs endorse two of them. Find a Turbopack-compatible alternative; keep that build on webpack via
`--webpack`; or re-express the transform as a loader if it is genuinely per-file work, wiring it through
`turbopack.rules`. What is not an option is porting it to a `webpack()` function in `next.config.js`, because under
the default bundler that hook is not recognised at all. Note that opting a *build* back to webpack while dev stays
on Turbopack reintroduces the two-bundler split that 16.0 removed, so it is a temporary position, not a resting
place.

**Why is Turbopack's configuration surface so much smaller than webpack's, and is that a limitation?**
It is a consequence of the architecture rather than missing work. Turbopack's value comes from function-level
incremental caching over a single unified graph; every configuration hook that can arbitrarily mutate the build is a
hook that invalidates that caching model. So the surface is deliberately restricted to things expressible per
module — loaders, aliases, extensions, a resolution root — plus an issue-suppression escape valve. It is a real
limitation for codebases built on plugins, and simultaneously the reason the incremental model works.

**What does `turbopack.root` exist for?**
Module resolution is scoped to the project root, and files outside it are not resolved. That breaks locally linked
dependencies — `npm link`, `yarn link`, `pnpm link` — because the link target lives outside the project. `root`
repoints the filesystem root at a directory containing both the project and its link targets. It is covered in full
on the migration page, since it is one of the documented behavioural gaps with webpack rather than an ordinary
configuration knob.

---

← [01 · Turbopack in dev and production](01-turbopack-in-dev-and-production-fast-refresh.md) · [Chapter index](01-explanation.md) · Next → [01c · Build-time constants and profiling](01c-import-meta-env-and-profiling-the-dev-server.md)
