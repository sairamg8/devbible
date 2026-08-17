---
title: "Authoring `.d.ts` files"
sidebar_label: "07 · Authoring .d.ts files"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Files →
> Introduction, Declaration Reference, Do's and Don'ts, Deep Dive, Templates →
> module.d.ts*; *Modules*; *Triple-Slash Directives*), the **TSConfig reference**
> for every flag named, and the compiler's own **option records, diagnostic table
> and emitter source** — read out of the installed **TypeScript 5.9.3** build and
> cross-checked against the **7.0.2** native binary where the wording matters.
> **No sandbox, no console blocks** — nothing here was run.

## The one-sentence version

> **A `.d.ts` file is a TypeScript file with the implementations removed** — and
> the one your build emits is your package's public API, whether or not anybody
> reviews it.

## Three sentences worth keeping

1. **You generate them; you do not write them.** `declaration: true` is the
   answer in almost every case. Hand-writing is for four narrow situations, and
   a hand-written file for code you own is a second source of truth that drifts.
2. **One structural rule governs the whole file.** A top-level `import` or
   `export` makes it a *module*; without one it is a *script* and everything in
   it is global. Getting that wrong produces both of the confusing symptoms in
   this area — "my types are not found" and "my types are suddenly everywhere".
3. **Declaration emit asks a question ordinary compilation never does:** can this
   type be *written down*, in another file, using names that file can reach?
   Every `TS4023` / `TS2742` / `TS9005` in your build is that question failing,
   and the fix is almost always to write the annotation yourself.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [What a `.d.ts` actually is](./01-what-a-declaration-file-is.md) | The ambient context, and the five syntax errors that define the file format |
| 02 | [The declaration forms](./02-declaration-forms.md) | Which declaration describes which shape of JavaScript API — the lookup table |
| 03 | [The three declaration spaces](./03-the-three-spaces.md) | Types, values, namespaces — why some declarations merge and others collide |
| 04 | [Generated, or written by hand](./04-generated-or-handwritten.md) | `declaration` and its four companions; the four cases where hand-writing is right |
| 05 | [Module or global](./05-module-or-global.md) | The structural rule, its two opposite failure modes, and `declare global` |
| 06 | [The export forms](./06-the-export-forms.md) | Named, `export =`, `export default`, `export as namespace` — matching the runtime |
| 07 | [`declare module`, and choosing](./07-declare-module-and-choosing.md) | Declaring versus augmenting, and a decision table for the whole set |
| 08 | [When declaration emit fails](./08-when-declaration-emit-fails.md) | "Private name" and "cannot be named" — the two groups you meet weekly |
| 09 | [The rarer emit failures](./09-the-rarer-emit-failures.md) | Unserializable types, split augmentations, the JavaScript pair, and the `any` shortcut |
| 10 | [Designing the surface](./10-designing-the-surface.md) | The handbook's Do's and Don'ts: general types and callbacks |
| 11 | [Overloads and naming](./11-overloads-and-naming.md) | Overload order is a resolution rule; when to collapse to a union or an optional |
| 12 | [`@internal` and `stripInternal`](./12-internal-and-strip.md) | Redacting the published surface, and how the detection actually works |
| 13 | [Triple-slash references](./13-triple-slash-references.md) | `types` / `path` / `lib`, the placement rule, and the 5.5 emit change |

## What this topic deliberately does not cover

Each of these is another topic in this phase, and the boundary is worth stating
so you know where to look rather than assuming something is missing:

- **Shimming a dependency that ships no types** — the most common hand-written
  declaration in any repo. [08 · Typing an untyped dependency](../08-typing-an-untyped-dependency/README.md).
- **`import express from 'express'` against a CommonJS package** — chunk 06 says
  which export form is *correct*; [09 · `esModuleInterop`](../09-esmoduleinterop-and-default-imports/README.md)
  says what the consumer's flag does about it.
- **Which errors `skipLibCheck` hides** — [10 · `skipLibCheck`](../10-skiplibcheck/README.md). Chunk 09 only establishes that it cannot help with emit failures.
- **Getting the file into a published package** — `exports`, `types`,
  `typesVersions`, dual ESM/CJS. [11 · Publishing a typed package](../11-publishing-a-typed-package/README.md).
- **Declaration emit without inference** — [15 · `isolatedDeclarations`](../15-isolateddeclarations/README.md) is the flag that turns chunk 08's failures into a rule you write
  to up front.
- **`declare module '*.css'` and friends** — [16 · Typing non-code imports](../16-typing-non-code-imports/README.md).

## Where this connects

- **← [Phase 0 · Erasure](../../phase-0-how-typescript-runs/02-erasure.md)** —
  types do not survive compilation, which is the entire reason this file format
  exists.
- **← [Phase 4 · Module augmentation](../../phase-4-classes-declarations/01-module-augmentation/README.md)**
  and
  **[Interface declaration merging](../../phase-4-classes-declarations/05-interface-declaration-merging/README.md)**
  — the merging machinery chunk 03 explains from first principles.
- **← [Phase 4 · Global augmentation](../../phase-4-classes-declarations/06-global-augmentation.md)**
  — `declare global` in depth, including the `var`-not-`let` rule chunk 05
  depends on.
- **→ [Phase 10 · The suppression tiers](../../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md)**
  — where `skipLibCheck` is settled as *not* a suppression mechanism.
- **→ Phase 12 · Tooling, performance and testing** *(not written yet)* —
  declaration emit is a large share of a slow build, and the flags here are the
  levers.

---

← [Phase 6 index](../README.md) · Start → [01 · What a `.d.ts` actually is](./01-what-a-declaration-file-is.md)
