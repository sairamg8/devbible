---
title: "ThreadLocal — the slot and the leak"
sidebar_label: "1 · ThreadLocal"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `ThreadLocal`
> (including the class-level lifetime note), `InheritableThreadLocal`
> (copy-at-creation semantics) and `ThreadLocal.withInitial`.

**A `ThreadLocal<T>` gives every thread its own independent copy of a
variable: same field, different value per thread, no synchronization needed
because no sharing happens. That confinement is the legitimate use. The
troubles all come from the lifetime rule in the Javadoc: the value lives
*as long as the thread lives*. On a pooled thread that is "forever", which
turns a per-request context into a leak; on a million virtual threads it
turns a small cache into a large one.**

## The mechanics

```java
private static final ThreadLocal<RequestContext> CTX =
        ThreadLocal.withInitial(RequestContext::empty);   // lazy, per thread

CTX.set(new RequestContext(userId, traceId));   // this thread's copy only
RequestContext ctx = CTX.get();                 // reads this thread's copy
CTX.remove();                                   // deletes this thread's copy
```

Each `Thread` object carries a private map keyed (weakly) by the
`ThreadLocal` instance itself — the static field is the *key*, the values
live *on the threads*. Consequences:

- `get()` on a thread that never called `set` returns the
  `initialValue()` result (`null` by default; `withInitial` supplies a
  factory — evaluated lazily, once per thread).
- There is no way to read or clear *another* thread's copy. Cleanup is
  strictly the owning thread's job — hence `remove()` in `finally`.
- The key is weakly referenced, but values are cleared lazily; dropping
  the `ThreadLocal` field does not promptly free per-thread values. The
  Javadoc's rule is the practical one: the value lives with the thread.

## The three classic uses

1. **Request context** — user, tenant, locale, trace id, set by a filter
   at the top of the request and read by logging (`MDC` in Logback/Log4j
   is a `ThreadLocal` map), auditing and security code anywhere below,
   with no `ctx` parameter on every method. This is the use `ScopedValue`
   [was built to replace](02-scopedvalue.md).
2. **A per-thread copy of a non-thread-safe helper.** The canonical
   example was `SimpleDateFormat` — mutable, unsafe to share, expensive to
   create, so each thread kept one. Modern code uses the immutable
   `java.time.format.DateTimeFormatter` and the pattern survives only for
   other unsafe legacies (`MessageDigest` instances, some parsers).
3. **Framework plumbing you don't see** — Spring's transaction and request
   synchronization, security contexts, JDBC connection holders. Worth
   knowing because *their* leak symptoms surface as *your* bugs.

## The pooled-thread leak

A pool ([topic 06](../06-executorservice-pools/README.md)) reuses threads
across tasks. A `ThreadLocal` set during task A and not removed is still
there when the same thread runs task B:

```java
executor.submit(() -> {
    CTX.set(contextFor(request));        // task A
    handle(request);                     // forgot remove()
});
// later, same pool thread:
executor.submit(() -> {
    audit(CTX.get());                    // task B reads task A's user!
});
```

Two distinct failure modes:

- **Correctness bleed** — request B observes request A's user, tenant or
  transaction. In a multi-tenant service this is a data-exposure incident,
  and it is intermittent because it needs the *same* worker thread.
- **Memory retention** — the value graph is reachable from a long-lived
  thread. In application servers this classically pinned redeployed
  classloaders (the value's class holds its loader), the historical "leak
  on redeploy" warning.

The discipline is mechanical:

```java
CTX.set(context);
try {
    handle(request);
} finally {
    CTX.remove();        // ALWAYS — the pool keeps the thread
}
```

## `InheritableThreadLocal` — and why executors break it

`InheritableThreadLocal` copies the parent's values into a child thread
**at thread creation**. That worked when code spawned threads directly;
with a pool it fails silently twice over:

- Pool threads were created at pool startup — they inherited the values of
  whichever thread built the pool, not of the submitting thread.
- Creation-time copying never re-runs on reuse, so submitted tasks see
  stale or foreign context anyway.

Propagating context *per task* therefore has to be done by the submitter —
capture the value, wrap the `Runnable`, set/remove inside it. Framework
"context propagation" libraries are this pattern industrialized.
`ScopedValue` inheritance (chunk 2) is per-*fork*, which is why it
composes with task-per-thread designs.

## Virtual threads: supported, but the economics flip

Virtual threads fully support `ThreadLocal` — migrated code keeps working
([what changed, what didn't](../02-platform-vs-virtual-threads/02-what-changed-what-didnt.md)).
But two premises quietly die:

- **"Per-thread" stops meaning "a few hundred copies".** A slot that
  cached a 50 KB buffer per worker was an optimization at 200 platform
  threads and is a heap problem at a million virtual ones.
- **Reuse-based caching stops paying at all.** A fresh thread per task
  means the "expensive object, reused across tasks on this thread" cache
  never gets a second hit — you pay the construction every task *plus* the
  slot bookkeeping.

Confinement-for-correctness (use 2) survives; caching-for-performance
should move to a bounded shared pool of objects or be rebuilt immutably.
Request context (use 1) is exactly what `ScopedValue` replaces.

## Gotchas

**Symptom:** intermittent wrong-user data in responses, only under load, unreproducible locally
**Cause:** context `ThreadLocal` set per request, never removed; pool reuse hands request A's context to request B on the same worker
**Fix:** `set` / `try` / `finally remove()` in the outermost filter; an integration test that runs two differently-authenticated requests on a size-1 pool catches it deterministically

**Symptom:** `OutOfMemoryError` grows with uptime in an app server; heap dump shows old classloaders retained via `Thread` → `threadLocals`
**Cause:** values set on pooled server threads outlive the application that set them; the value's class pins its classloader after redeploy
**Fix:** `remove()` on every exit path; on shutdown/undeploy, clear or drain the pool that carried the values

**Symptom:** `InheritableThreadLocal` context arrives empty (or as somebody else's) in tasks run on an executor
**Cause:** inheritance copies at thread *creation*; pool threads were created before your request existed and are never re-created per task
**Fix:** capture the value at submit time and wrap the task (`set` in a `try`/`finally remove()`); or move to `ScopedValue`, whose inheritance is per structured fork

**Symptom:** memory per request roughly doubles after enabling virtual threads
**Cause:** per-thread caches (buffers, formatters) that amortized across pooled workers now instantiate per task-thread
**Fix:** delete reuse caches whose object is now cheap; pool the genuinely expensive objects themselves (a bounded object pool), not the threads

**Symptom:** `ThreadLocal.get()` returns `null` and throws downstream, but only on some code paths
**Cause:** a path reaches the reader without passing the writer (async hop, event callback, scheduled retry) — the new thread has no copy
**Fix:** make the read fail loudly (`Objects.requireNonNull(CTX.get(), "no request context")`); propagate explicitly across every thread hop, or pass the value as a parameter where the chain is short

**Symptom:** setting a `ThreadLocal` from a `CompletableFuture` callback "doesn't stick" for later stages
**Cause:** each stage may run on a different thread ([topic 07](../07-completablefuture/README.md)); the slot was written on one thread and read on another
**Fix:** stop using thread identity as a data channel across async stages — carry context in the value flowing through the stages, or use a context-propagating wrapper at each stage boundary

**Symptom:** unit tests pass in isolation, fail when the suite runs — assertions see other tests' `ThreadLocal` state
**Cause:** test frameworks reuse worker threads too; statics + leftover slots make tests order-dependent
**Fix:** `remove()` in `@AfterEach`; or inject the context object instead of reaching for a static slot

## Interview questions

**★ Where does a `ThreadLocal` value actually live, and what does that imply for cleanup?**
In a map carried by each `Thread` object, keyed by the `ThreadLocal`
instance. So the value's lifetime is the *thread's* lifetime unless
`remove()` runs; no other thread can clean it; and on pooled or reused
threads, forgetting `remove()` means state and memory outlive the task
that set it.

**★ Why is `ThreadLocal` "thread-safe" without synchronization?**
It doesn't make shared data safe — it removes sharing. Each thread reads
and writes only its own copy (thread confinement), so there is no data
race to synchronize away. The moment the *referenced object* is also
reachable from elsewhere and mutable, that object's safety is back on you.

**★ A filter sets the current user in a `ThreadLocal`; sometimes audit logs show the wrong user. Walk the diagnosis.**
Wrong-user rather than missing-user points at reuse, not absence: a pooled
worker carried a previous request's value, so this request read stale
context — the filter must not have `remove()`d on all exit paths (early
returns and exceptions included). Verify by forcing a one-thread pool and
alternating two users. Fix with `finally remove()`, then look for other
set-without-remove sites.

**★ Why does `InheritableThreadLocal` fail with thread pools, and what actually propagates context?**
It copies parent values when a thread is *constructed*; pool threads are
constructed once, at pool build time, by an unrelated thread — so tasks
inherit nothing useful and never refresh. Real propagation happens at
submit time: capture, wrap the task, set/remove inside it — or use
`ScopedValue`, which inherits per structured fork rather than per thread
construction.

**★ You migrate a service to virtual threads. Which `ThreadLocal` uses do you delete, which do you keep, and which do you rewrite?**
Delete: per-thread caches that existed to amortize creation across a
pool's reuse — there is no reuse now, and a million threads multiply the
footprint. Keep (for now): confinement of genuinely non-thread-safe
helpers that are cheap to make per task. Rewrite: request context — to
`ScopedValue` for the set-at-top/read-below shape, gaining bounded
lifetime and immutability instead of `finally remove()` discipline.

**★ The `ThreadLocal` key is held weakly — so does the JVM clean leaks up for you?**
No. The weak reference covers the *key* (the `ThreadLocal` object): once
the field is GC'd, the entry's key clears and the map can expunge stale
entries — but only lazily, during that thread's later `ThreadLocal`
operations. The *value* meanwhile stays strongly reachable from the
thread, and a static `ThreadLocal` field never becomes unreachable at
all — the common case. The weak key is a mitigation for dropped
`ThreadLocal` instances, not a substitute for `remove()`.

**★ Can one thread read or clear another thread's `ThreadLocal` value?**
No API exists for it — the map is private to each thread. That's the
feature (confinement without locks) and the operational catch: leaked
values can only be cleared by code running *on* the leaking thread, which
is why cleanup must be structural (`finally`, filters, executor wrappers)
rather than an admin task.

---

← Prev: [Overview](README.md) · Index: [ThreadLocal and ScopedValue](README.md) · Next → [`ScopedValue` — the 25-era replacement](02-scopedvalue.md)
