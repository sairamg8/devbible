---
title: "Module or global — the decision that governs the file"
sidebar_label: "03 · Module or global"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Modules* — the
> module-vs-script rule is quoted verbatim; *Declaration Files → Templates →
> module.d.ts* for `export =` and `export as namespace`) and the compiler's
> diagnostic table for `TS2306`, `TS2669`, `TS2686`, `TS1203`, `TS2309`,
> `TS1319`, `TS2664` and `TS2665`, read out of the installed **5.9.3** message
> table. **No sandbox, no console blocks.**

Every `.d.ts` file is one of two things, and the file does not tell you which by
its name, its location or its contents at a glance. It is decided by a single
structural rule — and getting it wrong produces the two most confusing symptoms
in this whole phase: *"my types are not found"* and *"my types are suddenly
everywhere"*.

## The rule, verbatim

From the handbook's *Modules* page:

> In TypeScript, just as in ECMAScript 2015, any file containing a top-level
> `import` or `export` is considered a module.
>
> Conversely, a file without any top-level import or export declarations is
> treated as a script whose contents are available in the global scope (and
> therefore to modules as well).

🔴 **That is the whole rule, and it applies to `.d.ts` files exactly as it
applies to `.ts` files.** One `export` keyword anywhere at the top level flips
the file from *global* to *module*, and every declaration in it changes meaning.

| | **Script / global `.d.ts`** | **Module `.d.ts`** |
|---|---|---|
| Has a top-level `import`/`export`? | No | Yes |
| What its declarations do | Add to **global scope** | Are exported by **this module** |
| How you consume it | Just use the name — no import | `import { X } from '…'` |
| How it gets loaded | By being **included** in the program | By being imported, or by resolution |
| `declare global` inside it | ❌ `TS2669` | ✅ correct |

## Failure one — "everything disappeared"

The classic. A global declarations file works fine, then somebody adds an import
to it:

```ts
// src/globals.d.ts  — was a script, is now a module
import type { User } from './user';        // ← this line changes everything

declare const __APP_VERSION__: string;      // no longer global
interface Window { analytics: Analytics }   // no longer merged into the real Window
```

Every consumer that used `__APP_VERSION__` now reports *"Cannot find name"*, and
the `Window` interface stopped merging — because it is no longer *the* global
`Window`, it is a local interface in a module nobody imports.

**The fix is `declare global`:**

```ts
import type { User } from './user';

declare global {
  const __APP_VERSION__: string;
  interface Window { analytics: Analytics }
  var currentUser: User | undefined;    // ⚠️ var, not let/const — see below
}
```

⚠️ **`declare global` is only legal inside a module.** The compiler is explicit:

> **TS2669:** *"Augmentations for the global scope can only be directly nested in
> external modules or ambient module declarations."*

So the two forms are mutually exclusive by construction: a script file *is*
global and needs no `declare global`; a module file needs it and cannot skip it.

📌 **`var` versus `let`/`const` inside `declare global` is not a style choice** —
only `var` creates a property on `globalThis`, which is why every real global
augmentation you will read uses it. That rule is argued in full in
[Phase 4 · Global augmentation](../../phase-4-classes-declarations/06-global-augmentation.md).

## Failure two — "my types are suddenly everywhere"

The mirror image. You meant to write a module's types, forgot the `export`, and
now every interface in the file is a **global type**:

```ts
// src/types/api.d.ts  — no import, no export → a SCRIPT
interface User { id: string; name: string }
interface Response { ok: boolean }        // ← now shadows nothing, but collides with lib.dom's Response
```

Two things happen, both bad:

1. `User` is usable from every file in the project with no import, which feels
   convenient and destroys any sense of where a type comes from.
2. `Response` **merges with the DOM's `Response` interface** rather than
   replacing it, because interfaces merge. You have silently added `ok: boolean`
   to `fetch`'s return type project-wide.

**The fix is one line:**

```ts
export {};
```

From the handbook: *"If you have a file that doesn't currently have any imports
or exports, but you want it to be treated as a module, add this line."* And:
*"This syntax works regardless of your module target."*

⚠️ **This is why a repo-wide `types/` folder full of interfaces with no `export`
is a smell.** It compiles, it is convenient, and it makes every type in it a
global that can collide with `lib.dom.d.ts`.

## Consuming a script `.d.ts` — you do not import it

The corollary that catches people going the other way:

> **TS2306:** *"File '{0}' is not a module."*

You cannot `import { Foo } from './globals'` when `globals.d.ts` is a script.
Its declarations are already in scope. A script declaration file gets into the
program by being **included** — matched by `include`/`files` in `tsconfig.json`,
referenced by a triple-slash directive, or pulled in through `types`/`typeRoots`
— never by being imported.

🔴 **A `.d.ts` that no glob matches does nothing at all.** No error, no warning:
the compiler simply never reads it, and your "why is my declaration being
ignored" bug is a `tsconfig.json` bug. Check the `include` pattern first, every
time — this is the single most common cause, and it is invisible because the
symptom is an *absence*.

## Once you have decided "module"

The decision made here settles only *whether* the file exports. **Which export
form** — named exports, `export =`, `export default`, `export as namespace` — has
to match what the JavaScript does at runtime, and choosing by taste is how
interop bugs start. That is
[chunk 06](./06-the-export-forms.md), along with the two different jobs
`declare module 'name'` can do ([chunk 07](./07-declare-module-and-choosing.md)).

## Gotchas

**Symptom:** Adding an import to a declarations file broke every global.
**Cause:** The file became a module; its top-level declarations are no longer
global.
**Fix:** Wrap them in `declare global { … }`.

**Symptom:** `TS2669: Augmentations for the global scope can only be directly
nested in external modules or ambient module declarations.`
**Cause:** `declare global` in a file that is already a script.
**Fix:** Remove the wrapper — you are already global — or add `export {}` if you
intended the file to be a module.

**Symptom:** Types in a `types/*.d.ts` folder are available everywhere with no
import.
**Cause:** No top-level `export`, so the file is a script and its interfaces are
global.
**Fix:** Add `export {}` and import them properly.

**Symptom:** `fetch`'s `Response` grew a property you never added to it.
**Cause:** A global `interface Response` merged with the DOM one.
**Fix:** Make the file a module, or rename the interface. Interfaces merge; that
is not a bug you can suppress.

**Symptom:** `TS2306: File './globals' is not a module.`
**Cause:** You imported from a script declaration file.
**Fix:** Do not import it — its declarations are already in scope. Make sure it
is matched by `include` instead.

**Symptom:** A declaration file is being ignored entirely — no error, no effect.
**Cause:** It is not matched by `include`/`files` and nothing references it.
**Fix:** Widen the glob, add it to `files`, or reference it. Check this before
suspecting anything subtler.


## Interview questions

**★ What makes a `.d.ts` file global rather than module-scoped?**
The absence of any top-level `import` or `export`. A file with either is a
module; a file with neither is a script, and its declarations go into global
scope. It is a structural rule, not a naming or location one.

**★ You added an import to a globals file and everything broke. Why?**
The import turned the script into a module, so its top-level declarations stopped
being global and became module-local. The fix is to move them inside
`declare global { … }`, which is legal only in a module — the two forms are exact
complements.

**★ How do you force a declaration file to be a module?**
`export {};`. The handbook recommends it precisely for this, and it works
regardless of the module target.


**★ My hand-written `.d.ts` is being ignored. Where do you look first?**
Whether the compiler is reading it at all — is it matched by `include`/`files`,
or reachable via `types`/`typeRoots` or a reference? An unincluded declaration
file produces no error, so the symptom is a silent absence rather than a failure.


**Why is a global `interface Response {}` dangerous?**
Interfaces merge. A global one with a name that already exists in `lib.dom.d.ts`
does not shadow it, it *extends* it — so you have changed a built-in type for the
whole project, and nothing reports it.

---

← Prev: [04 · Generated or hand-written](./04-generated-or-handwritten.md) · Next → [06 · The export forms](./06-the-export-forms.md)
