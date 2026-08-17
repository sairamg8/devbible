---
title: "The cost, and the alternatives"
sidebar_label: "05 · The cost and the alternatives"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. The instantiation and caching mechanisms are
> [topic 09 · chunk 01](../09-type-level-performance/01-the-three-budgets.md) and
> [chunk 02](../09-type-level-performance/02-caching-and-naming.md)'s reads of the **5.9.3**
> checker, reused rather than re-derived. ⚠️ **No timings are given anywhere here** — no
> sandbox covers this phase, so the costs are ranked by **which budget they consume**, not
> by seconds. **No sandbox, no console block.**

The guarded helper from [chunk 03](./03-the-version-that-holds-up.md) is correct. This chunk
is about whether you should use it, which is a different question, and it has a cheap answer
most of the time.

## Why this type is expensive, mechanically

Three multiplications stack, and none of them is the recursion depth people worry about.

**1. It fans out.** [Topic 11 · chunk 04](../11-recursive-types/04-the-fine-print.md)
established that object recursion has one branch per property rather than one per step. A
shape with ten properties at each of four levels is not forty pieces of work — the branches
multiply, and the depth is an exponent rather than a count.

**2. Each node pays for every guard.** The five conditionals in the guarded version are not
evaluated once; they are evaluated at every property of every object at every level. Adding
a sixth class to the list is not one more line of cost, it is one more test per node.

**3. It is re-done per use, per file, per keystroke.**
[Topic 09 · chunk 02](../09-type-level-performance/02-caching-and-naming.md) read the
instantiation cache and found it is **per active mapper** and cleared when the mapper pops —
so one derived type used in twenty files is twenty pieces of work, and an editor redoes them
as you type.

🔴 **Multiply those together and you have the phase's most expensive routine shape.** Not
because any one of them is severe, but because they compose, and because a deep helper is
typically applied to the largest type in the codebase.

## The error messages are the part people underestimate

A deep helper's output is a **structurally expanded** type. When something does not fit, the
checker reports on the type it produced — not on the helper that produced it
([topic 08 · chunk 01](../08-knowing-when-to-stop/01-the-error-is-the-interface.md)) — so a
single wrong leaf produces a message containing the whole tree, truncated at the
`defaultMaximumTruncationLength` of 160 characters and therefore ending mid-structure.

The practical shape of this: **one property is wrong at depth four, and the error names the
root.** The reader cannot see which leaf failed, and the truncation removes exactly the part
that would have told them.

📌 **That is the argument for applying it at a boundary rather than everywhere.** Fewer
places where a mismatch can be reported means fewer places where an unreadable message can
appear.

## The fixes, cheapest first

None of these needs a measurement, which is deliberate — the same ordering principle as
[topic 09 · chunk 04](../09-type-level-performance/04-the-fixes-in-order.md).

1. **Resolve it once and export the result.**

   ```ts
   // not: DeepReadonly<Config> at twenty use sites
   export type ReadonlyConfig = DeepReadonly<Config>;
   ```

   A named top-level alias is the shape the instantiation cache can actually help with, and
   it gives every error message a short name instead of an expanded tree. ⚠️ Keep it at
   **module top level** — topic 09 found that a type alias declared inside a function body
   is not eligible for the cheapest early-out.

2. **Apply it to the subtree that needs it.** `DeepReadonly<Config["theme"]>` instead of the
   whole config. Most requirements are about one branch of the tree, and the cost is
   proportional to what you hand it.

3. **Cap the depth deliberately**
   ([topic 11 · chunk 05](../11-recursive-types/05-capping-depth-deliberately.md)) — with the
   number chosen from your data and a decision recorded about what happens at the cap.

4. **Write it by hand.** For a shape that is small and stable, two hand-written interfaces
   beat a computed type on every axis that matters: the hover is readable, the error names
   the field, and nobody has to understand five conditionals to change it.
   [Topic 08 · chunk 06](../08-knowing-when-to-stop/06-what-to-write-instead.md) makes this
   case in full, and this is the topic it was written for.

5. **Generate it.** If the shape comes from a schema, an OpenAPI document or a database, the
   deep-readonly version is a codegen output, not a computed type
   ([topic 08 · chunk 09](../08-knowing-when-to-stop/09-the-boundary-and-the-generator.md)).

6. **Use something that is not a type.** `Object.freeze` gives runtime immutability that
   `readonly` never claimed to
   ([phase 1 · topic 14](../../phase-1-type-vocabulary/14-readonly-and-immutability.md)); a
   validator gives a type from a check rather than from a mapping; `satisfies` keeps a
   literal's precise type without transforming anything.

## The library option, and what you are actually buying

Published deep helpers exist, and it is worth being precise about what they give you: **not
the mapped type — the guard list.** [Chunk 03](./03-the-version-that-holds-up.md)'s third
limit was that the list of non-data classes is hand-maintained and finite. A maintained
library is someone else maintaining it, across TypeScript versions and `lib` changes.

That is a real service, and it is the only part that was hard. ⚠️ **Check the specific
library's documentation for which classes it handles and how it treats arrays and tuples**
before adopting it — those are exactly the decisions [chunk 03](./03-the-version-that-holds-up.md)
showed can go either way, and they are not interchangeable between implementations.

## When a deep helper earns it

All of these together, not any one:

- **the shape is data** — no methods, no class instances, no `Map`/`Set`;
- **you own it**, so a new nested class cannot appear from a dependency;
- **it is shallow enough to name a depth** — three or four levels, not "arbitrary JSON";
- **it is applied at one boundary** and the result is exported under a name;
- **the alternative is worse** — the hand-written version would be hundreds of lines and
  would drift from the original.

A frozen configuration tree meets all five. A domain model with an ORM entity in it meets
none, and that is the common case.

🔴 **The honest summary of this topic: `DeepReadonly` over a config tree is a good use of
the type system, and `DeepPartial` over a domain model is usually a design decision being
made accidentally.** Everything in the five chunks is downstream of that sentence.

## Gotchas

**Symptom:** The editor slowed noticeably after a deep helper was introduced, but `tsc
--noEmit` looks fine.
**Cause:** The bill is per use, per file and per keystroke; a batch compile amortises what an
editor pays continuously.
**Fix:** Resolve to a named alias at one boundary. A faster `tsc` is not evidence the editor
improved — that is topic 09's warning, and this is where it bites.

**Symptom:** A one-property mismatch produces an error naming the root type.
**Cause:** The checker reports on the produced type, and the produced type is the whole
expanded tree.
**Fix:** Name the resolved type, apply it to a smaller subtree, or hand-write it. There is no
way to make the expanded form report well.

**Symptom:** The error message stops mid-structure.
**Cause:** Truncation at 160 characters, which lands inside the tree rather than at a
boundary.
**Fix:** `noErrorTruncation` while debugging only — it makes every other message longer too.

**Symptom:** Adding one more class to the guard list made everything slower.
**Cause:** Guards are evaluated per node, so a guard is a cost multiplied by the size of the
input, not a fixed line.
**Fix:** Order the guards so the common cases exit early, and question whether the class
belongs in the input at all.

**Symptom:** The helper is fine in the file that defines it and slow everywhere it is used.
**Cause:** The instantiation cache is per active mapper and is cleared when the mapper pops.
**Fix:** Export the resolved type rather than the generic helper, so consumers import a
result instead of re-computing one.

**Symptom:** A hand-written version was rejected in review as "duplication".
**Cause:** It looks like duplication and is not — the computed version is a *program* whose
output nobody has read.
**Fix:** Compare them on the three things that matter: what the hover shows, what the error
says, and who can change it. For a small stable shape the hand-written one wins all three.

**Symptom:** You adopted a library helper and behaviour changed for tuples.
**Cause:** Array and tuple handling is a genuine design choice
([chunk 03](./03-the-version-that-holds-up.md)) and implementations differ.
**Fix:** Read that library's documentation on arrays specifically, and test a tuple before
migrating.

**Symptom:** `Object.freeze` was added *and* `DeepReadonly`, and nested objects still mutate.
**Cause:** `Object.freeze` is one level deep too. The type and the runtime call have the same
shallow/deep distinction, and neither implies the other.
**Fix:** A recursive freeze if you need it at runtime — and note that this is the one place
where the deep type and a deep runtime operation genuinely pair up.

## Interview questions

**★ Why is a deep helper expensive, and which budget does it spend?**
Three things multiply. Object recursion fans out — one branch per property, so depth is an
exponent rather than a count. Every guard is evaluated at every node, so the conditional
stack is a per-node cost. And the instantiation cache is per active mapper and cleared when
the mapper pops, so the work is redone per use, per consuming file, and per keystroke in an
editor. It is the instantiation budget that gets spent, not the recursion depth people
expect.

**★ Why are the error messages the underrated cost?**
Because the checker reports on the type the helper produced, not on the helper, and the
produced type is the fully expanded structure. A single wrong leaf at depth four yields a
message naming the root, containing the whole tree, and truncated at 160 characters — which
removes exactly the part identifying the leaf. The type is being paid for by every reader of
every future error.

**★ Give the fixes in order, without measuring anything.**
Resolve it once into a named top-level alias and export that. Apply it to the subtree that
actually needs it rather than the root. Cap the depth deliberately. Hand-write it if the
shape is small and stable. Generate it if the shape comes from a schema. And consider that
the requirement may not need a type at all — `Object.freeze`, a validator, or `satisfies`.

**★ What do you actually get from a published deep-helper library?**
The guard list, maintained. The mapped type is four lines that anyone can write; the hard
part is the finite, hand-maintained list of non-data classes that must be handed back
untouched, kept current across TypeScript and `lib` versions. That is worth paying for —
but check how the specific library treats arrays and tuples first, because those decisions
differ between implementations and are not interchangeable.

**★ When does a deep helper earn its place?**
When all of: the shape is plain data with no methods or class instances; you own it, so a
dependency cannot introduce one; it is shallow enough that you can state a depth; it is
applied at a single boundary and exported under a name; and the hand-written alternative
would be large and would drift. A frozen config tree qualifies. A domain model with an ORM
entity in it fails every clause.

**Why does a faster `tsc --noEmit` not prove the helper got cheaper?**
Because a batch compile pays the cost once and amortises it, while an editor re-instantiates
as you type, in every file the type reaches. The two measure different things, and a deep
helper is precisely the shape where they diverge.

**Is a hand-written deep type duplication?**
It looks like it and it is not. The computed version is a program, and its output is a type
nobody has read. Compare them on what the hover shows, what an error says, and who on the
team can change it safely — for a small stable shape the hand-written version wins all
three, and that is the trade the stopping tests are for.

---

← [04 · `DeepPartial` is not `DeepReadonly`](./04-partial-is-not-readonly.md) ·
[Topic index](./README.md) · [Phase 5 index](../README.md) ·
Next topic → **13 · Tuple manipulation** *(not written yet)*
