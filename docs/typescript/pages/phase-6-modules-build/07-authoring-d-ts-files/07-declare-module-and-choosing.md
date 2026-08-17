---
title: "`declare module`, and choosing a form"
sidebar_label: "07 · declare module, and choosing"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Modules*, *Declaration
> Files → Library Structures*) and the compiler's diagnostic table for `TS2664`,
> `TS2665` and `TS2669`, read out of the installed **5.9.3** message table.
> **No sandbox, no console blocks.**

[Chunk 06](./06-the-export-forms.md) covered the forms that shape *this* file's
exports. `declare module 'name'` is the one that does not: it describes a
**different** module. And depending on whether that module already exists, the
same three words do two entirely different jobs.

## `declare module 'name'` — two different jobs, one syntax

The same three words do two entirely different things depending on whether the
module already exists:

```ts
declare module 'legacy-lib' {          // module has NO types → you are DECLARING it
  export function doThing(x: number): string;
}

declare module 'express' {             // module HAS types → you are AUGMENTING it
  interface Request { user?: User }
}
```

The compiler tells you which one it decided, and both messages use the word
*augmentation* even when you meant to declare:

> **TS2664:** *"Invalid module name in augmentation, module '{0}' cannot be
> found."*
> **TS2665:** *"Invalid module name in augmentation. Module '{0}' resolves to an
> untyped module at '{1}', which cannot be augmented."*

⚠️ **`TS2665` is the confusing one, and it is worth understanding now.** It fires
when the module *does* resolve — to a real `.js` file with no types — so the
compiler reads your block as an augmentation of something untyped rather than as
a fresh declaration. The shape of the fix is that your declaration has to be
found *instead of* the untyped resolution, not alongside it. That whole problem
is [08 · Typing an untyped dependency](../08-typing-an-untyped-dependency/README.md); the augmentation
half is
[Phase 4 · Module augmentation](../../phase-4-classes-declarations/01-module-augmentation/README.md).

📌 **An ambient module declaration is itself an ambient context**, so a
`declare global` block nested inside one is legal — that is the *"or ambient
module declarations"* half of `TS2669` from chunk 05.

⚠️ **A wildcard module declaration is a blunt instrument.**
`declare module '*.svg'` (and worse, `declare module '*'`) matches by pattern and
turns off "cannot find module" errors for everything it covers, including
typos. It is the right tool for non-code assets — [16 · Typing non-code imports](../16-typing-non-code-imports/README.md) — and the wrong one for a package you were too
impatient to type.

## Choosing, in practice

Ask what the thing you are describing is, at runtime:

- **Something you `import`** → module file. Named exports unless the JavaScript
  says otherwise; `declare global` only for the extra globals it also installs.
- **Something that just exists** — a `<script>` tag global, a build-time
  constant, a test framework's `describe`/`it`, an environment shim → script
  file, or `declare global` inside a module file. Either is fine; be consistent
  within a repo.
- **`module.exports = ` a single value** → `export =`, plus a merged namespace
  if it also has properties.
- **Both importable and a `<script>` global** → `export as namespace`, and only
  if the package really is UMD.


## Where the declaration has to live

The chunk-05 rule bites here in a way that catches almost everybody:

| You want to… | The file holding it must be… |
|---|---|
| **Declare** a module with no types (`declare module 'legacy-lib'`) | a **script** — no top-level `import`/`export` |
| **Augment** a module that has types | a **module** — it must import something |

A fresh ambient module declaration in a file that happens to be a module is read
as an augmentation of a module that does not exist — which is exactly `TS2664`.
Adding a stray `import type` to a shim file is enough to break it, and the error
message says *augmentation* when you never asked for one.

📌 **The reverse is also true.** An augmentation in a *script* file augments the
global scope instead of the module, silently, because there is no module context
for it to attach to.

## A decision table

Ask what the thing you are describing is, at runtime:

| The thing | What you write |
|---|---|
| Your own module's exports | `export` declarations ([chunk 06](./06-the-export-forms.md)) |
| `module.exports = ` a single value | `export =`, plus a merged namespace if it has properties |
| Importable *and* a `<script>` global | `export as namespace` — only if the package really is UMD |
| A global the host injects | `declare const` in a script file, or `declare global` in a module file |
| A dependency with no types at all | `declare module 'pkg'` in a **script** `.d.ts` |
| A dependency whose types need one more property | `declare module 'pkg'` in a **module** file — an augmentation |
| A non-code import (`.svg`, `.css`) | `declare module '*.svg'` — the narrowest pattern that works |

**Be consistent within a repo.** A `src/types/` folder where some files are
scripts and some are modules, with no convention about which, is how the two
failure modes in [chunk 05](./05-module-or-global.md) keep recurring.

## Gotchas

**Symptom:** `TS2664: Invalid module name in augmentation, module 'x' cannot be
found.`
**Cause:** You are declaring a module the compiler cannot resolve, *and* the file
you wrote it in is a module — so the block is read as an augmentation.
**Fix:** Put the `declare module 'x'` in a **script** `.d.ts` with no top-level
import or export. That is how a fresh ambient module declaration is written.

**Symptom:** `TS2665: Invalid module name in augmentation. Module 'x' resolves to
an untyped module at '…', which cannot be augmented.`
**Cause:** `x` resolves to a real `.js` with no types, so your block is treated as
an augmentation of something untyped.
**Fix:** Topic 08's problem — the declaration has to win resolution, typically via
`paths` or by putting the types where resolution looks first.

**Symptom:** A shim that worked stopped working after an unrelated edit.
**Cause:** Someone added an `import` to the shim file, turning it into a module
and the declaration into an augmentation.
**Fix:** Remove the import, or move the declaration to its own script file.

**Symptom:** An augmentation appears to do nothing.
**Cause:** It is in a script file, so it augmented the global scope rather than
the module.
**Fix:** Give the file a top-level `import`/`export` so it is a module.

**Symptom:** `TS2669: Augmentations for the global scope can only be directly
nested in external modules or ambient module declarations.`
**Cause:** `declare global` in a script file.
**Fix:** Remove the wrapper (you are already global) or make the file a module.

**Symptom:** After adding `declare module '*'`, real missing-module typos stopped
being reported.
**Cause:** The wildcard matched them.
**Fix:** Narrow it to the extensions you actually import as assets. `'*'` is
never the right pattern.

**Symptom:** The shim types a package correctly, and the editor still shows the
real (wrong) types.
**Cause:** The package does ship types; the compiler resolved those and treated
your file as an augmentation.
**Fix:** Augment rather than replace, or override the resolution deliberately.
Replacing a package's own types is a resolution problem, not a declaration one.

**Symptom:** Two different files both `declare module 'pkg'` with conflicting
shapes.
**Cause:** Ambient module declarations merge like anything else.
**Fix:** Consolidate them. Merging means neither wins cleanly and the resulting
type is the union of both authors' assumptions.

## Interview questions

**★ `declare module 'foo'` gave you `TS2664`. What is wrong?**
The file you wrote it in is a *module*, so the compiler reads the block as an
augmentation of `'foo'` — and `'foo'` does not resolve. A fresh ambient module
declaration belongs in a **script** `.d.ts` with no top-level import or export.

**★ What is the difference between declaring a module and augmenting one?**
Nothing in the syntax — only in whether the module already resolves. If it does
not, you are declaring it; if it does, you are adding to its existing types. The
compiler decides, and both of its error messages say "augmentation" regardless of
what you intended.

**★ What does `declare module '*.svg'` actually do, and what is the risk?**
It declares a pattern of module specifiers so `tsc` stops failing on imports a
bundler will handle. The risk is breadth: a wildcard suppresses *"cannot find
module"* for everything it matches, including misspelled real imports. Keep the
pattern as narrow as the asset types you genuinely import.

**Why can `declare global` appear inside `declare module 'x'`?**
Because an ambient module declaration is itself an ambient context — that is the
*"or ambient module declarations"* half of `TS2669`. It is how a package
declares both its exports and the globals it installs.

**Your shim broke when a colleague added an import to it. Why?**
The import turned the file from a script into a module, so the ambient module
declaration became an augmentation of a module that does not exist. The fix is to
keep shims in files with no top-level import or export.

**How do you decide between `export =` and a `declare module` block?**
They answer different questions. `export =` describes *this* file's module shape;
`declare module 'x'` describes *another* module entirely. You would use both
together when writing a shim for a CommonJS package: a `declare module 'x'` block
whose body ends in `export =`.

---

← Prev: [06 · The export forms](./06-the-export-forms.md) · Next → [08 · When declaration emit fails](./08-when-declaration-emit-fails.md)
