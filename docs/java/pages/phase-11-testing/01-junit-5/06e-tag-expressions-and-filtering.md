---
title: "A tag expression is a small boolean grammar evaluated by the Launcher after discovery, which is why an excluded test does not appear in the report at all and why every tag you exclude needs a job somewhere that includes it"
sidebar_label: "06e · Tag expressions and filtering"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Tags"
> ([running-tests/tags](https://docs.junit.org/6.0.3/running-tests/tags.html)),
> "Tagging and Filtering"
> ([tagging-and-filtering](https://docs.junit.org/6.0.3/writing-tests/tagging-and-filtering.html)),
> "Build Support" ([build-support](https://docs.junit.org/6.0.3/running-tests/build-support.html)),
> "Console Launcher"
> ([console-launcher](https://docs.junit.org/6.0.3/running-tests/console-launcher.html)) and
> "Disabling Tests"
> ([disabling-tests](https://docs.junit.org/6.0.3/writing-tests/disabling-tests.html));
> javadoc for `TagFilter`
> ([TagFilter](https://docs.junit.org/6.0.3/api/org.junit.platform.launcher/org/junit/platform/launcher/TagFilter.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**[06d](06d-tagging.md) put the labels on. This chunk is what reads them: a three-operator
boolean grammar, the three places a real project writes it down, and the one behavioural
difference that decides when you tag a test instead of disabling it — a filtered test is
removed from the plan before execution starts, so it is not reported at all.**

## Tag expressions

> *"Tag expressions are boolean expressions with the operators `!`, `&` and `|`. In
> addition, `(` and `)` can be used to adjust for operator precedence."*

> *"Two special expressions are supported, `any()` and `none()`, which select all tests
> with any tags at all, and all tests without any tags, respectively. These special
> expressions may be combined with other expressions just like normal tags."*

Operators, in the guide's stated descending order of precedence:

- `!` — not — **right**-associative
- `&` — and — **left**-associative
- `|` — or — **left**-associative

Which means `a | b & c` parses as `a | (b & c)`, and `!a & b` parses as `(!a) & b`. If you
have to think about it for more than a second, put the parentheses in.

The guide's worked taxonomy — tagging by test type (`micro`, `integration`, `end-to-end`)
and by feature (`product`, `catalog`, `shipping`) — gives these selections verbatim:

- `product` — *"all tests for product"*
- `catalog | shipping` — *"all tests for catalog plus all tests for shipping"*
- `catalog & shipping` — *"all tests for the intersection between catalog and shipping"*
- `product & !end-to-end` — *"all tests for product, but not the end-to-end tests"*
- `(micro | integration) & (product | shipping)` — *"all micro or integration tests for
  product or shipping"*

`none()` is the one people miss. Given a convention where every slow test is tagged and
nothing else is, `none()` is exactly "the fast suite" and stays correct as tags are added.

## Where the filter actually lives

**Maven Surefire / Failsafe** — the guide names the two properties:

> *"to include tags or tag expressions, use `groups`. to exclude tags or tag expressions,
> use `excludedGroups`."*

```xml
<plugin>
  <artifactId>maven-surefire-plugin</artifactId>
  <version>3.5.4</version>
  <configuration>
    <groups>acceptance | !feature-a</groups>
    <excludedGroups>integration, regression</excludedGroups>
  </configuration>
</plugin>
```

⚠️ The guide shows the comma form in `excludedGroups` but **does not state what the comma
means** there. I could not confirm from JUnit's documentation whether Surefire combines
comma-separated expressions with OR or with AND. Write one explicit expression —
`<excludedGroups>integration | regression</excludedGroups>` — and the question does not
arise.

**Gradle** — inside the test task:

```groovy
test {
    useJUnitPlatform {
        includeTags("fast", "smoke & feature-a")
        // excludeTags("slow", "ci")
    }
}
```

**ConsoleLauncher**, where the semantics of repetition *are* documented:

> *"`-t, --include-tag=TAG` Provide a tag or tag expression to include only tests whose
> tags match. When this option is repeated, all patterns will be combined using OR
> semantics."*

`-T` / `--exclude-tag` is the mirror image. Note the wording: *include only **tests**
whose tags match*.

## Filtering is not disabling

`TagFilter` is documented as a factory for *post-discovery* filters:

> *"Factory methods for creating `PostDiscoveryFilter`s based on included and excluded
> tags or tag expressions."*

A filtered-out test is removed from the test plan **before execution begins**. It is not
reported as skipped, it does not appear in the XML report, and none of its lifecycle
callbacks run. That is the exact opposite of `@Disabled`, which the guide says still
instantiates the class and still runs `@BeforeAll`
([03 · the lifecycle](03-the-lifecycle.md)). When you want "this test exists but is not
part of today's run", tag it. When you want "this test is broken", `@Disabled` it with a
reason.

⚠️ How a class-level tag combines with a method-level tag during filtering is **not**
stated in one sentence anywhere in the guide or the javadoc — see the warning in
[06d](06d-tagging.md). Verify a new tag dimension with one ConsoleLauncher run before a CI
job depends on it.

## A suite is the fourth place a tag expression can live

The filter does not have to live in the build tool. `junit-platform-suite` lets a suite
class carry it, which is useful when you want the selection under version control next to
the tests rather than in a POM:

```java
import org.junit.platform.suite.api.ExcludeTags;
import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;

@Suite
@SelectPackages("com.example.orders")
@ExcludeTags("slow")
class FastOrderTests {
}
```

`@IncludeTags` and `@ExcludeTags` are documented in exactly the same terms as the build
plugins — *"specifies the tags or tag expressions to be included when running a test suite
on the JUnit Platform"* — with the same three operators and the same syntax rules. Both
are `@Inherited` and both target types only.

⚠️ A `@Suite` class is itself discovered by the suite engine, so a suite that selects the
same packages your normal run selects will execute those tests **twice** unless the plain
engine run excludes suites or the suite selects a package the default run does not. Suites
are a selection mechanism, not a grouping mechanism; reach for them when the alternative is
a second Surefire execution block.

## Gotchas

**★ Excluding a tag in CI and forgetting to include it anywhere else.**
`excludedGroups=slow` on the only build that runs means the slow tests have not executed
since the day the line was added. Every exclusion needs a corresponding job that includes
it; the honest test of a tagging scheme is whether every tag is selected by some run.

**★ Relying on operator precedence rather than parentheses.**
`fast | integration & !windows` is `fast | (integration & !windows)`, which is probably not
the set you had in mind. `!` binds tightest and is right-associative; `&` beats `|`.

**★ A `!` inside double quotes in a shell.**
`--include-tag "!slow"` runs into history expansion in an interactive bash. Single-quote
tag expressions on the command line, or set them in the build file where no shell sees
them.

**★ Tagging a test and expecting the report to show it as skipped when excluded.**
A tag filter is a post-discovery filter: the test is gone from the plan, not skipped
within it. If you need "visibly not run today", `@Disabled("…")` shows up in the report;
an exclusion does not.

**★ Running in the IDE and expecting the build file's tag filter to apply.**
`groups`, `excludedGroups` and `useJUnitPlatform { … }` are Surefire and Gradle
configuration. Pressing "run" on a test class in an IDE launches the Platform directly and
none of that is read, so a test excluded on CI runs locally — and a test that only ever
runs locally is a test nobody notices breaking. IDEs expose tag filters in the run
configuration; the two have to be set separately.

**★ Assuming an empty selection is an error.**
A tag expression that matches nothing produces a run with zero tests. Some build setups
treat that as success. If a tag lane must not silently empty itself, configure the build to
fail on no tests — Surefire has `failIfNoSpecifiedTests` for explicitly selected tests, and
the ConsoleLauncher exits non-zero when no tests are found; verify the behaviour of your
own runner rather than assuming.

**★ Putting the tag expression in one build file and the tag in another module.**
Tags are matched by string across the whole engine run. A tag defined by a meta-annotation
in module A and excluded in module B's POM works — right up to the moment module B stops
depending on module A's test-fixtures jar and the annotation quietly disappears.

## Interview questions

**★ State the tag expression grammar.**
Boolean expressions over tag names with `!` (not, right-associative, highest precedence),
`&` (and, left-associative), `|` (or, left-associative, lowest), plus parentheses.
`any()` selects every test that has any tag at all, `none()` every test with no tags.

**★ Write the expression for "micro and integration tests for product or shipping".**
`(micro | integration) & (product | shipping)`. It is the guide's own example, and it is
the one worth memorising because it shows both places parentheses are needed.

**★ What is the difference between excluding a test by tag and disabling it?**
Exclusion is a post-discovery filter — the test never enters the executing test plan, is
never reported, and none of its lifecycle callbacks run. `@Disabled` is evaluated during
execution: the test is reported as skipped, the class is still instantiated, and
`@BeforeAll` and `@AfterAll` still run.

**★ Where can a tag expression be written?**
Four places: Surefire/Failsafe's `groups` and `excludedGroups`, Gradle's `includeTags` /
`excludeTags` inside `useJUnitPlatform`, the ConsoleLauncher's `-t` / `-T`, and
`@IncludeTags` / `@ExcludeTags` on a `@Suite` class. All four feed the same
`PostDiscoveryFilter` machinery, so the grammar is identical in all four.

**★ What does `none()` select, and why is it the useful one?**
Every test with no tags at all. If the convention is that anything slow or environment-
dependent carries a tag, then `none()` is a definition of "the fast suite" that keeps
working as new tags are invented — unlike `!slow & !integration & !needs-docker`, which has
to be edited every time somebody adds a category.

{/* FOOTER */}
