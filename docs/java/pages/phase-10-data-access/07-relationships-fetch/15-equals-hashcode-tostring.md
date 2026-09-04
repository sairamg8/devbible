---
title: "toString on a bidirectional pair recurses until the stack ends, and a hashCode built on a generated id loses the object inside its own Set"
sidebar_label: "15 · equals, hashCode, toString"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §3.26 *equals() and
> hashCode()* and §3.17 *Set, List, or Collection?*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the `@NaturalId` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/annotations/NaturalId.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/annotations/NaturalId.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Three methods every Java developer writes without thinking, and all three are traps on
an entity with associations. `toString` recurses forever across a bidirectional pair.
`hashCode` built on a generated id changes when the entity is persisted, losing the object
inside its own `Set`. `equals` built on `getClass()` returns false for a proxy that
represents the same row. Each has a documented fix, and the fixes are short.**

## The `toString` recursion

```java
class Publisher {
    @Override public String toString() {
        return "Publisher{id=" + id + ", books=" + books + "}";     // ⛔
    }
}

class Book {
    @Override public String toString() {
        return "Book{isbn=" + isbn + ", publisher=" + publisher + "}";  // ⛔
    }
}
```

`publisher.toString()` prints its books; each book prints its publisher; that publisher
prints its books. The recursion ends when the stack does — a `StackOverflowError`, from a
log statement.

There is a second failure hiding behind the first. Even with the recursion broken,
`toString` on a lazy collection **initialises it**. So a debug log line issues a query, and
one written inside a loop issues one per iteration. If the persistence context has already
closed, it throws instead.

**The rule: `toString` must not touch any association.**

```java
@Override
public String toString() {
    return "Publisher{id=" + id + ", name='" + name + "'}";
}
```

If you want an association mentioned, mention its identifier — and read it from the owning
side's field, which does not initialise anything (**[14](14-what-a-lazy-association-is.md)**):

```java
@Override
public String toString() {
    return "Book{isbn='" + isbn + "', publisherId=" +
           (publisher == null ? null : publisher.getId()) + "}";
}
```

Or report load state instead of contents, using **[14b](14b-inspecting-initialization.md)**:

```java
"books=" + (Hibernate.isInitialized(books) ? books.size() + " loaded" : "<not loaded>")
```

## `hashCode` and the generated id

The obvious implementation:

```java
@Override public int hashCode() { return Objects.hash(id); }   // ⛔
```

And the failure it produces, which **[2c](02c-keeping-both-sides-in-step.md)** foreshadowed:

```java
Book b = new Book("978-1", "Java Concurrency");
publisher.addBook(b);                 // hashed with id == null
em.persist(b);                        // id assigned → hashCode CHANGES
publisher.getBooks().contains(b);     // may be false — wrong bucket
```

A `HashSet` puts an element in a bucket chosen from its hash at insertion time. Changing the
hash afterwards does not move it. The object is physically in the set and unreachable
through it.

Hibernate's *Introduction* states the principles directly:

> - You should not include a mutable field in the hashcode, since that would require
>   rehashing every collection containing the entity whenever the field is mutated.
> - It's not completely wrong to include a generated identifier (surrogate key) in the
>   hashcode, but since the identifier is not generated until the entity instance is made
>   persistent, you must take great care to not add it to any hashed collection before the
>   identifier is generated. **We therefore advise against including any database-generated
>   field in the hashcode.**
> - It's OK to include any immutable, non-generated field in the hashcode.

Notice what the three principles have in common. All that matters is **immutability across
the object's lifetime**. A field that changes — because it was generated late, or because
the domain lets it change — cannot be in a hash.

## The recommendation: a natural key

> We therefore recommend identifying a natural key for each entity, that is, a combination
> of fields that uniquely identifies an instance of the entity, from the perspective of the
> data model of the program. The natural key should correspond to a unique constraint on
> the database, and to the fields which are included in `equals()` and `hashCode()`.

The guide's own example, which is the shape to copy:

```java
@Entity
class Book {

    @Id @GeneratedValue
    Long id;

    @NaturalId
    @Basic(optional=false)
    String isbn;

    String getIsbn() {
        return isbn;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof Book                   // check type with instanceof, not getClass()
            && ((Book) other).getIsbn().equals(isbn);  // compare natural ids
    }
    @Override
    public int hashCode() {
        return isbn.hashCode();  // hashcode based on the natural id
    }
}
```

Three things to take from it, and the two comments in the guide's own source are the
important ones.

**`instanceof`, not `getClass()`.** The argument may be a proxy, whose class is a generated
subclass. A `getClass()` comparison is then false for two references to the same row.

**Accessor, not field.** `((Book) other).getIsbn()` rather than `((Book) other).isbn`. A
proxy holds no state in its own fields; the accessor triggers initialisation and returns the
real value. Reading the field directly gives `null`.

**`@NaturalId` and the `equals` agree.** They are two statements of the same fact, and
`@NaturalId` also gives you `session.byNaturalId(Book.class).using(…)` as a lookup path.

## Why `Set` made this your problem

This all became load-bearing the moment you chose `Set` for a collection
(**[10](10-collection-types.md)**). The *Introduction* is candid about the trade:

> The catch associated with using a set is that we must carefully ensure that `Book` has a
> high-quality implementation of `equals()` and `hashCode()`. Now, that's not necessarily a
> bad thing, since a quality `equals()` is independently useful. […] But what if we used
> `Collection` or `List` instead? Then our code would be much less sensitive to how
> `equals()` and `hashCode()` were implemented.

So there is a real choice here, and it is between two obligations rather than between right
and wrong: `Set` plus a sound `equals`/`hashCode`, or `List`/`Collection` on the inverse
side of a one-to-many and less sensitivity to them. What is *not* available is `Set` with a
careless `equals`.

## Gotchas

**A `StackOverflowError` from a log line is this bug.** The stack trace is a repeating pair
of `toString` frames. Recognise it and go straight to the entity.

**`toString` on a lazy collection initialises it — or throws.** Either a query you did not
mean to run, or a `LazyInitializationException` from a logger. [Topic 10 · Lazy-loading pitfalls](../10-lazy-loading/README.md)
owns the second.

**A hash over a mutable field breaks silently.** Changing a book's title after it went into
a `HashSet` keyed on the title puts it in the wrong bucket. Hibernate's first principle
exists for exactly this.

**`equals` using `getClass()` fails for proxies.** Two references to the same row compare
unequal because one is `Book` and the other is a generated subclass. Use `instanceof`.

**`equals` reading the other object's fields directly fails for proxies.** The fields are
empty. Use the accessor. This is the half of the rule people forget, because the
`instanceof` half is better known.

**Symmetry breaks across an inheritance hierarchy with `instanceof`.** If `Ebook extends
Book`, `book.equals(ebook)` and `ebook.equals(book)` can disagree unless the check is
written carefully. Hibernate's advice to use `instanceof` is aimed at proxies; for a real
hierarchy, base the comparison on the natural key and the root type.

**Two different natural keys for the same conceptual entity is a modelling error, not an
`equals` problem.** If you cannot name a combination of fields that identifies the instance,
that is information — see **[15b](15b-no-natural-key-and-lombok.md)**.

**Jackson and `toString` are separate problems with the same cause.** Fixing `toString` does
not fix JSON serialisation — see **[16](16-serialising-an-entity-graph.md)**.

## Interview questions

**★ Why does `toString` on a bidirectional association cause a `StackOverflowError`?**
Because each side prints the other. The parent's `toString` renders its collection, which
calls each child's `toString`, which renders its parent, and so on until the stack is
exhausted. It is entirely a Java problem — no database involved — but it only appears on
entities because bidirectional references are unusual elsewhere. The fix is that `toString`
must not touch associations: print scalar fields and, at most, an association's identifier
read from the owning side's field.

**★ What else can `toString` do wrong on an entity?**
Trigger a fetch. Rendering a lazy collection initialises it, so a debug log line becomes a
query, and one inside a loop becomes a query per iteration. If the persistence context has
already closed, the same line throws instead — which means a logging statement can be the
thing that fails a request. Both are avoided by the same rule: do not touch associations.

**★ What is wrong with `hashCode` based on a generated id?**
The id does not exist until the entity is persisted, so an entity added to a `HashSet`
before the insert is hashed one way and hashes differently afterwards. It stays in its
original bucket, so `contains` returns false for an object physically inside the set.
Hibernate's documentation advises against including any database-generated field in the hash
code for exactly this reason, and against mutable fields for the analogous reason — the
common thread is that a hash may only be built from values that never change.

**★ What does Hibernate recommend instead?**
Identifying a natural key — a combination of fields that uniquely identifies the instance
from the program's point of view, backed by a unique constraint in the database — and basing
`equals` and `hashCode` on that. An ISBN for a book, a registration number for a person.
Marking it `@NaturalId` states the same fact to Hibernate and gives you a natural-id lookup
API as a side benefit.

**★ Why must `equals` use `instanceof` rather than `getClass()`, and what is the second
half of that rule?**
Because the argument may be a proxy: a lazy association holds a generated subclass of the
entity, so a `getClass()` comparison returns false for two references to the same row. The
second half, which Hibernate's documentation states in the same sentence and which is more
often missed, is that you must read the other object's state through its accessor methods
rather than its fields — a proxy's own fields are empty, so direct field access reads null.

**★ Does choosing `Set` for a collection commit you to anything?**
Yes: to a sound `equals` and `hashCode` on the element type, because every add, remove and
contains routes through them. Hibernate's documentation names this as the catch of using a
set, and notes that a `List` or `Collection` makes your code much less sensitive to how they
are implemented — which is part of why its recommendation softened from insisting on `Set`.
The choice is between two obligations, not between a right and a wrong answer.

---

← Prev: [14b · Inspecting initialization](14b-inspecting-initialization.md) · Index: [Relationships and fetch types](README.md) · Next → [15b · No natural key, and Lombok](15b-no-natural-key-and-lombok.md)
