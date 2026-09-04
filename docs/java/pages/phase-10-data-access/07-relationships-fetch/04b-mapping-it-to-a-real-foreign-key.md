---
title: "@JoinColumn on the collection removes the join table but not the underlying problem — the parent still owns a column on the child's table"
sidebar_label: "4b · @JoinColumn on the collection"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 `@JoinColumn` javadoc
> ([.../joincolumn](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/joincolumn)),
> the Hibernate ORM 7.4 *User Guide* §25 *Envers → @OneToMany with @JoinColumn* and
> §31.4 *Associations*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Adding `@JoinColumn` to a unidirectional `@OneToMany` switches the physical mapping
from an association table to a real foreign-key column on the child's table. That is a
genuine improvement and it is still not the bidirectional mapping. The column lives on
`book`; the attribute that owns it lives on `Publisher`. Everything awkward about this
mapping follows from that split.**

## The mapping

```java
@Entity
public class Publisher {

    @Id @GeneratedValue
    private Long id;

    @OneToMany(cascade = CascadeType.ALL)
    @JoinColumn(name = "publisher_id")     // the column lives on BOOK
    private Set<Book> books = new HashSet<>();
}
```

`Book` still has no `publisher` field. The Jakarta Persistence `@JoinColumn` javadoc
covers this case explicitly: for a unidirectional one-to-many using the foreign-key
strategy, the column resides in **the target entity's table**. Hibernate's Envers chapter
states the consequence from the other end: *"When a collection is mapped using these two
annotations, Hibernate doesn't generate a join table."*

Two tables, one foreign key:

```sql
CREATE TABLE book (
    id           bigint PRIMARY KEY,
    isbn         text NOT NULL UNIQUE,
    title        text NOT NULL,
    publisher_id bigint REFERENCES publisher (id)
);
```

## The split that causes everything else

**`Book` does not map `publisher_id`.** The column is in `book`'s row; the mapping
attribute that writes it is `Publisher.books`, on a different entity.

That single fact produces three consequences, and it is worth deriving each rather than
memorising them.

**The child's `INSERT` cannot carry the key.** Hibernate generates a table's insert from
the attributes that entity maps. `publisher_id` is not one of `Book`'s attributes, so it
is not in the statement. The key has to be written on behalf of the collection, after the
row exists.

> ⚠️ I could not confirm the exact generated statement sequence for this case against a
> primary Hibernate 7.4 source. What the documentation does establish is the ownership
> split above; the extra write follows from it, and Hibernate has historically inserted
> the child row with the key unset and then updated it. Treat the shape as certain and
> the precise statement count as "more than the bidirectional mapping needs".

**`nullable = false` is hard to satisfy.** If `publisher_id` is `NOT NULL`, the child row
cannot be inserted at all without its key, and the key is exactly what the child's insert
lacks. Expect a constraint violation at flush. A `NOT NULL` foreign key is a strong
signal that the child depends on the parent, which is a strong signal for the
bidirectional mapping, where the child's `@ManyToOne` supplies the key in its own insert.

**Removal sets the column to `NULL` rather than deleting.** Taking a book out of
`publisher.getBooks()` makes it parentless, not gone — unless `orphanRemoval = true`, in
which case the row is deleted. Same behaviour as the bidirectional case, and the same
choice to make; see **[9 · Orphan removal](09-orphan-removal.md)**.

## The hybrid: read from the child, write from the collection

Hibernate documents a third arrangement, and it is the pragmatic answer when you are
stuck with a collection-owned key but need to navigate from the child:

```java
@Entity
public class Publisher {
    @OneToMany(cascade = CascadeType.ALL)
    @JoinColumn(name = "publisher_id")               // owns the column
    private Set<Book> books = new HashSet<>();
}

@Entity
public class Book {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "publisher_id",
                insertable = false, updatable = false)   // read-only view of it
    private Publisher publisher;
}
```

The guide's own description of this shape: *"`@OneToMany` with `@JoinColumn` on the one
side, and `@ManyToOne` and `@JoinColumn(insertable = false, updatable = false)` on the
many side. Such relations are, in fact, bidirectional, but the owning side is the
collection."*

`insertable = false, updatable = false` is what makes the mapping legal. Two attributes
now map the same column, and exactly one of them may write it. Drop those flags and you
have two writers for one column — Hibernate rejects that at startup, which is the correct
outcome.

What you get: navigation in both directions, and `book.getPublisher()` works.
What you do not get: the bidirectional mapping's write efficiency, because the collection
is still the writer.

## When to use which, decided in one table

| You have | Use |
|---|---|
| A child that cannot exist without its parent | bidirectional: `@ManyToOne` + `@OneToMany(mappedBy)` |
| A child with several unrelated parent types | unidirectional `@OneToMany`, join table, no `@JoinColumn` |
| A legacy schema whose column you must not let the child write | the hybrid above |
| A child you never navigate upward from, on a schema you control | still bidirectional — it costs one field and saves statements |

The Hibernate 7.4 *User Guide*'s best-practice chapter is blunt about the ranking:
*"Bidirectional associations are usually a better choice because the `@ManyToOne` side
controls the association"*, and *"Unidirectional `List`s are less efficient than a
`@ManyToOne` association."*

## Gotchas

**Adding `@JoinColumn` to an existing unidirectional collection is a schema migration,
not an annotation tweak.** The mapping changes from association table to foreign key. Any
data already in `publisher_books` becomes unreachable, and a migration has to copy it
into `book.publisher_id` before the table is dropped.

**The column name default is not the one you want here.** Without an explicit `name`, the
default for a unidirectional one-to-many join column is derived from the owning entity
and the collection attribute, not from the child's perspective — so you get something like
`publisher_id` only by coincidence of naming. Write the name.

**Do not put `@JoinColumn` on a `@OneToMany(mappedBy = …)`.** That combination is
self-contradictory: `mappedBy` says "I map no column", `@JoinColumn` says "here is my
column". Pick one. If you want the child's column named explicitly, name it on the child's
`@ManyToOne`.

**Forgetting `insertable = false, updatable = false` in the hybrid fails at startup, and
that is the good outcome.** Two writable mappings for one column is ambiguous, and
Hibernate refuses it rather than picking one.

**The hybrid's read-only `@ManyToOne` is genuinely read-only.**
`book.setPublisher(other)` compiles and changes nothing, ever — the attribute is excluded
from both insert and update. This is the **[2b](02b-mappedby-and-the-silent-nothing.md)**
silent-nothing bug in a new costume, and it catches people who assume the `@ManyToOne` is
the owner because it usually is.

**`@JoinColumn` on the collection does not make the child aware of the parent.** In the
non-hybrid form there is still no `book.getPublisher()`. If you need it, you need either
the hybrid or a proper bidirectional mapping — adding a plain `@ManyToOne` without the
read-only flags gives you a second writer, not a getter.

## Interview questions

**★ What does `@JoinColumn` change on a unidirectional `@OneToMany`?**
The physical mapping strategy. Without it, the association is stored in a separate join
table; with it, the association is stored as a foreign-key column on the child's table —
the `@JoinColumn` javadoc says the column resides in the target entity's table for this
case, and Hibernate's documentation confirms it does not generate a join table. What does
not change is ownership: the parent's collection still owns the column, and the child
entity still does not map it.

**★ Why is a `NOT NULL` foreign key awkward with this mapping?**
Because the child's insert statement is generated from the child's own mapped attributes,
and the foreign key is not one of them — it belongs to the parent's collection. So the row
has to be inserted before the key can be written, and a `NOT NULL` constraint rejects
that insert. If the domain says the child cannot exist without a parent, that is a reason
to use the bidirectional mapping, where the child's `@ManyToOne` supplies the value in the
same insert.

**★ Explain `@ManyToOne @JoinColumn(insertable = false, updatable = false)`.**
It maps an attribute onto a column that some *other* attribute already owns, as a
read-only view. It exists because JPA will not accept two writable mappings for the same
column. In the documented hybrid, the parent's `@OneToMany @JoinColumn` owns the column
and the child's `@ManyToOne` is the read-only companion, giving navigation from the child
without a second writer. The catch is that assignments to that attribute are silently
ignored, because it is excluded from every insert and update.

**★ How would you migrate from a unidirectional join-table mapping to a bidirectional
foreign-key one?**
Two steps and they must be in this order. First a schema migration: add the foreign-key
column to the child table, backfill it from the association table, add the constraint,
then drop the association table. Only then change the mapping — add `@ManyToOne` with
`@JoinColumn` to the child and `mappedBy` to the parent's collection — and add the
`addChild`/`removeChild` helpers, because the mapping is now bidirectional and both sides
have to be kept in step.

---

← Prev: [4 · Unidirectional @OneToMany](04-one-to-many-unidirectional.md) · Index: [Relationships and fetch types](README.md) · Next → [5 · Bidirectional @OneToMany](05-one-to-many-bidirectional.md)
