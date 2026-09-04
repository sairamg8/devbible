---
title: "Jupiter builds a brand-new instance of your test class before every single test method, and every rule about static, about @BeforeAll, and about why your field assignments do not leak between tests follows from that one decision"
sidebar_label: "03 · The lifecycle"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Test Instance Lifecycle"
> ([test-instance-lifecycle](https://docs.junit.org/6.0.3/writing-tests/test-instance-lifecycle.html)),
> "Test Classes and Methods"
> ([test-classes-and-methods](https://docs.junit.org/6.0.3/writing-tests/test-classes-and-methods.html))
> and "Relative Execution Order of User Code and Extensions"
> ([relative-execution-order](https://docs.junit.org/6.0.3/extensions/relative-execution-order-of-user-code-and-extensions.html));
> `@BeforeAll` / `@BeforeEach` javadoc
> ([BeforeAll](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/BeforeAll.html),
> [BeforeEach](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/BeforeEach.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**The default is one test class instance per test method, and the guide says why:**

> *"In order to allow individual test methods to be executed in isolation and to avoid
> unexpected side effects due to mutable test instance state, JUnit creates a new
> instance of each test class before executing each test method … This 'per-method' test
> instance lifecycle is the default behavior in JUnit Jupiter and is analogous to all
> previous versions of JUnit."*

**Every "why is this method `static`" question in JUnit has the same answer: because at
the time it runs, there is no instance to call it on.**

## What one test method actually costs

```java
class OrderServiceTest {

    private final InMemoryOrderRepository repository = new InMemoryOrderRepository();
    private final OrderService service = new OrderService(repository);

    @Test
    void placesAnOrder() { /* ... */ }

    @Test
    void rejectsAnEmptyBasket() { /* ... */ }
}
```

Two tests, two constructions of `OrderServiceTest`, two `InMemoryOrderRepository`
instances, two `OrderService` instances. `placesAnOrder` cannot pollute
`rejectsAnEmptyBasket`, because the object it polluted no longer exists. Field
initialisers are, for free, per-test setup — which is why in a class with no shared
resource you often need no `@BeforeEach` at all.

The isolation is per *instance field*. A `static` field is shared by every instance in the
JVM and is therefore outside the guarantee entirely — that is [11](11-execution-order.md)
and, once tests run concurrently, [12](12-parallel-execution.md).

## The four lifecycle annotations, and the static rule

The definition first, because it is precise:

> *"**Lifecycle Method** — any method that is directly annotated or meta-annotated with
> `@BeforeAll`, `@AfterAll`, `@BeforeEach`, or `@AfterEach`."*

**`@BeforeEach` / `@AfterEach`** run around each test method, on the instance created for
that test. The javadoc: *"`@BeforeEach` methods must have a `void` return type and must
not be `static`."*

**`@BeforeAll` / `@AfterAll`** run once per test class. The javadoc:

> *"`@BeforeAll` methods must have a `void` return type and must be `static` unless the
> test class is annotated with `@TestInstance(Lifecycle.PER_CLASS)`."*

Which is the whole mechanism. `@BeforeAll` runs *before the first instance exists*. There
is no `this`. Hence `static`, hence the fields it initialises must be `static` too, hence
they are shared by every test in the class — and hence they are the most common source of
order-dependence in an otherwise clean suite.

```java
class OrderRepositoryTest {

    private static EmbeddedBroker broker;          // static: outlives every instance

    @BeforeAll
    static void startBroker() {                    // no instance exists yet
        broker = EmbeddedBroker.start();
    }

    private OrderRepository repository;            // instance: one per test method

    @BeforeEach
    void openConnection() {
        repository = new OrderRepository(broker.connect());
    }

    @AfterEach
    void closeConnection() {
        repository.close();
    }

    @AfterAll
    static void stopBroker() {
        broker.stop();
    }
}
```

The split is the design: `@BeforeAll` for things that are expensive *and* safe to share,
`@BeforeEach` for everything that is per-test state. Getting a mutable object on the wrong
side of that line is the bug this whole page exists to prevent.

⚠️ **Nothing here says what order two `@BeforeEach` methods run in, or where an
extension's callbacks sit relative to yours.** Both are precisely specified and neither is
what people assume — [03c · ordering, wrapping and inheritance](03c-inheritance-and-wrapping.md).

## Visibility, return types and the shape of a test class

From "Test Classes and Methods":

> *"Test classes, test methods, and lifecycle methods are not required to be `public`, but
> they must not be `private`."*

> *"It is generally recommended to omit the `public` modifier for test classes, test
> methods, and lifecycle methods unless there is a technical reason for doing so."*

Package-private is the idiom. `public` is required only when a test class in another
package extends yours, or when you are testing on the module path.

> *"test methods and lifecycle methods must not be `abstract` and must not return a value
> (except `@TestFactory` methods which are required to return a value)."*

⚠️ **A non-`void` `@Test` method is not a test.** It is silently not discovered in some
tooling and reported as a configuration error in others — either way, the assertion you
wrote never runs. This bites hardest in Kotlin, where an expression-bodied function has an
inferred non-`Unit` return type.

And the container rule:

> *"**Test Class** — any top-level class, `static` member class, or `@Nested` class that
> contains at least one test method … Test classes must not be `abstract` and must have a
> single constructor. Java record classes are supported as well."*

**A single constructor** — because Jupiter has to pick one, and it resolves its parameters
through `ParameterResolver`s ([10](10-extensions.md)). Two constructors is a configuration
error, not an overload resolution problem.

## What still happens when a test is disabled

A trap that costs people an afternoon:

> *"Please note that the test class will still be instantiated if a given test method is
> disabled via a condition (e.g., `@Disabled`, `@DisabledOnOs`, etc.) even when the
> 'per-method' test instance lifecycle mode is active."*

And from "Disabling Tests":

> *"If a test method is disabled via `@Disabled`, that prevents execution of the test
> method and method-level lifecycle callbacks such as `@BeforeEach` methods, `@AfterEach`
> methods, and corresponding extension APIs. However, that does not prevent the test class
> from being instantiated, and it does not prevent the execution of class-level lifecycle
> callbacks such as `@BeforeAll` methods, `@AfterAll` methods, and corresponding extension
> APIs."*

So `@Disabled` on every method in a class does **not** stop `@BeforeAll` from starting
your container, opening your connection pool or booting a Spring context. Disabling the
*class* is what you want ([07](07-disabling-and-conditions.md)).

## Gotchas

**★ Assigning to an instance field in one test and expecting to read it in the next.**
There is no next — the instance is discarded. The field you set belonged to an object that
no longer exists. If the tests genuinely need shared state, that is
[03b · `PER_CLASS`](03b-per-class-lifecycle.md), and it comes with its own bill.

**★ Making a field `static` to "fix" the above.**
It works, and it converts a correctness problem into an order-dependence problem plus a
thread-safety problem. Static mutable state is the number-one cause of "passes alone,
fails in the suite" ([14](14-flaky-tests.md)).

**★ `@BeforeAll` on a non-static method with the default lifecycle.**
Jupiter reports a configuration error, not a compile error, so the failure arrives at run
time. Either make it `static` or opt into `@TestInstance(PER_CLASS)` deliberately.

**★ Initialising an expensive shared resource in `@BeforeEach`.**
Starting a broker, a container or a Spring context per test method turns a 4-second suite
into a 4-minute one. `@BeforeAll` exists for exactly this — and for Spring specifically,
the context cache does it for you (**topic 05 · the test pyramid**, *(not written yet)*).

**★ Cleanup in the test method instead of `@AfterEach`.**
The last two lines of the test never run when an assertion above them fails, and the
leaked resource then breaks a *different* test. Cleanup goes in `@AfterEach`, which runs
regardless of the test's outcome.

**★ A test method that returns a value.**
Not `void`, not a test. Common in Kotlin (`fun test() = assertThat(...)`) and in Java when
someone changes `void` to `boolean` mid-refactor.

**★ Two constructors on a test class.**
The guide requires exactly one. Adding a convenience constructor for a subclass turns the
whole class into a configuration error.

**★ Believing `@Disabled` on all methods keeps the class inert.**
`@BeforeAll`, `@AfterAll` and their extension callbacks still run, and the class is still
instantiated. Put `@Disabled` on the class.

**★ Using a field initialiser for something that must happen after extensions have run.**
Field initialisers run during construction, which is before `TestInstancePostProcessor`
and before `@BeforeEach`. Anything that needs an injected value — a Spring bean, a
`@Mock` — is not available yet.

## Interview questions

**★ How many instances of a test class with five `@Test` methods does Jupiter create by
default?**
Five — one per test method, created immediately before that method runs. The guide gives
the reason: isolating methods from each other and avoiding side effects from mutable test
instance state. It also creates the instance even for a method disabled by a condition.

**★ Why must `@BeforeAll` be `static`?**
Because it runs once per class, before any instance exists, so there is no receiver to
invoke it on. The exception is `@TestInstance(Lifecycle.PER_CLASS)`, where one instance is
created up front and `@BeforeAll` can therefore be an instance method.

**★ Does `@AfterEach` run if the test fails?**
Yes. `@AfterEach` and `AfterEachCallback` run after the test method regardless of outcome,
which is precisely why cleanup belongs there and not in the last lines of the test body.
It also runs after the `TestExecutionExceptionHandler` extensions have had their turn.

**★ A test class has `@Disabled` on all ten of its test methods and the build still takes
90 seconds in that class. Explain.**
`@Disabled` at method level suppresses the test method and the method-level lifecycle
callbacks, but the class is still instantiated and `@BeforeAll`/`@AfterAll` plus their
extension callbacks still run. Whatever expensive thing `@BeforeAll` starts is still being
started. Moving `@Disabled` to the class disables the whole container.

**★ Why is package-private the recommended visibility for test classes and methods?**
Because Jupiter uses reflection and only requires that members are not `private`, and
`public` on a test class advertises an API that does not exist. The guide names the two
real reasons to use `public`: a subclass in a different package, and testing on the module
path.

{/* FOOTER */}
