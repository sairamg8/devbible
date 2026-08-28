---
title: "A fake is production-shaped code in the test tree, and its failure mode is not that it breaks but that it quietly disagrees with the real implementation while every test stays green — which is why the fake and the real thing have to be run against the same test class, not against two"
sidebar_label: "12b · What a fake costs"
sidebar_position: 62
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Mockito wiki
> [How to write good tests](https://github.com/mockito/mockito/wiki/How-to-write-good-tests)
> (*"Don't mock everything, it's an anti-pattern"*, *"Keep the testing code compact and
> readable"*) and the **Mockito 5.23.0** class javadoc for the vocabulary this page inherits
> from [01b · Mock, stub, spy, fake](01b-mock-stub-spy-fake.md). The contract-test technique
> below is a test-design pattern, not a Mockito API — nothing on this page is claimed as
> Mockito documentation.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[12](12-mocks-vs-fakes.md) argues for the fake. This is the bill. A fake is code you own and
maintain; a fake that has drifted from the real implementation is worse than no fake at all,
because a mock's wrong answer looks like the test's invention while a fake's wrong answer looks
like the truth. One technique fixes that, and it costs nothing beyond arranging the tests you
were going to write anyway.**

## The cost side, honestly

A fake is production-shaped code living in the test tree, and it has three real costs.

**It must be maintained with the interface.** Add a method to `OrderRepository` and the fake
stops compiling — which is the good failure. Change a method's *semantics* and the fake silently
keeps the old ones, which is the bad one, and it is what the contract test below exists to
prevent.

**A wrong fake is worse than no fake**, because it is believed. A mock that returns a nonsense
value is visibly a test's invention; a fake that quietly differs from the real repository —
case-sensitive lookups where the database is case-insensitive, insertion order where the
database returns rows unordered — produces green tests across the whole suite for a behaviour
production does not have.

**It attracts features.** Every test that needs one more capability adds a method, and the
in-memory repository grows paging, sorting, projections and a cache. At that point it is a
second implementation of your data layer with no tests of its own.

## 🔴 The contract test: one test class, two implementations

The technique is to stop writing tests *for the fake* and *for the repository* and write them
once, **for the interface**, then run the same class against both. Any behaviour the fake gets
wrong now fails on the fake's run of a test the real one passes.

JUnit's `@Nested` gives the cleanest shape — one abstract contract, two concrete runs:

```java
abstract class OrderRepositoryContract {

    protected abstract OrderRepository repository();

    @Test
    void a_saved_order_is_found_by_its_id() {
        Order saved = repository().save(anOrder().build());
        assertThat(repository().findById(saved.id())).contains(saved);
    }

    @Test
    void an_unknown_id_yields_empty_rather_than_null() {
        assertThat(repository().findById(OrderId.of("ORD-nope"))).isEmpty();
    }

    @Test
    void existsById_agrees_with_findById() {
        Order saved = repository().save(anOrder().build());
        assertThat(repository().existsById(saved.id())).isTrue();
        assertThat(repository().existsById(OrderId.of("ORD-nope"))).isFalse();
    }

    @Test
    void saving_the_same_id_twice_replaces_rather_than_duplicates() {
        Order first = repository().save(anOrder().withTotal("10.00").build());
        repository().save(first.withTotal(Money.of("20.00")));
        assertThat(repository().findByCustomer(first.customer())).hasSize(1);
    }

    @Test
    void count_never_disagrees_with_the_list() {
        repository().save(anOrder().forCustomer(ALICE).build());
        repository().save(anOrder().forCustomer(ALICE).build());
        assertThat(repository().countByCustomer(ALICE))
                .isEqualTo(repository().findByCustomer(ALICE).size());
    }

    @Test
    void a_deleted_order_is_gone() {
        Order saved = repository().save(anOrder().build());
        repository().deleteById(saved.id());
        assertThat(repository().findById(saved.id())).isEmpty();
    }
}
```

```java
// Fast: runs in every build, in milliseconds.
class InMemoryOrderRepositoryTest extends OrderRepositoryContract {
    private final OrderRepository repository = new InMemoryOrderRepository();
    @Override protected OrderRepository repository() { return repository; }
}
```

```java
// Slow: the same assertions, against the real thing.
@DataJpaTest
class JpaOrderRepositoryTest extends OrderRepositoryContract {
    @Autowired private OrderRepository repository;
    @Override protected OrderRepository repository() { return repository; }
}
```

**What belongs in the contract** is every fact the calling code is entitled to rely on: absence
is `Optional.empty()` and never `null`; `existsById` agrees with `findById`; a count agrees with
the list it counts; saving the same identity twice replaces; a delete is observable. Those are
exactly the invariants a hand-written fake gets subtly wrong.

**What does not belong** is anything only one implementation can do. Transactions, constraint
violations, lock timeouts, SQL-level ordering, collation. Putting those in the contract makes the
fake either fail or grow features until it is a database — and the fake failing a test it can
never pass is noise, not signal. Those belong in the real implementation's own test file,
alongside the contract it inherits.

**Where it stops.** The contract proves the fake and the real implementation agree *about the
things the contract states*. It cannot prove the contract is complete. Anything production
depends on and the contract does not mention is still a place the fake may quietly differ — so
when a production bug turns out to be a fake/real divergence, the fix has two parts: the fake,
and a new contract test that would have caught it.

## Where the boundary sits against a real dependency

Three tiers, and the fake is the middle one.

| | What it proves | Cost per test |
|---|---|---|
| **Mock** | the code calls the collaborator as scripted | microseconds |
| **Fake** | the code's *sequence* of operations is coherent | microseconds |
| **Real dependency in a container** | the SQL, the constraints, the transactions and the driver are right | seconds, once per suite |

A fake cannot produce a unique-constraint violation, a deadlock, a lock timeout, a rollback, or
a row that a `WHERE` clause matched differently than you expected — because it has no SQL and no
transactions. Those are exactly the things a repository test must cover, and they need the real
database. **07 · Testcontainers** *(not written yet)* is that argument, including the "it passed
on H2" version of this same mistake.

The split that works: **domain and service logic against fakes and stubs; the repository
implementations against a real database; nothing important against a mocked `DataSource`.**


## Gotchas

**★ A fake whose semantics quietly differ from the real thing.**
Insertion-ordered results where the database returns rows unordered; `equals`-based lookup where
the column collation is case-insensitive; no length limit where the column is `VARCHAR(20)`.
Every test in the suite is now green about behaviour production does not have. The contract test
above is the only thing that catches it.

**★ A fake that grows into a second implementation.**
Once it has paging, sorting, projections and a cache, it is production code without production
tests, and its own bugs start failing tests for reasons unrelated to the code under test. When a
fake stops being small, the real dependency in a container is the honest answer.

**★ Assuming a fake removes the need for an integration test.**
It removes the need for *many* of them. The repository implementation, the SQL and the schema
are still unverified until something runs against a real database, and a fake's green tests are
silent about all three.


**★ Two separate test classes — one for the fake, one for the repository.**
They drift the moment either is edited, and nothing compares them. The whole technique is that
there is **one** set of assertions and two runs of it; the second test class exists only to
supply a different `repository()`.

**★ Putting database-only behaviour in the shared contract.**
A unique-constraint violation, a transaction rollback or a lock timeout cannot happen in a
`LinkedHashMap`. Asserting them in the contract forces the fake to grow a feature it should not
have, or to fail permanently. Keep them in the real implementation's own test class.

**★ Treating a passing contract as proof the fake is correct.**
It proves agreement about what the contract states. A behaviour production relies on and the
contract never mentions is exactly where a fake diverges silently — which is why the fix for
every discovered divergence is two commits' worth of work: the fake, and the missing contract
test.

**★ A contract test that depends on ordering the real implementation does not guarantee.**
`assertThat(findAll()).containsExactly(a, b, c)` passes on a `LinkedHashMap` and is a coin toss
against a table with no `ORDER BY`. Either the interface promises an order — in which case the
implementation must sort — or the contract must assert with `containsExactlyInAnyOrder`.

**★ Sharing the fake instance between the contract's test methods.**
The contract runs against a stateful object, so the instance has to be fresh per test. A field
initialiser gives you that under JUnit's default per-method lifecycle; a `static` field or
`@TestInstance(PER_CLASS)` silently does not.

## Interview questions

**★ What are the costs of a fake?**
It is code in the test tree that must track the interface — a signature change breaks
compilation, which is fine, but a *semantic* change does not, which is the dangerous case. A
fake that differs from the real implementation is worse than no fake, because the whole suite is
now green about behaviour production lacks. And fakes attract features until they become a
second implementation with no tests of their own.

**★ Does a fake replace an integration test?**
No. A fake has no SQL, no transactions, no constraints and no driver, so it cannot show a
unique-constraint violation, a deadlock, a rollback or a query that matched differently than you
expected. It replaces many *service-level* tests. The repository implementation still needs a
real database, which is what Testcontainers is for.

**★ How do you stop a fake from drifting away from the real implementation?**
Write the tests once, against the interface, and run them against both — an abstract contract
test that each implementation subclasses. That way any behaviour the fake gets wrong fails on
the fake's run of the same test the real one passes — the contract-test shape set out above.

{/* FOOTER */}

**★ Describe the contract-test technique concretely.**
Write the tests once as an abstract class that exercises the *interface* through a single
abstract accessor — `protected abstract OrderRepository repository()`. Then write two tiny
subclasses: one supplying the in-memory fake, one supplying the real implementation under
whatever slice or container it needs. Both run the same assertions. Any behaviour the fake gets
wrong now fails on a test the real implementation passes, in the same build.

**★ What goes in the contract and what stays out?**
In: every fact a caller is entitled to rely on — absence as `Optional.empty()` rather than
`null`, `existsById` agreeing with `findById`, a count agreeing with the list it counts, saving
the same identity replacing rather than duplicating, a delete being observable. Out: anything
only one implementation can do — transactions, constraint violations, lock timeouts, SQL
ordering, collation. Those go in the real implementation's own test class.

**★ Doesn't the contract test double the runtime?**
Only for the real implementation's run, which you were going to write anyway — the fake's run is
milliseconds. What it removes is the far more expensive outcome: a suite that is green because
the fake agrees with itself.

**★ A production bug turns out to be a place where the fake and the database disagree. What do
you do?**
Two things, and the second is the one people skip. Fix the fake, and add a contract test that
would have caught the divergence. Without the second, the same class of drift is still
undetectable everywhere else in the interface.

{/* FOOTER */}
