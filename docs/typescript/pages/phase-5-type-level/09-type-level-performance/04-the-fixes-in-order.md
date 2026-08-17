---
title: "The fixes, in order"
sidebar_label: "04 · The fixes, in order"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript wiki, *Performance*** (*Naming Complex Types*,
> *Using Type Annotations*, *Preferring Interfaces Over Intersections*, *Preferring Base Types
> Over Unions* — all quoted verbatim in chunks
> [02](./02-caching-and-naming.md) and [03](./03-what-makes-it-slow.md)) and against the
> **TypeScript 5.9.3** checker internals read in
> [chunk 01](./01-the-three-budgets.md). `TS2589`, `TS2321`, `TS2859`, `TS2590` and `TS7056`
> are from the compiler's own message table, confirmed in **7.0.2**. **No sandbox, no console
> block, no timings** — so the ordering below is **judgement**, argued from which budget each
> fix relieves rather than from measurements, and it says so at each step.

Four chunks in, the diagnosis is mechanical. This one is the order to act in — cheapest and
most certain first, because **the first three cost nothing and are worth doing before you
measure anything.**

## Step 0 · Identify the budget before choosing a fix

From [chunk 01](./01-the-three-budgets.md), because acting without this is a coin flip:

| Diagnostic | Budget | Fix family |
|---|---|---|
| `TS2589` + recursion present | instantiation **depth** (100) | cap the recursion — step 5 |
| `TS2589`, no recursion | instantiation **count** (5,000,000) | do less work — steps 1–4 |
| `TS2321` | comparison **depth** | flatten nesting — steps 3, 5 |
| `TS2859` | comparison **budget** | fewer comparisons — steps 2, 3 |
| `TS2590` | union **size** / reduction | narrow the union — step 2 |
| `TS7056` | declaration **serialisation** | annotate the return — step 4 |

## Step 1 · Name every intermediate, and use the name

The one recommendation with no trade-off, for the reasons in
[chunk 02](./02-caching-and-naming.md): the alias supplies the `aliasSymbol` the instantiation
early-out requires and the stable key its cache uses, and *"more information can be cached by
the compiler."*

```ts
// before: one anonymous computation, re-derived at every use
declare function toRow<T>(x: T): Required<Omit<{ [K in keyof T]: T[K] | null }, "id">>;

// after: three names, three cacheable steps, three hoverable types
type Nullable<T>  = { [K in keyof T]: T[K] | null };
type WithoutId<T> = Omit<T, "id">;
type Row<T>       = Required<WithoutId<Nullable<T>>>;
declare function toRow2<T>(x: T): Row<T>;
```

🔴 **And declare them at module top level.** A `type` alias inside a function body fails
`isNonGenericTopLevelType`'s ancestor walk, so it is not eligible for the cheapest early-out
([chunk 02](./02-caching-and-naming.md)). Hoisting is a one-line change with no downside.

## Step 2 · Narrow the widest union in the path

The quadratic term, so this is where the largest wins live
([chunk 03](./03-what-makes-it-slow.md)).

- **Stop enumerating what you can match.** A template literal over three unions is a product;
  `infer` against a pattern is not
  ([topic 06 · chunk 02](../06-infer/02-strings-and-your-own.md)).
- **Stop unintended distribution.** The bracket form `[T] extends [U]` keeps a union whole
  ([topic 05](../05-distributive-conditionals.md)).
- **Prefer subtypes** — *"One way to avoid this is to use subtypes, rather than unions"* — a
  base type the members extend, rather than fifteen alternatives compared pairwise.

📌 **Do the arithmetic before the refactor.** Multiply the member counts along the path: if the
product is near 100,000 you have found the cause, and if it is 40 you have not.

## Step 3 · Turn intersections into interfaces, in hot signatures first

*"Type relationships between interfaces are also cached, as opposed to intersection types as a
whole."* One cacheable relationship instead of one comparison per constituent per check — and
flatter error messages at the same time
([topic 08 · chunk 08](../08-knowing-when-to-stop/08-structure-and-tooling.md)).

⚠️ **Order matters:** apply it to types used in *many* signatures first. An intersection used
once is not worth a refactor; one in a widely-imported helper is a multiplier.

## Step 4 · Annotate exported return types

*"Adding type annotations, especially return types, can save the compiler a lot of work."* An
inferred return is re-derived per consumer because the instantiation cache does not span units
of work; annotating it converts that into one written type.

```ts
interface Store<T> { get(): T; set(v: T): void }
export function makeStore<T>(init: T): Store<T> { /* … */ }   // annotated on purpose
```

Keep the wiki's own limit in view — *"Type inference is very convenient, so there's no need to
do this universally"* — so the target is **exported functions whose returns compose derived
types**, which is also exactly the population that can hit `TS7056`.

## Step 5 · Cap recursion, and say what the cap is

An uncapped recursive type stops when the compiler does, at `instantiationDepth === 100`. A
chosen limit is a contract; the compiler's limit is an accident. The construction belongs to
[11 · Recursive types · chunk 05](../11-recursive-types/05-capping-depth-deliberately.md); the decision belongs here, and it has two parts:
**pick the depth, and decide whether exceeding it errors or silently stops.**

## Step 6 · Reduce the surface, not the type

When the input is generated — an API client, a schema bundle — no amount of type cleverness
helps, because the size is the problem
([topic 08 · chunk 09](../08-knowing-when-to-stop/09-the-boundary-and-the-generator.md)):

- narrow what the generator emits;
- re-export a small hand-written façade and let application code import that;
- resolve the genericity once at the boundary rather than in every consumer.

## Step 7 · Only now, measure

Everything above is defensible without a measurement because each step relieves a budget you
can identify from the diagnostic. Beyond it, **stop guessing** — the compiler reports where
time went and can emit a trace, and that toolchain is **phase 12 · Tooling, performance and
testing**'s subject *(not written yet)*.

⚠️ **Measure in the place the symptom is.** The editor re-derives per keystroke and `tsc` runs
once, so improving one proves nothing about the other
([chunk 03](./03-what-makes-it-slow.md)).

## The order, condensed

1. Identify the budget from the diagnostic.
2. Name intermediates; hoist them to module top level.
3. Narrow the widest union on the path — multiply the counts first.
4. Interfaces instead of intersections, hottest signatures first.
5. Annotate exported returns that compose derived types.
6. Cap recursion deliberately and document the cap.
7. Shrink generated surfaces rather than optimising types over them.
8. Then measure, with phase 12's tools, where the symptom actually is.

## Gotchas

**Symptom:** You applied every fix and the diagnostic did not change.
**Cause:** Wrong budget — a depth fix against a count problem, or vice versa.
**Fix:** Step 0's table. `TS2859` and `TS2321` in particular demand opposite remedies.

**Symptom:** Naming intermediates made no difference.
**Cause:** The names are declared but the signatures still inline the structural form, or the
aliases sit inside a function body.
**Fix:** Use the names where the types are used, and hoist them to module top level.

**Symptom:** Narrowing a union helped locally and something else got slower.
**Cause:** Plausible: the relation cache's contents changed, and the comparison budget is
`(16e6 − relation.size) >> 3`.
**Fix:** Judge the project, not the file. And do not chase it without measuring — this is the
point where step 7 begins.

**Symptom:** Converting intersections to interfaces was a large diff with no visible gain.
**Cause:** It was applied to cold types.
**Fix:** Target types used in many signatures. Frequency is the multiplier, not size.

**Symptom:** Annotating every return type made the codebase worse to work in.
**Cause:** The wiki's caveat ignored — inference is convenient and the advice is not universal.
**Fix:** Annotate exported functions composing derived types; leave locals inferred.

**Symptom:** A depth cap was added and callers now silently get a truncated type.
**Cause:** The cap was chosen but its behaviour was not.
**Fix:** Decide, then document: stop quietly, or produce a named error type
([topic 08 · chunk 10](../08-knowing-when-to-stop/10-keeping-the-ones-you-keep.md)).

**Symptom:** Someone optimised the mapped types over a generated API client instead of the
client.
**Cause:** Step 6 skipped — the surface is the cost.
**Fix:** Narrow the generation or add a façade; the types over it were never the problem.

**Symptom:** A change was declared a win on the strength of one local `tsc` run.
**Cause:** No baseline, and possibly the wrong environment for the symptom.
**Fix:** Phase 12's tooling, in the place the symptom appears, with the cache state controlled.

## Interview questions

**★ Where do you start when type checking is slow?**
By reading the diagnostic to identify *which* budget ran out, because the fixes are mutually
exclusive: `TS2589` with recursion wants a depth cap, `TS2589` without it wants less work,
`TS2321` wants flatter nesting and `TS2859` wants fewer comparisons. Then the three
zero-cost steps — name intermediates and hoist them, narrow the widest union, replace hot
intersections with interfaces — all of which are justified by documented caching behaviour
rather than by a measurement.

**★ Why is naming intermediates the first fix rather than a cosmetic afterthought?**
Because the instantiation early-out needs a named alias to exist at all, its cache key is built
from the alias, and the wiki states that extracting a type alias means *"more information can be
cached by the compiler"*. It also improves every error message the type produces. No cost, two
benefits, so there is nothing to weigh.

**★ Which fix has the largest ceiling, and why?**
Narrowing the widest union on the path, because union reduction is quadratic — *"the elements
have to be compared pairwise, which is quadratic"* — and template literals or distribution turn
a few lines into a product of member counts. Halving a union quarters that term. Do the
multiplication before refactoring: a product near 100,000 confirms the cause, a product of 40
rules it out.

**★ When do you stop reasoning and start measuring?**
After the steps whose justification is structural — the ones you can defend from the
diagnostic and the documented caching behaviour. Past that, attribution needs the compiler's own
reporting and tracing, which is phase 12's territory, and it has to be done where the symptom
is: the editor re-derives per keystroke while `tsc` runs once, so a faster build is not evidence
that the editor improved.

**Why annotate only *some* return types?**
Because the wiki's advice comes with its own limit — *"Type inference is very convenient, so
there's no need to do this universally"*. The population that pays for inference is exported
functions whose returns compose derived types: every consumer re-derives them, and at the
extreme the compiler refuses to serialise the result and asks for the annotation by name
(`TS7056`). Local inference costs nothing worth reclaiming.

**A recursive type has no depth cap. Is that a correctness problem or a performance problem?**
Both, and that is the argument for capping. Without a cap the stopping condition is the
compiler's own limit of 100 instantiation levels, so the type's behaviour on deep input is
`TS2589` rather than anything you designed. Choosing the depth makes it a contract — and the
second half of the decision is whether exceeding it stops quietly or reports, because those are
different promises to a caller.

**Why can narrowing one union make an unrelated check slower?**
Because the comparison budget is sixteen million minus the relation cache's size, divided by
eight, so anything that changes what gets cached changes what other checks are allowed. It is a
real effect, it is not a reason to avoid the fix, and it is the clearest signal that further work
belongs in the measurement phase rather than in more reasoning.

**Your team wants a rule of thumb. Give one sentence.**
Name your types, keep unions small, prefer interfaces to intersections, annotate what you
export — and cap anything recursive; everything else needs a measurement before it is worth
touching.

---

← Prev: [03 · What makes it slow](./03-what-makes-it-slow.md) · [Topic index](./README.md) ·
Next → [10 · Deriving one function's type from another](../10-deriving-function-types/README.md)
