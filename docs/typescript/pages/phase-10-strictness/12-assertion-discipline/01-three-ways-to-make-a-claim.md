---
title: "Three ways to make a claim, and how much each is checked"
sidebar_label: "01 · Three ways to make a claim"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.9.3 diagnostic table read from disk**
> (`sandbox/ts-p0`) — `TS2352`, `TS1360`, `TS8013`, `TS8016`, `TS8037` and the
> quick-fix text `TS9035` are quoted **verbatim** below — and against the
> **TypeScript handbook** for type assertions, `satisfies` (4.9) and the non-null
> assertion operator. **No sandbox run, no console block.**

TypeScript gives you three ways to tell the compiler something it could not work
out for itself. They look similar in a diff and **the compiler treats them
completely differently.** Knowing which is which is most of assertion discipline.

## 🔴 The three, ranked by how much the compiler checks

| You write | What it means | What the compiler does |
|---|---|---|
| `x satisfies T` | *"check that this matches `T`"* | ✅ **verifies it** — `TS1360` if it does not, and the value keeps its narrow type |
| `x as T` | *"treat this as `T`"* | ⚠️ **accepts it** unless the two types barely overlap — `TS2352` |
| `x!` | *"this is not null or undefined"* | 🔴 **nothing. Ever.** |

That last row is the finding this whole topic rests on, so it is worth showing the
evidence rather than asserting it.

## 🔴 The compiler has no opinion about `!`

Searching 5.9.3's diagnostic table for messages mentioning non-null assertions
returns **exactly one code**, and it is not a check on the assertion:

> `TS8013` · *"Non-null assertions can only be used in TypeScript files."*

That is a statement about **file extensions** — the same shape as its neighbours
`TS8016` *"Type assertion expressions can only be used in TypeScript files."* and
`TS8037` *"Type satisfaction expressions can only be used in TypeScript files."*

**There is no diagnostic anywhere that questions whether a `!` is justified**, and
there cannot be one
([Phase 2 · 13](../../phase-2-narrowing/13-non-null-assertion.md) covers what `!`
does and where it silently does nothing): `!` means *stop applying strict null checking to this
expression*, so a check on it would be a check on the feature working.

📌 **Compare `as`, which at least has a floor.** `TS2352` exists and can refuse an
assertion. `!` has no equivalent — no threshold, no overlap requirement, nothing.
🔴 **So `!` is the strongest claim in the language and the only one the compiler
never pushes back on**, which is precisely backwards from how the two are treated
in review, where `as SomeType` draws comment and a single `!` does not.

## What `as` actually gets you, and where its floor is

Verbatim, and note that the message **quotes its own escape hatch**:

> `TS2352` · *"Conversion of type '{0}' to type '{1}' may be a mistake because
> neither type sufficiently overlaps with the other. If this was intentional,
> convert the expression to 'unknown' first."*

Three things follow, and each one matters more than it looks:

1. ⚠️ **The check is "sufficient overlap", not correctness.** `as` being accepted
   is **not** evidence the assertion is true — only that the two types are related
   enough for the compiler to decline the argument. Most wrong assertions are
   between related types, which is exactly the region `TS2352` does not police.
2. 🔴 **`x as unknown as T` is not a hack someone invented — the compiler names
   it.** ([Phase 2 · 08](../../phase-2-narrowing/08-as-assertions/README.md) covers
   the mechanism; what matters here is what it tells you about the diff.) That is worth knowing both ways round: it is sanctioned, and it is the
   documented way to defeat the only check `as` has. **A double assertion in a diff
   means someone was told "these types do not overlap" and proceeded anyway.**
3. **`as` has no runtime effect at all.** It is erased with the rest of the type
   syntax, so it changes what the compiler believes and nothing else. A value that
   was the wrong shape before the assertion is the wrong shape after it.

## `satisfies` is the one that checks

> `TS1360` · *"Type '{0}' does not satisfy the expected type '{1}'."*

`satisfies` ([Phase 2 · 10](../../phase-2-narrowing/10-satisfies/README.md) has it in
full) verifies the value against `T` **and leaves the value's own narrow type in
place** — which is why it is the right default for configuration objects and
lookup tables, where an annotation would widen away the literal types you wanted.
[Topic 09](../09-excess-property-checks/README.md) makes the same argument from the
freshness side: an annotation restores excess property checking *and* widens;
`satisfies` restores it without widening.

📌 **The compiler recommends composing the two.** Its own quick-fix text for
`isolatedDeclarations` reads:

> `TS9035` · *"Add satisfies and a type assertion to this expression
> (satisfies T as T) to make the type explicit."*

**`x satisfies T as T` is a checked claim followed by a widening** — you get the
verification, then deliberately opt into the wider type. Where you genuinely need
the annotation's type, that is strictly better than `as T` alone, because the `as`
can no longer be wrong about something `satisfies` would have caught.

## The rule this gives you

> 🔴 **Prefer the strongest check that does the job: `satisfies` if you can,
> annotation if you must, `as` only when you know something the compiler cannot,
> and `!` almost never.**

⚠️ **And notice the ordering is the reverse of the effort involved.** `!` is one
character and the least defensible; `satisfies` is a word and the most. The cheapest
thing to type is the thing with no oversight at all, which is the whole reason
assertion discipline has to be a policy rather than a preference.

## Gotchas

**Symptom:** an `as` was accepted, so it is assumed to be safe.
**Cause:** `TS2352` only fires when the types barely overlap.
**Fix:** 🔴 read acceptance as "the compiler declined to argue", not as
verification. Most wrong assertions are between *related* types and no check
applies to them.

**Symptom:** `as unknown as T` appears in a diff.
**Cause:** somebody hit `TS2352` and followed the message's own suggestion.
**Fix:** treat it as the loudest possible signal — the compiler explicitly said
these types do not overlap. It is occasionally right (a test double, a controlled
cast at a boundary) and usually a design problem.

**Symptom:** a `!` is added to silence `TS18048` and nobody comments on it in
review.
**Cause:** it is one character and looks like punctuation.
**Fix:** 🔴 it is the strongest claim in the language with the least oversight.
Count `!` at least as carefully as `as` — the compiler will never help you here.

**Symptom:** `satisfies` is used and the value's type comes out wider than expected.
**Cause:** an annotation was left on the declaration as well, and it widens.
**Fix:** drop the annotation. `satisfies` alone checks without widening; that is the
entire reason to prefer it.

**Symptom:** an assertion "fixed" a bug and the bug came back at runtime.
**Cause:** `as` is erased — it changes what the compiler believes, not what the
value is.
**Fix:** validate. An assertion is a claim *about* data; it is never a check *of*
data.

**Symptom:** `as` or `!` reported as an error in a `.js` file.
**Cause:** `TS8016` / `TS8013` — both are TypeScript-only syntax.
**Fix:** in a checked `.js` file, use a JSDoc cast. 📌 Worth noticing that these
two codes are the *only* thing the table says about `!`.

## Interview questions

**What is the difference between `as T` and `satisfies T`?**
`as` asserts — it tells the compiler to treat the expression as `T` and is accepted
unless the two types barely overlap. `satisfies` verifies — it checks the value
against `T`, reports `TS1360` if it fails, and leaves the value's own narrower type
in place. So `satisfies` is a check and `as` is a claim, and where both would work
`satisfies` is strictly better.

**How much does the compiler check an `as`?**
Only that the types "sufficiently overlap" — that is `TS2352`'s wording. It is a
floor, not a verification: an assertion between two related types is never
questioned, which is where nearly all wrong assertions live. And the message quotes
its own escape hatch, telling you to convert to `unknown` first, so even the floor
is one edit away from being removed.

**What does the compiler check about a non-null assertion?**
Nothing. Searching the 5.9.3 diagnostic table for non-null assertions returns a
single code, `TS8013`, which says they cannot be used in JavaScript files — a
statement about file extensions, not about the assertion. There is no threshold and
no overlap requirement, because `!` means "stop applying strict null checks here",
so a check on it would defeat the feature.

**Why is `x as unknown as T` significant when you see it?**
Because the compiler suggested it. `TS2352` says the types do not sufficiently
overlap and then tells you to convert to `unknown` first if the assertion was
intentional. So a double assertion means someone was told the types are unrelated
and proceeded — it is the single most informative pattern to grep for.

**Does an assertion do anything at runtime?**
No. It is erased along with the rest of the type syntax. It changes what the
compiler believes about a value, never the value itself, which is why an assertion
can never substitute for validation at a boundary.

**When is `satisfies T as T` the right thing to write?**
When you need the wider annotated type at the use site but still want the value
checked against it. The `satisfies` verifies the claim and the `as` then widens
deliberately, so the assertion cannot be wrong about anything `satisfies` would have
caught. The compiler suggests exactly this composition in its own quick-fix text for
`isolatedDeclarations`.

**Which is worse in review, an `as` or a `!`?**
`!` — which is the opposite of how they are usually treated. `as` has a floor the
compiler can refuse at; `!` has none at all, and it is one character, so it attracts
no attention. Any policy that counts assertions must count both, and the `!` count
is the one likely to be underestimated.

---

[Topic index](./README.md) · Next → **02 · What an `as` is standing in for** *(not written yet)*
