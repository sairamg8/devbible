---
title: "`optimizePackageImports` and `serverExternalPackages` sound like the same kind of knob and are opposites — one makes a barrel-file import resolve narrowly, the other stops a server package being bundled at all"
sidebar_label: "03d · Package imports and server externals"
sidebar_position: 116
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js [package bundling guide](https://nextjs.org/docs/app/guides/package-bundling)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-06-01`) and the Next.js
> [`serverExternalPackages` reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)
> (`version: 16.3.4`, `lastUpdated: 2025-12-05`).
> Documentation-verified; **no sandbox run, no bundle measured, no byte counts here**.
> Target: **Next.js 16.3.4 · Turbopack default since 16.0**.

**These are the two configuration answers to a bundle problem, and the fastest way to waste an afternoon is to
reach for the wrong one — they act on different graphs, in different directions, for different reasons.**
`optimizePackageImports` narrows how a barrel-file package resolves so only the modules you use are pulled in.
`serverExternalPackages` does the opposite thing to the opposite graph: it takes a package *out* of the server
bundle so it is loaded from `node_modules` at run time. This page covers both, the documented caveat that some
libraries are already optimised automatically so half the entries people add are no-ops, and the decision table
for choosing between these two and the two architectural fixes. The architectural one with the biggest payoff
is [03c](03c-fixing-what-the-analyzer-finds.md); deferral is
[03e](03e-next-dynamic-and-lazy-loading.md).

## `optimizePackageImports` — for packages with hundreds of exports

> *"If you're using a package that exports hundreds of modules (such as icon and utility libraries), you can
> optimize how those imports are resolved using the `optimizePackageImports` option … This option will only
> load the modules you actually use, while still giving you the convenience of writing import statements with
> many named exports."*

```js
// next.config.js
const nextConfig = {
  experimental: {
    optimizePackageImports: ['icon-library'],
  },
}

module.exports = nextConfig
```

This is the barrel-file problem. A package whose entry point re-exports every module means one named import
puts the whole index in the graph, and whether tree-shaking removes the rest again depends on side-effect
analysis that frequently cannot prove what it needs to. The option makes the resolution targeted instead of
hoping.

🔴 **Check before you add anything to the list:**

> *"Next.js also optimizes some libraries automatically, thus they do not need to be included in the
> `optimizePackageImports` list."*

So a growing array in `next.config.js` is not evidence of a well-tuned app; it may be a list of no-ops
somebody added defensively. Add a package when the analyzer's import chain shows a barrel between your code and
the module you wanted — and remove it again if the chain does not change.

## `serverExternalPackages` — opting out of server bundling

> *"Packages imported inside Server Components and Route Handlers are automatically bundled by Next.js."*
> *"You can opt specific packages out of bundling using the `serverExternalPackages` option"*

Its own config reference is more precise about the trigger and about what replaces bundling:

> *"Dependencies used inside Server Components and Route Handlers will automatically be bundled by Next.js."*
> *"If a dependency is using Node.js specific features, you can choose to opt-out specific dependencies from
> the Server Components bundling and use native Node.js `require`."*
> — `serverExternalPackages` reference (`lastUpdated: 2025-12-05`)

🔴 **It is a top-level key, not an `experimental` one** — the opposite nesting to `optimizePackageImports`
above, which is the single most common copy-paste error on this page:

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@acme/ui'],
}

module.exports = nextConfig
```

Note the difference in kind from the option above. `optimizePackageImports` is about **making a client bundle
smaller**; `serverExternalPackages` is about **not bundling a server dependency at all**, leaving it to be
`require`d from `node_modules` at run time. It is the answer when a package does something a bundler cannot
faithfully reproduce — native bindings, runtime file reads relative to its own package directory, dynamic
`require` of files chosen at run time.

### Check the automatic list before you add anything

> *"Next.js includes a short list of popular packages that currently are working on compatibility and
> automatically opt-ed out"*

That list is published in the reference and is long — and it contains most of what a fullstack app actually
runs on the server. A sample of the entries most likely to appear in this corpus's stack:

| Category | Already opted out automatically |
|---|---|
| Databases and ORMs | `@prisma/client`, `prisma`, `pg`, `mongodb`, `mongoose`, `better-sqlite3`, `sqlite3`, `libsql`, `@mikro-orm/core` |
| Native / binary | `sharp`, `canvas`, `bcrypt`, `@node-rs/bcrypt`, `argon2`, `@node-rs/argon2`, `node-pty`, `zeromq`, `cpu-features` |
| Rendering and content | **`shiki`**, `@react-pdf/renderer`, `mdx-bundler`, `next-mdx-remote`, `jsdom` |
| Logging and tracing | `pino`, `pino-pretty`, `dd-trace`, `newrelic`, `@sentry/profiling-node` |
| Browsers and test runners | `puppeteer`, `puppeteer-core`, `playwright`, `@sparticuz/chromium`, `jest`, `cypress` |
| Cloud SDKs | `@aws-sdk/client-s3`, `firebase-admin` |

⚠️ **`shiki` being on that list is the detail worth carrying across from
[03c](03c-fixing-what-the-analyzer-finds.md).** The recommended fix there is to move highlighting into a Server
Component — and the highlighter Next.js recommends is already excluded from server bundling by default. You do
not need to add it, and adding it tells a future reader that you found a problem you did not find.

The version history matters for anything you copy from an older codebase or a pre-15 blog post:

> *"`v15.0.0` — Moved from experimental to stable. Renamed from `serverComponentsExternalPackages` to
> `serverExternalPackages`"*

## Choosing between the four levers

| Option | Which graph | What it does | Reach for it when |
|---|---|---|---|
| `optimizePackageImports` | client (and server) | Resolves only the modules you actually use out of a barrel | The import chain shows a package index between you and one export |
| `serverExternalPackages` | server only | Excludes the package from the bundle; it is loaded from `node_modules` | A server package has native bindings or reads its own files at runtime |
| `next/dynamic` | client | Defers a chunk until it is needed ([03e](03e-next-dynamic-and-lazy-loading.md)) | The code is only reachable from an interaction most users never perform |
| Move to a Server Component | removes from client | The library never enters the client graph | The work is data → markup and needs no browser API |

## Gotchas

**★ Symptom: `optimizePackageImports` was added for a package and the bundle did not change.** Cause: either
Next.js already optimises that library automatically — *"Next.js also optimizes some libraries automatically,
thus they do not need to be included"* — or the package was never the problem. Fix: verify with the import
chain before and after; if the chain is identical, take the entry back out rather than leaving a config line
nobody can justify.

```js
// Keep the list to entries you can point at an import chain for.
experimental: { optimizePackageImports: ['icon-library'] }
```

**★ Symptom: a server-side package with native bindings fails at runtime with a module-not-found or a missing
`.node` binary, only in the deployed build.** Cause: it was bundled — *"Packages imported inside Server
Components and Route Handlers are automatically bundled by Next.js"* — and bundling broke a path or a binding
the package resolves itself. Fix: opt it out.

```js
// next.config.js
module.exports = { serverExternalPackages: ['some-package-with-native-bindings'] }
```

**★ Symptom: `serverExternalPackages` was added for a package used in a Client Component and nothing happened.**
Cause: the option only governs server bundling; it has no bearing on the client graph. Fix: use the right lever
for the graph you are looking at — `optimizePackageImports` or `next/dynamic` for client weight, and
`serverExternalPackages` only for packages Next.js bundles into the server output.

**★ Symptom: `experimental.serverComponentsExternalPackages` in `next.config.js` is ignored, or TypeScript
rejects it.** Cause: it was renamed and stabilised — *"`v15.0.0` — Moved from experimental to stable. Renamed
from `serverComponentsExternalPackages` to `serverExternalPackages`"*. Anything copied from a Next.js 14-era
config or blog post carries the old name. Fix: rename it and move it to the top level.

```js
// ❌ Next.js 14 shape
module.exports = { experimental: { serverComponentsExternalPackages: ['@acme/ui'] } }

// ✅ Next.js 15+ shape
module.exports = { serverExternalPackages: ['@acme/ui'] }
```

**★ Symptom: `serverExternalPackages: ['prisma', 'sharp', 'pg']` was added and made no difference.** Cause:
those are already on the published list of packages Next.js *"automatically opt-ed out"* — as are `bcrypt`,
`mongoose`, `puppeteer`, `pino`, `shiki` and most of a typical server stack. Fix: check the list in the
reference first and keep your array to packages that are genuinely not on it, so the config still documents a
real decision.

**Symptom: one option is nested under `experimental` and the other is not, and half the team gets it backwards.**
Cause: the asymmetry is real and undocumented as a pairing — the bundling guide shows
`optimizePackageImports` under `experimental`, while the `serverExternalPackages` reference shows it at the top
level of `nextConfig`. Fix: write both together and let the `NextConfig` type check the placement.

```ts
// next.config.ts — the two options, at their two different levels
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@acme/ui'],              // top level
  experimental: {
    optimizePackageImports: ['icon-library'],        // under experimental
  },
}

export default nextConfig
```

## Interview questions

**★ What is the difference between `optimizePackageImports` and `serverExternalPackages`? People mix them up.**
They act on different graphs and in opposite directions. `optimizePackageImports` is for packages that
*"export hundreds of modules"* — icon and utility libraries with a barrel entry point — and it makes resolution
targeted so only the modules you use are loaded, which shrinks what gets bundled.
`serverExternalPackages` does the reverse for the server: packages imported in Server Components and Route
Handlers are bundled automatically, and this option excludes specific ones so they are loaded from
`node_modules` at runtime instead. You reach for the first when a barrel is inflating a client bundle, and the
second when bundling breaks a package that has native bindings or resolves its own files at run time.

**★ Why is adding every large dependency to `optimizePackageImports` a bad instinct?**
Because some of the entries will do nothing and you will not be able to tell which. The documentation says
outright that *"Next.js also optimizes some libraries automatically, thus they do not need to be included in the
`optimizePackageImports` list."* A long array is then indistinguishable from a well-tuned one, and every entry
is a claim nobody can verify without re-running the analysis. The discipline is to add an entry only when an
import chain shows a barrel file between your code and the export you wanted, and to remove it if the chain
does not change afterwards.

**How do you decide which of the four fixes applies to a given large module?**
Read its import chain and ask two questions in order. First, does this need to run in the browser? If not, it
should not be in the client graph at all — move the work to a Server Component. If it does, second: is it
reachable on first paint, or only from an interaction? Code behind an interaction is a `next/dynamic`
candidate. Only when neither applies do you look at the chain's shape: a barrel entry point points at
`optimizePackageImports`, and a server-side package that breaks when bundled points at
`serverExternalPackages`. Doing it in that order matters, because the configuration options make a dependency
smaller while the architectural moves remove it.

**★ What actually happens when a package is in `serverExternalPackages`?**
It stops being bundled into the server output and is loaded with *"native Node.js `require`"* from
`node_modules` at run time instead. That is the point: a bundler rewrites module resolution, and packages with
native bindings, or that read files relative to their own installed location, or that `require` a path computed
at run time, break when that happens. The cost is that the package must actually be present in `node_modules`
where the app runs, which matters for standalone or containerised deployments — you have moved a build-time
dependency into a runtime one.

**Do you need to list Prisma, `sharp` or `bcrypt` in `serverExternalPackages`?**
No, and this is worth knowing because it is a config line many codebases carry for no reason. Next.js publishes
a list of *"popular packages that currently are working on compatibility and automatically opt-ed out"*, and it
covers most of a normal server stack: the Prisma client, `pg`, `mongodb`, `mongoose`, `sharp`, `canvas`,
`bcrypt` and the `@node-rs` variants, `puppeteer`, `playwright`, `pino`, `shiki`. Adding them is harmless but
misleading — it implies somebody diagnosed a bundling failure that never occurred. Check the list, then list
only what is not on it.

**Why is `shiki` on the automatic opt-out list an interesting detail?**
Because it closes a loop between two pieces of Next.js's own advice. The package bundling guide's recommended
fix for a heavy client workload is to move syntax highlighting into a Server Component using `shiki`, and the
`serverExternalPackages` reference already excludes `shiki` from server bundling by default. So the recommended
architecture is the one the defaults are tuned for: the library never enters the client graph, and it is not
bundled into the server output either — it is simply required at run time on the server.

---

← [03c · Fixing what it finds](03c-fixing-what-the-analyzer-finds.md) · [Chapter index](01-explanation.md) · Next → [03e · `next/dynamic` and lazy loading](03e-next-dynamic-and-lazy-loading.md)
