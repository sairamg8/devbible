---
title: "Living with assertions"
sidebar_label: "02 · Living with them"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** — *Everyday Types → Type
> Assertions*, *Objects → `const` assertions* — and the TS 4.9 release notes for
> `satisfies`. **No sandbox run covers this page**; there is no console block.

[Chunk 01](./01-what-an-assertion-is.md) established what an assertion is and
what it costs. This chunk is the practical half: where `as` genuinely earns its
place, the feature that shares its keyword and shares none of its danger, and the
one everyday use that quietly destroys a check you wanted.

## The legitimate uses

`as` earns its place where a runtime fact is genuinely invisible to the checker.

**DOM queries.** The DOM's type declarations cannot know your HTML.

```ts
const input = document.getElementById('email') as HTMLInputElement;
input.value = '';
```

`getElementById` returns `HTMLElement | null` because that is all it can promise.
You are asserting two things — that the element exists, and that it is an input.
Both are claims about a template the compiler has never seen, and both become
your responsibility the moment the markup changes.

The honest version checks:

```ts
const el = document.getElementById('email');
if (!(el instanceof HTMLInputElement)) throw new Error('#email is not an input');
el.value = '';                       // narrowed, not asserted
```

That is [`instanceof` narrowing](../04-instanceof-narrowing.md) doing the work
`as` was standing in for — one extra line, and a failure that names itself where
it happens rather than three functions later.

**Keys of an object.** `Object.keys` is typed as `string[]`, deliberately.

```ts
const keys = Object.keys(user) as (keyof User)[];
```

The declaration is not a mistake: an object typed `User` can carry extra
properties at runtime — that is
[structural typing](../../phase-1-type-vocabulary/09-structural-typing.md) — so
`Object.keys` genuinely cannot promise the result holds only `keyof User`. The
assertion is you saying "not in this case". Reasonable for an object literal you
built two lines above; a guess for one that arrived over the network.

**Test doubles and known-wrong declarations**, as covered in chunk 01 — both with
a comment saying why.

## `as const` is a different feature

Same keyword, unrelated mechanism. A **`const` assertion** does not assert a
type — it asks for the *narrowest* one:

```ts
const a = { mode: 'dark' };            // { mode: string }
const b = { mode: 'dark' } as const;   // { readonly mode: "dark" }

const xs = [1, 2, 3];                  // number[]
const ys = [1, 2, 3] as const;         // readonly [1, 2, 3]
```

Three effects together: literal types instead of widened ones, `readonly` on
every property, and arrays becoming tuples. It cannot make a claim that is wrong,
because it only ever asks for what is already there —
[phase 1 · literal types and `as const`](../../phase-1-type-vocabulary/02-literal-types-and-as-const.md)
is the full treatment.

**So `as const` is safe and `as T` is not**, and confusing the two is common
enough to be worth naming out loud.

## The excess-property escape, and why it hides bugs

Object literals get an
[excess property check](../../phase-1-type-vocabulary/04-object-types.md) that
ordinary assignability does not:

```ts
const cfg: Options = { retries: 3, timeuot: 500 };
//                                  ~~~~~~~ error TS2353 — 'timeuot' not in 'Options'
```

That check is the compiler catching a typo in an optional property — exactly the
case nothing else catches. And `as` turns it off:

```ts
const cfg = { retries: 3, timeuot: 500 } as Options;   // silent
```

`timeuot` is now absent from the type, `timeout` falls back to its default, and
nothing anywhere reports it. **This is the most common way an `as` causes real
damage in ordinary code** — not an exotic cast, just someone silencing a
complaint about an object literal.

When the goal is "check this literal against `Options` but keep the literal's own
type", the answer is [`satisfies`](../10-satisfies.md), which was added for
precisely this and keeps the excess-property check.

## The angle-bracket form

```ts
const input = <HTMLInputElement>document.getElementById('email');
```

Equivalent to `as`, older, and **illegal in `.tsx` files** because it is
indistinguishable from a JSX element. Since almost every project has some `.tsx`
in it, `as` is the form to use everywhere for consistency. You will still meet
angle brackets in older code and in `.ts`-only libraries.

## Where each escape sits

There are four ways to overrule the checker in this phase, and they are not
interchangeable:

| Tool | What it claims | Checked? | Reach for it when |
|---|---|---|---|
| `as T` | this value is a `T` | overlap only | a runtime fact the checker cannot see |
| [`!`](../13-non-null-assertion.md) | not `null`/`undefined` | no | the same, narrowed to nullability |
| [type guard](../07-type-guards.md) | returns `v is T` | body not checked | the check is reusable and worth naming |
| [assertion function](../09-assertion-functions/README.md) | throws unless `v is T` | body not checked | the failure should stop execution |

The bottom two perform a **real runtime check** and then tell the compiler about
it. The top two do nothing at runtime at all. That is the distinction worth
carrying out of this phase: a guard is a check plus a claim; an assertion is the
claim alone.

## Trade-off

The settling point is not "zero assertions". It is that assertions are fine where
the fact is genuinely external and the blast radius is one line, and not fine at
a data boundary, where a check costs little and the wrongness arrives from
outside your codebase.

`@typescript-eslint/consistent-type-assertions` can enforce the shape of this,
and `eslint-disable` comments on the exceptions make them reviewable. The goal is
that every assertion left in the tree is deliberate and someone can say why.

## Gotchas

**Symptom:** A typo'd property in a config object was never reported
**Cause:** `as Options` on an object literal turns off the excess property check.
**Fix:** Annotate (`const cfg: Options = …`) or use
[`satisfies`](../10-satisfies.md), both of which keep the check.

**Symptom:** `<T>value` breaks in a `.tsx` file
**Cause:** The angle-bracket form is unparseable alongside JSX.
**Fix:** Use `as`.

**Symptom:** `as const` on an array broke a function call
**Cause:** It produced a `readonly` tuple, and the parameter is a mutable array.
**Fix:** Widen the parameter to `readonly T[]` — usually the correct signature
anyway, since the function is not mutating.

**Symptom:** An `as` on a `useRef` value silences a real null
**Cause:** `useRef<T>(null)` is `T | null` until mount, deliberately.
**Fix:** Check it. The null is real between render and commit.

**Symptom:** A cast on parsed JSON compiled and the object was missing fields
**Cause:** `JSON.parse` returns `any`, so `as User` was accepted without any
overlap check at all.
**Fix:** Parse into `unknown` and validate. This is the subject of **Phase 9 ·
Types at the boundary** *(not written yet)*, and no assertion substitutes for it.

## Interview questions

**★ Why prefer `satisfies` over `as` for a config object?**
`as` widens the value to the target type and disables the excess-property check,
so a typo'd optional key vanishes silently. `satisfies` validates against the
type while keeping the literal's own inferred type — you get both the check and
the precision.

**★ Is `as const` a type assertion?**
Only in syntax. It makes no claim that could be wrong: it asks for the narrowest
type available — literal types instead of widened ones, `readonly` properties,
tuples instead of arrays. `as T` overrules the compiler; `as const` asks it for
more precision.

**★ When is an assertion genuinely the right call?**
When the fact is real and external to the type system — a DOM element whose
markup you control, a wrong third-party declaration (with the issue linked), a
test double. Not at a data boundary: parsed JSON is `unknown`, and the correct
move there is a validator that checks at runtime and derives the type from one
declaration.

**Why is `Object.keys` typed as `string[]` rather than `(keyof T)[]`?**
Because structural typing allows a value to carry more properties than its type
declares, so the narrower signature would be unsound. The assertion is you
promising this particular object has no extras — safe for a literal you just
built, a guess for anything that arrived from outside.

**How would you stop assertions spreading through a codebase?**
Lint them (`@typescript-eslint/consistent-type-assertions`), require a comment on
each, ban them in the modules that touch the network, and treat
`as unknown as T` as needing review.

---

← Prev: [01 · What an assertion actually is](./01-what-an-assertion-is.md) · Next → [09 · Assertion functions](../09-assertion-functions/README.md)
