---
title: "A record cannot be a JPA entity — and the reason is not a limitation anyone chose, it is what a record is"
sidebar_label: "1c · Why not a record"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification §2.1 *The Entity
> Class*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Hibernate ORM 7.4 *Introduction* §3.1 *Entity classes* and §3.15 *Embeddable
> objects*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and JEP 395 *Records*
> ([openjdk.org/jeps/395](https://openjdk.org/jeps/395)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Java records are the best thing to happen to data classes in a decade, and the first
instinct of every Java developer meeting JPA in 2026 is to make the entity a record.
It does not work. The interesting part is *why*: not one arbitrary rule but a head-on
collision between what a record guarantees and what a managed entity requires. Once
you see the collision you also see where records absolutely do belong in a JPA model —
and there are three such places.**

## The spec sentence

Jakarta Persistence 3.2 §2.1, listing the requirements on an entity class:

> The entity class must be a top-level class or a static inner class. **An enum,
> record, or interface may not be designated as an entity.**

That is a flat prohibition, added when records arrived. It is not Hibernate being
conservative; it is the specification.

## Why the prohibition is not arbitrary

Records are, in JEP 395's words, "transparent carriers for immutable data". The compiler
gives you three guarantees that are exactly the three things a managed entity cannot
have.

**A record class is implicitly `final`.** Hibernate implements lazy association
fetching by generating a runtime subclass of the entity. A `final` class cannot be
subclassed. See [1b · The rules the spec imposes](01b-the-rules-the-spec-imposes.md)
for the mechanism.

**A record's fields are implicitly `final`.** Hibernate populates an entity by writing
its fields (field access) or calling its setters (property access). A record offers
neither: the fields cannot be written after construction and there are no setters. And
even if you could write them once, **dirty checking requires that the state can change
after loading** — that is the entire feature. A record whose state can change is not a
record.

**A record has no no-argument constructor.** Its canonical constructor takes every
component. The spec requires a public or protected no-arg constructor because the
provider must instantiate the class without understanding your parameters.

Stack those up and the picture is clear. An entity is a *mutable object with a
persistent identity that a runtime watches for changes*. A record is an *immutable
value defined entirely by its components*. Those are opposite designs. The prohibition
in §2.1 is a statement of that fact, not a missing feature.

There is a fourth collision worth naming, because it is the conceptual one. A record's
`equals` is generated from **all** its components. An entity's identity is its
`@Id` — two instances with the same id are the same entity even if a field differs,
and two instances with different ids are different entities even if every other field
matches. Record equality and entity identity mean different things. See
[10 · equals and hashCode](10-equals-and-hashcode.md).

## Where records *do* belong in a JPA model

Three places, and all three are genuinely good practice.

### 1 · As an `@Embeddable`

This one is explicitly blessed. The Hibernate Introduction §3.15:

> Alternatively, an embeddable type may be defined as a Java record type:
>
> ```java
> @Embeddable
> record Name(String firstName, String middleName, String lastName) {}
> ```
>
> In this case, the requirement for a constructor with no parameters is relaxed.

This works because an embeddable has **no persistent identity of its own**. Its
lifecycle is entirely determined by the entity that owns it, and replacing the whole
value is the natural way to change it — which is exactly how you mutate a record: you
build a new one.

```java
@Entity
public class Customer {

    @Id @GeneratedValue
    private Long id;

    private Name name;          // @Embedded is optional

    public void rename(Name newName) {
        this.name = newName;    // whole-value replacement — dirty checking sees it
    }
}
```

The setter on the *entity* is what dirty checking watches. The record inside is just
the value. More in
[5 · Embeddables, LOBs and converters](05-embeddables-lobs-converters.md).

### 2 · As a query projection

This is where records pay for themselves most often. When you only need a few columns,
select straight into a record and never load an entity at all:

```java
public record CustomerSummary(Long id, String email, long orderCount) {}
```

```java
List<CustomerSummary> rows = entityManager.createQuery("""
        select new com.example.CustomerSummary(c.id, c.email, size(c.orders))
        from Customer c
        where c.active = true
        """, CustomerSummary.class)
    .getResultList();
```

Nothing here is managed. Nothing is dirty-checked. Nothing is held in the persistence
context. For read-only endpoints that is a strict improvement — and it is one of the
tools **Topic 08 · The N+1 problem** *(not written yet)* reaches for.

### 3 · As the DTO at your API boundary

Entities should not leave the service layer.
[1 · What an entity is](01-what-an-entity-is.md) explains why. A record is the ideal
thing to map them into on the way out: immutable, cheap to write, and structurally
incapable of accidentally issuing an UPDATE.

## What about a composite key?

Records are the recommended shape for a composite identifier, in both mechanisms.
Hibernate's Introduction §3.7 says of the `@IdClass` route that "every such id class
must override `equals()` and `hashCode()`. Of course, the easiest way to satisfy these
requirements is to declare the id class as a record." And it then states a preference
between the two: "This is not our preferred approach. Instead, we recommend that the
`BookId` class be declared as an `@Embeddable` type" and used with `@EmbeddedId`, which
"eliminates some duplicated code."

```java
@Embeddable
record BookId(String isbn, int printing) {}

@Entity
class Book {
    Book() {}

    @EmbeddedId
    BookId bookId;
}
```

This works for the same reason any embeddable record does — and here the generated
value-based equality is not merely tolerated but *required*, since an id class's whole
job is to compare equal when it denotes the same row. Identifier values are also
required to be immutable, so a record's finality is a virtue rather than an obstacle.
See [6 · The identifier](06-the-identifier.md).

## Gotchas

**The failure is at bootstrap, not at compile time.**
`@Entity record Customer(...)` compiles. It fails when Hibernate builds its metadata,
because nothing in the type system knows about JPA's rules. Do not read "it compiled"
as "it is a valid mapping" — that is true of most of this topic.

**"Just add a no-arg constructor to the record" does not help.**
You can give a record a compact or alternative constructor, but you cannot make its
fields non-final or the class non-final. Rules 2 and 3 still fail, and rule 3 is fatal:
there is no way for the runtime to write state into the instance.

**A Kotlin `data class` is not a record, but fails the same way for the same reasons.**
It is `final` and its `val` properties are read-only. The standard fix is the
`kotlin-allopen` and `kotlin-noarg` compiler plugins configured for JPA annotations —
which is worth understanding as *making the class not behave like a data class any
more*.

**An embeddable record's components are still mapped as columns of the owning table.**
Making it a record does not create a table. `Name(firstName, middleName, lastName)`
inside `Customer` maps to three columns on `customer`. If you want it in its own table
you want an entity and a relationship, which is **Topic 07 · Relationships and fetch
types** *(not written yet)*.

**A record projection with `select new` needs the fully-qualified class name.**
It is a constructor expression, and JPQL resolves it against the class name you write.
Hibernate also supports positional and `select new map(...)` forms, but the
fully-qualified constructor expression is the portable one.

## Interview questions

**★ Can a JPA entity be a Java record? Why or why not?**
No. Jakarta Persistence 3.2 §2.1 states directly that "an enum, record, or interface
may not be designated as an entity." The reason is structural rather than political: a
record is implicitly final, so Hibernate cannot generate the lazy-loading proxy
subclass; its fields are implicitly final, so the provider cannot populate an instance
after construction and dirty checking has nothing it can observe changing; and it has
no no-argument constructor, which the provider needs to instantiate the class from a
result set. Underneath all three, a record models an immutable value while an entity
models a mutable object with a persistent identity.

**★ Then where would you use a record in a JPA application?**
Three places. As an `@Embeddable` — Hibernate supports this explicitly and relaxes the
no-arg constructor requirement for it, because an embeddable has no identity of its own
and whole-value replacement is the natural way to change it. As a query projection via
a `select new` constructor expression, which avoids loading managed entities at all for
read-only work. And as the DTO you map entities into at the API boundary, where
immutability is exactly what you want.

**★ Why does the embeddable case work when the entity case does not?**
Because the two prohibitions have different causes. An embeddable is never proxied on
its own and never has its own identity in the persistence context, so the `final`-class
objection disappears. And you never mutate an embeddable in place — you assign a new
one to the owning entity's attribute, and dirty checking observes the *entity's*
attribute changing. The immutability that disqualifies a record as an entity is
harmless, even helpful, as a value.

**★ A colleague makes the entity a Lombok `@Value` class instead. Same problem?**
Yes, and it is worth being able to say why in the same terms: `@Value` generates a
final class with final fields and no no-arg constructor. It is a record by another
route. `@Data` is more insidious — the class is mutable and instantiable, so it starts
up fine, but its generated `equals`/`hashCode` include every field, including mutable
ones and the generated id, which is the precise failure mode covered in
[10 · equals and hashCode](10-equals-and-hashcode.md).

**★ What is the deeper conceptual difference between record equality and entity identity?**
A record is defined by its components: two records are equal when every component is
equal, and there is nothing else to a record. An entity is defined by its identifier:
two instances with the same id denote the same row and therefore the same entity, even
if a field differs because one is stale, and two instances with different ids are
different entities even if every non-id field matches. Equality is about *value*;
entity identity is about *which row*. A type cannot sensibly mean both.

---

← Prev: [1b · The rules the spec imposes](01b-the-rules-the-spec-imposes.md) · Index: [The JPA/Hibernate model](README.md) · Next → [2 · @Entity and @Table](02-entity-and-table.md)
