---
title: "Helidon bets on virtual threads, and the rest of the field"
sidebar_label: "4 · Helidon and the rest"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the Helidon documentation *Helidon SE
> Introduction* (helidon.io/docs/v4/se/introduction), the Helidon project site
> (helidon.io), the Helidon GitHub releases page
> (github.com/helidon-io/helidon/releases), and the MicroProfile 7.1 release
> announcement and release index (microprofile.io). Spring Boot 4.1.0 is the
> comparison baseline; JDK 25.

**Helidon does not belong in the same sentence as Quarkus and Micronaut, and
putting it there is the mistake most comparison articles make. Its
distinguishing bet is not build-time dependency injection — it is virtual
threads. Helidon 4's web server, Níma, was written from scratch on virtual
threads rather than on an event loop, which makes it the clearest existing
expression of the argument this phase already made in
[Topic 15](../15-webflux-reactive/11-why-virtual-threads-changed-the-answer.md):
that Loom removed the reason to write reactive code. And Helidon comes in two
flavours that are genuinely different products, so "we use Helidon" tells you
almost nothing until someone says SE or MP.**

## The two flavours

| | **Helidon SE** | **Helidon MP** |
|---|---|---|
| Model | A set of libraries you call directly — routes, config, security, observability wired by hand | Declarative: MicroProfile, which means Jakarta REST (JAX-RS) and CDI |
| DI | **None.** You construct things | CDI, so annotation-driven like Quarkus's ArC |
| Slogan | *"No magic. Just Java."* | Familiar to anyone from a Jakarta EE background |
| Who it suits | Someone who wants to read the whole call path and accept the verbosity | Someone who wants Spring-shaped ergonomics on a vendor-neutral spec |

The SE side is worth understanding even if you never use it, because it is the
one framework here that answers the question "what if we simply did not have a
container?" You register routes as lambdas, you build your own objects, and
there is no wiring phase because there is nothing to wire. That has a real cost
— you write the plumbing — and a real benefit: there is exactly one way for a
request to reach your code and you can read it.

Helidon MP is the opposite posture, and both are supported first-class. The
project explicitly positions them as a choice, not as a beginner and an advanced
tier.

## Níma and the virtual-thread bet

The project describes its web server as *"the world's first web server written
from scratch that is fully based on virtual threads"*, and the SE
documentation states it plainly: *"Helidon 4 uses Java 21 virtual threads
throughout the WebServer, so applications can use a simple blocking style
without tying up platform threads for each request."*

Note what this is *not*. It is not thread-per-request on platform threads with
a bigger pool, and it is not an event loop with a callback API. It is
thread-per-request where the thread is cheap, which is the model
[Topic 01 — Thread-per-request](../01-why-frameworks-servlet-model/05-thread-per-request.md)
describes and
[Topic 01 chunk 6](../01-why-frameworks-servlet-model/06-living-with-virtual-threads.md)
brings up to date. Helidon 3 was reactive; Helidon 4 deliberately abandoned that
in favour of blocking code on virtual threads.

🔴 **This is the interesting part of Helidon, and it is an architectural
argument rather than a performance claim.** Spring can also run on virtual
threads — `spring.threads.virtual.enabled=true` — but Spring's servlet stack
was designed for platform threads and adapted. Helidon 4 was designed for
virtual threads and has no legacy to carry. Whether that difference is worth
anything to you is a fair question; the *claim* is at least a coherent one, and
it is not the build-time-DI claim at all.

## MicroProfile, for a reader who has only seen Spring

MicroProfile is a set of vendor-neutral specifications for the things a
microservice needs beyond Jakarta REST and CDI. You write against the API and
your runtime — Helidon MP, Quarkus, Open Liberty, WildFly, Payara — provides
the implementation, in the same way JPA is a spec and Hibernate is one
implementation.

Mapping the specs onto what you already know:

| MicroProfile spec | The Spring thing it corresponds to |
|---|---|
| MicroProfile **Config** | `Environment`, `@Value`, `@ConfigurationProperties` |
| MicroProfile **Health** | Actuator's `/actuator/health` and health indicators |
| MicroProfile **Telemetry** | Micrometer plus OpenTelemetry tracing |
| MicroProfile **OpenAPI** | springdoc's generated OpenAPI document |
| MicroProfile **JWT Authentication** | Resource-server JWT support in Spring Security |
| MicroProfile **Rest Client** | Framework 7's HTTP service interfaces / `@ImportHttpServices` |
| MicroProfile **Fault Tolerance** | Framework 7's `@Retryable`, `@ConcurrencyLimit`, `@EnableResilientMethods` |

The current platform release is **MicroProfile 7.1**, released **17 June 2025**,
built on the **Jakarta EE 10 Core Profile** — note, *10*, not 11 — with Java SE
11 source and target compatibility. MicroProfile 7.0 replaced MicroProfile
Metrics with the broader Telemetry 2.0. No MicroProfile 8 appears on the
release index as of this writing.

🔴 **The trade MicroProfile offers is portability for currency.** Because it is
a committee spec with multiple implementations, it moves at spec pace and its
baselines lag — a platform release aligned to Jakarta EE 10 Core with a Java SE
11 floor, next to Spring Boot 4.1 on Jakarta EE 11 and Jackson 3. If
vendor-neutrality is a procurement requirement or a hedge, that lag is the price.
If it is not, you are paying it for nothing.

## Helidon versions, as of writing

- Helidon **4** requires **Java 21 as a minimum**; the project documentation
  states **Java 25 is recommended**.
- The current line is **4.5.x**. ⚠️ The exact latest patch differed between the
  project home page and the GitHub releases listing when checked, so treat the
  patch number as something to confirm on
  [github.com/helidon-io/helidon/releases](https://github.com/helidon-io/helidon/releases)
  rather than taking a number from here.
- There is **no Helidon 5**; the maintained majors are 3 and 4.
- Helidon **3** requires Java 17 or newer and is the reactive generation — if
  you meet a Helidon 3 codebase, expect reactive APIs, not virtual threads.

## The rest of the field, in one line each

Not sections, because a reader needs to *recognise* these rather than evaluate
them:

- **Jakarta EE application servers** — Open Liberty, WildFly, Payara, TomEE.
  The pre-Boot model: a container you deploy a WAR into, with the spec APIs
  provided. Still very much alive in enterprises, and Open Liberty in
  particular is a serious modern runtime. If someone says "we deploy to an app
  server", this is what they mean, and it changes assumptions about class
  loading, packaging and lifecycle that this entire phase takes for granted.
- **Vert.x** — a reactive, event-loop toolkit rather than an opinionated
  framework, and one of the things Quarkus is built on internally. Choose it
  when you want the event loop deliberately, not because you want a
  microservice framework.
- **Ktor** — Kotlin-first, coroutine-based, from JetBrains. The natural reach
  for a team that has already gone all-in on Kotlin and finds Spring's
  Java-shaped idioms a poor fit. Worth knowing exists before someone proposes
  it as though it were a Java option.
- **Dropwizard** — the historical predecessor to all of this: Jetty plus Jersey
  plus Jackson plus Metrics assembled into an opinionated whole, years before
  Spring Boot made that the norm. You will meet it in older services, and its
  metrics library is the ancestor of a good deal of what came after.

## Gotchas

**⚠️ Treating "Helidon" as one framework**
**Symptom:** An estimate, a hiring conversation or an architecture review that
assumes the wrong programming model entirely.
**Cause:** SE and MP share a name, a release train and a web server, and share
almost nothing else — one has no dependency injection at all.
**Fix:** Always qualify it. Ask "SE or MP?" as the first question, and write it
that way in your own documents.

**⚠️ Expecting a Helidon 3 codebase to look like Helidon 4**
**Symptom:** Reactive types and callback chains in code that documentation
describes as blocking.
**Cause:** Helidon 4 replaced the reactive web server with Níma. The migration
across that boundary is not a version bump.
**Fix:** Establish the major version before reading anything — the two
generations answer the concurrency question in opposite ways.

**⚠️ Assuming MicroProfile means "current"**
**Symptom:** A team picks a MicroProfile runtime expecting Jakarta EE 11 and
recent baselines, and finds older ones.
**Cause:** MicroProfile 7.1 is built on the Jakarta EE 10 Core Profile with a
Java SE 11 source and target floor.
**Fix:** Check the spec's stated baseline rather than the runtime's marketing —
a runtime may well support a newer JDK than the spec it certifies against, and
those are two different facts.

**⚠️ Reading "written for virtual threads" as a benchmark claim**
**Symptom:** A framework choice defended on throughput with no measurement.
**Cause:** The virtual-thread argument is about *programming model* — blocking
code that scales — not about beating an event loop on requests per second.
**Fix:** Make the argument you can actually defend: that you get readable stack
traces, working debuggers and ordinary `ThreadLocal` semantics while still
handling many concurrent connections. That is the claim, and it is a good one.

## Interview questions

**★ What distinguishes Helidon from Quarkus and Micronaut?**
The axis is different. Quarkus and Micronaut are build-time-DI frameworks —
their pitch is that the wiring happens during compilation. Helidon 4's pitch is
concurrency: it rewrote its web server from scratch on virtual threads so you
can write blocking code and still handle high concurrency, and it dropped the
reactive stack it had in version 3 to do it. It also ships in two genuinely
different flavours, SE with no dependency injection at all and MP built on
MicroProfile's CDI-and-JAX-RS model. Grouping all three as "the fast
alternatives to Spring" loses the only interesting distinction.

**★ What is MicroProfile, and would you choose it over Spring?**
It is a set of vendor-neutral specifications — Config, Health, Telemetry,
OpenAPI, JWT auth, Rest Client, Fault Tolerance — that several runtimes
implement, so you code against the API and swap the runtime. I would choose it
when portability across vendors is a genuine requirement, typically because
it is contractual or because an organisation is standardising across teams that
already run different app servers. Otherwise I would not, because the price is
currency: the current platform release sits on the Jakarta EE 10 Core Profile
with a Java SE 11 floor, while Spring Boot 4.1 is on Jakarta EE 11 and Jackson
3. Paying a lag for a portability nobody exercises is a bad trade.

**★ Helidon SE has no dependency injection. Is that a problem?**
It is a design position, and whether it is a problem depends on the size of the
service. For something small and focused, wiring by hand is genuinely clearer —
there is one call path, it is visible, and there is no container behaviour to
learn or debug. It stops scaling when the object graph gets large and the same
few dependencies have to be threaded through many constructors by hand, which
is precisely the pain that made DI containers popular in the first place. So I
would read Helidon SE as a deliberate offer: you accept assembly work in
exchange for no framework between you and the code.

**★ You inherit a service and see `io.helidon.reactive` imports. What do you conclude?**
That it is Helidon 3 or earlier, so it predates the Níma rewrite, and that the
concurrency model is reactive rather than virtual-threaded. That tells me the
upgrade path to Helidon 4 is a rewrite of the request-handling layer rather
than a dependency bump, and it tells me the maintenance cost of the current
code includes everything Topic 15 lists about reactive: stack traces that do
not describe the call, `ThreadLocal`-based mechanisms needing reactive
counterparts, and colour propagating through the codebase.

**★ Where do Jakarta EE application servers still make sense?**
Where the operational model is already built around them: an ops team that
deploys WARs into a managed container, vendor support contracts, and
applications that expect container-provided resources like JNDI datasources.
That is not a fashion argument, it is an organisational one, and it is often
decisive. Open Liberty in particular is a modern runtime, not a legacy one, and
it is a reasonable target for new work in a shop that already runs it. What I
would not do is deploy a WAR into an app server for a new greenfield service in
an organisation that has no existing investment in one.

**★ Both Quarkus and Helidon MP use CDI. What would make you pick one over the other?**
The question is really about what else comes with it. Quarkus's value is the
build-time augmentation and the extension ecosystem around it, so it suits a
team that wants fast startup, a small footprint and a native-image path, and is
willing to live with build-time-fixed configuration and a curated library set.
Helidon MP's value is that it is a straightforward MicroProfile runtime on a
virtual-threaded server, without the build-time model or its constraints, so it
suits a team that wants spec portability and a conventional runtime. If the
driver is cold start, Quarkus. If the driver is a MicroProfile codebase that
should keep working exactly as it does, Helidon MP.

**★ What is Vert.x and why does it keep appearing next to Quarkus?**
Vert.x is a reactive, event-loop toolkit rather than an opinionated framework —
you assemble it rather than being handed a shape — and Quarkus uses it
internally as part of its reactive stack. So a Quarkus stack trace or dependency
tree containing Vert.x is normal and is not a sign that anyone chose it. As a
direct choice, I would reach for Vert.x only when I specifically want the event
loop and the control it gives, which after virtual threads is a much narrower
set of situations than it used to be.

---

← Prev: [Micronaut](03-micronaut.md) · Index: [16 · The alternatives](README.md) · Next → [The closed world](05-the-closed-world.md)
