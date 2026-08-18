---
title: "Raw types — the bug factory"
sidebar_label: "2 · Raw types"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §4.8 (raw types), §5.1.9
> (unchecked conversion), §4.12.2 (heap pollution), and the JDK 25 API
> documentation for `java.util.List`.

**A raw type is a generic class used with its type arguments stripped:
`List` instead of `List<Order>`. It is not "a list of anything" — that is
`List<?>` — it is a list with *checking turned off*. Every operation on it
is permitted and unverified, and the compiler marks each one with an
`unchecked` warning: the paper trail of a bug factory. Raw types survive in
the language for exactly one reason — source compatibility with pre-2004
code — and have exactly zero legitimate uses in new code.**

## What "raw" actually does

Using `List` raw does two distinct things (JLS §4.8):

```java
List raw = new ArrayList<Order>();   // legal — any parameterization assigns
raw.add("not an order");             // compiles — unchecked warning
raw.add(42);                         // compiles — unchecked warning

List<Order> orders = raw;            // compiles — unchecked warning
Order o = orders.get(0);             // ClassCastException here — the
                                     // "safe" generic read blows up
```

1. **Writes are unchecked** — the compiler lets any reference into a raw
   collection, because there is no argument to check against.
2. **Assignment to a parameterized type is an *unchecked conversion*
   (§5.1.9)** — the compiler takes your word that the raw list really
   holds `Order`s. If the word is bad, the exception surfaces later, at a
   read that looks perfectly typed.

That deferred failure has a name: **heap pollution** (§4.12.2) — a variable
of parameterized type refers to an object whose actual contents violate the
parameter. The polluted list travels through the program looking healthy;
the crash site (`orders.get(0)`) can be arbitrarily far from the pollution
site (`raw.add("...")`), in another class, written by someone else. That
distance is what makes raw types expensive: the stack trace points at
innocent code.

## `List` vs `List<Object>` vs `List<?>`

The three "I don't care about the type" spellings are three different
contracts, and only one of them is broken:

| | Accepts any `List<X>`? | Can `add` freely? | Checked? |
|---|---|---|---|
| `List` (raw) | yes | yes — unchecked | **no** |
| `List<Object>` | **no** — only `List<Object>` itself | yes — anything is an `Object` | yes |
| `List<?>` | yes | **no** — only `null` | yes |

- **`List<Object>`** is an honest "list of anything, and I may add
  anything" — but invariance (chunk 3) means a `List<String>` cannot be
  passed to it.
- **`List<?>`** is "a list of *some specific* unknown type": any list can
  come in, reads produce `Object`, and writes are forbidden (except
  `null`) because the compiler cannot prove any element type is safe.
  This is the type-safe replacement for almost every raw-type parameter —
  wildcards in full are [topic 03](../03-wildcards-pecs.md).
- **Raw `List`** is the "accepts everything, checks nothing" impostor.

The practical rule: a method that only *reads* takes `List<?>` (or better,
a bounded wildcard); a method that genuinely handles heterogeneous data
takes `List<Object>` and owns that choice; nothing takes raw.

## Where raw types leak into modern code

- **The missing diamond**: `new ArrayList()` — one typo, checking off
  (chunk 1).
- **`.class` literals and reflection**: `List.class` is `Class<List>` —
  there is no `Class<List<String>>`, so reflective code goes raw at the
  boundary and must be fenced with explicit, commented casts
  ([topic 02](../02-type-erasure.md)).
- **Old libraries and generated code** compiled against pre-generics APIs.
- **Hand-migrated pre-5 code** where someone silenced warnings instead of
  fixing types.

The fence for the unavoidable cases (reflection, deserialization):

```java
@SuppressWarnings("unchecked")            // narrowest possible scope —
List<Order> orders = (List<Order>) raw;   // one variable, with a comment
                                          // saying WHY it is actually safe
```

`@SuppressWarnings("unchecked")` on a whole method or class is the
anti-pattern: it silences the *next* bug too. Annotate the single
declaration, never wider, and write the justification down.

## Reading the warnings

- `uses unchecked or unsafe operations` / `Recompile with
  -Xlint:unchecked` — javac's summary; the flag lists each site.
- `unchecked call to add(E)` — you wrote into a raw collection.
- `unchecked conversion` — raw assigned to parameterized: the "trust me"
  moment, and the usual pollution point.
- `unchecked cast` — a cast to a parameterized type the runtime cannot
  verify (erasure): allowed, unverifiable, on you.

A clean build with `-Xlint:unchecked` and zero suppressions outside
documented reflection fences is an achievable and worthwhile bar for a
codebase.

## Gotchas

**Symptom:** `ClassCastException: String cannot be cast to Order` on a line that contains no cast
**Cause:** heap pollution — a raw reference wrote a `String` into the list earlier; the compiler inserted the failing cast at the generic read site
**Fix:** find the raw reference (compile with `-Xlint:unchecked`), parameterize it; the warning list is the map to the pollution source

**Symptom:** calling a method on a raw reference wipes out generics *unrelated* to the type parameter
**Cause:** JLS §4.8 — on a raw type, the type of every member is erased, including generic method signatures that don't mention `T`; `rawList.stream()` yields a raw `Stream`
**Fix:** never call through raw references; the erasure contagion spreads through whole call chains

**Symptom:** `List<String>` won't pass to a `List<Object>` parameter, so someone "fixed" the parameter to raw `List`
**Cause:** the real need was a wildcard; raw was the wrong escape hatch for invariance
**Fix:** `List<?>` for read-only, `List<? extends X>`/`List<? super X>` per [topic 03](../03-wildcards-pecs.md)

**Symptom:** `@SuppressWarnings("unchecked")` on a 200-line method; a new real warning inside it goes unseen
**Cause:** suppression scoped wider than the one justified cast
**Fix:** move the suppression to the single variable declaration; if the method has several, each gets its own with its own justification comment

**Symptom:** test with a raw `List` passes; production read crashes
**Cause:** pollution is only punished at a *typed read* — code paths that never read the wrong element never fail
**Fix:** the compiler already told you at the write (`unchecked`); treat those warnings as errors (`-Werror` with `-Xlint:unchecked`) so the test run can't shrug them off

**Symptom:** IDE shows `List` parameter in an old interface; implementing it forces raw types into new code
**Cause:** the interface predates generics or was never migrated
**Fix:** migrate the interface if you own it; if not, fence the boundary — convert to parameterized types immediately at the call edge with one documented suppressed cast

## Interview questions

**★ What is the difference between `List`, `List<Object>` and `List<?>`?**
Raw `List` accepts any list and any write, unchecked — heap pollution
waiting to happen. `List<Object>` is checked and writable but, by
invariance, only a `List<Object>` itself assigns to it. `List<?>` accepts
any list, allows reads as `Object`, and forbids writes except `null` —
the type-safe "some list, I won't write" contract.

**★ What is heap pollution, and where does the exception surface?**
A parameterized variable pointing at an object whose contents violate the
parameter — created by unchecked writes or unchecked conversions. The
`ClassCastException` surfaces at a later *typed read*, where the compiler
inserted the cast — a different line, often a different class, than the
pollution site. That distance is the whole argument against raw types.

**★ Why do raw types exist at all?**
Migration compatibility: Java 5 had to let pre-generics code compile and
interoperate with generified libraries unchanged, in both directions. The
JLS (§4.8) says plainly that raw types are permitted only for legacy
compatibility — new code has no legitimate use.

**★ Why does calling a method on a raw type erase even unrelated generics?**
By JLS §4.8 the members of a raw type are the erasures of the members of
the generic declaration — wholesale, not per-parameter. It approximates
"pretend this class was never generified". Practical consequence: one raw
reference in a stream chain turns the entire chain raw.

**★ When is `@SuppressWarnings("unchecked")` legitimate, and how should it be scoped?**
At erasure boundaries the runtime can't verify — reflection,
deserialization, generic array creation inside a collection
implementation — where *you* can prove safety the compiler can't. Scope:
the single declaration, with a comment stating the proof. Method- or
class-level suppression silences future unrelated bugs.

**Does a raw type behave differently from an erased type at runtime?**
No — at runtime everything is erased; raw vs parameterized is purely a
compile-time distinction about how much checking you get. That is exactly
why the raw type's damage (missing checks) is invisible in the bytecode
and only manifests as pollution.

---

← Prev: [The contract with the compiler](01-the-contract-with-the-compiler.md) · Next → [Generic methods and invariance](03-generic-methods-and-invariance.md)
