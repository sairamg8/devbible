---
title: "The five rules that track any"
sidebar_label: "08 · The rules that track any"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **typescript-eslint's own rule pages** for
> `no-unsafe-assignment`, `no-unsafe-argument`, `no-unsafe-call`,
> `no-unsafe-member-access` and `no-unsafe-return` — descriptions and preset
> membership quoted from each — and against the **TypeScript handbook** and the
> **4.4 release notes** for `useUnknownInCatchVariables`, the one `any` source the
> compiler itself closed.
> ⚠️ typescript-eslint is not installed here, so rule metadata is
> documentation-attributed. **No sandbox, no console block.**

## 🔴 First, the prefix is not a family

There are **ten** rules named `no-unsafe-*`, and they are two unrelated groups that
share a naming convention:

| | Rules | What they have in common |
|---|---|---|
| **This chunk — five** | `no-unsafe-assignment` · `no-unsafe-argument` · `no-unsafe-call` · `no-unsafe-member-access` · `no-unsafe-return` | they track **`any`**, and they only work together |
| **Chunk 09 — five** | `no-unsafe-enum-comparison` · `no-unsafe-declaration-merging` · `no-unsafe-function-type` · `no-unsafe-unary-minus` · `no-unsafe-type-assertion` | nothing — five independent checks that happen to be named alike |

⚠️ **Worth stating because the naming actively misleads.** Teams enable or disable
"the `no-unsafe` rules" as a block, which is right for the first five and
meaningless for the second five. This chunk is the first group.

## The debt this chunk pays

[Topic 03 · Containing `any`](../03-containing-any.md) ends by naming these rules as
**the only way to catch `any` that arrives *inherited* rather than written.** That
distinction is the whole reason they exist:

| Where the `any` came from | What catches it |
|---|---|
| you wrote `: any` | code review, a grep, `no-explicit-any` |
| you failed to annotate a parameter | 🔴 **`noImplicitAny`** — the compiler |
| a dependency's `.d.ts` returns `any` | **nothing in the compiler** |
| `JSON.parse` | **nothing in the compiler** |
| an untyped import under `allowJs` | **nothing in the compiler** |
| a `catch` clause | `useUnknownInCatchVariables`, and *only* that |

🔴 **The compiler has no diagnostic for "this expression is `any`", and cannot
have one**, because using an `any` is not an error — it is the documented meaning
of the type. `noImplicitAny` fires where an `any` is *created without being asked
for*; once it exists, every subsequent use of it is legal by definition.

📌 **The exception proves it.** TypeScript closed exactly one `any` source —
`catch (e)` became `unknown` under `useUnknownInCatchVariables` in 4.4 — and it
needed a **dedicated flag** to do it, because there was no general mechanism to
extend. [Phase 7 · `catch (e: unknown)`](../../phase-7-server/04-catch-e-unknown/README.md)
is that case argued in full.

## 🔴 Five rules, one flow — and they only work together

The five are not five overlapping opinions. They are the **five places an `any` can
cross a boundary**, and each rule guards exactly one:

```ts
const data = JSON.parse(raw)      // 1. it ENTERS         → no-unsafe-assignment
data.user.name                    // 2. you READ from it  → no-unsafe-member-access
data()                            // 3. you CALL it       → no-unsafe-call
save(data)                        // 4. it MOVES on       → no-unsafe-argument
return data                       // 5. it ESCAPES        → no-unsafe-return
```

⚠️ **Disabling any one of them moves the leak rather than removing it.** Turn off
`no-unsafe-assignment` and the `any` still gets reported the moment it is read,
passed or returned — which is *later*, in someone else's file, with no indication
of where it came from. **The entry point is the cheapest place to catch it**, which
is the argument for keeping the assignment rule on even though it is the noisiest.

🔴 **This is also why `any` is worse than it looks in a codebase.** It is
contagious: every expression derived from an `any` is itself `any`, so one untyped
import can silently make a whole module's worth of types meaningless. **The number
of affected lines is unrelated to the number of `any`s** — which is exactly what
makes a per-`any` count a bad metric and a per-boundary rule a good one.

## What the fix looks like

Almost always `unknown` plus narrowing at the boundary:

```ts
const raw: unknown = JSON.parse(input)     // the type now says what is true
const parsed = UserSchema.parse(raw)       // and the narrowing is explicit
```

🔴 **`unknown` is `any` with the same honesty and none of the silence.** Both mean
"I do not know what this is"; `unknown` additionally forces the question to be
answered before the value is used. The five rules exist to push `any` toward
`unknown`, and every one of their reports is a place where that swap is available.

⚠️ **Where the `any` comes from a dependency, the fix is upstream, not local.**
Typing the boundary once is worth more than narrowing at every call site — that is
**phase 6 · Typing an untyped dependency** *(not written yet)*, and until then the
containment patterns in [topic 03](../03-containing-any.md) are the working answer.

## Gotchas

**Symptom:** enabling `recommended-type-checked` produces thousands of `no-unsafe-*`
reports on a codebase nobody thought used `any`.
**Cause:** inherited `any` — untyped dependencies, `JSON.parse`, `allowJs` imports.
None of it was written by anyone on the team, which is why nobody expected it.
**Fix:** read the count as a measurement rather than a problem with the lint. 🔴 It
is the first honest number anyone has had for how much of the codebase is
unchecked.

**Symptom:** disabling `no-unsafe-assignment` to reduce noise, and the noise moves
somewhere worse.
**Cause:** the `any` is still there; it now reports at the read, the call or the
return, in a different file.
**Fix:** keep the assignment rule. It is the only one that reports at the point the
`any` *entered*, which is the only place the fix is cheap.

**Symptom:** a report on a line where every identifier looks properly typed.
**Cause:** contagion — something upstream is `any` and the type flowed here.
**Fix:** follow it back to the boundary. Hovering the intermediate values finds it
in a few steps, and the fix belongs at the origin, not the report.

**Symptom:** the team "fixes" reports by adding `as SomeType`.
**Cause:** it silences the rule, because the expression is no longer `any`.
**Fix:** 🔴 this is the worst available outcome — it converts a *detected* unknown
into an *undetected* wrong assumption. The assertion is a claim nobody checked; see
**topic 12 · Assertion discipline** *(not written yet)*, and prefer `unknown` plus
validation.

**Symptom:** `catch (e)` reports under these rules on one project and not another.
**Cause:** `useUnknownInCatchVariables` is part of `strict` from 4.4, so the catch
variable is `unknown` on a strict project and `any` on a non-strict one.
**Fix:** enable `strict` ([topic 01](../01-strict-flag-by-flag/README.md)). This is
one of the few `any` sources the compiler will close for you.

**Symptom:** an `any` from a dependency is narrowed at fifteen call sites.
**Cause:** the fix was applied where the rule reported rather than where the value
entered.
**Fix:** type the boundary once. Fifteen local narrowings are fifteen places to get
it wrong and fifteen places to update when the dependency changes.

**Symptom:** someone proposes counting `any`s as the metric instead.
**Cause:** it is the obvious measurement.
**Fix:** it does not measure the exposure — one `any` at a hot boundary infects
more code than fifty in a leaf file. The rules report *uses*, which is closer to
the thing you care about, and that is why this phase's metric is assertions per
error fixed rather than a raw count.

## Interview questions

**What do the `no-unsafe-*` rules add that `noImplicitAny` does not?**
`noImplicitAny` fires where an `any` is *created without being asked for* — an
unannotated parameter, mostly. It says nothing about `any` that arrives from
somewhere else: a dependency's declarations, `JSON.parse`, an untyped import. Once
an `any` exists, every use of it is legal, so the compiler has no diagnostic to
give. These rules are the only detector for inherited `any`.

**Why are there five of them rather than one?**
Because they guard the five distinct places an `any` can cross a boundary —
assignment, member access, call, argument and return. They are one flow, not five
opinions, and disabling any one of them relocates the report instead of removing
the problem. The assignment rule is the most valuable of the five because it fires
where the `any` entered, which is where the fix is cheapest.

**Why can't the compiler just report `any` usage?**
Because using an `any` is not an error — it is the type's documented meaning. A
diagnostic for it would be a diagnostic for the feature working. The one place
TypeScript did act is the `catch` clause, and it needed a dedicated flag,
`useUnknownInCatchVariables` in 4.4, which is evidence that there was no general
mechanism to extend.

**What is the right fix for a `no-unsafe-assignment` report on `JSON.parse`?**
Type the value `unknown` and validate it before use. Both types say "I do not know
what this is"; `unknown` is the one that makes you answer the question before the
value can be touched. Adding an `as` instead silences the rule while making things
strictly worse — it replaces a known unknown with an unchecked assumption.

**Enabling these rules produces two thousand reports. What do you do?**
Read the number first: it is a measurement of how much of the codebase is
unchecked, and it is usually the first honest one available. Then fix it at the
boundaries rather than at the reports — most of the two thousand will trace back to
a handful of untyped dependencies or parse sites, and typing those collapses the
count far faster than working through the list.

**Why is `any` described as contagious, and why does that matter for metrics?**
Every expression derived from an `any` is itself `any`, so a single untyped import
can make an entire module's types meaningless without another `any` being written.
The count of affected lines is therefore unrelated to the count of `any`s, which is
why counting `any`s underestimates exposure and why a rule that reports *uses* is
the better signal.

**Which of the five would you keep if you could only keep one?**
`no-unsafe-return`, if the concern is other people's code — it stops an `any`
escaping a module and becoming someone else's inherited `any`, which is how the
problem spreads across a codebase. `no-unsafe-assignment` if the concern is your
own, because it reports at the entry point. Either answer is defensible; "member
access" is not, because by then the value has already been trusted.

---

← [07 · Fixing them without breaking them](./07-fixing-them-without-breaking-them.md) · [Topic index](./README.md) · Next → [09 · The five that only share the prefix](./09-the-five-that-share-a-prefix.md)
