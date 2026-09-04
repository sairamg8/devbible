---
title: "The comparison is per mapped value and it does not go through your setters, so anything that makes a value differ from its snapshot is a change — including mutating an object you never reassigned"
sidebar_label: "14c · What counts as a change"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.5 *Mapping basic
> values*, §3.6 *AttributeConverter*, §3.15 *Mutability* (§3.15.1–§3.15.6) and §6.2.2
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 *Introduction* §3.13 *Compositional basic types*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Jakarta Persistence 3.2 specification §11 *Attribute Conversion*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Dirty checking never sees a setter call. It sees two arrays of mapped values and asks,
per value, "are these the same?" So the question "did I change it?" is really two
questions: is the value *mapped*, and does whatever compares that value's Java type
consider the two versions equal. Mutating a `Date` in place is a change. Assigning an
equal `String` is not. And a field with `@Transient` on it does not participate at all.**

## Rule one: it has to be mapped

The snapshot holds mapped values. A field that is not mapped is in neither array, so it
cannot differ.

```java
@Entity
class Order {
    @Id Long id;
    BigDecimal total;                 // mapped — compared
    @Transient BigDecimal displayed;  // not mapped — invisible to dirty checking
    transient String cachedLabel;      // also not mapped, for the same reason
}
```

This is what makes `@Transient` genuinely useful rather than merely a way to silence the
mapper: it gives you a place to hold derived or per-request state on the entity without
that state generating writes. The *Introduction*'s own `@PostLoad` example is exactly
this shape — a computed `total` on a `transient` field.

The inverse is the trap. If the field is mapped and something assigns to it during load —
a `@PostLoad` callback, a defensive normaliser in a getter, a Lombok-generated
`@Builder.Default` interacting with reflection — the entity differs from its snapshot the
instant it is loaded, and **every read transaction generates an `UPDATE`**.
[14e · What dirty checking costs](14e-what-dirty-checking-costs.md) is where that becomes
expensive; here it is enough to know it is possible.

Access type decides *which* member is read for the comparison. If `@Id` is on a field,
Hibernate reads fields; if it is on a getter, Hibernate calls getters. A getter with a
side effect, or one that returns a freshly built object each call, is therefore a
liability under property access — see
[3 · Fields, columns, access](03-fields-columns-access.md).

## Rule two: how "the same" is decided

Comparison is delegated to the value's Java type. The *Introduction* describes `JavaType`
as being able to "compare instances of the class to determine if an attribute of that
class type is dirty (modified)". Above that sits the `MutabilityPlan`. The User Guide
lists the three jobs a `MutabilityPlan` does, and dirty checking is the first:

> Hibernate uses `MutabilityPlan` to: **check whether a value is considered dirty**; make
> deep copies; marshal values to and from the second-level cache.

And it says exactly what changes when a value is treated as immutable:

> To check for dirtiness, Hibernate just needs to check object identity (`==`) as opposed
> to equality (`Object#equals`). The same value instance can be used as the deep copy of
> itself.

That single sentence explains the whole "prefer immutable types" advice. An immutable
value can be compared with `==` and does not need copying into the snapshot at all. A
mutable one needs a defensive copy *and* an `equals` call, every flush, per attribute.

Hibernate resolves the plan in a documented order of precedence:

> 1. Local to the mapping
> 2. On the associated `AttributeConverter` implementation class (if one)
> 3. On the value's Java type

with the note that "in most cases, the fallback defined by `JavaType#getMutabilityPlan`
is the proper strategy".

## Mutating in place is a change

This is the case that catches people, because nothing was assigned. The User Guide shows
it side by side with the ordinary case in §3.15.6, and states the outcome in one line:

> This mutating example has the same effect as the setting example — they each will make
> the entity dirty.

```java
// setting
entity.setActiveTimestamp(now());

// mutating — no setter called on the entity at all
entity.getActiveTimestamp().setTime(now().getTime());
```

Both produce an `UPDATE`, because the snapshot holds a *copy* of the old `Date` and the
copy still has the old millis. This is the reason the snapshot has to deep-copy mutable
values in the first place: if it held the same `Date` instance the entity holds, mutating
it would change both sides of the comparison and the change would become invisible.

The same applies to a converted type whose converted Java object is mutable. The User
Guide's `Money`/`Long` converter example spells it out: "A mutable `Object` allows you to
modify its internal structure, and Hibernate's dirty checking mechanism is going to
propagate the change to the database", and then immediately advises against relying on
it — "prefer immutable types over mutable ones whenever possible."

**Modern code mostly gets this for free.** `String`, `Integer`, `BigDecimal`, `UUID`,
`LocalDate`, `Instant`, `OffsetDateTime` and enums are all immutable. `java.util.Date`,
`java.util.Calendar`, `byte[]` and any mutable value object you wrote are not.

## Embeddables: the value is the fields, not the object

An `@Embeddable` is not a row and is not tracked separately. Its component fields are
columns on the owning table, and they are compared like any other mapped values. So
mutating a field *inside* an embedded instance is a change to the owning entity:

```java
@Embeddable
class Address { String street; String city; String postcode; }

@Entity
class Customer { @Id Long id; @Embedded Address address; }
```

```java
customer.getAddress().setCity("Bristol");   // one column differs → UPDATE on customer
```

Replacing the whole embeddable is also a change, and for the same reason — the comparison
is per component column, and the columns now differ. Whether you mutate or replace makes
no difference to the SQL, which is a good argument for making embeddables immutable
records-in-spirit and always replacing: it removes a whole class of aliasing bug where two
entities accidentally share one `Address` instance.

⚠️ **A shared embeddable instance is a genuine hazard.** If you assign the same `Address`
object to two `Customer`s and then mutate it, both customers become dirty and both get
written. Nothing warns you.

An `@ElementCollection` of embeddables is compared as a collection: adding, removing or
mutating an element makes the collection dirty and produces the collection's own DML at
flush. Where that DML sits in the flush order is
[15c · Flush operation order](15c-flush-operation-order.md), and the *shape* of it — why
a modified element collection is often deleted and re-inserted wholesale — is discussed
with element collections in
[**topic 07 · 11 · `@ElementCollection`**](../07-relationships-fetch/11-element-collection.md).

**Association collections belong to topic 07 and are not the same thing.** Whether adding
to a `@OneToMany` produces any SQL at all depends on which side owns the foreign key, and
that is argued in
[topic 07 · 2 · The owning side](../07-relationships-fetch/02-the-owning-side.md).

## Converters and the comparison

A converter sits between your Java value and the column. Two consequences follow.

**The comparison is on the Java side.** Two Java values that convert to the same column
value but are not `equals` will be seen as a change and written — a no-op `UPDATE` that
costs a round trip and, if the entity is versioned, a version bump.

**Hibernate needs to be able to compare your type.** If your converted Java type is not
in the `JavaTypeRegistry` and does not implement `equals`/`hashCode`, Hibernate says so at
startup, in a message the User Guide quotes verbatim:

> `HHH000481: Encountered Java type for which we could not locate a JavaType and which
> does not appear to implement equals and/or hashCode. This can lead to significant
> performance problems when performing equality/dirty checking involving this Java type.
> Consider registering a custom JavaType or at least implementing equals/hashCode.`

That warning is about dirty checking specifically. If you see it in a startup log, the
entity it names is being compared by identity or by a fallback that will not do what you
expect.

## Declaring that something cannot change

Three annotations, three different scopes, and the User Guide is careful that "mutability"
is "an overloaded term" — it can mean *the internal state can change* or *the value is
updateable in the database*.

| Annotation | On | Effect |
|---|---|---|
| `@Immutable` | entity | no `UPDATE` is ever generated; the loaded state need not be retained |
| `@Immutable` | basic attribute | immutable in both senses — changes ignored |
| `@Immutable` | plural attribute | modification throws |
| `@Mutability(plan)` | attribute, converter, user type | supplies a `MutabilityPlan` |

`@Mutability` is **not** allowed on an entity. And the plural case behaves differently
from every other one — the User Guide flags it as a tip: "While most immutable changes are
simply discarded, modifying an immutable collection will cause an exception", quoting
`org.hibernate.HibernateException: changed an immutable collection instance: […]`.

Entity-level `@Immutable` is the one with a performance story attached, and it is taken up
in [14f · Turning it off](14f-turning-dirty-checking-off.md).

## Gotchas

**★ Mutating a `Date` in place makes the entity dirty even though you called no setter on
it.** This is documented behaviour, not a bug, and it is why the snapshot deep-copies
mutable values.

**★ Sharing one mutable embeddable or converted value object between two entities makes
both dirty when you mutate it.** There is no warning. Prefer immutable value types, or
always assign a fresh instance.

**★ A converter that is not a pure function produces phantom updates.** If
`convertToEntityAttribute` builds a new object each call and the type has no `equals`, or
if the round trip is lossy, every flush can see a difference where the database has none.

**★ `HHH000481` at startup is a dirty-checking warning, not a mapping-style nag.** It
names a Java type Hibernate cannot compare properly. Fix it by implementing
`equals`/`hashCode` or registering a `JavaType`.

**★ A getter that computes or normalises is dangerous under property access.** With
`@Id` on a getter, Hibernate reads state through getters. A getter returning
`new ArrayList<>(items)` or trimming a string on the way out can make the entity look
different from its snapshot on every flush.

**★ `BigDecimal` scale is part of equality.** `new BigDecimal("10.0")` and
`new BigDecimal("10.00")` are not `equals`, so a value re-read from a differently scaled
source, or recomputed, can register as a change even though the numeric value is
identical.

**★ `byte[]` is mutable and is compared as an array.** Writing into an existing array
makes the entity dirty. If the column is large, that means re-sending the whole payload —
see [5b · Large columns and `@Lob`](05b-lobs-and-large-columns.md).

**★ Adding a field to an embeddable changes what is compared for every entity that embeds
it.** Because the embeddable is not a separate row, a new component field becomes a new
column on the owner's table and a new element in every one of its snapshots.

**★ `@Transient` prevents dirty checking; `@Column(updatable = false)` does not.** The
first keeps the value out of the comparison entirely. The second keeps the column out of
the generated `UPDATE`'s `SET` clause — the entity can still be dirty on other fields,
and the value you assigned is silently not written.

**★ `@Immutable` on an entity discards writes silently, but on a collection it throws.**
Two different failure modes from the same annotation, decided by where you put it.

## Interview questions

**★ How does Hibernate decide whether a mapped value changed?**
It compares the current value against the loaded state using the value's Java type. For
values treated as immutable it can compare with `==`; for mutable ones it deep-copies into
the snapshot and compares with `equals`. Which of those applies is decided by the
`MutabilityPlan`, resolved from the mapping, then the converter, then the Java type.

**★ Why does mutating a `java.util.Date` field make the entity dirty when no setter was
called?**
Because the snapshot holds a deep copy of the old `Date`, not the same instance. Your
mutation changes only the entity's copy, so the two differ. The User Guide states that a
mutating change "has the same effect as the setting example".

**★ Why does Hibernate documentation keep advising immutable types?**
Because immutability removes work from three separate paths: dirty checking becomes an
identity check instead of an `equals` call, the deep copy becomes a no-op, and
second-level cache marshalling can reuse the same instance.

**★ Does changing a `@Transient` field cause a write?**
No. It is not mapped, so it is in neither the entity's mapped state nor the snapshot.
That is precisely what makes it the right place for derived state computed in `@PostLoad`.

**★ Is mutating a field inside an `@Embedded` value a change to the entity?**
Yes. The embeddable's fields are columns on the owning table and are compared like any
other mapped value. Replacing the whole embeddable produces the same SQL.

**★ What is `@Column(updatable = false)` doing, and is it the same as `@Transient`?**
No. `updatable = false` excludes the column from the `UPDATE` statement while the
attribute remains mapped and readable; the entity can still be dirty because of other
fields, and an assignment to that field is silently not persisted. `@Transient` removes
the attribute from persistence altogether.

**★ What does `HHH000481` tell you?**
That Hibernate could not find a `JavaType` for some mapped Java class and the class does
not implement `equals`/`hashCode`, so equality and dirty checking for it will be poor. It
is a correctness-and-performance warning about the comparison itself.

**★ Why does `@Immutable` throw on a collection but silently ignore changes on a basic
attribute?**
The User Guide documents both behaviours without deriving one from the other: "most
immutable changes are simply discarded", but "modifying an immutable collection will cause
an exception". Treat it as two documented rules rather than one principle.

---

← Prev: [14b · When the snapshot is taken](14b-when-the-snapshot-is-taken.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [14d · The shape of the UPDATE](14d-the-shape-of-the-update.md)
