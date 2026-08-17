---
title: "The map"
sidebar_label: "01 · The map"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Utility Types*) for the
> full list, each utility's one-line description and the version each was
> released in, and the **2.1 / 2.8 / 3.1 / 3.5 / 4.5 / 5.4 release notes** for
> the ones whose definitions are quoted. **No console block** — no sandbox run
> covers this phase.

There are twenty-two utility types in `lib`. Memorising twenty-two things is not
a plan. **Classifying them into four mechanisms is**, because the mechanism
predicts the behaviour — whether it preserves `readonly`, whether it distributes
over a union, whether it works on a type parameter that is not resolved yet.

You already have all four mechanisms: [mapped types](../01-mapped-types/README.md)
and [conditional types](../02-conditional-types/README.md) between them account
for every utility except the four intrinsics and two markers.

## The four families

| Family | Mechanism | Members |
|---|---|---|
| **Object shapers** | a mapped type | `Partial` · `Required` · `Readonly` · `Record` · `Pick` |
| **Union filters** | a distributing conditional | `Exclude` · `Extract` · `NonNullable` |
| **Extractors** | a conditional with `infer` | `ReturnType` · `Parameters` · `ConstructorParameters` · `InstanceType` · `Awaited` · `ThisParameterType` · `OmitThisParameter` |
| **Composites, markers, intrinsics** | more than one, or none | `Omit` (conditional + mapped) · `ThisType` and `NoInfer` (markers) · `Uppercase` / `Lowercase` / `Capitalize` / `Uncapitalize` (compiler intrinsics) |

**Why the family matters, in one line each:**

- **Object shapers** are homomorphic mappings — except `Record` and `Pick`, which
  loop over a key union you supplied and therefore preserve nothing
  ([topic 01 · chunk 02](../01-mapped-types/02-modifiers.md)).
- **Union filters** work *entirely* through distribution. On a non-union they do
  almost nothing; on `never` they produce `never`.
- **Extractors** are deferred while their input is a type parameter, which is why
  they are useless inside the generic function and precise at its call sites
  ([topic 02 · chunk 02](../02-conditional-types/02-deferred.md)).
- **The last family** has no shared rule, which is exactly why the oddities need
  their own chunk.

## The full list, with what each is

| Utility | Since | What it does (the handbook's own words, condensed) |
|---|---|---|
| `Awaited<T>` | 4.5 | models `await` — unwraps nested promises |
| `Partial<T>` | 2.1 | all properties optional |
| `Required<T>` | 2.8 | all properties required — the opposite of `Partial` |
| `Readonly<T>` | 2.1 | all properties `readonly` |
| `Record<K, T>` | 2.1 | keys `K`, values `T` |
| `Pick<T, K>` | 2.1 | keep the set of properties `K` |
| `Omit<T, K>` | 3.5 | keep everything, then remove `K` — the opposite of `Pick` |
| `Exclude<U, E>` | 2.8 | drop union members assignable to `E` |
| `Extract<T, U>` | 2.8 | keep union members assignable to `U` |
| `NonNullable<T>` | 2.8 | drop `null` and `undefined` |
| `Parameters<T>` | 3.1 | a tuple of a function type's parameters |
| `ConstructorParameters<T>` | 3.1 | the same for a constructor |
| `ReturnType<T>` | 2.8 | a function type's return type |
| `InstanceType<T>` | 2.8 | what a constructor type produces |
| `NoInfer<T>` | 5.4 | blocks inference to `T`; otherwise identical to `T` |
| `ThisParameterType<T>` | 3.3 | the `this` parameter's type, or `unknown` |
| `OmitThisParameter<T>` | 3.3 | the function type without its `this` parameter |
| `ThisType<T>` | 2.3 | a **marker** for a contextual `this` — returns no transformed type |
| `Uppercase` / `Lowercase` / `Capitalize` / `Uncapitalize` | 4.1 | intrinsic string manipulation |

⚠️ **`ThisType` has a prerequisite the handbook states explicitly:** *"Note that
the `noImplicitThis` flag must be enabled to use this utility."*

## Two release notes worth reading once

**`ReturnType` was born as three lines.** From the 2.8 notes, verbatim:

```ts
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
```

That is the whole of it. Every extractor in the list is the same shape with a
different pattern in the `extends` clause, which is why
[topic 02 · chunk 03](../02-conditional-types/03-composing.md) treats them as one
idea rather than seven.

**`NonNullable` was rewritten in 4.8** and the reasoning is worth knowing, because
it is the only utility whose *implementation strategy* changed:

```ts
- type NonNullable<T> = T extends null | undefined ? never : T;
+ type NonNullable<T> = T & {};
```

> "This is an improvement because intersection types like this can be reduced and
> assigned to, while conditional types currently cannot. So
> `NonNullable<NonNullable<T>>` now simplifies at least to `NonNullable<T>`,
> whereas it didn't before."

The lesson generalises: **an intersection the compiler can reduce beats a
conditional it must defer.** When your own helper is fighting deferral, ask
whether an intersection expresses the same thing.

## What is *not* in the box

Worth knowing, because reaching for a utility that does not exist wastes real
time:

- **`Mutable<T>`** — the opposite of `Readonly`. Four characters of mapping,
  built in [topic 01 · chunk 03](../01-mapped-types/03-writing-your-own.md).
- **`DeepPartial<T>` / `DeepReadonly<T>`** — every library rolls its own; they are
  topic 12's subject, along with why they hurt.
- **`RequiredKeys<T>` / `OptionalKeys<T>`** — the key-selection idiom from
  [topic 02 · chunk 03](../02-conditional-types/03-composing.md).
- **A strict `Omit`** — the built-in deliberately does not constrain its key
  parameter to `keyof T`, so typos pass silently.
- **`Merge` / `Overwrite`** — an intersection plus an `Omit`; a one-liner, but
  everyone's is subtly different.

The point of the classification is precisely this: once you know `Partial` is a
mapping and `Exclude` is a distributing conditional, writing the missing sibling
is a two-minute job rather than a search.

## Gotchas

**Symptom:** `Record<string, T>` behaves unlike `Partial<T>` with respect to
`readonly`
**Cause:** `Record` and `Pick` loop over a key union, not over `keyof T`, so they
are not homomorphic and have no modifiers to preserve.
**Fix:** Expected. Use a homomorphic mapping if preservation matters.

**Symptom:** A union filter did nothing
**Cause:** The input was not a union. `Exclude`, `Extract` and `NonNullable` do
their work through distribution.
**Fix:** Check what the input actually is — a single object type has one member.

**Symptom:** An extractor returns `unknown` or `never` inside a generic function
**Cause:** It is deferred while the type parameter is unresolved.
**Fix:** Use it at the boundary where the type is concrete.

**Symptom:** `ThisType` appears to do nothing
**Cause:** `noImplicitThis` is off — the handbook states the flag is required.
**Fix:** Enable it, or use an explicit `this` parameter instead.

**Symptom:** Reaching for `Mutable<T>` and finding it missing
**Cause:** It is not in `lib`; only `Partial`, `Required` and `Readonly` are.
**Fix:** `type Mutable<T> = { -readonly [P in keyof T]: T[P] }`.

## Interview questions

**★ How would you organise the built-in utility types for someone learning them?**
By mechanism, not alphabetically. Object shapers are mapped types
(`Partial`, `Required`, `Readonly`, `Record`, `Pick`); union filters are
distributing conditionals (`Exclude`, `Extract`, `NonNullable`); extractors are
conditionals with `infer` (`ReturnType`, `Parameters`, `InstanceType`, `Awaited`
and friends); and the rest are composites, markers or compiler intrinsics. The
family tells you whether it preserves modifiers, whether it distributes, and
whether it defers.

**★ Why was `NonNullable` rewritten as `T & {}` in 4.8?**
Because intersections can be reduced and assigned to, while conditional types are
deferred and cannot. The rewrite means `NonNullable<NonNullable<T>>` simplifies to
`NonNullable<T>`, which the conditional version did not. It is the clearest
worked example of a general lesson: prefer an intersection the compiler can
reduce over a conditional it must carry around.

**★ Which utilities are *not* homomorphic, and why does it matter?**
`Record` and `Pick` — both loop over a key union you supply rather than over
`keyof T`, so there is no source type whose `readonly` and `?` modifiers could be
preserved, arrays are not kept as arrays, and there is no union distribution.
`Partial`, `Required` and `Readonly` are homomorphic and do all three.

**Name three useful utilities that are not in the standard library.**
`Mutable<T>` (the opposite of `Readonly`, one line of mapping), `DeepPartial<T>`
(every library writes its own), and a strict `Omit` whose key parameter is
constrained to `keyof T` so typos are caught. Knowing the four mechanisms is what
makes writing them quick.

**What is unusual about `ThisType`?**
It does not transform anything — the handbook calls it a marker for a contextual
`this` type — and it requires `noImplicitThis` to be enabled. It is the only
entry in the list that is a compiler hint rather than a type function.

---

← [Topic index](./README.md) · Next → [02 · The object shapers](./02-object-shapers.md)
