---
title: "@EnabledIf names a boolean method by String and an ExecutionCondition is thirty lines of real code, and the deciding factor between them is whether the reason for skipping is worth explaining to whoever reads the report"
sidebar_label: "07d · Custom conditions"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Conditional Test Execution"
> ([conditional-test-execution](https://docs.junit.org/6.0.3/writing-tests/conditional-test-execution.html)),
> the extension-model page of the same name
> ([extensions/conditional-test-execution](https://docs.junit.org/6.0.3/extensions/conditional-test-execution.html))
> and "Configuration Parameters — Pattern Matching Syntax"
> ([configuration-parameters](https://docs.junit.org/6.0.3/running-tests/configuration-parameters.html));
> javadoc for `ExecutionCondition`
> ([ExecutionCondition](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ExecutionCondition.html))
> and `ConditionEvaluationResult`
> ([ConditionEvaluationResult](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/ConditionEvaluationResult.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**When none of the built-in conditions fits, Jupiter offers two escape hatches at very
different levels: `@EnabledIf`/`@DisabledIf`, which point at a `boolean` method by name,
and `ExecutionCondition`, the interface every condition in the framework is built on.
The first is a two-line answer with a string-typed reference the compiler cannot check;
the second is reusable, testable, and can put a real sentence in the report. This chunk
covers the declarative one. The interface, and how to switch conditions off for a run, are
[07e · ExecutionCondition and deactivation](07e-executioncondition-and-deactivation.md).**

## `@EnabledIf` and `@DisabledIf`

> *"As an alternative to implementing an `ExecutionCondition`, a container or test may be
> enabled or disabled based on a condition method configured via the `@EnabledIf` and
> `@DisabledIf` annotations. A condition method must have a `boolean` return type and may
> accept either no arguments or a single `ExtensionContext` argument."*

```java
@Test
@EnabledIf("customCondition")
void enabled() {
    // ...
}

@Test
@DisabledIf("customCondition")
void disabled() {
    // ...
}

boolean customCondition() {
    return true;
}
```

The method may live elsewhere, referenced by fully qualified name with a `#` before the
method:

```java
package example;

class ExternalCustomConditionDemo {

    @Test
    @EnabledIf("example.ExternalCondition#customCondition")
    void enabled() {
        // ...
    }

}

class ExternalCondition {

    static boolean customCondition() {
        return true;
    }

}
```

**When the method has to be `static`** — the guide lists exactly four situations:

> *"There are several cases where a condition method would need to be `static`: when
> `@EnabledIf` or `@DisabledIf` is used at class level; when `@EnabledIf` or `@DisabledIf`
> is used on a `@ParameterizedTest` or a `@TestTemplate` method; when the condition method
> is located in an external class. In any other case, you can use either `static` methods
> or instance methods as condition methods."*

The reason is the same one that makes `@BeforeAll` static ([03](03-the-lifecycle.md)): a
class-level condition is evaluated before the test instance exists. A `@ParameterizedTest`
([03 · parameterized tests](../03-parameterized-tests/01-one-test-many-cases.md)) is a
template whose condition is evaluated once for the template, before any invocation's
instance exists.

And the guide's genuinely useful trick — an existing JDK predicate as a condition, with no
new code at all:

> *"It is often the case that you can use an existing `static` method in a utility class as
> a custom condition. For example, `java.awt.GraphicsEnvironment` provides a
> `public static boolean isHeadless()` method that can be used to determine if the current
> environment does not support a graphical display."*

```java
@DisabledIf(value = "java.awt.GraphicsEnvironment#isHeadless",
    disabledReason = "headless environment")
```

## The cost of a `String` reference

`@EnabledIf("customCondition")` is a method reference that no compiler, no IDE rename and
no "find usages" understands. Rename `customCondition` and the annotation still compiles;
what happens then is a resolution failure at run time rather than a green build, so it is
not silent — but it is a failure discovered by the suite rather than by the build, on
whatever machine runs it next.

It is also invisible to a reader: `@EnabledIf("dbAvailable")` tells you a method exists
somewhere in this class or a superclass and nothing about what it consults. Two rules keep
this honest:

1. **Always set `disabledReason`.** The annotation has it, and it is the only thing the
   report will show.
2. **Prefer a real `ExecutionCondition` the moment the predicate is used twice**, because
   an extension is a type: it can be imported, renamed, unit tested and given a
   meta-annotation — [07e](07e-executioncondition-and-deactivation.md) writes one.

## Gotchas

**★ Renaming the method that `@EnabledIf` names by string.**
The annotation is a `String`; no refactoring tool follows it. The failure surfaces at run
time, on whichever machine runs the suite next, not at compile time.

**★ A non-`static` condition method used at class level.**
Class-level conditions are evaluated before any test instance exists. The guide names the
four cases that require `static`: class level, `@ParameterizedTest`, `@TestTemplate`, and
an external class.

**★ A condition method with the wrong signature.**
`boolean` return type, and either no arguments or exactly one `ExtensionContext`. Anything
else — a `Boolean` box, a second parameter — is not a valid condition method.

**★ Writing `@EnabledIf` on a `@ParameterizedTest` and expecting per-invocation evaluation.**
The condition is evaluated for the template, not per invocation, which is exactly why the
method must be `static` there. Per-invocation logic belongs in the argument source or in
an `assumeTrue` inside the test ([08 · assumptions](08-assumptions.md)).
## Interview questions

**★ What signature must an `@EnabledIf` condition method have, and when must it be static?**
A `boolean` return type and either no parameters or a single `ExtensionContext` parameter.
It must be `static` when the annotation is at class level, when it is on a
`@ParameterizedTest` or `@TestTemplate` method, or when the method lives in an external
class referenced as `fully.qualified.Class#method`.
**★ What does `@DisabledIf("java.awt.GraphicsEnvironment#isHeadless")` demonstrate?**
That a condition method does not have to be written for the purpose. Any accessible
`static boolean` method with the right signature will do, referenced by fully qualified
class name and `#` method name — the guide uses `isHeadless()` to skip tests that need a
graphical display. It is the cheapest correct condition in the framework and it needs no
new code.

**★ Why is `disabledReason` more important on `@EnabledIf` than on `@DisabledOnOs`?**
Because `@DisabledOnOs(WINDOWS)` at least tells a reader what was consulted, while
`@EnabledIf("dbAvailable")` names a method they now have to go and find. The report shows
neither annotation — only the reason string — so a condition whose name is opaque is the
one that most needs the sentence.

{/* FOOTER */}
