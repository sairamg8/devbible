---
title: "SLF4J is an interface with no implementation and Logback is an implementation that happens to be that interface, and understanding which of the two you are configuring is what separates a five-minute logging fix from an afternoon"
sidebar_label: "02 · The facade and the backend"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **SLF4J 2.0.18 manual**, including the provider/ServiceLoader
> section and the "no SLF4J providers were found" message
> ([slf4j.org](https://www.slf4j.org/manual.html)), the **SLF4J FAQ**
> ([slf4j.org](https://www.slf4j.org/faq.html)), the **Logback news page** for the current release
> series ([logback.qos.ch](https://logback.qos.ch/news.html)), and
> **`spring-boot-dependencies:4.1.1`** for the managed versions
> ([repo1.maven.org](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom)).
> 🔴 **No sandbox.** JDK 25 · Spring Boot 4.1.1 · SLF4J 2.0.18 · Logback 1.5.34.

**Your code calls `org.slf4j.Logger`. Nothing in `org.slf4j` writes anything anywhere. The bytes
reach a file because a separate artifact on the classpath implements that interface, and the two
are wired together at startup by `ServiceLoader` with no compile-time link between them. Every
confusing logging problem — no output, duplicate output, output at the wrong level, a
`logback.xml` that is ignored — is a question about which side of that seam you are looking at.**

## The split, and why it exists

SLF4J is *"a simple facade or abstraction for various logging frameworks"* — an API jar with
interfaces and almost no behaviour. Logback, Log4j 2 and `java.util.logging` are backends: they
own configuration files, appenders, encoders and the actual I/O.

The reason the split exists is a library problem, not an application problem. The SLF4J manual is
explicit about it:

> *"Embedded components such as libraries or frameworks should not declare a dependency on any
> SLF4J binding/provider but only depend on slf4j-api. When a library declares a transitive
> dependency on a specific binding, that binding is imposed on the end-user negating the purpose
> of SLF4J."*

🔴 **That is the whole design.** Hibernate, Jackson, HikariCP and Spring all want to log. If each
one depended on a concrete framework, an application would end up running three logging systems
with three configuration files and no single place to set a level. Because they all depend only
on `slf4j-api`, the *application* picks one backend and every library's output flows into it.

**Corollary for your own code:** if you are writing a library, depend on `slf4j-api` and nothing
else — a provider goes in `test` scope at most. If you are writing an application, depend on
exactly one provider.

## Logback is not "a backend behind SLF4J" — it *is* SLF4J

This is a distinction people miss, and it is why Logback is the default. Most backends need an
adapter jar (`slf4j-jdk14`, `slf4j-reload4j`) that translates SLF4J calls into that framework's
own API. Logback does not. From the manual:

> *"Logback's `ch.qos.logback.classic.Logger` class is a direct implementation of SLF4J's
> `org.slf4j.Logger` interface. Thus, using SLF4J in conjunction with logback involves strictly
> zero memory and computational overhead."*

`LoggerFactory.getLogger(Foo.class)` under Logback returns a `ch.qos.logback.classic.Logger`.
There is no wrapper object, no delegating call, no adapter. Logback and SLF4J are by the same
author and the same project lineage, which is also why SLF4J features land in Logback first —
key-value pairs, the fluent API, `%kvp` ([04b](04b-the-fluent-api.md)).

## How the two find each other

SLF4J 2.x replaced the old mechanism completely, and this matters because the internet is full of
1.7-era advice.

- **SLF4J 1.7 and earlier** looked for a class at a fixed name: `org.slf4j.impl.StaticLoggerBinder`.
  Missing it produced *"Failed to load class `org.slf4j.impl.StaticLoggerBinder`"*.
- **SLF4J 2.0 and later** uses `ServiceLoader`. The manual: *"SLF4J API version 2.0.0 relies on
  the `ServiceLoader` mechanism to find its logging backend."* Providers are declared in
  `META-INF/services/org.slf4j.spi.SLF4JServiceProvider`. Missing it produces:

> *"SLF4J: No SLF4J providers were found. SLF4J: Defaulting to no-operation (NOP) logger
> implementation"*

🔴 **Those two messages are a version fingerprint.** If you see `StaticLoggerBinder` in a stack
trace or a warning, something on the classpath is SLF4J 1.7 or a jar built against it — which is
a real incompatibility, not a cosmetic one, because a 1.7-era *provider* does not implement the
2.x service interface and will not be found by a 2.x API jar.

Since **SLF4J 2.0.9** you can skip the search entirely:

```
-Dslf4j.provider=ch.qos.logback.classic.spi.LogbackServiceProvider
```

The manual describes this as bypassing *"the service loader mechanism for finding providers"*,
and it *"may shorten SLF4J initialization"*. It is worth knowing about for startup-sensitive
workloads — GraalVM native images and CRaC restores — and it also makes the choice explicit
rather than emergent.

## Absence is silent, and that is deliberate

Since SLF4J 1.6, no provider on the classpath does **not** throw. It emits one warning and
discards every log request. The manual justifies it: a library shipping `slf4j-api` with no
binding still works out of the box, and *"only when the end-user decides to enable logging will
she need to install the SLF4J binding"*.

⚠️ **The consequence for an application is nasty.** A misconfigured build that drops the provider
produces a service that starts cleanly, runs correctly, and logs nothing — with a single line of
warning at startup that scrolls past in a container boot sequence. "We have no logs since the last
deploy" is a dependency problem far more often than an infrastructure problem.

## What Spring Boot actually puts on the classpath

Boot 4.1 keeps Logback as the default and manages the versions in `spring-boot-dependencies`:

| Artifact | Version in Boot 4.1.0 |
|---|---|
| `org.slf4j:slf4j-api` | **2.0.18** |
| `ch.qos.logback:logback-classic` / `logback-core` | **1.5.34** |
| `org.apache.logging.log4j` (via `spring-boot-starter-log4j2`) | **2.25.4** |

Three starters exist, and the split is new enough to be worth naming:

- **`spring-boot-starter-logging`** — the default, pulled in by `spring-boot-starter`.
- **`spring-boot-starter-logback`** — Boot 4 exposes Logback as its own starter artifact.
- **`spring-boot-starter-log4j2`** — the swap.

🔴 **Boot itself does not log through SLF4J.** The reference is explicit that Boot *"uses Commons
Logging for all internal logging"* while leaving the underlying implementation open. That is a
historical artefact of Spring Framework's own dependency policy, and the practical consequence is
that `jcl-over-slf4j` is not optional in a Boot application — it is the bridge that gets Spring's
own output into your backend. [02b](02b-the-classpath-problem.md) owns the bridges.

## Getting a logger

One idiom, and the deviations from it are all mistakes:

```java
public class OrderService {
    private static final Logger log = LoggerFactory.getLogger(OrderService.class);
}
```

**`private`** — a logger is not part of the type's contract. **`static`** — one per class, not one
per instance; a non-static logger on a short-lived entity allocates a field per object for no
benefit. **`final`** — nothing should reassign it. **`OrderService.class`** rather than a string
— the string version survives a class rename and silently detaches the logger from its package,
so `logging.level.com.example.order=DEBUG` stops matching it.

⚠️ **`getLogger(getClass())` in a superclass is a real decision, not a typo.** It names the
*subclass*, so a base class's log lines are attributed to whichever concrete class inherited them
— which is sometimes exactly what you want and sometimes scatters one component's output across a
dozen logger names that no single `logging.level` entry can control.

## Levels are resolved by the backend, not the facade

`log.debug(...)` does not decide anything. It asks the backend whether DEBUG is enabled for this
logger name, and the backend answers from its configuration — a hierarchy keyed on dotted logger
names, with each logger inheriting from its nearest configured ancestor and ultimately from
`root`. That is why `logging.level.com.example=WARN` silences everything under `com.example`, and
why the class-literal idiom above matters: the name *is* the configuration key
([03](03-levels.md)).

## Gotchas

**★ `StaticLoggerBinder` in 2026 means a 1.7-era artifact is on the classpath.**
SLF4J 2.x abandoned that mechanism for `ServiceLoader`. The message is not cosmetic — a 1.7
provider does not implement `SLF4JServiceProvider` and will not be found, so the application ends
up on the NOP logger and writes nothing.

**★ No provider is a silent failure by design.**
SLF4J emits one warning and discards everything. A build change that drops the provider produces a
service that works perfectly and logs nothing, with a single line of evidence in the boot
sequence.

**★ Depending on a provider from a library imposes it on every consumer.**
The manual calls this out as *"negating the purpose of SLF4J"*. Library `pom.xml` files get
`slf4j-api` at compile scope and a provider at `test` scope only.

**★ A non-static logger field costs one reference per instance.**
On a class instantiated per request or per row this is pure waste. `private static final` is not
style pedantry; it is the difference between one object and millions.

**★ `LoggerFactory.getLogger("com.example.OrderService")` breaks on rename.**
The string does not follow the class. After a package move the logger keeps the old name, and
every level configuration keyed on the new package silently stops applying to it.

**★ `getLogger(getClass())` in an abstract base class attributes lines to subclasses.**
Sometimes desirable, often surprising: the base class's output appears under half a dozen logger
names and cannot be turned up or down with one property.

**★ Assuming Boot logs through SLF4J internally.**
Boot and Spring Framework log through Commons Logging. Their output only reaches Logback because
`jcl-over-slf4j` is on the classpath. Remove it while "cleaning up dependencies" and Spring's own
startup and error output disappears.

**★ Thinking "SLF4J is slow because it is an abstraction".**
Under Logback there is no abstraction at runtime — `ch.qos.logback.classic.Logger` *implements*
`org.slf4j.Logger`, and the manual states this involves *"strictly zero memory and computational
overhead"*. The cost of logging is in formatting and I/O ([04](04-parameterised-messages.md)),
never in the facade.

## Interview questions

**★ Why does the SLF4J/Logback split exist at all, given that almost everyone uses Logback?**
It exists for libraries, not applications. Hibernate, Jackson, HikariCP and Spring all need to
log, and if each depended on a concrete framework an application would run several logging
systems at once with several configuration files. Because they depend only on `slf4j-api`, the
application chooses one backend and all of that output converges on it. The fact that most
applications then choose Logback does not make the abstraction pointless — it is what allows the
choice to be the application's.

**★ How does SLF4J find its backend, and what changed in 2.x?**
SLF4J 1.7 and earlier looked for a fixed class name, `org.slf4j.impl.StaticLoggerBinder`, loaded
by the classloader. SLF4J 2.0 replaced that with `ServiceLoader`: providers declare
`org.slf4j.spi.SLF4JServiceProvider` in `META-INF/services`. The two failure messages differ, so
they act as a version fingerprint, and since 2.0.9 you can bypass discovery entirely with the
`slf4j.provider` system property — useful when startup time matters.

**★ What happens if there is no SLF4J provider on the classpath?**
Since 1.6, nothing throws. SLF4J prints one warning — *"No SLF4J providers were found"* — falls
back to a no-operation logger, and discards every request. That is deliberate so a library
shipping only `slf4j-api` works out of the box. For an application it is a dangerous failure mode:
the service behaves correctly and produces no logs at all, with one line of warning that is easy
to miss in a container startup.

**★ Is there a performance cost to going through SLF4J rather than calling Logback directly?**
Under Logback, none. `ch.qos.logback.classic.Logger` is a direct implementation of
`org.slf4j.Logger`, so `getLogger` returns the Logback object itself — no adapter, no delegation.
The SLF4J manual describes this as *"strictly zero memory and computational overhead"*. Backends
that need an adapter jar do pay a small indirection, but even there the cost is dwarfed by
message formatting and I/O.

**★ Why `private static final Logger` with a class literal rather than a string?**
`static` because one logger per class is correct and a per-instance field is pure allocation on a
type instantiated frequently. `final` because nothing should reassign it. The class literal
because the logger's *name* is the key that `logging.level.*` configuration matches on — a
hard-coded string does not follow a package move, so after a refactor the logger silently detaches
from the configuration meant to control it.

**★ Spring Boot uses Commons Logging internally. Why does its output still appear in your Logback
file?**
Because `jcl-over-slf4j` is on the classpath. It provides the Commons Logging API surface but
routes every call into SLF4J, which reaches Logback. It is a bridge, not a backend, and it is
required rather than optional in a Boot application — removing it during a dependency cleanup
makes all of Spring's own startup and failure output vanish while your own logging keeps working,
which is a confusing symptom to diagnose.

{/* FOOTER */}
