---
title: "A tag is a Platform-level label subject to a syntax the compiler cannot check, so an invalid tag is dropped with a log warning rather than a build failure — which is the single most expensive fact about @Tag"
sidebar_label: "06d · Tagging"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Tagging and Filtering"
> ([tagging-and-filtering](https://docs.junit.org/6.0.3/writing-tests/tagging-and-filtering.html)),
> "Tags" ([running-tests/tags](https://docs.junit.org/6.0.3/running-tests/tags.html)),
> "Build Support" ([build-support](https://docs.junit.org/6.0.3/running-tests/build-support.html))
> and "Console Launcher"
> ([console-launcher](https://docs.junit.org/6.0.3/running-tests/console-launcher.html));
> javadoc for `@Tag`
> ([Tag](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Tag.html))
> and `TagFilter`
> ([TagFilter](https://docs.junit.org/6.0.3/api/org.junit.platform.launcher/org/junit/platform/launcher/TagFilter.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**Tagging is the only mechanism in JUnit that lets one source tree be several test suites.
The annotation is Jupiter's; the concept and the filter are the Platform's; and the
decision about which tags run is made outside the code, in Surefire's `groups`, Gradle's
`includeTags`, or a `-t` on the ConsoleLauncher. That separation is the whole point — and
it is also why a mistyped tag costs you a silently smaller test run instead of a red
build.**

This chunk is the annotation: what a tag is, what `@Tag` may and may not say, and how to
keep a tag vocabulary from rotting. The expression grammar and the build-file plumbing are
[06e · tag expressions and filtering](06e-tag-expressions-and-filtering.md).

## The tag is a Platform concept, not a Jupiter one

> *"Tags are a JUnit Platform concept for marking and filtering tests. The programming
> model for adding tags to containers and tests is defined by the testing framework. For
> example, in JUnit Jupiter based tests, the `@Tag` annotation … should be used. For
> JUnit 4 based tests, the Vintage engine maps `@Category` annotations to tags."*

So a tag expression written in your build file filters Jupiter tests and Vintage tests in
the same run, through the same syntax, because by the time the Launcher applies the filter
both engines have already reduced their annotations to the same `TestTag` type
([02 · the architecture](02-the-architecture.md)).

## `@Tag` in the test

> *"Test classes and methods can be tagged via the `@Tag` annotation. Those tags can later
> be used to filter test discovery and execution."*

```java
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("fast")
@Tag("model")
class TaggingDemo {

    @Test
    @Tag("taxes")
    void testingTaxCalculation() {
    }

}
```

Three facts from the annotation's own declaration, each of which matters:

- **`@Target({TYPE, METHOD})`** — a class or a method, and nothing else. There is no
  package-level tag and no field-level tag.
- **`@Repeatable(Tags.class)`** — several tags on one element, as above. The container
  annotation `@Tags` exists for the reflective machinery; you never write it by hand.
- **`@Inherited`** — a tag on a superclass applies to a subclass. This is unlike the
  conditional annotations, which the guide explicitly says are *not* `@Inherited`
  ([07 · disabling and conditions](07-disabling-and-conditions.md)), so the two families
  behave differently in the same class hierarchy.

⚠️ **What the documentation does not spell out in one sentence is how a class-level tag
combines with a method-level tag during filtering.** The guide's own demo tags the class
`fast` and `model` and one method `taxes`, but no sentence in the guide or in the javadoc
states the propagation rule for the resulting test descriptors, and I am not going to
invent one. The safe practice: put the tag on the element you actually intend to select,
and verify a new tag dimension with one ConsoleLauncher run before a CI job depends on it
([06e](06e-tag-expressions-and-filtering.md)).

## The syntax rules, and the failure mode nobody expects

> *"Regardless how a tag is specified, the JUnit Platform enforces the following rules: A
> tag must not be `null` or blank. A stripped tag must not contain whitespace. A stripped
> tag must not contain ISO control characters. A stripped tag must not contain any of the
> following reserved characters."*

The reserved characters are `,` comma, `(` left parenthesis, `)` right parenthesis, `&`
ampersand, `|` vertical bar, and `!` exclamation point — the punctuation of the tag
expression grammar below, reserved so that a tag name can never be confused with an
operator.

> *"In the above context, 'stripped' means that leading and trailing whitespace characters
> have been removed using `java.lang.String.strip()`."*

And then the sentence that makes this a Gotcha rather than a footnote, from the `value`
element of the `@Tag` javadoc:

> *"Note: the tag will first be stripped. If the supplied tag is syntactically invalid
> after trimming, the error will be logged as a warning, and the invalid tag will be
> effectively ignored."*

**A warning, and the tag is dropped.** `@Tag("slow tests")` compiles, runs, and tags
nothing. `@Tag("integration,slow")` — the intuitive way to write two tags — is one
invalid tag, not two valid ones, and it is discarded. The test then quietly falls into
whatever your default run is, which on most projects means it runs in the fast lane it was
supposed to be excluded from, or never runs at all.

```java
@Tag("slow")                    // valid
@Tag("needs-docker")            // valid — hyphens are fine
@Tag("  slow  ")                // valid: stripped to "slow"
@Tag("slow tests")              // INVALID: whitespace after stripping — ignored
@Tag("integration,slow")        // INVALID: reserved ','    — ignored
@Tag("!slow")                   // INVALID: reserved '!'    — ignored
@Tag("")                        // INVALID: blank           — ignored
```

## A taxonomy that survives contact with a team

A tag is a raw string with no compile-time checking, so the failure mode of a large tag
vocabulary is a slow drift into `slow`, `Slow`, `slowtest` and `slow-test`, each selecting
a different quarter of the suite. Two defences, both cheap:

**Constants**, so the compiler at least catches a rename:

```java
public final class TestTags {
    public static final String SLOW = "slow";
    public static final String NEEDS_DOCKER = "needs-docker";
    private TestTags() {}
}

@Tag(TestTags.SLOW)
class OrderReconciliationTest { }
```

**Meta-annotations**, which is what the guide points you at, and which let the tag carry
other configuration along with it:

```java
@Target({ ElementType.TYPE, ElementType.METHOD })
@Retention(RetentionPolicy.RUNTIME)
@Tag("integration")
@Tag("needs-docker")
public @interface IntegrationTest {
}

@IntegrationTest
class OrderRepositoryIT { }
```

Now `@IntegrationTest` is a single, misspelling-proof, IDE-completable token, and adding a
third tag to the definition retags every test that uses it.

Keep the vocabulary **small and closed** — one or two dimensions, a handful of values
each. `slow` plus a per-feature tag covers nearly every real need. The dimension worth
having first is nothing to do with features: it is whatever separates "runs on every
commit in seconds" from "runs on the merge queue", because that is the split the build is
going to make anyway.

## Gotchas

**★ An invalid tag is a logged warning, not a build failure.**
`@Tag("slow tests")`, `@Tag("a,b")` and `@Tag("")` are stripped, found syntactically
invalid, warned about, and dropped. Nothing turns red. The test is then in the wrong lane
and stays there until somebody reads a build log.

**★ Writing two tags as one comma-separated string.**
`@Tag("integration,slow")` is the natural guess and is invalid on the reserved-character
rule. `@Tag` is `@Repeatable` — write it twice.

**★ Assuming a tag can contain a space because a display name can.**
Display names are prose and may contain anything, including emoji. Tags are grammar
tokens: no whitespace after stripping, no ISO control characters, none of `,()&|!`.

**★ `@Tag` is `@Inherited` and the conditional annotations are not.**
Move a test into a subclass of a `@Tag("slow")` base class and it becomes slow; move it
into a subclass of a `@Disabled` base class and it becomes enabled. Two annotation
families, two inheritance rules, in the same file.

**★ A tag vocabulary nobody wrote down.**
Tags are strings; strings drift. Constants or a meta-annotation are the only durable
answer, and the meta-annotation is the better one because it can carry `@ExtendWith`,
`@Timeout` and `@Tag` in one token.

**★ Using tags to encode ordering or dependency between tests.**
`@Tag("step1")` is a tag expression away from being a suite that runs in one order in
Maven and another in the IDE. Tags select; they do not sequence
([11 · execution order](11-execution-order.md)).

## Interview questions

**★ Whose concept is a tag — Jupiter's or the Platform's?**
The Platform's. The guide states it plainly: tags are a Platform concept for marking and
filtering, and each testing framework defines its own programming model for attaching
them. Jupiter contributes `@Tag`; the Vintage engine maps JUnit 4's `@Category` onto the
same `TestTag` type; the filter written in the build file applies to both.

**★ What happens if you write `@Tag("slow tests")`?**
Nothing visible. The tag is stripped, found to contain whitespace, reported as a warning
in the log, and ignored. The test carries no tag and is selected or excluded accordingly —
the failure is silent by design, which is precisely why it deserves a code-review rule.

**★ How do you stop a tag vocabulary from rotting?**
Never write the literal twice. Either a `String` constant or, better, a meta-annotation
such as `@IntegrationTest` that carries the tags and any other configuration those tests
need. Then the vocabulary is a type, the IDE completes it, and adding a tag to the whole
category is a one-line change.

**★ Is `@Tag` inherited?**
Yes — the annotation is meta-annotated `@Inherited`, so a tag on a superclass applies to
its subclasses. This is worth stating explicitly in an interview because the conditional
annotations in `org.junit.jupiter.api.condition` are documented as *not* inherited, and
the asymmetry surprises people.

{/* FOOTER */}