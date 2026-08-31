---
title: "jqwik is a separate JUnit Platform TestEngine rather than a Jupiter extension, it is built against JUnit Platform 1.14.4, and Spring Boot 4.1 puts JUnit Platform 6.0.3 on your classpath — so the first decision in this topic is not how to write a property but whether the engine will start at all"
sidebar_label: "02 · An engine, not an extension"
sidebar_position: 3
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, *How to Use*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); the **jqwik 1.10.1 release
> notes** on GitHub
> ([github.com/jqwik-team/jqwik](https://github.com/jqwik-team/jqwik/releases/tag/1.10.1));
> the published POMs and JARs of `net.jqwik:jqwik-engine:1.10.1` and
> `net.jqwik:jqwik-api:1.10.1` on **Maven Central**
> ([repo1.maven.org](https://repo1.maven.org/maven2/net/jqwik/jqwik-engine/1.10.1/));
> the **JUnit 6.0.3 release notes** ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/))
> and the **Upgrading to JUnit 6.0** wiki
> ([github.com/junit-team](https://github.com/junit-team/junit-framework/wiki/Upgrading-to-JUnit-6.0));
> the **Spring Framework 7.0 release notes**
> ([github.com/spring-projects](https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-7.0-Release-Notes));
> and `spring-boot-dependencies:4.1.0`'s own POM.
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox, no build and no test run on this machine.** The evidence below is
> published POMs, published JAR contents and official release notes. Where that evidence
> cannot settle a question, this page says so instead of guessing.

**Almost everything else in this topic assumes you can run a jqwik property, and on the stack
this phase pins that assumption is the one most likely to fail. The reason has nothing to do
with property-based testing. jqwik is not a Jupiter extension — it is a whole separate
`TestEngine` implementation registered through `ServiceLoader`, a peer of Jupiter rather than
a plug-in inside it. This chunk establishes that one fact from the published artifact and
draws out the four consequences that catch people; the version collision it causes with
Spring Boot 4.1 is [02b](02b-the-version-collision.md), and what to do about it is
[02c](02c-what-to-do-about-it.md).**

## What "a separate engine" means, mechanically

The JUnit Platform is a launcher plus a service-provider interface. A `TestEngine` discovers
tests and executes them; the `Launcher` finds engines with `java.util.ServiceLoader` and asks
each one what it can run. Jupiter (`junit-jupiter-engine`) is one engine. Vintage is another.
jqwik is a third. The user guide says so in the first line of *How to Use*:

> *"jqwik is an alternative test engine for the JUnit 5 platform. That means that you can use
> it either stand-alone or combine it with any other JUnit 5 engine, e.g. Jupiter (the
> standard engine) or Vintage (aka JUnit 4)."*

That is not marketing language; it is verifiable in the artifact. `jqwik-engine-1.10.1.jar`
contains the file `META-INF/services/org.junit.platform.engine.TestEngine`, whose entire
content is:

```
net.jqwik.engine.JqwikTestEngine
```

Four consequences follow from that one fact, and they surprise people who assumed jqwik was
"a JUnit 5 annotation library":

- **Jupiter annotations do nothing inside a jqwik container.** `@Test`, `@BeforeEach`,
  `@AfterEach`, `@Nested`, `@ExtendWith`, `@ParameterizedTest` are concepts belonging to the
  Jupiter *engine*. jqwik's engine does not read them. It has its own vocabulary —
  `@Property`, `@Example`, `@Group`, `@BeforeTry`, `@BeforeProperty` — covered in
  [03b · The jqwik lifecycle](03b-the-jqwik-lifecycle.md). A `@BeforeEach` method in a jqwik
  test class is not "ignored with a warning". It is invisible.
- **Assertion libraries still work, because they are just static methods.** AssertJ, Hamcrest
  and even `org.junit.jupiter.api.Assertions` are plain classes with no engine involvement.
  The guide is explicit: *"jqwik does not come with any assertions, so you have to use one of
  the third-party assertion libraries, e.g. Hamcrest or AssertJ. If you have Jupiter in your
  test dependencies anyway, you can also use the static methods in
  `org.junit.jupiter.api.Assertions`."*
- **`SpringExtension` cannot apply.** `@SpringBootTest`, `@WebMvcTest` and every slice in
  **topic 05 · The test pyramid** work through `@ExtendWith(SpringExtension.class)`, which is
  a Jupiter extension. There is no Spring context inside a jqwik property unless a separate
  integration module provides one. (`net.jqwik:jqwik-spring` exists and is not a live option
  on this stack — see [02b](02c-what-to-do-about-it.md).)
- **Build tools have to be told the engine exists.** Gradle's `useJUnitPlatform` block takes
  `includeEngines`; the guide's own sample uses `includeEngines 'jqwik', 'junit-jupiter'`.
  Maven Surefire picks up every engine on the test classpath automatically, but only for
  classes whose *file names* match its include patterns — a separate trap covered in
  [02b](02c-what-to-do-about-it.md).

## What follows from this

The renumbering of the JUnit Platform in JUnit 6.0 turns "jqwik is an engine" from a design
note into a dependency-resolution problem, because an engine has a hard dependency on the
Platform's SPI artifacts while an extension would inherit whatever Jupiter uses. The four
primary-source facts that collide, the maintainer's stated position on JUnit 6, and a
careful account of what can and cannot be established without running anything, are in
[02b · The version collision](02b-the-version-collision.md).

## Where this connects

- The version collision this fact causes on Boot 4.1, with the evidence, is
  [02b · The version collision](02b-the-version-collision.md).
- What to actually do about all this — four options, with build files, and how to prove the
  engine started — is [02b · What a team on Boot 4.1 can do](02c-what-to-do-about-it.md).
- The annotations jqwik brings instead of Jupiter's are
  [03 · Writing a property](03-a-property.md) and
  [03b · The jqwik lifecycle](03b-the-jqwik-lifecycle.md).
- The JUnit Platform, engines, the launcher and Jupiter's own extension model belong to
  [01 · JUnit 5](../01-junit-5/README.md); the Spring slices that `SpringExtension` powers
  belong to [05 · The test pyramid](../05-the-test-pyramid/README.md).
- Configuration through `junit-platform.properties`, which jqwik reuses for all its own
  settings, appears in [07 · Reproducibility](07-reproducibility.md).

## Gotchas

**★ "It's a JUnit 5 library" is the sentence that causes this whole problem, and it is wrong in a way that matters.**
jqwik is a JUnit *Platform* library. Jupiter is also a JUnit Platform library. They are peers,
not host and plugin. Everything that feels surprising downstream — that `@BeforeEach` does
nothing, that Spring slices are unavailable, that Gradle needs `includeEngines`, that a BOM
managing "JUnit" changes jqwik's transitive dependencies — is the same fact restated. If you
carry one sentence out of this page, carry *engine, not extension*.

**★ Silence is a plausible failure mode, and it is worse than an exception.**
The Platform's launcher tolerates engines that discover nothing. If jqwik's discovery path
fails softly under Platform 6 — or, far more commonly, if Surefire's filename patterns never
hand it any classes — the build is **green with zero properties executed**. A green build that
ran none of your property tests is indistinguishable from a green build that ran all of them
unless somebody checks the counts. Never adopt this without a deliberately-failing property
proving the engine is live, which is the first thing [02b](02c-what-to-do-about-it.md) shows.

**★ `net.jqwik:jqwik` is an aggregator, and knowing that changes what you exclude.**
The `jqwik` artifact has no code. Its POM pulls `jqwik-api`, `jqwik-web` and `jqwik-time` at
compile scope and `jqwik-engine` at runtime scope. That matters twice: the *engine* is a
runtime dependency, so nothing in your test source references it and an IDE that prunes
"unused" dependencies can quietly remove the thing that runs your tests; and if you want the
generator API without the engine — option 4 in the next chunk — you depend on `jqwik-api`
alone, which does not register a `TestEngine`.

**★ Two engines on one classpath means two reporting conventions, and jqwik's does not go through the platform by default.**
Gradle does not yet support JUnit Platform reporting for this purpose, so — in the guide's
words — *"jqwik has switched to do its own reporting by default. This behaviour can be
configured through parameter `jqwik.reporting.usejunitplatform` (default: false)."* The
practical effect is that jqwik's per-property report block (tries, checks, seed, edge-case
counts) is written to stdout rather than published as platform report entries, so under
Gradle you need `--info` to see it and your CI report generator will not contain it. If you
want the seed in a machine-readable place, set `jqwik.reporting.usejunitplatform = true`
deliberately.

**★ An engine cannot be added by `@ExtendWith`, so there is no way to make one test class use jqwik and the rest use Jupiter within a single class.**
The unit of engine ownership is the class: whichever engine's discovery claims a class, runs
it. A class containing both `@Test` and `@Property` methods is claimed by both engines and
each runs only the methods it understands, which produces a test report where the class
appears twice with different children. That is confusing rather than broken, but it is a
strong argument for keeping property classes in their own files with their own naming
convention.

## Interview questions

**★ Explain the difference between a JUnit Platform engine and a Jupiter extension, and give a consequence of each.**
The Platform defines a `TestEngine` SPI; an engine is discovered by `ServiceLoader`, owns
discovery and execution of a whole family of tests, and defines its own annotations. Jupiter
is one such engine, and *within* Jupiter there is a second, narrower plug-in point — the
`Extension` API, used by `@ExtendWith`, which lets you hook Jupiter's lifecycle without
replacing it. `SpringExtension` is an extension: it works because Jupiter is running.
jqwik is an engine: it runs alongside Jupiter, not inside it. The consequences are direct —
an extension can give you a Spring context in a `@Test`, and cannot give you a new test
annotation with its own lifecycle; an engine can give you `@Property` with per-try hooks, and
cannot see `@ExtendWith` at all. That is why there is no such thing as "just add
`@SpringBootTest` to a jqwik property".

**★ A jqwik property class is on the classpath, the build is green, and the property is one you wrote to fail on purpose. What are the candidate explanations, in order?**
First: the class name does not match the runner's include pattern. Maven Surefire's defaults
are `**/Test*.java`, `**/*Test.java`, `**/*Tests.java`, `**/*TestCase.java`, so a class called
`BillProperties` is never handed to any engine — the most common cause by a wide margin, and
it looks exactly like "jqwik doesn't work". Second: the engine was filtered out — Gradle's
`useJUnitPlatform { includeEngines 'junit-jupiter' }` excludes every other engine, silently.
Third: `jqwik-engine` is not on the runtime classpath at all, because someone depended on
`jqwik-api` alone, or an IDE pruned the runtime-scoped aggregate. Only after those three would
I start suspecting a Platform 6 incompatibility, and I would confirm it by resolving the
Platform version rather than by guessing.

**★ You need a Spring bean inside a property — say a `PriceCalculator` wired with three collaborators. What are your options and which do you pick?**
There is no `SpringExtension` available, because that is a Jupiter extension and jqwik is not
Jupiter, so the honest first answer is: do not. A property wants a pure function; if the thing
you want to test needs a Spring context to be constructed, that is a signal the logic worth
propertising is buried inside a bean and should be extracted to a plain class with
constructor arguments. The extraction is the fix, and it is a good change independent of
testing. If you genuinely cannot extract — the calculation legitimately needs a repository —
the second answer is to build the object graph by hand inside the property (`new
PriceCalculator(new InMemoryRateStore(rates), ...)`), which is fast and gives you a
deterministic collaborator. The third answer, `net.jqwik:jqwik-spring`, is not available on
this stack; the reasons are in [02c](02c-what-to-do-about-it.md). What I would not do is
reach for `@MockitoBean` — bean overrides are a Spring TestContext feature and there is no
TestContext here.

{/* FOOTER */}
