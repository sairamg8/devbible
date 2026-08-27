---
title: "SoftAssertionsExtension removes the one way soft assertions can silently pass, by calling assertAll itself in afterTestExecution — and it injects into test methods only, never into constructors or lifecycle methods"
sidebar_label: "06c · The soft-assertions extension"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the `assertj-core` **3.27.7** sources on GitHub
> (tag `assertj-build-3.27.7`) — the class javadoc and declaration of
> [`SoftAssertionsExtension`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/junit/jupiter/SoftAssertionsExtension.java)
> and
> [`InjectSoftAssertions`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/junit/jupiter/InjectSoftAssertions.java).
> JDK 25 · Spring Boot 4.1.0 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**[06](06-soft-assertions.md) established that the raw `new SoftAssertions()` form has a
failure mode where a forgotten `assertAll()` makes the test unfailable. The Jupiter
extension removes it structurally: you never hold the instance's lifecycle, so you cannot
forget to drain it. That is the reason to prefer it — the reduction in boilerplate is the
smaller half of the argument.**

## Registering it

> *"Extension for JUnit Jupiter that provides support for injecting a concrete
> implementation of `SoftAssertionsProvider` into test methods and (since 3.18.0) into test
> fields annotated with `@InjectSoftAssertions`."*

```java
@ExtendWith(SoftAssertionsExtension.class)
class SoftlyExtensionExample {

  // initialized by the SoftlyExtension extension
  @InjectSoftAssertions
  private SoftAssertions soft;

  @Test
  public void chained_soft_assertions_example() {
    String name = "Michael Jordan - Bulls";
    soft.assertThat(name)
        .startsWith("Mi")
        .contains("Bulls");
    // no need to call softly.assertAll(), this is done by the extension
  }

  // nested classes test work too
  @Nested
  class NestedExample {

    @Test
    public void football_assertions_example() {
      String kylian = "Kylian Mbappé";
      soft.assertThat(kylian)
          .startsWith("Ky")
          .contains("bap");
      // no need to call softly.assertAll(), this is done by the extension
    }
  }
}
```

Two things the javadoc's own example is quietly demonstrating. The field is **`private`**,
so injection is reflective and does not need an accessor. And the `@Nested` class reads the
outer class's injected field and works — one of the few places where nesting's enclosing
instance does exactly what you would hope. Compare
[01 · Nested tests](../01-junit-5/06b-nested-tests.md).

`SoftAssertions` and `BDDSoftAssertions` both work, and so does your own:

> *"Two examples of `SoftAssertionsProvider`s that come packaged with AssertJ are
> `SoftAssertions` and `BDDSoftAssertions`, but custom implementations are also supported as
> long as they are non-abstract and have a default constructor."*

## Parameter injection

```java
@ExtendWith(SoftAssertionsExtension.class)
class ExampleTestCase {

   @InjectSoftAssertions
   BDDSoftAssertions bdd;

   @Test
   void multipleFailures(SoftAssertions softly) {
      softly.assertThat(2 * 3).isEqualTo(0);
      softly.assertThat(Arrays.asList(1, 2)).containsOnly(1);
      softly.assertThat(1 + 1).isEqualTo(2);
   }
}
```

Note the parameter needs **no annotation** — the extension is a `ParameterResolver` and
resolves any `SoftAssertionsProvider` parameter. `@InjectSoftAssertions` is for fields only;
its `@Target` is `FIELD`.

## 🔴 Applicability — where injection does and does not happen

The javadoc is precise, and this is the part people get wrong:

> *"In this context, the term "test method" refers to any method annotated with `@Test`,
> `@RepeatedTest`, `@ParameterizedTest`, `@TestFactory`, or `@TestTemplate`.*
> *This extension does not inject `SoftAssertionsProvider` arguments into test constructors
> or lifecycle methods."*

So a `SoftAssertions` parameter on `@BeforeEach` is **not** resolved, and neither is one on
the test class constructor. Only the five test-method annotations listed. If you want soft
assertions available in `@BeforeEach`, use the injected *field* — which is valid there, per
the scope rules below — or reach for the extension's own API, covered further down.

## Scope: when the instance is valid, and when it is drained

> *"Annotated `SoftAssertionsProvider` fields become valid from the `@BeforeEach` lifecycle
> phase. For parameters, they become valid when the parameter is resolved.*
> *In the `afterTestExecution` phase (immediately after the test has returned, but before
> the `AfterEach` phase) all collected errors (if any) will be wrapped in a single
> multiple-failures error.*
> *All `SoftAssertionsProvider` instances (fields & parameters) created within the scope of
> the same test method (including its `BeforeEach` phase) will share the same state object
> to collect the failed assertions, so that all assertion failures from all
> `SoftAssertionsProvider`s will be reported in the order that they failed."*

Three consequences worth having straight:

1. **A field is usable from `@BeforeEach` onwards** — not in the constructor, not in
   `@BeforeAll`. An assertion made in `@BeforeEach` is collected into the same report as the
   test's own.
2. **Draining happens in `afterTestExecution`, before `@AfterEach`.** So an `@AfterEach` that
   makes a soft assertion on the injected field is running *after* the report has already
   been produced — its failures have nowhere to go. Assert in the test, or hard-assert in
   `@AfterEach`.
3. **All providers in one test method share one collector.** Field and parameter, `SoftAssertions`
   and `BDDSoftAssertions` together — one report, in failure order. The javadoc's mixed
   example makes the point explicitly:

```java
@ExtendWith(SoftAssertionsExtension.class)
class ExampleTestCase {

   @InjectSoftAssertions
   SoftAssertions softly

   @Test
   void multipleFailures(BDDSoftAssertions bdd) {
      bdd.then(2 * 3).isEqualTo(0);
      softly.assertThat(Arrays.asList(1, 2)).containsOnly(1);
      bdd.then(1 + 1).isEqualTo(2);
      // When SoftAssertionsExtension calls assertAll(), the three
      // above failures above will be reported in-order.
   }
}
```

## Third-party extensions can contribute failures

> *"Sometimes a third-party extension may wish to softly assert something as part of the
> main test. Or sometimes a third-party extension may be a wrapper around another assertion
> library (eg, Mockito) and it would be nice for that library's soft assertions to mix well
> with AssertJ's."*

```java
class ExampleTestCase implements BeforeEachCallback {

   @Override
   public void beforeEach(ExtensionContext context) {
     SoftAssertions softly = SoftAssertionsExtension
       .getSoftAssertionsProvider(context, SoftAssertions.class);
     softly.assertThat(false).isTrue();
     // When SoftAssertionsExtension calls assertAll(), the
     // above failure will be included in the list of reported failures.
   }
}
```

`getSoftAssertionsProvider(context, Class)` and `getAssertionErrorCollector(context)` are the
public entry points. This is niche — you need it when writing your own extension, not when
writing tests — but it is the answer to "can my custom extension's checks land in the same
report", and the answer is yes.

⚠️ The extension class carries `@Beta` on parts of its API in 3.27.7. Treat the
third-party integration methods as the less stable half.

## Choosing between the extension and `assertSoftly`

| | Reach for |
|---|---|
| One or two soft tests in a class | `SoftAssertions.assertSoftly(softly -> { … })` — the scope is visible in the braces |
| Several tests in a class, or a base class for a suite | the extension — no boilerplate, and it also covers `@BeforeEach` |
| Soft assertions needed inside `@BeforeEach` | the extension, injected as a **field** |
| A custom `SoftAssertionsProvider` | the extension — it instantiates any non-abstract provider with a default constructor |

Both are safe against the forgotten-`assertAll()` defect, which is the criterion that
matters. The explicit `new SoftAssertions()` is the only form that is not.

## Gotchas

**★ A `SoftAssertions` parameter on `@BeforeEach` is not injected.**
The javadoc restricts parameter injection to methods annotated `@Test`, `@RepeatedTest`,
`@ParameterizedTest`, `@TestFactory` or `@TestTemplate`, and states it does not inject into
constructors or lifecycle methods. The failure is a `ParameterResolutionException` at
runtime, not a compile error. Use the injected field instead.

**★ Soft assertions made in `@AfterEach` are discarded.**
Draining happens in `afterTestExecution`, *before* `@AfterEach` runs. Anything collected
after that point has no report to land in. This is subtle enough to be worth a comment if
your team has teardown assertions.

**★ Expecting the injected field to be usable in `@BeforeAll` or the constructor.**
It becomes valid *from* `@BeforeEach`. A `static @BeforeAll` has no instance field to read
anyway, and a constructor runs before the `TestInstancePostProcessor` has done its work.

**★ `@InjectSoftAssertions` on a parameter does nothing.**
Its `@Target` is `FIELD`. A parameter needs no annotation at all — the extension resolves any
`SoftAssertionsProvider`-typed parameter — so the annotation is silently ignored where
people most expect to need it.

**★ Registering the extension and then also calling `assertAll()` yourself.**
The extension drains the shared collector afterwards; a manual `assertAll()` mid-test drains
it early and reports there instead. Failures after that point go into a now-empty collector
and are reported separately. Let the extension do it.

**★ Assuming a field injected in an outer class is unavailable to a `@Nested` class.**
It is available — the javadoc's own example demonstrates a `@Nested` test using the outer
class's injected field. The enclosing instance carries it.

**★ A custom `SoftAssertionsProvider` without a default constructor.**
The javadoc's condition is *"non-abstract and have a default constructor"*. Without one the
extension cannot instantiate it, and the failure appears as an extension configuration
error rather than as anything about your test.

**★ Relying on `@Beta` API.**
`getSoftAssertionsProvider` and the error-collector handle are the third-party integration
surface and are marked `@Beta` in 3.27.7. Fine to use; not fine to assume stable across
minor versions.

**★ Mixing the extension with `assertSoftly` in the same test.**
Two collectors, two reports, one confusing failure output — the `assertSoftly` lambda drains
its own instance and the extension drains the injected one. Pick one mechanism per test.

## Interview questions

**★ Why is the extension safer than `new SoftAssertions()`?**
Because it owns the instance's lifecycle. It calls `assertAll()` in `afterTestExecution`, so
the one defect that makes a soft-assertion test unfailable — a forgotten `assertAll()` —
cannot happen. The boilerplate saving is real but secondary.

**★ Where does the extension inject, and where does it refuse to?**
Into fields annotated `@InjectSoftAssertions`, and into parameters of methods annotated
`@Test`, `@RepeatedTest`, `@ParameterizedTest`, `@TestFactory` or `@TestTemplate`. It does
**not** inject into test constructors or lifecycle methods, so a `SoftAssertions` parameter
on `@BeforeEach` fails to resolve.

**★ When exactly are the collected failures reported?**
In the `afterTestExecution` phase — immediately after the test method returns and *before*
`@AfterEach`. That ordering matters: soft assertions made in teardown are collected after the
report has been produced and are lost.

**★ You inject a `SoftAssertions` field and also take a `BDDSoftAssertions` parameter. How
many reports do you get?**
One. All providers created within the scope of the same test method share a single state
object, so failures from both are reported together in the order they failed. The javadoc
gives exactly this example.

**★ Is the injected field usable from `@BeforeEach`?**
Yes — the javadoc says annotated fields *"become valid from the `@BeforeEach` lifecycle
phase"*, and assertions made there are collected into the test's report. It is not usable in
the constructor or in `@BeforeAll`.

**★ Can a `@Nested` class use the outer class's injected soft assertions?**
Yes. The javadoc's own example shows a `@Nested` test doing exactly that — the nested class
is an inner class and reads the enclosing instance's field.

**★ How would a custom extension of your own get its checks into AssertJ's report?**
Call `SoftAssertionsExtension.getSoftAssertionsProvider(context, SoftAssertions.class)` — or
`getAssertionErrorCollector(context)` for the raw collector — from inside your extension
callback. Failures recorded there are included when the extension drains. Note that this
surface is `@Beta`.

{/* FOOTER */}
