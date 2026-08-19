---
title: "Transitivity, optional, and what actually ships"
sidebar_label: "2 · Transitivity and what ships"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Maven guide *Introduction to the Dependency
> Mechanism* (the *Dependency Scope* transitivity table, optional dependencies,
> `import` scope), the maven-dependency-plugin `analyze` mojo page (the
> bytecode-analysis limitations and `ignoreUnusedRuntime` /
> `ignoredUnusedDeclaredDependencies`) and `tree` mojo page (`scope`), and the
> Spring Boot Maven plugin *Packaging Executable Archives* documentation
> (`includeOptional`, `includeSystemScope`, `excludeDevtools`, `<excludes>`).
> Maven 3.9.16, JDK 25 target.

**A scope you declare is not the scope you get. When a dependency arrives
transitively, Maven *rewrites* its scope according to a fixed table — and that
table, plus the packaging plugin's own opinion about `provided`, explains
almost every "why is that jar here" and "why can't I import that class"
question you will ever be asked.**

## Scope transitivity — the mechanism nobody knows

When a dependency **A** that you declared brings in its own dependency **B**,
B's scope in *your* build is not the scope A gave it. It is:

| Your scope for A ↓ / A's declared scope for B → | `compile` | `provided` | `runtime` | `test` |
|---|---|---|---|---|
| **`compile`** | `compile` | — | `runtime` | — |
| **`provided`** | `provided` | — | `provided` | — |
| **`runtime`** | `runtime` | — | `runtime` | — |
| **`test`** | `test` | — | `test` | — |

An em dash means **omitted entirely** — B never enters your build at all.

Read the *columns* first, because that is where the design lives:

- **The `provided` and `test` columns are empty.** Neither is ever transitive.
  This is why depending on a library does not drag in its JUnit stack, and why
  depending on a war-bound library does not hand you a servlet API. It is also
  precisely why `provided` gets abused as an exclusion mechanism.
- **The `runtime` column is `runtime` everywhere.** A `compile` dependency's
  `runtime` dependency lands on your runtime and test classpaths but **not**
  your compile classpath. So you can see it in `dependency:tree`, it is
  unambiguously inside your fat jar, and `import` still will not resolve. That
  is not a bug — that is the table.
- **The `provided` row demotes an entire subtree.** Everything reached through
  a `provided` dependency becomes `provided` too, however it was declared.
  Mark one dependency `provided` and its whole graph stops being shipped.

Now read the diagonal: **scope is rewritten, never promoted.** Nothing in this
table ever makes a dependency *wider* than the path that reached it. If you
need a transitive jar on your compile classpath, the only answer is to declare
it directly — which is the correct fix regardless, and exactly what
`dependency:analyze` will tell you to do.

## `import` — the scope that is not a classpath

For completeness, since it appears in the same `<scope>` element and means
something entirely different: `import` is legal only on a dependency of
`<type>pom</type>` inside `<dependencyManagement>`, and it substitutes that
POM's `dependencyManagement` block in place. It puts nothing on any classpath
and, in the guide's words, imported dependencies *"do not actually participate
in limiting the transitivity of a dependency"*. It is the BOM mechanism, and it
is covered in
**[Transitive dependencies and mediation](../03-transitive-and-mediation/README.md)**.

## `optional` is not a scope

```xml
<dependency>
  <groupId>com.acme</groupId>
  <artifactId>fancy-codec</artifactId>
  <version>2.4.0</version>
  <optional>true</optional>
</dependency>
```

`<optional>` is an orthogonal boolean that can sit on a dependency of any
scope. It changes exactly one thing: **the edge does not propagate**. You get
`fancy-codec` on your own classpath at its declared scope; anyone depending on
*you* does not. The guide's phrasing is the one to memorise — optional
dependencies are *"excluded by default."*

It exists for libraries with pluggable back ends: a logging façade supporting
six sinks, a serializer supporting three formats. You compile against all of
them; consumers opt in to the one they use by re-declaring it.

Two things people consistently get wrong:

- **`optional` is a promise you must keep in code.** Touch an optional type on
  a path a consumer can reach without re-declaring the dependency and they get
  `NoClassDefFoundError`. Optional types belong behind a `Class.forName` probe
  or a `ServiceLoader` lookup with a real fallback — not behind an `if`.
- **`optional` and `provided` are not synonyms.** `provided` is a claim about
  the **runtime environment** ("the container has this") and removes the jar
  from your own runtime classpath and package. `optional` is a claim about
  **consumers** ("you may not want this") and leaves the jar fully present in
  your own build.

## Spring Boot repackaging changes the `provided` answer

This is the one place where the tables above stop predicting what ships, and it
surprises nearly everyone. The `spring-boot-maven-plugin` `repackage` goal
builds `BOOT-INF/lib` from `compile` **and `provided`** — its documentation's
own framing is that *"a Spring Boot project should consider `provided`
dependencies as 'container' dependencies that are required to run the
application."*

| | plain jar / war | Boot fat jar (`repackage`) |
|---|---|---|
| `compile`, `runtime` | packaged | packaged |
| `provided` | **not** packaged | **packaged** |
| `optional` | packaged | not packaged unless `includeOptional=true` |
| `system` | not packaged | not packaged unless `includeSystemScope=true` |
| `test` | not packaged | not packaged |
| `spring-boot-devtools` | packaged | excluded (`excludeDevtools`, default `true`) |

That inversion is what lets one Boot **war** carry `spring-boot-starter-tomcat`
at `provided`, deploy into an external Tomcat with no duplicate container, and
*still* run standalone under `java -jar` — the servlet container is out of
`WEB-INF/lib` but inside `BOOT-INF/lib`. Convenient, and a trap if you were
using `provided` as an exclusion: it excluded nothing.

**To keep something out of a Boot artifact, use the plugin's `<excludes>` /
`<excludeGroupIds>` configuration, or a real `<exclusion>` on the dependency
that drags it in.** Scope is not an exclusion mechanism in a Boot build.

## How you check what actually ships

Do not reason about this from the POM. Ask the tools:

```bash
# resolved graph with scopes, one line per artifact
mvn dependency:list -Dsort=true

# only what the runtime classpath will contain
mvn dependency:tree -Dscope=runtime

# the literal classpath string the JVM would be given
mvn dependency:build-classpath -Dmdep.outputFile=cp.txt

# declared-but-unused and used-but-undeclared, from bytecode
mvn dependency:analyze
```

Then look inside the artifact, which is the only source of truth:

```bash
jar tf target/app.jar | grep '^BOOT-INF/lib/'
jar tf target/app.war | grep '^WEB-INF/lib/'
```

**A CI guard worth having**, because it catches the leak on the day it is
introduced rather than the day a consumer reports it: fail the build if
anything test-shaped reached the shipped archive — grep that `jar tf` listing
for `junit`, `mockito`, `assertj`, `testcontainers`, and exit non-zero on a
match. It is three lines of shell and it is the only check here that runs
without a human reading output.

⚠️ `dependency:analyze` works on **bytecode**, and its documentation names the
blind spots: constants inlined at compile time, reflective usage, and
`SOURCE`/`CLASS`-retention annotations are all invisible to it. That is why a
`runtime`-scoped JDBC driver or an SLF4J binding is reported as *unused
declared* — nothing names it in bytecode, `ServiceLoader` finds it at runtime.
Silence those deliberately with `ignoreUnusedRuntime` or
`ignoredUnusedDeclaredDependencies`, and **never** by widening the scope.

## When scope discipline is not worth it

Honest limits, because "tighten every scope" is bad advice for some projects:

- **A leaf application publishes nothing.** If the artifact is a deployable
  service nothing else depends on, transitivity does not exist for you. Two
  scopes still earn their keep — `test` (keeps test libraries out of production
  bytecode) and `runtime` (enforces an API/impl boundary the compiler can
  check). Auditing `provided` on a Boot service is close to pure ceremony,
  since it ships either way.
- **A published library is the exact opposite.** Every `compile` dependency is
  a constraint on strangers that you cannot withdraw without a breaking change.
  Scope work is the highest-leverage thing in that POM.
- **`provided` buys size and costs you a failure mode.** You have traded a
  build-time guarantee for an environment assumption. If nothing else genuinely
  supplies the jar, take the megabytes.
- **Over-narrowing is churn.** A `runtime` scope somebody has to widen to
  `compile` every time they touch the module was expressing a boundary the code
  does not actually have.

## Gotchas

**Symptom:** `dependency:tree` clearly shows a jar, and `import` of a class from it will not resolve
**Cause:** it arrived transitively through a `compile` dependency that declared it `runtime`; the transitivity table rewrites it to `runtime`, which is on the runtime and test classpaths but not the compile classpath
**Fix:** declare it directly in your own POM at the scope you need. Do not widen the intermediate dependency's scope, and do not add a `compile` entry you cannot justify in `src/main/java`

**Symptom:** you mark a dependency `provided` in a Spring Boot service specifically so it will not ship, and it is in the fat jar anyway
**Cause:** `spring-boot-maven-plugin:repackage` includes `provided` in `BOOT-INF/lib` by design — Boot reads `provided` as "container dependency needed to run"
**Fix:** use the plugin's `<excludes>` / `<excludeGroupIds>`, or a real `<exclusion>` on whatever pulls it in

**Symptom:** someone "tidies" Lombok from `<optional>true</optional>` to `<scope>provided</scope>` and the fat jar grows by Lombok
**Cause:** the two flags land on opposite sides of the repackager's rules — `optional` is skipped unless `includeOptional=true`, `provided` is included. Spring Initializr generates `optional` for exactly this reason
**Fix:** leave Initializr's `<optional>true</optional>` alone; if you need both semantics, set the scope *and* keep `optional`

**Symptom:** module B depends on module A's `test-jar` for shared fixtures, and B's tests die with `NoClassDefFoundError` on JUnit or Testcontainers
**Cause:** A's own `test`-scoped dependencies are not transitive — the `test` column of the table is empty — so B inherits the fixture classes but none of the libraries they were compiled against
**Fix:** declare those libraries at `test` scope in B as well, or move shared fixtures into a real published module with `compile`-scoped dependencies instead of a `test-jar`

**Symptom:** a consumer of your library gets `NoClassDefFoundError` on a codec class that your POM does list
**Cause:** you marked it `<optional>true</optional>` and then used it on a code path the consumer reaches without re-declaring it. Optional means *not propagated*, and keeping the promise is your job
**Fix:** put the optional type behind a `Class.forName` / `ServiceLoader` probe with a working fallback, or make it a non-optional `compile` dependency and accept the weight

**Symptom:** `dependency:analyze` reports the PostgreSQL driver and `logback-classic` as *unused declared*, someone removes them, and the app dies on the first query
**Cause:** the analyzer reads bytecode. Nothing in your code names the driver — `ServiceLoader` discovers it at runtime — so it genuinely looks unused
**Fix:** keep them at `runtime` and silence the report with `ignoreUnusedRuntime` or `ignoredUnusedDeclaredDependencies`. Never resolve an analyzer warning by widening a scope

**Symptom:** a security scan reports CVEs in Byte Buddy and Objenesis in a production image, and nobody can find code that uses them
**Cause:** an unscoped test library pulled its whole transitive graph onto the compile classpath at `compile`, and all of it was packaged
**Fix:** fix the scope, then add the `jar tf | grep` CI guard above so the leak cannot silently return

## Interview questions

**★ I depend on A at `compile`, and A depends on B at `runtime`. Where does B end up, and can I `import` from it?**
B lands in your build at `runtime` scope — on your runtime and test classpaths,
inside your packaged artifact, and *not* on your compile classpath. So `import`
will not resolve even though `dependency:tree` shows B and the jar is
unambiguously shipped. The fix is to declare B directly at the scope you need;
nothing in the transitivity table ever promotes a scope for you.

**★ Which scopes are never transitive, and what does that buy the ecosystem?**
`provided` and `test` — both of their columns in the transitivity table are
empty, and `system` behaves the same way in practice. It means depending on a
library never inherits its test stack or its container APIs, which is the
single reason the Maven ecosystem is usable at all. It is also why `provided`
gets abused as an exclusion mechanism, and why the war plugin's own FAQ
suggests it.

**★ Is `optional` a scope? What does it change, and how does it differ from `provided`?**
No — it is an orthogonal boolean that can accompany any scope. It changes one
thing: the edge does not propagate, so consumers do not inherit it; the guide
calls optional dependencies *"excluded by default"*. `provided` is a claim
about the runtime environment and removes the jar from your own runtime
classpath and package. `optional` is a claim about consumers and leaves the jar
fully present in your own build. They are even packaged differently: Boot's
repackager includes `provided` and skips `optional`.

**★ You mark something `provided` in a Boot service and it still ships. Why, and what is the real fix?**
`spring-boot-maven-plugin:repackage` deliberately includes `provided`
dependencies in `BOOT-INF/lib`, treating them as container dependencies
required to run the application — which is what lets one artifact both deploy
as a war and run under `java -jar`. Scope is therefore not an exclusion
mechanism in a Boot build. The fix is the plugin's `<excludes>` /
`<excludeGroupIds>`, or an `<exclusion>` on the dependency that pulls it in.

**★ How do you find out what actually ships, and why is the POM not enough?**
The POM describes intent; three separate layers stand between it and the
archive — transitive scope rewriting, the packaging plugin's rules, and any
`<excludes>` configuration. So you ask the tools: `mvn dependency:list
-Dsort=true` and `mvn dependency:tree -Dscope=runtime` for the resolved graph,
`dependency:build-classpath` for the literal classpath, and then `jar tf` on
the built archive filtered to `BOOT-INF/lib/` or `WEB-INF/lib/`, which is the
only source of truth. Worth making a CI check rather than a manual one.

**★ `dependency:analyze` says a dependency is "unused declared". When is it right and when is it lying?**
It is right when the dependency really is dead weight — a library nothing
imports any more, usually left over from a deleted feature. It lies whenever
usage is invisible in bytecode, and its documentation names the cases: compile-
time-inlined constants, reflection, and `SOURCE`/`CLASS`-retention annotations.
`ServiceLoader`-discovered implementations — JDBC drivers, SLF4J bindings — are
the everyday example, which is why the plugin ships `ignoreUnusedRuntime` and
`ignoredUnusedDeclaredDependencies`. Silence it there; never widen the scope to
make the warning go away.

---

← Prev: [The five classpath scopes](01-the-five-scopes.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Transitive dependencies and mediation](../03-transitive-and-mediation/README.md)
