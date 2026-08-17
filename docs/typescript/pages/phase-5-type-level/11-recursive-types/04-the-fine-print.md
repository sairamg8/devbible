---
title: "The fine print"
sidebar_label: "04 · The fine print"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. 🔴 **The 10,000-element tuple ceiling was read out of the compiler's
> own source** — **TypeScript 5.9.3**,
> `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`, `createNormalizedTupleType`:
> the `elements.length + expandedTypes.length >= 1e4` guard and the pair of diagnostics it
> chooses between. Codes `TS2799` / `TS2800` and the absence of a type-position variant of
> `TS2590` are from the same message table. The instantiation budget it is contrasted with
> is [topic 09 · chunk 01](../09-type-level-performance/01-the-three-budgets.md)'s.
> ⚠️ **Constants are 5.9.3's and are not claimed for the 7.0.2 Go port.** **No sandbox, no
> console block, no timings.**

The accumulator conversion is a good trade and it is not a free one. Three things it does
not fix, and one thing it makes worse, all of which show up after the type is already in
use — which is the expensive time to find them.

## The public alias is API surface, not style

Step 5 of [chunk 02](./02-the-accumulator-pattern.md)'s recipe — hide the helper behind a
public alias — reads like tidiness. It is not. A defaulted type parameter is a **public**
parameter:

```ts
// the accumulator is part of the signature, whether you meant it or not
type Join<T extends readonly string[], Acc extends string = ""> = /* … */;

type Wrong = Join<["b", "c"], "a, ">;   // "a, b, c" — no error, wrong answer
```

Nobody wrote that on purpose. It happens when a caller sees two parameters and assumes the
second is a separator, an initial value, an option — and the checker cannot object,
because the seed genuinely is a valid argument. The failure is a **wrong type**, not a
diagnostic, which puts it in the worst category
[topic 08](../08-knowing-when-to-stop/README.md) names: a type-level bug that type-checks.

The split closes it by arity:

```ts
type Join<T extends readonly string[], Sep extends string = ", "> = JoinHelper<T, Sep, "">;
type JoinHelper<T extends readonly string[], Sep extends string, Acc extends string> =
  /* … */;
```

`Join` now takes what a caller should pass and nothing else, and `JoinHelper` has **no
defaults at all** — every parameter is supplied by the alias, so there is no wrong way to
call it that is not obviously wrong.

Three practical notes on the split:

1. **Name the helper for the reader who will meet it in an error message.** They will:
   the helper is what resolves, so the helper is what hovers and diagnostics show.
   `JoinHelper` beats `_Join`, `JoinImpl` or `J`.
2. **An `@internal` tag and a leading underscore are documentation, not enforcement.**
   Neither stops an import. If the type must not be used, do not export it — a helper in a
   module that only exports the public alias is genuinely private.
3. ⚠️ **The helper still has to be a named alias**, per
   [chunk 01](./01-the-two-limits.md): `tailCount` increments only when the tail call has
   an `aliasSymbol`. Inlining the helper to "keep the API clean" would cost you the
   optimisation the helper exists for.

## A third ceiling, and it is not a recursion limit

[Chunk 01](./01-the-two-limits.md) gave two ceilings — 100 nested, 1,000 tail. A tuple
accumulator has a **third**, and it has nothing to do with recursion depth. From
`createNormalizedTupleType`:

```js
// TypeScript 5.9.3, createNormalizedTupleType — spreading a tuple into a tuple
if (elements.length + expandedTypes.length >= 1e4) {
  error2(currentNode, isPartOfTypeNode(currentNode)
    ? Diagnostics.Type_produces_a_tuple_type_that_is_too_large_to_represent        // TS2799
    : Diagnostics.Expression_produces_a_tuple_type_that_is_too_large_to_represent  // TS2800
  );
  return errorType;
}
```

🔴 **10,000 elements is a hard cap on the tuple itself, checked at the spread.** It is not
counted per iteration and it is not `TS2589`, so none of the recursion advice applies to
it:

| Ceiling | Counted | Diagnostic | Reached by |
|---|---|---|---|
| 100 | instantiation depth | `TS2589` | nested recursion |
| 1,000 | `tailCount` iterations | `TS2589` | tail recursion, one element per step |
| **10,000** | **tuple elements** | **`TS2799` / `TS2800`** | **any spread, at any depth** |

⚠️ **A doubling accumulator hits it in fourteen steps.** `[...Acc, ...Acc]` is a perfectly
ordinary way to build a large tuple quickly, and it reaches 8,192 on step 13 and dies on
step 14 — with 986 tail-call iterations still unspent. The budget you exhausted is not the
one you were watching.

📌 **Two codes for one condition, chosen by position.** `TS2799` is the type-position
wording and `TS2800` the expression-position one — the same split
[topic 09](../09-type-level-performance/01-the-three-budgets.md) found for `TS2321` /
`TS2859`. Worth noting: the message table has **no** type-position variant of `TS2590`,
so a union that gets too complex says *"Expression produces a union type…"* even when
there is no expression in sight. If that reads oddly in an error, it is the compiler's
wording, not your mistake.

## Iterations are not cost

The 1,000-iteration ceiling is a limit on **how many times**, not on **how much**. Every
one of those iterations is an instantiation, and instantiations are counted against the
five-million `instantiationCount` budget that
[topic 09 · chunk 01](../09-type-level-performance/01-the-three-budgets.md) read out of
the same checker.

So a type that survives 900 iterations is:

- doing 900 instantiations **per use** — not once, per use;
- doing them again in every file that uses it, because the instantiation cache is per
  active mapper and is cleared when the mapper pops
  ([topic 09 · chunk 02](../09-type-level-performance/02-caching-and-naming.md));
- doing them **on every keystroke** in an editor, in every file the type reaches.

🔴 **"It fits under the limit" and "it is fine" are different claims.** A type that only
just fits is one that will be slow everywhere it is used *and* will fail on the first
input slightly deeper than your test — the worst pair of properties to ship together.
The conversion bought headroom; it did not buy the right to use all of it.

## The shapes the conversion cannot reach

Three cases where there is no accumulator to write, and recognising them early saves an
afternoon.

### Two recursive calls

A tree walk recurses into a left side and a right side. **Only one call can be last**, so
whichever way you arrange it the other one nests:

```ts
type Flatten<T> =
  T extends [infer H, ...infer R] ? [...Flatten<H>, ...Flatten<R>] : [T];
//                                    ^^^^^^^^^^     ^^^^^^^^^^ two calls, one branch
```

An accumulator can carry a work list — push the un-walked side onto a queue parameter and
walk it later — and that does work, but it is a manual continuation and it makes the type
markedly harder to read. **That trade is exactly what
[topic 08](../08-knowing-when-to-stop/README.md) is about**: the ceiling goes up and the
error message gets worse, and for a tree of realistic depth the 100 levels were rarely the
binding constraint anyway.

### Recursion over an object

Every property is its own recursive branch, so the work **fans out** rather than advancing
one step. There is no single "rest of the input" to pass along, so there is no tail call to
make. That is why the deep helpers are their own topic — **12 · `DeepPartial` /
`DeepReadonly`** *(not written yet)* — and why they are the usual source of `TS2589` in
application code rather than the string parsers everyone worries about.

### When the next step depends on the answer

If the recursion has to look at the result of the recursive call to decide what to do next
— not to wrap it, but to *branch* on it — the call cannot be the branch's whole value by
definition. Restructure so the decision uses the accumulator instead of the result, or
accept the nested ceiling.

**When none of the three has a way out, the honest options are a deliberate depth cap —
chunk 05 · Capping depth deliberately** *(not written yet)* — **or not writing the type**,
which [topic 08](../08-knowing-when-to-stop/README.md) argues is more often right than it
feels.

## Gotchas

**Symptom:** A caller passes a second argument to a one-concept type and gets a wrong
answer with no error.
**Cause:** The accumulator is a defaulted public parameter, so seeding it is a legal call.
**Fix:** The public-alias split. The alias takes only real arguments; the helper takes no
defaults.

**Symptom:** `TS2799` — *"Type produces a tuple type that is too large to represent."*
**Cause:** A tuple reached 10,000 elements at a spread. This is not a recursion limit and
capping the depth will not help.
**Fix:** Stop building the tuple. If it is a counter, count with a smaller representation;
if it is a result, ask whether the caller needs 10,000 elements as a type.

**Symptom:** `TS2800` instead of `TS2799` for what looks like the same mistake.
**Cause:** Same guard, expression position rather than type position.
**Fix:** Nothing different — read them as one condition with two wordings.

**Symptom:** A doubling accumulator dies far below the iteration ceiling.
**Cause:** `[...Acc, ...Acc]` grows the tuple exponentially, so the element cap arrives in
about fourteen steps while `tailCount` is barely used.
**Fix:** Grow linearly, or generate the large type at build time rather than in the type
system.

**Symptom:** The type is comfortably under every limit and the editor is still slow.
**Cause:** Iterations are not cost. Several hundred instantiations per use, repeated per
consuming file and per keystroke, is a real bill even when nothing errors.
**Fix:** Reduce iterations, or resolve the type once at a boundary and export the
resolved result — [topic 09 · chunk 04](../09-type-level-performance/04-the-fixes-in-order.md)
has the ordered list.

**Symptom:** You inlined the helper to keep the public API clean and the ceiling dropped
back to 100.
**Cause:** `tailCount` only increments for a tail call to a **named** alias.
**Fix:** Keep the helper as a named alias and control visibility with module exports
instead. Naming is load-bearing here for the third time — after caching and error
messages.

**Symptom:** A tree walk cannot be converted no matter how the branches are arranged.
**Cause:** Two recursive calls; only one can be in tail position.
**Fix:** Either carry a work list in an extra parameter — a manual continuation, and a
readability cost worth pricing honestly — or accept the 100-level ceiling, which is
usually enough for a tree.

**Symptom:** An error says *"Expression produces a union type…"* where there is no
expression.
**Cause:** `TS2590` has only the expression-position wording in the message table; there
is no type-position variant.
**Fix:** Read it as "union too complex" and ignore the word "expression". It is not a clue
about where the problem is.

## Interview questions

**★ Why is hiding the accumulator behind a public alias a correctness issue rather than a
style one?**
Because a defaulted type parameter is public. A caller can pass a seed, the checker cannot
object — the seed is a legal argument — and the result is a wrong type rather than an
error. The alias fixes it by arity: the public type takes only the arguments a caller
should pass, and the helper takes no defaults at all, so there is no plausible-but-wrong
way to call either.

**★ Name the third ceiling a recursive type can hit and say why it is different.**
A tuple cannot exceed 10,000 elements — `TS2799` in type position, `TS2800` in expression
position — and the check happens at the **spread**, in `createNormalizedTupleType`, not
per recursion step. So it is independent of both the 100-level nesting limit and the
1,000-iteration tail-call limit: a doubling accumulator reaches it in about fourteen steps
with almost the whole iteration budget unspent. Depth caps do not help; building a smaller
tuple does.

**★ Does surviving 1,000 iterations mean the type is fine?**
No. The ceiling limits how many times, not how much. Each iteration is an instantiation
counted against the five-million instantiation budget, incurred per use, repeated in every
consuming file because the instantiation cache is per active mapper, and re-run on every
keystroke in the editor. A type that only just fits is slow everywhere and fails on the
first input slightly deeper than your test.

**★ Which recursive shapes cannot be converted at all?**
Three. A walk with two recursive calls — a tree — because only one call can be last.
Recursion over an object, because each property is its own branch, so there is no single
remainder to pass along. And recursion where the next step branches on the *result* of the
recursive call, which contradicts the call being the branch's whole value. For all three
the choices are a deliberate depth cap or not writing the type.

**★ Why does inlining the helper cost you the optimisation?**
Because `tailCount` increments only when the tail call is to a named type alias — the
compiler checks for an `aliasSymbol`. An inlined conditional is anonymous, so the call is
not counted as a tail call and the type falls back to the nesting path with its 100-level
ceiling. Visibility should be controlled by what the module exports, not by removing the
name.

**How would you get a tree walk under a higher ceiling if you had to?**
Carry a work list. Push the un-walked side into an extra tuple parameter and process it
after the current branch, so there is a single recursive call in tail position and the
queue holds the pending work. It is a manual continuation-passing transform, it raises the
ceiling, and it makes the type substantially harder to read — which is a trade to state
out loud rather than assume.

**What do `TS2799` and `TS2800` have in common with `TS2321` and `TS2859`?**
Both pairs are one condition with two messages, chosen by context rather than by cause —
type position versus expression position for the tuple cap, and which overflow flag fired
for the comparison budget. It is worth knowing because searching the error text suggests
two different problems when there is one.

**Is there a type-position version of `TS2590`?**
No — the message table has only *"Expression produces a union type that is too complex to
represent."*, so you can see that wording in a context with no expression in it. It is a
gap in the wording, not a hint about where the union was built.

---

← [03 · Order and position](./03-order-and-position.md) · [Topic index](./README.md) ·
Next → **05 · Capping depth deliberately** *(not written yet)*
