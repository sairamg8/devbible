---
title: "What an assertion function is"
sidebar_label: "01 · The two forms"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Narrowing → Assertion
> functions*) and the **TypeScript 3.7 release notes**, which introduced the
> feature. The narrowing result for `asserts v is string` — `string` after the
> call — is **sandbox-measured** in `sandbox/ts-p2/ex2-guards-and-loss.sh` by
> the assign-to-`1` technique; that run produced no saved output file, so the
> finding is stated in prose and this page carries **no console block**.

**A type guard narrows inside a branch. An assertion function narrows the rest
of the scope — by promising to throw if the claim is false.** It is the type
system's model of `assert(x)`: if the call returns *at all*, the claim held.

```ts
function assertIsString(v: unknown): asserts v is string {
  if (typeof v !== 'string') throw new TypeError('expected a string');
}

declare const input: unknown;
assertIsString(input);
input.toUpperCase();       // string — no `if`, no block, no indentation
```

There is no `if` here and nothing is nested. That is the whole ergonomic
argument for the feature: a guard forces the happy path into a branch, an
assertion leaves it at the top level.

## Why the narrowing survives past the call

`asserts v is string` is not a return type in the ordinary sense — the function
returns `undefined` like any other `void` function. It is an instruction to
**control flow analysis**, the same machinery that reads your `if` statements
([README](../README.md)).

The compiler reasons about the two ways a call can finish. Either it threw, in
which case the code below is unreachable and there is nothing to type; or it
returned, in which case the declared claim is true. Since only one of those
paths continues, the analysis can apply the narrowing unconditionally to
everything after the call.

That is also why the effect is scoped the way it is. The narrowing lasts until
something invalidates it — a reassignment, a callback boundary, a mutable
property re-read ([11](../11-narrowing-lost.md)) — exactly like a narrowing
produced by a `typeof` check. Assertions do not create a special kind of
knowledge; they create an ordinary narrowing at an unusual place.

## The two forms

`asserts` has two spellings and they do different jobs.

```ts
function assertIsString(v: unknown): asserts v is string { … }   // asserts a TYPE
function assertOk(v: unknown): asserts v { … }                   // asserts TRUTHINESS
```

**`asserts v is T`** replaces the type of `v` with `T` for the remainder of the
scope. This is the type-guard predicate `v is T`, moved from a `boolean` return
to a throwing one.

**`asserts v`** narrows `v` the way `if (v)` would — it removes every falsy
member from the union — but without the branch:

```ts
declare const maybe: string | null | undefined;

function assertOk(v: unknown): asserts v { if (!v) throw new Error('falsy'); }

assertOk(maybe);
maybe.length;              // string
```

⚠️ **The truthiness form inherits the trap from
[page 02](../02-truthiness-and-equality.md) in full.** `asserts v` removes `''`
from a `string` union along with `null`, so `assertOk(name)` throws on an empty
string — which is almost never what "assert this is present" was meant to mean.
When the intent is *not null*, say so:

```ts
function assertPresent<T>(v: T): asserts v is NonNullable<T> {
  if (v == null) throw new Error('expected a value');
}
```

Now `''` and `0` pass, `null` and `undefined` do not, and the signature says
which of the two you meant. The generic `T` is what keeps the rest of the type
intact — `assertOk` flattens everything it touches to "truthy", while
`assertPresent` subtracts exactly `null | undefined`.

## Assertion function vs type guard

The distinction that matters is **where the narrowing lives**, not what the
function does inside.

| | Type guard `v is T` | Assertion `asserts v is T` |
|---|---|---|
| Returns | `boolean` | nothing — `void` |
| On failure | returns `false` | **throws** |
| Narrows | inside the `if` branch | the whole enclosing scope, after the call |
| Call site | `if (isX(v)) { … }` | `assertIsX(v);` then carry on |
| Negative branch | you get an `else` | there is no `else` — the code stopped |
| Body checked by the compiler | no | no |
| Usable in `filter`/`find` | **yes** | no — it is not a predicate |

Choose by whether "not a `T`" is a **case you handle** or a **bug**.

A guard gives you both branches, so it is right when the other shape is
legitimate — a `Cat` or a `Dog`, a cache hit or a miss, a response that is
either data or an error. An assertion deletes the other branch entirely, so it
is right only when the other shape means the program is already wrong and should
stop.

Using an assertion where a guard belonged converts a recoverable case into a
thrown exception in production — and the type system will never warn you,
because from its point of view both spellings are correct. The choice is a
design decision the compiler cannot make for you.

The last row of the table is the practical tiebreaker people forget:
`array.filter(isDefined)` works and `array.filter(assertIsDefined)` cannot,
because `filter` needs something that returns `boolean`. Anything that has to
compose with an array method must be a guard.

## The compiler does not check the body

Exactly as with type guards ([07](../07-type-guards.md)), the body is taken on
trust:

```ts
function assertIsString(v: unknown): asserts v is string {
  // no check at all
}

declare const n: unknown;
assertIsString(n);
n.toUpperCase();          // compiles. Explodes at runtime if n is a number.
```

An assertion function is a claim you own, and it is worse than a bad `as`
([08](../08-as-assertions/README.md)) in one specific way: a cast is visible at
the site where the lie is told, while an assertion is written once and then
believed at every call. One wrong body silently corrupts every consumer.

So keep them to one condition and one `throw`, and **test them like any other
logic** — they are the rare piece of code where a unit test is checking
something the compiler is definitionally unable to check.

## The runtime obligation with no type-level counterpart

There is a second way to get this wrong, and it is subtler than a wrong
condition:

```ts
function assertIsString(v: unknown): asserts v is string {
  if (typeof v !== 'string') {
    console.error('expected a string');   // logs, then returns normally
  }
}
```

Nothing here is a type error. But the function **returns** on the bad path, and
the compiler's entire reasoning was "if it returned, the claim held". The
narrowing is now applied over a value that never satisfied it, and the failure
surfaces somewhere else entirely — often several frames away, on a property
access that looks unrelated.

**An assertion function must throw, or not return.** Logging is not asserting.
A helper that "reports a problem and carries on" is a validator with the wrong
signature.

## Gotchas

**Symptom:** The narrowing applies but the program crashes on a value that
looks valid
**Cause:** `asserts v` is truthiness, so `''` and `0` fail it.
**Fix:** `asserts v is NonNullable<T>` with a `v != null` body when the intent
is "not null".

**Symptom:** No error anywhere, but a runtime `TypeError` on a narrowed value
**Cause:** The assertion body logs or returns instead of throwing on the bad
path.
**Fix:** Throw. Nothing in the type system will find this one for you.

**Symptom:** An assertion function seems to narrow nothing at all
**Cause:** A declared return type of `void` instead of the `asserts` clause —
easy to lose in a refactor, since both are "returns nothing".
**Fix:** The `asserts` clause **is** the return type and cannot be combined with
another one.

**Symptom:** `array.filter(assertIsDefined)` does not compile
**Cause:** `filter` needs a function returning `boolean`; an assertion returns
`void`.
**Fix:** Use the guard form `isDefined(v): v is T` there. The two are not
interchangeable.

**Symptom:** Narrowing from an assertion disappears further down the function
**Cause:** The ordinary invalidations — reassignment, a callback boundary, a
mutable property read after an intervening call ([11](../11-narrowing-lost.md)).
**Fix:** Assign to a `const` immediately after the assertion.

## Interview questions

**★ What is an assertion function, and how does it differ from a type guard?**
A function whose return type is `asserts v is T` or `asserts v`. A guard returns
`boolean` and narrows inside an `if`; an assertion returns nothing, throws when
the claim is false, and narrows for the **rest of the enclosing scope** after
the call. Choose a guard when the other case is handled, an assertion when the
other case is a bug.

**★ Why does the narrowing persist after the call rather than inside a branch?**
Because the compiler reasons over the two ways the call can finish: it threw, so
the code below is unreachable, or it returned, so the claim is true. Only one of
those continues, which means the narrowing can be applied unconditionally to
everything after the call.

**What is the difference between `asserts v` and `asserts v is T`?**
`asserts v` narrows by truthiness — it removes every falsy member, so `''` and
`0` fail it. `asserts v is T` replaces the type outright. For "this is not
null", neither bare form is right: write
`asserts v is NonNullable<T>`, which subtracts exactly `null | undefined` and
leaves the rest of the type alone.

**Does the compiler verify the body of an assertion function?**
No, exactly as with a type predicate. `function assertIsString(v: unknown):
asserts v is string {}` — with an empty body — compiles. It is an assertion in
function form, written once and then trusted at every call site, which makes a
wrong one more expensive than a wrong `as`.

**Can you pass an assertion function to `filter`?**
No. `filter` needs something returning `boolean`, and an assertion returns
`void`. Anything that has to compose with an array method must be written as a
type guard.

---

← [Topic index](./README.md) · Next → [02 · Calling them, and where they belong](./02-calling-and-placing.md)
