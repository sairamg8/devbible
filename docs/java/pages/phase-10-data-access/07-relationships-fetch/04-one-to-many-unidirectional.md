---
title: "A @OneToMany with no @ManyToOne on the other side does not map the foreign key you were thinking of — by default it invents a third table"
sidebar_label: "4 · Unidirectional @OneToMany"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §3.21 *Unidirectional
> one-to-many*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Hibernate ORM 7.4 *User Guide* §3.8.2 *@OneToMany*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Write `@OneToMany` on a collection, put nothing on the other entity, and you have not
mapped `book.publisher_id`. Hibernate's documented default for that mapping is a
separate association table with two foreign keys — the same shape as a many-to-many.
The Hibernate 7.4 *Introduction* is unusually direct about it: "If you're new to
Hibernate, this is not the association mapping strategy you're looking for."**

## The mapping that surprises people

```java
@Entity
public class Publisher {

    @Id @GeneratedValue
    private Long id;

    private String name;

    @OneToMany(cascade = CascadeType.ALL)   // no mappedBy — and no @ManyToOne on Book
    private Set<Book> books = new HashSet<>();
}
```

`Book` has no `publisher` field at all. This compiles, starts, and works. The schema
Hibernate infers is **three** tables, not two:

```sql
CREATE TABLE publisher (id bigint PRIMARY KEY, name text);
CREATE TABLE book      (id bigint PRIMARY KEY, isbn text, title text);

CREATE TABLE publisher_books (               -- the table you did not ask for
    publisher_id bigint NOT NULL REFERENCES publisher (id),
    books_id     bigint NOT NULL REFERENCES book (id) UNIQUE
);
```

The `UNIQUE` on `books_id` is what makes it a one-to-many rather than a many-to-many: a
given book can appear in at most one publisher's collection. The relationship is
correct. The storage is not what a database person would have written.

The 7.4 *User Guide* states the behaviour without hedging: *"When using a unidirectional
`@OneToMany` association, Hibernate resorts to using a link table between the two joining
entities."* The *Introduction* agrees: *"By default, a unidirectional one-to-many
association maps to a separate association join table. It therefore more closely
resembles a many-to-many association than a many-to-one association."*

## Why the default is a join table and not a column

The reason is the asymmetry from **[1](01-two-models-one-foreign-key.md)**, applied
strictly.

Mapping annotations describe the table of the entity they are on. `Publisher.books` is
on `Publisher`, so by default it may only map things in `publisher`'s own storage. A
foreign key for this relationship has to live on `book` — a table this entity does not
map. So the provider does the only thing it can do using tables it is entitled to
create: it makes an association table it owns outright.

The alternative — reaching across and writing a column of another entity's table — is
possible, but it has to be asked for explicitly. That is `@JoinColumn`, and it is
**[4b · Mapping it to a real foreign key](04b-mapping-it-to-a-real-foreign-key.md)**.

## The removal behaviour that makes this expensive

The 7.4 *User Guide* describes what happens when you remove one element from a
unidirectional collection:

> Hibernate deletes all database rows from the link table (e.g. `Person_Phone`) that are
> associated with the parent `Person` entity and reinserts the ones that are still found
> in the `@OneToMany` collection.

Read that as a cost model. Removing one child from a collection of 500 is not one
`DELETE`. It is one `DELETE` covering 500 rows and then 499 `INSERT`s.

The reason is that the parent side cannot identify which link row to remove — the guide
says so for bags explicitly: *"Because the parent-side cannot uniquely identify each
individual child, Hibernate deletes all link table rows associated with the parent entity
and re-adds the remaining ones."* A `Set` of entities is better behaved than a `List`
here, which is one reason the guide's best-practice chapter says *"For unidirectional
collections, `Set`s are the best choice because they generate the most efficient SQL
statements"* — but the join-table indirection is still there.

Compare the bidirectional mapping, where the same guide notes that *"every element
removal only requires a single update (in which the foreign key column is set to
`NULL`)"*. That comparison is the whole argument for
**[5 · Bidirectional @OneToMany](05-one-to-many-bidirectional.md)**.

## The one case where unidirectional `@OneToMany` is right

Hibernate's *Introduction* names it, and only it:

> Suppose we have a `Comment` entity, which has many different "parents" — there can be
> comments on `Document`s, comments on `Issue`s, comments on `Request`s, and so on.
> These aren't many-to-many associations; each given `Comment` belongs to exactly one
> parent. But on the other hand, it doesn't make sense to add a field for each kind of
> parent entity to the `Comment` class. Nor does it make sense to add a foreign key
> column for each parent entity to the `COMMENTS` table. This is the only scenario in
> which we can imagine ourselves using a unidirectional one-to-many.

Here the join-table default is a feature. Each parent type gets its own association
table (`document_comments`, `issue_comments`, …), `Comment` stays free of parent-specific
fields, and no table grows a column per parent type.

```java
@Entity
public class Document {
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Comment> comments = new HashSet<>();
}

@Entity
public class Issue {
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Comment> comments = new HashSet<>();
}
```

Note what makes this work: nobody ever asks a `Comment` who its parent is. The moment
that requirement appears, this mapping stops being the right one and you are looking at
Hibernate's `@Any` mapping or separate comment entities per parent.

The guide's earlier editions went further than the current one. The *Introduction* notes:
*"Previous versions of this Guide advised against the use of these mappings completely."*
The advice softened; the recommendation did not.

## Gotchas

**The extra table appears silently at schema-export time, and never at all if Flyway owns
your schema.** With `ddl-auto: none` — the correct production setting — Hibernate does not
create `publisher_books`. It simply expects it to exist, and the application fails at
first use with a missing-relation error. The mapping mistake surfaces as a migration
mismatch, which sends people looking in the wrong place.

**Forgetting `mappedBy` is how most people arrive here.** The intended mapping was
bidirectional; the `@ManyToOne` exists on `Book`; the `mappedBy` was just left off the
collection. That is not "a bidirectional mapping missing a hint" — it is **two separate
associations**, one mapped as a column on `book` and one mapped as a join table, both
live at once. Two mappings, two sets of writes, and they can disagree.

**Two entities with unidirectional `@OneToMany` collections onto the same child type get
two association tables.** That is deliberate in the `Comment` case and accidental
everywhere else. If you find yourself with `publisher_books` and `series_books` both
pointing at `book`, ask whether `Book` should just have two `@ManyToOne` fields.

**A unidirectional `@OneToMany` cannot be filtered or paginated any more than a
bidirectional one can.** The join table adds a hop; it does not add a `WHERE` clause. If
the collection is large, neither shape is the answer — a repository query is.

**`@ElementCollection` looks similar and is not the same thing.** It also creates an
auxiliary table, but its contents are value types with no identity of their own. See
**[11 · @ElementCollection](11-element-collection.md)**.

**The association table has no surrogate key and no other columns.** The moment the
relationship needs an attribute of its own — a date, a role, a sequence number — this
mapping has to be replaced by a real entity. That is the same argument that applies to
`@ManyToMany`; see **[7b](07b-model-the-join-table.md)**.

## Interview questions

**★ What schema does a `@OneToMany` with no `mappedBy` and no `@JoinColumn` produce?**
Three tables: the two entity tables plus an association table holding both foreign keys,
with a unique constraint on the child's key so a child can belong to at most one parent.
Hibernate's documentation states this default directly and notes it resembles a
many-to-many mapping more than a many-to-one. It is almost never what the developer
intended, because the mental model was "one foreign-key column on the child table".

**★ Why can't the annotation just map the child's foreign-key column by default?**
Because the annotation is on the parent entity, and by default an entity's mapping
annotations describe the parent's own storage. The foreign key for a one-to-many lives on
the child's table, which the parent does not map. Reaching across to another entity's
table is possible, but has to be requested explicitly with `@JoinColumn`.

**★ Why is removing one element from a unidirectional collection expensive?**
Because the parent side cannot identify the individual link row to delete, so Hibernate
deletes every link row for that parent and reinserts the ones that remain. Removing one
child from a collection of 500 becomes a delete of 500 rows and 499 inserts. The
bidirectional mapping avoids this entirely: the child owns the key, so removal is a single
update setting one column to null — or a single delete if orphan removal is on.

**★ Is there a legitimate use for a unidirectional `@OneToMany`?**
One, and Hibernate's introduction names it: a child entity with several unrelated parent
types — comments on documents, issues and requests. Adding a field per parent type to the
child, or a nullable foreign-key column per parent type to its table, is worse than
letting each parent own its own association table. Outside that shape, use a bidirectional
many-to-one.

**★ Someone has a `@ManyToOne` on the child *and* a `@OneToMany` on the parent with no
`mappedBy`. What is actually mapped?**
Two independent associations over the same conceptual relationship. The `@ManyToOne` maps
a foreign-key column on the child table and is the owner of that. The `@OneToMany` maps an
association table and is the owner of that. Both are written, both are read, and they can
disagree — a child can have its column set to one parent while appearing in another
parent's link table. Adding `mappedBy` to the collection collapses the two into the one
mapping that was intended, and drops the association table.

---

← Prev: [3 · @ManyToOne](03-many-to-one.md) · Index: [Relationships and fetch types](README.md) · Next → [4b · @JoinColumn on the collection](04b-mapping-it-to-a-real-foreign-key.md)
