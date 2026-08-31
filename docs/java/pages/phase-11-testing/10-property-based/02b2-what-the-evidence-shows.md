---
title: "Reading the published jqwik jars shows they touch only public JUnit Platform API and none of the symbols JUnit 6.0 removed — which is meaningful evidence and is still not proof that the engine runs, and the difference between those two statements is the whole point of this page"
sidebar_label: "02b2 · What the evidence shows"
sidebar_position: 5
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 by extracting `net.jqwik:jqwik-engine:1.10.1` and
> `net.jqwik:jqwik-api:1.10.1` from **Maven Central**
> ([repo1.maven.org](https://repo1.maven.org/maven2/net/jqwik/jqwik-engine/1.10.1/)) and
> reading their class constant pools and `META-INF/services` entries; against the **JUnit
> 6.0.3 release notes** ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/)) for
> the list of removed APIs; against the **JUnit Platform 6.0.3 javadocs** for `@Testable`,
> `Try` and `ExecutionRequest`; and against the **Spring Framework 7.0 release notes**
> ([github.com/spring-projects](https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-7.0-Release-Notes))
> for the JUnit 6 baseline.
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> 🔴 **No sandbox, no build, no JVM and no test run on this machine.** Everything below is
> static inspection of published artifacts and official release notes. The page is explicit
> about the boundary between what that establishes and what it does not.

**[02b](02b-the-version-collision.md) established the collision: jqwik 1.10.1 declares JUnit
Platform 1.14.4, Boot 4.1 resolves 6.0.3, and the maintainer has said 1.10 is probably the
last release on the `1.x` line. The natural next question is "so does it work?" — and the
answer available without a JVM is *partial*, which is a much more useful answer than a
confident one in either direction. What the published artifacts do establish is set out
first; what they cannot establish is set out second, in equal detail, because a team making
this decision needs both halves and will only ever be given the first.**

## What I could verify, and what I could not

Being honest about the boundary here matters more than sounding confident.

**Verified — jqwik touches only public Platform API that JUnit 6.0 kept.** Extracting
`jqwik-engine-1.10.1.jar` and `jqwik-api-1.10.1.jar` and reading the class constant pools,
the *only* `org.junit.platform` types referenced are in these packages:

| Package | Types referenced |
|---|---|
| `org.junit.platform.commons.annotation` | `Testable` |
| `org.junit.platform.commons.function` | `Try` |
| `org.junit.platform.commons.support` | `AnnotationSupport`, `ClassSupport`, `HierarchyTraversalMode`, `ModifierSupport`, `ReflectionSupport` |
| `org.junit.platform.engine` | `TestEngine`, `TestDescriptor`, `ExecutionRequest`, `EngineDiscoveryRequest`, `EngineExecutionListener`, `EngineDiscoveryListener`, `ConfigurationParameters`, `UniqueId`, `TestExecutionResult`, `TestSource`, `TestTag`, `Filter`, `DiscoveryFilter`, `DiscoverySelector`, `SelectorResolutionResult` |
| `org.junit.platform.engine.discovery` | `ClassSelector`, `MethodSelector`, `PackageSelector`, `ModuleSelector`, `UniqueIdSelector`, `ClasspathRootSelector`, `ClassNameFilter`, `PackageNameFilter` |
| `org.junit.platform.engine.support.*` | `AbstractTestDescriptor`, `EngineDescriptor`, `ClassSource`, `MethodSource`, `PrefixedConfigurationParameters`, `Node`, `Node.SkipResult`, `ThrowableCollector` |
| `org.junit.platform.engine.reporting` | `ReportEntry` |

Nothing from `org.junit.platform.commons.util` — the internal package — appears at all.

**Verified — none of JUnit 6.0's named removals appears in those jars.** The 6.0.3 release
notes list, among the removals: `ReflectionSupport.loadClass(String)`,
`ReflectionUtils.readFieldValue(…)`, `ReflectionUtils.getMethod(…)`, `BlacklistedExceptions`,
`org.junit.platform.commons.util.PreconditionViolationException`, `ClasspathScanningSupport`,
`ConfigurationParameters.size()`, `MethodSelector.getMethodParameterTypes()`, the
`ReportEntry()` constructor, `SingleTestExecutor`, `LegacyReportingUtils`, and the
`junit-platform-runner`, `junit-platform-jfr` and `junit-platform-suite-commons` modules.
None of those names occurs in either jar. Spot-checking the survivors in the 6.0.3 javadocs:
`@Testable` is present and `@API(status = STABLE, since = "1.0")`; `Try` is present and
`@API(status = MAINTAINED, since = "1.4")`; and `ExecutionRequest.getRootTestDescriptor()`,
`getEngineExecutionListener()` and `getConfigurationParameters()` all still exist and are not
deprecated.

**Verified — the bytecode level is not a problem.** `net/jqwik/engine/JqwikTestEngine.class`
carries class file major version 52 (Java 8); the jar's root `module-info.class` is major
version 53 (Java 9). JDK 25 loads both. JUnit 6's Java 17 baseline raises the *floor*, not a
ceiling, so nothing there excludes a Java 8 -targeted engine.

**🔴 NOT verified — that it actually runs.** There is no sandbox on this machine, and no
amount of constant-pool reading substitutes for starting a JVM. Three specific things the
evidence above cannot settle:

1. The release notes' removal list is a summary, not a machine-checked API diff. A method
   signature change that is source-compatible but binary-incompatible would not appear in it.
2. Behavioural changes are invisible in a constant pool. If the 6.0 `Launcher` calls
   `TestEngine.discover` under new expectations, or if `Node`/`ThrowableCollector` semantics
   moved, jqwik would link fine and misbehave.
3. jqwik's own test suite has never been run against Platform 6, by the maintainer's own
   statement.

**Therefore: treat "jqwik 1.10.1 on JUnit Platform 6.0.3" as unproven until your own build
proves it, and make that proof the first commit of the spike** — the exact shape of that
proof is in [02c](02c-what-to-do-about-it.md). Do not let a review conversation record this
page as "it works". It records as "the published artifacts do not contain a known
incompatibility, and nobody has run it".

## Why you cannot simply downgrade JUnit

The reflex fix — pin `org.junit:junit-bom` to `5.14.4` so that Platform resolves to `1.14.4`
— is worth understanding rather than trying, because it is closed off from above. The Spring
Framework 7.0 release notes list, among the baseline upgrades for 7.0, **JUnit 6**; the same
document deprecates JUnit 4 support in the TestContext framework in favour of
`SpringExtension`. Boot 4.1 sits on Framework 7.0.8. So downgrading Jupiter to satisfy jqwik
means downgrading below Spring's own supported baseline for its test support — which trades a
question mark for a certainty. The viable options all involve *separating* the two worlds
rather than reconciling them, and that is the next chunk.

## Where this connects

- The collision that made this question necessary is
  [02b · The version collision](02b-the-version-collision.md).
- The four things a team can do, including the spike this page keeps demanding, are
  [02c · What to do about it](02c-what-to-do-about-it.md).
- Why jqwik depends directly on Platform SPI artifacts at all is
  [02 · An engine, not an extension](02-the-stack-problem.md).

## Gotchas

**★ "No known incompatibility" and "compatible" are different claims, and conflating them is how a spike gets skipped.**
Everything on this page is the first claim. Constant-pool inspection proves that the classes
jqwik links against still exist by name; it says nothing about whether their behaviour, their
calling contract or the launcher's expectations of an engine changed. A team that reads this
page as "verified working" and skips the five-minute spike has converted a documented
uncertainty into an undocumented assumption, which is strictly worse than where they started.

**★ Static reference analysis cannot see reflection, and a test engine is full of reflection.**
jqwik references `ReflectionSupport`, `AnnotationSupport` and `ModifierSupport` — the
Platform's reflective helpers — and does its own reflection through
`net.jqwik.engine.support.JqwikReflectionSupport`. Reflective calls resolve by name at
runtime, so a removed or renamed target does not appear in a constant pool as a broken link;
it appears as a runtime failure. Any argument of the form "the symbols are all present,
therefore it links" is bounded by that, and the boundary is exactly where a test engine does
most of its work.

**★ The removals list in a release note is a human summary, not a machine-generated API diff.**
The JUnit 6.0.3 notes list removals under headings, in prose, aimed at users migrating their
own tests — not at maintainers of third-party engines. A signature whose type bounds changed
(the notes mention exactly that for `ConfigurationParameters.get` and
`NamespacedHierarchicalStore.getOrComputeIfAbsent`) is source-compatible and can still be
binary-incompatible. If you want certainty rather than evidence, the tool is a bytecode
compatibility checker run over the two Platform versions, or simply running the tests.

**★ A `NoSuchMethodError` from a test engine looks like a corrupt build, not a compatibility problem.**
If jqwik does break on Platform 6, the failure will not say "jqwik is incompatible". It will
say `java.lang.NoSuchMethodError` naming an `org.junit.platform` symbol, thrown from inside
the launcher during discovery, with a stack trace containing no jqwik frames you recognise.
Teams routinely respond by deleting `~/.m2`, which does nothing. The diagnostic is
`mvn dependency:tree -Dincludes=org.junit.platform` — if it prints `6.0.3` while jqwik's POM
asks for `1.14.4`, you have your answer in one line.

**★ jqwik targets Java 8 bytecode today and the maintainer's stated next step is Java 21 — those are the two ends of a range you should not assume is contiguous.**
`jqwik-engine`'s classes are class file version 52. The announced future is *"JUnit Platform 6
and thus Java >= 21"*. Nothing has been published in between. Planning a migration path on the
assumption that a Platform-6 jqwik will arrive, and arrive soon, is planning on a sentence
that contains the words *"if ever realised"*.

## Interview questions

**★ You are told "the jars only reference APIs that still exist, so it will work." Push back on that.**
Three gaps. First, existence by name is not compatibility: a method whose parameter type
changed, or whose declaring interface gained an abstract method, keeps its name and breaks at
link time or class-load time. Second, engines are reflection-heavy — jqwik goes through
`ReflectionSupport` and its own reflective helpers — and reflective targets never appear in a
constant pool, so the whole reflective surface is outside what the analysis covered. Third,
and most simply, none of this addresses behaviour: the Platform's launcher could call
`discover` and `execute` under different expectations in 6.0 and jqwik would link perfectly
and produce wrong results, including the worst outcome, silently discovering nothing. The
evidence raises the prior that it works. It does not close the question, and the thing that
closes it costs five minutes.

**★ Design the smallest experiment that would actually settle this.**
One test module, one property that asserts something false, and one CI run. Concretely: add
`net.jqwik:jqwik:1.10.1` to the test scope of an otherwise unmodified Boot 4.1 project, add a
class whose *file name* matches the runner's include pattern (`SmokeTests`, not
`SmokeProperties` — Surefire's defaults will silently skip the latter), put a single
`@Property void alwaysFails(@ForAll int i) { assertThat(i).isEqualTo(4711); }` in it, and run
the build. Three outcomes and each is informative: red with a jqwik report block naming a
shrunk sample means the engine discovered, executed, falsified and shrank — every code path
that matters. An exception during discovery names the incompatibility directly. Green is the
dangerous outcome and means the property never ran, which you then chase through include
patterns, `includeEngines` filters, and engine presence on the runtime classpath, in that
order.

**★ Why can't you just pin JUnit back to 5.14.4 and be done with it?**
Because Spring is above you in the stack, not below. The Spring Framework 7.0 release notes
list JUnit 6 among the baseline upgrades for 7.0, and Boot 4.1 is built on Framework 7.0.8;
downgrading `org.junit:junit-bom` to `5.14.4` puts every Spring test — slices, `MockMvcTester`,
`@MockitoBean`, the TestContext framework — onto a JUnit version Spring no longer supports.
You would be trading an unverified risk in one test library for a documented
unsupported-configuration across your entire test suite. The workable answers all separate
the two rather than reconciling them: run jqwik in a module that does not import Boot's BOM,
or use jqwik only as a generator library from inside Jupiter.

**★ What is the difference between this problem and an ordinary transitive-dependency conflict, and why does that difference matter?**
An ordinary conflict is between two libraries that both want version X or Y of a third, and
the resolution is an exclusion, a pin, or an upgrade of whichever library is behind. Here the
"third library" is the SPI that defines what a test engine *is*, one side of the conflict is
your framework's mandated baseline, and the library that is behind has announced it may not
catch up. There is no version of jqwik that resolves it and there is no version of Spring
that resolves it. That is why the answers are all architectural — separate the module,
separate the classpath, or use the library without its engine — rather than a line in a
`dependencyManagement` block. Recognising a conflict as unresolvable-by-pinning early saves a
day of trying pins.

{/* FOOTER */}
