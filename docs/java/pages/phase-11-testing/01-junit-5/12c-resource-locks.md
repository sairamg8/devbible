---
title: "@ResourceLock names a shared resource with a String and lets Jupiter refuse to schedule conflicting tests together, and the two things that make it usable are the READ/READ_WRITE distinction and the fact that a class-level READ_WRITE lock quietly serialises the entire class"
sidebar_label: "12c · Resource locks"
sidebar_position: 43
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Parallel Execution"
> ([writing-tests/parallel-execution](https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html));
> javadoc for `@ResourceLock`
> ([ResourceLock](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/parallel/ResourceLock.html))
> and `Resources`
> ([Resources](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/parallel/Resources.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**Some state genuinely cannot be made per-test — the JVM has one set of system properties, one
default `Locale`, one `System.out`. `@ResourceLock` is Jupiter's answer: you declare which
shared thing a test touches and how, and the engine refuses to schedule conflicting tests at
the same time. It is a scheduling constraint expressed declaratively, and it is the reason
`CONCURRENT` is defined as *"execute concurrently unless a resource lock forces execution in
the same thread"*.**

[12](12-parallel-execution.md) is the execution modes and
[12b](12b-parallelism-configuration.md) is the pool. Dynamic locks and the global barrier
`@Isolated` are [12d · dynamic locks and isolation](12d-dynamic-locks-and-isolation.md); the
catalogue of shared state that breaks under concurrency is
[12e · shared state under parallelism](12e-shared-state-under-parallelism.md).

## The mechanism

> *"In addition to controlling the execution mode using the `@Execution` annotation, JUnit
> Jupiter provides another annotation-based declarative synchronization mechanism. The
> `@ResourceLock` annotation allows you to declare that a test class or method uses a specific
> shared resource that requires synchronized access to ensure reliable test execution. The
> shared resource is identified by a unique name which is a `String`."*

A `String`. There is no type, no registry and no compiler check — **two tests share a resource
if and only if they spell its name identically.** That is the price of a mechanism that has to
cover "the database", "the port 8080 listener" and "that one static cache" without knowing
what any of them are.

The guarantee you buy:

> *"When access to shared resources is declared using the `@ResourceLock` annotation, the JUnit
> Jupiter engine uses this information to ensure that no conflicting tests are run in parallel.
> This guarantee extends to lifecycle methods of a test class or method. For example, if a test
> method is annotated with a `@ResourceLock` annotation, the 'lock' will be acquired before any
> `@BeforeEach` methods are executed and released after all `@AfterEach` methods have been
> executed."*

**The lock brackets the lifecycle, not just the test body.** That is what makes it usable at
all — a `@BeforeEach` that mutates a system property is inside the critical section, and so is
the `@AfterEach` that restores it.

Three properties from the javadoc that decide how it behaves in a hierarchy:

> *"`@Target({ TYPE, METHOD })` … `@Inherited` … `@Repeatable(ResourceLocks.class)`"*

> *"This annotation can be repeated to declare the use of multiple shared resources."*

> *"Uniqueness of a shared resource is determined by both the `value()` and the `mode()`.
> Duplicated shared resources do not cause errors."*

So a test may hold several locks, a subclass inherits its superclass's, and declaring the same
resource twice is harmless rather than an error — which matters because inheritance plus a
composed annotation will produce duplicates routinely.

## The built-in resource names

> *"The name can be user-defined or one of the predefined constants in `Resources`:
> `SYSTEM_PROPERTIES`, `SYSTEM_OUT`, `SYSTEM_ERR`, `LOCALE`, or `TIME_ZONE`."*

Those five are precisely the JVM-global mutable things that ordinary tests touch without
thinking:

| Constant | The global it names |
|---|---|
| `SYSTEM_PROPERTIES` | `System.getProperties()` / `System.setProperty` |
| `SYSTEM_OUT` | `System.out`, including `System.setOut` in a test that captures output |
| `SYSTEM_ERR` | `System.err` |
| `LOCALE` | `Locale.getDefault()` / `Locale.setDefault` |
| `TIME_ZONE` | `TimeZone.getDefault()` / `TimeZone.setDefault` |

Using the constants rather than your own strings matters: they are the names *other people's*
tests and other libraries' tests will use, so a lock on `Resources.SYSTEM_PROPERTIES`
coordinates with code you have never read, and a lock on `"sysprops"` coordinates with nothing.

## `READ` and `READ_WRITE`

> *"In addition to the `String` that uniquely identifies the shared resource, you may specify an
> access mode. Two tests that require `READ` access to a shared resource may run in parallel
> with each other but not while any other test that requires `READ_WRITE` access to the same
> shared resource is running."*

A standard readers–writer lock. Readers share; a writer excludes everybody. The guide's own
example, and the sentence that justifies it:

> *"If the tests in the following example were run in parallel without the use of
> `@ResourceLock`, they would be flaky. Sometimes they would pass, and at other times they would
> fail due to the inherent race condition of writing and then reading the same JVM System
> Property."*

```java
@Execution(CONCURRENT)
class StaticSharedResourcesDemo {

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
    @ResourceLock(value = SYSTEM_PROPERTIES, mode = READ)
    void customPropertyIsNotSetByDefault() {
        assertNull(System.getProperty("my.prop"));
    }

    @Test
    @ResourceLock(value = SYSTEM_PROPERTIES, mode = READ_WRITE)
    void canSetCustomPropertyToApple() {
        System.setProperty("my.prop", "apple");
        assertEquals("apple", System.getProperty("my.prop"));
    }

    @Test
    @ResourceLock(value = SYSTEM_PROPERTIES, mode = READ_WRITE)
    void canSetCustomPropertyToBanana() {
        System.setProperty("my.prop", "banana");
        assertEquals("banana", System.getProperty("my.prop"));
    }

}
```

Notice that the backup-and-restore in `@BeforeEach`/`@AfterEach` is **not** sufficient on its
own — that is exactly the code a developer writes believing it makes the test safe. It is
inside the lock's bracket, which is what makes it work; without the lock, another test's writer
runs between this test's backup and its assertion.

## `target = CHILDREN`, and the trap it exists to fix

Here is the sharp edge. A class-level lock applies to the class *as a node*, and a `READ_WRITE`
requirement anywhere forces the whole class into one thread:

> *"Tests in the following example would run in the `SAME_THREAD` if the `@ResourceLock` didn't
> have `target = CHILDREN`. This is because the test class declares a `READ` shared resource,
> but one test method holds a `READ_WRITE` lock, which would force the `SAME_THREAD` execution
> mode for all the test methods."*

The fix:

> *"Also, 'static' shared resources can be declared for direct child nodes via the `target`
> attribute in the `@ResourceLock` annotation, the attribute accepts a value from the
> `ResourceLockTarget` enum. Specifying `target = CHILDREN` in a class-level `@ResourceLock`
> annotation has the same semantics as adding an annotation with the same value and mode to
> each test method and nested test class declared in this class. This may improve
> parallelization when a test class declares a `READ` lock, but only a few methods hold a
> `READ_WRITE` lock."*

```java
@Execution(CONCURRENT)
@ResourceLock(value = "a", mode = READ, target = CHILDREN)
public class ChildrenSharedResourcesDemo {

    @ResourceLock(value = "a", mode = READ_WRITE)
    @Test
    void test1() throws InterruptedException {
        Thread.sleep(2000L);
    }

    @Test
    void test2() throws InterruptedException {
        Thread.sleep(2000L);
    }

    // test3, test4, test5 likewise
}
```

`target = CHILDREN` pushes the class-level `READ` down onto each method instead of holding it
at the class, so the four readers proceed together and only `test1`'s writer serialises against
them. Without it, one `READ_WRITE` method turns a five-method class into a sequential one.

⚠️ One consequence the guide states only in the javadoc:

> *"Note that `target = CHILDREN` means that `value()` and `mode()` no longer apply to a node
> declaring the annotation. However, the `providers()` attribute remains applicable, and the
> target of 'dynamic' shared resources added via implementations of `ResourceLocksProvider` is
> not changed."*

The class itself no longer holds the lock at all — the declaration has moved wholly to the
children. If the class-level setup (`@BeforeAll`) touches the resource, `target = CHILDREN`
leaves it unprotected.

**This is the performance trap of `@ResourceLock`:** locks are easy to add and their cost is
invisible until you look at the wall-clock time. A class-level `READ_WRITE` lock on a resource
half your suite also locks is a suite that is, in effect, sequential.

## Gotchas

**★ Two tests locking the same resource under different names.**
The identity of a resource is string equality. `"database"` and `"db"` are two resources and
the tests run concurrently. Use the `Resources` constants where they apply, and a shared
`public static final String` where they do not.

**★ A class-level `READ_WRITE` lock serialising the whole class.**
A lock held at class level applies to the class node, and one `READ_WRITE` method forces
`SAME_THREAD` for every method in the class. `target = CHILDREN` pushes the declaration down to
the methods and is the documented fix.

**★ Believing backup-and-restore in `@BeforeEach`/`@AfterEach` makes a test thread-safe.**
It does not — another test's writer can run between your backup and your assertion. The
restore is only correct *inside* a lock, which is why the guide's example has both.

**★ Forgetting that the lock covers the lifecycle methods too.**
That is a feature, and it changes where you can put mutations: setup and teardown are inside
the critical section, so restoring global state in `@AfterEach` is safe. It also means a slow
`@BeforeEach` holds the lock for its whole duration.

**★ Using `READ_WRITE` because you were not sure.**
`READ` readers run together. Defaulting everything to `READ_WRITE` turns a readers–writer lock
into a mutex and gives up most of the benefit, silently, with no failing test to tell you.

**★ Locking on a resource that is not actually shared.**
Each lock is a scheduling constraint that costs wall-clock time and buys nothing if the
resource was per-test all along. `@TempDir` ([09](09-tempdir-and-resources.md)) gives each test
its own directory; a lock on `"tempfiles"` is pure loss.

**★ Assuming a resource lock protects against code outside the test.**
It coordinates test *nodes* within the Jupiter engine. Application threads, a background
scheduler in your Spring context, or another engine running in the same JVM are not
participants.

## Interview questions

**★ What problem does `@ResourceLock` solve that `@Execution(SAME_THREAD)` does not?**
`SAME_THREAD` serialises a node with respect to its parent — it says "do not run *this* in
parallel". `@ResourceLock` says "do not run this *at the same time as anything else that
touches the same named resource*", which lets everything unrelated keep running concurrently.
It is a targeted constraint rather than a blanket one, and it has a readers–writer mode so
several readers still overlap.

**★ What are the built-in resource names and why use them instead of your own strings?**
`SYSTEM_PROPERTIES`, `SYSTEM_OUT`, `SYSTEM_ERR`, `LOCALE` and `TIME_ZONE`, from
`org.junit.jupiter.api.parallel.Resources`. Resource identity is string equality, so using the
predefined constants means your lock coordinates with every other test and library that also
uses them — including code you have not read — whereas a private string only coordinates with
itself.

**★ Explain `READ` versus `READ_WRITE`.**
Two tests requiring `READ` on the same resource may run in parallel with each other, but not
while any test requiring `READ_WRITE` on that resource is running. It is a readers–writer lock:
readers share, a writer excludes everyone. Defaulting everything to `READ_WRITE` degrades it to
a mutex.

**★ What does `target = CHILDREN` do, and what problem does it fix?**
It makes a class-level `@ResourceLock` behave as though the same annotation had been placed on
each test method and nested class instead of on the class node. The problem it fixes is that a
class-level `READ` lock combined with even one `READ_WRITE` method forces `SAME_THREAD` for the
entire class; pushing the declaration to the children lets the readers overlap and serialises
only the writer.

**★ Does `@ResourceLock` cover `@BeforeEach` and `@AfterEach`?**
Yes, explicitly: the lock is acquired before any `@BeforeEach` runs and released after all
`@AfterEach` methods have completed. That is what makes the common backup-and-restore-globals
pattern correct, and it also means a slow setup holds the lock for its whole duration.

{/* FOOTER */}
