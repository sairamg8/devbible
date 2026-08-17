---
title: "Four tests before you keep it"
sidebar_label: "04 · Four tests before you keep it"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. `TS2589` and `TS2590` are from the **compiler's own diagnostic
> table** (**TypeScript 5.9.3**, `sandbox/ts-p0`) and confirmed present in **7.0.2**.
> **No sandbox, no console block.** 🔴 **Everything else on this page is judgement**
> — a decision procedure this corpus applies, not a language rule. Read it as
> arguments you may disagree with, not facts you can look up.

The fixes in [chunk 03](./03-four-fixes.md) improve a type you are keeping. These
four tests decide whether to keep it, and they are ordered by how often they are the
answer.

**Most types that should not exist fail test 1 or test 2**, and both are answerable
in under a minute without opening the file that uses them.
[Chunk 05](./05-is-a-type-the-tool.md) has the three that ask a different question:
whether a *type* is the right kind of tool at all.

## Test 1 · Can you explain it at review speed?

**Sixty seconds, out loud, no whiteboard, to someone who knows TypeScript but not
this type.** If you cannot, the type is not reviewable — and an unreviewable type is
merged on trust, changed by guesswork, and eventually deleted by someone who could
not tell what it protected.

```ts
// explainable: "make every key optional except the ones you name"
type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;

// not explainable at speed — and it is only three operators deeper
type DeepRequiredWhere<T, P extends string> =
  P extends `${infer H}.${infer R}`
    ? H extends keyof T
      ? Omit<T, H> & { [_ in H]-?: DeepRequiredWhere<NonNullable<T[H]>, R> }
      : T
    : P extends keyof T
      ? Omit<T, P> & { [_ in P]-?: NonNullable<T[P]> }
      : T;
```

The second one is *useful*. It is also the type that will be sitting unexplained in a
codebase in two years with everyone routing around it.

⚠️ **The failure mode of this test is dishonesty in your own favour.** You have just
written it, so of course you can explain it. The question is whether you could have
explained it *before* writing it — because the afternoon it took you is the afternoon
every reader is being asked for.

📌 **Two mitigations before deleting.** Name the intermediate steps
([chunk 03](./03-four-fixes.md)) so the explanation becomes three short ones, and put
the explanation in the file as a comment with one worked input and one worked output.
If it is *still* not explainable in a minute, that is the answer.

## Test 2 · Is the input set open or closed?

**This decides most cases, and it is nearly mechanical.**

- **Closed** — you can list every input and the list changes rarely: two request
  kinds, three log levels, four table names. **Write the types out.** Two named types
  are shorter than the conditional that computes them, check faster, hover better,
  and read as documentation.
- **Open** — the input is *whatever the caller has*: any object, any function, any
  tuple. **Compute it.** You cannot enumerate what you have not been told, and that
  is exactly what type-level programming is for.

```ts
// closed set of two — the conditional is ceremony
type Res<K> = K extends "user" ? User : Order;      // ❌
declare function get(kind: "user"): User;            // ✅
declare function get(kind: "order"): Order;

// open set — the caller's own function, unknown to you
type Wrapped<F extends (...a: never[]) => unknown> =
  (...a: Parameters<F>) => Promise<Awaited<ReturnType<F>>>;   // ✅ earns it
```

⚠️ **"Closed but long" is not open.** Twenty known table names is still closed; a
generated union plus a lookup interface handles it and both are readable. Length is
an argument for *generating* the types, not for computing them
([chunk 06](./06-what-to-write-instead.md)).

⚠️ **The reverse mistake is just as real.** Enumerating an open set — a template
literal type over four interpolated unions — is how you meet `TS2590`
*"Expression produces a union type that is too complex to represent."*
([topic 07](../07-template-literal-types.md)). Open sets get **matched**, not listed.

📌 **A closed set has a second advantage nobody mentions:** you can jump to the
definition. `Kind` is a union of two literals in a file; a conditional's valid inputs
exist only in the reader's head after they have traced the branches.

## Test 3 · Does it prevent a bug that has actually happened?

A type-level program is a **guard**. Ask what it guards against, and demand a
concrete answer:

- *"Someone passed the wrong id kind and we shipped it"* — **real.** Guard it.
- *"Someone could misspell an event name"* — real **if** event names are hand-written
  in many places; theoretical if there are three call sites.
- *"It's more type-safe"* — **not an answer.** Type-safe against what?

⚠️ **The cost is not zero and you are not the one who pays it**, so a guard with no
incident behind it and no plausible incident ahead of it is a net loss by the phase's
own rule. This is the test that stops speculative machinery, and the one authors find
hardest to apply to their own work.

📌 **Corollary:** if the bug would be caught by an existing test, a schema validator,
or the very next line of code, the type is redundant rather than protective.

🔴 **The fastest empirical version of this test: delete it on a branch and build.** If
nothing breaks, it was not load-bearing. If things break, the failures *are* the
concrete answer you could not produce.

## Test 4 · Where does the failure land?

Run [chunk 03](./03-four-fixes.md)'s hover test and look at the **location**, not the
wording:

| Where the error lands | Verdict |
|---|---|
| The call site, naming a constraint | ✅ keep |
| The call site, printing a computed type | ⚠️ acceptable — name the steps |
| A different file, as `never` or a mismatch | 🔴 fix the design or delete it |
| Nowhere — it compiles and misbehaves | 🔴 the type is not doing its job |

The bottom two rows are not style problems. A guard whose failure appears somewhere
other than the mistake has **moved** the debugging cost, not removed it — and usually
increased it, because the person who finally sees the error has no idea your type is
involved.

📌 **This is also the least subjective test available.** When two reviewers disagree
about readability, breaking the type on purpose and reading where the error lands is
evidence rather than opinion.

## Gotchas

**Symptom:** The type was explainable when written and nobody understands it now.
**Cause:** Test 1 was applied with the author's context, which no reader has.
**Fix:** Keep the explanation in the file — a comment with one worked input and one
worked output. If it cannot be written, that is the test failing late.

**Symptom:** A conditional type has grown to nine branches.
**Cause:** A closed input set was treated as open, and each new case was one cheap
line.
**Fix:** Write or generate the mapping as an interface and index into it. Nine
branches is a lookup table in a costume.

**Symptom:** `TS2589` after adding one more case.
**Cause:** Depth multiplied — especially if a branch distributes over a union.
**Fix:** Cap the recursion and re-apply test 2. Arriving here usually means the answer
to test 2 changed several commits ago ([chunk 05](./05-is-a-type-the-tool.md)).

**Symptom:** `TS2590` while enumerating "all the valid strings".
**Cause:** Interpolated unions cross-multiply; you tried to list an open set.
**Fix:** Match the pattern with `infer` instead of enumerating it
([topic 06 · chunk 02](../06-infer/02-strings-and-your-own.md)).

**Symptom:** The type is "more type-safe" and nobody can say against what.
**Cause:** Test 3 was never asked.
**Fix:** Ask it. No incident and no plausible one means the guard has a cost and no
benefit.

**Symptom:** Deleting the clever type breaks nothing.
**Cause:** It was never load-bearing.
**Fix:** That is the whole answer, and it took one build to get.

**Symptom:** Two reviewers disagree about whether the type is readable.
**Cause:** No shared measurement.
**Fix:** Run test 4 together on a deliberately wrong call. Location and length of the
error is evidence; "I find it clear" is not.

**Symptom:** The error is at the call site but names an anonymous type.
**Cause:** Row 2 of test 4 — acceptable, but unfinished.
**Fix:** Name the intermediates; the location is already right, only the wording is
weak.

**Symptom:** A type passes all four tests and is still disliked.
**Cause:** Possibly the wrong *kind* of tool rather than a bad type.
**Fix:** [Chunk 05](./05-is-a-type-the-tool.md) — validators, lint rules, code
generation and comments each beat a type at something.

## Interview questions

**★ You are reviewing a 30-line conditional type. What do you ask first?**
Whether the input set is open or closed. If the author can list every input, write the
types out — two or three named types are shorter, check faster, hover better and read
as documentation. Computing is for input you have not been told: the caller's own
object, function or tuple. That single question resolves most cases before any
discussion of style begins.

**★ Give a test that separates a guard worth keeping from speculative machinery.**
Name the bug it prevents, concretely. "We shipped an order id where a user id was
expected" is an incident; "it's more type-safe" is not an answer. The type costs every
future reader something, so with no incident behind it and none plausible ahead it is a
net loss by the phase's own rule. And the empirical version is one build: delete it on
a branch — if nothing breaks, it was never load-bearing.

**★ Why does *where* an error lands matter more than how it is worded?**
Because a guard whose failure surfaces in a different file has moved the debugging cost
instead of removing it. The person who eventually sees the error has no idea your type
is involved, so they debug the wrong code. A failure at the call site naming a
constraint is worth keeping even if it is verbose; a failure three files away is worth
redesigning even if the message is short.

**★ How do you apply the explain-at-review-speed test honestly?**
Ask whether you could have explained it *before* writing it, not after. You have the
context now and no reader ever will. Two mitigations before deleting: name the
intermediate steps so the explanation becomes three short ones, and put a worked
example in a comment. If it still takes more than a minute, the type cannot be
reviewed — and unreviewable types get changed by guesswork.

**What does "closed but long" mean, and why is it not "open"?**
Twenty known table names is a closed set that happens to be long. You still know every
member, so it can be a generated union plus a lookup interface — both readable, both
jump-to-definition-able. Length argues for generating the declarations, not for
computing them at the type level. An *open* set is one you cannot list at all, because
it is whatever the caller passes.

**What happens if you treat an open set as closed?**
You try to enumerate it, and you meet `TS2590` *"Expression produces a union type that
is too complex to represent."* — usually via template literal types, where interpolated
unions cross-multiply. Open sets are matched with `infer` rather than listed; that is
the whole distinction between describing a pattern and enumerating its instances.

**A type prevents a real bug but the error lands in the wrong file. What do you do?**
Fix the location before arguing about the type. Almost always it is a missing bound: the
bad input satisfied a too-wide constraint and fell through to a fallback, so the failure
happened where the value was *used* rather than where it was *passed*. Constrain the
parameter to the union of valid inputs, and the same guard now reports at the call site
by name.

**Which of the four tests would you keep if you could only keep one?**
Test 2, open or closed. It is nearly mechanical, it needs no history and no incident
report, and it correctly disposes of the largest category — conditionals computing over
a set of two or three known inputs, which are the ones most often written and least
often justified.

---

← Prev: [03 · Four fixes that cost nothing](./03-four-fixes.md) ·
[Topic index](./README.md) · Next → [05 · Is a type the tool?](./05-is-a-type-the-tool.md)
