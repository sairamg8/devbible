---
title: "A test's real output is not green or red, it is the sentence it prints when it fails — and AssertJ exists because assertTrue can only ever print false"
sidebar_label: "01 · Why fluent assertions"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — "A simple example",
> "Avoiding incorrect usage" and "Configuring AssertJ"
> ([assertj.github.io/doc](https://assertj.github.io/doc/#assertj-core-simple-example)) —
> and the `assertj-core` 3.27.7 sources (`org.assertj.core.error.ShouldBeEqual`,
> `org.assertj.core.internal.Failures`, `org.assertj.core.configuration.Configuration`).
> JDK 25 · Spring Boot 4.1.0, which manages **AssertJ Core 3.27.7** via `assertj-bom`
> and **JUnit Jupiter 6.0.3** via `junit-bom`.

**A passing test produces nothing you read. A failing test produces one paragraph, and
that paragraph is the entire return on the hours you spent writing the suite. If the
paragraph says `expected: <true> but was: <false>` you have to reopen the file, reread
the assertion, and often attach a debugger to find out what the value actually was —
which means the test told you *that* something broke and nothing about *what*. AssertJ's
whole argument is that the assertion should know enough about the object under test to
describe the difference itself. Everything else in this topic — the collection
assertions, the recursive comparison, soft assertions, `as()` — is downstream of that one
idea.**

## The three ways to say the same thing, and what each can print

Take a service that returns a `Money` and should return £42.00.

```java
// 1 — carries no information at all
assertTrue(actual.equals(expected));

// 2 — carries both values, but nothing about which field differs
assertEquals(expected, actual);

// 3 — carries both values, the type, and a per-field diff if you ask for one
assertThat(actual).isEqualTo(expected);
```

Form 1 can only ever produce the boolean. The assertion *computed* both objects and then
threw the interesting half away before failing: by the time the `AssertionError` is
constructed, `actual` and `expected` are gone. No amount of cleverness downstream can
recover them. This is not a style complaint — it is an information-theoretic one.

Form 2 keeps both. That is most of the value, and for two scalars it is enough.

Form 3 keeps both **and** keeps the static type of `actual`, which is the part that
matters as soon as the value is not a scalar. `assertThat(actual)` returns a
type-specific assert object — a `StringAssert`, an `AbstractIterableAssert`, an
`AbstractLocalDateTimeAssert` — and every assertion on it can render a failure in terms
of that type. A collection assertion can say which elements were missing and which were
unexpected; a `Throwable` assertion can print the stack trace of the cause; a recursive
comparison can list the differing field paths. `assertEquals` has no idea it is holding a
list.

## The mechanism: a template, a representation, and a failure factory

AssertJ does not build its messages with string concatenation at the call site. Each
failure has an `ErrorMessageFactory` in `org.assertj.core.error` holding a `String.format`
template, and the values are rendered by a pluggable `Representation`. The `isEqualTo`
template in 3.27.7 is a two-line one, verbatim from `ShouldBeEqual`:

```java
private static final String EXPECTED_BUT_WAS_MESSAGE = "%nexpected: %s%n but was: %s";
```

`ShouldContain` builds its template out of a *group type description*, so the same code
prints "Expecting `ArrayList`:" or "Expecting `Set`:" or "Expecting directory:" as
appropriate:

```java
super("%nExpecting " + groupTypeDescription.getGroupTypeName()
      + ":%n  %s%nto contain:%n  %s%nbut could not find the following "
      + groupTypeDescription.getElementTypeName()
      + ":%n  %s%n%s", actual, expected, notFound, comparisonStrategy);
```

Two consequences follow, and both matter in practice.

**The message is composed after the failure is known**, so it can afford to be expensive:
computing "which elements were missing" is only done on the failing path. That is why
AssertJ can be this verbose without slowing a green suite.

**The rendering is a separate concern from the assertion.** Register a `Representation`
and every message changes at once; that is the hook you reach for when your domain type's
`toString()` is useless in a failure. See
[09 · as(), messages and representations](09-describedas-and-messages.md).

## It hands the failure to opentest4j so the IDE can show a diff

`ShouldBeEqual.newAssertionError` does not just throw an `AssertionError`. Its javadoc
says, verbatim:

> *"If opentest4j is on the classpath then `org.opentest4j.AssertionFailedError` would be
> used."*

and the code comments in the same method spell out the fallback chain:

```java
// comparison strategy is standard -> try to build an AssertionFailedError used in JUnit 5
// that is nicely displayed in IDEs
AssertionError assertionFailedError = assertionFailedError(message, representation);
// assertionFailedError != null means that JUnit 5 and opentest4j are in the classpath
if (assertionFailedError != null) return assertionFailedError;
// Junit5 was not used, try to build a JUnit 4 ComparisonFailure that is nicely displayed in IDEs
```

`AssertionFailedError` carries `expected` and `actual` as structured values, not just as
text inside a message. That is what IntelliJ and Eclipse read to offer the side-by-side
diff view on a failed test. Because `spring-boot-starter-test` puts Jupiter (and therefore
opentest4j) on the test classpath, you get this for free — but note that AssertJ only
takes this path **when no custom comparator is in play**, because a custom comparison
strategy makes "expected vs actual" a lie about how equality was decided.

## It also edits its own stack trace out of the way

`removeAssertJRelatedElementsFromStackTrace` defaults to `true`
(`Configuration.REMOVE_ASSERTJ_RELATED_ELEMENTS_FROM_STACK_TRACE`). The reference calls
it:

> *"Sets whether the elements related to AssertJ are removed from assertion errors stack
> trace. Defaults to true."*

Without it, every failure's stack trace opens with a dozen frames inside
`org.assertj.core.internal.*` before it reaches your test method. With it, the top frame
is the line you wrote. This is a small thing that you notice only when you turn it off —
which you should do exactly once, when you are debugging AssertJ itself or a custom
assertion of your own that is failing in the wrong place.

## The two printing limits that silently truncate a message

Both are documented in "Configuring AssertJ" and both are worth knowing before you file a
bug against AssertJ for "hiding" your data:

- **`MaxElementsForPrinting`** — *"In error messages, sets the threshold for how many
  elements from one iterable/array/map will be included in the description. Defaults to
  1000."*
- **`MaxLengthForSingleLineDescription`** — *"In error messages, sets the threshold when
  iterable/array formatting will be on one line (if their String description is less than
  this parameter) or it will be formatted with one element per line. Defaults to 80."*

So a 5,000-element list is reported with 1,000 elements shown, and a collection whose
rendering exceeds 80 characters flips to one element per line. The second default is the
reason a failure that used to fit on one line suddenly becomes a wall of text when you
add a field to your DTO — nothing broke, the rendering just crossed the threshold.

## The one misuse the whole design cannot prevent

Because `assertThat(x)` is an ordinary expression, this compiles and passes:

```java
// DON'T DO THIS ! It does not assert anything
assertThat(actual.equals(expected));
```

That is the documentation's own example and its own capitalisation. The `assertThat`
overload resolves to the `boolean` one, you get a `BooleanAssert`, and you never call an
assertion on it. The test is green and asserts nothing. The reference lists the analysers
that catch it:

> *"SpotBugs or FindBugs with the `RV_RETURN_VALUE_IGNORED_INFERRED` rule"*, *"SonarQube
> with the Assertions should be complete (S2970) rule"*, and *"other tools that can
> evaluate whether calls to methods annotated with the `@CheckReturnValue` annotation are
> done correctly."*

If your build has neither SpotBugs nor SonarQube wired in, nothing in the compiler, the
test runner or AssertJ will tell you. This is the single highest-value static-analysis
rule you can enable on a Java test source set.

## What this topic owns, and what it does not

This topic is about assertion *style* and *failure messages*. The test engine — lifecycle,
`@Test`, `assertAll`, `assertThrows`, extensions, execution order — is
**topic 01 · JUnit 5** *(not written yet)*. Mockito's `verify` and argument captors are
**topic 04 · Mockito** *(not written yet)*. AssertJ's Spring integration, including
`MockMvcTester` and its `assertThat(result)` chain, is
**topic 06 · Web-layer tests with MockMvc** *(not written yet)* — it is an AssertJ API but
it is a Spring subject, and it is named there.

## Gotchas

**★ `assertThat(a.equals(b))` compiles, passes, and asserts nothing.**
It is the documentation's first listed misuse. There is no arity error and no warning,
because `assertThat(boolean)` is a legitimate overload. Turn on SpotBugs'
`RV_RETURN_VALUE_IGNORED_INFERRED` or Sonar's S2970 on your test sources; without one of
them this defect is invisible until someone reads the file.

**★ `assertThat(1 == 2)` is the same bug with a more convincing appearance.**
Also from the docs, also passing. It looks like a comparison assertion and is a
`BooleanAssert` that was never asserted on.

**★ Mixing `assertThat` from two entry-point classes that both extend `Assertions` will
not compile.**
The reference is explicit: if `MyAssertions` and `MyOtherAssertions` both inherit
`org.assertj.core.api.Assertions`, then `assertThat("frodo")` is ambiguous — the inherited
`assertThat(String)` is visible from both. One custom entry point per test source set, or
none. See [07 · Custom assertions](07-custom-assertions.md).

**★ A green suite tells you nothing about the quality of your failure messages.**
Nobody reads a message that never prints. The only way to find out that your assertion
reports "expected true but was false" is for it to fail in CI at 2am, which is the worst
possible moment to discover it. Review assertions by asking what they would say — that is
what [10 · The checklist](10-the-checklist.md) is for.

**★ The IDE diff view disappears the moment you add a custom comparator.**
`ShouldBeEqual` only builds an `AssertionFailedError` on the standard comparison strategy
path when the comparison is standard; with a comparator in play the message still
describes the comparator, but the structured expected/actual that drives the diff view is
not the whole story and the presentation degrades. If you lose the diff view after a
refactor, look for a `usingComparator` you inherited.

**★ Truncated collections in a failure are a configured default, not a bug.**
1,000 elements printed, 80 characters before multi-line. If you are staring at a report
that stops mid-collection, raise `setMaxElementsForPrinting` for that test rather than
concluding AssertJ lost the data.

**★ Turning `removeAssertJRelatedElementsFromStackTrace` off globally makes every failure
worse.**
It is a debugging switch for AssertJ internals, not a production setting. Applied through
a discovered `Configuration` SPI it affects the whole test run and buries the one frame
anybody wants.

**★ AssertJ does not replace the test engine, and adding it does not remove JUnit.**
`spring-boot-starter-test` pulls in Jupiter, AssertJ, Mockito, Hamcrest, JSONassert and
XMLUnit. Having AssertJ on the classpath does not stop anyone writing `assertEquals`; a
consistent style is a review decision, not a dependency decision.

## Interview questions

**★ Why is `assertTrue(a.equals(b))` worse than `assertEquals(a, b)`, in terms other than
taste?**
Because it destroys information before the failure exists. `equals` collapses two objects
to a boolean, and the assertion only ever sees the boolean, so the `AssertionError` it
constructs physically cannot contain the values. `assertEquals` receives both objects and
puts both in the message. The difference is not that one reads better — it is that one
can produce a diagnosis and the other cannot, no matter how good the reporting layer
downstream is.

**★ What does `assertThat(x)` actually return, and why does the answer matter?**
A type-specific assert object chosen by overload resolution on the static type of `x` —
`StringAssert`, `ListAssert`, `ThrowableAssert`, and so on, all descending from
`AbstractAssert`. It matters because every assertion available on that object, and every
failure message it can produce, is specialised to that type. Type-specific assertions are
where the good failure messages come from; a generic `assertEquals` has no type
information to spend.

**★ How does AssertJ get IntelliJ to show a side-by-side diff on a failed assertion?**
By throwing `org.opentest4j.AssertionFailedError` when opentest4j is on the classpath,
which it is under `spring-boot-starter-test`. That exception carries `expected` and
`actual` as structured values in addition to the message, and IDEs read those fields to
render the comparison view. If opentest4j is absent AssertJ falls back to JUnit 4's
`ComparisonFailure`, and failing that to a plain `AssertionError`.

**★ A colleague says "AssertJ is just syntactic sugar over JUnit assertions." What is the
strongest counter-argument?**
That the sugar is not the point; the type-directed dispatch is. Because `assertThat`
returns a typed assert, AssertJ can offer `containsExactlyInAnyOrder`, `hasRootCauseMessage`
and `usingRecursiveComparison` at all — none of which can be expressed as an
`assertEquals` because none of them is an equality check. The fluent chain is a
consequence of returning `this`; the value is the API surface that returning a typed
`this` makes possible.

**★ Your test suite is entirely green. What can you say about your failure messages?**
Nothing. That is the uncomfortable answer and it is the correct one. Failure output is the
only part of a test suite that is never exercised by a passing run, which makes it the
only part that rots without anyone noticing. The mitigations are review — reading each
assertion and asking what it would print — and, occasionally, deliberately breaking a
production method locally to read what comes out.

**★ Why does AssertJ strip its own frames from the stack trace by default, and when would
you turn that off?**
Because the frames between your assertion call and the throw site are all AssertJ
internals and none of them is where the bug is; leaving them in pushes your test's line
number off the top of the report. You turn it off when the thing you are debugging *is*
an AssertJ internal — most realistically a custom `AbstractAssert` subclass of your own
that is failing somewhere you did not expect.

{/* FOOTER */}
