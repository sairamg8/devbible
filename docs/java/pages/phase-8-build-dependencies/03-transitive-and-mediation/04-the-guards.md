---
title: "The guards that fail the build"
sidebar_label: "4 · The guards"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the maven-dependency-plugin **3.11.0** `analyze`
> mojo documentation (used/undeclared and unused/declared categories, the
> bytecode-analysis limitations, `failOnWarning`, `ignoreUnusedRuntime`,
> `ignoredUnusedDeclaredDependencies`, `ignoredUsedUndeclaredDependencies`) and
> the maven-enforcer-plugin **3.6.3** rule pages for `dependencyConvergence`
> (the Jaxen 1.1.3 / 2.0.0 example, `excludedScopes` defaulting to `provided`
> and `test`, `uniqueVersions`, `includes`/`excludes`) and
> `requireUpperBoundDeps` (*"the version for each dependency resolved during a
> build is equal to or higher than highest version found in the transitive
> dependencies"*).

**Everything in the previous three chunks is *policy* — a scope, a managed
version, a BOM. None of it notices when the policy is incomplete and mediation
quietly picks something incoherent, because neither Maven nor Gradle treats a
version conflict as an error. The last piece is therefore not a fix at all. It
is a check that turns tomorrow's silent downgrade into today's red build.**

Three of them exist, and they answer genuinely different questions.

## `dependency:analyze` — is the POM honest?

```bash
mvn dependency:analyze
mvn dependency:analyze -DfailOnWarning=true      # in CI
```

It compares what the POM declares against what the compiled bytecode actually
references, and reports two categories:

- **Used, undeclared** — you import types from an artifact you receive only
  *transitively*. It compiles today and breaks the day the intermediate library
  drops that dependency or moves it to a scope that no longer propagates. This
  finding is almost never a false positive, and the fix is always the same:
  declare it directly.
- **Unused, declared** — dead weight, or a false positive. Both are common.

It is a **bytecode** analyser, and its documentation names the blind spots:
constants inlined at compile time, reflective usage, and `SOURCE`/`CLASS`-
retention annotations are all invisible to it. So `ServiceLoader`-discovered
implementations — JDBC drivers, SLF4J bindings — are reported as unused
whenever they are doing their job correctly.

Silence those deliberately rather than structurally:

```xml
<configuration>
  <failOnWarning>true</failOnWarning>
  <ignoreUnusedRuntime>true</ignoreUnusedRuntime>   <!-- drivers, log bindings -->
  <ignoredUnusedDeclaredDependencies>
    <dep>org.projectlombok:lombok</dep>              <!-- SOURCE retention -->
  </ignoredUnusedDeclaredDependencies>
</configuration>
```

**Never resolve an analyzer warning by widening a scope.** Moving a `runtime`
driver to `compile` makes the message go away and re-opens the API boundary
[topic 02](../02-dependency-scopes/README.md) exists to close.

## Enforcer `dependencyConvergence` — does the graph agree with itself?

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-enforcer-plugin</artifactId>
  <version>3.6.3</version>
  <executions><execution><id>enforce</id>
    <goals><goal>enforce</goal></goals>
    <configuration><rules>
      <dependencyConvergence/>
    </rules></configuration>
  </execution></executions>
</plugin>
```

It fails the build whenever one artifact is requested at **different versions**
anywhere in the tree — the rule's own example is one dependency wanting Jaxen
1.1.3 while another wants 2.0.0. It excludes `provided` and `test` scopes by
default (`excludedScopes`), takes `includes` / `excludes` on
`groupId[:artifactId][:version][:type][:scope][:classifier]` patterns, and has
`uniqueVersions` for comparing timestamped snapshots.

This is the strict option, and it should be adopted with eyes open. On a mature
Spring Boot service it will fail immediately and produce dozens of violations,
because a large graph is *always* internally inconsistent somewhere. Turning it
on is a commitment to supply a managed version for every disagreement — which
is excellent discipline for a library and often exhausting for an application.

## Enforcer `requireUpperBoundDeps` — did mediation downgrade anything?

The rule requires that *"the version for each dependency resolved during a
build is equal to or higher than highest version found in the transitive
dependencies."* That is a far narrower claim than convergence: **disagreement
is fine, losing to a lower version is not.**

It is precisely the nearest-wins downgrade from
[chunk 1](01-the-graph-and-who-wins.md), caught at build time — Gradle's
highest-wins rule retrofitted onto Maven as an assertion rather than a policy.
Same default `excludedScopes` (`test`, `provided`), same `includes` /
`excludes` shape, same `uniqueVersions`.

**Start here.** It has a much better signal-to-noise ratio than convergence, it
maps directly onto the failure that actually pages people
(`NoSuchMethodError` in a library nobody changed), and convergence can be
layered on afterwards — scoped with `<includes>` to the stacks you care about —
once the real downgrades are gone.

## The order to adopt them

1. **`requireUpperBoundDeps`.** Fails only on genuine downgrades, so it has a
   realistic chance of going green this week.
2. **A BOM** — usually `spring-boot-dependencies` — so the large managed set
   stops being decided by graph shape at all
   ([chunk 3](03-boms-and-platforms.md)).
3. **`dependency:analyze` with `failOnWarning`**, once every *used undeclared*
   finding is declared and the known false positives are explicitly ignored.
4. **`dependencyConvergence` last**, narrowed with `<includes>`. Switching it
   on cold produces dozens of failures and gets disabled again by whoever is on
   call at the time.

## When the guards are not worth it

- **A single-module service under a Boot parent already has most of this.** The
  BOM pins the managed set; Enforcer then only covers the handful of artifacts
  Boot does not manage. Real value, but small — and the rules cost build time
  on every module.
- **Guards report; they do not decide.** Every violation still needs a human to
  choose a version, and a rule that produces findings nobody triages is worse
  than no rule, because it trains the team to ignore red.
- **They cannot see reflection or runtime wiring.** A guard that says the graph
  is coherent has verified coordinates and versions, not that the combination
  works. Only running the artifact does that.
- **`excludedScopes` defaults hide test-only problems.** Both Enforcer rules
  skip `test` and `provided` by default, which is the right default for
  shipping correctness and the wrong one if your flaky test suite is being
  caused by a downgraded test library.

## Gotchas

**Symptom:** `dependencyConvergence` is enabled and the build has been red for three weeks with dozens of violations
**Cause:** the rule demands the *entire* graph agree on every artifact, which a large application graph never does out of the box
**Fix:** start with `requireUpperBoundDeps` — only downgrades fail — then reintroduce convergence narrowed with `<includes>` to the artifacts that actually matter: the JSON, logging and HTTP stacks

**Symptom:** `dependency:analyze` reports an artifact as *used undeclared*, everything works, and it gets ignored for a year
**Cause:** you are importing types from something you receive only transitively. It works right up until the intermediate library drops or re-scopes that dependency, at which point compilation breaks for a reason unrelated to anything you changed
**Fix:** declare it directly at the scope you need. This is the one finding that is almost never a false positive

**Symptom:** the Enforcer plugin is configured in the POM and has never once failed a build
**Cause:** the `enforce` goal is not bound to an execution, or the execution has no `<goals>` — the configuration block is inert without it. A rule that never runs looks exactly like a rule that always passes
**Fix:** verify with `mvn enforcer:enforce` explicitly, and confirm the rule appears in the build log; a guard nobody has seen fail is a guard nobody has tested

**Symptom:** `failOnWarning=true` fails the build over the PostgreSQL driver, so someone changes its scope from `runtime` to `compile` and the build goes green
**Cause:** the driver is `ServiceLoader`-discovered, invisible to bytecode analysis, and therefore always reported as *unused declared*. Widening the scope silences the symptom by removing the boundary
**Fix:** set `ignoreUnusedRuntime` or list the artifact in `ignoredUnusedDeclaredDependencies`. Scopes are never an answer to an analyzer warning

**Symptom:** a test library was silently downgraded, tests behave oddly, and both Enforcer rules pass
**Cause:** `dependencyConvergence` and `requireUpperBoundDeps` both default `excludedScopes` to `test` and `provided`, so nothing in the test graph is checked at all
**Fix:** override `excludedScopes` deliberately if the test classpath matters to you, and expect considerably more noise when you do

## Interview questions

**★ What does `dependency:analyze` check, and which of its two findings is more urgent?**
It compares declared dependencies against actual bytecode usage and reports
*used undeclared* and *unused declared*. **Used undeclared** is the urgent one:
you are compiling against something received only transitively, so an unrelated
upstream change can break your compile with no change of yours. *Unused
declared* is frequently a false positive, because bytecode analysis cannot see
inlined constants, reflection, or `SOURCE`/`CLASS`-retention annotations —
`ServiceLoader`-found JDBC drivers, logging bindings and Lombok are the
everyday examples.

**★ `dependencyConvergence` versus `requireUpperBoundDeps` — what does each assert, and which would you adopt first?**
`dependencyConvergence` asserts the whole graph agrees: no artifact may appear
at two different versions anywhere, and it fails if one does.
`requireUpperBoundDeps` asserts only that the *resolved* version is at least as
high as the highest version requested transitively — disagreement is tolerated,
downgrades are not. Adopt upper-bound first: it targets exactly the nearest-wins
downgrade that produces runtime `NoSuchMethodError`, and it will not bury you in
findings on day one. Both default to excluding `test` and `provided`.

**★ Why does Maven need `requireUpperBoundDeps` at all when Gradle does not?**
Because Maven's mediation rule is nearest-wins, which can select a version
*lower* than something in the graph was compiled against, and it does so
silently. Gradle's default is highest-wins, so the downgrade cannot arise from
mediation in the first place. The rule is effectively Gradle's policy
reimplemented as a Maven assertion — which is also why it is the highest-value
guard to add to an existing Maven build.

**★ You inherit a service with no dependency guards. Where do you start?**
`requireUpperBoundDeps` first, because it fails only on genuine downgrades and
can plausibly go green quickly. Then a BOM, so the large managed set stops
being decided by graph shape. Then `dependency:analyze` with `failOnWarning`,
once the *used undeclared* findings are declared and the known false positives
are explicitly ignored. `dependencyConvergence` last and narrowed with
`<includes>` — enabling it cold produces dozens of failures and gets switched
off again by whoever is on call.

---

← Prev: [BOMs and platforms](03-boms-and-platforms.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Gradle](../04-gradle/README.md)
