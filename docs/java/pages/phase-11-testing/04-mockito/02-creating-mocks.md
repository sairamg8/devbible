---
title: "There are four ways to get a mock and only one of them is right on JUnit 6 — and the thing nobody tells you is that MockitoExtension's no-argument constructor sets STRICT_STUBS, so the extension changes your tests' behaviour, not just their boilerplate"
sidebar_label: "02 · Creating mocks"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> (section 9, the `@Mock` annotation), and the javadoc **and constructor** of
> [`MockitoExtension`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-extensions/mockito-junit-jupiter/src/main/java/org/mockito/junit/jupiter/MockitoExtension.java)
> and
> [`MockitoSettings`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-extensions/mockito-junit-jupiter/src/main/java/org/mockito/junit/jupiter/MockitoSettings.java).
> JDK 25 · Spring Boot 4.1.1 → Mockito 5.23.0, JUnit Jupiter 6.0.3. **No sandbox** — this
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

{/* FOOTER */}
