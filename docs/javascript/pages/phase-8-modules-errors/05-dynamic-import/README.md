---
title: "05 · Dynamic `import()`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`import()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import), [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [`import.meta`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta), [`<link rel="modulepreload">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/modulepreload) — and ECMAScript [§ `import` calls](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-import-calls). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *code splitting, conditional loading, and its promise semantics*.

🔴 **Static `import` is a declaration; `import()` is an expression.** The static form is the
module graph, hoisted and resolved before any code runs. The dynamic form is a decision made
*while the program is running* — and every property of it follows from that one difference.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The expression and its semantics](./01-the-expression.md)** | Why it is an operator and not a function; the module namespace object and `.default`; modules evaluated once with **failures remembered**; the error table and why load and init need separate `try`s; specifier resolution against `import.meta.url`; and import attributes |
| 02 | **[Code splitting in practice](./02-code-splitting.md)** | The static-analysis rule and the explicit loader map; where splitting actually pays; the waterfall, warming a load early, and `modulepreload`; chunk-load failures after a deploy and the reload-once fix; loading state as part of the feature; and what it buys on the server |

## Four facts worth carrying out of this topic

- **The promise resolves to the namespace object**, so the default export is `.default` — not the
  resolution value.
- **A module that throws at the top level is cached in that failed state.** Re-importing does not
  re-run it.
- **A specifier a bundler cannot read statically produces no chunk** — it works in development
  and 404s in production.
- **Chunk-load failures after a deploy are reloads, not retries.** The file is gone; only a fresh
  document has the new asset names.

## Phase gate

You can explain why `const fn = await import('./x.js')` gives you something uncallable, choose a
splitting boundary and defend it, and say what happens to a lazily loaded feature for a user whose
tab was open when you deployed.

## Where this connects

- [01 · Import and export](../01-es-modules/01-import-and-export.md) — the static form this
  contrasts with, and live bindings
- [02 · Singletons and strict](../02-module-semantics/01-singletons-and-strict.md) — the
  once-only evaluation that dynamic importing does not opt out of
- [02 · Deferred and hoisted](../02-module-semantics/02-deferred-and-hoisted.md) — why static
  imports are resolved before any code runs
- [Phase 7 · 08 · Try/catch around await](../../phase-7-async/08-error-handling/01-try-catch-around-await.md)
  — keeping the load and the call in separate `try` blocks
- [Phase 7 · 11 · Floating promises](../../phase-7-async/11-anti-patterns/02-floating-promises.md)
  — the warmed import nobody is awaiting yet
- [Phase 0 · 07 · Loading scripts](../../phase-0-how-javascript-runs/07-loading-scripts.md) — how
  a module script reaches the engine in the first place
- **06 · Circular imports** · **10 · Global error handling** · **13 · Bundlers and the build** ·
  **15 · CommonJS in a modern world** *(not written yet)*

---

Start → [01 · The expression and its semantics](./01-the-expression.md)
