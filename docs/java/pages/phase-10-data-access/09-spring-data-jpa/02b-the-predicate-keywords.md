---
title: "The predicate half of a method name is a keyword grammar with two tables behind it — a store-neutral one that lists keywords JPA cannot render, and a JPA one that shows exactly which JPQL fragment each keyword becomes"
sidebar_label: "02b · The predicate keywords"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Repository query
> keywords"
> ([query-keywords-reference.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-keywords-reference.html)),
> "JPA Query Methods"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html))
> and "Query by Example"
> ([query-by-example.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-by-example.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> Jakarta Persistence 3.2, PostgreSQL 18.

**Once the subject has decided what kind of statement to build, everything after
the `By` is parsed as a predicate: property references separated by keywords,
each keyword mapping to a JPQL fragment and consuming a fixed number of method
arguments. Two tables define that mapping, and they are not the same table — the
store-neutral one contains `Near`, `Within` and `Regex`, which JPA cannot render.
Reading the JPA-specific one closely is worth the five minutes, because it is
where you learn that a `null` argument silently changes `=` into `is null`, that
`Containing` escapes wildcards in your input, and that `IgnoreCase` wraps the
column in a function.**

## The store-neutral keywords

This is Spring Data's own list, shared by every module. The left column is the
logical keyword; the right is every spelling that maps to it.

| Logical keyword | Spellings |
|---|---|
| `AND` | `And` |
| `OR` | `Or` |
| `AFTER` | `After`, `IsAfter` |
| `BEFORE` | `Before`, `IsBefore` |
| `CONTAINING` | `Containing`, `IsContaining`, `Contains` |
| `BETWEEN` | `Between`, `IsBetween` |
| `ENDING_WITH` | `EndingWith`, `IsEndingWith`, `EndsWith` |
| `EXISTS` | `Exists` |
| `FALSE` | `False`, `IsFalse` |
| `GREATER_THAN` | `GreaterThan`, `IsGreaterThan` |
| `GREATER_THAN_EQUALS` | `GreaterThanEqual`, `IsGreaterThanEqual` |
| `IN` | `In`, `IsIn` |
| `IS` | `Is`, `Equals`, or no keyword at all |
| `IS_EMPTY` | `IsEmpty`, `Empty` |
| `IS_NOT_EMPTY` | `IsNotEmpty`, `NotEmpty` |
| `IS_NOT_NULL` | `NotNull`, `IsNotNull` |
| `IS_NULL` | `Null`, `IsNull` |
| `LESS_THAN` | `LessThan`, `IsLessThan` |
| `LESS_THAN_EQUAL` | `LessThanEqual`, `IsLessThanEqual` |
| `LIKE` | `Like`, `IsLike` |
| `NEAR` | `Near`, `IsNear` |
| `NOT` | `Not`, `IsNot` |
| `NOT_IN` | `NotIn`, `IsNotIn` |
| `NOT_LIKE` | `NotLike`, `IsNotLike` |
| `REGEX` | `Regex`, `MatchesRegex`, `Matches` |
| `STARTING_WITH` | `StartingWith`, `IsStartingWith`, `StartsWith` |
| `TRUE` | `True`, `IsTrue` |
| `WITHIN` | `Within`, `IsWithin` |

Plus three modifiers: `IgnoreCase`/`IgnoringCase` for one property,
`AllIgnoreCase`/`AllIgnoringCase` for *"all suitable properties"*, and
`OrderBy…` for a static sort — which is
[02e · limiting and static ordering](02e-limiting-and-static-ordering.md).

⚠️ **`Near`, `Within` and `Regex` are in that table because it is Spring Data's,
not JPA's.** They belong to geospatial and document stores. The JPA reference's
own keyword table omits them, and the Query by Example page states flatly that
*"Regex-matching is not supported by JPA"*. Treat the store-neutral table as the
vocabulary and the JPA table below as the subset you can actually spend.

## What each keyword becomes, in JPA

| Keyword | Sample | JPQL snippet |
|---|---|---|
| `Distinct` | `findDistinctByLastnameAndFirstname` | `select distinct … where x.lastname = ?1 and x.firstname = ?2` |
| `And` | `findByLastnameAndFirstname` | `… where x.lastname = ?1 and x.firstname = ?2` |
| `Or` | `findByLastnameOrFirstname` | `… where x.lastname = ?1 or x.firstname = ?2` |
| `Is`, `Equals` | `findByFirstname`, `findByFirstnameIs`, `findByFirstnameEquals` | `… where x.firstname = ?1` (or `… where x.firstname IS NULL` if the argument is `null`) |
| `Between` | `findByStartDateBetween` | `… where x.startDate between ?1 and ?2` |
| `LessThan` | `findByAgeLessThan` | `… where x.age < ?1` |
| `LessThanEqual` | `findByAgeLessThanEqual` | `… where x.age <= ?1` |
| `GreaterThan` | `findByAgeGreaterThan` | `… where x.age > ?1` |
| `GreaterThanEqual` | `findByAgeGreaterThanEqual` | `… where x.age >= ?1` |
| `After` | `findByStartDateAfter` | `… where x.startDate > ?1` |
| `Before` | `findByStartDateBefore` | `… where x.startDate < ?1` |
| `IsNull`, `Null` | `findByAgeIsNull` | `… where x.age is null` |
| `IsNotNull`, `NotNull` | `findByAgeNotNull` | `… where x.age is not null` |
| `Like` | `findByFirstnameLike` | `… where x.firstname like ?1` |
| `NotLike` | `findByFirstnameNotLike` | `… where x.firstname not like ?1` |
| `StartingWith` | `findByFirstnameStartingWith` | `… where x.firstname like ?1` (parameter bound with appended `%`) |
| `EndingWith` | `findByFirstnameEndingWith` | `… where x.firstname like ?1` (parameter bound with prepended `%`) |
| `Containing` | `findByFirstnameContaining` | `… where x.firstname like ?1` (parameter bound wrapped in `%`) |
| `OrderBy` | `findByAgeOrderByLastnameDesc` | `… where x.age = ?1 order by x.lastname desc` |
| `Not` | `findByLastnameNot` | `… where x.lastname <> ?1` (or `… where x.lastname IS NOT NULL` if the argument is `null`) |
| `In` | `findByAgeIn(Collection<Age> ages)` | `… where x.age in ?1` |
| `NotIn` | `findByAgeNotIn(Collection<Age> ages)` | `… where x.age not in ?1` |
| `True` | `findByActiveTrue()` | `… where x.active = true` |
| `False` | `findByActiveFalse()` | `… where x.active = false` |
| `IgnoreCase` | `findByFirstnameIgnoreCase` | `… where UPPER(x.firstname) = UPPER(?1)` |

## The `null` argument changes the operator

Two rows in that table carry a parenthesis that is easy to skim past. `Is` and
`Equals` render `x.firstname = ?1` — *"or `… where x.firstname IS NULL` if the
argument is `null`"*. `Not` does the mirror image.

```java
List<User> findByManager(User manager);
```

Called with a manager, that is an equality test. Called with `null`, it is
`where x.manager is null` — which is almost certainly what you wanted, and is
also a completely different query with a completely different plan. It is
Spring Data being helpful about a genuine SQL wart: in SQL, `col = NULL` is never
true, so the naive translation would silently return nothing.

⚠️ **Be aware that the helpfulness stops at the derived-query boundary.** Write
the same predicate as `@Query("select o from Order o where o.manager = :m")` and
a `null` argument gives you the SQL semantics: zero rows, no error. The rewrite
is a feature of the *derived* path only. That asymmetry has bitten people
converting a derived method to `@Query` for an unrelated reason.

## How many arguments each keyword eats

Arguments are bound positionally, in declaration order, and each keyword consumes
a fixed number:

| Keyword | Arguments |
|---|---|
| `Is`, `Equals`, `LessThan`, `GreaterThan`, `Like`, `Containing`, `After`, `Before`… | one |
| `Between` | two |
| `In`, `NotIn` | one, a `Collection` or array |
| `True`, `False`, `IsNull`, `NotNull`, `IsEmpty`, `IsNotEmpty` | none |

Get the count wrong and it is a bootstrap failure, which is the right outcome.
Get the *order* wrong between two arguments of the same type and it is not — the
compiler cannot tell `findByFirstnameAndLastname(String a, String b)` apart from
its own transposition. That is a genuine argument for `@Query` with named
parameters on any predicate with two same-typed properties.

⚠️ **`In` with a large collection is a statement-cache problem, not a syntax
problem.** Each distinct list length can produce a differently-shaped statement.
That argument is made in full for the SQL-first world in
[topic 05 · IN lists and the statement cache](../05-sql-first-access/05b-in-lists-and-the-statement-cache.md);
it applies identically here, and Hibernate's `in`-clause padding is the mitigation.

## Gotchas

**⚠️ Passing `null` into a derived equality method and expecting zero rows.**
You get `is null` instead, because the derived path rewrites the operator. On a
nullable foreign key that quietly turns "find orders for this manager" into "find
unassigned orders". The rewrite is documented and useful; the surprise is that it
is invisible at the call site.

**⚠️ Converting that method to `@Query` and keeping the `null` call.**
The rewrite does not happen for a declared query. `where o.manager = :m` with
`null` matches nothing, silently. The two forms of the same predicate behave
differently for exactly one input value, and no test that passes a real manager
will catch it.

**⚠️ Two same-typed parameters in one derived method.**
`findByFirstnameAndLastname(String a, String b)` binds positionally. Swap the
call arguments and everything compiles, starts and returns wrong rows. Any
predicate with two `String`s or two `Long`s is a candidate for `@Query` with
named parameters.

**⚠️ Assuming `Regex`, `Near` or `Within` work because they are in a Spring Data
table.**
They belong to other modules. The reference states that regex matching is not
supported by JPA, and the JPA keyword table lists none of the three.

**⚠️ Believing `Not` and `NotIn` behave like their SQL counterparts around
`null`.**
`Not` gets the same `null` rewrite as `Is`. `NotIn` does not: SQL's `not in` with
a `null` inside the list yields unknown for every row, so a collection containing
a `null` returns nothing. Spring Data does not fix that for you — filter the
collection before you pass it.

**⚠️ Trusting a name that reads like English over the table.**
`findByStartDateAfter` is `>`, not `>=`; `findByAgeGreaterThanEqual` is the only
inclusive spelling. Nothing in the name signals the boundary, and off-by-one on a
date range is the classic way a nightly job double-counts or skips a row.

**⚠️ Using `Between` on timestamps.**
`between ?1 and ?2` is inclusive on both ends, so two adjacent ranges built with
it overlap by exactly one instant. For half-open intervals — which is what almost
every reporting window actually is — use
`…GreaterThanEqualAndPlacedAtLessThan`, ugly as it reads.

**⚠️ Passing an array where the reference says `Collection` for `In`.**
Both work, but the two spellings are not interchangeable in the same codebase
without someone eventually writing `findByIdIn(ids)` with a `Long[]` where a
`List<Long>` was expected and getting a compile error at a distance from the
declaration. Pick `Collection` and stay with it.

**⚠️ Writing `findByActiveTrue()` and then needing the flag as a parameter.**
`True` and `False` take no argument, so making the predicate dynamic means a new
method, not a new parameter. Two near-identical finders is the usual result;
`findByActive(boolean)` from the start avoids it.

## Interview questions

**★ Why are there two keyword tables, and which one applies to a JPA
repository?**
One is Spring Data's store-neutral vocabulary, listing every keyword any module
supports — including `Near`, `Within` and `Regex`. The other is the JPA module's,
which shows the JPQL each keyword becomes. Only the second is spendable on a
`JpaRepository`; the reference says outright that regex matching is not supported
by JPA.

**★ What does `findByManager(null)` do?**
It issues `where x.manager is null`. The JPA keyword table documents this for
`Is`/`Equals` — "or `IS NULL` if the argument is `null`" — and `Not` gets the
mirror rewrite. It is a deliberate correction of SQL's `= NULL` never being true.

**★ Does the same rewrite happen for `@Query("… where o.manager = :m")`?**
No. The rewrite is part of the derived-query translation. A declared query binds
the parameter as given, and `= null` matches no rows. So the same logical
predicate behaves differently in the two forms for exactly one input.

**★ How do you change the escape character used for that sanitisation?**
The `escapeCharacter` attribute of `@EnableJpaRepositories`. It matters when your
data legitimately contains the default escape character, which would otherwise
need escaping itself.

**★ How are the method's arguments bound to the keywords?**
Positionally, in declaration order, with each keyword consuming a fixed count —
one for most, two for `Between`, one `Collection` for `In`, none for `True`,
`IsNull` or `IsEmpty`. A wrong count fails at bootstrap; a wrong *order* between
two same-typed parameters does not fail at all.

**★ Is there a trap with `NotIn` and `null`?**
Yes, and it is SQL's, not Spring Data's. `not in` with a `null` element evaluates
to unknown for every row, so the query returns nothing. Spring Data does not
filter the collection for you, so a list assembled from a nullable field needs
cleaning before it is passed.

{/* FOOTER */}

**★ Which keywords consume no argument at all?**
`True`, `False`, `IsNull`/`Null`, `NotNull`, `IsEmpty` and `IsNotEmpty`. They
encode the operand in the name, which is convenient until the value needs to
become dynamic — at which point you need a different method rather than a
different argument.

**★ Is `After` inclusive?**
No. The table renders `After` as `>` and `Before` as `<`; the inclusive forms are
`GreaterThanEqual` and `LessThanEqual`. `Between` is the odd one out — it is
inclusive on both ends, which makes it the wrong tool for adjacent time windows.

**★ How do you know what JPQL a keyword produces without running anything?**
The JPA reference prints the fragment for every supported keyword next to a
sample method name. That table is the contract; the store-neutral keyword list is
only the vocabulary, and it contains keywords JPA has no rendering for.

{/* FOOTER */}
