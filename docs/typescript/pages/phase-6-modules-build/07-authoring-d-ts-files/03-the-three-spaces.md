---
title: "The three declaration spaces"
sidebar_label: "03 · The three spaces"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** — *Declaration Files →
> Deep Dive*, from which the three spaces, the "what each declaration creates"
> table and the conflict rule are quoted verbatim. Diagnostic text is read out of
> the installed **TypeScript 5.9.3** message table. **No sandbox, no console
> blocks.**

[Chunk 02](./02-declaration-forms.md) is the *what to write*. This is the *why
it behaves like that* — the handbook's Deep Dive, which is the piece most people
skip and the piece that answers every "why can I merge these two but not those
two" question you will have about a declaration file.

## The three declaration spaces

This is the handbook's *Deep Dive*, and it is the piece most people skip. It
explains every "why can I merge these two but not those two" question you will
ever have about a declaration file.

**Every declaration puts a name into one, two or three separate spaces:**

| Declaration | Type | Value | Namespace |
|---|---|---|---|
| `interface` | ✓ | | |
| `type` | ✓ | | |
| `class` | ✓ | ✓ | |
| `enum` | ✓ | ✓ | |
| `function` | | ✓ | |
| `var` / `let` / `const` | | ✓ | |
| `namespace` | | ✓ | ✓ |
| `import` | ✓ *(if it refers to a type)* | ✓ *(if a value)* | ✓ *(if a namespace)* |

The handbook defines each space precisely. A **type** is introduced by a type
alias, an interface, a class, an enum, or an import that refers to a type.
**Values** are *"runtime names that can be referenced in expressions"*. And on
the third:

> Types can exist in *namespaces*. For example, if we have the declaration
> `let x: A.B.C`, the type `C` comes from the `A.B` namespace. Note that `A.B` is
> not necessarily a type or a value.

The conflict rule that falls out of it, verbatim:

> **Values** always conflict with other values of the same name unless declared
> as `namespace`s; **types** conflict if declared with a type alias; and
> **namespaces** never conflict.

## What the rule buys you

### Interfaces merge; type aliases collide

```ts
interface Foo { x: number }
// elsewhere
interface Foo { y: number }

let a: Foo;
console.log(a.x + a.y);   // OK
```

The same thing with `type Foo` twice is `TS2300: Duplicate identifier`. This
asymmetry is *why* declaration files are built on interfaces: it is what makes
third-party types extensible at all, and it is the entire mechanism behind
[Phase 4 · Interface declaration merging](../../phase-4-classes-declarations/05-interface-declaration-merging/README.md)
and module augmentation.

⚠️ **The handbook notes the one-way version too:** you can add to a `class` with
an `interface`, but *"you cannot add to type aliases"* with one.

```ts
class Foo { x: number }
// elsewhere
interface Foo { y: number }     // OK — adds y to the instance type
```

### `class` + `namespace` — statics and nested types

```ts
declare class Greeter { constructor(g: string); }
declare namespace Greeter {
  interface Options { modal: boolean }
}
// consumers write:  new Greeter("hi")  and  Greeter.Options
```

The handbook's minimal version of the same idea:

```ts
class C {}
// elsewhere
namespace C {
  export let x: number;
}
let y = C.x; // OK
```

### `function` + `namespace` — the shape half of npm actually is

```ts
declare function getArrayLength(arr: any[]): number;
declare namespace getArrayLength {
  const maxInterval: 12;
}
```

`getArrayLength(x)` and `getArrayLength.maxInterval` both work, because
`function` created a value and `namespace` created a value *and* a namespace, and
values that are namespaces do not conflict. There is no other way to describe a
callable with properties in a declaration file.

## When a name misbehaves, ask which space you are in

Two diagnostics are the compiler telling you that you crossed a boundary:

> **TS2749:** *"'{0}' refers to a value, but is being used as a type here. Did you
> mean 'typeof {0}'?"*
> **TS2503:** *"Cannot find namespace '{0}'."*

`TS2749` means the name exists only in the value space — a `const`, a `function`
— and you used it where a type belongs. `typeof` is the bridge from the value
space to the type space, and it is
[Phase 3 · The `typeof` type operator](../../phase-3-generics/07-typeof-type-operator.md).

`TS2503` means you wrote `Foo.Bar` as a type where `Foo` is an interface or a
type alias — neither creates a namespace. Either declare a real namespace, or
reach into the type with an indexed access, `Foo['Bar']`
([Phase 3 · Indexed access types](../../phase-3-generics/06-indexed-access-types.md)).


## Where this shows up in real declaration files

Three places, and you will meet all three:

1. **Module augmentation works because interfaces merge.** Adding `user` to
   Express's `Request` is a second `interface Request` declaration contributing a
   member. There is no other mechanism —
   [Phase 4 · Module augmentation](../../phase-4-classes-declarations/01-module-augmentation/README.md).
2. **`@types` packages describe callables with properties** using the
   function + namespace merge. Once you have seen it, half of DefinitelyTyped
   becomes readable.
3. **A global `interface` collides with `lib.dom.d.ts` by merging, not
   shadowing.** Declaring `interface Response { ok: boolean }` in a script file
   adds a member to the DOM's `Response` project-wide, silently — the
   module-or-global decision in [chunk 05](./05-module-or-global.md) is what
   controls whether you are exposed to that.

## Gotchas

**Symptom:** `TS2749: 'Foo' refers to a value, but is being used as a type here.
Did you mean 'typeof Foo'?`
**Cause:** The name only exists in the value space — a `const`, a `function`, a
`namespace`.
**Fix:** `typeof Foo`, or declare the type separately.

**Symptom:** `TS2503: Cannot find namespace 'Foo'.`
**Cause:** `Foo.Bar` in a type position where `Foo` is an interface or a type
alias; neither creates a namespace.
**Fix:** `declare namespace Foo` for a real container, or `Foo['Bar']`.

**Symptom:** `TS2300: Duplicate identifier 'Foo'.` on two type aliases.
**Cause:** Type aliases do not merge — they are a single binding in the type
space.
**Fix:** Make it an `interface` if merging is what you wanted; otherwise rename.

**Symptom:** An interface you declared merged with an unrelated one somewhere
else in the project.
**Cause:** Same name, same scope. Merging is silent and has no opt-out.
**Fix:** Scope it — make the file a module ([chunk 05](./05-module-or-global.md))
or put it in a namespace.

**Symptom:** You cannot add a member to somebody's exported `type Foo = …`.
**Cause:** Interfaces can be added to; type aliases cannot.
**Fix:** Intersect at the use site (`Foo & { extra: string }`), or ask upstream
to publish an interface. This is a real limitation, not a workaround you missed.

**Symptom:** Two `declare namespace Foo` blocks in different files both compile,
and you expected a conflict.
**Cause:** Namespaces never conflict — they merge.
**Fix:** Nothing to fix; that is the design. It is also why namespace-based
declaration files are extensible.

**Symptom:** A `class` you declared cannot hold a nested `interface`.
**Cause:** A class body is a value-space construct; it has no type-space
container.
**Fix:** Merge a `declare namespace` of the same name and put the interface
there.

**Symptom:** `import type { X }` then using `X` as a value fails.
**Cause:** A type-only import brings the name into the type space only, by
design.
**Fix:** Use a value import. That the two spaces are separable here is exactly
what makes `import type` erasable — **02 · `import type` and
`verbatimModuleSyntax`** *(not written yet)*.

## Interview questions

**★ What are the three declaration spaces, and why do they matter?**
Types, values and namespaces. A declaration lands in one, two or all three —
`interface` is type-only, `const` is value-only, `class` and `enum` are both,
`namespace` is value plus namespace. They matter because conflicts and merges are
decided *per space*: values collide unless they are namespaces, types collide if
declared with a type alias, and namespaces never collide.

**★ Why does declaring the same `interface` twice work, but the same `type` twice
does not?**
Interfaces merge by design — each declaration contributes members to one type.
Type aliases are a single binding in the type space and collide (`TS2300`). The
asymmetry is deliberate: it is what makes third-party declaration files
extensible, and it is the entire basis of module augmentation.

**★ How do you describe a JavaScript function that also has properties on it?**
Declare a function and a namespace with the same name. `function` creates a
value; `namespace` creates a value *and* a namespace; namespaces never conflict,
so the two merge. `getArrayLength(x)` and `getArrayLength.maxInterval` both
type-check.

**★ What is the bridge from the value space to the type space?**
`typeof`. It takes a name that exists as a value and yields its type, which is
exactly what `TS2749` suggests when you use a value where a type belongs.

**Can you add a member to a `class` from another file?**
Yes — with an `interface` of the same name, which merges into the instance type.
The handbook shows exactly this. You cannot do it to a `type` alias.

**Why can a `class` and a `namespace` share a name?**
Because a class occupies the type and value spaces, a namespace the value and
namespace spaces, and the rule is that values sharing a name are allowed when one
is a namespace. That merge is how statics and nested types get attached.

**Why avoid `enum` in a hand-written declaration file?**
Because `enum` creates a *value* — a real runtime object the library must
actually have. If it does not, the declaration is a lie that type-checks. A union
of literal types describes the same set with no runtime claim.

**Somebody's `.d.ts` exports `Foo` and you cannot use it as a type. Why?**
It was declared as something that creates only a value — a `const` or a
`function`. Use `typeof Foo`, or ask for a companion interface. Distinguishing
this from a genuine missing export is the practical payoff of knowing the spaces.

---

← Prev: [02 · The declaration forms](./02-declaration-forms.md) · Next → [04 · Generated, or written by hand](./04-generated-or-handwritten.md)
