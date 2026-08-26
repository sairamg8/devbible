---
title: "Four derived-query keywords carry behaviour the method name does not show: Containing escapes your wildcards, IgnoreCase wraps the column in a function, mixed And/Or groups the wrong way, and IsEmpty is a subquery"
sidebar_label: "02c · Like, IgnoreCase and grouping"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html))
> and "Repository query keywords"
> ([query-keywords-reference.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-keywords-reference.html)),
> plus the PostgreSQL 18 manual on expression indexes
> ([indexes-expressional.html](https://www.postgresql.org/docs/18/indexes-expressional.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> Jakarta Persistence 3.2, PostgreSQL 18.

**The keyword table tells you which JPQL fragment each keyword becomes. It does
not tell you what that fragment does to your input, your indexes or your
intended grouping — and four keywords change all three. `Containing` sanitises
the argument so a user cannot supply a pattern. `IgnoreCase` wraps the column in
`UPPER(…)`, which no ordinary index can answer. A mixed `And`/`Or` name is parsed
as a disjunction of conjunctions, so the grouping you meant may not be the one
you got. And `IsEmpty` is a subquery against a child table wearing a four-word
method name.**

## The `like` family escapes your input, and that is not obvious

`StartingWith`, `EndingWith` and `Containing` do not just concatenate `%` onto
your argument. The reference:

> *"Derived queries with the predicates `IsStartingWith`, `StartingWith`,
> `StartsWith`, `IsEndingWith`, `EndingWith`, `EndsWith`, `IsNotContaining`,
> `NotContaining`, `NotContains`, `IsContaining`, `Containing`, `Contains` the
> respective arguments for these queries will get sanitized. This means if the
> arguments actually contain characters recognized by `LIKE` as wildcards these
> will get escaped so they match only as literals. The escape character used can
> be configured by setting the `escapeCharacter` of the `@EnableJpaRepositories`
> annotation."*

So `findByNameContaining("50%")` searches for the literal text `50%`, not for
"anything, then 50, then anything". That is the right default — a search box that
lets a user type `%` and scan the table is a real availability problem — but it
means `Containing` cannot be used to accept user-supplied patterns.

🔴 **The plain `Like` and `NotLike` keywords are *not* on that list.** They bind
the argument as-is, wildcards and all, and the caller has to supply the `%`:

```java
List<User> findByFirstnameLike(String pattern);   // caller passes "Pet%"
List<User> findByFirstnameContaining(String s);   // Spring wraps and escapes
```

Two methods, one letter of difference in intent, and opposite trust
assumptions about the argument. If the value came from a request, `Containing`
is the one you want.

## `IgnoreCase` is a function on the column

`findByEmailIgnoreCase` renders `where UPPER(x.email) = UPPER(?1)`. That is a
correct case-insensitive comparison and a well-known way to stop using an index:
a plain B-tree index on `email` cannot answer a predicate on `upper(email)`.

On PostgreSQL the fix is an expression index matching the predicate:

```sql
CREATE INDEX idx_users_email_upper ON users (upper(email));
```

or, better for an email column, storing it normalised on write so no function is
needed at read time at all. `AllIgnoreCase` multiplies the problem across every
string property in the predicate, so a three-property `AllIgnoreCase` finder
needs three matching expression indexes to stay indexed.

⚠️ **This is the keyword most likely to be added late and cheaply** — a bug
report says search is case-sensitive, someone appends `IgnoreCase`, the test
passes on a table of forty rows, and the plan changes on a table of forty
million.

## `And`, `Or`, and the grouping you cannot express

The parser splits the predicate on `Or` first and then splits each piece on
`And`, so a mixed name reads as a disjunction of conjunctions:

```java
// (status = ?1 and total > ?2) or expedited = ?3
List<Order> findByStatusAndTotalGreaterThanOrExpedited(
        OrderStatus status, Money total, boolean expedited);
```

⚠️ **The reference does not spell this grouping out**, and the method name
certainly does not. There is no parenthesis in the grammar, so the moment a
predicate needs `a and (b or c)` the derived form cannot express it — and, worse,
a name that *looks* like it expresses it will compile into something else. When
grouping matters, write the JPQL: [03 · `@Query`](03-at-query-jpql.md).

## Emptiness is not nullness

`IsNull` tests a column; `IsEmpty` tests a collection association.

```java
List<Order> findByCancelledAtIsNull();      // scalar column IS NULL
List<Order> findByLinesIsEmpty();           // no rows in the child table
```

`IsEmpty` renders as a JPQL `is empty` on the collection, which becomes a
correlated subquery or an anti-join in SQL. It is not free, and on a large child
table it is frequently the slowest predicate in a method name that looks
harmless. Applying it to a scalar property is a bootstrap failure.

⚠️ **`Containing` against a collection property is a different operation
entirely** — a membership test rather than a `like`. The JPA reference's table
documents only the string case, so if you use it on an association, check the
generated SQL before relying on the shape. Turning the SQL on is
[topic 08 · turning the SQL on](../08-the-n-plus-1-problem/05-turning-the-sql-on.md).

## Gotchas

**⚠️ Using `Like` where you meant `Containing`.**
`Like` binds the argument verbatim, so a caller that does not add `%` gets an
exact match and a caller that types `%` gets a full scan. `Containing` wraps and
escapes. For anything user-supplied, `Like` is an injection-shaped problem — not
SQL injection, but pattern injection, which on a big table is a denial of service.

**⚠️ Expecting `Containing` to accept a pattern.**
It escapes wildcards deliberately. A search feature that is supposed to support
`*` or `%` needs an explicit `@Query` with a bound pattern, or the SpEL escaping
form the reference shows for partial escaping.

**⚠️ Adding `IgnoreCase` without adding a matching expression index.**
`UPPER(x.email) = UPPER(?1)` cannot use a plain index on `email`. The query stays
correct and stops being indexed, and the regression shows up as a gradual
slowdown rather than a failure.

**⚠️ Reaching for `AllIgnoreCase` as a convenience.**
It applies to *"all suitable properties"* in the predicate, so one keyword can
de-index three columns at once. It is also invisible in a code review that scans
for `IgnoreCase` on individual properties.

**⚠️ Writing a mixed `And`/`Or` name and assuming your own grouping.**
The parser splits on `Or` first. `findByAAndBOrC` is `(A and B) or C`, never
`A and (B or C)`. There is no way to write the second in a method name, and the
first is easy to write by accident when you meant the second.

**⚠️ Using `IsEmpty` on a large collection without looking at the plan.**
It becomes a subquery or anti-join against the child table. The method name is
four words; the query can be the most expensive thing on the page.

**⚠️ Escaping the argument and then wondering why an admin search cannot use
`%`.**
The sanitisation is unconditional for `Containing` and friends — there is no
"trusted caller" mode. A deliberate pattern search needs `Like` with a
caller-supplied pattern, or an explicit `@Query` using the reference's SpEL
`escape([0])` form so you control exactly what is escaped.

**⚠️ Normalising case in Java instead of in the query, and forgetting one call
site.**
Lower-casing the argument before calling `findByEmail` only works if every write
path also normalised the column. Half-normalised data is worse than an
unindexed `UPPER(…)`, because it fails by returning nothing rather than by
being slow.

**⚠️ Reading `findByLinesIsEmpty` as cheap because the collection is small.**
The collection's size is not what the database evaluates — it evaluates an
anti-join or a correlated subquery over the whole child table. Small parents with
a huge child table is exactly the shape where this is slowest.

**⚠️ Using `Containing` on a collection association and assuming it is a
`like`.**
On an association it is a membership test, not a string match. The JPA
reference's table documents only the string case, so confirm the generated SQL
before building on it.

## Interview questions

**★ What is the difference between `Like` and `Containing`?**
`Like` binds the argument verbatim — the caller supplies the wildcards.
`Containing` wraps the argument in `%` *and sanitises it*, escaping any `LIKE`
metacharacters so they match literally. For a value that came from a user,
`Containing` is the safe one; `Like` lets the user write the pattern.

**★ How do you change the escape character used for that sanitisation?**
The `escapeCharacter` attribute of `@EnableJpaRepositories`. It matters when your
data legitimately contains the default escape character, which would otherwise
need escaping itself.

**★ What SQL does `IgnoreCase` generate, and what does it cost?**
`where UPPER(x.firstname) = UPPER(?1)`. The cost is that a plain index on the
column no longer matches the predicate; you need an expression index on
`upper(col)`, or a normalised column written at insert time. `AllIgnoreCase`
applies the same transformation to every suitable property in the predicate.

**★ How does Spring Data group `findByAAndBOrC`?**
As `(A and B) or C` — the predicate is split on `Or` first, then each part on
`And`. There is no parenthesis in the grammar, so `A and (B or C)` cannot be
expressed as a method name at all. That is one of the clearest signals to move
to `@Query` or a `Specification`.

**★ What is the difference between `IsNull` and `IsEmpty`?**
`IsNull` tests a scalar column for `null`. `IsEmpty` tests a collection
association for having no rows, and renders as JPQL `is empty` — a correlated
subquery or anti-join in SQL. Using `IsEmpty` on a scalar is a bootstrap failure,
and using it on a large child table is a performance decision disguised as a
keyword.

**★ Why can a derived method name not express `A and (B or C)`?**
Because there is no grouping token in the grammar. The parser splits the
predicate on `Or` and then on `And`, which always yields a disjunction of
conjunctions. Anything else has to be written as JPQL or built as a
`Specification`.

**★ How would you support a search box that allows wildcards?**
Not with `Containing`, which escapes them. Either accept a pattern explicitly and
use `Like`, validating or bounding it first, or write a `@Query` and control the
escaping yourself — the reference shows the SpEL form
`like %?#{escape([0])}% escape ?#{escapeCharacter()}` for partial escaping.

**★ A case-insensitive search got slow after a release. What would you look
for?**
An `IgnoreCase` or `AllIgnoreCase` added to a derived method. It changes the
predicate to `UPPER(col) = UPPER(?)`, which a plain B-tree index on `col` cannot
serve. The fixes are an expression index on `upper(col)`, or normalising the
column on write so the query needs no function at all.

**★ Why is `AllIgnoreCase` worse than `IgnoreCase` in review?**
Because it is one token that changes every suitable property in the predicate. A
reviewer scanning for per-property `IgnoreCase` will not see three columns being
de-indexed at once.

{/* FOOTER */}
