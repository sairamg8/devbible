---
title: "The mechanics and the cache"
sidebar_label: "1 · Mechanics and the cache"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §5.1.7 (boxing conversion) and
> §5.1.8 (unboxing conversion), and the JDK 25 `Integer.valueOf`,
> `Long.valueOf`, `Short.valueOf`, `Byte.valueOf`, `Character.valueOf` and
> `Boolean.valueOf` API documentation.

**Boxing and unboxing are `javac` rewrites, not runtime magic: every boxing
site becomes an `Integer.valueOf`-style call, every unboxing site an
`intValue()`-style call. `valueOf` is required by the JLS to hand out shared
cached instances for small values — which is why `==` on wrappers *appears*
to work in tests and stops working the day the data grows past 127.**

## What the compiler actually inserts

```java
Integer boxed = 42;          // compiles to Integer.valueOf(42)
int back = boxed;            // compiles to boxed.intValue()
Long sum = 0L;
for (long i = 0; i < n; i++) sum += i;   // valueOf + longValue EVERY pass
```

`javap -c` shows the `valueOf`/`intValue` calls. Two facts follow:

- Every boxing site is an object-producing call; in a hot loop (like that
  `Long sum` accumulator) that is an allocation per iteration plus
  pointer-chasing — the classic "why is this loop slow" answer
  ([chunk 3](03-boxing-at-scale.md) counts it).
- Unboxing is a method call **on the wrapper** — so a `null` wrapper makes
  the innocent-looking `+`, `<`, or assignment throw `NullPointerException`
  ([chunk 2](02-unboxing-npes-overloads.md) catalogues the shapes).

Boxing never happens where a primitive is expected and provided, and never
`new Integer(...)` — the wrapper constructors were deprecated for removal
years ago precisely because they bypass the cache and defeat the identity
expectations `valueOf` maintains.

## The cache: why 127 works and 128 doesn't

The JLS (§5.1.7) **requires** boxing to return cached, shared instances for:

| Wrapper | Guaranteed cached range | Beyond it |
|---|---|---|
| `Boolean` | both values | — |
| `Byte` | all 256 values | — |
| `Short` | −128 … 127 | may allocate fresh |
| `Integer` | −128 … 127 | may allocate fresh — upper bound tunable |
| `Long` | −128 … 127 (per the `valueOf` Javadoc) | may allocate fresh |
| `Character` | `'\u0000'` … `'\u007F'` (0–127) | may allocate fresh |
| `Float` / `Double` | **nothing cached** | every box may be fresh |

```java
Integer a = 127, b = 127;
a == b        // true  — both are the cached instance (JLS-guaranteed)

Integer c = 128, d = 128;
c == d        // false — two distinct objects; == compares references
```

Both lines are *specified* behaviour, not luck. Notice the last table row:
`Double x = 0.5, y = 0.5; x == y` is allowed to be — and in practice is —
`false` for **every** value, so the "small values work" intuition doesn't
even hold for floating wrappers.

The `Integer` upper bound is tunable (`-XX:AutoBoxCacheMax=<size>`, surfaced
in the `Integer` Javadoc via the `java.lang.Integer.IntegerCache.high`
property), which makes relying on it doubly absurd: the comparison's result
can change with a JVM flag.

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
| `wrapper.compareTo(wrapper)` | value comparison, same type only | fine — but nulls still NPE |

The third row is its own trap: `equals` across wrapper types is always
false even for equal values — `Objects.equals(anInteger, aLong)` quietly
never matches. The `equals` implementations check the class before the
value, per their Javadoc. Compare like types, or compare primitives. The
sibling trap: a `Map<Long, T>` probed with an `int`-valued key —
`map.get(42)` boxes to `Integer`, which equals no `Long` key, and the
lookup misses forever without an error.

## Gotchas

**Symptom:** id-equality check passes every test, never matches in production
**Cause:** `Integer == Integer` compares references; test ids ≤127 hit the JLS-mandated cache and share instances, real ids don't
**Fix:** `.equals`/`Objects.equals` for wrappers, or keep ids primitive. Treat any `==` between wrapper types as a bug in review

**Symptom:** the same wrapper `==` comparison behaves differently between environments
**Cause:** the cache's upper bound is tunable (`-XX:AutoBoxCacheMax`) — reference comparison results can vary with JVM flags
**Fix:** the same fix as always: never `==` on wrappers; the flag just makes the crime harder to prosecute

**Symptom:** `Objects.equals(count, expected)` is false though both print the same number
**Cause:** different wrapper classes — `Integer.equals(Long)` is false by type check before value check
**Fix:** align the types (both `long`/`Long`), or compare unboxed primitives

**Symptom:** `map.get(id)` always misses though the key "is there"
**Cause:** the map keys are `Long`, the probe boxed an `int` to `Integer` — cross-type `equals` never matches
**Fix:** make the probe's type match the key type (`map.get((long) id)` / declare ids `long` end to end)

**Symptom:** `Double a = 0.5, b = 0.5; a == b` is false even for the "small value"
**Cause:** floating wrappers cache nothing — the integer-cache intuition doesn't transfer
**Fix:** `equals`/`compareTo` — and for doubles remember `equals` differs from `==` on `NaN`/`-0.0` too ([topic 05](../05-floating-point-bigdecimal/01-ieee-754-doubles.md))

**Symptom:** deprecation warnings on `new Integer(...)` / code review flags it
**Cause:** the wrapper constructors are deprecated for removal — they always allocate, bypassing the cache and wasting the identity guarantees
**Fix:** `Integer.valueOf(...)`, or just let autoboxing call it for you

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

**★ Which values does the JLS guarantee are cached, per wrapper?**
Both `Boolean`s, all `Byte`s, −128…127 for `Short`/`Integer`/`Long`, 0–127
for `Character` — and nothing for `Float`/`Double`. The `Integer` upper
bound can be raised with `-XX:AutoBoxCacheMax`.

**★ `wrapper == primitive` — reference or value comparison?**
Value: the wrapper is unboxed and the primitives compared. That makes
`Integer x = ...; x == 5` correct-but-NPE-prone, while `x == y` between two
wrappers is the identity trap. The asymmetry is worth stating in review.

**Why is `Integer.valueOf(1).equals(Long.valueOf(1))` false?**
Wrapper `equals` implementations check the class first; cross-type
comparisons are false regardless of value. Normalize the types before
comparing — a subtle killer in map lookups where key types drifted.

**Why were the wrapper constructors deprecated?**
`new Integer(5)` always allocates a distinct object — never cache-shared,
so identity behaves differently from boxed values, and it wastes memory.
`valueOf` is the factory with the cache; deprecation-for-removal pushes all
code through it.

**What exactly does the compiler emit for `Integer x = 5; int y = x;`?**
`Integer.valueOf(5)` for the boxing, `x.intValue()` for the unboxing —
visible in `javap -c`. Knowing it is method calls, not magic, explains both
the null NPE (call on null) and the allocation cost (a call that may
allocate).

---

Index: [Autoboxing and the integer cache](README.md) · Next → [Unboxing NPEs and overload ambushes](02-unboxing-npes-overloads.md)

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [Conversions and Contexts (JLS chapter 5)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-5.html) — Oracle: boxing conversion (5.1.7), including the rule that values from -128 to 127 must be cached (*read*)
- **Also good:** [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html) — Javadoc: `valueOf` (*read*)
- **Beyond the docs:** [EXP03-J. Do not use the equality operators when comparing values of boxed primitives](https://cmu-sei.github.io/secure-coding-standards/sei-cert-oracle-coding-standard-for-java/rules/expressions-exp/exp03-j/) — SEI CERT Oracle Coding Standard for Java, Carnegie Mellon SEI: quotes JLS 5.1.7 on which boxed values are always cached (booleans, bytes, chars up to `\u007f`, ints and shorts from -128 to 127), notes a JVM may cache more so code relying on it is nonportable, and shows a `Comparator` that use

{/* LINKMAP:END */}
