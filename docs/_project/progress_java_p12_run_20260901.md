---
name: progress-java-p12-run-20260901
description: The 2026-09-01 phase-12 run — session d7d5224e as coordinator plus 3 devbible-author forks. Topic 01 and topic 05 closed, forks on 02/03/04, coordinator on 06. Carries the verified findings each topic established, the standing order to stop after phase 12, and the scratch directory that must be deleted at close.
metadata:
  type: project
---

# Java phase 12 · The JVM in production — the 2026-09-01 run

**Coordinator: session `d7d5224e`.** Started as a two-part user request — *"finish phase 12 topic
01 and fix those 23 links"* — then widened twice by the user mid-run:

> *"you can deploy 3 more agents split current phase between them"* / *"you also take work from
> that"*

and bounded by a standing order:

> 🔴 *"After completing current phase do not start new"*

**So: finish all 15 phase-12 topics, then STOP.** Do not begin phase 13, 14, 15 or 16 without a
new instruction. This is recorded in [[java-board]] as well.

---

## What is done

🔴 **FINAL STATE at clean stop, 2026-09-01. Working tree CLEAN — nothing to salvage.**

| Topic | State | Measured off disk |
|---|---|---|
| **01 · Memory layout** | ✅ **CLOSED** | 47 files, 11,490 lines, 691 ★ |
| **02 · GC in practice** | ⚠️ partial | 33 files, 8,333 lines, 396 ★ — owes index + renumber, max pos 33 |
| **03 · Heap sizing in containers** | ✅ **CLOSED** | 17 files, 3,890 lines, 213 ★ |
| **04 · `OutOfMemoryError`** | ✅ **CLOSED** | 24 files, 6,167 lines, 316 ★ |
| **05 · Thread dumps** | ✅ **CLOSED** | 16 files, 3,792 lines, 248 ★ |
| **06 · JFR and profiling** | ✅ **CLOSED** | 20 files, 4,666 lines, 320 ★ |
| **07 · Logging** (Master) | ⚠️ partial | 16 files, 4,218 lines, 236 ★ — max pos 16 |
| **08 · Metrics** | ⚠️ partial | 3 files — 🔴 `03-the-meter-types.md` is **339 lines, OVER CAP**, owes a proven split |
| **09 · Tracing** (Know) | ⚠️ partial | 4 files, 996 lines, 54 ★ — max pos 4 |
| **10 · Packaging** | ⚠️ partial | 1 file — 🔴 **START HERE** → `01b-why-not-shading.md` at pos 2 |
| 11–15 | 📋 planned | `_plan.md` exists for every one |

**Phase 12: 6 of 15 closed. Java 173/233 (74%).** ⚠️ 82 broken links remain in phase 12, all
forward references inside the five partial topics; the six closed topics are 0 broken.

🔴 **The resume cursor is [[cursor-java]]** — it names the exact next file and carries the banked
topic-10 research.

**Topic 01 also closed the 23 dangling links** that had blocked a clean build since the
`4248352b` run. Java-wide dangling fell **126 → 103**, and every one remaining belongs to
phase 14's in-flight topics, not to phase 12.

---

## 🔴 Findings this run established — do not re-derive

### Topic 01 (memory layout)
Written from the two banked research files, which were sufficient — **zero re-fetching needed**.
Six owed chunks written; four exceeded the cap and were split with proof:

| Chunk | Split into | Before → after |
|---|---|---|
| `03c` TLABs | `03c2` TLAB sizing | 312 L / 17 ★ → 511 L / 30 ★ |
| `04` metaspace | `04b` flags, `04c` classloader leak | 389 L / 19 ★ → 763 L / 44 ★ |
| `05` code cache | `05b` when it fills, `05c` diagnosing | 301 L / 17 ★ → 485 L / 32 ★ |
| `08c` alignment | `08c2` false sharing / `@Contended` | 337 L / 21 ★ → 489 L / 34 ★ |

⚠️ **The renumber was done by EXISTING `sidebar_position` order, not by filename.** A filename
sort moves `08e-the-mark-word-locking-and-hashing` out of the place its author gave it (directly
after `08`, before `08b`). Contiguous 1..46 now.

### Topic 05 (thread dumps) — five verified corrections
1. 🔴 **`jstack` is experimental and unsupported on JDK 25.** Its man page opens *"Note: This
   command is experimental and unsupported"* and the Troubleshooting Guide says *"Use the `jcmd`
   or `jhsdb jstack` utility, instead of the `jstack` utility"*. Same status as `jmap`.
2. 🔴 **`Thread.print` does not show virtual threads** and does not say so. `Thread.dump_to_file`
   (`-format=plain|json`, `-overwrite`, `%p` expands to PID) is the one that does. Also
   `Thread.vthread_scheduler` and `Thread.vthread_pollers`, both **Impact: Low**.
3. 🔴 **`jdk.tracePinnedThreads` was REMOVED by JEP 491** — *"setting it on the command line will
   have no effect"*. It is a system property, so it does not fail the launch: the runbook step
   runs, produces silence, and reads as "no pinning found".
4. 🔴 **`synchronized` no longer pins on JDK 24+.** JEP 491 *"will eliminate nearly all cases"*,
   and says the `ReentrantLock` migration *"will no longer be necessary"*. The most-repeated
   virtual-thread advice in existence is now obsolete. What still pins: native/FFM frames, plus
   the class-init cases in Future Work.
5. **HikariCP 6.3.0 call chain, verified from source:** `HikariPool.getConnection` →
   `connectionBag.borrow(timeout, MILLISECONDS)` → `handoffQueue.poll(timeout, NANOSECONDS)` on a
   `SynchronousQueue<>(true)`; throws `SQLTransientConnectionException` whose message is
   `"... Connection is not available, request timed out after Nms (total=…, active=…, idle=…, waiting=…)"`.
   ⚠️ `total` **below** `maximumPoolSize` in that message is a *different* failure — the pool could
   not create connections at all.

Also verbatim and quotable: the Troubleshooting Guide's **full `Found one Java-level deadlock`
example**, its statement that detection covers `synchronized` **and** `java.util.concurrent`, the
`ObjectMonitor::enter` mixed-stack example, the `VMThread` / `SafepointSynchronize::begin`
guidance, and the header line
`"DestroyJavaVM" #18 prio=5 tid=0x… nid=0x744 waiting on condition […]` with
`java.lang.Thread.State: RUNNABLE` — which is the documented proof that the two state lines
disagree.

### Topic 06 (JFR) — banked, partly written
- 🔴 **The overhead figure has a real source.** JEP 520: *"JFR generally aims to impose a CPU
  overhead of less than one percent"* — an **aim**, not a measurement — and the same JEP says
  *"It is not a goal to remain within this constraint when timing and tracing methods."*
- **JEP 509** (Release 25, `Closed/Delivered`, **experimental, Linux only**): new event
  **`jdk.CPUTimeSample`**, **not enabled by default**. Enable with
  `-XX:StartFlightRecording=jdk.CPUTimeSample#enabled=true,filename=profile.jfr`. Coexists with
  `jdk.ExecutionSample`. Its Motivation lists the old sampler's three deficiencies (Java frames
  only, silent failed samples, samples only a subset of threads) and says async-profiler's use of
  internal interfaces is *"inherently unsafe and can lead to process crashes"*.
- **JEP 518** (Release 25, Scope: **Implementation**): cooperative sampling — sampler records the
  program counter and stack pointer into a thread-local queue, target reconstructs the stack at
  its next safepoint *"adjusting for safepoint bias"*. Replaces heuristics that *"can crash the
  JVM"*. ⚠️ Future Work admits it *"does not entirely avoid safepoint bias"* (intrinsics). Says
  `AsyncGetCallTrace` is *"even riskier"* and is SIGPROF-based with no Windows equivalent.
- **JEP 520** (Release 25): events **`jdk.MethodTiming`** and **`jdk.MethodTrace`** via bytecode
  instrumentation, filter-selected. Example verbatim:
  `java -XX:StartFlightRecording:jdk.MethodTrace#filter=java.util.HashMap::resize,filename=recording.jfr`
  then `jfr print --events jdk.MethodTrace --stack-depth 20 recording.jfr`. Non-goals: not method
  arguments or non-static field values; not abstract/native/non-static-non-default-interface
  methods; not many methods at once.
- **`jfr` tool subcommands (JDK 25):** `print`, `view`, `configure`, `metadata`, `summary`,
  `scrub`, `assemble`, `disassemble`. 🔴 `scrub` exists to *"remove sensitive contents or reduce
  size"* — relevant before attaching a recording to a ticket.

---

## 🔴 Owed at close — do not forget

1. **Delete `docs/java/pages/phase-12-jvm-production/02-gc-in-practice/.src/`** — ~1.9 MB of
   fork A's downloaded source material (JDK `.cpp`/`.hpp`, Oracle `.html`, `JvmGcMetrics.java`)
   sitting inside the docs tree. It is uncommitted and must never be committed. Left in place only
   because fork A is still using it.
2. **Each fork owes its `README.md` index** and a contiguous `sidebar_position` renumber within
   its own directory. Directories are disjoint, so there is **no cross-fork renumbering**.
3. **`src/data/progress.js`** — bump `pages` for phase 12 as each topic closes (at 4 of 15 now).

4. 🔴 **NEVER check links with `os.path.exists()` alone.** `docusaurus.config.js` excludes
   `'**/_*.{js,jsx,ts,tsx,md,mdx}'` and `'**/reviews/**'` from routing, so a link to
   `../topic/_plan.md` points at a real file and is still **broken in the build**. 27 such links
   were committed across phase 12 before fork C caught it. Use
   **`shared/scripts/devbible-linkcheck.py`**, which checks existence *and* routing.

## The working pattern that held

- **Per-file cadence throughout**: write → QC (`wc -l`, `grep -c '^\*\*★'`, footer, MDX, links) →
  commit explicit paths → re-stamp the holder cell on [[java-board]].
- **Forks run NO git commands**; the coordinator commits, gated on `wc -l ≤ 300` **and** a
  `{/* FOOTER */}` marker. That gate correctly held back four files that were momentarily over the
  cap — and in every case the fork split it itself within minutes, so the gate cost nothing and
  prevented committing a rule violation.
- ⚠️ **A file's line count can change between checking it and committing it.** Fork A's
  `02c-what-was-removed.md` read 344 lines, then 227 a minute later. Re-check at commit time
  rather than trusting an earlier measurement.

Related: [[java-board]] · [[java-playbook]] · [[research-java-p12-t01-jvm-memory-internals]] ·
[[research-java-p12-metaspace-codecache-tlabs]] · [[progress-java-p12-t01-memory-layout]] ·
[[cursor-java]]

---

## 🔴 Fork B's primary-source findings (topic 03, containers) — banked 2026-09-01

**These cost a full agent run to establish. Do not re-derive.** Topic 03 closed at 16 chunks +
index, 3,860 lines, 213 ★, verified off disk by the coordinator (0 over cap, positions 0–16
contiguous, 121 links / 0 dangling).

1. 🔴 **The "approximately 125 MB small heap" in the man page is DERIVED, not chosen.**
   `MaxHeapSize` default is `ScaleForWordSize(96*M)` (`gc_globals.hpp`), and `globals_shared.hpp`
   has `#define ScaleForWordSize(x) align_down((x) * 13 / 10, HeapWordSize)` on LP64 →
   96 MiB × 1.3 ≈ **124.8 MiB**.
2. 🔴 **There is a FLAT BAND in ergonomic heap sizing** (`Arguments::set_heap_size()`): below
   ~250 MiB container memory the heap is 50%; between ~250 and ~500 MiB it is a constant
   ≈124.8 MiB; above ~500 MiB it is 25%. **Doubling a 256 MiB container to 448 MiB buys zero extra
   heap.**
3. 🔴 **Naming `MaxRAMPercentage`/`MinRAMPercentage`/`InitialRAMPercentage`/`MaxRAM` sets
   `override_coop_limit`**, which on a large container makes the JVM **disable compressed oops**
   rather than clamping the heap — and it logs under the **`aot`** tag, not `gc`. Default
   (unnamed) behaviour clamps to ~32 GiB and keeps compressed oops.
4. 🔴 **`ZVirtualToPhysicalRatio = 16`** (`gc/z/zGlobals.hpp`). Band A had left this unverified.
   Feeds `limit_heap_by_allocatable_memory`; on LP64 `os::has_allocatable_memory_limit` returns
   true **only if `RLIMIT_AS` is finite**, so the clamp is a no-op in a normal container.
5. 🔴 **`OSContainer::init()` is two-step:** controllers mounted read-only → containerized; else
   "is any memory or cpu limit present", which exists *"to ensure that limits enforced by other
   means (e.g. systemd slice) are properly detected."* **A systemd slice with `MemoryMax=` makes a
   JVM "containerized".**
6. 🔴 **`CgroupUtil::processor_count` uses quota/period ONLY**, with `ceilf`, capped by
   `MIN2(host_cpus, …)`. `cpu_shares()` is never called. **JDK-8281181** — *"Do not use CPU Shares
   to compute active processor count"*, fixVersions `[19]`, Fixed. **`UseContainerCpuShares` is
   absent from JDK 25 `globals_linux.hpp` AND from the deprecated/obsolete table — it is an
   unrecognised flag that FAILS THE LAUNCH.**
7. 🔴 **`CgroupUtil::adjust_controller` walks UP the cgroup hierarchy and uses the lowest limit.**
   Warning: *"Cgroup memory controller path at '%s' seems to have moved to '%s', detected limits
   won't be accurate"*.
8. **`os::is_server_class_machine()`** — *"&gt;= 2 physical CPU's and &gt;=2GB of memory, with some
   fuzz"*; `server_memory = 2G`, `missing_memory = 256M` → **1792 MB threshold**.
   `GCConfig::select_gc_ergonomically` → G1 if server-class, **Serial otherwise**.
9. **`InitialRAMPercentage` default 1.5625 (= 1/64).**
10. **`MaxRAM` full wording:** *"the maximum amount of available memory to the JVM process or
    128 GB, whichever is lower … the minimum of the machine's physical memory and any constraints
    set by the environment (e.g. container)."*
11. **`WorkerPolicy::nof_parallel_worker_threads`** — `switch_pt = 8`, `num = 5`; source's worked
    example: *"on a 72 cpu machine … 8 + (72 - 8) * (5/8) == 48 worker threads."* Reads
    `os::initial_active_processor_count()` (**startup** value).
12. **`Thread` javadoc:** `jdk.virtualThreadScheduler.parallelism` *"defaults to the number of
    available processors"*; `jdk.virtualThreadScheduler.maxPoolSize` *"defaults to 256"*.
13. **`OSCONTAINER_CACHE_TIMEOUT` = `NANOSECS_PER_SEC/50`** — *"20ms timeout between re-reads"*.
14. 🔴 **cgroup v2: soft limit is `memory.low`, usage `memory.current`, shares `cpu.weight`. The
    JVM NEVER reads `memory.high`** — a `MemoryQoS`-throttled container is invisible to it.
15. **JVM TI spec:** `JAVA_TOOL_OPTIONS` is *prepended* to programmatic options; *"the variable
    should not be overwritten, instead, options should be appended"*; and the RI *"disables this
    feature on Unix systems when the effective user or group ID differs from the real ID."*
16. 🔴 **Kubernetes:** *"memory limits are enforced reactively. A container may use more memory
    than its memory limit, but if it does, it may get killed."* And on `emptyDir` with
    `medium: Memory`: *"files you write count against the memory limit of the container that wrote
    them"* — **writing a heap dump there OOMKills the pod.** `kubectl cp` *"Requires that the
    'tar' binary is present in your container image."*
17. 🔴 **Paketo `libjvm` constants:** `ClassSize=5_800`, `ClassOverhead=14_000_000`,
    **`DefaultDirectMemory = 10 * Mebi`**, `DefaultReservedCodeCache=240*Mebi`,
    `DefaultStack=1*Mebi`, `DefaultThreadCount=250`, `ClassLoadFactor=0.35`, `DefaultHeadroom=0`.
    Emits **all five** flags into `JAVA_TOOL_OPTIONS`. **The 10 MiB direct-memory default is why
    Netty/WebFlux apps fail as buildpack images but not as plain jars.**

### What fork B could NOT confirm (written as unverified on the pages)
`os::is_server_class_machine()`'s hyperthreading branch · `ForkJoinPool.commonPool()` parallelism
= `availableProcessors() - 1` (not in the JDK 25 javadoc) · Netty's own direct-memory derivation
and property names · `AlwaysPreTouch` × huge pages / NUMA · the *"Picked up JAVA_TOOL_OPTIONS"*
stderr line (the `JDK_JAVA_OPTIONS` reminder **is** documented) ·
`AlwaysActAsServerClassMachine`/`NeverActAsServerClassMachine` declarations.

### ⛔ RETRACTED — `mdxcheck.py` is NOT broken. The warning was wrong twice.
🔴 **The coordinator tested it empirically on 2026-09-01 and the script WORKS.** Fed a control
file containing a bare `<Tag` in prose, it reported:

```
RAW-TAG   /tmp/.../hazard.md:5
          Some prose with a bare <Tag here.

1 MDX hazard(s) in 1 file(s)
```

**`0 MDX hazard(s) in 0 file(s)` means zero hazards across zero files-WITH-HITS — a genuine
pass**, not an empty scan. Fork C reached the same conclusion by reading the source: it walks
directories, skips `_`-prefixed files, blanks fenced code blocks and joins wrapped inline spans
before matching.

**Two independent reports called it broken and both were wrong**, having inferred "scans nothing"
from the second number in its output. Fork B's "four genuine hazards" were most likely wrapped
inline code spans — which the script deliberately joins, and which render correctly. The original
warning is in [[research-java-p12-t01-jvm-memory-internals]] and **should be treated as retracted
there too**.

**The lesson worth keeping:** a tool reporting zero is not evidence it did nothing. Test it
against a known-bad control before declaring it broken — it costs one file and thirty seconds, and
two agents spent far longer than that working around a tool that was fine.

---

## 🔴 Corrections this run made to ALREADY-CLOSED work — the lesson

Two defects were found in topics that had been declared clean, both by a fork reading primary
sources rather than by any checker:

**1 · 27 build-breaking links.** Every `](../topic/_plan.md)` was broken, because
`docusaurus.config.js` excludes `'**/_*.{js,jsx,ts,tsx,md,mdx}'` from routing. The target file
exists; it is simply never routed. 🔴 **The coordinator's own "0 dangling links" checks had passed
these, because they tested `os.path.exists()` rather than Docusaurus routing.** Fixed by repointing
14 to `README.md` and demoting 13 to prose, and by writing
**`shared/scripts/devbible-linkcheck.py`**, which checks existence *and* routing. **Use it.**

**2 · Two factual errors, both from JDK 25 source:**
- Topic 01 claimed metaspace OOMs do not fire the heap-dump hook.
  `metaspace.cpp::report_metadata_oome` **does** call `report_java_out_of_memory` — the man page's
  "Java Heap exhaustion" wording is narrower than the implementation. The page now documents the
  discrepancy instead of repeating the man page.
- Four pages presented `OutOfMemoryError: Direct buffer memory` as a **literal** message. It does
  not exist: `java.nio.Bits` throws
  `Cannot reserve N bytes of direct buffer memory (allocated: …, limit: …)`. Grepping logs for the
  short string finds nothing.

**The lesson worth carrying:** *a topic marked closed is not verified.* Both defects survived a
close-out QC pass. What caught them was a later agent reading the source for its own topic. Build
verification into the fork brief — tell forks to report defects they find **outside** their
directory, because they are the ones who will find them.

## 🔴 Also corrected: a tool this store said was broken

`mdxcheck.py` was recorded here and in [[research-java-p12-t01-jvm-memory-internals]] as scanning
nothing. **Tested against a control file with a deliberate bare `<Tag` in prose, it caught it.**
`0 MDX hazard(s) in 0 file(s)` = zero hazards across zero **files-with-hits**, a genuine pass. Two
independent agents inferred "broken" from that second number and both were wrong, and both spent
effort working around a tool that was fine. **Test a checker against a known-bad control before
declaring it broken.** Both records are now retracted.
