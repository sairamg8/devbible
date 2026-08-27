---
title: "Everything you can put inside a projection beyond a plain getter — a default method, a SpEL expression, a nested projection, a nullable wrapper — and which of them keeps the query narrow and which of them quietly gives it back"
sidebar_label: "06b · Inside a projection"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Projections",
> the *Open Projections*, *Nullable Wrappers* and *Derived queries* sections
> ([projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)),
> and "Value Expressions"
> ([jpa/value-expressions.html](https://docs.spring.io/spring-data/jpa/reference/jpa/value-expressions.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**[06](06-projections.md) established that one `@Value` demotes a projection from
closed to open and costs you the narrowing. That leaves a practical question: what
*can* you put in a projection interface? There are four answers — default methods,
SpEL expressions, nested projections and nullable wrappers — and only one of them is
free.**

## Default methods keep the projection closed

The reference reaches for this first:

> *"For very simple expressions, one option might be to resort to default methods
> (introduced in Java 8)"*

```java
interface OrderSummary {
    String getNumber();
    BigDecimal getTotal();

    default String getLabel() {
        return getNumber() + " (" + getTotal() + ")";
    }
}
```

A `default` method is ordinary Java running on the proxy. It cannot reach anything the
projection did not already expose, which is precisely why it does not demote the
interface — Spring Data still knows the complete attribute set. The reference states
the constraint honestly:

> *"This approach requires you to be able to implement logic purely based on the other
> accessor methods exposed on the projection interface."*

That constraint is the feature. If a default method needs a field you did not declare,
the answer is to declare that field — which widens the select list *visibly*, one
property at a time, instead of invisibly widening it to the whole row.

## SpEL, and moving it into a bean

The `@Value` form is documented with the aggregate root bound to `target`:

```java
interface NamesOnly {
    @Value("#{target.firstname + ' ' + target.lastname}")
    String getFullName();
}
```

For anything longer than that, the reference says to stop writing code in a string:

> *"The expressions used in `@Value` should not be too complex — you want to avoid
> programming in String variables."*

The recommended alternative is a Spring bean invoked from the expression:

```java
@Component
class OrderLabels {
    String label(Order order) { … }
}

interface OrderSummary {
    @Value("#{@orderLabels.label(target)}")
    String getLabel();
}
```

⚠️ **This is still an open projection.** The `@Value` is what demotes the interface, not
what the expression contains. Moving the logic into a bean buys testability, a compiler
and a stack trace; it buys nothing at all in the query. If the narrowing matters, the
computation has to move out of the projection entirely — into the query as a selected
expression, or into the caller.

Expressions may also use the method's own parameters, exposed as an `Object` array
named `args`:

```java
interface NamesOnly {
    @Value("#{args[0] + ' ' + target.firstname + '!'}")
    String getSalutation(String prefix);
}
```

The array is positional and untyped, so a parameter reorder is a silent behaviour
change: `args[0]` still compiles and now means something else.

Two standing facts about value expressions apply here as much as they do in a `@Query`
([03e2](03e2-expressions-escaping-and-cost.md)). The cost:

> *"Doing so requires evaluation of the expression on each usage and, therefore, value
> expression evaluation has an impact on the performance profile."*

For a projection, *"each usage"* means each getter call on each element of the result
list. And the trust boundary:

> *"Make sure to parse and evaluate only expressions from trusted sources such as
> annotations. Accepting user-provided expressions can create an entry path to exploit
> the application context and your system resulting in a potential security
> vulnerability."*

A projection's `@Value` is an annotation constant, so it is on the safe side of that
line — as long as nobody builds the interface dynamically.

## Nested projections shape the output, not the join

Projections recurse. Return another projection interface from a getter and the target's
property is wrapped in turn:

```java
interface OrderSummary {
    String getNumber();
    CustomerSummary getCustomer();

    interface CustomerSummary {
        String getName();
    }
}
```

> *"On method invocation, the address property of the target instance is obtained and
> wrapped into a projecting proxy in turn."*

*"On method invocation"* is doing real work in that sentence — the wrapping happens when
you call the getter, over whatever the target already holds. And the JPA-specific
section says plainly what the target holds:

> *"Projections limit the selection to top-level properties of the target entity. Any
> nested properties resolving to joins select the entire nested property causing the
> full join to materialize."*

🔴 So a nested projection over an **association** does not narrow the join. The whole
associated entity is selected and then wrapped in a proxy that exposes one getter. You
get the JSON shape you wanted and none of the saving you assumed.

If narrowing across the join is the point, the tool is a DTO with a constructor
expression over the joined columns
([06c](06c-class-based-projections.md)) or a query that selects those columns directly.
And if the nested property is a *collection* rather than a to-one, that is a different
problem again with four different answers —
[08 · 12b · projecting a collection](../08-the-n-plus-1-problem/12b-projecting-a-collection.md).

## Nullable wrappers

A projection getter may return a wrapper instead of a bare value:

```java
interface NamesOnly {
    Optional<String> getFirstname();
}
```

The supported types are `java.util.Optional`, Guava's
`com.google.common.base.Optional`, `scala.Option` and `io.vavr.control.Option`.

> *"If the underlying projection value is not null, then values are returned using the
> present-representation of the wrapper type. In case the backing value is null, then
> the getter method returns the empty representation of the used wrapper type."*

This is per-property nullability *inside* one result. It is unrelated to an
`Optional<T>` **return type** on the query method, which answers "did the query match
anything at all" — the table in [01e](01e-return-types.md). A method can perfectly well
return `Optional<OrderSummary>` whose `getNumber()` also returns `Optional<String>`,
and the two `Optional`s mean entirely different things.

## The one restriction that catches people

A projection only applies to a **query method**. Overriding an inherited CRUD method
does not turn it into one:

> *"Declaring a method in your Repository that overrides a base method (e.g. declared
> in `CrudRepository`, a store-specific repository interface, or the `Simple…Repository`)
> results in a call to the base method regardless of the declared return type. Make
> sure to use a compatible return type as base methods cannot be used for projections."*

> *"Some store modules support `@Query` annotations to turn an overridden base method
> into a query method that then can be used to return projections."*

So `Optional<OrderSummary> findById(Long id)` does not project — it calls
`SimpleJpaRepository.findById` and hands you an entity in a variable typed as a
projection, which is a `ClassCastException` waiting at the first getter unless the
declared type is compatible. Give the method a different name, or attach a `@Query`.

## Gotchas

**★ A `default` method that needs an undeclared property cannot be written.** That is
the design, not a limitation to route around. Adding the property is the correct fix and
it makes the widened select list visible in the interface.

**★ A bean-backed `@Value` is still an open projection.** Readability improved; the
query did not. The only way back to a closed projection is to have no `@Value` on the
interface at all.

**★ `args` is positional and untyped.** Reordering the method's parameters silently
changes what `args[0]` means. Nothing fails to compile.

**★ Expression evaluation happens per getter call, per row.** The reference warns that
value expressions have an impact on the performance profile; in a projection that cost
is multiplied by the size of the result list and by how often the caller reads the
property.

**★ A nested projection over a to-one association materialises the whole association.**
The join is not narrowed. If you adopted nesting to reduce the columns fetched, measure
before believing it.

**★ Nesting is evaluated on method invocation.** The proxy wraps whatever the target
holds when you call the getter — so if the underlying association is an uninitialised
lazy proxy and you are outside the transaction, that call fails rather than returning a
nested projection.

**★ A nullable wrapper on a getter is not the method's `Optional`.** One describes a
null column, the other describes an empty result. Confusing them produces code that
handles the wrong emptiness.

**★ Overriding an inherited CRUD method never projects.** The base implementation runs
regardless of the declared return type. Rename the method or annotate it with `@Query`.

**★ Guava, Scala and Vavr wrappers are supported but not free.** Each pulls a dependency
into the type signature of your API. `java.util.Optional` is the one that costs nothing
extra.

## Interview questions

**★ How do you add a computed property to a projection without losing the query
optimisation?**
Use a `default` method built purely from the other accessors the projection exposes. It
executes on the proxy in plain Java, so Spring Data still knows the complete set of
attributes it must select and can keep the projection closed.

**★ Does moving the SpEL into a Spring bean re-close the projection?**
No. The presence of `@Value` is what makes it open. The bean call improves the code and
leaves the query exactly as wide as it was.

**★ What is `target` in a projection expression, and what is `args`?**
`target` is the aggregate root backing the projection proxy. `args` is an `Object` array
of the projection method's own parameters, referenced by index.

**★ Does a nested projection reduce the columns fetched from the joined table?**
No. Projections limit the selection to top-level properties; a nested property resolving
to a join causes the full join to materialise, and the associated entity is then wrapped
in a proxy.

**★ When is nesting the right tool then?**
When you want the output *shape* — a customer object inside an order object in the JSON
— and the association is going to be loaded anyway. It is a mapping convenience, not a
fetching strategy.

**★ What is the difference between `Optional<String> getFirstname()` inside a projection
and `Optional<Order> findByNumber(String)` on the repository?**
The first says the column may be null for a row that was found. The second says no row
may have been found at all. They are independent, and both can be present on the same
call path.

**★ Why can you not project by overriding `findById`?**
Because an overridden base method calls the base implementation whatever return type you
declare — projections only apply to query methods. Use a differently named derived query
or attach a `@Query` to the override where the module supports it.

**★ What is the cost profile of an open projection over a thousand-row list?**
The entity is materialised for every row, the SpEL is evaluated on every getter call,
and any lazy association the expression touches is initialised per row. All three costs
scale with the result size, and none of them are visible at the call site.

{/* FOOTER */}
