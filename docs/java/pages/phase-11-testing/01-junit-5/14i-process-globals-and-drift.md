---
title: "System properties, environment variables and the machine's own locale are process-wide globals your test shares with every other test in the fork, and the last family of flakes is what happens when the machine underneath changes — a different core count, a different JDK, a different CLDR release that moved a space character"
sidebar_label: "14i · Process globals and drift"
sidebar_position: 58
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against javadoc for `java.lang.System`
> ([System](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/System.html))
> and `java.lang.Runtime`
> ([Runtime](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Runtime.html));
> the JUnit 6.0.3 javadoc for `Resources`
> ([Resources](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/parallel/Resources.html));
> the JUnit **6.1.0** User Guide — "Built-in Extensions"
> ([6.1.0/built-in-extensions](https://docs.junit.org/6.1.0/writing-tests/built-in-extensions.html))
> compared against the 6.0.3 page
> ([6.0.3/built-in-extensions](https://docs.junit.org/6.0.3/writing-tests/built-in-extensions.html));
> the OpenJDK quality outreach note on CLDR 42
> ([inside.java](https://inside.java/2024/03/29/quality-heads-up/)) and the Oracle JDK 23 release
> notes ([23all-relnotes](https://www.oracle.com/java/technologies/javase/23all-relnotes.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**Every item in this chunk is shared by the whole JVM process, or supplied by the machine the
process happens to be running on. A test that writes one is writing a global; a test that reads
one has an input it never declared.** The filesystem is [14d](14d-environment.md), ports and the
database are [14h](14h-ports-network-and-the-database.md), the *code-level* clock and locale
problems are [14b](14b-time-and-determinism.md), and what changes when the machine or the versions
underneath change is [14j](14j-ci-and-version-drift.md).

## System properties

`System.setProperty` mutates a `Properties` object shared by everything in the fork. Two things go
wrong, and they are independent.

**It races.** Under parallel execution another test can read your value, or overwrite it between
your write and your read ([12e](12e-shared-state-under-parallelism.md)). Jupiter ships a
resource name for exactly this — `Resources.SYSTEM_PROPERTIES`, whose value is the string
`"java.lang.System.properties"` — so `@ResourceLock(Resources.SYSTEM_PROPERTIES)`
([12c](12c-resource-locks.md)) is the containment.

**It may not take effect at all.** The `System.getProperties()` apiNote, which most people have
never read:

> *"Changing a standard system property may have unpredictable results unless otherwise
> specified. Property values may be cached during initialization or on first use. Setting a
> standard property after initialization using `getProperties()`, `setProperties(Properties)`,
> `setProperty(String, String)`, or `clearProperty(String)` may not have the desired effect."*

That single paragraph invalidates a whole genre of test setup:
`System.setProperty("user.timezone", "UTC")` in a `@BeforeAll`, `line.separator`,
`file.encoding`, `user.language`. Those are read during JVM initialisation; setting them later
changes the map and nothing else. **Set them on the command line, in the build's test
configuration, where they are honoured — not in test code.**

### 🔴 The JUnit 6.0 / 6.1 gap you will actually hit

JUnit **6.1.0** shipped built-in extensions for this. The user guide:

> *"The `@ClearSystemProperty` and `@SetSystemProperty` annotations can be used to clear and set,
> respectively, the values of JVM system properties for test execution. Both annotations work on
> the test method and class level and are repeatable, combinable, and inherited from higher-level
> containers. After the annotated method has been executed, the properties configured in the
> annotation will be restored to their original value or the value of the higher-level container,
> or will be cleared if they did not previously have a value."*

with a companion for dynamic changes:

> *"`@RestoreSystemProperties` can be placed on test methods or test classes and will completely
> restore all system properties to their original state after the test or test class has
> finished."*

and — the part that matters most — the locking is done for you:

> *"Since system properties are global state, reading and writing them during parallel execution
> can lead to unpredictable results and flaky tests. The system property extension is prepared for
> that and tests annotated with `@ClearSystemProperty`, `@SetSystemProperty`, or
> `@RestoreSystemProperties` will never execute in parallel (thanks to resource locks) to
> guarantee correct test results."*

> *"However, this does not cover all possible cases. Tested code that reads or writes system
> properties independently of the extension can still run in parallel to it… Tests that cover code
> that reads or writes system properties need to be annotated with the respective annotation:
> `@ReadsSystemProperty` [or] `@WritesSystemProperty`."*

🔴 **None of that exists in 6.0.3, which is what `spring-boot-dependencies:4.1.0` manages.** The
6.0.3 built-in-extensions page has no system-property, locale or time-zone extension at all. On
this spine you either restore the property yourself in an `@AfterEach` *and* take the
`@ResourceLock` yourself, or you override the JUnit BOM to 6.1.x deliberately. Saying "just use
`@SetSystemProperty`" is the single most likely piece of stale advice you will be given on this
topic, because it is correct for the version one minor release ahead of yours.

JUnit 6.1.0 also added `@DefaultLocale` and `@DefaultTimeZone`, with the same
never-run-in-parallel guarantee and the same `@ReadsDefaultLocale` / `@WritesDefaultTimeZone`
family for code that touches the defaults independently. Same gap: not in 6.0.3.

⚠️ These extensions previously lived in JUnit Pioneer. As of 2026-08-28 **Pioneer's latest release
is 2.3.0 (October 2024), which targets JUnit 5**, and its issue tracker carries an open question
about when a JUnit-6-compatible 3.0 will ship. I could not find a released Pioneer version that
works on a JUnit 6 platform, so treat "add Pioneer" as unavailable on this stack until that
changes.

## Environment variables

There is no supported way to set one from inside the JVM. The `System.getenv()` javadoc:

> *"Returns an unmodifiable string map view of the current system environment."*

Libraries that appear to set environment variables do it by reflecting into the JDK's internal
`ProcessEnvironment` map, which strong encapsulation blocks on a modern JDK unless you add
`--add-opens` to the test JVM. That is a real, permanent cost paid to test a design decision you
could reverse instead.

**The design decision:** reading `System.getenv("PAYMENTS_URL")` deep inside a class makes the
environment an undeclared constructor parameter. Read it once at the edge and pass the value in,
or in Spring read it through `Environment` / `@ConfigurationProperties`, which a test overrides
with `@TestPropertySource` or `@SpringBootTest(properties = …)` — no reflection, no `--add-opens`,
no global mutation.

⚠️ `@EnabledIfEnvironmentVariable` ([07c](07c-environment-conditions.md)) is for *reacting* to the
environment, not for setting it — and a test skipped because a variable was missing is not a
passing test ([08](08-assumptions.md)).

## The machine's locale, time zone and clock

[14b](14b-time-and-determinism.md) argues the code-level fix: inject a `Clock`, pass a `Locale`,
never call `now()` without one. This is the other half — the machine supplies defaults, and the
machine differs.

A CI container typically runs with `TZ=UTC` and a C or POSIX locale; a laptop runs whatever the
developer's operating system was installed with. So the same code takes different branches on the
two, and the failure arrives on CI with no local reproduction. The pin is a *build* setting, not a
test setting, because of the initialisation caveat above:

```xml
<!-- Maven Surefire: the JVM sees these at startup, which is when they are read -->
<argLine>-Duser.timezone=UTC -Duser.language=en -Duser.country=US</argLine>
```

Pinning makes runs reproducible. It does **not** test the awkward cases — for that you still want
a parameterized test over several zones and locales ([14b](14b-time-and-determinism.md), and
[03 · Parameterized tests](../03-parameterized-tests/README.md)).

And pinning only holds the *configuration* still. It does not hold the machine still — core count,
contention and cold caches differ regardless — nor the versions, where a JDK upgrade can change
formatted output without changing a line of your code. That is
[14j](14j-ci-and-version-drift.md).

## Gotchas

**★ `System.setProperty` in a test with no restore.**
The next test in the fork inherits it, across classes, for the rest of the JVM's life. Restore in
`@AfterEach` — which runs even when the test fails — and take `@ResourceLock` for the window.

**★ `System.setProperty("user.timezone", …)` in `@BeforeAll`.**
Documented not to work: *"Property values may be cached during initialization or on first use.
Setting a standard property after initialization… may not have the desired effect."* Set it on the
JVM command line in the build configuration instead.

**★ Assuming `@SetSystemProperty` is available.**
It is a **JUnit 6.1.0** built-in extension. Boot 4.1.0 manages Jupiter **6.0.3**, whose built-in
extensions page has no such annotation. Either write the save/restore yourself or override the
JUnit BOM on purpose.

**★ Reaching for JUnit Pioneer to fill the gap.**
As of 2026-08-28 its latest release is 2.3.0 from October 2024, targeting JUnit 5, with a
JUnit-6-compatible 3.0 still an open question on its tracker. Verify compatibility before adding
it rather than after the platform fails to discover its extensions.

**★ Restoring a system property but not locking it.**
Restoration closes the window after your test; it does not stop a concurrent test reading the
mutated value inside the window. JUnit 6.1's own extension takes a resource lock for precisely
this reason — on 6.0.3 you take it yourself.

**★ Using a library that reflects into `ProcessEnvironment` to set an environment variable.**
It needs `--add-opens` on a modern JDK, so you are weakening the test JVM's encapsulation
permanently in order to avoid passing a value into a constructor.

**★ Reading `System.getenv` deep inside production code.**
It is an undeclared dependency that no test can set. Read it once at the edge and inject the
value; in Spring, read it through `Environment` so a test can override it as a property.

**★ Treating a skipped test as a passing one.**
`@EnabledIfEnvironmentVariable` on an integration test means the test silently does not run on
every machine missing that variable — usually CI, which is where you most wanted it
([07c](07c-environment-conditions.md), [08](08-assumptions.md)).

**★ Not pinning the time zone and locale in the build.**
The laptop is `Europe/London` and `en_GB`; the container is `UTC` and `C`. The same code takes
different branches, and the failure has no local reproduction. Pin them as JVM arguments, then
test the awkward cases deliberately with a parameterized test.

## Interview questions

**★ Why is setting a system property in a test worse than setting an instance field?**
Because it is process-global and unscoped. Every other test in the same JVM fork sees it, across
class boundaries, until something unsets it — so the failure lands on an unrelated test later in
the run. And unlike a field, restoring it in `@AfterEach` is necessary but not sufficient: under
parallel execution a concurrent test can read the mutated value inside the window before you
restore it, which is why JUnit's own system-property extension takes a resource lock rather than
just restoring.

**★ Someone tells you to use `@SetSystemProperty`. What do you check first?**
The version. `@ClearSystemProperty`, `@SetSystemProperty`, `@RestoreSystemProperties`,
`@DefaultLocale` and `@DefaultTimeZone` are built-in as of **JUnit 6.1.0**; Spring Boot 4.1.0
manages Jupiter **6.0.3**, whose built-in-extensions documentation has none of them. The advice is
right for a version you are not on. On 6.0.3 you either write the save-and-restore plus the
`@ResourceLock` by hand, or you deliberately override the JUnit BOM — and the third option people
suggest, JUnit Pioneer, has no release compatible with JUnit 6 at the time of writing.

**★ How do you test code that reads an environment variable?**
Preferably by not having code that reads an environment variable. `System.getenv` returns *"an
unmodifiable string map view of the current system environment"* — there is no supported way to
set one from inside the JVM, and the libraries that appear to do so reflect into the JDK's
internals and need `--add-opens`. Read the variable once at the application's edge and pass the
value in as a constructor parameter, or in Spring read it through `Environment` so that a test can
override it with `@TestPropertySource`. Then the test sets a value instead of a global.

{/* FOOTER */}
