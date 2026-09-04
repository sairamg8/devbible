---
title: "A native query is SQL in a string with no parse before production, no entity names, no portability and no automatic count query — which is a good trade only when JPQL genuinely cannot say what you need"
sidebar_label: "03g · Native queries"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", sections "Native Queries" and "Query Introspection and Rewriting"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html));
> the absence of validation read from
> [`NativeJpaQuery`](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/query/NativeJpaQuery.java).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Setting `nativeQuery = true` is not "the same query, written in SQL". It moves
the string out of everything Spring Data and Hibernate know how to reason about:
the query is no longer parsed at startup, the identifiers are no longer your
Java names, the dialect is no longer abstracted, `Sort` and `Pageable` can no
longer be applied reliably without help, and the result is no longer
automatically the shape the method promises. Every one of those is recoverable
with work. The point of this chunk is that the work is real, so the decision
should be, too.**

## The annotation, and its composed form

Two spellings, and the newer one is the better default:

```java
public interface UserRepository extends JpaRepository<User, Long> {

    @Query(value = "SELECT * FROM USERS WHERE EMAIL_ADDRESS = ?1", nativeQuery = true)
    User findByEmailAddress(String emailAddress);

    @NativeQuery("SELECT * FROM USERS WHERE EMAIL_ADDRESS = ?1")
    User findByEmailAddressToo(String emailAddress);
}
```

> "The `@NativeQuery` annotation is mostly a composed annotation for
> `@Query(nativeQuery=true)` but it also provides additional attributes such as
> `sqlResultSetMapping` to leverage JPA's `@SqlResultSetMapping(…)`."

Use `@NativeQuery`. It says what it is at the start of the line rather than in an
attribute at the end, and it is the only form that can reference a JPA result-set
mapping.

## What you give up, item by item

| You lose | Because | What it costs |
|---|---|---|
| the startup parse | `NativeJpaQuery` has no validation step | the query is first parsed by the database, on the first call |
| entity and field names | the string is SQL | a column rename breaks it silently at runtime, not at compile or boot |
| dialect independence | the string is your database's SQL | the query pins the application to PostgreSQL, and to a version of it |
| the automatic count query | only simple SQL can be introspected | `Page` needs JSqlParser or a hand-written `countQuery` |
| reliable dynamic sorting | `Sort` is appended to text nobody parsed | an alias or expression that works in JPQL may not survive here |
| the type mapping by default | JPA does not know what the columns are | you must say what to map to, or accept `Object[]`/`Tuple` |

🔴 **The first row is the one that changes engineering practice.** The identical
mistake — a typo, a renamed column, a table dropped by a migration — fails your
deployment when the query is JPQL and fails a user's request when it is native.
The mechanism is in
[03f · what is checked, and when](03f-what-is-checked-and-when.md): the class that
builds a JPQL query validates it, and the class that builds a native one does not.

⚠️ **So a native query method needs a test that actually executes it.** Not a
context-loads test — an execution against a real schema. That is the price of
admission, and it is the one thing that buys back most of what the table above
lists.

## What it does *not* change

Two symmetries that surprise people in both directions:

**Parameters are still bound.** `?1` and `:name` work exactly as they do in JPQL,
with the same rules —
[03c · binding parameters](03c-binding-parameters.md). Native SQL is not an excuse
to concatenate a value into the string; the injection risk arrives only if you
write it that way.

**Entities that come back are still managed.** If the method returns the domain
type and Spring Data can map the result to it, those instances enter the
persistence context and are dirty-checked like any other. A native `select *`
against the entity's own table is a normal load with an unusual spelling —
including the part where modifying the result inside the transaction produces an
`update` you did not ask for.

⚠️ **Native *writes* are a different matter and belong to
[04 · modifying queries](04-modifying-queries.md).** A native `update` or `delete`
goes straight to the database, so the persistence context is left holding stale
copies and the statement can be ordered before pending changes are flushed. That
argument, and the `@Modifying` attributes that control it, live in the next
chunk.

## When native is the right answer

The honest list is short, and every entry is "JPQL has no way to say this":

- **Window functions** — `row_number()`, `lag`, running totals, and the
  `partition by` clauses that make a report query one pass instead of N.
- **Common table expressions**, especially recursive ones for trees and
  hierarchies.
- **Database-specific operators and types** — PostgreSQL's `jsonb` operators,
  arrays, `tsvector` full-text search, ranges, `distinct on`.
- **`insert … on conflict`** and other upsert forms, which JPQL has no statement
  for at all.
- **Set operations and rewritten plans** that you arrived at from an execution
  plan, where the exact SQL is the deliverable.

And the honest counter-list — reasons that are *not* good enough on their own:

- **"SQL is easier to read."** It is, for the author, once. It is also the version
  nobody can validate before production.
- **"It will be faster."** Hibernate renders JPQL to SQL; the plan is usually the
  same. If it is not, the difference is worth measuring rather than assuming, and
  measuring it is how you find out that the real problem was fetching.
- **"I need three columns, not an entity."** That is a projection, and JPQL does
  it with a constructor expression —
  [06 · projections](06-projections.md).
- **"I need a left join."** JPQL has one.

🔴 **If a repository is accumulating native queries, the question is not "is this
one justified" but "is this still a repository".** Past a certain density, the
work belongs in a SQL-first component with its own tests and its own mapper —
[topic 05 · when SQL-first beats an entity](../05-sql-first-access/10-when-sql-first-beats-an-entity.md)
— or in a typed SQL builder, which is what **topic 13 · jOOQ** *(not written
yet)* is about. A repository interface with fifteen `@NativeQuery` methods has
all the costs of JPA and none of its benefits.

## Gotchas

**⚠️ Assuming a native query is validated at startup because a JPQL one is.**
It is not — there is no validation call in the class that builds it. The first
parse is the database's, on the first execution, in whatever environment that
happens to be.

**⚠️ Writing entity and field names into the SQL.**
`SELECT * FROM User u WHERE u.emailAddress = ?1` is JPQL wearing SQL's clothes.
It compiles, starts, and fails at execution against a table called `users` with a
column called `email_address`. The naming strategy is not applied to your string.

**⚠️ Forgetting the naming strategy exists at all.**
Boot's default converts `emailAddress` to `email_address`; a native query must
use whatever the strategy actually produced, not what you assume. Read the schema
or the migration, not the entity.

**⚠️ `select *` on an entity table and then adding a column to the entity.**
It keeps working, which is the trap: the query returns the new column too, and
the mapping picks it up. Then somebody adds a column to the *table* that the
entity does not have, and the behaviour depends on the provider rather than on
anything you decided.

**⚠️ Using a native query to avoid learning a JPQL construct.**
Left joins, `group by`, subqueries and constructor expressions are all available.
Each native query written for one of those is a permanent loss of validation in
exchange for a temporary saving.

**⚠️ Pinning the application to a database by accident.**
One `on conflict` or `jsonb` operator in one repository method and the test
suite can no longer run on H2. That may be the right call — it is not a call to
make without noticing, and it is not one to make casually in a codebase whose
tests depend on it.

**⚠️ Treating a native query as exempt from parameter binding.**
Concatenating a value into native SQL is real SQL injection, not the theoretical
kind. Binding works identically to JPQL here; there is never a reason to build
the string.

**⚠️ Expecting `Sort` to behave.**
Spring Data appends the ordering to a string it has not necessarily parsed. A
property name that is not a column, or an alias it cannot see, produces SQL the
database rejects — at runtime, again.

**⚠️ Assuming a native `select` refreshes what is in the persistence context.**
Entities already managed in the current context keep their in-memory state; a
query does not overwrite a managed instance with database values. That is a
persistence-context rule, and it applies to native queries exactly as to JPQL —
[06 · the persistence context](../06-jpa-hibernate-model/11-the-persistence-context.md).

**⚠️ Leaving a native query untested because "it is only SQL".**
It is the one kind of query in the codebase that nothing else checks. A native
query without an executing test is a string that has been read by one person,
once.

**⚠️ Copying a native query between environments with different schemas.**
Schema-qualified names, casing, and search-path assumptions all travel badly. If
the string contains a schema name, it has an environment baked into it.

**⚠️ Reaching for `@NativeQuery` when the real requirement is a stored
procedure.**
Spring Data has `@Procedure` for that, with its own semantics — and note from
[03f](03f-what-is-checked-and-when.md) that procedure query methods are skipped
by validation deliberately, so the trade there is different again.

## Interview questions

**★ What actually changes when you set `nativeQuery = true`?**
The string stops being JPQL and starts being SQL for your database, which means:
no startup validation, table and column names instead of entity and field names,
no dialect abstraction, no automatic count query for pagination, and no default
answer to what the result maps to. Binding and transaction behaviour are
unchanged.

**★ Why is losing the startup parse the important one?**
Because it converts a whole class of defects from failed deployments into
production incidents. A renamed column breaks a JPQL query before the application
starts and breaks a native query when a user hits that endpoint. Everything else
in the list is inconvenience; this one changes who finds the bug.

**★ How do you get that safety back?**
A test per native query method that executes it against a real schema — the same
schema shape your migrations produce. It is the only mechanism available, which
is why "native queries need tests" is a rule rather than a preference in a
JPA codebase.

**★ `@Query(nativeQuery = true)` or `@NativeQuery`?**
`@NativeQuery`, which the reference describes as mostly a composed annotation for
the other form. It reads better and it adds `sqlResultSetMapping` for referencing
a JPA `@SqlResultSetMapping`.

**★ Are the entities returned by a native query managed?**
Yes, when the result is mapped to the domain type. They join the persistence
context and are dirty-checked like anything else, so modifying one inside the
transaction writes an update. Only a projection or a `Tuple`/`Map` result avoids
that.

**★ Is a native query safe from injection?**
As safe as a JPQL one, provided you bind. Positional and named parameters work
identically. It becomes unsafe exactly when somebody assembles the string, which
is easier to do in a custom implementation than in an annotation — and that is
where it happens.

**★ Give three cases where native SQL is genuinely the right tool.**
Window functions; recursive CTEs; and database-specific features with no JPQL
spelling — `jsonb` operators, `distinct on`, full-text search, `insert … on
conflict`. In all three the SQL itself is the deliverable, not an implementation
detail.

**★ And a case where it is the wrong tool that people still use it for?**
Selecting a few columns instead of an entity. That is a projection, and JPQL
expresses it with a constructor expression while keeping the startup parse and
the portability. Reaching for native SQL there trades a permanent check for a
syntax preference.

**★ A repository has fifteen native queries. What do you conclude?**
That the data access is SQL-first and is pretending not to be. The honest options
are to move that work to `JdbcClient` or a typed SQL builder, where the SQL is
the model and the tests are shaped for it, or to find out why JPQL was not
sufficient — often it was, and native crept in one method at a time.

**★ Does using a native query pin you to a database?**
Only if you use something specific to it — but that is usually the reason you
went native in the first place. The thing to notice is that the pin lands on the
whole application, including its test strategy: one PostgreSQL-only operator and
an in-memory database is no longer a viable test target.

**★ What is the relationship between a native query and a stored procedure?**
Different tools. `@Procedure` calls a procedure with JPA's procedure support, and
notably repository query methods for procedures are skipped by the query
validation entirely. A native query with a `CALL` is a third option the reference
mentions; all three put the logic somewhere the Java build cannot check.

{/* FOOTER */}
