---
title: "The shim"
sidebar_label: "03 · The shim"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Modules*, *Declaration
> Files → Templates → module.d.ts*) and the compiler's diagnostic table for
> `TS2664`, `TS2665`, `TS7016` and `TS7009`, read out of the installed **5.9.3**
> message table. The `TS7016` suggestion text — *"Try `npm i --save-dev
> @types/{1}` if it exists or add a new declaration (.d.ts) file containing
> `declare module '{0}';`"* — is quoted from that table. **No sandbox, no console
> blocks.**

The package ships nothing, `@types` has nothing, and you still need to import it.
Now you write the shim — and the compiler has already told you the shape of it,
in the second half of the `TS7016` message:

> Try `npm i --save-dev @types/{1}` if it exists **or add a new declaration
> (.d.ts) file containing `declare module '{0}';`**

## The one-line shim

```ts
// src/types/legacy-lib.d.ts
declare module 'legacy-lib';
```

That is legal, and it does exactly one thing: the module now exists, and its
type is `any`. Every import from it, every call, every property access — `any`.

**It is the right first move and the wrong last one.** Right, because it unblocks
the build in ten seconds and confines the untypedness to one named package
instead of leaving `TS7016` suppressed globally. Wrong as a resting place,
because `any` propagates: a value from this module flows through your code
turning off checking wherever it lands.

📌 **Prefer it to the alternatives people reach for instead**, though — a
`// @ts-ignore` on the import line, or `noImplicitAny: false`. Both hide *more*
than this does, and neither leaves a file you can improve later.

## 🔴 Where the file has to live

Two conditions, and both are silent when you get them wrong.

### It must be a script, not a module

This is [topic 07 · chunk 05](../07-authoring-d-ts-files/05-module-or-global.md)'s
rule arriving with consequences. A file with any top-level `import` or `export`
is a **module**, and `declare module 'x'` inside a module is read as an
**augmentation** of `x` — which fails, because `x` has no types to augment:

> **TS2664:** *"Invalid module name in augmentation, module '{0}' cannot be
> found."*

```ts
// ❌ src/types/legacy-lib.d.ts
import type { Config } from '../config';   // ← makes this a module

declare module 'legacy-lib' {              // ← now an augmentation. TS2664.
  export function doThing(c: Config): void;
}
```

⚠️ **This is the single most common way a shim breaks**, and it breaks *later* —
somebody adds an import to the file for an unrelated reason, months after it was
written, and the error blames augmentation for something nobody was augmenting.

**Keep shims in files with no top-level import or export.** If you need a type
from elsewhere, use an inline import type, which is not a top-level import:

```ts
// ✅ still a script
declare module 'legacy-lib' {
  export function doThing(c: import('../config').Config): void;
}
```

### It must be included

A `.d.ts` no glob matches does nothing at all — no error, no warning. Check
`include`/`files` in `tsconfig.json` before suspecting anything subtler:

```json
{ "include": ["src/**/*"] }        // src/types/legacy-lib.d.ts ✅
{ "include": ["src/**/*.ts"] }     // ✅ .d.ts matches *.ts
{ "files": ["src/index.ts"] }      // ❌ nothing else is included
```

⛔ **And do not import it to "activate" it** — that is `TS6137: Cannot import
type declaration files.` A declaration file is found by inclusion, never by
specifier.

## The honest shim — declare what you use

The version worth keeping declares the actual surface your code touches, and
nothing else:

```ts
// src/types/legacy-lib.d.ts
declare module 'legacy-lib' {
  export interface RenderOptions {
    width: number;
    height: number;
    background?: string;
  }

  export function render(input: string, options?: RenderOptions): string;
  export function version(): string;
}
```

Three properties of this that are worth being deliberate about:

1. **It is not the package's API — it is your usage of it.** You are describing
   the subset you call. That is a feature: it is small enough to keep correct,
   and it fails loudly when somebody starts using something you have not
   declared.
2. **It is unverified.** Nothing checks this against the real JavaScript. Every
   signature is a claim, and a wrong one type-checks perfectly and fails at
   runtime. Write it from the package's documentation or its source, never from
   memory of how you think the API works.
3. **It is a module `.d.ts` inside a script file.** The outer file is a script;
   the `declare module` block is a module. Inside the block you use `export`
   normally, and all of [topic 07 · chunk 06](../07-authoring-d-ts-files/06-the-export-forms.md)
   applies — including `export =` if the package assigns `module.exports`:

```ts
declare module 'legacy-lib' {
  function render(input: string): string;
  namespace render {
    const version: string;
  }
  export = render;
}
```

## Matching the runtime, not your preference

The shim describes a real JavaScript file, and that file has a shape you did not
choose. Two mistakes follow from writing what you *want* instead:

- **Declaring `export default` for a CommonJS package.** The consumer's
  `import x from 'legacy-lib'` then type-checks and yields `undefined` unless
  `esModuleInterop` is doing the work. Use `export =`; interop is
  **09 · `esModuleInterop` and default imports** *(not written yet)*.
- **Declaring a value where the code calls `new`.** That produces
  `TS7009: 'new' expression, whose target lacks a construct signature, implicitly
  has an 'any' type.` Use `declare class` or an interface with a `new` signature
  — [topic 07 · chunk 02](../07-authoring-d-ts-files/02-declaration-forms.md).

🔴 **Read the package's shipped JavaScript before writing the block.** Not its
README, not its examples — its `main`/`exports` entry point. Whether it ends in
`module.exports = fn` or `exports.render = …` decides the export form, and that
is a two-minute read that prevents the most annoying class of shim bug.

## Wildcards, and where they stop being appropriate

```ts
declare module 'legacy-lib/*';       // every subpath
declare module '*';                  // ⛔ never
```

A subpath wildcard is reasonable for a package with deep imports you cannot
enumerate. `declare module '*'` is not: it matches every unresolved specifier in
the program, including your own typos, and permanently disables *"cannot find
module"* as a signal. Asset wildcards (`'*.svg'`) are a different thing with a
different justification — **16 · Typing non-code imports** *(not written yet)*.

## The one that is not a shim

If the package *does* resolve to real JavaScript with no types and your
`declare module` block is being treated as an augmentation anyway:

> **TS2665:** *"Invalid module name in augmentation. Module '{0}' resolves to an
> untyped module at '{1}', which cannot be augmented."*

This one is a **resolution** problem, not a declaration one: your block has to be
found *instead of* the untyped resolution, not alongside it. The usual levers are
`paths` pointing the specifier at your declaration, or placing the types where
resolution looks first. `paths` is **03 · Path aliases** *(not written yet)*.

## Gotchas

**Symptom:** `TS2664: Invalid module name in augmentation, module 'legacy-lib'
cannot be found.`
**Cause:** The shim file has a top-level `import` or `export`, so it is a module
and the block is read as an augmentation.
**Fix:** Remove the top-level import. Use `import('…').Type` inline if you need a
type from elsewhere.

**Symptom:** A shim that worked for months suddenly fails.
**Cause:** Somebody added an import to the file for an unrelated reason.
**Fix:** Same as above. Keeping shims in dedicated files with nothing else in
them prevents the recurrence.

**Symptom:** The shim exists and the error persists, with no error in the shim
itself.
**Cause:** It is not matched by `include`/`files`, so the compiler never read it.
**Fix:** Widen the glob or add it to `files`. Check this before anything else.

**Symptom:** `TS6137: Cannot import type declaration files.`
**Cause:** You imported the shim to make it take effect.
**Fix:** Delete the import. Inclusion is the mechanism; imports are not.

**Symptom:** `declare module 'legacy-lib';` silenced the error and now everything
downstream is `any`.
**Cause:** That is exactly what the one-line form does.
**Fix:** Expected as a first step — now declare the surface you actually use.
[Chunk 04](./04-growing-the-shim.md) is how to get there incrementally.

**Symptom:** `import lib from 'legacy-lib'` type-checks and is `undefined` at
runtime.
**Cause:** The shim declared `export default` for a package that assigns
`module.exports`.
**Fix:** `export =`, and let `esModuleInterop` handle the import form.

**Symptom:** `TS7009: 'new' expression, whose target lacks a construct
signature…`
**Cause:** The shim declared the export as a value or function type.
**Fix:** `declare class`, or an interface with a `new` signature.

**Symptom:** After `declare module '*'`, real typos in import paths stopped being
reported.
**Cause:** The wildcard matched them.
**Fix:** Narrow it to the package (or subpath) you meant. `'*'` is never right.

**Symptom:** `TS2665: … resolves to an untyped module … which cannot be
augmented.`
**Cause:** The specifier resolves to real untyped JavaScript, so your block is an
augmentation of something untyped.
**Fix:** A resolution fix — `paths`, or placing the declarations where resolution
looks first.

**Symptom:** The shim's signatures are subtly wrong and nothing caught it.
**Cause:** Nothing checks a shim against the JavaScript it describes. Every line
is an unverified claim.
**Fix:** Write it from the package's source or docs, and keep it small. A shim
that declares only what you call is a shim you can keep correct.

**Symptom:** A new team member used an export the shim does not declare, and got
an error on a function that genuinely exists.
**Cause:** The shim describes your usage, not the package.
**Fix:** Add it. That error is the design working — it forces a deliberate
decision instead of silently widening the untyped surface.

## Interview questions

**★ What is the minimum shim for an untyped package, and what does it cost?**
`declare module 'legacy-lib';` in a `.d.ts`. It makes the module exist with type
`any`, so everything from it is unchecked. It is the right first move — better
than `@ts-ignore` or disabling `noImplicitAny`, because it is confined to one
named package and leaves a file you can improve.

**★ Why must a shim file have no top-level `import` or `export`?**
Because that would make it a module, and `declare module 'x'` inside a module is
an **augmentation** — which fails with `TS2664` when `x` has no types to augment.
A fresh ambient module declaration belongs in a script file. Use inline
`import('…').Type` if you need a type from elsewhere.

**★ Your shim appears to do nothing at all — no error, no effect. Where do you
look?**
Whether the compiler is reading the file: is it matched by `include`/`files`? An
unincluded `.d.ts` produces no diagnostic, so the symptom is a silent absence.
And check nobody tried to `import` it — that is `TS6137`.

**★ How do you decide between `export =` and `export default` in a shim?**
By reading the package's shipped entry point. If it assigns `module.exports = fn`
that is `export =`; if it has a real ES `export default`, that is
`export default`. The declaration describes the runtime, and guessing produces an
import that type-checks and is `undefined`.

**★ Should a shim describe the whole package API?**
No — describe the surface your code actually uses. It is small enough to keep
correct, and an error when somebody reaches for something undeclared is the
design working: it forces a deliberate addition rather than silent drift.

**What checks a shim against the library it describes?**
Nothing. Every signature in it is an unverified claim, which is why it should be
written from the package's source or documentation and kept small. This is the
main argument for upstreaming it instead.

**When is `declare module 'pkg/*'` reasonable, and when is `declare module '*'`?**
The subpath wildcard is reasonable for a package with deep imports you cannot
enumerate. `'*'` never is — it matches every unresolved specifier including your
own typos, and permanently removes *"cannot find module"* as a signal.

**What does `TS2665` mean, and why is it not fixed by editing the shim?**
It means the specifier resolves to real untyped JavaScript, so your block is
being read as an augmentation of something untyped. The fix is in resolution —
making your declarations win, typically via `paths` — not in the declaration's
contents.

---

← Prev: [02 · Look for types first](./02-look-for-types-first.md) · Next → [04 · Growing the shim](./04-growing-the-shim.md)
