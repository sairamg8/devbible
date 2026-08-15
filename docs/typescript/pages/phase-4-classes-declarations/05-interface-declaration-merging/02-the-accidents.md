---
title: "The accidents"
sidebar_label: "02 · The accidents"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Merging* —
> *Merging Interfaces*), and following from the module-versus-script rule
> established in
> [topic 01 chunk 03](../01-module-augmentation/03-why-it-did-not-load.md).
> Error codes and their exact `{0}`-templated text are read out of the
> **compiler's own diagnostic table** (⚠️ install inspected: TypeScript
> **6.0.3**, not the 7.0.2 this corpus targets). **No console block** — no
> sandbox run covers this phase.

[Chunk 01](./01-what-merges-with-what.md) was the mechanism working as designed.
This is why it is a liability in code you own.

## An interface declared twice does not error — it combines

```ts
// user.ts
interface User { id: string; name: string }

// somewhere else, same scope
interface User { role: string }
```

There is now one `User` with three members, and **nothing told you.** That is the
documented behaviour, and it is exactly what you want when augmenting a library
and exactly what you do not want when a name has been reused by accident.

The failure mode is usually not a compile error at all — it is a type **wider
than either author intended**. Every construction site now has to supply `role`,
and the errors appear *there*, in files whose authors have never seen the second
declaration. The distance between the cause and the symptom is what makes this
expensive.

**Contrast with `type`:** the identical mistake is `TS2300: Duplicate identifier`
on the spot. That is the most practical argument for `type` as the default in
application code — not elegance, but that a name collision is reported where it
happened.

## When it does error, the message is the tell

```ts
interface Config { retries: number }
interface Config { retries: string }
```

> **TS2717:** *"Subsequent property declarations must have the same type.
> Property '{0}' must be of type '{1}', but here has type '{2}'."*

🔴 **If you see TS2717 for a name you believed was declared once, you have found
an accidental merge.** The word *"subsequent"* is the giveaway — the compiler is
telling you a second declaration exists. Search the name across the project
rather than changing the type it complains about, which is the instinctive and
wrong response.

Generic parameters have their own version:

> **TS2428:** *"All declarations of '{0}' must have identical type parameters."*

Identical means **names, order, constraints and defaults** — not merely the
count. It is the same rule met in
[phase 3 · generic interfaces](../../phase-3-generics/03-generic-interfaces-and-aliases/README.md).

Both of these are the lucky cases. Merges that happen to be compatible say
nothing at all.

## The global scope makes it much worse

Interfaces merge with same-named interfaces **in the same scope**, and
[topic 01 chunk 03](../01-module-augmentation/03-why-it-did-not-load.md)
established that a file with no top-level `import` or `export` is a **script**,
whose declarations land in the **global** scope.

Put those together: two `.d.ts` files — yours and a dependency's — each declaring
`interface Options` with no module wrapper will merge, **across the package
boundary**, silently. Nothing in either file references the other.

This is the mechanism behind *"installing a package broke types in an unrelated
file"*. It is also why it is so hard to diagnose: the error surfaces in a third
file, naming a type that looks correct in both declarations.

**The defence is one line.** Make every `.d.ts` a module with `export {};` unless
it is *deliberately* contributing globals. A collision then behaves like a
collision instead of a merge, and anything you do want in the global scope goes
through `declare global`, where the intent is written down.

## So when do you want it?

Three cases, and they share one property — **you do not own both declarations**:

1. **Augmenting a library** — [topic 01](../01-module-augmentation/README.md).
2. **A plugin boundary in your own system**, where a core interface is
   deliberately extended by independently-loaded modules. Structurally identical
   to the library case.
3. **Publishing an extensible library**, where you ship an interface precisely so
   consumers can merge into it — as Express does with its empty
   `Express.Request`.

**Inside a single codebase you own, a merge is almost always an accident.** When
you want to combine two shapes deliberately, `extends` or an intersection says so
in one place, is visible to a reader, and cannot happen by mistake.

## Trade-off

**`interface`** is open, so declarations elsewhere can extend it — the only way to
augment a library, and the right choice when publishing an extension point. It
costs you the duplicate-name error: a collision merges silently rather than being
reported.

**`type`** is closed, so a duplicate name is `TS2300` immediately. It cannot be
augmented at all, and a library exporting only type aliases cannot be extended by
its consumers.

The line worth holding: **`interface` for anything you intend others to extend,
`type` for everything else.** The default should be the one that turns a mistake
into an error.

## Gotchas

**Symptom:** An interface has members nobody in that file declared
**Cause:** A same-named interface elsewhere in the same scope merged into it.
**Fix:** Search the name across the project. Rename one, or make the file a
module so they are no longer in the same scope.

**Symptom:** `TS2717: Subsequent property declarations must have the same type.`
**Cause:** Two declarations of one interface disagree on a member's type — an
accidental merge that happened to conflict.
**Fix:** This is the lucky version, because it is reported at all. Find the other
declaration; do not change the type.

**Symptom:** Installing a package changed types in unrelated files
**Cause:** A global `.d.ts` — one with no top-level import or export — merged
into an interface you also declare globally.
**Fix:** `export {};` in your own declaration files so they are modules rather
than scripts.

**Symptom:** `TS2428: All declarations of 'X' must have identical type
parameters.`
**Cause:** Two generic declarations differ in parameter names, order, constraints
or defaults.
**Fix:** Make them identical — a matching count is not enough.

**Symptom:** Errors appear at every construction site of a type, none of which
you changed
**Cause:** A merge widened the type by adding required members.
**Fix:** Find the second declaration rather than adding the members everywhere.

**Symptom:** You want to combine two shapes and reach for a second `interface`
declaration
**Cause:** Using an implicit mechanism for an explicit intent.
**Fix:** `extends` or an intersection — visible, local, and impossible to trigger
by accident.

## Interview questions

**★ Why can two interfaces with the same name coexist but two type aliases
cannot?**
`interface` is an open declaration — declaring it again reopens it and the
members merge. A type alias is closed, so a second declaration is
`TS2300: Duplicate identifier`. That openness is what makes module augmentation
possible, and it is also why an accidental name collision on an interface is
silent while the same mistake on a type alias is reported immediately.

**★ Why is merging usually a problem inside your own codebase?**
Because nothing tells you it happened. Two same-named interfaces in one scope
combine into a type wider than either author intended, and the errors appear at
construction sites rather than at the duplicated declaration. You only get a
diagnostic when the members happen to conflict — `TS2717`, whose word
*"subsequent"* is the clue that a second declaration exists.

**★ How can adding a dependency break types in an unrelated file?**
A `.d.ts` with no top-level import or export is a script, so its declarations are
global. If the package and your code both declare a global interface with the
same name, they merge across the package boundary. Making your own declaration
files modules with `export {};` turns the silent merge back into an ordinary
collision.

**When is merging the right tool?**
When you do not own both declarations: augmenting a library, a genuine plugin
boundary, or publishing an interface as an extension point. Inside one codebase,
`extends` or an intersection expresses the same intent in one place and cannot
happen by accident.

**You see `TS2717` on a type you thought was declared once. What do you do?**
Search for the name project-wide rather than editing the type in the error. The
word "subsequent" means the compiler is looking at a second declaration — the bug
is that it exists, not that its member has the wrong type.

---

← [01 · What merges with what](./01-what-merges-with-what.md) · Up → [Overview](./README.md) · Next → [06 · Global augmentation](../06-global-augmentation.md)
