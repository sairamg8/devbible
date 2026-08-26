---
title: "Subselect fetching gets every collection in one extra statement by re-running the query that found the owners, which is either brilliant or the same expensive query twice"
sidebar_label: "11 · @Fetch(SUBSELECT)"
sidebar_position: 38
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §12.9 *The `@Fetch`
> annotation mapping*, §12.11 *`FetchMode.SUBSELECT`* and §A.7.3
> `hibernate.use_subselect_fetch`
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the `org.hibernate.annotations.FetchMode` and `org.hibernate.annotations.Fetch`
> javadocs
> ([docs.hibernate.org/orm/7.4/javadocs](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/annotations/FetchMode.html)),
> and *A Short Guide to Hibernate 7* §8.5 *Batch fetching and subselect fetching*
> ([docs.hibernate.org/orm/7.4/introduction](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Hibernate ORM 7.4.1, PostgreSQL 18.

**Batch fetching identifies the owners by listing their ids. Subselect fetching
identifies them by *re-running the query that found them*, inside an `IN`
subquery. That gets every collection in exactly **one** extra statement no matter
how many owners there are — and it means the driving query executes twice.**

## The mechanism

The `FetchMode.SUBSELECT` javadoc:

> *"Use a secondary select with a subselect that re-executes an initial query to
> load all instances of the related entity or collection at once, at some point
> after the initial query is executed. This fetching strategy is currently only
> available for collections and many-valued associations."*

And §12.9's summary of the same mode:

> *"Available for collections only. When accessing a non-initialized collection,
> this fetch mode will trigger loading all elements of all collections of the same
> role for all owners associated with the persistence context using a single
> secondary select."*

Read "all owners associated with the persistence context" carefully — it is the
same scoping rule batch fetching uses, and it means the statement covers parents
you are not currently looking at.

## What it generates

The user guide's §12.11 example — departments filtered by name, then their
employee collections touched:

```sql
SELECT d.id FROM Department d WHERE d.name LIKE 'Department%';

SELECT e.department_id, e.id, e.name
FROM   Employee e
WHERE  e.department_id IN (
           SELECT fetchmodes0_.id
           FROM   Department fetchmodes0_
           WHERE  d.name LIKE 'Department%'
       );
```

The introduction guide's version of the same shape is `where a1_0.books_isbn in
(select b1_0.isbn from Book b1_0)`, and it adds the sentence that is the whole
argument for the strategy:

> *"Notice that the first query is re-executed in a subselect in the second
> query. The execution of the subselect is likely to be relatively inexpensive,
> since the data should already be cached by the database."*

**Two statements. Always two, for any number of owners** — and no ids are
transferred at all, because the owner set is described rather than enumerated.

## Turning it on

Per collection:

```java
@Entity
class Order {
    @OneToMany(mappedBy = "order")
    @Fetch(FetchMode.SUBSELECT)
    Set<Shipment> shipments;
}
```

Globally, since **Hibernate 6.3**:

```properties
spring.jpa.properties.hibernate.use_subselect_fetch=true
```

The settings appendix: *"When enabled, Hibernate will use subselect fetching,
when possible, to fetch any collection. Subselect fetching involves fetching the
collection based on the restriction used to load it owner(s). By default,
Hibernate only uses subselect fetching for collections explicitly annotated
`@Fetch(SUBSELECT)`."*

Per session: `session.setSubselectFetchingEnabled(true)`.

## The detail that decides where it applies

From the introduction guide, and it is easy to skim past:

> *"Note that `@Fetch(SUBSELECT)` has the same effect as `@Fetch(SELECT)`, except
> **after execution of a HQL or criteria query**. But after query execution,
> `@Fetch(SUBSELECT)` is able to much more efficiently fetch associations."*

🔴 **There has to be a query for the subselect to re-run.** Load a single order
with `find(Order.class, id)` and then touch `shipments`, and there is no prior
query to put in a subselect — the mode degrades to `SELECT`, which is one
statement, which is correct and unremarkable. Subselect fetching is a
*query-result* optimisation, not a lookup optimisation.

## Against batch fetching

| | `@BatchSize(k)` | `@Fetch(SUBSELECT)` |
|---|---|---|
| Extra statements | ⌈N/k⌉ | **1** |
| Owner set expressed as | a list of ids | the original query, re-run |
| Ids on the wire | `N` | **none** |
| Driving query executed | once | **twice** |
| Works after `find()` | yes | no — degrades to `SELECT` |
| Works for `@ManyToOne` | **yes** | no — collections only |
| Scope of the setting | role or global | role or global |
| Composes with pagination | yes | ⚠️ see [chunk 11b](11b-the-trap.md) |

The two rows in bold are the trade in full: subselect wins the statement count
outright and pays for it by executing the driving query a second time.

## When it is clearly right

**Two collections off one query.** This is the case Hibernate's own documentation
reaches for it, in §8.6:

> *"There's one interesting case where join fetching becomes inefficient: when we
> fetch two many-valued associations in parallel. … Joining both collections in a
> single query would result in a cartesian product of tables, and a large SQL
> result set. Subselect fetching comes to the rescue here, allowing us to fetch
> `books` using a join, and `royaltyStatements` using a single subsequent
> select."*

Join-fetch the first collection, subselect the second: three statements, no
product, no `MultipleBagFetchException` —
[chunk 8e2](08e2-the-three-ways-out.md) is where this arrives from.

**A cheap driving query with many owners.** `select o from Order o where
o.status = 'OPEN'` over an indexed column, returning eight hundred rows: batch
fetching is 1 + ⌈800/50⌉ = 17 statements; subselect is 2, and the re-executed
driving query is an index scan the database has just done.

## When it is clearly wrong

**An expensive driving query.** You pay it twice.
[Chunk 11b](11b-the-trap.md) is entirely about this.

**A `@ManyToOne`.** Not available — "currently only available for collections and
many-valued associations". The proxy-per-row shape needs `@BatchSize` on the
entity class ([chunk 10](10-batch-size.md)).

**A lookup by id.** Degrades to `SELECT`; nothing is gained and a reader of the
mapping will think something is.

## Gotchas

**⚠️ Expecting it to work after `find()`.**
Without a preceding HQL or criteria query there is nothing to re-run, and the
mode behaves as `SELECT`. A codebase whose read path is mostly `findById` gets no
benefit from the annotation and keeps the maintenance cost of it.

**⚠️ Putting it on a `@ManyToOne`.**
`FetchMode.SUBSELECT` is documented as collections and many-valued associations
only. Whether it is rejected or silently ignored on a to-one is not something the
7.4 documentation states, and I would not rely on either — use `@BatchSize` on
the target entity class instead, which is the documented fix for that shape.

**⚠️ Treating it as a per-query decision.**
Like `@BatchSize`, it is attached to the **collection role**, so every query in
the application that touches that collection gets subselect behaviour, including
the ones that loaded one owner. Nothing in the JPA or Hibernate query APIs lets
you request it for a single query — the introduction guide is explicit that a
fetch profile is the only mechanism that can, and that "we can't do that with
entity graphs, and we can't do it with HQL". See
[chunk 13](13-fetch-profiles.md).

**⚠️ Enabling `hibernate.use_subselect_fetch` globally by analogy with
`default_batch_fetch_size`.**
They are not comparable in risk. The batch setting adds a bounded `IN` list to a
statement Hibernate was going to issue anyway. The subselect setting makes *every*
collection in the application re-run its owners' driving query — including
collections whose owners came from an expensive one. Turn it on per role until
you have a reason not to.

**⚠️ Assuming the subselect is cheap because the guide says it "should already be
cached".**
The guide's word is *should*, and the caching it refers to is the database's own
buffer cache, not a result cache. A driving query that scanned a large table
warms the cache and still re-scans it. Read the sentence as an argument for why
this is usually fine, not as a guarantee.

**⚠️ Forgetting that the second statement covers all owners in the persistence
context.**
"All collections of the same role for all owners associated with the persistence
context" — so if a previous query in the same transaction loaded more owners, the
subselect's result set covers them too. Usually a bonus. Occasionally a very large
statement you did not ask for.

**⚠️ Mapping one collection `SUBSELECT` and join-fetching the same collection
elsewhere.**
The join fetch wins for that query and the annotation does nothing there, which
is correct but means the mapping no longer describes what happens. Two mechanisms
for one association is a readability cost paid by everybody who reads it later.

**⚠️ Reaching for it to fix a `Cartesian` product that a projection would remove
entirely.**
Two collections in one response is very often a report shape. Subselect makes it
three statements instead of a product; a projection makes it one flat query with
a tenth of the columns — [chunk 12](12-projections-and-dtos.md).

**⚠️ Measuring it by statement count alone.**
Two statements is the headline and the second one can be large: it returns every
child of every owner the driving query matched. Look at the row count as well —
[chunk 6](06-count-do-not-read.md).

## Interview questions

**★ What is subselect fetching?**
A fetching strategy where an uninitialised collection is loaded by a single
secondary select whose `where` clause contains the *original query* as a
subquery, rather than a list of owner ids. The javadoc's wording is "a secondary
select with a subselect that re-executes an initial query to load all instances
of the related entity or collection at once". The result is exactly two
statements, for any number of owners.

**★ How does it differ from batch fetching?**
Batch fetching enumerates the owners — `N` ids in ⌈N/k⌉ statements. Subselect
fetching *describes* them — no ids on the wire, one statement, and the driving
query re-executed inside it. Subselect always wins the statement count; batch
never pays for the driving query twice. Batch also works for `@ManyToOne` proxies
and after a `find()`; subselect does neither.

**★ Why does it need a query to have run?**
Because the subselect *is* the query. The introduction guide says
`@Fetch(SUBSELECT)` "has the same effect as `@Fetch(SELECT)`, except after
execution of a HQL or criteria query". After a lookup by id there is no
restriction to re-express, so the mode degrades to one select per collection —
which is fine, and is not what the annotation led the reader to expect.

**★ When would you choose it over a fetch join?**
When the fetch join would produce a Cartesian product — which is exactly the case
Hibernate's own guide names: fetching two many-valued associations in parallel
"would result in a cartesian product of tables, and a large SQL result set", and
"subselect fetching comes to the rescue here". Join-fetch one collection,
subselect the other. Outside that case the guide's advice stands: prefer the
join.

**★ What is the risk you are accepting when you turn it on?**
That the driving query runs twice. On a cheap indexed query that is close to
free; on an expensive one — a wide join, a full scan, a leading-wildcard `LIKE` —
you have doubled the expensive half of the request to remove ⌈N/k⌉ − 1 cheap
statements. The guide's reassurance is that the subselect "is likely to be
relatively inexpensive, since the data should already be cached by the database",
and *likely* and *should* are the words to check against your own query.

**★ Can you request subselect fetching for one query?**
Not with a graph and not with HQL — the introduction guide says so directly: "the
one and only advantage unique to fetch profiles is that they let us very
selectively request subselect fetching. We can't do that with entity graphs, and
we can't do it with HQL." So the mechanisms are the mapping annotation, the
global setting, `session.setSubselectFetchingEnabled(true)`, or a fetch profile.

**★ Would you enable it globally?**
No, not by default, and I would push back on treating it as the twin of
`hibernate.default_batch_fetch_size`. The batch setting adds a bounded `IN` list
to a statement that was going to be issued anyway; the subselect setting makes
every collection in the application re-run its owners' driving query, including
the collections whose owners came from the expensive queries. Enable it per role,
where you can see what the driving query is.

---

← Prev: [10c · Choosing a batch size](10c-choosing-a-batch-size.md) · Index: [08 · The N+1 problem](README.md) · Next → [11b · The subselect trap](11b-the-trap.md)
