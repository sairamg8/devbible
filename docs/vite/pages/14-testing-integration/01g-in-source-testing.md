---
title: "import.meta.vitest lets a test live next to the function it tests, and it is only safe in production because define replaces it with undefined at build time, not because Vitest strips it"
sidebar_label: "01g · In-source testing"
sidebar_position: 8
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-08 against the [In-Source Testing guide](https://vitest.dev/guide/in-source.html). Documentation-validated; **no sandbox run**. Target: **Vitest 5.0.0 · Vite 8.2.2**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ The test never ships — because `define` deletes it, not because it's a test

**In-source testing puts the test directly in the same file as the code it exercises, guarded by `import.meta.vitest`, and the reason it never reaches production has nothing to do with Vitest recognizing "this is a test" — it is an ordinary `define` string replacement plus dead-code elimination, the exact same mechanism that strips any other build-time constant.** Getting the `define` config wrong does not fail loudly; it ships the test code (and its imports) straight into the production bundle.

## What it is, and the pattern

> *"Vitest provides a way to run tests within your source code along side the implementation, similar to Rust's module tests."* — [In-Source Testing guide](https://vitest.dev/guide/in-source.html)

```typescript
// src/utils/add.ts
export function add(a: number, b: number): number {
  return a + b;
}

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;
  it('add', () => {
    expect(add(1, 2)).toBe(3);
  });
}
```

`import.meta.vitest` is truthy only when the file is executing under Vitest; the guide's documented scope for this pattern is narrow and deliberate:

> recommended for *"unit testing for small-scoped functions or utilities"* rather than component or end-to-end scenarios.

## `includeSource` — telling Vitest to look inside source files at all

By default, Vitest's own `include` pattern only looks at files that look like tests. In-source tests live in ordinary source files, so Vitest needs to be told to scan those too:

```typescript
// vite.config.ts
export default defineConfig({
  test: {
    includeSource: ['src/**/*.{js,ts}'],
  },
});
```

Without `includeSource` naming the source files, the `if (import.meta.vitest)` block is dead code as far as the test runner is concerned — it never runs, and no failure is reported, because Vitest never looked at the file to find it.

## Stripping it from the production build — the part that is not automatic

Nothing about `import.meta.vitest` disappears from the file just because a production build, rather than Vitest, is processing it. It is ordinary code that a bundler will happily include unless told otherwise. The documented mechanism is a `define` replacement:

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    'import.meta.vitest': 'undefined',
  },
});
```

> This lets *"the bundler do the dead code elimination"* — `define` performs a literal text substitution of `import.meta.vitest` with the string `undefined` at build time, and once that substitution has happened, `if (undefined) { ... }` is a block a minifier's dead-code elimination pass can — and will — remove entirely, imports and all, because it is statically unreachable.

The documentation names this same requirement across every bundler this pattern might be built with, not just Vite: *"Similar define/replace configurations are needed for Rollup, webpack, Rolldown, and unbuild."* The mechanism (a build-time constant substitution enabling dead-code elimination) is generic; only the config surface for expressing it changes per tool.

## Why "it's guarded by an `if`" is not, by itself, a safety net

The `if (import.meta.vitest)` guard only prevents the test code from *running* in production — `import.meta.vitest` is `undefined` at runtime outside Vitest regardless of whether `define` ever ran, so the branch is never entered. What `define` plus dead-code elimination additionally buys is that the code, and everything it imports, is not merely unreachable but **absent from the shipped bundle** — smaller output, and no accidental exposure of test-only imports (a testing library, fixture data, an internal helper never meant to ship) in the production artifact. Skipping the `define` step leaves the guard doing only half its job: correctness is preserved, but bundle size and dependency surface are not.

## A known limitation with assertion-style checks

> *"a limitation when using assertion functions such as `assert` in in-source tests"*, with a workaround pointed at the API documentation rather than spelled out in the guide itself — treat this as a real, named limitation whose exact workaround needs checking against the current `assert` API docs before relying on it, rather than assuming Node's or Vitest's `assert` behaves identically inside an in-source block as it does in a normal test file.

## Gotchas

**★ Symptom: an `if (import.meta.vitest)` block runs fine locally under Vitest, and after a production build, the deployed bundle still contains the test code, its assertions, and its imports.** Cause: `import.meta.vitest` is ordinary code as far as a production build is concerned — nothing strips it automatically; the guard being falsy at runtime prevents the block from *executing*, but not from being *present* in the shipped file, unless `define` explicitly replaces it with `undefined` so a minifier's dead-code elimination can remove the whole branch. Fix: add the `define` entry for every build tool in the pipeline, not just Vite.
```typescript
define: { 'import.meta.vitest': 'undefined' }
```

**★ Symptom: an in-source test block is written correctly, `import.meta.vitest` is truthy under `vitest run` locally, but the test never appears in Vitest's reported test count.** Cause: `includeSource` was never configured, so Vitest's file-discovery step never looked inside ordinary source files for `import.meta.vitest` blocks in the first place — the block is not failing, it is simply never being found. Fix: add the source glob to `includeSource`.
```typescript
test: { includeSource: ['src/**/*.{js,ts}'] }
```

**★ Symptom: the production bundle is only slightly smaller than expected after adding `define: { 'import.meta.vitest': 'undefined' }`, and a testing-library import still shows up in the dependency graph analysis.** Cause: `define` alone performs the text substitution; dead-code elimination — the step that actually removes the now-unreachable `if (undefined)` block and drops its imports — is a separate pass the minifier/bundler performs, and it needs to run with minification/tree-shaking enabled to have any effect. Fix: confirm the build is running in production mode with minification on; a dev-mode or unminified build may substitute the constant without ever eliminating the now-dead branch.

**★ Symptom: an in-source test grows into something that needs a DOM, a mock server, or multiple describe blocks, and the source file it lives in becomes hard to read.** Cause: the pattern's documented scope is narrow — *"unit testing for small-scoped functions or utilities"* — and stretching it to component or integration-level testing works against the entire premise of colocating a small, fast check next to the function it verifies. Fix: move the test out to a conventional `*.test.ts` file once it needs setup beyond a couple of `it` blocks and a direct function call; in-source testing is for the pure-utility case, not a replacement for the rest of the test suite.

**★ Symptom: an in-source test using `assert`-style checks (rather than `expect`) behaves unexpectedly.** Cause: the documentation names a specific, real limitation around assertion functions in this context without detailing it in the guide itself. Fix: check the current `assert` API documentation for the exact workaround before relying on assertion-function-style checks in an in-source block; do not assume parity with a normal test file's `assert` behavior.

## Interview questions

**★ Why isn't `if (import.meta.vitest)` enough, on its own, to keep test code out of a production bundle?**
Because the `if` guard only controls whether the block *executes* — `import.meta.vitest` being `undefined` outside Vitest already guarantees the branch never runs, with or without `define`. What the guard does not control is whether the block, and everything it imports, is *present* in the built file at all. A bundler has no special knowledge that this particular `if` is a test guard; it only removes unreachable code once something makes the condition statically knowable as false, which is exactly what `define: { 'import.meta.vitest': 'undefined' }` provides — after that substitution, the block becomes literally `if (undefined) {...}`, which dead-code elimination can prove unreachable and delete, imports included.

**★ Why does the `define` requirement apply the same way across Vite, Rollup, webpack, Rolldown, and unbuild, when those are different tools?**
Because the underlying mechanism — replace a known expression with a literal constant at build time, then let dead-code elimination remove the now-unreachable branch — is generic to bundlers in general, not specific to any one of them. Each tool exposes its own config surface for expressing "replace this expression with this value" (`define` in Vite/esbuild-family tools, plugin-based approaches elsewhere), but the requirement is the same: without that substitution, none of these bundlers has any reason to treat `import.meta.vitest` as anything other than an ordinary runtime expression that might be truthy, and so none of them can safely eliminate the branch.

**★ When is in-source testing the right call, versus writing a conventional `*.test.ts` file next to the source?**
When the thing under test is a small, pure, self-contained utility function where the test is genuinely trivial to colocate — a handful of `it` blocks calling the function directly, no DOM, no mocked server, no multi-step setup. The value proposition is proximity: the test travels with the function through refactors and is impossible to "forget" because it lives in the same file. The moment a test needs its own setup, its own environment, or grows past a couple of assertions, the colocation stops paying for itself and starts making the source file harder to read — that is the signal to move it to a conventional test file instead.

---

← [01f · Coverage providers](01f-coverage.md) · [Vite overview](../../README.md) · Next → [01h · CI, pool, and reporters](01h-ci-execution-and-reporters.md)
