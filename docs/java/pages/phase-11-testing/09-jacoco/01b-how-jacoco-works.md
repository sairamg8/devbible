---
title: "How JaCoCo actually works: a Java agent rewrites classes as the JVM loads them, drops boolean probes into the control flow, and writes a file of flags keyed by a CRC64 of the class bytes — every strange coverage result in this topic is explained by one of those four facts"
sidebar_label: "01b · How JaCoCo works"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s documentation — `implementation.html`,
> `classids.html`, `counters.html`, `faq.html`, `agent.html`, `changes.html` — and the Maven
> plugin's `prepare-agent-mojo.html`. Version spine from `spring-boot-dependencies:4.1.1`:
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine** — configuration and documented behaviour only,
> never output from a run.

**You can use JaCoCo for years without knowing how it works, right up until the day a class
reads 0% that you watched execute, or the number changes after a build-tool upgrade in which
nobody wrote code. Both are explained by the mechanism, and the mechanism is four facts: it is
a Java agent, it rewrites classes at load time, it records single bits, and it identifies
classes by a checksum of their bytes. Almost every confusing coverage result in the rest of
this topic reduces to one of the four.**

## Fact 1 · It is a Java agent, not a test framework plugin

JaCoCo runs as a `-javaagent` on the JVM that executes your tests. It has no knowledge of JUnit,
no knowledge of Spring, and no opinion about what a test is. The build plugin's entire job on
the collection side is to get that flag onto the test JVM's command line:

```
-javaagent:/path/to/jacocoagent.jar=destfile=target/jacoco.exec,append=true
```

The Maven plugin's `prepare-agent` goal does not run anything itself — it **builds that string
and sets it as a property**. Its documentation says it sets `argLine` (or `tycho.testArgLine`
for `eclipse-test-plugin` packaging), and the property name is configurable via `propertyName`.
Surefire then passes `${argLine}` to the forked test JVM.

That indirection — a goal that only sets a property, and a *different* plugin that has to
actually use it — is the source of the single most common JaCoCo failure in Maven builds, and
it gets its own chunk: [02b · The argLine trap](02b-the-argline-trap.md).

Two consequences worth stating now:

- **Anything that runs in a different JVM is not measured** unless that JVM also got the agent.
  A test that shells out, a container started by Testcontainers, a forked compiler, a Gradle
  worker configured separately — code executing there is invisible, and its classes read as
  never executed.
- **The agent must be present at *run* time, not compile time.** Coverage is not something baked
  into your artifact by a build step. This is why "the tests passed but coverage is 0%" is a
  configuration symptom, never a code symptom.

## Fact 2 · Classes are rewritten as they are loaded

The agent installs a class-file transformer. As each class is loaded, JaCoCo inserts probes into
the bytecode before the JVM sees it — this is what its docs call **on-the-fly instrumentation**.
Your `.class` files on disk are not modified.

A probe is a write of `true` into a boolean array, placed so that the set of probes that fired
determines which instructions ran. JaCoCo does not put a probe on every instruction; it puts
them at control-flow decision points, from which the coverage of every instruction in between
can be reconstructed. That is why the tool can report instruction-level detail from a modest
number of flags.

Three consequences:

- **Coverage is measured on what the compiler produced.** Not on your source. Implicit
  constructors, static initialisers, the `values()` and `valueOf` a compiler adds to an enum, the
  members generated for a `record`, the synthetic classes behind certain `switch` forms — all of
  it is real bytecode and all of it is, in principle, countable. JaCoCo filters a long list of
  these by default ([chunk 05c](05c-what-jacoco-filters-for-free.md)), but the ones it does not
  filter land in your denominator.
- **A class that is never loaded is never instrumented.** JaCoCo's report generator later
  analyses the class files on disk to know what *could* have been covered, which is how a class
  that was never loaded still appears in the report at 0% rather than vanishing.
- **Something else that rewrites bytecode can collide with it.** Aspect weavers, mocking
  libraries that redefine classes, shading, and repackaging all change the bytes. Whether that
  breaks coverage depends on *when* it happens relative to the run — which is fact 4.

There is also an **offline instrumentation** mode (the `instrument` and
`restore-instrumented-classes` goals), which rewrites the class files on disk instead. It exists
for environments where you cannot attach an agent — some Android and app-server setups. It is a
fallback, not the normal path, and it requires the JaCoCo runtime on the application classpath.

## Fact 3 · A probe stores one bit, and the file stores probes

At JVM shutdown (or on demand), the agent writes the probe arrays to an execution data file —
`target/jacoco.exec` by default for the Maven plugin, per `destFile`.

What is in that file is **not** a report. It is a set of class ids paired with boolean arrays.
There are no percentages in it, no line numbers, no method names in any useful sense, and no
source. The `report` goal produces the human-readable output by combining two separate inputs:

```
jacoco.exec  (which probes fired)        ┐
                                         ├──►  HTML / XML / CSV report
target/classes (what code exists)        ┘
+ src/main/java (source, for highlighting)
```

That two-input structure explains a family of confusions:

- **The report can be generated later, on a different machine**, as long as it has the same class
  files. This is what makes multi-module aggregation ([chunk 07](07-multi-module.md)) possible.
- **If the class files differ from the ones that ran, the data cannot be matched** — fact 4.
- **If the source is missing, you still get numbers but no highlighted source view.** The report
  degrades to a table.
- **Nothing in the file records what the test asserted**, because a bit has no room for it. This
  is the structural version of [chunk 01](01-what-coverage-measures.md)'s argument: it is not that
  JaCoCo chose not to record assertions, it is that the format has no place to put them.

`append=true` (the Maven default) means several JVMs can accumulate into one file — which is how
unit and integration test runs combine, and also how a stale `jacoco.exec` from last week can
quietly inflate today's report if nothing cleans it.

## Fact 4 · A class is identified by a CRC64 of its bytes

This is the fact that explains the worst-looking coverage bugs, and it is documented precisely.

JaCoCo identifies each class in the execution data by a **class id**: per `classids.html`,
64-bit values calculated as a **CRC64 checksum of the raw class file**. That id is how probe
data recorded at run time is related to the class analysed at report time.

The matching is byte-for-byte. Its documentation is blunt about what that means: if different
class files are used at runtime and at analysis time, *"execution data cannot be related to the
analyzed classes"*, and those classes are *"reported with 0% coverage"*. Any difference does
it — a different compiler, a different compiler version, different compiler settings, or any
post-processing of the class files between the run and the report.

The reason it must be this strict is also documented: probes are *"stored in a plain boolean
array"* with no metadata identifying which probe is which. If JaCoCo matched a slightly different
class file to that array, the probes would line up with different instructions and it would
produce, in its own words, *"random coverage results"*. Refusing to match is the safe failure.

The documented way to confirm you have hit this: open the report's **Sessions page**. *"If the
entry is not linked this means there is a class id mismatch between the class used at runtime
and the class provided to create the report."* That check is worth knowing, because from the
main report a class id mismatch and a genuinely untested class look identical. [Chunk
06c](06c-the-zero-percent-class.md) works through the diagnosis.

## Putting the four together

Here is the whole pipeline in one place, which is the mental model to keep:

| Stage | What happens | What can go wrong |
|---|---|---|
| Build sets up | `prepare-agent` composes a `-javaagent` string into a property | The property is never passed to the test JVM ([02b](02b-the-argline-trap.md)) |
| Test JVM starts | Agent installs a class-file transformer | Wrong JVM; agent not on this JVM's command line |
| Classes load | Probes inserted into bytecode in memory | Class never loaded ⇒ 0%; another transformer collides |
| Tests run | Probes flip to `true` | Code runs in a different process ⇒ invisible |
| JVM exits | Probe arrays written to `jacoco.exec` | Stale file appended to; JVM killed before writing |
| Report runs | `.exec` + class files + source ⇒ HTML/XML/CSV | Class files changed since the run ⇒ 0% via class id mismatch |

Every chunk after this one is, in some sense, a detailed reading of one row of that table.

## Where this connects

- **[02 · Wiring it up](02-wiring-it-up-maven.md)** — the Maven goals that implement the first row,
  with their real defaults and phase bindings.
- **[02b · The argLine trap](02b-the-argline-trap.md)** — the documented failure of row one, and
  the documented fix.
- **[06c · The class that reads 0%](06c-the-zero-percent-class.md)** — diagnosing row six.
- **[07 · Multi-module and aggregation](07-multi-module.md)** — why the two-input report
  structure is what makes aggregation work at all.

## Gotchas

**★ `prepare-agent` does not enable coverage — it sets a property, and something else has to use it.**
The goal succeeds whether or not the test JVM ever receives the flag. There is no error, no
warning, and the build is green; you find out when the report says 0%. Treat "the goal ran" and
"the agent attached" as two different claims, and verify the second by looking at the report's
Sessions page rather than the build log.

**★ Code executing in another process is invisible, and nothing tells you.**
Testcontainers containers, a database's stored procedures, a forked JVM, an external service
stubbed by WireMock — none of it is instrumented. This is correct behaviour, but it means an
integration-heavy suite can drive real behaviour through code that reports as uncovered because
the covered part lives elsewhere.

**★ `append=true` is the default, so a stale `jacoco.exec` inflates today's report.**
Run the suite, delete a test class, run again without cleaning: the deleted test's probes are
still in the file. Anything that does not `mvn clean` — a CI cache, a developer laptop, an
incremental build — can carry coverage forward from code paths that no longer have tests. The
symptom is a number that will not go down when it should.

**★ A JVM that is killed rather than exited may not write its execution data.**
The agent writes on shutdown. A test JVM terminated by a timeout, an OOM kill, or a
`Runtime.halt` can lose the whole run's data, which then reports as 0% across the board. A
suddenly-zero coverage report is more often a dead JVM than a broken configuration.

**★ Anything that rewrites bytecode after the tests run breaks class id matching, silently.**
Spring Boot's repackaging, a shade/shadow plugin, an AspectJ post-compile weave, or a
Proguard-style step — if the report is generated against those outputs rather than against
`target/classes`, ids do not match and classes read 0%. Generate the report from the same class
directory the tests ran against.

**★ Two different compilers between run and report is enough to break it, even at the same source version.**
The class id is a checksum of bytes, not a semantic identity. A CI image whose JDK differs by a
patch release from the one that produced the cached class files can produce a whole report of
zeroes with no other symptom. This is a real cause of "coverage broke and nothing changed".

**★ Offline instrumentation is not a drop-in swap for the agent.**
`instrument` rewrites your class files in place, so the JaCoCo runtime must then be on the
application classpath, and you must run `restore-instrumented-classes` afterwards or ship
instrumented bytecode. It exists for environments that cannot attach an agent; choosing it
because on-the-fly "did not work" usually means fixing a property-passing problem the hard way.

**★ A class at 0% may never have been loaded rather than never been executed.**
The distinction matters when you are hunting dead code: a class excluded by a classloader,
disabled by a profile, or only referenced through configuration that the test context never
activates is reported the same as one your tests deliberately ignore. The report cannot tell you
which, and it does not claim to.

**★ The report needs the class files, so a report goal that runs before compilation output exists produces nothing useful.**
Aggregation across modules is the common case — the aggregating module must be able to see the
other modules' classes and exec files, which is a dependency-ordering question, not a JaCoCo
question. [Chunk 07](07-multi-module.md) covers the shape.

## Interview questions

**★ How does JaCoCo collect coverage?**
As a Java agent on the test JVM. It installs a class-file transformer that inserts boolean
probes into the bytecode as classes are loaded — on-the-fly instrumentation, so the `.class`
files on disk are untouched — and at shutdown writes the probe arrays to an execution data file.
A separate report step combines that file with the class files and sources to produce HTML, XML
or CSV. The build plugin's collection-side job is only to get `-javaagent` onto the test JVM.

**★ A class you can see executing in the debugger reports 0% coverage. Walk through the causes.**
In order of likelihood: the agent never attached to that JVM (the property was overwritten, or
the code runs in a forked/second process); the class files used for the report differ from the
ones that ran, so class ids do not match — JaCoCo's docs say such classes are *"reported with 0%
coverage"*, and the Sessions page shows an unlinked entry when this happens; the class was
excluded at the agent rather than at the report, which the FAQ notes renders as not-covered
because the generator cannot distinguish exclusion from non-execution; or the test JVM was killed
before it could write the exec file.

**★ Why does JaCoCo identify classes by a checksum instead of by name?**
Because the execution data is a bare boolean array with no metadata about which probe belongs to
which instruction. Matching by name would let a differently-compiled version of the same class be
paired with probe data recorded against a different instruction layout, producing — in JaCoCo's
own phrasing — random results. A CRC64 over the raw class file makes the match byte-exact, so the
failure mode is a visible 0% rather than an invisible wrong answer.

**★ Your CI coverage number is higher than a clean local run of the same commit. Why might that be?**
Most likely a stale execution data file. The Maven agent defaults to `append=true`, so if the CI
workspace is cached and not cleaned, probes from previous runs — including tests that no longer
exist — accumulate in `jacoco.exec` and are included in the report. Other candidates: CI runs
integration tests that the local command skipped, or the two reports have different exclusions or
different module scope.

**★ What is offline instrumentation and when would you use it?**
It rewrites class files on disk rather than at load time, via the `instrument` goal, with
`restore-instrumented-classes` to undo it. You need it when you cannot attach a `-javaagent` to
the JVM that runs the code — certain application-server or Android setups. The costs are that the
JaCoCo runtime must be on the application classpath and that instrumented bytecode must never
escape into a build artifact, so it is a deliberate fallback rather than a preference.

**★ Does adding Mockito, AspectJ or Spring's proxying affect coverage measurement?**
Not by itself — those create or modify classes at runtime, and JaCoCo instruments whatever is
loaded. The problem arises when bytecode is changed *between* the test run and the report: then
the class files handed to the report generator differ from the ones that ran and class ids no
longer match. Runtime-generated proxies raise a separate question — they are classes without a
source location, and whether they are instrumented at all is controlled by the agent's
`inclNoLocationClasses` option.

{/* FOOTER */}
