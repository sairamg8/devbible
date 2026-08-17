---
title: "The holes you opt into"
sidebar_label: "02 · Holes you opt into"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** on type assertions —
> which documents that an assertion is *removed at compile time* and that
> TypeScript permits only assertions between types that are a subtype of one
> another, hence the `as unknown as T` double-step — and the **compiler's
> diagnostic table** for `TS2352`. `any`'s behaviour is
> [topic 03](../03-containing-any.md)'s subject and is cited rather than
> restated. **No sandbox, no console block.**

Three of the seven holes are ones **you write yourself**. That makes them the
easiest to reason about and, in practice, the ones responsible for most real
incidents — because a hole you opted into is a hole nobody reviews.

## Hole 1 · `any`

`any` is not a wide type; it is the **absence** of checking. Every operation on
it is permitted, and — the part that makes it a soundness hole rather than a
convenience — it **propagates**:

```ts
const data: any = JSON.parse(body);
const user = data.user;              // any
const name = user.name;              // any
name.toUpperCase();                  // no error. TypeError if name is a number.
```

Nothing here is asserted, nothing is obviously wrong, and the compiler checks
none of the four lines. [Topic 03 · Containing `any`](../03-containing-any.md)
covers the four doors it enters through and how it spreads; this page's only
addition is to name it as hole number one, because it is the largest by a wide
margin.

📌 **`unknown` is the sound version of the same idea** and costs one narrowing
step. Where you are describing "a value whose type I do not know", `unknown` says
it truthfully and forces the check; `any` says it and skips the check. That
substitution alone closes this hole.

## Hole 2 · Type assertions

```ts
const el = document.getElementById('x') as HTMLInputElement;
el.value;                            // may be null at runtime, or a <div>
```

An assertion is **erased at compile time**. It generates no check, no cast, no
runtime code at all — it changes the compiler's opinion and nothing else.

The compiler does apply one restriction: it refuses assertions between types with
no relationship, with `TS2352`. Which is why the universal escape exists and is
worth recognising on sight:

```ts
const n = 'hello' as unknown as number;   // permitted — two legal steps
```

🔴 **`as unknown as T` should be treated as a different construct from `as T`.**
A plain `as` is often a narrowing the compiler cannot see; the double-step is an
explicit statement that the two types are unrelated and you are overriding the
compiler anyway. In review, the first deserves a question and the second deserves
an explanation in a comment.

### `satisfies` is the sound alternative you usually want

Most `as` uses are trying to say "this value conforms to `T`" — which
`satisfies` does **while still checking it**:

```ts
const config = { port: 3000 } as Config;         // unchecked claim
const config = { port: 3000 } satisfies Config;  // checked, and keeps the literal type
```

[Phase 2 · `satisfies`](../../phase-2-narrowing/10-satisfies/README.md) covers it
properly. The relevance here is that **a large share of assertions in a real
codebase are not overrides at all** — they are conformance claims written with
the wrong keyword, and swapping it removes the hole for free.

## Hole 3 · The non-null assertion

```ts
const user = users.find(u => u.id === id)!;
user.name;                                   // TypeError when nothing matched
```

`!` is an assertion with even less ceremony — one character, no type written, and
therefore nothing for a reviewer to disagree with.
[Phase 2 · The non-null assertion](../../phase-2-narrowing/13-non-null-assertion.md)
argues it in full.

⚠️ **`!` is the hole that a strictness migration manufactures.** Every flag in
this phase produces errors, and `!` is the fastest way to close a great many of
them — which is why [topic 02](../02-nouncheckedindexedaccess.md) and
[topic 05](../05-exactoptionalpropertytypes/README.md) both use the `!` count as
the measure of whether a migration was done or merely declared.
[Topic 12](../README.md) treats each one as an unresolved review comment.

## What these three have in common

They are the only holes on the list that **appear in a diff**. Nobody
accidentally acquires an `any`, an `as` or a `!` — someone typed it, and someone
approved it.

That gives them a property the other four do not have:

| | opt-in holes | structural holes |
|---|---|---|
| Visible in review | ✅ | ❌ |
| Greppable | ✅ | ❌ |
| Countable over time | ✅ | ❌ |
| Fixable by policy | ✅ | ❌ |

🔴 **So these three are the only holes you can put a number on**, and that is why
the metric across this whole phase is *assertions added per error fixed*. It is
not that assertions are the worst hole — it is that they are the only one a team
can actually manage.

The typescript-eslint rules that enforce this — `no-explicit-any`,
`no-unsafe-*`, `no-non-null-assertion` — are
[topic 11](../README.md)'s subject.

## When each is genuinely correct

Being fair, because a blanket ban produces worse code than a considered policy:

- **`any` is correct** in a `.d.ts` describing a genuinely untypeable JavaScript
  API, and at the innermost point of a generic utility whose signature is already
  precise. It is not correct as a way to move past an error.
- **`as` is correct** immediately after a runtime check the compiler cannot
  follow — a validated `JSON.parse` result, a discriminant checked by a
  hand-rolled predicate. Even then a
  [type guard](../../phase-2-narrowing/07-type-guards.md) usually says it better,
  because it makes the check and the type change the same act.
- **`!` is correct** essentially never in application code, and defensibly in a
  test where a fixture's shape is a precondition of the test itself.

📌 **The pattern in all three: the assertion is acceptable when a runtime check
sits directly above it.** An assertion with a check above it is a limitation of
the compiler's inference; an assertion with nothing above it is a guess.

## Gotchas

**Symptom:** an `as` compiles that "should not be possible".
**Cause:** it was written `as unknown as T`, which is two legal assertions in a
row and bypasses `TS2352` entirely.
**Fix:** grep for `as unknown as`. Each instance needs a comment justifying it or
a real runtime check.

**Symptom:** removing an `as` produces an error the team cannot fix, so it goes
back.
**Cause:** frequently the assertion was a conformance claim, not an override.
**Fix:** try `satisfies` first. It checks the value against the type and keeps
the narrower inferred type, which is usually what was wanted.

**Symptom:** `!` count grew sharply after a strictness migration.
**Cause:** the flags were enabled and the errors suppressed rather than fixed.
**Fix:** this is the metric, not a side effect. Revert and redo with a budget.

**Symptom:** `any` was banned by lint rule and unsafe code persists.
**Cause:** `any` arrives from untyped dependencies and `JSON.parse` without
anyone writing the word — `no-explicit-any` does not see those.
**Fix:** the `no-unsafe-*` family, which catches *inherited* `any`
([topic 03](../03-containing-any.md)).

**Symptom:** an assertion is correct today and wrong after a refactor, silently.
**Cause:** assertions are not re-verified — that is what "erased at compile
time" means.
**Fix:** prefer a type guard, which is re-checked whenever the types change.

**Symptom:** `as const` was banned along with other assertions.
**Cause:** `as const` shares a keyword with type assertions and is a different
feature — it narrows to literal types rather than overriding a check.
**Fix:** exempt it. It makes types more precise, not less.

## Interview questions

**Why is a type assertion a soundness hole rather than a cast?**
Because it is erased at compile time and generates no runtime code. A cast in
another language checks or converts; `as` only changes the compiler's opinion. If
the value is not what you claimed, nothing notices until an operation fails.

**What is `as unknown as T` and why does it exist?**
The compiler refuses assertions between unrelated types with `TS2352`, so the
double step routes through `unknown`, which is related to everything. It is the
universal override, and it should be read as a much stronger statement than a
plain `as` — the author is saying the two types have no relationship and
proceeding anyway.

**What should you reach for instead of `as` most of the time?**
`satisfies`, when the intent is "this value conforms to `T`" — it checks the
value and preserves the narrower inferred type. Or a user-defined type guard,
when a runtime check is involved, because a guard makes the check and the type
change the same act and is re-verified whenever the types change.

**Why does this phase keep using assertion count as its metric?**
Because these three holes are the only ones that appear in a diff. Nobody
acquires an `any`, `as` or `!` accidentally — someone wrote it and someone
approved it — so they are greppable, countable and fixable by policy. The
structural holes are none of those things, which makes them worth *knowing* but
impossible to *manage*.

**When is `!` defensible?**
Rarely in application code. In a test, where a fixture's shape is a precondition
of the test itself, it is reasonable — a failure there is a broken test, not a
production incident. In application code the honest version is a check with a
real error, because the case you are asserting away is the one that will happen.

**A team bans `any` by lint rule. What have they not fixed?**
Inherited `any` — from untyped dependencies, from `JSON.parse`, from implicit
returns — none of which involves anyone writing the word, so `no-explicit-any`
never fires. Catching those needs the `no-unsafe-*` family, which is
considerably more expensive to run because it requires type information.

---

← [01 · What unsound means](./01-what-unsound-means.md) · Next → [03 · The holes in your data](./03-the-holes-in-your-data.md)
