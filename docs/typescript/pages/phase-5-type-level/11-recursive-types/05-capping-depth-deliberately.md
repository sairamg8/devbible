---
title: "Capping depth deliberately"
sidebar_label: "05 · Capping depth deliberately"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. 🔴 **The four circularity diagnostics are read out of the compiler's
> own message table** — **TypeScript 5.9.3**,
> `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`: `TS2456` *"Type alias '{0}'
> circularly references itself."*, `TS2615` *"Type of property '{0}' circularly references
> itself in mapped type '{1}'."*, `TS2313` *"Type parameter '{0}' has a circular
> constraint."* and `TS2716` *"Type parameter '{0}' has a circular default."* The depth and
> instantiation budgets they are contrasted with are
> [topic 09 · chunk 01](../09-type-level-performance/01-the-three-budgets.md)'s.
> ⚠️ **Constants are 5.9.3's and are not claimed for the 7.0.2 Go port.** **No sandbox, no
> console block, no timings.**

Every recursive type has a depth limit. The only question is whether it is **yours or the
compiler's**, and the compiler's arrives as `TS2589` at an input you did not test, in a
file you were not editing, with a message that names neither your type nor the data that
broke it.

[Topic 09 · chunk 03](../09-type-level-performance/03-what-makes-it-slow.md) lists
uncapped recursion as a performance profile you did not choose. This chunk is choosing
one.

## The counter tuple

The construction is the tuple accumulator from
[chunk 02](./02-the-accumulator-pattern.md) used as nothing but a counter:

```ts
type DeepReadonly<T, Depth extends 1[] = []> =
  Depth["length"] extends 5
    ? T
    : { readonly [K in keyof T]: DeepReadonly<T[K], [...Depth, 1]> };
```

`Depth["length"]` is a numeric literal, so `extends 5` is a real comparison; `[...Depth, 1]`
advances it. Five levels down, the recursion stops and hands back `T` untouched.

⚠️ **Note that this recursion is nested, not tail** — the recursive call sits inside a
mapped type, so it is on the 100-level path. That is fine and it is the normal case: the
cap exists precisely because you are not going to reach either compiler ceiling on
purpose. **Capping and converting to tail position are different tools for different
problems** — the cap bounds *cost*, the conversion raises a *ceiling*.

### The decrementing lookup table

The other common form replaces the growing tuple with a fixed table:

```ts
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type DeepReadonly<T, D extends number = 5> =
  D extends 0 ? T : { readonly [K in keyof T]: DeepReadonly<T[K], Prev[D]> };
```

| | Counter tuple | `Prev` lookup |
|---|---|---|
| Cost per step | a spread — builds a new tuple each level | an indexed access — no allocation |
| Maximum | bounded by the tuple element cap ([chunk 04](./04-the-fine-print.md)) | bounded by the **table length** |
| Reads as | "how many have I done" | "how many are left" |
| Caller-facing default | awkward — the seed is a tuple | natural — the seed is a number |

📌 **The lookup table is usually the better choice for a depth cap**, and the reason is
the last row: `DeepReadonly<T, 3>` is a signature a caller can understand, where
`DeepReadonly<T, [1, 1, 1]>` is not. Keep the counter tuple for accumulating a *result*;
use the table when the count is the whole point.

⚠️ **`Prev[D]` past the end of the table is `undefined`, not an error** — the type quietly
becomes something you did not intend. Give the table more entries than any default you
ship, and constrain `D` if the parameter is public at all.

## The decision the cap forces: what happens *at* the cap

This is the half that gets skipped, and it is the half the caller experiences. Stopping
is not one behaviour — there are four, and they fail in different places.

| At the cap, return | The caller sees | Good when |
|---|---|---|
| `T` — the input, unchanged | a type that is right for 5 levels and plain `T` below | the transform is a *refinement* (`readonly`, `?`) so stopping early is a weaker promise, not a wrong one |
| `unknown` | nothing usable past the cap; every access errors at the use site | you want the boundary to be visible but not fatal |
| `never` | the whole surrounding type often collapses; the error lands far from the cause | almost never — see below |
| a **branded error type** | a name that says what happened, in the hover and the error | the cap is a real limit callers must know about |

The branded form is the one worth writing out, because it is
[topic 08](../08-knowing-when-to-stop/README.md)'s argument applied here — **the error
message is the interface**:

```ts
type DepthLimitReached<T> = { readonly __depthLimit: "DeepReadonly stops at 5 levels"; T: T };

type DeepReadonly<T, D extends number = 5> =
  D extends 0
    ? DepthLimitReached<T>
    : { readonly [K in keyof T]: DeepReadonly<T[K], Prev[D]> };
```

A caller who hits it gets `__depthLimit` in the hover with the sentence in it. Compare
that to `TS2589`, which tells them a type instantiation was excessively deep and possibly
infinite — true, unhelpful, and about the compiler rather than about your type.

🔴 **`never` is the trap.** It looks like the principled "no answer" and it behaves badly:
`never` in a property position is assignable to everything, so the mistake often does not
error **at the cap at all** — it errors later, somewhere the reader has no reason to
connect to a depth limit. Prefer stopping at `T` or branding.

## Document the boundary, in the type

[Topic 08 · chunk 10](../08-knowing-when-to-stop/10-keeping-the-ones-you-keep.md) makes
documenting the boundary a condition of keeping a computed type. A depth cap is a boundary
by definition, so:

- **State the number where it is written**, not in a comment three files away —
  `D extends number = 5` in the signature is already documentation.
- **Say what happens past it** in the same place, which is what the branded type does for
  free.
- **Pin it with a test type.** A `// @ts-expect-error`-style assertion, or a type-level
  equality check on a six-deep input, will fail the day someone edits the cap — the number
  is otherwise the easiest thing in the file to change by accident.

## Picking the number

Not from the compiler's limits — from your data.

1. **Measure the real shape.** Configuration objects are two or three deep; an AST or a
   file tree is unbounded. If the honest answer is "unbounded", a depth cap is the wrong
   tool and [topic 08](../08-knowing-when-to-stop/README.md)'s advice applies.
2. **Add one, not fifty.** Every extra level is instantiations on every use, in every
   consuming file, on every keystroke ([chunk 04](./04-the-fine-print.md)). Headroom in a
   type is not free the way headroom in an array is.
3. **Prefer the smallest number that covers the data you have**, and make the cap
   *visible* rather than generous — a caller who hits a documented limit files a bug; a
   caller who hits `TS2589` files nothing and stops using the type.

## When it is not a depth problem at all

A cap fixes a type that is **too deep**. It does nothing for a type that is
**circular** — those are structural failures, and the compiler has four separate
diagnostics for them:

| Code | Message | Usually means |
|---|---|---|
| `TS2456` | *"Type alias '{0}' circularly references itself."* | an alias that expands to itself with no conditional to stop at |
| `TS2615` | *"Type of property '{0}' circularly references itself in mapped type '{1}'."* | a mapped type whose property type reaches the mapped type again at the same level — [topic 01 · chunk 04](../01-mapped-types/04-limits.md) has the shapes |
| `TS2313` | *"Type parameter '{0}' has a circular constraint."* | `T extends U, U extends T`, or a constraint that mentions the parameter it constrains |
| `TS2716` | *"Type parameter '{0}' has a circular default."* | a default that refers back to the parameter — easy to write by accident when the default is the counter |

🔴 **Telling them apart is the diagnostic skill this topic is for.** `TS2589` means *the
compiler stopped*; these four mean *there is nothing to compute*. Adding a depth cap to a
`TS2456` changes nothing, and the half hour spent tuning the number is the cost of not
having read the code.

⚠️ **`TS2716` is the one this chunk can cause.** A counter default that references the
parameter — writing the seed in terms of `D` while defining `D` — is a natural typo in
exactly the construction above, and its message says "circular default" rather than
anything about depth.

## Gotchas

**Symptom:** You added a depth cap and `TS2589` still fires.
**Cause:** The failure was breadth, not depth — a wide union, an intersection in a hot
signature, or the instantiation *count* budget rather than the depth one. `TS2589` is two
failures with one message.
**Fix:** [Topic 09 · chunk 01](../09-type-level-performance/01-the-three-budgets.md)
separates them; check which guard your shape can actually trip before tuning a number.

**Symptom:** The capped type returns `undefined` for deep inputs.
**Cause:** `Prev[D]` ran off the end of the lookup table.
**Fix:** Extend the table well past any default you ship, and constrain the parameter if
callers can set it.

**Symptom:** The cap works but the errors it produces are worse than the ones it replaced.
**Cause:** Returning `never` at the cap. It is assignable in enough positions that the
failure surfaces somewhere unrelated.
**Fix:** Return the input unchanged, or a branded type whose name says what happened.

**Symptom:** Nobody noticed the cap was raised from 5 to 20 and the editor got slow.
**Cause:** The number is a single token with no test behind it.
**Fix:** Pin it with a type-level assertion on an input one level past the cap. It is the
only thing that makes the number a decision rather than a default.

**Symptom:** `TS2716` — *"Type parameter '{0}' has a circular default."*
**Cause:** The counter's default refers to the parameter it is defaulting.
**Fix:** Seed with a literal — `D extends number = 5`, `Depth extends 1[] = []` — never
with an expression over `D` itself.

**Symptom:** `TS2456` on a type you were about to add a depth cap to.
**Cause:** The alias is circular, not deep — it expands to itself with no conditional to
terminate at.
**Fix:** Break the cycle: a conditional that can return a non-recursive branch, a named
intermediate, or an interface, which is allowed to be circular where an alias is not.

**Symptom:** The cap changed the meaning of the type for shallow inputs too.
**Cause:** The stop condition is tested before the transform rather than after, so level
five is dropped instead of level six.
**Fix:** Decide whether the number means "levels transformed" or "levels remaining" and
write one test at exactly the boundary. Off-by-one here is invisible in a three-deep test
fixture.

**Symptom:** Two capped helpers in the same codebase stop at different depths.
**Cause:** The number was picked per type, by whoever wrote it.
**Fix:** Pick one project-wide default and export it as a type alias, so the number has a
name and one place to change.

## Interview questions

**★ Why cap a recursive type's depth when the compiler already has a limit?**
Because the compiler's limit is not a decision — it arrives as `TS2589` on an input you
did not test, in a consumer's file, with a message about instantiation depth rather than
about your type or their data. A cap you choose puts the boundary where you can document
it, keeps the cost bounded on every use rather than only at the extreme, and lets you
decide what a caller past the boundary actually gets.

**★ Show the two ways to write a depth counter and say which you prefer.**
A growing tuple — `Depth extends 1[] = []` with `[...Depth, 1]` and
`Depth["length"] extends N` — or a decrementing lookup table,
`type Prev = [never, 0, 1, 2, …]` with `Prev[D]`. The table is usually better for a cap:
it costs an indexed access rather than a spread per level, and its parameter is a plain
number, so `DeepReadonly<T, 3>` reads sensibly at a call site. Keep the tuple when you are
accumulating a result as well as counting.

**★ What should the type return at the cap?**
Whatever makes the failure legible. Returning the input unchanged is right when the
transform is a refinement, because stopping early is a weaker promise rather than a wrong
one. A branded type — a property whose name says "depth limit reached" — is right when
callers must know, because the name appears in the hover and the error. `never` is almost
always wrong: it is assignable in enough positions that the failure resurfaces far from
the cap.

**★ How do you tell a depth problem from a circular one?**
By the diagnostic. `TS2589` means the compiler stopped at a limit and a cap or an
accumulator is the lever. `TS2456`, `TS2615`, `TS2313` and `TS2716` mean the definition
refers to itself in a way that has no fixed point — a circular alias, a mapped type whose
property reaches itself, a circular constraint, a circular default. No amount of depth
capping helps the second group; the cycle has to be broken.

**★ How do you choose the number?**
From the data, not from the compiler's limits. Measure how deep the real inputs go —
configuration is two or three, a tree is unbounded — take the smallest number that covers
them, and pin it with a type-level test one level past the boundary so it cannot be
changed silently. If the honest answer is "unbounded", the depth cap is the wrong tool and
the question becomes whether the type should exist at all.

**Is capping the same as converting to tail position?**
No, and they solve different problems. The accumulator conversion raises the *ceiling*
from 100 to 1,000 by changing which counter the compiler spends. A cap lowers the depth
*you* use, to bound cost and to control what happens at the boundary. A capped type is
usually nested, because you are not trying to reach either compiler limit.

**What is `TS2716` and why does it show up in this construction specifically?**
*"Type parameter '{0}' has a circular default."* — a default that refers to the parameter
it is defaulting. It shows up here because the counter parameter is the one with a
default, so writing the seed in terms of the counter is a one-character mistake away, and
the message says nothing about depth.

**Why does a raised cap need a test rather than a comment?**
Because the number is a single token in a signature and changing it is a one-character
diff with no local symptom — the cost appears as editor latency in other people's files.
A type-level assertion on an input at the boundary fails the moment the number moves,
which turns the cap from a default into a decision somebody has to make on purpose.

---

← [04 · The fine print](./04-the-fine-print.md) · [Topic index](./README.md) ·
[Phase 5 index](../README.md) · Next topic → **12 · `DeepPartial` / `DeepReadonly`**
*(not written yet)*
