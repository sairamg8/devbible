---
title: "A contract test proves the fake and the real implementation agree about the clauses it states and nothing else, so the two things that decide whether it is worth anything are what you put in it and whether the slow half actually runs — and the discipline that makes both work is that every clause must be expressible through the interface alone"
sidebar_label: "12d · Keeping a contract honest"
sidebar_position: 55
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **JUnit 6.0.3** User Guide — "Test Classes and Methods"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/test-classes-and-methods.html)),
> "Definitions" ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/definitions.html)) —
> and the `@ParameterizedClass` material already verified in
> [08c · Parameterized classes](../03-parameterized-tests/08c-parameterized-classes.md). The
> contract test is a test-design pattern, not an API; nothing here is claimed as Mockito or JUnit
> documentation.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Mockito 5.23.0, **JUnit Jupiter 6.0.3**. **No sandbox** — this page carries Java source, never a
> fabricated test run.

**[12c · Contract-testing a fake](12c-contract-testing-a-fake.md) builds the structure. A correct
structure asserting the wrong things, or asserting the right things in a suite nobody runs, buys
nothing — and both are the normal outcome. This chunk is the content discipline: the one rule that
decides every "does this clause belong?" argument, the clauses that actually catch drift, and how
the fixture stays clean for each of them. Keeping the expensive half of the suite alive — tags,
the shapes that look like alternatives, and growing the contract from real divergences — is
[12e · Running both halves](12e-running-both-halves.md).**

## 🔴 The rule that settles everything: expressible through the interface alone

[12b](12b-what-a-fake-costs.md) gives the list — absence is `Optional.empty()` and never `null`,
`existsById` agrees with `findById`, a count agrees with the list it counts, saving the same
identity replaces, a delete is observable. Underneath that list is one rule, and it decides the
cases the list does not cover:

**A clause belongs in the contract if and only if it can be *set up*, *exercised* and *asserted*
using nothing but the interface.**

Each of the three matters, and the setup half is the one people breach:

```java
@Test
void a_deleted_order_is_gone() {
    Order saved = repository().save(anOrder().build());     // setup: through the interface ✔
    repository().deleteById(saved.id());                    // exercise: through the interface ✔
    assertThat(repository().findById(saved.id())).isEmpty();// assert: through the interface ✔
}
```

```java
@Test
void an_order_with_a_legacy_null_status_reads_as_PENDING() {
    jdbcTemplate.update("insert into orders(id, status) values (?, null)", ID);   // ✘
    assertThat(repository().findById(ID)).map(Order::status).contains(PENDING);
}
```

The second clause cannot run against the fake — there is no JDBC — so it is not a contract clause.
It is a good test, and it belongs in the JPA implementation's own test class, next to the contract
it also inherits. The same verdict applies to a clause that needs the fake's helper:
`repository().containing(order)` from [12](12-mocks-vs-fakes.md)'s fake is not on the interface,
so a contract clause may not call it.

The rule also explains the exclusions [12b](12b-what-a-fake-costs.md) lists — transactions,
constraint violations, lock timeouts, SQL ordering, collation. None of them can be *provoked*
through the interface, so none of them are contract clauses, and forcing them in makes the fake
either grow a feature it should not have or fail permanently.

## The other direction: what the contract must state that you were not going to write down

Because a fake is written by someone reading the interface, it diverges precisely where the
interface is silent. So the useful clauses are the ones about **things nobody wrote in the
javadoc**:

- **Absence.** `Optional.empty()` or `null`? An empty `List` or `null`? Every fake gets one of
  these wrong eventually.
- **Identity.** Is the returned object the one you passed, or a copy? Does `save` mutate its
  argument? A fake that stores the reference and a JPA repository that returns a managed entity
  behave differently the moment the caller mutates the object afterwards.
- **Idempotence.** Saving the same identity twice, deleting twice, deleting something absent.
- **Ordering.** If the interface promises an order, assert it; if it does not, assert with
  `containsExactlyInAnyOrder` so the fake's `LinkedHashMap` does not accidentally encode a promise
  the database never made.
- **Generated values.** Who assigns the id, and is it visible on the returned object or only after
  a re-read?
- **Boundaries.** Empty store, one element, a query matching nothing.

Each of those is a sentence the interface should have said and did not. Writing the clause is how
you find out that the two implementations disagreed about it.

## Keeping the fixture fresh

The contract runs against a stateful object, so every clause needs a clean one. Jupiter's default
lifecycle gives you that for free — a new test instance per test method, so a subclass field
initialiser runs again per method:

```java
private final OrderRepository repository = new InMemoryOrderRepository();   // fresh per test
```

Two ways to lose it, both silent:

- **`static`.** `private static final OrderRepository repository = …` is created once for the whole
  class. Orders saved by clause 3 are still there in clause 7, and the count clauses start failing
  in an order-dependent way.
- **`@TestInstance(PER_CLASS)`**, which reuses one instance for every method —
  [03b · Per-class lifecycle](../01-junit-5/03b-per-class-lifecycle.md). The field initialiser then
  runs once. If a contract implementation needs `PER_CLASS` for a non-static `@BeforeAll`, the
  accessor has to build a new instance per test instead of returning a field, and a `@BeforeEach`
  reset is the usual way.

The real implementation's freshness is a different problem with a different answer: a transaction
rolled back per test (`@DataJpaTest` does this), a truncate in `@BeforeEach`, or a container per
class. Whatever it is, it belongs in that subclass, not in the contract — the contract's own
comment on the accessor should simply state the requirement, as the listing above does.

## Naming, so a failure says which implementation

By default the report reads `JpaOrderRepositoryTest > count_never_disagrees_with_the_list()`, which
is already unambiguous. Two things are worth doing anyway:

```java
@DisplayName("OrderRepository contract · in-memory fake")
class InMemoryOrderRepositoryTest implements OrderRepositoryContract { … }
```

and keeping the two subclasses in the same package as the contract, so a reader who opens one finds
the other. The point of the pattern is that the two runs are compared by a human when one of them
fails; anything that makes "the fake passes and the database does not" obvious at a glance is worth
the line.
## Gotchas

**★ A `static` fixture field in the implementation class.**
One instance for the whole class, so state leaks between clauses and the suite becomes
order-dependent — the same hazard as
[12e · Shared state](../01-junit-5/12e-shared-state-under-parallelism.md), with the contract's own
clauses as the interfering parties.


**★ `@TestInstance(PER_CLASS)` on a contract implementation.**
The field initialiser runs once instead of once per method, so the fake accumulates state across
clauses. If you need `PER_CLASS`, build the object inside the accessor or reset it in a
`@BeforeEach`.


**★ Putting the real implementation's reset logic in the contract.**
A truncate, a rollback or a container restart is implementation-specific and cannot be expressed
through the interface. It belongs in the subclass; the contract should only state the requirement
that each clause starts clean.


**★ Making the contract's accessor return a *new* object on each call.**
`return new InMemoryOrderRepository();` inside `repository()` looks like freshness and destroys
every clause, because `repository().save(x)` and `repository().findById(…)` then talk to two
different objects. Fresh **per test**, not per call.


**★ A contract clause that sets up its fixture outside the interface.**
`jdbcTemplate.update(...)`, a direct `Map.put`, or the fake's own `containing(...)` helper. It
cannot run against both implementations, so it is not a contract clause — it belongs in one
implementation's own test class.

**★ A clause that asserts an ordering the interface does not promise.**
`containsExactly(a, b, c)` passes on a `LinkedHashMap` and is a coin toss against a table with no
`ORDER BY`. Either the interface promises an order and every implementation must sort, or the
clause uses `containsExactlyInAnyOrder`.

**★ Writing only the clauses the javadoc already states.**
Those are the ones both implementations got right. The value is in the unstated behaviour —
absence, identity, idempotence, generated ids, boundaries — which is exactly where a fake written
from the interface diverges.

## Interview questions

**★ How do you make sure each clause starts with a clean object?**
Rely on Jupiter's default per-method test instance and initialise the fixture in a field
initialiser or the accessor, so it is rebuilt for every test method. Avoid `static` fields and
`@TestInstance(PER_CLASS)`, both of which turn one object into a shared one. The real
implementation's equivalent — a rolled-back transaction, a truncate, a fresh container — lives in
its own subclass, never in the contract.

**★ How do you decide whether a behaviour belongs in the shared contract?**
Ask whether it can be set up, exercised and asserted using only the interface. Saving and reading
back qualifies. A unique-constraint violation, a lock timeout, a legacy row inserted with raw SQL,
or anything needing the fake's own helper method does not — those are real tests, but they belong
in one implementation's own class, alongside the contract it also inherits.

**★ Which clauses actually catch fake drift?**
The ones about behaviour the interface never wrote down: whether absence is `Optional.empty()` or
`null`, whether the returned object is the one you passed or a copy, whether saving the same
identity twice replaces or duplicates, who assigns the id and when it becomes visible, what an
empty store returns. A fake is written by reading the interface, so it diverges exactly where the
interface is silent.

{/* FOOTER */}
