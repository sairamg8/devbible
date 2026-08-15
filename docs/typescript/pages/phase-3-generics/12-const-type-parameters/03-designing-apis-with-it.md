---
title: "Designing APIs with it"
sidebar_label: "03 · Designing APIs with it"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.0 release notes** (*const Type
> Parameters*) for the feature's behaviour and version, and the **handbook**
> (*Type Manipulation → Indexed Access Types*, *Keyof Type Operator*) for the
> patterns that consume it. **No console block** — no sandbox run covers this
> phase.

Chunks [01](./01-what-const-inference-does.md) and
[02](./02-where-it-silently-does-nothing.md) covered what the modifier does and
the two ways it quietly does nothing. This chunk is the design question: when is
it worth putting on an API at all?

## The shape it exists for

Always the same one: **a function whose return type is computed from the literals
it was given.**

```ts
declare function defineRoutes<const T extends readonly { path: string }[]>(
  routes: T,
): T;

const routes = defineRoutes([
  { path: "/" },
  { path: "/checkout" },
  { path: "/orders/:id" },
]);

type Path = (typeof routes)[number]["path"];
// "/" | "/checkout" | "/orders/:id"
```

Three things had to line up for that union to exist:

1. `const` kept the strings as literals instead of widening them to `string`.
2. The return type is `T` — the literals flow back out rather than being
   flattened to the parameter type.
3. `[number]` and `["path"]` ([indexed access](../06-indexed-access-types.md))
   read them back.

**Remove any one and the union collapses to `string`.** That is the checklist for
whether `const` belongs on a signature: it is worth adding only when something
downstream actually reads the literals.

## The consumption patterns

`const` is upstream plumbing; these are what make it pay.

```ts
// the union of values in a list
type Path = (typeof routes)[number]["path"];

// the union of keys in a config object
declare function defineConfig<const T extends Record<string, unknown>>(c: T): T;
const cfg = defineConfig({ retries: 3, mode: "fast" });
type Key = keyof typeof cfg;                    // "retries" | "mode"

// a lookup whose result type depends on the key
declare function get<const T, K extends keyof T>(obj: T, key: K): T[K];
```

That last one is the [`getProp` pattern](../05-getprop-pattern/README.md) with
`const` bolted on so the caller does not have to write `as const` on an inline
object. Same two-type-parameter shape, same reason the object must come first.

## Real places it shows up

- **Route tables** — deriving a union of valid paths, and typed params from a
  template literal.
- **State machines** — `defineMachine({ states: [...] })`, where transitions must
  reference declared state names.
- **Form and validation schemas** — field lists that produce a typed values
  object.
- **Permission and role lists** — a runtime array *and* its union from one
  declaration, no duplication to drift.
- **Design tokens and theme objects** — `keyof typeof theme.colors` as an
  autocompleting prop type.

The common thread: **one declaration that must serve both runtime and the type
system.** Without `const`, every one of these forces `as const` on the caller and
silently degrades when someone forgets.

## The three-way split, stated precisely

These get confused constantly, and the distinction is about *who* is deciding.

| | Who writes it | What it does | Reach for it when |
|---|---|---|---|
| **[`as const`](../../phase-1-type-vocabulary/02-literal-types-and-as-const.md)** | the caller | Freezes literals on a value expression | The value is declared on its own line, away from any call |
| **`as const satisfies T`** | the caller | Freezes, **then checks** against `T` without widening — [phase 2](../../phase-2-narrowing/10-satisfies/README.md) | A table you own and want validated in place |
| **`<const T>`** | the **author** | Declares that this parameter's literals matter, for every caller | You are designing the function, and inline arguments are the normal call style |

They are not alternatives so much as different positions in the same problem.
Note the row that no other row covers: `as const` is the **only** one that works
for a value declared elsewhere — which is
[no-op #1](./02-where-it-silently-does-nothing.md) restated as a design fact.

## Adding it to an existing API

Turning `<T>` into `<const T>` is **not** a purely additive change, and it is
worth thinking about before shipping it in a library.

- Existing callers who wrote `as const` are unaffected — they were already
  producing the readonly literal type.
- Existing callers who did **not** now get a narrower type than before. Usually
  an improvement, occasionally a break: code that assigned the result to a
  `string[]`, or called `.push` on it, now fails on the `readonly`.
- ⚠️ **The constraint usually has to change too.** A pre-`const` signature very
  often reads `<T extends string[]>`, and leaving that mutable makes the whole
  edit a
  [silent no-op](./02-where-it-silently-does-nothing.md) — the change looks
  delivered and does nothing. Widen it to `readonly string[]` in the same commit.

In application code this is a cheap, contained change. In a published package it
is a minor-version-with-care change, and the release note is "inferred types are
now narrower".

## When to leave it off

The signal is the absence of consumption. If `T` is never indexed into —
no `T[number]`, no `T[K]`, no `keyof T`, no template literal — then `const` buys:

- longer hovers (a full readonly tuple where `string[]` used to appear),
- larger error messages quoting that tuple,
- `readonly` friction at every downstream boundary that wants a mutable array,

and nothing else. That is one of the listed failure shapes in
[topic 13](../13-when-not-to-write-a-generic/README.md), and the same judgement applies:
a modifier that relates nothing is noise.

## Trade-off

**Adding `const`** removes a footgun from every call site and makes the specific
type the default rather than an opt-in each caller must know about. It costs
surprise — hovers grow, error messages grow, and a `readonly` tuple propagates
into code that may want a mutable array. It can over-specify: a value that really
is just a list of strings now carries a tuple type through everything downstream.

**Leaving it off** keeps types small and messages short, and pushes the `as const`
decision onto people who mostly will not make it — accepting a quiet loss of
precision as the default.

The line worth holding: **add `const` when the function's return type reads the
literals.** Everything else follows from that one test.

## Gotchas

**Symptom:** `<const T>` is on the signature and the inferred type is still wide
**Cause:** The argument is a variable declared elsewhere, already widened at its
own declaration.
**Fix:** `as const` on that declaration, or inline the literal into the call.

**Symptom:** `const` does nothing even with a literal argument, and no error
**Cause:** The constraint is mutable (`T extends string[]`), so the readonly
candidate fails it and inference falls back to the constraint.
**Fix:** `readonly` throughout the constraint, including array-typed properties
inside object constraints.

**Symptom:** `TS4104: The type '…' is 'readonly' and cannot be assigned to the
mutable type '…'` downstream
**Cause:** The inferred readonly tuple is reaching something that wants a mutable
array — `.push`, or a parameter typed `string[]`.
**Fix:** Widen at that boundary with a spread (`[...value]`), not by removing the
`const` that is doing the useful work.

**Symptom:** A modifier-placement error on a type alias or interface
**Cause:** `const` belongs on function, method and constructor type parameters;
`in`/`out` are the pair that belong on a class, interface or type alias.
**Fix:** Drop it — a type alias has no call site for it to act on.

**Symptom:** Someone expects the argument to be frozen at runtime
**Cause:** Reading `const` as a runtime guarantee.
**Fix:** It is erased like every other annotation. `Object.freeze` if the runtime
behaviour is genuinely wanted.

**Symptom:** Hovers and error messages are suddenly enormous
**Cause:** A large literal now carried as a full readonly tuple.
**Fix:** Intended — unless nothing reads the literals, in which case remove the
`const`.

## Interview questions

**★ What does `const` on a type parameter do?**
It makes inference at the call site behave as though the caller had written
`as const`, so object and array literals keep their literal types and come back
as readonly tuples. TypeScript 5.0. The value is that it moves the obligation off
every caller and onto the one declaration that knows it matters.

**★ Why might `<const T>` have no effect?**
Two reasons. The argument is a variable declared elsewhere — already widened at
its own declaration, and the modifier only affects expressions written inside the
call. Or the constraint is mutable, so the readonly candidate is not assignable
to it and inference silently falls back to the constraint. The second is the
dangerous one: nothing is reported.

**★ How does it relate to `<T extends string>`?**
Same goal, opposite halves of the type space. A primitive constraint already
preserves literal types, so `<T extends string>` keeps `'red'` as `'red'`.
Objects and arrays have no equivalent constraint that does this, and `const`
fills the gap. They compose — the constraint says what may be passed, the
modifier says how it is inferred.

**Does `const` make the argument immutable?**
No. It is erased at compile time; the array is an ordinary mutable array at
runtime. Only the compiler treats it as readonly — the same bargain as `as const`.

**When would you not add it?**
When the return type never reads the literals. If nothing does `T[number]`,
`T[K]` or `keyof T`, `const` only makes hovers and error messages larger and adds
`readonly` friction downstream. The presence of an indexed access in the return
position is the signal to add it.

**What breaks if you add it to an existing library function?**
Callers who never wrote `as const` now get a narrower, readonly type — usually an
improvement, but code assigning the result to a mutable array or calling `.push`
will fail. And the constraint almost always needs widening to `readonly` in the
same change, or the whole edit is inert.

---

← [02 · Where it silently does nothing](./02-where-it-silently-does-nothing.md) · Up → [Overview](./README.md) · Next → [13 · When *not* to write a generic](../13-when-not-to-write-a-generic/README.md)
