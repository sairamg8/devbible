---
title: "Building comparators"
sidebar_label: "2 · Building comparators"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.Comparator` (`comparing`, `comparingInt`, `thenComparing`,
> `reversed`, `nullsFirst`, `nullsLast`, `naturalOrder`), `Integer#compare`,
> `Double#compare`, and JLS SE 25 §15.18.2 (integer overflow wraps silently).

**Since Java 8 you compose comparators from key extractors instead of writing
`compare` by hand: `comparing` names *what* to sort by, `thenComparing` adds
tiebreakers, `reversed` flips, `nullsFirst` decides the one question natural
order refuses to answer. The hand-written alternative is where two famous
bugs live — subtracting ints and comparing doubles with `<` — both of which
pass small tests and corrupt sorts in production.**

## The composition vocabulary

```java
record Employee(String dept, String name, int salary,
                LocalDate hired, String badge) {}

Comparator<Employee> order =
    Comparator.comparing(Employee::dept)                 // primary key
              .thenComparing(Employee::name)             // tiebreaker 1
              .thenComparingInt(Employee::salary)        // tiebreaker 2, unboxed
              .reversed();                               // flips the WHOLE chain
```

- **`comparing(keyExtractor)`** — sort by an extracted key, using the key's
  natural order. `comparing(extractor, keyComparator)` when the key needs
  its own comparator (`comparing(Employee::name, String.CASE_INSENSITIVE_ORDER)`).
- **`comparingInt` / `comparingLong` / `comparingDouble`** (and the
  `thenComparingX` forms) — primitive-specialized: same result, no boxing of
  every key. With a million elements sorting by an `int` field, `comparing`
  boxes each key extraction; `comparingInt` doesn't. Prefer the primitive
  form whenever the key is primitive.
- **`thenComparing`** — applied only when everything before it tied (returned
  0). Chains read exactly like an ORDER BY list.
- **`reversed()`** — reverses the *entire comparator built so far*, not the
  next key. `comparing(a).reversed().thenComparing(b)` means "descending a,
  then ascending b among equal a" — the `thenComparing` attaches *after* the
  reversal and is not itself reversed. When one key of several must be
  descending, reverse that key alone:
  `comparing(Employee::dept).thenComparing(Employee::salary, Comparator.reverseOrder())`.
- **`naturalOrder()` / `reverseOrder()`** — the natural order as a reusable
  comparator object, for APIs that want a `Comparator` argument.
- **`nullsFirst(cmp)` / `nullsLast(cmp)`** — wrap a comparator so `null`
  *elements* sort to one end instead of throwing. For null *keys*, wrap the
  key comparator: `comparing(Employee::hired, nullsLast(naturalOrder()))`.

Store the result in a named constant when more than one call site needs it —
a comparator is stateless and thread-safe, and the name documents the policy:

```java
public static final Comparator<Employee> SENIORITY =
    Comparator.comparing(Employee::hired)
              .thenComparing(Employee::badge);   // total, stable tiebreak
```

## The subtraction bug

The pre-Java-8 idiom — "subtract, the sign falls out":

```java
// BROKEN — do not ship
Comparator<Employee> bySalary = (a, b) -> a.salary() - b.salary();
```

Correct for small numbers, and wrong in general: **int subtraction overflows
silently** (JLS §15.18.2 — the result wraps, no exception; the same silent
wraparound as [Phase 1 topic 04](../../phase-1-language-core/04-operators-overflow/README.md)).
`Integer.MIN_VALUE - 1` wraps to a huge *positive* value, so a hugely
negative `a` compared with a positive `b` can report "a comes after b".
The sort doesn't just misplace those two elements — a comparator that is
sometimes wrong is *intransitive*, which TimSort detects and punishes with
the `IllegalArgumentException` dissected in
[chunk 3](03-the-contract.md), or repays with a silently garbled order.

The fix costs nothing:

```java
Comparator<Employee> bySalary = (a, b) -> Integer.compare(a.salary(), b.salary());
// or better, say what you mean:
Comparator<Employee> bySalary = Comparator.comparingInt(Employee::salary);
```

`Integer.compare`, `Long.compare`, `Short.compare` — all overflow-proof, all
since Java 7. There is no reason to ever write the subtraction form; when
you see it in review, it is a bug even if today's data is small. (Subtraction
is *also* wrong for unsigned-flavored comparisons — that's what
`Integer.compareUnsigned` is for.)

## The floating-point twin

```java
// BROKEN differently
Comparator<Reading> byValue = (a, b) -> a.value() < b.value() ? -1
                                      : a.value() > b.value() ? 1 : 0;
```

`NaN` answers `false` to every `<`, `>`, `==` — so any `NaN` compares "equal"
to everything, which is intransitive the moment real values are present
([Phase 1 topic 05](../../phase-1-language-core/05-floating-point-bigdecimal/README.md)).
`Double.compare` (and `comparingDouble`) defines a total order: `NaN` sorts
last, and `-0.0` sorts before `0.0`. That total order is *deliberately*
inconsistent with `==` at those two edges — the price of totality, and the
right trade inside a sort.

For money, the key is `BigDecimal`, and its `compareTo` treats `1.0` and
`1.00` as equal while its `equals` does not — the classic
consistency-with-equals case, picked up in
[chunk 3](03-the-contract.md).

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Sort mostly right, wrong for extreme values; or `IllegalArgumentException` from `Arrays.sort` | `(a, b) -> a.x - b.x` — int subtraction overflow makes the comparator intransitive | `Integer.compare` / `comparingInt`; never subtract to compare |
| Descending sort also reversed the tiebreaker (or didn't — opposite of intent) | `reversed()` reverses the whole chain built so far, and `thenComparing` after it is not reversed | Put `reversed()` where its scope says what you mean, or reverse a single key with a per-key comparator |
| `NullPointerException` sorting a list with `null` elements | `comparing`-built comparators and natural order reject `null` | `nullsFirst(...)`/`nullsLast(...)` around the element comparator |
| NPE with no `null` *elements* in sight | A key extractor returned `null` (`Employee::hired` on a not-yet-hired record) | Wrap the *key* comparator: `comparing(Employee::hired, nullsLast(naturalOrder()))` |
| `NaN` readings scattered arbitrarily through a "sorted" report | Hand-written `<`/`>` comparator — `NaN` ties with everything | `Double.compare` / `comparingDouble` — total order, `NaN` last |
| Sorting a huge list by an int key is slower than expected | `comparing(e -> e.salary())` boxes every key | `comparingInt` / `thenComparingInt` |
| Two "equal" employees swap order between runs and break a paginated API | Comparator not total — no tiebreaker, and the sort's tie order isn't a contract across data changes | End chains with a unique key (`thenComparing(Employee::badge)`) when stable identity matters |
| `Comparator.comparing(Employee::name)` won't compile on a raw/inferred lambda | Type inference can't see `T` without a target type | Add the type witness `Comparator.<Employee, String>comparing(...)` or declare the variable's type explicitly |

## Interview questions

1. **Why is `(a, b) -> a.x - b.x` broken, and what's the fix?** Int
   subtraction wraps on overflow (no exception), so for operands far apart
   the sign is wrong; the comparator becomes intransitive and either garbles
   the sort or triggers TimSort's contract exception. Use
   `Integer.compare`/`comparingInt`.
2. **What exactly does `reversed()` reverse?** The entire comparator it's
   called on — everything composed before it. Tiebreakers chained *after*
   `reversed()` are in their own (ascending) direction. To descend on one
   key only, give that key `Comparator.reverseOrder()` as its key comparator.
3. **`nullsFirst` at the element level vs the key level — what's the
   difference?** Element level tolerates `null` *entries in the list*; key
   level tolerates a `null` *field* inside non-null entries. They compose:
   `nullsLast(comparing(X::k, nullsFirst(naturalOrder())))` handles both.
4. **Why do `comparingInt`/`comparingDouble` exist when `comparing`
   works?** Boxing: generic `comparing` boxes every extracted primitive key.
   The primitive forms compare without allocation — same order, cheaper on
   large sorts.
5. **How does `Double.compare` order `NaN` and `-0.0`, and why is that
   "wrong on purpose"?** `NaN` after everything, `-0.0` before `0.0` — a
   total order, required for sorting, even though `==` semantics say NaN is
   unordered and `-0.0 == 0.0`. Totality beats IEEE fidelity inside a sort.
6. **A paginated endpoint sorted by `createdAt` shows the same row on page 2
   and page 3. The comparator?** Not total — many rows tie on `createdAt`
   and tie-order isn't stable across queries. Add a unique tiebreaker
   (`thenComparing(id)`) so the order is deterministic.
7. **When would you still write `compare` by hand instead of composing?**
   Rarely: multi-field logic that isn't a lexicographic chain (e.g. "nulls
   are equal to each other but interleave by date"), or hot paths where a
   hand-fused comparison avoids extractor allocation. Start with the
   composed form; hand-write only with a reason you can say out loud.

---

← Prev: [Two kinds of order](01-two-orders.md) · Index: [Comparable vs Comparator](README.md) · Next → [The contract, and what breaks it](03-the-contract.md)
