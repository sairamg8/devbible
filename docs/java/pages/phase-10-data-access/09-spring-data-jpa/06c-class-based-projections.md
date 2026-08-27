---
title: "A DTO projection is not a proxy over a Tuple but a real object built by a real constructor, which is why it needs a constructor expression in JPQL — and why Spring Data 4.1 writes that expression for you under rules worth knowing before you rely on them"
sidebar_label: "06c · DTO projections"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Projections",
> the *Class-based Projections (DTOs)*, *JPQL Queries*, *DTO Projection JPQL Query
> Rewriting* and *Native Queries* sections
> ([projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**The second projection form is a plain value type. It behaves differently from an
interface projection in three ways that matter — it is constructed rather than proxied,
it cannot nest, and how its properties are determined depends entirely on which kind of
query is behind the method.**

## The type

> *"Another way of defining projections is by using value type DTOs (Data Transfer
> Objects) that hold properties for the fields that are supposed to be retrieved.
> These DTO types can be used in exactly the same way projection interfaces are used,
> except that no proxying happens and no nested projections can be applied."*

```java
record OrderSummary(Long id, String number, BigDecimal total) {}

interface OrderRepository extends JpaRepository<Order, Long> {
    List<OrderSummary> findByStatus(String status);
}
```

The reference endorses records explicitly:

> *"Java Records are ideal to define DTO types since they adhere to value semantics:
> All fields are private final and `equals(…)`/`hashCode()`/`toString()` methods are
> created automatically. Alternatively, you can use any class that defines the
> properties you want to project."*

Two consequences follow immediately from "no proxying happens". There is no `target`,
so there is no `@Value` and nothing to demote — a DTO is structurally always the narrow
case. And there is no lazy anything: whatever the constructor received is all the object
will ever hold, which is the property that makes DTOs safe to hand to a serialiser
outside the transaction.

## How the properties are determined: the constructor

> *"If the store optimizes the query execution by limiting the fields to be loaded, the
> fields to be loaded are determined from the parameter names of the constructor that
> is exposed."*

The constructor is the select list. That is why the ambiguity rule is strict:

> *"When using Class-based projection, types must declare a single constructor so that
> Spring Data can determine their input properties. If your class defines more than one
> constructor, then you cannot use the type without further hints for DTO projections."*

The hint is `@PersistenceCreator`:

```java
public class NamesOnly {

  private final String firstname;
  private final String lastname;

  protected NamesOnly() { }

  @PersistenceCreator
  public NamesOnly(String firstname, String lastname) {
      this.firstname = firstname;
      this.lastname = lastname;
  }
}
```

⚠️ **This is the trap that arrives with a code-style change, not with a code change.**
A record has exactly one canonical constructor and works. Add a compact convenience
constructor, or let a framework add a no-arg one, and the type now has two — at which
point the projection stops working until somebody annotates the right one. Lombok's
`@NoArgsConstructor` on a DTO does this in one line.

## Derived queries

> *"Query derivation supports both, class-based and interface projections by
> introspecting the returned type. Class-based projections use JPA's instantiation
> mechanism (constructor expressions) to create the projection instance."*

So `List<OrderSummary> findByStatus(String)` needs nothing else: Spring Data reads the
constructor parameters, builds a constructor expression, and the SQL selects those
columns. The same top-level restriction from [06b](06b-computed-values-and-nesting.md)
applies —

> *"Projections limit the selection to top-level properties of the target entity. Any
> nested properties resolving to joins select the entire nested property causing the
> full join to materialize."*

## `@Query` and JPQL: the constructor expression

For a string query, JPA's own mechanism is the constructor expression, and the
reference is blunt about the syntax:

> *"JPA's mechanism to return Class-based projections using JPQL is constructor
> expressions. Therefore, your query must define a constructor expression such as
> `SELECT new com.example.NamesOnly(u.firstname, u.lastname) from User u`. (Note the
> usage of a FQDN for the DTO type!)"*

The fully-qualified name is not optional and does not follow imports. It is a string,
so moving the DTO to another package breaks it at runtime and the IDE will not rename
it for you.

### The rewriting, and its rules

Spring Data will write the constructor expression for you:

> *"Spring Data JPA can aid with rewriting your query to a constructor expression if
> your query selects the primary entity or a list of select items."*

Both of these get rewritten to
`SELECT new UserDto(u.firstname, u.lastname) FROM User u WHERE u.lastname = :lastname`:

```java
interface UserRepository extends Repository<User, Long> {

  @Query("SELECT u FROM User u WHERE u.lastname = :lastname")                       // (1)
  List<UserDto> findByLastname(String lastname);

  @Query("SELECT u.firstname, u.lastname FROM User u WHERE u.lastname = :lastname") // (2)
  List<UserDto> findMultipleColumnsByLastname(String lastname);
}

record UserDto(String firstname, String lastname) {}
```

The rules around that rewriting are where the surprises live.

**It triggers on the return type being outside the domain hierarchy:**

> *"Repository query methods that return a DTO projection type (a Java type outside the
> domain type hierarchy) are subject to query rewriting."*

**It backs off if you already wrote one:**

> *"If an `@Query`-annotated query already uses constructor expressions, then Spring
> Data backs off and doesn't apply DTO constructor expression rewriting."*

**Aliases make the query invalid, and rewriting will not save you:**

> *"JPQL constructor expressions must not contain aliases for selected columns and
> query rewriting will not remove them for you. While `SELECT u as user, count(u.roles)
> as roleCount FROM User u …` is a valid query for interface-based projections that
> rely on column names from the returned `Tuple`, the same construct is invalid when
> requesting a DTO where it needs to be `SELECT u, count(u.roles) FROM User u …`. Some
> persistence providers may be lenient about this, others not."*

🔴 That paragraph is the single most useful thing on the page. **The aliases that an
interface projection requires are the aliases a DTO projection forbids.** Switching a
method from `List<SomethingProjection>` to `List<SomethingDto>` is therefore not a
type-level change — the query text has to change with it, in the opposite direction. And
because *"some persistence providers may be lenient"*, a query that works on one
provider is not evidence that it is correct.

**And the constructor must take everything:**

> *"Make sure that your DTO types provide an all-args constructor for the projection,
> otherwise the query will fail."*

Note the tension with the single-constructor rule: one constructor, and it must accept
every selected item, in order.

## Native queries

Two cases, and the reference separates them cleanly:

> *"If properties of the result type map directly to the result (the order of columns
> and their types match the constructor arguments), then you can declare the query
> result type as the DTO type without further hints (or use the DTO class through
> dynamic projections)."*

> *"If the properties do not match or require transformation, use `@SqlResultSetMapping`
> through JPA's annotations to map the result set to the DTO and provide the result
> mapping name through `@NativeQuery(resultSetMapping = "…")`."*

⚠️ The first case is **positional**. Column order in the SQL and parameter order in the
constructor are the contract, and neither the compiler nor the persistence provider
checks that they agree beyond type compatibility. Two adjacent `String` columns swapped
in the `SELECT` produce a DTO with the values transposed and no error at all. The
`@SqlResultSetMapping` route is the one that names things — see
[03g3](03g3-what-a-native-query-returns.md) for how the return type drives a native
query generally.

## What a DTO cannot do

- **No nesting.** *"no nested projections can be applied"*. A DTO field whose type is
  another DTO is not populated by a constructor expression; JPQL constructor expressions
  do not nest. Selecting the joined columns flat and assembling in Java is the honest
  version.
- **No dynamic computed fields.** There is no `@Value` because there is no proxy and no
  `target`. Compute in the query, in the constructor, or in the caller.
- **No `Optional` accessors.** Nullable wrappers are an interface-projection feature. A
  DTO component is simply nullable.

## Gotchas

**★ Two constructors and the DTO stops working.** Spring Data determines input
properties from *the* constructor. A second one — added by Lombok, by a framework, or by
a colleague adding a convenience overload — requires `@PersistenceCreator` on the right
one, and until somebody adds it the projection fails.

**★ The FQDN in a constructor expression is a string.** Move or rename the DTO's package
and the query breaks at runtime. No refactoring tool follows it.

**★ Aliases in a `@Query` are required by interface projections and illegal for DTOs.**
Changing the return type from an interface to a record is therefore also a query change.
Query rewriting explicitly will not strip the aliases for you.

**★ "Some persistence providers may be lenient about this."** A query with aliases that
happens to work today is not portable and is not sanctioned. Write it the way the
reference says.

**★ Rewriting backs off silently when the query already has a constructor expression.**
That is usually what you want, but it means a half-written expression — the wrong FQDN,
a missing column — is *your* expression and gets executed as-is.

**★ The constructor must be an all-args constructor for the projection.** Selecting four
items into a three-parameter constructor fails; the failure is at query execution, not
at startup, unless the JPQL itself is malformed.

**★ A native query mapped by position transposes silently.** Same-typed adjacent columns
in the wrong order give you a well-formed DTO holding the wrong values. Use
`@SqlResultSetMapping` when the mapping is not trivially obvious.

**★ A DTO cannot nest, so a "summary with a nested summary" quietly becomes a flat
select plus assembly in Java.** Discover that before designing the API response around
it.

**★ A record's canonical constructor parameter *names* matter, not just its types.** The
fields to be loaded are determined from the constructor's parameter names, which means
the same `-parameters` compiler flag that
[03c](03c-binding-parameters.md) relies on is load-bearing here too. Spring Boot's build
plugins set it; a hand-rolled build may not.

## Interview questions

**★ What is the difference between an interface projection and a DTO projection?**
An interface projection is a runtime proxy over a `Tuple` and can be open or closed; a
DTO is a real object built by a real constructor, with no proxying and no nesting. The
DTO is always the narrow case because there is no `target` for an expression to reach
through.

**★ How does Spring Data know which columns a DTO needs?**
From the parameter names of the constructor it exposes. That is why the type must
declare exactly one constructor, or mark the intended one with `@PersistenceCreator`.

**★ Why does a `@Query` returning a DTO need a constructor expression?**
Because that is JPA's own instantiation mechanism for non-entity types —
`SELECT new com.example.Dto(u.a, u.b) FROM User u`, with a fully qualified name. Spring
Data can write it for you when the query selects the primary entity or a list of select
items.

**★ When does Spring Data *not* rewrite the query?**
When the query already contains a constructor expression — it backs off entirely — and
when the return type is inside the domain type hierarchy, in which case it is not a
projection at all.

**★ Your query has `select u as user, count(u.roles) as roleCount` and works with an
interface projection. You switch to a record and it breaks. Why?**
Interface projections read column names off the returned `Tuple`, so aliases are how
they resolve. Constructor expressions must not contain aliases, and query rewriting will
not remove them. The query text has to change along with the return type.

**★ How do you return a DTO from a native query?**
Either let the columns match the constructor by position and type and declare the DTO as
the return type, or define an `@SqlResultSetMapping` and name it through
`@NativeQuery(resultSetMapping = "…")` when the shapes do not line up.

**★ Why is positional native mapping risky?**
Because it is checked only for type compatibility. Two adjacent columns of the same type
in the wrong order produce a valid object with transposed values and no error anywhere.

**★ You want a DTO containing a nested DTO. What actually happens?**
Nothing good: class-based projections do not nest and JPQL constructor expressions do
not nest either. Select the columns flat and assemble the nested shape in Java, or use
an interface projection where nesting is supported — at the cost of the join
materialising in full.

{/* FOOTER */}
