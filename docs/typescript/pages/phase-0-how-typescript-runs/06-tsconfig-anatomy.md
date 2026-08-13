---
title: "tsconfig.json anatomy"
sidebar_label: "06 · tsconfig.json"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. The scaffold below is the literal
> output of `tsc --init` (comments stripped), captured by
> `sandbox/ts-p0/ex5-init-and-flags.sh`.

**`tsconfig.json` does two jobs: it defines *which files* are the project, and
*what rules* they are checked under.** Most confusion about it comes from
conflating those, or from not realising the file is what makes a project a
project — the editor, the CLI and CI all read it to agree on one answer.

## What `tsc --init` writes in TypeScript 7

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
    "types": [],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "strict": true,
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  }
}
```

Read that as an opinion, because it is one: strict, plus two flags stricter than
`strict`, plus single-file-transpiler compatibility (`isolatedModules`,
`verbatimModuleSyntax`) turned on from the start. It is close to what a new
project should keep.

## The fields worth understanding

### Which files

| Field | What it means |
|---|---|
| `include` | Globs that form the project. Defaults to everything under the config's directory |
| `exclude` | Removes from `include` — **not** from imports. A file imported by an included file is still checked |
| `files` | An explicit list instead of globs. Rare outside generated configs |
| `extends` | Inherit another config. The base for monorepo sharing |
| `references` | Project references — separate compilations wired together (Phase 6) |

**The most common misunderstanding:** `exclude` does not stop a file being
checked if something included imports it. It only controls the *roots* of the
program.

### What the output is

| Field | What it means |
|---|---|
| `target` | JavaScript version to emit. `esnext` on a Node-24-only service; lower if browsers matter |
| `module` / `moduleResolution` | What module system the output uses and how imports are resolved. The single most bug-prone pair — Phase 6 |
| `outDir` / `rootDir` | Where output goes, and which directory is treated as the source root |
| `noEmit` | Check only. Correct when a bundler or the runtime handles output |
| `declaration` / `declarationMap` | Emit `.d.ts` (and maps). Required for a published package |
| `sourceMap` | Map stack traces back to source. Required when you compile and deploy `dist/` |

### What the rules are

| Field | What it means |
|---|---|
| `strict` | The seven-flag switch — [05 · strict](./05-strict.md). **Defaults to `true` in TS 7** |
| `lib` | Which ambient APIs exist (`es2023`, `dom`). Wrong `lib` is why `document` or `structuredClone` "does not exist" |
| `types` | Which `@types/*` packages are auto-included. `[]` means "none unless imported" — a real speed and correctness lever |
| `skipLibCheck` | Skip checking `.d.ts` files in dependencies. Nearly everyone enables it |
| `isolatedModules` | Guarantee every file can be transpiled alone |
| `verbatimModuleSyntax` | Emit imports exactly as written; forces `import type` to be explicit |
| `erasableSyntaxOnly` | Reject syntax the runtime cannot strip — [04](./04-strip-only-and-erasable-syntax.md) |
| `paths` | Alias map for imports. **Resolved by `tsc` only** — the runtime needs its own answer (Phase 6) |

## `types: []` is doing more than it looks

By default TypeScript auto-includes **every** `@types/*` package it finds by
walking up `node_modules/@types` directories — whether or not you import them.
That is how `describe()` and `process` are typed without an import, and also how
a project ends up loading React's types into a server build.

It has a measurable cost. While benchmarking the compilers, the 5.9.3 run inside
this repo reported errors from `../../node_modules/@types/mdx` — types belonging
to the Docusaurus site three directories up, pulled in automatically, and never
referenced by the code under test. Two runs, "identical" flags, different
workloads — the confound is written up in
[07 · TypeScript 7](./07-typescript-7-native-compiler.md).

`"types": []` turns that off. Add back only what you need:

```json
{ "compilerOptions": { "types": ["node"] } }
```

## Where the file lives, and how many you need

One at the root is the common case. Two configs earn their place when the
*checking rules* genuinely differ, not merely the folders:

```
tsconfig.json          // the app: dom lib, bundler resolution, noEmit
tsconfig.node.json     // vite.config.ts, scripts: node types, nodenext
```

A monorepo adds a shared base:

```json
// packages/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "types": ["node"] },
  "include": ["src"]
}
```

Keep the base free of `outDir`, `rootDir` and `include` — those are per-package,
and inheriting them produces output in surprising places.

## Trade-off

**One config** is simpler and always consistent, but forces one `lib` and one
module setting on code that runs in two different places (a browser app and its
Vite config file, say).

**Several configs** describe reality more honestly at the cost of duplication and
a real risk that the editor picks a different one than CI — the failure mode in
[09 · The language server is not the build](./09-language-server-vs-build.md).

## Gotchas

**Symptom:** `Cannot find name 'document'` / `'process'`
**Cause:** Wrong `lib`, or the relevant `@types` package is not installed or not
in `types`.
**Fix:** Add `"dom"` to `lib` for browser code; `npm i -D @types/node` and
include `"node"` in `types` for server code.

**Symptom:** A file you excluded is still reported
**Cause:** `exclude` only removes roots; an included file imports it.
**Fix:** Stop importing it, or split the project with `references`.

**Symptom:** Output lands in `dist/src/...` instead of `dist/...`
**Cause:** `rootDir` is inferred from the common ancestor of all inputs, and one
stray included file widened it.
**Fix:** Set `rootDir` explicitly and check what `include` actually matches.

**Symptom:** The editor and CI disagree about a type
**Cause:** Different `tsconfig.json` selected, or a different TypeScript version.
**Fix:** Point the editor at the workspace TypeScript version and keep one config
per source root.

**Symptom:** Typechecking is slow and `node_modules` appears in the trace
**Cause:** Ambient `@types` auto-inclusion.
**Fix:** `"types": []` plus an explicit list; `skipLibCheck: true`.

## Interview questions

**★ What are the two jobs of `tsconfig.json`?**
Defining the file set (`include`/`exclude`/`files`/`references`) and defining the
rules (`compilerOptions`). Most confusion comes from treating `exclude` as if it
prevented checking — it only removes roots, and an excluded file is still checked
when an included file imports it.

**★ What does `"types": []` do and why would you set it?**
It stops TypeScript auto-including every `@types/*` package found by walking up
`node_modules/@types`. That auto-inclusion pulls in ambient types you never
imported — measurably so: a compile in this repo picked up `@types/mdx` from
three directories above the source. Setting `[]` and listing only what you need
makes the program smaller and the checks honest.

**★ Why might your editor and CI report different errors for the same file?**
They resolved different configs or different compiler versions. The language
server picks a `tsconfig.json` by file location and may use the editor's bundled
TypeScript, while CI runs the repo's version against an explicit config.

**Which options must match your runtime rather than your preference?**
`module`, `moduleResolution`, `target` and `lib`. They model what actually loads
and executes the code; getting them wrong produces builds that typecheck and then
fail at runtime with `ERR_MODULE_NOT_FOUND` or a missing global.

**When is `noEmit: true` the right setting?**
Whenever something else produces the JavaScript — a bundler, or the runtime
stripping types. Then `tsc` is purely the checker, which is the arrangement in
[03 · The three ways to run TypeScript](./03-three-ways-to-run.md).

---

← Prev: [`strict`](./05-strict.md) · Next → [TypeScript 7 is a different compiler](./07-typescript-7-native-compiler.md)
