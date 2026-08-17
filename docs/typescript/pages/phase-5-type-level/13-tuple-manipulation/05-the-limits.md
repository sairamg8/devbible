---
title: "The limits"
sidebar_label: "05 · The limits"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. The three ceilings and the instantiation budget are
> [topic 11 · chunk 01](../11-recursive-types/01-the-two-limits.md) and
> [chunk 04](../11-recursive-types/04-the-fine-print.md)'s reads of the **5.9.3** checker —
> `getConditionalType`'s `tailCount === 1e3`, `instantiationDepth === 100`, and
> `createNormalizedTupleType`'s `>= 1e4` guard. ⚠️ **Constants are 5.9.3's and are not
> claimed for the 7.0.2 Go port.** **No sandbox, no console block, no timings.**

Everything in this topic is bounded, and the bounds are not where people expect them. This
chunk is what stops a tuple type, in the order you will actually hit them.

## The three ceilings, applied to tuples

| Ceiling | What counts | Diagnostic | Reached by |
|---|---|---|---|
| **100** | instantiation depth | `TS2589` | a nested recursive walk — the call wrapped in anything |
| **1,000** | `tailCount` iterations | `TS2589` | a tail-recursive walk, one element per step |
| **10,000** | tuple **elements** | `TS2799` / `TS2800` | any spread, at any depth |

🔴 **For tuple work the third one is the interesting ceiling**, because it is the only one
that is about tuples rather than about recursion, and it is the only one no amount of
rewriting the recursion will move. It fires at the **spread**, in
`createNormalizedTupleType` — so a doubling accumulator reaches it in about fourteen steps
with essentially the whole iteration budget unspent
([topic 11 · chunk 04](../11-recursive-types/04-the-fine-print.md)).

⚠️ **The practical consequence is a rule of thumb worth stating plainly:** a tuple type is
for a *parameter list*, a *route segment list*, a *fixed record* — things whose length is a
small number a human wrote. It is not a data structure. `Range<10000>` is not a large
computation, it is a compile error.

## Recursion is the expensive way to do most of this

[Chunk 02](./02-variadic-tuple-types.md) made the positive case: if an operation can be a
spread, it should be. The negative case belongs here.

A recursive walk over a tuple costs **one instantiation per element, per use, per consuming
file, per keystroke** — the per-mapper cache is cleared when the mapper pops
([topic 09 · chunk 02](../09-type-level-performance/02-caching-and-naming.md)). So the same
`Reverse<T>` applied in twenty files is twenty walks, and an editor redoes them as you type.

That gives an ordering, cheapest first, for anything you are about to write recursively:

1. **Can it be a spread?** `Push`, `Unshift`, `Concat`, replace-at-a-known-position — all one
   step regardless of length.
2. **Can it be an indexed access?** A fixed position is `T[3]`, not `Head<Tail<Tail<Tail<T>>>>`.
3. **Can it be a homomorphic mapped type?** `{ [K in keyof T]: F<T[K]> }` maps every element
   without a recursion *and* preserves labels and element flags
   ([chunk 03](./03-labels-and-optionality.md)). This is the one people forget, and it covers
   most "apply something to every element" cases.
4. **Only then, recursion** — for filtering, for per-element conditionals, for anything whose
   result shape depends on the elements.

🔴 **Step 3 is the highest-value line in this chunk.** A large share of hand-written recursive
tuple walks are element-wise maps that a mapped type does in one step, correctly, with the
labels intact.

## The shapes that are the wrong tool

**A list whose length varies at runtime.** If the length is not known statically there is no
tuple type to compute over — `Length<string[]>` is `number`
([chunk 01](./01-the-accessors.md)), and every fixed-length pattern fails to match. The type
is `string[]` and that is correct.

**An overload set.** A tuple describes one parameter list
([chunk 04](./04-bind-and-curry.md)). No manipulation of it can represent several.

**A record with named fields.** If you are labelling every position and then looking things
up by name, the shape is an object. Tuples buy order and arity; objects buy names. Paying for
both by simulating one in the other is the trade
[topic 08 · chunk 06](../08-knowing-when-to-stop/06-what-to-write-instead.md) tells you to
refuse.

**Arithmetic.** Counter tuples make addition expressible
([topic 11 · chunk 02](../11-recursive-types/02-the-accumulator-pattern.md)), and the 10,000
ceiling makes them useless for real numbers. Type-level arithmetic beyond small bounded
counters is a demonstration, not a technique.

## When tuple manipulation earns it

All of these together:

- **the length is small and human-authored** — a parameter list, not a dataset;
- **the operation is structural** — a spread or a mapped type, not a recursive walk;
- **the result is consumed at a call site**, so its errors land where the mistake was
  ([chunk 04](./04-bind-and-curry.md)'s four error cases are the standard to meet);
- **the alternative is an overload pile** — which is the case the 4.0 notes opened with, and
  still the best reason to reach for any of this.

🔴 **The honest summary: variadic tuple types are excellent for parameter lists and poor for
everything else.** That is not a criticism — parameter lists are exactly what they were
designed for, and the release notes say so — but it is the line to hold, because the syntax
makes it look as though a tuple is a general list type and it is not.

## Gotchas

**Symptom:** `TS2799` — *"Type produces a tuple type that is too large to represent."*
**Cause:** A tuple reached 10,000 elements at a spread. Not a recursion limit.
**Fix:** Stop building the tuple. No depth cap or accumulator rewrite affects this ceiling.

**Symptom:** `TS2589` on a tuple walk over an ordinary-looking input.
**Cause:** The input is an array, not a tuple, so the recursion has no fixed length to
consume.
**Fix:** Guard for the array case — `number extends Length<T>` — and return early. A recursion
with no shrinking input does not terminate.

**Symptom:** A recursive element-wise transform is slow.
**Cause:** It is a mapped type written as a recursion.
**Fix:** `{ [K in keyof T]: F<T[K]> }`. One step, and it preserves labels and element flags
where the recursion loses them.

**Symptom:** A type that works in isolation fails once it is used in several files.
**Cause:** The instantiation cache is per active mapper, so the work repeats per consuming
file rather than being shared.
**Fix:** Resolve to a named alias at one boundary and export the result
([topic 09 · chunk 04](../09-type-level-performance/04-the-fixes-in-order.md)).

**Symptom:** Type-level arithmetic works for small numbers and dies at scale.
**Cause:** Counter tuples spend the 10,000-element budget one element per unit.
**Fix:** Accept the bound and keep it to small counters, or do the arithmetic at runtime. This
is not a limitation to engineer around.

**Symptom:** Every position in the tuple has a label and the code looks things up by name
anyway.
**Cause:** The shape is a record, being simulated with a tuple.
**Fix:** Use an object type. Order and arity are what a tuple buys; if you are not using them,
you are paying for nothing.

**Symptom:** The hover for a manipulated tuple is unreadable.
**Cause:** Structurally expanded types print in full, and are truncated at 160 characters
mid-structure.
**Fix:** Name the resolved type. The same fix as everywhere else in this phase, and the same
reason ([topic 08 · chunk 01](../08-knowing-when-to-stop/01-the-error-is-the-interface.md)).

**Symptom:** Adding one more element to a tuple type made the build noticeably slower.
**Cause:** A recursive walk is linear in the length and is redone per use — so the marginal
element is not marginal at all if the type is widely consumed.
**Fix:** Check whether the operation is really structural, and use step 1, 2 or 3 of the
ordering above.

## Interview questions

**★ What actually limits a tuple type?**
Three ceilings, only one of which is about tuples: 100 for nested recursion and 1,000 for tail
recursion, both reported as `TS2589`, and **10,000 elements** for the tuple itself, reported
as `TS2799` in type position or `TS2800` in expression position. The third fires at the
spread, so no rewriting of the recursion moves it — and a doubling accumulator reaches it in
about fourteen steps with the iteration budget almost untouched.

**★ Before writing a recursive tuple type, what should you check?**
Three cheaper things in order. Whether it is a spread — push, unshift, concat, replace at a
known position — which is one step regardless of length. Whether it is an indexed access,
because a fixed position is `T[3]` rather than a chain of accessors. And whether it is a
**homomorphic mapped type**, which applies something to every element in one step *and*
preserves labels and element flags. That third one covers most hand-written recursive walks
and is the one people forget.

**★ Why is a tuple type the wrong shape for a runtime-length list?**
Because there is nothing to compute over. `Length<string[]>` is `number`, not a literal, and
every fixed-length pattern fails to match — correctly, since the compiler genuinely does not
know the length. A recursion over such a type has no shrinking input and does not terminate;
the right type is the array.

**★ What is tuple manipulation genuinely good for?**
Parameter lists — which is what it was designed for, and what every example in the 4.0
release notes is about. The test is four clauses: the length is small and human-authored, the
operation is structural rather than a recursive walk, the result is consumed at a call site so
its errors land on the caller's mistake, and the alternative is an overload pile. That last
one is the case the notes opened with and still the strongest reason to use any of this.

**★ Why is type-level arithmetic with counter tuples a demonstration rather than a
technique?**
Because a counter tuple spends the 10,000-element budget at one element per unit, so anything
past small bounded counters is a compile error rather than a slow computation. Counters are
genuinely useful for depth caps and short ranges; they are not a numeric tower, and treating
them as one produces types that work in a blog post and fail on real inputs.

**Does making a tuple walk tail-recursive help?**
It raises the iteration ceiling from 100 to 1,000, which matters for string parsers and long
walks. It does nothing for the element cap, nothing for the per-use cost, and nothing for the
error messages — so it is the right fix for exactly one symptom, and reaching for it when the
problem is cost or readability is treating the wrong thing.

**Where does the cost of a tuple type actually land?**
Per use, per consuming file, per keystroke — the instantiation cache is per active mapper and
is cleared when the mapper pops. So a widely-imported recursive tuple type is re-walked
everywhere it is used, and a batch `tsc` run amortises what an editor pays continuously. The
fix is to resolve it once into a named alias and export that.

---

← [04 · `bind` and `curry`](./04-bind-and-curry.md) · [Topic index](./README.md) ·
[Phase 5 index](../README.md) · Next topic → **14 · `NoInfer<T>`** *(not written yet)*
