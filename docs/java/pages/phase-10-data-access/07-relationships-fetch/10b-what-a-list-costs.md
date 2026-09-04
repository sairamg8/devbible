---
title: "A List without @OrderColumn is a bag, and a bag Hibernate cannot identify row by row gets deleted and reinserted wholesale"
sidebar_label: "10b · What a List costs"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.9.2 *Mapping Lists*,
> §3.9.11 *Bags*, §3.9.1 *Collection Semantics*, §A.6.17
> `hibernate.mapping.default_list_semantics` and §31.4 *Associations*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 `MultipleBagFetchException` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/loader/MultipleBagFetchException.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/loader/MultipleBagFetchException.html))
> and the Jakarta Persistence 3.2 `@OrderColumn` javadoc
> ([.../ordercolumn](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/ordercolumn)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**A `List` promises two things Java programmers take for granted: order, and the same
element twice. A relational table gives you neither for free. Hibernate's answer is the
bag — a collection with no persistent order and no per-element identity — and the price
of no per-element identity is that changing one element can mean rewriting the whole
collection.**

## What a bag is

The 7.4 *User Guide* defines the classification: a `Collection` is a `BAG`, and a `List`
with no `@OrderColumn` is treated as one too. The controlling setting is documented in the
configuration appendix:

> `hibernate.mapping.default_list_semantics` — Since: 6.0 — **Default Value:
> `CollectionClassification.BAG`**

and the guide's *Mapping Lists* section explains what that means for you:

> Contrary to natural expectations, the ordering of a list is by default not maintained.
> To maintain the order, it is necessary to explicitly use the
> `jakarta.persistence.OrderColumn` annotation.

So `List<Book> books` gives you a Java `List` whose iteration order is whatever the
database returned, in whatever order the rows came back. It is not stable across loads and
it is not the order you added things in.

## The cost: delete-all-and-reinsert

Here is the part that matters. From the guide's *Bags* section:

> Because the parent-side cannot uniquely identify each individual child, Hibernate
> deletes all link table rows associated with the parent entity and re-adds the remaining
> ones that are found in the current collection state.

and, for value-type collections:

> unidirectional bags are not as efficient when it comes to modifying the collection
> structure (removing or reshuffling elements).

Think about what "cannot uniquely identify each individual child" means physically. In an
association table `(publisher_id, book_id)` with no other column, two rows for the same
pair are indistinguishable — which is exactly what a bag permits. So Hibernate has no
`WHERE` clause that reliably names one row. Its only correct option is to remove
everything for that parent and put back what survived.

**Removing one element from a bag of 500 is one bulk delete and 499 inserts.** That is the
whole cost model, and it applies to owned bags: unidirectional `@OneToMany`, `@ManyToMany`,
and `@ElementCollection`.

⚠️ **The inverse side of a bidirectional one-to-many escapes this.** There, the child row
*is* the association and it has a primary key, so removal is one targeted update or
delete. Hibernate's *Introduction* accordingly says a `List` on a `@OneToMany(mappedBy =
…)` has "almost no difference in semantics" from a `Set` — the bag penalty is a property of
owned collections, not of the word `List`.

## `@OrderColumn`: buying order, and what it costs

```java
@ElementCollection
@CollectionTable(name = "checklist_step",
                 joinColumns = @JoinColumn(name = "checklist_id"))
@OrderColumn(name = "step_order")
@Column(name = "description", nullable = false)
private List<String> steps = new ArrayList<>();
```

Now there is a real column holding each element's index, and the list order is persistent.
The default column name, if you omit `name`, is documented: *"The default column name that
stores the index is derived from the attribute name, by suffixing `_ORDER`."* And
`@ListIndexBase` chooses between 0-based and 1-based indexing on the database side.

**What it costs.** The index is stored per row, so it must be kept correct. Inserting at
position 0 of a 500-element list shifts 500 indexes. Removing element 3 renumbers
everything after it. An index column turns "add an item" into an operation whose cost
depends on where you add it.

**When it is worth it.** When position is genuinely data — a checklist whose step order is
the point, a playlist, a set of form fields with a fixed sequence. When it is not: when
somebody wanted alphabetical order and reached for `List`. That is `@OrderBy` —
**[10c](10c-orderby-versus-ordercolumn.md)**.

## Two `List`s fetched at once is a documented failure

Once two collections on the same entity are bags, fetching both in one query is not
allowed. Hibernate's 7.4 javadoc for `org.hibernate.loader.MultipleBagFetchException`
describes it as the *"exception used to indicate that a query is attempting to
simultaneously fetch multiple bags"*, extending `HibernateException` and exposing
`getBagRoles()` — *"the collection-roles for the bags encountered"*.

The reason is that a bag has no per-element identity, so when two bags are joined in one
result set Hibernate cannot tell a genuine duplicate from a row multiplied by the join. It
refuses rather than guessing.

You can reach this without writing a single query, because **an `EAGER` collection is
fetched by the same machinery**. Two `List` collections both marked `EAGER` puts you here
on the first `find`. That is **[13b · How it multiplies](13b-how-it-multiplies.md)**.

🔴 The *fix* for needing several collections at once — separate queries, batching, entity
graphs — belongs to [Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md). The mapping-level
advice that belongs here is simpler: **make them `Set`s.** Two `Set`s do not raise this
exception, because a set element is identifiable.

## The efficiency ranking, from the guide

The 7.4 *User Guide*'s best-practice chapter ranks the options directly:

> For unidirectional collections, `Set`s are the best choice because they generate the
> most efficient SQL statements. Unidirectional `List`s are less efficient than a
> `@ManyToOne` association.

and for value types:

> Embeddable collections (`@ElementCollection`) are unidirectional associations, hence
> `Set`s are the most efficient, followed by ordered `List`s, whereas bags (unordered
> `List`s) are the least efficient.

**Read that last sentence carefully: an ordered `List` — one with `@OrderColumn` — beats a
bag.** The index column that costs you on reordering also buys per-row identity, which is
what makes targeted deletes possible. A bag is the worst of both: no order and no identity.

## The `@Bag` and `ID_BAG` escape hatches

Hibernate offers two related tools you will occasionally meet:

`@Bag` forces bag classification on a `List` — *"Even though the `names` attribute is
defined as `List`, Hibernate will treat it using the `BAG` semantics."* Used when the
`default_list_semantics` setting has been changed globally and you want one attribute back.

`ID_BAG`, configured with `@CollectionId`, is *"similar to a `BAG`, except that it maps a
generated, per-row identifier into the collection table"*. That surrogate key is exactly
the per-element identity a bag lacks, so targeted deletes become possible while duplicates
remain allowed. Niche, and the right answer when you genuinely need duplicates in an owned
collection.

## Gotchas

**`List` does not give you order.** It gives you a Java type whose iteration order is
undefined unless you added `@OrderColumn` or `@OrderBy`. Code that relies on
`list.get(0)` being "the first one added" is relying on nothing.

**Changing `default_list_semantics` to `LIST` globally does not fix unowned collections.**
The guide warns: *"default `LIST` semantics only affects owned collection mappings. Unowned
mappings like `@ManyToMany(mappedBy = …)` and `@OneToMany(mappedBy = …)` do not retain the
element order by default."*

**Keeping an ordered `@OneToMany(mappedBy = …)` correct requires both sides to be in
step.** The guide is explicit: to retain the order of a `mappedBy` one-to-many you must
apply `@OrderColumn` explicitly *and* keep the `@OneToMany` and the `@ManyToOne` in sync,
*"otherwise, the element position will not be updated accordingly."*

**`@OrderColumn` on `@ManyToMany(mappedBy = …)` is illegal.** Not degraded — rejected. The
unowned side maps no columns.

**Inserting at the head of an ordered list is O(n) in statements.** Every subsequent index
shifts. If insertion position is arbitrary and the list is long, an index column is the
wrong storage.

**A bag makes `contains` and `remove` behave on `equals`, and you probably have not
written one.** `List.remove(Object)` removes the first element that `equals` its argument.
With `Object` identity semantics that is the instance you hold, which may not be the
instance in the collection if they came from different persistence contexts.

**The delete-and-reinsert behaviour is invisible until it is a production incident.** It
costs nothing on a collection of five and dominates on a collection of five thousand, and
nothing in the mapping hints at the difference.

## Interview questions

**★ What is a bag, and why does Hibernate have one?**
A bag is an unordered collection that permits duplicates and has no per-element identity.
Hibernate needs the classification because a plain database table backing a collection has
no inherent order and, without an extra column, no way to tell two identical rows apart. A
Java `Collection` is classified as a bag, and so is a `List` with no `@OrderColumn` —
Hibernate's documented default for `hibernate.mapping.default_list_semantics` is
`CollectionClassification.BAG`.

**★ Why is removing one element from an owned bag expensive?**
Because Hibernate cannot write a `WHERE` clause that identifies the row to remove. The
documentation says it directly: since the parent side cannot uniquely identify each
individual child, Hibernate deletes all the rows associated with that parent and reinserts
the ones still present in the collection. Removing one element from a bag of 500 becomes
one delete covering 500 rows plus 499 inserts.

**★ Does that apply to the inverse side of a bidirectional one-to-many?**
No. There, the association is the child row itself, and the child row has a primary key, so
Hibernate can target it — removal is one update setting the foreign key to null, or one
delete with orphan removal. Hibernate's introduction says a `List` on a `mappedBy`
one-to-many has almost no difference in semantics from a `Set`. The bag penalty is a
property of owned collections: unidirectional one-to-many, many-to-many, element
collections.

**★ What does `@OrderColumn` buy and what does it cost?**
It buys a persistent order: an extra column stores each element's index, so the list comes
back in the order you left it, and — because the index makes each row identifiable — the
collection is more efficient to modify than a bag. Hibernate's best-practice chapter ranks
ordered lists above bags for exactly that reason. It costs index maintenance: inserting or
removing anywhere but the end renumbers every element after that point, so an insert at the
head of a long list is many updates.

**★ What is `MultipleBagFetchException` and how do you avoid it at the mapping level?**
It is the exception Hibernate throws when a query tries to fetch two bag-typed collections
at once — the javadoc describes it as indicating a query attempting to simultaneously fetch
multiple bags, and it reports the offending collection roles. It happens because a bag has
no per-element identity, so Hibernate cannot distinguish a real duplicate from a row
multiplied by the join. At the mapping level, the fix is to make the collections `Set`s, or
to give them `@OrderColumn`. You can hit this without writing a query at all, because two
`EAGER` `List` collections are fetched by the same mechanism.

**★ When would you deliberately use `@CollectionId` / an id-bag?**
When you genuinely need duplicates in an owned collection and cannot accept the
delete-and-reinsert cost. An id-bag adds a generated per-row identifier to the collection
table, which gives Hibernate the per-element identity a plain bag lacks, so removals become
targeted while duplicates remain allowed. It is niche — most of the time the honest answer
is that the "duplicates" are really rows with distinguishing attributes, and the collection
should be of a real entity.

---

← Prev: [10 · Collection types](10-collection-types.md) · Index: [Relationships and fetch types](README.md) · Next → [10c · @OrderBy vs @OrderColumn](10c-orderby-versus-ordercolumn.md)
