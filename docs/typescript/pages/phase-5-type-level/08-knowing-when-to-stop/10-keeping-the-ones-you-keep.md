---
title: "Keeping the ones you keep"
sidebar_label: "10 · Keeping the ones you keep"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. **Five walls and three circularity diagnostics** — `TS2589`,
> `TS2321`, 🔴 `TS2859`, `TS7056`, `TS2590`, `TS2615`, `TS2456`, `TS2502` — were read
> out of the **compiler's own numbered diagnostic table** (**TypeScript 5.9.3**,
> `sandbox/ts-p0`), by identifier, and **every string was then confirmed present in the
> installed TypeScript 7.0.2 native compiler**. 🔴 **`TS2859` is a distinct diagnostic
> from `TS2321` and had not appeared in this corpus before this page** — the identifiers
> are `Excessive_complexity_comparing_types_0_and_1_2859` and
> `Excessive_stack_depth_comparing_types_0_and_1_2321`, and both exist in 5.9.3 **and**
> 7.0.2. **No sandbox, no console block.** The habits are **judgement**, marked as such.

Some types survive the tests. This chunk is how to keep one without inflicting it on
everybody — the practices that make a genuinely necessary type-level program tolerable.

⚠️ **Everything here assumes the tests were run.** These are not a substitute for
[chunk 04](./04-the-stopping-tests.md); a well-packaged type that should not exist is still
a type that should not exist.

## 1 · Export the façade, hide the machinery

The most effective single habit, and it is purely about module boundaries:

```ts
// internal — not exported
type Segments<S extends string> =
  S extends `${infer H}/${infer R}` ? [H, ...Segments<R>] : [S];
type ParamNames<T> = /* … */;

// the only thing consumers see
export type RouteParams<S extends string> = Record<ParamNames<Segments<S>>, string>;
```

Consumers get one name in their editor, one name in their errors, and one thing to learn.
The four helpers are still named — which is [chunk 03](./03-four-fixes.md)'s fix, and it is
what makes the *implementation* debuggable — but they are not part of the API.

📌 **Judgement, and it holds up:** put the machinery in **one file** and give it a name
like `types/route-params.ts`. A codebase can hold a small number of these; the number it can
hold *scattered* is roughly zero, because nobody can find them to reason about them.

## 2 · Flatten at the boundary

Whatever the internals do, the exported type should display as a shape a human recognises —
the `Prettify` identity mapping from
[topic 01 · chunk 01](../01-mapped-types/01-the-loop.md), applied once at the export:

```ts
export type PublicUser = Prettify<Omit<User, "passwordHash"> & { roles: Role[] }>;
```

⚠️ **Once, at the boundary — not on every internal step.** `Prettify` forces evaluation, so
sprinkling it through a recursive helper multiplies work for no display benefit; the
internals are never displayed anyway.

## 3 · Make the failure branch say something

[Topic 02 · chunk 04](../02-conditional-types/04-readable.md) introduced the named message
type. The general form:

```ts
type RouteParams<S extends string> =
  S extends `${string}:${string}`
    ? /* … the real computation … */
    : "ERROR: a route must contain at least one :param";
```

The string is not a language feature — it is a **message that survives into the caller's
hover and error**, and it is the cheapest debugging tool in this phase.

**The rule for choosing:** `never` when the case is genuinely impossible and the type must
compose (it disappears from unions and removes mapped properties); a message type when the
case is a **user error you want visible**. `never` is silent by construction, which is
correct for composition and wrong for diagnosis.

⚠️ **A message type does not fail the build on its own** — it produces a wrong-but-valid
type that fails later, at the assignment. If the mistake must be rejected *here*, a
constraint is the tool ([chunk 02](./02-three-designs-one-mistake.md)).

## 4 · Bound the recursion, deliberately

A recursive type without a depth bound is a type that will meet one of the five walls on
somebody else's input. A fixed-length tuple as a counter is the usual construction, and it
belongs in full to **11 · Recursive types** and **09 · Type-level performance** *(neither
written yet)*.

What belongs here is the decision: **choose the depth, write it down, and say what happens
past it.** A helper that silently stops at depth 5 and one that errors at depth 5 are
different contracts, and the reader needs to know which they have.

## 5 · The five walls — the compiler telling you to stop

Five distinct ways the checker declines to finish. Knowing which one fired tells you what
went wrong:

> **`TS2589`: Type instantiation is excessively deep and possibly infinite.**
> — *recursion or nesting went too deep while **producing** a type.*
>
> **`TS2321`: Excessive stack depth comparing types `'{0}'` and `'{1}'`.**
> — *the types were produced; **comparing** them ran out of depth.*
>
> 🔴 **`TS2859`: Excessive complexity comparing types `'{0}'` and `'{1}'`.**
> — *a **separate** diagnostic from `TS2321`: not depth, but total comparison work.*
>
> **`TS7056`: The inferred type of this node exceeds the maximum length the compiler will
> serialize. An explicit type annotation is needed.**
> — *the type is fine and **too large to write down**; declaration emit gave up.*
>
> **`TS2590`: Expression produces a union type that is too complex to represent.**
> — *cross-multiplied unions; you tried to **enumerate** an open set.*

📌 **`TS2321` and `TS2859` being two different diagnostics is worth internalising**, because
the fixes differ: depth is reduced by shortening the chain or capping recursion, while
*complexity* is reduced by cutting the number of comparisons — fewer union members, a base
type instead of a wide union ([chunk 08](./08-structure-and-tooling.md)), or a named
intermediate the compiler can cache.

And three circularity diagnostics, which mean something structurally different — not "too
much work" but "this definition refers to itself in a way that cannot be resolved":

> **`TS2456`: Type alias `'{0}'` circularly references itself.**
>
> **`TS2615`: Type of property `'{0}'` circularly references itself in mapped type `'{1}'`.**
>
> **`TS2502`: `'{0}'` is referenced directly or indirectly in its own type annotation.**

`TS2615` in a mapped type is the one you will actually hit
([topic 01 · chunk 04](../01-mapped-types/04-limits.md) has it in context).

⚠️ **None of the five walls is a licence to suppress.** A `@ts-ignore` over `TS2589` leaves
the checker having given up on that type while the code carries on as if it had not.

## 6 · Document the boundary, not the mechanism

Judgement, and the most-skipped item on the list. A reader needs to know:

- **What it does not handle** — optional fields, symbols, index signatures, arrays,
  unions, `readonly`.
- **One worked input and its output**, in a comment. Concrete beats descriptive every
  time.
- **The depth limit**, if there is one, and what happens at it.
- **Why it exists** — the bug from [chunk 04](./04-the-stopping-tests.md)'s test 3, named.
  This is what tells a future reader whether they may delete it.

⚠️ **"See the type" is not documentation.** The type is what they could not read; that is
why they are reading the comment.

## 7 · Pin the failure, so it cannot rot

A deliberately wrong call kept under `@ts-expect-error` fails the build if that line ever
stops erroring — which is what catches a helper silently going permissive after a refactor:

```ts
// @ts-expect-error — a route with no :param must be rejected
const bad: RouteParams<"/users"> = {};
```

That pins the error's **existence**, not its wording; asserting the wording needs the
type-level testing tools, which belong to phase 12. Directive policy — and why
`@ts-expect-error` beats `@ts-ignore` — is
[phase 10 · chunk 08](../../phase-10-strictness/08-suppression-directives/README.md).

## 8 · Plan its deletion

The last habit, and the one that distinguishes a maintained type from an inherited one:
**write down what would make this unnecessary.** "When the API publishes a schema we can
generate from" or "when we drop support for the v1 payload shape" is a sentence in a comment
that lets somebody else retire your work without a week of archaeology.

## Gotchas

**Symptom:** Consumers' errors mention four internal helper types.
**Cause:** The machinery is exported.
**Fix:** Export only the façade; keep the helpers module-private.

**Symptom:** The exported type displays as an intersection nobody recognises.
**Cause:** No flattening at the boundary.
**Fix:** `Prettify` once, at the export — not on internal steps, where it only adds work.

**Symptom:** A caller gets `never` and cannot tell why.
**Cause:** A silent fallback.
**Fix:** A named message type while the case is a user error; a constraint if the mistake
should be rejected at the call site.

**Symptom:** The message-type fallback did not stop the build.
**Cause:** It produces a valid type; only the eventual assignment fails.
**Fix:** Expected. Use a constraint when the failure must be immediate.

**Symptom:** `TS2589` on somebody else's input, never on yours.
**Cause:** Unbounded recursion met a deeper shape than you tested.
**Fix:** Cap the depth, document the cap, and decide whether the cap errors or stops.

**Symptom:** `TS2321` and the depth is already capped.
**Cause:** Wrong wall — this one is about *comparing*, not producing.
**Fix:** Reduce what is being compared: simplify the target type, or name intermediates so
relationships can be cached.

**Symptom:** `TS2859`, not `TS2321`, and reducing depth changed nothing.
**Cause:** Total comparison work, not depth. They are genuinely different diagnostics.
**Fix:** Cut the number of comparisons — fewer union members, a base type instead of a wide
union, or a cached named intermediate.

**Symptom:** `TS7056` from a helper that works fine in-editor.
**Cause:** Declaration emit cannot serialise the inferred type.
**Fix:** Write the annotation it asks for. That is the honest fix, and usually the better
design ([chunk 05](./05-is-a-type-the-tool.md)).

**Symptom:** `TS2615` on a recursive mapped type.
**Cause:** A property's type refers to the mapped type being defined.
**Fix:** Break the cycle through a named intermediate or an interface;
[topic 01 · chunk 04](../01-mapped-types/04-limits.md) has the shapes.

**Symptom:** A helper quietly stopped rejecting bad input after a refactor.
**Cause:** Nothing pinned the failure.
**Fix:** A kept `@ts-expect-error` line on a deliberately wrong call.

**Symptom:** The type is documented and the questions keep coming.
**Cause:** The comment explains the mechanism, not the boundary.
**Fix:** Document what it does *not* handle, one worked input and output, the depth limit,
and the bug it prevents.

**Symptom:** An obviously obsolete helper survives because nobody dares delete it.
**Cause:** No stated exit condition.
**Fix:** Write the deletion criterion in the file, at the time you write the type.

## Interview questions

**★ You have decided to keep an elaborate type. What is the first thing you do?**
Split the API from the implementation: export one façade type and keep every helper
module-private. Consumers then see one name in their editor and one name in their errors,
while the internals stay individually named so *you* can debug them. Followed by flattening
the exported type once with `Prettify` at the boundary, so what people see is a shape they
recognise.

**★ Name the five walls and say what each one means.**
`TS2589` *"Type instantiation is excessively deep and possibly infinite."* — too deep while
producing a type. `TS2321` *"Excessive stack depth comparing types…"* — depth ran out while
*comparing* two types. `TS2859` *"Excessive complexity comparing types…"* — a separate
diagnostic about the total comparison work rather than depth. `TS7056` — the inferred type is
too large to serialise and an explicit annotation is needed. `TS2590` — cross-multiplied
unions produced something too complex to represent. Different causes, different fixes: cap
recursion, shorten chains, cut comparison count, write the annotation, stop enumerating.

**★ `never` or a named message type for a false branch?**
`never` when the case is genuinely impossible and the type must compose — it vanishes from
unions and removes properties from mapped results. A named message type when the case is a
*user error you want visible*, because a string like `"ERROR: a route must contain at least
one :param"` survives into the caller's hover where `never` says nothing. The caveat: the
message type still produces a valid type, so it fails at the later assignment rather than at
the mistake — if immediate rejection matters, use a constraint.

**★ How do you stop a kept type from silently rotting?**
Pin its failure. Keep one deliberately wrong call under `@ts-expect-error`; if the helper
ever stops rejecting it, the directive itself becomes an error and the build fails. That
covers the error's existence — asserting its *wording* needs the type-testing tools of phase
12. It is the only regression test most type-level code ever gets.

**What belongs in the comment above a complicated type?**
The boundary, not the mechanism: what it does not handle (optional fields, symbols, index
signatures, unions), one worked input with its output, the depth limit and what happens at
it, and the concrete bug it prevents. The last one is what lets a future reader decide
whether they may delete it. "See the type" is not documentation — the type is the thing they
could not read.

**Why keep helper types named if they are not exported?**
Because naming is what makes the *implementation* debuggable and cacheable, and neither
depends on export. The export decision is about the API surface; the naming decision is
about whether anyone — including you, next year — can read the internals. Do both: name
everything, export one thing.

**Why `Prettify` at the boundary rather than throughout?**
Because it forces evaluation, and the internal steps are never displayed to anyone. Applying
it once at the export gives the reader the flat shape they need; applying it on every
recursive step multiplies work for a display nobody sees. The same reasoning as annotating a
public return type while leaving internal inference alone.

**What is the deletion plan, and why does it belong in the file?**
A sentence stating what would make the type unnecessary — a published schema to generate
from, dropping support for an old payload shape. Without it, an obsolete helper survives
because nobody can prove it is safe to remove, and the cost the tests were trying to avoid
gets paid indefinitely by people who never chose it.

---

← Prev: [09 · The boundary and the generator](./09-the-boundary-and-the-generator.md) ·
[Topic index](./README.md) · Next → [11 · The cases that earn it](./11-the-cases-that-earn-it.md)
