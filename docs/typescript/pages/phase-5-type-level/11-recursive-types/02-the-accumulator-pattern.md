---
title: "The accumulator pattern"
sidebar_label: "02 · The accumulator pattern"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 4.5 release notes**, *Tail-Recursion
> Elimination on Conditional Types* — the `GetChars` / `GetCharsHelper` pair below is
> **the compiler team's own example**, quoted verbatim, as are the two sentences saying
> when the optimisation applies. `infer X extends string` is **4.8**; variadic tuple
> types are **4.0**. Diagnostic codes are read out of the **5.9.3** message table
> (`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`) rather than recalled.
> **No sandbox, no console block, no timings.**

[Chunk 01](./01-the-two-limits.md) said the ceiling depends on whether the recursive
call is the branch's entire result — 100 if anything wraps it, 1,000 if nothing does.
This chunk is the conversion that moves a type from the first case to the second.

It is one move, and it has a name in the release notes.

## The compiler team's own example

The 4.5 release notes introduce tail-call elimination and then, in the same breath,
show the type it does **not** help:

> Keep in mind, the following type *won't* be optimized, since it uses the result of a
> conditional type by adding it to a union.

```ts
type GetChars<S> =
    S extends `${infer Char}${infer Rest}` ? Char | GetChars<Rest> : never;
```

`Char | GetChars<Rest>` is a union built **around** the recursive call, so every step
stacks — the nested path, ceiling 100. The fix follows immediately:

> If you would like to make it tail-recursive, you can introduce a helper that takes an
> "accumulator" type parameter, just like with tail-recursive functions.

```ts
type GetChars<S> = GetCharsHelper<S, never>;
type GetCharsHelper<S, Acc> =
    S extends `${infer Char}${infer Rest}` ? GetCharsHelper<Rest, Char | Acc> : Acc;
```

Nothing was deleted. The union is still built — it moved **inside the argument list**,
where it is computed to produce the call rather than wrapped around it. The branch is
now nothing but `GetCharsHelper<…>`, which is exactly what the optimisation looks for:

> As long as one branch of a conditional type is simply another conditional type,
> TypeScript can avoid intermediate instantiations. There are still heuristics to
> ensure that these types don't go off the rails, but they are much more generous.

📌 **"Much more generous" is as specific as the notes get.** The actual number — 1,000
against 100 — is not documented anywhere; it comes from reading `getConditionalType`'s
`tailCount === 1e3` guard, which is [chunk 01](./01-the-two-limits.md)'s find.

## The recipe — five steps

1. **Find the wrapper.** Look at the recursive branch and ask what surrounds the call.
   In `GetChars` it is `Char |`. In a tuple walk it is usually a pair of brackets.
2. **Add a type parameter to carry it**, with a seed as its default:
   `Acc extends string = ""`, `Acc extends unknown[] = []`, or `Acc = never`.
3. **Move the wrapping work into the argument.** `Char | GetChars<Rest>` becomes
   `GetCharsHelper<Rest, Char | Acc>`. The work is identical; its *position* changed.
4. **Return the accumulator in the base branch** — the recursion no longer builds a
   value on the way out, so the answer has to be the thing you carried in.
5. **Hide the helper behind a public alias** that seeds it, exactly as the release notes
   do with `type GetChars<S> = GetCharsHelper<S, never>`.

⚠️ **Steps 3 and 4 together are why the conversion changes nothing observable.** The
result is the same type; the compiler simply reaches it by iterating instead of
stacking. If the output changed, the conversion was done wrong — and the usual way it
changes is order, which is [chunk 03 · Order and position](./03-order-and-position.md).

## The three kinds of accumulator

Which seed you pick is decided by what the type produces, and there are only three
common answers.

### A union accumulator — seed `never`

`never` is the identity for `|`, so the first step's `Char | never` is just `Char`. That
is why the release notes seed with it rather than with a sentinel:

```ts
type GetChars<S> = GetCharsHelper<S, never>;
type GetCharsHelper<S, Acc> =
    S extends `${infer Char}${infer Rest}` ? GetCharsHelper<Rest, Char | Acc> : Acc;
```

The same shape covers "collect every key that matches", "collect every event name", and
every other type whose answer is a set.

### A string accumulator — seed `""`

`""` is the identity for template-literal concatenation. Joining a tuple of strings:

```ts
type Join<
  T extends readonly string[],
  Sep extends string = ", ",
  Acc extends string = "",
> = T extends readonly [infer H extends string, ...infer R extends string[]]
  ? Join<R, Sep, Acc extends "" ? H : `${Acc}${Sep}${H}`>
  : Acc;

type Cols = Join<["id", "name", "email"]>;   // "id, name, email"
```

⚠️ `infer H extends string` is **TypeScript 4.8**. Before it you constrained by hand,
which meant writing a second conditional *around* the recursive call — and that loses
the tail position the rewrite was for. The 4.8 syntax is not sugar in this pattern; it
is what keeps the type on the fast path.

### A tuple accumulator — seed `[]`

The most general of the three, because a tuple carries both a result **and** a count.
Reversing:

```ts
type Reverse<T extends readonly unknown[], Acc extends unknown[] = []> =
  T extends readonly [infer H, ...infer R] ? Reverse<R, [H, ...Acc]> : Acc;

type Backwards = Reverse<[1, 2, 3]>;   // [3, 2, 1]
```

Splitting a string, which produces a tuple *from* a string:

```ts
type Split<S extends string, Sep extends string, Acc extends string[] = []> =
  S extends `${infer H}${Sep}${infer R}` ? Split<R, Sep, [...Acc, H]> : [...Acc, S];

type Parts = Split<"a/b/c", "/">;   // ["a", "b", "c"]
```

And counting, where the accumulator is *only* a counter and the answer is its length:

```ts
type Range<N extends number, Acc extends number[] = []> =
  Acc["length"] extends N ? Acc : Range<N, [...Acc, Acc["length"]]>;

type ZeroToFour = Range<5>;   // [0, 1, 2, 3, 4]
```

🔴 **`Acc["length"]` is the whole reason tuples are the general case.** It converts a
tuple back into a numeric literal type, so a tuple accumulator is simultaneously the
result you are building and the loop counter you are testing against — which is what
makes `Range`, `Repeat` and the deliberate depth caps in
**chunk 05 · Capping depth deliberately** *(not written yet)* possible at all.

## Two accumulators are normal

Nothing says there is one. Repeating a string `N` times needs an output accumulator and
a counter, and they are different types:

```ts
type Repeat<
  S extends string,
  N extends number,
  Acc extends string = "",
  Count extends 1[] = [],
> = Count["length"] extends N ? Acc : Repeat<S, N, `${Acc}${S}`, [...Count, 1]>;

type Indent = Repeat<"  ", 3>;   // "      "
```

The call is still bare, so this is still tail-recursive; the parameter list just got
longer. **Arity does not affect tail position.**

📌 **Note which parameter the base case tests.** `Repeat` terminates on the *counter*,
not on the input, because its input never shrinks — the walk is over a number, not over
a structure. A recursion whose input does not get smaller needs something else that
does, and a counter tuple is the standard something.

## Gotchas

**Symptom:** You added an accumulator and the ceiling did not move at all.
**Cause:** Something still wraps the call — very often a `Prettify` or `Simplify` helper
applied to the recursive result "just to make the hover readable".
**Fix:** Apply the cosmetic helper in the **base** branch, or at the public alias, where
it runs once instead of on every step.

**Symptom:** `TS2574` — *"A rest element type must be an array type."*
**Cause:** The accumulator is unconstrained, so `[...Acc, H]` cannot know it is
spreadable.
**Fix:** Constrain it: `Acc extends unknown[] = []`. A union accumulator seeded with
`never` needs no constraint, which is why the release-notes example has none — and that
asymmetry is exactly what trips you when you copy that example and switch to tuples.

**Symptom:** `Acc["length"]` comes back as `number` instead of a literal like `3`.
**Cause:** The accumulator widened to an array type — `unknown[]`, `string[]` — instead
of staying a tuple.
**Fix:** Keep every step a tuple literal, `[...Acc, X]`. Widening usually creeps in from
an annotation on the *default*, or from a helper that returned `Array<T>` in a branch.

**Symptom:** A union accumulator quietly loses members.
**Cause:** The wrong seed. Seeding with `unknown` swallows the union at the first step;
seeding with a sentinel like `null` leaves the sentinel in the answer.
**Fix:** Seed with the identity element of the operation — `never` for `|`, `""` for
concatenation, `[]` for tuple building, `unknown` for `&`.

**Symptom:** The type terminates on a tuple but loops forever on a string input.
**Cause:** The base case tests the wrong parameter — usually the accumulator instead of
the input, or the input instead of a counter in a type whose input never shrinks.
**Fix:** Ask which parameter is strictly getting smaller on every step, and test that
one. If none is, add a counter, as `Repeat` does.

**Symptom:** The helper's default seed makes the type behave differently depending on
whether the caller passed two arguments or one.
**Cause:** The accumulator is a public parameter with a default, so it is part of the
API whether you meant it or not.
**Fix:** The public-alias split — step 5. `type Join<T> = JoinHelper<T, ", ", "">` has
exactly one parameter, and no caller can seed it wrongly.

**Symptom:** Every hover and every error now names `JoinHelper` rather than `Join`.
**Cause:** The helper is what actually resolves, so the helper is what the checker
reports on.
**Fix:** Expected, and the reason [topic 08](../08-knowing-when-to-stop/README.md) cares
about naming: name the helper for the reader who will see it in a diagnostic, not for
yourself. It is not a reason to inline the helper back.

**Symptom:** A string accumulator behaves oddly the moment the input is a union.
**Cause:** The conditional distributes, so each member is walked separately — and per
[chunk 01](./01-the-two-limits.md), distribution also bails out of the tail-call loop,
so you lose the ceiling as well.
**Fix:** Wrap both sides in single-element tuples if you want one walk over the whole
union. Leave it distributive if per-member is what you meant. Decide it, do not discover
it.

## Interview questions

**★ What is the accumulator pattern in a type, and what problem does it solve?**
It is a rewrite that moves a recursive type's work out from around the recursive call
and into the call's arguments, so the recursive branch is nothing but the call. That
puts it in tail position, which the compiler evaluates by re-entering a loop rather than
by nesting an instantiation — so the ceiling moves from 100 levels to 1,000 iterations.
The release notes introduce it with exactly this shape: `GetChars` builds
`Char | GetChars<Rest>` and is not optimised; the helper taking `Char | Acc` as an
argument is.

**★ Show the conversion on a type that unions its results.**
Take the release notes' own pair. The unoptimised form puts the union around the call in
the true branch; the optimised form is a public alias `GetChars<S> = GetCharsHelper<S,
never>` plus a helper whose true branch is `GetCharsHelper<Rest, Char | Acc>` and whose
false branch returns `Acc`. The union still happens — it moved into the argument list —
and the base case returns the accumulator instead of `never`.

**★ How do you choose the seed?**
By the identity element of whatever you are accumulating: `never` for a union, because
`X | never` is `X`; `""` for string concatenation; `[]` for tuple building; `unknown` for
an intersection. Getting it wrong does not error — it produces a subtly wrong answer,
which is why it is worth stating as a rule rather than guessing per type.

**★ Why is a tuple accumulator the general case?**
Because `Acc["length"]` turns it back into a numeric literal type. One accumulator can
therefore be both the result you are building and the counter you test against, which is
what makes counting, ranges, repetition and deliberate depth caps expressible. Union and
string accumulators can only carry the result; they cannot tell you how many steps have
happened.

**★ What terminates a tail-recursive type whose input never gets smaller?**
A counter. `Repeat<S, N>` walks a *number*, not a structure, so nothing shrinks — the
base case tests a counter tuple's length against `N` and the recursion grows that tuple
by one per step. Any recursion where you cannot point at a parameter that is strictly
decreasing needs this, and if you cannot add one, the type does not terminate.

**Can a type have more than one accumulator?**
Yes, and it is common — an output accumulator plus a counter is the standard pair. The
extra parameters do not affect tail position, which is a property of what surrounds the
call in the branch, not of how many arguments it takes.

**What error tells you the accumulator is unconstrained?**
`TS2574`, *"A rest element type must be an array type"*, raised at the spread. It only
appears for tuple and array accumulators; a union accumulator legitimately needs no
constraint, so the release-notes example's lack of one is not an oversight.

**Does the conversion change the type the caller sees?**
It should not — same input, same output, computed by iterating instead of stacking. Two
things do change and both are visible: diagnostics and hovers name the helper rather
than the public alias, and if the accumulated structure is ordered, the order can flip.
The first is cosmetic; the second is a bug, and it is common enough to be worth a
dedicated test.

---

← [01 · The two limits](./01-the-two-limits.md) · [Topic index](./README.md) ·
Next → [03 · Order and position](./03-order-and-position.md)
