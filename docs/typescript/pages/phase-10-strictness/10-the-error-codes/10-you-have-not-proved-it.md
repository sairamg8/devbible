---
title: "TS18046 and TS18048 — you have not proved it is there"
sidebar_label: "10 · You have not proved it"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by **reading the two checker functions that choose between
> these codes** in the **TypeScript 5.9.3** build —
> `checkNonNullTypeWithReporter` and `reportObjectPossiblyNullOrUndefinedError`
> (`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`, around line 79472),
> plus `checkNonNullNonVoidType` — so the named-versus-anonymous rule below is the
> compiler's own condition rather than an observation. Codes and templates read
> from the numbered table in the same file: `TS18046`–`TS18050`, `TS2531`,
> `TS2532`, `TS2533`, `TS2571`, `TS2721`–`TS2723`. **No sandbox, no console
> block** — this is a file read.

Two of the topic's nine codes, and they are the same code twice — once with your
expression's name in it and once without.

> 🔴 **`TS18048` and `TS2532` are one check reported two ways, and so are three
> more pairs.** The compiler prefers the named form and falls back to the
> anonymous one when it cannot print the expression. **Which one you get is
> itself a diagnosis**, because the fallback happens for a specific, actionable
> reason.

## The four pairs

| Named form | Anonymous form | Fires when the value may be |
|---|---|---|
| `TS18046` `'{0}' is of type 'unknown'.` | `TS2571` `Object is of type 'unknown'.` | `unknown` |
| `TS18047` `'{0}' is possibly 'null'.` | `TS2531` `Object is possibly 'null'.` | `null` |
| `TS18048` `'{0}' is possibly 'undefined'.` | `TS2532` `Object is possibly 'undefined'.` | `undefined` |
| `TS18049` `'{0}' is possibly 'null' or 'undefined'.` | `TS2533` `Object is possibly 'null' or 'undefined'.` | either |

📌 **The 2xxx forms are the originals and the 18xxx forms were added later**, which
is why the newer, better messages sit in the themeless overflow range
([chunk 01](./01-what-a-code-is.md)). Nothing about `18` means "nullability" — it
means "added after the low ranges filled up".

## 🔴 The selector, exactly

```js
const nodeText = isEntityNameExpression(node) ? entityNameToString(node) : undefined;
…
if (nodeText !== undefined && nodeText.length < 100) {  → the NAMED form
} else {                                                 → the ANONYMOUS form
}
```

Two conditions, both worth knowing:

1. **The expression must be an *entity name expression*** — an identifier, or a
   dotted chain of identifiers. `user`, `a.b.c`, `config.server.port` all qualify.
   **A call result, an index access, a parenthesised expression or anything with an
   operator in it does not.**
2. **Its printed text must be under 100 characters.** A genuinely long qualified
   name falls off the named form even though it is a valid entity name.

🔴 **So the anonymous form carries information: the thing that might be missing
has no name.** That is not cosmetic — it is precisely the case where **you cannot
narrow it in place**, because there is nothing for a type guard to attach to:

```ts
if (getUser().profile) getUser().profile.name;   // two separate calls
```

The guard narrows nothing, because the second `getUser()` is a different
expression as far as control-flow analysis is concerned. **The anonymous code is
the compiler telling you to bind the value first**, and it is the only signal you
get:

```ts
const user = getUser();
if (user.profile) user.profile.name;             // now it narrows
```

📌 **This is the mechanism behind the advice in
[topic 04](../04-reading-a-typescript-error.md)** — *"extract the expression into
a named `const`"*. That page gives the technique; this is the condition that makes
it work, and knowing the condition tells you when it will not
(see the invocation asymmetry below).

## The two special cases

**A literal `null`, or the identifier `undefined`, gets a different code
entirely:**

| Code | Template |
|---|---|
| `TS18050` | `The value '{0}' cannot be used here.` |

So `null.foo` and `undefined.foo` are not reported as *"possibly null"* — the
compiler says the value cannot be used at all, because there is no "possibly"
about it. 📌 **A useful sight-read: `TS18050` means the value is definitely
absent, the 18047/18048 pair means it might be.**

**`void` is folded in.** `checkNonNullNonVoidType` reports the *same*
`TS18048`/`TS2532` pair for a `void`-typed value used as an object — so *"possibly
'undefined'"* on something you never made optional usually means you are using the
return value of a `void` function.

## 🔴 The asymmetry: invocation has no named form

| What you did | Named form | Anonymous form |
|---|---|---|
| **property access** — `x.foo` | ✅ `TS18047`–`TS18049` | `TS2531`–`TS2533` |
| **invocation** — `x()` | ⛔ **none** | `TS2721` `Cannot invoke an object which is possibly 'null'.` · `TS2722` *…'undefined'* · `TS2723` *…'null' or 'undefined'* |

**There is no `'x' is possibly undefined` for a call.** So the extract-to-a-`const`
trick, which reliably improves property-access messages, does nothing for
`callback()` — you get `TS2722` either way.

📌 That is worth knowing mainly so you stop trying. The fix for an optional call
is `?.()`, covered in [chunk 05](./05-callable-or-not.md).

## What the codes are actually asking for

All of these come from **`strictNullChecks`**, one of the nine flags `strict`
turns on ([topic 01](../01-strict-flag-by-flag/README.md)). The demand is always
the same: *prove it is there, at this point in the control flow.*

**The fixes, in order of preference:**

```ts
user?.profile?.name;                    // optional chaining — when absence is fine
if (!user) throw new Error("no user");  // narrow by exiting — best for invariants
user.profile.name;                      //   …everything after this is narrowed

const name = user?.name ?? "anonymous"; // supply a default at the boundary
```

⛔ **`user!.profile` is not a fix.** It removes the check and leaves the
possibility. **12 · Assertion discipline** *(not written yet)* counts these, and
[topic 01 chunk 02](../01-strict-flag-by-flag/02-strictnullchecks.md), topic 02 and
[topic 03](../03-containing-any.md) all point at the `!` count as the real measure
of whether a strictness migration achieved anything.

## `TS18046` is different from the other three

*"'{0}' is of type 'unknown'"* is **not a nullability complaint**. It is the type
system working correctly at a boundary you set up deliberately:

- a `catch` variable under `useUnknownInCatchVariables` —
  [phase 2](../../phase-2-narrowing/12-unknown-in-catch.md) and
  [phase 7](../../phase-7-server/04-catch-e-unknown/README.md)
- a `JSON.parse` result you typed honestly
- an `unknown` parameter on an API designed that way — the subject of
  **13 · Designing APIs `unknown`-first** *(not written yet)*

🔴 **So `TS18046` is a success, not a failure.** It appears exactly where you asked
the compiler to stop trusting incoming data, and the answer is a validator or a
type guard — never an assertion, which would undo the boundary you built on
purpose.

## Gotchas

**Symptom:** *"Object is possibly 'undefined'"* with no name, and you cannot tell
which part of the expression it means.
**Cause:** the expression is not a plain dotted name — a call result, an index
access, or something with an operator.
**Fix:** bind the subexpression to a `const`. The message becomes `TS18048` with
the name, **and** the value becomes narrowable, which it was not before.

**Symptom:** a guard on `getThing().prop` does not narrow the next line.
**Cause:** two calls are two expressions. Control-flow analysis tracks
*references*, and a call is not one.
**Fix:** `const thing = getThing()` once, then guard that.

**Symptom:** the anonymous form appears on what looks like a perfectly ordinary
dotted name.
**Cause:** the printed name is 100 characters or more.
**Fix:** shorten the chain with an intermediate `const`. This is rare but real in
deeply namespaced generated code.

**Symptom:** *"possibly 'undefined'"* on a value you never declared optional.
**Cause:** it is `void` — usually the return value of a function that returns
nothing. `checkNonNullNonVoidType` reports the same pair.
**Fix:** stop using the return value, or change the function's return type if it
does produce something.

**Symptom:** `TS18050` instead of the usual pair.
**Cause:** you wrote the literal `null` or the identifier `undefined` directly.
**Fix:** there is no "possibly" to narrow. The expression is wrong.

**Symptom:** extracting to a `const` does not improve a message about calling
something.
**Cause:** invocation has only the anonymous `TS2721`–`TS2723`; there is no named
variant to upgrade to.
**Fix:** none available. Use `?.()`.

**Symptom:** `TS18046` on a `catch` variable and it feels like a regression.
**Cause:** `useUnknownInCatchVariables`, and it is correct — a `throw` can throw
anything.
**Fix:** narrow it. [Phase 7 · `catch (e: unknown)`](../../phase-7-server/04-catch-e-unknown/README.md)
is the full treatment, including what belongs on an error.

**Symptom:** the same expression errors in one branch and not another, with no
visible difference.
**Cause:** control-flow narrowing is per-reference and is **reset by an
intervening function call or assignment** it cannot reason about.
**Fix:** narrow closer to the use, or hold the narrowed value in a `const`.

## Interview questions

**What is the difference between `TS18048` and `TS2532`?**
Nothing about the finding — they are the same check reported two ways. The
compiler uses the named form, *"'x' is possibly 'undefined'"*, when the expression
is an identifier or a dotted name whose printed text is under 100 characters, and
falls back to *"Object is possibly 'undefined'"* otherwise. There are four such
pairs, covering `unknown`, `null`, `undefined` and both.

**Why is the anonymous form useful information rather than just a worse message?**
Because the fallback happens when the expression has no printable name — a call
result, an index access, something with an operator. Those are exactly the
expressions you *cannot* narrow with a guard, because control-flow analysis tracks
references and a call is not one. So the anonymous code is telling you to bind the
value to a variable first, which both fixes the message and makes narrowing
possible.

**Why does `if (getUser().profile) getUser().profile.name` not work?**
Because the two calls are two different expressions. Narrowing applies to a
reference, and a function call is not a reference the compiler can assume is
stable — it might return something different. Assign the result to a `const` once
and guard that.

**Does the "extract to a named variable" trick always improve nullability
errors?**
No, and the exception is exact: invocation has only the anonymous forms
`TS2721`–`TS2723`, with no named variant. So it works for `x.foo` and does nothing
for `x()`. For an optional call the answer is `?.()`.

**Is `TS18046` a problem?**
No — it is the type system doing what you asked. `unknown` appears where you
deliberately stopped trusting data: a `catch` variable under
`useUnknownInCatchVariables`, a `JSON.parse` result, an `unknown`-first API
parameter. The correct response is a validator or a type guard. An assertion here
undoes the boundary that was built on purpose, which is worse than never having
had it.

**You see *"possibly 'undefined'"* on a value that is not optional. What is going
on?**
It is probably `void`. The checker folds `void` into the same `TS18048`/`TS2532`
pair, so using the return value of a function that returns nothing produces a
nullability message about a value you never marked optional.

---

← [09 · The index codes](./09-the-index-codes.md) · [Topic index](./README.md) · Next → [11 · The condition is already decided](./11-the-condition-is-decided.md)
