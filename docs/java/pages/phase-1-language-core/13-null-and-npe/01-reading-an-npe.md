---
title: "Reading an NPE"
sidebar_label: "1 · Reading an NPE"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against JEP 358 (Helpful NullPointerExceptions —
> introduced in 14 behind a flag, enabled by default since 15), the JLS SE 25
> §4.1 and §5.1.8 (unboxing conversion), and the `NullPointerException`
> JDK 25 API documentation.

**An NPE is thrown at the moment of *dereference*, never at the moment a null
was created or passed — and those can be minutes and three layers apart.
Since JDK 15 the JVM closes half that gap for you: the exception message
names the precise sub-expression that was null. Learn the five dereference
shapes, learn to read the helpful message, and the average NPE goes from a
debugging session to a glance.**

## The five places an NPE can happen

Exactly these operations dereference a reference, so exactly these can throw:

1. **Field access** on null — `order.customer` where `order` is null.
2. **Method invocation** on null — `name.trim()` where `name` is null.
3. **Array operations** on null — indexing or `length` of a null array.
4. **Unboxing** null — using an `Integer` that is null where an `int` is
   needed (arithmetic, comparison, assignment to a primitive). No visible dot
   anywhere, which is what makes this one hard to spot.
5. **`throw` / `synchronized` on null** — throwing a null reference or
   locking on one (corner cases, but specified: both throw NPE).

Note what is *not* on the list: passing null, returning null, storing null.
Nulls travel silently; only *use* detonates. That asymmetry is the entire
difficulty of the exception — and the reason chunk 2's discipline is to make
*passing* the failure point instead.

## Helpful messages: JEP 358

Since JDK 15 (default on), the JVM computes which sub-expression was null.
For a chain like:

```java
order.getCustomer().getAddress().getCity().toUpperCase()
```

a pre-14 JVM reported only the line number — four dereferences, one line,
you're guessing. A modern JVM's message states which call returned null (in
the form *"...because the return value of `getAddress()` is null"*), turning
the four suspects into one. Practical protocol:

- **Read the message before the stack trace.** The message names the null;
  the trace names the location. Message first, then confirm.
- **The named expression is the *victim*, not the culprit.** If
  `getAddress()` returned null, the question becomes "who constructed a
  customer without an address" — the creation site is still yours to find,
  which is chunk 2's argument for failing at construction.
- Helpful messages are computed from bytecode, so they work for any JVM
  language and cost nothing until an NPE actually throws.

One habit the feature quietly killed: splitting chained calls across lines
"so the NPE points at the right one". Format for readability; the message
carries the precision now.

## The unboxing NPE — no dot in sight

```java
Map<String, Integer> counts = loadCounts();
int n = counts.get("orders");     // NPE here if the key is absent
```

`Map.get` returns null for a missing key; assigning to `int` triggers
unboxing (`intValue()` under the hood — JLS §5.1.8), which dereferences the
null. The same shape hides in arithmetic (`total + maybeNull`), in comparisons
(`x > threshold` with a null `Integer`), and in a ternary whose branches mix
`int` and `Integer` — numeric promotion unboxes the null branch. The tell in
the helpful message is a reference to `intValue()`/`longValue()` you never
wrote.

## Reading the trace around it

The mechanics from
[reading a stack trace fast](../../phase-5-exceptions/README.md) apply, NPE
edition:

- **Scan down to the first frame in *your* package** — the throw site is
  often inside a library that was handed your null (`Objects.requireNonNull`
  frames, collection internals). The library is almost never at fault.
- **`Caused by` still rules**: an NPE inside a stream lambda arrives wrapped
  in whatever the framework wraps it in; the root cause block carries the
  helpful message.
- An NPE from a *constructor* frame is good news — chunk 2's
  `requireNonNull`-in-constructor pattern worked, and the message names which
  argument was null at the true origin.

## Gotchas

**Symptom:** NPE on a line with four chained calls; which one was null?
**Cause:** pre-15 JVMs gave only the line number
**Fix:** on 15+, read the message — it names the null sub-expression. On an inherited 8/11 runtime, split the chain temporarily or upgrade; this alone is a reason to leave 11

**Symptom:** NPE with `intValue()` in the message, but the code contains no such call
**Cause:** auto-unboxing — a null `Integer`/`Long` met a primitive context (assignment, arithmetic, comparison, mixed-type ternary)
**Fix:** find the boxed-to-primitive junction on that line; use `getOrDefault`, an explicit null check, or keep the value boxed if absence is meaningful

**Symptom:** `Map.get` chain NPEs only for *some* inputs, in production, never in tests
**Cause:** the missing-key case returns null — tests only covered present keys
**Fix:** `getOrDefault(key, 0)`, `containsKey` when null-vs-absent matters, or a `Map` contract that guarantees the key (and a test for the absent case either way)

**Symptom:** the NPE names a getter as returning null, but that "can't happen — the field is always set"
**Cause:** it wasn't: some construction path (deserialization, a mapper, a test fixture, reflection) skipped the assignment
**Fix:** hunt creation sites, not use sites — then close the hole at construction (chunk 2). Deserializers bypassing constructors are the classic offender

**Symptom:** `throw someException;` itself threw an NPE
**Cause:** `someException` was null — throwing null is specified to throw NPE instead
**Fix:** the exception-building code path returned null (a lookup table of exceptions, a factory); fix that path. Rare, real, and baffling until you know the rule

**Symptom:** an NPE appears as the *cause* of an `ExceptionInInitializerError`
**Cause:** the null dereference happened inside a static initializer — the class failed to initialize
**Fix:** the [static initialization page](../11-static.md) rules apply: find the first occurrence, keep static init trivial. Later uses of the class show only `NoClassDefFoundError`

## Interview questions

**★ When exactly is an NPE thrown — and what never throws one?**
At dereference: field access, method call, array access/length, unboxing, and
`throw`/`synchronized` on null. Creating, passing, returning and storing null
are all silent — which is why the throw site and the origin can be far apart.

**★ What did JEP 358 change about debugging NPEs?**
Since 15 the JVM's message names the precise null sub-expression ("the return
value of `getAddress()` is null"), so a chained-call NPE identifies itself.
Before, the line number was the only clue and multi-dereference lines were
ambiguous.

**★ Why can code with no visible dereference throw an NPE?**
Auto-unboxing: a null boxed value (`Integer`, `Boolean`…) used in a primitive
context calls `intValue()`-style methods under the hood. `Map.get` on an
absent key feeding an `int` is the canonical instance.

**★ The helpful message names a getter — is that getter the bug?**
No, it's the victim: it faithfully returned a null field. The bug is wherever
the object was constructed without that field — which is the argument for
constructor-time validation, so the trace points at the true origin instead.

**What does a mixed-type ternary have to do with NPEs?**
`cond ? 1 : boxedInteger` promotes both branches to `int`, unboxing the boxed
one — if it's null, NPE, on a line that looks like a simple choice. Keep
ternary branch types identical (both boxed or both primitive).

**Can `throw` or `synchronized` themselves throw NPE?**
Yes — both are specified to NPE when handed a null (a null exception
reference, a null lock target). Obscure, but they complete the "only
dereference throws" model.

---

← Index: [null and NPE](README.md) · Next → [Designing nulls out](02-designing-nulls-out.md)
