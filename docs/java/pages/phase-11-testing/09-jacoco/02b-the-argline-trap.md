---
title: "The argLine trap: prepare-agent sets a property, Surefire's own argLine overwrites it, no goal fails, no warning is printed, and the report reads 0% — the single most common JaCoCo failure in Maven, with a documented one-character fix"
sidebar_label: "02b · The argLine trap"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `prepare-agent-mojo.html` and
> `prepare-agent-integration-mojo.html`, and `classids.html` for the alternative cause of a
> 0% report. Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> JUnit Jupiter 6.0.3, Maven Surefire as managed by Boot.
> ⚠️ **No build on this machine** — POM configuration and documented behaviour only, never
> build output.

**Add a `-Xmx` setting to Surefire and your coverage report goes to zero. Nothing fails. The
plugin runs, the tests pass, `mvn verify` is green, and every class in the report reads 0%
covered. This is not a bug in anything — it is two plugins agreeing on a property name, and the
second one winning. It has a documented fix that is four characters long, and it is worth an
entire chunk because the failure is silent, the symptom points nowhere near the cause, and
almost every Maven project eventually configures Surefire.**

## The mechanism, in three steps

1. **`prepare-agent` sets a property.** Per its documentation it sets `argLine` — or
   `tycho.testArgLine` for `eclipse-test-plugin` packaging — to the `-javaagent:...` string.
   It does not attach anything itself. [Chunk 01b](01b-how-jacoco-works.md) is the long version.
2. **Surefire forks a JVM and passes `${argLine}` to it.** That is how the agent normally
   arrives on the test JVM's command line.
3. **If Surefire has its own `<argLine>` in its `<configuration>`, that value is used instead.**
   Plugin configuration beats a project property. The `-javaagent` flag is simply not there.

Here is the config that breaks it, and it looks completely reasonable:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <configuration>
    <argLine>-Xmx2g -Duser.timezone=UTC</argLine>   <!-- 🔴 overwrites the agent -->
  </configuration>
</plugin>
```

Somebody added a heap size, or a timezone, or `--enable-preview`, or an `--add-opens` for a
library that needed it. Coverage silently stopped working on that commit, and the number that
appeared in the next report — 0%, or a partial figure if only some modules were affected — was
attributed to something else entirely.

## The documented fix: late property evaluation

JaCoCo's own `prepare-agent` page gives the answer. Use `@{...}` instead of `${...}`:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <configuration>
    <argLine>@{argLine} -Xmx2g -Duser.timezone=UTC</argLine>
  </configuration>
</plugin>
```

The documentation's own phrasing is *"late property evaluation"*, with the shape
`<argLine>@{argLine} -your -extra -arguments</argLine>`.

The difference matters and is worth understanding rather than memorising. `${argLine}` is
resolved when the POM is interpolated — before `prepare-agent` has run — so at that moment the
property does not exist and the reference does not do what you want. `@{argLine}` defers
resolution until Surefire actually reads the parameter, which is after `initialize`, so the
value JaCoCo set is there.

**The second documented option** is to stop putting the argument in Surefire's configuration at
all, and define `argLine` as a Maven property instead:

```xml
<properties>
  <argLine>-Xmx2g -Duser.timezone=UTC</argLine>
</properties>
```

⚠️ This one is subtler than it looks. `prepare-agent` **sets** the `argLine` property, so a
property you declared in `<properties>` is what the plugin appends to — the plugin's own
documentation notes this arrangement as the alternative, and it works. But it also means a
`<properties>` block and a Surefire `<configuration>` block are *not* interchangeable here, and
mixing the two — a property *and* a plain `${argLine}` in the configuration — reintroduces the
original problem.

## Why the failure is so hard to attribute

Every part of this fails quietly:

- **`prepare-agent` succeeds.** Its job is to set a property; it did.
- **The tests pass.** They are unaffected — the JVM simply has no agent on it.
- **`report` succeeds.** It reads the exec file and the classes and produces valid HTML.
- **There is no warning anywhere.** No plugin is in a position to notice: Surefire does not know
  JaCoCo exists, and JaCoCo does not know Surefire ran.

The one place the truth is visible is the **execution data file itself**. If
`target/jacoco.exec` is missing or empty after a test run, the agent never attached. That is the
first check, and it separates this problem from every other cause of a zero report:

| Symptom | Likely cause |
|---|---|
| `target/jacoco.exec` **missing or ~0 bytes** | Agent never attached — this chunk |
| `jacoco.exec` present, report 0% | Class id mismatch, or excluded at the agent ([06c](06c-the-zero-percent-class.md)) |
| `jacoco.exec` present, **no HTML at all** | `report` never ran — you used `mvn test`, which stops before `verify` |
| Some modules 0%, others fine | Surefire `<argLine>` overridden in one module's POM, or an inherited parent config |

## The same trap, three more times

The mechanism is not specific to `-Xmx`, and it recurs in places where the `<argLine>` is not
yours:

- **A corporate parent POM.** The override lives in a parent you did not write and may not be
  able to change. `@{argLine}` in the parent is the fix; if you cannot edit the parent, set
  `propertyName` on `prepare-agent` to a name the parent does not use, and reference that name
  in your own configuration.
- **Failsafe, identically.** `prepare-agent-integration` binds to `pre-integration-test` and
  writes `jacoco-it.exec`, but it sets the **same `argLine` property** — not a separate
  `failsafeArgLine`. So a Failsafe `<argLine>` breaks integration coverage in exactly the same
  way and needs exactly the same `@{argLine}`.
- **`--add-opens` and `--enable-preview` on a modern JDK.** These are precisely the flags a team
  adds when moving to a new Java release, so "we upgraded the JDK and coverage broke" is very
  often this and not a JDK-support problem. JaCoCo 0.8.15 officially supports Java 26 class
  files; the JDK is rarely the actual cause.

## `propertyName`, and when to use it

`prepare-agent` accepts `propertyName` to set something other than `argLine`:

```xml
<execution>
  <id>prepare-agent</id>
  <goals><goal>prepare-agent</goal></goals>
  <configuration>
    <propertyName>jacocoArgLine</propertyName>
  </configuration>
</execution>
```

```xml
<argLine>@{jacocoArgLine} -Xmx2g</argLine>
```

This is the right tool when you do not control the POM that sets `argLine`, or when two agents
need to coexist and you want each one's contribution named. It is the wrong tool as a default,
because it makes the wiring non-obvious to the next reader — and if the reference is ever
dropped, you are back to a silent 0% with a config that looks deliberate.

## Where this connects

- **[01b · How JaCoCo works](01b-how-jacoco-works.md)** — why the agent has to be on the test
  JVM's command line at all, and what else can go wrong on that path.
- **[02 · Wiring it up (Maven)](02-wiring-it-up-maven.md)** — the goals and their defaults.
- **[06c · The class that reads 0%](06c-the-zero-percent-class.md)** — the other family of
  zero-coverage causes, which look identical from the report.
- **[02c · Gradle](02c-wiring-it-up-gradle.md)** — Gradle has no equivalent of this trap, but it
  has two documented traps of its own.

## Gotchas

**★ The fix is `@{argLine}`, not `${argLine}`, and the difference is invisible in review.**
One character, and the two forms look identical at a glance in a large POM. `${...}` interpolates
during POM construction, before `prepare-agent` has run; `@{...}` defers to when Surefire reads
the parameter. A reviewer skimming a diff will not catch a `$` that should be an `@`.

**★ `target/jacoco.exec` missing is the diagnostic that separates this from everything else.**
Every other zero-coverage cause leaves an exec file behind. Check for the file before you check
anything else — it turns a vague "coverage is broken" into a two-way split, and it costs one `ls`.

**★ The override can arrive from a parent POM you do not control.**
Nothing in your module changed; coverage broke because a shared parent added `--add-opens` for
some other team's dependency. `propertyName` gives you an escape hatch that does not require
editing the parent, and it is the main legitimate use for that parameter.

**★ Failsafe has the same problem because it uses the same property name.**
`prepare-agent-integration` sets `argLine`, not a distinct `failsafeArgLine` — verified against
its mojo page. Teams that fix Surefire and forget Failsafe end up with unit coverage working and
integration coverage silently at zero, which then looks like "our integration tests don't cover
anything", a much more alarming and much wronger conclusion.

**★ Declaring `<argLine>` as a `<properties>` entry AND referencing `${argLine}` in Surefire's config recreates the bug.**
The two documented approaches are alternatives, not layers. Pick one: either `@{argLine}` inside
Surefire's configuration, or a plain `<properties>` declaration with nothing in Surefire's
configuration at all.

**★ "We upgraded the JDK and coverage stopped working" is usually this, not JDK support.**
A JDK upgrade is when `--enable-preview`, `--add-opens` and `--add-exports` get added to
Surefire. JaCoCo's release notes put official support at Java 26 as of 0.8.15, with experimental
support beyond, so the version is rarely the constraint. Check the exec file before you go
looking for a JaCoCo upgrade.

**★ A green build with a 0% gate is possible if the gate is a minimum on a bundle that has no data.**
If nothing was instrumented, some rule formulations have nothing to evaluate against and pass
vacuously rather than failing. A gate that cannot distinguish "we have no coverage" from "we
collected no data" is not protecting you, which is an argument for asserting the exec file exists
in CI rather than trusting the `check` goal alone.

**★ Multi-module builds can be half-broken, and the aggregate hides it.**
One module's POM overrides `argLine`; the others are fine. The aggregate report drops by a few
percent — well inside the noise a team tolerates — and nobody looks. Per-module numbers, not the
aggregate, are what reveal it.

## Interview questions

**★ Coverage reports 0% for everything, but the tests pass and the build is green. What do you check first?**
Whether `target/jacoco.exec` exists and is non-empty. If it is missing, the agent never attached
to the test JVM — the usual cause being a Surefire `<argLine>` in the plugin's configuration
overwriting the property `prepare-agent` set. If the file exists and is populated, the collection
side worked and the problem is on the report side: class id mismatch from post-processed class
files, or classes excluded at the agent, both of which render as 0%.

**★ What is `@{argLine}` and why does it matter?**
It is Maven's late property evaluation syntax, and it is JaCoCo's documented fix for the Surefire
override. `${argLine}` resolves during POM interpolation, before `prepare-agent` runs at
`initialize`, so it does not pick up the agent string. `@{argLine}` resolves when Surefire reads
the parameter, by which time the property holds the `-javaagent` flag. The alternative the docs
give is to declare `argLine` as a Maven property and keep it out of Surefire's configuration
entirely.

**★ Why doesn't the build warn you about this?**
Because no component is in a position to know. `prepare-agent`'s contract is to set a property,
and it does — successfully. Surefire's contract is to pass its configured `argLine`, and it does.
JaCoCo's `report` goal reads whatever execution data exists and reports honestly on it. There is
no participant that knows the agent was *supposed* to be on that command line, so there is nothing
to warn about. That structural gap is why the check has to be yours, in CI.

**★ Your integration tests show 0% coverage but unit tests are fine. Where do you look?**
At Failsafe's `<argLine>`. `prepare-agent-integration` sets the same `argLine` property that
`prepare-agent` does, so a Failsafe configuration block with its own `<argLine>` breaks
integration coverage identically. Confirm by checking for `target/jacoco-it.exec` — that is the
integration goal's default `destFile`, and its absence means the agent never reached the Failsafe
JVM.

**★ How would you stop this from silently regressing?**
Assert on the artifact rather than on the goal succeeding. In CI, fail the job if
`target/jacoco.exec` is missing or below a trivial size, and fail it if the report's total
instruction count is zero — a coverage report over zero instructions is a broken pipeline, not a
coverage result. That check is cheap and catches every variant of this problem, including the
parent-POM and Failsafe versions, without depending on a threshold.

{/* FOOTER */}
