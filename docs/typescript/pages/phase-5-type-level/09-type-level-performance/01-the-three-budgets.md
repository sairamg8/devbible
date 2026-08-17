---
title: "The three budgets"
sidebar_label: "01 · The three budgets"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. 🔴 **Every limit on this page was read out of the compiler's own
> source**, not recalled — `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`,
> **TypeScript 5.9.3**: the `TS2589` guard in `instantiateTypeWithAlias`, the `overflow`
> block in `checkTypeRelatedTo` that chooses between `TS2321` and `TS2859`, and the two
> `TS2590` sites (`checkCrossProductUnion` and subtype reduction). Diagnostic wording comes
> from the same file's numbered message table and every string was confirmed present in the
> installed **TypeScript 7.0.2** native compiler. ⚠️ **The numeric constants are 5.9.3's.**
> 7.0.2 is the Go port and its constants cannot be read the same way, so they are **not**
> claimed for it — the *shape* of each limit is what transfers. **No sandbox, no console
> block**: nothing here was run, and no timing is quoted.

Type-level programming is a program the compiler runs on every keystroke. Like any program
it can be too slow — and unlike your program, it fails by **giving up**, with a diagnostic
that tells you nothing about which type was at fault unless you know how to read it.

There are **three separate budgets**, they run out in three different ways, and each has its
own diagnostic. Most confusion about "slow types" is a mix-up between them.

## Budget 1 · Instantiation — depth 100, or five million

Every time a generic type is applied to arguments, the compiler *instantiates* it. The guard
sits at the top of that function, and it is one line:

```js
// TypeScript 5.9.3, instantiateTypeWithAlias
if (instantiationDepth === 100 || instantiationCount >= 5e6) {
  error2(currentNode, Diagnostics.Type_instantiation_is_excessively_deep_and_possibly_infinite);
  return errorType;
}
```

> **`TS2589`: Type instantiation is excessively deep and possibly infinite.**

**Two different failures, one message.** That is the single most useful thing to know about
`TS2589`:

- **`instantiationDepth === 100`** — you are 100 levels *deep* in nested instantiation.
  A recursive type with no depth cap gets here on its 100th step. **The fix is a cap.**
- **`instantiationCount >= 5e6`** — five million instantiations, at any depth. Nothing is
  recursive; there is simply an enormous amount of work. **The fix is less work** — fewer
  members, fewer derived layers, a named intermediate that can be cached.

⚠️ **Reaching for a depth cap when you actually blew the count is why "I capped it and it
still fails" happens.** They are different budgets sharing a message.

📌 **`instantiationCount` is reset at several points during checking while
`totalInstantiationCount` only rises** — the count is a per-unit-of-work budget, not a
lifetime one. So the same type can pass in one position and fail in another, depending on how
much instantiation already happened nearby. That is not superstition; it is the counter being
zeroed between units.

## Budget 2 · Comparison — a budget that shrinks as your project grows

When the compiler asks *is A assignable to B*, it walks both types. Two things can go wrong,
and **both set the same `overflow` flag** — then one line decides which diagnostic you see:

```js
// TypeScript 5.9.3, checkTypeRelatedTo
let relationCount = 16e6 - relation.size >> 3;
// …
const message = relationCount <= 0
  ? Diagnostics.Excessive_complexity_comparing_types_0_and_1
  : Diagnostics.Excessive_stack_depth_comparing_types_0_and_1;
```

> **`TS2321`: Excessive stack depth comparing types `'{0}'` and `'{1}'`.**
> — the *depth* ran out: `sourceDepth === 100 || targetDepth === 100`.
>
> 🔴 **`TS2859`: Excessive complexity comparing types `'{0}'` and `'{1}'`.**
> — the *comparison budget* ran out, with depth to spare.

🔴 **These are two distinct diagnostics, and most writing about TypeScript performance only
mentions the first.** They demand opposite fixes: depth is cured by shortening or capping
recursion, complexity by reducing the **number** of comparisons — fewer union members, a base
type instead of a wide union, a named intermediate the compiler can cache.

### The part that explains a real class of bug

Read the budget expression again. JavaScript's `-` binds tighter than `>>`, so it is
`(16e6 - relation.size) >> 3` — **sixteen million minus the size of the relation cache,
divided by eight.**

> 🔴 **The comparison budget for your type depends on how much the compiler has already
> cached.** An empty cache gives roughly two million comparisons; a large project's cache has
> already eaten into the sixteen million, so the same check gets **less** budget.

That is the mechanism behind an experience people report and rarely explain: **a type that
compiles fine in a small reproduction hits `TS2859` in the real repository.** Nothing about
the type changed. Its allowance did.

📌 **The failure is then cached**, with a flag recording *which* overflow it was
(`ComplexityOverflow` or `StackDepthOverflow`), so the second identical comparison is
answered from the cache rather than re-attempted.

## Budget 3 · Union size — 100,000, and an extrapolation

Two separate sites raise the same message, and they are worth telling apart.

**The cross product**, checked *before* the work is done:

```js
// TypeScript 5.9.3, checkCrossProductUnion
const size = getCrossProductUnionSize(types);
if (size >= 1e5) {
  error2(currentNode, Diagnostics.Expression_produces_a_union_type_that_is_too_complex_to_represent);
  return false;
}
```

> **`TS2590`: Expression produces a union type that is too complex to represent.**

`getCrossProductUnionSize` **multiplies** the member counts. Five unions of ten members each
is 100,000 — exactly the limit — which is why
[topic 07](../07-template-literal-types.md)'s warning about interpolating several unions into
a template literal is not a stylistic worry. It is arithmetic against a fixed ceiling.

**Subtype reduction**, which *estimates*:

```js
// TypeScript 5.9.3, inside subtype reduction
if (count === 1e5) {
  const estimatedCount = count / (len - i) * len;
  if (estimatedCount > 1e6) {
    error2(currentNode, Diagnostics.Expression_produces_a_union_type_that_is_too_complex_to_represent);
```

After 100,000 pairwise comparisons it extrapolates from progress so far; if the projected
total exceeds a million it stops. This is the concrete form of the wiki's *"to eliminate
redundant members from a union, the elements have to be compared pairwise, which is
quadratic"* — the quadratic term is being measured, and abandoned when the projection is
hopeless.

⚠️ **So `TS2590` can arrive from a union you never wrote down**, produced by distribution
([topic 05](../05-distributive-conditionals.md)) rather than by enumeration.

## The three, side by side

| Budget | Runs out when | Diagnostic | The fix |
|---|---|---|---|
| **Instantiation depth** | 100 levels deep | `TS2589` | cap the recursion |
| **Instantiation count** | 5,000,000 instantiations | `TS2589` — *same message* | less work: fewer layers, named intermediates |
| **Comparison depth** | `sourceDepth`/`targetDepth` hits 100 | `TS2321` | shorten or cap the nesting |
| **Comparison budget** | `(16e6 − cacheSize) >> 3` exhausted | 🔴 `TS2859` | fewer comparisons; **and it shrinks as the project grows** |
| **Cross-product size** | product of union sizes ≥ 100,000 | `TS2590` | fewer/smaller interpolated unions |
| **Subtype reduction** | projected comparisons > 1,000,000 | `TS2590` — *same message* | narrow the union at its source |

**Two messages cover six failures**, which is exactly why "I hit `TS2589`, so I added a depth
cap" is a coin flip rather than a diagnosis.

## Gotchas

**Symptom:** `TS2589`, you added a depth cap, and it still fires.
**Cause:** You blew the *count* (5,000,000 instantiations), not the *depth* (100).
**Fix:** Reduce total work — fewer derived layers, fewer union members flowing through,
named intermediates that can be cached.

**Symptom:** `TS2589` from a type with no recursion in it at all.
**Cause:** Same thing — the count budget has nothing to do with recursion.
**Fix:** Look for a wide union being mapped, or a chain of generics applied per member.

**Symptom:** A type compiles in a minimal reproduction and fails in the real project.
**Cause:** The comparison budget is `(16e6 − relation cache size) >> 3`, so a big project
leaves less of it.
**Fix:** Reduce the comparisons this check needs. Do **not** conclude the reproduction was
invalid — it was, for a smaller allowance.

**Symptom:** `TS2859` and reducing nesting depth changed nothing.
**Cause:** Wrong budget. `TS2859` is the complexity/count budget; `TS2321` is the depth one.
**Fix:** Cut the *number* of comparisons: fewer union members, a base type instead of a wide
union, a named intermediate.

**Symptom:** `TS2321` and simplifying the union changed nothing.
**Cause:** The mirror image — this one really is depth.
**Fix:** Flatten the nesting, or cap the recursion.

**Symptom:** `TS2590` from an expression with no unions written in it.
**Cause:** Distribution produced the union, or subtype reduction extrapolated past a million.
**Fix:** Stop the distribution ([topic 05](../05-distributive-conditionals.md)) or narrow the
union where it originates.

**Symptom:** `TS2590` appeared after adding one member to a small union.
**Cause:** Cross products multiply — three unions of 40, 40 and 63 members is under the limit
and 40 × 40 × 64 is over it.
**Fix:** Count the product, not the members.

**Symptom:** The same failing comparison is instant the second time.
**Cause:** The overflow was cached in the relation cache with its overflow flag.
**Fix:** Nothing to fix — but do not read the speed as progress.

## Interview questions

**★ `TS2589` says "excessively deep and possibly infinite". What are the two ways to get
it?**
The guard is `instantiationDepth === 100 || instantiationCount >= 5e6`, so either 100 levels
of nested instantiation — the recursive case, cured by a depth cap — or five million
instantiations at any depth, which is simply too much work and is cured by doing less of it.
One message, two causes, opposite fixes; that is why capping recursion sometimes changes
nothing.

**★ What is the difference between `TS2321` and `TS2859`?**
Both come from the same `overflow` flag in `checkTypeRelatedTo`, and one line picks the
message: if the comparison budget ran out you get `TS2859` *"Excessive complexity comparing
types"*, and if the depth counters hit 100 you get `TS2321` *"Excessive stack depth comparing
types"*. Complexity means too many comparisons — fewer union members, a base type, a cached
named intermediate. Depth means too much nesting — flatten or cap it.

**★ Why can a type compile in a small reproduction and fail in a large project?**
Because the comparison budget is `(16e6 − relation.size) >> 3` — sixteen million minus the
current size of the relation cache, divided by eight. A big project has already filled the
cache, so the same check is given a smaller allowance and can exhaust it. The type did not
change; its budget did. This is the honest answer to "it works in the playground".

**★ How does `TS2590` actually get triggered?**
Two ways. `checkCrossProductUnion` multiplies the member counts of the unions involved and
refuses at 100,000 or more — five unions of ten members is exactly the ceiling. And subtype
reduction, after 100,000 pairwise comparisons, extrapolates the total and gives up if the
projection exceeds a million. The second is the quadratic union-reduction cost being measured
and abandoned, which is why the error can come from a union you never wrote.

**Why does the number of *distinct* budgets matter in practice?**
Because two diagnostics cover six failures, so the message alone does not identify the cause.
Knowing which budget ran out is what turns "add a depth cap and hope" into a decision: cap
recursion for depth, reduce work for counts, shrink unions for cross products, and reduce
comparison volume for complexity.

**What does the compiler do with a failed comparison?**
Caches it, tagged with which overflow occurred — `ComplexityOverflow` or
`StackDepthOverflow`. So the second identical comparison returns immediately from the cache.
That makes a re-check feel fast without anything having improved, and it is worth knowing
before concluding that a change helped.

**Are these constants safe to quote as facts about TypeScript?**
They are facts about **5.9.3's checker**, read from its source. The 7.0.2 native compiler is
a port, and its constants cannot be read the same way, so quoting 100 and five million *for
7.0.2* would be an assumption. What transfers is the shape: separate budgets for depth,
count, comparison and union size, with two messages covering them.

---

← [Topic index](./README.md) · Next → [02 · Caching, and why naming is a performance fix](./02-caching-and-naming.md)
