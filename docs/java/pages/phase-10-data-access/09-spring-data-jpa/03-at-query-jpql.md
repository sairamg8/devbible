---
title: "@Query moves the query out of the method name and into a JPQL string — the annotation wins over every other source, the method name stops being parsed, and you inherit the whole of a query language over the object model"
sidebar_label: "03 · @Query and JPQL"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html))
> and "Defining Query Methods"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html));
> Jakarta Persistence 3.2 §4 (the query language); Hibernate ORM 7.4 User Guide,
> "A Guide to Hibernate Query Language"
> ([HQL](https://docs.jboss.org/hibernate/orm/7.0/querylanguage/html_single/Hibernate_Query_Language.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**`@Query` is the point where the abstraction stops guessing. A derived name is an
abbreviation Spring expands into JPQL; `@Query` is the JPQL itself, written by you,
and it takes precedence over every other source of a query for that method. The
method name immediately stops being parsed — which is the feature and the first
trap in one. What you gain is the whole query language: grouping, explicit joins,
aggregates, subqueries, functions, constructor expressions. What you give up is
the compiler, and what replaces it is a check at application startup.**

## The declared query wins, and the name becomes a label

Spring Data's default lookup strategy is `CREATE_IF_NOT_FOUND`: it looks for a
declared query first and only derives one from the method name if it finds none.
`@Query` is a declared query, so it short-circuits derivation entirely. The
reference is explicit about where it sits in the pecking order:

> "Queries annotated to the query method take precedence over queries defined
> using `@NamedQuery` or named queries declared in `orm.xml`."

So all three of these can exist for one method, and only the annotation runs:

```java
public interface UserRepository extends JpaRepository<User, Long> {

    @Query("select u from User u where u.emailAddress = ?1")
    User findByEmailAddress(String emailAddress);
}
```

🔴 **The name is now documentation, not code.** Nothing checks that
`findByEmailAddress` filters on an email address. This compiles, starts, and
returns the wrong rows for the rest of its life:

```java
@Query("select u from User u where u.lastname = ?1")
User findByEmailAddress(String emailAddress);
```

That is not a hypothetical: it is what happens when a query is edited under a
method whose name nobody revisited. The upside is the same mechanism — a method
called `search` or `loadDashboardRow` is now legal, and a name that had grown to
[eleven keywords](02f-where-derived-queries-stop.md) can shrink back to something
a human reads.

⚠️ **The prefix still matters even though the predicate does not.** The subject
part of the name is what tells Spring the *shape* of the execution — a `delete…`
or `remove…` prefix, a `count…` prefix, an `exists…` prefix. With `@Query` the
return type and the annotation carry most of that, but a modifying statement
still needs `@Modifying` regardless of what the method is called — that is
[04 · modifying queries](04-modifying-queries.md).

## JPQL queries the object model, not the schema

This is the sentence to hold on to: **every identifier in a JPQL string is a Java
name.** `User` is the entity name, not the table; `u.emailAddress` is the field,
not `email_address`; `u.orders` is the association, not a foreign key. The
mapping layer translates all of it, which is why the same string runs unchanged
against PostgreSQL and H2, and why a column rename in a migration does not break
it as long as the `@Column` mapping is updated.

```java
@Query("""
        select o from Order o
        join o.customer c
        where c.country = :country
          and o.placedAt >= :since
        order by o.placedAt desc
        """)
List<Order> recentOrdersFrom(String country, Instant since);
```

Four things in that string are worth naming individually.

**The alias is required.** JPQL calls it an identification variable, and the
`from` clause declares one. Hibernate's HQL is more forgiving than the spec in
several places, but a query written with explicit aliases is portable and
unambiguous; write the alias even when your provider lets you skip it.

**A path expression navigates associations.** `o.customer.country` is legal and
means the same as the explicit `join` above — and, exactly as in a derived query,
**it is an inner join**. Orders with no customer disappear from the result. That
is the same trap
[02d · property paths](02d-property-paths-and-ambiguity.md) describes for derived
names, and the escape is the same: write `left join` yourself, which is precisely
the thing a method name cannot say.

**You can bind an entity, not just its id.** `where o.customer = :customer` takes
a `Customer` instance and compares on identity; the provider sends the primary
key. It reads better than threading ids around and it type-checks at the call
site.

**A query over a mapped superclass or an inheritance root is polymorphic.**
`select p from Payment p` returns `CardPayment` and `BankTransfer` too. If you
want one branch, say so with `where type(p) = CardPayment`, and use `treat(…)` to
navigate to a subtype's own fields. This surprises people who expect the query to
mean "rows in the `payment` table".

## Gotchas

**⚠️ Editing the query and leaving the method name.**
The name is not checked against the query, ever. `findByEmailAddress` running a
lastname filter is a defect that no build, no test that only asserts "returns
rows", and no IDE will find. Rename the method in the same commit as the
predicate, or you have created a permanent lie.

**⚠️ Assuming the derived query still runs as a fallback.**
It does not. `CREATE_IF_NOT_FOUND` derives *only when no declared query exists*.
Adding `@Query` to an existing derived method silently replaces its behaviour,
which is the point — but it means a typo'd `@Query` does not degrade to the old
behaviour, it becomes the behaviour.

**⚠️ Writing table and column names in JPQL.**
`select * from users where email_address = ?1` is SQL, not JPQL, and it fails at
startup with a parse error naming a token you did not expect. If you meant SQL,
say so with `nativeQuery = true` and accept the trade —
[03g · native queries](03g-native-queries.md).

**⚠️ Expecting `o.customer.country` to behave like an outer join.**
It is an inner join. Rows whose association is null vanish before your predicate
is evaluated, so a query that looks like a filter is silently also a restriction
on existence. Write `left join` when "or no customer at all" is part of the
answer.

**⚠️ Forgetting that a query on a hierarchy root is polymorphic.**
`select p from Payment p where p.amount > ?1` includes every subclass. If a
subclass maps to another table entirely, you have just written a query with a
union in it and did not know.

**⚠️ Assuming `@Query` on an inherited or overridden method behaves like the
name it overrides.**
Overriding `findAll()` with a `@Query` replaces the base implementation for that
repository only. Callers who reached it through `CrudRepository` still get your
query — which is either exactly what you wanted or a very well-hidden surprise
for the next reader.

**⚠️ Putting a `select` alias in the query and expecting the property name.**
`select u.firstname as name from User u` returns a scalar; the alias matters for
`Sort` and for interface projections, not for how the value arrives. A single
selected field arrives as that field's type, not as a one-element `Object[]`.

**⚠️ Assuming an empty result throws.**
It does not. A `@Query` behaves exactly like a derived method for return types:
a collection comes back empty, an `Optional` comes back empty, a bare entity
comes back `null`, and two rows for a single-result method throw
`IncorrectResultSizeDataAccessException` —
[01e · return types](01e-return-types.md).

**⚠️ Writing `where u.role = 'ADMIN'` with a literal instead of a parameter.**
It works, and it hard-codes a value into a string nobody greps. Worse, the habit
transfers to values that came from a user, and in a native query that is an
injection. Bind everything —
[03c · binding parameters](03c-binding-parameters.md).

**⚠️ Believing the query is checked because the application starts.**
Starting proves it parsed. It does not prove the predicate is right, that the
join is the one you meant, or that the result is the shape the caller expects.
Parsing is the cheapest of the checks you need, not the only one.

## Interview questions

**★ If a method has both a derivable name and a `@Query`, which runs?**
The `@Query`. The default lookup strategy is `CREATE_IF_NOT_FOUND` — it looks for
a declared query first and derives from the name only when there is none. The
reference also states that an annotated query takes precedence over `@NamedQuery`
and over named queries declared in `orm.xml`.

**★ What is the risk of that precedence?**
The method name stops being checked against the query, so the name can drift into
a lie. `findByEmailAddress` can run a filter on lastname and nothing in the build
or the IDE objects. It is a documentation defect that behaves like a correctness
defect.

**★ Is JPQL just SQL with different keywords?**
No. Every identifier is a Java name — entity names and field names, not tables
and columns — and joins are declared over mapped associations rather than over
key equality. That is what makes the same string run against different databases,
and it is why a JPQL query breaks when you rename a field rather than when you
rename a column.

**★ What does `o.customer.country` compile to?**
An inner join from `order` to `customer` plus a predicate on `country`. The
important half is "inner": orders with no customer are removed from the result
before your predicate runs. If you need those rows, you must write `left join`
explicitly, which is one of the things a derived name cannot express.

**★ Why is a JPQL query on an inheritance root polymorphic?**
Because JPQL queries the entity, and the entity's subtypes *are* that entity.
`select p from Payment p` therefore includes every mapped subclass, and depending
on the inheritance strategy that means a discriminator predicate, a union, or a
set of left joins in the generated SQL. `type(p) = …` narrows it and `treat(…)`
navigates into a subtype.

**★ Can you compare an entity directly in a JPQL predicate?**
Yes. `where o.customer = :customer` binds a `Customer` instance and the provider
compares primary keys. It reads better than passing ids around and it type-checks
at the call site — though it does mean the caller must have the entity, which for
a filter is sometimes more work than passing the id.

**★ Should the query live in `@Query`, in `@NamedQuery`, or in `orm.xml`?**
`@Query` in almost every case: it sits next to the method that runs it, it keeps
persistence details out of the entity class, and it wins over the other two
anyway. Named queries in the entity make sense when several repositories share
one query; `orm.xml` is worth it mainly when queries must be changed without
recompiling.

**★ Does `@Query` change what happens to the objects it returns?**
No. Selected entities are managed exactly as they would be from a derived method:
they enter the persistence context, they are dirty-checked, and a modification
inside the transaction produces an `update` at flush. Only a projection or a
constructor expression breaks that.

**★ When would you still prefer the derived name?**
When the predicate is one or two properties and the name reads as a sentence.
`findByEmailAddress(String)` is self-documenting, is validated against the entity
at bootstrap, and survives a rename with an IDE refactor. `@Query` earns its keep
when the query grows past what the name can say — not before.

**★ How do you review a repository full of `@Query` methods?**
Read each method name against its query first — that is where the cheap defects
are. Then look for `join` where `join fetch` was meant, path navigation where a
`left join` was meant, and entities returned where three columns were wanted.
Those three account for most of what goes wrong in a JPQL-heavy repository.

{/* FOOTER */}
