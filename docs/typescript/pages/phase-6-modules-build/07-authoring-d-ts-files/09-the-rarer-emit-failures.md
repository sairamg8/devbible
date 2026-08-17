---
title: "The rarer emit failures, and the shortcut that is not one"
sidebar_label: "09 · The rarer emit failures"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — every diagnostic below is read out of the compiler's own
> message table (installed **TypeScript 5.9.3**) and the `TS9005`/`TS9006`
> wording cross-checked against the **7.0.2** native binary. 🔴 The claim that
> `TS9005`/`TS9006` come from the **JavaScript** declaration path is read from
> the emitter source — `transformDeclarationsForJS` is their only call site in
> the installed 5.9.3 build. **No sandbox, no console blocks.**

[Chunk 08](./08-when-declaration-emit-fails.md) covered the two groups you meet
weekly: types that are not exported, and types that cannot be named portably.
This chunk is the rest — the types the emitter can reach but cannot **write
down**, plus the reason the whole family exists at all.

## Group C — "cannot be serialized"

The type can be reached but not *written down*. These are rarer and each has a
distinct cause worth recognising:

> **TS5088:** *"The inferred type of '{0}' references a type with a cyclic
> structure which cannot be trivially serialized. A type annotation is
> necessary."*
> **TS2527:** *"The inferred type of '{0}' references an inaccessible '{1}' type.
> A type annotation is necessary."* — the `{1}` is `this`.
> **TS7056:** *"The inferred type of this node exceeds the maximum length the
> compiler will serialize. An explicit type annotation is needed."*
> **TS4118:** *"The type of this node cannot be serialized because its property
> '{0}' cannot be serialized."*
> **TS4094:** *"Property '{0}' of exported anonymous class type may not be
> private or protected."*

**`TS7056` is the interesting one.** It is not an error about correctness — the
type is fine, it is just enormous. It is the standard failure mode of a heavily
inferred builder chain or a deeply generic library API: each `.method()` widens
the inferred type until the emitter refuses to print it. It also appears in
[Phase 5 · type-level performance](../../phase-5-type-level/README.md) territory,
for the same underlying reason.

**`TS4094`** is the one people meet without understanding it: an *anonymous*
class expression cannot have its private members represented in a declaration
file, because there is no name to attach the brand to. Give the class a name.

## Group D — augmentation across files

> **TS6232:** *"Declaration augments declaration in another file. This cannot be
> serialized."*
> **TS6233:** *"This is the declaration being augmented. Consider moving the
> augmenting declaration into the same file."* *(attached as related
> information)*

The emitter writes one output file per input file. If file A declares something
and file B augments it, neither output can carry the merged result. The
compiler's own suggestion is in the message: move the augmentation next to the
declaration.

## Group E — declaration emit from JavaScript

> **TS9005:** *"Declaration emit for this file requires using private name '{0}'.
> An explicit type annotation may unblock declaration emit."*
> **TS9006:** *"Declaration emit for this file requires using private name '{0}'
> from module '{1}'. An explicit type annotation may unblock declaration emit."*

🔴 **These come from the JavaScript declaration path**, not the TypeScript one —
in the installed 5.9.3 build their only call site is `transformDeclarationsForJS`,
the transform used when emitting `.d.ts` for `.js` inputs. So if you are seeing
them, you have `allowJs` with `declaration`, and the fix is a JSDoc `@type` or
`@returns` annotation on the offending declaration.

They are the same underlying failure as Groups A and B, phrased more helpfully —
and *"An explicit type annotation may unblock declaration emit"* is the compiler
stating this chunk's universal fix in its own words.

## Why the whole family exists — and where it goes next

Everything above is the compiler *trying* to infer a type it can print, and
failing. **`isolatedDeclarations` is the flag that stops it trying**: it requires
the annotations up front so that each file's `.d.ts` can be produced from that
file alone, with no checker and no cross-file inference. That trade — a large
annotation diff in exchange for parallelisable, much faster declaration builds —
is **15 · `isolatedDeclarations`** *(not written yet)*.

📌 **Which means these errors are worth fixing properly rather than working
around.** Every explicit annotation you add here is an annotation
`isolatedDeclarations` would have demanded anyway, and every one of them makes a
public signature stop depending on inference.

## The shortcut that is not a shortcut

The temptation, when a wave of these appears, is to reach for `any` or a cast:

```ts
export const client: any = new Client();       // ⛔ error gone, API destroyed
```

That does silence it, and it silences it by deleting the type from your public
surface — which is precisely the thing declaration emit exists to produce.
`skipLibCheck` does not help either: it skips checking *inside* `.d.ts` files and
has nothing to do with *producing* them
(**10 · `skipLibCheck`** *(not written yet)*, and
[Phase 10 · The suppression tiers](../../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md)
settles that it is not a suppression mechanism at all).


## Gotchas

**Symptom:** `TS7056: The inferred type of this node exceeds the maximum length
the compiler will serialize.`
**Cause:** A long inferred chain — a builder API, a deeply generic library —
produced a type too large to print.
**Fix:** Annotate the export with a written type. Simplify the chain if you can;
the type is correct, it is just unprintable.

**Symptom:** `TS5088: … references a type with a cyclic structure which cannot be
trivially serialized.`
**Cause:** The inferred type refers to itself in a way the emitter cannot unfold.
**Fix:** Declare a named `interface` for it. A name breaks the cycle, which is
one of the things interfaces exist for.

**Symptom:** `TS2527: The inferred type of 'x' references an inaccessible 'this'
type.`
**Cause:** An inferred polymorphic `this` escaped into an exported signature.
**Fix:** Annotate the return with the concrete type, or with `this` explicitly —
see [Phase 4 · `this` types](../../phase-4-classes-declarations/10-this-types.md).

**Symptom:** `TS4118: The type of this node cannot be serialized because its
property 'x' cannot be serialized.`
**Cause:** One member of an otherwise fine type is unprintable, and it takes the
whole type with it.
**Fix:** The message names the property. Annotate *that* member, not the export.

**Symptom:** `TS4094: Property 'x' of exported anonymous class type may not be
private or protected.`
**Cause:** An anonymous `class { … }` expression with private members, exported.
**Fix:** Name the class. A private member is branded by its declaring class, and
an anonymous class has no name to brand with.

**Symptom:** `TS6232: Declaration augments declaration in another file. This
cannot be serialized.`
**Cause:** The augmentation and the declaration live in different files, so no
single output file can carry the merged type.
**Fix:** Move the augmentation into the same file — the compiler attaches
`TS6233` pointing at the declaration being augmented, so you do not have to hunt
for it.

**Symptom:** `TS9005` / `TS9006` in a project with no TypeScript in it.
**Cause:** `allowJs` plus `declaration` — you are emitting declarations from
JavaScript.
**Fix:** Add a JSDoc `@type` or `@returns` annotation at the named location.

**Symptom:** `TS9006` names a module you did not know you depended on.
**Cause:** Same as `TS2742`, on the JavaScript path: an inferred type reaches
into a package your output cannot name.
**Fix:** JSDoc `@type {import('pkg').Thing}` — the JSDoc import form is what
gives you the reference the emitter wanted.

**Symptom:** Somebody "fixed" a wave of these with `: any` annotations.
**Cause:** It is the fastest way to satisfy *"a type annotation is necessary"*.
**Fix:** Revert it. `any` in a declaration file is the absence of the API you
were trying to publish.

**Symptom:** Someone proposed `skipLibCheck` as the fix.
**Cause:** The name sounds like it covers declarations.
**Fix:** It cannot help. It skips checking *inside* `.d.ts` files; these errors
happen while *producing* one.

**Symptom:** The errors only appear in CI, never locally.
**Cause:** The local build is a bundler with `emitDeclarationOnly` off, or a
`tsc --noEmit` that never runs the declaration transform.
**Fix:** Run the same declaration build locally. Declaration emit is a distinct
phase and `--noEmit` does not exercise it.

## Interview questions

**★ What is `TS7056` telling you, and is it a correctness problem?**
That the inferred type is too large for the emitter to serialize — usually a long
builder chain or a deeply generic API. It is not a correctness problem; the type
is fine. Annotate the export and the emitter has nothing left to print.

**★ How do these relate to `isolatedDeclarations`?**
They are all the compiler *trying* to infer a printable type and failing.
`isolatedDeclarations` removes the attempt entirely by requiring annotations up
front, which is what lets a `.d.ts` be produced per file with no checker and in
parallel. Every annotation you add fixing these is one that flag would have
demanded anyway.

**★ Why is `export const x: any = …` a bad way to clear one of these?**
Because the declaration file *is* your published API. Replacing the type with
`any` silences the diagnostic by deleting the thing you were trying to publish,
and consumers get no checking at all on that export.

**★ Would `skipLibCheck` help?**
No. It skips *checking inside* `.d.ts` files; these errors happen while
*producing* one. It is a common wrong suggestion — phase 10's suppression-tier
page settles that it is not a suppression mechanism at all.

**You see `TS9005` in a JavaScript-only repo. What does that tell you?**
That `allowJs` and `declaration` are both on, so `tsc` is generating `.d.ts` from
`.js`. Those two codes come from the JavaScript declaration transform
specifically. The fix is a JSDoc annotation, not a TypeScript one.

**What does `TS6232` want you to do, and why can it not just work?**
Move the augmentation into the file holding the declaration. It cannot just work
because declaration emit is per-file: neither output file alone can represent a
type assembled from two inputs.

**Why does an anonymous class with private members fail declaration emit?**
Private members are nominal — they are branded by the class that declares them.
An anonymous class expression has no name for the `.d.ts` to brand with, so the
type is unwritable. Naming the class resolves it.

**These errors appear only in CI. What is the likely cause?**
Local builds are not running declaration emit — a bundler is producing the
JavaScript, or the local check is `tsc --noEmit`. Declaration emit is a separate
phase with its own error set, so it has to be run to be tested.

---

← Prev: [08 · When declaration emit fails](./08-when-declaration-emit-fails.md) · Next → [10 · Designing the surface](./10-designing-the-surface.md)
