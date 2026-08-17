---
title: "JDK vs JRE vs JVM, and distributions"
sidebar_label: "02 · JDK, JRE, JVM"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 documentation
> ([docs.oracle.com/en/java/javase/25/](https://docs.oracle.com/en/java/javase/25/)),
> [adoptium.net](https://adoptium.net/) (Temurin), the
> [Oracle Java SE support roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html),
> and the Oracle NFTC license FAQ.

**Three nested things, one source project, many vendors. The JVM executes
bytecode; the JRE is the JVM plus the standard library — a runtime; the JDK is
the JRE plus the developer tools (`javac`, `jar`, `jshell`, the profilers).
Every mainstream "Java" you install is a build of the same OpenJDK source —
what differs between Temurin, Corretto, Zulu and Oracle JDK is not the
bytecode behaviour but the packaging, the patch cadence, and who answers the
phone when a CVE drops.**

## The three layers

| Layer | Contains | You use it when |
|---|---|---|
| **JVM** | The execution engine: class loading, verification, interpreter, JIT, GC | Always — it is what `java` starts |
| **JRE** | JVM + the standard library (`java.base`, `java.util`, …) | Running applications |
| **JDK** | JRE + tools: `javac`, `jar`, `javadoc`, `jshell`, `jlink`, `jcmd`, `jstack`, `jmap`, JFR tooling | Building, and *diagnosing production* |

Two modern realities reshape the old textbook picture:

1. **The standalone JRE is effectively dead.** Since Java 11, Oracle and most
   vendors stopped shipping a separate JRE download. The replacements are:
   ship the full JDK (most server images do), or build a trimmed custom
   runtime with `jlink`. Some vendors (Temurin among them) still publish
   JRE-tagged container images — those are convenience trims, not the old
   product.
2. **Production wants JDK tools.** `jcmd`, `jstack`, `jmap` and JFR live in
   the JDK. A container built on a bare runtime image saves ~100 MB and costs
   you thread dumps during an incident. Phase 12 leans on these tools;
   deciding your base image is deciding whether they exist at 3am.

## OpenJDK and the distributions

**OpenJDK is the source project** — where the code is developed, where JEPs
land. Nobody runs "OpenJDK" directly; you run a vendor's *build* of it:

| Distribution | Vendor | Why teams pick it |
|---|---|---|
| **Eclipse Temurin** | Adoptium (Eclipse Foundation) | The vendor-neutral default; the `eclipse-temurin` Docker images; free, TCK-tested |
| **Oracle JDK** | Oracle | Commercial support contracts; NFTC license (free in production since 17, but terms shift at LTS boundaries) |
| **Amazon Corretto** | Amazon | Default on Amazon Linux/AWS images; free LTS support driven by Amazon's own production needs |
| **Azul Zulu** | Azul | Broadest platform matrix (including unusual OS/arch combos); paid support tiers |
| **Red Hat build of OpenJDK** | Red Hat | Bundled with RHEL subscriptions |
| **Microsoft Build of OpenJDK** | Microsoft | Azure-optimized builds |
| **GraalVM** | Oracle | HotSpot + Graal JIT + `native-image` — a capability difference, not just packaging |

All of these (GraalVM's native mode aside) pass the **TCK** — the Technology
Compatibility Kit, the test suite that certifies "behaves as Java SE
specifies". Your bytecode does not care which one runs it. What differs:

- **Support windows** — how long the vendor backports security patches to a
  given LTS. Corretto and Temurin publish long free windows; Oracle's free
  NFTC window for an LTS ends one year after the *next* LTS ships.
- **Patch latency** — how fast the quarterly CPU (Critical Patch Update)
  security releases appear in the vendor's builds and container images.
- **Licensing** — Oracle JDK's terms have changed repeatedly (the 2019
  Java 8 licensing scare is why half the industry migrated to
  OpenJDK-based builds; NFTC since 17 made Oracle JDK free in production
  again, with the LTS-boundary caveat above).

## Which one is in your Docker image

The base image decides your distribution, and the decision matters exactly
twice: at CVE time and at incident time.

```dockerfile
FROM eclipse-temurin:25-jre    # Temurin, trimmed runtime — small, no jcmd/jstack
FROM eclipse-temurin:25        # Temurin, full JDK — diagnostics on board
FROM amazoncorretto:25         # Corretto — the AWS-native default
```

At CVE time, the question is: *how fast does a patched image tag appear, and
does your rebuild pipeline pick it up?* A pinned digest of a vulnerable JDK
build stays vulnerable forever; a floating minor tag (`25-jre`) picks up
quarterly patches on rebuild. This is Phase 8's CVE-scanning discipline meeting
the platform layer — the JDK itself appears in scanner reports, not just your
dependencies.

## `JAVA_HOME` and what points where

Tools find the JDK through `JAVA_HOME` (Maven, Gradle, IDEs) or the `PATH`.
The perennial local mess is a `PATH` `java` from one install and a
`JAVA_HOME` pointing at another — builds then compile with a different
version than `java -version` prints. Topic 09 (SDKMAN!) is the cure; the
diagnostic is:

```bash
java -version
echo $JAVA_HOME
mvn -version        # prints which JDK Maven actually resolved
```

## Gotchas

**Symptom:** "We can't use Java in production without paying Oracle"
**Cause:** the 2019 Java 8 licensing change echoing years later — conflating *Java* with *Oracle JDK*
**Fix:** OpenJDK-based builds (Temurin, Corretto, Zulu) are free for production, TCK-certified, and are what most of the industry runs. Oracle JDK itself is free under NFTC since 17, with support-window fine print

**Symptom:** production incident, and `jcmd`/`jstack`/`jmap` don't exist in the container
**Cause:** a JRE-only or aggressively trimmed base image — the diagnostic tools are JDK components
**Fix:** ship the full JDK image for services (the ~100 MB is cheap insurance), or a `jlink` runtime that deliberately includes `jdk.jcmd`; decide this before the incident

**Symptom:** Maven builds with a different Java version than `java -version` shows
**Cause:** `JAVA_HOME` and `PATH` pointing at different installs — tools resolve the JDK through `JAVA_HOME` first
**Fix:** align them; use SDKMAN! (topic 09) so both flip together per project

**Symptom:** the vulnerability scanner flags the JDK in the image, not your code
**Cause:** the JDK is software with CVEs like everything else; a pinned old base image stays unpatched
**Fix:** track the quarterly CPU releases; rebuild on updated base tags; treat the JDK as a dependency in the patching process

**Symptom:** `java -version` says `openjdk 25` and someone asks whether that's "real Java"
**Cause:** the `openjdk` string reads as unofficial to people who remember Sun-era branding
**Fix:** it is real, certified Java — the same source Oracle JDK is built from. The vendor line below it (`Temurin-25…`, `Corretto-25…`) names the build

**Symptom:** an image on Alpine Linux fails to run a JDK that works everywhere else
**Cause:** Alpine uses musl libc; standard JDK builds link against glibc
**Fix:** use the vendor's Alpine/musl-specific builds (`eclipse-temurin:25-alpine`) — a distinct build target, which is exactly the kind of thing distributions differ on

## Interview questions

**★ Explain JDK vs JRE vs JVM.**
The JVM executes bytecode (loading, verification, JIT, GC). The JRE is the
JVM plus the standard library — enough to run applications. The JDK is the
JRE plus development and diagnostic tools: `javac`, `jar`, `jshell`, `jcmd`,
JFR. Since 11 the standalone JRE product is gone — you ship a JDK or a
`jlink`-trimmed runtime.

**★ What is the difference between OpenJDK and Oracle JDK?**
OpenJDK is the open-source project where Java is developed. Oracle JDK and
Temurin/Corretto/Zulu are all *builds* of that source; they pass the same TCK
and run bytecode identically. They differ in license terms, support windows
and patch delivery — commercial and operational properties, not language
behaviour.

**★ Which distribution would you choose for a new service, and why?**
Temurin as the vendor-neutral default (official Docker images, free,
TCK-tested), Corretto on AWS-heavy infrastructure, Oracle JDK when a support
contract is required. The honest answer is that the bytecode doesn't care —
the choice is about patch cadence, support windows, and base-image
availability.

**★ Why does the JDK choice matter at CVE time?**
The JDK has its own CVEs, patched in quarterly Critical Patch Updates. Your
exposure window is the vendor's patch latency plus your image-rebuild
latency. A pinned, never-rebuilt base image means the runtime layer never
gets patched, regardless of how diligently you update dependencies.

**What is the TCK and why does it matter?**
The Technology Compatibility Kit — the certification test suite a build must
pass to claim Java SE compatibility. It is why "which distribution" is an
operational question rather than a correctness one.

**Why might you deliberately ship the bigger JDK image instead of a JRE image?**
Diagnostics: `jstack`, `jcmd`, `jmap`, JFR live in the JDK. During an
incident, a thread dump is worth far more than the ~100 MB the trimmed image
saved. `jlink` offers a middle path — a custom runtime that includes the
diagnostic modules you chose.

**What actually changed in the 2019 Java licensing scare?**
Oracle JDK 8 updates moved behind a paid license for commercial use, and the
industry responded by standardizing on OpenJDK builds (AdoptOpenJDK, now
Temurin). Oracle later introduced NFTC (17+), making Oracle JDK free in
production again — but the migration to vendor-neutral builds mostly stuck.

---

← Prev: [What Java is](01-what-java-is/README.md) · Index: [Phase 0 — The platform and the JVM](README.md)
