---
title: "Phase 0 — The platform and the JVM"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Java 25 (LTS).** Documentation-validated — every page names its
> sources on a `> Verified:` line (the JDK 25 documentation, the Java Language
> and JVM Specifications, and the JEP that finalized each feature). No sandbox:
> pages carry Java code, never fabricated program output.

The mental model everything else hangs off. Java is not "slow C++" and not
"verbose JavaScript" — it is a managed runtime with a compiler in the loop *at
run time*, and that changes how you reason about performance, deployment and
debugging. Phase 12 (the JVM in production) is this phase's payoff; Spring
(Phase 9) is unreadable without it.

🚧 **1 of 13 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[What Java is](01-what-java-is/README.md)** | <span className="db-tier t-master">Master</span> | Source → bytecode → JVM; why the same `.jar` runs everywhere — 3 chunks |
| 02 | **JDK vs JRE vs JVM, and distributions** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Same bytecode, different support contracts |
| 03 | **The release model** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | 6-month majors, LTS every 2 years: 17 → 21 → 25 |
| 04 | **Running code** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `java`, `javac`, single-file launch, `jshell` |
| 05 | **Packages and the classpath** *(not written yet)* | <span className="db-tier t-master">Master</span> | How the JVM finds a class — and the two errors when it can't |
| 06 | **`main`, startup and the config channels** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Program args, `-D` system properties vs environment variables |
| 07 | **JIT compilation** *(not written yet)* | <span className="db-tier t-know">Know</span> | Interpreter → C1 → C2; why the first 100 requests are slow |
| 08 | **Garbage collection, the working model** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | You allocate, the JVM reclaims — and what that costs |
| 09 | **Version managers** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | SDKMAN!, `.sdkmanrc` — one JDK per team, on purpose |
| 10 | **The standard library layout** *(not written yet)* | <span className="db-tier t-know">Know</span> | `java.base`, `java.util`, `java.time` — and Javadoc as a reflex |
| 11 | **The module system (JPMS)** *(not written yet)* | <span className="db-tier t-know">Know</span> | Why most apps stay on the classpath — and where modules still reach you |
| 12 | **Java vs Kotlin vs the JVM ecosystem** *(not written yet)* | <span className="db-tier t-know">Know</span> | The honest comparison, post-records and pattern matching |
| 13 | **HotSpot internals** *(not written yet)* | <span className="db-tier t-when">When Needed</span> | Tiered compilation detail, deoptimization, intrinsics |

## Phase gate

Move on when you can explain what happens between typing `java -jar app.jar`
and the first request being served — load, verify, interpret, JIT — and why
restarting a Java service always costs you warm-up time.

## Where this connects

- **Phase 12 — The JVM in production** picks up GC tuning, heap sizing in
  containers, and the profiling tools this phase only names.
- **Phase 8 — The build** turns "the classpath" from a concept into Maven's
  dependency graph.
- The [Docker section](../../../docker/README.md) of this bible covers the
  container side of the JVM-in-a-cgroup story.
