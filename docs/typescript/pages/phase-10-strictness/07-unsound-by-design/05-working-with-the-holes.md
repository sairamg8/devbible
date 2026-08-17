---
title: "Working with the holes"
sidebar_label: "05 · Working with the holes"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript Design Goals** (*Non-goals*) for the
> position this page argues from, and the **`tsconfig` reference** for the two
> flags that close two of the seven holes. Everything else on this page is a
> summary of the four chunks before it and introduces no new claim.
> **No sandbox, no console block.**

The list is only useful if it changes what you write. This chunk is the
conversion: seven holes into one working practice.

## The seven, and the honest mitigation for each

| # | Hole | Mitigation | Costs |
|---|---|---|---|
| 1 | [`any`](./02-the-holes-you-opt-into.md) | `unknown` plus a narrowing step; `no-unsafe-*` for inherited `any` | one check per boundary; the lint rules need type info |
| 2 | [Assertions `as`](./02-the-holes-you-opt-into.md) | `satisfies` for conformance claims; a type guard where a runtime check exists | almost nothing — most `as` uses are the wrong keyword |
| 3 | [Non-null `!`](./02-the-holes-you-opt-into.md) | a real check with a real error | one branch |
| 4 | [Index access](./03-the-holes-in-your-data.md) | `noUncheckedIndexedAccess` | a real migration; ⚠️ narrows, never closes |
| 5 | [Object spread over optionals](./03-the-holes-in-your-data.md) | `exactOptionalPropertyTypes`, or destructuring defaults | a real migration; defaults-by-destructuring is free |
| 6 | [`Object.keys` → `string[]`](./03-the-holes-in-your-data.md) | do not iterate keys — list the fields with `as const` | nothing, and the result is better code |
| 7 | [Mutation through an alias](./04-mutation-and-variance.md) | `readonly T[]` in parameters; return new objects | nothing |
| 8 | [Method bivariance](./04-mutation-and-variance.md) | declare callbacks as **properties**, not methods | nothing |

📌 **Five of the eight rows cost essentially nothing**, and two of those five —
`satisfies` instead of `as`, and property-syntax callbacks — make the code better
independently of soundness. The list is far less bleak than "TypeScript is
unsound" makes it sound.

## The one practice that covers most of it

Almost every hole above is reachable only when **unvalidated data crosses into
typed code**. So the general defence is not per-hole, it is architectural:

> **Validate at the edge, once, and type the result. Trust the type inside.**

The edges are countable and there are not many of them: a request body, a query
result, `JSON.parse`, `localStorage`, an environment variable, a message off a
queue, a third-party function's return value.

```ts
// the edge — one place, one check, one type produced
const body: unknown = await req.json();
const patch = UserPatch.parse(body);      // throws on anything unexpected

// everything inside — the type is now a fact, not a claim
applyPatch(user, patch);
```

🔴 **The reason this works is that it converts a claim into a fact at a known
line.** An `as` says "trust me" with nothing behind it; a parser says the same
thing with a runtime check behind it. **They produce the same type — the
difference is entirely whether anything verified it.**

Two boundary cases already have their own topic and are the worked examples:
[phase 7 · Typing `process.env`](../../phase-7-server/03-typing-process-env/README.md)
argues parsing over augmenting, and
[phase 7 · `catch (e: unknown)`](../../phase-7-server/04-catch-e-unknown/README.md)
does the same for the thrown value.

## What this does *not* cover

Be precise, because "validate at the edge" is sometimes offered as a complete
answer and it is not:

- **Mutation through an alias** happens entirely inside validated code. No
  boundary check helps; `readonly` parameters do.
- **Method bivariance** is a declaration-site issue, not a data issue. No amount
  of validation reaches it.
- **Index access** survives validation — a validated array is still an array, and
  `xs[5]` is still optimistic.

⚠️ **So there are three holes that live entirely inside your own well-typed
code**, and they are the three with the cheapest mitigations. That asymmetry is
convenient and worth stating: the expensive defence (validation) covers the
boundary holes, and the free defences (`readonly`, property-syntax callbacks,
`noUncheckedIndexedAccess`) cover the interior ones.

## A review checklist

Six questions, each mapping to a hole, none requiring the reviewer to remember
this page:

1. **Is there an `as`, `!` or `any` in this diff?** If yes — what runtime check
   sits directly above it? If none, that is the comment to leave.
2. **Is there an `as unknown as`?** That is a different construct and needs a
   written justification.
3. **Does a function take `T[]` and not write to it?** Then it should take
   `readonly T[]`.
4. **Is a callback declared with method syntax?** If it is a callback rather than
   a method, property syntax gets it checked.
5. **Does this iterate `Object.keys`?** Could the field list be written out
   instead?
6. **Does new data enter here?** Then there is exactly one right place for a
   check, and it is this line.

📌 **Questions 3 and 4 are the ones nobody asks**, and they are the two holes
nobody opts into. Adding them to a review habit is the highest-value change on
this page.

## The position to hold

Being fair to the language, and to the people who ask about this in interviews:

- **Unsound is not unsafe in practice.** TypeScript eliminates a very large class
  of errors and guarantees none of them absolutely. Those are compatible
  statements, and treating the second as a refutation of the first is the common
  error.
- **The holes are documented, stable and few.** Seven, of which three are things
  you write and two are switched off by a flag. That is a learnable list, unlike
  "be careful".
- **A sound TypeScript would not be TypeScript.** It could not type the standard
  library's array methods, could not accept ordinary structural assignments, and
  could not describe the JavaScript it exists to describe. The trade was made
  deliberately, has held for over a decade, and produced the most widely-adopted
  gradual type system there is.

🔴 **The one thing to actually change:** stop reading a type as a guarantee and
start reading it as a claim with a known provenance. A type that came from a
literal or a parser is a fact. A type that came from an `as`, an index, an
alias, or a method-syntax callback is a claim — and this list is exactly the set
of places to check which one you are holding.

## Gotchas

**Symptom:** validation is everywhere and bugs persist.
**Cause:** validating on the inside rather than at the edge, so untrusted data is
already several frames deep.
**Fix:** one check where data enters, producing a type. Internal checks are a
symptom of not having one.

**Symptom:** a parser is used at the edge and an `as` still appears right after.
**Cause:** the parser's output type and the domain type differ, and the gap was
asserted rather than mapped.
**Fix:** derive the domain type from the schema, or write an explicit mapping
function that the compiler checks.

**Symptom:** the team adopted `readonly` parameters and nothing changed.
**Cause:** `readonly` on *properties* is aliasable; only `readonly T[]` is
enforced at the boundary.
**Fix:** know which of the two you applied.

**Symptom:** "we banned `any`, so we are safe."
**Cause:** three of eight holes closed, and not the two that nobody opts into.
**Fix:** add review questions 3 and 4. They cost nothing and cover the
unopted-into pair.

**Symptom:** a runtime failure on a line where every type is right.
**Cause:** the signature of this list — the mistake was made through an alias or a
bivariant method signature, elsewhere.
**Fix:** look for a second name for the object, or a callback that narrowed its
parameter.

## Interview questions

**How do you work safely in an unsound type system?**
Validate at the edge, once, and type the result — request bodies, query results,
`JSON.parse`, environment variables, third-party returns. That converts a claim
into a fact at a known line, and it covers every hole that involves untrusted
data entering. Then handle the three interior holes with free mitigations:
`readonly T[]` parameters, property-syntax callbacks, and
`noUncheckedIndexedAccess`.

**Which holes does boundary validation *not* cover?**
Mutation through an alias, method bivariance, and index access. All three occur
inside already-validated code. Conveniently, all three have essentially free
mitigations, so the expensive defence covers the boundary and the cheap defences
cover the interior.

**What is the difference between an `as` and a parser, given both produce the
same type?**
Whether anything verified it. Both hand you a value of type `T`; the assertion is
erased and checks nothing, the parser runs at runtime and throws on anything
unexpected. The type is identical and its provenance is not, which is the whole
distinction this topic is about.

**Two review questions on this page catch the holes nobody opts into. What are
they?**
"Does this function take `T[]` without writing to it?" — it should take
`readonly T[]`, which closes array covariance at the boundary. And "is this
callback declared with method syntax?" — property syntax gets it checked by
`strictFunctionTypes`, method syntax stays bivariant. Both cost nothing and
neither is a habit most teams have.

**Someone says types are pointless because TypeScript is unsound. What is the
response?**
That soundness is not binary and the useful question is *where*. The list is
seven items, three of which are things you write and can grep for, two of which
are switched off by a flag. A sound TypeScript could not type the standard
library's array methods or accept ordinary structural assignments — it would not
be able to describe the JavaScript it exists to describe.

**What should change about how you read a type after learning this list?**
Read it as a claim with a provenance rather than a guarantee. A type from a
literal or a parser is a fact; a type from an `as`, an index access, an alias, or
a method-syntax callback is a claim. The list is precisely the set of places
where you need to know which one you are holding.

---

← [04 · Mutation and variance](./04-mutation-and-variance.md) · [Topic index](./README.md) · Next → [08 · `@ts-expect-error` vs `@ts-ignore` vs `@ts-nocheck`](../08-suppression-directives/README.md)
