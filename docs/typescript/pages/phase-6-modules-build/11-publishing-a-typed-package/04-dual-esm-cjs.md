---
title: "Dual ESM/CJS — producing the two declaration files"
sidebar_label: "04 · Dual ESM/CJS"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **`arethetypeswrong` problem documentation**
> (`FalseCJS.md`, `FalseESM.md`, `CJSResolvesToESM.md`, quoted verbatim) and the
> **TypeScript handbook** — *Modules → Reference* for extension and `"type"`
> semantics, and the **TSConfig reference** for `declaration` and `outDir`.
> **No sandbox, no console blocks.**

[Chunk 03](./03-exports-and-the-types-condition.md) settled where the two
declaration files go in the map. This chunk is about **producing** them, which
is where the practical difficulty actually is: `tsc` compiles one program to one
module format, and you need two.

## First: decide whether you want to be dual at all

Worth asking, because the whole of this chunk is a cost:

| Choice | What you ship | Cost |
|---|---|---|
| **CJS only** | `.js` + `.d.ts` | ESM consumers still work — Node's ESM can `import` CommonJS. Loses named-import ergonomics ([chunk 05](./05-export-equals-vs-default.md)) |
| **ESM only** | `.mjs`/`.js` + `.d.mts`/`.d.ts` | Simplest correct package. `require` consumers must use `await import()`, which is *"a breaking change for downstream APIs"* |
| **Dual** | both, paired | Everyone works. Two builds, two declaration sets, and every failure in this topic becomes possible |

🔴 **Dual is the expensive option and it is chosen by default far more often than
it is chosen deliberately.** If your consumers are applications rather than
libraries, ESM-only is increasingly defensible and removes this entire class of
bug. If you ship to a broad ecosystem, dual is the price.

## The file-extension pairing

Non-negotiable, and it is the golden rule as a table:

| Implementation | Declaration | Format |
|---|---|---|
| `index.mjs` | `index.d.mts` | always ESM |
| `index.cjs` | `index.d.cts` | always CommonJS |
| `index.js` | `index.d.ts` | **depends on the nearest `package.json` `"type"`** |

⚠️ **The third row is where the bugs live.** `.mjs`/`.cjs` and their declaration
counterparts are unambiguous — they carry their format in the extension. The
bare `.js`/`.d.ts` pair inherits it, so the same two files mean different things
depending on a field in a file elsewhere.

📌 **This is why the pairing advice is usually given as *"use `.d.mts` for `.mjs`
and `.d.ts` for `.js`"***, quoted from `FalseCJS.md`. That is correct in a
package whose `"type"` you control. As a general rule it is safer to make both
sides explicit and use `.mjs`/`.d.mts` + `.cjs`/`.d.cts`, so nothing depends on
`"type"` at all.

## Producing both — the two-tsconfig build

`tsc` emits one format per invocation, so you run it twice:

```jsonc
// tsconfig.base.json — everything except module format and output
{
  "compilerOptions": {
    "strict": true,
    "declaration": true,
    "rootDir": "src"
  },
  "include": ["src"]
}

// tsconfig.esm.json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "module": "nodenext", "outDir": "dist/esm" }
}

// tsconfig.cjs.json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "module": "commonjs", "outDir": "dist/cjs" }
}
```

🔴 **And then the problem this always runs into:** both invocations emit `.js`
and `.d.ts`, so `dist/cjs/index.js` and `dist/esm/index.js` are two files with
the same extension and different formats. Node decides what each *is* by the
nearest `package.json`.

There are two accepted answers.

### Answer 1 — the nested `package.json` marker

Drop a one-line manifest into each output directory:

```json
// dist/cjs/package.json
{ "type": "commonjs" }
```

```json
// dist/esm/package.json
{ "type": "module" }
```

Now `dist/cjs/index.js` is CommonJS and `dist/esm/index.js` is ESM, each
declaration file inherits the right format from its neighbour, and the golden
rule holds without renaming anything.

⚠️ **Both directories must have one.** Marking only the ESM side and relying on
the root `"type"` for the other works until the root changes.

### Answer 2 — emit explicit extensions

Compile to `.mjs`/`.cjs` (and `.d.mts`/`.d.cts`) so the format is in the name.
This is the more robust option because it survives being copied, re-published,
or vendored into somebody else's tree — nothing depends on a manifest staying
adjacent.

The cost is that `tsc` alone does not rename outputs, so it needs a post-step or
a bundler that does. That is a real cost and it is why answer 1 remains common.

> **Both are correct. Answer 1 is less work; answer 2 is harder to break.**

## What the failures look like from the consumer's side

Worth mapping back, because you will read these in bug reports rather than in
your own build:

| Report | Which failure | Where to look |
|---|---|---|
| *"default import is `undefined`"* | Masquerading as CJS | Your `types` says CJS, Node resolved ESM |
| *"`.default` is required and it crashes"* | Masquerading as CJS, other direction | Same root cause |
| *"`require()` of ES Module not supported"* | ESM-only entrypoint, or masquerading as ESM | Do you actually ship a CJS build? |
| *"named import is not exported"* | `cjs-module-lexer` — [chunk 05](./05-export-equals-vs-default.md) | Not a format bug |

🔴 **The first question for all of them is the same:** does each condition in
your `exports` map lead to a declaration file whose format matches the
implementation it sits beside? [Chunk 07](./07-validating-the-result.md) answers
it mechanically instead of by inspection.

## The thing that makes this genuinely hard

Two builds of the same source produce **two type identities**. A consumer that
somehow loads both — through a transitive dependency on one side and a direct
dependency on the other — has two `Foo` types that are structurally identical
and nominally distinct wherever nominality leaks in (classes with `private`
members, branded types).

📌 **This is the dual-package hazard**, and the type-level half of it is the part
this topic owns. It is another argument for ESM-only where you can, and for
keeping the public surface structural — [phase 4's branded types](../../phase-4-classes-declarations/07-branded-nominal-types.md)
are exactly the shape that breaks here.

## Gotchas

**Symptom:** Both builds emit `index.js` and consumers get the wrong format.
**Cause:** Extension alone does not decide; the nearest `package.json` `"type"`
does.
**Fix:** A `{"type": …}` marker in each output directory, or emit `.mjs`/`.cjs`.

**Symptom:** A `dist/esm/package.json` marker was added and the CJS side broke.
**Cause:** Only one directory was marked, so the other inherited the root
`"type"` — which the marker's addition made ambiguous to reason about.
**Fix:** Mark both. Never rely on the root for one side.

**Symptom:** Publishing worked, then a consumer vendored `dist/` and it broke.
**Cause:** The nested `package.json` markers did not come along.
**Fix:** Answer 2 — explicit extensions survive being moved.

**Symptom:** `tsc` was run twice and only one set of `.d.ts` files appeared.
**Cause:** `declaration` set in only one config, or both writing to the same
`outDir`.
**Fix:** `declaration: true` in the shared base; distinct `outDir` per config.

**Symptom:** A class instance from the ESM build is rejected where the CJS
build's type is expected.
**Cause:** The dual-package hazard — two identities of the same type, made
nominal by a `private` member or a brand.
**Fix:** Structural public surface, or ESM-only. There is no fix that keeps both
and the nominality.

**Symptom:** Everything is paired correctly and `require` still fails.
**Cause:** ESM-only entrypoint — you never built a CommonJS side.
**Fix:** Build one, or document `await import()`. Chunk 01's third case.

**Symptom:** The build works and the published package does not.
**Cause:** The output tree is right and the `exports` map or `files` list is
not.
**Fix:** Validate the packed tarball, not `dist/`. Chunk 07.

**Symptom:** A maintainer wants to drop the CJS build and is told it is a
breaking change.
**Cause:** It is — consumers must adopt `await import()`, which is asynchronous.
**Fix:** Correct as stated; treat it as a major version, and say so in the
changelog rather than in an issue thread later.

## Interview questions

**★ Why can't you just run `tsc` twice and publish both output directories?**
Because both runs emit `.js` and `.d.ts`, and those extensions do not carry a
module format — Node decides from the nearest `package.json` `"type"`. Without a
marker in each output directory, or explicit `.mjs`/`.cjs` extensions, both
directories are interpreted the same way.

**★ What are the two ways to make a dual build's output unambiguous?**
A one-line `package.json` (`{"type":"commonjs"}` / `{"type":"module"}`) in each
output directory, or emitting explicit `.mjs`/`.cjs` with `.d.mts`/`.d.cts`. The
second is more robust because it survives the files being moved or vendored.

**★ Which declaration extension pairs with which implementation?**
`.d.mts` with `.mjs` (always ESM), `.d.cts` with `.cjs` (always CommonJS), and
`.d.ts` with `.js` — whose format depends on the nearest `"type"` field, which is
why that pair is where the bugs are.

**★ What is the dual-package hazard at the type level?**
Two builds produce two distinct type identities for the same declaration. A
consumer loading both gets types that are structurally identical but not
interchangeable wherever nominality leaks in — a `private` member or a brand.

**Is going ESM-only a breaking change?**
Yes. CommonJS consumers can no longer `require` and must switch to
`await import()`, which makes their call site asynchronous — and asynchronicity
propagates through their API.

**Why is dual the expensive option?**
Every failure in this topic becomes possible only once you have two formats: both
masquerades, the two-identity hazard, and the doubled build. A single-format
package cannot masquerade as anything.

**Where does `declaration: true` belong in a two-config build?**
In the shared base, so both invocations emit declarations, with a distinct
`outDir` in each derived config so they do not overwrite each other.

---

← Prev: [03 · `exports` and the `types` condition](./03-exports-and-the-types-condition.md) · Next → [05 · `export =` vs `export default`](./05-export-equals-vs-default.md)
