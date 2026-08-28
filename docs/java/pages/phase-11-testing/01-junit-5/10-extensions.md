---
title: "Jupiter replaced JUnit 4's three competing extension mechanisms with one marker interface and about twenty sub-interfaces, and knowing which sub-interface fires where is the difference between an extension that works and one that silently never runs"
sidebar_label: "10 · The extension model"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Extension Model / Overview"
> ([extensions/overview](https://docs.junit.org/6.0.3/extensions/overview.html)),
> "Test Lifecycle Callbacks"
> ([test-lifecycle-callbacks](https://docs.junit.org/6.0.3/extensions/test-lifecycle-callbacks.html)),
> "Parameter Resolution"
> ([parameter-resolution](https://docs.junit.org/6.0.3/extensions/parameter-resolution.html)),
> "Test Instance Post-processing"
> ([test-instance-post-processing](https://docs.junit.org/6.0.3/extensions/test-instance-post-processing.html)),
> "Test Result Processing"
> ([test-result-processing](https://docs.junit.org/6.0.3/extensions/test-result-processing.html)),
> "Exception Handling"
> ([extensions/exception-handling](https://docs.junit.org/6.0.3/extensions/exception-handling.html)),
> "Intercepting Invocations"
> ([intercepting-invocations](https://docs.junit.org/6.0.3/extensions/intercepting-invocations.html)) and
> "Relative Execution Order of User Code and Extensions"
> ([relative-execution-order](https://docs.junit.org/6.0.3/extensions/relative-execution-order-of-user-code-and-extensions.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**Almost everything you think of as "JUnit" beyond `@Test` and `Assertions` is an
extension. `@TempDir` is an extension. `@Disabled` is an extension. `@SpringBootTest` works
because `SpringExtension` is an extension, and `@Mock` works because `MockitoExtension` is
one. Understanding the model is therefore not an advanced topic — it is the explanation for
the behaviour of every library you already use in tests.**

This chunk is the model and the catalogue of extension points. Writing one — including the
`ParameterResolver` rules an author must know — is [10b · writing one](10b-writing-one.md);
the three ways to register an extension and the order they run in are
[10d · registering extensions](10d-registering-extensions.md).

## One concept, replacing three

> *"In contrast to the competing `Runner`, `TestRule`, and `MethodRule` extension points in
> JUnit 4, the JUnit Jupiter extension model consists of a single, coherent concept: the
> `Extension` API. Note, however, that `Extension` itself is just a marker interface."*

Both halves matter. JUnit 4 forced a choice — a `Runner` could not be combined with another
`Runner`, so `@RunWith(SpringJUnit4ClassRunner.class)` and `@RunWith(MockitoJUnitRunner.class)`
were mutually exclusive and teams worked around it with rules. In Jupiter you register as
many extensions as you like and each contributes to the parts of the lifecycle it cares
about.

And because `Extension` is a *marker*, an extension declares its capabilities by which
sub-interfaces it implements:

> *"Extension developers may choose to implement any number of these interfaces within a
> single extension. Consult the source code of the `SpringExtension` for a concrete
> example."*

That is the whole design. There is no registration of "what kind of extension this is" —
you implement `BeforeEachCallback` and you get called before each test, and if you also
implement `ParameterResolver` you also get asked about parameters.

## The catalogue

**Around the lifecycle** — these are the eight that appear in the sixteen-step diagram
([03c · ordering and wrapping](03c-inheritance-and-wrapping.md)):

| Interface | Fires |
|---|---|
| `BeforeAllCallback` | before all tests of the container |
| `BeforeEachCallback` | before each test — **outside** the user's `@BeforeEach` |
| `BeforeTestExecutionCallback` | immediately before the test method, after `@BeforeEach` |
| `AfterTestExecutionCallback` | immediately after the test method and its exception handlers |
| `AfterEachCallback` | after each test — **outside** the user's `@AfterEach` |
| `AfterAllCallback` | after all tests of the container |
| `BeforeClassTemplateInvocationCallback` | before each class-template invocation |
| `AfterClassTemplateInvocationCallback` | after each class-template invocation |

The distinction people get wrong, stated by the guide itself:

> *"`BeforeTestExecutionCallback` and `AfterTestExecutionCallback` define the APIs for
> `Extension`s that wish to add behavior that will be executed immediately before and
> immediately after a test method is executed, respectively. As such, these callbacks are
> well suited for timing, tracing, and similar use cases. If you need to implement callbacks
> that are invoked around `@BeforeEach` and `@AfterEach` methods, implement
> `BeforeEachCallback` and `AfterEachCallback` instead."*

**Timing the test?** `BeforeTestExecutionCallback`. **Setting up something the user's
`@BeforeEach` will use?** `BeforeEachCallback`. Choosing wrongly gives you a measurement
that includes the fixture, or a fixture that arrives too late.

**Around the test instance:**

- `TestInstanceFactory` — create the test instance yourself instead of letting Jupiter call
  the constructor.
- `TestInstancePreConstructCallback` — before the instance is constructed.
- `TestInstancePostProcessor` — after construction. *"Common use cases include injecting
  dependencies into the test instance, invoking custom initialization methods on the test
  instance, etc."* This is where `@Mock` fields and Spring's `@Autowired` test fields are
  populated; the guide names `MockitoExtension` and `SpringExtension` as the concrete
  examples.
- `TestInstancePreDestroyCallback` — before the instance is discarded. `@AutoClose` uses it
  ([09d](09d-autoclose.md)).

**Resolving parameters:**

> *"`ParameterResolver` defines the Extension API for dynamically resolving parameters at
> runtime. If a test class constructor, test method, or lifecycle method … declares a
> parameter, the parameter must be resolved at runtime by a `ParameterResolver`."*

This is why a test method can take arguments at all. `TestInfo`, `TestReporter`,
`@TempDir Path`, `RepetitionInfo` and every mock injected as a method parameter arrive
through a `ParameterResolver`.

**Deciding whether to run:** `ExecutionCondition`
([07e](07e-executioncondition-and-deactivation.md)).

**Reacting to outcomes:**

> *"`TestWatcher` defines the API for extensions that wish to process the results of test
> method executions. Specifically, a `TestWatcher` will be invoked with contextual
> information for the following events. `testDisabled`: invoked after a disabled test method
> has been skipped. `testSuccessful`: invoked after a test method has completed
> successfully. `testAborted`: invoked after a test method has been aborted. `testFailed`:
> invoked after a test method has failed."*

**Handling exceptions:**

> *"JUnit Jupiter offers API for Extensions that wish to handle exceptions thrown during
> `@Test` methods via `TestExecutionExceptionHandler` and for those thrown during one of
> test lifecycle methods (`@BeforeAll`, `@BeforeEach`, `@AfterEach` and `@AfterAll`) via
> `LifecycleMethodExecutionExceptionHandler`."*

The guide's own illustration of why the second one exists is worth keeping:

> *"Note that unlike relying on lifecycle callbacks, which may or may not be executed
> depending on the test status, this solution guarantees execution immediately after failing
> `@BeforeAll`, `@BeforeEach`, `@AfterEach` or `@AfterAll`."*

**Wrapping the invocation itself:** `InvocationInterceptor`, *"the API for Extensions that
wish to intercept calls to test code"* — the guide's example runs every test method on
Swing's Event Dispatch Thread. Note from the ordering page: *"All invocations of user code
methods in the above table can additionally be intercepted by implementing
`InvocationInterceptor`."*

**Producing invocations:** `TestTemplateInvocationContextProvider` — the mechanism behind
`@RepeatedTest` and `@ParameterizedTest`
([03 · parameterized tests](../03-parameterized-tests/01-one-test-many-cases.md)) — and its
class-level sibling for `@ClassTemplate`.

**Diagnosing timeouts:** `PreInterruptCallback`, called before `Thread.interrupt()` on a
timed-out method ([13 · timeouts](13-timeouts.md)).

## The two rules that decide whether your extension is called at all

**A `TestWatcher` registered on an instance field misses template methods.**

> *"If a `TestWatcher` is registered via a non-static (instance) field – for example, using
> `@RegisterExtension` – and the test class is configured with
> `@TestInstance(Lifecycle.PER_METHOD)` semantics (which is the default lifecycle mode), the
> `TestWatcher` will not be invoked with events for `@TestTemplate` methods (for example,
> `@RepeatedTest` or `@ParameterizedTest`). To ensure that a `TestWatcher` is invoked for
> all test methods in a given class, it is therefore recommended that the `TestWatcher` be
> registered at the class level with `@ExtendWith` or via a static field with
> `@RegisterExtension` or `@ExtendWith`."*

**A class-level failure produces no test results at all.**

> *"If there is a failure at the class level — for example, an exception thrown by a
> `@BeforeAll` method — no test results will be reported. Similarly, if the test class is
> disabled via an `ExecutionCondition` — for example, `@Disabled` — no test results will be
> reported."*

Anything building a report, a flakiness database or a Slack notification from a
`TestWatcher` therefore under-reports exactly the failures that matter most: a broken
`@BeforeAll` looks like silence, not like fifty failures.
## What extensions are for, and what they are not for

**For:** anything that is genuinely cross-cutting and has nothing to do with the assertion —
starting a shared server, injecting a generated value, timing, capturing diagnostics on
failure, deciding whether a test applies at all, integrating a container framework.

**Not for:** hiding assertions. An extension that inspects the result and fails the test on
some global rule turns every test in the codebase into a test of that rule, and the failure
message points at machinery rather than at behaviour. Nor for shared *state*: an extension
that quietly seeds a database makes every test in the class depend on setup you cannot see
from the test body.

The test to apply: **could a competent reader understand why the test failed with only the
test class in front of them?** If registering the extension changes the meaning of the test
rather than its environment, it is the wrong tool.

## Gotchas

**★ Implementing `BeforeEachCallback` when you meant `BeforeTestExecutionCallback`.**
`BeforeEachCallback` runs *outside* the user's `@BeforeEach`. Time a test with it and you
are timing the fixture as well as the test.

**★ A `TestWatcher` on an instance field, missing every `@ParameterizedTest`.**
Documented: under the default `PER_METHOD` lifecycle, an instance-registered `TestWatcher`
receives no events for `@TestTemplate` methods. Register at class level or via a `static`
field.

**★ Building a flakiness dashboard on `TestWatcher` alone.**
A failure in `@BeforeAll`, or a class disabled by a condition, reports **no test results at
all**. The dashboard will show a quiet day; the build was red.

**★ Assuming an extension is a place to put shared setup.**
It is a place to put shared *environment*. Setup that the assertions depend on belongs
where the reader can see it, or the test becomes unreadable in isolation.

**★ Swallowing exceptions in a `TestExecutionExceptionHandler`.**
The guide's own example swallows `IOException` — as a demonstration. In a real suite, an
extension that eats exceptions is a suite that cannot fail, and nobody will remember it is
registered.

**★ Expecting `AfterEachCallback` to run when `@BeforeAll` blew up.**
Nothing method-level runs if the container never got that far. That is precisely why
`LifecycleMethodExecutionExceptionHandler` exists — it is guaranteed to run immediately
after a failing lifecycle method.

**★ Registering the same extension twice and expecting it twice.**
A specific extension implementation is registered once per extension context and its
parents; duplicates are ignored ([10d](10d-registering-extensions.md)).
## Interview questions

**★ What did Jupiter's extension model replace, and why is that better?**
JUnit 4's `Runner`, `TestRule` and `MethodRule` — three competing mechanisms, of which the
`Runner` was exclusive, so Spring and Mockito could not both use one. Jupiter has a single
`Extension` marker interface with many sub-interfaces; any number of extensions can be
registered and each participates in the callbacks it implements.

**★ What is the difference between `BeforeEachCallback` and `BeforeTestExecutionCallback`?**
`BeforeEachCallback` fires before the user's `@BeforeEach` methods; `BeforeTestExecutionCallback`
fires after them, immediately before the test method itself. The guide recommends the latter
for timing and tracing and the former for anything that must be in place before user setup
runs.

**★ Which extension interface makes `@Mock` and `@Autowired` fields work in a test class?**
`TestInstancePostProcessor` — it post-processes the instance after construction, which is
where `MockitoExtension` and `SpringExtension` inject fields. Parameter-level injection is a
different interface, `ParameterResolver`.

**★ You want to record diagnostics whenever a test fails. Which interface, and what will you
miss?**
`TestWatcher` gives you `testFailed`, `testSuccessful`, `testAborted` and `testDisabled`.
You will miss class-level failures entirely — an exception from `@BeforeAll`, or a class
disabled by a condition, produces no test results — and, if you register it on an instance
field, you will also miss every `@RepeatedTest` and `@ParameterizedTest`.

**★ How does an extension declare what it does?**
By implementing sub-interfaces of `Extension`, which is only a marker. There is no
descriptor and no registration metadata: implementing `AfterAllCallback` *is* the
declaration that you want to be called after all tests, and one class may implement as many
of these interfaces as it needs.

{/* FOOTER */}
