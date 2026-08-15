---
title: "15 · CommonJS in a modern world"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against the Node.js documentation — [Modules: CommonJS modules](https://nodejs.org/api/modules.html), [Modules: ECMAScript modules](https://nodejs.org/api/esm.html), [Packages § `exports`](https://nodejs.org/api/packages.html#exports) — and the TypeScript reference [`esModuleInterop`](https://www.typescriptlang.org/tsconfig/esModuleInterop.html). Documentation-validated; **no runs, no timings, no console blocks**. ⚠️ Version numbers move — check your own runtime's docs before depending on a boundary version.

The syllabus row is *`require`/`module.exports`, interop through a bundler, and why you still meet
it*.

🔴 **The one sentence that explains every difference: `require` is a function call, `import` is a
declaration.** One is resolved while the program runs; the other is resolved before it starts.
Module scope, `__dirname`, cycles, caching, tree shaking and every interop error below are
consequences of that single fact.

⚠️ **Know tier — this is for reading CommonJS and surviving the boundary**, not for writing new
CommonJS.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The CommonJS model](./01-the-commonjs-model.md)** | The five-parameter **module wrapper** and the five consequences that fall straight out of it — module scope, top-level `this` being `module.exports`, `require` as an ordinary callable, `__filename`/`__dirname` as parameters, synchronous execution; 🔴 **`exports` versus `module.exports`** and the silent empty-object bug; caching **by resolved filename** and the two ways one module becomes two; `require.cache` as a debugging tool only, and why it is not the cache `import` uses; and cycles returning an **unfinished copy** rather than an error |
| 02 | **[Interop, both ways](./02-interop-both-ways.md)** | Importing CJS from ESM — default is `module.exports`, named imports are a **heuristic best-effort** and the run-time destructuring fallback; `require(esm)` and its hard condition, **synchronous modules only** or `ERR_REQUIRE_ASYNC_MODULE`; what ESM does not have and the replacement for each (`import.meta.dirname`/`filename`/`resolve`/`main`, `createRequire`); the `new URL('./x', import.meta.url)` idiom; **`__esModule` and the default import that is not there**, with TypeScript's `esModuleInterop` as the documented version; and the **dual-package hazard** |

## Five facts worth carrying out of this topic

- **Assigning to `exports` exports nothing.** Assign to `module.exports` when replacing.
- **The cache key is the resolved filename**, so one module can exist twice in one process.
- **CommonJS cycles hand you an unfinished object**; ESM cycles hand you a TDZ error.
- **Named imports from CommonJS are detected heuristically** — default-import and destructure when
  the guess fails.
- **`require` cannot load an ES module that uses top-level `await`.** That is what `import()` is for.

## Phase gate

You can read a CommonJS file and say what it exports and when; explain why one library appears twice
in a process; choose correctly between a named import, a default import and `createRequire` at an
interop boundary; and recognise `does not provide an export named`,
`ERR_REQUIRE_ASYNC_MODULE` and a broken default import on sight.

## Where this connects

- [01 · Import and export](../01-es-modules/01-import-and-export.md) — the static structure
  CommonJS does not have
- [02 · Singletons and strict mode](../02-module-semantics/01-singletons-and-strict.md) — one
  instance per module, and what "one" means when there are two caches
- [06 · Circular imports](../06-circular-imports/01-what-happens.md) — the ESM half of the cycle
  comparison
- [05 · The expression](../05-dynamic-import/01-the-expression.md) — `import()`, the only loader
  that always works across the boundary
- [13 · What a bundler does](../13-bundlers-and-the-build/01-what-a-bundler-does.md) — the `exports`
  map and conditions that decide which build you get
- [13 · Tree shaking](../13-bundlers-and-the-build/02-tree-shaking.md) — why a CommonJS dependency
  cannot be shaken
- [08 · Cause chains and boundaries](../08-custom-error-classes/02-cause-chains-and-boundaries.md) —
  why `instanceof` is the wrong test once a package can be loaded twice

---

Start → [01 · The CommonJS model](./01-the-commonjs-model.md)
