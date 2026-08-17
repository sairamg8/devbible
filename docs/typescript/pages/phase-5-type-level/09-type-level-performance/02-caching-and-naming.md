---
title: "Caching, and why naming is a performance fix"
sidebar_label: "02 · Caching and naming"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. 🔴 **Read out of the compiler's own source**, **TypeScript 5.9.3**
> (`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`): the `couldContainTypeVariables`
> early-out and its memoisation on `objectFlags`, `isNonGenericTopLevelType`, the per-mapper
> instantiation cache (`activeTypeMappersCaches`, keyed by `type.id + getAliasId(...)`, and
> `.clear()`d when a mapper is popped), and the relation cache write in `checkTypeRelatedTo`.
> The two quotations are from the **TypeScript wiki, *Performance*** (*Naming Complex Types*,
> *Preferring Interfaces Over Intersections*), verbatim. ⚠️ **Constants and internals are
> 5.9.3's** — 7.0.2 is the Go port and is not claimed here. **No sandbox, no console block, no
> timings.**

[Chunk 01](./01-the-three-budgets.md) counted the budgets. This chunk is about the other half
of the story — **what the compiler avoids doing** — because every real performance fix in this
phase is a cache hit that would otherwise have been a miss.

Which is why the advice *"give your types names"* is not a style preference dressed up as
performance. There is a mechanism, and it is readable.

## The first thing instantiation does is try not to happen

```js
// TypeScript 5.9.3, instantiateTypeWithAlias — the first three lines
if (!couldContainTypeVariables(type)) {
  return type;
}
```

If a type cannot contain a type variable, instantiating it is meaningless, so it is returned
unchanged — no work, no depth, no count. And the answer is **memoised onto the type itself**:

```js
// couldContainTypeVariables, on the way out
type.objectFlags |= CouldContainTypeVariablesComputed | (result ? CouldContainTypeVariables : 0);
```

So the question is asked **once per type**, ever. This is the cheapest tier of the cache
hierarchy and the one you influence most, because it depends on whether your types *are*
generic at the point they are used.

## 🔴 The finding: where you declare an alias changes its cost

The early-out consults a helper whose name gives the game away — `isNonGenericTopLevelType`.
Reduced to what it decides:

```js
// TypeScript 5.9.3
function isNonGenericTopLevelType(type) {
  if (type.aliasSymbol && !type.aliasTypeArguments) {
    const declaration = getDeclarationOfKind(type.aliasSymbol, TypeAliasDeclaration);
    return !!(declaration && findAncestor(declaration.parent, (n) =>
      n.kind === SourceFile ? true : n.kind === ModuleDeclaration ? false : "quit"));
  }
  return false;
}
```

Two conditions, both actionable:

1. **`type.aliasSymbol && !type.aliasTypeArguments`** — it must be a **named alias with no
   type arguments applied**. An anonymous inline type has no `aliasSymbol` and never
   qualifies. This is the mechanical reason naming pays.
2. **The declaration's ancestors must reach a `SourceFile`**, walking through
   `ModuleDeclaration`s but **quitting at anything else** — a function body, a block. So a
   `type` declared at module top level (or inside a namespace) qualifies; **one declared
   inside a function does not.**

> 🔴 **A `type` alias declared inside a function body is not eligible for the cheapest
> early-out that the identical alias at module top level gets.**

📌 **Judgement, but it follows directly:** hoist type aliases out of function bodies. It is a
one-line move that most codebases have several opportunities for, and it costs nothing to
read.

⚠️ **Do not overread it.** This is one early-out among several, on 5.9.3, and no timing here
measures its effect — no sandbox covers this phase. The claim is about *eligibility*, not
about a benchmark.

## The instantiation cache is per active mapper, and it is cleared

```js
// TypeScript 5.9.3, instantiateTypeWithAlias
const key = type.id + getAliasId(aliasSymbol, aliasTypeArguments);
const mapperCache = activeTypeMappersCaches[/* … */];
const cached = mapperCache.get(key);
if (cached) return cached;
```

Three consequences worth having:

- **The key is the type's id plus its alias id.** A named alias with arguments has a stable
  key; an anonymous structural type does not participate in the same way. Naming again.
- **The cache is indexed by *active mapper*** — the substitution currently in flight — and
  the entries are `.clear()`ed when that mapper is popped. So it accelerates repetition
  *within* a piece of work, not across your whole program.
- Therefore **the same derived type resolved in twenty files is twenty separate pieces of
  work**, and shrinking it once pays twenty times.

This is precisely what the wiki is describing, in one sentence:

> If the return type in this example was extracted out to a type alias, more information can
> be cached by the compiler.

— *TypeScript wiki, Performance → Naming Complex Types*

## The relation cache remembers failures too

[Chunk 01](./01-the-three-budgets.md) showed the overflow path writing into the relation
cache, tagged with which budget ran out. The general behaviour matters here:

- Assignability answers — including *failures* — are **cached by a relation key** built from
  both types.
- That cache's **size is subtracted from the comparison budget**:
  `relationCount = (16e6 − relation.size) >> 3`. So the cache both saves work and consumes
  allowance, which is the trade behind chunk 01's shrinking budget.

And the second wiki quotation is a direct consequence:

> Type relationships between interfaces are also cached, as opposed to intersection types as
> a whole.

— *TypeScript wiki, Performance → Preferring Interfaces Over Intersections*

**An intersection is not one cacheable relationship; it is a comparison per constituent, every
time.** That is why
[topic 08 · chunk 08](../08-knowing-when-to-stop/08-structure-and-tooling.md) recommends
`interface … extends` on readability grounds *and* on these grounds — the same change, two
independent payoffs.

## The four tiers, cheapest first

| Tier | What it avoids | How you influence it |
|---|---|---|
| `couldContainTypeVariables` | instantiation entirely | keep non-generic types non-generic; **name them at module top level** |
| Per-mapper instantiation cache | re-instantiating within one unit of work | named aliases with stable keys |
| Relation cache | re-comparing two types | fewer, flatter, named types; `interface extends` over `&` |
| The compiler's own file/program caches | re-checking unchanged files | phase 12's territory (`incremental`, project references) |

📌 **Rows two and three are what "the type is slow" almost always means**, and both respond to
the same intervention: **give it a name, and make the name the thing you use.**

## Gotchas

**Symptom:** A helper type was extracted and named, and nothing got faster.
**Cause:** The name is not what gets used — the call sites still inline the structural form,
or the alias immediately takes type arguments at every use.
**Fix:** Use the alias in the signatures. A name only helps where it appears.

**Symptom:** A `type` inside a function body behaves differently from the same `type` at
module level.
**Cause:** `isNonGenericTopLevelType` quits at a function body, so the local alias is not
eligible for the early-out.
**Fix:** Hoist it. There is no reason to declare a type alias inside a function.

**Symptom:** Editor responsiveness is worse in files that import the derived type than in the
file that defines it.
**Cause:** The instantiation cache is per active mapper and cleared when the mapper is
popped, so each consumer re-does the work.
**Fix:** Shrink the type once; every consumer benefits. Or export a *resolved* concrete type
where the genericity is not needed.

**Symptom:** Replacing an intersection with an interface improved compile time as well as the
error messages.
**Cause:** Interface relationships are cached as a whole; intersections are compared
constituent by constituent.
**Fix:** Nothing — this is the documented reason both effects appear together.

**Symptom:** A big project's incremental checks feel fine and one file is always slow.
**Cause:** That file instantiates a large derived type; the program-level caches cannot help
because the work is inside a single check.
**Fix:** Name intermediates so the per-mapper cache can hit, and reduce the union widths
flowing through.

**Symptom:** Someone "optimised" by inlining aliases to remove indirection.
**Cause:** A runtime intuition applied to the type system, where indirection is what enables
caching.
**Fix:** Revert it. Inlining removes the `aliasSymbol` that the early-out and the cache key
both depend on.

**Symptom:** The same failing assignability check is instant on the second attempt.
**Cause:** The failure was cached, overflow flag included.
**Fix:** Do not read that as an improvement.

**Symptom:** Adding types to a project made an *unrelated* check start failing with
`TS2859`.
**Cause:** The relation cache grew, and the comparison budget is sixteen million minus its
size, divided by eight.
**Fix:** Reduce that check's comparison count. The cause is real but it is not in the file
that broke.

## Interview questions

**★ Why is "give the type a name" a performance recommendation and not just a readability
one?**
Because two of the compiler's caches depend on the name. The instantiation cache key is
`type.id + getAliasId(...)`, so a named alias has a stable key an anonymous structural type
does not, and the early-out helper `isNonGenericTopLevelType` requires `type.aliasSymbol` to
exist at all. The wiki states the effect — *"If the return type in this example was extracted
out to a type alias, more information can be cached by the compiler"* — and the mechanism is
in the checker.

**★ What does the compiler do before instantiating a type, and why does it matter?**
It asks `couldContainTypeVariables(type)` and returns the type unchanged if the answer is no —
no instantiation, no depth, no count against the five-million budget. The answer is memoised
onto the type's `objectFlags`, so it is computed once per type ever. It is the cheapest tier of
the hierarchy and the one your type design influences most directly.

**★ Where you declare a type alias affects its cost. Explain.**
`isNonGenericTopLevelType` requires a named alias with no type arguments *and* that its
declaration's ancestors reach a `SourceFile` — walking through namespace declarations but
quitting at a function body or block. So the identical alias declared at module top level is
eligible for the early-out and the one declared inside a function is not. The practical rule
is to hoist type aliases out of function bodies; it costs nothing and it is a one-line move.

**★ Why do interfaces beat intersections for compile time as well as for error messages?**
Because *"Type relationships between interfaces are also cached, as opposed to intersection
types as a whole"*. An interface's assignability answer is one cacheable relationship; an
intersection has to be compared constituent by constituent each time. Combined with the flat
single object type an interface produces, that is one change with two independent payoffs —
which is why it is the easiest recommendation in the phase.

**How does the relation cache both help and hurt?**
It stores assignability answers, including failures with the overflow flag that caused them,
so repeat comparisons are free. But its size is subtracted from the comparison budget —
`(16e6 − relation.size) >> 3` — so as it fills, each individual check is allowed fewer
comparisons. That is why adding unrelated types to a project can push a previously fine check
into `TS2859`.

**Is the instantiation cache global?**
No — it is indexed by the *active mapper* and cleared when that mapper is popped, so it
accelerates repetition within a unit of work rather than across the program. The practical
consequence is that the same derived type used in twenty files is twenty separate pieces of
work, which is exactly why shrinking it once pays twenty times.

**Someone inlines your type aliases to "remove indirection". What do you tell them?**
That the intuition is from runtime code, where indirection costs something. In the type system
the alias *is* the caching mechanism: it supplies the `aliasSymbol` the early-out requires and
the stable key the instantiation cache uses. Inlining removes both, and it makes every error
message print structure instead of a name.

**How much of this can you claim as fact about the current compiler?**
The mechanisms and the constants are 5.9.3's, read from its source. 7.0.2 is a port whose
internals cannot be read the same way, so the honest position is that the *shapes* — an
early-out, a per-mapper instantiation cache, a relation cache that stores failures, a budget
that competes with that cache — are what to reason about, and the exact numbers belong to the
version they were read from.

---

← Prev: [01 · The three budgets](./01-the-three-budgets.md) · [Topic index](./README.md) ·
Next → **03 · What actually makes a codebase slow** *(not written yet)*
