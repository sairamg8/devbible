---
title: "The feature"
sidebar_label: "1 · The feature"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against JEP 395 (Records, 16), the `java.lang.Record`
> Javadoc, and JLS §8.10 (record declarations) in the SE 25 edition.

**`record Money(BigDecimal amount, Currency currency)` generates a final
class with final fields, accessors named exactly like the components (no
`get` prefix), a canonical constructor, and `equals`/`hashCode`/`toString`
over all components. What it does *not* generate is deep immutability — a
record is a shallow guarantee, and the compact constructor is where you make
it a real one.**

## What one line expands to

For `record Money(BigDecimal amount, Currency currency)`:

- **A final class** extending `java.lang.Record` — no subclassing a record,
  no record extending another class (it may implement interfaces).
- **Private final fields** per component; **accessors** `amount()`,
  `currency()` — component-named, not JavaBean-style `getAmount()`.
- **The canonical constructor** `Money(BigDecimal, Currency)`.
- **`equals`/`hashCode`** over all components (contract semantics specified
  by JEP 395 — [topic 06](../06-equals-hashcode/README.md) done by the
  compiler) and **`toString`** as `Money[amount=..., currency=...]`.

Everything is derived from the *header*, so adding or removing a component
updates every generated member in the same edit — the drift class of bugs
(field added, `equals` forgotten) is structurally gone.

You can override any generated member. The accessors and `toString` are
overridden routinely (masking a secret component, normalizing a view);
overriding `equals`/`hashCode` is rare and mostly for array components.

## The compact constructor: the validation slot

The canonical constructor can be written in *compact* form — no parameter
list, no field assignments; the fields are assigned automatically after your
block runs:

```java
public record Money(BigDecimal amount, Currency currency) {
    public Money {                          // compact canonical constructor
        Objects.requireNonNull(amount, "amount");
        Objects.requireNonNull(currency, "currency");
        if (amount.signum() < 0) throw new IllegalArgumentException("negative amount");
        amount = amount.setScale(2, RoundingMode.HALF_EVEN);  // normalize — reassigns the *parameter*
    }
}
```

Two things make this slot powerful:

- **Validation is un-bypassable.** Every instance — deserialized, copied,
  constructed in a test — passes through the canonical constructor. An
  invalid `Money` cannot exist, which is the "invalid states don't compile
  or construct" half of the phase gate.
- **Normalization by parameter reassignment.** Assigning to `amount` inside
  the compact form rewrites what the field will be set to. This is where
  scale normalization ([topic 06 chunk 2's](../06-equals-hashcode/02-implementing-it-right.md)
  `BigDecimal` fix) and defensive copies (chunk 2) live.

Alternative constructors are allowed but must delegate (directly or
indirectly) to the canonical one — the funnel is preserved. Static factories
(`Money.of(...)`) compose fine on top.

## Shallow immutability — the honest caveat

The record guarantees its *fields* never change. It guarantees nothing about
the objects they reference:

```java
record Basket(List<Item> items) {}

var list = new ArrayList<Item>();
var basket = new Basket(list);
list.add(item);                 // basket "changed" — through the shared reference
basket.items().add(item);       // and the accessor hands out the live list
```

`Basket` is immutable the way a display case with an open back is locked.
The fix is the standard defensive pattern *in the compact constructor* —
`items = List.copyOf(items)` — which copies on the way in and (because
`List.copyOf` returns an unmodifiable list) makes the accessor's answer safe
on the way out. Chunk 2 makes this the house rule for any mutable component
type (`List`, `Map`, `Date`, arrays).

Arrays deserve their own flag: an array component is mutable *and* breaks
the generated `equals` (identity comparison —
[topic 06 chunk 2](../06-equals-hashcode/02-implementing-it-right.md)).
Records and raw arrays don't mix; wrap in a `List` or override the trio.

## What records can't do — each "can't" is the point

| Restriction | Why it's a feature |
|---|---|
| No `extends` (records are final, extend `Record`) | Equality stays symmetric ([topic 06 chunk 3](../06-equals-hashcode/03-where-it-breaks-in-production.md)); transparency can't be diluted by hidden subclass state |
| No instance fields beyond components | The header *is* the whole state — "transparent carrier" is enforceable only if nothing hides |
| No setters, fields final | The immutability half of the contract |
| Static members allowed | Constants and factories don't threaten transparency |

Also in the toolbox: **local records** — declared inside a method, ideal for
naming an intermediate shape in a stream pipeline instead of abusing
`Map.Entry` or a `Object[]` pair; and **generic records**
(`record Pair<A, B>(A first, B second)`).

## Records and pattern matching

JEP 440 (21) added **record patterns** — deconstruction at the use site:

```java
if (obj instanceof Money(BigDecimal amt, Currency cur)) {
    // amt and cur bound directly — no accessor calls in sight
}
```

Nesting composes: `case Line(Point(var x1, var y1), Point(var x2, var y2))`.
Combined with sealed interfaces and `switch`
([topic 09](../09-sealed-adts.md)), this is Java's algebraic-data-type
story: records define the shapes, patterns take them apart, exhaustiveness
checks the coverage.

## Gotchas

**Symptom:** `getAmount()` doesn't exist on a record
**Cause:** accessors are component-named — `amount()`, no JavaBean prefix
**Fix:** call the component name; for reflection-based tools expecting getters, most modern versions understand records — check the tool before writing adapter getters

**Symptom:** a "validated" record was constructed invalid via `Money.of(...)`-style alternate paths in an old class converted to a record
**Cause:** validation placed in a static factory instead of the compact constructor — alternate constructors bypassed it
**Fix:** validation lives in the compact canonical constructor, which every construction path must reach

**Symptom:** a record's contents changed after construction
**Cause:** shallow immutability — a mutable component (`List`, `Date`, array) shared with the caller
**Fix:** defensive copy in the compact constructor (`List.copyOf`); treat any mutable component type without one as a review finding

**Symptom:** two records with identical array contents aren't equal
**Cause:** generated `equals` compares components via their own `equals`; arrays compare by identity
**Fix:** wrap the array in a `List`, or override `equals`/`hashCode` with `Arrays.equals`/`hashCode`

**Symptom:** `record Order extends BaseEntity` doesn't compile
**Cause:** records cannot extend classes — they already extend `java.lang.Record`
**Fix:** implement interfaces for shared *behaviour*; shared *state* means the type isn't a transparent carrier — use a class, or compose

**Symptom:** reassigning a field in the compact constructor (`this.amount = ...`) doesn't compile
**Cause:** compact form assigns fields automatically *after* the block; you adjust the *parameters*, not the fields
**Fix:** `amount = amount.setScale(2, ...)` — bare parameter name, no `this`

## Interview questions

**★ What does a record generate, and from what?**
From the header alone: final fields, component-named accessors, the canonical
constructor, all-component `equals`/`hashCode`/`toString`, on a final class
extending `Record`. Header edits regenerate everything — the sync bugs of
hand-written value classes can't occur.

**★ What is a compact constructor and why is it the most important record feature?**
The canonical constructor without the boilerplate: your block runs
validation/normalization on the parameters, then fields auto-assign. Because
every construction path funnels through it, invariants hold for every
instance that can ever exist — records turn "validated data" from a
convention into a guarantee.

**★ "Records are immutable" — qualify that statement.**
Shallowly: the fields can't be reassigned, but referenced mutable objects
(lists, dates, arrays) can still change. Real immutability requires defensive
copies in the compact constructor (`List.copyOf`) so no caller shares the
mutable innards.

**★ Why can't records extend classes or be extended?**
Transparency and equality. Subclassing could add hidden state (breaking "the
header is the state") and re-opens the equals-symmetry trap that final value
classes exist to close. Interfaces remain available for behaviour.

**Where do local records earn their place?**
Naming an intermediate result inside a method — a stream pipeline that would
otherwise juggle `Map.Entry<String, List<Order>>` reads as
`record CustomerOrders(String customer, List<Order> orders)` declared right
above its use.

**What did record patterns (JEP 440) add over accessors?**
Deconstruction: `instanceof Money(var amt, var cur)` binds components
positionally, nests arbitrarily, and inside `switch` combines with sealed
hierarchies for compiler-checked case analysis — the use-site half of the
ADT story.

---

← Index: [Records](README.md) · Next → [Records in practice](02-records-in-practice.md)
