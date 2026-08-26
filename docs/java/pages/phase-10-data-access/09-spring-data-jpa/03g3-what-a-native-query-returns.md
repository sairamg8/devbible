---
title: "For a native query the return type is the instruction — the domain type, an interface projection run as a Tuple, a Map of raw column names, or an explicit result-set mapping — and QueryRewriter is the last seam before the EntityManager sees the string"
sidebar_label: "03g3 · What a native query returns"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", sections "Native Queries" and "Applying a QueryRewriter"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html));
> result-type selection read from
> [`NativeJpaQuery.getTypeToQueryFor`](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/query/NativeJpaQuery.java);
> Jakarta Persistence 3.2 §3.10.16 (`@SqlResultSetMapping`).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**JPQL knows what it selected, because it selected entities and fields. Native SQL
returns columns, and nothing in the string says what they are for. So the mapping
decision moves to the method signature: the return type is what tells Spring Data
whether to build entities, proxy an interface over a `Tuple`, hand you raw
name/value pairs, or defer to a result-set mapping you declared. Getting this
wrong is the second most common native-query defect, after not testing it.**

## What comes back, and how to control it

For a native query, the return type is the instruction. Four shapes:

**The entity.** If the method returns the domain type, Spring Data asks the
`EntityManager` for a native query typed to that class, and the rows are mapped
by the entity's own mapping. Columns the entity does not know about are not
mapped.

**An interface projection.** Read from the source: when the returned type is
projecting and is an interface, the query is created for `Tuple.class` and the
proxy is built from the tuple. That is why an interface projection over a native
query needs its column *aliases* to match the accessor names.

**A DTO or class projection.** When the query carries a constructor expression or
is a default projection, the domain type is used; otherwise the returned type
itself is queried for. In practice the reliable native spelling is aliases plus
an interface projection, or an explicit `@SqlResultSetMapping` referenced with
`@NativeQuery(sqlResultSetMapping = …)`.

**Raw column name/value pairs.** Choosing `Map` as the container gives you the
`Tuple` directly:

```java
interface UserRepository extends JpaRepository<User, Long> {

    @NativeQuery("SELECT * FROM USERS WHERE EMAIL_ADDRESS = ?1")
    Map<String, Object> findRawMapByEmail(String emailAddress);

    @NativeQuery("SELECT * FROM USERS WHERE LASTNAME = ?1")
    List<Map<String, Object>> findRawMapByLastname(String lastname);
}
```

> "The resulting map contains key/value pairs representing the actual database
> column name and the value."

🔴 **That form is Hibernate-only.** *"String-based Tuple Queries are only
supported by Hibernate. Eclipselink supports only Criteria-based Tuple Queries."*
It is a perfectly good escape hatch for a reporting endpoint, and it is another
brick in the wall between your application and a different provider.

## Rewriting the query on the way out

When nothing else fits, `QueryRewriter` gives you the string immediately before
it reaches the `EntityManager`:

```java
public class MyQueryRewriter implements QueryRewriter {

    @Override
    public String rewrite(String query, Sort sort) {
        return query.replaceAll("original_user_alias", "rewritten_user_alias");
    }
}
```

```java
@NativeQuery(value = "select original_user_alias.* from SD_USER original_user_alias",
        queryRewriter = MyQueryRewriter.class)
List<User> findByNativeQuery(String param);
```

The rewriter must be a bean — *"whether it's by applying one of Spring
Framework's `@Component`-based annotations, or having it as part of a `@Bean`
method"* — and a repository may implement the interface itself and name itself as
its own rewriter.

⚠️ **Two subtleties in the reference worth carrying:** rewriting applies *"to the
actual query and, when applicable, to count queries"*, and count queries are
*"optimized and therefore, either not necessary or a count is obtained through
other means, such as derived from a Hibernate `SelectionQuery` if there is an
enclosing transaction."* So a rewriter that assumes it will always see the count
query is assuming something the documentation does not promise.

## Gotchas

**⚠️ Expecting an interface projection to work without aliases.**
The native path queries for a `Tuple`, so the accessor names have to line up with
the labels the database returns. `select first_name` with a `getFirstName()`
accessor is a mismatch, and it reports as "everything is null" rather than as an
error.

**⚠️ Relying on column *order* rather than labels.**
`Object[]` results are positional, so adding a column to the `select` list
reorders everything after it. Every consumer of that array breaks silently — a
`ClassCastException` at best, a wrong value at worst.

**⚠️ Assuming `Map` results are portable.**
String-based tuple queries are Hibernate-only, as the reference states. It is a
good escape hatch for a reporting endpoint and one more thing pinning the
application to its provider.

**⚠️ Returning the entity from a native query that does not select every mapped
column.**
The mapping expects the columns it knows about. A partial `select` mapped to the
domain type is a request for trouble that varies by provider — say what you
selected with a projection instead.

**⚠️ Selecting `*` and letting the entity mapping sort it out.**
It works until the table gains a column the entity does not have, or the entity
gains a field the query does not select. Both are silent for a while, which is
what makes them expensive.

**⚠️ Forgetting that entities returned this way are managed.**
A native `select` mapped to the domain type puts managed instances in the
persistence context. Modify one inside the transaction and Hibernate writes an
update at flush — the "read-only report query" that quietly writes.

**⚠️ Registering an `@SqlResultSetMapping` and referencing it from the wrong
annotation.**
`sqlResultSetMapping` is an attribute of `@NativeQuery`; the plain
`@Query(nativeQuery = true)` form has no way to name one. This is the concrete
reason to prefer the composed annotation.

**⚠️ Reaching for `QueryRewriter` as a first resort.**
It is a string-replacement hook running before every execution. Anything you can
express in the query itself, in a parameter, or in the return type belongs there
instead; a rewriter is what you use when there is genuinely no other seam.

**⚠️ Writing a rewriter and not registering it as a bean.**
The class named in `queryRewriter` is looked up in the application context. A
plain class with no `@Component` and no `@Bean` method is not found, and the
failure is about a missing bean rather than about your query.

**⚠️ Assuming the rewriter always sees the count query.**
Rewriting applies to the actual query and, where applicable, to count queries —
but the reference notes counts are optimised and may not be needed at all, or may
be obtained from a Hibernate `SelectionQuery` when there is an enclosing
transaction. Do not build a rewriter that depends on it.

**⚠️ Doing a `replaceAll` in a rewriter without anchoring it.**
The rewriter's own documented example replaces an alias by name. A loose regular
expression over arbitrary SQL will eventually match inside a string literal or a
column name, and the result is a query that is wrong in one case out of a
thousand.

**⚠️ Putting business logic in the rewriter.**
It runs on every execution, has no access to the arguments, and is invisible from
the repository method. A tenant filter or a soft-delete predicate added there is a
rule nobody reading the query will see.

## Interview questions

**★ How does a native query decide what to map the result to?**
From the method's return type. The domain type produces a typed native query; an
interface projection is run as a `Tuple` query and proxied; a `Map` container
gives you column-name/value pairs directly; and `@SqlResultSetMapping` referenced
from `@NativeQuery` gives you explicit control.

**★ Why does an interface projection over native SQL need aliases?**
Because the values arrive as a `Tuple` keyed by the labels the database returned,
and the projection proxy resolves accessors against those labels. Without aliases
matching the accessor names, the properties do not resolve — and the symptom is
nulls, not an exception.

**★ What is Hibernate-specific about `Map` results?**
The reference states that string-based tuple queries are supported only by
Hibernate; EclipseLink supports tuple queries only through the Criteria API. So
the `Map` return shape is convenient and provider-locking at the same time.

**★ When would you use `@SqlResultSetMapping`?**
When the result is a fixed, non-trivial shape you want declared once — several
entities from one query, an entity plus scalar columns, or a constructor mapping.
It is the JPA-standard answer, and `@NativeQuery(sqlResultSetMapping = …)` is how
a repository method references it.

**★ Are the entities from a native query managed?**
Yes, when the result is mapped to the domain type — they join the persistence
context and are dirty-checked like any other. That is easy to forget on a query
written to look like a report, and it is one reason a projection is the better
default for read-only work.

**★ What happens if the native query selects fewer columns than the entity maps?**
It is provider-dependent and none of the outcomes are good. The correct move is
to stop claiming the result is the entity: project to an interface, a DTO or a
result-set mapping that describes exactly what you selected.

**★ What is `QueryRewriter` for?**
It hands you the query string immediately before it goes to the `EntityManager`,
so you can alter it — an alias rename, a hint, a comment. It applies to JPQL and
native queries alike, it must be a bean, and a repository may implement the
interface for itself and name itself as its own rewriter.

**★ Does a rewriter also see the count query?**
Sometimes. Rewriting applies to the actual query and, where applicable, to count
queries, but the reference notes that counts are optimised and may not be
necessary, or may be obtained through other means. A rewriter that must run on
the count query is relying on something undocumented.

**★ What would make you reject a `QueryRewriter` in review?**
Business rules inside it — a tenant predicate, a soft-delete filter — because it
runs invisibly on every query and has no access to the arguments. Also an
unanchored `replaceAll` over arbitrary SQL, which will eventually match something
it should not.

**★ You need a paged report over a `group by` query in native SQL. Walk through
it.**
Return a `Slice` if the total is not needed. If it is, write the count explicitly
as a count over the grouped result rather than `count(*)` on the base table.
Alias every selected column, project to an interface or a result-set mapping
rather than to the entity, and write an executing test — because none of the
strings involved is validated before it runs.

**★ At what point would you stop doing this in a repository at all?**
When the return type stops resembling the domain model and the SQL starts being
the deliverable. At that point the work belongs in a SQL-first component with its
own row mappers and tests, where nobody has to pretend a report is an entity.

{/* FOOTER */}
