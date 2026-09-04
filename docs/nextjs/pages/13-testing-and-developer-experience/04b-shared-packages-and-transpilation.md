---
title: "Turbopack transpiles workspace packages automatically in Next.js 16, which retires most transpilePackages advice — but the internal-package style you choose still decides whether Turborepo can cache anything at all"
sidebar_label: "4b · Shared packages and transpilation"
sidebar_position: 11
description: "Just-in-Time, Compiled and Publishable internal packages and what each costs, why a JIT package is structurally uncacheable, the three cases where transpilePackages is still required, the serverExternalPackages conflict that throws at build start, and outputFileTracingRoot for standalone output."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [`transpilePackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages) (lastUpdated 2026-05-27), [`output`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) (2025-10-08), [TypeScript configuration](https://nextjs.org/docs/app/api-reference/config/typescript) (2026-08-25), [`next` CLI](https://nextjs.org/docs/app/api-reference/cli/next) (2026-08-25) and the Turborepo docs — [Internal Packages](https://turborepo.dev/docs/core-concepts/internal-packages). Continues [4 · Turborepo: the task graph](04-monorepos-with-turborepo-shared-packages-remote-caching-ci-p.md). Documentation-verified; **no sandbox run**.
> Target: **Turborepo 2.10.12** · **Next.js 16.3.4** · Node.js 24.20.0.

**Sharing a `Button` between two Next.js apps used to be a configuration problem: the package shipped TypeScript, the app's bundler refused to compile anything in `node_modules`, and `transpilePackages` was the fix. Next.js 16 handles this automatically for workspace packages, which removes the configuration but not the decision underneath it. A package that ships raw source has no build step, and a package with no build step is a package Turborepo cannot cache — so the "simplest" option quietly moves work from the cache into every consumer's build, forever. This page is about picking deliberately, and about the three narrow cases where you still need `transpilePackages` after all.**

## The framework already does the transpiling

> *"Turbopack transpiles workspace packages (npm, pnpm, or Yarn workspaces) in your monorepo automatically under both routers. Webpack does the same for the App Router."*

Turbopack is the default bundler in Next.js 16 for both `next dev` and `next build`, so in a normal App Router monorepo this is the whole story: `@sprintdesk/ui` can export `./src/button.tsx` directly and it will compile. `transpilePackages` also replaces the old `next-transpile-modules` plugin entirely; if you find that package in a repo, it is a migration you have not done.

## Three kinds of internal package

Turborepo names three strategies, and the difference between the first two is the one that matters:

### Just-in-Time — no build step

```json
{
  "name": "@sprintdesk/ui",
  "exports": {
    "./button": "./src/button.tsx"
  }
}
```

Cheapest to set up, and three real costs:

- It only works when the **consumer** transpiles it. That is true of a Next.js app; it is not true of a plain `tsc`-built Node package, a Vitest run without the right transform, or a script run through `node`.
- **TypeScript `compilerOptions.paths` do not work** in a JIT package — the docs direct you to Node.js subpath imports (`#internal/*` in `package.json`) instead.
- 🔴 *"Turborepo cannot cache a build for a Just-in-Time Package"*, because there is no build task to cache. Every consumer recompiles the same source on every cold build, in every app.
- *"Errors in internal dependencies will be reported"* — type-checking a consumer surfaces errors that live inside the dependency's source, which is either a feature or a permanent distraction depending on how disciplined the package is.

### Compiled — a `build` script and a `dist`

```json
{
  "name": "@sprintdesk/ui",
  "scripts": { "build": "tsc" },
  "exports": {
    "./button": {
      "types": "./src/button.tsx",
      "default": "./dist/button.js"
    }
  }
}
```

The `types` condition points at source so the editor gives you go-to-definition into real code, while `default` points at the built output. Now there is a `build` task, so Turborepo can hash it and cache it — provided you declared `"outputs": ["dist/**"]`, per [4](04-monorepos-with-turborepo-shared-packages-remote-caching-ci-p.md).

> *"The majority of Compiled Packages should use `tsc`"* — a bundler only for specific needs. This is worth taking literally: reaching for tsup or Rollup in an internal package buys configuration surface and rarely buys anything else.

### Publishable — the full npm treatment

Versioning, changelogs, multiple module formats, `peerDependencies`, a registry. Only when the package leaves the repo.

### Choosing, for SprintDesk

| Package | Style | Why |
|---|---|---|
| `@sprintdesk/ui` | Just-in-Time | Consumed only by Next.js apps, which transpile it; changes constantly during design work |
| `@sprintdesk/db` (Drizzle schema + queries) | **Compiled** | Consumed by apps *and* by migration scripts run through `node`, which will not transpile TSX or TS |
| `@sprintdesk/eslint-config` | Just-in-Time | Config files, consumed by tools that already load TypeScript configs |
| `@sprintdesk/emails` | Compiled | Rendered by a background worker outside Next.js |

The rule of thumb that falls out: **if anything other than a bundler consumes the package, compile it.**

## The three cases where `transpilePackages` is still required

Automatic handling covers *workspace* packages under Turbopack (and App Router webpack). It does not cover:

1. A dependency in `node_modules` — a real published package, not a workspace one — that ships raw TypeScript or JSX.
2. Webpack plus the Pages Router, with source outside the app directory.
3. Pages Router wanting a `node_modules` dependency bundled into the route rather than externalised.

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['some-untranspiled-lib'],
}

export default nextConfig
```

Two constraints on the value:

- 🔴 *"A package cannot appear in both `transpilePackages` and `serverExternalPackages`; Next.js throws at build start if it does."* The two options are opposites — one says "compile this into my bundle", the other says "leave this to Node's resolver" — and the conflict is caught immediately, which is the one merciful part of it.
- Entries are **package names only**. *"Paths and glob patterns are not supported."* `@sprintdesk/*` does not work.

Next.js also adds `optimizePackageImports` entries and its own `default-transpiled-packages.json` automatically, so a package you never configured may already be handled.

## File tracing: the monorepo default that drops half your files

For `output: 'standalone'`, Next.js traces the files the server needs. The default tracing root is not the repository:

> *"While tracing in monorepo setups, the project directory is used for tracing by default. For `next build packages/web-app`, `packages/web-app` would be the tracing root and any files outside of that folder will not be included."*

> *"In a monorepo, `project root` refers to the Next.js project root (the folder containing `next.config.js`, e.g., `packages/web-app`), not necessarily the monorepo root."*

So every shared workspace package your app imports lives *outside* the tracing root and is omitted from `.next/standalone`. The container then starts and fails at the first import.

```ts
// apps/web/next.config.ts
import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
}

export default nextConfig
```

⚠️ Separately, and independently of the monorepo: `output: 'standalone'` does **not** copy `public` or `.next/static` into the output, on the assumption they are served by a CDN. If your `server.js` serves them, copy them yourself in the Dockerfile.

## Type-checking across packages

Three things interact badly here, and knowing which is which saves an afternoon:

- **A JIT package's type errors belong to its consumers.** Since the consumer compiles the dependency's source, `next build` in `apps/web` reports errors inside `packages/ui`. This is why an app can suddenly fail to build after a change to a package that has no build step of its own.
- **`next typegen` is per app.** The route types for `apps/web` are generated from `apps/web`. Run it with a directory: `next typegen ./apps/web`. Without the argument, from the repo root, there is no app to inspect.
- **A shared package with looser settings can fail a strict app's build**, because the Next.js 16 CLI checker type-checks the complete `tsconfig` project. The documented escape is a build-specific config:

  > *"You might need to relax checks in scenarios like monorepos, where the build also validates shared dependencies that don't match your project's standards"*

  ```json
  {
    "extends": "./tsconfig.json",
    "compilerOptions": {
      "useUnknownInCatchVariables": false
    }
  }
  ```

  selected with `typescript.tsconfigPath`. Treat it as a bridge with an expiry date, not a resting place — see [3](03-type-safety-as-testing-strict-ts-config-typed-routes-zod-con.md) for the strictness ladder and [12](12-typescript-7-and-build-type-checking.md) for what the CLI checker covers.

The durable arrangement is a `@sprintdesk/tsconfig` package holding `base.json`, `nextjs.json` and `library.json`, extended by every package. One place to raise the floor, and the raise is visible as a single diff.

## Gotchas

**★ Symptom: an app's cold build recompiles the same shared package in every app, every time.** Cause: the package is Just-in-Time, so it has no `build` task, and *"Turborepo cannot cache a build for a Just-in-Time Package."* Fix: convert it to a Compiled package — a `build: "tsc"` script, an `exports` map with `types` pointing at source and `default` at `dist`, and `"outputs": ["dist/**"]` in the task definition. Do this when the package stops changing daily, not before.

**★ Symptom: `next build` fails with type errors in files you did not touch, inside `packages/ui`.** Cause: `packages/ui` is JIT, so its source is part of the app's compilation, and *"Errors in internal dependencies will be reported."* Fix: give the package its own `type-check` task so the errors are attributed to it in CI, and compile it if the noise persists.

**★ Symptom: a migration script fails with `Unexpected token 'export'` importing the shared schema package.** Cause: the package is JIT and the script runs under plain `node`, which does not transpile it. Only bundlers do. Fix: compile any package consumed outside a bundler.

**★ Symptom: `transpilePackages: ['@sprintdesk/*']` has no effect.** Cause: *"Paths and glob patterns are not supported"* — entries are exact package names. Fix: list them individually, and first check whether you need the option at all: workspace packages are transpiled automatically under Turbopack in Next.js 16.

**★ Symptom: `next build` throws immediately, before compiling anything.** Cause: a package appears in both `transpilePackages` and `serverExternalPackages`; Next.js throws at build start. Fix: decide which one you meant. `serverExternalPackages` for a native or CommonJS server dependency that must stay outside the bundle; `transpilePackages` for source that must be compiled into it.

**★ Symptom: a standalone Docker image starts and dies on `Cannot find module '@sprintdesk/db'`.** Cause: the default tracing root is the app directory, so nothing outside `apps/web` was traced into `.next/standalone`. Fix: `outputFileTracingRoot: path.join(__dirname, '../../')`.

**★ Symptom: the standalone container serves the app but every image and stylesheet 404s.** Cause: `output: 'standalone'` deliberately omits `public` and `.next/static`, assuming a CDN. Fix: copy both into the output in the Dockerfile if `server.js` is the thing serving them.

**★ Symptom: `next typegen` reports no routes when run from the repo root.** Cause: it inspects one Next.js project, and the root is not one. Fix: `next typegen ./apps/web`, per app, in each app's own `type-check` script so `turbo run type-check` does the right thing everywhere.

**★ Symptom: `paths` aliases inside a shared package resolve in the editor and fail at build.** Cause: TypeScript `compilerOptions.paths` are not supported in a Just-in-Time package — the consumer's bundler resolves the files, and it does not read the package's tsconfig. Fix: Node.js subpath imports declared in the package's own `package.json` (`"imports": { "#lib/*": "./src/lib/*" }`), which every consumer honours because they are a package-manager feature, not a compiler one.

**★ Symptom: the editor jumps into `dist/*.d.ts` instead of the real source.** Cause: the `exports` map's `types` condition points at the built declarations. Fix: point `types` at the source file and `default` at `dist`, which is the shape the Turborepo docs use for Compiled Packages — you get source navigation and compiled runtime output from one entry.

## Interview questions

**★ Why is a package with no build step a caching problem rather than a simplification?**
Because Turborepo's unit of caching is a task, and a package with no `build` script has no task to cache. The work does not disappear — it moves into every consumer's build, where it is repeated once per app and once per cold CI run, and where it cannot be attributed to the package that caused it. For a package that changes several times a day the recompilation is cheaper than the cache round-trip and JIT is the right call; for a stable one it is a permanent tax.

**★ Next.js 16 transpiles workspace packages automatically. When do you still need `transpilePackages`?**
When the code is not a workspace package. A published dependency in `node_modules` that ships raw TypeScript or JSX still needs to be named explicitly, and the Pages Router with webpack has two further cases — source outside the app directory, and a `node_modules` dependency you want bundled into the route rather than left external. Everything else is handled, which means most `transpilePackages` entries in an upgraded repo are now dead configuration.

**★ What is `outputFileTracingRoot` for, and what happens without it?**
Standalone output ships only the files Next.js traced as reachable, and the trace starts at the Next.js project root — the directory containing `next.config`, not the repository root. In a monorepo every shared package is above that directory, so none of them are traced and none are copied. The container builds, starts, and fails on the first import of a workspace package. Setting the tracing root to the repo root fixes it; the failure is easy to misdiagnose as a package-manager or Docker problem because the build itself succeeded.

**★ How do you stop a shared package's laxer TypeScript settings from failing an app's build?**
Recognise first that this is a consequence of Next.js 16 type-checking the whole `tsconfig` project through the `tsc` CLI, so it is not going away by tweaking Next.js. The documented mechanism is `typescript.tsconfigPath` pointing at a `tsconfig.build.json` that relaxes the specific check — the docs use `useUnknownInCatchVariables: false` as the example — while `tsconfig.json` stays strict for the editor. The real fix is to raise the shared package to the app's standard, and the config split is how you keep shipping while you do it.

**★ Why does the Compiled Package `exports` map point `types` at source and `default` at `dist`?**
Because the two conditions serve different consumers. TypeScript resolves `types` to decide what the package's API is, and pointing it at the original `.tsx` gives editors real source for go-to-definition, hover documentation and accurate error locations. The runtime resolves `default` and needs compiled JavaScript. Pointing both at `dist` works but degrades the developer experience to reading generated declarations; pointing both at source removes the reason to compile at all.

**★ A teammate proposes bundling every internal package with Rollup "for consistency". What is the argument against?**
The Turborepo docs' own position — the majority of compiled packages should use `tsc`, with a bundler only for specific needs. A bundler in an internal package adds a configuration file, a plugin chain, its own module-format decisions and a second source of resolution bugs, in exchange for benefits (tree-shaking a published artefact, multiple output formats, minification) that only matter when the package leaves the repository. Internal consumers are themselves bundled by the app, which does the tree-shaking anyway.

---

← [Turborepo: the task graph](04-monorepos-with-turborepo-shared-packages-remote-caching-ci-p.md) · [Chapter 13 overview](01-explanation.md) · Next → [Hashing, caching and poisoning](04c-hashing-caching-and-cache-poisoning.md)
