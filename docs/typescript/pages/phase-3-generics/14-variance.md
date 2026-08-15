---
title: "Variance"
sidebar_label: "14 · Variance"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 4.7 release notes** (*Optional
> Variance Annotations for Type Parameters*) and the **tsconfig reference** for
> `strictFunctionTypes` — the `Getter`/`Setter`/`State` declarations, the
> `StringOrNumberFunc` example, the variance-annotation error text and the
> methods-are-exempt note are **quoted verbatim** from those pages. **No console
> block** — no sandbox run covers this phase.

This is a **Know** topic: you need to recognise variance when an error message
names it, and know the one rule that actually bites in day-to-day TypeScript. You
do not need to derive it.

The question variance answers is: **`Dog` is assignable to `Animal` — so what is
the relationship between `F<Dog>` and `F<Animal>`?** It depends entirely on what
`F` does with its parameter, and there are four possible answers.

| Name | Relationship | Where it comes from |
|---|---|---|
| **Covariant** | `F<Dog>` → `F<Animal>` (same direction) | `T` is an **output** — `() => T`, `readonly T[]` |
| **Contravariant** | `F<Animal>` → `F<Dog>` (reversed) | `T` is an **input** — `(value: T) => void` |
| **Invariant** | neither direction | `T` is **both** — `{ get(): T; set(v: T): void }` |
| **Bivariant** | both directions | Unsound; TypeScript keeps it deliberately in two places |

TypeScript works this out **structurally, on its own** — you almost never declare
it. That is why most people write generics for years without meeting the word.

## Output positions are covariant

```ts
type Getter<out T> = () => T;
```

A thing that produces `Dog`s is a thing that produces `Animal`s. Safe, obvious,
and the direction people assume applies everywhere.

## Input positions are contravariant, and this is the surprise

```ts
type Setter<in T> = (value: T) => void;
```

Reversed. A function that accepts **any** `Animal` can stand in wherever a
function accepting `Dog`s is needed — it handles more, so it is *more* usable,
not less. A function accepting only `Dog`s cannot stand in for one accepting any
`Animal`, because it will be handed a `Cat`.

`strictFunctionTypes` is the flag that enforces this. Off, the unsafe assignment
goes through:

```ts
function fn(x: string) {
  console.log("Hello, " + x.toLowerCase());
}

type StringOrNumberFunc = (ns: string | number) => void;

// Unsafe assignment
let func: StringOrNumberFunc = fn;

// Unsafe call - will crash
func(10);
```

`10` reaches `x.toLowerCase()`. On, the same line is rejected, and the error
walks you through the contravariance:

```
Type '(x: string) => void' is not assignable to type 'StringOrNumberFunc'.
  Types of parameters 'x' and 'ns' are incompatible.
    Type 'string | number' is not assignable to type 'string'.
      Type 'number' is not assignable to type 'string'.
```

Read the nesting: to assign the function, the *target's* parameter type must be
assignable to the *source's* — the comparison flipped. That flip is
contravariance, and recognising it in an error message is most of what this topic
is for.

`strictFunctionTypes` is on under `strict`, which is on by default in a modern
`tsconfig.json`.

## 🔴 The exception that matters: methods are still bivariant

This is the one to carry away, because it is a hole in `strict` that most people
never learn about. From the tsconfig reference, verbatim:

> During development of this feature, we discovered a large number of inherently
> unsafe class hierarchies, including some in the DOM. Because of this, the
> setting only applies to functions written in *function* syntax, not to those in
> *method* syntax

So these two are **not** checked the same way:

```ts
interface A {
  handle: (e: MouseEvent) => void;   // property, function syntax → contravariant
}

interface B {
  handle(e: MouseEvent): void;       // method syntax → still BIVARIANT
}
```

`B`'s version accepts an unsafe assignment that `A`'s rejects. Nothing in the
syntax hints at it, `strict` does not close it, and there is no flag that does —
it was left open because closing it would break the DOM's own type definitions
and a great deal of existing class code.

**Practical consequence:** if you want a callback-shaped member checked properly,
declare it as a **property with a function type**, not as a method. That single
habit is the entire actionable content of this page.

## Arrays are covariant, and that is also unsound

```ts
const dogs: Dog[] = [];
const animals: Animal[] = dogs;   // allowed
animals.push(new Cat());          // now `dogs` contains a Cat
```

`Array<T>` has `T` in both input and output positions, so it *should* be
invariant. TypeScript treats it as covariant anyway, for the same reason: strict
invariance would reject an enormous amount of ordinary, mostly-fine code. It is a
known, deliberate hole.

`readonly T[]` has no input positions, so it is genuinely covariant and genuinely
safe — one more reason to prefer it in signatures, alongside the `as const`
reasons from [topic 12](./12-const-type-parameters/README.md).

## Optional variance annotations (TypeScript 4.7)

You can write the variance down instead of letting it be inferred:

```ts
type Getter<out T> = () => T;
type Setter<in T> = (value: T) => void;

interface State<in out T> {
    get: () => T;
    set: (value: T) => void;
}
```

The release notes explain the naming plainly — *"`out` and `in` are used because
a type parameter's variance depends on whether it's used in an output or an
input"*. So you do not have to think in terms of variance at all; you ask where
`T` appears.

**What the annotations buy you.** Two things, per the release notes: they **speed
up type-checking** — TypeScript can "skip deeper comparisons and just compare
type arguments", which matters in large recursive or circular types — and they
**document intent**. What they do *not* do is change how your type behaves. The
variance was already there; you are stating it.

**And they are checked.** Annotate wrongly and the compiler tells you, quoting
the member that contradicts you. Drop the `in` from `State`:

```ts
interface State<out T> {
    //          ~~~~~
    // error!
    // Type 'State<sub-T>' is not assignable to type 'State<super-T>' as implied by variance annotation.
    //   Types of property 'set' are incompatible.
    //     Type '(value: sub-T) => void' is not assignable to type '(value: super-T) => void'.
    //       Types of parameters 'value' and 'value' are incompatible.
    //         Type 'super-T' is not assignable to type 'sub-T'.
    get: () => T;
    set: (value: T) => void;
}
```

`set` puts `T` in an input position, which makes the type invariant, and the
error says so in as many words — *"as implied by variance annotation"* is the
phrase to recognise.

⚠️ `in`/`out` go on the type parameters of a **class, interface or type alias** —
the placement list behind `TS1274`, and the mirror of where
[`const`](./12-const-type-parameters/README.md) is allowed. Reach for them for
performance in a large type, or to pin an intended contract in a library. In
application code they are almost always unnecessary.

## Where you have already met this

- **[Topic 02](./02-constraints/README.md)** — `(...args: never[]) => unknown` is
  the right "any function" bound precisely because parameters are contravariant:
  `never` is assignable to everything, so it accepts any parameter list.
- **[Topic 11](./11-infer-in-conditional-types.md)** — inferring the same name
  from several *property* positions gives a union, from several *parameter*
  positions gives an intersection. Covariant versus contravariant; that asymmetry
  is what `UnionToIntersection` is built on.
- **React** — an `onChange` prop typed as a method rather than a property is the
  most common place the bivariance hole shows up in application code.

## Trade-off

**Writing `in`/`out`** makes a large type's checking measurably cheaper and
states a contract the compiler will hold you to. It costs a concept most readers
of your code do not have, on a line they have to read anyway.

**Leaving variance inferred** — the default, and correct nearly always — is free
and right, until a deeply recursive generic makes the checker slow.

The habit actually worth adopting is neither: **declare callback-shaped members
as properties with function types rather than as methods**, so
`strictFunctionTypes` can do its job.

## Gotchas

**Symptom:** An obviously-wrong callback assignment is accepted under `strict`
**Cause:** The member is declared in *method* syntax, which is still checked
bivariantly — `strictFunctionTypes` only applies to function syntax.
**Fix:** Declare it as a property: `handle: (e: MouseEvent) => void`.

**Symptom:** A function type will not assign, and the error compares the
parameters the "wrong way round"
**Cause:** Parameters are contravariant, so the target's parameter must be
assignable to the source's.
**Fix:** Widen the source's parameter, or narrow the target's. The error is
correct.

**Symptom:** `Type 'X<sub-T>' is not assignable to type 'X<super-T>' as implied
by variance annotation`
**Cause:** An `in`/`out` annotation contradicts how `T` is actually used — a
`set`-like member makes it invariant.
**Fix:** `in out`, or remove the annotation and let it be inferred.

**Symptom:** A `Cat` turned up in a `Dog[]`
**Cause:** Array covariance — assigning `Dog[]` to `Animal[]` is allowed, and the
alias can then push anything.
**Fix:** `readonly Animal[]` in the receiving signature, which has no input
position and is safe.

**Symptom:** A modifier-placement error on `in`/`out`
**Cause:** They belong on a class, interface or type alias (`TS1274`); `const` is
the one for functions and methods.
**Fix:** Move it, or drop it.

## Interview questions

**★ What is contravariance, in one example?**
Function parameters. A `(x: Animal) => void` is assignable to
`(x: Dog) => void`, not the other way round — a handler that copes with any
animal can stand in for one that only copes with dogs. The relationship reverses,
which is why `strictFunctionTypes` errors compare the parameters in what looks
like the wrong direction.

**★ Does `strict` make function assignment sound?**
No, and the gap is worth knowing. `strictFunctionTypes` applies only to members
written in *function* syntax; anything in *method* syntax is still compared
bivariantly. The docs say it was left that way because strict checking uncovered
a large number of unsafe class hierarchies, including some in the DOM. Declaring
callback members as properties rather than methods is how you opt in.

**What do `in` and `out` do?**
They state a type parameter's variance explicitly — `out` for output positions,
`in` for input, `in out` for both. They do not change behaviour; they let the
checker skip deep structural comparisons (a real speed-up in large or circular
types), document intent, and produce an error if the annotation contradicts how
the parameter is actually used.

**Why is `Array<T>` unsound?**
`T` appears in both input and output positions, so it ought to be invariant, but
TypeScript treats arrays as covariant deliberately — invariance would reject far
too much ordinary code. `readonly T[]` has no input position and is genuinely
safe.

**Where does variance show up in type-level code?**
Inferring one `infer` name from several property positions yields a union; from
several parameter positions it yields an intersection. That is covariance versus
contravariance, and it is the mechanism behind `UnionToIntersection`.

---

← Prev: [13 · When *not* to write a generic](./13-when-not-to-write-a-generic/README.md) · Up → [Phase 3 · Generics](./README.md)
