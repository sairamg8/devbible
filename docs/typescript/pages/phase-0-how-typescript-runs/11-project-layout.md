---
title: "Project layout and `tsc --init`"
sidebar_label: "11 · Project layout"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. The scaffold is the literal output of
> `tsc --init` in an empty directory (`sandbox/ts-p0/ex5-init-and-flags.sh`);
> emit paths from `ex1-erasure.sh`.

**Two directories, one config, and a clear rule about which files are inputs.**
Most layout pain is one of three things: output landing in the wrong place,
`include` not matching what you thought, or a second config nobody knows applies.

## Starting from scratch

```console
$ npm init -y
$ npm i -D typescript
$ npx tsc --init
```

The generated `compilerOptions` in 7.0.2, comments stripped:

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

What it does **not** write is as informative: no `include`, no `outDir`, no
`rootDir`. Those are yours, and leaving them unset is where the surprises start.

## The shape that works

```
service/
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts
│   ├── routes/
│   └── domain/
├── types/              ← ambient .d.ts you own
│   └── untyped-lib.d.ts
├── tests/
└── dist/               ← generated, gitignored
```

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "es2023",
    "strict": true,
    "types": ["node"],
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src", "types"],
  "exclude": ["dist"]
}
```

Four decisions in there worth naming:

1. **`rootDir` is set explicitly.** Unset, it is inferred as the common ancestor
   of every input — so the day a `scripts/seed.ts` joins the program, `rootDir`
   silently becomes `.` and output moves from `dist/server.js` to
   `dist/src/server.js`. Every deploy path breaks at once.
2. **`types` is an explicit list.** Otherwise every `@types/*` found by walking up
   `node_modules` is loaded, imported or not ([06](./06-tsconfig-anatomy.md)).
3. **`types/` is inside `include`.** An ambient declaration outside the file set
   is invisible ([08](./08-where-types-come-from.md)).
4. **`dist` is excluded.** Otherwise a previous build's `.d.ts` and `.js` become
   inputs to the next one, producing duplicate-identifier errors that look
   inexplicable.

## Where output goes

```console
$ tsc --target es2022 --module nodenext --outDir out-ex1 src-ex1/shipping.ts
$ node out-ex1/shipping.js
4800
```

The mapping is `outDir` + (input path − `rootDir`). Keep `src/` flat as the only
root and the output mirrors it exactly.

If you do not emit at all — a bundler builds, or the runtime strips types — then
`"noEmit": true` and neither `outDir` nor `rootDir` matters. Say so explicitly
rather than leaving a half-configured emit nobody uses.

## When a second config earns its place

A front end usually needs two, because two different environments are involved:

```
tsconfig.json          // app code: "lib": ["es2023", "dom"], bundler resolution, noEmit
tsconfig.node.json     // vite.config.ts, scripts: "types": ["node"], nodenext
```

The test is **"do the checking rules differ?"** — different `lib`, `types`, or
module settings. "Different folder" is not a reason; `include` handles that.

A monorepo adds a shared base:

```json
// tsconfig.base.json — rules only
{ "compilerOptions": { "strict": true, "target": "es2023", "skipLibCheck": true } }
```

```json
// packages/api/tsconfig.json — paths and file set
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "types": ["node"] },
  "include": ["src"]
}
```

**Keep `rootDir`, `outDir` and `include` out of the base.** Inherited relative
paths resolve against the *inheriting* config, which is a reliable source of
output in unexpected directories.

## `package.json` fields that go with it

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "node --watch src/server.ts"
  }
}
```

`"type": "module"` is what makes `module: nodenext` resolve to ESM rather than
CommonJS; the two must agree. Publishing details are Phase 6 — the point here is
that the layout and these fields are one decision, not two.

## Trade-off

**One config, one `src/`** is the least to explain and the least to get wrong; it
forces a single environment on everything in the repo.

**Several configs** describe a mixed repo honestly, at the cost of duplication
and a real chance the editor selects a different one than CI
([09](./09-language-server-vs-build.md)).

## Gotchas

**Symptom:** Output at `dist/src/index.js` instead of `dist/index.js`
**Cause:** `rootDir` inferred from a widened common ancestor after a new file
joined the program.
**Fix:** Set `rootDir` explicitly and check what `include` matches.

**Symptom:** `Duplicate identifier` errors mentioning files in `dist/`
**Cause:** A previous build's output became an input.
**Fix:** `"exclude": ["dist"]`, and scope `include` to source directories.

**Symptom:** An ambient `.d.ts` is ignored
**Cause:** It is outside `include`.
**Fix:** Put it in an included directory such as `types/`.

**Symptom:** `tsc` compiles files you did not expect
**Cause:** No `include`, so the default is everything under the config directory.
**Fix:** Set `include` explicitly. Always.

**Symptom:** Imports resolve for `tsc` but fail at runtime
**Cause:** `paths` aliases, or `module`/`type` disagreeing between `tsconfig.json`
and `package.json`.
**Fix:** Match them, and give the runtime its own alias resolution (Phase 6).

## Interview questions

**★ Why set `rootDir` explicitly?**
Unset, it is inferred as the common ancestor of all input files, so adding one
file outside `src/` silently changes the output layout — `dist/index.js` becomes
`dist/src/index.js` and every deployment path breaks. Setting it makes the emit
shape a decision rather than a consequence.

**★ Why exclude `dist` from the project?**
Otherwise the previous build's `.js` and `.d.ts` are inputs to the next one,
producing duplicate-identifier errors that appear to come from nowhere.

**★ When do you need more than one `tsconfig.json`?**
When the *rules* differ — a browser app (`dom` lib, bundler resolution) alongside
Node-side config and scripts (`types: ["node"]`, `nodenext`). Different folders
alone are handled by `include`.

**What does `tsc --init` give you in TypeScript 7, and would you keep it?**
`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`, `isolatedModules`, `moduleDetection: force`,
`skipLibCheck`, `module: nodenext`, `target: esnext`. Mostly keep it; add
`include`, `rootDir`/`outDir` (or `noEmit`), and set `types` to what you use.

**What must `package.json` and `tsconfig.json` agree on?**
Module system — `"type": "module"` with `module: nodenext` — and the paths in
`main`/`types`/`exports` must point at what `outDir` actually produces.

---

← Prev: [Checking vs transpiling](./10-checking-vs-transpiling.md) · Next → [Release cadence and upgrades](./12-release-cadence.md)
