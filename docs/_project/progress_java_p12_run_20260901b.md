---
name: progress-java-p12-run-20260901b
description: The second 2026-09-01 phase-12 run — coordinator f413d97a plus 2 devbible-author forks. Topics 14 (JMH) and 15 (CRaC) closed, topic 10 left needing only its index, topic 08 two chunks short, topic 12 half written. Carries the two build-breaking MDX brace defects, the verified Boot 4.1 graceful-shutdown facts, and the source quotes the forks banked.
metadata:
  type: project
---

# Java phase 12 · the 2026-09-01 evening run — 3 workers

**Coordinator: session `f413d97a`.** User order, in sequence:

> *"Complete pending java"* → *"Deploy max 3 more agents including you split work all of them and
> finish it"* → *"Please finish current files including agents wind down for now"* /
> *"Only current file and enough for the day"* → *"Please verify build failing issues in case"*

Three workers on **disjoint topic directories**, forks running **no git commands at all**, the
coordinator committing on a gate of `wc -l <= 300` **and** a `{/* FOOTER */}` last line. That
gate held back several files mid-write and every one of them was under cap minutes later — the
forks split their own over-cap drafts without being asked.

## Result

| | Topic | Outcome |
|---|---|---|
| coordinator | **14 · Benchmarking with JMH** | ✅ **CLOSED** — 19 chunks + index, 3,976 L, 151 ★, positions 0–19, 0 over cap, 117 links 0 broken |
| coordinator | **15 · Checkpoint/restore (CRaC)** | ✅ **CLOSED** — 13 chunks + index, 2,304 L, 89 ★, positions 0–13, 0 over cap, 81 links 0 broken |
| coordinator | **12 · Graceful shutdown** | ⚠️ 8 chunks, positions 1–8. Next `06-executors-and-schedulers.md` at pos 9 |
| fork A | **10 · Packaging for deploy** | ⚠️ **all 29 chunks written** (21 this session, 5,554 L, 380 ★, 3 proven splits) — **owes only `README.md`** |
| fork B | **08 · Metrics with Micrometer** | ⚠️ 28 chunks (23 this session, 6,058 L, 344 ★, 10 proven splits) — owes `11-cost-and-overhead`, `12-the-checklist`, `README.md` |

**Phase 12: 9/15. Java 177/233 (76%).** Topics 09, 11, 13 untouched by design at wind-down.

---

## 🔴 The finding that matters most: two build-breaking MDX defects

`yarn build` was **failing before this session and nobody knew**, because the failure is in a file
written days earlier and `mdxcheck.py` does not detect the pattern.

1. **`p12/07-logging-done-right/04-parameterised-messages.md`** quoted SLF4J's own sentence about
   *"the `'{'` character immediately followed by `'}'`"* — with the braces in **single quotes, in a
   blockquote, in emphasis**, and none of that protects them. MDX read `{' `…`'}` as an expression:
   *"Could not parse expression with acorn"*, and the **whole build died**.
2. **`p14/01-monolith-first/11f-nested-modules.md`** had `$.{moduleName}.parent` from a Spring
   Modulith property table. That one *compiles* and then fails at static rendering with
   **`ReferenceError: moduleName is not defined`**.

🔴 **A literal `{` or `}` in prose is an MDX expression, full stop.** Escape as `\{` / `\}`, or put
it in backticks, or use the `{'{'}` form (fork B's topic-08 pages already use that form correctly).
⚠️ **`mdxcheck.py` catches bare `<Tag` and brace *spans*, not this.** The only reliable detector is
`yarn build`. **Run it before ending a session.** After both fixes: `[SUCCESS] Generated static
files in "build"`, 92 broken-link warnings site-wide, **none of them in phase 12's closed topics**
(they are phase 14's in-flight forward references).

---

## Verified facts established this session — do not re-derive

### Topic 14 · JMH (all from the OpenJDK JMH repo on `master`, JMH 1.37)
- **JMH is a code generator, not a library.** README: *"Simply adding the `jmh-core` jar file to
  your build is not enough to be able to run benchmarks."*
- **Five HotSpot execution levels**, verbatim from `compilationPolicy.hpp` at `jdk-25+36`; level 2
  is *"generally faster than level 3 by about 30%"*; thresholds are scaled by compiler load
  (`s = queue_size_X / (TierXLoadFeedback * compiler_count_X) + 1`); **OSR is backedge-only**.
- **`Level.Invocation` carries four numbered warnings** and an all-caps preamble; only usable above
  **1 ms per invocation**; warning #2 is coordinated omission, which makes throughput look *better*.
- **`JMHSample_38_PerInvokeSetup` publishes a results table in its source comment** — quotable, and
  it shows the broken benchmark at 73 ns/op against 58,812 ns/op honest, ~800×.
- **Blackhole modes**: `COMPILER`, `FULL_DONTINLINE`, `FULL`. Auto-detect is **on by default**
  (`jmh.blackhole.autoDetect`); JMH probes by launching a JVM with
  `-XX:CompileCommand=blackhole,some/fake/Class.method` and reading the complaints. 🔴 **`blackhole`
  is NOT in the JDK 25 man page's documented `CompileCommand` list** — that list is `break`,
  `compileonly`, `dontinline`, `exclude`, `help`, `inline`, `log`, `option`, `print`, `quiet`.
- **Scores are `±(99.9%)`** (`getConfidenceIntervalAt(0.999)`) and JMH prints *"assumes normal
  distribution"*; the extended form needs `stats.getN() > 2`.

### Topic 15 · CRaC
- **Linux only**, needs a CRaC-enabled JDK (BellSoft Liberica / Azul Zulu, or the OpenJDK CRaC
  builds), `org.crac:crac` **1.4.0+**, and `-XX:CRaCCheckpointTo` / `-XX:CRaCRestoreFrom`.
- 🔴 **The image is your heap.** Spring says it twice: assume *"any value "seen" by the JVM"* is in
  the checkpoint files, *"especially in use cases where the CRaC files are shipped as part of a
  deployable artifact (a container image for example)"*.
- 🔴 **`spring.context.checkpoint=onRefresh` *"does not allow to have a fully warmed-up JVM"*** —
  the cheap mode does not deliver the headline benefit. `-Dspring.context.exit=onRefresh` is the
  free diagnostic that needs no CRaC, no CRaC JDK and no Linux.
- **`@Scheduled(fixedRate)` fires every missed execution on restore**; use `fixedDelay` or cron.
- **The global `Context` holds *weak* references and has no `unregister`** — an anonymous
  `Resource` passed straight to `register` is collected and never called. Store it in a field.
- **`jcmd … JDK.checkpoint` always reports success**; real errors go to the application console.
- CRIU wants `chown root:root $JAVA_HOME/lib/criu` + `chmod u+s` — a setuid-root binary in the
  runtime image, and **restore needs the privileges too, not just checkpoint**.

### Topic 12 · Graceful shutdown (Boot 4.1 — the plan was out of date, the docs won)
- 🔴 **`server.shutdown` defaults to `graceful`** in the Boot 4.1 properties appendix. The property
  now exists to set `immediate`. Advice to "enable graceful shutdown" is pre-4.x.
- **The servers listed are Jetty, Reactor Netty and Tomcat** — **Undertow is not in the list**.
- 🔴 **The timeout is `spring.lifecycle.timeout-per-shutdown-phase`, default `30s`, and it is
  PER PHASE** — not a total budget. Kubernetes' `terminationGracePeriodSeconds` default is also
  **30s**, and it covers preStop + drain + teardown together. The two defaults collide.
- **All three servers stop accepting at the network layer** — a client sees a reset, not a 503,
  which is why readiness must be failed first.
- **Kubernetes**: endpoint removal happens *"At the same time as the kubelet is starting graceful
  shutdown"*; the preStop hook gets a one-off **2-second** grace extension; TERM goes to **PID 1**;
  containers in a Pod get TERM *"at different times and in an arbitrary order"*; sidecars are
  delayed until the last main container terminates.
- **`Runtime` javadoc, JDK 25**: hooks start *"in some unspecified order"*, run concurrently, and
  a hook that never returns means *"the shutdown sequence will never finish"* — **no timeout**.
- **`SmartLifecycle`**: startup low→high phase, **shutdown is the reverse**; same phase is
  *"arbitrarily ordered"*; `getPhase()` defaults to `DEFAULT_PHASE` (the top, so you stop first);
  plain `Lifecycle` beans are treated as phase `0`; **`stop(Runnable)` must call `callback.run()`**
  or you burn the whole phase timeout; `Lifecycle.stop()` is **not** called on `SmartLifecycle`
  beans unless delegated.

### Banked by the forks for the topics they did not reach
- **Topic 11 (native image)**: fork A fetched and quoted Boot's closed-world paragraph and the
  `MyConfiguration__BeanDefinitions` generated-source example in `10/06` and `10/06c` — reuse for
  chunks 02, 03, 05. Also `@NestedConfigurationProperty` — *"otherwise they won't be detected and
  will not be bindable"*.
- **Topic 13 (flags)**: `-XX:+AutoCreateSharedArchive` — *"it's no longer necessary to have a
  separate trial run"*; `-XX:+UsePerfData` *"suppresses the creation of the `hsperfdata_userid`
  directories"*; JEP 514 — *"the memory needed to complete the one-step workflow is double the heap
  size specified on the command line"*.
- **Topic 08 remainder**: the SRE Workbook burn-rate table (2%/1h/14.4/page, 5%/6h/6/page,
  10%/3d/1/ticket, short window = 1/12 of long) is fetched and unused — it belongs in a `10b`.
- ⚠️ **Fork A found a real documentation conflict**: the JDK 25 `java` man page still says the AOT
  cache *"currently contains Java classes and heap objects"* with profiles as a future addition,
  while **JEP 515 (profiles) is Closed/Delivered for Release 25**. `10/05f` reports both and says
  no reconciling document was found. Do not "fix" one to match the other.
- ⚠️ **Fork B flagged real scope overlap** between phase-12 topic 08 and **phase-9 topic 13
  (Actuator)**, which already ships `08-metrics` … `15-observation-conventions-and-propagation`.
  Somebody has to decide whether phase 9 trims to endpoint mechanics or phase 12 cross-links harder.

## What to repeat

- **Coordinator + forks on disjoint directories, forks run no git.** Worked again, zero conflicts.
- **Commit gate = cap + footer marker.** Cheap, and it caught every mid-write file.
- **Plan chunk boundaries to land under 300 on first write** — the coordinator's 32 chunks needed
  zero post-hoc splits; the forks drafted whole and split 13 times, every one proven both-up.
- 🔴 **Run `yarn build` before ending.** Two build-breaking defects had been sitting in `main`.

## Everything else

- **[[cursor-java]]** — repointed to `10-packaging-for-deploy/README.md`, one file that closes a topic.
- **[[java-board]]** — every row released; per-topic owed lists are exact.
- Earlier run of the same day: [[progress-java-p12-run-20260901]] · topic 10 research:
  [[progress-java-p12-t10-packaging]].
