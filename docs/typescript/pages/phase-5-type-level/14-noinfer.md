---
title: "`NoInfer<T>`"
sidebar_label: "14 · NoInfer<T>"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 5.4 release notes**, *The `NoInfer` Utility
> Type* — the `createStreetLight` example, the `D extends C` workaround, the error text and
> the sentence describing what `NoInfer` signals are all quoted from there. Inference sites
> and contextual typing are
> [phase 3 · topic 10](../phase-3-generics/10-inference-sites-and-contextual-typing.md)'s.
> **No sandbox, no console block, no timings.**

Every other type in this phase computes a type from a type. `NoInfer<T>` computes nothing —
it is a **signal to the inference algorithm**, and it is the only tool in the phase that
changes *how* a type is arrived at rather than *what* it is.

## The problem, in the release notes' own example

```ts
function createStreetLight<C extends string>(colors: C[], defaultColor?: C) {
  // ...
}

createStreetLight(["red", "yellow", "green"], "red");
```

> What happens when we pass in a `defaultColor` that wasn't in the original `colors` array?
> In this function, `colors` is supposed to be the "source of truth" and describe what can be
> passed to `defaultColor`.

```ts
// Oops! This is undesirable, but is allowed!
createStreetLight(["red", "yellow", "green"], "blue");
```

> In this call, type inference decided that `"blue"` was just as valid of a type as `"red"`
> or `"yellow"` or `"green"`. So instead of rejecting the call, TypeScript infers the type of
> `C` as `"red" | "yellow" | "green" | "blue"`.

🔴 **Nothing went wrong here.** `C` appears in two parameters, so both are inference sites,
and the algorithm did exactly what it is supposed to: it found a type that satisfies every
candidate. The bug is in the *signature* — it says the two parameters are related, when the
intent was that one **constrains** the other.

📌 **That distinction is the whole topic.** A type parameter used in two positions is
symmetric by default. `NoInfer` is how you make it asymmetric.

## The workaround, and why the notes call it a smell

> One way people currently deal with this is to add a separate type parameter that's bounded
> by the existing type parameter.

```ts
function createStreetLight<C extends string, D extends C>(colors: C[], defaultColor?: D) {}

createStreetLight(["red", "yellow", "green"], "blue");
//                                            ~~~~~~
// error!
// Argument of type '"blue"' is not assignable to parameter of type '"red" | "yellow" | "green" | undefined'.
```

> This works, but is a little bit awkward because `D` probably won't be used anywhere else in
> the signature for `createStreetLight`. While not bad *in this case*, using a type parameter
> only once in a signature is often a code smell.

⚠️ **That last sentence is [phase 3 · topic 13](../phase-3-generics/13-when-not-to-write-a-generic/README.md)'s
rule, stated by the compiler team** — a type parameter appearing once relates nothing, so it
is doing the work of a plain annotation while looking like a generic. The workaround is a
deliberate, documented exception to a rule the corpus argues elsewhere, and it is worth
knowing that the language shipped a feature specifically to remove the exception.

## The fix

> That's why TypeScript 5.4 introduces a new `NoInfer<T>` utility type. Surrounding a type in
> `NoInfer<...>` gives a signal to TypeScript not to dig in and match against the inner types
> to find candidates for type inference.

```ts
function createStreetLight<C extends string>(colors: C[], defaultColor?: NoInfer<C>) {
  // ...
}

createStreetLight(["red", "yellow", "green"], "blue");
//                                            ~~~~~~
// error!
// Argument of type '"blue"' is not assignable to parameter of type '"red" | "yellow" | "green" | undefined'.
```

> Excluding the type of `defaultColor` from being explored for inference means that `"blue"`
> never ends up as an inference candidate, and the type-checker can reject it.

**One parameter is now the source of truth and the other is checked against it.** The
signature has one type parameter, used twice, with one of the uses marked as
*"read, do not infer from"*.

## What it does and does not do

| | |
|---|---|
| ✅ Removes that position as an **inference site** | so its argument contributes no candidate for `C` |
| ✅ Still **checks** the argument against `C` | assignability is unchanged, which is why `"blue"` errors rather than being ignored |
| ❌ Does **not** change the constraint | `C extends string` still governs what `C` can be |
| ❌ Does **not** narrow, widen or transform anything | the type at that position is exactly `C` |

🔴 **The two-line summary: `NoInfer<T>` is `T` for every purpose except inference.** It is
not a computation and it has no runtime or emit consequence — which also means it cannot fix
a signature whose *constraint* is wrong. If the error you want is "not one of the allowed
colours" and the constraint is `string`, `NoInfer` gives you exactly that; if the constraint
itself is too loose, this is the wrong tool.

## Where it earns its place

The shape is always the same — **one argument defines the set, another must be drawn from
it** — and it recurs more than you would expect:

1. **A default drawn from a list.** The notes' own case.
2. **A callback whose parameter type is fixed by an earlier argument.**
   `map<T>(items: T[], fn: (item: NoInfer<T>) => void)` — otherwise a wrongly-annotated
   callback parameter widens `T` instead of erroring.
3. **An initial value for a state machine or reducer**, where the states are enumerated by
   another argument.
4. **A builder step that must match what an earlier step declared** — a column list and a
   default sort key, a route table and a fallback route.
5. **Anywhere the current signature has a single-use type parameter bounded by another one**
   — that is the `D extends C` shape, and it is now a `NoInfer` in disguise.

📌 **Test for it:** if a wrong argument *widens the inferred type* instead of producing an
error, the position that widened it should probably be `NoInfer`.

## Position matters, and getting it wrong is silent

`NoInfer` on the wrong parameter removes the only site that was doing the inferring:

```ts
// ❌ nothing is left to infer C from
function createStreetLight<C extends string>(colors: NoInfer<C>[], defaultColor?: C) {}
```

`C` now has no inference candidate from `colors`, so it is inferred from `defaultColor`
alone — the exact inversion of what was wanted — and when `defaultColor` is omitted, `C`
falls back to its constraint. **Nothing errors at the definition.** The signature compiles
and behaves wrongly, which puts it in the same category as the bug it was meant to fix.

🔴 **The rule: mark the *consumers*, never the source of truth.** Exactly one position should
remain an inference site, and it should be the argument whose type you actually want to read.

## Before 5.4

`NoInfer` is an **intrinsic** — it is implemented in the checker, not expressible as a type
alias — which is why it needed a release rather than a `lib` addition. Before it, codebases
used the `D extends C` workaround above, or a community trick that wrapped the type in an
indexed access to blunt the inference site.

⚠️ **The community trick is superseded and should not be reintroduced.** It is worth
recognising in old code, but on 5.4 or later the intrinsic is the answer: it is documented,
it says what it means at the call site, and it does not add a type parameter.

## Gotchas

**Symptom:** A wrong argument widens the inferred type instead of erroring.
**Cause:** That position is an inference site, so its argument is a candidate rather than a
constraint.
**Fix:** `NoInfer<...>` around it. This is the diagnostic test for the whole feature.

**Symptom:** `NoInfer` was added and now nothing infers at all.
**Cause:** It was applied to the parameter that was the source of truth, so no inference site
remains.
**Fix:** Mark the consumers, not the source. Exactly one position stays inferable.

**Symptom:** `NoInfer` did not produce the error you expected.
**Cause:** The constraint is too loose. `NoInfer` blocks inference; it does not tighten
`C extends string`.
**Fix:** Fix the constraint. These are two different levers and only one of them is about
what values are legal.

**Symptom:** A callback's wrongly-annotated parameter silently widened the element type.
**Cause:** The callback parameter is an inference site like any other.
**Fix:** `fn: (item: NoInfer<T>) => void`. The array argument should define `T`; the callback
should be checked against it.

**Symptom:** The `D extends C` workaround was replaced with `NoInfer` and an unrelated call
site broke.
**Cause:** They are not identical — `D` could be *narrower* than `C` and was inferred
separately, where `NoInfer<C>` is exactly `C`.
**Fix:** Usually the new behaviour is the intended one; if a caller genuinely needed the
narrower `D`, that call wanted a different signature.

**Symptom:** `NoInfer` appears in a return type and seems to do nothing.
**Cause:** Return positions are not inference sites for the call's own type arguments.
**Fix:** Remove it. It is noise there, and noise in a signature is read as meaning.

**Symptom:** Errors mention `NoInfer<C>` and readers do not know what it is.
**Cause:** It is recent and it looks like a computation.
**Fix:** Worth a one-line comment the first time it appears in a codebase — *"checked
against, never inferred from"* — because the name describes the mechanism rather than the
intent.

**Symptom:** The project is on a pre-5.4 compiler.
**Cause:** `NoInfer` is an intrinsic added in 5.4.
**Fix:** The `D extends C` workaround, with a comment saying what it is for. Do not
hand-write an emulation.

## Interview questions

**★ What problem does `NoInfer<T>` solve?**
A type parameter used in two positions makes both of them inference sites, so an argument
that was supposed to be *checked against* the other instead contributes a candidate and
widens the result. The release notes' example: `createStreetLight(["red", "yellow",
"green"], "blue")` infers `C` as `"red" | "yellow" | "green" | "blue"` and is accepted.
Wrapping the second parameter in `NoInfer` removes it as an inference site, so `"blue"` is
never a candidate and the call is correctly rejected.

**★ What was the workaround, and why did the language add a feature to replace it?**
A second type parameter bounded by the first — `<C extends string, D extends C>` with
`defaultColor?: D`. It works, but `D` is used exactly once in the signature, and the notes
say plainly that using a type parameter only once is often a code smell. `NoInfer` gets the
same behaviour with one type parameter and says what it means at the position it applies to.

**★ Does `NoInfer` change assignability?**
No. It removes the position as an inference site and nothing else — the argument is still
checked against the type parameter, which is exactly why `"blue"` produces an error rather
than being silently ignored. `NoInfer<T>` is `T` for every purpose except inference, so it
cannot fix a constraint that is too loose.

**★ Where does it go in a signature?**
On the consumers, never on the source of truth. Exactly one position should remain an
inference site — the argument whose type you actually want to read. Marking the wrong one
removes the only candidate, so the type parameter falls back to being inferred from somewhere
you did not intend or to its constraint, and nothing errors at the definition.

**★ How do you recognise a signature that wants it?**
If passing a *wrong* argument widens the inferred type rather than producing an error, the
position that widened it should be `NoInfer`. The general shape is "one argument defines the
set, another must be drawn from it": a default from a list, a callback parameter fixed by an
earlier argument, an initial state from an enumerated set, a builder step matching an earlier
one. Any existing single-use type parameter bounded by another one is the same thing written
the old way.

**Why did this need a compiler feature rather than a library type?**
Because it is not a computation — there is no mapping from input type to output type that
expresses "do not look here for candidates". `NoInfer` is an intrinsic, implemented in the
checker's inference machinery, which is why it arrived in a release rather than as an
addition to `lib`.

**Is `NoInfer<C>` interchangeable with the `D extends C` workaround?**
Almost, and the difference matters occasionally. `D` was inferred independently and could
land on a *narrower* type than `C`; `NoInfer<C>` is exactly `C`. If a caller depended on the
narrower inference, replacing the workaround changes their result — which usually means that
call wanted a different signature, but it is worth checking rather than assuming.

## Where this connects

- **← [Phase 3 · Inference sites and contextual typing](../phase-3-generics/10-inference-sites-and-contextual-typing.md)**
  — what an inference site is and how candidates are gathered. `NoInfer` is a switch on that
  machinery and does not make sense without it.
- **← [Phase 3 · When *not* to write a generic](../phase-3-generics/13-when-not-to-write-a-generic/README.md)**
  — the single-use type parameter rule, which the 5.4 notes independently state as the reason
  the old workaround was unsatisfying.
- **← [10 · Deriving one function's type from another · chunk 02](./10-deriving-function-types/02-what-it-loses.md)**
  — making a wrapper generic to preserve genericity **adds inference sites**, and that page
  hands the consequence to this topic.
- **→ [15 · Union → intersection and other identities](./15-union-to-intersection.md)** — the
  other place inference behaviour is exploited deliberately.

---

← [13 · Tuple manipulation](./13-tuple-manipulation/README.md) ·
[Phase 5 index](./README.md) · Next → [15 · Union → intersection and other identities](./15-union-to-intersection.md)
