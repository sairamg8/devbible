---
title: "Alpine is not a smaller Linux, it is a different C library, and JEP 386 delivered a real upstream port of the JDK to it — with a stated architecture scope, a stated diagnostic capability it gives up, and size arithmetic that shows the base image was never the expensive part"
sidebar_label: "03b · Alpine and the musl port"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 386 · Alpine Linux Port**
> ([openjdk.org](https://openjdk.org/jeps/386) — Closed/Delivered, Release 16, Type Feature,
> **Scope: Implementation**); **JEP 220 · Modular Run-Time Images**
> ([openjdk.org](https://openjdk.org/jeps/220)) for the `release` file; the **JDK 25 API module
> summary** for
> [`jdk.hotspot.agent`](https://docs.oracle.com/en/java/javase/25/docs/api/jdk.hotspot.agent/module-summary.html);
> and the **JDK 25 tool reference** for
> [`jstack`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jstack.html).
> 🔴 **No sandbox** — no image was built and every size figure below is quoted from JEP 386
> rather than measured. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[03](03-base-images.md) argued that the `FROM` line decides which tools you have. On Alpine it
also decides which *libc* you have, and that is a far larger change than the image-size number
suggests. Java on Alpine is supported, upstream and deliberate — JEP 386 made it so in JDK 16 —
but the port document itself bounds the architectures, names one diagnostic capability that does
not come with it, and contains the arithmetic that undermines the usual reason people choose
Alpine in the first place.**

## The case for Alpine, in the JDK's own words

JEP 386's motivation section is the honest version of the argument, and it is a size argument:

> *"The Alpine Linux distribution is widely adopted in cloud deployments, microservices, and
> container environments due to its small image size. A Docker base image for Alpine Linux, for
> example, is less than 6 MB."*

It immediately pairs Alpine with `jlink`, which is the combination that produces a small
*image* rather than merely a small *base*:

> *"By using jlink (JEP 282) to reduce the size of the Java runtime, a user will be able to
> create an even smaller image targeted to run a specific application. The set of modules
> required by an application can be determined via the `jdeps` command. For example, if a target
> application depends only on the `java.base` module then a Docker image with Alpine Linux and a
> Java runtime with just that module and the server VM fits in 38 MB."*

🔴 **Look at what that sentence concedes: the base image is under 6 MB and the runtime is the
other 32.** A minimal Java image is roughly six parts runtime to one part distribution — and
that is the *minimal* case, with a single module and no application. On a real image carrying a
JDK, Spring and your dependencies, the base is a rounding error. Choosing Alpine and installing
a stock JDK on it optimises the smallest term in the sum.

The JEP also disposes of the workaround people reach for first — keeping a glibc-built JDK and
adding a compatibility layer — with arithmetic rather than opinion:

> *"For a cloud deployment scenario, assuming the base Alpine Linux 3.11 musl image is 5.6 MB,
> the additional glibc layer is 26 MB, and the Java runtime with the java.base module and the
> server VM is 38 MB, the static footprint overhead of having the glibc portability layer in
> the image is 30%."*

So the supported path is a **musl build of the JDK**, not a glibc build plus a shim. The thing
you are selecting with an `-alpine` tag is a different binary of Java, not a different wrapper
around the same one.

## Verify that you got a musl build

JEP 220 specifies that every run-time image carries a `release` file that *"describes the image
in terms of simple key/value property pairs"*. That file is the cheapest ground truth available
and it costs one line in a builder stage:

```dockerfile
RUN cat "$JAVA_HOME/release"
```

Read `OS_NAME`, `OS_ARCH` and the `SOURCE`/`IMPLEMENTOR` keys. This is worth doing because the
tag naming for musl builds is a **vendor convention, not a standard** — some publishers spell it
`-alpine`, some `-musl`, some both — and a mismatched pull is otherwise invisible until the
first `exec format`-shaped failure.

## What the port does not support

One sentence in JEP 386's description section carries the whole limitation, and it is easy to
skim past because it sits between a package list and a build instruction:

> *"This port will not support the attach mechanism of the HotSpot Serviceability
> Agent."*

🔴 **Read it precisely — it says *Serviceability Agent*, and it pays to know what that is.** The
SA is the module `jdk.hotspot.agent`, whose summary reads:

> *"Defines the implementation of the HotSpot Serviceability Agent. This module includes the
> `jhsdb` tool to attach to a running Java Virtual Machine (JVM) or launch a postmortem debugger
> to analyze the content of a core-dump from a crashed JVM."*

So on a musl build the SA-based path is out: `jhsdb` attaching to a live process, and the SA's
way of prying state out of a JVM that is not answering.

⚠️ **What the JEP does *not* say is that HotSpot's ordinary dynamic-attach mechanism is
unsupported.** `jcmd` and `jstack` in their normal mode use HotSpot's own attach listener, which
is a different mechanism from the Serviceability Agent, and I could not find documentation
stating that it is excluded from the musl port. Two honest consequences:

1. **Do not repeat the widespread claim that "you cannot take a thread dump on Alpine."** The
   JEP does not say that, and asserting it confidently is how folklore is manufactured.
2. **Do not assume the opposite either.** Verify on your own image, before an incident, by
   running `jcmd <pid> Thread.print` inside a test container built from the exact tag you ship.

A nearby JDK 25 fact worth carrying: the `jstack` tool reference for JDK 25 documents only two
options, `-l` and `-h`, and opens with *"Note: This command is experimental and unsupported."*
The forced, SA-backed mode people remember from older JDKs is not in the current tool reference
at all — on **any** libc. The SA question is narrower in 2026 than the folklore suggests.

## Architecture scope, and what "Scope: Implementation" means

JEP 386's summary bounds the port:

> *"Port the JDK to Alpine Linux, and to other Linux distributions that use musl as their
> primary C library, on both the x64 and AArch64 architectures"*

and its own follow-up:

> *"Musl ports for other architectures may be implemented in follow-up enhancements, if there is
> demand."*

Two things follow. First, if your fleet includes s390x, ppc64le or 32-bit ARM nodes, musl is not
an upstream guarantee there — check the vendor's platform matrix rather than assuming a tag
exists. Second, the JEP's **Scope is `Implementation`, not `SE`**: nothing in the Java SE
Platform specification says anything about musl. Alpine support is a property of the OpenJDK
implementation and of whichever vendor builds your binaries, which is exactly the kind of thing
that can vary between two `:25-jre-alpine` tags from two publishers.

## Where this leaves the decision

Alpine is defensible when image size is a real, measured constraint and when you have either no
native dependencies or the appetite to test them properly. It is a poor default, because the
size argument is weaker than it looks and the libc change is stronger than it looks — that is
[03c](03c-musl-runtime-differences.md), which itemises the runtime behaviour that actually
differs.

The alternative that captures most of the size benefit *without* changing libc is a slim
Debian-based image plus `jlink`, or a distroless image, which is [03d](03d-distroless.md).

## Gotchas

**★ A glibc JDK does not run on Alpine, and the compatibility layer costs more than it saves.**
JEP 386 rejected that alternative on footprint: *"the static footprint overhead of having the
glibc portability layer in the image is 30%."* If you are on Alpine, use a musl build. Mixing is
unsupported *and* larger — it fails on both the correctness and the size argument.

**★ "Alpine is 6 MB" is a claim about the base image, not about your image.** JEP 386's own
example puts a single-module Java runtime at 38 MB next to a 5.6 MB base. Whatever your image
weighs, the runtime and your dependencies dominate it. Read
[09](09-image-size-and-startup.md) before optimising the smallest term.

**★ The Serviceability Agent's attach mechanism is unsupported on the musl port.** That is the
JEP's exact scope: `jhsdb` and SA-backed core-dump analysis. It is not a blanket statement about
`jcmd`. Verify the specific tool you rely on, on the specific image you ship, before you need it.

**★ `jstack` on JDK 25 documents only `-l` and `-h`, and calls itself experimental and
unsupported.** People arguing about SA availability are often arguing about a mode of a tool
that the current tool reference no longer documents. Check the JDK 25 man page before you plan a
procedure around it.

**★ Alpine support is `Scope: Implementation`, not part of Java SE.** No specification obliges
any vendor to publish a musl build of any particular JDK version, and two vendors' Alpine tags
are not interchangeable by definition. This is the same lesson as the `jre` tag in
[03](03-base-images.md), one layer down.

**★ Upstream musl support covers x64 and AArch64 only.** *"Musl ports for other architectures may
be implemented in follow-up enhancements, if there is demand."* A mixed-architecture fleet is a
reason to check before standardising, not after the first node type fails to schedule.

**★ Tag naming for musl builds is a vendor convention.** There is no standard suffix. Read
`$JAVA_HOME/release` — JEP 220 guarantees it exists and describes the image — rather than
inferring the libc from the tag string.

**★ Switching to Alpine invalidates your test history.** Every integration test you have ever
run passed on glibc. The differences are individually small and collectively a different
platform, so the switch deserves a full suite run on the new base *before* it reaches
production, not a canary that only exercises the happy path.

**★ Alpine plus a stock JDK is the worst of both.** You take the libc change and skip the
`jlink` step that was the point of taking it. If you are not going to trim the runtime, a slim
Debian base gives you nearly the same image for none of the risk.

## Interview questions

**★ Why is running Java on Alpine a bigger decision than running it on a slim Debian image?**
Because Alpine uses musl rather than glibc, so it is a different C library, not a smaller
distribution. The JDK needs a dedicated musl build — that is what JEP 386 delivered in JDK 16 —
and musl documents behavioural differences in thread stack defaults, DNS resolution and locale
handling ([03c](03c-musl-runtime-differences.md)). A slim Debian image changes the package set;
Alpine changes the platform underneath the JVM.

**★ What does JEP 386 say the Alpine port does not support?**
Verbatim: *"This port will not support the attach mechanism of the HotSpot Serviceability
Agent."* The Serviceability Agent is the `jdk.hotspot.agent` module — `jhsdb`, live SA
introspection and core-dump post-mortems. The JEP does **not** extend that statement to
HotSpot's ordinary dynamic-attach mechanism, and the accurate answer says so rather than
inflating it into "no thread dumps on Alpine".

**★ Where does the size saving from Alpine actually come from, and how much of it is real?**
From the base layer only. JEP 386's own example is a base under 6 MB against a `java.base`-only
runtime plus server VM at 38 MB — so even in the most favourable case the distribution is about
a seventh of the image, and in a realistic case carrying a full JDK, Spring and your code it is
a small percentage. The saving becomes material only in combination with `jlink` or a heavily
trimmed module set.

**★ Is Alpine support part of the Java SE Platform?**
No. JEP 386's scope is `Implementation`. Java SE says nothing about the C library, so musl
support is a property of OpenJDK and of whichever vendor builds your binaries. Practically: two
publishers' Alpine images can differ in ways no specification forbids, and you verify with
`$JAVA_HOME/release` rather than trusting the tag.

**★ Someone proposes "install the glibc compatibility package so we can keep our current JDK
image on Alpine". What is wrong with that?**
It is the alternative JEP 386 explicitly considered and rejected, and it fails on the very
metric that motivated Alpine: a 26 MB glibc layer on a 5.6 MB base beside a 38 MB runtime is a
*"30%"* footprint overhead. It is also unsupported. If Alpine is right, use a musl build; if a
musl build does not exist for your platform, Alpine is not right.

**★ How would you decide between Alpine and distroless for a Spring Boot service?**
Ask what the constraint really is. If it is image size across a fleet that pulls constantly,
Alpine plus `jlink` is a strong answer and you accept a libc change and the testing that implies.
If it is CVE surface and supply-chain provenance, distroless keeps glibc and Debian's package
provenance while removing the shell and package manager entirely, so nothing about your
application's runtime behaviour changes. Most teams discover the second constraint is the real
one.

**★ How do you prove, from inside a container, that you are running a musl build?**
Read `$JAVA_HOME/release`. JEP 220 specifies that a modular run-time image carries that file and
that it *"describes the image in terms of simple key/value property pairs"*, so `OS_NAME`,
`OS_ARCH` and the implementor keys are there without needing a shell utility, a package manager
or any assumption about the tag.

{/* FOOTER */}
