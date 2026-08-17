---
title: "Reading a TypeScript error"
sidebar_label: "04 · Reading an error"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. Every diagnostic quoted here — `TS2322`, `TS2345`, `TS2326`,
> `TS2200`, `TS2769`, `TS2739`, `TS2741`, `TS2353`, `TS2559`, `TS2571`, `TS2589`
> — and its exact `{0}` message text was read out of the **compiler's own
> numbered diagnostic table** (**TypeScript 5.9.3**) rather than recalled.
> `--noErrorTruncation` is from the **`tsconfig` reference**. **No sandbox, no
> console block** — the error shapes below are assembled from the quoted message
> templates, not pasted from a run, and are labelled as such.

The only Master row in this phase with no flag attached, because it is a
**skill** rather than a setting — and the one that decides whether the other
twelve are usable. A team that cannot read a 40-line assignability error will
turn the flags back off.

> **A TypeScript error is not a paragraph. It is a stack**, printed
> outermost-first: the claim you made, then the reason, then the reason for the
> reason. **The answer is almost always the innermost line, and the path that
> leads to it.**

## The shape

Errors nest through two connector messages, both read from the diagnostic table:

| Code | Template |
|---|---|
| `TS2326` | `Types of property '{0}' are incompatible.` |
| `TS2200` | `The types of '{0}' are incompatible between these types.` |

So a real error assembles like this — **structure illustrated from the message
templates above, not a transcript**:

```text
Type 'ApiUser' is not assignable to type 'User'.            ← the claim
  Types of property 'address' are incompatible.             ← narrowing
    Types of property 'postcode' are incompatible.          ← narrowing
      Type 'number' is not assignable to type 'string'.     ← THE ANSWER
```

**Read it bottom-up.** The first line tells you *what you were doing*; the last
tells you *what is wrong*. Everything between is a breadcrumb trail — and the
trail itself is the second most useful thing on the page, because
`address.postcode` is exactly where to look.

📌 **The two-step method, and it works on almost every error:**
> **1. Jump to the last line.** That is the concrete mismatch.
> **2. Read the property names on the way down.** That is the location.

The outer line is the one people fixate on, and it is the least informative — it
restates the assignment you already know you wrote.

## Assignment or argument?

Two codes carry almost the same message and mean different things:

| Code | Template | Means |
|---|---|---|
| `TS2322` | `Type '{0}' is not assignable to type '{1}'.` | an **assignment** — variable, property, return |
| `TS2345` | `Argument of type '{0}' is not assignable to parameter of type '{1}'.` | a **call** |

Worth distinguishing on sight because the fix lives in a different place: for
`TS2322` you look at the declaration; for `TS2345` you look at the function's
signature, which may not be in the file you are staring at.

## Missing-property errors say which

Three codes, increasingly specific, and each tells you how much is wrong:

| Code | Template |
|---|---|
| `TS2741` | `Property '{0}' is missing in type '{1}' but required in type '{2}'.` |
| `TS2739` | `Type '{0}' is missing the following properties from type '{1}': {2}` |
| `TS2559` | `Type '{0}' has no properties in common with type '{1}'.` |

`TS2741` is one missing property — usually a rename or an optional you forgot.
`TS2739` lists several — usually you passed the wrong object entirely.
**`TS2559` means nothing matched**, which almost always means you passed a value
of a completely unrelated type, or the argument order is wrong.

⚠️ `TS2353` — `Object literal may only specify known properties, and '{0}' does not exist in type '{1}'` — is **not** a missing-property error, it is an excess
one, and it fires only for object *literals*. Why an identically-shaped variable
is accepted where a literal is rejected is [topic 09](./README.md)'s subject.

## 🔴 Overload errors, and why they are the worst

```text
error TS2769: No overload matches this call.
```

Then, typically, one block per overload, each explaining why *that* one did not
match — which is how a single wrong argument becomes forty lines.

**The method:**

1. **Count your arguments**, and find the overload with that arity. The others
   are noise; they failed on argument count, not on your actual mistake.
2. **Read the last overload's block if you cannot tell.** The compiler reports
   the last one it tried in most cases, and its message is usually the closest
   to your intent.
3. **Then apply the two-step method** to that block alone.

📌 If a call genuinely matches no overload's arity, the fix is arity, and none of
the type detail matters. That check takes two seconds and saves reading the wall.

## When the error is not where the bug is

Three situations worth recognising, because in each the reported line is a
symptom:

**Contextual typing moves it to the call site.** An arrow function passed inline
gets its parameter types from the parameter it is assigned to, so a mistake
*inside* the callback surfaces as a failure of the whole call.
→ Extract the callback into a named `const` with an explicit type. The error
moves to where the mistake is.

**Inference widens at the declaration, fails at the use.** A `const` inferred as
`string` breaks three functions later when something needs a literal.
→ `as const`, or annotate at the declaration.

**Unions report against the whole union.** `Type 'X' is not assignable to type
'A | B'` means it failed against *both*, and the nested detail usually only
explains one.
→ Assign to each member in turn, or use a discriminant so the compiler can pick
a branch.

## Three techniques that make errors readable

**1. Extract the expression into a named `const`.** Established in
[topic 01 chunk 02](./01-strict-flag-by-flag/02-strictnullchecks.md): the
compiler reports `TS18048` (`'{0}' is possibly 'undefined'`) when it has a name
and `TS2532` (*"Object is possibly 'undefined'"*) when it does not. **Naming a
subexpression is the cheapest error-quality improvement available**, and it works
for far more than nullability.

**2. Turn truncation off.** Long types print with `...` in the middle. If the
answer is inside the elision:

```json
{ "compilerOptions": { "noErrorTruncation": true } }
```

Do it temporarily. Left on, it makes every error worse.

**3. Use `satisfies` to localise.** An annotation replaces the type and reports
at the declaration; `satisfies` checks and leaves inference alone, so the error
lands on the offending property rather than on the whole object
([phase 2 · `satisfies`](../phase-2-narrowing/10-satisfies/README.md)).

## Two errors that mean something structural

**`TS2571`** — *"Object is of type 'unknown'."* Not a failure. It is the type
system doing its job at a boundary; narrow it
([phase 2](../phase-2-narrowing/12-unknown-in-catch.md)).

**`TS2589`** — *"Type instantiation is excessively deep and possibly infinite."*
A recursion limit, not a mistake in the value. Phase 1 measured where it fires.
The fix is a shallower type, never a cast.

## Gotchas

**Symptom:** a 40-line error and no idea where to start.
**Cause:** reading top-down.
**Fix:** last line first, then the property path. The first line restates what
you already know.

**Symptom:** the error names a type you have never heard of.
**Cause:** an inferred or library-internal type appearing mid-chain.
**Fix:** ignore it and keep going down; the innermost mismatch is usually
between two types you *do* recognise.

**Symptom:** `TS2769` with forty lines about overloads that obviously do not
apply.
**Cause:** the compiler reports every overload it tried.
**Fix:** match on arity first, then read only that block.

**Symptom:** the error points at a line that is plainly correct.
**Cause:** contextual typing — the mistake is inside an inline callback, reported
at the call.
**Fix:** extract the callback to a typed `const`.

**Symptom:** the crucial type is replaced by `...`.
**Cause:** error truncation.
**Fix:** `noErrorTruncation: true`, temporarily.

**Symptom:** an error mentions a property that does not exist in either type.
**Cause:** `TS2353` — an excess-property check on an object literal, not a
mismatch. Often a typo in a property name.
**Fix:** check the spelling before checking the types.

## Interview questions

**How do you read a long assignability error?**
Bottom-up. The last line is the concrete mismatch; the `Types of property` lines
above it spell out the path to the offending field; the
first line just restates the assignment. Two steps: jump to the end, then read
the property names on the way down.

**What is the difference between `TS2322` and `TS2345`?**
`TS2322` is an assignment — a variable, property or return position. `TS2345` is
an argument at a call site. They matter differently because the fix is in a
different place: a declaration versus a function signature that may live in
another file.

**Why are overload errors so long, and how do you handle them?**
`TS2769` reports why *each* overload failed, so one wrong argument produces a
block per candidate. Match your argument count against the overloads first —
most of the blocks failed on arity and are irrelevant — then apply the normal
reading method to the one remaining candidate.

**Give a cheap way to make an error more informative.**
Extract the offending subexpression into a named `const`. The compiler has a name
to report, so `TS2532` ("Object is possibly 'undefined'") becomes `TS18048`
("'x' is possibly 'undefined'"). The same trick moves contextual-typing errors
out of a call site and onto the callback where the mistake actually is.

---

← [Phase 10 index](./README.md) · Next → [05 · `exactOptionalPropertyTypes`](./05-exactoptionalpropertytypes/README.md)
