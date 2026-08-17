---
title: "06 — File extensions"
sidebar_label: "06 · File extensions"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the `Extension` enum, `allSupportedExtensions`,
> `extensionsNotSupportingExtensionlessResolution`, `getOutputExtension` and
> `getDeclarationEmitExtensionForPath`, read out of the installed **TypeScript
> 5.9.3** build; `TS5096` cross-checked against the **7.0.2** native binary,
> where its text differs. Every extension, mapping and diagnostic below is
> quoted from those sources rather than recalled. **No sandbox, no console
> blocks.**

TypeScript recognises thirteen extensions, and the two questions people actually
have about them are separate:

1. **Which extension does this file get?** — `.ts`, `.tsx`, `.mts`, `.cts`, and
   which `.d.*` goes with it.
2. **Which extension do I type in an import?** — the one that surprises everyone,
   because the answer is the *output* extension of a file that does not exist
   yet.

## The one-sentence version

**The extension family survives compilation** — `.mts` in, `.mjs` and `.d.mts`
out — **and the specifier you write describes the output, not the input.** Both
follow from topic 01's rule that the compiler emits the specifier exactly as
written.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The extension table](./01-the-extension-table.md) | all thirteen, the three families, and what each one emits |
| 02 | [How the compiler picks a file](./02-resolution-order.md) | 🔴 priority order, why a `.d.ts` beats a `.js`, and why `./util` can never find `util.mts` |
| 03 | [The extension you type in an import](./03-the-specifier-extension.md) | 🔴 why you write `./router.js` for `router.ts`, and what lifts the rule |
| 04 | [Choosing an extension](./04-choosing.md) | when `.cts` and `.mts` earn their place, and what `.tsx` costs you |

## Three facts worth carrying

1. 🔴 **`extensionsNotSupportingExtensionlessResolution`** — `import "./util"`
   can never find `util.mts`, `util.cts` or their JavaScript and declaration
   counterparts. Not discouraged; excluded, in a list in the compiler. It is why
   a `.ts` → `.mts` rename breaks imports that never mentioned an extension.
2. 🔴 **`allSupportedExtensions` is nested, and both levels are load bearing.**
   The outer array is the three format families; the inner arrays are resolution
   priority — `.ts`, `.tsx`, `.d.ts`, `.js`, `.jsx`. A source file always beats
   its own build output, and a `.d.ts` beating a `.js` is the entire `@types`
   mechanism in one line.
3. 🔴 **`TS5096` differs between the two compilers in this corpus.** 5.9.3
   requires `noEmit` or `emitDeclarationOnly` for `allowImportingTsExtensions`;
   7.0.2 also accepts `rewriteRelativeImportExtensions`. Same reasoning either
   way: writing `.ts` in a specifier is safe only when something guarantees the
   string never reaches a runtime unchanged.

## The `.tsx` decision is not about modules

It is about parsing, and it costs one piece of syntax: in `.tsx`, `<T>` opens a
JSX element, so the angle-bracket type assertion is gone and `as` is the only
form. Generic arrows need `<T,>` — a trailing comma that exists purely as a
parser hint, and is the most-Googled piece of `.tsx` syntax there is. Chunk 04.

## Where this connects

- **← [Topic 01 · Format detection, file by file](../01-module-and-moduleresolution/09-format-detection.md)**
  — this topic asks which extension to type; that one asks what format a file
  ends up being. Read it first if the `.ts`/`.mts`/`.cts` split is unfamiliar.
- **← [Topic 01 · The two questions](../01-module-and-moduleresolution/01-the-two-questions.md)**
  — "the specifier is emitted as written", which chunk 03 is entirely a
  consequence of.
- **← [Topic 03 · Path aliases](../03-path-aliases/README.md)** — the one place
  the as-written rule is broken on purpose, and why the extension rewriter cannot
  help there.
- **→ [Phase 7 · Who compiles](../../phase-7-server/01-tsconfig-for-a-node-service/01-who-compiles.md)**
  — `allowImportingTsExtensions` and `rewriteRelativeImportExtensions` argued on
  a real Node service.
- **→ [Phase 6 · 07 · Authoring `.d.ts` files](../07-authoring-d-ts-files/README.md)**
  — what goes inside a declaration file, as opposed to which extension it wears.
- **Deliberately not here:** JSON, CSS modules and `allowArbitraryExtensions`,
  which belong to **Phase 6 · 16 · Typing non-code imports** *(not written yet,
  lane D)*.

---

← [Phase 6 index](../README.md) · Next → [01 · The extension table](./01-the-extension-table.md)
