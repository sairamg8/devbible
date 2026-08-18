---
title: "Using them well"
sidebar_label: "3 · Using them well"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Thread.Builder`,
> `Thread.ofVirtual`/`ofPlatform`, `Thread.startVirtualThread`,
> `Executors.newVirtualThreadPerTaskExecutor` and
> `java.util.concurrent.Semaphore`; JEP 444 (recommended usage) and
> JEP 491 (JDK 24); and the JDK 25 Core Libraries virtual-threads guide's
> "don't pool" and pinning guidance.

**The API is small on purpose: builders to make threads, one executor
factory to make one-thread-per-task pools, and — this is the part that
takes unlearning — no pooling, ever, of the threads themselves. Virtual
threads are cheap task containers, not scarce workers: you limit *work in
flight* with a semaphore where a resource demands it, and you reach for a
platform thread only in the few places an OS thread is genuinely the right
tool.**

## Creating them

```java
Thread.startVirtualThread(() -> handle(request));      // fire-and-go shorthand

Thread t = Thread.ofVirtual()                          // the builder
        .name("order-", 0)                             // counted names: order-0, order-1…
        .unstarted(() -> handle(request));
t.start();

ThreadFactory factory = Thread.ofVirtual().name("job-", 0).factory();
```

`Thread.ofPlatform()` is the same builder shape for platform threads
(`.daemon()`, `.stackSize(...)` exist there; they don't apply to virtual).
Name your virtual threads — the default name is empty, and an empty name
is what your log pattern and dumps will show.

The construction detail that bites frameworks: `new Thread(...)`
constructors only ever make platform threads — virtual threads come from
the builder or the executor. Code that instantiates `Thread` subclasses
cannot be switched by configuration.

## The executor: one thread per task

```java
try (ExecutorService exec = Executors.newVirtualThreadPerTaskExecutor()) {
    Future<Quote>  q = exec.submit(this::fetchQuote);     // each submit →
    Future<Score>  s = exec.submit(this::fetchScore);     // a NEW virtual thread
    render(q.get(), s.get());
}   // ExecutorService is AutoCloseable (19+): close() awaits tasks
```

It implements `ExecutorService`, so it drops into every API that accepts
one — that compatibility is how frameworks flipped with one property. But
it is not a *pool*: no queue, no core size, no reuse. Every task gets a
fresh thread immediately; "pool exhausted" ceases to exist as a failure
mode, and so does the pool as a throttle.

Two consequences of tasks being cheap threads now:

- **Scope them.** The try-with-resources form
  ([phase 5, topic 03](../../phase-5-exceptions/03-try-with-resources/README.md))
  gives tasks a lifetime the code shows. Structured concurrency
  (**topic 08** *(not written yet)*) tightens this further —
  fan-out/join with automatic cancellation.
- **Don't cache the executor as a shared "pool" singleton** out of habit;
  per-use executors are fine and make shutdown local. (A shared one is
  not *wrong* — it's just no longer buying anything.)

## Limiting concurrency — on purpose, where it matters

The worker pool used to throttle everything by accident. The deliberate
replacement: a `Semaphore` at the constrained resource.

```java
private final Semaphore dbPermits = new Semaphore(50);   // what the DB tolerates

Result query(String sql) throws InterruptedException {
    dbPermits.acquire();               // excess callers park — cheaply, they're virtual
    try {
        return jdbc.run(sql);
    } finally {
        dbPermits.release();
    }
}
```

This is strictly better than sizing a thread pool to 50: the limit sits
*at the resource it protects*, is independent per resource (50 for the DB,
200 for the search index), and waiting costs a parked virtual thread
instead of a blocked OS worker. The JDK guide recommends exactly this
shape. (**Topic 16** *(not written yet)* covers `Semaphore` itself.)

## When platform threads still win

- **CPU-bound work.** No blocking → no unmounting → virtual threads add
  machinery and subtract nothing. A sized pool of platform threads
  (≈ core count) remains correct for compute (**topic 06** *(not written
  yet)*).
- **Work that must survive to JVM exit** — virtual threads are daemons,
  always; a flush-on-shutdown loop belongs on a user platform thread
  ([topic 01](../01-threads-lifecycle-interrupt/01-lifecycle-start-daemons.md)).
- **Long-lived identity threads** — an event-loop owner, a watchdog, a
  thread that JNI code expects to call back on: stable OS identity is the
  point, so use the thread kind that has one.
- **Hot `ThreadLocal` caches you can't yet redesign** — until the
  migration to shared immutables or `ScopedValue` happens, the per-task
  multiplication cost is real
  ([chunk 2](02-what-changed-what-didnt.md)).

## Pinning, in brief

*Pinning* = a virtual thread blocking while it cannot unmount, so the
carrier blocks too. Two sources remain on JDK 24+: **native frames**
(JNI/FFM on the stack) and certain **file-system operations** (the
scheduler compensates by growing the carrier pool temporarily). The
historically loudest source — blocking inside `synchronized` — was fixed
by JEP 491 in JDK 24; on JDK 21–23 the standing advice was to convert
hot `synchronized` blocks that block within to `ReentrantLock`. On a
current JDK that rewrite is no longer needed for pinning reasons. Detect
what remains with `jdk.VirtualThreadPinned` (JFR). The full treatment —
including the 21-era guidance you'll still meet in the wild — is
**topic 14** *(not written yet)*.

## Migration checklist (thread-per-request services)

1. JDK 24+ if at all possible (else audit `synchronized`-then-block
   paths).
2. Flip the framework switch (Spring: `spring.threads.virtual.enabled`) —
   request handling moves to virtual threads.
3. Bound every constrained downstream explicitly (connection pools were
   already bounded; add semaphores where the pool isn't the entry point).
4. Audit `ThreadLocal` for caches and cross-task reuse.
5. Re-key saturation dashboards from pool gauges to in-flight counts;
   enable JFR pinning events.
6. Leave CPU-bound pools (and their sizing) alone.

## Gotchas

**Symptom:** a "virtual thread pool" of 200 reused virtual threads, faithfully ported from the old config
**Cause:** pooling transplanted without its premise — reuse amortizes creation cost that no longer exists, and 200 reused threads reinstate the old ceiling
**Fix:** one new virtual thread per task (`newVirtualThreadPerTaskExecutor`); express limits as semaphores at resources, not as thread counts

**Symptom:** `Executors.newFixedThreadPool(200, virtualFactory)` — hybrid meant as "bounded virtual pool"
**Cause:** same misunderstanding with an API face-lift: it queues tasks behind 200 long-lived virtual threads, recreating pool semantics and losing per-task freshness
**Fix:** unbounded per-task executor + explicit `Semaphore` where the bound belongs

**Symptom:** framework config flag flipped, but some requests still run on platform pool threads
**Cause:** code paths that build threads directly (`new Thread`, custom factories, `@Async` executors configured elsewhere) bypass the flag
**Fix:** find thread creation sites; route them through `Thread.ofVirtual()` factories or the per-task executor

**Symptom:** logs show empty thread names everywhere after migration
**Cause:** virtual threads default to an empty name, and the old pattern leaned on pool worker names
**Fix:** `.name("prefix-", 0)` on the builder/factory — or better, log a request/task id via MDC or `ScopedValue` (**topic 12** *(not written yet)*)

**Symptom:** on JDK 21 in production, sporadic whole-service stalls under load traced to carriers all `BLOCKED`
**Cause:** synchronized-block pinning (pre-JEP 491) starving the carrier pool
**Fix:** upgrade to 24+; if pinned to 21, convert the offending `synchronized` sections to `ReentrantLock` and watch `jdk.VirtualThreadPinned`

**Symptom:** batch of CPU-heavy encodings moved to virtual threads; p99 of unrelated requests degrades
**Cause:** compute-bound virtual threads don't unmount — they occupy carriers for whole time slices the scheduler never reclaims mid-run
**Fix:** CPU work goes to a dedicated, sized platform pool; virtual threads are for work that *blocks*

**Symptom:** `submit()` accepted a million tasks and the process died of heap exhaustion before any backpressure fired
**Cause:** per-task executor has no queue bound — admission control was implicit in the old pool and nobody re-added it
**Fix:** bound admission where work *enters* (server connector limits, a semaphore at intake), not in the executor

## Interview questions

**★ Why is pooling virtual threads an anti-pattern?**
Pools exist to amortize expensive creation and cap a scarce resource.
Virtual threads are cheap to create and not scarce — a pool adds queuing,
reuse hazards (`ThreadLocal` bleed-through) and reinstates an arbitrary
concurrency ceiling while buying nothing. The correct decomposition:
per-task threads for structure, semaphores for limits.

**★ How do you bound load on a database once the request pool no longer does it?**
Keep the connection pool bounded (it already is) and gate the section
that *uses* connections with a `Semaphore` sized to what the DB tolerates.
Excess requests park cheaply on `acquire()`. The bound lives at the
resource, is tunable independently of every other resource, and its
permit count is your new saturation metric.

**★ What does JEP 491 change about migration advice?**
Pre-24, blocking inside `synchronized` pinned the carrier, so guides said
"convert hot synchronized-then-block code to `ReentrantLock`". JDK 24
made `synchronized` yield the carrier like other blocking, so that
rewrite is obsolete *for pinning purposes* — remaining pinning sources
are native frames and some file I/O. Lock choice goes back to being about
features (fairness, `tryLock`, conditions), not virtual-thread survival.

**★ A colleague replaces every executor in the codebase — including the image-resizing pool — with `newVirtualThreadPerTaskExecutor`. Review it.**
Request-handling and I/O-bound executors: good change. The image-resizing
pool is CPU-bound: virtual threads won't unmount during compute, so the
change removes the deliberate ≈core-count cap and lets resize jobs crowd
carriers, hurting everything else. Keep compute on a sized platform pool;
the sizing rules are **topic 06**'s *(not written yet)*.

**★ Where do virtual threads come from, API-wise, and what can't `new Thread()` give you?**
`Thread.ofVirtual()` (builder → `start`/`unstarted`/`factory`),
`Thread.startVirtualThread(runnable)`, and
`Executors.newVirtualThreadPerTaskExecutor()`. The `Thread` constructors
predate the split and always produce platform threads — which is why
thread-subclassing code can't be migrated by configuration, only by
switching to builders/factories.

**★ Design the shutdown story for a service whose background work runs on virtual threads.**
Virtual threads never block JVM exit (forced daemons), so orderly
shutdown must be explicit: keep each work group in an `ExecutorService`
(or structured scope), and on shutdown call `shutdown()` +
`awaitTermination`/`close()` so in-flight tasks finish, using
[interruption](../01-threads-lifecycle-interrupt/02-interruption.md) via
`shutdownNow` for the impatient path. Anything that must run *even on
abrupt exit* belongs in a shutdown hook on a platform thread.

---

← Prev: [What changed, what didn't](02-what-changed-what-didnt.md) · Index: [Platform vs virtual threads](README.md) · Next → **03 · Race conditions** *(not written yet)*
