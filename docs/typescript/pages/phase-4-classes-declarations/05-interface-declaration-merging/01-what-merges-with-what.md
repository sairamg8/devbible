---
title: "What merges with what"
sidebar_label: "01 · What merges with what"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Merging* —
> *Basic Concepts*, *Merging Namespaces*, *Merging Namespaces with Classes,
> Functions, and Enums*, *Disallowed Merges*). The declaration table and the
> `Animals`, `buildLabel`, `Album` and `Color` examples are **quoted verbatim**.
> `TS2300`'s text is read out of the **compiler's own diagnostic table** (⚠️
> install inspected: TypeScript **6.0.3**). **No console block** — no sandbox run
> covers this phase.

## What a declaration actually creates

This table is the key to the whole subject, and it is worth more than any list of
rules:

| Declaration Type | Namespace | Type | Value |
|---|---|---|---|
| **Namespace** | X | X | X |
| **Class** | | X | X |
| **Enum** | | X | X |
| **Interface** | | X | |
| **Type Alias** | | X | |
| **Function** | | | X |
| **Variable** | | | X |

Read it as **three separate namespaces of names sharing one identifier.**
`class Foo` puts `Foo` in the **type** slot *and* the **value** slot — which is
why `typeof Foo` is meaningful
([phase 3 · topic 07](../../phase-3-generics/07-typeof-type-operator.md)) and why
you can both annotate with it and call `new` on it. `interface Foo` puts `Foo`
only in the type slot, which is why `interface Foo {}` and `const Foo = 1` can
coexist without complaint.

**Two declarations can coexist when they do not collide in the same slot.** That
one sentence explains every merge below and every disallowed one, and it is worth
more than memorising the cases.

## Adding a namespace to something

A `function` occupies only the **value** slot, so a `namespace` of the same name
can supply the rest. The result is typed properties on a function:

```ts
function buildLabel(name: string): string {
  return buildLabel.prefix + name + buildLabel.suffix;
}

namespace buildLabel {
  export let suffix = "";
  export let prefix = "Hello, ";
}

console.log(buildLabel("Sam Smith"));
```

That is the typed version of `fn.someProperty = …`, which JavaScript libraries do
constantly and which is otherwise awkward to describe.

The same trick nests a **type** under a class's name — the inner-class pattern:

```ts
class Album {
  label: Album.AlbumLabel;
}

namespace Album {
  export class AlbumLabel {}
}
```

And attaches helpers to an enum:

```ts
enum Color {
  red = 1,
  green = 2,
  blue = 4,
}

namespace Color {
  export function mixColor(colorName: string) {
    if (colorName == "yellow") {
      return Color.red + Color.green;
    }
    // …
  }
}
```

Namespaces merge with each other exactly as you would expect:

```ts
namespace Animals {
  export class Zebra {}
}

namespace Animals {
  export interface Legged {
    numberOfLegs: number;
  }
  export class Dog {}
}
```

⚠️ **These are legacy-flavoured patterns.** `namespace` predates ES modules, and
new code should generally not reach for it — but you will meet all three in
`.d.ts` files and older libraries, and the `Album.AlbumLabel` shape in particular
is common in published type definitions. Recognising it is the point; writing it
usually is not.

## What cannot merge

> Not all merges are allowed in TypeScript. Currently, **classes can not merge
> with other classes or with variables.**

Both fall straight out of the table. Two classes would collide in the value slot
*and* the type slot; a class and a variable collide in the value slot.

The one you will actually hit day to day:

```ts
type Box = { a: number };
type Box = { b: number };   // TS2300
```

> **TS2300:** *"Duplicate identifier '{0}'."*

A type alias creates only a **type**, and it is a **closed** declaration —
declaring it twice is a collision, not a merge. An `interface` in the same
position merges silently, which is
[chunk 02](./02-the-accidents.md)'s entire subject.

## Gotchas

**Symptom:** Two classes with the same name will not merge
**Cause:** They collide in both the type and the value slot — explicitly
disallowed.
**Fix:** Rename one. If you wanted to attach static members, merge a `namespace`
with the class instead.

**Symptom:** `TS2300: Duplicate identifier` on a `type`, where the same code with
`interface` compiled
**Cause:** Type aliases are closed declarations; interfaces are open.
**Fix:** Rename one — and note that this error is the *useful* behaviour.

**Symptom:** `interface Foo {}` and `const Foo = …` coexist and you expected a
clash
**Cause:** Different slots — one is a type, the other a value.
**Fix:** Nothing is wrong. This is also why `typeof Foo` and `Foo` can mean
different things.

**Symptom:** A property on a function will not type-check
**Cause:** A function declaration creates only a value; there is nowhere for the
property to be declared.
**Fix:** Merge a `namespace` of the same name, as in `buildLabel`.

**Symptom:** `Album.AlbumLabel` resolves in a library's types and you cannot see
how
**Cause:** A namespace merged with the class to nest a type under its name.
**Fix:** Nothing — recognise the pattern.

## Interview questions

**★ What does the declaration-merging table tell you?**
That every declaration creates some combination of a namespace, a type and a
value — `class` creates a type and a value, `interface` only a type, `function`
only a value. Two declarations coexist when they do not collide in the same slot,
which is why a `namespace` can merge with a function, a class or an enum, and why
two classes cannot merge at all.

**★ Why can a `namespace` merge with a function?**
Because a function occupies only the value slot, and the namespace supplies the
rest. The practical result is typed properties on a function — `buildLabel.prefix`
— which is how you describe the `fn.someProperty` pattern JavaScript libraries use
constantly.

**What cannot merge?**
Classes with other classes, and classes with variables — both collide in the
value slot. And a type alias cannot be declared twice at all: it is closed, so
the second declaration is `TS2300: Duplicate identifier`.

**Why can `interface Foo` and `const Foo` coexist?**
They occupy different slots — the interface is only a type, the variable only a
value. It is the same reason `typeof Foo` is a meaningful thing to write about a
class.

---

← [Overview](./README.md) · Next → [02 · The accidents](./02-the-accidents.md)
