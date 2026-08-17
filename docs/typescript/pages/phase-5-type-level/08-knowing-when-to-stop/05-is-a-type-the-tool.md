---
title: "Is a type the tool?"
sidebar_label: "05 · Is a type the tool?"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. `TS2589` and `TS7056` are from the **compiler's own diagnostic
> table** (**TypeScript 5.9.3**, `sandbox/ts-p0`) and confirmed present in **7.0.2**;
> their exact wording is quoted. **No sandbox, no console block.** 🔴 **The rest is
> judgement** — this corpus's review procedure, not a language rule.

[Chunk 04](./04-the-stopping-tests.md) asked whether a type is good. These three
tests ask a different and more uncomfortable question: **whether the job belongs to
the type system at all.** A type that passes all four earlier tests can still be the
wrong instrument.

## Test 5 · Would a runtime check be the honest answer?

**Types describe data you already have. They cannot check data arriving from
outside.**

A computed type over a shape parsed from JSON, read from `process.env`, or returned by
`fetch` asserts something nobody verified. The type-level machinery makes the lie
*precise*, which is worse than leaving it obvious:

```ts
// elaborate, and completely unverified
const cfg = JSON.parse(raw) as DeepReadonly<ExpectedConfig>;

// honest — and the compiler is on your side for everything downstream
const cfg = parseConfig(JSON.parse(raw));      // throws on bad input
//    ^? Config
```

At a boundary the tool is a validator with an assertion signature or a type predicate —
[phase 2 · assertion functions](../../phase-2-narrowing/09-assertion-functions/README.md)
and [type guards](../../phase-2-narrowing/07-type-guards.md) — not a cleverer type.

🔴 **The strongest form of this test:** if the type would be *wrong* exactly when the
data is wrong, and nothing checks the data, the type is decoration. Validate the input
or delete the type.

📌 **The productive combination is both, in one direction.** Validate at the boundary,
then **derive your types from the validator** so there is one source of truth that is
checked at runtime and known at compile time. That is a legitimate and common use of
this phase's machinery — see [chunk 11](./11-the-cases-that-earn-it.md).

## Test 6 · Who maintains it when you are not here?

Three signals, all observable rather than hypothetical:

1. **Can a second person on the team change it?** If exactly one can, it is a single
   point of failure with no rotation.
2. **Is it the file people route around?** Watch for helpers added *next to* your type
   instead of changes made *to* it. That is the readability cost expressing itself as
   duplication, and duplication that avoids an abstraction is worse than no
   abstraction.
3. **Would you re-derive it or re-write it after a refactor?** If a change to the
   underlying model means starting over, the type was coupled to a shape you do not
   control.

📌 **This test has the longest feedback loop and the most authority.** The others
predict the cost; this one measures it. It is also the one you can only apply to types
that already exist, which is why the earlier tests matter.

⚠️ **"I will document it" is not a maintenance plan** unless the document says what the
type *does not* handle. Readers need the boundary of a helper far more than its
mechanism, and the boundary is the part authors leave out.

## Test 7 · Is a type the right *kind* of tool?

Four alternatives that are not types, each better than a type at the thing it does:

| What you want | The type-level attempt | The better tool |
|---|---|---|
| Forbid an import or a call | a branded phantom type | a **lint rule** |
| Keep types in step with a schema | a type-level parser | **code generation** from the schema |
| Assert a runtime invariant | a computed type plus `as` | a **validator** or assertion function |
| Document intent | an unreadable derived type | a **named type plus a comment** |

**Why each substitution wins:**

- **A lint rule says what it means at the line where it means it.** Bending the type
  system into a prohibition produces phantom brands whose failure is an assignability
  error about a property nobody wrote.
- **Code generation gives you readable declarations and no checker cost**, and it stays
  correct when the contract changes. A type-level parser for an external contract is the
  classic wrong tool: the contract already exists as a schema, and you have chosen to
  re-implement its parser in the slowest language available.
- **A validator runs.** That is the entire argument — test 5.
- **A comment is read by the person who is stuck**, which no type is.

⚠️ **The tell for this test:** you are writing a type whose purpose is to *forbid*
rather than to *describe*. Types are descriptions of values; "you may not do this" is
a lint rule's sentence, not a type's.

## The ratchet, and why these tests apply per-change

Type-level code does not arrive complicated. **It accretes**, and every individual step
is defensible:

1. A conditional with two branches. Fine.
2. A third case. One line.
3. A nested conditional for a sub-case. Still readable.
4. Recursion, because one field is nested. Now it needs a depth cap.
5. `TS2589` — *"Type instantiation is excessively deep and possibly infinite."*
6. Someone adds `// @ts-ignore` at the one call site that breaks.

**No step in that list is the wrong decision; the total is.** So the tests apply to each
*change*, not to the type's birth — and they are only cheap to apply at step 2 or 3,
before anything depends on the shape.

🔴 **Three signals that the ratchet has already won:**

> **`TS2589`: Type instantiation is excessively deep and possibly infinite.**
>
> **`TS7056`: The inferred type of this node exceeds the maximum length the compiler
> will serialize. An explicit type annotation is needed.**

and a **suppression comment added because of your type**. The first two are the
compiler declining to finish; the third is a colleague telling you the same thing in a
language the build does not check. Suppression policy belongs to
[phase 10 · chunk 08](../../phase-10-strictness/08-suppression-directives/README.md);
the *cause* belongs here.

⚠️ **`TS7056` deserves special attention because its fix looks like a defeat and is
not.** *"An explicit type annotation is needed"* is the compiler asking you to write the
type you were deriving. Writing it is usually the right call — it is faster to check,
readable in errors, and stable across refactors. The derived version's only advantage
was that nobody had to maintain it, and the compiler has just told you that advantage
has a price.

## The procedure, condensed

Judgement, and this corpus's review order — tests 1–4 from
[chunk 04](./04-the-stopping-tests.md), 5–7 from here:

1. Explain it in sixty seconds, or name the steps and try again.
2. Closed input set? Write the types out.
3. Name the bug it prevents. No name, no type.
4. Break it on purpose and check *where* the error lands.
5. Data from outside? Validate, do not compute.
6. Ask whether a second person could change it.
7. Ask whether a lint rule, a generator or a comment is the real tool.
8. **Re-run 1–4 on the next change, not just this one.**

Step 8 is the one that prevents the ratchet, and it is the only step that costs nothing
to remember and everything to forget.

## Gotchas

**Symptom:** A derived type over API data is precisely wrong the moment the API
changes.
**Cause:** Test 5 — the type asserted a shape nobody validated.
**Fix:** Validate at the boundary and derive from the validator's output type, so one
source of truth is both checked at runtime and known at compile time.

**Symptom:** `as` appears next to your elaborate type at every call site.
**Cause:** The type describes what you wish the data were; the assertions are callers
telling you it is not.
**Fix:** Each `as` is a bug report. Move the check to runtime.

**Symptom:** Everyone writes new helpers beside the type instead of extending it.
**Cause:** Test 6, signal 2 — the maintenance cost showing up as duplication.
**Fix:** Treat it as a delete signal, not a discipline problem.

**Symptom:** The type's documentation explains the mechanism and nobody's question is
answered by it.
**Cause:** It documents how, not what it does not handle.
**Fix:** Document the boundary — the inputs it rejects and the cases it does not cover.

**Symptom:** A phantom-branded type is enforcing "don't call this from the UI layer".
**Cause:** Test 7 — a prohibition expressed as a description.
**Fix:** A lint rule. It reports at the offending import, in a sentence, with no type
machinery.

**Symptom:** A hand-rolled type-level parser for an OpenAPI or SQL schema keeps
breaking.
**Cause:** You re-implemented a parser in the type system for a contract that already
has one.
**Fix:** Generate the declarations. Readable output, real error messages, no checker
cost, and it tracks the contract.

**Symptom:** `TS7056` — an explicit annotation is demanded.
**Cause:** The inferred type is too large to serialise into a declaration.
**Fix:** Write the annotation. That is not a defeat; it is faster to check, better in
errors and stable across refactors.

**Symptom:** `TS2589` arrived and the fix was a `@ts-ignore`.
**Cause:** Step 6 of the ratchet — the cheapest escape from a type that has outgrown
its usefulness.
**Fix:** Reopen tests 2 and 3. The suppression is evidence the answer changed a while
ago.

**Symptom:** Every test passes, the type is disliked anyway, and no one can say why.
**Cause:** Often the boundary problem in disguise: the type is fine and the *layer* is
wrong.
**Fix:** Ask where the value comes from. A perfect type on unvalidated input is
test 5's failure wearing test 1's clothes.

## Interview questions

**★ Why can't a computed type validate data from outside the program?**
Because types describe data the program already has and are erased before anything
runs. A derived type over a `JSON.parse` result or a `fetch` response asserts a shape
nobody checked — and the elaborate version makes that assertion *precise* rather than
*obvious*, which is worse. The tool at a boundary is a validator with an assertion
signature or a type predicate; then you derive from **its** output type, so one source
of truth is checked at runtime and known at compile time.

**★ What is the ratchet, and why does it mean the tests are applied per-change?**
Type-level code accretes: two branches, a third, a nested case, recursion, a depth cap,
`TS2589`, and finally a `@ts-ignore` at the one call site that broke. Every individual
step is defensible and the total is not. So the decision points are the *changes*, not
the type's creation — and they are only cheap at step two or three, before other code
depends on the shape.

**★ Name a case where a lint rule beats a type, and say why.**
Anything you want to *forbid* rather than *describe* — do not import this module from
that layer, do not call this function outside the repository layer. A type can be bent
into it with phantom brands, but the failure is then an assignability error about a
property nobody wrote, at a line that is not the import. A lint rule reports the exact
line with a sentence a human wrote. Types are descriptions of values; prohibitions are
somebody else's job.

**★ `TS7056` says an explicit annotation is needed. Is that a defeat?**
No — it is the compiler asking you to write the type you were deriving, because the
inferred one is too large to serialise. Writing it is usually the better design: it
checks faster, prints readably in errors, and survives refactors. The derived version's
only real advantage was that nobody had to maintain it, and `TS7056` is the invoice for
that convenience.

**How do you tell that a type is doing a code generator's job?**
The type parses or mirrors an external contract — an OpenAPI document, a SQL schema, a
`.graphql` file — that already has a machine-readable definition. Generating
declarations from that definition gives readable types, real error messages, zero
checker cost, and automatic tracking when the contract changes. A type-level parser
gives you the opposite of all four, and it breaks in a language with no debugger.

**What are the observable signals in the maintainer test?**
Whether a second person can change it; whether people add helpers *next to* it instead
of modifying it; and whether a refactor of the underlying model would mean re-writing
it from scratch. The second is the strongest, because it arrives unprompted — duplication
that avoids your abstraction is a review comment nobody had to write.

**A colleague's helper is elaborate but every call site has an `as` next to it. What is
your read?**
That the type describes what they wish the data were, and the assertions are callers
telling them it is not. Each `as` is a bug report against the type. The fix is a runtime
check at the boundary, after which the assertions disappear because the compiler
genuinely knows the shape rather than being told.

**Which single step of the condensed procedure prevents the most damage?**
Step 8 — re-running the tests on the *next* change. Everything about type-level code
that goes wrong goes wrong incrementally, and each increment is individually
defensible. Re-asking "is the input set still closed?" and "where does the failure land
now?" at every edit is what stops a two-branch conditional from becoming a `TS2589`
with a suppression comment.

---

← Prev: [04 · Four tests before you keep it](./04-the-stopping-tests.md) ·
[Topic index](./README.md) · Next → [06 · What to write instead](./06-what-to-write-instead.md)
