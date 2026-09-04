---
title: "A @Query string is a template as well as a query — SpEL expressions and property placeholders are substituted into it before the provider sees it, and the one substitution worth learning is the entity name"
sidebar_label: "03e · Templated queries"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", section "Templated Queries and Expressions"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html))
> and "Value Expressions Fundamentals"
> ([value-expressions.html](https://docs.spring.io/spring-data/jpa/reference/jpa/value-expressions.html));
> `SecurityEvaluationContextExtension` read from the Spring Security source
> ([spring-security-data](https://github.com/spring-projects/spring-security/blob/main/data/src/main/java/org/springframework/security/data/repository/query/SecurityEvaluationContextExtension.java)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**A `@Query` is a template as well as a query. Two substitution mechanisms run
over it before it reaches the provider: SpEL expressions in `#{…}`, and property
placeholders in `${…}`. One use of this is genuinely excellent and has no
alternative — `#{#entityName}` lets a single generic repository interface carry a
query that works for every entity that extends it. Everything the mechanism can
do to *values* is a sharper tool with real costs, and that is the next chunk.**

## Two mechanisms, one string

> "Value Expressions can be defined from a sole SpEL Expression, a Property
> Placeholder or a composite expression mixing various expressions including
> literals."

The reference's own worked set, which is the clearest statement of the syntax:

| Expression | What it is |
|---|---|
| `#{tenantService.getOrderCollection()}` | a single SpEL expression, resolving a bean |
| `#{(1+1) + '-hello-world'}` | a static SpEL expression evaluating to `2-hello-world` |
| `${tenant-config.suffix}` | a single property placeholder |
| `orders-${tenant-config.suffix}` | a literal composed with a placeholder |
| `#{…}-${…}` | SpEL, placeholder and literal in one value |

Inside a query method the expression is prefixed with the binding marker for the
style you are using — `:#{…}` / `:${…}` for named binding, `?#{…}` / `?${…}` for
positional. The reference states this deliberately loosely, because the marker is
module-specific: *"Consult your module's documentation to determine the actual
parameter by-name/by-index binding syntax."* For JPA it is the two forms above.

## `#{#entityName}` — the one worth learning

The template variable `entityName` inserts the entity name of the repository's
domain type. It resolves in two steps: the `name` attribute of `@Entity` if one
was set, otherwise the simple class name. ⚠️ *"Customizations in `orm.xml` are not
supported for the SpEL expressions."*

```java
public interface UserRepository extends JpaRepository<User, Long> {

    @Query("select u from #{#entityName} u where u.lastname = ?1")
    List<User> findByLastname(String lastname);
}
```

On its own that looks like ceremony — you could have written `User`. The
reference's argument for it is remapping: the expression *"picks up potential
future remappings of the `User` class to a different entity name (for example, by
using `@Entity(name = "MyUser")`)"*.

**The use that actually earns it is the generic repository.** A query written once
on a `@NoRepositoryBean` parent interface works for every concrete repository
that extends it:

```java
@MappedSuperclass
public abstract class AbstractMappedType {
    String attribute;
}

@Entity
public class ConcreteType extends AbstractMappedType { }

@NoRepositoryBean
public interface MappedTypeRepository<T extends AbstractMappedType>
        extends Repository<T, Long> {

    @Query("select t from #{#entityName} t where t.attribute = ?1")
    List<T> findAllByAttribute(String attribute);
}

public interface ConcreteRepository extends MappedTypeRepository<ConcreteType> { }
```

Calling `findAllByAttribute(…)` on `ConcreteRepository` runs
`select t from ConcreteType t where t.attribute = ?1`. Without the expression
there is no way to write that query once — the entity name is different for every
implementing repository, and the parent has no idea which one it will serve.

## Gotchas

**⚠️ Writing `#{entityName}` instead of `#{#entityName}`.**
The inner `#` marks a variable in the evaluation context; without it SpEL looks
for a property or bean called `entityName` and the expression fails. The two
spellings differ by one character and only one of them works.

**⚠️ Assuming `#{#entityName}` respects `orm.xml`.**
It does not — the reference states that `orm.xml` customisations are not
supported for these expressions. An entity renamed only in XML resolves to the
class name, and the query then fails at parse time against a name the provider
does not know.

**⚠️ Using `#{#entityName}` in a native query.**
Native SQL needs the *table* name; the expression emits the *entity* name. They
are frequently the same word and occasionally not, which makes this a bug that
works on every entity you tested and fails on the one with `@Table(name = …)`.

**⚠️ Expecting expressions to work in a `@NamedQuery`.**
The reference supports them *"in manually defined queries that are defined with
`@Query`"*. A named query on the entity is handed to the provider as-is, so the
expression arrives at Hibernate verbatim and is a syntax error.

**⚠️ Declaring the generic parent interface without `@NoRepositoryBean`.**
Spring Data will try to create a repository instance for it, fail to resolve a
domain type, and the failure is at startup with a message about the interface you
meant to be abstract. Every shared parent interface needs that annotation.

**⚠️ Assuming the parent's query is compiled once.**
Each concrete repository builds its own query from the template, so an expression
that resolves for one entity and not another fails only for that repository —
and only when that repository is created.

**⚠️ Using an expression to build part of the query structure.**
A `#{…}` that emits a fragment of a `where` clause is string-built SQL with a
Spring accent — untestable, unparsable at startup, and one refactor away from an
injection. Structure that varies belongs in a
[`Specification`](07-specifications-and-criteria.md).

**⚠️ Forgetting that expressions run before Hibernate sees the query.**
Everything here happens in Spring Data. If an expression produces nonsense, the
error is a JPQL parse error about text you did not write, and the string in the
message will not match the string in your annotation.

**⚠️ Reaching for the template when a plain entity name would do.**
`#{#entityName}` on a repository bound to exactly one entity buys you protection
against a rename that an IDE would have done for you anyway, at the price of a
query nobody can grep for by entity name. Use it where it is load-bearing — the
generic parent — and write `User` everywhere else.

**⚠️ Putting a composite expression in a query for tidiness.**
`orders-${tenant-config.suffix}` is legal in a value expression, and in a query it
means part of your JPQL is assembled from configuration. That is a deployment
concern leaking into a query the compiler already cannot check.

## Interview questions

**★ What is `#{#entityName}` for?**
It substitutes the repository's entity name — the `@Entity(name = …)` value, or
the simple class name if none was set. Its real use is a generic
`@NoRepositoryBean` parent interface: one `@Query` written there works for every
concrete repository that extends it, which is otherwise impossible because the
entity name differs per repository.

**★ Where does it get the name from, and what does it ignore?**
From the `@Entity` annotation's `name` attribute if present, otherwise the simple
class name. It ignores `orm.xml`: the reference states that `orm.xml`
customisations are not supported for these expressions.

**★ What is the difference between `#{…}` and `${…}` in a query?**
`#{…}` is a SpEL expression evaluated against an `EvaluationContext`; `${…}` is a
property placeholder resolved from the `Environment`, with an optional default
after a colon. Both can be composed with literals in one value, and both are
substituted into the query *text* rather than bound as parameters.

**★ Show the case where the template is the only option.**
A `@NoRepositoryBean` interface parameterised over a `@MappedSuperclass`, holding
`@Query("select t from #{#entityName} t where t.attribute = ?1")`. Each concrete
repository that extends it gets the query with its own entity name substituted.
Without the expression the parent would have to name an entity it cannot know.

**★ Why must that parent interface carry `@NoRepositoryBean`?**
Because Spring Data instantiates every interface it finds that extends
`Repository`. The parent is a template, not a repository for a concrete domain
type, and without the annotation the container tries to create it and fails at
startup.

**★ Do expressions work in `@NamedQuery` or `orm.xml`?**
No. The reference scopes them to queries defined with `@Query`. Anything else is
passed to the persistence provider untouched, so the expression is a syntax
error rather than a substitution.

**★ Is `#{#entityName}` worth using in an ordinary repository?**
Usually not. It protects against a future `@Entity(name = …)` remapping, which is
rare and which a rename refactor would handle anyway, and it costs you the
ability to find queries by entity name with a grep. Its value is concentrated in
the generic-parent case.

**★ When does the substitution happen?**
Before the query reaches the provider: Spring Data resolves the value expression
and hands the resulting string to the `EntityManager`. That is why an expression
failure shows up as a JPQL error about text that does not appear in your source.

{/* FOOTER */}
