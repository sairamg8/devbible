---
title: "Hibernate 7.4 fixed pagination with a collection fetch join, and every article you will find on this is now wrong"
sidebar_label: "8d · Pagination"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against *What's New in 7.4* (version 7.4.6.Final), §*Limits
> and Fetch Joins*
> ([docs.hibernate.org/orm/7.4/whats-new/whats-new.html](https://docs.hibernate.org/orm/7.4/whats-new/whats-new.html)),
> the *7.4 Migration Guide* §*Limits and fetch joins*
> ([docs.hibernate.org/orm/7.4/migration-guide/migration-guide.html](https://docs.hibernate.org/orm/7.4/migration-guide/migration-guide.html)),
> the *Guide to Hibernate Query Language* §4.5.1 *Limits and offsets*
> ([docs.hibernate.org/orm/7.4/querylanguage/html_single/](https://docs.hibernate.org/orm/7.4/querylanguage/html_single/Hibernate_Query_Language.html)),
> and `org.hibernate.query.QueryLogging` and `org.hibernate.cfg.QuerySettings` in
> the Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/query/QueryLogging.java)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**🔴 For fifteen years the answer to "can I paginate a query with a collection
fetch join?" was no — Hibernate would fetch every matching row and apply the
limit in the JVM. Hibernate 7.4 fixed it. On PostgreSQL, and on every supported
database except Sybase ASE, `setMaxResults()` with a collection `join fetch` is
now processed in the SQL. This chunk is what changed, what the old warning
actually was, and what to do on each version.**

## Why it was ever a problem

A collection fetch join flattens the graph into a rectangle
([chunk 8b](08b-what-a-fetch-join-breaks.md)): one order with three lines is
three rows.

Now ask for "the first 10 orders". A SQL `LIMIT 10` counts **rows**, and rows are
no longer orders — ten rows might be three orders, one of which is missing two
of its lines because the limit cut it in half. The limit is expressed in the
wrong unit.

Hibernate's historical answer was to drop the `LIMIT` from the SQL, fetch every
row matching the `where` clause, assemble the entities, and take the first ten in
Java. Correct, and catastrophic: `findFirst10` against a million-row table reads
a million rows.

## What it logged, and it is not what you have read

Every article on this quotes `HHH000104`. **That is not the code Hibernate 7.4
emits.** The message is declared in `org.hibernate.query.QueryLogging`, whose
`@MessageLogger` uses `projectCode = "HHH"` and `@ValidIdRange(min = 90003001,
max = 90003500)`:

```java
@LogMessage(level = WARN)
@Message(value = "firstResult/maxResults specified with collection fetch; applying in memory",
         id = 90003004)
void firstOrMaxResultsSpecifiedWithCollectionFetch();
```

So on Hibernate 7.4 the code is **`HHH90003004`**, the level is **WARN**, and the
text ends without the exclamation mark that older versions had. If you are
grepping logs for `HHH000104` on a modern Hibernate, you will find nothing and
conclude you are safe.

## What 7.4 changed

The release notes are unambiguous. *What's New in 7.4*:

> *"It is now perfectly safe to combine a HQL `limit` or pagination using
> `setMaxResults()` with a collection `join fetch`, on any database which supports
> limits and offsets inside subqueries (which includes all the supported databases
> except Sybase ASE). Similarly, it's now safe to use a collection `join fetch`
> with `getResultStream()` or `scroll()`. In Hibernate 6, and in previous versions
> of Hibernate 7, the combination of limits/pagination with a many-valued fetch
> join forced Hibernate to fall back to applying the limit **in the JVM**, which
> usually exhibited terrible performance characteristics. **This problem is
> finally solved.** To recover the previous behavior, using the query hint
> `org.hibernate.limitInMemory`. Use of this hint will almost certainly harm
> performance."*

The migration guide says the same in one line:

> *"When pagination or a limit is used with a query which fetches a collection,
> the limit is now processed as part of the SQL query. To recover the previous
> behavior, set the query hint `org.hibernate.limitInMemory`."*

And the HQL guide dates it precisely:

> *"**Prior to Hibernate 7.4**, limits didn't play well with many-valued fetch
> joins. This problem is now fixed on any database that supports limits and
> offsets in subqueries. But when a limit or pagination is combined with a fetch
> join to a collection on a database which doesn't support this (notably, Sybase
> ASE), Hibernate must retrieve all matching results from the database and apply
> the limit in memory!"*

**The mechanism is a subquery.** Instead of limiting the joined result, Hibernate
limits the *parents* in a subquery and joins the children to that — so `LIMIT 10`
counts orders again, which is the unit you meant. It requires the database to
support `LIMIT`/`OFFSET` inside a subquery, which PostgreSQL 18 does and which
the notes say every supported database does except Sybase ASE.

The same release also made `getResultStream()` and `scroll()` safe with a
collection fetch, which were broken for the same reason.

## So on 7.4, this simply works

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    @Query(value = """
                   select o from Order o
                   left join fetch o.lines
                   where o.placedAt > :cutoff
                   """,
           countQuery = """
                        select count(o) from Order o
                        where o.placedAt > :cutoff
                        """)
    Page<Order> findRecentWithLines(@Param("cutoff") Instant cutoff, Pageable pageable);
}
```

⚠️ **The `countQuery` is still yours to supply, and it must not contain the fetch
join.** Spring Data derives a count query by rewriting the main one, and a
derived count over a fetch-joined query is at best meaningless. Write it
explicitly, over the parents only.

## The setting that is still there, and now reads differently

`hibernate.query.fail_on_pagination_over_collection_fetch` has existed since 5.2
and is still in `org.hibernate.cfg.QuerySettings` in 7.4. Its javadoc has been
rewritten to reflect the new world, and the conditional clause is the
interesting part:

> *"When pagination is used in combination with a `fetch join` applied to a
> collection or many-valued association, **and the database does not support
> `LIMIT` inside a subquery**, the limit must be applied in-memory instead of on
> the database. This typically has terrible performance characteristics and should
> be avoided. When enabled, this setting specifies that an exception should be
> thrown for any query which would result in the limit being applied in-memory."*
> — `@settingDefault false` (disabled) — *"no exception is thrown, and the
> possibility of terrible performance is left as a problem for the client to
> avoid."*

On PostgreSQL 18 that condition is never met, so on 7.4 the setting is inert —
there is no in-memory limit for it to catch. It remains worth setting to `true`
as a safety net: if you ever run against a database that cannot do it, you want
an exception rather than a silent full-table read.

What to do on each Hibernate version — including the two-query pattern you will
meet in every codebase written before this year — is
[chunk 8d2](08d2-paginating-on-older-versions.md).

## Gotchas

**⚠️ Grepping production logs for `HHH000104` on Hibernate 6 or 7.**
The code is `HHH90003004`. You will find nothing and conclude the problem is
absent. Grep the message text instead, which is stable across the rename:
`firstResult/maxResults specified with collection fetch`.

**⚠️ Assuming an article from last year is current.**
This changed in 7.4, released within the last year. Essentially everything
written about pagination and fetch joins predates it, including material that is
otherwise excellent. Check which version the article targets before believing it.

**⚠️ Letting Spring Data derive the count query for a fetch-joined `@Query`.**
Supply `countQuery` explicitly, over the parents only. A derived count over a
fetch join is meaningless and may not even parse.

**⚠️ Setting `org.hibernate.limitInMemory` to work around something.**
The release notes are blunt: "use of this hint will almost certainly harm
performance". It exists to restore pre-7.4 behaviour for compatibility, not as a
tuning option.

**⚠️ Leaving `fail_on_pagination_over_collection_fetch` at its default.**
It defaults to `false`, and the javadoc describes what that means with unusual
candour: "the possibility of terrible performance is left as a problem for the
client to avoid". On 7.4 with PostgreSQL it will never fire, which is exactly why
turning it on costs nothing and protects you against a future dialect change.

**⚠️ Assuming `getResultStream()` was always safe.**
It had the same problem for the same reason, and was fixed in the same release.
Streaming a collection fetch join before 7.4 also fell back to materialising
every matching row.

**⚠️ Reading "fixed" as "unconditionally fixed".**
The condition is that the database supports limits and offsets inside subqueries.
That is every supported database except Sybase ASE, so in practice it is
universal — but the mechanism is a subquery, and knowing that tells you both why
the exception exists and what to check if you ever meet a dialect that cannot.

## Interview questions

**★ Can you paginate a query with a collection fetch join?**
On Hibernate 7.4 and later, yes — this was fixed in that release, and it is one
of the most consequential recent changes in the ecosystem, because the previous
answer had been no for about fifteen years. The release notes say it is "now
perfectly safe to combine a HQL `limit` or pagination using `setMaxResults()`
with a collection `join fetch`, on any database which supports limits and offsets
inside subqueries", which is every supported database except Sybase ASE, so
PostgreSQL included. The mechanism is that Hibernate applies the limit to the
parents inside a subquery and joins the children to that result, which makes the
limit count parents rather than joined rows. On Hibernate 6 and on 7.0 through
7.3 the answer is still no — the limit is applied in the JVM after fetching every
matching row.

**★ Why was it a problem at all?**
Because a `LIMIT` counts rows and a collection fetch join makes rows stop
corresponding to entities. An order with three lines is three rows, so `LIMIT 10`
might return three orders, one of them missing two of its lines because the cut
fell in the middle of it. The limit is expressed in the wrong unit. Hibernate
could not simply push the limit down without returning partially-populated
collections, which would be a correctness bug rather than a performance one, so
it chose correctness and paid for it in the JVM. The 7.4 fix resolves the unit
mismatch properly: limit the parents in a subquery, then join the children to
those parents, so the limit counts what you meant.

**★ What did it log, and why does that detail matter?**
It logged a warning, and the code changed in a way that traps people. Everybody
quotes `HHH000104`, but in Hibernate 7.4 the message is declared in
`org.hibernate.query.QueryLogging` with `id = 90003004` under
`@ValidIdRange(min = 90003001, max = 90003500)`, so it appears as `HHH90003004`
at WARN level, with the text "firstResult/maxResults specified with collection
fetch; applying in memory" — and without the trailing exclamation mark older
versions had. It matters because a team grepping production logs for the old code
on a modern Hibernate will find nothing and wrongly conclude they are unaffected.
The robust thing to grep for is the message text, which survived the renumbering.

**★ What is `hibernate.query.fail_on_pagination_over_collection_fetch` and should
you set it?**
It is a setting that turns the in-memory-limit warning into an exception. It has
existed since 5.2 and is still present in 7.4, but its javadoc was rewritten to
add a condition: it applies when pagination is combined with a collection fetch
join *and the database does not support `LIMIT` inside a subquery*. On PostgreSQL
18 with Hibernate 7.4 that condition is never satisfied, so the setting is inert.
It is still worth enabling, because it costs nothing and protects against a
future change of database or dialect where the fallback would silently return.
Its default is `false`, and the javadoc is unusually frank about what that means:
"no exception is thrown, and the possibility of terrible performance is left as a
problem for the client to avoid."

**★ What is `org.hibernate.limitInMemory` for?**
It is a query hint added in 7.4 to restore the pre-7.4 behaviour of applying the
limit in the JVM. The release notes mention it as a compatibility escape and
immediately warn that "use of this hint will almost certainly harm performance".
The realistic reason to reach for it is a migration where some query depended on
the old semantics in a way that broke — which should be rare, since the old
behaviour produced the same results more slowly. It is not a tuning option, and
finding it in a codebase should prompt a question about what it was working
around, because the answer is more likely to be a misdiagnosis than a genuine
need.

**★ How would you find out whether this affects a service you have just
inherited?**
Check the Hibernate version first, because the answer is entirely determined by
it — 7.4 or later on PostgreSQL and there is nothing to find. Below that, grep
the logs for the message text rather than either error code, since the code
changed between 5 and 6 and grepping the wrong one produces a false negative.
Then look for the two structural fossils that indicate the team hit this: a
two-query pattern where ids are paged and then re-fetched, and any paginated
repository method whose `@Query` contains `join fetch`. The first is a correct
workaround you can now simplify; the second is an active bug on any version
before 7.4 and worth measuring immediately, because its cost is proportional to
the whole table rather than to the page size.

---

← Prev: [8c · Duplicates and distinct](08c-duplicate-parents-and-distinct.md) · Index: [08 · The N+1 problem](README.md) · Next → [8d2 · Paginating before 7.4](08d2-paginating-on-older-versions.md)
