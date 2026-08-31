# Phase 12 · The JVM in production — notes every fork in this phase must read

Target stack: **JDK 25 (LTS)** · **Spring Boot 4.1.0 / Spring Framework 7.0.8** ·
Micrometer + OpenTelemetry · Logback/SLF4J · JFR + JDK Mission Control · async-profiler ·
GraalVM native image · JMH · CRaC.

This phase is the **observability and runtime** phase. Phase 0 built the mental model of
what the JVM *is*; this phase is about what you do at 03:00 when a service is misbehaving
and you have a shell, a PID and nothing else.

---

## 🔴 THE VERSION SPINE — verified 2026-08-31, do not re-derive per topic

| | Pinned |
|---|---|
| **JDK** | **25**, the LTS (GA September 2025). Every flag, tool and JEP on these pages is checked against JDK 25, not against "Java 17 + whatever the blog said". |
| Spring Boot / Framework | **4.1.0** / **7.0.8** (`spring-boot-dependencies:4.1.0`) |
| Build | Maven with the Spring Boot plugin; Gradle equivalents named, not re-taught (Phase 8 owns build) |

🔴 **Every page carries a `> Verified:` line naming the actual source**, and the source for
this phase is one of: the **HotSpot Java Virtual Machine Garbage Collection Tuning Guide**
for JDK 25 (`docs.oracle.com/en/java/javase/25/gctuning/`), the **JDK 25 tool references**
(`docs.oracle.com/en/java/javase/25/docs/specs/man/` for `jcmd`, `jstack`, `jmap`, `jstat`,
`java`), the **JFR / JMC** documentation, the **Micrometer** reference
(`docs.micrometer.io`), the **OpenTelemetry Java** docs, the **Spring Boot production-ready**
reference, the **GraalVM** reference, the **JMH** samples in the OpenJDK repo, and the
**CRaC** project docs. A vendor blog is a pointer to a source, never the source.

---

## 🔴 The six facts that make most online material wrong on this phase

1. 🔴 **ZGC is generational, and there is no other kind any more.** Generational ZGC became
   the default ZGC mode in JDK 23 (JEP 474) and the **non-generational mode was removed in
   JDK 24 (JEP 490)**. `-XX:-ZGenerational` is gone: on JDK 25 `-XX:+UseZGC` *is*
   generational ZGC. Every article that tells you to "enable generational ZGC with
   `-XX:+ZGenerational`" is pre-24 and its flag will not even parse. **Verify against the
   JDK 25 GC tuning guide before writing a ZGC flag.**
2. 🔴 **The available collectors on JDK 25 are Serial, Parallel, G1 and ZGC, and G1 is the
   default** — the tuning guide's own words: *"G1 is selected by default on most hardware
   and operating system configurations."* **Shenandoah is an OpenJDK collector that is not
   in every build** (Oracle's JDK does not ship it; Temurin and Red Hat's do). Its
   generational mode became a **product** feature in JDK 25 via **JEP 521**, but it is
   still **not** Shenandoah's default. Say all three of those things; do not present
   Shenandoah as universally available.
3. 🔴 **CMS does not exist.** It was removed in JDK 14. So were most of the flags people
   still paste: `-XX:+UseConcMarkSweepGC`, `-XX:PermSize`/`-XX:MaxPermSize` (PermGen died
   in Java 8), `-Xincgc`. On JDK 25 an unrecognised `-XX:` flag **fails the launch** unless
   `-XX:+IgnoreUnrecognizedVMOptions` is set. Topic 13 owns the retired-flag inventory;
   every other topic links to it rather than repeating it.
4. 🔴 **`-Xmx` is not what you set in a container.** The JVM is container-aware
   (`UseContainerSupport`, on by default since JDK 10) and the correct knob is
   **`-XX:MaxRAMPercentage`** — a percentage of the *cgroup* limit, so one image works at
   every memory size. Topic 03 owns this and the OOMKilled-vs-`OutOfMemoryError`
   distinction, which is the single most misdiagnosed production symptom in the phase.
5. 🔴 **`-XX:MaxDirectMemorySize` defaults to `-Xmx`, and nothing bounds mapped files.** The man
   page hides the first behind *"the JVM chooses the size … automatically"*; `jdk/internal/misc/VM.java`
   resets it to `Runtime.getRuntime().maxMemory()`. So the direct-memory ceiling is a **second copy
   of the heap ceiling**, and raising `-Xmx` raises it too. Mapped buffers use separate pools and
   are bounded by **no JVM flag at all**. Both matter for topic 03's container arithmetic.
6. 🔴 **Heap is not the process.** `-Xmx` bounds the Java heap only; metaspace, code cache,
   thread stacks, GC structures, direct/mapped `ByteBuffer`s and the native allocator all
   live outside it. "Heap looks fine but the pod got OOMKilled" is a *native footprint*
   question, answered with **Native Memory Tracking** (`-XX:NativeMemoryTracking=summary`,
   `jcmd <pid> VM.native_memory summary`), not with a heap dump. Topic 01 owns this framing
   and every later topic leans on it.

### JDK 25-specific features this phase must not miss

These are new enough that almost no tutorial covers them, and they are exactly what makes
the phase current rather than a 2019 rerun:

- **JEP 519 · Compact Object Headers** — promoted from experimental to **product** in JDK 25.
  Shrinks the header from 96–128 bits to **64 bits** on 64-bit platforms.
  🔴 **It is a product feature, not a default** — `-XX:+UseCompactObjectHeaders` still has to
  be asked for, and JEP 519 lists making it the default as an explicit **non-goal**. No unlock
  flag is needed any more. The size numbers belong to **JEP 450**, not 519.
  🔴 **JEP 534 · Compact Object Headers by Default is `Closed/Delivered` for Release 27** — so
  "eventually" has a version. It **requires compressed class pointers** (shrinking them 32→22
  bits), and it **silently disables itself under legacy locking**. ⚠️ Relatedly,
  **`UseCompressedClassPointers` is deprecated in JDK 25 and obsolete in 26** — do not write
  advice that depends on turning it off. Topic 01 owns the header anatomy; topic 13 owns flag status.
- **JEP 515 · Ahead-of-Time Method Profiling** and **JEP 514 · AOT Command-Line Ergonomics**,
  on top of **JEP 483 · AOT Class Loading & Linking** (JDK 24). The AOT *cache* is the
  successor story to CDS. Topic 10 owns packaging and the cache; topic 11 contrasts it with
  native image; topic 15 contrasts it with CRaC.
- **JEP 509 · JFR CPU-Time Profiling** (**experimental**, Linux only) and
  **JEP 520 · JFR Method Timing & Tracing** (`jdk.MethodTiming`, `jdk.MethodTrace`), plus
  **JEP 518 · JFR Cooperative Sampling**. Topic 06 owns these and must mark 509 as
  experimental every time it names it.

---

## Boundaries inside the phase (fixed — a fork that crosses one duplicates another's work)

- **01 Memory layout** owns *where the bytes are*: heap generations, metaspace, code cache,
  thread stacks, direct buffers, the object header and alignment, compressed oops, and NMT.
  It does **not** teach GC algorithms — it teaches the map that GC operates on.
- **02 GC in practice** owns *choosing and reading* a collector: G1 vs ZGC vs Parallel vs
  Serial vs Shenandoah, latency vs throughput vs footprint, unified logging (`-Xlog:gc*`),
  what a healthy log looks like, allocation rate, humongous allocations, and when tuning is
  the wrong answer. **Sizing lives in 03.**
- **03 Heap sizing in containers** owns cgroups, `MaxRAMPercentage`, the OOMKilled loop,
  requests/limits, and why `-Xmx` in a Dockerfile is a bug. Links to the Docker section
  rather than re-teaching containers.
- **04 `OutOfMemoryError`** owns the messages the JVM can print after that word, heap
  dumps (`-XX:+HeapDumpOnOutOfMemoryError`, `jcmd GC.heap_dump`), MAT, dominator trees, and
  the usual suspects (unbounded cache, `ThreadLocal` on a pooled thread, classloader leak).
  🔴 **It is SEVEN documented messages, not eight** — the JDK 25 troubleshooting guide lists
  `Java heap space`, `GC Overhead limit exceeded`, `Requested array size exceeds VM limit`,
  `Metaspace`, `request size bytes for reason. Out of swap space?`, `Compressed class space`,
  `reason stack_trace (Native method)`. The direct-buffer and native-thread messages are **real
  but not on that list**; say "seven documented, plus these two".
  🔴 **`-XX:+HeapDumpOnOutOfMemoryError` fires only for HEAP exhaustion** (man page, verbatim);
  it does nothing for metaspace, class space, direct buffers or native threads.
- **05 Thread dumps** owns `jcmd Thread.print` / `jstack`, every thread state, deadlock
  detection, and reading a dump of a stuck service. **Virtual threads' dump story
  (`jcmd Thread.dump_to_file`) belongs here**, and it links back to Phase 6.
- **06 JFR, JMC and async-profiler** owns always-on profiling: starting a recording, the
  event model, settings profiles, `jfr` CLI, JMC's automated analysis, and where
  async-profiler's wall-clock/alloc/lock modes beat JFR (and the safepoint-bias argument).
- **07 Logging done right** (**Master**) owns SLF4J-over-Logback, structured JSON, MDC,
  what to log and what never to log, appenders and async, cost, and correlation ids.
- **08 Metrics with Micrometer** owns meters, tags/cardinality, RED, `@Timed`,
  `MeterFilter`, percentiles vs histograms vs SLOs, and the Actuator/Prometheus wiring.
  🔴 **Actuator itself was taught in Phase 9 topic 13** — link, do not re-teach.
- **09 Distributed tracing** owns spans, context propagation, W3C `traceparent`, sampling,
  Micrometer Observation vs the OTel Java agent, and joining traces to logs and metrics.
- **10 Packaging for deploy** owns the executable/layered jar, `jarmode`, JRE base images,
  `jlink`, non-root, CDS and the AOT cache, image size and startup.
- **11 GraalVM native image** owns closed-world assumption, reachability metadata,
  reflection/resources/proxies, build-time initialisation, Spring's AOT engine, and the
  honest cost/benefit. **It does not re-teach packaging.**
- **12 Graceful shutdown** owns SIGTERM, `server.shutdown=graceful`, the grace period,
  shutdown hooks, draining pools and executors, and the readiness-probe interplay.
- **13 JVM flags that matter in 2026** owns the short live list, the retired list, ergonomics,
  `-XX:+PrintFlagsFinal`, and the "do not paste flags you cannot explain" argument.
- **14 Benchmarking with JMH** owns harness mechanics: warmup, forks, blackholes, dead-code
  elimination, `@State`, modes, and why `System.nanoTime()` around a loop measures the JIT.
- **15 CRaC** (**When needed**) owns checkpoint/restore, the resource lifecycle, what breaks
  across a checkpoint (sockets, files, RNG, time), and where it beats native image.

---

## Hard rules for this phase specifically

0. 🔴 **The `java` man page is not the whole truth — read the source when it is silent.** Several
   defaults that matter here (`CompressedClassSpaceSize` = 1 GB, `MetaspaceSize` = 21 MB,
   `MaxDirectMemorySize` = `-Xmx`, the TLAB flags, `ExitOnOutOfMemoryError`) are **absent from the
   man page entirely**. `raw.githubusercontent.com/openjdk/jdk/jdk-25%2B36/src/hotspot/...` is
   fetchable and authoritative; `curl -A "Mozilla/5.0"` gets JEPs that 403 WebFetch. Banked in
   `research_java_p12_*` in the memory store — **read those before authoring.**
1. 🔴 **NO sandbox, NO Docker, NO invented output.** There is no JVM run behind these pages.
   **Never fabricate a GC log line, a heap dump summary, a thread dump, a JFR event table,
   a flame graph, a benchmark number or a metric value.** Where a page needs to show output
   shape, it must be **quoted from the documentation and attributed on the `> Verified:`
   line**, or presented explicitly as a schematic with a sentence saying so. A plausible
   fake number is the worst failure mode available to this phase.
2. 🔴 **Every flag gets checked against JDK 25.** State when a flag was removed, when it was
   deprecated, and when ergonomics made it unnecessary. `java -XX:+PrintFlagsFinal -version`
   is the reader's own verification path and should be taught in topic 13.
3. 🔴 **300 lines is a FILE-SIZE cap and never a content budget.** Write the chunk to
   exhaustion — every gotcha, pitfall, worked example and interview question the topic
   genuinely has — then **split on a concept boundary** into a lettered sibling with its own
   frontmatter, tier badge, `> Verified:` line, Gotchas and Interview questions. **Prove the
   split**: record `wc -l` and `grep -c '^\*\*★'` before, and both totals must go **up**.
4. 🔴 **A topic is not closed without a `README.md` index** — `sidebar_position: 0`,
   `sidebar_label: "Overview"`, the full chunk table with tier badges. Copy
   `../phase-11-testing/02-assertj/README.md` exactly.
5. ⚠️ **The phase README uses the tier class `t-when`** for topic 15, not `t-when-needed`.
   **Match the README. Do not "fix" it** — that is a whole-corpus rename, not a phase-12 job.
6. ⚠️ **Verify the brief, do not trust it.** Phase 11 recorded four occasions where the
   source contradicted the brief and the author who checked was right every time. If a
   `_plan.md` row or a line in this file disagrees with the JDK 25 documentation,
   **the documentation wins** — write what is true and say so in the page.

## Phase gate (from the README — the phase must actually deliver this)

For *"p99 latency doubled after the deploy"*, the reader has an ordered plan — metrics
first, then the GC log, then a flame graph, then a thread dump — and can say what each
would show if it were the culprit.
