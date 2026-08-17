---
title: "What unsound means, and why it was chosen"
sidebar_label: "01 · What unsound means"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript Design Goals**, whose *Non-goals*
> list states the position explicitly — *"Apply a sound or 'provably correct'
> type system. Instead, strike a balance between correctness and
> productivity."* — and the **TypeScript handbook**'s treatment of structural
> typing and type assertions. **No sandbox, no console block.**

Every page before this one has been about making the compiler catch more. This
one is about the things it will **never** catch, on purpose, and it is the most
useful page in the phase for exactly that reason.

> **A sound type system guarantees that a value of type `T` is always a `T` at
> runtime. TypeScript makes no such guarantee, and does not try to.** That is a
> stated non-goal, not an unfixed bug — and knowing precisely where the guarantee
> stops is worth more than believing it holds everywhere.

## The definition, precisely

A type system is **sound** if it never accepts a program that goes wrong in the
way the types were supposed to prevent. No `string` that is secretly a `number`;
no property access on a value that does not have it.

TypeScript accepts such programs. Not through bugs — through decisions:

```ts
const xs: string[] = ['a'];
const x: string = xs[5];      // typed string. is undefined.
x.toUpperCase();              // TypeError at runtime
```

The compiler is content, the type is wrong, and nobody made a mistake writing the
compiler. `xs[5]` was **decided** to be `string` because the alternative — every
array read being `string | undefined` — was judged too costly for what it buys.
(You can buy it: [`noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md).)

## Why the trade was made

The Design Goals put it in one line: *strike a balance between correctness and
productivity*. What that means concretely, in the cases on the following pages:

- **The unsound behaviour is what makes ordinary JavaScript type-check.**
  `Array<Dog>` being assignable to `Array<Animal>` is unsound, and it is also how
  every `map`, `filter` and `forEach` over a subtype-array works without
  ceremony.
- **The sound alternative exists and people rejected it.** Sound languages solve
  array covariance with immutability or with variance annotations. Both were
  available; both cost more than the bug they prevent, in a language whose job is
  to type existing JavaScript.
- **The escape hatches are the point.** `any` and `as` exist so you can describe
  JavaScript that no type system can describe. Removing them would not make
  TypeScript sound, it would make it unable to type the code it was built for.

📌 **This is worth being fair about.** "TypeScript is unsound" is often said as a
criticism, and it is really a description of a design position that has held for
over a decade and produced the most widely-adopted gradual type system there is.
The interesting question is never *whether* it is unsound; it is **where**.

## Unsound is not the same as buggy

Three things get conflated and are worth separating, because the response to each
is different:

| | What it is | What you do |
|---|---|---|
| **A compiler bug** | the checker is wrong about its own rules | report it; it will be fixed |
| **A deliberate hole** | the rules themselves permit an unsafe program | know it, and put a runtime check there |
| **A missing flag** | soundness is available but not switched on | switch it on |

🔴 **The middle row is this topic.** The holes listed in the following chunks are
not going to be fixed, because fixing them is not a goal. They are permanent
features of the language and your defence against each of them is **a runtime
check in a place you chose deliberately**.

⚠️ **The third row matters too, and is often mistaken for the second.** Index
access is only unsound *by default*; `noUncheckedIndexedAccess` closes it. So is
the object-spread hole, which
[`exactOptionalPropertyTypes`](../05-exactoptionalpropertytypes/README.md)
closes. Before treating a hole as permanent, check whether a flag already sells
you the fix — [topic 06](../06-the-other-correctness-flags/README.md) is largely
a list of such flags.

## The seven holes on the following pages

| # | Hole | Chosen? | Closable by a flag? |
|---|---|---|---|
| 1 | **`any`** | yes, you write it | no — [contain it](../03-containing-any.md) |
| 2 | **Type assertions** (`as`, `!`) | yes, you write it | no |
| 3 | **Index access** | no | ✅ `noUncheckedIndexedAccess` |
| 4 | **Object spread over optionals** | no | ✅ `exactOptionalPropertyTypes` |
| 5 | **`Object.keys` returns `string[]`** | no | no |
| 6 | **Mutation through an alias** (array covariance, aliased `readonly`) | no | no |
| 7 | **Method parameter bivariance** | no | no |

📌 **Read the third column before the second.** Two of the seven are not really
permanent holes at all — they are defaults, and this phase has already told you
how to buy the fix. The genuinely permanent ones are five, and three of those are
things you opt into by writing them.

**That leaves two holes you neither chose nor can close: `Object.keys`, and
mutation through an alias.** Those are the ones worth memorising.

## How to use the list

Not as trivia. Each hole marks a place where **the type is a claim rather than a
fact**, and the useful response is always the same shape:

1. **Find where untrusted data enters** — a request body, a database row, a
   `JSON.parse`, a library return value, an `as`.
2. **Put a real runtime check there**, once, and give the checked value a type.
3. **Trust the type everywhere inside.** The holes are almost all at boundaries;
   code that only sees already-validated data meets very few of them.

🔴 **The single most useful consequence of this page:** the answer to "the types
lied to me" is nearly never "add another type". It is "the value entered here
without being checked, and here is where the check belongs".

## Gotchas

**Symptom:** a value typed `string` is `undefined` at runtime and nothing was
asserted.
**Cause:** index access, almost certainly — `arr[i]` or `record[key]`.
**Fix:** `noUncheckedIndexedAccess`. This one is a default, not a permanent hole.

**Symptom:** "TypeScript is unsound so types are pointless."
**Cause:** treating soundness as binary. TypeScript catches an enormous class of
errors and guarantees none of them absolutely.
**Fix:** the useful question is *where* it is unsound, which is a short and
learnable list, and every entry has a known mitigation.

**Symptom:** a team decides to fix soundness by banning `any` and `as`
completely.
**Cause:** treating the opt-in holes as the whole problem.
**Fix:** worth doing, but it closes three of seven. Mutation through an alias and
`Object.keys` remain, and they are the two nobody opted into.

**Symptom:** a hole was "discovered" and reported to the TypeScript repo.
**Cause:** confusing a deliberate hole with a compiler bug.
**Fix:** check this list first. The permanent ones have been intentional since
the design goals were written, and most have long-closed issues explaining why.

**Symptom:** the codebase has runtime validation everywhere and it is still
wrong.
**Cause:** validation on the inside rather than at the edge, so untrusted data is
already several frames deep when it is checked.
**Fix:** validate where data **enters**, once, and type the result. Scattered
internal checks are the symptom of not having done that.

## Interview questions

**What does it mean that TypeScript is unsound?**
That a value typed `T` is not guaranteed to be a `T` at runtime. `arr[5]` on a
three-element array is typed `string` and evaluates to `undefined`, with no
error. It is not a bug: the Design Goals list applying a sound type system as an
explicit **non-goal**, in favour of a balance between correctness and
productivity.

**Is that a criticism of the language?**
Not by itself. Soundness would require either rejecting a great deal of ordinary
JavaScript or adding machinery — immutable collections, variance annotations —
that costs more than the bugs it prevents in a language designed to type existing
code. The useful question is not whether TypeScript is unsound but exactly where,
because that list is short and each entry has a known mitigation.

**Which of the holes can you close with a compiler flag?**
Two of the seven. Index access is closed by `noUncheckedIndexedAccess`, and the
object-spread-over-optionals hole by `exactOptionalPropertyTypes`. Three more —
`any`, assertions, and the non-null `!` — are things you opt into by writing them,
so the mitigation is discipline rather than configuration. That leaves
`Object.keys` returning `string[]` and mutation through an alias as the two you
neither chose nor can configure away.

**How should the list change how you write code?**
It tells you where a type is a claim rather than a fact, and those places are
almost all boundaries — request bodies, database rows, `JSON.parse`, library
returns, `as`. The response is to put one real runtime check at each entry point
and type the checked value, rather than adding more types on the inside. "The
types lied to me" is nearly always "this value entered without being checked".

**What is the difference between a deliberate hole and a compiler bug?**
A bug means the checker is wrong about its own rules and will be fixed. A
deliberate hole means the rules themselves permit an unsafe program, and it will
not be fixed because doing so is not a goal. Reporting the second as the first is
common; the permanent holes have long-standing issues explaining the decision.

---

← [Topic index](./README.md) · Next → [02 · The holes you opt into](./02-the-holes-you-opt-into.md)
