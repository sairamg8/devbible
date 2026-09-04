---
title: "When the repository abstraction runs out you do not abandon it — you add a fragment interface and one implementation class whose name ends in Impl, and the composition rules that follow are what let a fragment override a method the framework already provides"
sidebar_label: "08 · Custom implementations"
sidebar_position: 38
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Custom Repository
> Implementations"
> ([repositories/custom-implementations.html](https://docs.spring.io/spring-data/jpa/reference/repositories/custom-implementations.html)),
> the *Customizing Individual Repositories* and *Configuration* sections; and
> "Transactionality"
> ([jpa/transactions.html](https://docs.spring.io/spring-data/jpa/reference/jpa/transactions.html));
> plus the Spring Data Commons `main` source of `RepositoryComposition`
> ([github.com/spring-projects/spring-data-commons](https://github.com/spring-projects/spring-data-commons/blob/main/src/main/java/org/springframework/data/repository/core/support/RepositoryComposition.java)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Every previous chunk has been about telling Spring Data what query you want. This one
is about the case where you want to write the code yourself and still have it arrive
through the repository interface — because the alternative, a second bean that callers
must know to inject, splits your data access in two.**

## The three pieces

> *"To enrich a repository with custom functionality, you must first define a fragment
> interface and an implementation for the custom functionality"*

```java
interface CustomizedUserRepository {
  void someCustomMethod(User user);
}

class CustomizedUserRepositoryImpl implements CustomizedUserRepository {

  @Override
  public void someCustomMethod(User user) {
    // Your custom implementation
  }
}

interface UserRepository extends CrudRepository<User, Long>, CustomizedUserRepository {
  // Declare query methods here
}
```

Three types: the fragment interface, its implementation, and the repository interface
that extends the fragment. Callers see one type — `UserRepository` — and cannot tell
which methods are generated and which are yours.

> *"Extending the fragment interface with your repository interface combines the CRUD
> and custom functionality and makes it available to clients."*

## The naming rule

> *"The most important part of the class name that corresponds to the fragment interface
> is the `Impl` postfix. You can customize the store-specific postfix by setting
> `@Enable<StoreModule>Repositories(repositoryImplementationPostfix = …)`."*

`CustomizedUserRepository` → `CustomizedUserRepositoryImpl`. Not
`DefaultCustomizedUserRepository`, not `CustomizedUserRepositoryJpa`. The postfix is how
the infrastructure finds the class, and getting it wrong is caught when the repository is
created: `RepositoryComposition.validateImplementation()` throws
`FragmentNotImplementedException` — *"Fragment %s used in %s has no implementation"* — for
any fragment in the composition with nothing behind it. Which is good news, and is covered
in [08b](08b-finding-the-implementation.md).

🔴 **The name is matched against the *fragment interface*, not against the repository.**
`UserRepositoryImpl` would be the implementation of a fragment called `UserRepository` —
which is your repository interface, and that is the pattern the reference now tells you
not to use.

## The pattern that is now deprecated

This is new enough to be worth flagging, because it is what most existing code does:

> *"Historically, Spring Data custom repository implementation discovery followed a
> naming pattern that derived the custom implementation class name from the repository
> allowing effectively a single custom implementation."*

> *"A type located in the same package as the repository interface, matching repository
> interface name followed by implementation postfix, is considered a custom
> implementation and will be treated as a custom implementation. A class following that
> name can lead to undesired behavior."*

> *"We consider the single-custom implementation naming deprecated and recommend not
> using this pattern. Instead, migrate to a fragment-based programming model."*

So `UserRepositoryImpl` next to `UserRepository` still works and is now explicitly
discouraged. Two things follow. First, on an existing codebase this is a rename job with
a real payoff — one fragment per capability instead of one grab-bag class per repository.
Second, and more sharply: a class called `UserRepositoryImpl` is *picked up* whether you
meant it to be or not. Naming an unrelated helper that way is a way to hand the
repository infrastructure a bean it will try to compose in.

## The implementation is an ordinary bean

> *"The implementation itself does not depend on Spring Data and can be a regular Spring
> bean. Consequently, you can use standard dependency injection behavior to inject
> references to other beans (such as a `JdbcTemplate`), take part in aspects, and so
> on."*

That sentence is the whole value proposition. A fragment implementation can inject an
`EntityManager`, a `JdbcTemplate`, a jOOQ `DSLContext` or anything else, and everything
Spring does to normal beans — AOP, `@Transactional`, metrics, validation — applies:

```java
class OrderSearchImpl implements OrderSearch {

  private final EntityManager em;

  OrderSearchImpl(EntityManager em) {
    this.em = em;
  }

  @Override
  public List<Order> search(SearchCriteria criteria) {
    // Criteria API, a hand-built JPQL string, whatever the job needs
  }
}
```

`@PersistenceContext` on the field works too, and is what you need when the class must
participate in the container-managed persistence context rather than hold a plain
injected proxy.

⚠️ **`@Transactional` on a fragment method is honoured, and it wins.** The transactions
chapter says so directly: *"Repository methods that are backed by transactional
repository fragments inherit the transactional attributes from the actual fragment
method."* A fragment is therefore the one place inside a repository where you can set
transactional attributes per method without redeclaring an inherited CRUD method — and
also a place where an accidental `@Transactional` changes behaviour invisibly.

## Composition, and what a fragment may override

A repository is not "generated code plus your class". It is a composition:

> *"Spring Data repositories are implemented by using fragments that form a repository
> composition. Fragments are the base repository, functional aspects (such as Querydsl),
> and custom interfaces along with their implementations. Each time you add an interface
> to your repository interface, you enhance the composition by adding a fragment."*

```java
interface UserRepository extends CrudRepository<User, Long>, HumanRepository, ContactRepository {
}
```

and the resolution order is stated exactly:

> *"Repositories may be composed of multiple custom implementations that are imported in
> the order of their declaration. Custom implementations have a higher priority than the
> base implementation and repository aspects. This ordering lets you override base
> repository and aspect methods and resolves ambiguity if two fragments contribute the
> same method signature."*

Two rules in one paragraph, both load-bearing.

**Fragments beat the base implementation.** A fragment can replace `save`:

```java
interface CustomizedSave<T> {
  <S extends T> S save(S entity);
}

class CustomizedSaveImpl<T> implements CustomizedSave<T> {

  @Override
  public <S extends T> S save(S entity) {
    // Your custom implementation
  }
}

interface UserRepository extends CrudRepository<User, Long>, CustomizedSave<User> {}
interface PersonRepository extends CrudRepository<Person, Long>, CustomizedSave<Person> {}
```

This is powerful and quiet: every caller of `userRepository.save(…)` now runs your code,
and nothing at the call site changes. It is also the mechanism behind most "why is
`save()` behaving strangely" investigations that end in an unfamiliar fragment.

**Declaration order breaks ties.** If two fragments declare the same method signature,
the one declared first in the `extends` list wins. Reordering the interfaces in that list
is therefore a behaviour change that reads like a formatting change.

And fragments are reusable — *"Repository fragments are not limited to use in a single
repository interface. Multiple repositories may use a fragment interface, letting you
reuse customizations across different repositories."* The generic `<T>` in
`CustomizedSave<T>` is how a fragment aligns itself with each repository's domain type.

## When a fragment is the right answer

- **A query the abstraction cannot express** — the Criteria API by hand, a Hibernate-only
  feature, a stored procedure with an awkward signature.
- **A query that should not be JPA at all** — inject a `JdbcTemplate` or `JdbcClient` and
  write the SQL, keeping the call behind the same repository interface. Topic 05 owns the
  API ([05 · mixing both](../05-sql-first-access/11-mixing-both.md)) and the flush-ordering
  trap that comes with mixing them in one transaction.
- **A multi-statement operation that belongs to the aggregate** — a bulk insert, a
  `COPY`, an upsert.
- **Overriding a base method for every repository that opts in** — the `CustomizedSave`
  pattern above.

And when it is not: a fragment is *not* the place for business logic. It is data access
that happens to be hand-written. The moment it starts orchestrating two aggregates or
making decisions, it belongs in a service — which is the same boundary argument
[09](09-transactions-on-repositories.md) makes about transactions.

Where the implementation is found, and what happens when two candidates match, is
[08b](08b-finding-the-implementation.md).

## Gotchas

**★ The `Impl` postfix is matched against the fragment interface name.** A fragment
`OrderSearch` needs `OrderSearchImpl`. Any other name means no implementation is found,
the context still starts, and the failure is at first call.

**★ `UserRepositoryImpl` beside `UserRepository` is the deprecated pattern.** It still
works, the reference recommends against it, and it means any class you happen to name
that way is treated as a custom implementation.

**★ A fragment can silently replace `save`, `findById` or `delete`.** Custom
implementations have higher priority than the base implementation. If a CRUD method is
behaving unexpectedly, check what the repository extends before you check Hibernate.

**★ Declaration order in the `extends` list decides which fragment wins a tie.**
Reordering interfaces looks cosmetic and is not.

**★ The fragment implementation is a normal bean, so AOP applies to it.**
`@Transactional`, `@Cacheable`, metrics and validation all work — which also means an
annotation you did not intend to be active is active.

**★ A fragment's own `@Transactional` overrides the repository defaults for that method.**
The reference says fragment-backed methods inherit the fragment method's transactional
attributes. That is useful and it is also a place where a copied annotation changes
semantics.

**★ Self-invocation inside the fragment bypasses the proxy, exactly as everywhere else.**
A fragment method calling another `@Transactional` method of the same class gets no new
transaction — the trap from
[04 · self-invocation](../04-spring-transactional/03-the-self-invocation-trap.md).

**★ Injecting the repository into its own fragment is a circular dependency.** The
repository proxy is built *from* the fragment. If the fragment needs repository methods,
take the `EntityManager` instead, or use `RepositoryMethodContext`
([08b](08b-finding-the-implementation.md)).

**★ A fragment implementation is not generic-safe by magic.** `CustomizedSaveImpl<T>`
compiles for any `T`; nothing verifies that the fragment's `T` and the repository's domain
type agree beyond the declaration site. Get it wrong and it fails at runtime.

## Interview questions

**★ How do you add a hand-written query method to a Spring Data repository?**
Declare a fragment interface with the method, implement it in a class whose name is the
fragment interface plus the `Impl` postfix, and make the repository interface extend the
fragment. Callers keep using the repository interface and cannot tell the difference.

**★ Why is the implementation class named after the fragment and not the repository?**
Because the infrastructure discovers implementations by matching the fragment interface
name plus the postfix. Naming it after the repository is the historical single-implementation
pattern, which the reference now considers deprecated in favour of fragments.

**★ Can a fragment override `save()`?**
Yes. Custom implementations have a higher priority than the base implementation and
repository aspects, so a fragment declaring `<S extends T> S save(S entity)` replaces
`SimpleJpaRepository`'s version for every repository that extends that fragment.

**★ Two fragments declare the same method. Which one runs?**
The one whose interface is declared first in the repository's `extends` list — fragments
are imported in the order of their declaration, and that order resolves the ambiguity.

**★ Can a fragment implementation inject other beans?**
Yes — it is a regular Spring bean with no dependency on Spring Data. An `EntityManager`, a
`JdbcTemplate`, a `DSLContext` or a domain service all inject normally, and Spring's
aspects apply to it.

**★ What are the transactional semantics of a fragment method?**
Repository methods backed by a transactional fragment inherit the transactional attributes
of the fragment method itself. Without an annotation there, the method has no transaction
configuration of its own and relies on the caller's.

**★ When should custom logic go into a service instead of a fragment?**
As soon as it is not data access. A fragment exists to express a query or a write the
abstraction cannot; orchestration across aggregates, decisions and side effects belong at
the service boundary where the transaction is declared.

**★ Your `save()` is doing something you did not write and Hibernate is not to blame.
Where do you look?**
At the repository's `extends` list. A fragment with a matching signature takes priority
over the base implementation, and nothing at the call site shows it.

{/* FOOTER */}
