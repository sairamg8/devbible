---
title: "The contract"
sidebar_label: "1 · The contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `java.lang.Object#equals` and `#hashCode`
> Javadoc (JDK 25 API documentation) — the five properties below are quoted
> obligations from that specification, not folklore.

**The `equals` contract has five rules, the `hashCode` contract has two, and
one rule ties them together: equal objects must report equal hash codes. None
of this is style guidance — `HashMap` is *implemented against* these promises,
and it does not check them. When you break the contract, the collection
doesn't throw; it quietly gives wrong answers.**

## The five rules of `equals`

For non-null references `x`, `y`, `z`, the Javadoc requires:

| Rule | Meaning | The violation that happens in real code |
|---|---|---|
| **Reflexive** | `x.equals(x)` is true | Rare to break directly; broken via NaN-style field comparisons |
| **Symmetric** | `x.equals(y)` ⇔ `y.equals(x)` | A subclass adds a field and compares it, the parent doesn't — order now matters (chunk 3) |
| **Transitive** | `x=y` and `y=z` ⇒ `x=z` | "Tolerant" comparisons (case-insensitive against one field, exact on another) chain into contradiction |
| **Consistent** | Repeated calls agree — *if no compared field changed* | `equals` reading mutable or time-dependent state (`lastSeen`, lazily-loaded fields) |
| **Non-null** | `x.equals(null)` is false, never a throw | Implementations that call `null.getClass()` or skip the null guard |

Note what the consistency rule does *not* promise: nothing protects you if a
field used in `equals` mutates. That case is legal per the contract and still
catastrophic inside a hash collection — the contract's sharpest edge, and
chunk 3's opening bug.

## The `hashCode` contract

1. **Internally consistent**: repeated calls during one execution return the
   same value, provided no `equals`-relevant field changed.
2. **Consistent with `equals`**: `x.equals(y)` ⇒ same `hashCode`.

The reverse is *not* required — unequal objects may share a hash (a
collision). Collisions cost performance, not correctness. The contract
violation that costs correctness is the forward direction: equal objects with
different hashes.

## Why the pairing exists: what `HashMap` actually does

A `HashMap` lookup is a two-stage filter:

1. **Hash to a bucket.** `hashCode()` (spread and masked) selects a bucket —
   this is the O(1) part. Only objects in *that bucket* are ever considered.
2. **`equals` within the bucket.** Candidates with matching hashes are
   compared with `equals` until one answers true.

Both stages must agree with your notion of "the same":

- **Equal but different hashes** → stage 1 looks in the *wrong bucket*. The
  equal entry exists in another bucket and is never consulted. `contains`
  returns false for an element the set holds; `put` stores a duplicate key.
- **Same hash but never equal** (hashCode overridden, equals not) → stage 2
  rejects everything. Same visible symptom: lookups miss.

This is why "override both or neither" is not advice but arithmetic. The
default `Object` implementations are consistent *with each other* (identity
equality, identity-based hash); any override of one without the other splits
the pair.

## What the defaults mean

Inherited from `Object`:

- `equals` is **reference identity** — `x.equals(y)` ⇔ `x == y`.
- `hashCode` is an identity-based value (historically the address; actually a
  stored per-object value on modern JVMs).

For many classes this is *correct*: a `Connection`, a `Thread`, a service
bean — two instances are genuinely never "the same". Value classes (money,
coordinates, DTOs) are the ones that need value equality, which is exactly
the niche records fill with generated, contract-correct implementations
(chunk 2).

## `==` vs `equals`, restated once

`==` on references compares identity, always, and cannot be overridden.
`equals` is the extension point for value equality. The practical rules:

- Domain values, strings, boxed numbers: `equals` (or better, let
  collections and `Objects.equals` call it).
- Enum constants: `==` is correct *and* null-safe — each constant is a
  singleton (topic [10 · Enums](../10-enums/README.md)).
- `Objects.equals(a, b)` — the null-safe wrapper for code that may hold nulls.

## Gotchas

**Symptom:** `set.contains(order)` is false for an order the debugger shows inside the set
**Cause:** `hashCode` inconsistent with `equals` — the lookup hashed to a different bucket than the stored entry
**Fix:** override both from the same field set. Records or IDE generation (chunk 2) make agreement structural

**Symptom:** `HashMap.put(key, v)` created a second entry for a key that `equals` an existing one
**Cause:** same as above seen from the write path — different bucket, so no replacement happened
**Fix:** same field set for both methods; add a regression test asserting `equals` ⇒ same `hashCode` for representative pairs

**Symptom:** overrode `equals` only ("we don't use hash collections") — a `distinct()` stream or a test matcher still misbehaves
**Cause:** half the ecosystem hashes behind your back: `Set.copyOf`, `groupingBy`, assertion libraries, caches
**Fix:** there is no supported "equals-only" class. Pair them, always

**Symptom:** `x.equals(null)` throws `NullPointerException`
**Cause:** the implementation dereferences the argument before the type/null check
**Fix:** `instanceof` handles null for free — `o instanceof Order other` is false for null, no separate guard needed

**Symptom:** equality works in unit tests, fails across serialization (the deserialized copy isn't "equal" to the original)
**Cause:** default identity equality — two distinct instances are never `==`
**Fix:** value classes crossing process boundaries need value `equals`; this is why DTOs are records

**Symptom:** intermittent `assertEquals` failures on a class whose `equals` uses a timestamp field
**Cause:** consistency violation — a compared field changes between construction and assertion
**Fix:** exclude volatile/derived state from `equals`; compare stable value fields only

## Interview questions

**★ State the equals/hashCode contract and why it exists.**
Equals must be reflexive, symmetric, transitive, consistent, and false against
null; hashCode must be consistent across calls and *equal objects must have
equal hash codes*. `HashMap` navigates by hash first and confirms by equals
second — the contract is exactly the set of assumptions that two-stage lookup
bakes in.

**★ What happens if you override `equals` but not `hashCode`?**
Two "equal" objects keep distinct identity hashes, land in different buckets,
and hash collections stop finding them: `contains` misses, `put` duplicates
keys, `distinct()` keeps both. Nothing throws — the failure is silent wrong
answers.

**★ Can two unequal objects share a hash code?**
Yes — collisions are legal and inevitable (int has 2³² values). They degrade
bucket lookups toward linear (or tree) search, a performance cost only. The
illegal direction is equal objects with *different* hashes.

**★ When are the default `Object` implementations the right choice?**
When identity *is* equality: stateful resources, services, entities where two
instances are never interchangeable. Overriding equality on such classes is
itself a bug — it merges things that must stay distinct.

**Why is `==` on two `Integer`s a bug but on two enum constants correct?**
Boxed integers are objects with value semantics (and a cache that makes `==`
lie inconsistently — [phase 1, topic 02](../../phase-1-language-core/02-autoboxing-integer-cache.md));
enum constants are canonical singletons, so identity and equality coincide by
construction.

**What does `Objects.equals(a, b)` add over `a.equals(b)`?**
Null safety on *both* sides: true when both are null, false when exactly one
is, delegates otherwise — the right call sites are comparisons inside your own
`equals` implementations and any code where either operand may be null.

---

← Index: [equals and hashCode](README.md) · Next → [Implementing it right](02-implementing-it-right.md)
