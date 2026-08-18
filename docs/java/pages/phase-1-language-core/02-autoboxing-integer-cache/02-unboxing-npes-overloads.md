---
title: "Unboxing NPEs and overload ambushes"
sidebar_label: "2 · NPEs and overloads"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §15.25 (conditional operator
> typing), §5.1.8 (unboxing conversion), §15.12.2 (overload resolution
> phases), and the JDK 25 `List`, `Map` and `Comparator` API documentation.

**Unboxing is a method call on the wrapper, so every place a box silently
disappears is a place `null` can detonate — and some of those places unbox
by *typing*, before any branch is taken. Add overload resolution's
preference for primitive matches over boxing and you get the second family:
calls that pick a different method than the one you meant. Every shape in
this chunk is a real incident pattern with the JLS section that explains
it.**

## The unboxing NPEs you will actually meet

**The ternary.** If one branch is a primitive and the other a wrapper, the
whole conditional expression is typed as the *primitive* (JLS §15.25) — so
the wrapper branch unboxes even when it is the one selected:

```java
Long discount = row.getDiscount();               // may be null
long value = flag ? 0L : discount;               // discount != null? Doesn't matter:
                                                 // typing unboxes; null → NPE here
```

The fix is making both branches the same reference type
(`flag ? Long.valueOf(0L) : discount`) or handling `null` before the
ternary. This is the one NPE that fires *even when the null branch is not
taken* — it is decided by the expression's static type, not the runtime
path, which is why it survives code review.

**The comparison.** `if (row.getCount() > limit)` unboxes `getCount()`'s
`Integer` — the NPE points at a line containing only `>`. All numeric
comparisons (`<`, `<=`, `>`, `>=`) unbox both operands; only `==`/`!=`
between two wrappers skip unboxing (and compare identity — chunk 1).

**The `Map.get` chain.** `long total = totals.get(key);` — a missing key
returns `null`, and the assignment unboxes it. `getOrDefault(key, 0L)` says
what you meant. The `merge`/`compute` family (Phase 3) removes the pattern
entirely for accumulation.

**The enhanced `for`.** `for (long id : listOfLongWrappers)` unboxes each
element — one `null` element ends the loop with an NPE that names the loop
header. Collections that can contain `null` and loops that unbox are a
standing conflict.

**The stream reduction.** `list.stream().mapToLong(Order::getAmount)` NPEs
inside the pipeline when one `getAmount()` returns a null `Long` — the
stack trace names the lambda, not the row. Filter or default nulls *before*
mapping to a primitive stream.

## The `List.remove` ambush

`List<Integer>` has both `remove(int index)` and `remove(Object element)` —
and an `int` argument picks the **index** overload without boxing:

```java
list.remove(2);                    // removes the element AT INDEX 2
list.remove(Integer.valueOf(2));   // removes the first element EQUAL to 2
```

Overload resolution (JLS §15.12.2) tries **strict** invocation (no boxing,
no varargs) before **loose** invocation (boxing allowed) before varargs —
so the exact primitive match wins whenever it exists. With ids in a
`List<Integer>`, the first form compiles, runs, and deletes the wrong thing
— or throws `IndexOutOfBoundsException` from data-dependent values. The
same phase ordering explains several cousins:

- `map.remove(intKey)` on a `Map<Integer, T>` is safe (only one `remove`)
  — the ambush needs the overload *pair*, which `List` uniquely has.
- A method overloaded on `f(long)` and `f(Integer)` called with an `int`
  picks `f(long)`: **widening beats boxing**. Full resolution rules in
  [topic 10](../10-methods.md).
- `f(int...)` loses to both: varargs is the last resort.

## Comparator and sort traps

- **The subtraction comparator.** `(a, b) -> a.getViews() - b.getViews()`
  overflows for large spreads ([topic 04](../04-operators-overflow/README.md))
  *and* unboxes — two failure modes in one idiom. Write
  `Comparator.comparingInt(Post::getViews)` or `Integer.compare(x, y)`.
- **`Comparator.comparing` vs `comparingInt`/`comparingLong`.**
  `comparing(Post::getViews)` with an `Integer` extractor boxes every
  comparison; `comparingInt` keeps it primitive. Same result, different
  allocation profile in a sort over millions.
- **Null elements.** Every wrapper `compareTo` NPEs on null;
  `Comparator.nullsFirst(naturalOrder())` decides placement explicitly
  instead (Phase 3's comparator topic carries the full pattern).

## Gotchas

**Symptom:** NPE from a ternary even though the null branch "wasn't taken"
**Cause:** mixed primitive/wrapper branches type the expression as primitive (JLS §15.25); the wrapper operand unboxes regardless of which branch runs
**Fix:** make both branches wrappers, or resolve null before the conditional

**Symptom:** NPE on a line containing only a comparison or `+=`
**Cause:** unboxing a `null` wrapper — `Map.get` miss, unset entity field, absent JSON value
**Fix:** `getOrDefault`, explicit null handling at the boundary, or primitive types where null is impossible

**Symptom:** `list.remove(x)` on a `List<Integer>` removes the wrong element or throws `IndexOutOfBoundsException`
**Cause:** an `int` argument selects `remove(int index)` — strict match beats boxing to `remove(Object)`
**Fix:** `list.remove(Integer.valueOf(x))` for by-value removal — and say why in a comment, because someone will "simplify" it back

**Symptom:** enhanced-for over a wrapper collection dies mid-iteration with an NPE at the loop header
**Cause:** the loop variable is primitive; each element unboxes, and one element was null
**Fix:** loop over the wrapper type and handle null, or guarantee the collection can't contain null (validate at the boundary where it was filled)

**Symptom:** NPE deep inside a stream pipeline's `mapToInt`/`mapToLong`
**Cause:** a null wrapper met the primitive mapping
**Fix:** `.filter(Objects::nonNull)` or a defaulting `map` before the primitive conversion — decide what absence means, don't let the pipeline decide by crashing

**Symptom:** sort crashes with NPE or "Comparison method violates its general contract"
**Cause:** wrapper `compareTo` on null elements, or a subtraction comparator that overflowed into inconsistency
**Fix:** `Comparator.nullsFirst`/`nullsLast` for placement; `comparingInt`/`Integer.compare` instead of subtraction

**Symptom:** the wrong overload runs after a parameter type was changed from `int` to `Integer` (or back)
**Cause:** overload resolution phases — strict (no boxing) beats loose (boxing) beats varargs; changing a type re-ranks the candidates
**Fix:** avoid overload pairs that differ only in boxing; when stuck with an API's pair (`List.remove`), cast at the call site to name the one you mean

## Interview questions

**★ Where can autoboxing throw `NullPointerException`?**
Anywhere unboxing meets null: arithmetic and comparisons on null wrappers,
assigning a null wrapper to a primitive (including from `Map.get` on a
missing key), enhanced-for loops with a primitive loop variable, primitive
stream mappings — and mixed-type ternaries, which unbox by *typing* even
when the null branch isn't selected.

**★ Why does `flag ? 0L : nullableLong` NPE when `flag` is true?**
JLS §15.25: a conditional with one primitive and one wrapper branch is
typed as the primitive, so the wrapper operand gets an unboxing conversion
applied as part of evaluating the expression — independent of which branch
was selected. Fix by typing both branches as the wrapper.

**★ What does `list.remove(2)` do on a `List<Integer>`?**
Calls `remove(int index)` — removes the element at index 2. Overload
resolution tries strict (no-boxing) matches first, so the by-value
`remove(Object)` needs an explicit `Integer.valueOf(2)`.

**★ Rank these for a call `f(anInt)`: `f(long)`, `f(Integer)`, `f(int...)`.**
`f(long)` — widening is a strict-phase match; then `f(Integer)` — boxing is
phase two; varargs is always last. The full three-phase story is topic 10,
but boxing's position in it is what makes wrapper overloads treacherous.

**Why is `(a, b) -> a.count() - b.count()` a bad comparator?**
Subtraction overflows (`MIN_VALUE` wraps) making the comparator
inconsistent — `TimSort` then throws "Comparison method violates its
general contract" — and if the getters return wrappers it also unboxes,
adding an NPE mode. `Comparator.comparingInt` / `Integer.compare` have
neither problem.

**How do you sum values from a `Map<String, Long>` safely for a possibly
missing key?**
`map.getOrDefault(key, 0L)` for reads; `map.merge(key, delta, Long::sum)`
for accumulation. Both make the absent case explicit instead of letting the
unboxing assignment NPE on the `null` that `get` returns.

---

← Prev: [The mechanics and the cache](01-mechanics-and-cache.md) · Index: [Autoboxing and the integer cache](README.md) · Next → [Boxing at scale](03-boxing-at-scale.md)
