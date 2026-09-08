---
title: "Sharing Vite's transform pipeline stops at node_modules by default — server.deps.external means raw Node import, and test.deps.optimizer is a third, off-by-default mechanism that is neither"
sidebar_label: "01a · The transform boundary"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the Vitest documentation — [`server.deps`](https://vitest.dev/config/server), [`deps`](https://vitest.dev/config/deps). Documentation-validated; **no sandbox run, no timings**. Target: **Vitest 5.0.0 · Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Which files actually go through Vite, and which are loaded raw

**"Vitest reuses Vite's transform pipeline" is true, and it is also the sentence people over-generalize from — because by default it is true for your source and false for `node_modules`.** A dependency in `node_modules` is, by default, imported by Node's own native `import`, not compiled through Vite's plugin pipeline at all. That single default explains almost every "works in the browser, throws in a test" report on a Vite+Vitest project, and it is controlled by an option most people never look at because their tests never needed it — until a dependency ships ESM-only syntax Node's `import` cannot parse, or a plugin transform that only the browser build sees.

## `server.deps.external` and `server.deps.inline` — the actual boundary

> *"These modules are imported via native dynamic `import` and bypass both transformation and resolution phases."* — [`server.deps.external`](https://vitest.dev/config/server)

> Default: files inside [`moduleDirectories`](https://vitest.dev/config/deps) — in practice, `node_modules`.

> *"These modules are run by Vite's module runner."* — [`server.deps.inline`](https://vitest.dev/config/server)

> Default: everything that is **not** externalized.

Put the two together and the default split is exactly this:

```text
your source code, and anything explicitly added to deps.inline
        │
        ▼
   Vite's module runner  ──►  full transform: TS/JSX stripping, plugins, resolve.alias, define
                              (identical to what the dev server does)

node_modules (default), matched via moduleDirectories
        │
        ▼
   Node's native dynamic import()  ──►  no plugin runs, no alias rewriting, no `define` substitution
                                        the file is loaded exactly as it is written on disk
```

This is why a custom Vite plugin that transforms a special import suffix, or a `define` replacement for a global, works for every file in `src/` inside a test — and silently does nothing for the same pattern inside a `node_modules` package, because that package's code never passed through the plugin at all. It is not that the plugin "doesn't run under Vitest"; it never sees that file, by design, for every dependency that has not been pulled into `deps.inline`.

### Why the default is "externalize `node_modules`," not "inline everything"

Running every dependency through Vite's transform pipeline on every test run would mean re-transforming packages that never change, on every test process, for no correctness benefit in the common case — most published packages are already plain, valid JavaScript that Node can `import` or `require` without help. Externalizing is the fast path; inlining is the fallback for the packages that are not plain JavaScript as far as Node is concerned.

### When a package needs to be pulled into `deps.inline`

The signal is always a failure that traces back to `node_modules`, because that is the one place the transform is skipped:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    server: {
      deps: {
        // this package ships TypeScript or JSX source directly, with no compiled
        // output — Node cannot import it raw; it needs Vite's transform.
        inline: ['some-untranspiled-design-system'],
      },
    },
  },
});
```

Common real triggers: a monorepo package that is symlinked into `node_modules` and intentionally ships uncompiled `.ts`/`.tsx` source (common with `workspace:*` protocols and no build step), a package that only works when passed through a specific plugin your app's `vite.config.ts` already declares, or a package using an import syntax newer than the installed Node version supports natively.

## `test.deps.optimizer` — a third, unrelated, off-by-default mechanism

The name invites confusion with `server.deps`, and it does something different: it is Vitest's own dependency **bundler for the test run**, modeled on (and inheriting from) Vite's dev-server `optimizeDeps`, but it is a separate step with its own default.

> *"Enable dependency optimization. If you have a lot of tests, this might improve their performance."* — [`deps.optimizer`](https://vitest.dev/config/deps)

> *"When Vitest encounters the external library listed in `include`, it will be bundled into a single file using esbuild and imported as a whole module."*

> *"This option also inherits your `optimizeDeps` configuration (for web Vitest will extend `optimizeDeps`, for ssr - `ssr.optimizeDeps`)."*

> Default: `false`, for both `deps.optimizer.web.enabled` and `deps.optimizer.ssr.enabled`.

```typescript
// vitest.config.ts — turning on the test-time optimizer for jsdom-environment tests
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    deps: {
      optimizer: {
        // 'web' backs jsdom/happy-dom environments; 'ssr' backs node/edge-runtime.
        web: {
          enabled: true,
          include: ['a-ui-library-with-hundreds-of-internal-modules'],
        },
      },
    },
  },
});
```

> *"By default, Vitest uses `optimizer.client` for `jsdom` and `happy-dom` environments, and `optimizer.ssr` for `node` and `edge` environments."*

🔴 **The docs describe this bundling step as using esbuild specifically** — *"it will be bundled into a single file using esbuild"* — with no mention of Rolldown anywhere on that reference page (checked directly). That is notable given Vite 8's own dev-server dependency pre-bundling switched engines: *"Rolldown is now used for dependency optimization instead of esbuild"* per Vite 8's migration guide (covered in this track's **[Dependency pre-bundling](../11-optimization-and-performance/01a-dependency-pre-bundling.md)**). Vitest's `deps.optimizer` is a separate code path from Vite's dev-server `optimizeDeps` — it inherits your `optimizeDeps` *configuration*, not the machinery that runs it — and as of this fetch the Vitest 5 documentation still names esbuild for its own step. Whether that is current behavior or documentation lagging Vitest's internal engine choice is **not something I could confirm from the docs alone**; treat "esbuild" here as what the reference states, not as a claim independently re-verified against Vitest's source.

The three settings this page covers are genuinely orthogonal — mixing them up is the single most common mistake in this area:

| Setting | Default | What it controls |
|---|---|---|
| `server.deps.external` | `node_modules` (via `moduleDirectories`) | Loaded raw by Node's native `import`, no Vite involvement |
| `server.deps.inline` | everything not externalized | Runs through Vite's module runner — transforms, plugins, alias, `define` |
| `deps.optimizer.{web,ssr}.enabled` | `false` | A separate, opt-in step that pre-bundles listed dependencies into one file for faster test startup — a performance lever, not a correctness one |

## `deps.interopDefault` and `deps.moduleDirectories`

> *"Interpret CJS module's default as named exports."* — [`deps.interopDefault`](https://vitest.dev/config/deps), default `true`.

This is why `import { foo } from 'a-cjs-package'` frequently works in a test even for a package that only ever does `module.exports = { foo }` — Vitest, like Vite's own CJS interop, treats the CJS default export's properties as if they were named ESM exports, matching what a bundler-aware runtime does with the same package in the browser.

> *"A list of directories that should be treated as module directories."* — [`deps.moduleDirectories`](https://vitest.dev/config/deps), default `['node_modules']`.

This list is what `server.deps.external`'s default actually resolves against, and it also *"affects `vi.mock` behavior"* and *"if a file should be treated as a module when externalizing dependencies."* A monorepo using a non-standard vendor directory (`vendor/`, a custom workspace layout) needs that directory added here, or Vitest's externalize-by-default logic will not recognize packages living there as externalizable dependencies at all — they will instead be treated as project source and run through the full transform, which is usually not what a vendored, pre-built dependency needs or wants.

## Gotchas

**★ Symptom: an import that resolves and runs fine in the browser throws a syntax error, or the wrong export shape, only inside a Vitest test.** Cause: the failing module lives in `node_modules` and is therefore, by default, loaded via Node's native `import` with zero Vite involvement — no plugin, no `define`, no alias rewriting reaches it. The browser build passed the same file through Vite's (or Rolldown's) full pipeline; the test did not. Fix: add the package to `server.deps.inline`.
```typescript
test: { server: { deps: { inline: ['the-offending-package'] } } }
```

**★ Symptom: a custom Vite plugin that rewrites a special import suffix (`?raw`, `?worker`, a project-specific one) works for app code but is silently ignored for the same suffix used inside a dependency.** Cause: the plugin's `transform` hook only ever sees files Vite's module runner processes — by default that excludes everything in `node_modules`. Fix: either inline that specific dependency, or, if the pattern is common across many dependencies, reconsider whether the transform belongs in a plugin `resolveId`/`load` pair that can run before externalization is decided, rather than in `transform`.

**★ Symptom: turning on `deps.optimizer` made test startup faster once, then a later run behaves as though the change did nothing.** Cause: `deps.optimizer` is off by default (`enabled: false`) precisely because most projects do not need it — it exists for large dependency graphs where bundling many small ESM files once genuinely saves start-up time, the same problem Vite's own dev-server pre-bundling solves for the browser (see **[Dependency pre-bundling](../11-optimization-and-performance/01a-dependency-pre-bundling.md)**). If the dependency set the option targets is small, the win is small too. Fix: measure before reaching for it; it is a performance knob, not a correctness fix for anything covered by `server.deps`.

**★ Symptom: `deps.optimizer.web.enabled: true` and `deps.optimizer.ssr.enabled: true` are both set, and only one seems to have any effect.** Cause: `web` (aliased in docs prose to "client") backs `jsdom`/`happy-dom` environments; `ssr` backs `node`/`edge-runtime` environments. A single test file only runs under one `environment` at a time, so only the matching optimizer mode is ever exercised by that file. Fix: check which `environment` the affected test actually runs under (including any per-file `// @vitest-environment` override) before assuming the optimizer setting itself is broken.

**★ Symptom: a vendored, pre-built dependency living outside `node_modules` (a `vendor/` directory, a non-standard monorepo layout) gets fully re-transformed by Vite on every test run, and it is slow.** Cause: `server.deps.external`'s default only recognizes directories listed in `deps.moduleDirectories`, which defaults to `['node_modules']` alone — anything outside that list is treated as project source, not as an externalizable dependency. Fix: add the real directory.
```typescript
test: { deps: { moduleDirectories: ['node_modules', 'vendor'] } }
```

**★ Symptom: `import { helper } from 'a-cjs-only-package'` works even though the package only defines `module.exports = { helper }`.** Cause: `deps.interopDefault` defaults to `true` — Vitest treats a CJS module's default export's own properties as though they were named ESM exports, the same interop bundlers apply. Fix: nothing to fix; this is expected. If it is ever turned off, every such named import across the dependency graph needs auditing at once, not just the one that happened to be touched.

## Interview questions

**★ "Vitest shares Vite's transform pipeline." Is that true for every file the test imports?**
No — it is true by default only for the test's own source and anything explicitly pulled into `deps.inline`. `node_modules` is externalized by default, meaning it is loaded through Node's native `import`, bypassing Vite's transform, plugins, `resolve.alias`, and `define` entirely. "Shares the pipeline" is correct for the code you wrote; it is the wrong mental model for the code you installed, and the gap between those two is exactly where dependency-related test failures come from that have no browser-side equivalent.

**★ A dependency works when imported by the app in the browser and throws when the same import runs inside a Vitest test. Where do you look first?**
Whether the failing file lives in `node_modules`. If it does, the default externalization means it was loaded raw by Node, not through Vite's pipeline the way the browser build processes it — the two environments are not actually running the same transformed code, despite "shared config." The fix, if the package genuinely needs Vite's transform (uncompiled TS/JSX source, a plugin-dependent format), is `server.deps.inline`, not rewriting the import or excluding the package from some other list.

**★ What is the actual difference between `server.deps.inline` and `deps.optimizer`, given both sound like they're about "handling dependencies"?**
`server.deps.inline` is a correctness switch: it decides whether a module is transformed by Vite at all before it runs. `deps.optimizer` is a performance switch, off by default, that bundles a chosen set of externalized dependencies into a single file with esbuild to cut down the number of modules Node has to resolve and load at test startup — it does not change *whether* a dependency is transformed by Vite's plugin pipeline, only how efficiently the already-externalized path is loaded. Confusing the two leads to reaching for `deps.optimizer` to fix an import error it was never built to fix.

**★ Why is `node_modules` externalized by default instead of inlined, given that inlining seems "safer"?**
Because most installed packages are already valid, plain JavaScript that Node's native `import` handles correctly and quickly, and passing every dependency through Vite's transform pipeline on every test run would cost real startup time for no benefit in the common case. Externalizing is the fast, correct-by-default path; `deps.inline` exists precisely for the minority of packages — uncompiled monorepo siblings, packages needing a specific plugin, packages using syntax the installed Node cannot parse — where that default assumption is wrong.

---

← [01 · The Vitest/Vite relationship](01-vitest-relationship.md) · [Vite overview](../../README.md) · Next → [01b · Environments](01b-environments.md)
