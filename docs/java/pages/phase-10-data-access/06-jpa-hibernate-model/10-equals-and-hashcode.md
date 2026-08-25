---
title: "equals/hashCode based on a generated @Id loses elements out of a HashSet, because the hash changes while the object is in it"
sidebar_label: "10 · equals and hashCode"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.4.7 *Implementing
> equals() and hashCode()*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §3.26 *equals() and hashCode()*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the `java.util.Set` and `java.lang.Object#hashCode` javadoc for JDK 25
> ([docs.oracle.com/en/java/javase/25/docs/api/](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Set.html)).
> JDK 25, Hibernate ORM 7.4.1, PostgreSQL 18.

**Everyone's first `equals`/`hashCode` on an entity compares the `@Id`. It is the obvious
choice, it looks correct, and it silently breaks `HashSet`. The reason is a contract
violation rather than a JPA quirk: `Set` requires that an element's hash does not change
while it is in the set, and a generated identifier is `null` when you add the object and
a number after the flush. This chunk shows the failure precisely; the three
fixes, and Hibernate's recommendation among them, are
[10b · Fixing entity equality](10b-fixing-entity-equality.md).**

## Start with what Hibernate already gives you

Inside one persistence context you do not need `equals` at all. The User Guide:

> Hibernate guarantees equivalence of persistent identity (database row) and Java
> identity inside a particular session scope. So if we ask a Hibernate `Session` to load
> that specific `Person` multiple times we will actually get back the same instance.

```java
Book book1 = entityManager.find(Book.class, 1L);
Book book2 = entityManager.find(Book.class, 1L);

assertTrue(book1 == book2);      // reference equality — the identity map at work
```

That is the identity map from [11 · The persistence context](11-the-persistence-context.md),
and it means a `HashSet` populated from a single context already behaves correctly with
the default `Object` identity semantics.

The trouble starts the moment instances from *different* contexts, or instances that are
not yet persistent, end up in the same collection. The User Guide's own framing:

> In cases where you will be dealing with entities outside of a `Session` (whether they
> be transient or detached), especially in cases where you will be using them in Java
> collections, you should consider implementing equals/hashCode.

So the question is not "should entities have `equals`" in the abstract. It is "what
should it be based on, given that the obvious answer is wrong".

## The obvious answer, and exactly how it fails

```java
@Entity
public class Book {

    @Id @GeneratedValue
    private Long id;

    private String title;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Book)) return false;
        return Objects.equals(id, ((Book) o).getId());
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
```

Now add two unsaved books to a persisted `Library`'s `Set`, inside a transaction, and
check afterwards:

```java
Book book1 = new Book();
book1.setTitle("High-Performance Java Persistence");
Book book2 = new Book();
book2.setTitle("Java Persistence with Hibernate");

Library library = scope.fromTransaction(entityManager -> {
    Library lib = entityManager.find(Library.class, 1L);
    lib.getBooks().add(book1);
    lib.getBooks().add(book2);
    return lib;
});

assertFalse(library.getBooks().contains(book1));   // ← both fail
assertFalse(library.getBooks().contains(book2));
```

That example is the User Guide's, assertions included. The books are *in* the set. The
set cannot find them.

The User Guide names the cause precisely:

> The issue here is a conflict between the use of the generated identifier, the contract
> of `Set`, and the equals/hashCode implementations. `Set` says that the equals/hashCode
> value for an object should not change while the object is part of the `Set`. But that
> is exactly what happened here because the equals/hashCode are based on the (generated)
> id, which was not set until the Jakarta Persistence transaction is committed.

Mechanically: `hashCode()` on an id of `null` produces one bucket. The set files the
object there. At commit the id is assigned, so `hashCode()` now produces a different
bucket. `contains()` looks in the new bucket and finds nothing. The object is still in
the set — iterating finds it — but every hash-based operation misses it.

There is a second failure in the same family. Before ids are assigned, `book1` and
`book2` both have `id == null`, so they are `equals` to each other. Add both to a set and
you get **one** element. Two different books have collapsed into one.

⚠️ Note what the User Guide adds: "this is just a concern when using generated
identifiers. If you are using assigned identifiers this will not be a problem, assuming
the identifier value is assigned prior to adding to the `Set`." A natural-key `@Id` set
before insertion is stable, and the whole problem disappears.

## Gotchas

**The bug does not appear in tests that use one persistence context.**
Inside one context the identity map already gives correct behaviour, so a test that
creates, saves and re-reads in one transaction passes. The failure needs a detached
instance or an unsaved one.

**`List` hides the bug; `Set` exposes it.**
`ArrayList.contains` uses `equals` linearly and never consults `hashCode`, so a broken
`hashCode` is invisible. Changing a mapped collection from `List` to `Set` — a perfectly
reasonable modelling decision — can surface a latent bug written years earlier.

**Mutating any field used in `hashCode` corrupts every hashed collection containing the
object.**
This is the general form of the rule, not a JPA speciality: the object is filed under
its old hash and will not be found under its new one. It is why the Introduction says
never to put a mutable field in the hash.

More traps — and every fix — are in [10b · Fixing entity equality](10b-fixing-entity-equality.md).

## Interview questions

**★ Why does `equals`/`hashCode` based on a generated `@Id` break a `HashSet`?**
Because `Set` requires that an element's hash not change while it is a member, and a
generated id is `null` when the object is created and a number after the insert. Add the
object to a set before it is persisted and it is filed in the bucket for a `null` id;
after the flush its hash points at a different bucket, so `contains` and `remove` miss it
even though iteration still finds it. There is a second failure in the same shape: before
ids are assigned, every unsaved instance has `id == null` and so compares equal to every
other, which collapses several distinct objects into one set element.

**★ Do you need `equals` at all if everything happens in one transaction?**
No. Within a persistence context Hibernate guarantees one instance per row, so reference
equality is already row equality and the inherited `Object` implementation is correct.
The User Guide even suggests considering not implementing them at all. You need them when
entities cross context boundaries — detached objects sent to another layer and compared,
unsaved objects placed in collections, entities loaded in two different sessions and
combined.

**★ Why does switching a mapped collection from `List` to `Set` sometimes break code that worked?**
Because `List.contains` scans linearly with `equals` and never calls `hashCode`, so a
broken `hashCode` has no effect. `HashSet` uses the hash to choose a bucket before calling
`equals` at all, so the same broken implementation now loses elements. The bug was always
there; the collection type decided whether it was reachable.

---

← Prev: [9 · TABLE, AUTO and UUID](09-table-auto-uuid.md) · Index: [The JPA/Hibernate model](README.md) · Next → [10b · Fixing entity equality](10b-fixing-entity-equality.md)
