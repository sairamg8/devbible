---
title: "The repository hierarchy contains one genuine trap: PagingAndSortingRepository stopped extending CrudRepository in Spring Data 3.0, so extending it alone gives you paging and no save"
sidebar_label: "1b · The repository hierarchy"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Core concepts"
> ([core-concepts.html](https://docs.spring.io/spring-data/jpa/reference/repositories/core-concepts.html))
> and "Defining Repository Interfaces"
> ([definition.html](https://docs.spring.io/spring-data/jpa/reference/repositories/definition.html))
> — and the `JpaRepository` javadoc, Spring Data JPA Parent 4.1.0
> ([docs.spring.io/spring-data/jpa/docs/current/api](https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/JpaRepository.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Jakarta Persistence 3.2.

**There are more interfaces here than anyone remembers, and exactly one of them
is a trap. `PagingAndSortingRepository` has not extended `CrudRepository` since
Spring Data 3.0 — the reference says the sorting variants "no longer extend CRUD
repositories, so you must extend both if you need both functionalities". Every
other distinction in the hierarchy is about return types: the `List…` variants
return `List` where the originals return `Iterable`, and `JpaRepository` is the
JPA-specific interface that composes both `List` variants plus Query by
Example.**

## The interfaces, in order

```java
interface Repository<T, ID> { }                          // marker, declares nothing
```

`CrudRepository`, as the reference prints it:

```java
public interface CrudRepository<T, ID> extends Repository<T, ID> {

  <S extends T> S save(S entity);

  Optional<T> findById(ID primaryKey);

  Iterable<T> findAll();

  long count();

  void delete(T entity);

  boolean existsById(ID primaryKey);

  // … more functionality omitted.
}
```

`ListCrudRepository` is the same set with `List` returns. The reference:
*"`ListCrudRepository` offers equivalent methods, but they return `List` where
the `CrudRepository` methods return an `Iterable`."*

And the paging pair:

```java
interface PagingAndSortingRepository<T, ID> extends Repository<T, ID> {

  Iterable<T> findAll(Sort sort);

  Page<T> findAll(Pageable pageable);
}
```

with `ListPagingAndSortingRepository` again differing only in returning `List`
where the original returns `Iterable`.

Note what `PagingAndSortingRepository` extends: **`Repository`**. Not
`CrudRepository`. That is the break.

## The 3.0 break, and why it is easy to walk into

Before Spring Data 3.0, `PagingAndSortingRepository extends CrudRepository`, so
this was a complete data-access interface:

```java
public interface OrderRepository
        extends PagingAndSortingRepository<Order, Long> { }        // 2.x
```

On 4.1 the same declaration gives you `findAll(Sort)` and `findAll(Pageable)` and
nothing else. No `save`. No `findById`. No `count`. The reference's own note:
sorting variants *"no longer extend CRUD repositories, so you must extend both if
you need both functionalities"*.

```java
public interface OrderRepository
        extends ListCrudRepository<Order, Long>,
                ListPagingAndSortingRepository<Order, Long> { }    // 4.x
```

🔴 **The failure mode is a compile error, which is the good news.** `save` simply
does not exist on the type, so the code does not build. The bad news is that the
error arrives during an upgrade, in files nobody was intending to touch, and the
obvious fix — "add `CrudRepository` too" — is correct but looks like a workaround
to anyone who does not know the change was deliberate.

The change was deliberate, and the reason is composability: paging and CRUD are
independent capabilities, and a read-only paged view of an aggregate is a
perfectly reasonable thing to want. Before 3.0 you could not express it — asking
for `Pageable` support forced the whole write surface onto the interface.

## What `JpaRepository` extends

From the 4.1.0 javadoc:

```java
public interface JpaRepository<T, ID>
        extends ListCrudRepository<T, ID>,
                ListPagingAndSortingRepository<T, ID>,
                QueryByExampleExecutor<T> { }
```

So extending `JpaRepository` gets you all three at once, which is exactly why it
is the default choice and why the 3.0 break rarely bites anyone who uses it. It
is also why the reference's core-concepts page can describe the hierarchy without
most readers ever noticing it exists.

`QueryByExampleExecutor` arriving for free is worth noticing separately. It means
every `JpaRepository` in the application already exposes `findAll(Example)`,
whether or not the team decided to use Query by Example — see
[7b · query by example](07b-query-by-example.md), and
[1d · shaping the interface](01d-shaping-the-interface.md) for how to not have it.

## What is deliberately *not* in the hierarchy

Two capabilities are separate interfaces you opt into rather than inherit:

```java
public interface OrderRepository extends JpaRepository<Order, Long>,
                                         JpaSpecificationExecutor<Order> { }
```

- **`JpaSpecificationExecutor<T>`** — dynamic criteria queries built from
  composable predicates. [7 · specifications](07-specifications-and-criteria.md).
- **`RevisionRepository<T, ID, N>`** — Spring Data Envers, a separate module with
  its own dependency.

Both are opt-in for the same reason: they change what the repository *is*.
A `JpaSpecificationExecutor` publishes `findAll(Specification)`, which is a hole
in the interface big enough to drive any query through, and that is a design
decision rather than a convenience. `QueryByExampleExecutor` is the one that goes
the other way and is included by default.

## Picking the right one

The decision is short, once the break is known:

| You want | Extend |
|---|---|
| everything, no thought required | `JpaRepository<T, ID>` |
| CRUD only, no paging surface | `ListCrudRepository<T, ID>` |
| paging only, genuinely read-only | `ListPagingAndSortingRepository<T, ID>` |
| both, without the JPA-specific methods | both `List…` interfaces |
| a hand-picked set of methods | `Repository<T, ID>` and copy signatures |

The last row is the one worth arguing for and the one nobody uses; it has a page
of its own at [1d · shaping the interface](01d-shaping-the-interface.md).

## Gotchas

**⚠️ Extending `PagingAndSortingRepository` alone on 3.0 or later.**
You get two `findAll` overloads and no CRUD. The compiler catches it, but the
message — "cannot find symbol: method save" on an interface that obviously
should have `save` — reads like a classpath problem rather than a hierarchy
change, and the first instinct is to check the dependency version.

**⚠️ Extending `CrudRepository` and then wondering where `findAll(Pageable)`
went.**
Same break, the other direction. `CrudRepository` never had it; before 3.0 you
got it by extending `PagingAndSortingRepository`, which then dragged CRUD along
with it. Now the dependency runs neither way, so both have to be named.

**⚠️ Copying a 2.x repository declaration out of a blog post or an old service.**
This is how the break actually reaches people. The declaration compiles on the
old codebase and does not on the new one, and the volume of pre-3.0 material on
the web means the wrong form is still the most common form you will read.

**⚠️ Reaching for `Iterable<T>` in a service because that is what
`CrudRepository.findAll()` returns.**
`Iterable` cannot be `stream()`ed without a helper and cannot be sized at all.
`ListCrudRepository` exists exactly so you do not have to wrap it, and
`JpaRepository` already extends it. There is no reason to be handling `Iterable`
in application code on 4.1 — if you are, the interface choice is wrong.

**⚠️ Getting `findAll(Example)` you did not ask for.**
`JpaRepository` extends `QueryByExampleExecutor`, so Query by Example is on every
repository in the application by default. It is a capability with real
limitations ([7b](07b-query-by-example.md)), and a team that has decided against
it cannot enforce that decision while extending `JpaRepository`.

**⚠️ Assuming the `List…` variants change behaviour.**
They do not. Same queries, same semantics, different static type. Choosing
`ListCrudRepository` over `CrudRepository` is an ergonomics decision and nothing
more, and it is not a reason to expect different SQL.

**⚠️ Putting the entity's id type wrong and only finding out at startup.**
`JpaRepository<Order, Long>` where the entity's `@Id` is a `UUID` compiles
perfectly — the type arguments are not checked against the mapping by the
compiler. Spring Data resolves the entity information at bootstrap and fails
there, with a message about the identifier type, which is a long way from the
line that is wrong.

**⚠️ Adding a second repository interface for the same entity and expecting them
to share anything.**
They do not share a persistence context (that belongs to the transaction), they
do not share query methods, and both get their own proxy. Two repositories for
one entity is legal and occasionally right — a read side and a write side — but
it buys separation, not efficiency.

## Interview questions

**★ What changed about `PagingAndSortingRepository` in Spring Data 3.0?**
It stopped extending `CrudRepository`. The reference states the sorting variants
"no longer extend CRUD repositories, so you must extend both if you need both
functionalities". So on 4.1 an interface extending only
`PagingAndSortingRepository` has `findAll(Sort)` and `findAll(Pageable)` and no
`save`, `findById` or `count`. It is a compile error rather than a runtime
surprise, which is the best possible way for a breaking change to arrive.

**★ Why was that change made?**
To make paging and CRUD independent capabilities. Before it, you could not
express a repository that pages but does not write — asking for `Pageable`
support forced the whole CRUD surface onto the interface. Afterwards you compose
exactly the two you want, and `JpaRepository` composes both for the common case
so most code never notices.

**★ What exactly does `JpaRepository` extend?**
`ListCrudRepository`, `ListPagingAndSortingRepository` and
`QueryByExampleExecutor`. The first two are the `List`-returning variants of the
CRUD and paging interfaces; the third is why every `JpaRepository` already has
`findAll(Example)`. On top of those it declares the JPA-specific methods — the
flush family, the batch-delete family and `getReferenceById`.

**★ What is the difference between `CrudRepository` and `ListCrudRepository`?**
Return types only. The reference: "`ListCrudRepository` offers equivalent
methods, but they return `List` where the `CrudRepository` methods return an
`Iterable`." There is no behavioural difference and no difference in the SQL.
Since `Iterable` cannot be streamed or sized without ceremony, the `List`
variants are what you want in application code.

**★ Which interface would you extend for a read-only paged view?**
`ListPagingAndSortingRepository<T, ID>` alone — which is a declaration that only
became expressible in 3.0. It gives `findAll(Sort)` and `findAll(Pageable)` and
nothing that writes. If it also needs `findById`, add `ListCrudRepository`, or
extend bare `Repository` and copy in the three signatures you actually want.

**★ Which capabilities sit outside the hierarchy?**
`JpaSpecificationExecutor`, for dynamic criteria queries, and
`RevisionRepository` from Spring Data Envers. Both are extended explicitly,
because both change what the interface is rather than adding convenience — a
`findAll(Specification)` method can express any query at all. Query by Example is
the one that goes the other way and arrives whether you wanted it or not.

**★ Is `Repository` an interface with methods on it?**
No. It is a pure marker — it declares nothing. Its job is to let the
infrastructure find your interfaces by type at scan time. Everything you can call
on a repository comes from something further down the hierarchy, from a query
method, or from a fragment.

**★ What happens if the id type argument does not match the entity's `@Id`?**
It compiles, because the compiler has no way to relate the type argument to the
mapping, and then fails at bootstrap when Spring Data resolves the entity
information. The message names the identifier type, which does not obviously
point at the `extends` clause on a different file — so it is worth knowing that
this is where that class of startup error comes from.

{/* FOOTER */}
