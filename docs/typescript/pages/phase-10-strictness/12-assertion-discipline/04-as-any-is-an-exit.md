---
title: "`as any` is an exit, not a stronger assertion"
sidebar_label: "04 · `as any` is an exit"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** for `any` and type
> assertions, the **5.9.3 diagnostic table** (`sandbox/ts-p0`) for `TS2352`, and
> **typescript-eslint's** rule pages for `no-explicit-any` and the `no-unsafe-*`
> rules. ⚠️ typescript-eslint is not installed here, so rule claims are
> documentation-attributed; the reasoning about which rules can *see* a given
> spelling follows from the resulting expression's type and is argued rather than
> measured. Containment of `any` itself is [topic 03](../03-containing-any.md).
> **No sandbox run, no console block.**

`as any` looks like the top of the assertion scale — the same operation as `as T`,
turned up. **It is a different operation.**

| | `x as T` | `x as any` |
|---|---|---|
| What it claims | *"this is a `T`"* — 🔴 **a specific, falsifiable claim** | 🔴 **nothing** |
| Can it be wrong? | yes, and provably so later | it cannot be wrong, because it asserts nothing |
| Blast radius | one expression | **everything downstream** — `any` is contagious |
| Reviewable? | yes — you can ask *is it a `T`?* | there is no question to ask |

🔴 **An assertion that cannot be wrong is not a safer assertion — it is the absence
of a type.** `as T` narrows the compiler's belief to something you can argue about;
`as any` removes the belief entirely, and everything derived from that expression is
`any` too ([topic 11 · chunk 08](../11-typescript-eslint/08-the-rules-that-track-any.md)).

## Why it is worse than `: any` written as an annotation

An explicit `any` annotation is at least **declared**: it sits at a binding, it is
greppable, `no-explicit-any` reports it, and a reader who hovers the variable sees
what they are dealing with.

```ts
let payload: any = getPayload()        // declared, visible, greppable
const payload = getPayload() as any    // mid-expression, and it spreads from here
```

⚠️ **`as any` is the same decision made where nobody will look for it** — inside an
argument list, a return expression, a JSX prop. And it does not appear at the
binding, so the variable's declaration looks ordinary while its type is not.

## 🔴 The spelling that defeats both checks

This is the part worth taking away, because it inverts the usual ranking of "bad"
assertions:

| Spelling | Compiler | The `any`-tracking lint rules |
|---|---|---|
| `x as any` | accepts | ✅ **report it** — the expression is `any`, so assignment / argument / call / return all fire |
| `x as unknown as T` | accepts (it is `TS2352`'s own suggestion) | ⚪ nothing to report — the result is `T` |
| 🔴 **`x as any as T`** | accepts | ⚪ **nothing to report — the result is `T`** |

🔴 **So a bare `as any` is the *loud* spelling and the double assertion is the
*silent* one.** The intermediate `any` disappears into the final type, so the
boundary rules have nothing to fire on, and `TS2352` has been stepped around by
construction.

⚠️ **Which makes the obvious policy actively counterproductive.** A rule that bans
`as any` and nothing else does not remove the exits — it converts them into
`as unknown as T` and `as any as T`, both of which are **invisible to the very rules
that were catching the first spelling.** That is the escalation
[topic 08](../08-suppression-directives/README.md) documents for suppression
comments, arriving here with a concrete mechanism: **the ban moves the population to
a tier your tooling cannot see.**

📌 **The corollary is a genuinely useful review heuristic:** a bare `as any` is
someone taking a shortcut in the open. A double assertion is someone who has already
been told no — by `TS2352`, by a lint rule, or by a reviewer. **Grep for the double
first.**

## What it is standing in for

Almost always the same thing, and it is the substitution
[chunk 02](./02-what-an-as-is-standing-in-for.md) calls the most dangerous:

```ts
const config = JSON.parse(raw) as any         // "I do not know what this is"
const config: unknown = JSON.parse(raw)       // …which is what `unknown` means
```

🔴 **`unknown` and `any` say the same thing about your knowledge and opposite things
about your obligations.** Both mean *"I do not know what this is"*; `unknown` makes
you answer before the value can be used, `any` lets the question go unasked forever.
Where `as any` is genuinely honest about the situation, `unknown` is the spelling
that keeps it honest.

**The three cases where it is defensible**, and they are narrower than they look:

1. **Test doubles** — a partial mock asserted into a full interface. Real, common,
   and costed in [chunk 02](./02-what-an-as-is-standing-in-for.md): the test now
   claims a contract it does not honour.
2. **A genuinely dynamic bridge** — a plugin loader, a serialiser working over
   arbitrary shapes. ⚠️ Even here `unknown` at the boundary plus a validated exit is
   usually available and better.
3. **A last-resort interop shim** for a dependency whose types are wrong. **Contain
   it in one file** and export a typed surface, exactly as
   [topic 03](../03-containing-any.md) argues — so the codebase has one `as any`
   rather than a hundred.

📌 In all three, the discipline is not *avoid it* but **keep it in one place and
make the typed thing the only export.** An `as any` at a boundary you control is a
decision; an `as any` in a component is a leak.

## Gotchas

**Symptom:** a lint rule bans `as any` and the assertion count falls.
**Cause:** the exits moved to `as unknown as T` and `as any as T`.
**Fix:** 🔴 count all three spellings. The two doubles are the ones your `any`-
tracking rules cannot see, so a falling `as any` count with a flat bug rate is
evidence of migration, not improvement.

**Symptom:** `no-unsafe-assignment` fires on a line that has an explicit assertion.
**Cause:** the assertion was `as any`, so the expression really is `any`.
**Fix:** this is the tooling working. The report is telling you the assertion
removed the type rather than corrected it.

**Symptom:** a variable's declaration looks properly typed and everything derived
from it is `any`.
**Cause:** an `as any` somewhere inside the initialising expression.
**Fix:** hover the intermediate values back to the origin. ⚠️ The declaration is the
last place this shows up, which is exactly why `as any` is worse than a declared
`: any`.

**Symptom:** `as any` in a test file, and it seems harmless.
**Cause:** it usually is, until the interface grows.
**Fix:** the test keeps passing while no longer exercising the real contract.
Prefer a checked factory for fixtures and keep the assertions for the cases where
there is no alternative.

**Symptom:** someone argues `as any` is more honest than `as WrongType`.
**Cause:** it is, in a narrow sense — it does not make a false claim.
**Fix:** ⚠️ agree, and then note that `unknown` is more honest than both, since it
says the same thing and keeps the obligation. "It does not lie" is a low bar when a
spelling exists that does not lie *and* stays checkable.

**Symptom:** an interop shim's `as any` has spread to thirty files.
**Cause:** the assertion was applied at each use rather than once at the boundary.
**Fix:** one module, one assertion, a typed export. This is topic 03's containment
argument, and `as any` is the case it was written for.

## Interview questions

**Is `as any` just a stronger version of `as T`?**
No — it is a different operation. `as T` makes a specific, falsifiable claim you can
argue about and that can be shown wrong later. `as any` makes no claim at all; it
removes the type. An assertion that cannot be wrong is not safer, it is the absence
of checking, and everything derived from it is `any` too.

**Why is `as any` worse than an `: any` annotation?**
Because it is the same decision taken where nobody looks for it. An annotation is at
a binding — declared, greppable, reported by `no-explicit-any`, visible on hover.
`as any` sits mid-expression inside an argument list or a return, so the
declaration looks ordinary while the type is gone, and the effect spreads from there.

**Which assertion spelling should worry you most?**
`x as any as T` or `x as unknown as T`. A bare `as any` is loud — the expression is
`any`, so the boundary rules report it. The doubles produce a final type of `T`, so
those rules have nothing to fire on, and `TS2352` was stepped around by
construction. The silent spellings are the ones to grep for.

**What happens if you ban `as any`?**
The exits migrate to the double assertions, which your tooling can no longer see. It
is the same escalation as banning a suppression comment: the population moves to a
wider tier rather than shrinking. Count the family and review the count instead —
and treat a falling `as any` count with an unchanged bug rate as evidence of
migration.

**When is `as any` defensible?**
Test doubles, a genuinely dynamic bridge, and a last-resort shim for a dependency
whose types are wrong. In all three the discipline is containment rather than
avoidance: one file, one assertion, and a typed surface as the only export — so the
codebase has one `as any` rather than a hundred.

**Someone says `as any` is more honest than asserting a wrong type. Are they right?**
Partly, and it is worth conceding: it makes no false claim. But `unknown` says
exactly the same thing about what you know while keeping the obligation to find out,
so it is more honest still. "It does not lie" is a weak defence when a spelling
exists that does not lie and stays checkable.

**How do you tell a shortcut from a decision when reviewing an assertion?**
A bare `as any` is usually someone moving fast in the open. A double assertion is
usually someone who has already been told no — by the compiler's overlap check, by
a lint rule, or by a reviewer — and has routed around it. The second deserves the
harder question, and it is the one least likely to be flagged automatically.

---

← [03 · The one-character claim](./03-the-one-character-claim.md) · [Topic index](./README.md) · Next → **05 · A policy that works** *(not written yet)*
