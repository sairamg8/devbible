---
title: "Dismantling an over-generic API"
sidebar_label: "03 · Dismantling an over-generic API"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Functions → Guidelines
> for Writing Good Generic Functions*) and **typescript-eslint**'s
> `no-unnecessary-type-parameters` rule page. **No console block** — no sandbox
> run covers this phase.

## A worked refactor

Here is a signature of a kind that appears in most codebases eventually. Four
type parameters, all plausible-looking:

```ts
function fetchList<
  T,
  R extends { items: T[] },
  F extends (item: T) => boolean,
  K extends string = string,
>(url: K, filter: F): Promise<R> { /* … */ }
```

Take them one at a time, using the two tests from the
[overview](./README.md).

**`K extends string = string`** — appears once, as the type of `url`. The
constraint fully determines it and nothing reads it back. It is `string` with
extra steps, and its default hides that. **Delete it**; write `url: string`.

**`F extends (item: T) => boolean`** — appears once, as the type of `filter`.
This is the handbook's `filter2` case exactly: a parameter that "doesn't relate
two values", and one that forces any caller pinning `T` to pin `F` as well
(`TS2558`). **Delete it**; write `filter: (item: T) => boolean`.

**`R extends { items: T[] }`** — appears in the return position and in its own
constraint. A constraint is not an inference site, so nothing determines `R` from
the arguments; the caller states it. This is
[chunk 02](./02-the-unsafe-shape.md)'s unsafe shape wearing a constraint as a
disguise — the constraint makes it *look* checked while checking nothing about
what the server actually sent. **Delete it**, and let the return type be computed.

**`T`** — appears in `filter`'s parameter and (after the edits) in the return
type. Two positions, genuinely relating them. **Keep it.**

```ts
function fetchList<T>(
  url: string,
  filter: (item: T) => boolean,
): Promise<{ items: T[] }> { /* … */ }
```

⚠️ **One honest problem remains, and it is not a type-parameter problem.** `T` is
inferred from `filter`, which means the caller still decides what the server
returned — the runtime data is unvalidated. Fixing that is
[chunk 02](./02-the-unsafe-shape.md)'s validator argument, and it is a separate
change. Worth noticing that shrinking the generics made the remaining unsoundness
visible instead of burying it under three more parameters.

## The failure-shape catalogue

Each was met earlier in this phase; here they are in one place.

| Shape | Why it fails | Write instead |
|---|---|---|
| `<T>(x: T) => void` | One position, in a parameter | `(x: unknown) => void` |
| `<T>(url: string) => T` | One position, in the return — an assertion | Return `unknown`, or take a validator |
| `<T extends string>(s: T): void` | Constraint fully determines it | `(s: string): void` |
| `<Type extends any[]>(arr: Type)` | The bound lets `any` back in — indexing gives `any` | `<Type>(arr: Type[])` |
| `<T, F extends (x: T) => boolean>` | `F` relates nothing, and forces callers to pin it too | Write the callback type inline |
| `<T = any>` with no inference site | A silent `any` at every call ([topic 08](../08-default-type-parameters.md)) | `= unknown`, or drop the parameter |
| `class Result<T, E>` with a `success` flag | A discriminated union models it better ([topic 09](../09-generic-classes.md)) | `{ ok: true; value: T } \| { ok: false; error: E }` |
| `<const T>` where nothing indexes into `T` | Longer hovers, no benefit ([topic 12](../12-const-type-parameters/README.md)) | Drop the `const` |
| `<T>` added "in case we need it later" | Every caller pays now for a maybe | Add it when the second position exists |

## The `as`-in-the-body test

From [topic 05](../05-getprop-pattern/README.md), and it is the fastest check you
can run on code you already have:

> If you write `<T>` and then immediately write `as T` inside the function, the
> type parameter is not doing any work.

A correct generic's body type-checks on its own, because the relationship the
parameter expresses is real and the compiler can see it. A body needing `as T` is
one where the parameter was asserted rather than inferred — the `getJson` problem
with an extra step, and now with the assertion hidden inside the function where
callers cannot see it at all.

Two honest exceptions, so the test is not applied mechanically: a body may need
an assertion when it is bridging genuinely untyped input at a boundary, or when
implementing an overload set whose implementation signature is deliberately
wider. Both are places where the assertion is the *point* and is confined to one
audited function. Neither excuses a `<T>` on an ordinary helper.

## So when *is* it earning its place?

Ask what the parameter relates. There should be a straight answer:

- **Argument → return.** `identity`, `firstElement1`, `first<T>(items: T[]): T |
  undefined`, [`getProp<T, K>`](../05-getprop-pattern/README.md) — the return
  type is computed from what was passed in.
- **Argument → argument.** `setProp(obj, key, value)` ties the value's type to
  the key's; `filter1` ties the callback's parameter to the array's element.
- **Argument → a *later* call.** A `Repository<T>`'s constructor argument fixing
  what `findAll()` returns
  ([topic 03](../03-generic-interfaces-and-aliases/README.md)).

If none of those describes it, the parameter is a name for "whatever", and
`unknown` is the honest spelling.

## Trade-off

**Removing a type parameter** makes the signature shorter, the errors smaller,
and the call sites unable to lie. It costs flexibility you may want later, and
adding a parameter back is a breaking change for anyone passing type arguments
explicitly — which is precisely why library types accumulate them
([topic 08](../08-default-type-parameters.md)).

**Keeping it** preserves that flexibility and, in the `getJson` case, preserves a
comfortable fiction that a lot of teams like having. Saying that plainly matters:
the reason this shape is everywhere is that it feels good, not that anyone
believes it is checked.

The line worth holding: **in application code, delete it.** The flexibility is
hypothetical and the false safety is not. In a published library, weigh the
break — but a parameter appearing only in the return position is wrong there too,
and the validator form is what mature libraries converge on.

## Gotchas

**Symptom:** A generic function returns exactly what the caller asked for, always
**Cause:** The type parameter appears only in the return position, so it is
asserted rather than inferred.
**Fix:** Return `unknown` and narrow, or take a validator so the parameter is
inferred from something real.

**Symptom:** A caller must supply two type arguments to specify one
**Cause:** A second parameter — typically a bound on a callback — that relates
nothing, and type argument lists are all-or-nothing (`TS2558`).
**Fix:** Delete it and write the callback type inline.

**Symptom:** A generic returns `any` for an ordinary call
**Cause:** The container was parameterised with an `any`-ish constraint
(`Type extends any[]`) instead of the element.
**Fix:** Push the parameter down — `<Type>(arr: Type[])`.

**Symptom:** The parameter looks unused but the lint stays quiet
**Cause:** It is in the *inferred* return type, which counts as a second
position.
**Fix:** Nothing — that is a legitimate generic.

**Symptom:** The body needs `as T` to compile
**Cause:** The parameter was asserted, not inferred; there is no relationship for
the compiler to see.
**Fix:** Rework the signature so `T` is solved from an argument, or drop it.

**Symptom:** A generic class with a boolean flag and half its fields optional
**Cause:** A discriminated union modelled as a class.
**Fix:** The union — `T` and `E` then relate to real, present values in each arm.

**Symptom:** A constraint makes an unsafe signature look checked
**Cause:** A constraint restricts what a type argument *may* be; it is not an
inference site and validates nothing at runtime.
**Fix:** Judge the parameter by its positions, ignoring the constraint.

## Interview questions

**★ When should you not write a generic?**
When the type parameter appears only once in the signature. Type parameters exist
to relate the types of multiple values; one appearing once relates nothing and is
a longer way of writing `unknown`. The handbook states it as "Type Parameters
Should Appear Twice", counting the inferred return type as a position.

**★ What is wrong with `function getJson<T>(url: string): Promise<T>`?**
`T` appears only in the return type, so nothing infers it — the caller states it
and the compiler believes them. It is an unchecked `as` in angle-bracket form,
with no runtime validation. Return `Promise<unknown>` and narrow, or take a
`parse: (raw: unknown) => T` so `T` is inferred from something that actually
checks.

**★ What does "push type parameters down" mean?**
Parameterise the element, not the container: `<Type>(arr: Type[])` rather than
`<Type extends any[]>(arr: Type)`. The second returns `any` from `arr[0]` for an
ordinary call, because the constraint let `any` in through the back door.

**How do you spot a type parameter that is not doing work?**
Two tests. Count its positions in the signature, inferred return type included —
one position means it relates nothing. And look for `as T` in the body: if the
implementation must assert the parameter, there is no relationship for the
compiler to see.

**Why is an extra type parameter worse than just noise?**
Type argument lists are all-or-nothing (`TS2558`). A caller wanting to specify
one type argument must specify every one of them, including the parameter that
exists for no reason.

**Does a constraint make a return-position-only parameter safe?**
No. A constraint limits what a caller *may* claim; it is not an inference site
and checks nothing at runtime. `<R extends { items: T[] }>(url: string):
Promise<R>` is still an assertion — the constraint only narrows which lie is
tellable.

---

← [02 · The unsafe shape](./02-the-unsafe-shape.md) · Up → [Overview](./README.md) · Next → [14 · Variance](../14-variance.md)
