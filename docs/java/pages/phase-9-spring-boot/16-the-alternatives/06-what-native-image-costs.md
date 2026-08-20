---
title: "What native image costs, and the narrow case where it pays"
sidebar_label: "6 · What it costs"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the GraalVM guides *Debug Native Executables with
> GDB* and *Build and Run Native Executables with JFR*
> (graalvm.org/latest/reference-manual/native-image/guides/), the GraalVM
> release calendar (graalvm.org/release-calendar/), and the Spring Boot
> reference *Advanced Native Images Topics*
> (docs.spring.io/spring-boot/reference/packaging/native-image/). Spring Boot
> 4.1.0, JDK 25.

**A reader should finish this chunk able to argue *against* native image for
their own team, because for most teams that is the correct answer. You are
trading the dynamic half of the platform, a large part of your observability
and debugging toolchain, and minutes on every release build, for startup
latency. That is a good trade in a narrow and identifiable set of cases and a
bad one everywhere else, and being able to say which you are in is the entire
value of knowing about this at all.**

## What you actually give up

The pitch omits this part, and this part decides the question.

- **Build time and build resources.** Native compilation is measured in minutes
  rather than seconds, and the builder is memory-hungry. Every release build
  pays it; every pull-request build that verifies the native image pays it too.
  ⚠️ The exact figures depend entirely on your application and your CI hardware
  — measure yours rather than trusting anyone's number, including a vendor's.
- **Debugging.** The GraalVM guide documents **source-level debugging with
  GDB**, requiring `-g` at build time and recommending `-O0` alongside it,
  which disables inlining and optimisation. That is a real capability, and it
  is not the workflow your team has. A JVM debugger attached over JDWP is not
  the documented path here.
- **Agents.** Anything that instruments bytecode at load time — a large part of
  the APM and profiler ecosystem — has no bytecode to instrument at run time.
  Check your specific observability vendor's native support before committing;
  do not assume it.
- **Monitoring must be asked for.** JFR is supported, but the executable has to
  be built with `--enable-monitoring=jfr`. The GraalVM guide describes the
  event API experience as similar to HotSpot's; treat *parity* as something to
  verify for the specific events you depend on rather than assume across the
  board.
- **Library risk, permanently.** Spring's documentation states it plainly: not
  all libraries support native images. Every dependency is a question, and the
  answer can change with every upgrade.
- **A second thing to test.** Native failures are build-time-analysis failures,
  so they cannot occur on the JVM and no JVM test can find them. You now
  maintain two test targets and two CI paths.

🔴 **Notice that four of those six are ongoing costs, not one-time migration
costs.** A migration you can budget for; a permanent tax on every dependency
upgrade, every release build and every production investigation is a different
kind of decision, and it is the one people underestimate.

## When it is genuinely right

Narrow, and worth stating exactly:

- **Cold start is user-visible or billed.** Serverless functions, scale-to-zero
  workloads, anything where a real request waits on a boot. Here startup is not
  an optimisation, it is the product.
- **Instance count is very high**, so resident memory per instance multiplies
  into a real line on an invoice. This is the case that gets forgotten, and it
  stands on its own merits without any startup argument.
- **A command-line tool.** JVM startup dominates every invocation, the process
  is short-lived, and almost none of the dynamic-framework problems apply. This
  is the least ambiguous win in the list and the one least often discussed.

🔴 **If your service starts on deploy and then runs for weeks, native image is
paying a large, permanent engineering cost to optimise something nobody
experiences.** [Chunk 7](07-choosing.md) covers the two options that recover
much of the startup benefit without leaving the JVM at all.

## GraalVM versions, as of writing

GraalVM follows JEP 223 numbering aligned to the JDK, so "GraalVM for JDK 25"
is the 25.x line. The release calendar lists **25.2.4 on 28 July 2026** as the
most recent entry, with feature releases on a **monthly** cadence from 25.1
onward and quarterly CPUs folded in when available. ⚠️ That cadence means any
version pinned on a page like this goes stale quickly — check the calendar
rather than trusting this line.

## Gotchas

**⚠️ A green JVM test suite treated as proof the native build is fine**
**Symptom:** CI is green; the native artifact crashes on the first request.
**Cause:** Native failures are analysis failures. They cannot occur on the JVM,
so no JVM test can detect them.
**Fix:** Build and test the native image in CI as a separate job. Accept the
build time as part of the cost of the decision — and if that cost turns out not
to be acceptable, that is useful evidence about whether the decision was right.

**⚠️ Adding a dependency breaks the native build weeks later**
**Symptom:** A build that worked stops working after an unrelated feature lands.
**Cause:** The new library does something dynamic and has no metadata in the
GraalVM Reachability Metadata Repository.
**Fix:** Check the repository for a library before adopting it, and make "is it
native-ready" a standing question in dependency review alongside licence and
CVE history — see
[Phase 8 — Versioning, updates and CVEs](../../phase-8-build-dependencies/07-versioning-updates-cve/README.md).

**⚠️ Assuming your APM agent works**
**Symptom:** No traces, no metrics and no profiles from the native deployment,
with the same configuration that works on the JVM.
**Cause:** Load-time bytecode instrumentation has nothing to instrument.
**Fix:** Verify your vendor's native support before the migration, and plan on
build-time instrumentation or a direct OpenTelemetry SDK integration instead of
an attached agent.

**⚠️ The binary is built, and now nobody can debug it**
**Symptom:** A production issue that would normally take a breakpoint and ten
minutes takes a day.
**Cause:** The executable was built without `-g`, so there is no debug info at
all, and even with it the documented path is GDB rather than an IDE debugger.
**Fix:** Build a debuggable variant with `-g` (and `-O0` for step-through
fidelity) as a deliberate, separate artifact, and make sure someone has actually
used it once *before* an incident rather than discovering the workflow during
one.

**⚠️ Adopting native image because the framework supports it**
**Symptom:** A team on Quarkus or Micronaut turns on native builds because it is
one flag, then inherits every cost on this page.
**Cause:** Ease of enabling was mistaken for absence of consequence.
**Fix:** Decide it as its own question. Build-time DI already gives you most of
the startup and footprint improvement on the JVM; native image is a further
step with a much steeper bill, and the flag being easy is not an argument.

## Interview questions

**★ Your team wants native image for a service that runs 24/7 behind a load balancer. What do you say?**
That they are buying the wrong thing. Startup latency amortises to nothing for a
service that starts on deploy, so the benefit they would actually receive is
footprint — real, but it should be quantified against instance count before it
justifies anything. Against that they take on build times in minutes on every
release, a debugging story that is GDB rather than their IDE, a probable loss of
their APM agent, a per-dependency native-readiness question forever, and a
redesign of every property-driven conditional bean. If what they actually want
is faster startup, the AOT cache gets a large part of it for a fraction of the
cost and none of the restrictions.

**★ How would you de-risk a native migration you had already decided to do?**
In the order the failures appear. First, audit conditionals and
profile-specific configuration, because those are redesigns rather than fixes
and they set the true size of the project. Second, run the tracing agent over
the entire test suite, then convert what it produces into explicit
`RuntimeHintsRegistrar` code so it is reviewable and diffable rather than a
generated blob. Third, assert those hints with `RuntimeHintsPredicates` in unit
tests, so a refactor cannot silently drop one. Fourth, add native build and
native test jobs to CI from day one. And keep the JVM artifact buildable
throughout, so the rollback is a deploy rather than a project.

**★ Is native image the same conversation as Quarkus or Micronaut?**
No, and conflating them is the standard mistake. Build-time DI and native image
are correlated because build-time frameworks avoid the dynamic features native
image forbids, which makes them easy to compile natively. But you can run
Quarkus or Micronaut on the JVM and keep most of the startup and footprint
benefit with none of native image's costs, and you can compile Spring natively
with AOT. The framework question is "when does the wiring happen"; the native
question is "am I willing to give up the dynamic platform and my tooling". They
should be decided separately, in that order.

**★ Somebody quotes you a startup-time comparison from a blog post. How do you use it?**
Carefully, and mostly not. A startup figure is a measurement of one application,
with one dependency set and bean count, on one JDK, on one machine, possibly
with a warm page cache — none of which is mine. What I would take from it is the
*direction* and the *mechanism*: build-time wiring removes scanning and
reflective setup from startup, so it will be faster, and a native binary skips
JVM startup and class loading entirely, so it will be faster again. Then I would
measure my own service, because the only number that can justify a migration is
one taken from the thing being migrated.

**★ What is the strongest case for native image that has nothing to do with web services?**
A command-line tool. JVM startup is paid on every single invocation, the process
lives for seconds, and a CLI typically does none of the dynamic classpath work
that makes native image hard — no container to wire, no ORM reflecting over
entities, no APM agent to keep. You get a single executable with no JRE to
install, which is also a distribution win rather than only a performance one. It
is the case where nearly every cost on this page evaporates.

---

← Prev: [The closed world](05-the-closed-world.md) · Index: [16 · The alternatives](README.md) · Next → [Choosing](07-choosing.md)
