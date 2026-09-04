---
title: "SimpleJpaRepository applies your specification to the count query as well as the data query, which is why a fetch join inside a predicate works until the day someone adds a Pageable — and why the bulk update and delete specifications carry every warning a bulk statement carries"
sidebar_label: "07d · What the base repository does"
sidebar_position: 37
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the 4.1 source of `SimpleJpaRepository` and
> `JpaSpecificationExecutor`
> ([github.com/spring-projects/spring-data-jpa](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/support/SimpleJpaRepository.java)),
> the Spring Data JPA 4.1 reference "Specifications"
> ([jpa/specifications.html](https://docs.spring.io/spring-data/jpa/reference/jpa/specifications.html)),
> and Jakarta Persistence 3.2 §4.11 on bulk operations
> ([jakarta.ee](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**A specification is a lambda you hand to the framework, and it is easy to assume it is
called once. It is not. Reading the twenty lines of `SimpleJpaRepository` that consume it
explains three behaviours that otherwise look like bugs, and it is the shortest route to
understanding why the most-reported specification problem in the wild only appears when
pagination is added.**

## The one helper that applies a specification

```java
private <S, U extends T> Root<U> applySpecificationToCriteria(
        Specification<U> spec, Class<U> domainClass, CriteriaQuery<S> query) {

    Root<U> root = query.from(domainClass);
    CriteriaBuilder builder = entityManager.getCriteriaBuilder();
    Predicate predicate = spec.toPredicate(root, query, builder);

    if (predicate != null) {
        query.where(predicate);
    }
    return root;
}
```

That is where the `null`-elision of [07](07-specifications-and-criteria.md) is
implemented: a `null` predicate means no `where` call at all — not an empty `where`, not
`1=1`. `Specification.unrestricted()` returns a lambda that returns `null`, and this is
the line that makes it mean "no restriction".

Note the generic: `CriteriaQuery<S>`, not `CriteriaQuery<U>`. The same helper serves
queries whose result type is not the entity.

## The count query calls your predicate again

```java
protected <S extends T> TypedQuery<Long> getCountQuery(Specification<S> spec, Class<S> domainClass) {

    CriteriaBuilder builder = entityManager.getCriteriaBuilder();
    CriteriaQuery<Long> query = builder.createQuery(Long.class);

    Root<S> root = applySpecificationToCriteria(spec, domainClass, query);

    if (query.isDistinct()) {
        query.select(builder.countDistinct(root));
    } else {
        query.select(builder.count(root));
    }

    // Remove all Orders the Specifications might have applied
    query.orderBy(Collections.emptyList());

    return applyRepositoryMethodMetadataForCount(entityManager.createQuery(query));
}
```

Three facts fall out of those fifteen lines, and all three are discovered the hard way.

**1 · `toPredicate` runs twice per paged call** — once with a `CriteriaQuery<T>` and once
with a `CriteriaQuery<Long>`. Anything with a side effect inside a predicate happens
twice; anything expensive is paid twice. A predicate that logs, that calls a service, or
that reads the security context and caches something is doing all of it a second time.

**2 · `query.distinct(true)` propagates into the count**, which becomes `countDistinct`.
That is the correct answer — the count has to agree with the data query — and it is also
why a specification that sets `distinct` makes pagination materially more expensive on a
large match set.

**3 · Orders are stripped from the count.** A specification that calls `query.orderBy(…)`
will not break the count, but its ordering is discarded there. Do not rely on ordering as
a side effect of a predicate; pass a `Sort`.

## The fetch-join trap

This is the failure people meet:

```java
static Specification<Order> withCustomer() {
    return (root, query, cb) -> {
        root.fetch("customer");                    // ← breaks the count query
        return cb.isNotNull(root.get("number"));
    };
}
```

`findAll(spec)` works. `findAll(spec, pageable)` applies the *same* specification to a
`CriteriaQuery<Long>` whose select list is `count(root)` — and a fetch whose owner is not
in the select list is not a legal query. Hibernate rejects it, and the message talks about
join fetching and the select list rather than about pagination, which sends people looking
in the wrong place.

The guard is to ask the query what it is building. `CriteriaQuery.getResultType()` returns
`Long.class` for the count query constructed above:

```java
static Specification<Order> withCustomer() {
    return (root, query, cb) -> {
        Class<?> resultType = query == null ? null : query.getResultType();
        if (resultType != Long.class && resultType != long.class) {
            root.fetch("customer");                // data query only
        }
        return cb.isNotNull(root.get("number"));
    };
}
```

⚠️ Even guarded, this is a fetch join under pagination, with everything topic 08 says
about that — [08 · 8d · pagination](../08-the-n-plus-1-problem/08d-pagination.md) and
[08 · 8b · what a fetch join breaks](../08-the-n-plus-1-problem/08b-what-a-fetch-join-breaks.md).
And putting fetch instructions inside a *predicate* conflates two decisions that want
different lifetimes: the filter varies per request, the fetch plan varies per use case.
`@EntityGraph` on the repository method
([08 · 9g](../08-the-n-plus-1-problem/09g-spring-data-entitygraph.md)) keeps them apart —
and applies to a `JpaSpecificationExecutor` method just as it does to a derived one.

## The separate count specification

Since 3.5 there is an overload that removes the double duty entirely:

```java
Page<T> findAll(Specification<T> spec, Specification<T> countSpec, Pageable pageable);
```

> *"Returns a `Page` of entities matching the given `Specification`. Supports counting
> the total number of entities matching the `Specification`."*

The fluent API has the same thing as a terminal:
`page(Pageable, Specification<?> countSpec)`, declared on `SpecificationFluentQuery`
([07c](07c-executing-specifications-and-examples.md)).

Two predicates — one for data, one for counting — is the clean answer whenever the data
query needs joins, fetches or `distinct` that the count neither needs nor tolerates. It is
also where a *deliberately cheaper* count goes when the exact one is too slow, at the cost
of `getTotalElements()` no longer being exactly right. That is a trade to make on purpose,
not by accident.

## The bulk write specifications

`UpdateSpecification` and `DeleteSpecification` are bound to the other two Criteria query
types:

```java
public interface UpdateSpecification<T> {
  Predicate toPredicate(Root<T> root, CriteriaUpdate<T> update, CriteriaBuilder builder);
}

public interface DeleteSpecification<T> {
  Predicate toPredicate(Root<T> root, CriteriaDelete<T> delete, CriteriaBuilder builder);
}
```

```java
public static UpdateSpecification<Customer> updateLastname(
        String newLastName, String currentFirstname, String currentLastname) {

  return UpdateSpecification.<Customer>update((root, update, cb) -> {
    update.set("lastname", newLastName);
  }).where(hasFirstname(currentFirstname).and(hasLastname(currentLastname)));
}
```

Both compose from ordinary `PredicateSpecification` building blocks, which is the payoff
of the 4.0 split: one `hasFirstname(…)` serves the select, the update and the delete.

🔴 The javadoc on the executor methods is explicit about the cost:

> *"This method uses Criteria API bulk update that maps directly to database update
> operations. The persistence context is not synchronized with the result of the bulk
> update."*

which is the specification-shaped restatement of the Jakarta Persistence rule:

> *"Bulk update maps directly to a database update operation, bypassing optimistic locking
> checks. Portable applications must manually update the value of the version column, if
> desired, and/or manually validate the value of the version column."*

> *"A delete operation only applies to entities of the specified class and its subclasses.
> It does not cascade to related entities."*

So: no cascade, no lifecycle callbacks, no optimistic-lock check, and a persistence context
that now disagrees with the database. Everything in [04](04-modifying-queries.md),
[04b](04b-flush-clear-and-the-stale-context.md) and
[04c](04c-derived-delete-versus-bulk-delete.md) applies unchanged — with one difference
worth stating plainly: **`JpaSpecificationExecutor` has no `clearAutomatically` or
`flushAutomatically`.** `@Modifying`'s two switches do not exist here. Flushing before and
clearing after are entirely your responsibility.

Both return the affected row count, and both are annotated `@Transactional` on
`SimpleJpaRepository`, which means that without an outer transaction each one commits on
its own — [09](09-transactions-on-repositories.md).

## Gotchas

**★ Your specification's `toPredicate` is called twice for a `Page`.** Once for the data
query and once for the count query. Side effects, logging and expensive lookups inside a
predicate all happen twice.

**★ A `root.fetch(…)` inside a specification breaks the count query.** The count selects
`count(root)`, and a fetch whose owner is not in the select list is invalid. Guard on
`query.getResultType()`, or use the `findAll(spec, countSpec, pageable)` overload — or
better, move the fetch plan to `@EntityGraph`.

**★ The failure only appears when someone adds pagination.** The specification is correct
today, is committed, is reused, and breaks in an unrelated pull request that changed
`List` to `Page`. That is why the guard belongs in the specification from the start.

**★ `query.distinct(true)` makes the count a `countDistinct`.** Correct, and materially
more expensive than a plain count on a large match set.

**★ Orders applied inside a specification are discarded for the count.**
`SimpleJpaRepository` calls `query.orderBy(emptyList())` after applying the spec. Never
treat ordering as a side effect of a predicate.

**★ `query` can be inspected but should not be mutated casually.** The same object is
reused for the count with a different result type; a specification that mutates it is
mutating two different queries in one method.

**★ A custom count specification that is not equivalent to the data one makes
`getTotalElements()` a lie.** That is sometimes the right trade — say it out loud in the
code rather than letting the next reader assume exactness.

**★ `update` and `delete` on the executor are bulk operations.** The persistence context is
not synchronised, cascades do not fire, lifecycle callbacks do not run, optimistic locking
is bypassed, and there is no `clearAutomatically` to save you.

**★ Each executor write commits alone without an outer transaction.** They carry a plain
`@Transactional` on the base class, so a service issuing two of them has two transactions
unless it declares its own boundary.

**★ Auditing does not run for a bulk update.** `@LastModifiedDate` is set by a JPA
lifecycle callback, and bulk operations do not fire callbacks — see
[10](10-auditing-and-lifecycle.md). A bulk `UpdateSpecification` silently leaves the audit
columns stale.

## Interview questions

**★ How many times is a `Specification` evaluated for a `Page` query?**
Twice — once against the data query and once against the count query, which is a
`CriteriaQuery<Long>`. That is what makes fetch joins and side effects inside a
specification dangerous.

**★ A specification with a fetch join works for `findAll(spec)` and throws for
`findAll(spec, pageable)`. Explain.**
The paged call also builds a count query selecting `count(root)`, and the same
specification adds the fetch to it. A fetch whose owner is not in the select list is
invalid, so the count query fails. Guard with `query.getResultType()`, supply a separate
count specification, or move the fetch plan out to `@EntityGraph`.

**★ What does `Specification.unrestricted()` actually do at execution time?**
It returns `null` from `toPredicate`, and `applySpecificationToCriteria` skips the
`query.where(…)` call entirely when the predicate is `null`. There is no `1=1` in the SQL.

**★ What does the `findAll(spec, countSpec, pageable)` overload buy you?**
A count query built from a different predicate — so the data query can carry joins,
fetches or `distinct` that the count neither needs nor tolerates, and the count can be made
deliberately cheaper.

**★ What happens to an `orderBy` set inside a specification when the query is counted?**
It is removed. `SimpleJpaRepository` explicitly clears the orders before creating the count
query.

**★ Why does `distinct` on a specification cost you twice?**
Because the flag propagates: the data query is a `select distinct` and the count becomes
`countDistinct`, so both statements pay for the deduplication.

**★ Are `UpdateSpecification` and `DeleteSpecification` just a nicer `@Modifying`?**
They are the Criteria API equivalent with the same semantics — direct database statements,
no cascade, no lifecycle callbacks, no optimistic locking, an unsynchronised persistence
context — and without `@Modifying`'s `clearAutomatically` and `flushAutomatically`
switches. Auditing columns are not touched either.

**★ Where would you put a fetch plan for a specification-based finder?**
On the repository method as `@EntityGraph`, not inside the predicate. The filter varies per
request and the fetch plan varies per use case; keeping them in the same lambda couples two
decisions with different lifetimes and is what creates the count-query failure.

{/* FOOTER */}
