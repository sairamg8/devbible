---
title: "ResourceLocksProvider moves locking out of the test and into a convention, and @Isolated gives up on naming the resource entirely by stopping the whole suite — the first makes locking invisible and the second makes it expensive, and both are correct answers to problems the annotation cannot reach"
sidebar_label: "12d · Dynamic locks and isolation"
sidebar_position: 44
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Parallel Execution"
> ([writing-tests/parallel-execution](https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html));
> javadoc for `ResourceLocksProvider`
> ([ResourceLocksProvider](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/parallel/ResourceLocksProvider.html)),
> `@ResourceLock`
> ([ResourceLock](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/parallel/ResourceLock.html))
> and `@Isolated`
> ([Isolated](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/parallel/Isolated.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**[12c](12c-resource-locks.md) covers the case where you can name the resource and annotate the
test. This is the two escapes: computing the locks at runtime when annotating every method
would be absurd, and declining to name the resource at all when there isn't one you can name.**

## `ResourceLocksProvider` — locks computed at runtime

> *"In addition to declaring these shared resources statically, the `@ResourceLock` annotation
> has a `providers` attribute that allows registering implementations of the
> `ResourceLocksProvider` interface that can add shared resources dynamically at runtime. Note
> that resources declared statically with `@ResourceLock` annotation are combined with resources
> added dynamically by `ResourceLocksProvider` implementations."*

**Combined, not replaced.** The javadoc spells the arithmetic out:

> *"Resources declared 'statically' using `value()` and `mode()` are combined with 'dynamic'
> resources added via `providers()`. For example, declaring resource 'A' via
> `@ResourceLock("A")` and resource 'B' via a provider returning `new Lock("B")` will result in
> two shared resources 'A' and 'B'."*

The guide's example derives the access mode from the method name, so the tests carry no lock
annotations at all:

```java
@Execution(CONCURRENT)
@ResourceLock(providers = DynamicSharedResourcesDemo.Provider.class)
class DynamicSharedResourcesDemo {

    private Properties backup;

    @BeforeEach
    void backup() {
        backup = new Properties();
        backup.putAll(System.getProperties());
    }

    @AfterEach
    void restore() {
        System.setProperties(backup);
    }

    @Test
    void customPropertyIsNotSetByDefault() {
        assertNull(System.getProperty("my.prop"));
    }

    @Test
    void canSetCustomPropertyToApple() {
        System.setProperty("my.prop", "apple");
        assertEquals("apple", System.getProperty("my.prop"));
    }

    @Test
    void canSetCustomPropertyToBanana() {
        System.setProperty("my.prop", "banana");
        assertEquals("banana", System.getProperty("my.prop"));
    }

    static class Provider implements ResourceLocksProvider {

        @Override
        public Set<Lock> provideForMethod(List<Class<?>> enclosingInstanceTypes, Class<?> testClass,
                Method testMethod) {
            ResourceAccessMode mode = testMethod.getName().startsWith("canSet") ? READ_WRITE : READ;
            return Set.of(new Lock(SYSTEM_PROPERTIES, mode));
        }
    }

}
```

### The three hooks

> *"`provideForClass(Class<?> testClass)` — Add shared resources for a test class."*

> *"`provideForNestedClass(List<Class<?>> enclosingInstanceTypes, Class<?> testClass)` — Add
> shared resources for a `@Nested` test class."*

> *"`provideForMethod(List<Class<?>> enclosingInstanceTypes, Class<?> testClass, Method
> testMethod)` — Add shared resources for a test method."*

All three are `default` methods returning nothing, so you override only the level you care
about. And a requirement that is easy to miss:

> *"Implementations must provide a no-args constructor."*

The API's own framing of when to use it:

> *"Adding shared resources via this API has the same semantics as declaring them declaratively
> via `@ResourceLock(value, mode)`, but for some use cases the programmatic approach may be more
> flexible and less verbose."*

`@API(status = MAINTAINED, since = "5.13.3")`, present since 5.12 — so this is recent API, and
any 5.x-era example you find will not have it.

### When it is justified, and the cost

**Justified** when the locking is a *convention* spanning many classes: every method annotated
with your own `@ModifiesGlobalConfig` takes `READ_WRITE`, everything else takes `READ`; or a
base class for database tests derives a lock name from the schema each subclass declares. The
rule is expressed once instead of on hundreds of methods, and it cannot drift out of sync with
itself.

**The cost is visibility.** A reader of `canSetCustomPropertyToApple` sees no annotation and no
reason why their test is serialised against another one. Under a provider, the answer to "why is
this slow" lives in a class they have to know exists. If you use one, the convention belongs in
a comment on the base class or on the custom annotation — somewhere the reader will actually
land.

## `@Isolated` — the global barrier

> *"If most of your test classes can be run in parallel without any synchronization but you have
> some test classes that need to run in isolation, you can mark the latter with the `@Isolated`
> annotation. Tests in such classes are executed sequentially without any other tests running at
> the same time."*

The javadoc is blunter:

> *"When a test class is run in isolation, no other test class is executed concurrently. This can
> be used to enable parallel test execution for the entire test suite while running some tests
> in isolation (e.g. if they modify some global resource)."*

**Nothing else runs at all.** This is not a lock on a named resource; it is a barrier across the
whole run. It is `@Target(TYPE)` and `@Inherited`, so it applies to a class and everything that
extends it, and there is no method-level form.

### The reason attribute that goes nowhere

`@Isolated` takes an optional `String`:

> *"`value` — The reason this test class needs to run in isolation. The supplied string is
> currently not reported in any way but can be used for documentation purposes."*

⚠️ *"currently not reported in any way"* — unlike `@Disabled`'s reason, which appears in the
report ([07](07-disabling-and-conditions.md)), this one is a comment with annotation syntax.
Write it anyway. `@Isolated` is exactly the annotation whose justification is forgotten, and the
attribute is the obvious place for it even if only a human ever reads it.

### The cost, stated plainly

Every `@Isolated` class is a point where the suite's parallelism collapses to one. Its cost is
roughly the class's own duration multiplied by the parallelism you were otherwise getting: an
`@Isolated` class taking ten seconds, in a suite running at parallelism four, costs about thirty
seconds of otherwise-usable machine time — and more if other classes are already in flight when
it needs to start, because they must drain first.

Two or three `@Isolated` classes in a large suite are invisible. Twenty of them mean you have a
sequential suite with a parallel configuration file.

### `@Isolated` versus a named `@ResourceLock`

| | `@ResourceLock("x")` | `@Isolated` |
|---|---|---|
| Blocks | only tests declaring `x` | everything |
| Granularity | class or method | class only |
| Requires | a name both sides agree on | nothing |
| Cost | proportional to the contended set | proportional to the whole suite |

**Prefer the lock whenever you can name the thing.** `@Isolated` is the admission that you
cannot — a class that installs a JVM-wide agent, replaces a security manager, plays
class-loading games, or restarts an infrastructure component that everything implicitly depends
on. Those cases are real, and they are rarer than the number of `@Isolated` annotations in most
codebases suggests.

## Gotchas

**★ A `ResourceLocksProvider` that hides the locking from the test.**
Deriving locks from method names is powerful, and it means a reader of the test cannot see why
their test is serialised. Reserve it for a convention documented in one obvious place — the base
class, or the custom annotation that pulls the provider in.

**★ Expecting a provider to replace the static declarations.**
It does not. Static `value`/`mode` and provider-returned locks are *combined*, so
`@ResourceLock("A")` plus a provider returning `new Lock("B")` gives you two locks, not one.

**★ A `ResourceLocksProvider` without a no-args constructor.**
Documented as a requirement. Jupiter instantiates the provider itself, exactly as it does an
`@ExtendWith` extension ([10d](10d-registering-extensions.md)).

**★ Overriding `provideForClass` when you meant `provideForMethod`.**
All three methods are `default` and return nothing, so overriding the wrong one compiles and
silently locks nothing at the level you cared about. There is no error to tell you.

**★ Copying a 5.x example and finding `providers` does not exist.**
`ResourceLocksProvider` arrived in 5.12 and the `providers` and `target` attributes with it.
Anything written before that will show only `value` and `mode`.

**★ Reaching for `@Isolated` when you could name the resource.**
`@Isolated` stops the entire suite, not just conflicting tests. A named `@ResourceLock` blocks
only the tests that touch the same thing, and it works at method granularity.

**★ Accumulating `@Isolated` classes.**
Each one is a serialisation point for the whole run, costing roughly its own duration times your
parallelism. A handful is fine; twenty means the parallel configuration is decorative and nobody
has noticed.

**★ Expecting `@Isolated`'s reason string to appear in the report.**
It does not — *"currently not reported in any way"*. It is documentation for humans reading the
source. Write it, and do not expect to find it in a CI failure.

**★ Putting `@Isolated` on a method.**
`@Target(TYPE)`. It is class-only, and the compiler will tell you — but the underlying point is
that isolation is not a per-test concept: it is a statement about a whole class's relationship
with the JVM.

**★ Forgetting `@Isolated` is `@Inherited`.**
A base class marked `@Isolated` makes every subclass isolated too. That is usually intended and
occasionally means a whole family of fast tests has quietly stopped running in parallel.

## Interview questions

**★ When is a `ResourceLocksProvider` justified over plain annotations?**
When the locking follows a convention across many classes — every method whose name or
annotation marks it a writer takes `READ_WRITE` on the same resource — so the rule is expressed
once instead of on hundreds of methods and cannot drift. The cost is that the locking becomes
invisible at the test site, so the convention has to be documented somewhere a reader will land.

**★ If a class has both `@ResourceLock("A")` and a provider returning `Lock("B")`, what locks
does it hold?**
Both. The documentation is explicit that static and dynamic resources are combined, giving two
shared resources rather than the provider overriding the annotation.

**★ What does `@Isolated` do, and what does it cost?**
It runs the annotated class with no other test class executing concurrently — a barrier across
the whole suite rather than a lock on a named resource. Its cost is approximately the class's
duration multiplied by the parallelism you gave up, plus the drain time for work already in
flight. It is the right answer for a class that mutates something unnameable, and a suite-killer
if it accumulates.

**★ `@Isolated` takes a reason string. Where does it show up?**
Nowhere. The javadoc says it is *"currently not reported in any way but can be used for
documentation purposes"*. Unlike `@Disabled`'s reason, it never reaches the report — which is an
argument for writing it anyway, since `@Isolated` is precisely the annotation whose justification
gets lost.

**★ You have one test class that restarts a shared container mid-run. Lock or isolate?**
Isolate. The thing it disturbs is not a resource you can name and have every other test agree
on; every test in the suite implicitly depends on the container being up. That is the case
`@Isolated` exists for. If instead the class only mutated one schema, a named `@ResourceLock` on
that schema would be far cheaper.

**★ Which levels can a `ResourceLocksProvider` supply locks for?**
Three: `provideForClass` for a test class, `provideForNestedClass` for a `@Nested` class, and
`provideForMethod` for a test method. All three are `default` methods, so you implement only the
level you need — and overriding the wrong one silently locks nothing where you wanted it.

{/* FOOTER */}
