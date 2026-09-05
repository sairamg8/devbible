---
title: "Importing from next/dist is the one extension technique that always eventually breaks — and most requests for a Next.js plugin are really a request for a shared config package plus a codemod"
sidebar_label: "04d · Internals and the decision"
sidebar_position: 17
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [`transpilePackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages), [Custom Webpack Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack), [Turbopack](https://nextjs.org/docs/app/api-reference/turbopack), [`turbopack` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack). React probed on the installed package: `react` **19.2.8** (matches the pin), `Object.keys(require('react'))` contains **zero** `experimental_taint*` exports. `next` is **not installed in this checkout**, so nothing here is a probe of the Next.js package. Quoted and probed, not run — **no sandbox run**.

**Every long-lived Next.js extension eventually meets the same temptation: the documented seam does not quite reach, but there is a module inside `next/dist` that does exactly what you need. Take it and you have coupled your build to the framework's compiled implementation — not to its API, not to anything covered by a version promise, and not to anything anyone will mention in a changelog when it moves. The failure is rarely a clean error at the import site; the characteristic case is that your copy of a module and the framework's copy are *different builds of the same library*, and the mismatch surfaces as a missing export or a context that reads as `undefined` three layers away. This chunk shows that shape with a fact this corpus has already proven, then argues the alternative: most "we need a Next.js plugin" requests are a shared configuration package plus a codemod, and those two things do not break on upgrade.**

## What counts as an internal

The published API of the framework is the set of entry points the documentation names — `next/link`, `next/image`, `next/navigation`, `next/server`, `next/headers`, the file conventions, and `NextConfig`. `next/dist/**` is the compiled output that implements them. It is shipped in the package because it has to be, not because it is for you.

⚠️ **Stated precisely, because the difference matters:** I found **no documentation page that describes `next/dist` as a supported import path**, and equally **no page that explicitly forbids it**. The argument here is not a quoted rule. It is that no contract exists — nothing names those paths, nothing versions them, and the one adjacent stability sentence in the reference points the same way:

> *"**Good to know**: changes to webpack config are not covered by semver so proceed at your own risk"*
> — [Custom Webpack Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack)

If the *documented* build seam is outside semver, a compiled path under `dist` that appears in no document is not somehow inside it.

## The canonical shape of an internals bug: two Reacts

This corpus has already established the mechanism, and it is not re-derived here — see [ch1 · Introduction](../01-introduction-to-next-js/01-explanation.md). The two sentences below were quoted from the Next.js installation documentation during the chapter 1 pass and are **banked, not re-fetched here**. The rule is that **the App Router does not render with the React in your lockfile**:

> *"The `App Router` uses React canary releases built-in, which include all the stable React 19 changes, as well as newer features being validated in frameworks, but you should still declare react and react-dom in package.json for tooling and ecosystem compatibility."*

> *"The `Pages Router` uses the React version from your `package.json`."*

The observable consequence, probed on this checkout: `react` is installed at **19.2.8**, matching the corpus pin, and `Object.keys(require('react'))` contains **no** `experimental_taint*` export at all. Yet `taintObjectReference` and `taintUniqueValue` are usable from an App Router Server Component, because that code is compiled against the canary React bundled inside Next.js.

**Generalise it, because this is the template for every internals-coupling failure:**

- There are two builds of the same library in the tree — the one your code resolves and the one the framework uses.
- They export different things, and neither is "wrong".
- Code that reaches into `next/dist/compiled/react` (or any other vendored dependency under `dist`) binds to the framework's copy; code that imports `react` binds to yours. Mixing them in one call path is where the bug lives.
- The symptom is not at the import. It is a named export that is `undefined` when you call it, or a React context that resolves to its default value because the provider was created by a *different* React.

## What breaking actually looks like

No transcript is reproduced here — there is no sandbox for this page and inventing one would be worse than describing the mechanism. The four shapes, in the order you meet them:

1. **The path moved.** Node throws `MODULE_NOT_FOUND` at require time. This is the *good* failure: loud, immediate, and obviously about the import.
2. **The path survived, the export did not.** The module resolves, your named import is `undefined`, and you get a `TypeError` when you call it — at request time, in production, far from the config file.
3. **The signature changed.** Everything imports and calls fine, and the behaviour is subtly different: an extra argument is now required, a returned object gained or lost a field, an internal that used to be synchronous returns a promise. Nothing errors; results are wrong.
4. **Duplicate instance.** Two copies of the same library both load. Singletons are no longer single: contexts read defaults, `instanceof` checks fail across the boundary, and module-level caches are populated twice.

⚠️ **All four are invisible to CI unless you test the built app.** A unit test that imports your module directly resolves the same copies the test process resolves, which is not necessarily what the bundler wires together in a build.

## What to do instead, per temptation

| What you were reaching into `next/dist` for | The documented seam |
|---|---|
| The internal webpack config Next.js builds | `webpack(config, options)` under `--webpack`, or `turbopack.rules` ([04b](04b-the-bundler-seam-webpack-and-turbopack.md)) |
| Reading the build's route/manifest output | An adapter's `onBuildComplete` ([ch16](../16-deployment-scaling-and-observability/11-modifyconfig-and-onbuildcomplete-the-two-hooks-in-detail.md)) |
| Running code before the server serves traffic | `register` in `instrumentation.ts` ([04c](04c-the-seams-that-are-files.md)) |
| Catching every server error | `onRequestError` ([04c](04c-the-seams-that-are-files.md)) |
| Intercepting requests | `proxy.ts` ([ch2](../02-routing-and-navigation/07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md)) |
| The framework's copy of React | Import `react` normally; if you need a canary-only API, use it from App Router code and do not import the vendored copy |
| Compiling a workspace package that ships TSX | `transpilePackages` (below) |

The substitution that comes up most often — replacing a `next/dist` manifest read with a post-build script — is worth writing out, because it is bundler-agnostic and version-agnostic in a way the internal never was:

```js
// scripts/report-build.mjs — run as `next build && node scripts/report-build.mjs`
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Reads only what the build wrote into .next, and fails loudly if the shape
// it expects is not there — instead of silently reporting nothing.
const manifestPath = path.join(process.cwd(), '.next', 'build-manifest.json')

let manifest
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
} catch (cause) {
  throw new Error(
    `report-build: could not read ${manifestPath}. If this ran after a successful ` +
      `next build, the output layout changed — update this script.`,
    { cause }
  )
}

console.error(`report-build: ${Object.keys(manifest.pages ?? {}).length} page entries`)
```

**That script is still coupled to an output shape** — nothing makes it immune — but the coupling is explicit, it is checked at run time, and it fails with a message that tells the next person what happened. That is the whole difference between a survivable coupling and a landmine.

## Monorepos: `transpilePackages` is the shared-package seam

> *"Use `transpilePackages` to compile and bundle a dependency instead of treating it as untouched runtime code. Values are package names, including scoped names like `@scope/pkg`. Paths and glob patterns are not supported."*
> — [`transpilePackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)

> *"This replaces the `next-transpile-modules` package."*

The 16.3.4 reference is more generous than the folklore, and the folklore is where the wasted afternoons come from:

> *"Turbopack transpiles workspace packages (npm, pnpm, or Yarn workspaces) in your monorepo automatically under both routers. Webpack does the same for the App Router."*

So a workspace package full of `'use client'` components frequently needs **no** configuration at all on the default bundler. You add it to the list when one of the documented cases applies:

> *"**A `node_modules` dependency ships raw TypeScript or JSX.** Next.js does not compile code inside `node_modules` by default."*

> *"**You build with webpack for the Pages Router and the dependency's source lives outside the next app's directory.**"*

> *"**You use the Pages Router and want a `node_modules` dependency bundled into the route.** Pages Router loads `node_modules` server-side dependencies through Node.js `require` at runtime."*

```js
// next.config.js
module.exports = {
  transpilePackages: ['@sprintdesk/ui', '@sprintdesk/analytics'],
}
```

> *"**Good to know**: A package cannot appear in both `transpilePackages` and `serverExternalPackages`; Next.js throws at build start if it does. Packages listed in `optimizePackageImports` and the entries in `default-transpiled-packages.json` are added automatically; you do not need to repeat them."*

## Writing one extension that survives both bundlers

Two keys, one intent. Do not branch on an environment variable you invented — set both, and let whichever bundler runs read its own:

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Read only when the build runs with --webpack
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.svg$/,
      issuer: /\.[jt]sx?$/,
      use: [{ loader: '@svgr/webpack', options: { icon: true } }],
    })
    return config
  },
  // Read only when the build runs with Turbopack (the default)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: [{ loader: '@svgr/webpack', options: { icon: true } }],
        as: '*.js',
      },
    },
  },
}

module.exports = nextConfig
```

Keeping both is cheap and honest: neither bundler complains about the other's key, and the repo stays buildable with `--webpack` on the two platforms where it is mandatory —

> *"On platforms without native bindings (e.g. FreeBSD, OpenBSD), Next.js falls back to WebAssembly (WASM) bindings. WASM bindings support core SWC features like compilation and minification, but **do not support Turbopack**. On these platforms, use the `--webpack` flag"*

## Plugin, template, or codemod — pick honestly

Almost every "we need a Next.js plugin" is one of three cheaper things:

| The actual need | The right artefact | Why not a plugin |
|---|---|---|
| Twelve apps should share one config, lint setup and tsconfig | A **shared package** the apps import and compose (`withSprintdesk(baseConfig)`), plus `transpilePackages` if it ships TSX | Same result; no framework coupling; version it yourself |
| New apps should start the same way | A **template repository** or an internal `create-*` generator | A plugin cannot create files; scaffolding is a one-time act |
| Existing apps must all move to a new pattern | A **codemod** | A plugin would have to keep re-doing at build time what a codemod does once, in a reviewable commit |
| A platform must consume the build output | An **adapter** ([ch16](../16-deployment-scaling-and-observability/10-the-adapters-api-why-it-exists-and-how-a-platform-wires-one-in.md)) | This is the one case with a real API |
| Every request needs a header, a check or a rewrite | `proxy.ts`, shipped in the shared package and re-exported | Nothing to build-time about it |

Next.js's own migrations are codemods, and the pattern is worth copying verbatim — the Turbopack reference ships one for its own config rename:

```bash
npx @next/codemod@latest next-experimental-turbo-to-turbopack .
```

**The trade-off, stated fairly.** A shared config package plus a codemod is more verbose than a plugin and gives you less leverage: every app still has a `next.config.mjs` that calls your wrapper, and a codemod cannot enforce anything after it runs. What you get in exchange is that neither artefact has a framework contract to break. A config wrapper is a function on a plain object; a codemod is a source transformation that has already finished by the time Next.js runs. The upgrade that breaks a `next/dist` import does not touch either.

## Making an extension survivable

1. **Pin the framework exactly** in the package that ships the extension — `"next": "16.3.4"`, not `^16.3.4` — and declare it as a `peerDependency` with a range you have actually tested. An extension whose own dependency floats is an extension that breaks on someone else's `yarn upgrade`.
2. **Prefer the more verbose documented seam.** `turbopack.rules` as data is duller than a `webpack()` callback that reaches into the compiler, and it is the one that still applies in 17.
3. **Test against the next minor before it lands.** Next.js publishes to the `canary` channel daily; a scheduled CI job that installs `next@canary` and runs your build turns a production surprise into a red job you can ignore until you cannot.
4. **Make coupling explicit and loud.** If you must read build output or a version-specific path, assert its shape and throw a message naming the file and the assumption, as `report-build.mjs` above does.
5. **Keep the extension small enough to delete.** The best outcome for most of these packages is that the framework grows the feature and you remove yours; that only happens cheaply if the extension is one function in one file.
6. **Write down which seam each behaviour uses.** When an upgrade breaks something, the first question is always *which of our customisations could this be* — a five-line table in the repo's README answers it in seconds.

## Gotchas

**★ Symptom: an import from `next/dist/...` worked for months and fails after a patch upgrade.** Cause: `next/dist` is compiled implementation, not API; no document names those paths and nothing versions them. Fix: replace it with a documented seam, and if there is genuinely no equivalent, isolate the coupling in one module with a guard so the failure is legible:

```js
// src/server/internal-bridge.js — one file, one assumption, loud failure
let internal
try {
  internal = require('next/dist/server/some-module')
} catch (cause) {
  throw new Error(
    'internal-bridge: next/dist layout changed. This file is the only place we ' +
      'depend on Next.js internals — fix it here or delete the feature.',
    { cause }
  )
}
module.exports = internal
```

**★ Symptom: a React hook or context works in one component and returns a default value in another, with no error.** Cause: two copies of React in one call path — typically because something imported the vendored React under `next/dist` while the rest of the tree imported `react`. Fix: import `react` and nothing else; a canary-only API should be called from App Router code rather than pulled from the framework's copy.

**★ Symptom: `experimental_taintObjectReference` is undefined when you import it from `react`.** Cause: your `react` is stable 19.2.8, which exports no `experimental_taint*` at all — the App Router reaches those through the canary React bundled into Next.js. Fix: call it from App Router server code, where the bundled canary is what compiles, and do not try to reach the canary copy from a shared package:

```ts
// app/lib/user.ts — App Router server code, canary React is what compiles here
import { experimental_taintObjectReference as taintObjectReference } from 'react'

export function protect(user: { id: string; email: string }) {
  taintObjectReference('Do not pass the whole user object to the client', user)
  return user
}
```

**★ Symptom: a workspace package's components fail to compile with a syntax error about JSX or `'use client'`.** Cause: the package ships raw TSX and is being consumed as untouched runtime code. Fix: list it — and only by name, since *"Paths and glob patterns are not supported"*:

```js
module.exports = { transpilePackages: ['@sprintdesk/ui'] }
```

**Symptom: the build throws at start complaining about a package appearing twice.** Cause: it is in both `transpilePackages` and `serverExternalPackages`; the reference says *"Next.js throws at build start if it does."* Fix: pick one — bundle it (`transpilePackages`) or keep it external at runtime (`serverExternalPackages`) — never both.

**Symptom: you added `transpilePackages` for a workspace package and it made no difference.** Cause: it may not have been needed. Turbopack transpiles workspace packages automatically under both routers, and webpack does so for the App Router; the entry is a no-op in those cases. Fix: verify the real cause before adding config — the documented cases where it *is* needed are a `node_modules` dependency shipping raw TS/JSX, or Pages Router builds under webpack.

**Symptom: your internal plugin works in the app it was written in and breaks in the second one.** Cause: it depends on something incidental — a path relative to the config file, a peer dependency that happened to be hoisted, a `next` version resolved differently in the other repo. Fix: pin `next` as an explicit `peerDependency`, resolve paths from `import.meta.url` or `__dirname` rather than `process.cwd()`, and test the package by consuming it from a second app before publishing.

**Symptom: an upgrade breaks the build and nobody can say which customisation caused it.** Cause: composition gives the framework no plugin identity — see [04](04-framework-extension-and-plugin-development.md) — so nothing in the error names your wrapper. Fix: keep the seam inventory in the repo and label your wrapper's own additions, e.g. give every loader rule you add a comment naming the package that added it, so the config file itself answers the question.

## Interview questions

**★ Why is importing from `next/dist` worse than a webpack config hack, when both are unsupported?**
Because of how they fail. The webpack seam is documented, so when it changes there is a page to read and usually a changelog entry — it is outside semver, but it is *known*. `next/dist` is compiled output that appears in no document: nothing names those paths, so nothing tells you when they move, and the most common failure mode is not a missing module but a mismatched one — an export that is now `undefined`, or a duplicate library instance whose singletons are no longer single. The webpack hack fails at build time; the internals import often fails at request time, in production.

**★ Explain the bundled-React problem to someone who has never hit it.**
Next.js's App Router renders with a React canary that ships inside the `next` package, while the `react` in your `package.json` is what your own imports resolve — the documentation states both halves explicitly. So there can be two builds of React in the tree with different export lists. Concretely: stable React 19.2.8 exports no `experimental_taint*` functions, yet App Router code can call them, because that code compiles against the bundled canary. Anything that reaches into the framework's copy to "get the same React" ends up mixing instances, and the symptom is a context resolving to its default value or an `instanceof` check failing — never a clear error.

**★ A team asks you to build "a Next.js plugin" so all twelve of their apps get the same setup. What do you build?**
Almost certainly a shared package plus a codemod, not a plugin. The package exports a config wrapper (`withSprintdesk`), the shared `proxy.ts`, the shared `instrumentation.ts` and the lint/tsconfig bases; each app composes it in three lines. The codemod moves the existing twelve apps onto it once, in a reviewable commit. If the package ships TSX, add it to `transpilePackages`. The reason not to build "a plugin" is that there is nothing to plug into — a plugin here *is* a config wrapper — and framing it as a plugin invites someone to make it reach into internals to get leverage a wrapper cannot have.

**★ How would you make a build-time extension survive the next two minor releases?**
Pin `next` exactly in the extension package and declare a tested peer range; prefer declarative seams (`turbopack.rules`) over callbacks that touch compiler objects; set both the `webpack` and `turbopack` keys so a bundler switch cannot silently disable it; add a scheduled CI job that installs `next@canary` and runs the build, so an upcoming break shows up as a red job rather than an outage; and isolate any unavoidable coupling in one module that throws a message naming the assumption. None of that is exotic — it is the difference between an extension nobody dares upgrade around and one that fails informatively.

**Is a codemod really better than a lint rule or a plugin for enforcing a pattern?**
They solve different halves. A codemod performs the migration once and leaves a diff a human reviewed, which is the only mechanism that scales to twelve repositories without a build-time cost. A lint rule prevents regression afterwards. A plugin does neither well: it would have to re-derive the transformation on every build, it is invisible in the source, and it couples the enforcement to the framework's lifetime. The pairing Next.js itself uses is exactly this — a `@next/codemod` migration plus documentation — and its config rename shipped that way: `npx @next/codemod@latest next-experimental-turbo-to-turbopack .`

**When is reaching into internals actually defensible?**
When the alternative is not shipping, the coupling is confined to one module, the failure is guarded with a message that names the assumption, and someone owns re-checking it every minor. That is a real engineering trade, and it is occasionally the right one — a temporary bridge while an upstream feature lands. What is never defensible is spreading `next/dist` imports across a codebase, because then no one can answer the only question that matters during an upgrade: what exactly are we coupled to?

---

← [04c · Seams that are files](04c-the-seams-that-are-files.md) · [Chapter index](01-explanation.md) · Next → [Capstone: decision trees and outlook](../18-capstone-decision-trees-and-outlook/01-explanation.md)
