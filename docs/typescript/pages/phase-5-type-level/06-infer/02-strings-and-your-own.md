---
title: "In strings, and writing your own"
sidebar_label: "02 · In strings, and your own"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 4.8 release notes** (*Improved
> Inference for `infer` Types in Template String Types*), whose
> `TryGetNumberIfFirst`, `SomeNum`, `SomeBigInt`, `SomeBool` and `JustNumber`
> examples and the round-tripping explanation are **quoted verbatim**, and the
> **4.7 notes** for constrained `infer`. **No console block** — no sandbox run
> covers this phase.

## `infer` inside a template literal type

A template literal type is a pattern, so `infer` works inside one — which is what
makes typed route strings, event names and parsers possible at all.

```ts
type Route = "/users/:id/posts/:postId";

type ParamNames<S> =
  S extends `${string}:${infer Param}/${infer Rest}` ? Param | ParamNames<`/${Rest}`>
  : S extends `${string}:${infer Param}` ? Param
  : never;

type P = ParamNames<Route>;   // "id" | "postId"
```

Two conditionals, matched in order, recursing on the remainder: the same
first-match-wins chain as any other conditional
([topic 02 · chunk 01](../02-conditional-types/01-the-question.md)), just with
string patterns.

## Parsing a primitive out of a string — 4.8

Constrained `infer` (4.7) plus a template literal (4.1) gives something that
looks impossible: reading a literal *value* out of a string type.

> "If these `infer` types appear in a template string type and are constrained to
> a primitive type, TypeScript will now try to parse out a literal type."

```ts
// SomeNum used to be 'number'; now it's '100'.
type SomeNum = "100" extends `${infer U extends number}` ? U : never;

// SomeBigInt used to be 'bigint'; now it's '100n'.
type SomeBigInt = "100" extends `${infer U extends bigint}` ? U : never;

// SomeBool used to be 'boolean'; now it's 'true'.
type SomeBool = "true" extends `${infer U extends boolean}` ? U : never;
```

> "This can now better convey what a library will do at runtime, and give more
> precise types."

### The round-tripping rule

This is the part that catches people, and the notes are explicit about it:

> "when TypeScript parses these literal types out it will greedily try to parse
> out as much of what looks like of the appropriate primitive type; however it
> then checks to see if the print-back of that primitive matches up with the
> string contents. In other words, TypeScript checks whether the going from the
> string, to the primitive, and back matches. If it doesn't see that the string
> can be 'round-tripped', then it will fall back to the base primitive type."

```ts
// JustNumber is `number` here because TypeScript parses out `"1.0"`, but `String(Number("1.0"))` is `"1"` and doesn't match.
type JustNumber = "1.0" extends `${infer T extends number}` ? T : never;
```

**So `"100"` gives `100` and `"1.0"` gives `number`.** The rule is
`String(Number(s)) === s`, applied at the type level — not an approximation, the
actual check. Anything with a leading zero, a trailing `.0`, a `+`, or padding
falls back to the base primitive.

## Writing your own extractor

The shape never changes: a conditional, a pattern, an `infer`, a `never` fallback.

```ts
// The value type of any Map-like
type MapValue<T> = T extends Map<unknown, infer V> ? V : never;

// The resolved type of a Redux-style action creator
type ActionOf<T> = T extends (...args: never[]) => infer A ? A : never;

// The props of a React-style component type
type PropsOf<T> = T extends (props: infer P) => unknown ? P : never;

// The keys of a route pattern, as a params object
type Params<S extends string> = { [K in ParamNames<S> & string]: string };
```

Three habits worth adopting, all judgement rather than documentation:

1. **Use `never[]` in parameter patterns, not `any[]`.** `(...args: never[])` is
   the safer catch-all — the handbook's own `GetReturnType` uses it — because
   `any` re-enables assignability in both directions and hides mistakes.
2. **Return `never`, not `unknown`.** The false branch means "no such type", and
   `never` composes: it vanishes from unions and drops keys from mapped results.
3. **Name the helper after what it produces.** `ElementOf`, `MapValue`,
   `PropsOf` — not `ExtractInner`. Someone reading the call site should not have
   to open the definition.

## Where inference goes wrong

Four failures, all of which look like the pattern is broken and none of which are:

- **Overloads.** Every extractor sees only the *last* signature — documented in
  the 2.8 notes and covered in
  [topic 03 · chunk 04](../03-utility-types/04-extractors.md). There is no
  workaround at the type level.
- **Generic functions.** `typeof genericFn` instantiates the type parameters to
  their constraints during inference, so the generics do not survive extraction.
- **Deferral.** Inside a generic function, an extractor over an unresolved `T` is
  a promise, not a type — see
  [topic 02 · chunk 02](../02-conditional-types/02-deferred.md).
- **Optional and rest parameters.** `Parameters<(a?: string) => void>` keeps the
  optionality in the tuple (`[a?: string]`), which is correct and surprises people
  spreading it into another call.

## Gotchas

**Symptom:** A route-parsing type returns `never`
**Cause:** The pattern chain has no branch matching the final segment — the last
parameter usually has no trailing `/`.
**Fix:** Add the terminal case, as `ParamNames` above does, and order the cases
most-specific first.

**Symptom:** `${infer U extends number}` gave `number`, not the literal
**Cause:** Round-tripping failed — `String(Number(s))` does not equal the original
string. `"1.0"`, `"01"` and `"+1"` all fall back.
**Fix:** Expected behaviour. Normalise the string at the source, or accept the
base primitive.

**Symptom:** A template pattern matched too much or too little
**Cause:** Template inference is greedy, and `${infer A}${infer B}` has many valid
splits.
**Fix:** Anchor the pattern with literal separators — `${infer A}.${infer B}` — and
recurse rather than trying to split everything in one go.

**Symptom:** An extractor built on `(...args: any[])` accepts things it should not
**Cause:** `any` is assignable in both directions.
**Fix:** `(...args: never[])`, which the handbook's own `GetReturnType` uses.

**Symptom:** `PropsOf` returns `unknown` for a component that clearly takes props
**Cause:** The component type is generic or overloaded, so inference either
instantiated to constraints or used the last signature.
**Fix:** Extract from a concrete instantiation, or type the props explicitly.

**Symptom:** Spreading `Parameters<F>` into a call fails on an optional parameter
**Cause:** The tuple keeps optionality — `[a?: string]` — and a spread of it is not
assignable to `(a: string)`.
**Fix:** Correct behaviour; fix the target signature, or normalise with a
`Required`-style step on the tuple.

**Symptom:** Two extractors that look identical give different results
**Cause:** One pattern is `readonly`, or uses `unknown` where the other uses
`any`, or constrains an `infer` the other does not.
**Fix:** Compare the patterns character by character before suspecting the
compiler.

## Interview questions

**★ How do you extract part of a string at the type level?**
With `infer` inside a template literal pattern:
`` S extends `${string}:${infer Param}/${infer Rest}` ? … : … ``, recursing on the
remainder and ordering the cases most-specific first. It is the same first-match
chain as any conditional, with string patterns instead of type patterns.

**★ What does `${infer U extends number}` do, and when does it not give a
literal?**
Constrained `infer` inside a template string tries to parse a literal of that
primitive out of the string — `"100"` gives `100`. It only keeps the literal if
the value **round-trips**: TypeScript checks that printing the parsed primitive
back reproduces the original string. `"1.0"` parses to `1`, prints back as `"1"`,
does not match, so the result falls back to `number`.

**★ Why do the standard extractors use `(...args: never[])` rather than
`any[]`?**
Because `any` is assignable in both directions and switches off the checking the
pattern is meant to do, while `never[]` is the safe bottom for a parameter list —
it matches any function while keeping the inference honest. The handbook's own
`GetReturnType` is written that way.

**Name three situations where `infer` gives a result you did not expect, and say
why.**
Overloaded functions (inference uses only the last signature, per the 2.8 notes);
generic functions (type parameters are instantiated to their constraints and do
not survive); and unresolved generics inside a function body (the extractor is
deferred, so nothing is known). A fourth: optional parameters keep their
optionality in a `Parameters` tuple.

**How would you write "the value type of a Map"?**
`type MapValue<T> = T extends Map<unknown, infer V> ? V : never` — pattern, infer,
`never` fallback. Every extractor you will write is that line with a different
pattern, which is the whole point of learning the shape rather than the list.

---

← Prev: [01 · Pattern matching](./01-pattern-matching.md) · [Topic index](./README.md) · Next → **07 · Template literal types** *(not written yet)*
