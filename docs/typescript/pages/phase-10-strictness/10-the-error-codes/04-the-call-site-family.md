---
title: "Arity and overloads — the call-site family"
sidebar_label: "04 · Arity and overloads"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **numbered diagnostic table** in the **TypeScript
> 5.9.3** build. Codes and templates read from that table: `TS2554`, `TS2555`,
> `TS2556`, `TS2558`, `TS2623`, `TS2624`, `TS2658`, `TS2769`, `TS2771`, `TS2772`,
> `TS2793`, `TS2794`, `TS2810`, `TS2849`, `TS2750`, and the `Message`-category
> related-information lines `TS6210`, `TS6211`, `TS6236`. The **TypeScript
> handbook**'s *Functions → Overloads* section is the reference for overload
> resolution order. **No sandbox, no console block** — output shapes are assembled
> from the quoted templates and labelled as such.

The codes that fire when the *number* of things is wrong rather than their type.
They are the cheapest errors in TypeScript to fix and the most expensive to read,
because one of them prints a wall.

> **Check arity before you read a single type.** An arity failure and a type
> failure look identical at a glance and take wildly different amounts of time to
> resolve. Counting arguments is a two-second check that eliminates the longest
> error class in the language.

## The arity codes

| Code | Template | Fires on |
|---|---|---|
| `TS2554` | `Expected {0} arguments, but got {1}.` | a fixed-arity function |
| `TS2555` | `Expected at least {0} arguments, but got {1}.` | a function with a **rest** parameter |
| `TS2558` | `Expected {0} type arguments, but got {1}.` | **type** arguments — `Foo<A, B>` |
| `TS2556` | `A spread argument must either have a tuple type or be passed to a rest parameter.` | `f(...args)` where `args` is an array, not a tuple |
| `TS2849` | `Target signature provides too few arguments. Expected {0} or more, but got {1}.` | assigning a function *to* a signature that passes more |
| `TS2623` | `Source provides no match for required element at position {0} in target.` | tuple destructuring / spread, by position |
| `TS2624` | `Source provides no match for variadic element at position {0} in target.` | variadic tuple positions |
| `TS2658` | `Type '{0}' provides no match for the signature '{1}'.` | an object failing a call or construct signature |

📌 **`TS2555` versus `TS2554` tells you whether a rest parameter exists**, which
you can otherwise only learn by reading the signature. *"At least"* means the
function is variadic and you are under the minimum.

### 🔴 `TS2554` comes with a second line naming the missing parameter

Three `Message`-category templates are attached as **related information**, and
almost nobody notices them because they point at a *different file* — the
declaration, not the call:

| Code | Template | Attached when |
|---|---|---|
| `TS6210` | `An argument for '{0}' was not provided.` | a plain named parameter is missing |
| `TS6211` | `An argument matching this binding pattern was not provided.` | the missing parameter is **destructured**, so it has no single name |
| `TS6236` | `Arguments for the rest parameter '{0}' were not provided.` | a rest parameter got nothing |

**So `Expected 3 arguments, but got 2` is normally followed by which one.** In an
editor it is a clickable jump straight to the parameter. In `tsc` output it is an
extra line with a different path and line number, which is exactly why it gets
skimmed past.

⚠️ **`TS6211` is a signal in itself:** it means the parameter is an object
destructuring pattern, so the compiler *cannot* name it. That usually means an
options bag — and a missing options bag is often a missing `{}`, not a missing
value.

### Two Promise-specific arity codes

The compiler carries dedicated diagnostics for one confusing case:

| Code | Template |
|---|---|
| `TS2794` | `Expected {0} arguments, but got {1}. Did you forget to include 'void' in your type argument to 'Promise'?` |
| `TS2810` | `Expected 1 argument, but got 0. 'new Promise()' needs a JSDoc hint to produce a 'resolve' that can be called without arguments.` |

`TS2794` is the one you will meet. `new Promise<T>((resolve) => resolve())` fails
because `resolve` requires a `T`; the fix is `Promise<void>` — or, more honestly,
`resolve(theValue)`.

📌 **A dedicated diagnostic is evidence about frequency.** The compiler team does
not spend a code number on a rare confusion; `TS2794` exists because this trips
people up constantly.

## 🔴 `TS2769` — no overload matches, and why it prints a wall

```text
error TS2769: No overload matches this call.
```

Then, typically, one block per overload. **Each block has its own code**, and
knowing them turns the wall into a table of contents:

| Code | Template | Role |
|---|---|---|
| `TS2769` | `No overload matches this call.` | the header |
| `TS2772` | `Overload {0} of {1}, '{2}', gave the following error.` | 🔴 **the block separator** — it numbers the candidates *and prints each signature* |
| `TS2771` | `The last overload is declared here.` | a related-information pointer at the final candidate |
| `TS2750` | `The implementation signature is declared here.` | points at the implementation, not an overload |
| `TS2793` | `The call would have succeeded against this implementation, but implementation signatures of overloads are not externally visible.` | 🔴 see below |

[Topic 04](../04-reading-a-typescript-error.md) gives the reading method — match
on arity first, then read one block. **These codes are why that method works:**
`TS2772` labels every block with its candidate number and signature, so you can
find the one with your argument count without reading any of the others, and
`TS2771` explicitly points at the last one.

### 🔴 `TS2793` is the most informative error in the whole family

*"The call would have succeeded against this implementation, but implementation
signatures of overloads are not externally visible."*

This fires when your call matches the **implementation** signature but none of the
declared overloads. It means:

- **your code is fine at runtime** — the implementation would accept it;
- **the overload list is wrong** — it fails to describe a combination the function
  genuinely supports.

```ts
function make(a: string): string;
function make(a: number): number;
function make(a: string | number): string | number { return a; }   // implementation

declare const v: string | number;
make(v);        // TS2769 + TS2793 — matches the implementation, no overload
```

**The fix is to add the overload**, not to cast the argument:

```ts
function make(a: string): string;
function make(a: number): number;
function make(a: string | number): string | number;   // ← declare it
function make(a: string | number): string | number { return a; }
```

⚠️ **This is the one overload error where the wall is worth reading to the end**,
because `TS2793` is at the bottom and it changes the fix from "correct my call" to
"correct the signature". Everyone hits it with a union argument against
non-union overloads, and almost everyone reaches for `as` instead.

📌 **Why implementation signatures are hidden at all:** an implementation
signature exists to be *compatible with* every overload, so it is deliberately
looser than any of them. If it were callable, the overloads would guarantee
nothing — every union combination would be allowed. Hiding it is what makes an
overload list a contract rather than documentation.

## The order the compiler tries them in, and why the error looks arbitrary

Overload resolution walks the list **top to bottom and stops at the first
match**. Two consequences that explain most surprising overload behaviour:

- **Order in the source is semantic.** A more general overload placed first
  shadows the specific ones after it — they become unreachable, with no error.
  🔴 **Put the most specific overload first**, always.
- **The reported failure is not necessarily the closest match.** The compiler
  reports based on the last candidate it tried in many cases, which is why
  `TS2771` exists to name it. If the block you read looks irrelevant, look for the
  `TS2772` block whose signature has your arity.

## Gotchas

**Symptom:** `TS2769` with forty lines about overloads that obviously do not
apply.
**Cause:** every candidate is reported.
**Fix:** scan the `TS2772` separator lines for the candidate with your argument
count, and read only that block. Everything else failed on arity.

**Symptom:** a `TS2769` wall ending in a line about "implementation signatures".
**Cause:** `TS2793` — your call is valid, the overload list is incomplete.
**Fix:** add the overload. Do not cast the argument; the runtime already supports
it.

**Symptom:** `Expected 3 arguments, but got 2` and you cannot see which one is
missing.
**Cause:** the `TS6210`/`TS6211`/`TS6236` related line points at the *declaration
file*, so it reads like an unrelated second error.
**Fix:** read it — it names the parameter. In an editor, click it.

**Symptom:** `Expected 1 argument, but got 0` on a destructured options
parameter.
**Cause:** `TS6211` — the parameter is a binding pattern with no name.
**Fix:** you probably need `f({})`, not a value. If every field is optional,
consider giving the parameter a default of `{}` in the declaration.

**Symptom:** `f(...args)` fails even though `args` has the right length.
**Cause:** `TS2556`. `args` is typed as an **array**, whose length is unknown to
the type system.
**Fix:** `as const` on the literal, an explicit tuple type, or a rest parameter on
the target.

**Symptom:** a specific overload seems to be ignored.
**Cause:** a more general overload appears **above** it and matched first.
**Fix:** reorder — most specific first. There is no error for an unreachable
overload.

**Symptom:** `TS2558` about type arguments when you wrote none.
**Cause:** a generic with required type parameters, or a default you removed.
**Fix:** supply them, or give the type parameter a default in the declaration.

**Symptom:** `new Promise<T>(resolve => resolve())` fails.
**Cause:** `TS2794`. `resolve` needs a `T`.
**Fix:** `Promise<void>` if there is genuinely no value, otherwise pass the value.

**Symptom:** an arity error on a callback you pass to someone else's function.
**Cause:** `TS2849` — the target signature passes *more* arguments than yours
accepts, in a position where that is checked.
**Fix:** accept and ignore the extra parameters, or check the signature. Note
that accepting **fewer** parameters than offered is normally legal; this code
fires in the narrower cases where it is not.

## Interview questions

**Why are overload errors so long, and how do you handle them?**
`TS2769` reports why *each* overload failed, so one wrong argument produces a
block per candidate — each labelled by `TS2772`, which numbers the candidate and
prints its signature. The method is to match your argument count against those
signatures first, since most blocks failed on arity and are irrelevant, then read
the single remaining candidate. `TS2771` points at the last overload if you cannot
tell.

**What does it mean when an overload error ends with a line about implementation
signatures not being externally visible?**
That is `TS2793`, and it is the most useful line in the family: your call *would*
work at runtime, because it matches the implementation signature, but no declared
overload describes it. The overload list is incomplete. The fix is to declare the
missing overload, not to cast the argument — which is what most people do, and it
hides a signature bug behind an assertion.

**Why can you not call the implementation signature of an overloaded function?**
Because it exists to be compatible with every overload and is therefore looser
than all of them. If it were callable, the overload list would guarantee nothing —
every union combination the implementation tolerates would become legal. Hiding it
is what makes overloads a contract instead of documentation.

**Does the order of overload declarations matter?**
Yes, and it is easy to get wrong because there is no error for it. Resolution
walks the list top to bottom and stops at the first match, so a general overload
placed above a specific one makes the specific one unreachable. Most specific
first.

**`f(...args)` is rejected even though `args` has exactly the right number of
elements. Why?**
`TS2556`. `args` is typed as an array, and an array's length is not part of its
type, so the compiler cannot verify the arity. Give it a tuple type — `as const`
on a literal, or an explicit tuple annotation — or make the target take a rest
parameter.

**`Expected 3 arguments, but got 2` — how do you find out which argument?**
Read the second line. `TS6210` names the parameter, `TS6236` names a rest
parameter, and `TS6211` says the parameter is a destructuring pattern and
therefore unnameable. They are `Message`-category related information attached to
the declaration, so in `tsc` output they appear with a different file path and
look like a separate error.

---

← [03 · One name, two types](./03-two-types-with-one-name.md) · [Topic index](./README.md) · Next → [05 · Callable or not](./05-callable-or-not.md)
