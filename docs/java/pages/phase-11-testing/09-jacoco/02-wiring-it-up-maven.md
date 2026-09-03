---
title: "Wiring JaCoCo into Maven: two executions, eleven goals you mostly ignore, and a set of defaults — verify phase, target/jacoco.exec, instruction coverage — that are not the ones most teams believe they configured"
sidebar_label: "02 · Wiring it up (Maven)"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against the **JaCoCo Maven plugin 0.8.15** mojo documentation —
> `maven.html`, `prepare-agent-mojo.html`, `report-mojo.html`, `check-mojo.html`,
> `report-aggregate-mojo.html`. Version spine from `spring-boot-dependencies:4.1.0`: JDK 25,
> Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Maven Surefire as managed by Boot.
> ⚠️ **No build and no sandbox on this machine** — POM configuration and documented defaults
> only, never build output.
> ⚠️ **0.8.15 (released 2026/06/04) is the current release.** Version strings like
> `0.8.16.202608270545` that appear on jacoco.org are **snapshots**, not releases — do not pin one.

**The minimum viable JaCoCo setup in Maven is about fifteen lines and two executions, and it is
worth understanding rather than pasting, because every one of the plugin's defaults is a decision
somebody will later assume differently. The report lands somewhere you did not choose, the
threshold you did not fully specify is measuring a counter you did not intend, and the goal that
"turns on coverage" does not turn on coverage — it sets a property.**

## The minimum that works

```xml
<build>
  <plugins>
    <plugin>
      <groupId>org.jacoco</groupId>
      <artifactId>jacoco-maven-plugin</artifactId>
      <version>0.8.15</version>
      <executions>
        <execution>
          <id>prepare-agent</id>
          <goals><goal>prepare-agent</goal></goals>
        </execution>
        <execution>
          <id>report</id>
          <goals><goal>report</goal></goals>
        </execution>
      </executions>
    </plugin>
  </plugins>
</build>
```

No `<phase>` is needed on either execution, because both goals carry a default binding:
`prepare-agent` binds to **`initialize`** and `report` binds to **`verify`**. That is the whole
setup for a single-module project running unit tests through Surefire.

Two things about this snippet are worth saying explicitly, because both are commonly misread:

- **`prepare-agent` must run before the tests, and `initialize` is early enough.** It runs at the
  start of the lifecycle, long before `test`.
- **`report` binds to `verify`, not to `test`.** So `mvn test` runs your tests and produces
  `jacoco.exec` — and **no report**. You need `mvn verify` (or `mvn test jacoco:report`) to get
  HTML. "The tests ran but there is no report" is usually this and nothing more.

## What each goal is for

The plugin ships eleven goals. Most projects use two or three. The full list, from `maven.html`:

| Goal | What it does | When you need it |
|---|---|---|
| `prepare-agent` | Composes the `-javaagent` string into a property | Always |
| `report` | `.exec` + classes + sources ⇒ HTML/XML/CSV | Almost always |
| `check` | Fails the build against coverage rules | When you want a gate ([04](04-thresholds.md)) |
| `prepare-agent-integration` | Same as `prepare-agent`, for the integration-test phase | Failsafe-based ITs |
| `report-integration` | Report from the integration-test exec file | Failsafe-based ITs |
| `report-aggregate` | One report across reactor modules | Multi-module ([07](07-multi-module.md)) |
| `merge` | Combines several `.exec` files into one | Several test JVMs / runs |
| `instrument` | Offline instrumentation of class files | Only when an agent cannot attach |
| `restore-instrumented-classes` | Undoes `instrument` | Always, if you used `instrument` |
| `dump` | Pulls execution data from a running JVM over TCP | Long-running / remote processes |
| `help` | Prints goal documentation | — |

The three-goal setup — `prepare-agent`, `report`, `check` — covers the overwhelming majority of
projects. Reach for `merge` and `report-aggregate` only when you actually have several exec files
or several modules.

## The defaults, stated once so you can stop guessing

These are the ones that matter, all from the mojo pages:

**`prepare-agent`**

| Parameter | Default |
|---|---|
| phase | `initialize` |
| property set | **`argLine`** (`tycho.testArgLine` for `eclipse-test-plugin` packaging) |
| `destFile` | `${project.build.directory}/jacoco.exec` |
| `append` | appends to an existing file; when `false`, *"an existing execution data file will be replaced"* |
| `includes` | unset ⇒ everything included |
| `excludes` | unset ⇒ nothing excluded |
| `excludeClassLoaders` | list entries separated by a **colon**, wildcards `*` and `?` |
| `inclNoLocationClasses` | whether *"classes without source location should be instrumented"* |

**`report`**

| Parameter | Default |
|---|---|
| phase | `verify` |
| `outputDirectory` | `${project.reporting.outputDirectory}/jacoco` — i.e. `target/site/jacoco` |
| `dataFile` | `${project.build.directory}/jacoco.exec` |
| `formats` | all three: HTML, XML, CSV |
| `title` | `${project.name}` |
| `includes`/`excludes` | class file patterns, wildcards `*` and `?` |

**`check`**

| Parameter | Default |
|---|---|
| phase | `verify` |
| `haltOnFailure` | **`true`** (`jacoco.haltOnFailure`) |
| `dataFile` | `${project.build.directory}/jacoco.exec` |
| `skip` | `false` (`jacoco.skip`) |
| unspecified rule element | **`BUNDLE`** |
| unspecified limit counter | **`INSTRUCTION`** |
| unspecified limit value | **`COVEREDRATIO`** |

🔴 That last block is the one to remember. A rule with nothing but a `<minimum>0.80</minimum>` is
a **bundle-level instruction-coverage** rule. Most people writing it believe they configured line
coverage. [Chunk 04](04-thresholds.md) is about what to write instead.

## `report` needs the classes and the sources

The report goal reads three things: the execution data, the compiled classes, and the source. It
finds all three from the project's own configuration by default — `target/classes` and
`src/main/java` — which is why the minimal setup needs no paths.

It matters when the defaults stop holding:

- **A module whose classes are post-processed** (shaded, repackaged, weaved) must have the report
  generated against the same class files the tests ran against, or class ids will not match and
  everything reads 0% — see [01b](01b-how-jacoco-works.md).
- **A module with no sources** still produces numbers, but the HTML has no highlighted source
  view; you get tables only.
- **`report-aggregate`** works precisely because these inputs can come from elsewhere in the
  reactor — [chunk 07](07-multi-module.md).

## Skipping it without deleting it

Two properties turn the whole thing off, which matters for fast local loops and for build
profiles that have no business measuring coverage:

```bash
mvn verify -Djacoco.skip=true
```

`jacoco.skip` suppresses the goals. Note that skipping `prepare-agent` leaves `argLine` unset,
which is fine — unless something else in the build expects the property to exist. That
interaction is the subject of [02b](02b-the-argline-trap.md).

For CI you more often want the *opposite* asymmetry: run `report` always, run `check` only on the
branch where the gate belongs. `jacoco.haltOnFailure=false` gives you the rule evaluation and the
warning without failing the build, which is a reasonable way to introduce a threshold to a
codebase that would currently fail it.

## Does Spring Boot manage the version?

⚠️ **Not established.** Boot's dependency management covers *dependencies*, and build plugins are
managed separately through the Spring Boot parent's `pluginManagement` where they are managed at
all. Whether `spring-boot-starter-parent` 4.1.0 pins a JaCoCo plugin version was not verified for
this page, so **specify `<version>` explicitly** — which is good practice for any build plugin
regardless, since an unpinned plugin version makes builds non-reproducible.

## Where this connects

- **[02b · The argLine trap](02b-the-argline-trap.md)** — the failure this wiring runs into the
  moment Surefire has its own `<argLine>`, and the documented fix.
- **[02c · Gradle](02c-wiring-it-up-gradle.md)** — the same job, with two different documented
  surprises about task dependencies.
- **[02d · Integration tests](02d-integration-tests-and-failsafe.md)** — the `-integration`
  goals and `merge`.
- **[04 · Thresholds](04-thresholds.md)** — the `check` goal's rule syntax in full.
- **[Phase 8 · Maven core](../../phase-8-build-dependencies/01-maven-core/README.md)** owns the lifecycle,
  phases and plugin binding themselves; this page assumes them.

## Gotchas

**★ `mvn test` produces no report, and this surprises everyone once.**
`report` binds to `verify`. After `mvn test` you have `target/jacoco.exec` and no HTML, which
reads exactly like "coverage is broken". Either run `mvn verify`, or run `mvn test jacoco:report`
explicitly, or rebind the execution — but rebinding `report` to `test` means it runs before
integration tests and reports on unit tests only, which may not be what you want either.

**★ A bare `<minimum>` in a check rule is instruction coverage over the whole bundle.**
The documented defaults are element `BUNDLE`, counter `INSTRUCTION`, value `COVEREDRATIO`. Since
instruction coverage reads higher than line or branch coverage on the same code, a team that
believes it set an 80% line gate has actually set something materially weaker, and will not
discover it until they compare two numbers.

**★ The report goal's `excludes` and the agent's `excludes` are different exclusions with different effects.**
Excluding at the agent means no data is collected, and JaCoCo's FAQ is explicit that such classes
still appear *"as not covered"* because the generator cannot tell exclusion from non-execution.
Excluding at the report removes them from the numbers. If your goal is a fairer percentage, you
want the report. [Chunk 05](05-exclusions.md) is entirely about this distinction.

**★ Both are class *file* patterns, not package names.**
`com/example/generated/**/*.class` — slashes and a `.class` suffix, not `com.example.generated.*`.
A dotted pattern silently matches nothing, the exclusion appears to be ignored, and the usual
next move is to add more patterns rather than fix the syntax.

**★ An unpinned plugin version makes coverage non-reproducible in a way that is hard to attribute.**
JaCoCo adds filters in most releases — `assert` statements in 0.8.8, exhaustive switch and record
patterns in 0.8.11, several Kotlin constructs in 0.8.14. A floating version changes what is in
your denominator between builds, so a threshold fails on a day nobody committed anything.

**★ `append` defaults to appending, so `jacoco.exec` survives a build that did not `clean`.**
On a CI runner with a cached workspace this accumulates coverage from previous commits. The
number then declines to fall when tests are deleted, which is the exact regression a floor exists
to catch.

**★ `jacoco.skip=true` in a shared profile can silently disable the gate you thought was enforcing.**
A `-Dskip.tests`-style convenience property wired to also skip JaCoCo means the `check` goal
never evaluates. The build is green, the gate is inert, and nothing in the output says so.
If a gate matters, assert that the report exists in CI rather than trusting the goal ran.

**★ `haltOnFailure=false` turns `check` into a log line nobody reads.**
It is the right setting while you are introducing a threshold, and the wrong one to leave in
place — a rule that cannot fail the build is a rule with no effect, and it will be quietly
violated within weeks. Set a date or a ticket when you turn it on.

**★ The default output path is `target/site/jacoco`, which the `site` lifecycle also writes to.**
Running `mvn site` can regenerate or clobber the directory, and a CI step that archives
`target/site` picks up more than the coverage report. Setting `outputDirectory` explicitly to
something like `target/jacoco-report` avoids an interaction that is confusing when it happens.

## Interview questions

**★ What is the minimum Maven configuration for JaCoCo, and what does each part do?**
Two executions of the `jacoco-maven-plugin`: `prepare-agent`, which binds to `initialize` and
composes the `-javaagent` string into the `argLine` property that Surefire passes to the forked
test JVM; and `report`, which binds to `verify` and combines `target/jacoco.exec` with the
compiled classes and sources to produce HTML, XML and CSV. Add `check` if you want the build to
fail on a rule. Pin the plugin version explicitly.

**★ You run `mvn test`, the tests pass, and there is no coverage report. What happened?**
Nothing is broken. `report` binds by default to `verify`, which `mvn test` does not reach. There
should be a `target/jacoco.exec` — if that file exists, collection worked and only the report step
was skipped, so run `mvn verify`. If the exec file is *also* missing, the agent never attached and
you have the argLine problem instead.

**★ What's the difference between excluding classes at the agent and at the report?**
The agent's `excludes` stop data being collected; the report's `excludes` stop classes appearing
in the output. They produce different reports: agent-excluded classes are still analysed from the
class files and, per JaCoCo's FAQ, are shown as not covered because the tool cannot distinguish
exclusion from non-execution. So excluding generated code at the agent makes your number *worse*.
Exclude at the report, and use agent excludes only for classes that must not be instrumented at
all — for instance ones that a framework rewrites and would collide.

**★ Why does the JaCoCo Maven plugin have separate `prepare-agent` and `prepare-agent-integration` goals?**
Because they bind to different phases and write to different execution data files.
`prepare-agent` binds to `initialize` and writes `jacoco.exec`; `prepare-agent-integration` binds
to **`pre-integration-test`** and writes **`jacoco-it.exec`**, so a Failsafe run does not
overwrite the unit-test data. ⚠️ Note that **both set `argLine` by default** — the same property
name, not a separate `failsafeArgLine`. That works only because the second execution runs later
in the lifecycle and rewrites the property before Failsafe forks its JVM; it is also why the
argLine trap bites both goals identically.

**★ A team pastes a JaCoCo config with only `<minimum>0.80</minimum>` and reports 80% line coverage. Is that accurate?**
No. With element, counter and value unspecified, the documented defaults are `BUNDLE`,
`INSTRUCTION` and `COVEREDRATIO`, so the gate is 80% *instruction* coverage across the bundle.
Instruction coverage is generally the most generous of the counters, so the real line and branch
figures are lower — often substantially. The fix is to state `<counter>` and `<value>` explicitly
in every limit.

{/* FOOTER */}
