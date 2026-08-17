---
title: "Composing and naming"
sidebar_label: "02 · Composing and naming"
sidebar_position: 2
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mixins*) — the
> composition and `InstanceType` notes follow from the pattern in
> [chunk 01](./01-the-pattern.md), whose examples are quoted verbatim there.
> **No console block** — no sandbox run covers this phase.

## Composing more than one


Mixins compose by nesting, because each one takes a class and returns a class:

```ts
const PlayerSprite = Jumpable(Scale(Sprite));
```

Read it inside-out: `Sprite` gains scaling, and *that* gains jumping. The
instance type is the union of all three sets of members, and the constructor
signature is still `Sprite`'s.

**Order matters in exactly one way: later wins.** If two mixins define a member
with the same name, the outermost one shadows the inner, because it is a subclass
of it — ordinary prototype-chain behaviour, no special rule. That is also the
only way a mixin can *override* something: wrap a class that already has the
member and call `super.method()`.

```ts
function Logged<TBase extends new (...args: any[]) => { save(): void }>(
  Base: TBase,
) {
  return class extends Base {
    save() {
      console.log("saving");
      super.save();          // the wrapped class's implementation
    }
  };
}
```

The constraint in that example — requiring the base to *have* `save` — is the
subject of [chunk 03](./03-constrained-mixins.md).

## Naming the result

`Scale(Sprite)` produces a **value with no declared type name**. That is normal
and mostly harmless, but it changes how you write annotations elsewhere:

```ts
const EightBitSprite = Scale(Sprite);

type EightBitSprite = InstanceType<typeof EightBitSprite>;   // the instance type

function render(s: EightBitSprite) { /* … */ }
```

The `class` / `type` declaration-merging trick from
[topic 05](../05-interface-declaration-merging/README.md) is not available here —
there is no class *declaration* to merge with. `InstanceType<typeof X>` is the
standard way to recover a name, and declaring it beside the `const` (same
identifier, different slot — the value slot and the type slot from the
declaration table) reads well.

## Gotchas

**Symptom:** Two mixins define the same method and the wrong one runs
**Cause:** The outer (later-applied) mixin shadows the inner one.
**Fix:** Reorder the composition, or have the outer one call `super.method()`.

## Interview questions

**How do you compose several mixins, and does the order matter?**
Nest them: `Jumpable(Scale(Sprite))`. Order matters only for collisions — the
outermost mixin is the most-derived subclass, so its members shadow inner ones,
and it can call `super.method()` to wrap them. Otherwise the member sets simply
accumulate, and the constructor signature stays the base's.


**How do you write down the type of a composed class?**
There is no class declaration to name, so use the value:
`type EightBitSprite = InstanceType<typeof EightBitSprite>` beside the `const`.
The class occupies the value slot and the alias the type slot, so one identifier
serves both.

---

← Prev: [01 · The pattern](./01-the-pattern.md) · Next → [03 · Constrained mixins](./03-constrained-mixins.md)
