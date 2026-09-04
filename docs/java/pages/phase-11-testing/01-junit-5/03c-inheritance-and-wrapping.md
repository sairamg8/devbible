---
title: "Jupiter guarantees exactly two orderings for lifecycle methods — extensions wrap user code, and superclasses wrap subclasses — and explicitly refuses to guarantee the one everybody assumes, which is the order of two @BeforeEach methods in the same class"
sidebar_label: "03c · Ordering, wrapping, inheritance"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Relative Execution Order of
> User Code and Extensions"
> ([relative-execution-order](https://docs.junit.org/6.0.3/extensions/relative-execution-order-of-user-code-and-extensions.html))
> and "Test Classes and Methods"
> ([test-classes-and-methods](https://docs.junit.org/6.0.3/writing-tests/test-classes-and-methods.html));
> `@BeforeAll` / `@BeforeEach` javadoc
> ([BeforeAll](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/BeforeAll.html),
> [BeforeEach](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/BeforeEach.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**[03](03-the-lifecycle.md) established what each lifecycle annotation is for. This chunk
is the timing: the sixteen-step sequence around a single test method, the wrapping
guarantee that makes extensions composable, the inheritance rules that make an abstract
base test class work, and the one ordering Jupiter deliberately withholds.**

## The sixteen steps around one test method

The guide's table, in order. Steps 5–14 repeat for each test method in the class.

| # | What | Whose code |
|---|---|---|
| 1 | `BeforeAllCallback` | extension |
| 2 | `@BeforeAll` | yours |
| 3 | `LifecycleMethodExecutionExceptionHandler#handleBeforeAllMethodExecutionException` | extension |
| 4 | `BeforeClassTemplateInvocationCallback` | extension (class templates only) |
| 5 | `BeforeEachCallback` | extension |
| 6 | `@BeforeEach` | yours |
| 7 | `…#handleBeforeEachMethodExecutionException` | extension |
| 8 | `BeforeTestExecutionCallback` | extension |
| 9 | `@Test` | yours |
| 10 | `TestExecutionExceptionHandler` | extension |
| 11 | `AfterTestExecutionCallback` | extension |
| 12 | `@AfterEach` | yours |
| 13 | `…#handleAfterEachMethodExecutionException` | extension |
| 14 | `AfterEachCallback` | extension |
| 15 | `@AfterAll` (then its exception handler) | yours |
| 16 | `AfterAllCallback` | extension |

> *"In the simplest case only the actual test method will be executed (step 9); all other
> steps are optional depending on the presence of user code or extension support for the
> corresponding lifecycle callback."*

Two structural facts to take from the table:

- **Extensions are outside your lifecycle methods.** `BeforeEachCallback` (5) precedes
  your `@BeforeEach` (6); `AfterEachCallback` (14) follows your `@AfterEach` (12). This is
  what lets `SpringExtension` have a context and injected beans ready before your setup
  code touches them, and lets a transaction-rolling-back extension close the transaction
  after your teardown has finished using it.
- **`BeforeTestExecutionCallback` (8) and `AfterTestExecutionCallback` (11) hug the test
  method**, inside your `@BeforeEach`/`@AfterEach`. The guide: *"these callbacks are well
  suited for timing, tracing, and similar use cases. If you need to implement callbacks
  that are invoked around `@BeforeEach` and `@AfterEach` methods, implement
  `BeforeEachCallback` and `AfterEachCallback` instead."* Timing at step 5 measures your
  setup as well as the test; timing at step 8 measures the test.

⚠️ **Every one of the user-code invocations in that table can additionally be wrapped by
`InvocationInterceptor`** — *"All invocations of user code methods in the above table can
additionally be intercepted by implementing `InvocationInterceptor`."* That is the
extension point that can run your test method on a different thread
([10](10-extensions.md)).

## The wrapping guarantee for multiple extensions

> *"JUnit Jupiter always guarantees wrapping behavior for multiple registered extensions
> that implement lifecycle callbacks … given two extensions `Extension1` and `Extension2`
> with `Extension1` registered before `Extension2`, any 'before' callbacks implemented by
> `Extension1` are guaranteed to execute before any 'before' callbacks implemented by
> `Extension2`. Similarly … any 'after' callbacks implemented by `Extension1` are
> guaranteed to execute after any 'after' callbacks implemented by `Extension2`.
> `Extension1` is therefore said to wrap `Extension2`."*

So registration order is meaningful, and it is LIFO on the way out — the same shape as
nested `try`/`finally`. `@ExtendWith({ DatabaseExtension.class, WebServerExtension.class })`
starts the database first and stops it last.

🔴 **This guarantee is for extensions. It does not extend to your own lifecycle methods
within a single class** — see below.

## What Jupiter refuses to guarantee

The `@BeforeEach` javadoc, verbatim:

> *"JUnit Jupiter does not guarantee the execution order of multiple `@BeforeEach` methods
> that are declared within a single test class or test interface. While it may at times
> appear that these methods are invoked in alphabetical order, they are in fact sorted
> using an algorithm that is deterministic but intentionally non-obvious."*

"Deterministic but intentionally non-obvious" is a phrase that recurs throughout JUnit 6 —
it also governs `@Nested` class order, `@AutoClose` field order and default method order.
It means: reproducible build to build, and unavailable to reason about.

Worse, before and after are not paired:

> *"`@BeforeEach` methods are in no way linked to `@AfterEach` methods. Consequently,
> there are no guarantees with regard to their wrapping behavior."*

The javadoc spells out the consequence with names: given `createA()` and `createB()` as
`@BeforeEach` and `destroyA()` and `destroyB()` as `@AfterEach`, the order in which the
creates ran *"does not imply any order for the seemingly corresponding `@AfterEach`
methods. In other words, `destroyA()` might be called before or after `destroyB()`."*

**If two setup steps depend on each other, they are one method.** Call the second from the
first, or inline it:

```java
@BeforeEach
void setUp() {
    seedReferenceData();   // must run first
    seedTestOrders();      // depends on reference data
}
```

Not:

```java
@BeforeEach void seedReferenceData() { /* ... */ }   // ⚠️ no ordering relationship
@BeforeEach void seedTestOrders()   { /* ... */ }    //     with the method above
```

## Inheritance: the ordering that *is* guaranteed

Within a class or interface hierarchy, Jupiter guarantees wrapping. From "Relative
Execution Order":

> *"`@BeforeAll` methods are inherited from superclasses as long as they are not
> overridden. Furthermore, `@BeforeAll` methods from superclasses will be executed before
> `@BeforeAll` methods in subclasses."*

> *"`@AfterAll` methods are inherited from superclasses as long as they are not
> overridden. Furthermore, `@AfterAll` methods from superclasses will be executed after
> `@AfterAll` methods in subclasses."*

The same pair of statements holds for `@BeforeEach` (superclass first) and `@AfterEach`
(superclass last), and for interface `default` methods relative to the implementing class.
So the base class opens the resource first and closes it last — the abstract base test
class works because of this rule:

```java
abstract class AbstractDatabaseTest {

    @BeforeEach
    void connect() { /* runs first */ }

    @AfterEach
    void disconnect() { /* runs last */ }
}

class OrderRepositoryTest extends AbstractDatabaseTest {

    @BeforeEach
    void seed() { /* runs after connect() */ }

    @AfterEach
    void truncate() { /* runs before disconnect() */ }
}
```

## What inheritance actually inherits

The rules from "Test Classes and Methods" are more aggressive than people expect:

> *"Fields in test classes are inherited. For example, a `@TempDir` field from a
> superclass will always be applied in a subclass."*

> *"Test methods and lifecycle methods are inherited unless they are overridden according
> to the visibility rules of the Java language. For example, a `@Test` method from a
> superclass will always be applied in a subclass unless the subclass explicitly overrides
> the method."*

🔴 **And the trap, stated in the guide itself:**

> *"if a package-private `@Test` method is declared in a superclass that resides in a
> different package than the subclass, that `@Test` method will always be applied in the
> subclass since the subclass cannot override a package-private method from a superclass
> in a different package."*

A subclass in a different package that declares a method with the same name as a
package-private superclass test method has not overridden it — it has *added* one. Both
run. This is standard Java overriding semantics, which is exactly the point: JUnit 6
removed the legacy search semantics and now, per the release notes, *"always adheres to
standard Java semantics regarding whether a given field or method is visible or overridden
according to the rules of the Java language."*

An `@Override` annotation on an intended override makes the compiler check this for you,
and is the cheapest defence available.

## Gotchas

**★ Two `@BeforeEach` methods where the second depends on the first.**
No order is guaranteed. It will appear to work — the algorithm is deterministic — until a
rename or a JUnit upgrade changes the outcome, and then the failure is in a setup method
nobody suspects. Merge them into one method with explicit statement order.

**★ Assuming `@AfterEach` pairs with the `@BeforeEach` that "matches" it.**
The javadoc explicitly disclaims it. Cleanup that must undo a specific setup step belongs
in the same method, or in an extension, `@TempDir` or `@AutoClose` that owns the resource
([09](09-tempdir-and-resources.md)).

**★ Reasoning about extension order from the class file rather than registration order.**
Extensions wrap in registration order: first registered is outermost. `@ExtendWith` at the
class level, then instance `@RegisterExtension` fields, then `@ExtendWith` at method level
([10](10-extensions.md) has the full precedence list).

**★ Expecting an extension's `beforeEach` to run after your `@BeforeEach`.**
It runs before. If you need extension code *between* your setup and the test, the callback
is `BeforeTestExecutionCallback`, not `BeforeEachCallback`.

**★ Timing tests with `BeforeEachCallback`/`AfterEachCallback`.**
You are measuring setup and teardown as well. `BeforeTestExecutionCallback` and
`AfterTestExecutionCallback` are the ones that bracket the test method alone.

**★ A subclass "overriding" a package-private superclass test method across packages.**
It is not an override. Both methods run, the superclass one against a subclass instance,
usually failing in a confusing way. Add `@Override` and let the compiler tell you.

**★ Forgetting that fields are inherited too.**
A `@TempDir`, `@RegisterExtension` or `@Mock` field on an abstract base class applies in
every subclass. Convenient when intended; surprising when a base class grows one.

**★ Overriding an inherited `@Test` method to disable it.**
An override with an empty body is a test that passes and asserts nothing. If the intent is
"this scenario does not apply to this subclass", the base class is asserting something not
universally true, and the hierarchy is the problem.

**★ Relying on `@BeforeAll` in a superclass to be re-run per subclass.**
It runs once per test class execution, so each subclass triggers it — but with the
superclass's `static` state. If the base class caches something in a `static` field, the
second subclass sees the first subclass's cache.

## Interview questions

**★ In what order do two `@BeforeEach` methods in the same class run?**
Unspecified. The javadoc says the order is deterministic but intentionally non-obvious and
warns that it may look alphabetical without being alphabetical. If order matters, they are
one method.

**★ Where does an extension's `beforeEach` run relative to my `@BeforeEach`?**
Before it. The order is `BeforeEachCallback`, your `@BeforeEach`, then
`BeforeTestExecutionCallback`, then the test. On the way out it mirrors:
`AfterTestExecutionCallback`, your `@AfterEach`, then `AfterEachCallback`. Extensions wrap
user code on both sides.

**★ What is the difference between `BeforeEachCallback` and `BeforeTestExecutionCallback`?**
`BeforeEachCallback` runs outside your `@BeforeEach` methods; `BeforeTestExecutionCallback`
runs between the last `@BeforeEach` and the test method. The guide recommends the latter
for timing and tracing, because it brackets the test rather than the test plus its setup.

**★ Two extensions are registered as `@ExtendWith({A.class, B.class})`. What order do
their callbacks run in?**
A's "before" callbacks run before B's; B's "after" callbacks run before A's. A wraps B, in
the same shape as nested `try`/`finally`. This is a hard guarantee for all eight lifecycle
callback interfaces, unlike the ordering of your own lifecycle methods within a class.

**★ How do lifecycle methods behave in an inheritance hierarchy?**
Superclass "before" methods run before subclass ones; superclass "after" methods run after
subclass ones; the same holds for interface `default` methods relative to the implementing
class. Methods are inherited unless genuinely overridden by Java's rules, and fields are
inherited unconditionally.

**★ A base test class in package `a` has a package-private `@Test void checksAudit()`, and
a subclass in package `b` declares a method with the same signature. What runs?**
Both. The subclass cannot override a package-private method from a different package, so
JUnit sees two distinct test methods. The guide calls this out explicitly, and JUnit 6
removed the legacy search semantics that used to blur it.

**★ Why does Jupiter deliberately refuse to define an order for sibling lifecycle
methods?**
Because a defined order would be a contract people build on, and that contract makes test
setup order-sensitive in a way that is invisible at the call site. Making it non-obvious
forces the dependency to be expressed as code — one method calling another — where it can
be read.

{/* FOOTER */}
