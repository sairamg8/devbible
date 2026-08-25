---
title: "Set, List or Map is not a style choice — Hibernate classifies the declared type and each classification gets different SQL"
sidebar_label: "10 · Collection types"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.9 *Collections* —
> §3.9.1 *Collection Semantics*, §3.9.2 *Mapping Lists*, §3.9.13 *Sets*, §3.9.14 *Sorted
> sets* and §31.4 *Associations*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the Hibernate ORM 7.4 *Introduction* §3.17 *Set, List, or Collection?* and §9.12
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Hibernate does not treat your collection field as "some collection". It inspects the
declared type and assigns it a *classification*, and the classification determines the
SQL generated when the contents change. A `Set` and a `List` mapping the same
relationship produce different statements. This chunk covers the classification rules
and how to choose; the specific price of a `List` gets its own chunk.**

## The classification rules, as documented

The 7.4 *User Guide* lists the interpretation Hibernate applies to a plural attribute's
declared type:

> - if an array → `ARRAY`
> - if a `List` → `LIST`
> - if a `SortedSet` → `SORTED_SET`
> - if a `Set` → `SET`
> - if a `SortedMap` → `SORTED_MAP`
> - if a `Map` → `MAP`
> - else `Collection` → `BAG`

Seven classifications from the declared type alone, plus `ORDERED_SET`, `ORDERED_MAP` and
`ID_BAG` reached through explicit annotations. **The declared type is the input.** Change
`Set<Book>` to `List<Book>` and you have changed the mapping, not just the Java API.

⚠️ **`List` maps to `LIST` in the classification table and still behaves as a bag by
default.** That looks contradictory and is not. The guide explains: *"Contrary to natural
expectations, the ordering of a list is by default not maintained. To maintain the order,
it is necessary to explicitly use the `jakarta.persistence.OrderColumn` annotation."* The
setting `hibernate.mapping.default_list_semantics` — documented default
`CollectionClassification.BAG`, since 6.0 — is what governs it. Full consequences in
**[10b](10b-what-a-list-costs.md)**.

## `Set` — the default choice

```java
@OneToMany(mappedBy = "publisher")
private Set<Book> books = new HashSet<>();
```

**Why it is the conventional answer.** A one-to-many mapped to a foreign key cannot
contain the same child twice — a row has one `publisher_id`. The *Introduction* makes the
argument: *"A one-to-many association mapped to a foreign key can never contain duplicate
elements, so `Set` seems like the most semantically correct Java collection type to use
here, and so that's the conventional practice in the Hibernate community."*

**Why the guide recommends it for efficiency too.** From the best-practice chapter: *"For
unidirectional collections, `Set`s are the best choice because they generate the most
efficient SQL statements."* A set element can be identified by its own value, so removal
is a targeted delete rather than a rewrite.

**The obligation it creates.** `HashSet` calls `hashCode()` and `equals()`. The
*Introduction* is candid: *"The catch associated with using a set is that we must
carefully ensure that `Book` has a high-quality implementation of `equals()` and
`hashCode()`."* See **[15](15-equals-hashcode-tostring.md)** for what "high-quality"
means and why the obvious implementation is wrong.

## `List` and `Collection` — permitted, and the guide has softened

Hibernate's *Introduction* used to insist on `Set`. It no longer does:

> But what if we used `Collection` or `List` instead? Then our code would be much less
> sensitive to how `equals()` and `hashCode()` were implemented. In the past, we were
> perhaps too dogmatic in recommending the use of `Set`. Now? I guess we're happy to let
> you guys decide.

For a `@OneToMany(mappedBy = …)` specifically, it notes the semantics barely change:
*"Hibernate also allows the use of `List` or `Collection` here, with almost no difference
in semantics. In particular, the `List` may not contain duplicate elements, and its order
will not be persistent."*

So for the inverse side of a one-to-many, `List` is defensible and buys you freedom from
the `equals` obligation. For an **owned** collection — a unidirectional `@OneToMany`, a
`@ManyToMany`, an `@ElementCollection` — it costs real SQL, and **[10b](10b-what-a-list-costs.md)**
is the argument.

## `Map` — a keyed view of the same rows

```java
@OneToMany(mappedBy = "publisher")
@MapKey(name = "isbn")                     // key is an attribute of Book
private Map<String, Book> booksByIsbn = new HashMap<>();
```

`@MapKey` names an **attribute of the target entity**, not a column. The *Introduction*
is explicit: *"Note that `@MapKey` specifies a field or property name, not a column
name."* No extra column is stored; the key is read out of the child.

The alternatives, and which side each belongs on:

| Annotation | Key comes from | Use on |
|---|---|---|
| `@MapKey` | an attribute of the target entity | owned or unowned collections |
| `@MapKeyColumn` | a column storing a basic key | `@ElementCollection`, owned `@ManyToMany`, owned `@OneToMany` |
| `@MapKeyJoinColumn` | a column storing an entity key | the same owned mappings |

⚠️ **`@MapKeyColumn` on an unowned collection is wrong in principle.** The 7.4
*Introduction* states the rule: the unowned side is not responsible for specifying column
mappings, so use `@OrderColumn`/`@MapKeyColumn` with an `@ElementCollection`, an owned
`@ManyToMany` or an owned `@OneToMany`, and use `@OrderBy`/`@MapKey` on the unowned side.

The *Introduction* is also honest about maps in general: *"Java lists and maps don't map
very naturally to foreign key relationships between tables, and so we tend to avoid using
them to represent associations between our entity classes."* A `Map` is a good local
convenience and a poor default.

## `SortedSet` — sorting in Java, not ordering in SQL

The *Introduction* draws a distinction worth adopting:

> an **ordered** collection is one with an ordering maintained in the database, and a
> **sorted** collection is one which is sorted in Java code.

```java
@OneToMany(mappedBy = "publisher")
@SortNatural                         // Book implements Comparable
private SortedSet<Book> books = new TreeSet<>();
```

```java
@OneToMany(mappedBy = "publisher")
@SortComparator(BookByTitle.class)
private SortedSet<Book> books = new TreeSet<>();
```

Hibernate backs these with a `TreeSet` or `TreeMap`. Both annotations are
Hibernate-specific, not JPA. And a change worth knowing: *"Before v6, `@SortNatural` must
be used if collection element's natural ordering is relied upon for sorting. Starting from
v6, we can omit `@SortNatural` as it will take effect by default"* for a `SortedSet`.

Sorting happens after the rows arrive, so it costs no SQL and cannot be used to limit what
is fetched. Ordering in SQL is `@OrderBy` — **[10c](10c-orderby-versus-ordercolumn.md)**.

## Choosing, as a decision list

1. **Inverse side of a one-to-many, small and bounded** → `Set`, with a sound
   `equals`/`hashCode`. `List` is acceptable if you would rather not write them.
2. **Owned collection** (`@ManyToMany`, unidirectional `@OneToMany`,
   `@ElementCollection`) → `Set`. A `List` here has a real cost.
3. **Order matters and is a property of the data** (a checklist, a playlist) → `List` with
   `@OrderColumn`, and read **[10b](10b-what-a-list-costs.md)** first.
4. **Order is just a presentation preference** → `Set` plus `@OrderBy`, or sort in the
   service layer, or a query with `ORDER BY`.
5. **You want lookup by key** → consider a `Map` with `@MapKey`, but check whether a
   `Set` plus a lookup method is simpler.
6. **The collection could be large** → none of the above. Use a repository query with a
   `Pageable`.

## Gotchas

**Declare the interface, never the implementation.** `private Set<Book> books` is required;
`private HashSet<Book> books` breaks the mapping, because Hibernate substitutes its own
persistent-collection type and can only do that for an interface.

**Changing `Set` to `List` in an existing entity changes the generated SQL.** It is a
mapping change, not a refactor, and the classification table is why. Review it as one.

**`@MapKeyColumn` and `@OrderColumn` are illegal or ineffective on `mappedBy` sides.** The
unowned side maps no columns. `@OrderColumn` on `@ManyToMany(mappedBy = …)` is documented
as illegal; use `@OrderBy` or `@MapKey` there.

**`@SortNatural` requires the element to implement `Comparable`,** and that comparison is
what the `TreeSet` uses for uniqueness — so an element whose `compareTo` returns 0 for two
distinct objects will silently lose one, regardless of `equals`.

**A `Map` keyed on a mutable attribute breaks the same way a `HashSet` does.** If
`@MapKey(name = "title")` and a title changes, the in-memory key is stale until reload.

**`SortedSet` is sorted in memory after loading — it does not add `ORDER BY`.** If you
were hoping to page the collection by that ordering, you cannot; everything is fetched
first.

**Two `List` collections on the same entity, both fetched in one query, is a documented
failure.** `org.hibernate.loader.MultipleBagFetchException` is described in the Hibernate
7.4 javadocs as the *"exception used to indicate that a query is attempting to
simultaneously fetch multiple bags"*. See **[13b](13b-how-it-multiplies.md)**.

## Interview questions

**★ How does Hibernate decide what a collection attribute means?**
From the declared type. Its documented interpretation is: array → `ARRAY`, `List` →
`LIST`, `SortedSet` → `SORTED_SET`, `Set` → `SET`, `SortedMap` → `SORTED_MAP`, `Map` →
`MAP`, and anything else typed as `Collection` → `BAG`. That classification then decides
what SQL is generated when the collection changes, which is why swapping `Set` for `List`
is a mapping change rather than a cosmetic one.

**★ Why is `Set` the conventional choice for a one-to-many?**
Because it matches the data. A one-to-many mapped to a foreign key cannot contain the same
child twice, so a set is the semantically accurate type — Hibernate's documentation makes
exactly that argument. It is also the most efficient for owned collections, because a set
element can be identified individually, so removing one is a targeted delete rather than a
rewrite of the whole collection.

**★ What does choosing `Set` commit you to?**
A correct `equals` and `hashCode` on the element type. `HashSet` routes every add,
remove and contains through them, and the naive implementation — hashing on a generated id
— changes an object's hash when it is persisted, which loses it inside the set. Hibernate's
documentation acknowledges this as the catch of using a set and, in recent editions, softens
its recommendation partly for that reason.

**★ What is the difference between a sorted and an ordered collection?**
Hibernate's documentation defines them precisely: an ordered collection has an ordering
maintained in the database, and a sorted collection is sorted in Java code. `@OrderBy` and
`@OrderColumn` produce ordering; `@SortNatural` and `@SortComparator` on a `SortedSet` or
`SortedMap` produce sorting, backed by a `TreeSet` or `TreeMap` after the rows arrive. Only
the first can influence SQL.

**★ Where can you use `@MapKeyColumn`, and where must you not?**
On collections that own their columns — an `@ElementCollection`, an owned `@ManyToMany`, an
owned `@OneToMany`. Not on the unowned `mappedBy` side, which by definition specifies no
column mappings; there you use `@MapKey`, which names an attribute of the target entity
rather than a column. The same split applies to `@OrderColumn` versus `@OrderBy`, and
`@OrderColumn` on a `@ManyToMany(mappedBy = …)` is documented as illegal outright.

**★ Why must the field be declared as an interface type?**
Because Hibernate replaces the value with its own persistent-collection implementation when
the entity becomes managed — that wrapper is what provides lazy initialisation and change
tracking. It can only substitute its type for the field if the declared type is an
interface it implements. The documentation states the rule directly for the many-valued
side of an association: use `Set` or `List`, never `HashSet` or `ArrayList`.

---

← Prev: [9 · Orphan removal](09-orphan-removal.md) · Index: [Relationships and fetch types](README.md) · Next → [10b · What a List costs](10b-what-a-list-costs.md)
