---
title: "The lifecycle"
sidebar_label: "4 · The lifecycle"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Maven Introduction to the Build
> Lifecycle
> (maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html
> — the three lifecycles, all 23 default phases in order, and the
> documented default bindings for `jar` and `pom` packaging), the
> maven-surefire-plugin inclusion/exclusion page (default includes), and
> the maven-failsafe-plugin site (`integration-test` and `verify` goals,
> and why it does not fail the build at `integration-test`).

**You never tell Maven to run a plugin. You name a **phase** — a
position in a fixed, ordered list — and Maven runs every phase up to and
including it, executing whatever plugin goals are *bound* to each. What
is bound comes from your `<packaging>`. This indirection is the whole
design: it is why `mvn package` builds a war in one project and a jar in
another with no configuration difference, and it is why "Maven ran
something I did not ask for" is always a binding question, never a
command question.**

## Three lifecycles, not one

| Lifecycle | Phases | Purpose |
|---|---|---|
| **clean** | `pre-clean`, `clean`, `post-clean` | delete the output of a previous build |
| **default** | 23 phases, `validate` → `deploy` | build and distribute the project |
| **site** | `pre-site`, `site`, `post-site`, `site-deploy` | generate the project's documentation site |

They are independent sequences. `mvn clean install` is not one lifecycle
with a `clean` phase in it — it is two invocations on one command line,
`clean` from the clean lifecycle and `install` from the default one, run
left to right in the order you wrote them.

## The default lifecycle, in order

| # | Phase | What it is for |
|---|---|---|
| 1 | `validate` | the project is correct and all necessary information is available |
| 2 | `initialize` | set properties, create directories |
| 3 | `generate-sources` | generate source to be compiled |
| 4 | `process-sources` | filter or otherwise transform sources |
| 5 | `generate-resources` | generate resources for the package |
| 6 | `process-resources` | copy and filter resources into the output directory |
| 7 | **`compile`** | compile main sources |
| 8 | `process-classes` | post-process compiled classes (bytecode weaving) |
| 9 | `generate-test-sources` | generate test source |
| 10 | `process-test-sources` | transform test source |
| 11 | `generate-test-resources` | generate test resources |
| 12 | `process-test-resources` | copy and filter test resources |
| 13 | `test-compile` | compile test sources |
| 14 | `process-test-classes` | post-process compiled test classes |
| 15 | **`test`** | run unit tests |
| 16 | `prepare-package` | anything needed before packaging |
| 17 | **`package`** | produce the distributable archive |
| 18 | `pre-integration-test` | stand up the integration environment |
| 19 | `integration-test` | run integration tests |
| 20 | `post-integration-test` | tear the environment down |
| 21 | **`verify`** | check that the package is valid and meets quality criteria |
| 22 | **`install`** | copy the artifact into the local repository |
| 23 | **`deploy`** | copy the artifact to a remote repository |

**Invoking a phase runs it and every phase before it**, in order.
`mvn test` runs phases 1–15. `mvn package` runs 1–17. There is no way to
run phase 17 without 1–16, and that is deliberate: the ordering *is* the
contract, and it is the reason a Maven project you have never seen still
builds with a command you already know.

## Packaging decides what actually happens

A phase is a name. The work is done by plugin goals bound to that name,
and the default set of bindings comes from `<packaging>`. For **`jar`**
packaging the documented bindings are:

| Phase | Goal |
|---|---|
| `process-resources` | `resources:resources` |
| `compile` | `compiler:compile` |
| `process-test-resources` | `resources:testResources` |
| `test-compile` | `compiler:testCompile` |
| `test` | `surefire:test` |
| `package` | `jar:jar` |
| `install` | `install:install` |
| `deploy` | `deploy:deploy` |

Eight bindings. Every other position in that 23-phase list is **empty**,
waiting for you to bind something to it. `war` packaging is the same
list with `war:war` instead of `jar:jar`; **`pom` packaging binds only
`install:install` and `deploy:deploy`**, which is exactly why build
configuration on an aggregator POM appears to do nothing at all.

Notice what is *not* in that table: nothing is bound to
`integration-test` or to `verify`. Failsafe, coverage gates, enforcer
rules and signature checks are not there until you put them there, and
that is the point — the lifecycle gives you an agreed vocabulary for
*when*, not a fixed set of things that happen.

## What the load-bearing phases really do

- **`compile`** — `compiler:compile` runs `javac` over `src/main/java`
  into `target/classes`, using `maven.compiler.release` (or the plugin's
  `1.8` defaults if you never set it). It compiles in one invocation,
  and Maven's incrementality here is coarse: it is good at "nothing
  changed" and unreliable about deletions and renames.
- **`test`** — Surefire runs unit tests against `target/classes` plus
  `target/test-classes`, in a forked JVM by default. The default
  includes are `**/Test*.java`, `**/*Test.java`, `**/*Tests.java` and
  `**/*TestCase.java`; a test class named anything else is **silently
  not run**, which is one of the quietest failure modes in Java tooling.
  A failure here fails the build immediately.
- **`package`** — takes `target/classes` and produces
  `target/<artifactId>-<version>.jar`. Nothing is copied anywhere else:
  after `package`, the artifact exists only inside `target/`.
- **`verify`** — the phase that answers "is this artifact acceptable?".
  Failsafe's `verify` goal, checksum and signature verification,
  coverage thresholds, enforcer rules, license audits.
- **`install`** — copies the artifact **and its POM** into
  `~/.m2/repository`, where other builds *on this machine* can resolve
  it. A local side effect, nothing more.
- **`deploy`** — uploads to the repository named in
  `<distributionManagement>`, with credentials from `settings.xml`. The
  only phase that makes an artifact visible to anyone else, and the only
  one that should run from CI rather than from a laptop.

## Why `integration-test` and `verify` are two phases

This looks like bureaucracy and is not. Surefire fails the build the
moment a test fails. If integration tests ran that way at
`integration-test`, phase 20 — `post-integration-test`, where you stop
the containers and drop the schema — would never execute, and a failing
test would leak an environment every time.

Failsafe therefore splits the work across two goals: `integration-test`
**runs** the tests and records results without failing, and `verify`
**reports** them and fails the build — after teardown has happened.

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-failsafe-plugin</artifactId>
  <version>3.5.4</version>
  <executions>
    <execution>
      <goals>
        <goal>integration-test</goal>
        <goal>verify</goal>
      </goals>
    </execution>
  </executions>
</plugin>
```

The consequence is a rule: **run `mvn verify`, never `mvn
integration-test`.** Stopping at phase 19 executes your integration
tests and then reports success no matter what they did, because the goal
that turns results into a build failure lives one phase later.

Failsafe's default includes are `**/IT*.java`, `**/*IT.java` and
`**/*ITCase.java` — deliberately disjoint from Surefire's, so the same
source tree can hold both kinds and each runner picks up only its own.

## The honest limitation

The lifecycle is fixed. You cannot add a phase, rename one, or express
"run this only if that other thing produced output". Every build,
however unusual, is projected onto the same 23 positions, and when a
build genuinely does not fit — a multi-stage generation pipeline, a
conditional artifact matrix — you end up with executions bound to phases
whose names have nothing to do with what they do, which is worse than no
convention at all. Gradle's arbitrary task graph exists for exactly
this, and it is the one place where "Maven is too rigid" is a technical
statement rather than a preference.

The counterweight is real: every Maven project on earth means the same
thing by `mvn verify`. No Gradle project means anything predictable by
`./gradlew build` until you have read its scripts.

## Gotchas

**Symptom:** a test class never runs and CI stays green
**Cause:** its name does not match Surefire's default includes (`Test*`, `*Test`, `*Tests`, `*TestCase`)
**Fix:** rename it, or configure `<includes>` explicitly; if this has bitten you once, assert an expected minimum test count in CI

**Symptom:** integration tests pass but containers are left running after a failure
**Cause:** they are running under Surefire at `test`, which fails immediately, so `post-integration-test` never executes
**Fix:** move them to Failsafe with `IT` naming, and invoke `verify`

**Symptom:** `mvn integration-test` reports success while an IT is clearly failing
**Cause:** Failsafe's `integration-test` goal records results; only its `verify` goal fails the build on them, and you stopped one phase short
**Fix:** always invoke `verify` or later — `integration-test` is a position in a list, not a command

**Symptom:** configuration added to the aggregator POM has no effect on anything
**Cause:** `pom` packaging binds only `install:install` and `deploy:deploy`, so there is no `compile` or `test` execution to attach to
**Fix:** put it in `<pluginManagement>` so children inherit it

**Symptom:** a class deleted from the source tree is still on the test classpath
**Cause:** `compile` does not remove orphaned output; `target/classes` still holds the old `.class` file
**Fix:** `mvn clean` for this specific class of problem — stale output survives renames and deletions, which is the one thing incremental compilation reliably gets wrong

**Symptom:** an annotation processor's generated sources are not compiled
**Cause:** nothing was bound to `generate-sources`, or the generated directory was never added as a source root
**Fix:** the generating plugin normally binds itself and calls `build-helper:add-source`; check the effective POM for the binding rather than assuming Maven scans `target/generated-sources`

## Interview questions

**★ What actually happens when you type `mvn package`?**
Maven runs every phase of the default lifecycle from `validate` through
`package`, executing the plugin goals bound to each. Which goals those
are comes from `<packaging>` — for `jar`, that is resources, compiler,
surefire and `jar:jar`. You never named a plugin; you named a position
in a list.

**★ `mvn clean install` — how many lifecycles is that?**
Two. `clean` is a phase of the clean lifecycle, `install` of the default
one. It is two invocations on a single command line, executed left to
right, not one lifecycle that contains both.

**★ Name the default `jar` bindings without looking.**
`resources:resources` at `process-resources`, `compiler:compile` at
`compile`, `resources:testResources` at `process-test-resources`,
`compiler:testCompile` at `test-compile`, `surefire:test` at `test`,
`jar:jar` at `package`, `install:install` at `install`,
`deploy:deploy` at `deploy`. Eight — everything else is an empty
position.

**★ Nothing is bound to `verify` for `jar` packaging. What does that tell you?**
That most of the lifecycle is extension points, not behaviour. `verify`
is where Failsafe, enforcer, coverage gates and signature checks get
bound by you. The lifecycle standardises *when* things run, not *what*
runs.

**★ Why does Failsafe exist when Surefire already runs tests?**
Failure timing. Surefire fails the build at the first failing test; at
`integration-test` that would skip `post-integration-test` and leak the
environment. Failsafe runs at `integration-test` without failing and
reports at `verify`, after teardown. Its default includes (`IT*`, `*IT`,
`*ITCase`) are disjoint from Surefire's so the two never collide.

**★ Someone's CI runs `mvn integration-test`. What is wrong with it?**
It runs the integration tests and never evaluates them — Failsafe's
`verify` goal is what turns recorded failures into a build failure, and
it lives one phase later. The pipeline is green regardless of results.

**★ What does `package` leave behind, and where?**
`target/<artifactId>-<version>.jar` and nothing else. The artifact is
not in the local repository until `install` and not visible to anyone
else until `deploy`. Confusing those three is why people cannot explain
why a colleague's build cannot see their change.

**★ Can you add a phase to the Maven lifecycle?**
No. Lifecycles and their phases are fixed; you bind goals to existing
phases. That rigidity is what Gradle's arbitrary task graph answers, and
the price Gradle pays is that `./gradlew build` means whatever a
project's scripts say, while `mvn verify` means the same thing
everywhere.

---

← Prev: [The effective POM and properties](03-effective-pom-and-properties.md) · Index: [Maven core](README.md) · Next → [Running the build](05-running-the-build.md)
