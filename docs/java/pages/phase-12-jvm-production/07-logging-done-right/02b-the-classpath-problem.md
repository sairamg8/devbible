---
title: "Four logging APIs coexist in every real Java application and the bridges that unify them are one-way valves, so the classic logging incidents — no output, doubled output, and a stack overflow at startup — are all consequences of putting a bridge and its matching binding on the same classpath"
sidebar_label: "02b · The classpath problem"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **SLF4J "Bridging legacy APIs" page**, which is the source of
> every "endless loop" warning quoted below ([slf4j.org](https://www.slf4j.org/legacy.html)), the
> **SLF4J 2.0.18 manual** ([slf4j.org](https://www.slf4j.org/manual.html)), the **Spring Boot 4.1
> reference, "Logging"** — *"Spring Boot uses Commons Logging for all internal logging but leaves
> the underlying log implementation open"*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/logging.html)), the
> **Spring Boot how-to, "Configure Log4j for Logging"**
> ([docs.spring.io](https://docs.spring.io/spring-boot/how-to/logging.html)), and
> **`spring-boot-dependencies:4.1.0`**
> ([repo1.maven.org](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom)).
> 🔴 **No sandbox.** JDK 25 · Spring Boot 4.1.0 · SLF4J 2.0.18 · Logback 1.5.34.

**A dependency tree of any size contains libraries that log through SLF4J, libraries that log
through Commons Logging, libraries that log through Log4j, and the JDK itself logging through
`java.util.logging`. Making all four arrive in one file requires bridge jars, and a bridge is
strictly one-directional. Put a bridge and the binding it inverts on the same classpath and calls
travel in a circle until the stack overflows — which the SLF4J documentation warns about in three
separate places because it keeps happening.**

## The two kinds of jar, and why the names are nearly identical

This is the confusion at the centre of every classpath logging problem, and the artifact naming
does not help.

| Kind | Direction | Examples |
|---|---|---|
| **Provider (binding)** | SLF4J call → *that* framework | `slf4j-reload4j`, `slf4j-jdk14`, `slf4j-jcl`, `logback-classic` |
| **Bridge** | *That* framework's call → SLF4J | `jcl-over-slf4j`, `log4j-over-slf4j`, `jul-to-slf4j`, `log4j-to-slf4j` |

Read the names as arrows. **`slf4j-jcl`** means *SLF4J goes to JCL*. **`jcl-over-slf4j`** means
*JCL is implemented over SLF4J* — the opposite direction. They differ by word order, they are
opposites, and the SLF4J page has an entire section titled *"jcl-over-slf4j.jar should not be
confused with slf4j-jcl.jar"*.

🔴 **The rule, stated once and applied everywhere: exactly one provider, plus one bridge for every
other API in the tree, and never a bridge paired with the provider that inverts it.**

## The three documented infinite loops

The SLF4J documentation names these explicitly. They are not folklore.

**1 · `jcl-over-slf4j` + `slf4j-jcl`:**

> *"Please note that `jcl-over-slf4j.jar` and `slf4j-jcl.jar` cannot be deployed at the same time.
> The former jar file will cause JCL to delegate the choice of the logging system to SLF4J and the
> latter jar file will cause SLF4J to delegate the choice of the logging system to JCL, resulting
> in an infinite loop."*

**2 · `log4j-over-slf4j` + `slf4j-reload4j` (or `slf4j-log4j12`):**

> *"If both are present simultaneously, SLF4J calls will be delegated to reload4j … and log4j 1.x
> calls redirected to SLF4j, resulting in an endless loop."*

**3 · `jul-to-slf4j` + `slf4j-jdk14`:**

> *"if both jar are present simultaneously (and `SLF4JBridgeHandler` is installed), slf4j calls
> will be delegated to jul and jul records will be routed to SLF4J, resulting in an endless
> loop."*

⚠️ **The symptom is not a nice error.** It is a `StackOverflowError` at the moment of the first
log statement — typically during context startup — with a stack of thousands of alternating
frames from the two artifacts. The good news is that the frame pattern names both culprits
directly, so the diagnosis is fast once you know to look for a repeating pair.

## What Spring Boot puts there for you

`spring-boot-starter-logging` (pulled in by `spring-boot-starter`) contributes the provider and
the bridges together:

- **`logback-classic`** — the provider, and a native SLF4J implementation
  ([02](02-the-facade-and-the-backend.md)).
- **`jcl-over-slf4j`** — required, because Boot and Spring Framework log through Commons Logging.
- **`log4j-to-slf4j`** — the *Log4j 2* bridge, a different artifact from SLF4J's own
  `log4j-over-slf4j`, which handles Log4j **1.x** only. The SLF4J page is explicit that
  `log4j-over-slf4j` *"allows log4j 1.x users (but not log4j 2.x)"* to migrate.
- **`jul-to-slf4j`** — the `java.util.logging` handler.

Boot 4.1.0 manages all of these at **`slf4j.version` = 2.0.18**, and also exposes
`spring-boot-starter-logback` as its own artifact alongside `spring-boot-starter-logging` and
`spring-boot-starter-log4j2`.

## `jul-to-slf4j` is the one with a real cost

The others reimplement an API and delegate, which is nearly free. `java.util.logging` cannot be
reimplemented — you may not replace classes under `java.*` — so the bridge installs a *handler*
and translates. The SLF4J documentation is unusually blunt about the price:

> *"this translation process incurs the cost of constructing a `LogRecord` instance regardless of
> whether the SLF4J logger is disabled for the given level or nor. Consequently, j.u.l. to SLF4J
> translation can seriously increase the cost of disabled logging statements (60-fold or 6000%)
> and measurably impact the performance of enabled log statements (20% overall increase)."*

🔴 **Read that carefully: the cost lands on *disabled* statements.** A library logging at FINE
inside a hot loop pays full `LogRecord` construction even though nothing will be written. The
documented remedy is Logback's `LevelChangePropagator`, which pushes SLF4J's effective levels down
into the JUL loggers so JUL declines before building anything:

```xml
<configuration>
  <contextListener class="ch.qos.logback.classic.jul.LevelChangePropagator">
    <resetJUL>true</resetJUL>
  </contextListener>
  <!-- appenders and loggers follow -->
</configuration>
```

SLF4J's own guidance: `SLF4JBridgeHandler` is appropriate only if *"few j.u.l. logging statements
are in play"* or *"`LevelChangePropagator` has been installed"*.

⚠️ **In a plain Boot application you rarely install this yourself**, because Boot's own logging
initialisation handles the JUL bridge. It becomes your problem when you hand-write a
`logback-spring.xml` that does not `<include>` Boot's defaults, or when a dependency is a heavy
JUL user.

## Swapping to Log4j 2, and what it costs

Boot documents the swap as an exclusion plus a starter:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter</artifactId>
  <exclusions>
    <exclusion>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-logging</artifactId>
    </exclusion>
  </exclusions>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-log4j2</artifactId>
</dependency>
```

🔴 **The exclusion has to be repeated on every starter that pulls in `spring-boot-starter`**, which
in a real `pom.xml` is most of them — that is why the Gradle recipe uses a `module { replacedBy }`
rule instead, which is global. A single missed exclusion leaves Logback on the classpath next to
Log4j 2 and you are back to "two providers, one wins arbitrarily".

**What you give up.** Boot's structured-logging support exists for both, but the surrounding
ecosystem is Logback-shaped: `logback-spring.xml` extensions (`springProfile`, `springProperty`)
become `log4j2-spring.xml` equivalents with different capitalisation (`SpringProfile`), the
`logging.logback.rollingpolicy.*` properties become `logging.log4j2.rollingpolicy.*` with a
different set of keys, and every Logback recipe on the internet stops applying.

**What you gain.** Log4j 2's asynchronous loggers are a genuinely different design from Logback's
`AsyncAppender` ([10b](10b-async-appender.md)) — a lock-free ring buffer rather than a blocking
queue — and Log4j 2 has richer built-in JSON layouts. Whether that is worth the switch is a real
question with a real answer either way; what it is not is a free swap.

## Diagnosing it

Two commands answer almost every classpath logging question before you start guessing:

```bash
# Maven: what logging artifacts are actually resolved, and who dragged each one in?
./mvnw dependency:tree -Dincludes='org.slf4j:*,ch.qos.logback:*,org.apache.logging.log4j:*,commons-logging:*'

# Gradle equivalent
./gradlew dependencyInsight --configuration runtimeClasspath --dependency slf4j-api
```

**What you are looking for**, in order: more than one provider; `commons-logging` itself present
alongside `jcl-over-slf4j` (the original JCL jar wins some classloader races and reintroduces the
class-loader problems the bridge exists to solve); any bridge/provider inversion pair from the
table above; and two different `slf4j-api` versions, which Maven resolves by nearest-definition
and can leave you on an SLF4J older than the provider expects.

## Gotchas

**★ `slf4j-jcl` and `jcl-over-slf4j` are opposites whose names differ only in word order.**
One sends SLF4J to Commons Logging, the other implements Commons Logging over SLF4J. Together they
form a documented infinite loop. The same trap exists for `slf4j-jdk14`/`jul-to-slf4j` and
`slf4j-reload4j`/`log4j-over-slf4j`.

**★ The loop presents as a `StackOverflowError` at startup, not as a logging error.**
The first log statement recurses until the stack is exhausted. The stack trace repeats two frames
forever, which names both artifacts — but only if you read past the first screen.

**★ `log4j-over-slf4j` does not bridge Log4j 2.**
It handles Log4j 1.x only; the documentation says so outright. Log4j 2 needs `log4j-to-slf4j`,
which is a different artifact from a different project. Adding the wrong one leaves Log4j 2
libraries logging nowhere.

**★ `jul-to-slf4j` makes *disabled* JUL statements dramatically more expensive.**
Because a `LogRecord` must be built before the level can be consulted — documented as up to
*"60-fold or 6000%"* on disabled statements. `LevelChangePropagator` is the documented fix and is
one XML element.

**★ `commons-logging` still on the classpath next to `jcl-over-slf4j` undoes the bridge.**
Both provide `org.apache.commons.logging.LogFactory`; whichever the classloader finds first wins,
and if it is the original, Spring's output goes through JCL's discovery mechanism instead of
yours. Exclude `commons-logging` globally.

**★ Excluding `spring-boot-starter-logging` from one starter is not enough in Maven.**
Every starter that transitively includes `spring-boot-starter` reintroduces it. Maven exclusions
are per-declaration, so the exclusion must be repeated or expressed as a global rule.

**★ Two `slf4j-api` versions resolve by nearest definition, not highest.**
Maven's mediation can pin you to an older API than the provider was built against. Declare
`slf4j-api` explicitly if you see divergent versions — the SLF4J manual recommends exactly this to
*"fix the correct version … by virtue of Maven's 'nearest definition' dependency mediation rule"*.

**★ A library that ships a provider imposes it on you.**
Some do, against SLF4J's own guidance. The result is a second provider you did not choose,
resolved arbitrarily. The dependency tree names it; the fix is an exclusion on that library.

**★ Swapping to Log4j 2 invalidates every Logback-shaped recipe you have.**
Configuration file name, extension element capitalisation, rolling-policy property names and the
async model all differ. It is a migration, not a toggle.

## Interview questions

**★ Explain the difference between an SLF4J binding and a bridge, and why it matters.**
A binding (provider) implements SLF4J on top of a concrete framework — calls go *out* of SLF4J
into that framework. A bridge implements another framework's public API on top of SLF4J — calls
come *in* to SLF4J from that framework. An application needs exactly one binding and one bridge
for each foreign API in its dependency tree. It matters because pairing a bridge with the binding
that inverts it makes calls travel in a circle: SLF4J to JCL to SLF4J, forever. The SLF4J
documentation names three such pairs and calls each one an endless loop.

**★ Your application throws a `StackOverflowError` on the first log statement at startup. What is
your first hypothesis?**
A bridge and its inverse binding on the same classpath — most commonly `jcl-over-slf4j` alongside
`slf4j-jcl`, or `jul-to-slf4j` alongside `slf4j-jdk14`. Confirm by reading past the top of the
stack for a repeating two-frame cycle naming both artifacts, then run a dependency tree filtered
to logging coordinates to find which dependency dragged the second one in.

**★ Why does Spring Boot need `jcl-over-slf4j` at all if everything modern uses SLF4J?**
Because Boot and Spring Framework themselves do not use SLF4J — the reference says *"Spring Boot
uses Commons Logging for all internal logging but leaves the underlying log implementation open."*
`jcl-over-slf4j` supplies the Commons Logging API surface and routes it into SLF4J. Without it,
Spring's own startup, auto-configuration and failure-analysis output never reaches your appenders,
while your application's own logging keeps working — a confusing partial outage.

**★ Is `jul-to-slf4j` free? Under what circumstances is it not?**
It is not free, and uniquely so among the bridges. `java.util.logging` lives under `java.*` and
cannot be replaced class-for-class, so the bridge installs a handler and translates `LogRecord`
objects — which means the record is constructed before the SLF4J level is consulted. SLF4J
documents the cost on *disabled* statements as up to sixty-fold. The remedy is Logback's
`LevelChangePropagator`, which propagates effective levels into JUL so JUL declines first; SLF4J
recommends the bridge only with that installed or with very little JUL traffic in play.

**★ What actually breaks when you switch a Boot application from Logback to Log4j 2?**
Mechanically: you must exclude `spring-boot-starter-logging` from every starter that pulls it in,
which in Maven is per-declaration and easy to miss — one miss leaves both providers present.
Then the configuration surface changes: `logback-spring.xml` becomes `log4j2-spring.xml`,
`springProfile` becomes `SpringProfile`, and `logging.logback.rollingpolicy.*` becomes
`logging.log4j2.rollingpolicy.*` with different keys. Boot's structured logging works with either,
so that is not the deciding factor; the async model and JSON layout ecosystem are.

**★ How would you audit a service's logging classpath before you touch anything?**
Resolve the dependency tree filtered to `org.slf4j`, `ch.qos.logback`,
`org.apache.logging.log4j` and `commons-logging`, and check four things: exactly one provider;
no bridge paired with its inverse binding; no original `commons-logging` jar alongside
`jcl-over-slf4j`; and a single `slf4j-api` version, since Maven's nearest-definition rule can
silently pin an older API than the provider expects. That audit takes a minute and pre-empts most
of the failures in this chunk.

{/* FOOTER */}
