---
title: "There are exactly three ways to fix entity equality, Hibernate recommends the middle one, and the third is a documented workaround with a real cost"
sidebar_label: "10b · Fixing entity equality"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.4.7 *Implementing
> equals() and hashCode()*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §3.26 *equals() and hashCode()* and §3.9 *Natural
> id attributes*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the `java.util.Set` javadoc for JDK 25
> ([docs.oracle.com/en/java/javase/25/docs/api/](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Set.html)).
> JDK 25, Hibernate ORM 7.4.1, PostgreSQL 18.

**[10 · equals and hashCode](10-equals-and-hashcode.md) showed the failure: an
identifier-based hash changes across the flush and the `HashSet` loses the element. This
chunk is the repair. Three candidate fixes exist, Hibernate documents all three, and it
recommends the second — a natural key. The third, a constant hash, is what you use when
there is no natural key, and it is worth knowing that it is a documented workaround with
a named price rather than an equally good alternative.**

## The three fixes, in the order you will consider them

### Fix 1 · flush before adding — real, and rarely usable

```java
entityManager.persist(book1);
entityManager.persist(book2);
entityManager.flush();          // ids are assigned here

library.getBooks().add(book1);
library.getBooks().add(book2);
```

The User Guide shows this and its assertions pass. It also gives the verdict in four
words: "But this is often not feasible." You have to know every place an entity might be
added to a hashed collection, and force a flush before each — including inside code you
do not own.

### Fix 2 · a natural key or business key — what Hibernate recommends

```java
@Entity
public class Book {

    @Id @GeneratedValue
    private Long id;

    @NaturalId
    private String isbn;

    public String getIsbn() { return isbn; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Book)) return false;
        return Objects.equals(isbn, ((Book) o).getIsbn());
    }

    @Override
    public int hashCode() {
        return Objects.hash(isbn);
    }
}
```

The ISBN is set by the application before the object goes anywhere, so it never changes
while the object sits in a set. The User Guide confirms the outcome and the Introduction
states the principle behind it:

> You should not include a mutable field in the hashcode, since that would require
> rehashing every collection containing the entity whenever the field is mutated.
>
> It's not completely wrong to include a generated identifier (surrogate key) in the
> hashcode, but since the identifier is not generated until the entity instance is made
> persistent, you must take great care to not add it to any hashed collection before the
> identifier is generated. **We therefore advise against including any database-generated
> field in the hashcode.**
>
> It's OK to include any immutable, non-generated field in the hashcode.

And its recommendation: "we recommend identifying a natural key for each entity, that is,
a combination of fields that uniquely identifies an instance of the entity […] The natural
key should correspond to a unique constraint on the database, and to the fields which are
included in `equals()` and `hashCode()`."

Note the two things `@NaturalId` buys beyond equality: it documents the business key, and
it enables Hibernate's load-by-natural-id path.

### Fix 3 · a constant `hashCode`, when there is no natural key

Sometimes there genuinely is no stable business key. The User Guide gives the workaround
and is explicit that it *is* a workaround:

> Although using a natural-id is best for equals and hashCode, sometimes you only have
> the entity identifier that provides a unique constraint. It's possible to use the
> entity identifier for equality check, but it needs a workaround:
>
> - you need to provide a constant value for `hashCode` so that the hash code value does
>   not change before and after the entity is flushed.
> - you need to compare the entity identifier equality only for non-transient entities.

```java
@Override
public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof Book other)) return false;
    return id != null && id.equals(other.getId());   // null id ⇒ not equal to anything else
}

@Override
public int hashCode() {
    return getClass().hashCode();   // constant per class — never changes
}
```

Two details are load-bearing. `id != null` means two unsaved instances are *not* equal,
which fixes the collapse-into-one problem. And a constant hash means every instance of
the class lands in one bucket, degrading a large `HashSet` towards linear scanning —
acceptable for the small collections entities usually live in, not acceptable for
thousands.

## Two rules about proxies you must not skip

Both come from the fact that Hibernate may hand you a generated subclass instead of your
class — see [1b · The rules the spec imposes](01b-the-rules-the-spec-imposes.md).

**Use `instanceof`, not `getClass()`.** The Introduction annotates its own example:
"check type with `instanceof`, not `getClass()`". A proxy's `getClass()` is the generated
subclass, so `getClass() == other.getClass()` is false for a real instance compared with
a proxy of the same row.

**Read the other object's state through its getter.** The Introduction: "you should […]
access fields of the passed entity via its accessor methods." Reading `other.isbn`
directly on a proxy bypasses the interception that would load it, and you see `null`.

## Gotchas

**Lombok `@Data` or `@EqualsAndHashCode` on an entity generates the worst possible version.**
Every field, including the generated id and every mutable column, and using `getClass()`
rather than `instanceof`. It reproduces all three failures at once.

**A record's generated `equals` has the same problem, for the same reason.**
That is one of the arguments in
[1c · Why an entity cannot be a record](01c-why-not-a-record.md) — value equality over
all components is not what entity identity means.

**A composite id class is the one place where id-based equality is mandatory.**
The User Guide: "there is really just one absolute case: a class that acts as an
identifier must implement equals/hashCode based on the id value(s)." That is about the
`@EmbeddedId`/`@IdClass` type, not about the entity — see
[6 · The identifier](06-the-identifier.md).

**Not implementing `equals` at all is a defensible default.**
The User Guide floats it: "Beyond this one very specific use case and few others we will
discuss below, you may want to consider not implementing equals/hashCode altogether."
Reference identity is correct inside a persistence context and honest outside one.


## Interview questions

**★ What does Hibernate recommend instead?**
A natural key — an immutable, non-generated combination of fields that identifies the
entity from the domain's point of view, backed by a unique constraint and marked
`@NaturalId`. The Introduction's rules are: never put a mutable field in the hash, because
mutating it corrupts every hashed collection holding the object; avoid any
database-generated field, because it does not exist until persist; and any immutable,
non-generated field is fine.

**★ What if the entity genuinely has no natural key?**
Use the identifier for equality but make `hashCode` a constant — typically
`getClass().hashCode()` — so it cannot change across the flush, and guard `equals` so an
entity with a null id is equal only to itself. The User Guide documents exactly this pair
of adjustments. The price is that every instance of the class hashes to one bucket, which
degrades a large `HashSet` to a linear scan; acceptable for the small collections that
hang off an entity, not for thousands of elements.

**★ Why `instanceof` rather than `getClass()`?**
Because Hibernate implements lazy loading by handing you a generated subclass of your
entity. A proxy's `getClass()` is that subclass, so a `getClass()` comparison declares a
real instance and a proxy of the same row unequal — which then breaks `contains`,
`remove`, and any dirty-checking logic that depended on the comparison. The same reasoning
means `equals` should read the other object's state through its getters, since reading a
proxy's field directly bypasses initialisation and yields `null`.

**★ Is it ever right to base `equals` on the id?**
Yes — for the id class itself. An `@EmbeddedId` or `@IdClass` type must implement
`equals`/`hashCode` over its components, and the User Guide calls this the one absolute
case. That is why declaring the id class as a record is a good fit: value equality over
all components is exactly the required semantics. The rule that generated ids are unsafe
in a hash applies to the *entity*, whose id is assigned later, not to the id class, whose
components are set at construction.

---

← Prev: [10 · equals and hashCode](10-equals-and-hashcode.md) · Index: [The JPA/Hibernate model](README.md) · Next → [11 · The persistence context](11-the-persistence-context.md)
