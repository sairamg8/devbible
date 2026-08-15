---
title: "Parameterising a type"
sidebar_label: "01 · Parameterising a type"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generics → Generic
> Types*, *Type Manipulation*). **The utility-type declarations quoted below are
> read verbatim from `lib.es5.d.ts`** — including `type NonNullable<T> = T & {};`
> and `type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;` —
> rather than reproduced from memory. `TS2314` (*"Generic type '{0}' requires
> {1} type argument(s)."*) was read out of the compiler's own diagnostic table.
> ⚠️ Install inspected: TypeScript **6.0.3**, not the 7.0.2 this corpus targets.
> **No console block** — no sandbox run covers this phase.

Topics 01 and 02 parameterised *functions*. The same mechanism applies to
**types**, and that is what turns a generic from a convenience into the way you
model a whole domain.

```ts
interface Box<T> {
  value: T;
}

type Box<T> = { value: T };        // the alias form
```

Both declare a **type constructor**: `Box` is not a type, it is something that
becomes a type when given one. `Box<string>` is a type; `Box` alone is an error:

```text
error TS2314: Generic type 'Box' requires 1 type argument(s).
```

That distinction is worth holding on to, because it explains most of the
confusing messages in this area. `Box` is to `Box<string>` roughly what
`function first` is to `first([1,2,3])` — a thing waiting for an argument.

## The two forms are not equivalent

For a plain object shape they are interchangeable, and
[Phase 1 · `type` vs `interface`](../../phase-1-type-vocabulary/07-type-vs-interface.md)
covers the general choice. **Generics is where the two genuinely diverge**,
because an alias can name things an interface cannot express at all:

```ts
// A union — an interface cannot be one.
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// A function type.
type Handler<T> = (payload: T) => void;

// A conditional type.
type Unwrap<T> = T extends Promise<infer U> ? U : T;

// A mapped type.
type Nullable<T> = { [K in keyof T]: T[K] | null };

// A primitive or a tuple.
type Pair<T> = [T, T];
type Id<T extends string> = `id:${T}`;
```

**An interface can only ever describe an object shape** (or a callable/newable
one). Everything above is alias-only territory, and almost all of the interesting
type-level work in later phases lives there.

What an interface has that an alias does not is **declaration merging**, covered
in [chunk 02](./02-parameter-placement-and-merging.md).

## The lib's own utility types are the worked examples

You do not have to imagine what good generic aliases look like — the standard
library is made of them. These are the actual declarations from `lib.es5.d.ts`:

```ts
type Partial<T>  = { [P in keyof T]?: T[P] };
type Required<T> = { [P in keyof T]-?: T[P] };
type Readonly<T> = { readonly [P in keyof T]: T[P] };

type Pick<T, K extends keyof T> = { [P in K]: T[P] };
type Record<K extends keyof any, T> = { [P in K]: T };

type Exclude<T, U> = T extends U ? never : T;
type Extract<T, U> = T extends U ? T : never;
type NonNullable<T> = T & {};

type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
```

Three things worth reading out of that list.

**`Pick<T, K extends keyof T>` constrains `K` against `T`** — the
`K extends keyof T` pattern from [topic 02](../02-constraints/README.md), used
in a type rather than a function. `Pick<User, 'nmae'>` is an error.

**🔴 `Omit<T, K extends keyof any>` does not.** `keyof any` is
`string | number | symbol`, so **`Omit<User, 'nmae'>` compiles happily and
silently omits nothing.** This is one of the best-known sharp edges in the
standard library, it is visible right there in the declaration, and it is why
codebases define their own stricter version:

```ts
type StrictOmit<T, K extends keyof T> = Omit<T, K>;
```

**`NonNullable<T> = T & {}`** is not the conditional type most people remember.
It intersects with `{}`, which accepts everything except `null` and `undefined`
— a neater formulation that arrived later, and a good reminder that the *current
declaration* is the source of truth rather than the version you learned.

## Modelling with a generic alias: the result type

The single most valuable shape in this topic is a parameterised discriminated
union ([Phase 2 · topic 05](../../phase-2-narrowing/05-discriminated-unions.md)):

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function loadUser(id: string): Promise<Result<User, 'not-found' | 'network'>> {
  …
}

const r = await loadUser('1');
if (r.ok) {
  r.value.name;        // User
} else {
  r.error;             // 'not-found' | 'network'
}
```

Everything this phase is about is visible in six lines: the type parameter
carries the success type, a **default** (`E = Error`) keeps the common case
short, the discriminant makes it narrowable, and the caller gets *their* error
union back rather than a flattened `Error`.

The same shape covers `Loadable<T>`, `Paginated<T>`, `Cached<T>` — anything
where a container has states and a payload.

## Generic interfaces for behaviour

Where the thing being parameterised is a set of **operations**, an interface
usually reads better:

```ts
interface Repository<T, Id = string> {
  find(id: Id): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: Id): Promise<void>;
}

class UserRepository implements Repository<User> { … }
```

`Partial<T>` in the middle of that is the point: once the interface is
parameterised, the standard utility types compose with it for free, and
`findAll` gets a correctly typed filter for *every* entity with no extra work.

## Type parameters can constrain each other here too

Exactly as in a function signature:

```ts
interface Table<Row extends object, Key extends keyof Row> {
  rows: readonly Row[];
  primaryKey: Key;
  byKey(k: Row[Key]): Row | undefined;
}
```

`Row[Key]` is an **indexed access type** — reading the type of one property out
of another type — which gets its own page at
[topic 06 · Indexed access types](../06-indexed-access-types.md).

## Gotchas

**Symptom:** `TS2314: Generic type 'Box' requires 1 type argument(s)`
**Cause:** Using the type constructor where a type belongs.
**Fix:** Supply the argument — `Box<string>` — or give the parameter a default so
`Box` alone becomes legal (chunk 02).

**Symptom:** `Omit<User, 'nmae'>` silently omits nothing
**Cause:** `Omit`'s second parameter is `keyof any`, not `keyof T` — visible in
its declaration.
**Fix:** Define `type StrictOmit<T, K extends keyof T> = Omit<T, K>` and use it.

**Symptom:** An interface cannot be made into a union
**Cause:** Interfaces describe object shapes only.
**Fix:** Use a type alias. This is the main reason a codebase ends up with both.

**Symptom:** A parameterised type is repeated in full at every use site
**Cause:** The alias is doing less work than it could.
**Fix:** Add defaults for the parameters that are usually the same —
`Result<T, E = Error>` — so the common case is one argument.

**Symptom:** `Partial<T>` on a nested object only makes the top level optional
**Cause:** It is one level deep by design; the declaration shows exactly that.
**Fix:** Write a recursive version, and read the depth caveat in chunk 02 before
you do.

## Interview questions

**★ What is the difference between a generic interface and a generic type
alias?**
An interface can only describe an object (or callable/newable) shape, and it
merges across declarations. An alias can name *anything* — unions, conditionals,
mapped types, tuples, primitives, function types — and does not merge. For a
plain shape they are interchangeable; for everything else in this phase the alias
is the only option.

**★ Why does `Omit<User, 'nmae'>` not error?**
Because the declaration is `Omit<T, K extends keyof any>`, so `K` is any
property key rather than a key of `T` — a typo silently omits nothing. `Pick` by
contrast is declared `Pick<T, K extends keyof T>` and does catch it. The usual
fix is a project-local `StrictOmit` that adds the `keyof T` constraint.

**★ Show a generic type you would define in almost any codebase.**
A parameterised result union:
`type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }`.
It carries the payload type, defaults the error so the common case stays short,
and its discriminant makes both branches narrowable at the call site — so
callers handle failure without assertions.

**What is `Box` on its own, if `Box<string>` is a type?**
A type constructor — something that becomes a type once given an argument. Using
it bare is `TS2314`. Giving its parameters defaults is what makes the bare name
legal.

**Where do type parameters on an interface constrain each other?**
The same way as in a function: `interface Table<Row extends object, Key extends
keyof Row>`. The second parameter's bound is computed from the first, which is
what lets a method's parameter be typed `Row[Key]`.

---

← [Topic index](./README.md) · Next → [02 · Parameter placement and merging](./02-parameter-placement-and-merging.md)
