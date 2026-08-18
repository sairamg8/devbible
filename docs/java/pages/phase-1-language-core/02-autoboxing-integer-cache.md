---
title: "Autoboxing and the integer cache"
sidebar_label: "02 · Autoboxing and the cache"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §5.1.7 (boxing conversion, including
> the guaranteed cache range) and §15.25 (conditional operator typing), and the
> JDK 25 `Integer.valueOf` API documentation.

**Autoboxing lets primitives and wrappers substitute for each other so
smoothly that code stops showing where the conversions are — and every
conversion is a place where reference semantics (`==` is identity, `null`
exists) and value semantics silently swap. The result is Java's most
reliable interview question *because* it is Java's most reliable production
bug: wrapper comparison that works for small numbers and fails for big ones,
and arithmetic that NPEs.**

## What the compiler actually inserts

Boxing and unboxing are `javac` rewrites, not runtime magic:

```java
Integer boxed = 42;          // compiles to Integer.valueOf(42)
int back = boxed;            // compiles to boxed.intValue()
Long sum = 0L;
for (long i = 0; i < n; i++) sum += i;   // valueOf + longValue EVERY pass
```

`javap -c` shows the `valueOf`/`intValue` calls. Two facts follow:

- Every boxing site is an object-producing call; in a hot loop (like that
  `Long sum` accumulator) that is an allocation per iteration plus
  pointer-chasing — the classic "why is this loop slow" answer.
- Unboxing is a method call **on the wrapper** — so a `null` wrapper makes
  the innocent-looking `+`, `<`, or assignment throw `NullPointerException`.

## The cache: why 127 works and 128 doesn't

`Integer.valueOf` is *required* by the JLS to return **cached, shared
instances for values −128 to 127** (likewise `Short`, `Byte`, `Long` in that
range, `Character` 0–127, and both `Boolean`s). Outside the range it may
allocate a fresh object — and in practice does.

```java
Integer a = 127, b = 127;
a == b        // true  — both are the cached instance (JLS-guaranteed)

Integer c = 128, d = 128;
c == d        // false — two distinct objects; == compares references
```

Both lines are *specified* behaviour, not luck. The upper bound is tunable
(`-XX:AutoBoxCacheMax=...`), which makes relying on it doubly absurd: the
comparison's result can change with a JVM flag.

**The production shape of this bug:** ids or codes compared with `==`. Tests
use ids 1, 2, 3 — cached, `==` true, tests green. Production ids are in the
millions — `==` false, and an "equal ids" check silently never matches. It
works in the test and fails with real data *by construction*.

## The rules that keep you safe

| Situation | What happens | Rule |
|---|---|---|
| `wrapper == wrapper` | reference identity — cache-dependent lie | **never**; use `.equals` / `Objects.equals` (null-safe) |
| `wrapper == primitive` | wrapper is **unboxed**, values compared | true value comparison — but NPEs if the wrapper is null |
| `wrapper.equals(other)` | value comparison — and type-strict | `Integer(1).equals(Long(1))` is **false**: different classes |
| arithmetic on wrappers | both unboxed, result re-boxed | fine for a line; hostile in a loop; NPE on null |

The third row is its own trap: `equals` across wrapper types is always
false even for equal values — `Objects.equals(anInteger, aLong)` quietly
never matches. Compare like types, or compare primitives.

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
(`flag ? Long.valueOf(0L) : discount`) or handling `null` before the ternary.

**The comparison.** `if (row.getCount() > limit)` unboxes `getCount()`'s
`Integer` — the NPE points at a line containing only `>`.

**The `Map.get` chain.** `long total = totals.get(key);` — a missing key
returns `null`, and the assignment unboxes it. `getOrDefault(key, 0L)` says
what you meant.

## The `List.remove` ambush

`List<Integer>` has both `remove(int index)` and `remove(Object element)` —
and an `int` argument picks the **index** overload without boxing:

```java
list.remove(2);                    // removes the element AT INDEX 2
list.remove(Integer.valueOf(2));   // removes the first element EQUAL to 2
```

Overload resolution prefers the exact primitive match over boxing
(topic 10's resolution order). With ids in a `List<Integer>`, the first form
compiles, runs, and deletes the wrong thing — or throws
`IndexOutOfBoundsException` from data-dependent values.

## Hidden boxing at scale

`List<Integer>`, `Map<Long, T>` keys, `Stream<Integer>` — each element is an
object. For bulk numerics this is real memory (an `Integer` costs ~4× an
`int`) and real GC pressure. The escape hatches, in the order you should
reach for them: primitives and arrays where the collection isn't needed;
`IntStream`/`LongStream` with `mapToInt`/`mapToLong` for pipelines
(Phase 4); boxed collections when N is small — which it usually is. Measure
before contorting (Phase 12's JMH), but *know* where the cost lives.

## Gotchas

**Symptom:** id-equality check passes every test, never matches in production
**Cause:** `Integer == Integer` compares references; test ids ≤127 hit the JLS-mandated cache and share instances, real ids don't
**Fix:** `.equals`/`Objects.equals` for wrappers, or keep ids primitive. Treat any `==` between wrapper types as a bug in review

**Symptom:** NPE on a line containing only a comparison or `+=`
**Cause:** unboxing a `null` wrapper — `Map.get` miss, unset entity field, absent JSON value
**Fix:** `getOrDefault`, explicit null handling at the boundary, or primitive types where null is impossible

**Symptom:** NPE from a ternary even though the null branch "wasn't taken"
**Cause:** mixed primitive/wrapper branches type the expression as primitive (JLS §15.25); the wrapper operand unboxes regardless of which branch runs
**Fix:** make both branches wrappers, or resolve null before the conditional

**Symptom:** `list.remove(x)` on a `List<Integer>` removes the wrong element or throws `IndexOutOfBoundsException`
**Cause:** an `int` argument selects `remove(int index)` — exact match beats boxing to `remove(Object)`
**Fix:** `list.remove(Integer.valueOf(x))` for by-value removal — and say why in a comment, because someone will "simplify" it back

**Symptom:** `Objects.equals(count, expected)` is false though both print the same number
**Cause:** different wrapper classes — `Integer.equals(Long)` is false by type check before value check
**Fix:** align the types (both `long`/`Long`), or compare unboxed primitives

**Symptom:** hot accumulation loop is slow and allocation-heavy in the profiler
**Cause:** a wrapper accumulator (`Long sum`) boxes and unboxes every iteration — one allocation per pass
**Fix:** primitive accumulator; for streams, `mapToLong(...).sum()` instead of `reduce` over boxed values

**Symptom:** the same wrapper `==` comparison behaves differently between environments
**Cause:** the cache's upper bound is tunable (`-XX:AutoBoxCacheMax`) — reference comparison results can vary with JVM flags
**Fix:** the same fix as always: never `==` on wrappers; the flag just makes the crime harder to prosecute

## Interview questions

**★ `Integer a = 127, b = 127; a == b` — and with 128? Explain both.**
True, then false. Boxing goes through `Integer.valueOf`, which the JLS
requires to return shared cached instances for −128…127 — so 127 gives one
object, `==` true. 128 allocates distinct objects; `==` compares references,
false. Values must be compared with `equals`.

**★ Why does this bug pass tests and fail in production?**
Test data is small — ids 1, 2, 3 sit in the cache, so identity comparison
accidentally equals value comparison. Real ids exceed 127 and the same code
compares distinct objects. The bug's trigger is the *magnitude of the data*,
which is exactly what tests understate.

**★ Where can autoboxing throw `NullPointerException`?**
Anywhere unboxing meets null: arithmetic and comparisons on null wrappers,
assigning a null wrapper to a primitive (including from `Map.get` on a
missing key), and mixed-type ternaries, which unbox by *typing* even when
the null branch isn't selected.

**★ `wrapper == primitive` — reference or value comparison?**
Value: the wrapper is unboxed and the primitives compared. That makes
`Integer x = ...; x == 5` correct-but-NPE-prone, while `x == y` between two
wrappers is the identity trap. The asymmetry is worth stating in review.

**What does `list.remove(2)` do on a `List<Integer>`?**
Calls `remove(int index)` — removes the element at index 2. Overload
resolution tries exact/widening matches before boxing, so the by-value
`remove(Object)` needs an explicit `Integer.valueOf(2)`.

**Why is `Integer.equals(Long.valueOf(1))` false for equal values?**
Wrapper `equals` implementations check the class first; cross-type
comparisons are false regardless of value. Normalize the types before
comparing — a subtle killer in map lookups where key types drifted.

**What is the performance story of boxed collections?**
Each element is a heap object (~4× the primitive's size plus indirection),
allocated at each boxing site, collected later. Fine at small N; measurable
in bulk pipelines — where `IntStream`/`LongStream` or primitive arrays keep
the numbers unboxed.

---

← Prev: [Primitives vs references](01-primitives-vs-references.md) · Next → [`var` — local-variable type inference](03-var.md)
