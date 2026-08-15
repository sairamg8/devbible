---
title: "Why it did not load"
sidebar_label: "03 · Why it did not load"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Merging*,
> *Modules*). Every error code below — `TS2664`, `TS2665`, `TS2669`, `TS2670`,
> `TS2649`, `TS2671` — and its exact `{0}`-templated message text is **read out
> of the compiler's own diagnostic table**, not recalled. ⚠️ Install inspected:
> TypeScript **6.0.3**, not the 7.0.2 this corpus targets. **No console block** —
> no sandbox run covers this phase.

You wrote the augmentation. `Property 'user' does not exist on type 'Request'` is
still there. This chunk is the checklist, in the order worth checking.

🔴 **The governing fact: a missing augmentation is not an error.** If your file
is never loaded, nothing says so — the original type is simply used, and the
symptom appears at the *use* site, in a file that is correct. Every failure below
looks identical from where you are standing.

## 1. The compiler never read the file

The most common cause by a distance.

An augmentation only exists if the file containing it is part of the program. If
your `tsconfig.json` has an `include` of `["src"]` and you put the file in
`types/` at the root, it does not exist as far as the compiler is concerned.

```jsonc
{
  "include": ["src", "types"]        // the directory must actually be in here
}
```

Check it the direct way rather than by reasoning about globs:

```bash
npx tsc --listFiles | grep express.d.ts
```

No line, no augmentation. This is the phase gate's second half — *"explain why it
must live in a file the compiler actually includes"* — and it is the thing that
makes this topic Master tier rather than a five-line recipe.

⚠️ **`files` and `include` are not the only routes.** A `.d.ts` can also be
pulled in by `types`/`typeRoots`, or by an `import` from something already in the
program. **Phase 6** is where those resolution rules get their own treatment; for
now, `--listFiles` answers the question empirically and takes a second.

## 2. The file is a script, not a module

```ts
// ❌ no import, no export anywhere in the file
declare global {
  namespace Express {
    interface Request { user?: User }
  }
}
```

A TypeScript file with no top-level `import` or `export` is a **script**: its
declarations go into the global scope, and it is not a module. `declare global`
inside one is meaningless, and the compiler says so:

> **TS2669:** *"Augmentations for the global scope can only be directly nested in
> external modules or ambient module declarations."*

**Fix:** add `export {};`. That one line changes the file's kind, and everything
starts working.

Its sibling, when the `declare` keyword is missing in a context that needs it:

> **TS2670:** *"Augmentations for the global scope should have 'declare' modifier
> unless they appear in already ambient context."*

⚠️ **This is why an augmentation can break by deletion of an unrelated line.**
Remove the last `import` from a `.d.ts` and it silently stops being a module —
the augmentation stops applying and, in the script case, the declarations leak
globally instead. Keep an explicit `export {};` even when an import already makes
the file a module.

## 3. The module specifier does not resolve

`declare module 'some-package'` must name the module **exactly as you would
import it**. Get it wrong and, helpfully, you *do* get an error here:

> **TS2664:** *"Invalid module name in augmentation, module '{0}' cannot be
> found."*

Two specifics that bite:

- **Relative specifiers are resolved relative to the augmenting file**, exactly
  like an `import`. `declare module './observable'` in a different directory
  names a different module.
- **Sub-path specifiers are distinct modules.** Augmenting `'express'` does not
  augment `'express-serve-static-core'`, and for the `req.user` case
  [chunk 02](./02-augmenting-a-package.md) the interface you want is in the
  latter — reached through the *global* `Express` namespace rather than by
  naming the package at all.

And when the package ships no types:

> **TS2665:** *"Invalid module name in augmentation. Module '{0}' resolves to an
> untyped module at '{1}', which cannot be augmented."*

There is nothing to reopen. An untyped package needs a `declare module 'pkg';`
ambient declaration first — which is a different thing from an augmentation, and
belongs in Phase 6.

## 4. The target is not a module at all

> **TS2671:** *"Cannot augment module '{0}' because it resolves to a non-module
> entity."*
>
> **TS2649:** *"Cannot augment module '{0}' with value exports because it
> resolves to a non-module entity."*

You are pointing `declare module` at something that is a namespace or a variable
rather than a module. Usually a sign the library's shape was guessed instead of
read.

## 5. You tried to change a member rather than add one

Covered in [chunk 01](./01-what-merging-and-augmentation-are.md) and worth
repeating because the instinct is so strong: merging **adds**. A conflicting
non-function member of a different type is an error, not an override. There is no
augmentation-based way to make a library's `id: string` into `id: number`.

## 6. It loaded, and the type half was all you wrote

The compiler is satisfied, and the call throws at runtime. `declare module` emits
nothing — if the method genuinely does not exist on the object, something has to
put it there. See chunk 01's two-halves rule.

## Gotchas

**Symptom:** `Property 'user' does not exist on type 'Request'`, and the
augmentation file looks perfect
**Cause:** The file is not in the program.
**Fix:** Add its directory to `include`, and confirm with
`npx tsc --listFiles | grep <file>`.

**Symptom:** `TS2669: Augmentations for the global scope can only be directly
nested in external modules…`
**Cause:** The file has no top-level import or export, so it is a script.
**Fix:** `export {};`.

**Symptom:** It worked, then stopped after an unrelated cleanup
**Cause:** The last `import` was removed and the file quietly became a script.
**Fix:** Keep an explicit `export {};` regardless.

**Symptom:** `TS2664: Invalid module name in augmentation`
**Cause:** The specifier does not resolve from this file — often a relative path
written for a different directory, or a package sub-path.
**Fix:** Use exactly the specifier an `import` in that same file would use.

**Symptom:** `TS2665: … resolves to an untyped module`
**Cause:** The package ships no types, so there is nothing to reopen.
**Fix:** Declare the module ambiently first; augmentation comes after types
exist.

**Symptom:** `TS2300: Duplicate identifier` when augmenting
**Cause:** You reached for `type` or `class` inside the augmentation. Only open
declarations merge.
**Fix:** `interface` or `namespace`.

**Symptom:** The types are right and the call throws `undefined is not a
function`
**Cause:** Only the type half was written; nothing assigned the implementation.
**Fix:** Assign it (`X.prototype.m = …`), or import the module that does.

**Symptom:** `process.env.DATABASE_URL` is typed `string` and is `undefined` in
production
**Cause:** The augmentation asserted it exists; nothing verified it.
**Fix:** Validate the environment at startup — the declaration then describes
something true.

**Symptom:** A library's types cannot be augmented no matter what you write
**Cause:** It exports type *aliases* rather than interfaces, or its API is a
default export.
**Fix:** Neither is augmentable. Wrap it in a module of your own, or send a PR.

## Interview questions

**★ How do you add a property to `Express.Request`?**
Express's own types declare an empty global `interface Request {}` inside a
`namespace Express` specifically so it can be merged into — and the real
`Request` extends it. So you write a module file containing `declare global {
namespace Express { interface Request { user?: User } } }` plus `export {};`, and
make sure that file is in the compiler's `include`. Optional rather than
required, because the property is genuinely absent until the auth middleware
runs.

**★ Why does an augmentation sometimes silently do nothing?**
Because a *missing* augmentation is not an error — the original type is simply
used, and the failure shows up at the use site. Nearly always one of two causes:
the file is not part of the program (`include` does not cover it), or the file has
no top-level import/export so it is a script rather than a module, in which case
`declare global` is invalid. `npx tsc --listFiles` settles the first;
`export {};` fixes the second.

**★ Why can you augment an interface but not a type alias?**
Interfaces and namespaces are open declarations — declare one twice and the
members merge. A type alias is closed: a second declaration is
`TS2300: Duplicate identifier`. Augmentation *is* that openness aimed at another
file, so a library that exports type aliases cannot be extended this way at all.

**What can't you do inside `declare module`?**
Two things, both absolute: you cannot declare new top-level declarations — only
patch existing ones — and you cannot augment a default export, only named
exports. You also cannot change an existing member's type; non-function members
must be unique or identical, so merging adds and never overrides.

**What happens if two declarations of the same interface both declare a method?**
They become overloads of one function rather than conflicting. Ordering matters:
later declarations are placed above earlier ones, except that signatures taking a
single string literal are bubbled to the top — which is why
`document.createElement('div')` returns `HTMLDivElement` instead of matching the
general `string` overload.

**Does `declare module` emit anything?**
No. It is a claim about types and disappears at compile time. If the method does
not exist at runtime, something still has to assign it — typically the library
itself, or a `prototype` assignment in the same file as the augmentation.

---

← [02 · Augmenting a package](./02-augmenting-a-package.md) · Up → [Overview](./README.md) · Next → [02 · Access modifiers](../02-access-modifiers/README.md)
