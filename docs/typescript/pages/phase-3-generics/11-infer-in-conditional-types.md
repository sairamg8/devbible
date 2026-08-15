---
title: "`infer` in conditional types"
sidebar_label: "11 · `infer`"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Type Manipulation →
> Conditional Types*, *Inferring Within Conditional Types*) and the **4.8 release
> notes** for `infer … extends`. **The `ReturnType`, `Parameters` and `Awaited`
> declarations below are quoted verbatim from `lib.es5.d.ts`**, comments
> included, rather than reproduced from memory. ⚠️ Install inspected: TypeScript
> **6.0.3**, not the 7.0.2 this corpus targets. **No console block** — no sandbox
> run covers this phase.

Every operator so far has *read* a type: `keyof` reads keys,
[`T[K]`](./06-indexed-access-types.md) reads a property, `typeof` reads a value's
type. `infer` is how you read a type out of a **position inside another type** —
the element of an array, the resolved value of a promise, the return of a
function.

It only exists inside a conditional type, so start there.

## Conditional types, in one paragraph

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<'hi'>;      // true
type B = IsString<42>;        // false
```

`T extends U ? X : Y` is a ternary in the type language. `extends` means the same
thing it means in a constraint ([topic 02](./02-constraints/README.md)) —
*assignable to* — and the whole thing resolves when `T` is known.

## `infer` names a piece of the pattern

```ts
type ElementType<T> = T extends (infer U)[] ? U : never;

type A = ElementType<string[]>;      // string
type B = ElementType<number>;        // never
```

Read `T extends (infer U)[]` as **"does `T` match the shape *array of
something*? If so, call that something `U`."** It is pattern matching: you write
the shape with a hole in it, and `infer` names the hole.

`U` is in scope only in the **true** branch, which is the whole reason a
conditional is required — there is nowhere else for the name to be meaningful.

## The library's own `infer` types, read from the source

These are the reference examples, verbatim from `lib.es5.d.ts`:

```ts
type Parameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;

type ReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : any;

type InstanceType<T extends abstract new (...args: any) => any> =
  T extends abstract new (...args: any) => infer R ? R : any;
```

Each is one conditional with one hole. `Parameters` puts the hole in the
parameter list and gets a **tuple** back; `ReturnType` puts it in the return
position. Note the fallbacks differ — `never` for `Parameters`, `any` for
`ReturnType` — which is a historical inconsistency in the standard library
rather than a principle.

And the genuinely hard one, also verbatim, comments and all:

```ts
type Awaited<T> = T extends null | undefined ? T :
    T extends object & { then(onfulfilled: infer F, ...args: infer _): any; } ?
        F extends ((value: infer V, ...args: infer _) => any) ?
            Awaited<V> :
        never :
    T;
```

Worth reading slowly, because it demonstrates almost everything at once:
**several `infer`s in one clause** (`F` and `_`), **a nested conditional** that
matches on an inferred type, **recursion** (`Awaited<V>`), and a
`_` throwaway name for a hole whose value is not wanted. It also shows the real
definition of "thenable" the compiler uses — an object with a callable `then` —
rather than the folk version.

## Writing your own

The useful ones are small:

```ts
type Unwrap<T> = T extends Promise<infer U> ? U : T;

type First<T> = T extends readonly [infer F, ...unknown[]] ? F : never;
type Last<T>  = T extends readonly [...unknown[], infer L] ? L : never;

type PropType<T, K extends keyof T> = T[K];              // no infer needed — use T[K]

type ArgOf<T> = T extends (arg: infer A) => unknown ? A : never;
```

⚠️ **The third line is a reminder, not an example.** Reading a property's type
does not need `infer` — an indexed access already does it. Reaching for a
conditional where `T[K]` would do is the most common over-use of this feature.

## Constrained `infer` (TypeScript 4.8)

```ts
type FirstChar<T> = T extends `${infer C extends string}${string}` ? C : never;

type NumericId<T> = T extends `${infer N extends number}` ? N : never;
type Id = NumericId<'42'>;      // 42, as a number literal — not '42'
```

`infer X extends C` both constrains what will match **and converts the result**
where the constraint is a primitive. Before 4.8 you had to infer a `string` and
then convert it with a second conditional; this is the tidy version, and it is
what makes template-literal parsing practical.

## 🔴 Distribution over unions

A conditional whose checked type is a **naked type parameter** distributes across
a union, evaluating once per member:

```ts
type Boxed<T> = T extends unknown ? T[] : never;

type A = Boxed<string | number>;      // string[] | number[]   ← NOT (string|number)[]
```

This is how `Exclude` and `Extract` work — their declarations in
`lib.es5.d.ts` are one line each precisely because distribution does the looping:

```ts
type Exclude<T, U> = T extends U ? never : T;
type Extract<T, U> = T extends U ? T : never;
```

`Exclude<'a'|'b'|'c', 'a'>` evaluates three times and unions the results, and the
`never`s vanish because `never` is the empty union.

**To switch distribution off, wrap both sides in a tuple:**

```ts
type IsUnion<T> = [T] extends [unknown] ? … : …;   // T is no longer naked
```

That `[T] extends [U]` idiom looks like a trick and it is a load-bearing one —
it is how you compare a union *as a whole* instead of member by member. It is
also the answer to "why does my conditional return a union when I expected one
type".

## `infer` position decides union or intersection

A subtle one, and the basis of a well-known utility:

```ts
type Co<T> = T extends { a: infer U; b: infer U } ? U : never;
// same name in two COVARIANT (property) positions → union

type Contra<T> = T extends { a: (x: infer U) => void; b: (x: infer U) => void } ? U : never;
// same name in two CONTRAVARIANT (parameter) positions → intersection
```

Inferring the same name from several **property** positions gives a union;
inferring it from several **parameter** positions gives an intersection. That
asymmetry is variance (**topic 14 · Variance** *(not written yet)* is the full account) and it is
the mechanism behind `UnionToIntersection`, which every "merge these types"
utility is built on.

You do not need to be able to write that from memory. You do need to recognise
that an unexpected intersection from an `infer` means a parameter position.

## Where this is going

`infer` is the entry point to **Phase 5 · Type-level programming**, where
conditionals, mapped types and template literals combine into things like typed
deep paths and schema inference. `z.infer<typeof schema>` — the thing that makes
validation libraries feel magical — is a conditional type with `infer` in it and
nothing more exotic.

**Two cautions before you go further.** Type-level recursion is where `TS2589`
actually bites (the `ts-p1` measurement put the threshold around 5000
instantiations, so ordinary data is fine and per-character recursion is not,
[topic 03](./03-generic-interfaces-and-aliases/02-parameter-placement-and-merging.md)).
And error messages inside a deep conditional are genuinely bad — a mismatch
reports the whole expanded type rather than the line you got wrong.

## Trade-off

**A conditional with `infer`** derives a type from a shape you do not control, so
it cannot drift, and it removes whole categories of hand-maintained duplication.
It costs readability — the reader has to run the pattern match in their head —
and it degrades error messages for everyone downstream.

**Restating the type by hand** is immediately legible and silently goes stale.

The line worth holding: **use `infer` to read from something you do not own**
(a library's return type, a schema, a third-party callback). Do not use it to
restate something you wrote ten lines above — `T[K]` and a plain alias are
better in every way there.

## Gotchas

**Symptom:** `Cannot find name 'U'` on the false branch
**Cause:** An `infer` name is in scope only in the true branch.
**Fix:** Put a fallback there (`: never`), or restructure the conditional.

**Symptom:** A conditional returns a union when a single type was expected
**Cause:** Distribution — the checked type is a naked type parameter.
**Fix:** `[T] extends [U] ? … : …` to compare the union as a whole.

**Symptom:** `infer` produces an intersection instead of a union
**Cause:** The same name was inferred from more than one *parameter* position,
which is contravariant.
**Fix:** Infer once, or accept the intersection — it is what
`UnionToIntersection` is built on.

**Symptom:** A conditional over `never` returns `never` unexpectedly
**Cause:** `never` is the empty union, so a distributive conditional has nothing
to iterate and yields `never`.
**Fix:** Guard with the `[T] extends [never]` form if you need to detect it.

**Symptom:** `TS2589: Type instantiation is excessively deep`
**Cause:** Recursion in the conditional with no terminating branch, or
per-character work on a long string.
**Fix:** Add a termination case, or cap the depth.

**Symptom:** A conditional is used where `T[K]` would do
**Cause:** Reaching for the powerful tool first.
**Fix:** Indexed access. Same result, readable, and no effect on error messages.

## Interview questions

**★ What does `infer` do?**
It names a hole in a type pattern, inside a conditional type. `T extends (infer
U)[] ? U : never` asks "does `T` match *array of something*?" and binds that
something to `U`, which is in scope only in the true branch. It is pattern
matching in the type language.

**★ How is `ReturnType` implemented?**
`type ReturnType<T extends (...args: any) => any> = T extends (...args: any) =>
infer R ? R : any` — one conditional with the hole in the return position.
`Parameters` is the same shape with the hole in the parameter list, which yields
a tuple.

**★ What is a distributive conditional type?**
One whose checked type is a naked type parameter: it evaluates once per union
member and unions the results, so `Boxed<string | number>` is `string[] |
number[]` rather than `(string | number)[]`. It is why `Exclude` and `Extract`
are one line each. Wrap both sides in a tuple — `[T] extends [U]` — to compare
the union as a whole instead.

**Why would an `infer` produce an intersection?**
Because the same name was inferred from more than one *parameter* position, which
is contravariant; property positions give a union. That asymmetry is what
`UnionToIntersection` exploits.

**When should you not reach for a conditional type?**
When an indexed access would do. Reading a property's type is `T[K]`, not a
conditional — and every conditional you add makes downstream error messages
worse, since a mismatch reports the whole expanded type rather than the line that
was wrong.

---

← Prev: [10 · Inference sites and contextual typing](./10-inference-sites-and-contextual-typing.md) · Next → **12 · `const` type parameters** *(not written yet)*
