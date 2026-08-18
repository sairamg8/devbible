---
title: "Implementing it right"
sidebar_label: "2 · Implementing it right"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `java.lang.Object#equals` Javadoc, the
> `java.util.Objects` and `java.util.Arrays` Javadoc (JDK 25), and JEP 395
> (records) for the generated-implementation semantics.

**In 2026 you should almost never hand-write `equals` and `hashCode`. The
ranked options: make the class a record (generated, correct, updates itself
when components change); otherwise generate with the IDE or build on
`Objects.equals`/`Objects.hash`. The residual skill is *reviewing* an
implementation — spotting the missing field, the wrong type check, the array
compared with `==` — and making the one genuine design decision the tools
can't make for you: `instanceof` or `getClass`.**

## Option 1 — records: correctness by construction

```java
public record Money(BigDecimal amount, Currency currency) {}
```

A record's generated `equals`/`hashCode` use **all components**, stay in sync
when components are added or removed, handle nulls, and satisfy the contract
mechanically (JEP 395 specifies the behaviour). For value classes — the
classes that *need* value equality — this deletes the entire topic. The
remaining chunks exist for the classes that can't be records: JPA entities,
classes with inheritance, classes where equality must use a field *subset*.

One record caveat belongs here: components that are **arrays** compare by
identity (a record's generated equals calls `Object.equals` per component,
and arrays don't override it). A record holding `byte[]` needs a hand-written
override — or better, wrap the array (`List.copyOf`, `ByteBuffer`).

## Option 2 — the standard hand-written shape

When it can't be a record, this is the reviewable idiom:

```java
@Override
public boolean equals(Object o) {
    if (this == o) return true;                    // fast path, not correctness
    if (!(o instanceof Money other)) return false; // null-safe type check
    return amount.equals(other.amount)
        && currency == other.currency;             // enum: == is right
}

@Override
public int hashCode() {
    return Objects.hash(amount, currency);         // same fields, same order of thought
}
```

Review checklist, in the order mistakes actually occur:

- **Same field set in both methods.** The classic drift: a field added to
  `equals` during a fix, `hashCode` forgotten. Records make this impossible;
  humans need the checklist.
- **Fields compared with the right operation**: `equals` for objects,
  `==` for primitives and enums, `Double.compare` for `double` fields (naive
  `==` mishandles `NaN` and the two zeros — the Javadoc defines equality via
  `doubleToLongBits`), `Arrays.equals` for arrays.
- **No dereference before the type check** — the `instanceof` pattern gives
  null-rejection for free.
- **`Objects.hash` vs hand-rolled 31-multiply**: `Objects.hash` allocates a
  varargs array; on a hot key type (a map key hashed millions of times) the
  IDE-generated `31 * result + field` chain is the faster equivalent. For
  everything else, `Objects.hash` wins on clarity.

## The one real decision: `instanceof` or `getClass`

The type check embeds a policy about subclasses, and both policies are
defensible — which is why the IDE asks:

- **`instanceof`** (shown above): a subclass instance *can* equal a parent
  instance. Correct when subclasses don't add equality-relevant state
  (`ArrayList` equals any `List` with the same elements — the collections
  framework chose this policy interface-wide). Breaks symmetry the moment a
  subclass adds a compared field and its own `equals` (chunk 3 shows the
  wreck).
- **`getClass() != o.getClass()`**: only exact same-class instances compare
  equal. Symmetric by construction even with subclass fields — but now a
  trivially-extended instance (a logging subclass, a framework proxy) never
  equals its base, which is exactly how **Hibernate proxies** break
  `getClass`-based entity equality (chunk 3).

The honest summary the interview wants: *there is no implementation of
`equals` that lets a subclass add an equality-relevant field while preserving
both symmetry and the substitution intuition* — Liskov and the contract
genuinely collide. Design around it: keep equality-bearing classes `final`
(or records, which are final), and prefer composition when variation is
needed.

## `BigDecimal`: the field that lies in both directions

`BigDecimal.equals` compares value *and scale*: `2.0` and `2.00` are not
equal, though `compareTo` says they are. So a `Money` record holding
unnormalized amounts reports two equal-looking prices as unequal — and two
such records land in different `HashSet` slots. Fix at the boundary:
normalize scale in the compact constructor
(`amount.setScale(2, RoundingMode.HALF_EVEN)`), making `equals`, `hashCode`
and `compareTo` agree for every instance the class can hold. The full
`BigDecimal` story is **phase 1, topic 05 · Floating point and `BigDecimal`**
*(being written in parallel — link lands when the file does)*.

## Gotchas

**Symptom:** review approves `equals`, six months later a new field silently isn't compared
**Cause:** hand-written implementations don't track field changes
**Fix:** records where possible; otherwise regenerate via IDE on every field change, and say so in a comment above the methods

**Symptom:** two records holding identical `byte[]` content are not equal
**Cause:** generated record equality compares components with their own `equals`; arrays compare by identity
**Fix:** override `equals`/`hashCode` in the record using `Arrays.equals`/`Arrays.hashCode`, or store an immutable wrapper instead of the raw array

**Symptom:** a class using `getClass()` equality stops matching once wrapped by a framework proxy
**Cause:** the proxy is a runtime subclass — `getClass()` differs from the entity class
**Fix:** for proxy-prone classes (JPA entities) use `instanceof` — chunk 3 gives the full entity recipe

**Symptom:** `Money(2.0)` and `Money(2.00)` behave as different map keys
**Cause:** `BigDecimal.equals` includes scale
**Fix:** normalize scale on construction so every representation is canonical

**Symptom:** `equals` on a class with a `double` field treats two `NaN` fields as unequal, breaking reflexivity
**Cause:** primitive `==` on `double` follows IEEE-754 (`NaN != NaN`)
**Fix:** `Double.compare(a, b) == 0` (bit-based, as the contract's reflexivity requires)

**Symptom:** profiler shows `Objects.hash` allocation on the hot path of a cache
**Cause:** varargs array per call
**Fix:** hand-roll the 31-multiply chain for that one key class; keep `Objects.hash` elsewhere — this is a measured optimization, not a default

## Interview questions

**★ How do you implement `equals`/`hashCode` in 2026?**
Prefer a record — generated, contract-correct, self-maintaining. If the class
can't be a record, IDE generation or `Objects.equals`/`Objects.hash` over the
same field set, with `instanceof`-pattern type checks. Hand-writing from
scratch is a review liability, not a skill to exercise.

**★ `instanceof` or `getClass()` in `equals` — which and why?**
`instanceof` allows subclass-to-parent equality and is proxy-safe, but breaks
symmetry if a subclass adds compared state; `getClass` is symmetric always but
treats any subclass (including framework proxies) as unequal. No
implementation supports subclasses adding equality-relevant fields — so make
value classes final and choose `instanceof` for proxy-prone entities.

**★ Why do `BigDecimal` fields poison equality, and what's the fix?**
Its `equals` includes scale (`2.0` ≠ `2.00`) while `compareTo` doesn't, so
un-normalized amounts break map lookups and disagree with sorting. Normalize
scale at construction so all three operations agree.

**How must `double` fields be compared inside `equals`?**
Via `Double.compare`/`doubleToLongBits`, not `==` — IEEE `NaN != NaN` would
break reflexivity, and `0.0 == -0.0` would merge values the spec treats as
distinct.

**Why does a record with an array component need special handling?**
The generated equality delegates to the component's `equals`, which for
arrays is identity. Content equality needs an explicit `Arrays.equals`
override — or don't store raw arrays in value types.

**What's wrong with `Objects.hash` on a hot map key, and when do you care?**
It allocates a varargs array each call. You care only when profiling shows it
— a cache key hashed millions of times per second — and the fix is the
IDE-style multiply-accumulate chain for that class alone.

---

← Prev: [The contract](01-the-contract.md) · Next → [Where it breaks in production](03-where-it-breaks-in-production.md)
