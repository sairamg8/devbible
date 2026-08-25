---
title: "@Enumerated defaults to ORDINAL, and ORDINAL turns a routine refactor into silent, irreversible data corruption"
sidebar_label: "4 · Enums and the ORDINAL trap"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §3.11 *Enumerated
> types*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 *User Guide* §3.2.5 *Enums*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the `jakarta.persistence.EnumType` javadoc in the Jakarta Persistence 3.2 API
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html))
> and the `java.lang.Enum#ordinal` javadoc
> ([docs.oracle.com/en/java/javase/25/docs/api/](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Enum.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**This is the one mapping default in JPA that can destroy data without any error ever
being raised. `@Enumerated` defaults to `ORDINAL`, which stores an enum as the integer
position of its constant in the source file. Insert a constant in the middle of the
enum a year later and every existing row now means something different. Nothing throws.
Nothing logs. The rows are simply wrong, and there is no way to recover the original
meaning from the data alone. Hibernate's own documentation says flatly: "JPA picks the
wrong default here."**

## What `ORDINAL` actually stores

```java
public enum OrderStatus {
    PENDING,      // ordinal 0
    SHIPPED,      // ordinal 1
    DELIVERED     // ordinal 2
}
```

```java
@Enumerated                    // no argument → ORDINAL
private OrderStatus status;
```

`java.lang.Enum#ordinal()` returns "the ordinal of this enumeration constant (its
position in its enum type declaration, where the initial constant is assigned an
ordinal of zero)". So the column holds `0`, `1` or `2`. The User Guide confirms the
mapping: ORDINAL is "stored according to the enum value's ordinal position within the
enum class, as indicated by `java.lang.Enum#ordinal`".

Nothing in the database records *what* `1` means. The meaning lives entirely in the
order of lines in a `.java` file.

## The refactor that corrupts everything

Six months later, someone adds a status. The natural place to put it is where it
belongs in the workflow:

```java
public enum OrderStatus {
    PENDING,      // 0
    PAID,         // 1   ← inserted here
    SHIPPED,      // 2   was 1
    DELIVERED     // 3   was 2
}
```

The change compiles. Tests pass — they create data and read it back within the same
version of the enum, so they cannot see the problem. The deploy succeeds.

And every order that was `SHIPPED` is now `PAID`. Every order that was `DELIVERED` is
now `SHIPPED`. Orders that shipped last month are back in the payment queue.

**There is no signal.** The values are all still in range, so no constraint fires. The
column type is still `integer`. Hibernate reads `1`, looks up ordinal 1, and returns
`PAID` — which is a completely correct implementation of what you asked for.

And it is **not recoverable from the data**. Row 4711 holds `1`. That `1` might mean
`SHIPPED` (written before the deploy) or `PAID` (written after). Nothing in the row
distinguishes them. Unless you have an audit trail or a `updated_at` you can correlate
against the deploy time, the original meaning is gone.

Reordering constants alphabetically, deleting an obsolete constant, or merging two
enums all do the same damage by the same mechanism.

## `STRING` stores the name, and names do not move

```java
@Enumerated(EnumType.STRING)
@Column(length = 20)
private OrderStatus status;
```

Now the column holds `'PENDING'`, `'SHIPPED'`, `'DELIVERED'`. Insert a constant
anywhere you like — the stored values are unaffected, because `Enum#name()` does not
depend on position.

You also get three things for free:

- The data is **readable**. `select status, count(*) from orders group by status` is
  answerable by anyone with a SQL prompt, not just someone holding the right version of
  the source.
- **Renaming** a constant now *fails loudly* instead of silently: the old string no
  longer matches any constant, and Hibernate throws rather than returning the wrong
  value. A loud failure you can fix with a migration is strictly better than a quiet
  one you cannot.
- The DDL Hibernate generates is self-documenting. Since Hibernate 6, per the
  Introduction, "an enum annotated `@Enumerated(STRING)` is mapped to a VARCHAR column
  type with a CHECK constraint on most databases, or an ENUM column type on MySQL." The
  check constraint enumerates the legal values in the schema itself.

The Introduction's own recommendation, after a nice worked example about `DayOfWeek`
where even a "naturally ordered" enum has a culturally ambiguous integer encoding:
"we prefer `@Enumerated(STRING)` for most enum attributes."

## What Hibernate 6 and 7 changed, which most advice predates

Two changes matter and neither is widely known.

**Non-STRING enums no longer map to a plain `integer`.** The Introduction: "Any other
enum is mapped to a TINYINT column with a CHECK constraint." So a Hibernate-generated
schema for an ORDINAL enum now constrains the range. That narrows one failure mode —
an out-of-range integer is rejected — but it does *nothing* about the corruption above,
because reordering keeps every value in range. **A check constraint does not make
ORDINAL safe.**

**PostgreSQL's native `ENUM` type is available but is not the default.** The
Introduction explains why Hibernate does not reach for it: these "ENUM types aren't
well-integrated with the SQL language, nor well-supported by the JDBC drivers, so
Hibernate doesn't use them by default." If you want it:

```java
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@JdbcTypeCode(SqlTypes.NAMED_ENUM)
@Basic(optional = false)
private OrderStatus status;
```

or globally with `hibernate.type.prefer_native_enum_types`. Before adopting it, know that
adding a value to a PostgreSQL enum type is a DDL change (`ALTER TYPE ... ADD VALUE`) with
its own transactional restrictions — you trade a Java-side migration for a database-side one.

## When you need a stable code that is neither the ordinal nor the name

Sometimes the database column is fixed by an external contract — a legacy integer, a
partner's code. Two mechanisms, and the newer one is much simpler.

**`@EnumeratedValue`** (Hibernate) lets a field of the enum *be* the stored value:

```java
enum Resolution {
    UNRESOLVED(0), FIXED(1), REJECTED(-1);

    @EnumeratedValue   // store the code, not the enum ordinal() value
    final int code;

    Resolution(int code) { this.code = code; }
}
```

The code now lives with the constant, so it cannot drift when the file is reordered.
That example is straight from the Hibernate Introduction.

**An `AttributeConverter`** (JPA) is the portable equivalent and gives you full control
of both directions:

```java
@Converter(autoApply = true)
public class OrderStatusConverter implements AttributeConverter<OrderStatus, String> {

    @Override
    public String convertToDatabaseColumn(OrderStatus status) {
        return status == null ? null : status.getCode();
    }

    @Override
    public OrderStatus convertToEntityAttribute(String code) {
        if (code == null) return null;
        return OrderStatus.fromCode(code);   // throws on an unknown code — deliberately
    }
}
```

⛔ **Do not combine `@Convert` with `@Enumerated` on the same attribute.** Jakarta
Persistence 3.2 §11 is explicit: "The `Convert` annotation should not be used to specify
conversion of id attributes […] of version attributes, of relationship attributes, or of
attributes explicitly annotated […] as `Enumerated` or `Temporal`. Applications that
depend on such conversions are not portable." Pick one mechanism. Converters are covered
further in
[5 · Embeddables, LOBs and converters](05-embeddables-lobs-converters.md).

## Gotchas

**`@Enumerated` with no argument is `ORDINAL`.**
People read the bare annotation as "this is an enum, map it sensibly". It is not a
hint; it is a choice, and it is the dangerous one. Always write the argument out.

**An enum field with *no* `@Enumerated` at all is also `ORDINAL`.**
The default applies to any enum attribute, annotated or not. Auditing a codebase for
this trap means grepping for enum-typed fields, not for `@Enumerated`.

**Tests cannot catch it.**
An integration test writes and reads within one version of the enum, so ordinals are
self-consistent and everything passes. The corruption is a property of *data written by
an older version of the code*, which no test fixture contains. This is why the trap
survives good test suites.

**Alphabetising an enum is a data migration.**
An IDE "sort members" action on an ORDINAL-mapped enum silently rewrites the meaning of
every existing row. So does deleting a deprecated constant, which shifts everything
after it down by one.

**Migrating ORDINAL → STRING needs a data migration, not just an annotation change.**
Change the annotation alone and Hibernate starts reading `'2'`-as-a-string from an
integer column, or reads integers and fails to match a name. The migration is: add a new
column, backfill it with a `CASE` expression that encodes today's ordinal-to-name
mapping, switch the mapping, drop the old column. Write the `CASE` from the enum as it
exists **at migration time**, and do it before anyone reorders it.

**Appending to the end of an ORDINAL enum is safe — which is why the trap persists.**
The first few times someone adds a constant they add it at the end, nothing breaks, and
the team concludes ORDINAL is fine. The rule "only ever append" is real but it is a
convention held by humans against an IDE refactor button, and it loses.

**`@Enumerated(STRING)` without a length is a `varchar(255)`.**
Harmless but wasteful, and it makes the column look like free text in a schema diagram.
Set `@Column(length = 20)` to something that documents the actual range.

**A renamed constant fails at *read* time, not at deploy time.**
Rename `SHIPPED` to `DISPATCHED` under STRING mapping and the application starts
cleanly; it breaks when a row containing `'SHIPPED'` is first read. That is still far
better than ORDINAL's silence, but it means "it started up" is not evidence the rename
was safe.

## Interview questions

**★ What does `@Enumerated(EnumType.ORDINAL)` store, and why is it dangerous?**
It stores `Enum#ordinal()` — the zero-based position of the constant in its declaration.
The danger is that the position is a property of the *source file*, not of the domain,
so any edit that shifts positions — inserting a constant in the middle, reordering,
deleting one — silently changes the meaning of every row already written. Nothing
throws, because the stored integers remain valid ordinals; they just now resolve to
different constants. And the damage is not recoverable from the data, since a stored
`1` carries no record of which version of the enum wrote it.

**★ Why is `STRING` safe from that?**
Because it stores `Enum#name()`, which is tied to the constant itself rather than to its
position. Reordering the declaration changes no stored value. Renaming a constant does
break the mapping, but it breaks *loudly* at read time rather than silently returning
the wrong constant — and a loud failure is something you can fix with a migration.

**★ Are there cases where ORDINAL is the right choice?**
Rarely, and the argument is weaker than it looks. It saves a few bytes per row and can
index marginally more cheaply, which matters only at a scale where you would also be
considering a lookup table. Even Hibernate's example of a "naturally ordered" enum,
`DayOfWeek`, is used in the documentation to make the opposite point: the integer
encoding is culturally ambiguous, since `java.time.DayOfWeek` encodes Sunday as 6 while
many cultures treat it as the first day. If you need a compact stored code, use
`@EnumeratedValue` or a converter — you get the compactness *and* a code that is bound
to the constant rather than to its position.

**★ Since Hibernate 6 an ORDINAL enum generates a TINYINT with a CHECK constraint. Does that fix the problem?**
No, and it is worth being precise about why. The check constraint bounds the *range* of
legal values, so it catches an integer that corresponds to no constant. Reordering an
enum keeps every value inside the range — a `1` is still a `1` — so the constraint never
fires. It is a defence against a different bug.

**★ How would you migrate an existing ORDINAL column to STRING?**
Not by changing the annotation alone; that would leave Hibernate reading integers as
names. Add a new varchar column, backfill it with a `CASE` expression that maps each
current ordinal to the corresponding constant name — written from the enum exactly as it
stands at migration time — verify the counts per value against the old column, then
switch the mapping to `@Enumerated(STRING)` pointing at the new column, and drop the old
one in a later migration once nothing reads it. The critical detail is that the `CASE`
must be authored before anyone touches the enum's order, because after that the ordinals
in the database and the ordinals in the source no longer agree.

**★ How do you map an enum onto a legacy integer code that is not the ordinal?**
Two ways. Hibernate's `@EnumeratedValue` marks a field of the enum as the stored value,
so the code sits next to the constant in the enum declaration and cannot drift when the
file is reordered. Or, portably, an `AttributeConverter` between the enum and the column
type, which also lets you decide what an unrecognised code should do — and it should
throw, not return `null`, because silently mapping unknown data to "no status" is how
you get the ORDINAL failure mode back by another route. One caveat worth knowing: the
spec says `@Convert` should not be used on an attribute that also carries
`@Enumerated`, and calls applications that rely on it non-portable — so use one or the
other, not both.

**★ Why don't unit tests catch the ORDINAL bug?**
Because it is not a bug in the code — it is a mismatch between data written by one
version of the code and read by another. A test writes with the current enum and reads
with the current enum, so its ordinals are self-consistent by construction. Catching it
would require a fixture containing rows written by the *previous* version of the enum,
which is not something test suites normally carry.

---

← Prev: [3 · Fields, columns, access](03-fields-columns-access.md) · Index: [The JPA/Hibernate model](README.md) · Next → [5 · Embeddables and converters](05-embeddables-lobs-converters.md)
