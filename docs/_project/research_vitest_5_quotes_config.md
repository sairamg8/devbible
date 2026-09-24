---
name: research-vitest-5-quotes-config
description: Verbatim Vitest 5.0.0 quotes, part 1 of 2 — peer range against Vite 8, config resolution (test block vs vitest.config.ts vs mergeConfig), the server.deps/deps.optimizer transform boundary, environments, globals, setupFiles vs globalSetup. Banked by agent D of batch 3, 2026-09-08. Part 2 is [[research-vitest-5-quotes-runtime]]. Do NOT re-derive.
metadata:
  type: project
---

vite: '^6.4.0 || ^7.0.0 || ^8.0.0'
jsdom: '*'
happy-dom: '*'
@vitest/ui: '5.0.0'
@types/node: '^22.0.0 || >=24.0.0'
@edge-runtime/vm: '*'
@opentelemetry/api: '^1.9.0'
@vitest/coverage-v8: '5.0.0'
@vitest/browser-preview: '5.0.0'
@vitest/coverage-istanbul: '5.0.0'
@vitest/browser-playwright: '5.0.0'
@vitest/browser-webdriverio: '^5.0.0-beta.5 || >=5.0.0'

Migration guide (T0): "Vitest 5.0 requires Vite >= 6.4.0 and Node.js >= 22.12.0."
(https://vitest.dev/guide/migration.html) -- consistent with the wider peer range above
(the peer range top-bounds at 8.0.0, floor 6.4.0).

playwright installed/registry version: 1.63.0 (npm view playwright version)
webdriverio: 4.1.11 (probably package split, confirm before citing precisely)
jsdom: 30.0.1
happy-dom: 20.14.0

## Config resolution — vite.config.ts `test` block vs vitest.config.ts vs mergeConfig
Source: https://vitest.dev/config/ and raw docs/config/index.md on GitHub main branch.

> "If you are using Vite and have a `vite.config` file, Vitest will read it to match
> with the plugins and setup as your Vite app."

> "Create `vitest.config.ts`, which will have the higher priority and will **override**
> the configuration from `vite.config.ts`"
-- i.e. NOT merged. A standalone vitest.config.ts REPLACES vite.config.ts wholesale,
it does not layer on top. This is the drift trap the dispatch names.

Triple-slash type augmentation for putting `test` inside vite.config.ts:
```
/// <reference types="vitest/config" />
```

mergeConfig pattern (verbatim from docs/config/index.md):
```js
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    exclude: ['packages/template/*'],
  },
}))
```

## The transform boundary: server.deps vs deps.optimizer
Source: https://vitest.dev/config/server, https://vitest.dev/config/deps

server.deps.external:
> modules bypass Vite transformation; "These modules are imported via native dynamic
> `import` and bypass both transformation and resolution phases."
> Default: files inside moduleDirectories (typically node_modules).

server.deps.inline:
> "These modules are run by Vite's module runner." (i.e. go through Vite's transform —
> TS/JSX stripping, plugins, resolve.alias, define)
> Default: everything that is NOT externalized.

So: default behaviour = node_modules packages run RAW through Node's native `import`
(no Vite transform, no alias rewriting inside them); your own source and anything you
add to `deps.inline` gets the full Vite pipeline (transforms, plugins, define).

deps.optimizer (test.deps.optimizer) — SEPARATE mechanism, off by default:
> "Enable dependency optimization. If you have a lot of tests, this might improve their
> performance."
> "When Vitest encounters the external library listed in `include`, it will be bundled
> into a single file using esbuild and imported as a whole module."
> "This options also inherits your `optimizeDeps` configuration (for web Vitest will
> extend `optimizeDeps`, for ssr - `ssr.optimizeDeps`)."
> Default: `false` for deps.optimizer.{mode}.enabled (both web/client and ssr).
> "By default, Vitest uses `optimizer.client` for `jsdom` and `happy-dom` environments,
> and `optimizer.ssr` for `node` and `edge` environments."

🔴 NOTE: the docs literally say "bundled ... using esbuild" for deps.optimizer, even
though Vite 8's own dev-server optimizeDeps now runs on Rolldown (confirmed by
01a-dependency-pre-bundling.md in this same repo, and Vite 8 migration guide:
"Rolldown is now used for dependency optimization instead of esbuild."). I could not
find any vitest.dev page that reconciles this — the deps.optimizer page for v5 still
names esbuild specifically, with no mention of "rolldown" anywhere on that page (checked
explicitly). Written on the page as: Vitest's OWN test-time dependency optimizer is a
separate mechanism from Vite 8's dev-server optimizeDeps, and as of this fetch (2026-09-08)
its own docs still describe it as esbuild-based — stated as what the docs say, flagged
uncertain whether that's current behavior or stale prose.

deps.interopDefault: "Interpret CJS module's default as named exports." Default: true.

deps.moduleDirectories: "A list of directories that should be treated as module
directories." Affects `vi.mock` behavior; "if a file should be treated as a module when
externalizing dependencies." Default: ['node_modules'].

## Environments
Source: https://vitest.dev/config/environment

> "The environment that will be used for testing. The default environment in Vitest is
> a Node.js environment."
Type: `'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string`, default `'node'`.

> "If you are building a web application, you can use browser-like environment through
> either jsdom or happy-dom instead. If you are building edge functions, you can use
> edge-runtime environment."

Per-file docblock:
```
/**
 * @vitest-environment jsdom
 */
```
> "For compatibility with Jest, there is also a `@jest-environment`" (alias supported).

Custom environments:
> "When non-builtin environment is used, Vitest will try to load the file if it's
> relative or absolute, or a package `vitest-environment-${name}`, if the name is a
> bare specifier."

TS support: "If you want TypeScript to recognize it, you can add `vitest/jsdom` to your
`tsconfig.json` when you use this environment." (jsdom-specific triple-slash-equivalent
types entry.)

jsdom/happy-dom descriptions (guide/environment.html):
> jsdom "emulates browser environment by providing Browser API, uses jsdom package"
> happy-dom "emulates browser environment by providing Browser API, and considered to
> be faster than jsdom, but lacks some API, uses happy-dom package"
No install command was quoted on that page; they are separate npm packages you add
yourself (peerDependencies list them as '*' — any version).

### environmentMatchGlobs / poolMatchGlobs — REMOVED in Vitest 4
(web search of GitHub issues/PRs + Vitest 4 migration coverage, corroborated by the
option's total absence from the current /config/environment page, which I confirmed
does not mention it)
- Deprecated in Vitest 3: "environmentMatchGlobs" is deprecated. Use "workspace" to
  define different configurations instead.
- Removed in Vitest 4.0.0, per release notes coverage: "environmentMatchGlobs and
  poolMatchGlobs were removed as part of Vitest 4.0.0."
- Replacement path: `workspace` (v3) -> `projects` (current name in v4/v5 per the v5
  migration guide's own "test.projects" language, e.g. "every project defined as an
  inline configuration in test.projects inherits all options from the root
  configuration").
I did NOT find a vitest.dev primary-source page stating this removal in as many words
(no dedicated "removed in 4.0" changelog page fetched) — this is corroborated via
GitHub PR titles and third-party coverage of the v4 release, not a vitest.dev quote.
Flag as: confirmed absent from current docs + corroborated by GitHub, not directly
quoted from vitest.dev prose.

## globals
Source: https://vitest.dev/config/globals
> "By default, `vitest` does not provide global APIs for explicitness. If you prefer to
> use the APIs globally like Jest, you can pass the `--globals` option to CLI or add
> `globals: true` in the config."
tsconfig: add `"vitest/globals"` to `compilerOptions.types`. If `typeRoots` is
customized, keep `node_modules` included so `vitest/globals` resolves.

## setupFiles vs globalSetup
Source: https://vitest.dev/config/setupfiles, https://vitest.dev/config/globalsetup

setupFiles:
> "Paths to setup files resolved relative to the root."
> "They will run before each _test file_ in the same process."
> "Note that setup files are executed in the same process as tests, unlike globalSetup
> that runs once in the main thread before any test worker is created."
> "Editing a setup file will automatically trigger a rerun of all tests."

globalSetup:
> setup executes "before the test workers are created and only if there is at least
> one test queued"; teardown "after all test files have finished running."
> runs "in a different global scope before test workers are even created"
> "Your tests don't have access to global variables defined here" — share data via
> `provide`/`inject` instead (serializable only).
> "a global setup file can either export named functions `setup` and `teardown` or a
> `default` function that returns a teardown function."
> multiple global setup files "are executed sequentially."

