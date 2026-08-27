---
title: "A Specification is a predicate you can name, store in a variable and combine at runtime, which is the one thing a method name can never be — and Spring Data JPA 4.0 reshaped the API around a smaller interface that most existing material predates"
sidebar_label: "07 · Specifications"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Specifications"
> ([jpa/specifications.html](https://docs.spring.io/spring-data/jpa/reference/jpa/specifications.html))
> — and the 4.1 source of `Specification` and `JpaSpecificationExecutor`
> ([github.com/spring-projects/spring-data-jpa](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/domain/Specification.java)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**[02f](02f-where-derived-queries-stop.md) named the wall: a method name is a predicate
fixed at compile time, so a search form with six optional filters becomes sixty-four
method names or one method that filters in Java. A `Specification` is the escape — a
predicate as a value, composed at runtime, executed as one query. 🔴 Spring Data JPA
4.0 rewrote this API, so almost every article you will find on it is describing a
different interface set.**

## Getting the methods

Specifications arrive by extending a second interface:

```java
public interface CustomerRepository
        extends CrudRepository<Customer, Long>, JpaSpecificationExecutor<Customer> {
}
```

`JpaSpecificationExecutor` contributes `findOne`, `findAll` in four overloads, `count`,
`exists`, `update`, `delete` and the fluent `findBy` — every one of them taking a
specification instead of a method name. Note what it does *not* extend: it is not a
`Repository`, it declares no domain type of its own beyond the generic, and
`JpaRepository` already includes `QueryByExampleExecutor` but **not** this one
([01b](01b-the-repository-hierarchy.md)). You opt in.

## What a specification is

> *"A specification is a predicate over an entity expressed with the Criteria API."*

The reference names its lineage — *"Based on the concept of a specification from Eric
Evans' book 'Domain Driven Design'"* — and, since 4.0, offers two entry points:

> *"`PredicateSpecification`: A flexible, query-type-agnostic interface introduced with
> Spring Data JPA 4.0."*
>
> *"`Specification` (and `UpdateSpecification`, `DeleteSpecification`): Query-bound
> variants."*

```java
public interface PredicateSpecification<T> {
  Predicate toPredicate(From<?, T> from, CriteriaBuilder builder);
}

public interface Specification<T> {
  Predicate toPredicate(Root<T> root, CriteriaQuery<?> query, CriteriaBuilder builder);
}
```

The difference is the middle argument. `Specification` receives the `CriteriaQuery`, so
it can call `query.distinct(true)`, add `query.orderBy(…)` or interrogate
`query.getResultType()` — and is therefore bound to a *select* query.
`PredicateSpecification` receives only the `From` and the builder, which is why it can
be reused inside a select, an update or a delete:

> *"The `PredicateSpecification` interface is defined with a minimal set of
> dependencies allowing broad functional composition."*

🔴 **Write new predicates as `PredicateSpecification` unless you actually need the
`CriteriaQuery`.** `Specification.where(PredicateSpecification)` adapts one to the other
in one call, and the smaller interface is the one that composes everywhere. The
query-bound `Specification` is not deprecated — as of 4.1.0 nothing on it carries
`@Deprecated` — it is simply the larger tool.

## Writing them

```java
class CustomerSpecs {

  static PredicateSpecification<Customer> isLongTermCustomer() {
    return (from, builder) -> {
      LocalDate date = LocalDate.now().minusYears(2);
      return builder.lessThan(from.get(Customer_.createdAt), date);
    };
  }

  static PredicateSpecification<Customer> hasSalesOfMoreThan(MonetaryAmount value) {
    return (from, builder) -> {
      // build predicate for sales > value
    };
  }
}
```

Two things about that snippet earn their place.

**`Customer_` is the generated metamodel.** The reference:

> *"The `Customer_` type is a metamodel type generated using the JPA Metamodel
> generator… So the expression, `Customer_.createdAt`, assumes the `Customer` has a
> `createdAt` attribute of type `LocalDate`."*

`from.get(Customer_.createdAt)` is typed: rename the field and the build fails. The
`from.get("createdAt")` string form compiles forever and throws at runtime. On a
Hibernate 7.4 project the metamodel generator is an annotation processor you add to the
build; adding it is the difference between a refactorable predicate library and a pile
of magic strings.

**The static factory names the business rule.** *"we have expressed some criteria on a
business requirement abstraction level"* — `isLongTermCustomer()` reads at the call site
in a way `findByCreatedAtBefore` does not, and it can be tested, reused and combined
without any repository being involved.

## Composition is the whole point

```java
List<Customer> customers = customerRepository.findAll(isLongTermCustomer());

MonetaryAmount amount = new MonetaryAmount(200.0, Currencies.DOLLAR);
List<Customer> customers = customerRepository.findAll(
  isLongTermCustomer().or(hasSalesOfMoreThan(amount))
);
```

> *"Specifications can easily be used to build an extensible set of predicates and used
> with `JpaRepository` removing the need to declare a query (method) for every needed
> combination."*

> *"Specifications become most valuable when composed."*

The composition operators are `and`, `or` (both since 2.0, both with a
`PredicateSpecification` overload), the static `not`, and `allOf`/`anyOf` over a varargs
or an `Iterable` (since 3.0). `allOf` and `anyOf` are the ones that matter for a
dynamic filter, because they take a collection you built in a loop.

## `unrestricted()` and the optional-filter pattern

Composition has to deal with "this filter was not supplied". Since 4.0 there is a
first-class answer:

> *"Simple static factory method to create a specification which does not participate in
> matching. The specification returned is `null`-like, and is elided in all operations."*

with the elision spelled out in the javadoc:

```
unrestricted().and(other) // consider only `other`
unrestricted().or(other)  // consider only `other`
not(unrestricted())       // equivalent to `unrestricted()`
```

The mechanism is that a specification contributes nothing by returning `null` from
`toPredicate`, and the composer drops it:

> *"Composition considers whether one or more specifications contribute to the overall
> predicate by returning a `Predicate` or `null`. Specifications returning `null`, such
> as `unrestricted()`, are considered to not contribute to the overall predicate, and
> their result is not considered in the final predicate."*

Which turns the six-optional-filters problem into ordinary code:

```java
PredicateSpecification<Customer> spec = PredicateSpecification.unrestricted();

if (criteria.name() != null)    spec = spec.and(nameContains(criteria.name()));
if (criteria.status() != null)  spec = spec.and(hasStatus(criteria.status()));
if (criteria.minSales() != null) spec = spec.and(hasSalesOfMoreThan(criteria.minSales()));

List<Customer> result = repository.findAll(Specification.where(spec));
```

⚠️ **`where(spec)` no longer accepts `null`.** The javadoc on `where` says the parameter
*"does not accept null values since 4.0, use `unrestricted()` instead of passing null"*.
Code written against 3.x that leaned on `Specification.where(null)` as its "no filter"
value does not compile-break — it fails at runtime with an assertion. This is the single
most likely thing to bite on an upgrade.

Note also that every `and`/`or` returns a **new** specification. The reassignment in the
loop above is not optional; `spec.and(x)` on its own discards the result.

What `SimpleJpaRepository` actually does with a specification when it runs one — the
second call for the count query, the two bulk-write variants `UpdateSpecification` and
`DeleteSpecification`, and the fluent `findBy` API — is
[07c](07c-executing-specifications-and-examples.md).

## Gotchas

**★ Nearly all existing material on specifications predates 4.0.** `PredicateSpecification`,
`UpdateSpecification` and `DeleteSpecification` are new types; `unrestricted()` is new;
`where(null)` is gone. Read the 4.1 reference, not a blog.

**★ `Specification.where(null)` now fails.** Since 4.0 `where` does not accept `null`.
Replace the idiom with `Specification.unrestricted()` — this is an upgrade break that the
compiler cannot see.

**★ `and`/`or` return a new instance.** `spec.and(other);` as a statement is a no-op that
looks like it works, because the surrounding query still runs and still returns rows.

**★ A specification built from strings is not refactorable.** `root.get("createdAt")`
survives every rename. Add the JPA metamodel generator and use `Customer_`, or accept
that the predicate library will rot silently.

**★ `Specification` is bound to a select query; `PredicateSpecification` is not.** If you
find yourself unable to reuse a predicate in a delete, the interface is the reason —
convert it, do not duplicate it.

**★ A `null` from `toPredicate` is a valid, meaningful answer.** It means "I do not
contribute". Returning `builder.conjunction()` instead produces a literal `1=1` in the
SQL rather than eliding the term — harmless, but noisier and no longer elided by `not`.

**★ Specifications are only as safe as their inputs.** A predicate built from a request
parameter is a *bound* parameter through the Criteria API, which is safe; a property path
built from a request parameter is not, because it names a column. Validate the path
against an allow-list, exactly as with `JpaSort.unsafe` ([05c](05c-sort-is-not-free.md)).

**★ `JpaSpecificationExecutor` is not inherited from `JpaRepository`.** Forgetting to add
it produces "cannot resolve method findAll(Specification)" and sends people looking for
the wrong problem.

## Interview questions

**★ What problem do specifications solve that derived queries cannot?**
A method name is a predicate fixed at compile time, so every combination of optional
filters needs its own method. A specification is a predicate as a value: it can be built
in a loop, composed with `and`/`or`, and executed as a single query.

**★ What is the difference between `Specification` and `PredicateSpecification` in 4.x?**
`Specification.toPredicate` receives the `CriteriaQuery` and is therefore bound to a
select query; `PredicateSpecification.toPredicate` receives only a `From` and a
`CriteriaBuilder`, so it composes into selects, updates and deletes alike. Prefer the
smaller one unless you need the query object.

**★ How do you express "no filter" now?**
`Specification.unrestricted()` (or `PredicateSpecification.unrestricted()`). It is
null-like and elided in all operations, so it is the correct seed value for a fold over
optional criteria. Passing `null` to `where` has not been allowed since 4.0.

**★ How does composition know to drop a specification?**
By what `toPredicate` returns. A `null` predicate is treated as not contributing and does
not appear in the final predicate — which is exactly what `unrestricted()` returns.

**★ Why use the generated metamodel instead of string property names?**
Because `Customer_.createdAt` is checked by the compiler and follows a rename, while
`root.get("createdAt")` compiles forever and throws at runtime. The metamodel generator is
an annotation processor on the build.

**★ When would you *not* reach for a specification?**
When the predicate is fixed. A derived query or a `@Query` states a fixed predicate more
plainly than a lambda over the Criteria API, and it is checked at bootstrap
([03f](03f-what-is-checked-and-when.md)) rather than at first call.

**★ Is `JpaSpecificationExecutor` part of `JpaRepository`?**
No. `JpaRepository` extends `ListCrudRepository`, `ListPagingAndSortingRepository` and
`QueryByExampleExecutor`. Specification support is a separate opt-in interface.

{/* FOOTER */}
