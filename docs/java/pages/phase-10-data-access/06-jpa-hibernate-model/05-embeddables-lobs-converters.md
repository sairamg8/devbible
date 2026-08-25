---
title: "Two ways to map something JPA has no built-in type for — @Embeddable when the value spans columns, a converter when it is one column of an unknown type"
sidebar_label: "5 · Embeddables and converters"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §3.10 *Basic
> attributes*, §3.12 *Converters* and §3.15 *Embeddable objects*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 *User Guide* §3.3 *Embeddable values* and §3.2.45 *Custom type
> mapping*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Jakarta Persistence 3.2 specification §11 *Metadata Annotations* (`@Convert`)
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**JPA's list of basic types is short and deliberately so. Everything else needs a
mechanism, and the two that cover almost every real case answer different questions.
`@Embeddable`: "this value spans several columns." `AttributeConverter`: "this value is
one column but JPA does not know the type." A third case — the value is *large* — is
different enough, and misunderstood often enough, to get its own chunk at
[5b · Large columns and `@Lob`](05b-lobs-and-large-columns.md). And there is a fourth
option the spec technically allows, `Serializable`, about which the Hibernate
documentation is unusually blunt: "Serializing a Java object and storing its binary
representation in the database is usually wrong."**

## The list of types you get for free

The Introduction §3.10 tabulates the JPA-standard basic types: primitives and their
wrappers, `String`, `BigInteger`/`BigDecimal`, `UUID`, the `java.time` types
(`LocalDate`, `LocalTime`, `LocalDateTime`, `OffsetDateTime`, `Instant`, `Year`), the
deprecated `java.util.Date`/`Calendar` and `java.sql` date-time types, `byte[]` and
`char[]`, any enum, and anything `Serializable`.

Hibernate adds `Duration`, `ZoneId`, `ZoneOffset`, `ZonedDateTime`, the JDBC LOB types,
`Class`, `InetAddress`, `Currency`, `Locale`, `URL` and `TimeZone`.

Two pieces of guidance come with the table and both are worth following. On dates:
"We're begging you to use types from the `java.time` package instead of anything which
inherits `java.util.Date`." And on the wrapper arrays: `Byte[]` and `Character[]` were
deprecated by Jakarta Persistence 3.2, Hibernate does not allow null elements in them,
and you should "use `byte[]` or `char[]` instead."

## `@Embeddable` — one value, several columns, no identity of its own

```java
@Embeddable
public record Money(BigDecimal amount, String currency) {}
```

```java
@Entity
public class Order {

    @Id @GeneratedValue
    private Long id;

    private Money total;      // maps to two columns on the `orders` table
}
```

The Introduction's definition is the one to hold on to: an embeddable is "a Java class
whose state maps to multiple columns of a table, but which doesn't have its own
persistent identity. That is, it's a class with mapped attributes, but no `@Id`
attribute."

Three consequences follow directly from "no identity of its own":

- **No table.** `Money` produces columns on `orders`, not a `money` table. If you want a
  table you want an entity, which is
  **Topic 07 · Relationships and fetch types** *(not written yet)*.
- **No independent lifecycle.** "An embeddable object can only be made persistent by
  assigning it to the attribute of an entity […] its lifecycle with respect to
  persistence is completely determined by the lifecycle of the entity to which it
  belongs."
- **No sharing.** "The embeddable object belongs to the entity, and can't be shared with
  other entity instances." Assigning the same `Money` instance to two orders is asking
  for trouble — treat embeddables as values and replace them wholesale.

An embeddable must meet the same class requirements as an entity except for `@Id` —
**with one important relaxation**: it may be a `record`, and then "the requirement for a
constructor with no parameters is relaxed." See
[1c · Why an entity cannot be a record](01c-why-not-a-record.md) for why records fit
here and not there.

`@Embedded` on the attribute is optional; the Introduction says "we don't usually use
it". Where you *do* need annotations is when the same embeddable appears twice and its
default column names collide:

```java
@Embedded
@AttributeOverride(name = "amount",   column = @Column(name = "shipping_amount"))
@AttributeOverride(name = "currency", column = @Column(name = "shipping_currency"))
private Money shipping;
```

Hibernate 7 adds a lighter alternative, `@EmbeddedColumnNaming`, which applies a
pattern instead of listing every override — useful once an embeddable has more than two
or three attributes.

## `AttributeConverter` — one column, a type JPA does not know

```java
@Converter(autoApply = true)
public class EmailConverter implements AttributeConverter<Email, String> {

    @Override
    public String convertToDatabaseColumn(Email email) {
        return email == null ? null : email.value();
    }

    @Override
    public Email convertToEntityAttribute(String value) {
        return value == null ? null : new Email(value);
    }
}
```

Two ways to apply it, per the Introduction: `@Convert` on a particular attribute, or
`@Converter(autoApply = true)` to register it for every attribute of that type.

**Both `convertToDatabaseColumn` and `convertToEntityAttribute` must handle `null`.**
The converter is invoked for null values too, and a converter that dereferences its
argument produces a `NullPointerException` from deep inside the persistence layer.

The documentation also draws a line about scope that is easy to cross without noticing:

> Converters are supposed to be used for type conversion. Some enterprising members of
> the community have noticed that they can be (mis)used to perform other tasks: trimming
> whitespace, normalizing case, assigning a default value in place of null, and so on.
> Hibernate tolerates but does not encourage such (mis)use. In particular, we strongly
> recommend against defining an `autoApply` converter acting on a basic type.

The reason `autoApply` on a basic type is dangerous is that it applies to *every*
`String` (or every `Integer`) in the whole persistence unit, including ones written by
code you have never read. A trimming converter registered that way silently changes
data across the entire application.

And the spec's restriction, from §11: `@Convert` "should not be used to specify
conversion of id attributes […] of version attributes, of relationship attributes, or of
attributes explicitly annotated […] as `Enumerated` or `Temporal`."

## The fourth option, and why not to take it

Any `Serializable` type is technically a valid basic type — JPA says so, and Hibernate
will do it. The Introduction's verdict: "Serializing a Java object and storing its
binary representation in the database is usually wrong. […] Hibernate has much better
ways to handle complex Java objects."

The concrete objections: the column is opaque to SQL, so you cannot query, index,
report on, or fix the data; and the stored bytes are tied to the Java class's
serialization compatibility, so a field added to that class years later can make old
rows unreadable. If you genuinely want a structured blob, JSON is the modern answer —
Hibernate supports `@JdbcTypeCode(SqlTypes.JSON)` and PostgreSQL's `jsonb` is queryable
and indexable in a way a serialized Java object never will be.

## Gotchas

**Two embeddables of the same type in one entity collide on column names.**
Both `billing` and `shipping` of type `Address` want a column called `street`. You get
a duplicate-column mapping error at startup — a good failure, but it needs
`@AttributeOverride` (or `@EmbeddedColumnNaming`) to resolve.

**Mutating an embeddable in place still triggers dirty checking — usually.**
If the embeddable is a mutable class and you call a setter on it, Hibernate's dirty
check compares against a snapshot and does see the change. But this is exactly why a
record embeddable is cleaner: whole-value replacement makes the change unambiguous, and
you cannot accidentally share a mutable value between two entities.

**A converter that returns `null` for unknown input hides bad data.**
Silently mapping an unrecognised database value to `null` means a corrupted row reads
as "not set" forever. Throwing is nearly always right; you find out at the point of
damage rather than three reports later.

**`@Converter(autoApply = true)` on `String` is a change to your whole application.**
The Hibernate documentation "strongly recommends against" it and the reason is blast
radius. Auto-apply is for your own domain types — `Email`, `Money`, `PhoneNumber` — not
for the platform's.

**A converter is applied when reading too, including in query results.**
It is not just a write-side hook. That is what makes it correct, but it also means a
slow converter runs once per row on a large result set.

**Never put a converter on an `@Id` or a `@Version`.**
The spec says not to, and the reason is mechanical: the persistence context keys its
identity map by the identifier, and optimistic locking compares version values. Both
are internal machinery that expects the mapped type directly.

**An embeddable containing a collection is not the same shape as one that does not.**
Hibernate supports it (User Guide §3.3.13) but the collection lives in its own table
with its own fetch behaviour, which drags relationship semantics into what looked like
a value. That is
**Topic 07 · Relationships and fetch types** *(not written yet)* territory.

## Interview questions

**★ When would you use an `@Embeddable` rather than a separate entity?**
When the value has no identity and no independent lifecycle — when it makes no sense to
ask "which one is it?" and it cannot exist without its owner. An address on an order,
a money amount, a date range, a person's name. If you find yourself wanting to look one
up by id, share one between two owners, or keep it after its owner is deleted, it is an
entity and it needs its own table and its own `@Id`.

**★ Why can an `@Embeddable` be a record when an `@Entity` cannot?**
Because the objections to a record entity all trace back to identity and mutation.
Hibernate proxies entities to implement lazy loading, which needs a non-final class; it
populates entity state after construction, which needs writable fields; and it detects
changes to entity state, which needs mutability. An embeddable is never proxied on its
own, has no identity in the persistence context, and is changed by assigning a whole new
value to the owning entity's attribute — so none of the three objections apply.
Hibernate's Introduction documents the record form explicitly and notes that the
no-argument-constructor requirement is relaxed for it.

**★ What is an `AttributeConverter` and when is it the right tool?**
A pair of functions between a Java type and one of JPA's basic types, applied on both
write and read. It is the right tool when your domain type occupies exactly one column
and JPA has no idea what it is — a value object wrapping a `String`, an enum with a
legacy integer code, a `Set` encoded as a bitmask. It is the wrong tool when the value
spans several columns, which is `@Embeddable`, and it is a misuse when you are really
doing normalisation or defaulting rather than type conversion.

**★ What is dangerous about `@Converter(autoApply = true)`?**
Scope. Auto-apply registers the converter for every attribute of that type in the whole
persistence unit. On your own domain type that is exactly what you want. On a platform
type like `String` or `Integer` it silently rewrites data everywhere, including in code
and entities you did not write, and there is no local annotation for a reader to notice.
The Hibernate documentation strongly recommends against auto-applying a converter to a
basic type for precisely this reason.

**★ Do converters have to handle `null`?**
Yes, in both directions, because the conversion methods are invoked for null values too.
A converter that assumes a non-null argument fails with a `NullPointerException` raised
from inside the persistence layer, typically at flush time, a long way from the code
that left the field unset.

**★ JPA lets you persist any `Serializable` type. Why shouldn't you?**
Because the result is a column no SQL can read. You cannot query it, index it, aggregate
over it, or repair it with an UPDATE; a reporting tool sees bytes. And the encoding is
tied to Java serialization compatibility, so a change to the class years later can make
old rows unreadable with no migration path. Hibernate's own documentation calls it
"usually wrong". If you need a structured value in one column, map it to `jsonb` with
`@JdbcTypeCode(SqlTypes.JSON)` — it is queryable, indexable, and readable by anything.

---

← Prev: [4 · Enums and the ORDINAL trap](04-enums-ordinal-corruption.md) · Index: [The JPA/Hibernate model](README.md) · Next → [5b · Large columns and @Lob](05b-lobs-and-large-columns.md)
