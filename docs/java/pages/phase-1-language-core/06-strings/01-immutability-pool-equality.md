---
title: "Immutability, the pool and equality"
sidebar_label: "1 · Immutability, pool, equality"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 `String` and `String.intern()` Javadoc,
> JLS §3.10.5 (string literals are interned), §15.28 (constant expressions),
> and JEP 254 (compact strings, 9).

**A `String` can never change. Every method that looks like a modification —
`toUpperCase`, `replace`, `concat`, `substring` — returns a *new* string and
leaves the original untouched. On top of that immutability the JVM builds a
*pool* of shared literal strings, and the pool is what makes `==` on strings
the most dangerous kind of bug: the kind that passes its tests.**

## Why immutability, actually

Immutability is not a stylistic preference — four load-bearing properties
depend on it:

1. **Safe sharing.** Any number of threads, callers and collections can hold
   the same `String` with no defensive copying — the object cannot change
   under them. (Phase 2's immutable-design topic generalizes this; Phase 6
   collects the concurrency payoff.)
2. **Pooling is possible at all.** Two variables may point at one shared
   `"ACTIVE"` only because neither can mutate it for the other.
3. **`hashCode` caching.** A string computes its hash once and stores it in a
   private field — this is why strings make cheap `HashMap` keys. A mutable
   string would break the map the moment it changed (the exact disaster
   Phase 2's `equals`/`hashCode` topic demonstrates with mutable keys).
4. **Security boundaries.** File paths, class names and URLs are validated
   *then used*; if the string could change between those two moments,
   validation would be meaningless.

The cost is allocation: a "modify" is a copy. That cost is what
[chunk 2](02-building-and-formatting.md) manages.

```java
String name = "order";
name.toUpperCase();          // does nothing useful — result discarded
name = name.toUpperCase();   // the only way "change" exists: rebind
```

The first line is a real bug reviewers catch weekly: calling a "mutator" and
ignoring that the receiver is untouched. Since Java 9 (JEP 254), the backing
storage is a `byte[]` with a coder flag rather than a `char[]` — an internal
detail that halved the memory of Latin-1 text and changes nothing observable.

## The string pool

String *literals* are interned: JLS §3.10.5 guarantees that identical literal
contents anywhere in the program name the **same object** in a JVM-wide pool.

```java
String a = "ACTIVE";
String b = "ACTIVE";            // same pooled object as a
String c = new String("ACTIVE"); // explicitly a NEW object, never pooled
String d = someHttpParam();      // built at run time — not pooled
```

Per the JLS, `a == b` is `true` — one pooled object. `a == c` and `a == d`
are `false` — different objects with equal contents. `new String(...)`
*always* allocates (which is why the idiom is useless outside teaching
examples), and strings built at run time — concatenation of variables, HTTP
input, database reads, `Scanner` — are ordinary heap objects the pool never
sees.

`intern()` asks the pool for the canonical copy, adding one if absent. Real
uses are rare (massive-scale deduplication of repeated values); sprinkling
`intern()` to "fix" `==` comparisons is treating the symptom and keeping the
disease.

## `==` vs `equals` — the bug that passes its tests

`==` on references compares **identity** — same object — for strings exactly
as for every other object ([Phase 0's model](../../phase-0-platform-jvm/README.md)
of references). `equals` compares **contents**, and `String` overrides it to
do so character by character.

The trap has a precise shape:

```java
if (order.status() == "ACTIVE") { ... }   // WRONG — and worse: sometimes right
```

In a unit test that constructs `Order` with the literal `"ACTIVE"`, both sides
are the same pooled object and the comparison *works*. In production, where
the status arrived from PostgreSQL or an HTTP body, it is a distinct object
and the branch silently never fires. A bug that tests cannot catch by
construction is the worst kind — which is why this page is Master tier.

The rules that end it:

```java
"ACTIVE".equals(order.status())          // constant first: also null-safe
Objects.equals(a, b)                      // null-safe when both sides vary
a.equalsIgnoreCase(b)                     // case-insensitive variant
```

Constant-first calling order is not superstition: `order.status().equals(...)`
throws `NullPointerException` when the status is null, while
`"ACTIVE".equals(null)` is simply `false` — often exactly the semantics a
guard wants. (When null is a *bug* rather than a case, let it throw —
[Phase 1 topic 13's](../README.md) boundary discipline decides which.)

## Constant folding — why `"a" + "b" == "ab"`

JLS §15.28 defines *constant expressions*: expressions the compiler must
evaluate at compile time. Concatenation of literals qualifies, so

```java
String x = "a" + "b";      // compiled as the single literal "ab"
final String p = "a";      // final + constant initializer = constant variable
String y = p + "b";        // ALSO folds to "ab" — p is a constant expression
String q = getA() + "b";   // runtime concat — new object, not pooled
```

`x == "ab"` and `y == "ab"` are `true` — the compiler emitted one pooled
literal; no concatenation exists at run time. Drop the `final` from `p`, or
produce either operand at run time, and the result is a fresh object for
which `==` against the literal is `false`.

This is the same compile-time-constant machinery whose inlining-across-jars
trap Phase 0 documented in
[Source to bytecode](../../phase-0-platform-jvm/01-what-java-is/01-source-to-bytecode.md) —
one mechanism, two ways to be surprised.

## Gotchas

**Symptom:** a status comparison works in every test and silently fails in production
**Cause:** `==` on strings — tests compare pooled literals (same object), production compares run-time-built strings (different objects, equal contents)
**Fix:** `equals`, constant first. Grep the codebase for `== "` and `!= "` — each hit is a latent bug even if it currently passes

**Symptom:** `str.toUpperCase()` appears to do nothing
**Cause:** immutability — the method returns the changed copy; the receiver is untouched and the return value was discarded
**Fix:** rebind: `str = str.toUpperCase()`. Modern IDEs and error-prone flag ignored return values of pure methods

**Symptom:** code calls `.intern()` before every comparison "so `==` works"
**Cause:** treating pooling as the fix for an equality bug
**Fix:** `equals`. `intern()` is for large-scale deduplication of repeated values, and even there measure first — the pool is not free

**Symptom:** `new String("x")` in reviewed code
**Cause:** cargo cult — it manufactures a guaranteed-distinct copy of an already-available object
**Fix:** use the literal. The only historical justification (detaching a small substring from a huge backing array) died in 7u6 when `substring` became a copy

**Symptom:** two "equal" strings, `equals` returns false, and they *print* identically
**Cause:** invisible content differences — trailing whitespace, NBSP vs space, combining characters vs precomposed (é as one code point vs e + U+0301)
**Fix:** log lengths and code points (`chars()`) when string equality surprises; normalize with `java.text.Normalizer` at input boundaries where Unicode equivalence matters

**Symptom:** a `final String` constant changed in a library, consumers still see the old value after redeploy
**Cause:** constant variables are compile-time constants — folded and inlined into consuming class files
**Fix:** recompile consumers, or expose the value via a method instead of a constant field — Phase 0's inlining trap, met through strings

## Interview questions

**★ What does `"a" + "b" == "ab"` evaluate to, and why?**
`true`. Both operands are literals, so JLS §15.28 makes the concatenation a
constant expression: the compiler emits the single pooled literal `"ab"`, and
both sides of `==` are that one object. Make either operand non-constant and
the result becomes a fresh runtime object — then `==` is `false`.

**★ Why did `status == "ACTIVE"` pass all tests and fail in production?**
Tests built the status from the same literal — one pooled object, identity
holds. Production received the string from I/O — different object, identical
contents. `==` compares identity; `equals` compares contents. The bug is
undetectable by tests that use literals, which is exactly how it ships.

**★ Why is `String` immutable? Give the engineering reasons, not "security" alone.**
Safe unsynchronized sharing across threads and collections; pooling (sharing
requires unchangeability); one-time `hashCode` computation, making strings
cheap map keys; and validate-then-use security semantics for paths, URLs and
class names. The price is allocation on every transformation.

**★ What does `intern()` do, and when is it legitimate?**
Returns the pool's canonical object for the contents, adding it if absent.
Legitimate for deduplicating millions of repeated runtime values (memory);
illegitimate as an `==` enabler. Since Java 7 interned strings live on the
normal heap, so the old PermGen-exhaustion fear is history — the reason to
avoid it is design, not memory.

**★ Where should the constant go in `equals`, and why?**
First: `"ACTIVE".equals(status)`. It cannot throw when `status` is null —
it just returns false. The reversed form NPEs. Use `Objects.equals` when
both sides are variables.

**Is the string pool per-class or JVM-wide, and when does a literal enter it?**
JVM-wide. A class's literals are interned as its constant pool entries
resolve — effectively at first use of the class. Identical literals in
different classes and different jars still collapse to one object.

**What changed about `String`'s internals in Java 9, and what did it break?**
Compact strings (JEP 254): storage moved from `char[]` to `byte[]` plus a
coder byte, halving memory for Latin-1 content. Observable behaviour:
nothing — it is the canonical example of an internal representation change
hidden behind an immutable API.

---

← Index: [Strings](README.md) · Next → [Building and formatting](02-building-and-formatting.md)
