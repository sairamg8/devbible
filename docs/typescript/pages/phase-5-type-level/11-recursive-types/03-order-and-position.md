---
title: "Order and position"
sidebar_label: "03 · Order and position"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 4.5 release notes** (*Tail-Recursion
> Elimination on Conditional Types* — *"As long as one branch of a conditional type is
> simply another conditional type…"*) and the **5.9.3** source read behind
> [chunk 01](./01-the-two-limits.md). Variadic tuple types and labelled elements are
> **4.0**. **No sandbox, no console block, no timings.**

The accumulator conversion in [chunk 02](./02-the-accumulator-pattern.md) is meant to be
invisible: same input, same output, computed by iterating instead of stacking. It is
invisible in exactly one case and visible in two others, and knowing which is which is
the difference between a rewrite that is safe and one that silently reverses your data.

There are three rules here. One is about **order**, one is about **which branch** the
bare-call requirement applies to, and one is about how much freedom the **argument list**
has — and the third is the one people over-restrict themselves on for no reason.

## Order — and reversal for free

Where the new element goes in the accumulator decides the order of the output:

| Written as | Produces | Because |
|---|---|---|
| `[...Acc, H]` | the original order | each element is appended behind what came before |
| `[H, ...Acc]` | the reverse order | each element is pushed in front of it |
| `` `${Acc}${H}` `` | the original order | same, for strings |
| `` `${H}${Acc}` `` | the reverse order | same, for strings |

So `Reverse` is not a different algorithm from a copy — it is the same walk with the two
halves of one spread swapped:

```ts
type Copy<T extends readonly unknown[], Acc extends unknown[] = []> =
  T extends readonly [infer H, ...infer R] ? Copy<R, [...Acc, H]> : Acc;

type Reverse<T extends readonly unknown[], Acc extends unknown[] = []> =
  T extends readonly [infer H, ...infer R] ? Reverse<R, [H, ...Acc]> : Acc;
//                                                    ^^^^^^^^^^^^ the only difference
```

🔴 **A tail-recursive walk reverses for free.** The nested version cannot: it builds its
result on the way *out* of the recursion, so producing the reverse means either a second
pass or an awkward inside-out construction. That is worth knowing when you are deciding
whether the conversion is "just" a performance change — it also buys you an operation.

### Why the release notes' own example is safe, and yours might not be

The compiler team convert `Char | GetChars<Rest>` into `GetCharsHelper<Rest, Char | Acc>`
and say nothing about order, because for that type there is nothing to say: **a union has
no order.** `A | B` and `B | A` are the same type, so moving the accumulation from the
way out to the way in cannot change the answer.

Tuples and template literal strings are ordered. The same mechanical rewrite on them is
an order change unless you compensate, and nothing warns you:

```ts
// nested — builds on the way OUT, original order
type Chars<S> = S extends `${infer C}${infer R}` ? [C, ...Chars<R>] : [];

// tail — builds on the way IN. This one is REVERSED …
type CharsHelper<S, Acc extends string[] = []> =
  S extends `${infer C}${infer R}` ? CharsHelper<R, [C, ...Acc]> : Acc;

// … and this one matches the original
type CharsHelper2<S, Acc extends string[] = []> =
  S extends `${infer C}${infer R}` ? CharsHelper2<R, [...Acc, C]> : Acc;
```

⚠️ **`[C, ...Chars<R>]` and `[C, ...Acc]` look almost identical and mean opposite
things.** In the first, `C` goes in front of the *rest of the input*; in the second, it
goes in front of *everything already seen*. That near-identity is why this bug survives
review — the diff is small and reads as a faithful translation.

📌 **Test with three distinguishable elements.** A two-element test passes both ways half
the time, and a test on `["a", "a"]` passes always. `Split<"a/b/c", "/">` is a better test
type than `Split<"a/b", "/">` for exactly that reason.

### The intersection case, and why it is not a fourth row

An intersection accumulator (`Acc & X`, seeded `unknown`) is unordered in the same sense a
union is — `A & B` and `B & A` are the same type. But the *display* of an intersection
keeps the order it was built in, so hovers and error messages will differ between the two
directions even though the types do not. Prefer `Acc & X` so the hover reads in source
order; it changes nothing else.

## The base branch may wrap; only the recursive branch may not

Look again at `Split`:

```ts
type Split<S extends string, Sep extends string, Acc extends string[] = []> =
  S extends `${infer H}${Sep}${infer R}` ? Split<R, Sep, [...Acc, H]> : [...Acc, S];
//                                                                     ^^^^^^^^^^^^
//                                                    wrapping, and completely fine
```

That false branch spreads the accumulator into a new tuple — exactly the "wrapping"
[chunk 02](./02-the-accumulator-pattern.md) tells you to eliminate — and it costs nothing,
because that branch does not recurse. It runs **once**, at the end.

📌 **The rule is narrower than it first sounds:** only the branch containing the recursive
call has to be bare. Every other branch can do whatever the answer needs.

That makes the base branch the right home for four things people wrongly put on the
recursive path:

1. **Cosmetics.** A `Prettify`-style helper that flattens an intersection for the hover
   belongs here, or on the public alias — applied per step it is pure waste, and it also
   destroys tail position, so it costs you the 10× ceiling as well as the work.
2. **The final shape change.** If the accumulator is a working representation — a counter
   tuple, a list of pairs — converting it to the type you actually return (`Acc["length"]`,
   an object, a union) happens once, here.
3. **The last element.** `Split`'s `[...Acc, S]` exists because the final segment has no
   separator after it, so it never matched the recursive pattern. Almost every string
   splitter has a version of this, and forgetting it silently drops the last item.
4. **The failure answer.** `never`, a branded error type, or a message string for the
   caller — see **chunk 05 · Capping depth deliberately** *(not written yet)*, which is
   about deciding what that answer is on purpose, and
   [chunk 04](./04-the-fine-print.md) for why the base branch is also where the public
   alias earns its keep.

⚠️ **A type with more than two branches has more than one "other" branch.** A chain of
conditionals may have several non-recursive outcomes and one recursive one; the bare-call
rule applies to the recursive one only, however deep in the chain it sits.

## The argument list is free

This is the rule people invent for themselves and then work around at real cost. Tail
position is about **what surrounds the call**, not about what its arguments are made of. A
conditional type in an argument is fine:

```ts
type Join<
  T extends readonly string[],
  Sep extends string = ", ",
  Acc extends string = "",
> = T extends readonly [infer H extends string, ...infer R extends string[]]
  ? Join<R, Sep, Acc extends "" ? H : `${Acc}${Sep}${H}`>
//                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ a conditional, in an argument
  : Acc;
```

The branch is still nothing but `Join<…>`. The argument is evaluated **to produce** the
call; it does not wrap it. This matters because the alternative — hoisting that logic into
a wrapper around the call — is precisely what breaks the optimisation.

The release notes' phrasing is the thing to hold onto:

> As long as one branch of a conditional type is simply another conditional type,
> TypeScript can avoid intermediate instantiations.

**"Simply another conditional type"** covers a call to a conditional alias *and* a
literal conditional written in place — which is why a chain of conditionals in the branch
keeps the optimisation, and why the separator logic above is safe.

⚠️ **Free is not the same as cheap.** The argument is instantiated on **every** step, so
its cost is multiplied by the iteration count. A `Join` over 500 elements evaluates that
`Acc extends ""` check 500 times. Keep arguments small for cost reasons; do not
restructure them for tail-position reasons.

## The eyeball test, applied

Everything above collapses into one question — *what surrounds the call in the recursive
branch?*

| Recursive branch | Position | Note |
|---|---|---|
| `Helper<R, Acc>` | ✅ tail | the target shape |
| `Helper<R, [...Acc, H]>` | ✅ tail | an argument, not a wrapper |
| `Helper<R, Acc extends "" ? H : X>` | ✅ tail | a conditional argument is still an argument |
| `Cond extends true ? A : Helper<R, Acc>` | ✅ tail | the branch is *simply another conditional* |
| `[Helper<R, Acc>]` | ❌ nested | a tuple around it |
| `H \| Helper<R, Acc>` | ❌ nested | the release notes' own counter-example |
| `{ value: Helper<R, Acc> }` | ❌ nested | an object around it |
| `Prettify<Helper<R, Acc>>` | ❌ nested | another utility around it — the commonest accident |
| `Helper<R, Acc>[]` | ❌ nested | an array around it |

📌 **When you cannot tell, do not reason about reduction.** `X | never` is `X` and
`[...T]` is `T`, but a shape that *reads* as a wrapper is not worth the uncertainty — this
corpus does not have a run to settle it with, and the fix is to write the bare call anyway.
Say "I did not confirm this" rather than betting a page on it.

## Gotchas

**Symptom:** The converted type returns the input backwards.
**Cause:** The accumulator is built on the way in, not on the way out, so the spread order
is now what decides output order.
**Fix:** `[...Acc, H]` for original order, `[H, ...Acc]` for reversed. Test with three
distinguishable elements — two-element tests pass both ways half the time.

**Symptom:** The union version converted perfectly and the tuple version of the same walk
came back reversed.
**Cause:** Unions are unordered so the rewrite could not change them; tuples and strings
are ordered so it could.
**Fix:** Treat "the release-notes example was safe" as a fact about unions, not about the
pattern. Re-check order every time the accumulator is a tuple or a string.

**Symptom:** A string splitter drops the last segment.
**Cause:** The final segment has no separator after it, so it never matches the recursive
pattern — it only exists in the base branch.
**Fix:** Return `[...Acc, S]`, not `Acc`, in the false branch. This is the single most
common bug in hand-written `Split` types.

**Symptom:** You moved a `Prettify` onto the base branch and the hover got worse rather
than better.
**Cause:** Prettifying the accumulator is not the same as prettifying the result when the
base branch also reshapes it — the flatten happened before the reshape.
**Fix:** Apply the cosmetic helper on the **public alias**, outermost, where it sees the
finished type. That also keeps it out of the recursive path.

**Symptom:** The type is slow despite being provably tail-recursive.
**Cause:** A heavy argument. Tail position bounds the *iterations*; it says nothing about
the cost of each one, and the argument expression runs on every step.
**Fix:** Hoist anything loop-invariant out of the argument, and prefer a cheap
accumulation step even if the base branch then has more work to do — that runs once.

**Symptom:** Adding a third branch to the conditional broke the ceiling.
**Cause:** The recursive call ended up wrapped in one of the new arms, or the chain now
produces a non-conditional intermediate.
**Fix:** Check only the arm that recurses. The others are unconstrained; if the recursing
arm is bare, the chain is fine.

**Symptom:** An intersection accumulator produces a correct type with an unreadable hover.
**Cause:** Intersections are unordered as types but are *displayed* in construction order.
**Fix:** Accumulate as `Acc & X` so the display follows source order, and flatten once at
the boundary rather than per step.

**Symptom:** You cannot decide whether a shape counts as a wrapper.
**Cause:** It reduces to the bare call, but only after reduction — `X | never`, a
single-element spread.
**Fix:** Rewrite it as the bare call. Relying on reduction is a bet you cannot settle
without measuring, and this corpus has no run to settle it with.

## Interview questions

**★ Does converting a recursive type to an accumulator change its result?**
For a union, no — unions are unordered, so accumulating on the way in rather than on the
way out cannot change the type. For tuples and template literal strings, yes, unless you
compensate: the nested form assembles the result on the way out of the recursion and the
accumulator form assembles it on the way in, so the same spread order produces the reverse
sequence. It is the pattern's most common silent bug.

**★ How do you get the original order, and how do you get the reverse?**
`[...Acc, H]` appends and preserves order; `[H, ...Acc]` prepends and reverses it. The
string equivalents are the two orders of a template literal. So a reversal is free — the
same single walk, with the two halves of one spread swapped — where the nested form would
need a second pass.

**★ Does the whole type have to avoid wrapping, or just part of it?**
Only the branch containing the recursive call. Every other branch runs exactly once, so it
can wrap freely — which makes the base branch the correct home for cosmetics, for the
final shape change from a working accumulator to the returned type, and for the last
element that never matched the recursive pattern.

**★ Can you put a conditional type in the arguments of a tail call?**
Yes. Tail position is about what surrounds the call, not about what its arguments contain,
and the release notes' condition is that the branch is "simply another conditional type" —
which a chain of conditionals satisfies. The real constraint is cost, not position: the
argument is instantiated on every step, so a heavy one is multiplied by the iteration
count.

**★ Give the eyeball test for tail position in one sentence.**
Delete the recursive call from the branch and look at what is left: if anything remains —
a bracket, a union bar, an object literal, another utility type — the call was nested; if
the branch is empty, it was in tail position. Arguments to the call do not count, because
they disappear with it.

**Why is `Prettify<Helper<R, Acc>>` the accident that keeps happening?**
Because it is added for a good reason — the hover was unreadable — and it is added at the
place where the unreadable type is produced, which is the recursive branch. It wraps the
call, so it silently drops the type from the 1,000-iteration path back to the 100-level
one, and the symptom (`TS2589` on larger inputs) shows up nowhere near the change.

**What is the last-element bug in a `Split` type?**
The recursive pattern only matches text that still contains a separator, so the final
segment never goes through it. If the base branch returns `Acc` rather than
`[...Acc, S]`, the last item is dropped — and every test whose input ends with a trailing
separator will pass, which is why it survives.

**Should you rely on a wrapper that reduces away, like a union with `never`?**
No. It may well be fine, but reduction happening before the tail-call check is not
something the release notes state and not something this corpus has measured, so it is an
unverified bet on the hot path of your type. Write the bare call; it costs nothing and
removes the question.

---

← [02 · The accumulator pattern](./02-the-accumulator-pattern.md) ·
[Topic index](./README.md) · Next → [04 · The fine print](./04-the-fine-print.md)
