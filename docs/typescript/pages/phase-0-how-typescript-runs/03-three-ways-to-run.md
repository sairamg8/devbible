---
title: "The three ways to run TypeScript"
sidebar_label: "03 · Three ways to run it"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**, **esbuild 0.28.2** and **Node
> 24.19.0**. Console blocks from `sandbox/ts-p0/ex9-node-runs-ts.sh`,
> `ex1-erasure.sh` and `ex7-transpile-vs-check.sh`.

**Three programs will happily accept your `.ts` file. Exactly one of them reads
the types.** Knowing which one your project runs — and where the missing one was
supposed to go — is the difference between a type system and a decorative one.

## The three

| | What it does | Checks types? | Output |
|---|---|---|---|
| **`tsc`** | Checks, then emits JavaScript | **Yes** | `.js` (+ `.d.ts`, source maps) |
| **Transpilers** — esbuild, swc, Vite, Babel | Strip types, emit fast | **No** | `.js` bundle |
| **Node 24 directly** | Strip types, execute | **No** | nothing, it just runs |

### 1. `tsc` — the only one that checks

```console
$ tsc --target es2022 --module nodenext --outDir out-ex1 src-ex1/shipping.ts
$ node out-ex1/shipping.js
4800
```

Slowest, and the only one whose silence means anything. It is also the only one
that produces `.d.ts` declarations, which is what a published package needs.

### 2. A transpiler — fast, and blind

```ts
// src-ex7/bad.ts
interface Cart { items: string[]; total: number }
const cart: Cart = { items: ['sku-1'], total: 'four thousand' };
console.log(cart.total.toFixed(2));
```

`total` is declared `number` and assigned a string, then a number method is
called on it.

```console
$ esbuild src-ex7/bad.ts --format=esm
const cart = { items: ["sku-1"], total: "four thousand" };
console.log(cart.total.toFixed(2));
esbuild exit=0
```

**Exit 0.** esbuild deleted the `interface`, deleted `: Cart`, and emitted the
bug. Run that output:

```console
$ node src-ex7/bad.mjs
TypeError: cart.total.toFixed is not a function
```

The same file through the checker:

```console
$ tsc --noEmit src-ex7/bad.ts
src-ex7/bad.ts(2,40): error TS2322: Type 'string' is not assignable to type 'number'.
tsc exit=1
```

This is not a criticism of esbuild — **type checking is deliberately not its
job.** It is 100× the speed precisely because it never builds a type graph. The
mistake is expecting a green bundler to mean checked code.

### 3. Node, directly

```ts
// src-ex9/quote.ts
interface Parcel { id: string; weightKg: number }

function quote(p: Parcel, perKg: number): number {
  return Math.round(p.weightKg * perKg);
}

const parcel: Parcel = { id: 'P-1', weightKg: 2.5 };
console.log('quote:', quote(parcel, 120));
```

```console
$ node --version
v24.19.0
$ node src-ex9/quote.ts
quote: 300
exit=0
```

No flag, no `tsconfig.json`, no `tsc`, nothing on stderr. Node strips the
annotations and runs the JavaScript underneath — and, like the transpiler,
checks nothing:

```console
$ node src-ex9/lying.ts
node does not care: HEAVY
exit=0
```

The runtime mechanics, the `node_modules` exclusion and the import-specifier
rule are Node's own subject — see
[Node · TypeScript without a build step](/docs/nodejs/pages/phase-1-modules/typescript-natively).
What matters here is the checking hole it leaves, and the syntax restriction it
imposes ([04 · Strip-only mode](./04-strip-only-and-erasable-syntax.md)).

## Picking a combination

Real projects use **two** of the three: something fast to run the code, and
`tsc --noEmit` to check it.

| Project | Runs with | Checked by |
|---|---|---|
| Backend service, no non-erasable syntax | `node src/server.ts` | `tsc --noEmit` in CI + editor |
| Backend service, compiled artefact | `tsc` build → `node dist/server.js` | the same `tsc` build |
| Frontend app | Vite/esbuild | `tsc --noEmit` as a separate script |
| Published library | `tsc` (needs `.d.ts`) | the same `tsc` build |
| Tests, scripts, one-off tooling | `node script.ts` | the project-wide `tsc --noEmit` |

The rule that falls out of it:

> **Whatever runs your code, `tsc --noEmit` runs beside it.** The build step
> became optional; the check never did.

## Why not just use `tsc` for everything?

Speed, and only speed. The measured gap on a 300-file fixture
([07 · TypeScript 7](./07-typescript-7-native-compiler.md)) is `tsc` at 0.76 s
against esbuild's sub-100 ms bundling — and on a real front end with thousands of
modules the difference is the whole reason bundlers won. Hence the split: the
fast tool builds, the slow tool judges.

There is one more reason, particular to `tsc`: it emits **even when it
disagrees** ([01 · Checker, not a runtime](./01-static-checker-not-runtime.md)),
so using it as your build tool does not by itself protect you either.

## Trade-off

**Running `.ts` directly** removes a build step, a `dist/` folder, source-map
configuration and a class of "stale build" bugs. It costs you `enum`, parameter
properties, runtime `namespace` and legacy decorators, and it is unavailable for
published libraries.

**Compiling with `tsc`** costs a build step and a watch process, and buys the
full syntax, `.d.ts` output, and one tool doing both jobs.

## Gotchas

**Symptom:** CI is green, production throws `TypeError`
**Cause:** CI runs a bundler or `node`, never the checker.
**Fix:** Add `tsc --noEmit` as its own required step. A bundler's exit code says
nothing about types.

**Symptom:** `tsc` is slow in CI and someone proposes replacing it with esbuild
**Cause:** Treating the two as interchangeable build tools.
**Fix:** They do different jobs. Keep both — esbuild builds, `tsc --noEmit`
checks. Speed up the checker with `skipLibCheck` and incremental builds instead.

**Symptom:** Works with `node app.ts`, fails after adding `tsc` to the build
**Cause:** Different module resolution and import-extension conventions between
the two paths.
**Fix:** Pick one execution model per project and configure `moduleResolution`
and import specifiers for it (Phase 6).

**Symptom:** A published package's consumers get `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`
**Cause:** You shipped TypeScript source; Node refuses to strip types inside
`node_modules`.
**Fix:** Publish compiled `.js` plus `.d.ts`. Libraries always need the `tsc`
path.

## Interview questions

**★ Name the ways to run TypeScript and say which of them type-check.**
`tsc` (checks and emits), transpile-only tools like esbuild/swc/Vite/Babel (strip
and emit, no checking), and Node 24 executing `.ts` directly (strips and runs, no
checking). Only `tsc` checks. Production setups pair a fast runner with
`tsc --noEmit`.

**★ Your bundler build is green. What has it proved about your types?**
Nothing. It proved the files parse. esbuild emitted a program assigning a string
to a `number` field and exited 0; the output threw
`TypeError: cart.total.toFixed is not a function` at runtime, while `tsc --noEmit`
on the same file reported `TS2322`.

**★ Node runs TypeScript now — do you still need `tsc`?**
For checking, always. For *building*: not for an application whose syntax is
fully erasable, but yes for a published library, because `.d.ts` files only come
from the compiler and Node will not strip types inside `node_modules`.

**Why is esbuild so much faster than `tsc`?**
It never type-checks. Stripping annotations is a per-file syntactic operation;
checking requires building a whole-program type graph and resolving every import.
The speed comes from skipping the expensive job, not from doing it better.

**Where do `.d.ts` files come from in a transpiler-based build?**
From `tsc` — usually a separate `tsc --emitDeclarationOnly` step, or a bundler
plugin that shells out to the compiler. Transpilers cannot generate declarations
because that requires type information they never compute.

---

← Prev: [Erasure](./02-erasure.md) · Next → [Strip-only mode and erasableSyntaxOnly](./04-strip-only-and-erasable-syntax.md)
