---
title: "The strings in a Sort are validated as JPQL path expressions before they ever reach the database, which is why a function call throws and an alias does not — and JpaSort.unsafe is the documented way out, with a trust boundary attached"
sidebar_label: "05c · What a Sort may contain"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", the *Sorting* section
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html));
> "Defining Query Methods"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html));
> and PostgreSQL 18 "Indexes and `ORDER BY`"
> ([postgresql.org](https://www.postgresql.org/docs/18/indexes-ordering.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**[05](05-pageable-and-sort.md) treated `Sort` as a parameter you pass. It is also
two things you can get wrong. The first is a validation question — the strings in a
`Sort` have to name something the query can actually order by, and Spring Data
rejects the rest on purpose. The second is a cost question that no Java-side API
shows you, and which [05c2](05c2-what-the-order-by-costs.md) takes up: an `ORDER BY`
is either read off an index in order, or it is a sort of every row the query matched.
This chunk is the first half — what you are allowed to put in a `Sort` at all.**

## The rule: a sort property is a path expression, not a snippet

> *"The properties actually used within the `Order` instances of `Sort` need to match
> your domain model, which means they need to resolve to either a property or an
> alias used within the query. The JPQL defines this as a state field path
> expression."*

And the consequence, stated flatly:

> *"Using any non-referenceable path expression leads to an `Exception`."*

So `Sort.by("firstname")` is fine, `Sort.by("address.city")` is fine if the path
exists, and `Sort.by("LENGTH(firstname)")` is not a path at all. It throws.

Two things make this less restrictive than it first sounds. A `@Query` can expose an
**alias**, and an alias *is* referenceable. And there is a deliberate escape hatch:

> *"However, using `Sort` together with `@Query` lets you sneak in non-path-checked
> `Order` instances containing functions within the `ORDER BY` clause. This is
> possible because the `Order` is appended to the given query string. By default,
> Spring Data JPA rejects any `Order` instance containing function calls, but you can
> use `JpaSort.unsafe` to add potentially unsafe ordering."*

## The four cases, from the reference

```java
public interface UserRepository extends JpaRepository<User, Long> {

  @Query("select u from User u where u.lastname like ?1%")
  List<User> findByAndSort(String lastname, Sort sort);

  @Query("select u.id, LENGTH(u.firstname) as fn_len from User u where u.lastname like ?1%")
  List<Object[]> findByAsArrayAndSort(String lastname, Sort sort);
}

repo.findByAndSort("lannister", Sort.by("firstname"));                // (1)
repo.findByAndSort("stark", Sort.by("LENGTH(firstname)"));            // (2)
repo.findByAndSort("targaryen", JpaSort.unsafe("LENGTH(firstname)")); // (3)
repo.findByAsArrayAndSort("bolton", Sort.by("fn_len"));               // (4)
```

| | What the reference calls it |
|---|---|
| (1) | *"Valid `Sort` expression pointing to property in domain model."* |
| (2) | *"Invalid `Sort` containing function call. Throws Exception."* |
| (3) | *"Valid `Sort` containing explicitly unsafe `Order`."* |
| (4) | *"Valid `Sort` expression pointing to aliased function."* |

🔴 **(4) is the one to reach for first.** If the expression you want to sort by is
already in the projection with an alias, the sort is *checked* and there is no unsafe
anything. `JpaSort.unsafe` is for the case where the expression is not selected.

## `JpaSort.unsafe` has two modes, and they are not the same mechanism

> *"`JpaSort.unsafe(…)` operates in two modes:*
> *— When used with derived Queries or String-based Queries, the order string is
> appended to the query.*
> *— When used with Query by Example or Specifications (that use `CriteriaQuery`),
> order expressions are parsed and added to the `CriteriaQuery` as expressions."*

The difference matters when you are debugging. In the first mode your string reaches
the JPQL as text, so a syntax error surfaces as a query parse failure with your
fragment visible in it. In the second the string is **parsed by Spring Data first**
and turned into criteria expressions, so the failure comes from the parser and the
generated SQL never contains your text verbatim.

`JpaSort.JpaOrder.withUnsafe(…)` is the composing form:

> *"`JpaSort.JpaOrder.withUnsafe(…)` creates a new `JpaSort` applying current
> direction, case-sensitivity, and null-handling the given properties."*

And the limits on what can be translated are explicit:

> *"Query expressions can contain function calls, various clauses (such as `CASE
> WHEN`, arithmetic expressions) or property paths. Order translation does not
> support subquery expressions, `TREAT` and `CAST`."*

⚠️ **"Unsafe" is the API telling you where the trust boundary is.** In the appended
mode the string becomes part of the query text. A `JpaSort.unsafe` built from a
request parameter is a SQL-injection surface with a different name — the whole point
of the safe form is that a property name is validated against the model. Build unsafe
orders from a fixed allow-list in your own code, never from what arrived over HTTP.

## Gotchas

**★ `Sort.by("LENGTH(firstname)")` throws — it is not a path expression.** The error
comes from Spring Data's property parser, not from the database, so it looks like a
mapping problem rather than a "this is a function" problem.

**★ A sort property is a string, and strings do not get refactored.** Renaming a field
compiles fine everywhere and breaks at runtime the first time that endpoint is called.
`Sort.sort(Type.class)` with method references is the compile-time-safe form —
[05](05-pageable-and-sort.md) has the caveat that it uses CGlib proxies and interferes
with native image compilation.

**★ `JpaSort.unsafe` in the appended mode puts your string into the query text.** It is
a trust boundary. An unsafe order built from a request parameter is an injection
surface; build it from an allow-list you control.

**★ The two modes of `unsafe` fail differently.** Derived and string queries append the
text; QBE and Specifications parse it into the `CriteriaQuery`. The same string can
work in one and be rejected in the other.

**★ `unsafe` cannot express a subquery, `TREAT` or `CAST`.** The reference says order
translation does not support them. If your ordering needs one, it belongs in the
selected columns as an alias — or in a hand-written query.

## Interview questions

**★ What can you put in a `Sort`?**
Anything that resolves to a property of the domain model or to an alias used within the
query — a JPQL state field path expression. A non-referenceable path throws.

**★ Why does `Sort.by("LENGTH(firstname)")` fail when the SQL would be valid?**
Because Spring Data validates the string as a property path before it ever reaches the
database, and by default rejects `Order` instances containing function calls.

**★ How do you sort by an expression then?**
Two ways. Select it with an alias and sort by the alias, which stays validated; or use
`JpaSort.unsafe("LENGTH(firstname)")` to opt out of the check explicitly.

**★ What does `JpaSort.unsafe` actually do?**
It marks the `Order` as unsafe so Spring Data will not reject it. With derived and
string-based queries the order string is appended to the query; with Query by Example
and Specifications it is parsed and added to the `CriteriaQuery` as expressions.

**★ What can `unsafe` not express?**
Subquery expressions, `TREAT` and `CAST`. Function calls, `CASE WHEN`, arithmetic and
property paths are all fine.

**★ Why is it called unsafe?**
Because in the appended mode the string becomes part of the query text, so it is only
as safe as its source. It is safe when it comes from your code and an injection risk
when it comes from a user.

{/* FOOTER */}
