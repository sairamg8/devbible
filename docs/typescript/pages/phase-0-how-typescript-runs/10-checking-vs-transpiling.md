---
title: "Checking is not transpiling"
sidebar_label: "10 · Checking vs transpiling"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 with **esbuild 0.28.2**, **TypeScript 7.0.2**, **Node
> 24.19.0**. Console output from `sandbox/ts-p0/ex7-transpile-vs-check.sh`.

**A transpiler reads one file at a time. A checker reads the whole program.**
That single structural difference explains why esbuild is orders of magnitude
faster, why it can never type-check, and why `isolatedModules` exists.

[03 · The three ways to run TypeScript](./03-three-ways-to-run.md) covered *which
tool to use*. This page is *why they cannot be the same tool*.

## One file versus the whole program

To emit JavaScript for `cart.ts`, a transpiler needs to know only what `cart.ts`
looks like: delete annotations, rewrite syntax to the target, done. It never
opens `types.ts`.

To decide whether `cart.total` is a `number`, the checker must load `types.ts`,
follow its imports, resolve `node_modules`, apply `tsconfig.json`, and build a
type graph over all of it — before it can judge one line.

| | Transpiler | Checker |
|---|---|---|
| Unit of work | one file | the whole program |
| Needs imports resolved | no | yes |
| Parallelisable per file | trivially | no — the graph is shared |
| Can be wrong about your intent | no (it does not have one) | that is the entire job |

Speed is not cleverness. It is scope.

## The demonstration

```ts
// src-ex7/bad.ts
interface Cart { items: string[]; total: number }
const cart: Cart = { items: ['sku-1'], total: 'four thousand' };
console.log(cart.total.toFixed(2));
```

```console
$ esbuild src-ex7/bad.ts --format=esm
const cart = { items: ["sku-1"], total: "four thousand" };
console.log(cart.total.toFixed(2));
esbuild exit=0

$ node src-ex7/bad.mjs
TypeError: cart.total.toFixed is not a function

$ tsc --noEmit src-ex7/bad.ts
src-ex7/bad.ts(2,40): error TS2322: Type 'string' is not assignable to type 'number'.
tsc exit=1
```

esbuild did its job perfectly. Its job does not include noticing.

## What single-file transpiling forbids: `isolatedModules`

Some TypeScript constructs cannot be compiled correctly without whole-program
knowledge, so a single-file transpiler must guess — and `isolatedModules` makes
the compiler reject them instead:

```ts
// Is `Cart` a type or a value? A single-file transpiler cannot know,
// so it cannot know whether to erase this re-export.
export { Cart } from './types.js';        // ❌ under isolatedModules
export type { Cart } from './types.js';   // ✅ explicit
```

The three that bite:

1. **Re-exporting a type without `export type`.** The transpiler cannot tell
   whether to keep the runtime import.
2. **`const enum`.** Its whole mechanism is inlining values from another file
   ([04](./04-strip-only-and-erasable-syntax.md)).
3. **Ambient-only files** with no import or export — under `moduleDetection` they
   may be treated as scripts rather than modules.

`verbatimModuleSyntax` goes further: emit imports exactly as written, so
`import type` is mandatory for type-only imports and nothing is guessed at all.
Both are on in `tsc --init`'s scaffold ([06](./06-tsconfig-anatomy.md)).

**These flags are not bureaucracy. They are the price of the fast build,** and
turning them on is how you find out today whether your codebase is compatible
with the tool you already ship with.

## Designing the pipeline

```jsonc
{
  "scripts": {
    "dev":        "vite",
    "build":      "vite build",          // transpiles. checks nothing.
    "typecheck":  "tsc --noEmit",        // checks. emits nothing.
    "ci":         "npm run typecheck && npm run test && npm run build"
  }
}
```

Three properties worth keeping:

- **`typecheck` is its own script**, so it can be required in CI independently.
- **It runs before the build**, so a type error fails in seconds rather than
  after a bundle.
- **Nothing depends on the build catching type errors**, because it never will.

For a large repo, `tsc --noEmit` is also the slowest step, and the levers are
`skipLibCheck`, `"types": []`, incremental builds and project references — Phase
12, not this phase.

## Where declarations come from

A transpiler cannot emit `.d.ts` files. Generating declarations requires
inferring exported types, which requires the type graph, which is the expensive
job it skips. Publishing a library therefore always involves `tsc`, even when the
JavaScript is bundled by something else:

```console
$ tsc --emitDeclarationOnly --declaration --outDir dist/types
```

## Trade-off

**Transpile-only builds** are dramatically faster and keep the dev loop instant.
The cost is that build success carries no information about types, plus the
`isolatedModules` restrictions.

**`tsc` as the build tool** gives one tool, one truth and `.d.ts` output, at
several times the build time — and it still emits on error by default
([01](./01-static-checker-not-runtime.md)), so it is not automatically safer.

## Gotchas

**Symptom:** The bundle built fine; production throws `TypeError`
**Cause:** The bundler never checked types.
**Fix:** A separate `tsc --noEmit` step, required in CI.

**Symptom:** `Re-exporting a type when 'isolatedModules' is enabled requires using
'export type'`
**Cause:** A single-file transpiler cannot tell a type from a value.
**Fix:** `export type { X } from './x.js'`.

**Symptom:** `const enum` breaks under esbuild/swc/Vite
**Cause:** Inlining needs cross-file knowledge.
**Fix:** An `as const` object plus a derived union.

**Symptom:** Published package has no types
**Cause:** The build used a transpiler only.
**Fix:** Add `tsc --emitDeclarationOnly` and point `types`/`exports` at the
output.

**Symptom:** `typecheck` passes locally, fails in CI
**Cause:** Different file set or compiler version — see
[09](./09-language-server-vs-build.md).

## Interview questions

**★ Why can't esbuild type-check?**
It compiles one file at a time and never resolves imports, so it has no
whole-program type graph — which is exactly why it is fast. Type checking is a
whole-program analysis; the two cannot be the same pass.

**★ What is `isolatedModules` for?**
It rejects constructs that cannot be compiled correctly from a single file in
isolation — type re-exports without `export type`, `const enum`, ambient-only
files. Enabling it guarantees your code is compatible with single-file
transpilers such as esbuild, swc and Babel.

**★ Where do `.d.ts` files come from in a bundler-based build?**
From `tsc`, usually `--emitDeclarationOnly` as a separate step. Transpilers
cannot produce declarations because that needs the type information they skip.

**Should `tsc --noEmit` run before or after the build in CI?**
Before. It is the cheapest signal about correctness, and the build cannot fail
for the reasons it catches.

**What does `verbatimModuleSyntax` change?**
Imports and exports are emitted exactly as written, so type-only imports must say
`import type`. It removes the compiler's guesswork about which imports have
runtime meaning — the same guesswork a single-file transpiler cannot perform.

---

← Prev: [Editor vs build](./09-language-server-vs-build.md) · Next → [Project layout](./11-project-layout.md)
