---
title: "Where freshness is lost"
sidebar_label: "02 · Where freshness is lost"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Object Types → Excess
> Property Checks*, and the *Type Compatibility* treatment of literal freshness)
> and the **compiler's diagnostic table** for `TS2353` / `TS2561` / `TS2559`.
> The union-target behaviour described here is the handbook's documented rule for
> checking a literal against a union. **No sandbox, no console block.**

The check is valuable and it is also easy to lose by accident. Knowing the exact
list is what turns "sometimes it catches typos" into a property you can rely on.

> **A literal is fresh exactly once: at the moment it is written, against the
> type expected there.** Every operation that stores it, widens it, or defers the
> comparison spends that freshness, and it never comes back.

## The seven ways to lose it

### 1 · Assign it to an unannotated variable

The canonical case from [chunk 01](./01-freshness.md):

```ts
const opts = { retries: 3, timeoutMS: 500 };   // inferred, no target to check against
connect(opts);                                  // ✅ no error
```

There was no target type at the point the literal was written, so there was
nothing to be excessive *to*. By the time `connect` sees it, it is a variable.

🔴 **This is the single most common way real codebases lose the check**, because
extracting a literal into a variable is a routine, harmless-looking refactor that
silently removes a typo guard.

### 2 · Assert it

```ts
connect({ retries: 3, timeoutMS: 500 } as Options);   // ✅ no error
```

An assertion tells the compiler the type is settled, so it stops checking. ⚠️
**This is the worst of the seven**, because it looks like it *adds* type safety
and it removes some — the reader sees an annotation-shaped thing and assumes the
object was checked against `Options`.

### 3 · Annotate it with a wider type first

```ts
const opts: object = { retries: 3, timeoutMS: 500 };
```

Freshness is spent against `object`, which has no properties to exceed.

### 4 · Return it through an unannotated function

```ts
function makeOptions() {                      // return type inferred
  return { retries: 3, timeoutMS: 500 };
}
connect(makeOptions());                        // ✅ no error
```

Annotating the return type restores it — `function makeOptions(): Options` checks
the literal at the `return`, which is a good reason to annotate return types on
factory functions.

### 5 · Spread it into another literal

```ts
const base = { timeoutMS: 500 };
connect({ retries: 3, ...base });              // ✅ no error on timeoutMS
```

The spread's contribution comes from a variable, not from the literal you are
writing, so the typo inside `base` is not part of the fresh material.

📌 **Related to but distinct from the spread hole in
[topic 07](../07-unsound-by-design/03-the-holes-in-your-data.md).** That one is
about `undefined` overwriting; this one is about typos surviving. Object spread
manages to defeat two different checks.

### 6 · Build it in stages

```ts
const opts: Partial<Options> = {};
opts.timeoutMS = 500;                          // TS2339 — this one IS caught
```

Property *assignment* is checked normally, so staged building is safe here —
but only because the variable is annotated. Unannotated, `opts.timeoutMS = 500`
just widens the inferred type and nothing is reported.

### 7 · Compare against a union that accepts it

```ts
type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; size: number };

const s: Shape = { kind: 'circle', radius: 1, size: 2 };   // TS2353
```

🔴 **This one is worth care, because the rule is not "any member accepts it".**
A literal checked against a union must not have a property that is absent from
**every** member. `size` exists on the square member, so it is *known* to the
union — but the literal also has `kind: 'circle'`, which selects the circle
member, and `size` is excess there.

The behaviour that surprises people is the looser direction: a property present
in *some* member is not always rejected, so a union target gives a weaker check
than a single type. **Discriminate first** — narrow the target to one member —
and the check sharpens back up.

## Restoring the check where you want it

Two tools, and the second is almost always the right one:

**Annotate the variable:**

```ts
const opts: Options = { retries: 3, timeoutMS: 500 };   // TS2561 — restored
```

**Or `satisfies`, which restores it *and* keeps the narrow inferred type:**

```ts
const opts = { retries: 3, timeoutMs: 500 } satisfies Options;
//    opts.timeoutMs is `number`, not `number | undefined`
```

🔴 **`satisfies` is the correct default for a configuration object**, and it
exists largely for this reason. An annotation checks the value and *widens* it to
the annotated type; `satisfies` checks the value and leaves it alone. Full
treatment: [phase 2 · `satisfies`](../../phase-2-narrowing/10-satisfies/README.md).

📌 **The rule of thumb: annotate a variable when you want the wider type;
`satisfies` when you only want the check.** Most config objects want the check.

## Gotchas

**Symptom:** extracting a literal into a variable "broke" the typo detection.
**Cause:** freshness is spent at the point the literal is written; the variable
has none.
**Fix:** `satisfies Options` on the variable. One word, and the check is back
with no widening.

**Symptom:** `as Options` was added to fix a different error and typos stopped
being caught.
**Cause:** an assertion settles the type and stops the check. This is the most
misleading of the seven, because it reads as added safety.
**Fix:** `satisfies` if you wanted a check, a real fix if you wanted a fix.

**Symptom:** a factory function's returned literal is unchecked.
**Cause:** the return type is inferred, so there is no target at the `return`.
**Fix:** annotate the return type. This is a good general habit for factories for
exactly this reason.

**Symptom:** a typo inside a spread source survives.
**Cause:** spread contributes from a variable; only the literal's own properties
are fresh.
**Fix:** `satisfies` on the source object where it is declared.

**Symptom:** a literal against a union type accepts a property that belongs to a
different member.
**Cause:** the union check is looser than a single-type check.
**Fix:** narrow the target first, or annotate against the specific member. Do not
rely on a union target for typo detection.

**Symptom:** `opts.timeoutMS = 500` on an unannotated object is not an error.
**Cause:** assignment to an unannotated object literal's variable widens the
inferred type rather than checking it.
**Fix:** annotate the variable, or `satisfies` at the declaration.

**Symptom:** a fixture array's rows are unchecked.
**Cause:** the array was built and assigned separately, so the elements were
never fresh against the element type.
**Fix:** annotate at the declaration — `const rows: Row[] = [ … ]` — or
`satisfies Row[]`.

## Interview questions

**Name the ways an object literal loses its excess-property check.**
Assigning it to an unannotated variable; asserting it with `as`; annotating with
a wider type; returning it from a function with an inferred return type;
contributing it through a spread; building it in stages without an annotation;
and comparing it against a union, where the check is looser. The first is the
most common in real code — extracting a literal into a variable is a routine
refactor that silently removes the guard.

**Which of those is most misleading and why?**
`as Options`. It removes the check while looking like it adds type safety — a
reader sees an annotation-shaped construct and assumes the object was verified
against `Options`, when in fact the assertion is precisely what stopped it being
verified.

**How do you get the check back on a variable?**
Annotate it, or use `satisfies`. `satisfies` is usually right: an annotation
checks the value and then widens it to the annotated type, while `satisfies`
checks it and preserves the narrow inferred type. For configuration objects the
narrow type is normally what you want to keep.

**Why is a union target a weaker check?**
Because the literal is compared against the union rather than against one member,
so a property belonging to a different member is not necessarily excess.
Discriminating first — narrowing the target to a single member — restores the
sharper check.

**Should factory functions annotate their return type?**
Yes, and excess property checking is a concrete reason why. Without an
annotation, the literal in the `return` has no target to be checked against, so a
typo in the object a factory produces is completely silent — and factories are
exactly where such objects are constructed.

---

← [01 · Freshness](./01-freshness.md) · Next → [03 · The second and third rules](./03-the-second-and-third-rules.md)
