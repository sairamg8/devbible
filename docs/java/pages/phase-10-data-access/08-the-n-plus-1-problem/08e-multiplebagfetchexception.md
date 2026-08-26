---
title: "cannot simultaneously fetch multiple bags — the exception is Hibernate refusing to give you a wrong answer, and changing List to Set is only one of two honest fixes"
sidebar_label: "8e · MultipleBagFetchException"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against `org.hibernate.loader.MultipleBagFetchException` in
> the Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/loader/MultipleBagFetchException.java)),
> the Hibernate ORM 7.4 user guide §3.9.11 *Bags* and §17.8.4
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Hibernate ORM 7.4 *A Short Guide to Hibernate 7* §8.6 *Join fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Fetch two collections in one query and one of two things happens: a Cartesian
product, or this exception. The exception is the better outcome, and understanding
why tells you which of the two real fixes to choose — because the popular one,
changing `List` to `Set`, silences the message without addressing the arithmetic
underneath.**

## The query and the exception

```java
// ⛔
@Query("""
       select o from Order o
       left join fetch o.lines
       left join fetch o.shipments
       where o.id = :id
       """)
Optional<Order> findFull(@Param("id") Long id);
```

```java
@Entity
class Order {
    @OneToMany(mappedBy = "order") List<OrderLine> lines;       // ← bag
    @OneToMany(mappedBy = "order") List<Shipment>  shipments;   // ← bag
}
```

The exception class is tiny, and its message is built in the constructor:

```java
public class MultipleBagFetchException extends HibernateException {
    public MultipleBagFetchException(List bagRoles) {
        super( "cannot simultaneously fetch multiple bags: " + bagRoles );
    }
    public List getBagRoles() { return bagRoles; }
}
```

Its javadoc: *"Exception used to indicate that a query is attempting to
simultaneously fetch multiple bags"*. Note `getBagRoles()` — the exception tells
you exactly which two associations are in conflict, which is worth reading rather
than just the message.

⛔ It lives in `org.hibernate.loader`, not `org.hibernate.query`, which is
occasionally useful when you are trying to catch it or find it.

## What a bag is

A **bag** is Hibernate's name for an unordered collection that permits
duplicates. The user guide classifies collections by their semantics, and the
mapping determines which you get:

| Java type | Mapped as | Duplicates | Order |
|---|---|---|---|
| `List` with no `@OrderColumn` | **BAG** | allowed | none |
| `List` with `@OrderColumn` | LIST | allowed | index column |
| `Set` | SET | not allowed | none |
| `SortedSet` / `@OrderBy` | SET, sorted | not allowed | comparator / `order by` |

**A plain `List<OrderLine>` is a bag.** That is the default and almost nobody
declares it deliberately — which is why this exception arrives as a surprise.

The guide notes that Hibernate will treat a `List` with bag semantics even when
you might expect otherwise, and offers `@Bag` to force the classification
explicitly.

## Why two bags cannot be fetched at once

Here is the part that makes the exception correct rather than an arbitrary
restriction.

Fetching both collections produces the Cartesian product from
[chunk 8b](08b-what-a-fetch-join-breaks.md): 3 lines × 2 shipments = 6 rows for
one order.

Now Hibernate must build the two collections from those 6 rows.

- For a **`Set`**, that is fine. Each line appears in 2 of the 6 rows, and adding
  it twice to a set is a no-op — the set ends with 3 elements, correctly.
- For a **bag**, it is not. A bag permits duplicates, so Hibernate has no basis
  for collapsing the repeats. Line A genuinely appears twice in the result, and a
  bag that allows duplicates cannot distinguish "appears twice because the join
  multiplied it" from "appears twice because there are two of them".

**So with two bags Hibernate would have to return `lines` with 6 elements and
`shipments` with 6 elements, when there are 3 and 2.** That is a wrong answer,
not a slow one — and rather than return it, Hibernate throws.

**The exception is a correctness guard.** Once you see that, the popular fix
looks different: changing to `Set` does not make the query cheap, it makes the
result *representable*. The Cartesian product is still there.

## The three ways out

[Chunk 8e2](08e2-the-three-ways-out.md) works through them: change one collection
to `Set`, fetch one and subselect the other, or stop loading the graph. They are
not equivalent, and the popular one is the weakest.

## Gotchas

**⚠️ Reading "bag" as something you opted into.**
You did not. A plain `List` with no `@OrderColumn` is a bag by default, which is
why this exception arrives without warning in code that never mentions bags.

**⚠️ Catching `MultipleBagFetchException` and falling back.**
It is thrown when the query is prepared, not per row — it is a programming error,
not a runtime condition. Catching it hides a query that can never work.

**⚠️ Reading the message and not `getBagRoles()`.**
The exception carries the exact collection roles in conflict. In an entity with
six associations that is the difference between knowing and guessing.

**⚠️ Looking for the class in `org.hibernate.query`.**
It is in `org.hibernate.loader`, which is a small thing that costs a few minutes
when you are trying to catch it or read its source.

**⚠️ Assuming it fires for two to-one fetches.**
It does not, and cannot. To-one joins add columns rather than multiplying rows,
so there is no product and no ambiguity — several to-one fetches in one query are
explicitly documented as safe.

**⚠️ Concluding from the absence of the exception that two collection fetches are
fine.**
If either collection is a `Set`, no exception fires and the Cartesian product
happens anyway. The exception only guards the case where the result would be
*wrong*; it says nothing about the case where it is merely enormous.

## Interview questions

**★ What is `MultipleBagFetchException` and what causes it?**
It is thrown by Hibernate when a single query tries to fetch two or more
collections that are mapped as *bags* — its javadoc is "exception used to
indicate that a query is attempting to simultaneously fetch multiple bags", and
the message is "cannot simultaneously fetch multiple bags: " followed by the
roles. A bag is Hibernate's classification for an unordered collection permitting
duplicates, which is what a plain `List` with no `@OrderColumn` becomes — so
almost nobody chooses a bag deliberately, which is why the exception feels
arbitrary. The trigger is two `left join fetch` clauses over collections in one
query, and the exception carries `getBagRoles()` naming exactly which two are in
conflict, which is worth reading rather than just the message.

**★ Why is it an error rather than just slow?**
Because Hibernate cannot build a correct answer. Fetching both collections
produces a Cartesian product — three lines and two shipments give six rows — and
Hibernate must assemble both collections from those six rows. For a `Set` that
works, because adding the same line twice is a no-op and the set ends with three
elements. For a bag it does not: a bag permits duplicates, so it has no basis for
collapsing repeats, and it cannot distinguish "line A appears twice because the
join multiplied it" from "there are genuinely two of line A". The only thing
Hibernate could return is a bag of six lines and a bag of six shipments, which is
wrong data. So it throws rather than lie — which means the exception is a
correctness guard, not a performance warning, and that distinction changes which
fix you should reach for.

**★ What exactly is a bag, and how do you end up with one?**
A bag is an unordered collection that permits duplicates — Hibernate's
classification for a collection with no index column and no uniqueness. You end
up with one by writing `List<OrderLine>`, which is the overwhelmingly common
mapping, because a `List` with no `@OrderColumn` has no way to record order in
the database and no constraint preventing duplicates. Adding `@OrderColumn`
reclassifies it as a LIST with an index column; mapping it as `Set` gives SET
semantics with no duplicates. Hibernate also exposes `@Bag` to force the
classification explicitly, which exists mainly to make the intent visible. The
practical upshot is that the default mapping is the one that triggers the
exception, which is why it is met so often and understood so rarely.

**★ Why does the exception not fire for two `@ManyToOne` fetches?**
Because to-one joins add columns to a row rather than multiplying rows, so there
is no Cartesian product and no ambiguity about how many elements a collection
should have. Fetching an order's customer and its payment method in one query
gives exactly one row per order, wider than before. The Hibernate user guide
states the rule directly: several to-one associations in series or parallel are
perfectly safe in one query, and it is fetching multiple *to-many* associations
in parallel that produces the product. That single distinction — columns versus
rows — explains nearly every documented restriction on fetch joins, this
exception included.

**★ Is the absence of this exception evidence that a two-collection fetch is
safe?**
No, and this is the most useful thing to know about it. If either collection is
mapped as a `Set`, Hibernate can build a correct answer, so no exception is
thrown — and the Cartesian product happens exactly as before. The exception
guards only against a result that would be *wrong*; it has nothing to say about a
result that is merely enormous. So a codebase that "solved" the problem by
switching to `Set` has traded a loud error for a silent quadratic result set,
which is a worse position than it started from. The check that actually tells you
is a row count, not the presence or absence of an exception.

---

← Prev: [8d2 · Paginating before 7.4](08d2-paginating-on-older-versions.md) · Index: [08 · The N+1 problem](README.md) · Next → [8e2 · The three ways out](08e2-the-three-ways-out.md)
