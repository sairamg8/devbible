---
title: "01 — The extension table"
sidebar_label: "01 · The extension table"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the `Extension` enum, `getOutputExtension` and
> `getDeclarationEmitExtensionForPath`, read out of the installed **TypeScript
> 5.9.3** build. Every extension and every mapping below is quoted from that
> source rather than recalled. **No sandbox, no console blocks.**

TypeScript recognises **thirteen** extensions. Most people know four of them and
guess at the rest, which is fine until a `.mts` file appears in a code review and
nobody can say what it changes.

## The complete list

The compiler's `Extension` enum, in its own order:

```js
".ts"   ".tsx"   ".d.ts"
".js"   ".jsx"   ".json"
".tsbuildinfo"
".mjs"  ".mts"   ".d.mts"
".cjs"  ".cts"   ".d.cts"
```

The layout of that list is not accidental — it is **three families and a piece of
bookkeeping**:

| Family | TypeScript | JavaScript | Declarations | Module format |
|---|---|---|---|---|
| **ambiguous** | `.ts`, `.tsx` | `.js`, `.jsx` | `.d.ts` | decided by the nearest `package.json` `"type"` |
| **module** | `.mts` | `.mjs` | `.d.mts` | **always ESM** |
| **commonjs** | `.cts` | `.cjs` | `.d.cts` | **always CommonJS** |

`.json` sits outside them, and `.tsbuildinfo` is the incremental cache — neither
is source in the usual sense.

⚠️ **The format column is topic 01's subject, not this one's.**
[Topic 01 · Format detection, file by file](../01-module-and-moduleresolution/09-format-detection.md)
argues how the ambiguous row is resolved and why `"type": "module"` in
`package.json` is the most consequential line in a TypeScript project. This topic
starts from that and asks the next question: **which extension do you type, and
which one comes out?**

## What each one emits

`getOutputExtension` is four conditionals and settles the whole thing:

```js
function getOutputExtension(fileName, options) {
  return fileExtensionIs(fileName, ".json") ? ".json"
    : options.jsx === Preserve && fileExtensionIsOneOf(fileName, [".jsx", ".tsx"]) ? ".jsx"
    : fileExtensionIsOneOf(fileName, [".mts", ".mjs"]) ? ".mjs"
    : fileExtensionIsOneOf(fileName, [".cts", ".cjs"]) ? ".cjs"
    : ".js";
}
```

| Input | Output |
|---|---|
| `.ts` | `.js` |
| `.tsx` | `.js` — **or `.jsx`, but only under `"jsx": "preserve"`** |
| `.mts` | `.mjs` |
| `.cts` | `.cjs` |
| `.json` | `.json` |

🔴 **The extension family survives compilation.** `.mts` in, `.mjs` out — so the
choice you make in the source directory is the choice the runtime sees in `dist/`.
That is the entire reason the `m`/`c` extensions exist: they are a **per-file
override of the package's module format**, and the override has to survive emit
to be worth anything.

⚠️ **`.tsx` → `.jsx` is conditional and catches people.** Only `"jsx":
"preserve"` produces `.jsx`; every other `jsx` value (`react`, `react-jsx`,
`react-jsxdev`, `react-native`) transforms the JSX and emits `.js`. If your
bundler expects `.jsx` files in the output and finds `.js`, that setting is why.

## And the declarations follow the same families

`getDeclarationEmitExtensionForPath`:

| Input | Declaration output |
|---|---|
| `.mts`, `.mjs` | `.d.mts` |
| `.cts`, `.cjs` | `.d.cts` |
| `.json` | `.d.json.ts` |
| everything else | `.d.ts` |

So a `.mts` file produces **two** files that both carry the family — `.mjs` and
`.d.mts` — and a consumer reading either one knows the format without opening a
`package.json`.

📌 The `.json` row carries a comment in the source calling it a *"drive-by
redefinition … so if it's ever enabled, it behaves well"* — JSON declaration emit
is not on, and that row is anticipating a feature rather than describing one.

## Why `.mts` and `.cts` exist at all

Because Node's format rule is **per-directory**, and real projects sometimes need
it to be per-file.

`"type": "module"` in `package.json` makes every `.js` in that tree an ES module.
That is usually what you want, and then one file needs to be CommonJS — a config
file a tool loads with `require`, a script using `__dirname`, a native addon
wrapper. Without `.cjs`/`.cts` your only option is a nested directory with its own
`package.json` containing `{"type": "commonjs"}`, which is a real and widely used
hack.

`.cts` replaces that whole arrangement with one character in a filename.

```
src/
  index.ts          → dist/index.js    (ESM, because package.json says "type": "module")
  loader.cts        → dist/loader.cjs  (CommonJS, because of the extension)
```

## The unambiguous extensions are self-documenting

There is a second, quieter benefit, and in a shared codebase it is the larger
one: **`.mts` and `.cts` state the format in the filename**.

A reviewer looking at `handler.ts` cannot tell whether `require` is available in
it without finding the nearest `package.json`. A reviewer looking at
`handler.cts` knows. That is worth something in any repository with more than one
`package.json`, which is every monorepo.

## Gotchas

**Symptom:** you renamed a file `.ts` → `.mts` and imports of it broke.
**Cause:** the *output* extension changed too, so every relative import that
pointed at `./thing.js` must now point at `./thing.mjs`.
**Fix:** update the specifiers. Chunk 03 is about which extension goes in the
import.

**Symptom:** the build emits `.js` where you expected `.jsx`.
**Cause:** `.tsx` only emits `.jsx` under `"jsx": "preserve"`. Any transforming
value emits `.js`.
**Fix:** set `"jsx": "preserve"` if a later tool does the transform, and make
sure only one tool does.

**Symptom:** a `.cts` file in an ESM package "does not work" with `import`.
**Cause:** it does — but the emitted `.cjs` is CommonJS, so importing it from ESM
gets the interop behaviour, not a live namespace.
**Fix:** expected. `.cts` is for the files that genuinely need CommonJS, not a
way to avoid thinking about format.

**Symptom:** `dist/` has `.d.mts` files and a consumer's editor ignores them.
**Cause:** the consumer's `moduleResolution` is `node10`, which predates the
whole family and does not look for them.
**Fix:** their config, not yours — topic 01 chunk 04 covers what `node10` cannot
do.

**Symptom:** a `.tsbuildinfo` file appeared in the source tree.
**Cause:** `incremental` or `composite` is on and `tsBuildInfoFile` is unset, so
it defaults next to the output.
**Fix:** set `tsBuildInfoFile`, and add it to `.gitignore`. Lane D's topic 14
covers what it holds.

**Symptom:** `.mts` and `.cts` files sort awkwardly and tooling ignores them.
**Cause:** older linters, formatters and bundler configs match `**/*.ts` and miss
them.
**Fix:** widen the globs to `**/*.{ts,mts,cts}`. This is the practical cost of
the family, and it is real.

## Interview questions

**How many extensions does TypeScript recognise?**
Thirteen, in three families — ambiguous (`.ts`, `.tsx`, `.d.ts`, `.js`, `.jsx`),
always-ESM (`.mts`, `.mjs`, `.d.mts`) and always-CJS (`.cts`, `.cjs`, `.d.cts`) —
plus `.json` and `.tsbuildinfo`.

**What does a `.mts` file compile to?**
`.mjs`, plus `.d.mts` if declarations are on. The family survives compilation,
which is the point of it.

**When does `.tsx` emit `.jsx`?**
Only under `"jsx": "preserve"`. Every transforming `jsx` value emits `.js`.

**What problem do `.mts` and `.cts` solve?**
Node's format rule is per-directory via `package.json` `"type"`. These
extensions make it per-file, replacing the nested-directory-with-its-own-
`package.json` workaround.

**Give a concrete case for `.cts`.**
A CommonJS-only config file, a script needing `__dirname`, or a native addon
wrapper, inside a package whose `"type"` is `"module"`.

**What is the non-mechanical benefit of the unambiguous extensions?**
They state the module format in the filename, so a reader does not have to find
the nearest `package.json` to know whether `require` is available.

**What is the cost?**
Tooling that globs `**/*.ts` silently skips them. Linters, formatters and build
configs all need widening.

---

← [Topic index](./README.md) · Next → [02 · How the compiler picks a file](./02-resolution-order.md)
