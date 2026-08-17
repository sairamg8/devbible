---
title: "The shapes that are slow"
sidebar_label: "02 · The shapes that are slow"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript wiki's Performance** page — *Naming
> Complex Types*, *Using Type Annotations*, *Preferring Interfaces Over
> Intersections*, *Preferring Base Types Over Unions* — and the **handbook**. The
> checker's limits are
> [phase 5 · 09](../../phase-5-type-level/09-type-level-performance/README.md)'s,
> read from the 5.9.3 source and **linked rather than re-derived**. ⚠️ **No timing
> figure here is ours**, and the shapes below are ranked **by which budget they
> consume**, not by seconds — because no measurement of ours covers them.
> **No console block.**

[Chunk 01](./01-measure-before-you-guess.md) gets you to *"the time is in
checking"*. This chunk is what you are then looking for.

> 🔴 **Rank by budget, not by how clever the type looks.** The compiler has
> **separate** limits — instantiation depth, instantiation count, comparison count,
> union cross-product size — and a shape is slow because it exhausts a *particular*
> one. Knowing which tells you the fix.

## The four shapes, by the budget they consume

| Shape | Budget it eats | Why |
|---|---|---|
| 🔴 **Deep recursive conditionals** | **instantiation depth** | each level re-instantiates; the depth limit is a hard wall |
| 🔴 **`DeepPartial` / `DeepReadonly` over a large type** | **instantiation count** | recursion × every property, at every level |
| **Large union × large union** | **cross-product size** | comparisons multiply rather than add |
| **Wide intersections** | **comparison count** | every member compared against every member |

📌 **Two of the four are the same construct at different scales**, which is why
`DeepPartial` is the canonical example: it is a recursive conditional *applied to
every property of a large object type*, so it consumes both depth and count.

## The fixes, from the compiler's own guidance

The wiki's Performance page is unusually direct, and four of its recommendations map
straight onto the shapes above:

1. 🔴 **Name complex types** — *Naming Complex Types*. A named type alias gives the
   checker something to cache and compare by identity; an inline anonymous type is
   re-elaborated at every use.
2. 🔴 **Add type annotations** — *Using Type Annotations*. **An annotation is a
   short-circuit**: the checker verifies rather than infers, and inference is the
   expensive half. ⚠️ This is the single highest-leverage change on most slow
   projects, and it is also the least fashionable, because "let it infer" reads as
   cleaner.
3. **Prefer interfaces over intersections** — *Preferring Interfaces Over
   Intersections*. An interface's members are resolved once; an intersection is
   re-flattened.
4. **Prefer base types over unions** — *Preferring Base Types Over Unions*. A union
   of many object types is compared member by member; a common base is compared
   once.

⚠️ **Note that three of the four are ordinary design advice** that happens to also be
the performance advice. **That is the useful shape of this topic: the fast types are
mostly the readable ones**, which is not true of most performance work.

## 🔴 Where to put the annotation

Not everywhere — **annotate where inference has to cross a boundary**, because that
is where a computed type gets re-derived by every consumer:

- **Exported function return types.** 🔴 The highest-value position: it stops the
  inference at the module edge, and it is also what
  [topic 03 · chunk 01](../03-build-pipelines/01-four-jobs-not-one.md) says makes
  **declaration emit** cheap — the same annotation pays twice.
- **Large object literals** that feed into a generic.
- **The result of a heavy type-level computation**, assigned to a named alias.

📌 **`isolatedDeclarations` is this advice turned into a compiler-enforced rule** —
it requires exactly the annotations that make declaration emit per-file, which is
why it appears in a performance discussion at all. **Phase 6 · 15** owns it.

## The trap: raising the limit

When a type hits `TS2589`, the reflex is to add a depth cap or restructure until the
error disappears.

⚠️ **The error is a symptom of two different failures with one message** — the depth
limit and the instantiation count — so the usual "add a depth cap" fix is a coin
flip on whether it addresses the one you have
([phase 5 · 09](../../phase-5-type-level/09-type-level-performance/README.md)).

🔴 **And silencing it does not make the type cheap — it makes it just cheap enough to
finish.** The check still runs, still consumes the budget, and still slows every
build. **The question worth asking is the one from
[phase 5 · 08](../../phase-5-type-level/08-knowing-when-to-stop/README.md): should
this type exist?** A hand-written union of twelve members is free; a computed one
that derives the same twelve is not.

## Barrel files, again — for a second reason

[Chunk 01](./01-measure-before-you-guess.md) named barrels as a *program-size*
problem. They are also a *checking* problem: a barrel makes every consumer's module
graph wider, so more types are in scope, so more comparisons are possible.

⚠️ **This is why "we removed the barrel and the build got faster" is a common and
confusing report** — the fix addressed two different costs at once, which makes it
look larger than any single explanation predicts.

## Gotchas

**Symptom:** a type was simplified and the build did not speed up.
**Cause:** it was consuming a different budget from the one the change addressed.
**Fix:** 🔴 identify the budget first — depth, count, cross-product or comparisons.
"Looks complicated" is not a diagnosis.

**Symptom:** `TS2589`, and adding a depth cap did not help.
**Cause:** the failure was the instantiation *count*, not the depth. One message,
two limits.
**Fix:** split the expression into named intermediates, which resets the counter —
and ask whether the type should exist.

**Symptom:** the type-level code was made to compile and the build is still slow.
**Cause:** silencing the limit made it *just* finish; the work is still being done
on every build.
**Fix:** ⚠️ the error is a budget warning, not the cost. Fixing the error and fixing
the cost are different jobs.

**Symptom:** adding annotations feels like it should not matter.
**Cause:** it reads as redundant when the compiler could work it out.
**Fix:** 🔴 that is exactly the point — **the working-out is the expensive part.** An
annotation converts inference into verification, and the wiki's own guidance names
it.

**Symptom:** an exported function's return type is a large computed type.
**Cause:** no annotation at the module boundary.
**Fix:** annotate it. 📌 It pays twice — cheaper checking, and cheaper declaration
emit, which is the same thing `isolatedDeclarations` enforces.

**Symptom:** removing a barrel file produced a bigger speedup than expected.
**Cause:** it was costing you twice — program size *and* checking surface.
**Fix:** nothing to fix; worth knowing so the result is not treated as unexplained.

**Symptom:** a union of many object types is compared repeatedly.
**Cause:** each comparison walks every member.
**Fix:** a common base type, per the wiki's *Preferring Base Types Over Unions*. ⚠️
Usually a better model as well as a faster one.

## Interview questions

**How do you decide which slow type to fix first?**
By which budget it consumes rather than by how complicated it looks. The compiler
has separate limits — instantiation depth, instantiation count, union cross-product
size, comparison count — and a shape is slow because it exhausts a particular one.
`DeepPartial` over a large type is the canonical case because it eats two: recursion
depth and count across every property.

**What is the highest-leverage change on a slow project?**
Adding type annotations, especially on exported function return types. An annotation
turns inference into verification, and inference is the expensive half — so it
short-circuits the work rather than reorganising it. It is also the least fashionable
fix, because "let it infer" reads as cleaner code.

**Why does annotating exported return types pay twice?**
It stops inference at the module boundary for checking, and it is also what makes
declaration emit cheap, since the compiler no longer has to infer a type to write
into the `.d.ts`. That is precisely the requirement `isolatedDeclarations` codifies.

**`TS2589` appeared and adding a depth cap did not fix it. Why?**
Because one message covers two limits — instantiation depth and instantiation count
— so a depth cap addresses only one of them. The counter resets per expression, so
splitting a chain into named intermediates is a real fix, and the more useful
question is whether the computed type needs to exist at all.

**Is fixing the error the same as fixing the cost?**
No, and this is where a lot of effort is wasted. Silencing a limit makes the type
just cheap enough to finish; the work still runs on every build. The error is a
budget warning, not the expense itself.

**Why is this topic's advice unusually palatable?**
Because three of the four fixes are ordinary design advice — name your complex types,
annotate your boundaries, prefer interfaces to intersections, prefer a base type to a
wide union. The fast types are mostly the readable ones, which is not true of most
performance work and is worth leaning on when arguing for the change.

---

← [01 · Measure before you guess](./01-measure-before-you-guess.md) · [Topic index](./README.md) · [Phase 12 index](../README.md)
