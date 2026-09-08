---
title: "Vitest shares Vite's config object and transform pipeline, not just its philosophy — and a standalone vitest.config.ts replaces vite.config.ts rather than layering on it"
sidebar_label: "01 · The Vitest/Vite relationship"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vitest documentation — [Configuring Vitest](https://vitest.dev/config/), [Vitest 5.0 migration guide](https://vitest.dev/guide/migration.html), [`globals`](https://vitest.dev/config/globals). Peer range and Node floor probed against the installed npm registry metadata for `vitest` **5.0.0** (`npm view vitest peerDependencies` / `engines`). Documentation-validated; **no sandbox run, no timings**. Target: **Vitest 5.0.0 · Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Vitest reads Vite's config object, not a copy of it

**Vitest is not "a test runner that happens to be fast with Vite projects" — it is built directly on top of `vite`'s dev server and module graph, and it reads the exact same config file your app does.** That single fact is the reason a path alias you add to `resolve.alias` works in a test the moment you save the file, with nothing to keep in sync. It is also the reason a second config file, added carelessly, can silently throw away every plugin and alias your app config defines — because the two files do not merge by default, they *replace*. This chunk covers what "shared config" actually resolves to at three different places (`vite.config.ts`, `vitest.config.ts`, `mergeConfig`), the version range that makes the pairing meaningful, and the one line that turns Vitest's globals on without breaking TypeScript.

## Three ways to give Vitest a config, and only one file wins

Vitest does not layer configuration the way, say, `.eslintrc` overrides cascade. It picks **one file**.

> *"If you are using Vite and have a `vite.config` file, Vitest will read it to match with the plugins and setup as your Vite app."* — [Configuring Vitest](https://vitest.dev/config/)

That is the common case: add a `test` property to the existing `vite.config.ts` and Vitest reads the whole file — `plugins`, `resolve.alias`, `define`, everything — plus the `test` block for its own options.

```typescript
// vite.config.ts — one file for dev, build, AND test
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

TypeScript does not know `defineConfig` from `'vite'` accepts a `test` key — that type lives in `vitest/config`. Rather than importing `defineConfig` from a different package, augment the existing file with a triple-slash reference:

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
// ...the rest of the file is unchanged; `test` now type-checks.
```

### The second file, and what "higher priority" actually means

> *"Create `vitest.config.ts`, which will have the higher priority and will **override** the configuration from `vite.config.ts`"* — [Configuring Vitest](https://vitest.dev/config/)

Read that sentence literally: it does not say "merge with higher precedence for conflicting keys." A standalone `vitest.config.ts` present in the project root is read *instead of* `vite.config.ts` — the app's `plugins`, `resolve.alias`, and `define` are not merged in at all unless the new file explicitly imports and re-declares them. This is precisely the drift trap the seed page's Jest analogy was trying to describe, except it can now happen entirely inside the Vite ecosystem: someone adds `vitest.config.ts` to set one test-only option, and every alias and plugin the app relies on silently stops applying to tests.

### The fix: `mergeConfig`, not a second copy

> *"Vitest supports the same extension mechanism present in Vite config."* The documented pattern extends rather than duplicates:

```typescript
// vitest.config.ts — extends vite.config.ts, does not replace it
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: ['packages/template/*'],
    },
  }),
);
```

`mergeConfig` deep-merges the two config objects; `viteConfig`'s `plugins`, `resolve`, and `define` all still apply, and only the keys the second argument actually sets are added or overridden. The only correct reason to reach for a separate `vitest.config.ts` at all is when the *same* dev/build config must serve environments Vitest cannot run in the same process — e.g. a monorepo package with no `vite.config.ts` of its own, or a config that intentionally diverges. If the goal is "just a couple of test options," put a `test` block in the existing file instead; there is nothing a separate file buys you at that scale, and it is the one config split with no upside.

## The version pairing is load-bearing, not incidental

> *"Vitest 5.0 requires Vite >= 6.4.0 and Node.js >= 22.12.0."* — [Vitest 5.0 migration guide](https://vitest.dev/guide/migration.html)

Probed directly against the published package (`npm view vitest peerDependencies`, `vitest` **5.0.0**):

```json
{
  "vite": "^6.4.0 || ^7.0.0 || ^8.0.0",
  "jsdom": "*",
  "happy-dom": "*",
  "@vitest/ui": "5.0.0",
  "@types/node": "^22.0.0 || >=24.0.0",
  "@vitest/coverage-v8": "5.0.0",
  "@vitest/coverage-istanbul": "5.0.0",
  "@vitest/browser-playwright": "5.0.0",
  "@vitest/browser-webdriverio": "^5.0.0-beta.5 || >=5.0.0"
}
```

Vitest 5 sits comfortably inside Vite 8's major-version window, so the pairing this topic targets — Vitest 5.0.0 on Vite 8.2.2 — is squarely supported, not a bleeding-edge combination. The companion packages (`@vitest/coverage-v8`, `@vitest/coverage-istanbul`, `@vitest/ui`, the browser providers) are pinned to the **exact** `5.0.0` string rather than a range — a coverage or UI package one minor behind the core `vitest` package is a real, common source of an install that resolves but breaks at runtime.

## `globals: true` and the TypeScript types it needs

> *"By default, `vitest` does not provide global APIs for explicitness. If you prefer to use the APIs globally like Jest, you can pass the `--globals` option to CLI or add `globals: true` in the config."* — [`globals`](https://vitest.dev/config/globals)

Without it, every test file imports what it uses:

```typescript
import { describe, it, expect } from 'vitest';

describe('formatCurrency', () => {
  it('rounds to two decimal places', () => {
    expect(1).toBe(1);
  });
});
```

With `globals: true`, `describe`/`it`/`expect`/`vi` are ambient — closer to Jest's default and to what most copy-pasted examples assume. TypeScript needs to be told those globals exist, or every bare `describe`/`it` is a type error:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

If `typeRoots` has been customized away from the default, `node_modules` must stay in that list or `vitest/globals` will not resolve at all — the symptom is `describe`/`it` reporting as undefined in the editor even though the tests run fine from the CLI, because `tsc` and Vitest's own runtime resolve types and modules differently.

## Gotchas

**★ Symptom: a `vitest.config.ts` was added for one option, and every path alias the app relies on stops resolving in tests.** Cause: a standalone `vitest.config.ts` does not merge with `vite.config.ts` — the documentation is explicit that it has "higher priority" and will "override" it, which means *replace*, not layer. Fix: delete the standalone file's independent `plugins`/`resolve` and rebuild it with `mergeConfig`, importing the real `vite.config.ts`.
```typescript
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';
export default mergeConfig(viteConfig, defineConfig({ test: { environment: 'jsdom' } }));
```

**★ Symptom: `test` inside `vite.config.ts` is a TypeScript error — "Object literal may only specify known properties."** Cause: `defineConfig` imported from `'vite'` types against Vite's own config shape, which has no `test` key; the augmentation lives in `vitest/config`. Fix: add the triple-slash reference rather than switching the import (switching would pull in `vitest/config`'s `defineConfig`, which is also valid, but the reference-comment form changes nothing else about the file and is what the docs show for this exact case).
```typescript
/// <reference types="vitest/config" />
```

**★ Symptom: `describe` and `it` are "Cannot find name" errors in the editor, but `vitest run` passes.** Cause: `globals: true` is a runtime behavior Vitest injects at test-execution time; TypeScript's static check has no idea those names exist unless `vitest/globals` is in `compilerOptions.types`. Fix: add it, and if `typeRoots` was customized, confirm `node_modules` is still on that list.
```json
{ "compilerOptions": { "types": ["vitest/globals"] } }
```

**★ Symptom: `@vitest/coverage-v8` (or `-istanbul`, or `@vitest/ui`) throws a version-mismatch error at startup after bumping `vitest`.** Cause: those packages are pinned to the exact core version in `vitest`'s own `peerDependencies` (`"@vitest/coverage-v8": "5.0.0"`, not a range) — an independent `^` range in your own `package.json` can resolve a coverage package that is a minor behind. Fix: bump the companion packages in lockstep with `vitest`, or better, let a single version-manager (`npm-check-updates`, Renovate) treat them as one group.

**★ Symptom: CI installs cleanly but `vitest` refuses to run, or behaves inconsistently across two developers' machines.** Cause: Vitest 5.0's own Node floor (`^22.12.0 || ^24.0.0 || >=26.0.0`, probed via `npm view vitest engines`) is narrower than Vite 8's (`^20.19.0 || >=22.12.0`). A machine on Node 20.19–22.11 satisfies Vite 8 and fails Vitest 5 specifically. Fix: pin CI and local `.nvmrc`/`engines` to Vitest's floor, not Vite's, when both tools are in the same project — Vitest is the stricter constraint.

## Interview questions

**★ Why does adding a path alias to `vite.config.ts` "just work" in a Vitest test, with nothing added to the test config?**
Because Vitest does not maintain a parallel resolver — it reads the same `vite.config.ts` object and runs test files through the same module-transform pipeline the dev server uses for the app. `resolve.alias`, plugins, and `define` are Vite-level config that Vitest inherits by construction, the same way the dev server and the production build share it. There is no second place for the alias to be declared, so there is no place for it to drift out of sync — a structural guarantee, not a discipline someone has to maintain.

**★ A teammate adds `vitest.config.ts` to change one test timeout, and the next morning every test importing `@/components/...` fails to resolve. What happened, and what's the fix?**
`vitest.config.ts`, when present, has documented "higher priority" over `vite.config.ts` and overrides it — it does not merge. The new file's minimal `test` block became the *entire* configuration Vitest saw; the app's `resolve.alias` for `@` was never re-declared, so the alias vanished for tests only, not for the dev server or the build (which still read `vite.config.ts` directly). The fix is `mergeConfig(viteConfig, defineConfig({ test: { testTimeout: 10_000 } }))`, importing the real config rather than starting a parallel one.

**★ Why does Vitest 5 pin its own coverage and UI packages to an exact version string in `peerDependencies` rather than a caret range?**
Because those packages ship in lockstep with `vitest` core and communicate over an internal, non-semver-stable protocol between the runner and the reporter/coverage collector — a coverage package a minor version behind can be structurally incompatible with what the core package expects to send it, in a way a caret range would not protect against. Pinning the exact string forces the package manager to flag the mismatch at install time instead of at first test run.

**★ Why would you ever want a `vitest.config.ts` separate from `vite.config.ts`, given the override trap?**
Two legitimate cases: a package in a monorepo that has tests but no `vite.config.ts` of its own (nothing to merge with), or a workspace project entry that is deliberately meant to diverge from the root config rather than extend it. Outside those, a separate file only exists to hold a `test` block, and a `test` block belongs directly in `vite.config.ts` — the separate-file form is strictly more code (an extra file, an extra `mergeConfig` call) for the same result, with a failure mode the single-file form cannot have at all.

---

← [01d · TypeScript for workers & WASM](../13-worker-and-wasm-support/01d-typescript-for-workers-and-wasm.md) · [Vite overview](../../README.md) · Next → [01a · The transform boundary](01a-the-transform-boundary.md)
