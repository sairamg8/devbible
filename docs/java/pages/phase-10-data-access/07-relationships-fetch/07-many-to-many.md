---
title: "@ManyToMany maps a join table you never see — which is fine right up until the relationship needs a column of its own"
sidebar_label: "7 · @ManyToMany"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 javadocs for `@ManyToMany`
> ([.../manytomany](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/manytomany))
> and `@JoinTable`
> ([.../jointable](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/jointable)),
> the Hibernate ORM 7.4 *Introduction* §3.20 *Many-to-many*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Hibernate ORM 7.4 *User Guide* §3.8.4 *@ManyToMany* and §31.4 *Associations*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**A many-to-many relationship has no home in either entity's table, so it gets a third
table with two foreign keys. `@ManyToMany` maps that table for you and hides it — no
entity, no Java type, no way to put anything else in it. That convenience is the whole
feature and also the whole problem, because association tables acquire extra columns
with striking regularity.**

## The mapping

```java
@Entity
public class Book {

    @Id @GeneratedValue
    private Long id;

    @ManyToMany
    @JoinTable(name = "book_author",
               joinColumns        = @JoinColumn(name = "book_id"),
               inverseJoinColumns = @JoinColumn(name = "author_id"))
    private Set<Author> authors = new HashSet<>();      // OWNING
}

@Entity
public class Author {

    @Id @GeneratedValue
    private Long id;

    @ManyToMany(mappedBy = "authors")
    private Set<Book> books = new HashSet<>();          // INVERSE
}
```

```sql
CREATE TABLE book_author (
    book_id   bigint NOT NULL REFERENCES book (id),
    author_id bigint NOT NULL REFERENCES author (id),
    PRIMARY KEY (book_id, author_id)
);

CREATE INDEX book_author_author_id_idx ON book_author (author_id);
```

`joinColumns` points at the owning entity's table; `inverseJoinColumns` at the other. The
Hibernate *Introduction*'s table of `@JoinTable` members describes them exactly that way:
foreign key column mappings to the table of the owning side, and to the table of the
unowned side.

⚠️ **The composite primary key is yours to write.** It is what stops the same book/author
pair appearing twice. And the index on the *second* column is what makes
`author.getBooks()` fast — the composite primary key index serves lookups by `book_id`,
not by `author_id`.

## Owning and inverse, one more time

Neither side has an obvious claim, so you pick. Whichever side omits `mappedBy` owns the
join table and is the only side whose changes are written.

Everything from **[2b](02b-mappedby-and-the-silent-nothing.md)** applies with double
force here, because the collections look symmetric and are not. `author.getBooks().add(book)`
on the inverse side does nothing. The *Introduction* says it in one line: *"Remember, if
we wish to modify the collection we must change the owning side."*

So you still write the helper, and it goes on the owning side:

```java
// on Book — the owning side
public void addAuthor(Author author) {
    authors.add(author);
    author.getBooksInternal().add(this);
}

public void removeAuthor(Author author) {
    authors.remove(author);
    author.getBooksInternal().remove(this);
}
```

⚠️ **Choose the owning side by which direction you write from.** If your application adds
authors to books, `Book` should own it. If it assigns books to authors, `Author` should.
Getting this backwards means every write goes through the awkward direction.

## `@ManyToMany` never cascades `REMOVE`, and that is deliberate

```java
@ManyToMany(cascade = CascadeType.ALL)   // ⛔ do not
```

`CascadeType.ALL` includes `REMOVE`. On a many-to-many, deleting a `Book` would then
delete its `Author`s — and each of those authors may have written other books, whose rows
now reference deleted authors. One delete becomes a cascade through the whole graph.

The safe set is `{PERSIST, MERGE}`, and often nothing at all. Neither side of a
many-to-many owns the other's lifecycle; that is what "many-to-many" means. Full argument
in **[8b](08b-cascade-remove-and-the-hibernate-extras.md)**.

For the same reason **`orphanRemoval` is not permitted on `@ManyToMany`** — it is not an
element of the annotation. Removing a book from an author's collection means "this author
did not write this book", not "delete this book".

## The fetch default, and the sentence Hibernate rarely writes

The `@ManyToMany` javadoc: *"If not specified, defaults to `LAZY`."* Good default, leave
it alone. The *Introduction* is unusually forceful about the alternative:

> We don't usually map collections with `fetch=EAGER`, since that usually leads to poor
> performance and fetching of unnecessary data. But this is especially clear in the case
> of many-to-many associations. We don't much employ the word "never" when it comes to
> object/relational mappings, but here we will: never write `@ManyToMany(fetch=EAGER)`
> unless you're deliberately looking for trouble.

Why it is worse here than elsewhere: an eager many-to-many joins three tables and, in a
query returning many rows, produces a row count that is the product of both collections'
sizes. See **[13b · How it multiplies](13b-how-it-multiplies.md)**.

## `Set`, `List` or `Collection` — and here it changes the meaning

For a one-to-many the choice was mostly about `equals`/`hashCode`. For a many-to-many the
*Introduction* points out that it changes the semantics:

> A many-to-many association represented as a `Collection` or `List` may contain duplicate
> elements. However, as before, the order of the elements is not persistent. That is, the
> collection is a bag, not a set.

A `Set` matches the composite primary key you wrote above: a pair appears at most once.
A `List` does not, and it comes with the bag costs in
**[10b · What a `List` costs](10b-what-a-list-costs.md)**. **Use a `Set` for
`@ManyToMany`** unless you have a specific reason not to, and if you have that reason, you
probably want a real entity instead.

## The thing that will happen to this mapping

Hibernate's *Introduction* says it as a prediction, not a possibility:

> It tends to happen that a many-to-many association eventually turns out to be an entity
> in disguise. […] imagine that we needed to report the percentage contribution of each
> author to a book. That information naturally belongs to the association table. We can't
> easily store it as an attribute of `Book`, nor as an attribute of `Author`.

An association table with only two foreign keys is a rare thing in a mature schema. Sooner
or later it wants `added_at`, `role`, `sort_order`, `added_by`, `is_primary`. And
`@ManyToMany` has nowhere to put any of them, because there is no Java type representing a
row of that table.

The *Introduction*'s conclusion, and the 7.4 *User Guide*'s best-practice chapter agree:

> We can evade the disruption occasioned by such "discoveries" by simply avoiding the use
> of `@ManyToMany` right from the start. There's little downside to representing
> every — or at least almost every — logical many-to-many association using an
> intermediate entity.

> The `@ManyToMany` annotation is rarely a good choice because it treats both sides as
> unidirectional associations. For this reason, it's much better to map the link table.

That is **[7b · Model the join table](07b-model-the-join-table.md)**, and it is the
recommendation, not the fallback.

## Gotchas

**The index on the inverse foreign-key column is missing by default.** A composite
primary key `(book_id, author_id)` indexes lookups by `book_id`. Lookups by `author_id` —
which is what `author.getBooks()` does — get nothing. Add the second index explicitly.

**`mappedBy` names the attribute on the other entity, not the join table.**
`@ManyToMany(mappedBy = "authors")` on `Author.books` refers to `Book.authors`. Naming the
table, or naming the local field, is the most common typo here.

**`@JoinTable` on the inverse side is ignored at best and rejected at worst.** The inverse
side maps nothing, including the join table. Both `@JoinTable` and `mappedBy` on one field
is contradictory.

**Removing an element from an owned many-to-many can rewrite the whole join table if the
collection is a bag.** With a `List` and no `@OrderColumn`, Hibernate cannot identify the
row to delete and falls back to deleting all rows for that parent and reinserting the
survivors — the same behaviour documented for unidirectional bags. A `Set` avoids it.

**A self-referencing `@ManyToMany` needs both column names spelled out.** `User.friends`
mapping onto `user_friend(user_id, friend_id)` cannot default either column, because both
sides are the same entity.

**`@OrderColumn` on a `@ManyToMany(mappedBy = …)` is illegal.** Not ineffective —
illegal. The 7.4 *User Guide* says so explicitly; the unowned side maps no columns, so it
may not specify one. Use `@OrderBy` there instead.

**Deleting an entity on the inverse side leaves join-table rows behind unless the database
cascades.** JPA's cascade does not clean up an association table you do not own. Either
delete from the owning side, or put `ON DELETE CASCADE` on the join table's foreign keys
in the migration.

## Interview questions

**★ Where is a many-to-many relationship stored, and who owns it in JPA?**
In a third table holding one foreign key to each side, normally with a composite primary
key over both columns so a pair cannot repeat. In JPA, whichever side does not carry
`mappedBy` owns that table, and only that side's collection is consulted when writing.
Since neither entity's table holds the relationship, the choice of owner is yours — make
it the direction your application actually writes from.

**★ Why is `CascadeType.ALL` wrong on a `@ManyToMany`?**
Because `ALL` includes `REMOVE`, and in a many-to-many neither side owns the other's
lifecycle — that is the definition of the multiplicity. Deleting a book would delete its
authors, who may have written other books. The same reasoning is why `orphanRemoval` is not
even an element of `@ManyToMany`: taking an author out of a book's collection means the
association ended, not that the author should cease to exist.

**★ Why does Hibernate's documentation say "never" about `@ManyToMany(fetch = EAGER)`?**
Because it is the worst case of an already-bad idea. An eager collection is a fetch you
cannot decline at any call site, and a many-to-many needs three tables joined to satisfy
it. Combined with any other eager collection on the same entity, the result set becomes a
product of the collection sizes rather than a sum. The documentation is explicit that it
does not usually use the word "never" and is using it here.

**★ Should you use `Set` or `List` for a many-to-many, and why does it matter more here?**
`Set`. For a many-to-many the choice changes the semantics, not just the performance:
Hibernate's documentation notes that a `Collection` or `List` may contain duplicate
elements, so it is a bag rather than a set. A bag permits the same pair twice, which
contradicts the composite primary key on the join table, and it brings the delete-all-and-
reinsert behaviour when elements are removed.

**★ Why do Hibernate's own docs recommend avoiding `@ManyToMany` entirely?**
Two reasons they state separately. First, association tables almost always grow extra
columns — a contribution percentage, a role, a timestamp — and `@ManyToMany` has no Java
type in which to put them, so the discovery forces a disruptive remodelling. Second, the
best-practice chapter notes it treats both sides as unidirectional associations, which is
where the inefficient collection handling comes from. Mapping the link table as an entity
with two `@ManyToOne`s avoids both, and costs one small class.

**★ You delete an `Author` that is on the inverse side of a `@ManyToMany`. What happens to
the join-table rows?**
Nothing, unless something else removes them. JPA cascade operates on entities, and the
inverse side does not own the join table, so removing the author does not clear its rows.
You get orphaned rows referencing a deleted author, or a foreign-key violation on the
delete itself — which is the better outcome. The fixes are to remove the association from
the owning side first, or to declare `ON DELETE CASCADE` on the join table's foreign keys
in the schema.

---

← Prev: [6c · The three real options](06c-the-three-real-options.md) · Index: [Relationships and fetch types](README.md) · Next → [7b · Model the join table](07b-model-the-join-table.md)
