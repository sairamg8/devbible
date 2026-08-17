---
title: "TS2589 — when the type system runs out of room"
sidebar_label: "12 · Out of room"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by **reading the limits out of the checker** in the
> **TypeScript 5.9.3** build
> (`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`): the
> `instantiateType` depth guard at line 68205, the three `instantiationCount = 0`
> reset sites at 85456 (`checkExpression`), 90957 (`checkSourceElement`) and 91264
> (`checkDeferredNode`), and both `TS2590` thresholds — `checkCrossProductUnion`
> (~66388) and `removeSubtypes` (~65908). Codes and templates read from the
> numbered table in the same file: `TS2589`, `TS2590`, `TS2321`. **No sandbox, no
> console block** — the numbers below are constants read from source, not
> measurements.

The last of the topic's nine, and the only one that is not about your values at
all.

```text
Type instantiation is excessively deep and possibly infinite.
```

> 🔴 **This is a resource limit, not a mistake in the data.** Nothing is wrong with
> any value; the checker gave up expanding a type. That changes the fix completely:
> **a cast cannot help**, because there is nothing to assert about. The type has to
> get shallower.

## 🔴 The limits, exactly

From the guard at the top of `instantiateType`:

```js
if (instantiationDepth === 100 || instantiationCount >= 5e6) {
```

| Limit | Value | Meaning |
|---|---|---|
| `instantiationDepth` | **100** | nested instantiations — a type expanding into a type expanding into a type |
| `instantiationCount` | **5,000,000** | total instantiations performed |

**Either one trips it.** Depth 100 is the recursion case; five million is the
combinatorial case — a type that is only twenty levels deep but branches wide at
every level.

## 🔴 The count resets per expression — so it is never "the file is too big"

This is the part that resolves the most common confusion about `TS2589`. The
counter is zeroed in three places:

| Reset site | When |
|---|---|
| `checkExpression` | **every expression** the checker visits |
| `checkSourceElement` | every statement or declaration |
| `checkDeferredNode` | every deferred node — function bodies, class members |

**So the five-million budget is per expression, not per program.** Consequences,
all practical:

- 🔴 **A `TS2589` is one expression's fault.** Splitting a file, deleting unrelated
  code, or removing other types will not help.
- 🔴 **But it is not always the *type's* fault either.** The budget is consumed by
  everything the checker instantiates while checking *that expression* — so a
  moderately deep type used inside a large generic call can trip a limit that the
  same type clears in isolation.
- 📌 **This is the real reason for "it works in the playground and fails in my
  repo."** Not a different compiler version, and not project size — a different
  *surrounding expression*, with a different amount of the budget already spent
  before your type is reached.

⚠️ **So reproducing a `TS2589` requires reproducing the whole expression**, not
just the type. Extracting the type into a minimal file and finding it fine proves
nothing.

## The three codes, and how to tell them apart

| Code | Template | Which resource |
|---|---|---|
| `TS2589` | `Type instantiation is excessively deep and possibly infinite.` | instantiation depth or count |
| `TS2590` | `Expression produces a union type that is too complex to represent.` | union **size** |
| `TS2321` | `Excessive stack depth comparing types '{0}' and '{1}'.` | the **assignability** comparison, not instantiation |

🔴 **`TS2590` has two separate thresholds**, which is worth knowing because they
point at different mistakes:

| Where | Threshold | Typical cause |
|---|---|---|
| `checkCrossProductUnion` | cross-product size **≥ 100,000** | a template-literal type or a distributive conditional multiplying unions together |
| `removeSubtypes` | comparison count hits **100,000** and the *estimated* total exceeds **1,000,000** | subtype reduction over a very large union |

📌 **`` `${A}-${B}` `` where `A` and `B` each have 400 members is 160,000
combinations** — over the cross-product limit, and it looks like two small unions
on the page. **Template-literal types multiply.** That is the single most common
route to `TS2590`.

📌 **`TS2321` is about comparing two types, not building one.** It fires when
checking assignability recurses too deep — typically two mutually recursive
generic types, or a deeply nested conditional being checked against another. Same
family of fixes, different trigger.

## What actually causes it, and the fix for each

### Unbounded recursive conditional types

```ts
type Flatten<T> = T extends readonly (infer U)[] ? Flatten<U> : T;
```

Fine on real data, unbounded in principle. **Bound the recursion with a depth
counter:**

```ts
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
type Flatten<T, D extends number = 9> =
  D extends 0 ? T
  : T extends readonly (infer U)[] ? Flatten<U, Prev[D]>
  : T;
```

📌 **A depth-limited type is not a compromise.** Nine levels of nesting exceeds
anything a real schema has, and the bound turns a possible compiler failure into a
guaranteed terminating one.

### Accumulating types that are not tail-recursive

🔴 **TypeScript 4.5 added tail-recursion elimination for conditional types**, and
it is the difference between a type that handles 50 elements and one that handles
1,000. The requirement is that the recursive reference is the **entire** result of
the conditional's branch — not wrapped in anything:

```ts
// ⛔ not tail-recursive — the recursive call is inside a tuple
type Rev<T extends unknown[]> = T extends [infer H, ...infer R] ? [...Rev<R>, H] : [];

// ✅ tail-recursive — the recursive call IS the branch, with an accumulator
type Rev<T extends unknown[], Acc extends unknown[] = []> =
  T extends [infer H, ...infer R] ? Rev<R, [H, ...Acc]> : Acc;
```

**The accumulator pattern is the standard rewrite** and it is worth learning
once — it converts depth into iteration for the compiler.

### A deep mapped type where an interface would do

```ts
type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };
```

On a wide object graph with cycles this expands enormously. **If the shape is
known, declare it.** An `interface` is instantiated once; a recursive mapped type
is instantiated per property, per level.

### Template-literal explosion → `TS2590`

```ts
type Key = `${Section}.${Field}`;      // |Section| × |Field|
```

**Fix by narrowing the inputs** — often only some combinations are real, and a
union of the actual valid keys is both smaller and more accurate than a
cross-product that includes nonsense.

### The library case, where the type is not yours

Deeply generic query builders and form libraries hit this on large schemas.
**Break the expression up:**

```ts
const q = builder.select(…).where(…).orderBy(…);       // one huge expression

const base = builder.select(…);                        // three expressions,
const filtered = base.where(…);                        // three fresh budgets
const q = filtered.orderBy(…);
```

🔴 **This works *because* of the per-expression reset**, and it is the most useful
practical consequence of that find. Naming intermediate values is a real fix, not
a workaround.

## The wrong fixes

⛔ **`as any` on the result.** The type was never wrong; it was unfinished. You now
have an `any` propagating out of the exact place your types were most detailed.

⛔ **`@ts-ignore` / `@ts-expect-error`.** Tier 3–4 on
[topic 08's ladder](../08-suppression-directives/03-the-suppression-tiers.md), and
worse than usual here: ⚠️ **the check is what is slow.** Suppressing the *error*
does not stop the checker doing the work, so your editor stays sluggish and
autocomplete in that file stays broken. **A `TS2589` you suppressed is a `TS2589`
you still pay for on every keystroke.**

⛔ **Raising a limit.** There is no compiler option for either constant. They are
`const`s in the checker, deliberately not configurable.

## Gotchas

**Symptom:** `TS2589` in your repo, and the same type is fine in the playground.
**Cause:** the budget is per **expression**, and your repo's call site consumes
more of it before reaching your type.
**Fix:** reproduce the whole expression, not the type. Then split it into named
intermediates.

**Symptom:** `TS2589` appears after adding an unrelated argument to a call.
**Cause:** the same expression now instantiates more, crossing a threshold the
type was already close to.
**Fix:** split the call. And treat it as a warning that the type is near its
limit even when it passes.

**Symptom:** editor performance collapses in one file, with no error.
**Cause:** you are near a limit without crossing it. The work is being done
either way.
**Fix:** the same fixes. `TS2589` is the loud version of a cost you pay silently.

**Symptom:** suppressing a `TS2589` does not make the editor fast again.
**Cause:** suppression hides the diagnostic, not the computation.
**Fix:** shorten the type. There is no way to opt out of the work.

**Symptom:** a recursive type handles 40 items and fails at 50.
**Cause:** it is not tail-recursive, so it is limited to the depth budget rather
than the count budget.
**Fix:** rewrite with an accumulator so the recursive reference is the whole
branch. TypeScript 4.5's tail-recursion elimination then applies.

**Symptom:** `TS2590` from two unions that each look small.
**Cause:** a template-literal type or a distributive conditional multiplies them —
400 × 400 is 160,000, over the 100,000 cross-product limit.
**Fix:** enumerate the combinations that are actually valid. The result is smaller
*and* more correct.

**Symptom:** `TS2321` rather than `TS2589`.
**Cause:** the depth was hit while **comparing** two types, not building one —
usually two mutually recursive generics.
**Fix:** the same shortening, applied to whichever side is deeper. Adding an
explicit annotation at the boundary often ends the comparison early.

**Symptom:** a `TS2589` that comes and goes between builds with no source change.
**Cause:** incremental builds and editor sessions check different sets of
expressions, and the per-expression budget makes borderline cases order-sensitive.
**Fix:** treat any appearance as real. A type that is borderline will trip in CI
eventually.

## Interview questions

**What does `TS2589` mean, and why can you not cast your way out of it?**
That the checker hit a resource limit expanding a type — either 100 levels of
nested instantiation or five million total instantiations. Nothing about the
values is wrong, so there is nothing for an assertion to assert. Worse, `as any`
puts an untyped value at exactly the point where your types were most detailed,
and suppressing the error does not stop the checker doing the work — so the editor
stays slow. The only real fix is a shallower type.

**Someone says "our project got too big and now we get `TS2589`". Are they right?**
No. The instantiation counter resets on every expression, every statement and
every deferred node, so the budget is per expression rather than per program.
`TS2589` is always one expression's fault. That is also why splitting a long
method chain into named intermediate `const`s genuinely fixes it — each one gets a
fresh budget — and why "it works in the playground" means the surrounding
expression differs, not the compiler.

**How do you make a recursive conditional type handle more elements?**
Make it tail-recursive, so the recursive reference is the entire result of the
branch rather than being wrapped in a tuple or object. TypeScript 4.5 eliminates
tail recursion in conditional types, which moves you from the depth limit to the
count limit — in practice from tens of elements to around a thousand. The standard
rewrite is an accumulator type parameter. If the input genuinely has no bound, add
an explicit depth counter and let the type terminate.

**What is `TS2590` and what usually causes it?**
*"Expression produces a union type that is too complex to represent."* It has two
thresholds: a cross-product union of 100,000 or more members, and subtype
reduction whose comparison count reaches 100,000 with an estimated total over a
million. The usual cause is a template-literal type multiplying two unions —
two 400-member unions produce 160,000 combinations while looking like two small
types on the page. The fix is to enumerate the combinations that are actually
valid, which is smaller and more accurate than the cross-product.

**Is there a compiler option to raise these limits?**
No. Both constants are hard-coded in the checker and deliberately not
configurable, because a raised limit converts a bounded failure into an unbounded
compile time. The limits exist to make the checker terminate.

**Why is a suppressed `TS2589` worse than a suppressed type error?**
Because the diagnostic is a symptom of work, not of a claim. Suppressing an
ordinary type error stops the compiler complaining about something it has already
decided. Suppressing `TS2589` stops it complaining while it continues to do the
expensive instantiation on every keystroke — so you keep the slow editor and the
broken autocomplete and lose the signal that told you why.

---

← [11 · The condition is decided](./11-the-condition-is-decided.md) · [Topic index](./README.md) · Next → [13 · The suppress codes are gone](./13-the-suppress-codes-are-gone.md)
