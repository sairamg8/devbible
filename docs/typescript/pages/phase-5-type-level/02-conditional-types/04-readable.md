---
title: "Keeping them readable"
sidebar_label: "04 · Keeping them readable"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Conditional Types*) and
> the compiler's own message table for `TS2589`, `TS2321` and `TS7056`, all three
> confirmed present in **TypeScript 7.0.2**. The formatting and naming
> recommendations here are stated as **judgement, not documentation** — they are
> marked as such where they appear. **No console block** — no sandbox run covers
> this phase.

The mechanism is finished. What is left is the part that decides whether a
conditional type is an asset or a liability in a codebase, and it has no error
code: **what the next person sees when it goes wrong.**

## The rule the phase is built around

> A clever type that produces an unreadable error message is a net loss.

A conditional type has a specific failure mode here. When a caller passes
something that does not fit, the compiler cannot say *"the third branch did not
match"* — it has no vocabulary for that. It reports an assignability failure
against whatever the conditional finally produced, which for a nested chain is
often a type nobody wrote and nobody recognises.

So the cost of a conditional is paid by someone who did not write it, at a moment
when they are already stuck. That asymmetry is why the discipline below is worth
following even when the type is "obviously fine".

## Five habits that keep them readable

These are conventions, not language rules — judgement drawn from how these types
fail, not from documentation.

**1. Name every intermediate step.** A chain of three conditionals inlined into a
signature is one type; the same chain as three named aliases is three types the
reader can hover individually, and three the compiler can print by name.

```ts
// harder to read, and its errors print the whole expansion
type Handler<T> = T extends { kind: infer K }
  ? K extends string ? (e: T) => void : never
  : never;

// easier: each step is nameable and hoverable
type KindOf<T>    = T extends { kind: infer K } ? K : never;
type IsStringKind<T> = KindOf<T> extends string ? true : false;
type Handler2<T>  = IsStringKind<T> extends true ? (e: T) => void : never;
```

**2. Format a chain as a column.** One `check ? result :` per line, with the
fallback alone at the bottom. It reads as a `switch`, and a misordered case
becomes visible.

**3. Order most-specific first**, as [chunk 01](./01-the-question.md) argued —
the first assignable match wins, and nothing warns you when an earlier general
case has made a later one unreachable.

**4. Make the fallback deliberate.** `never` says "this case cannot happen" and
disappears from unions. A named error type says "you did something wrong" and
survives to be read:

```ts
type RouteParams<T> = T extends `${string}:${infer P}` ? P : "ERROR: not a route";
```

That string is not a language feature — it is a message that survives into the
caller's hover, and it is the cheapest debugging tool in this phase.

**5. Constrain the input rather than testing for nonsense.** If a helper only
makes sense for objects, `<T extends object>` gives the caller a clean `TS2344`
at the call site. Accepting anything and returning `never` for the rest gives
them a mysterious `never` three files away.

## When to delete it instead

Three honest signals, all of which say the type is costing more than it saves:

- **You cannot explain it at review speed.** If it takes a whiteboard, every future
  reader pays that cost too.
- **The error message is worse than the bug it prevents.** This is the phase's
  stated test. A type that turns a clear "you passed a string" into forty lines of
  intersection has made the codebase harder to work in.
- **It only ever runs on two known inputs.** Two overloads, or two named types,
  are shorter, faster to check, and self-documenting. A conditional earns its keep
  when the input set is open.

[08 · Knowing when to stop](../08-knowing-when-to-stop/README.md) is the whole argument; this is
the conditional-type-specific half of it.

## Depth is a real limit, not a style opinion

> **`TS2589`: Type instantiation is excessively deep and possibly infinite.**
>
> **`TS2321`: Excessive stack depth comparing types `'{0}'` and `'{1}'`.**
>
> **`TS7056`: The inferred type of this node exceeds the maximum length the
> compiler will serialize. An explicit type annotation is needed.**

Three different walls, one cause: a type-level program the checker cannot finish
cheaply. Nested conditionals over unions multiply — a chain of four conditionals
over a five-member union is twenty checks, and each one may itself distribute.

The mitigations are the same habits as above, plus one more: **give recursion a
depth limit**. A tuple of a fixed length is the usual counter, and it belongs to
**09 · Type-level performance** *(not written yet)* along with the rest of the
compile-time story.

## A checklist before merging a conditional type

Judgement, not documentation — but it is the review this corpus applies:

- Does every branch have a reason, and is the fallback intentional?
- Is the order most-specific first?
- Is the input constrained, so failures land at the call site?
- Does the false branch return `never` (composes) or a message (debuggable), and
  is that the right choice here?
- Have you hovered the result for **one good input and one bad one**, and read
  what the caller will read?
- Could two named types or two overloads do this?

That fifth item is the one people skip, and it is the only one that measures the
thing the phase says matters.

## Gotchas

**Symptom:** An error message names a type nobody wrote
**Cause:** The conditional produced an anonymous expansion, and the compiler has
no name to print.
**Fix:** Name the intermediate steps; the printed type improves immediately.

**Symptom:** A caller gets `never` and cannot tell why
**Cause:** A silent fallback swallowed an input the helper does not handle.
**Fix:** Constrain the parameter so the failure lands at the call site, or return
a named message type instead of `never`.

**Symptom:** `TS2589` after adding one more case
**Cause:** Depth multiplied — especially if any branch distributes over a union.
**Fix:** Name intermediate types, cap recursion with a depth tuple, and reconsider
whether the last case is worth it.

**Symptom:** Editor hover is slow in files that use the helper
**Cause:** The language server re-derives the conditional on every keystroke.
**Fix:** Alias the resolved type where it is used repeatedly; keep chains short.

**Symptom:** A new branch changed the result of an old case
**Cause:** It was inserted above a case it also matches, and the first match wins.
**Fix:** Add cases at the bottom by default, and re-check the order deliberately.

**Symptom:** The type is right but nobody on the team will touch the file
**Cause:** That is the readability cost, and it is real.
**Fix:** Simplify, name the steps, comment the intent — or delete the type and
write two.

## Interview questions

**★ What is the main cost of a conditional type, and who pays it?**
The error message, and it is paid by whoever hits it — usually not the author.
The compiler cannot say which branch failed; it reports an assignability failure
against the produced type, which for a nested chain is an expansion nobody wrote.
That is why the phase's rule is that a clever type with an unreadable failure is
a net loss.

**★ Name three things you would do to make a chain of conditionals maintainable.**
Name every intermediate step so the compiler has something to print and the
reader something to hover; format the chain one case per line, most-specific
first; and constrain the input so bad arguments fail at the call site instead of
silently reaching a `never` fallback. A fourth, if wanted: return a named message
type rather than `never` while debugging.

**★ When would you delete a conditional type and write something simpler?**
When you cannot explain it at review speed, when the caller's error is worse than
the bug it prevents, or when the input set is closed — two known inputs are two
overloads or two named types, which are shorter and check faster. Conditionals
earn their keep when the input set is open and the output is genuinely a function
of the input.

**What do `TS2589`, `TS2321` and `TS7056` have in common?**
All three are the checker giving up on a type-level program: too deep to
instantiate, too deep to compare, too large to serialise. Nested conditionals
over unions multiply, so they arrive sooner than people expect. The fixes are the
same in each case — name intermediate types, bound the recursion, reduce the
depth.

**Why prefer a constraint over a "wrong input" branch?**
A constraint fails at the call site with `TS2344` naming the constraint. A
fallback branch produces a valid-but-useless type that flows onward and fails
somewhere else entirely, often as `never` with no explanation. Fail where the
mistake is.

**Is `never` always the right false branch?**
It is the right default, because it composes — it disappears from unions and
removes properties from mapped results. It is the wrong choice when the case
represents a *user error* you want visible: a named type like
`"ERROR: expected a route string"` survives into the caller's hover and tells
them what happened, which `never` cannot.

---

← Prev: [03 · Composing them](./03-composing.md) · [Topic index](./README.md) · Next → [03 · The built-in utility types](../03-utility-types/README.md)
