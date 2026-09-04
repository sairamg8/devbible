---
title: "Every CRUD method you inherit arrives with a transaction annotation you did not write, and every query method you declare yourself arrives with none at all — which is the opposite of what most people assume and explains a whole class of surprises"
sidebar_label: "09 · Transactions on repositories"
sidebar_position: 41
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Transactionality"
> ([jpa/transactions.html](https://docs.spring.io/spring-data/jpa/reference/jpa/transactions.html))
> — and the 4.1 source of `SimpleJpaRepository`
> ([spring-data-jpa](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/support/SimpleJpaRepository.java)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Topic [04](../04-spring-transactional/README.md) owns `@Transactional` — the proxy,
propagation, rollback rules, read-only. This chunk owns one narrower question: what
transaction configuration a Spring Data repository already has before you write a single
annotation. The answer has two halves, and only one of them is the half people expect.**

## Half one: the inherited methods are annotated

> *"By default, methods inherited from `CrudRepository` inherit the transactional
> configuration from `SimpleJpaRepository`. For read operations, the transaction
> configuration `readOnly` flag is set to `true`. All others are configured with a plain
> `@Transactional` so that default transaction configuration applies."*

The source says it in five characters:

```java
@Repository
@Transactional(readOnly = true)
public class SimpleJpaRepository<T, ID> implements JpaRepositoryImplementation<T, ID> {

    @Transactional
    public <S extends T> S save(S entity) { … }

    @Transactional
    public void deleteById(ID id) { … }

    // deleteAll, deleteAllInBatch, saveAll, saveAndFlush, flush,
    // update(UpdateSpecification), delete(DeleteSpecification) — all plain @Transactional
}
```

Class-level `readOnly = true` is the default for everything; each write method overrides it
with a plain `@Transactional`. So `findById`, `findAll`, `count` and `existsById` are
read-only transactional, and `save`, `delete`, `flush` and the batch operations are
read-write transactional — **each one on its own, if nothing else has started a
transaction**.

That last clause is the part worth pausing on. A service method with no `@Transactional`
that calls `repository.save(a)` and then `repository.save(b)` has run **two** transactions.
Either can commit while the other rolls back. Nothing in the service tells you this; the
boundary is on a class you have never opened.

## Half two: the methods you declare are not annotated

> *"Declared query methods (including default methods) do not get any transaction
> configuration applied by default."*

🔴 **This is the sentence that surprises everyone.** `findByLastname(String)` on your
repository — derived or `@Query` — has *no* transaction configuration. Not read-only, not
read-write: none. It participates in a caller's transaction if there is one, and runs
outside a Spring transaction if there is not.

Three consequences fall out immediately.

**Entities returned outside a transaction are detached the moment the method returns.** The
`EntityManager` behind a non-transactional call is short-lived, so lazy associations on the
result cannot be initialised later — the exception in
[10 · lazy loading · the exception](../10-lazy-loading/02-the-exception.md). This is why
"it works from the service and fails from the controller" is nearly always a transaction
boundary question rather than a mapping question.

**A `@Modifying` query without a transaction fails.** `Query.executeUpdate()` throws
`TransactionRequiredException` when there is no transaction, which is why
[04](04-modifying-queries.md) insists on a boundary around every modifying query.

**The two halves behave differently in the same interface.** `findById` (inherited) is
read-only transactional; `findByNumber` (declared, one line below it) is not transactional
at all. Nothing in the file distinguishes them.

## Making the declared methods transactional

The reference's own remedy is an annotation on the interface:

```java
@Transactional(readOnly = true)
interface UserRepository extends JpaRepository<User, Long> {

  List<User> findByLastname(String lastname);

  @Modifying
  @Transactional
  @Query("delete from User u where u.active = false")
  void deleteInactiveUsers();
}
```

> *"Typically, you want the `readOnly` flag to be set to `true`, as most of the query
> methods only read data. In contrast to that, `deleteInactiveUsers()` makes use of the
> `@Modifying` annotation and overrides the transaction configuration. Thus, the method
> runs with the `readOnly` flag set to `false`."*

Read that example carefully: `@Modifying` alone does not lift the read-only flag —
the method also carries its own `@Transactional`, which is what overrides the
interface-level one. The pattern is *interface-level `readOnly = true`, method-level plain
`@Transactional` on every writer*, and it is exactly the shape `SimpleJpaRepository`
already uses.

## Re-declaring an inherited method to change its settings

> *"If you need to tweak transaction configuration for one of the methods declared in a
> repository, redeclare the method in your repository interface"*

```java
public interface UserRepository extends CrudRepository<User, Long> {

  @Override
  @Transactional(timeout = 10)
  public List<User> findAll();
}
```

> *"Doing so causes the `findAll()` method to run with a timeout of 10 seconds and without
> the `readOnly` flag."*

⚠️ **"and without the `readOnly` flag"** is the trap in that sentence. You re-declared
`findAll` to add a timeout and you also, silently, turned a read-only transaction into a
read-write one — because your annotation replaces the inherited configuration entirely
rather than adding to it. Writing `@Transactional(timeout = 10, readOnly = true)` is what
you almost certainly meant.

## Fragments bring their own

One more rule, from the same page:

> *"Repository methods that are backed by transactional repository fragments inherit the
> transactional attributes from the actual fragment method."*

So a fragment method ([08](08-custom-implementations.md)) carrying `@Transactional` sets the
attributes for that repository method — which makes a fragment the one place inside a
repository where per-method transaction configuration lives naturally, and also a place
where a copied annotation quietly changes semantics for the interface's callers.

## The summary table

| Method | Transaction configuration by default |
|---|---|
| `findById`, `findAll`, `count`, `existsById`, `getReferenceById` | `@Transactional(readOnly = true)` from the class level |
| `save`, `saveAll`, `delete*`, `flush`, `saveAndFlush` | plain `@Transactional` |
| `update(UpdateSpecification)`, `delete(DeleteSpecification)` | plain `@Transactional` |
| A derived query method you declared | **none** |
| A `@Query` method you declared | **none** |
| A `default` method on your interface | **none** |
| A method backed by a fragment | whatever the fragment method declares |

[09b](09b-what-readonly-actually-does.md) takes up what `readOnly = true` actually does —
which is not what its name suggests — and [09c](09c-the-service-boundary.md) argues why
none of this removes the need for a transaction boundary in the service.

## Gotchas

**★ Declared query methods have no transaction configuration at all.** Not read-only —
none. Annotate the interface `@Transactional(readOnly = true)` if you want them
transactional by default.

**★ Two repository calls from a non-transactional service are two transactions.** Each
inherited CRUD method opens its own. Partial failure leaves half the work committed.

**★ Re-declaring an inherited method to add a setting removes `readOnly`.** The reference
says the re-declared `findAll` runs *"without the readOnly flag"*. Add `readOnly = true`
back explicitly unless you meant to drop it.

**★ Your annotation replaces, it does not merge.** There is no "inherit the rest of the
settings" mode. Whatever you do not state is the default, not what was there before.

**★ `@Modifying` does not make a method transactional.** It changes how the query is
executed, not whether a transaction exists. Without one, `executeUpdate` throws
`TransactionRequiredException`.

**★ Entities returned by a non-transactional query method are already detached.** Every
lazy association on them is a future exception, and the code path that works from inside a
`@Transactional` service is not evidence that the controller path works.

**★ An interface-level `@Transactional` does not reach inherited methods' own annotations.**
`SimpleJpaRepository`'s method-level `@Transactional` on `save` is more specific than your
interface-level `readOnly = true`, so writes still work — but do not rely on the interface
annotation to describe what `save` does.

**★ A fragment's `@Transactional` wins for that method.** Useful, and invisible from the
repository interface.

**★ `@Transactional` on a repository *interface* works because the proxy implements it.**
This is not the self-invocation situation of
[04 · 3](../04-spring-transactional/03-the-self-invocation-trap.md) — every call from
outside goes through the proxy. A `default` method calling another method of the same
interface, however, is a self-invocation and gets no new transaction.

**★ Read-only-by-default on the interface hides writes in default methods.** A `default`
method that loads and mutates entities under an interface-level `readOnly = true` may
silently persist nothing — the mechanism is [09b](09b-what-readonly-actually-does.md).

## Interview questions

**★ Is `findById` transactional?**
Yes — `SimpleJpaRepository` is annotated `@Transactional(readOnly = true)` at class level,
so every inherited read method runs in a read-only transaction, and each write method
overrides that with a plain `@Transactional`.

**★ Is `findByLastname` transactional?**
No. Declared query methods, including `default` methods, get no transaction configuration
by default. They join the caller's transaction if there is one and run without one
otherwise.

**★ What happens when a non-transactional service calls `save` twice?**
Two separate transactions, each committing independently. There is no atomicity across the
two calls, and nothing in the service code shows the boundaries.

**★ You re-declared `findAll()` with `@Transactional(timeout = 10)`. What changed besides
the timeout?**
It is no longer read-only. Your annotation replaces the inherited configuration rather than
extending it, so the `readOnly = true` from the class level is gone.

**★ How do you make all the query methods on a repository read-only transactional?**
Annotate the interface `@Transactional(readOnly = true)`, and put a plain `@Transactional`
on each modifying method to override it — the pattern the reference demonstrates and the
one `SimpleJpaRepository` itself uses.

**★ Why does a lazy association work in a service and throw from a controller?**
Because the service method has a transaction and the repository query method does not. Run
outside a transaction, the entity is detached as soon as the query method returns, and the
association can never be initialised.

**★ Does `@Modifying` imply a transaction?**
No. It tells Spring Data to call `executeUpdate` instead of `getResultList`. Without a
transaction, JPA throws `TransactionRequiredException`.

**★ Where do transaction attributes come from for a fragment-backed method?**
From the fragment method itself. Repository methods backed by transactional fragments
inherit the fragment method's attributes, which overrides the repository-level defaults for
that method.

{/* FOOTER */}
