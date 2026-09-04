---
title: "ServiceLoader auto-detection registers extensions that nothing in the test source names, which makes it right for a reporter and wrong for anything that changes what a test means — and it is one module-wide switch, not a per-extension one"
sidebar_label: "10g · Automatic registration"
sidebar_position: 32
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Registering Extensions"
> ([extensions/registering-extensions](https://docs.junit.org/6.0.3/extensions/registering-extensions.html))
> and "Configuration Parameters"
> ([running-tests/configuration-parameters](https://docs.junit.org/6.0.3/running-tests/configuration-parameters.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**The third registration route has no trace in the test source at all. That is its entire
value and its entire danger: a stranger looking at a red test has nothing to search for.
This chunk is the mechanism, the switch, the filters, and the one rule about when it is
legitimate — plus the assembled picture of where every route lands in the registry.**

Declarative registration is [10d](10d-registering-extensions.md), programmatic is
[10e](10e-registerextension.md), and ordering and inheritance are
[10f](10f-registration-order.md).

## The mechanism

> *"Specifically, a custom extension can be registered by supplying its fully qualified class
> name in a file named `org.junit.jupiter.api.extension.Extension` within the
> `/META-INF/services` folder in its enclosing JAR file."*

Standard `ServiceLoader`. The file name is the fully qualified name of the *service
interface* — `org.junit.jupiter.api.extension.Extension`, the marker interface from
[10](10-extensions.md) — and its contents are one fully qualified implementation class name
per line:

```
src/main/resources/META-INF/services/org.junit.jupiter.api.extension.Extension
```

```
com.example.testing.DiagnosticCaptureExtension
com.example.testing.BuildScanReporterExtension
```

Nothing about this is Jupiter-specific except the file name. It follows every `ServiceLoader`
rule, including the one that bites: **the file has to be on the classpath at test runtime**,
so a `src/main/resources` entry in the library jar is right and a `src/test/resources` entry
in the consuming project is a shortcut that will not travel.

## The switch, which is off

> *"Auto-detection is an advanced feature and is therefore not enabled by default. To enable
> it, set the `junit.jupiter.extensions.autodetection.enabled` configuration parameter to
> `true`. This can be supplied as a JVM system property, as a configuration parameter in the
> `LauncherDiscoveryRequest` that is passed to the `Launcher`, or via the JUnit Platform
> configuration file."*

Three delivery mechanisms. As a JVM system property:

```
-Djunit.jupiter.extensions.autodetection.enabled=true
```

Or, the form that belongs in version control, `src/test/resources/junit-platform.properties`:

```properties
junit.jupiter.extensions.autodetection.enabled = true
```

🔴 **It is a module-wide switch, not a per-extension one.** Turning it on to pick up one
extension registers *every* `ServiceLoader`-declared extension on the test classpath,
including ones that arrived transitively through a dependency nobody chose deliberately. A
test library that ships an extension in `META-INF/services` becomes active in your build the
moment this flag is `true`.

## Where auto-detected extensions land

> *"When auto-detection is enabled, extensions discovered via the `ServiceLoader` mechanism
> will be added to the extension registry after JUnit Jupiter's global extensions (e.g.,
> support for `TestInfo`, `TestReporter`, etc.)."*

That is **before everything you declare**. Auto-detected extensions are the outermost
wrappers after Jupiter's own: their `beforeEach` runs earliest and their `afterEach` runs
last, after every declared extension has finished.

For a reporter or a diagnostic capture that is the right place — you want to be the last
thing standing when everything else has torn down. For anything that provisions a fixture it
is the wrong place, because you are running before extensions that the test author can
actually see, and there is no `@Order` you can apply: `@Order` sorts *fields*
([10f](10f-registration-order.md)), and an auto-detected extension has no field.

## Narrowing the set

Because "everything on the classpath" is a poor default, the switch comes with filters:

> *"The list of auto-detected extensions can be filtered using include and exclude patterns
> via the following configuration parameters:
> `junit.jupiter.extensions.autodetection.include=<patterns>` … Comma-separated list of
> include patterns for auto-detected extensions.
> `junit.jupiter.extensions.autodetection.exclude=<patterns>` … Comma-separated list of
> exclude patterns for auto-detected extensions."*

> *"Include patterns are applied before exclude patterns. If both include and exclude patterns
> are provided, only extensions that match at least one include pattern and do not match any
> exclude pattern will be auto-detected."*

```properties
junit.jupiter.extensions.autodetection.enabled = true
junit.jupiter.extensions.autodetection.include = com.example.testing.*
```

The grammar is the Platform's shared **Pattern Matching Syntax** — the same syntax the engine
and package filters use — so this is a class-name pattern, not a glob over jar files. An
include list is the safer shape: it states the extensions you meant, and a transitively added
one is excluded by omission rather than by your remembering to name it.

## When auto-detection is legitimate

The test is one question: **does this extension change what a test means, or only what the
build observes?**

**Legitimate.** A `TestWatcher` writing results to a flakiness database. A capture that
attaches thread dumps to failed executions. Anything whose removal would change the *report*
and not a single assertion.

**Not legitimate.** Anything that seeds data, sets a system property, installs a clock,
starts a server, or resolves a parameter. All of those change the meaning of the tests, and
the tests contain no evidence they exist. When one fails on a colleague's machine because
their `junit-platform.properties` differs, there is nothing in the test file to lead them to
the cause.

⚠️ Note the shape of the failure this creates: an auto-detected extension makes tests pass or
fail based on the *classpath*, which is exactly the class of environment dependence that
[14 · flaky tests](14-flaky-tests.md) is about. A test that behaves differently depending on
a transitive dependency is not a test.

## The assembled registration order

The guide never prints one global ordered list; it gives pairwise rules. Assembling only what
is quoted here and in [10e](10e-registerextension.md) and [10f](10f-registration-order.md):

| | Registered |
|---|---|
| 1 | Jupiter's own global extensions (`TestInfo`, `TestReporter`, …) |
| 2 | auto-detected `ServiceLoader` extensions — *"after JUnit Jupiter's global extensions"* |
| 3 | class-level `@ExtendWith` — superclass before subclass, source order within a class |
| 4 | `static` `@RegisterExtension` / `@ExtendWith` fields — *"after extensions that are registered at the class level via `@ExtendWith`"*, `@Order` deciding among them |
| 5 | instance `@RegisterExtension` fields — after construction and post-processing |
| 6 | method-level `@ExtendWith` — in source order |

⚠️ Rows 1–4 and 6 are each backed by an explicit sentence in the documentation. **Row 5's
position relative to row 6 is the one the user guide and the `@RegisterExtension` javadoc
contradict each other on** ([10e](10e-registerextension.md)). This table is my assembly of the
documented pairwise rules, not a list the documentation publishes. Depend on the individual
rules, and on `@Order` wherever you need certainty.

## Gotchas

**★ Turning on `junit.jupiter.extensions.autodetection.enabled` to get one extension.**
It is a module-wide switch that registers *every* `ServiceLoader`-declared extension on the
test classpath, including ones that arrived transitively. Use the `include` pattern parameter
to name what you meant, or register explicitly with `@ExtendWith` and leave the switch off.

**★ Assuming an auto-detected extension is visible to whoever reads the test.**
It is not. Nothing in the test source names it. That is acceptable for reporting and
diagnostics, and unacceptable for anything that changes behaviour, because the failure gives
its reader nothing to search for.

**★ Putting the services file in the consuming project's `src/test/resources`.**
It works, and it is a lie: the extension now appears to come from the library while actually
depending on a file in your project. Ship it from the library's `src/main/resources`, or do
not ship it at all and document `@ExtendWith`.

**★ Getting the services file name wrong.**
It is `org.junit.jupiter.api.extension.Extension` — the interface's fully qualified name, no
`.txt`, no leading slash, under `META-INF/services`. A typo produces silence: `ServiceLoader`
finds no such service and nothing is registered.

**★ Expecting to order an auto-detected extension with `@Order`.**
`@Order` applies to `@RegisterExtension` and `@ExtendWith` **fields**. An auto-detected
extension has no field and no annotation, so its position is fixed: after Jupiter's globals
and before everything you declare.

**★ Shipping an extension in `META-INF/services` and assuming users have opted in.**
They have not — the flag is off by default, so your extension does nothing until somebody
sets it, and then it does everything at once along with every other library's. Ship a composed
annotation ([10d](10d-registering-extensions.md)) as the supported entry point and treat the
services file as an extra.

**★ Relying on the assembled six-row table.**
It is an assembly of pairwise rules, and one of those pairs is contradicted between the guide
and the javadoc. Depend on the individual documented statements and on `@Order`.

**★ Using auto-detection to enforce a policy on every test.**
An extension that inspects every result and fails the build on some global rule turns every
test in the codebase into a test of that rule, with a failure message that points at
machinery rather than behaviour — and now it is invisible as well. That is the argument
against policy extensions from [10](10-extensions.md), with the volume turned up.

## Interview questions

**★ How does an extension get registered with no annotation anywhere in the test source?**
Java's `ServiceLoader`: a file named `org.junit.jupiter.api.extension.Extension` under
`/META-INF/services` in the jar, listing fully qualified implementation class names, plus the
`junit.jupiter.extensions.autodetection.enabled=true` configuration parameter, which is off by
default. It can be supplied as a system property, in the `LauncherDiscoveryRequest`, or in
`junit-platform.properties`.

**★ Where do auto-detected extensions sit in the registration order, and what does that mean
for their callbacks?**
Immediately after Jupiter's own global extensions and before everything you declare. Since
extensions wrap user code, that makes them the outermost wrappers: their `before` callbacks
run earliest and their `after` callbacks run last, after every declared extension has torn
down. It is the right position for a reporter and the wrong one for anything a declared
extension depends on.

**★ When is auto-detection the right choice?**
When the extension changes what the *build observes* rather than what a *test means* — a
results reporter, a diagnostic capture on failure. Never for fixtures, clocks, system
properties, parameter resolution or data seeding, because the test source contains no
evidence that any of it is happening, and a failure on someone else's machine has no thread
to pull.

**★ Your team enables auto-detection and an unrelated test starts failing. What is the first
hypothesis?**
That the switch is module-wide and has activated an extension you did not know was on the
classpath — a test library that ships one in `META-INF/services` and had been dormant. The
fix is the `junit.jupiter.extensions.autodetection.include` pattern parameter, naming only the
extensions you actually meant, since include patterns are applied before exclude patterns and
an omitted extension is simply not detected.

**★ Can you make an auto-detected extension run after your own `@RegisterExtension` one?**
No. `@Order` sorts the pool of `@RegisterExtension` and `@ExtendWith` fields, and an
auto-detected extension is neither. Its slot — after Jupiter's globals, before all declared
extensions — is fixed. If you need it ordered, register it declaratively instead and switch
auto-detection off.

{/* FOOTER */}
