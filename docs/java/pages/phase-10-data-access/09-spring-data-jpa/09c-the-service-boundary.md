---
title: "The transaction defaults on a repository make each call correct on its own and say nothing about a unit of work spanning two of them, which is why Spring Data's own reference tells you to declare the boundary where the work starts"
sidebar_label: "09c · The service boundary"
sidebar_position: 43
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Transactionality"
> ([jpa/transactions.html](https://docs.spring.io/spring-data/jpa/reference/jpa/transactions.html))
> — and "Persisting Entities"
> ([jpa/entity-persistence.html](https://docs.spring.io/spring-data/jpa/reference/jpa/entity-persistence.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**A repository method's transaction makes that one method correct. It cannot make two
method calls correct together, because it does not know they belong together. That is the
whole argument for a service boundary, and Spring Data's own documentation makes it in one
sentence.**

## The recommendation, in the reference's words

> *"While examples discuss `@Transactional` usage on the repository, we generally recommend
> declaring transaction boundaries when starting a unit of work to ensure proper consistency
> and desired transaction participation."*

That is the closing sentence of the transactions chapter, after two pages of showing you how
to configure transactions on repositories. It is worth reading as what it is: the module's
authors saying that the repository-level configuration is a *default*, not a design.

The worked example:

```java
@Service
public class UserManagementImpl implements UserManagement {

  private final UserRepository userRepository;
  private final RoleRepository roleRepository;

  public UserManagementImpl(UserRepository userRepository, RoleRepository roleRepository) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
  }

  @Transactional
  public void addRoleToAllUsers(String roleName) {

    Role role = roleRepository.findByName(roleName);

    for (User user : userRepository.findAll()) {
      user.addRole(role);
      userRepository.save(user);
    }
  }
}
```

> *"This example causes call to `addRoleToAllUsers(…)` to run inside a transaction
> (participating in an existing one or creating a new one if none are already running).
> **The transaction configuration at the repositories is then neglected, as the outer
> transaction configuration determines the actual one used.** Note that you must activate
> `<tx:annotation-driven />` or use `@EnableTransactionManagement` explicitly to get
> annotation-based configuration of facades to work."*

🔴 **"The transaction configuration at the repositories is then neglected."** Once a
transaction exists, every repository call joins it and every setting on
`SimpleJpaRepository` — including `readOnly = true` on the reads — is ignored in favour of
the outer one. This is ordinary `PROPAGATION_REQUIRED` participation
([04 · 8](../04-spring-transactional/08-propagation-required.md)) and it has a corollary
worth stating: **a read-only service method makes the repository's write methods read-only
too**, which is the silent failure of [09b](09b-what-readonly-actually-does.md).

## What the boundary actually buys

Four distinct things, and it is worth separating them because they are usually conflated
into "atomicity".

**1 · Atomicity across calls.** Two `save` calls in a non-transactional service are two
transactions; either can commit without the other. With a boundary they are one unit that
rolls back together.

**2 · One persistence context for the whole unit of work.** Without a boundary each
repository call gets its own short-lived `EntityManager`. With one, all calls share an
identity map — so a second `findById` for the same row does not go to the database
([06 · 11b · find that issues no SQL](../06-jpa-hibernate-model/11b-find-that-issues-no-sql.md)),
and an entity loaded by one repository call is still *managed* when the next one runs.

**3 · Dirty checking works at all.** In the example above, `user.addRole(role)` mutates a
managed entity, and the reference notes what follows:

> *"Note that the call to `save` is not strictly necessary from a JPA point of view, but
> should still be there in order to stay consistent to the repository abstraction offered by
> Spring Data."*

The `save` is redundant *because there is a transaction*. Remove the boundary and the entity
is detached, dirty checking has nothing to check, and now `save` is not redundant — it is a
`merge`, with an extra `SELECT` and a returned copy
([06 · 13b · merge returns a copy](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md)).
The same three lines mean two different things depending on a boundary declared elsewhere.

**4 · Read-your-own-writes within the unit.** A query issued after a change in the same
transaction sees that change, because Hibernate flushes before a query whose results it
could affect ([06 · 15b · what triggers a flush](../06-jpa-hibernate-model/15b-what-triggers-a-flush.md)).
Across two separate transactions there is no such guarantee and no such flush.

## Where the boundary goes

At the **start of the unit of work** — the method that answers a business question, not the
method that issues a statement. In practice that is the application service, and two
placements are usually wrong:

- **On the controller.** The transaction then spans serialisation, which is how a
  `LazyInitializationException` gets fixed by accident and how a slow client ends up holding
  a database connection. That is the open-session-in-view argument in
  [08 · 15 · open-in-view](../08-the-n-plus-1-problem/15-open-in-view.md).
- **Only on the repository.** Then the unit of work is a single statement by definition, and
  no amount of annotation on the interface changes it.

Two practical shapes worth naming:

```java
@Service
class OrderService {

    @Transactional(readOnly = true)
    public OrderView find(Long id) { … }          // a read unit of work

    @Transactional
    public void place(OrderRequest request) { … } // a write unit of work
}
```

Two annotations, both stating what the *method* is, not what the repository is. The
repository's own defaults are then never consulted, and the settings a reader needs are in
the file they are already reading.

## What the boundary does not fix

- **It does not make a bulk `@Modifying` statement visible to the persistence context.**
  That is still [04b](04b-flush-clear-and-the-stale-context.md)'s problem, and a longer
  transaction makes a stale context *more* likely, not less.
- **It does not make an N+1 into one query.** It makes the N+1 possible by keeping
  associations initialisable. Fetching is a call-site decision — topic
  [08](../08-the-n-plus-1-problem/README.md).
- **It does not create a transaction if the proxy is bypassed.** A `@Transactional` method
  called from another method of the same class does nothing at all
  ([04 · 3](../04-spring-transactional/03-the-self-invocation-trap.md)), and a repository
  called from inside that method then falls back to its own per-call transactions — which
  looks like it works.
- **It does not bound the transaction to the work.** A boundary around a method that also
  calls an HTTP API holds a connection for the duration of that call. The unit of work is
  the database work, not the method.

## Gotchas

**★ Once an outer transaction exists, every repository setting is neglected.** Including
`readOnly = true` on the reads, and including the plain `@Transactional` on `save`. The
outer configuration determines the actual one used.

**★ A `readOnly = true` service method silently disables writes inside it.** The repository's
own read-write annotation does not apply, because `save` participates rather than starting a
new transaction.

**★ Without a boundary, `save` on a detached entity is a `merge`.** Extra `SELECT`, and the
returned instance is not the one you passed in. With a boundary it is often not needed at
all.

**★ Without a boundary, two repository calls cannot see each other's uncommitted work.**
Separate transactions, separate persistence contexts, no read-your-own-writes.

**★ Annotation-driven transactions must actually be enabled.** The reference says to activate
`@EnableTransactionManagement` (Spring Boot's auto-configuration does this). Without it the
annotation is inert — the whole of
[04 · 5 · annotations that do nothing](../04-spring-transactional/05-annotations-that-do-nothing.md).

**★ Moving the boundary to the controller trades one bug for two.** Lazy loading starts
working and connection hold time becomes request duration.

**★ A boundary makes the transaction longer, which makes lock hold times longer.** Atomicity
and contention pull in opposite directions; the unit of work should be as small as
correctness allows and no smaller.

**★ Repository-level `@Transactional` is still worth having.** It is the fallback for callers
that forget, and it makes a query method transactional at all. It is a floor, not a design.

## Interview questions

**★ Spring Data annotates repository methods for you. Why declare `@Transactional` on a
service at all?**
Because a repository transaction is one statement wide. A unit of work that touches two
repositories, or reads and then writes, needs one boundary around all of it — and the
reference recommends declaring the boundary where the unit of work starts.

**★ What happens to the repository's own transaction settings when a service method is
transactional?**
They are neglected. The repository call participates in the existing transaction, and the
outer configuration determines the settings actually used.

**★ In the reference's `addRoleToAllUsers` example, why is the `save` call not strictly
necessary?**
Because the entities are managed inside the transaction and dirty checking will issue the
updates at flush. The reference keeps the call for consistency with the repository
abstraction — and it becomes necessary the moment the boundary disappears.

**★ What changes about `save` when there is no transaction around the service method?**
The entity is detached, so `save` performs a `merge` rather than tracking a managed
instance: an extra `SELECT`, and a returned copy that is not the object you passed in.

**★ Why does the same code work in a service and fail in a controller?**
Because the service method has a boundary and the controller does not, so entities are
detached by the time the controller touches an association — and the transaction settings
that were in force were the repository's per-call ones, not a unit-of-work boundary.

**★ Should the boundary go on the controller instead?**
No. It makes the transaction span request handling and serialisation, holding a connection
for the duration and hiding fetching bugs behind open-session-in-view. The boundary belongs
where the unit of work starts.

**★ Does a service boundary fix an N+1?**
No — it enables one. Keeping the persistence context open means lazy associations can be
initialised, which is what makes the per-row queries possible. Fixing it is a fetching
decision at the call site.

**★ What is the cost of a service-level boundary?**
A longer transaction: locks held longer, connection held longer, and more exposure to a
stale persistence context after a bulk statement. Make the unit of work exactly as wide as
correctness requires.

{/* FOOTER */}
