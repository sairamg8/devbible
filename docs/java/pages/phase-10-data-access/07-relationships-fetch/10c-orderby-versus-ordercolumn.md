---
title: "@OrderBy adds an ORDER BY to the query; @OrderColumn stores a position in a column — one reads an ordering, the other maintains one"
sidebar_label: "10c · @OrderBy vs @OrderColumn"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 javadocs for `@OrderBy`
> ([.../orderby](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/orderby))
> and `@OrderColumn`
> ([.../ordercolumn](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/ordercolumn)),
> the Hibernate ORM 7.4 *User Guide* §3.9.12 *Ordered Lists*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the Hibernate ORM 7.4 *Introduction* §9.12 *Ordered and sorted collections and map
> keys*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Two annotations with confusingly similar names doing genuinely different jobs.
`@OrderBy` derives an order from data that is already there. `@OrderColumn` stores the
order as data of its own. The first is free and read-only; the second costs a column and
maintenance, and is the only one that can express an order the data does not otherwise
imply.**

## `@OrderBy` — an `ORDER BY` clause on the collection's query

```java
@OneToMany(mappedBy = "publisher")
@OrderBy("title ASC, id ASC")
private List<Book> books = new ArrayList<>();
```

When Hibernate loads the collection it appends the ordering to the `SELECT`. No column is
added, nothing is maintained, and the order is derived from the children's own attributes.

Three details from the documentation:

- **It takes entity attributes, with optional directions.** The 7.4 *User Guide*: *"The
  `@OrderBy` annotation can take multiple entity properties, and each property can take an
  ordering direction too (e.g. `@OrderBy("name ASC, type DESC")`)."*
- **With no argument it orders by the child's primary key.** *"If no property is specified
  (e.g. `@OrderBy`), the primary key of the child entity table is used for ordering."*
- **It works on the unowned side, which `@OrderColumn` does not.** The *Introduction*'s
  rule: use `@OrderColumn`/`@MapKeyColumn` with an `@ElementCollection`, an owned
  `@ManyToMany` or an owned `@OneToMany`, but use `@OrderBy`/`@MapKey` when it is an
  unowned `@ManyToMany` or `@OneToMany`.

⚠️ **`@OrderBy` names an attribute, not a column.** `@OrderBy("publishedAt DESC")` refers
to `Book.publishedAt`. It is JPQL-flavoured, not SQL. For a genuinely SQL ordering —
ordering by a function, a collation, a computed expression — Hibernate provides
`@SQLOrder`, listed in the *Introduction*'s table as specifying *"a fragment of SQL used to
order the collection"* and marked as non-standard.

**Ordering is not sorting.** The *Introduction* separates them: *"an ordered collection is
one with an ordering maintained in the database, and a sorted collection is one which is
sorted in Java code."* `@OrderBy` is ordering. `@SortNatural` and `@SortComparator` on a
`SortedSet` are sorting — see **[10 · Collection types](10-collection-types.md)**.

## `@OrderColumn` — a stored position

```java
@ElementCollection
@CollectionTable(name = "checklist_step",
                 joinColumns = @JoinColumn(name = "checklist_id"))
@OrderColumn(name = "step_order")
@ListIndexBase(1)
@Column(name = "description", nullable = false)
private List<String> steps = new ArrayList<>();
```

Now the table has a `step_order` column holding each element's index, and the list order
survives a reload because it is stored. Two documented details:

- **The default column name** is derived from the attribute name with `_ORDER` appended.
  Write it explicitly anyway.
- **`@ListIndexBase`** — a Hibernate annotation — *"may be used to choose between 0-based
  and 1-based indexing on the database side"*. Java's list index stays 0-based either way;
  this only changes what is stored.

**The cost is index maintenance.** Inserting at position 0 renumbers everything after it.
Removing element 3 renumbers everything after it. The number of statements depends on where
you touch the list, which is not a property most collections should have.

## The distinction that settles which one to use

Ask: **is the position of an element a fact about the data, or a preference about display?**

**A fact about the data** → `@OrderColumn`. A checklist whose steps must be performed in
order. A playlist. A set of survey questions with a fixed sequence. There is nothing in the
elements themselves that implies the order — you could not derive "step 3 comes after step
2" from the step's own attributes. The order has to be stored because it *is* information.

**A preference about display** → `@OrderBy`, or a query with `ORDER BY`, or sorting in the
service layer. Books alphabetically by title, comments newest-first, line items by SKU. The
order is derivable from the data at any time, so storing it would be duplicating
information that is already there — and it would go stale the moment a title changed.

Most collections are the second case. `@OrderColumn` is a specialist tool that gets used
where `@OrderBy` was meant.

## Side-by-side

| | `@OrderBy` | `@OrderColumn` |
|---|---|---|
| Standard | JPA | JPA |
| Extra column | no | **yes** |
| Order derived from | the elements' own attributes | a stored index |
| Cost of an insert in the middle | none | renumber the tail |
| Order survives an attribute change | it *follows* the change | no — the stored index wins |
| Allowed on `mappedBy` sides | **yes** | no (illegal on `@ManyToMany(mappedBy)`) |
| Can express an arbitrary order | no | **yes** |
| Effect on collection identity | none | gives bag elements per-row identity |

That last row is easy to miss and it matters: an `@OrderColumn` turns a bag into an ordered
list, and the guide's ranking puts ordered lists above bags for efficiency —
**[10b](10b-what-a-list-costs.md)**.

## The third option people forget

Neither. Map the collection as a `Set` and sort where you present it:

```java
List<Book> sorted = publisher.getBooks().stream()
        .sorted(comparing(Book::getTitle))
        .toList();
```

Or, better for anything of size, do not map the collection and let the query order it:

```java
List<Book> books = bookRepository.findByPublisherId(id, Sort.by("title"));
```

That version orders in SQL, pages, filters, and never loads more than a page. `@OrderBy` on
a mapped collection does none of those things — it orders everything, after fetching
everything.

## Gotchas

**`@OrderBy` sorts what was fetched; it does not limit it.** A collection of 50,000 books
ordered by title is still 50,000 books in memory. The ordering is not a pagination
mechanism.

**`@OrderColumn` on the inverse side needs both sides kept in step.** The 7.4 *User Guide*
is explicit: to retain the order of a `@OneToMany(mappedBy = …)` you must apply
`@OrderColumn` explicitly, *"in addition to that, it is important that both sides of the
relationship, the `@OneToMany(mappedBy = …)` and the `@ManyToOne`, must be kept in sync.
Otherwise, the element position will not be updated accordingly."*

**`@OrderColumn` on a `@ManyToMany(mappedBy = …)` is illegal.** Documented as such. Use
`@OrderBy`.

**A stored index and a natural ordering can disagree.** Once an index column exists, it is
authoritative. If someone also sorts by `createdAt` in a report, the two views of "the
order" differ, and nobody will notice until they do.

**An index column with gaps or duplicates is corrupt data with no constraint stopping it.**
Direct SQL updates, a failed batch, or a bug in an ordering helper can leave the column
inconsistent. There is no `CHECK` that will catch it. If order is genuinely data, a unique
constraint on `(parent_id, order_column)` is worth adding.

**`@OrderBy` with no argument orders by primary key, which is not "insertion order".** With
a sequence generator using `allocationSize` blocks, ids are not contiguous and, across
concurrent sessions, not even monotonic with respect to wall-clock insertion. If you want
insertion order, store a timestamp and order by it.

**`@OrderBy("someTransientThing")` fails at startup, and that is the good case.** Ordering
by an attribute that is not persistent cannot be translated to SQL.

## Interview questions

**★ What is the difference between `@OrderBy` and `@OrderColumn`?**
`@OrderBy` appends an `ORDER BY` clause to the query that loads the collection, deriving the
order from attributes the elements already have. It adds no column and costs nothing to
maintain. `@OrderColumn` adds a column that stores each element's position, so the order is
data in its own right and survives regardless of the elements' attributes — at the cost of
renumbering the tail whenever you insert or remove in the middle.

**★ Which one would you use for a to-do checklist whose steps have a fixed sequence?**
`@OrderColumn`. The order is a fact about the data and cannot be derived from the steps
themselves — nothing about the text of step three implies it comes after step two. That is
exactly the case where the position has to be stored. For anything where the order is
derivable — alphabetical, by date, by price — `@OrderBy` or a query's `ORDER BY` is right,
because storing a derivable order duplicates information and goes stale.

**★ Can you use `@OrderColumn` on the inverse side of a bidirectional association?**
Not on a `@ManyToMany(mappedBy = …)`, where the documentation says it is illegal. On a
`@OneToMany(mappedBy = …)` it is permitted but comes with a condition the guide spells out:
you must apply it explicitly, and you must keep both sides of the relationship in sync, or
the stored positions will not be updated. In general the unowned side is not responsible
for column mappings, which is why `@OrderBy` is the annotation that belongs there.

**★ Does `@OrderBy` help with a large collection?**
No, and it can encourage the opposite. It orders everything that was fetched, after it has
all been fetched — it is not a `LIMIT`. If a collection is large enough that you care about
its order for performance reasons, the mapped collection is the wrong tool and a repository
query with a `Sort` and a `Pageable` is the right one.

**★ What is `@SQLOrder` for?**
Ordering by something JPQL cannot express — a SQL function, a specific collation, a
computed expression. `@OrderBy` takes entity attributes and is translated by the provider;
Hibernate's `@SQLOrder` takes a raw SQL fragment instead. It is non-standard, so it ties
that mapping to Hibernate, which is a fair trade when the ordering genuinely needs SQL and
not otherwise.

---

← Prev: [10b · What a List costs](10b-what-a-list-costs.md) · Index: [Relationships and fetch types](README.md) · Next → [11 · @ElementCollection](11-element-collection.md)
