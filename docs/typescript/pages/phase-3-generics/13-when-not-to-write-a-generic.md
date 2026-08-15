---
title: "When *not* to write a generic"
sidebar_label: "13 · When not to write a generic"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Functions → Guidelines
> for Writing Good Generic Functions*) — the three guidelines and their code
> examples below are **quoted verbatim from that page** — and against
> **typescript-eslint**'s `no-unnecessary-type-parameters` rule page for the lint
> that enforces it. **No console block** — no sandbox run covers this phase.

Twelve topics of machinery, and this is the one that decides whether any of it
was worth using. Almost every genuinely bad generic in a real codebase is bad for
the same reason, and the handbook states it in one line:

> Remember, type parameters are for *relating the types of multiple values*. If a
> type parameter is only used once in the function signature, it's not relating
> anything.

That is the whole test. A type parameter is a **variable in the type language**
(topic 01), and a variable that appears once in an equation is not being solved
for — it is just a name for "whatever".

## The handbook's three guidelines

### Type Parameters Should Appear Twice

> **Rule**: If a type parameter only appears in one location, strongly reconsider
> if you actually need it

```ts
function greet<Str extends string>(s: Str) {
  console.log("Hello, " + s);
}

greet("world");
```

```ts
function greet(s: string) {
  console.log("Hello, " + s);
}
```

The second is the same function with less to read. `Str` was never used for
anything — it took a literal type in and threw it away.

🔴 **The nuance that catches people, stated by the handbook itself:** this
"includes the inferred return type". If `Str` had been part of the inferred
return type, it would be relating the argument to the result and would count as
**used twice despite appearing once in the written code**. So do not count
occurrences in the source — count *positions in the signature*, inferred ones
included.

### Use Fewer Type Parameters

> **Rule**: Always use as few type parameters as possible

```ts
function filter1<Type>(arr: Type[], func: (arg: Type) => boolean): Type[] {
  return arr.filter(func);
}

function filter2<Type, Func extends (arg: Type) => boolean>(
  arr: Type[],
  func: Func
): Type[] {
  return arr.filter(func);
}
```

`Func` "doesn't relate two values", in the handbook's words — it appears once, as
a bound on a parameter that `(arg: Type) => boolean` already described perfectly.
The cost is not only noise: a caller who wants to pass `Type` explicitly now has
to supply a second type argument too, because
[type argument lists are all-or-nothing](./02-constraints/README.md) (`TS2558`).

### Push Type Parameters Down

> **Rule**: When possible, use the type parameter itself rather than constraining
> it

```ts
function firstElement1<Type>(arr: Type[]) {
  return arr[0];
}

function firstElement2<Type extends any[]>(arr: Type) {
  return arr[0];
}

// a: number (good)
const a = firstElement1([1, 2, 3]);

// b: any (bad)
const b = firstElement2([1, 2, 3]);
```

Same call, and one of them returns `any`. Parameterise the **element** and let
the array structure be written out (`Type[]`), rather than parameterising the
whole array and hoping indexing recovers something. This is the constraint
version of the same disease: `Type extends any[]` is a bound that proves the
parameter is ceremony.

## The lint that enforces it

`@typescript-eslint/no-unnecessary-type-parameters` — *"Disallow type parameters
that aren't used multiple times."* Its own summary of the principle:

> Type parameters relate two types. If a type parameter is only used once, then
> it is not relating anything.

```ts
// incorrect
function second<A, B>(a: A, b: B): B {
  return b;
}

// correct
function second<B>(a: unknown, b: B): B {
  return b;
}
```

`A` was doing nothing that `unknown` does not do, and `unknown` says so honestly.
Turning this rule on is the cheapest way to stop the whole category, and the
fixes it suggests are almost always the ones above.

## 🔴 The dangerous shape: a parameter only in the return type

This one is not merely useless — it is actively unsafe, and it is the single most
common bad generic in application code:

```ts
declare function getJson<T>(url: string): Promise<T>;

const user = await getJson<User>('/api/me');   // user: User
```

`T` appears once, in the return position. Nothing in the arguments can determine
it, so there is no inference to do — the caller simply *states* it, and the
compiler agrees. **That is an unchecked `as` wearing angle brackets**, and it
survives review because it looks like typed code.

Nothing was validated. If the endpoint returns `{ error: 'unauthorized' }`, the
program has a `User` typed value holding something else, and the failure surfaces
somewhere unrelated. Reach back to [topic 10](./10-inference-sites-and-contextual-typing.md)
for why: with no inference site the parameter falls to `unknown`, or to whatever
the context supplies — and here the context is a lie the caller told.

**What to write instead** — return the truth and make the caller narrow it:

```ts
declare function getJson(url: string): Promise<unknown>;
```

…or take a validator, which restores a genuine relationship between an argument
and the return type:

```ts
declare function getJson<T>(url: string, parse: (raw: unknown) => T): Promise<T>;
```

Now `T` appears twice, it is *inferred* from `parse` rather than asserted, and
something actually checks at runtime. Phase 9 (*Types at the boundary*) is where
this becomes the design of a whole layer.

## The other failure shapes, gathered

Each was met earlier in this phase; here they are as one checklist.

| Shape | Why it fails | Write instead |
|---|---|---|
| `<T>(x: T) => void` | Appears once, in a parameter | `(x: unknown) => void` |
| `<T>(url: string) => T` | Appears once, in the return | Return `unknown`, or take a validator |
| `<T extends string>(s: T): void` | Constraint fully determines it | `(s: string): void` |
| `<T = any>` with no inference site | A silent `any` at every call ([topic 08](./08-default-type-parameters.md)) | `= unknown`, or drop the parameter |
| `class Result<T, E>` with a `success` flag | A discriminated union models it better ([topic 09](./09-generic-classes.md)) | `{ ok: true; value: T } \| { ok: false; error: E }` |
| `<const T>` where nothing indexes into `T` | Longer hovers, no benefit ([topic 12](./12-const-type-parameters.md)) | Drop the `const` |
| `<T>` added "in case we need it later" | Every caller pays now for a maybe | Add it when the second position exists |

## The `as`-in-the-body test

From [topic 05](./05-getprop-pattern/README.md), and it is the fastest check you
can run on your own code:

> If you write `<T>` and then immediately write `as T` inside the function, the
> type parameter is not doing any work.

A correct generic's body type-checks on its own, because the relationship the
parameter expresses is real and the compiler can see it. A body that needs `as T`
is one where the parameter was asserted rather than inferred — the `getJson`
problem with an extra step.

## So when *is* it earning its place?

Ask what the parameter relates. There should be a straight answer:

- **Argument → return.** `identity`, `firstElement1`, `getProp<T, K>` — the
  return type is computed from what was passed in.
- **Argument → argument.** `setProp(obj, key, value)` ties the value's type to
  the key's ([topic 05](./05-getprop-pattern/README.md)); `filter1` ties the
  callback's parameter to the array's element.
- **Argument → a *later* call.** A `Repository<T>`'s constructor argument fixing
  what `findAll()` returns ([topic 03](./03-generic-interfaces-and-aliases/README.md)).

If none of those describes it, the parameter is a name for "whatever", and
`unknown` is the honest spelling of that.

## Trade-off

**Removing a type parameter** makes the signature shorter, the errors smaller and
the call sites unable to lie. It costs flexibility that you may genuinely want
later, and adding a parameter back is a breaking change for anyone passing type
arguments explicitly — which is exactly why library types accumulate them
([topic 08](./08-default-type-parameters.md)).

**Keeping it** preserves that flexibility and, in the `getJson` case, preserves a
comfortable fiction that many teams like having.

The line worth holding: **in application code, delete it.** The flexibility is
hypothetical and the false safety is not. In a published library, weigh the
break — but a parameter that only appears in the return position is wrong there
too, and the validator form is what mature libraries converge on.

## Gotchas

**Symptom:** A generic function returns exactly what the caller asked for, always
**Cause:** The type parameter appears only in the return position, so it is
asserted rather than inferred.
**Fix:** Return `unknown` and narrow, or take a validator argument so the
parameter is inferred from something real.

**Symptom:** A caller must supply two type arguments to specify one
**Cause:** A second parameter (typically a constraint on a callback) that relates
nothing — and type argument lists are all-or-nothing.
**Fix:** Delete it and write the callback type out inline.

**Symptom:** A generic returns `any` for an ordinary call
**Cause:** The whole container was parameterised with an `any`-ish constraint
(`Type extends any[]`) instead of the element.
**Fix:** Push the parameter down — `<Type>(arr: Type[])`.

**Symptom:** The parameter looks unused but the lint rule stays quiet
**Cause:** It is in the *inferred* return type, which counts as a second use.
**Fix:** Nothing to fix — that is a legitimate generic.

**Symptom:** The body needs `as T` to compile
**Cause:** The parameter was asserted, not inferred; the compiler cannot see the
relationship because there is not one.
**Fix:** Rework the signature so `T` is solved from an argument, or drop it.

**Symptom:** A generic class with a boolean flag and half its fields optional
**Cause:** A discriminated union modelled as a class.
**Fix:** The union. `T` and `E` then relate to real, present values in each arm.

## Interview questions

**★ When should you not write a generic?**
When the type parameter appears only once in the signature. Type parameters exist
to relate the types of multiple values; one that appears once relates nothing and
is a longer way of writing `unknown`. The handbook states it as "Type Parameters
Should Appear Twice" — counting the inferred return type as a position.

**★ What is wrong with `function getJson<T>(url: string): Promise<T>`?**
`T` appears only in the return type, so nothing infers it — the caller states it
and the compiler believes them. It is an unchecked `as` in angle-bracket form,
and no runtime validation happens. Return `Promise<unknown>` and narrow, or take
a `parse: (raw: unknown) => T` so `T` is inferred from something that actually
checks.

**★ What does "push type parameters down" mean?**
Parameterise the element, not the container: `<Type>(arr: Type[])` rather than
`<Type extends any[]>(arr: Type)`. The second returns `any` from `arr[0]` for an
ordinary call, because the constraint let `any` in through the back door.

**How do you spot a type parameter that is not doing work?**
Two quick tests. Count its positions in the signature, inferred return type
included — one position means it relates nothing. And look for `as T` in the
body: if the implementation has to assert the parameter, the compiler cannot see
the relationship, because there is not one.

**Why is an extra type parameter worse than just noise?**
Because type argument lists are all-or-nothing (`TS2558`). A caller who wants to
specify one type argument must now specify every one of them, including the
parameter that exists for no reason.

---

← Prev: [12 · `const` type parameters](./12-const-type-parameters.md) · Next → **14 · Variance** *(not written yet)*
