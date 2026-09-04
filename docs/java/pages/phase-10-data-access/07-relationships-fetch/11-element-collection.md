---
title: "@ElementCollection is for values with no identity — the right answer when the child is a fact about the parent, and the wrong one the moment it needs a column of its own"
sidebar_label: "11 · @ElementCollection"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 javadocs for `@ElementCollection`
> ([.../elementcollection](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/elementcollection))
> and `@Embeddable`
> ([.../embeddable](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/embeddable)),
> the Hibernate ORM 7.4 *Introduction* §3.24 *Collections mapped to a separate table*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Hibernate ORM 7.4 *User Guide* §3.9.7 *@ElementCollection* and §31.4
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Everything so far has been about associations between entities — things with their own
identity, their own lifecycle, their own primary key. `@ElementCollection` is the other
kind of collection: a set of *values* that belong entirely to one parent row and have no
independent existence. A book's tags. A user's phone numbers. The distinction is whether
the thing has an identity of its own, and getting it wrong in either direction is
expensive.**

## The mapping

```java
@Entity
public class Book {

    @Id @GeneratedValue
    private Long id;

    @ElementCollection
    @CollectionTable(name = "book_topic",
                     joinColumns = @JoinColumn(name = "book_id"))
    @Column(name = "topic", nullable = false)
    private Set<String> topics = new HashSet<>();
}
```

```sql
CREATE TABLE book_topic (
    book_id bigint NOT NULL REFERENCES book (id),
    topic   text   NOT NULL,
    PRIMARY KEY (book_id, topic)
);
```

An auxiliary table, a foreign key back to the owner, and a column per value. There is no
`Topic` entity, no `topic.id`, and no way to reach a topic except through its book.

Elements may be **basic types** (`String`, `int`, an enum, `Instant`) or **embeddables**:

```java
@Embeddable
public record PhoneNumber(String countryCode, String number) {}

@ElementCollection
@CollectionTable(name = "person_phone", joinColumns = @JoinColumn(name = "person_id"))
private Set<PhoneNumber> phones = new HashSet<>();
```

An `@Embeddable` has no `@Id`. Two `PhoneNumber`s with the same fields *are* the same
phone number — that is exactly what "no identity" means.

## `@Column(nullable = false)` is not optional

This is the most valuable detail in the whole chunk and it is easy to skip. The 7.4
*Introduction* walks through it:

> Consider the following very simple mapping:
>
> ```java
> @ElementCollection
> Set<String> topics;
> ```
>
> Hibernate would generate the following DDL:
>
> ```sql
> create table Book_topics (
>     Book_isbn varchar(255) not null,
>     topics varchar(255)
> )
> ```
>
> Here, there's no `not null` constraint on one of the columns. As a result, Hibernate
> cannot add a primary key to the table. This is not a great data model.

Add `@Column(nullable = false)` and the guide shows the improvement: the value column
becomes `not null` and the table gains `primary key (Book_isbn, topics)`.

**A table with no primary key is not a table you want in a relational database.** It cannot
be replicated by some tools, it has no natural unique index, and it permits exact duplicate
rows. One annotation fixes it. Write it.

The trade the guide names: *"with this mapping we can't have `null` as an element of our
`Set`. But we can't think of a good reason why you might want that or what it would even
mean for a set to contain `null`."*

## How it behaves — value semantics all the way down

**The whole collection belongs to the parent.** There is no cascade element on
`@ElementCollection` because there is nothing to cascade to — the values are part of the
parent's state. Deleting the parent deletes them. Removing one from the collection deletes
its row. Both are automatic.

**Values cannot be shared.** Two books cannot reference "the same" topic row; each has its
own. If you want shared, referenceable topics, you want a `Topic` entity and a
many-to-many — or better, a link entity.

**Values cannot be queried independently as objects.** `SELECT t FROM Topic t` does not
exist because `Topic` does not exist. You can query them through the owner in JPQL
(`SELECT b FROM Book b JOIN b.topics t WHERE t = :topic`), which is often enough.

**The fetch default is `LAZY`.** Same as the collection associations. Leave it.

## When it is the right answer

The test is a question about identity: **would you ever want to point at one of these
from somewhere else, or track its history?**

Right for `@ElementCollection`:

- a book's topic tags, where a tag is just a string attached to a book;
- a user's phone numbers, where the number is meaningful only as that user's;
- a product's dimensions in several units, computed and stored;
- an order's snapshot of the delivery address at the time of ordering — deliberately a
  copy, not a reference to a mutable `Address` entity.

That last one is worth pausing on. Copying a value so it cannot change under you is a
*feature*, and it is one of the strongest arguments for an embeddable element collection.

Wrong for `@ElementCollection`:

- a tag you want to rename globally, list, count usage of, or attach a colour to;
- anything an audit log or another table must reference;
- anything with a lifecycle: created, approved, archived.

## When it is the wrong answer, and how you find out

Hibernate's *Introduction* does not disguise its opinion:

> `@ElementCollection` is one of our least-favorite features of JPA. Even the name of the
> annotation is bad.

and gives the concrete reason:

> When — inevitably — we find that we need to add a fourth column to that table, our Java
> code must change completely. Most likely, we'll realize that we need to add a separate
> entity after all. So this mapping isn't very robust in the face of minor changes to our
> data model.

This is the same prediction it makes about `@ManyToMany` in
**[7b](07b-model-the-join-table.md)**, and it fails the same way. The migration out is
worse here, though: with `@ManyToMany` the join table already exists and you are mostly
changing Java. With `@ElementCollection`, the auxiliary table has a composite key made of
the owner's key and the value, so promoting it to an entity means adding a surrogate key
column and rewriting every reference.

**So the decision costs more later than it looks like it does now.** Use it where you are
confident the value is a value.

## Efficiency, and the `Set`/`List` choice again

From the 7.4 *User Guide*'s best-practice chapter:

> Embeddable collections (`@ElementCollection`) are unidirectional associations, hence
> `Set`s are the most efficient, followed by ordered `List`s, whereas bags (unordered
> `List`s) are the least efficient.

The reasoning is **[10b](10b-what-a-list-costs.md)**'s: an element collection is an owned
collection, so a bag has no per-row identity and modifications become delete-all-and-
reinsert. A `Set` gives identity through the value itself; an `@OrderColumn` gives it
through the index.

An ordered element collection therefore looks like this:

```java
@ElementCollection
@CollectionTable(name = "checklist_step", joinColumns = @JoinColumn(name = "checklist_id"))
@OrderColumn(name = "step_order")
@Column(name = "description", nullable = false)
private List<String> steps = new ArrayList<>();
```

And a map, using the annotations from **[10](10-collection-types.md)**:

```java
@ElementCollection
@CollectionTable(name = "product_attribute", joinColumns = @JoinColumn(name = "product_id"))
@MapKeyColumn(name = "attribute_name")
@Column(name = "attribute_value", nullable = false)
private Map<String, String> attributes = new HashMap<>();
```

`@MapKeyColumn` is legal here because an element collection owns its columns.

## Gotchas

**Without `@Column(nullable = false)` the generated table has no primary key.** Hibernate's
own documentation walks through this. It is one annotation and it is the difference between
a reasonable table and a bad one.

**There is no `cascade` and no `orphanRemoval` element, and you do not need them.** Values
are part of the parent. Removing one deletes its row automatically; deleting the parent
deletes all of them.

**Arrays are not supported.** The *Introduction*: *"we shouldn't use an array here, since
array types can't be proxied, and so the JPA specification doesn't even say they're
supported. Instead, we should use `Set`, `List`, or `Map`."*

**An `@Embeddable` element needs `equals`/`hashCode`.** Especially in a `Set`. A `record`
gives you both for free and is the natural shape for a value type — one of the better
reasons to use records in an entity model.

**A mutable `@Embeddable` in a `Set` breaks the same way a mutable entity does.** If you
mutate an element in place, its hash changes and the set loses it. Prefer immutable
embeddables — another argument for `record`.

**Migrating an element collection to an entity is a bigger job than migrating a
`@ManyToMany`.** The auxiliary table's key is composite over the owner and the value, so
you need a new surrogate key column, a backfill, and a change to every foreign key that
should now point at it.

**An `@ElementCollection` of enums stores whatever `@Enumerated` says.** The default is
`ORDINAL`, which stores a position that shifts when someone reorders the enum. Use
`@Enumerated(EnumType.STRING)` — the same rule as for any enum column, and easier to
overlook inside a collection mapping.

**`@CollectionTable` defaults exist but are worth overriding.** The default table name is
derived from the owner and the attribute; the default join column from the owner's entity
name and primary key. Both are readable and neither is stable against a rename.

## Interview questions

**★ When do you use `@ElementCollection` instead of `@OneToMany`?**
When the elements are values rather than entities — they have no identity of their own, no
independent lifecycle, and nothing else will ever reference them. A book's tags, a person's
phone numbers, an order's snapshot of a delivery address. The operational test is whether
you would ever want to point at one of them from somewhere else or track its history. If
yes, it is an entity and needs a `@OneToMany`; if no, it is a value.

**★ What is the one annotation people forget on an `@ElementCollection`, and why does it
matter?**
`@Column(nullable = false)` on the value. Without it, the generated table has a nullable
value column, which means Hibernate cannot give the table a primary key — its own
documentation walks through exactly this and calls the result "not a great data model". A
table with no primary key allows duplicate rows and has no natural unique index. The cost
is that `null` cannot be an element, which is not a meaningful thing for a set of values
anyway.

**★ Why is there no `cascade` on `@ElementCollection`?**
Because there is nothing to cascade to. Cascade propagates entity lifecycle operations to
other entities; element-collection contents are not entities, they are part of the owner's
state. Removing an element deletes its row, and deleting the owner deletes all of them —
automatically, with no configuration, because that is what "value" means.

**★ Hibernate's documentation calls `@ElementCollection` one of its least favourite JPA
features. Why?**
Because the mapping is brittle against ordinary schema evolution. The moment the auxiliary
table needs another column — a timestamp, a flag, a source — there is no Java type to put
it on and the whole thing has to become an entity, which is a disruptive change. The same
criticism it makes of `@ManyToMany`, and worse here, because the auxiliary table's key is
composite over the owner and the value, so promotion requires adding a surrogate key and
backfilling it.

**★ Should an element collection be a `Set` or a `List`?**
`Set` unless order is genuinely part of the data. An element collection is an owned
collection, so a bag — a `List` with no `@OrderColumn` — has no per-row identity and
Hibernate falls back to deleting and reinserting the whole collection when it changes. The
best-practice chapter ranks them explicitly: sets are the most efficient, ordered lists
next, unordered lists least. If order matters, add `@OrderColumn`, which is legal here
because an element collection owns its columns.

**★ What type would you use for an embeddable element, and why?**
A `record` marked `@Embeddable`. Records are immutable and generate `equals` and
`hashCode` from their components, which is precisely what a value type needs — and it is
what a `Set` of embeddables requires to behave. A mutable embeddable in a set has the same
failure mode as a mutable key in a `HashMap`: change a field and the element is lost
inside its own collection.

---

← Prev: [10c · @OrderBy vs @OrderColumn](10c-orderby-versus-ordercolumn.md) · Index: [Relationships and fetch types](README.md) · Next → [12 · The fetch defaults](12-fetch-type-defaults.md)
