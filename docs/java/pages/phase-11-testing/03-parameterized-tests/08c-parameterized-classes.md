---
title: "@ParameterizedClass moves the table of cases up one level so every @Test in a class runs against every row and the report groups failures by case rather than by method — a feature that arrived in 5.13, is still marked experimental in 6.0.3, and lives in a different package from the one the guide's listings imply"
sidebar_label: "08c · Parameterized classes"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Parameterized Classes and Tests"
> and "Consuming Arguments"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `@ParameterizedClass`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedClass.html))
> and `@Parameter`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/Parameter.html))
> pages, and the 6.0.1 release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**`@ParameterizedTest` gives one method many cases. `@ParameterizedClass` gives one *class*
many cases: every `@Test` in it runs once per argument set, sharing the arguments as fields or
constructor parameters. That is exactly the shape you want when four assertions about the same
input would otherwise be four parameterized methods each repeating the same source annotation —
and it is a trap when the class is really a bag of unrelated tests that happen to be in the
same file. This chunk is what the feature is and what it costs; how the arguments actually get
into the instance is [08d](08d-parameterized-class-injection.md), and what runs when is
[08e](08e-parameterized-class-lifecycle.md).**

## 🔴 Package and status, checked against the javadoc

The user guide's samples show `@ParameterizedClass` and `@Parameter` imported from
`org.junit.jupiter.params`, and other listings in the guide place `@Parameter` next to
aggregator types in a way that suggests `org.junit.jupiter.params.aggregator`. **The javadoc
settles it and the aggregator package is wrong:**

| | |
|---|---|
| `@ParameterizedClass` | `org.junit.jupiter.params.ParameterizedClass` |
| `@Parameter` | `org.junit.jupiter.params.Parameter` |

There is no `org.junit.jupiter.params.aggregator.Parameter` in 6.0.3 — that javadoc page does
not exist. `@AggregateWith` and `ArgumentsAccessor` *are* in `…params.aggregator`, which is
where the confusion comes from.

Both annotations carry the same API status, and it is not "stable":

> `@API(status=EXPERIMENTAL, since="6.0")` — on both `ParameterizedClass` and `Parameter`,
> each with `Since: 5.13`.

The guide says the same thing in prose:

> *"Parameterized classes are currently an experimental feature. You're invited to give it a
> try and provide feedback to the JUnit team so they can improve and eventually promote this
> feature."*

Read the two version markers together: the feature *arrived* in 5.13 and is still marked
experimental in 6.0.3 — a full major version later. That is the honest risk statement for a
production test suite. It is not going away, but its API may still change in a minor release,
which `@API(status = STABLE)` would forbid.

The rest of the declaration explains what it actually is:

```java
@Target({ANNOTATION_TYPE, TYPE})
@Retention(RUNTIME)
@Documented
@Inherited
@ClassTemplate
@ExtendWith(ParameterizedClassExtension.class)
public @interface ParameterizedClass
```

`@ClassTemplate` is the mechanism — a parameterized class is a class template whose invocations
are supplied by argument sources, exactly as `@ParameterizedTest` is a `@TestTemplate`.

## The shape

```java
@ParameterizedClass
@ValueSource(strings = { "racecar", "radar", "able was I ere I saw elba" })
class PalindromeTests {

    @Parameter
    String candidate;

    @Test
    void palindrome() {
        assertTrue(StringUtils.isPalindrome(candidate));
    }

    @Test
    void reversePalindrome() {
        String reverseCandidate = new StringBuilder(candidate).reverse().toString();
        assertTrue(StringUtils.isPalindrome(reverseCandidate));
    }
}
```

The guide's documented tree for that class — quoted from the documentation, not from a run:

> ```
> PalindromeTests ✔
> ├─ [1] candidate = "racecar" ✔
> │  ├─ palindrome() ✔
> │  └─ reversePalindrome() ✔
> ├─ [2] candidate = "radar" ✔
> │  ├─ palindrome() ✔
> │  └─ reversePalindrome() ✔
> └─ [3] candidate = "able was I ere I saw elba" ✔
>    ├─ palindrome() ✔
>    └─ reversePalindrome() ✔
> ```

Three argument sets × two tests = six leaves, grouped by argument set rather than by method.
**That grouping is the feature.** A failure reads "for `radar`, `reversePalindrome` broke",
which is a sentence; two separate `@ParameterizedTest` methods would have produced two
unrelated subtrees saying the same thing twice.

Every source works here:

> *"All source annotations in this section are applicable to both `@ParameterizedClass` and
> `@ParameterizedTest`. For the sake of brevity, the examples in this section will only show
> how to use them with `@ParameterizedTest` methods."*

So `@CsvFileSource`, `@EnumSource`, `@MethodSource`, a custom `@ArgumentsSource` — all of
[02](02-valuesource.md) through [06](06-argumentssource.md) applies unchanged. So do
`quoteTextArguments`, `autoCloseArguments`, `allowZeroInvocations` and
`argumentCountValidation`: the javadoc lists exactly the same five optional elements on
`@ParameterizedClass` as on `@ParameterizedTest`, plus `name`.

## What it costs

The multiplication is the thing to hold in your head. A class with six `@Test` methods and four
argument sets is **twenty-four test executions**, each with a full instance lifecycle —
construction, every `@BeforeEach`, every `@AfterEach`. Under the default `PER_METHOD` mode that
is twenty-four instances of the test class.

For a pure unit test that is nothing. For a class annotated `@SpringBootTest`, or one that
opens a Testcontainers connection per instance, it is the difference between a suite that runs
in seconds and one that does not. The feature does not warn you; the arithmetic is yours to do.

## It is a class template, with the consequences that implies

`@ParameterizedClass` is meta-annotated `@ClassTemplate`, and that is what other Jupiter
features key off. 6.0.3 fixed one such interaction:

> *"Allow using `@ResourceLock` on classes annotated with `@ClassTemplate` (or
> `@ParameterizedClass`)."*

⚠️ That is a **6.0.3** bug fix. On 6.0.0 through 6.0.2, `@ResourceLock` on a parameterized class
did not work — which matters the moment a parameterized class touches a shared resource and the
suite runs in parallel. Boot 4.1.0 manages 6.0.3, so a project on the managed version has the
fix; a project pinning an earlier 6.0.x does not.

## Gotchas

**★ Importing `@Parameter` from `org.junit.jupiter.params.aggregator`.** That type does not
exist. It is `org.junit.jupiter.params.Parameter`, in the same package as `@ParameterizedClass`.
The aggregator package holds `ArgumentsAccessor`, `ArgumentsAggregator` and `@AggregateWith`.

**★ Treating the feature as stable because the guide documents it.** Both annotations are
`@API(status = EXPERIMENTAL, since = "6.0")`, having arrived in 5.13. Experimental means the
API may change in a minor release. Use it, but do not build an in-house testing framework on
top of it.

**★ Forgetting that a source annotation on the class is required.** The javadoc: *"A
`@ParameterizedClass` must specify at least one `ArgumentsProvider` via `@ArgumentsSource` or a
corresponding composed annotation."* A `@ParameterizedClass` with no source is not a plain test
class; it is a misconfiguration.

**★ Expecting `@ParameterizedClass` to be inherited only where you want it.** It is
`@Inherited` — *"This annotation is inherited within class hierarchies"* — so an abstract base
annotated with it makes every concrete subclass parameterized, whether or not the subclass says
anything about arguments.

**★ Reaching for a parameterized class when only one test in it varies.** Every `@Test` in the
class now runs once per argument set, including the ones the parameter is irrelevant to. That
multiplies runtime and adds nothing. Move the varying test out and make it a
`@ParameterizedTest` ([09](09-when-not-to-parameterize.md)).

**★ Parameterizing a `@SpringBootTest` class.** Four argument sets × six tests is twenty-four
full lifecycles. The Spring context is cached across them, but everything else is not. Do the
multiplication before, not after.

**★ Relying on `@ResourceLock` with a parameterized class on 6.0.0–6.0.2.** It was fixed in
6.0.3. Before that the lock did not apply, so a parallel run could interleave invocations that
were supposed to be serialised.

**★ Assuming a `@ParameterizedClass` needs its `@Test` methods annotated differently.** It does
not — they are ordinary `@Test` methods. The class-level annotation and the source are the only
new syntax, which is what makes converting an existing test class cheap and makes accidentally
converting one cheap too.

## Interview questions

**★ What is `@ParameterizedClass` and how does it differ from `@ParameterizedTest`?**
It parameterizes a whole test class: every `@Test` in it runs once per argument set, and the
report groups the results by argument set rather than by method. `@ParameterizedTest`
parameterizes a single method. Under the hood the class version is a `@ClassTemplate` where the
method version is a `@TestTemplate`, and every argument source annotation works on both.

**★ Which package are `@ParameterizedClass` and `@Parameter` in, and what is their API status?**
Both are in `org.junit.jupiter.params` — not in `…params.aggregator`, which holds
`ArgumentsAccessor`, `ArgumentsAggregator` and `@AggregateWith`. Both are
`@API(status = EXPERIMENTAL, since = "6.0")` with a `@since` of 5.13, so the feature has been
available for a major version and is still not promoted to stable.

**★ What does a parameterized class cost at run time?**
Every `@Test` in the class runs once per argument set, with a full lifecycle each time — so six
methods and four argument sets is twenty-four executions and, under the default `PER_METHOD`
mode, twenty-four instances. Trivial for unit tests, significant for anything that builds a
fixture per instance.

**★ Why is `@ParameterizedClass` meta-annotated `@ClassTemplate`?**
Because that is the extension point it is built on: a class template is a class whose
invocations are supplied by a provider, the class-level analogue of `@TestTemplate`. It is also
why interactions with other features are tracked against `@ClassTemplate` — 6.0.3, for example,
fixed `@ResourceLock` for class templates and therefore for parameterized classes.

**★ When is a parameterized class the wrong choice?**
When only some of the tests in the class actually depend on the parameter. Every `@Test`
multiplies by the number of argument sets, so a class with six tests and four argument sets
runs twenty-four times whether or not the parameter is relevant to all six. If one test varies
and five do not, the varying one should be a `@ParameterizedTest` in an ordinary class.

{/* FOOTER */}
