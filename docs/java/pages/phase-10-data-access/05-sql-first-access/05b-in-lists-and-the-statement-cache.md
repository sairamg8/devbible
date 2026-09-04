---
title: "`IN (:ids)` expands into one `?` per element, so the SQL text changes with the list length — and that is what wrecks the statement cache"
sidebar_label: "5b · `IN` lists and the cache"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> Common Problems with Parameter and Data Value Handling*
> ([docs.spring.io/.../jdbc/parameter-handling.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/parameter-handling.html)),
> the `NamedParameterUtils.substituteNamedParameters` source in spring-framework
> `main`
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/core/namedparam/NamedParameterUtils.java)),
> and the pgJDBC documentation for `prepareThreshold`,
> `preparedStatementCacheQueries` and `preparedStatementCacheSizeMiB`
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/)).
> JDK 25, Spring Framework 7.0.9, PostgreSQL 18, pgJDBC 42.7.x.

**Spring's named-parameter support lets you bind a whole collection to one
placeholder, which looks like it solved the `IN (?)` problem from
[Topic 01](../01-jdbc/08-in-lists-and-like-patterns.md). It did not — it moved it.
The reference calls the mechanism "dynamic SQL generation", and that is exactly
what it is: the statement sent to the server has one `?` per element, so a
three-element list and a four-element list are two different SQL strings. Every
caching layer between you and the database is keyed on that string.**

## What the expansion does

```java
jdbcClient
    .sql("select id, email from customers where id in (:ids)")
    .param("ids", List.of(11L, 12L, 13L))
    .query(CustomerRow.class)
    .list();
```

The reference describes the approach:

> "The named parameter support provided in the `NamedParameterJdbcTemplate` takes
> the approach of dynamic SQL generation. You can pass in the values as a
> `java.util.List` (or any `Iterable`) of simple values. This list is used to insert
> the required placeholders into the actual SQL statement and pass in the values
> during statement execution."

and the source is a plain loop — one `?` per element, joined with `", "`. So the
driver receives:

```sql
select id, email from customers where id in (?, ?, ?)
```

There is a second form. If the elements are `Object[]`, each becomes a
parenthesised tuple, which is how you express a multi-column `IN`:

```java
.param("pairs", List.of(new Object[]{1L, "Johnson"}, new Object[]{2L, "Harrop"}))
```

```sql
select * from t_actor where (id, last_name) in ((?, ?), (?, ?))
```

The reference notes the obvious caveat: "this, of course, requires that your
database supports this syntax." PostgreSQL does.

## The documented limit, and the undocumented cost

Spring's own warning is about size:

> "Be careful when passing in many values. The JDBC standard does not guarantee
> that you can use more than 100 values for an `IN` expression list. Various
> databases exceed this number, but they usually have a hard limit for how many
> values are allowed. For example, Oracle's limit is 1000."

That is worth knowing, but on PostgreSQL it is rarely what hurts. The cost that
actually shows up is **cache churn**, and it has two layers.

**Layer one — pgJDBC's client-side statement cache.** The driver caches parsed
statements keyed on the SQL text, bounded by `preparedStatementCacheQueries`
(default `256`) and `preparedStatementCacheSizeMiB` (default `5`), per connection.
An endpoint whose `IN` list length varies between 1 and 300 across requests
produces up to 300 distinct SQL strings for **one query**. That alone can evict
every other statement your application uses, on every pooled connection.

**Layer two — the server-side prepare threshold.** pgJDBC only creates a named
server-side statement after the same SQL text has executed `prepareThreshold`
times, default **5**. A list length you see once never gets there. So the query
that you carefully wrote as a `PreparedStatement` is re-parsed and re-planned on
every execution, forever.

Both mechanisms — and their limits — are
**[Server-side prepared statements](../01-jdbc/09-server-side-prepared-statements.md)**;
this chunk is only about the fact that an expanding `IN` list is an unusually
efficient way to defeat them.

## The PostgreSQL answer: one parameter, always

Bind an **array** instead of expanding a list, and the SQL text stops varying:

```java
jdbcClient
    .sql("select id, email from customers where id = any(:ids)")
    .param("ids", ids.toArray(Long[]::new))
    .query(CustomerRow.class)
    .list();
```

One `?`. One SQL string, for every list length from zero to a million. The
statement caches at both layers see a single entry, the prepare threshold is
reached after five calls whatever the sizes were, and the 100-value JDBC caveat
does not apply because there is no expression list. `= ANY(array)` is argued in
full in
**[`IN (?)` and the PostgreSQL answer](../01-jdbc/08-in-lists-and-like-patterns.md)**.

The trade is portability: `= ANY(?)` is PostgreSQL syntax. If a repository must run
against more than one database, the expanding form is the portable one, and then
the mitigation is to **bucket the list length** — pad to the next power of two, or
to the next multiple of ten, with a repeated value — so that a hundred distinct
lengths collapse into six or seven SQL strings.

## The empty list

`in ()` is a syntax error in PostgreSQL, and the substitution loop appends one
placeholder per element — so an empty collection leaves nothing between the
parentheses and produces exactly that. **An empty `IN` list is a failure, not an
empty result.**

Every call site that expands a collection therefore needs a guard:

```java
if (ids.isEmpty()) {
    return List.of();
}
```

`= any(?)` with an empty array does not need one: it is a well-formed statement
that matches nothing, and returns an empty result. That is a quiet but real
argument for the array form, because the guard is the kind of thing that gets
written on three of four call sites.

## Gotchas

**An empty collection produces `in ()`, which does not parse.** The failure is a
SQL syntax error, translated to `BadSqlGrammarException`, arriving from a query
that is correct for every non-empty input. It therefore reaches production, because
the test data always had at least one id. Guard the call site, or use `= any(?)`.

**A varying list length silently disables server-side prepared statements.**
Nothing reports this. The query keeps working; it is simply re-parsed and re-planned
every time and never reaches `prepareThreshold`. The symptom is a query that is
slower than its `EXPLAIN` suggests, which is a hard thing to attribute.

**One expanding `IN` list can evict every other statement in the cache.** The
client-side cache is per connection and bounded at 256 queries by default. A single
endpoint that varies its list length across a few hundred values will churn the
whole cache, so the *other* queries in your application — the ones you never
touched — also stop being prepared. This is why the effect is often noticed as a
general slowdown rather than as a problem with the query that caused it.

**`null` inside the collection does not do what SQL users expect.**
`where id in (?, ?, ?)` with a `null` among the values is not "match rows with a
null id" — SQL's three-valued logic means `id = NULL` is never true. This is not a
Spring behaviour, it is SQL, and the expansion makes it easy to hit because the
collection came from somewhere else. Filter nulls out before binding, and handle
"is null" as its own condition.

**The tuple form requires `Object[]`, not `List`.** The substitution code checks
`entryItem instanceof Object[]`. A `List<List<Object>>` does not match, so each
inner list is bound as a single value and the SQL is `in (?, ?)` with two list
objects for parameters, which fails at bind time with a message about an
unsupported type. Use `List<Object[]>`.

**Bucketing the length changes the results if you pad carelessly.** Padding a list
of ids to a fixed length by repeating the last element is safe for `IN`, because
`IN` is a set membership test and duplicates do not change the answer. Padding with
`null` is not safe in the sense above, and padding with `0` or `-1` is only safe if
those can never be real ids. If in doubt, repeat an existing element.

**`= ANY(?)` needs a real SQL array, not a Java `List`.** Binding a `List` to that
placeholder does not work; the driver needs an array. `Long[]` via
`toArray(Long[]::new)` works with pgJDBC, and
`Connection.createArrayOf` is the portable route — both are covered in
**[`IN (?)` and the PostgreSQL answer](../01-jdbc/08-in-lists-and-like-patterns.md)**.

## Interview questions

**★ How does Spring support `where id in (:ids)` when JDBC has no such feature?**
By generating SQL. `NamedParameterUtils.substituteNamedParameters` sees that the
bound value is an `Iterable` and emits one `?` per element, joined with commas, in
place of the single named placeholder. The reference calls this "the approach of
dynamic SQL generation". So the statement the driver receives has as many
placeholders as the list had elements, and the values are bound positionally as
usual. There is a second form for multi-column membership: if the elements are
`Object[]`, each is emitted as a parenthesised tuple, producing
`(id, last_name) in ((?, ?), (?, ?))`.

**★ What is wrong with an expanding `IN` list on PostgreSQL?**
The SQL text changes with the number of elements, and everything that caches a
statement is keyed on that text. pgJDBC's client-side cache holds
`preparedStatementCacheQueries` entries — 256 by default — per connection, so an
endpoint whose list length varies over a few hundred values can churn the entire
cache and evict statements belonging to unrelated queries. And pgJDBC only promotes
a statement to a server-side named one after `prepareThreshold` executions of the
same text, five by default, so a length you only ever see once is re-parsed and
re-planned every single time. The query still returns the right answer, which is
what makes it hard to spot.

**★ What would you write instead?**
On PostgreSQL, `where id = any(:ids)` with a single array parameter. That is one
placeholder and therefore one SQL string regardless of how many ids there are, so
both cache layers see one entry, the prepare threshold is reached normally, and
there is no expression-list length limit to worry about. It also removes the
empty-list special case. The cost is that it is PostgreSQL syntax — if the code has
to be portable, keep the expanding form and bucket the length to a small set of
sizes so that you generate six SQL strings instead of three hundred.

**★ What happens with an empty collection?**
It generates `in ()`, which is a syntax error — the substitution loop appends one
placeholder per element and an empty collection has none. So you get a
`BadSqlGrammarException` from a query that is correct for every non-empty input,
which means it survives testing and fails in production the first time a caller
passes an empty set. Every expanding call site needs an explicit empty check. `=
any(?)` with an empty array has no such problem: it is a valid statement that
simply matches nothing.

**★ Spring's documentation warns about 100 values. Is that the real limit?**
It is a portability warning rather than a PostgreSQL one. The reference says the
JDBC standard does not guarantee more than 100 values in an `IN` expression list
and gives Oracle's hard limit of 1000. PostgreSQL has no such small limit — you will
hit the protocol's parameter count ceiling long before anything about `IN` — so on
PostgreSQL the thing that actually bites first is the cache churn, not the list
size. Both point at the same fix.

**★ Is `IN (:ids)` an injection risk, since Spring is generating SQL?**
No. What is generated is the *placeholders*, never the values — the loop appends
literal `?` characters and the elements are then bound through
`PreparedStatement.setObject` exactly as any other parameter would be. The
generated text depends only on the size of the collection and on nothing a user
supplies. So the injection story is unchanged from
`PreparedStatement`: the values never become part of the statement.

---

← Prev: [5 · Named parameters](05-named-parameters.md) · Index: [05 · SQL-first access](README.md) · Next → [6 · The exception hierarchy](06-the-exception-hierarchy.md)
