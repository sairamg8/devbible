---
title: "A real extension is one class implementing three interfaces — a callback for static fields, a post-processor for instance fields and a resolver for parameters — and the parts that go wrong are the annotation lookup, the resolver's claim on a type, and where the state lives"
sidebar_label: "10b · Writing one"
sidebar_position: 27
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Registering Extensions"
> ([registering-extensions](https://docs.junit.org/6.0.3/extensions/registering-extensions.html)),
> "Test Lifecycle Callbacks"
> ([test-lifecycle-callbacks](https://docs.junit.org/6.0.3/extensions/test-lifecycle-callbacks.html)),
> "Parameter Resolution"
> ([parameter-resolution](https://docs.junit.org/6.0.3/extensions/parameter-resolution.html)) and
> "Keeping State in Extensions"
> ([keeping-state-in-extensions](https://docs.junit.org/6.0.3/extensions/keeping-state-in-extensions.html));
> javadoc for `EngineTestKit`
> ([EngineTestKit](https://docs.junit.org/6.0.3/api/org.junit.platform.testkit/org/junit/platform/testkit/engine/EngineTestKit.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**The catalogue in [10](10-extensions.md) is a list of interfaces; this is what one looks
like when it is finished. The guide's `RandomNumberExtension` is the example worth studying
because it is the smallest extension that has to solve all three injection problems at once
— a `static` field, an instance field, and a parameter — and each needs a different
interface.**

The `ParameterResolver` rules that only bite an author — resolver conflicts and the JDK
annotation bug — are [10c · resolving parameters](10c-resolving-parameters.md).

## The smallest useful extension

`BeforeTestExecutionCallback` and `AfterTestExecutionCallback` in one class, using the
`Store` to carry a value from one callback to the other
([10h · keeping state](10h-keeping-state.md) is the mechanism):

```java
public class TimingExtension implements BeforeTestExecutionCallback, AfterTestExecutionCallback {

    private static final Logger logger = Logger.getLogger(TimingExtension.class.getName());

    private static final String START_TIME = "start time";

    @Override
    public void beforeTestExecution(ExtensionContext context) {
        getStore(context).put(START_TIME, System.currentTimeMillis());
    }

    @Override
    public void afterTestExecution(ExtensionContext context) {
        Method testMethod = context.getRequiredTestMethod();
        long startTime = getStore(context).remove(START_TIME, long.class);
        long duration = System.currentTimeMillis() - startTime;

        logger.info(() ->
            "Method [%s] took %s ms.".formatted(testMethod.getName(), duration));
    }

    private Store getStore(ExtensionContext context) {
        return context.getStore(Namespace.create(getClass(), context.getRequiredTestMethod()));
    }

}
```

```java
@ExtendWith(TimingExtension.class)
class TimingExtensionTests {

    @Test
    void sleep20ms() throws Exception {
        Thread.sleep(20);
    }

}
```

Three things in twenty lines are worth naming:

- **The pair of interfaces is `…TestExecutionCallback`, not `…EachCallback`** — the guide
  recommends exactly this pair for timing, because they bracket the test method itself
  rather than the user's `@BeforeEach` ([10](10-extensions.md)).
- **The extension keeps no fields for per-test data.** It puts the start time in the
  `Store` keyed by the test method, because one extension instance may serve many tests and
  may serve them concurrently ([12 · parallel execution](12-parallel-execution.md)).
- **The namespace is `(getClass(), testMethod)`** — scoped so two extensions cannot collide
  and two test methods cannot collide.

## The three injection points, and the three interfaces

The guide's `RandomNumberExtension` supports all of these:

```java
class RandomNumberDemo {

    // Use static randomNumber0 field anywhere in the test class,
    // including @BeforeAll or @AfterEach lifecycle methods.
    @Random
    private static Integer randomNumber0;

    // Use randomNumber1 field in test methods and @BeforeEach
    // or @AfterEach lifecycle methods.
    @Random
    private int randomNumber1;

    RandomNumberDemo(@Random int randomNumber2) {
        // Use randomNumber2 in constructor.
    }

    @BeforeEach
    void beforeEach(@Random int randomNumber3) {
        // Use randomNumber3 in @BeforeEach method.
    }

    @Test
    void test(@Random int randomNumber4) {
        // Use randomNumber4 in test method.
    }

}
```

and the guide states which interface serves which case:

> *"Specifically, `RandomNumberExtension` implements the following extension APIs:
> `BeforeAllCallback`: to support `static` field injection. `TestInstancePostProcessor`: to
> support non-`static` field injection. `ParameterResolver`: to support constructor and
> method injection."*

That mapping is the single most useful fact on this page. **A field is not a parameter.**
An extension that implements only `ParameterResolver` will resolve `@Random int` in a method
signature and leave `@Random int randomNumber1` as a plain zero, with no error — which is
the "my extension silently does nothing" bug, and it is always this.

The implementation, in full:

```java
class RandomNumberExtension
        implements BeforeAllCallback, TestInstancePostProcessor, ParameterResolver {

    private final java.util.Random random = new java.util.Random(System.nanoTime());

    @Override
    public void beforeAll(ExtensionContext context) {
        Class<?> testClass = context.getRequiredTestClass();
        injectFields(testClass, null, ModifierSupport::isStatic);
    }

    @Override
    public void postProcessTestInstance(Object testInstance, ExtensionContext context) {
        Class<?> testClass = context.getRequiredTestClass();
        injectFields(testClass, testInstance, ModifierSupport::isNotStatic);
    }

    @Override
    public boolean supportsParameter(ParameterContext pc, ExtensionContext ec) {
        return pc.isAnnotated(Random.class) && isInteger(pc.getParameter().getType());
    }

    @Override
    public Integer resolveParameter(ParameterContext pc, ExtensionContext ec) {
        return this.random.nextInt();
    }

    private void injectFields(Class<?> testClass, @Nullable Object testInstance,
            Predicate<Field> predicate) {

        predicate = predicate.and(field -> isInteger(field.getType()));
        findAnnotatedFields(testClass, Random.class, predicate)
            .forEach(field -> {
                try {
                    field.setAccessible(true);
                    field.set(testInstance, this.random.nextInt());
                }
                catch (Exception ex) {
                    throw new RuntimeException(ex);
                }
            });
    }

    private static boolean isInteger(Class<?> type) {
        return type == Integer.class || type == int.class;
    }

}
```

Note `findAnnotatedFields` and `ModifierSupport` — these come from
`org.junit.platform.commons.support`, the **supported** reflection API. Extension authors
reach for `org.junit.platform.commons.util` because the IDE offers it; that package is
internal and the 6.0 release notes are a list of things that were removed from it
([02b](02b-what-junit-6-changed.md)).

And the annotation that ties it together — a meta-annotation, so the user never names the
extension class:

```java
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
@ExtendWith(RandomNumberExtension.class)
public @interface Random {
}
```
## Testing the extension

An extension is production code with no assertions of its own, and the supported way to
test it is the Platform's own test kit:

> *"`EngineTestKit` provides support for discovering and executing tests for a given
> `TestEngine` and provides convenient access to the results. … For execution,
> `EngineExecutionResults` provides a fluent API to verify the expected results."*

The artifact is `junit-platform-testkit`. The pattern is: define a small nested test class
that uses your extension, execute it through `EngineTestKit`, and assert on the resulting
events — how many tests ran, which failed, what the failure was. It is the only honest way
to test "does my extension disable the test in this case", because the outcome you want to
assert on is a *test result*, not a return value.

⚠️ Do not test an extension by writing tests that use it and eyeballing the build. A green
build proves your extension did not crash; it does not prove it ran at all — and an
extension that silently does nothing is the most common bug in this whole area.

## Gotchas

**★ Implementing only `ParameterResolver` and expecting fields to be injected.**
Fields need `TestInstancePostProcessor` (instance) and `BeforeAllCallback` (static). The
parameter case is a third interface. Nothing errors; the field just keeps its default value.

**★ Keeping per-test state in an instance field of the extension.**
*"Usually, an extension is instantiated only once"* — so an instance field is shared across
every test the extension serves, and under parallel execution it is shared across threads.
Use the `Store` ([10h](10h-keeping-state.md)).

**★ Using `org.junit.platform.commons.util` instead of `…commons.support`.**
The `util` package is internal. JUnit 6 removed a long list of its members —
`ReflectionSupport.loadClass`, `ReflectionUtils.readFieldValue`, `BlacklistedExceptions`,
the `commons.util.PreconditionViolationException` — and an extension compiled against it
breaks on upgrade.

**★ Throwing a raw `RuntimeException` from an extension.**
It becomes the test's failure, with your stack trace and no explanation. Throw
`ExtensionConfigurationException` for a misconfiguration and
`ParameterResolutionException` for a resolution failure; both produce messages that point
the user at their own code.

**★ An extension that mutates the test instance without saying so.**
Reflection into private fields is exactly what these extensions do, and it is invisible from
the test source. That is acceptable when the field carries an annotation the reader can
see — `@Random`, `@Mock`, `@TempDir` — and abusive otherwise.

## Interview questions

**★ Which interfaces does an extension need to inject into a static field, an instance field
and a method parameter?**
`BeforeAllCallback` for the `static` field, `TestInstancePostProcessor` for the instance
field, and `ParameterResolver` for constructor and method parameters. The guide's
`RandomNumberExtension` implements all three for exactly that reason, and an extension that
implements only one of them fails silently for the other two cases.

**★ Where should an extension keep state between two of its own callbacks?**
In the `ExtensionContext.Store`, keyed in a namespace derived from the extension class and
the relevant context — not in a field of the extension. An extension is typically
instantiated once, so a field is shared by every test it serves and by every thread running
them.

**★ How would you test an extension?**
With `junit-platform-testkit`: execute a small purpose-built test class through
`EngineTestKit` and assert on the recorded events — tests started, succeeded, failed,
skipped, and the exceptions recorded. Asserting on a real test run is the only way to check
behaviour whose observable output is a test result.

{/* FOOTER */}