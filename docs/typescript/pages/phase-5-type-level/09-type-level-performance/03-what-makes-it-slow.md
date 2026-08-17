---
title: "What actually makes a codebase slow"
sidebar_label: "03 · What makes it slow"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript wiki, *Performance*** — *Preferring Base Types
> Over Unions*, *Preferring Interfaces Over Intersections* and *Using Type Annotations* are
> **quoted verbatim** — and against the limits read out of **TypeScript 5.9.3**'s checker in
> [chunk 01](./01-the-three-budgets.md). `TS7056` is from the same file's message table and is
> confirmed in **7.0.2**. **No sandbox, no console block, and no timings** — nothing here was
> measured on this machine, so the causes below are ranked by **which budget they consume**,
> which is checkable, rather than by seconds, which is not. The ordering is **judgement**.

The budgets in [chunk 01](./01-the-three-budgets.md) are consumed by a small number of shapes.
This chunk is the list, worst first — and "worst" means **multiplicative**: the shapes that
turn a linear amount of code into a quadratic or exponential amount of checking.

⚠️ **Read the ranking as "where to look", not "what is slow in your project".** Attributing a
slow build without measuring it is guessing; the measuring tools are the toolchain's, and they
belong to **phase 12 · Tooling, performance and testing** *(not written yet)*, which owns
`--extendedDiagnostics` and `--generateTrace`.

## 1 · Wide unions — the quadratic one

> to eliminate redundant members from a union, the elements have to be compared pairwise,
> which is quadratic

— *TypeScript wiki, Performance → Preferring Base Types Over Unions*

Quadratic is the whole problem: **doubling the members quadruples the comparisons.** And
[chunk 01](./01-the-three-budgets.md) showed the compiler measuring exactly this — after
100,000 pairwise comparisons it extrapolates, and abandons with `TS2590` if the projection
passes a million.

Three ways a union gets wide without anyone deciding to widen it:

```ts
// 1 · a template literal over several unions — the members MULTIPLY
type Key = `${Lang}_${Section}_${Field}`;      // 12 × 20 × 40 = 9,600

// 2 · distribution over a union, once per member
type Wrapped<T> = T extends unknown ? Box<T> : never;   // one Box per member

// 3 · a mapped type over a union of keys, itself derived from a union
type Table = { [K in AllKeys]: Row<K> };
```

The wiki's remedy is structural:

> One way to avoid this is to use subtypes, rather than unions.

📌 **The tell:** the union is not written anywhere. If you cannot point at the line that lists
the members, they were computed — which means the count is a product, and products get large
without looking large.

## 2 · Nested conditionals over unions — multiplication, not addition

A conditional chain is not four checks; it is four checks **per union member**, and each branch
may itself distribute ([topic 05](../05-distributive-conditionals.md)).

```ts
// four conditionals over a five-member union: twenty resolutions, each able to distribute
type Classify<T> =
  T extends A ? X :
  T extends B ? Y :
  T extends C ? Z :
  T extends D ? W : never;
```

That is instantiation *count*, not depth — so it fails as `TS2589` **with no recursion
anywhere**, which is the single most misdiagnosed shape in this phase.

⚠️ **Adding one case to a chain over a wide union is never a one-line change in cost.**

## 3 · Intersections where an interface would do

> Type relationships between interfaces are also cached, as opposed to intersection types as a
> whole.

— *TypeScript wiki, Performance → Preferring Interfaces Over Intersections*

An interface's assignability answer is **one cacheable relationship**; an intersection is
compared **constituent by constituent, every time**. So `A & B & C & D` in a hot signature is
four comparisons per check that an `interface … extends A, B, C, D` would have made one — and
the error message improves at the same time
([topic 08 · chunk 08](../08-knowing-when-to-stop/08-structure-and-tooling.md)).

## 4 · Inferred return types nobody wrote down

> Adding type annotations, especially return types, can save the compiler a lot of work.

— *TypeScript wiki, Performance → Using Type Annotations*

An un-annotated return type must be **re-derived from the body**, and if the body composes
derived types the whole computation is the return type. Two consequences:

- Every caller pays for the derivation, since the per-mapper cache does not span units of work
  ([chunk 02](./02-caching-and-naming.md)).
- Declaration emit can refuse outright:
  **`TS7056`: The inferred type of this node exceeds the maximum length the compiler will
  serialize. An explicit type annotation is needed.**

The wiki's own caveat still applies — *"Type inference is very convenient, so there's no need
to do this universally"* — so the target is **exported** functions whose returns are composed
of derived types, not every local arrow.

## 5 · Recursion with no cap

A recursive type walks until it stops. With no depth limit the stopping condition is the
compiler's: `instantiationDepth === 100`, i.e. `TS2589` on somebody else's deeper data. The
counter-construction — a fixed-length tuple used as a depth budget — belongs to
[11 · Recursive types · chunk 05](../11-recursive-types/05-capping-depth-deliberately.md); what belongs here is that **an uncapped recursive
type has a performance profile you did not choose.**

## 6 · Mapped types over very large object types

The usual source is generated code: an API client with 400 shapes, a database schema, a
protobuf bundle. `keyof` over a 400-property type is fine; **a mapped type over it, then
`Partial` of that, then indexed access into it per call site** is the shape that makes an
editor feel broken while the build merely feels slow.

📌 **This is the case where the fix is not a better type**: narrow the generation scope, or
re-export a small hand-written façade
([topic 08 · chunk 09](../08-knowing-when-to-stop/09-the-boundary-and-the-generator.md)).

## 7 · The editor pays a different bill from the build

`tsc` checks once. The language server re-derives **on keystrokes**, for the file you are in
and everything it touches, and it has no incremental cache across edits inside a single file's
check. So the symptom people actually report — *"the editor lags in this file"* — is often a
type that the build handles acceptably.

⚠️ **Consequence for judging a change:** a faster `tsc --noEmit` does not prove the editor got
better, and a snappier editor does not prove CI did.

## The shapes, ranked by the budget they burn

| # | Shape | Budget consumed | Growth |
|---|---|---|---|
| 1 | Wide / computed unions | subtype reduction, cross product | **quadratic**, or a product |
| 2 | Nested conditionals over unions | instantiation **count** | multiplicative |
| 3 | Intersections in hot signatures | comparison count | linear per constituent, per check |
| 4 | Un-annotated composed returns | instantiation, per caller | linear per call site |
| 5 | Uncapped recursion | instantiation **depth** | unbounded by input |
| 6 | Mapped types over generated shapes | instantiation count, relation cache | linear but enormous |
| 7 | Any of the above, in an open editor | all of them, per keystroke | ×keystrokes |

## Gotchas

**Symptom:** `TS2589` in a type with no recursion.
**Cause:** Shape 2 — instantiation *count*, not depth. Conditionals multiply over union
members.
**Fix:** Reduce the union, or replace the chain with a lookup
([topic 08 · chunk 08](../08-knowing-when-to-stop/08-structure-and-tooling.md)).

**Symptom:** A union you never wrote has hundreds of members.
**Cause:** A template literal over several unions, or distribution.
**Fix:** Match with `infer` instead of enumerating
([topic 06 · chunk 02](../06-infer/02-strings-and-your-own.md)); stop the distribution with the
bracket form ([topic 05](../05-distributive-conditionals.md)).

**Symptom:** The build is tolerable and one file's editor experience is terrible.
**Cause:** Shape 7 — the language server re-derives per keystroke.
**Fix:** Annotate that file's exported returns and name the intermediates; judge the fix in the
editor, not in CI.

**Symptom:** `TS7056` on an exported helper.
**Cause:** Shape 4 — the inferred return is too large to serialise.
**Fix:** Write the annotation. It is faster to check, better in errors, and stable
([topic 08 · chunk 05](../08-knowing-when-to-stop/05-is-a-type-the-tool.md)).

**Symptom:** Adding a field to a generated API type slowed everything.
**Cause:** Shape 6 — the mapped types over it re-derive with one more property each, at every
use.
**Fix:** Narrow the generation, or put a façade in front of it.

**Symptom:** Swapping `A & B & C` for an interface improved compile time *and* the errors.
**Cause:** Shape 3, and the documented caching difference.
**Fix:** Nothing — expected.

**Symptom:** You reduced nesting depth and nothing improved.
**Cause:** You were burning count or comparison budget, not depth.
**Fix:** [Chunk 01](./01-the-three-budgets.md)'s table — identify the budget from the
diagnostic before choosing the fix.

**Symptom:** Someone "proved" a type is slow by commenting it out and timing the build.
**Cause:** Removing a type also removes every check that depended on it, so the comparison is
not like-for-like.
**Fix:** Treat it as a hint, not a measurement. Real attribution needs the toolchain in
**phase 12** *(not written yet)*.

## Interview questions

**★ Which single shape is most likely to be the cause of slow type checking?**
A wide union — especially one produced rather than written. Subtype reduction compares members
*"pairwise, which is quadratic"*, so doubling the members quadruples the work, and template
literals or distribution can create hundreds of members from a few lines. The compiler's own
`TS2590` sites exist precisely because this is the shape that runs away.

**★ Why can `TS2589` appear in a type with no recursion at all?**
Because its guard is `instantiationDepth === 100 || instantiationCount >= 5e6`, and the second
arm has nothing to do with recursion. A chain of four conditionals over a five-member union is
twenty resolutions, each potentially distributing again; enough of that reaches five million
instantiations at trivial depth. It is the most misdiagnosed shape in the phase, because the
message says "possibly infinite".

**★ Why is an annotated return type a performance change and not just documentation?**
Because an un-annotated return must be re-derived from the body, and the per-mapper
instantiation cache does not span units of work — so every caller pays. The wiki states it
directly: *"Adding type annotations, especially return types, can save the compiler a lot of
work."* At the extreme the compiler refuses to serialise the inferred type at all and asks for
the annotation by name, which is `TS7056`. The caveat matters too — the target is exported
functions composing derived types, not every local.

**★ The editor lags but CI is fine. What does that tell you?**
That the cost is per-keystroke rather than per-build: the language server re-derives the types
in the file you are editing and everything it touches, with no cache across edits inside one
check. It also means a faster `tsc --noEmit` is not evidence that you fixed the editor, and the
reverse. Judge the change where the symptom is.

**Why do intersections cost more than interfaces in a hot signature?**
Because *"Type relationships between interfaces are also cached, as opposed to intersection
types as a whole"*. An interface has one cacheable relationship; `A & B & C & D` is compared
constituent by constituent on every check. In a signature used in hundreds of places that is a
multiplier, and switching to `interface … extends` also flattens what the error messages print.

**How would you actually attribute a slow build rather than guess?**
With the toolchain, not by reading types: the compiler can report where time went and can emit
a trace. That is **phase 12**'s subject *(not written yet)*, and it is deliberately not
developed here. What this page gives you is the *shortlist* to check first, derived from which
budget each shape consumes — which is verifiable from the checker's source even without a
measurement.

**Is "comment it out and time the build" a valid experiment?**
Only as a hint. Removing a type removes every check that depended on it, so the two builds are
not comparable — you have deleted work as well as cost. It also cannot distinguish the budgets:
you learn something got faster, not whether it was depth, count, comparison volume or union
size.

---

← Prev: [02 · Caching and naming](./02-caching-and-naming.md) · [Topic index](./README.md) ·
Next → [04 · The fixes, in order](./04-the-fixes-in-order.md)
