---
title: "There are four ways to get a mock and only one of them is right on JUnit 6 — and the thing nobody tells you is that MockitoExtension's no-argument constructor sets STRICT_STUBS, so the extension changes your tests' behaviour, not just their boilerplate"
sidebar_label: "02 · Creating mocks"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> (sections 0.2 inline mock making, 0.3 instrumentation on Java 21+, 9 the `@Mock`
> annotation, 39 mocking final types), and the javadoc **and constructor** of
> [`MockitoExtension`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-extensions/mockito-junit-jupiter/src/main/java/org/mockito/junit/jupiter/MockitoExtension.java)
> and
> [`MockitoSettings`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-extensions/mockito-junit-jupiter/src/main/java/org/mockito/junit/jupiter/MockitoSettings.java).
> JDK 25 · Spring Boot 4.1.0 → Mockito 5.23.0, JUnit Jupiter 6.0.3. **No sandbox** — this
> page carries Java and build configuration, never a fabricated test run.

**Four ways exist because Mockito has outlived three test frameworks. Three of them are
history you will meet in an old codebase, one is what you write today, and the difference
between them is not cosmetic: `MockitoExtension` sets `STRICT_STUBS`, and
`MockitoAnnotations.openMocks` does not. Migrating from the old form to the new one can turn
a green suite red, which is the extension working correctly and is worth expecting.**

## What you write on JUnit 6

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock PaymentGateway gateway;
    @Mock OrderRepository repository;

    @Test
    void a_declined_card_leaves_the_order_unpaid() { /* ... */ }
}
```

The javadoc's own framing:

> *"Extension that initializes mocks and handles strict stubbings. This extension is the
> JUnit Jupiter equivalent of our JUnit4 `MockitoJUnitRunner`."*

Note *"and handles strict stubbings"* — that half is easy to skim and is the behavioural
change. More on it below.

### Why `@Mock` rather than `mock(...)`

From section 9, verbatim:

> - *"Minimizes repetitive mock creation code."*
> - *"Makes the test class more readable."*
> - *"Makes the verification error easier to read because the **field name** is used to
>   identify the mock."*

The third is the one worth having. A failure on an anonymous `mock(PaymentGateway.class)`
names the type; a failure on `@Mock PaymentGateway gateway` names `gateway`. In a test with
three collaborators of related types, that is the difference between reading the message and
reading the source.

### Method parameters, for a mock used once

```java
@ExtendWith(MockitoExtension.class)
public class ExampleTest {

    @Mock
    private List<Integer> sharedList;

    @Test
    public void hasLocalMockInThisTest(@Mock List<Integer> localList) {
        localList.add(100);
        sharedList.add(100);
    }
}
```

> *"Use parameters for initialization of mocks that you use only in that specific test
> method. In other words, where you would initialize local mocks in JUnit 4 by calling
> `Mockito.mock(Class)`, use the method parameter. This is especially beneficial when
> initializing a mock with generics, as you no longer get a warning about "Unchecked
> assignment"."*

The generics point is real and easily missed. `mock(List.class)` gives you a raw `List` and
an unchecked warning; `@Mock List<Integer> list` as a parameter is fully typed.

### Constructor parameters, for `final` fields

```java
@ExtendWith(MockitoExtension.class)
public class ExampleTest {

     private final List<Integer> sharedList;

     ExampleTest(@Mock sharedList) {
         this.sharedList = sharedList;
     }
}
```

> *"the extension supports JUnit Jupiter's constructor parameters. This allows you to do
> setup work in the constructor and set your fields to `final`."*

Nice where you want the field immutable. Note it interacts with the per-method test instance
lifecycle — a new instance per test means a new constructor call per test, which is what you
want. See [01 · The lifecycle](../01-junit-5/03-the-lifecycle.md).

## 🔴 The extension sets `STRICT_STUBS`, and that is a behaviour change

Straight out of the source:

```java
// This constructor is invoked by JUnit Jupiter via reflection or ServiceLoader
public MockitoExtension() {
    this(Strictness.STRICT_STUBS);
}
```

So the default — the one you get from a bare `@ExtendWith(MockitoExtension.class)` — is
**strict stubs**, not lenient. An unused stubbing now fails the test, and a stubbing invoked
with arguments that do not match now reports a `PotentialStubbingProblem` rather than
silently returning `null`.

`@MockitoSettings` overrides it, and its own default is the same:

```java
@ExtendWith(MockitoExtension.class)   // ← note: it registers the extension itself
@Inherited
@Retention(RUNTIME)
public @interface MockitoSettings {
    Strictness strictness() default Strictness.STRICT_STUBS;
}
```

Two things follow. **`@MockitoSettings` is meta-annotated with `@ExtendWith`**, so it
registers the extension on its own — writing both is harmless but redundant. And relaxing
strictness is an explicit, visible act:

```java
@MockitoSettings(strictness = Strictness.LENIENT)
class LegacyOrderServiceTest { /* ... */ }
```

⚠️ **Reach for `LENIENT` on a whole class only as a migration step, and leave a comment
saying so.** The unused stubbing that strictness reports is usually a real signal — see
**07 · Strictness** *(not written yet)*.

## The three older forms

| Form | Era | Strictness |
|---|---|---|
| `MockitoAnnotations.openMocks(this)` in `@BeforeEach` | any | **none** — nothing is checked |
| `@RunWith(MockitoJUnitRunner.class)` | JUnit 4 | strict, but JUnit 4 only |
| `MockitoRule` | JUnit 4 | configurable, JUnit 4 only |
| `@ExtendWith(MockitoExtension.class)` | **JUnit 5/6** | **`STRICT_STUBS`** |

Section 9 says of `@Mock`:

> ***"Important!** This needs to be somewhere in the base class or a test runner:
> `MockitoAnnotations.openMocks(testClass);`"*

That sentence is written for the pre-extension world. On JUnit 6, the extension does it.
Finding `openMocks` in a Jupiter test almost always means a JUnit 4 test was migrated by
changing the imports and nothing else — and the suite has been running without strictness
checks ever since.

⚠️ `openMocks` returns an `AutoCloseable`, and the older `initMocks` is deprecated. If you
must keep the manual form, close it in `@AfterEach` or the mocks leak between tests.

## 🔴 The inline mock maker and Java 21+

Since Mockito 5.0.0:

> *"Mockito now offers support for mocking final classes and methods by default. … Since
> 5.0.0, this feature is enabled by default."*

The inline mock maker *"uses a combination of both Java instrumentation API and sub-classing
rather than creating a new class to represent a mock. This way, it becomes possible to mock
final types and methods."* The separate `mockito-inline` artifact is legacy — the javadoc
says it *"may be abolished in future versions"*.

**And instrumentation is where JDK 25 bites.** Section 0.3, verbatim:

> *"Starting from Java 21, the JDK restricts the ability of libraries to attach a Java agent
> to their own JVM. As a result, the inline-mock-maker might not be able to function without
> an explicit setup to enable instrumentation, and the JVM will always display a warning."*

That is [JEP 451](https://openjdk.org/jeps/451), and on Java 25 you should expect the
warning. The documented fix is to pass Mockito's own jar as a `-javaagent`. Gradle, Kotlin
DSL, from the javadoc:

```kotlin
val mockitoAgent = configurations.create("mockitoAgent")
dependencies {
    testImplementation(libs.mockito)
    mockitoAgent(libs.mockito) { isTransitive = false }
}
tasks {
    test {
        jvmArgs.add("-javaagent:${mockitoAgent.asPath}")
    }
}
```

⚠️ The javadoc notes these are *"examples about how to set up mockito-core as a Java agent,
and it may be more appropriate to choose a different approach depending on your project
constraints"*, and that Gradle recommends a `CommandLineArgumentProvider` for task
relocatability — omitted above for simplicity, as in the original.

**If your build suddenly prints an agent warning after a JDK upgrade, this is why**, and it
is not a Mockito bug.

### What the inline maker still cannot do

From section 39:

- Mocking final types and enums is *"incompatible with mock settings like"*
  `withSettings().serializable()` and `withSettings().extraInterfaces()`.
- *"Some methods cannot be mocked"* — *"Package-visible methods of `java.*`"* and
  *"`native` methods"*.

## Gotchas

**★ Migrating from `openMocks` to `MockitoExtension` turns green tests red.**
That is the extension working. `openMocks` checks nothing; the extension's no-argument
constructor sets `STRICT_STUBS`, so every unused stubbing that was silently tolerated is now
a failure. Expect it, and read each failure rather than reaching for `LENIENT`.

**★ `openMocks` left behind in a migrated JUnit 4 test.**
The imports changed and nothing else, so the class has been running without any strictness
checking. It looks modern and behaves like 2015.

**★ `@Mock` with no extension registered at all.**
The field stays `null` and the first use is a `NullPointerException` with nothing pointing at
the missing `@ExtendWith`. Nothing warns that the annotation was never processed.

**★ Writing both `@ExtendWith(MockitoExtension.class)` and `@MockitoSettings`.**
Harmless but redundant — `@MockitoSettings` is itself meta-annotated `@ExtendWith(MockitoExtension.class)`.
Worth knowing so you do not delete the `@ExtendWith` and assume you have lost the extension.

**★ `@MockitoSettings(strictness = LENIENT)` applied to a whole class to fix one test.**
Every other test in the class loses the check too. Prefer `lenient()` on the single stubbing
that needs it, and only after establishing that the stubbing is genuinely needed.

**★ `mock(List.class)` and the unchecked warning.**
Raw type, unchecked assignment. The `@Mock List<Integer> list` parameter form is fully typed
— the javadoc calls this out as a specific benefit of parameter injection.

**★ Expecting `@Mock` to work on a constructor parameter without the extension.**
Constructor-parameter injection is a `ParameterResolver` feature of the extension. Without it
registered, Jupiter cannot construct the class at all.

**★ The JDK 21+ agent warning read as a broken build.**
JEP 451 restricts self-attaching agents. The inline mock maker still works in many setups but
warns; the documented fix is `-javaagent` pointing at Mockito's jar. It is configuration, not
breakage.

**★ Assuming "final classes are mockable now" means everything is.**
Package-visible methods of `java.*` and `native` methods still cannot be mocked, and
`serializable()` and `extraInterfaces()` are incompatible with mocking final types and enums.

**★ Adding the `mockito-inline` artifact on Mockito 5.**
It is redundant — the inline maker is the default since 5.0.0 — and the javadoc says the
artifact *"may be abolished in future versions"*. A dependency that does nothing is worse
than no dependency, because the next reader assumes it does something.

**★ Forgetting to close the `AutoCloseable` from `openMocks`.**
If you keep the manual form, the returned handle must be closed, or mocks accumulate across
tests in the same class.

## Interview questions

**★ What is the difference between `MockitoAnnotations.openMocks(this)` and
`@ExtendWith(MockitoExtension.class)`?**
Both initialise `@Mock` fields. Only the extension handles strictness — its no-argument
constructor, the one Jupiter calls, passes `Strictness.STRICT_STUBS`. `openMocks` checks
nothing, so a suite using it tolerates unused and mismatched stubbings silently.

**★ What strictness do you get from a bare `@ExtendWith(MockitoExtension.class)`?**
`STRICT_STUBS`. It is set in the extension's public no-argument constructor, and
`@MockitoSettings`'s own default is the same. So strict is the default on JUnit 5 and 6, and
lenient is something you opt into visibly.

**★ Does `@MockitoSettings` need `@ExtendWith` alongside it?**
No. `@MockitoSettings` is meta-annotated with `@ExtendWith(MockitoExtension.class)`, so it
registers the extension itself. Writing both is redundant rather than wrong.

**★ Why prefer `@Mock` over `Mockito.mock(...)`?**
Less repetition, a more readable class, and — the one that matters in a failure — the field
name is used to identify the mock in the error message. With several collaborators of similar
types, that is the difference between reading the message and going to the source.

**★ When would you use a `@Mock` method parameter?**
For a mock used in exactly one test method, and especially for a generic type: the parameter
form is fully typed, whereas `mock(List.class)` gives a raw type and an unchecked-assignment
warning. The javadoc names both reasons.

**★ Your build starts warning about a Java agent after upgrading the JDK. What happened?**
Java 21 restricted a library's ability to attach an agent to its own JVM (JEP 451), and
Mockito's inline mock maker is built on runtime agent attachment. The documented fix is to
pass Mockito's jar explicitly with `-javaagent` on the test JVM. It is a JDK policy change,
not a Mockito defect.

**★ Since Mockito 5, final classes are mockable. What is still out of reach?**
Package-visible methods of `java.*` and `native` methods. And mocking final types or enums is
incompatible with `withSettings().serializable()` and `withSettings().extraInterfaces()`.
Needing any of these is usually a design signal — see
**11 · Static and final** *(not written yet)*.

**★ Should a Mockito 5 project depend on `mockito-inline`?**
No. The inline mock maker has been the default since 5.0.0, and the javadoc says the separate
artifact *"may be abolished in future versions"*. Keeping it adds a dependency that changes
nothing and misleads the next reader into thinking it does.

{/* FOOTER */}
