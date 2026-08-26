---
title: "The @Id is not really for the database — it is the key the persistence context files your object under, and that is why the rules around it are strict"
sidebar_label: "6 · The identifier"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.7 *Identifiers*,
> §3.7.1 *Simple identifiers* and §3.7.2 *Composite identifiers*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §3.4 *Identifier attributes*, §3.6 *Natural keys
> as identifiers* and §3.7 *Composite identifiers*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Jakarta Persistence 3.2 specification §2.4 *Primary Keys and Entity
> Identity*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**It is natural to read `@Id` as "this field is the primary key" and stop there. That
reading explains none of the rules that come with it. The identifier is the key of the
persistence context's identity map — the thing that lets Hibernate answer "have I
already loaded this row?" — and that job is what makes it required, unique, non-null
and immutable. The database's primary key is where the value is *stored*; the `@Id` is
how the runtime *uses* it.**

## The three assumptions, and why they are not negotiable

The User Guide §3.7 states them as a list:

> **UNIQUE** — the values must uniquely identify each row.
> **NOT NULL** — the values cannot be null. For composite ids, no part can be null.
> **IMMUTABLE** — the values, once inserted, can never be changed.

Read them against the identity map and each one becomes obvious rather than
bureaucratic.

**Unique**, because the map has one slot per key. Two rows sharing an identifier means
one of them cannot be stored, or the second silently displaces the first.

**Not null**, because `null` is not a usable map key here — it cannot distinguish rows,
and Hibernate uses "the id is still null" as the signal that an entity has *not been
persisted yet*. That signal is load-bearing; see
[12 · The four states](12-the-four-states.md).

**Immutable**, because changing an entity's id would mean the object is filed under a
key that no longer describes it. Everything downstream — the entity that referenced it,
the queued UPDATE that names it in its `where` clause, the second-level cache entry —
would still be pointing at the old value. Hibernate does not offer a way to do this;
"change the primary key" is modelled as delete plus insert, and the User Guide's advice
when the value genuinely does change is to demote it: "Hibernate recommends mapping the
mutable value as a natural id, and use a surrogate id for the PK."

There is a subtlety in that same section worth carrying: the identifier "does not have
to map to the column(s) physically defined as the table primary key. They just need to
map to column(s) that uniquely identify each row." That matters when you are mapping
onto a schema someone else owns.

## Assigned or generated — that is the first real decision

The Introduction puts it plainly: identifier values may be "assigned by the
application, that is, by your Java code, or generated and assigned by Hibernate."

**Assigned** is what you get when there is no `@GeneratedValue`:

```java
@Entity
public class Book {
    @Id
    private String isbn;      // you set it; it means something
}
```

This is a **natural key** — an identifier "meaningful to the user of the system", in the
Introduction's phrase. The application is responsible for putting a value there before
`persist`.

**Generated** is `@GeneratedValue`:

```java
@Entity
public class Customer {
    @Id @GeneratedValue
    private Long id;          // Hibernate sets it; it means nothing
}
```

This is a **surrogate key**. The Introduction recommends it where you have the choice:
"System-generated identifiers, or surrogate keys make it easier to evolve or refactor
the relational data model. If you have the freedom to define the relational schema, we
recommend the use of surrogate keys." The generation strategies themselves are
[7 · IDENTITY](07-generatedvalue-identity.md) onwards.

Why the surrogate usually wins is worth stating explicitly, because "the ISBN is
already unique" is a reasonable-sounding argument. Natural keys have three habits:
they change (a customer's email; a product code after a merger), they get wide (a
composite of four columns propagates into every foreign key), and they turn out not to
be unique after all (ISBNs have been reissued). A surrogate key has no meaning, so
nothing about the business can invalidate it. The natural key still deserves a unique
constraint — and `@NaturalId`, which is
[10 · equals and hashCode](10-equals-and-hashcode.md)'s answer to entity equality.

## Which Java types are allowed

The User Guide lists what Jakarta Persistence portably supports as an identifier type:
any primitive, any primitive wrapper, `java.lang.String`, `java.util.Date`
(`TemporalType#DATE`), `java.sql.Date`, `java.math.BigDecimal`, `java.math.BigInteger`.
"Hibernate, however, supports a more broad set of types to be used for identifiers
(`UUID`, e.g.)."

There is a tighter restriction on *generated* ids, and it catches people: "While
Hibernate supports almost any valid basic type be used for generated identifier values,
**Jakarta Persistence restricts the allowable types to just integer types.**" So a
`@GeneratedValue UUID id` works on Hibernate and is outside the portable subset —
`GenerationType.UUID` exists precisely to make that case explicit.

Prefer wrapper types. The User Guide: "we recommend that you declare consistently-named
identifier attributes on persistent classes and that you use a wrapper (i.e.,
non-primitive) type (e.g. `Long` or `Integer`)." The reason is in
[12 · The four states](12-the-four-states.md): Hibernate distinguishes a new instance
from a detached one partly by checking whether the id holds the *default value for its
type*, and for `long` that default is `0`, which is also a plausible id.

## Composite identifiers, and why to avoid them

When a table's primary key is several columns, JPA gives you two mechanisms.

**`@EmbeddedId`** — one attribute, of an `@Embeddable` type:

```java
@Embeddable
public record OrderLineId(Long orderId, int lineNumber) implements Serializable {}

@Entity
public class OrderLine {
    @EmbeddedId
    private OrderLineId id;
}
```

**`@IdClass`** — several `@Id` attributes on the entity, mirrored by a separate class:

```java
@Entity
@IdClass(OrderLineId.class)
public class OrderLine {
    @Id private Long orderId;
    @Id private int lineNumber;
}
```

Both require the id class to be `Serializable` and to implement `equals`/`hashCode`
over its components. That is the one place where the User Guide says an equality
implementation is not optional: "there is really just one absolute case: a class that
acts as an identifier **must** implement equals/hashCode based on the id value(s)."

**A record is the natural id class**, and Hibernate says so: "the easiest way to satisfy
these requirements is to declare the id class as a record." Records generate
`equals`/`hashCode` over every component, which is exactly the required semantics — and
this is the one corner of the model where an entity-adjacent class *should* be defined
by its values. Compare
[1c · Why an entity cannot be a record](01c-why-not-a-record.md), where the same
generated equality is precisely the reason a record cannot be the entity itself.

Hibernate's stated preference between the two is unambiguous. Of `@IdClass`: "This is
not our preferred approach. Instead, we recommend that the `BookId` class be declared as
an `@Embeddable` type," which "eliminates some duplicated code." The motivating question
is a practical one — with several `@Id` fields, "what object can we use to identify a
`Book` and pass to methods like `find()` which accept an identifier?" With `@EmbeddedId`
that object already exists:

```java
Book book = entityManager.find(Book.class, new BookId(isbn, printing));
```

Composite keys are legitimate — you will meet them on join tables and on legacy schemas
— but they cost you. Every foreign key referencing the table becomes multi-column.
`find` takes a constructed key object rather than a number. Spring Data repository
method signatures get noisier. And with `@IdClass` your identifier is spread across the
entity rather than being one value you can pass around. Where you control the schema,
a surrogate `@Id` plus a multi-column unique constraint gives you the same guarantee
with none of the propagation.

## Gotchas

**An identifier you can `set` is an identifier someone will set.**
Exposing `setId(...)` on a `@GeneratedValue` entity invites code to assign one, and the
Introduction warns about exactly this: "we therefore strongly discourage assigning
values to fields annotated `@GeneratedValue` or `@Version` before passing an entity to
Hibernate," because it makes a new instance look detached. Omit the setter.

**"The primary key never changes" is a claim about your data, not about your mapping.**
Nothing in Hibernate prevents you writing `entity.setId(99L)` on a managed entity. What
happens next is undefined-in-practice: the queued UPDATE may name the old value, the
identity map still has the old key, and the resulting mess is very hard to read
backwards from the symptoms.

**A `@GeneratedValue` on a non-`@Id` attribute is not a thing in JPA.**
The Introduction notes: "Nor may `@GeneratedValue` be used on a property not annotated
`@Id`." For generated non-identifier values — created/updated timestamps, database
defaults — Hibernate has `@Generated`, `@CreationTimestamp`, `@UpdateTimestamp` and
`@CurrentTimestamp`.

**An `@IdClass` whose field names or types do not match the entity fails obscurely.**
The mirroring is by name and type, checked at bootstrap, and the message points at the
class rather than at the mismatched member. `@EmbeddedId` avoids the whole category by
having one definition instead of two.

**A composite id class without `equals`/`hashCode` breaks the identity map silently.**
Two `OrderLineId` instances describing the same row will not be equal, so the map keys
differ, so you get two managed instances of one row — and then two conflicting UPDATEs.
This is the failure the User Guide's "one absolute case" is protecting you from.

**A natural-key `@Id` on a mutable column is a bug waiting for a rename.**
Email addresses change. Product SKUs change after an acquisition. Using one as the
primary key means the change is a cascading delete-and-reinsert across every referencing
table. Map it as a `@NaturalId` with a unique constraint and keep a surrogate `@Id`.

**A `String` identifier is legal and quietly expensive.**
It is portable, but it widens every index and every foreign key, and on a busy table
that shows up. If the natural key is textual, keep it as a natural id and use a numeric
surrogate for the PK.

## Interview questions

**★ Why does JPA require an identifier at all?**
Because the persistence context is an identity map keyed by identifier: for any
persistent identity there is at most one instance in the context. That map is what makes
`find` on an already-loaded row return the same object, what lets Hibernate detect
circularity while cascading through a graph, and what dirty checking associates a
snapshot with. Without an id there is no key, so none of it works. Hibernate historically
tolerated identifier-less entities but the 7.4 User Guide now calls that "a deprecated
feature that will be removed in an upcoming release".

**★ Why must the identifier be immutable?**
Because the object is filed under it. Changing the value would leave the entity in the
identity map under a key that no longer describes it, would leave any queued UPDATE
naming the old value in its `where` clause, and would leave every foreign key pointing at
a row that no longer exists. JPA models a primary-key change as delete plus insert, and
Hibernate's own advice when the value genuinely changes is to stop using it as the
primary key: map it as a natural id and introduce a surrogate.

**★ Surrogate or natural key — how do you decide?**
If you control the schema, surrogate. A natural key is meaningful to the business, and
meaningful things change, widen, and turn out not to be as unique as everyone believed.
A surrogate has no meaning, so no business event can invalidate it, and it keeps foreign
keys narrow. The natural key does not disappear: give it a unique constraint and map it
with `@NaturalId`, which also gives you a stable basis for `equals`/`hashCode` and a
lookup path by that key.

**★ `Long` or `long` for the identifier?**
`Long`. Hibernate's heuristic for telling a brand-new transient instance from a detached
one inspects the id: if it holds the default value for its type, the instance is treated
as transient. With `long` the default is `0`, which is a value a row could legitimately
have, so the heuristic is ambiguous; with `Long` the default is `null`, which no
persisted row can hold. The User Guide recommends the wrapper type for this reason.

**★ `@EmbeddedId` or `@IdClass`?**
`@EmbeddedId` in almost every case. It keeps the identifier as one object with one
definition, which means one place to implement `equals`/`hashCode`, one type in
repository signatures, and one thing to pass to `find`. `@IdClass` splits the identifier
across the entity *and* a mirror class that must match it by name and type, so you have
two definitions to keep in step and a bootstrap-time failure when they drift. `@IdClass`
earns its place mainly when a legacy mapping already uses it.

**★ Can a `UUID` be an identifier?**
On Hibernate, yes, and `GenerationType.UUID` exists to generate one. It is worth
knowing that this is outside the portable subset: Jakarta Persistence restricts *generated*
identifier types to integer types, and Hibernate deliberately goes further. The
practical trade is that UUIDs are wider than a `bigint` and, if randomly generated,
insert into random index positions, which fragments a B-tree on a high-insert table —
against which they can be generated client-side without a database round trip and are
safe to merge across systems.

**★ Does the `@Id` have to be the table's primary key?**
No. The User Guide says the identifier "does not have to map to the column(s) physically
defined as the table primary key. They just need to map to column(s) that uniquely
identify each row." That flexibility exists for mapping onto schemas you do not own. It
is not licence to skip the primary key when you do own the schema: without one the
database cannot enforce the uniqueness the whole identity map depends on.

---

← Prev: [5b · Large columns and @Lob](05b-lobs-and-large-columns.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [7 · @GeneratedValue and IDENTITY](07-generatedvalue-identity.md)
