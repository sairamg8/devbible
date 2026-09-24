---
name: reference-java-concepts-phase5-6
description: Java phases 5–6 — load-bearing claims and sources (written 2026-08-18)
metadata:
  type: reference
---

# Java phases 5–6 — load-bearing claims and sources (written 2026-08-18)

Condensed record so a later session can review or reuse without re-reading the pages.
All claims documentation-validated; no sandbox, no console blocks anywhere.

## Phase 5 · Exceptions (8 topics, 20 files)

- Unchecked = `RuntimeException` + `Error` + subclasses; **`Exception` itself is
  checked** (JLS §11). `catch (Exception)` catches both checked and runtime.
- try-with-resources: JDK 7 (JSR 334); JDK 9 effectively-final existing-variable form
  (JEP 213); JDK 25 `try (var _ = …)` unnamed variable (JEP 456). Resources close in
  **reverse declaration order**; null resource skipped; resource vars implicitly final;
  desugaring per JLS §14.20.3 (shown as code on the page — that is spec, not output).
- Suppression: body + close both throw → **body's exception is primary**, close's
  attached via `addSuppressed`; `getSuppressed` vs cause chain are orthogonal;
  suppression disabled via protected `Throwable` ctor (enableSuppression=false).
- `Closeable.close` idempotent by contract, throws IOException;
  `AutoCloseable.close` throws Exception, NOT required idempotent, discouraged from
  throwing InterruptedException. `ExecutorService` is AutoCloseable since JDK 21 and
  `close()` blocks. `Files.lines` stream must be closed (holds the file).
- Stack traces: read bottom `Caused by` first; `[CIRCULAR REFERENCE]` marker;
  "Exception in thread X" printed by the default uncaught-exception handler.
- Streams + checked: `UncheckedIOException` is the JDK's blessed carrier (cause
  required); mid-read errors in `Files.lines` pipelines surface as UncheckedIOException.
- Happy-path `try` is ~zero cost (JVM exception tables, JVMS §3.12); cost is in
  `fillInStackTrace` at construction.

## Phase 6 · Concurrency (17 topics, 42 files, ~7,150 lines)

- Interruption is cooperative; `interrupted()` clears the flag, `isInterrupted()`
  doesn't; InterruptedException clears it — restore or rethrow. `stop`/`suspend`
  throw UnsupportedOperationException since JDK 20.
- Virtual threads: JEP 444 (JDK 21 final). Carrier FIFO ForkJoinPool; mount/unmount at
  blocking points; forced daemon, fixed priority, empty default name; **never pool
  them** — limit with a Semaphore at the resource. Economics change, JMM does not.
- **Pinning: `synchronized` pinning FIXED in JDK 24 (JEP 491)**; native/JNI frames
  still pin; `-Djdk.tracePinnedThreads` REMOVED in JDK 24 → use JFR
  `jdk.VirtualThreadPinned`. Syllabus row corrected accordingly (`12b9da89`).
- Data race (JLS §17.4.5) ≠ race condition — volatile check-then-act is a race
  condition with no data race. Double-charge fix ladder: JVM lock → conditional
  UPDATE/version column → idempotency key under a unique constraint.
- `synchronized`: monitor per object; static sync locks the Class object and does NOT
  exclude instance-sync; unlock→lock is a happens-before edge so **read paths must
  lock too**; never lock interned Strings/boxed primitives/value-based classes
  (JEP 390); lock on private final Object, not `this`.
- JMM: happens-before edges (program order, monitor, volatile, start, join, final-field
  freeze §17.5); volatile = visibility+ordering, NOT atomicity; DCL broken without
  volatile, holder idiom preferred (§12.4.2); word tearing §17.7.
- Pools: core→queue→max→reject admission — **unbounded queue makes max irrelevant**;
  execute vs submit (submit swallows into the Future); fixed-rate vs fixed-delay;
  an exception suppresses subsequent scheduled runs; shutdown→awaitTermination→
  shutdownNow drain; `close()` since JDK 19.
- CompletableFuture: commonPool default (shared with parallel streams; parallelism<2 →
  thread-per-task); thenApply/thenCompose = map/flatMap; allOf fail-fast join idiom;
  anyOf losers keep running; orTimeout uses ONE JVM-wide scheduler thread; `cancel`
  does NOT interrupt; join→CompletionException vs get→ExecutionException.
- **Structured concurrency JEP 505 is STILL PREVIEW in JDK 25 (5th preview)** and the
  API reshaped: `open()`/`Joiner`, not the older ShutdownOnFailure — old tutorials
  don't compile. Subtask is not a Future; owner-thread confinement.
- ScopedValue **FINAL in JDK 25 (JEP 506)**; ThreadLocal pool leak (remove() in
  finally); InheritableThreadLocal copies at thread creation → broken by pools.
- Locks: `lock()` BEFORE the try (not inside); zero-arg tryLock barges past fairness;
  RRWL no upgrade (self-deadlock), downgrade OK; StampedLock not reentrant; Javadoc's
  own advice: synchronized unless a capability is needed.
- Atomics: CAS = volatile read+write effects; updateAndGet functions must be pure
  (re-executed under contention); ABA → AtomicStampedReference or fresh immutable
  objects; LongAdder striping, `sum()` not a snapshot.
- ConcurrentHashMap: no nulls; computeIfAbsent atomic per key, must not recursively
  update the same map, cache-a-future pattern for slow loads; size() weakly consistent.
  COW lists = snapshot iterators, read-mostly. BlockingQueue put/take vs offer/poll.
- Deadlock: Coffman conditions; global lock ordering (identityHashCode tie-break);
  open calls; JVM detector (`jstack`, ThreadMXBean.findDeadlockedThreads) sees monitor/
  ownable-sync cycles only — NOT pool-exhaustion resource deadlocks; BLOCKED = monitor
  entry, WAITING = coordination; `jcmd Thread.dump_to_file` for virtual threads.
- Immutability: JLS §17.5 final-field freeze needs proper construction (no `this`
  escape); List.copyOf rejects nulls; volatile-snapshot-swap read-once discipline;
  wait/notify: synchronized + while + notifyAll — three independent reasons for the
  while loop (spurious wakeups per Javadoc, missed signals, multiple waiters);
  wait releases the monitor, sleep does not.

## Process facts

- Phase 5 commits: `999ef611` (07+08) → `f2bf39d6` (03+boards) → `225887e1` +
  `da2e68e9` (rule-13 depth pass). Phase 6: `5da5c6cb` `4aff01a5` `1cce18c0`
  `21493401` `29047407` `d8346ad1` `12b9da89`.
- Rule-13 uniform-count tell caught TWICE in fork output (P5: 11 files at exactly 6
  questions; fork D self-caught the same). **QC every fork batch by counting
  `^\*\*Symptom` and `^\*\*★` per file** — uniformity means dispatch a depth pass.
- The placeholder sweep at phase close is scriptable: bold `**topic NN …** *(not
  written yet)*` (multi-line-safe), footer `**NN · Title**` form, and plain
  `topic NN,` form; watch the `../` prefix for files inside chunk dirs.
