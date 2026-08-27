---
title: "Query by Example turns a half-filled instance of your entity into a WHERE clause, which is the least code any dynamic filter will ever take — and the four limitations in the reference are the whole reason it is not the answer to every search screen"
sidebar_label: "07b · Query by Example"
sidebar_position: 35
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Query by Example"
> ([repositories/query-by-example.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-by-example.html)),
> including the *Usage*, *Example Matchers* and `StringMatcher` sections.
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.
> ⚠️ `…/reference/jpa/query-by-example.html` returns 404 — the live path is under
> `/reference/repositories/`.

**A `Specification` ([07](07-specifications-and-criteria.md)) buys arbitrary dynamic
predicates at the price of writing them. Query by Example buys a narrower set of
predicates for almost no code at all: you construct an instance of the entity, set the
fields you want to match on, and pass it in. It is genuinely the shortest path to a
working filter — and the reference lists exactly why it stops.**

## The four parts

> *"Query by Example (QBE) is a user-friendly querying technique with a simple
> interface. It allows dynamic query creation and does not require you to write queries
> that contain field names. In fact, Query by Example does not require you to write
> queries by using store-specific query languages at all."*

The API has four pieces:

> *"**Probe**: The actual example of a domain object with populated fields."*
>
> *"**ExampleMatcher**: The `ExampleMatcher` carries details on how to match particular
> fields. It can be reused across multiple `Example`s."*
>
> *"**Example**: An `Example` consists of the probe and the `ExampleMatcher`. It is used
> to create the query."*
>
> *"**FetchableFluentQuery**: A `FetchableFluentQuery` offers a fluent API, that allows
> further customization of a query derived from an `Example`."*

```java
Person person = new Person();
person.setFirstname("Dave");

Example<Person> example = Example.of(person);

List<Person> matches = personRepository.findAll(example);
```

`QueryByExampleExecutor<T>` is where `findOne`, `findAll`, `count`, `exists` and
`findBy` come from — and unlike `JpaSpecificationExecutor`, **you already have it**:
`JpaRepository` extends `QueryByExampleExecutor` ([01b](01b-the-repository-hierarchy.md)).
Every `JpaRepository` in your codebase can take an `Example` today.

## What ends up in the WHERE clause

The inclusion rule is nullability, and it has one exception that catches everybody:

> *"By default, fields having null values are ignored, and strings are matched by using
> the store specific defaults."*

> *"Inclusion of properties into a Query by Example criteria is based on nullability.
> Properties using primitive types (`int`, `double`, …) are always included unless the
> `ExampleMatcher` ignores the property path."*

🔴 **A primitive field is always part of the predicate.** An `int quantity` you never
set is `0`, and `0` is not null, so the query gains `quantity = 0` and returns nothing.
The fix is either boxed types on the probe type or `withIgnorePaths("quantity")` — and
this is the strongest argument for QBE probes being a type you control rather than the
mapped entity, whose primitives you chose for other reasons.

`Example` is immutable, and so is `ExampleMatcher`: every `with…` call returns a new
instance. The numbered example in the reference is deliberate about this — each step
*"Construct a new `ExampleMatcher`…"* — so a chain that drops an intermediate result
silently keeps the earlier configuration.

## Matchers

```java
ExampleMatcher matcher = ExampleMatcher.matching()
  .withIgnorePaths("lastname")
  .withIncludeNullValues()
  .withStringMatcher(StringMatcher.ENDING);

Example<Person> example = Example.of(person, matcher);
```

Two forms of per-property configuration are documented, the second using lambdas:

```java
ExampleMatcher matcher = ExampleMatcher.matching()
  .withMatcher("firstname", endsWith())
  .withMatcher("lastname", startsWith().ignoreCase());
```

Paths may be nested — *"You can navigate by chaining properties together with dots
(`address.city`)"*.

`and` versus `or` is one method call:

> *"By default, the `ExampleMatcher` expects all values set on the probe to match. If
> you want to get results matching any of the predicates defined implicitly, use
> `ExampleMatcher.matchingAny()`."*

That is the *only* boolean structure available. There is no third option and no nesting
— which is limitation number one below.

The precedence between the two levels is stated exactly:

> *"Default matching settings can be set at the `ExampleMatcher` level, while individual
> settings can be applied to particular property paths. Settings that are set on
> `ExampleMatcher` are inherited by property path settings unless they are defined
> explicitly. Settings on a property path have higher precedence than default settings."*

and the scope of each setting is fixed:

| Setting | Scope |
|---|---|
| Null-handling | `ExampleMatcher` |
| String matching | `ExampleMatcher` and property path |
| Ignoring properties | Property path |
| Case sensitivity | `ExampleMatcher` and property path |
| Value transformation | Property path |

⚠️ **Null-handling is matcher-wide only.** You cannot say "include nulls for this one
property". `withIncludeNullValues()` turns every unset property into an `IS NULL`
predicate across the whole probe, which is almost never what a search form means.

## What the string matchers generate

| Matching | Logical result |
|---|---|
| `DEFAULT` (case-sensitive) | `firstname = ?0` |
| `DEFAULT` (case-insensitive) | `LOWER(firstname) = LOWER(?0)` |
| `EXACT` (case-sensitive) | `firstname = ?0` |
| `EXACT` (case-insensitive) | `LOWER(firstname) = LOWER(?0)` |
| `STARTING` (case-sensitive) | `firstname like ?0 + '%'` |
| `STARTING` (case-insensitive) | `LOWER(firstname) like LOWER(?0) + '%'` |
| `ENDING` (case-sensitive) | `firstname like '%' + ?0` |
| `ENDING` (case-insensitive) | `LOWER(firstname) like '%' + LOWER(?0)` |
| `CONTAINING` (case-sensitive) | `firstname like '%' + ?0 + '%'` |
| `CONTAINING` (case-insensitive) | `LOWER(firstname) like '%' + LOWER(?0) + '%'` |

Two things fall straight out of that table. `LOWER(firstname) = LOWER(?0)` is not
answerable by an ordinary index on `firstname` — it needs an expression index on
`lower(firstname)`, the same argument [02c](02c-like-ignorecase-and-grouping.md) makes
about `IgnoreCase`. And `like '%' + ?0 + '%'` is a leading-wildcard pattern, which no
b-tree index can help with at all; on PostgreSQL that is what `pg_trgm` exists for.

And the last line of the chapter is short:

> *"Regex-matching is not supported by JPA."*

## The four limitations, verbatim

The reference is unusually direct about where QBE stops:

> *"No support for nested or grouped property constraints, such as `firstname = ?0 or
> (firstname = ?1 and lastname = ?2)`."*
>
> *"No support for matching collections or maps."*
>
> *"Store-specific support on string matching. Depending on your databases, String
> matching can support starts/contains/ends/regex for strings."*
>
> *"Exact matching for other property types."*

Take those one at a time, because each is a design constraint rather than a bug.

**Nested or grouped constraints.** The probe produces a flat conjunction (or a flat
disjunction with `matchingAny()`). Any real search screen that has "status is A or B,
and created in the last month" is already outside QBE. This is the wall, and it arrives
early.

**Collections and maps.** A probe with `order.setLines(List.of(someLine))` does not
filter on the lines. It is not an error — it simply contributes nothing.

**Exact matching for other property types.** The string matchers are the only inexact
matching there is. **There is no range.** No `createdAt` between two dates, no `total >
100`, no `IN` over a set of statuses. That single sentence disqualifies QBE from most
admin filters, and it is the one people discover last because everything else about the
API suggests it should be possible.

## When QBE is the right tool

Where the reference recommends it is precise:

> *"Querying your data store with a set of static or dynamic constraints."*
>
> *"Frequent refactoring of the domain objects without worrying about breaking existing
> queries."*
>
> *"Working independently of the underlying data store API."*

The middle one is the strongest and the least obvious. A probe is *typed*: rename a
field and the probe stops compiling. A derived query method name does not, and a
`root.get("firstname")` in a specification does not either. For a model still in motion,
QBE is the only dynamic-filter mechanism that a rename cannot silently break.

The honest summary: QBE is right for equality filters over a handful of scalar fields
with optional string matching, especially in a service that runs against more than one
Spring Data module. The moment a range, a grouping or a collection appears, move to a
`Specification` — the migration is mechanical, because both end up at the same Criteria
API, and both are executed through the same fluent API in
[07c](07c-executing-specifications-and-examples.md).

## Gotchas

**★ Primitive fields are always in the predicate.** `int` defaults to `0` and `0` is not
`null`, so an unset primitive silently adds `= 0` and the result set collapses. Box the
fields, or list them in `withIgnorePaths`.

**★ There is no range matching at all.** "Exact matching for other property types" means
dates, numbers and enums are equality-only. No `between`, no `>`, no `IN`.

**★ Collections on the probe are ignored.** Setting a to-many association contributes
nothing to the query, and there is no warning.

**★ `matching()` and `matchingAny()` are the only structures.** Everything is one flat
`AND` or one flat `OR`. A single `A and (B or C)` requirement ends QBE's usefulness for
that query.

**★ `withIncludeNullValues()` is matcher-wide.** Null handling has `ExampleMatcher`
scope only, so you cannot include nulls for one property and ignore them elsewhere.

**★ `ExampleMatcher` is immutable.** Every `with…` returns a new instance; assigning is
mandatory. A discarded intermediate silently uses an earlier configuration.

**★ Case-insensitive matching defeats a plain index.** `LOWER(col) = LOWER(?)` needs an
expression index on `lower(col)`; `CONTAINING` needs a trigram index or it is a scan.

**★ String matching is store-specific.** The reference says so twice. What works on one
Spring Data module is not guaranteed on another, and regex is explicitly unsupported for
JPA.

**★ The probe is an entity instance, which invites accidents.** A probe constructed by
copying a loaded entity carries every populated field — including the id — into the
predicate. Build probes from empty instances, deliberately.

**★ An empty probe matches everything.** `Example.of(new Person())` with default settings
produces no predicates at all, which is `findAll()`. A filter form that submits nothing
therefore returns the whole table unless the caller checks.

## Interview questions

**★ What is a probe?**
An instance of the domain object with the fields you want to match populated. Together
with an `ExampleMatcher` it forms an `Example`, which the repository turns into a query.

**★ How does QBE decide which properties become predicates?**
By nullability: non-null properties are included, null ones are ignored — except
primitives, which are never null and are therefore always included unless the matcher
ignores their path.

**★ Why does a QBE search suddenly return nothing after someone changes a field from
`Integer` to `int`?**
Because the unset field is now `0` rather than `null`, and QBE includes it as `= 0`. The
type change is invisible at the call site and changes the query.

**★ Can Query by Example express `status = 'A' or (status = 'B' and total > 100)`?**
No, on two counts. There is no support for nested or grouped constraints, and there is no
range matching for non-string types. That query needs a `Specification` or a `@Query`.

**★ What matching options exist for strings?**
`DEFAULT`, `EXACT`, `STARTING`, `ENDING` and `CONTAINING`, each in a case-sensitive and a
case-insensitive form. Regex matching is not supported by JPA.

**★ Where do matcher settings apply?**
Null-handling is matcher-wide; ignoring properties is per path; string matching and case
sensitivity can be set at either level, with the property-path setting winning.

**★ What is the one thing QBE does better than both derived queries and specifications?**
It survives refactoring. A probe is a typed instance of your domain object, so a field
rename is a compile error rather than a runtime `PropertyReferenceException` or a
silently wrong string path.

**★ Do you need to extend anything to use it on a `JpaRepository`?**
No. `JpaRepository` already extends `QueryByExampleExecutor`, unlike
`JpaSpecificationExecutor` which you have to add yourself.

{/* FOOTER */}
