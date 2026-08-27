---
title: "Changing behaviour for every repository at once means replacing SimpleJpaRepository itself, which works, is documented, and is almost always the wrong answer compared with a fragment that repositories opt into"
sidebar_label: "08c · The base repository"
sidebar_position: 40
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Custom Repository
> Implementations", the *Customize the Base Repository*, *Customizing the Repository
> Factory*, *Customize the Repository Factory Bean* and *Using JpaContext in Custom
> Implementations* sections
> ([repositories/custom-implementations.html](https://docs.spring.io/spring-data/jpa/reference/repositories/custom-implementations.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**A fragment changes one repository, or several that opt in. Sometimes the requirement is
genuinely global — every `save` stamps a tenant, every `delete` is a soft delete. Spring
Data has three levels of answer for that, in increasing order of power and of regret.**

## Level one: replace the base class

> *"The approach described in the preceding section requires customization of each
> repository interfaces when you want to customize the base repository behavior so that
> all repositories are affected. To instead change behavior for all repositories, you can
> create an implementation that extends the persistence technology-specific repository
> base class."*

```java
class MyRepositoryImpl<T, ID> extends SimpleJpaRepository<T, ID> {

  private final EntityManager entityManager;

  MyRepositoryImpl(JpaEntityInformation entityInformation, EntityManager entityManager) {
    super(entityInformation, entityManager);

    // Keep the EntityManager around to used from the newly introduced methods.
    this.entityManager = entityManager;
  }

  @Override
  @Transactional
  public <S extends T> S save(S entity) {
    // implementation goes here
  }
}
```

Two constraints, both in the reference and both easy to trip over:

> *"The class needs to have a constructor of the super class which the store-specific
> repository factory implementation uses. If the repository base class has multiple
> constructors, override the one taking an `EntityInformation` plus a store specific
> infrastructure object (such as an `EntityManager` or a template class)."*

and it has to be registered:

```java
@Configuration
@EnableJpaRepositories(repositoryBaseClass = MyRepositoryImpl.class)
class ApplicationConfiguration { … }
```

⚠️ Note the `@Transactional` on the override in the reference's own example, and copy it.
`SimpleJpaRepository` is annotated `@Transactional(readOnly = true)` at class level, with a
plain `@Transactional` on each write method that overrides the read-only flag
([09](09-transactions-on-repositories.md)). Your subclass inherits the class-level
annotation — the rule in
[04 · 2d](../04-spring-transactional/02d-the-inheritance-rule.md) — so the question is
whether an un-annotated override also picks up the method-level one from the superclass.

**I could not settle that from the documentation.** It depends on how Spring's transaction
attribute source resolves annotations across an overridden method, which neither the Spring
Data reference nor the `@Transactional` chapter states for this case. What the reference
does do is re-declare the annotation on the override, and that is the only version that is
unambiguously correct. Re-declare it; do not reason about it.

The cost of this level is scope. It applies to **every repository in the configuration's
scope**, including ones written next year by people who have never read your base class,
and including the ones where the behaviour is wrong. There is no opt-out short of a second
configuration.

## Level two: customise the factory

> *"Customizing the repository factory through `RepositoryFactoryCustomizer` provides
> direct access to components involved with repository instance creation. This mechanism
> is useful when you want to adjust selected aspects of proxy creation without introducing
> a fully custom repository factory bean."*

```java
factoryBean.addRepositoryFactoryCustomizer(repositoryFactory -> {
	repositoryFactory.addInvocationListener(…);
	repositoryFactory.addQueryCreationListener(…);

	repositoryFactory.addRepositoryProxyPostProcessor((factory, repositoryInformation) ->
			factory.addAdvice(…));
});
```

This is the level for cross-cutting *observation* — timing every repository invocation,
logging every created query, adding an advice — rather than for changing what a method
does. Note the wiring warning:

> *"A `RepositoryFactoryCustomizer` is associated with a particular repository factory
> bean, ideally through `BeanPostProcessor` so that only specific repositories are
> affected. Note that customizer beans are not applied automatically to prevent unwanted
> wiring that become especially relevant in multi-repository arrangements or when using
> multiple Spring Data modules."*

🔴 **Customizer beans are not picked up automatically.** Declaring one and expecting it to
apply is the mistake this paragraph exists to prevent; you attach it to a factory bean
yourself.

## Level three: replace the factory bean

> *"The most powerful approach to customize repository creation is to provide a custom
> repository factory bean, typically a subclass of `RepositoryFactorySupport`,
> `TransactionalRepositoryFactoryBeanSupport` or the store-specific repository factory
> bean."*

> *"Note that this approach requires the most effort and is typically only needed when you
> want to change core aspects of repository creation."*

The reference lists the three things you then have to keep straight yourself:

> *"`repositoryBaseClass`: The repository base class defines which methods are implemented
> by the base class and which methods require additional handling through aspects or
> custom implementations."*
>
> *"`repositoryFragmentsContributor`: A `RepositoryFragmentsContributor` allows
> contributions to repository composition after all standard fragments have been
> collected. Store modules use this mechanism to add features such as Querydsl or
> Query-by-Example support. It also serves as an SPI for third-party extensions."*
>
> *"`exposeMetadata`: Controls whether invocation metadata is available through
> `RepositoryMethodContext.getContext()`."*

If you are reading that list to decide whether you need this level, the answer is no. It
is the extension point a *store module* uses, not an application.

## Choosing between the three, and the fourth option

| Requirement | Reach for |
|---|---|
| One repository needs a hand-written query | A fragment ([08](08-custom-implementations.md)) |
| Several repositories share a capability | A generic fragment they each extend |
| A library ships a capability | A fragment registered in `spring.factories` ([08b](08b-finding-the-implementation.md)) |
| Every repository must behave differently | `repositoryBaseClass` |
| Observe or advise every repository call | `RepositoryFactoryCustomizer` |
| Change how repositories are created | A custom factory bean — and reconsider |

The row worth arguing with is the fourth. **A generic fragment that every repository
extends does the same job as a custom base class, and it says so in the type.**

```java
interface SoftDeleting<T, ID> {
  void softDelete(ID id);
}

interface OrderRepository extends JpaRepository<Order, Long>, SoftDeleting<Order, Long> {}
```

`extends SoftDeleting` is visible in the file a reader is already looking at. A custom
`repositoryBaseClass` is visible only in a configuration class they have no reason to
open, and it changes the meaning of `delete` without changing any code they can see. The
base class wins only when the behaviour genuinely must not be opt-in — a hard multi-tenancy
filter, for instance, where a repository that forgot to extend the fragment would be a
security bug.

## `JpaContext` — when there is more than one `EntityManager`

> *"When working with multiple `EntityManager` instances and custom repository
> implementations, you need to wire the correct `EntityManager` into the repository
> implementation class. You can do so by explicitly naming the `EntityManager` in the
> `@PersistenceContext` annotation or, if the `EntityManager` is `@Autowired`, by using
> `@Qualifier`."*

The alternative avoids naming the persistence unit at all:

```java
class UserRepositoryImpl implements UserRepositoryCustom {

  private final EntityManager em;

  @Autowired
  public UserRepositoryImpl(JpaContext context) {
    this.em = context.getEntityManagerByManagedType(User.class);
  }
}
```

> *"Spring Data JPA includes an interface called `JpaContext` that lets you obtain the
> `EntityManager` by managed domain class, assuming it is managed by only one of the
> `EntityManager` instances in the application."*

> *"The advantage of this approach is that, if the domain type gets assigned to a
> different persistence unit, the repository does not have to be touched to alter the
> reference to the persistence unit."*

⚠️ The assumption is load-bearing: *"assuming it is managed by only one of the
`EntityManager` instances"*. A domain class mapped into two persistence units cannot be
resolved this way. In a single-datasource application — which is most of them — `JpaContext`
is unnecessary indirection; it earns its place exactly when there are two units and the
mapping between them may change.

## Gotchas

**★ Re-declare `@Transactional` on every write method you override in a base class.** The
class-level `readOnly = true` is inherited for certain; whether the method-level
`@Transactional` on `SimpleJpaRepository.save` carries to your override is not something the
documentation settles. The reference's own example annotates the override — do the same and
the question never arises.

**★ A custom base class applies to every repository in scope, forever.** Including the ones
written after you leave. There is no per-repository opt-out.

**★ The base class must expose the constructor the factory calls.** `(EntityInformation,
EntityManager)` for JPA. A base class with only a no-arg or a convenience constructor fails
at repository creation.

**★ `repositoryBaseClass` lives on `@EnableJpaRepositories`.** In a Boot application that
annotation is normally absent; adding it takes over base-package configuration too.

**★ `RepositoryFactoryCustomizer` beans are not applied automatically.** The reference says
so explicitly. Attach the customizer to the factory bean, usually through a
`BeanPostProcessor`, or it does nothing.

**★ A custom base class hides behaviour where nobody looks.** A fragment names itself in
the repository's `extends` clause; a base class does not appear in the repository file at
all. Prefer the fragment unless the behaviour must be non-optional.

**★ `JpaContext.getEntityManagerByManagedType` assumes a single owning persistence unit.**
An entity mapped into two units cannot be resolved by type.

**★ Replacing the repository factory bean means owning `repositoryBaseClass`,
`repositoryFragmentsContributor` and `exposeMetadata` yourself.** That is a store-module
job, and it is the level at which upgrades start breaking you.

**★ None of these levels affect query methods.** Derived queries and `@Query` methods are
built by the query-lookup machinery, not by the base class. Overriding `findAll` in a base
class does not change what `findByStatus` does.

## Interview questions

**★ How do you change behaviour for every repository in an application?**
Write a class extending `SimpleJpaRepository`, expose the constructor the factory uses, and
register it with `@EnableJpaRepositories(repositoryBaseClass = …)`.

**★ Why does the reference's base-class example put `@Transactional` on the overridden
`save`?**
Because `SimpleJpaRepository` is `@Transactional(readOnly = true)` at class level and relies
on a method-level plain `@Transactional` to lift that flag for writes. The class-level
annotation is inherited by the subclass; re-declaring the method-level one on the override
removes any question about whether it carried across, which is exactly why the example does
it.

**★ When is a generic fragment better than a custom base class?**
Almost always. A fragment names itself in the repository's `extends` list, so the behaviour
is visible where the reader already is, and repositories opt in. A base class is invisible
from the repository file and applies to everything in scope.

**★ When is the base class the right answer anyway?**
When the behaviour must not be optional — a tenancy filter or a soft-delete convention
where a repository that forgot to opt in would be a correctness or security defect.

**★ What is `RepositoryFactoryCustomizer` for?**
Adjusting selected aspects of proxy creation — invocation listeners, query-creation
listeners, extra advices — without writing a whole factory bean. It is not applied
automatically; you attach it to a specific factory bean.

**★ What is `JpaContext` and when do you need it?**
An interface that returns the `EntityManager` managing a given domain class, so a fragment
implementation does not have to name a persistence unit. It is only meaningful with
multiple `EntityManager` instances, and only when each domain type is managed by exactly
one of them.

**★ Does customising the base repository change how derived queries behave?**
No. Query methods are produced by the query-lookup mechanism, not by the base class. The
base class only supplies the implementations of the inherited CRUD methods.

{/* FOOTER */}
