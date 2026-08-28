---
title: "A contract test only keeps a fake honest if the assertions are literally the same code running twice, which in Jupiter means inheriting them — and the guide's own sentence about inheritance carries the trap, because a subclass that overrides a contract method replaces it silently and the run still reports the test as passing"
sidebar_label: "12c · Contract-testing a fake"
sidebar_position: 54
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **JUnit 6.0.3** User Guide — "Test Classes and Methods"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/test-classes-and-methods.html))
> and "Definitions"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/definitions.html)). The contract
> test itself is a test-design pattern, not an API of Mockito or JUnit; nothing on this page is
> claimed as Mockito documentation. Vocabulary from
> [01b · Mock, stub, spy, fake](01b-mock-stub-spy-fake.md).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Mockito 5.23.0, **JUnit Jupiter 6.0.3**. **No sandbox** — this page carries Java source, never
> a fabricated test run.

**[12b · What a fake costs](12b-what-a-fake-costs.md) names the technique and shows its shape: one
abstract test class, two subclasses, the same assertions run against the fake and against the real
implementation. This chunk is the part that decides whether it actually works — the Jupiter
mechanics of "the same assertions": which inheritance shape to use, why Java's single `extends`
usually settles it, and the one-line change that disables a contract clause without any test
turning red. What goes *into* the contract, how the fixture stays clean and how the slow half gets
run without slowing the fast loop is
[12d · Keeping a contract honest](12d-keeping-a-contract-honest.md).**

## Why it has to be inheritance

The property the technique needs is: *it must be impossible for the fake's assertions and the real
implementation's assertions to differ.* Two test classes containing the same assertions do not
have that property — they have it on the day they were written and lose it on the first edit.
Copying is the failure mode, not the implementation detail.

Jupiter gives the guarantee directly:

> *"Test methods and lifecycle methods are inherited unless they are overridden according to the
> visibility rules of the Java language."*
>
> *"a `@Test` method from a superclass will always be applied in a subclass unless the subclass
> explicitly overrides the method."*

So a `@Test` written once in a supertype runs once per concrete subtype, from one source of truth.
Add a clause to the contract and every implementation is tested against it in the same commit,
with no way to opt one of them out by accident.

The other half of the guarantee is that the contract itself never runs on its own:

> *"Test Class: any top-level class, `static` member class, or `@Nested` class that contains at
> least one test method, i.e. a container. **Test classes must not be `abstract`** and must have a
> single constructor."*

An `abstract class` contract, and an `interface` contract, are both un-runnable by definition.
There is no risk of Jupiter trying to instantiate them and no need for `@Disabled` anywhere.

## Shape A — the abstract class

```java
abstract class OrderRepositoryContract {

    /** Must return a repository that is empty at the start of every test. */
    protected abstract OrderRepository repository();

    @Test
    void a_saved_order_is_found_by_its_id() {
        Order saved = repository().save(anOrder().build());
        assertThat(repository().findById(saved.id())).contains(saved);
    }

    // … the rest of the clauses, from 12b
}
```

```java
class InMemoryOrderRepositoryTest extends OrderRepositoryContract {
    private final OrderRepository repository = new InMemoryOrderRepository();
    @Override protected OrderRepository repository() { return repository; }
}
```

```java
@DataJpaTest
class JpaOrderRepositoryTest extends OrderRepositoryContract {
    @Autowired private OrderRepository repository;
    @Override protected OrderRepository repository() { return repository; }
}
```

**Why `protected abstract OrderRepository repository()` and not a `protected` field.** The
abstract method makes the subclass's obligation a compile error rather than a `null`. A
`protected OrderRepository repository;` assigned in a subclass `@BeforeEach` compiles fine when
the subclass forgets — and then every clause fails with an NPE that looks like a contract
violation instead of a wiring mistake. It is exactly the `@InjectMocks` argument from
[09e](09e-the-case-against-injectmocks.md), one level up.

**Lifecycle ordering is in your favour.** Jupiter guarantees that superclass `@BeforeEach` methods
run before subclass ones — the wrapping rule in
[03c · Ordering, wrapping, inheritance](../01-junit-5/03c-inheritance-and-wrapping.md). So a
contract can define shared arrangement in its own `@BeforeEach` and a subclass can add
implementation-specific setup after it, without either knowing about the other.

## 🔴 Shape B — the contract as an interface, and why you will end up here

The abstract class costs the subclass its one `extends`. That is usually fine for the fake and
almost never fine for the real implementation, which wants to extend the project's integration
test base, or be a `@DataJpaTest`, or sit under a Testcontainers base class. Jupiter's test
interfaces solve it:

```java
interface OrderRepositoryContract {

    OrderRepository repository();

    @Test
    default void a_saved_order_is_found_by_its_id() {
        Order saved = repository().save(anOrder().build());
        assertThat(repository().findById(saved.id())).contains(saved);
    }

    @Test
    default void an_unknown_id_yields_empty_rather_than_null() {
        assertThat(repository().findById(OrderId.of("ORD-nope"))).isEmpty();
    }
}
```

```java
class InMemoryOrderRepositoryTest implements OrderRepositoryContract {
    private final OrderRepository repository = new InMemoryOrderRepository();
    @Override public OrderRepository repository() { return repository; }
}
```

```java
@DataJpaTest
class JpaOrderRepositoryTest extends AbstractPostgresTest implements OrderRepositoryContract {
    @Autowired private OrderRepository repository;
    @Override public OrderRepository repository() { return repository; }
}
```

The inheritance sentence quoted above covers interfaces as well as classes, and the visibility
rule works out: *"Test classes, test methods, and lifecycle methods are not required to be
`public`, but they must not be `private`"* — an interface `default` method is implicitly public,
so it qualifies.

Three consequences that make the interface shape the better default:

- **`extends` stays free** for whatever base class the real implementation needs.
- **Contracts compose.** `implements OrderRepositoryContract, SoftDeletableContract` runs both
  suites against one implementation. An abstract class cannot do that at all, and this is the
  reason to prefer interfaces before you think you need it.
- **An interface cannot declare instance fields**, so the accessor method is the *only* seam. That
  removes the "protected field assigned in a `@BeforeEach` the subclass forgot" failure entirely,
  by construction.

The cost is that shared arrangement has to go in `default` methods too, and there is no
constructor to run — which in practice pushes fixtures into the accessor, where they belong.

## 🔴 The override that disables a clause and reports nothing

This is the failure mode of the whole pattern, and it is the direct consequence of the sentence
that makes the pattern work: *"unless the subclass explicitly overrides the method."*

```java
class JpaOrderRepositoryTest extends OrderRepositoryContract {
    // …

    @Override
    void saving_the_same_id_twice_replaces_rather_than_duplicates() {
        // JPA merges differently, we'll look at this later
    }
}
```

Jupiter runs the **override**, not the inherited method. The override is empty, so it passes. The
report shows `saving_the_same_id_twice_replaces_rather_than_duplicates()` green in both runs, the
build is clean, and the contract clause it was written to enforce no longer exists for the real
implementation. Nothing in the tooling distinguishes this from a genuinely passing test.

An `@Disabled` override at least leaves a skipped marker in the report. A silent one leaves
nothing.

The countermeasures, in order of how much they actually help:

1. **`final` on every contract method.** In the abstract-class shape, `@Test final void …` makes
   the override a compile error. This is the only mechanical guarantee available, and it costs one
   keyword. (Interface `default` methods cannot be `final`, which is the one real advantage the
   abstract class retains — pick per contract which property you need more.)
2. **Review rule: an `@Override` inside a contract implementation is a design change**, and it
   needs the same scrutiny as changing the interface's javadoc, because it is the same act.
3. **If one implementation genuinely cannot satisfy a clause, the clause is not part of the
   contract.** Move it into that implementation's own test class. A contract that some
   implementations are excused from is not a contract — it is a suggestion with an inheritance
   hierarchy. [12d · Keeping a contract honest](12d-keeping-a-contract-honest.md) is the rule for
   deciding.

## Gotchas

**★ Two test classes with the same assertions instead of one inherited suite.**
They agree on the day they are written. The whole technique is that there is exactly one copy of
the assertions and two suppliers of the object under test.

**★ A subclass that overrides a contract method.**
Jupiter runs the override, so an empty one passes and the clause is silently gone from that
implementation's run. Mark contract methods `final` in the abstract-class shape, and treat any
`@Override` in a contract implementation as a change to the interface's contract.

**★ Using an abstract class when the real implementation needs a base class.**
Java has one `extends`. The moment the JPA or Testcontainers side needs a base class, the contract
has to move to an interface — so start there unless you specifically want `final` methods.

**★ A `protected` field instead of an abstract accessor.**
The subclass can forget to assign it and still compile. Every clause then fails with an NPE that
reads like a contract violation. An abstract method makes the obligation a compile error.

**★ Assuming an `@Disabled` override is equivalent to removing the clause.**
It is better than a silent override — it leaves a skipped marker — but it still asserts that the
contract has an exception, which is a claim about the interface. Decide whether the clause belongs
in the contract at all.

## Interview questions

**★ Why must a contract test be inherited rather than duplicated?**
Because the guarantee you want is that the two implementations cannot be asserted against different
things. Duplication provides that only at the moment of writing. Jupiter's rule — *"Test methods
and lifecycle methods are inherited unless they are overridden"* — makes one source of assertions
run once per implementation, so adding a clause covers every implementation in the same commit.

**★ Abstract class or interface for the contract, and why?**
Interface, by default. Java has a single `extends`, and the real implementation's test class almost
always needs it for a Spring slice, a Testcontainers base or the project's integration-test parent.
Interfaces also compose, so one implementation can be held to several contracts. The abstract class
retains one advantage: its `@Test` methods can be `final`, which makes the override hazard a
compile error.

**★ What is the single most dangerous way this pattern fails?**
A subclass overriding a contract method. Jupiter runs the override — *"a @Test method from a
superclass will always be applied in a subclass unless the subclass explicitly overrides the
method"* — so an empty override passes, the report is green, and the clause has been deleted for
that implementation with no trace. `final` methods, or a review rule treating `@Override` in a
contract implementation as a contract change, are the only defences.

**★ Why does the contract expose an abstract accessor method rather than a protected field?**
Because a missing accessor is a compile error and a missing field assignment is an NPE at run time
that reads like a contract violation. In the interface shape it is not even a choice — interfaces
cannot declare instance fields, which is part of why the interface shape is more robust.

**★ Can the abstract contract class itself accidentally run?**
No. The user guide's definition is explicit — *"Test classes must not be `abstract` and must have a
single constructor"* — so an abstract contract class and an interface contract are both
un-runnable containers. You never need `@Disabled` on the contract, and seeing one there means
somebody made it concrete.

{/* FOOTER */}
