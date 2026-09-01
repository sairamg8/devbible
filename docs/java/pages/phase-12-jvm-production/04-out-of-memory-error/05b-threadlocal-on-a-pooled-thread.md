---
title: "A ThreadLocal's map entry holds its key weakly and its value strongly, so on a pooled thread that never dies the value is retained until something calls remove — and the JDK's own comment says stale entries are cleaned only when the table runs out of space"
sidebar_label: "05b · ThreadLocal on a pool"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 source at tag `jdk-25+36`** —
> `java/lang/ThreadLocal.java` (the class javadoc and the `ThreadLocalMap` implementation comment)
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/java.base/share/classes/java/lang/ThreadLocal.java)),
> **JEP 506 "Scoped Values"** (`Closed/Delivered`, Release 25) for the design critique of
> thread-local variables ([openjdk.org](https://openjdk.org/jeps/506)), and the **Eclipse Memory
> Analyzer documentation** for `Thread` as a GC root type
> ([help.eclipse.org](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/gcroots.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**`ThreadLocal` is safe on a thread you own and dangerous on a thread you borrow, and the reason is
one sentence in its own javadoc: the value lives as long as the thread does. On a servlet container,
a `ForkJoinPool`, a scheduled executor or any framework-managed pool, the thread outlives the
request, the transaction, the tenant and often the deployment. Everything the request attached to
it stays reachable, indefinitely, and the weak key that everyone points to as the safety mechanism
does not help.**

## The sentence that is the whole bug

From the `ThreadLocal` class javadoc:

> *"Each thread holds an implicit reference to its copy of a thread-local variable **as long as the
> thread is alive** and the `ThreadLocal` instance is accessible; after a thread goes away, all of
> its copies of thread-local instances are subject to garbage collection (unless other references
> to these copies exist)."*

Read the condition: *after a thread goes away*. In a pool, threads do not go away. The mechanism
described as the cleanup path never runs.

## Why the weak key does not save you

The usual reassurance is "`ThreadLocalMap` uses weak references, so it cleans itself up". The
implementation comment says what that actually buys:

> *"ThreadLocalMap is a customized hash map suitable only for maintaining thread local values… To
> help deal with very large and long-lived usages, the hash table entries use **WeakReferences for
> keys**. However, since **reference queues are not used**, stale entries are guaranteed to be
> removed only **when the table starts running out of space**."*

and the entry itself:

```java
static class Entry extends WeakReference<ThreadLocal<?>> {
    /** The value associated with this ThreadLocal. */
    Object value;
}
```

🔴 **The key is weak; the value is a plain strong field.** Three consequences, in increasing order
of importance:

1. **The key is almost never collectable anyway.** The canonical declaration is
   `private static final ThreadLocal<X> CONTEXT = new ThreadLocal<>();` — a static field, hence a
   GC root, hence permanently strongly reachable. The weak reference has nothing to do.
2. **Even if the key were cleared, the value would not be.** The `value` field is strong. The entry
   becomes "stale" — key `null`, value alive — and stays that way until an operation on the table
   happens to expunge it.
3. **Expunging is opportunistic.** *"stale entries are guaranteed to be removed only when the table
   starts running out of space."* On a pooled thread that gets one value per request and never
   grows the table, that condition may never be reached.

So the reference chain that keeps your object alive is entirely strong:

```
  Thread (a GC root — MAT: "A started, but not stopped, thread")
     ↓  threadLocals
  ThreadLocalMap
     ↓  table[i]
  Entry           (key: WeakReference<ThreadLocal>, value: strong)
     ↓  value
  your object     ─────>  and everything it reaches
```

## What gets attached in practice

Almost none of these are written by you, which is why the leak survives code review:

- **MDC** — SLF4J's diagnostic context is a `ThreadLocal` map. **Topic 07 · Logging done right**
  *(not written yet)* owns it; the memory consequence is here.
- **Security context** — Spring Security's `SecurityContextHolder` defaults to a thread-local
  strategy, holding the authentication and therefore the principal and its authorities.
- **Transaction and connection binding** — Spring's `TransactionSynchronizationManager` binds
  resources to the current thread.
- **Request context** — `RequestContextHolder`, and anything a filter chose to stash.
- **Tracing scope** — an unclosed OpenTelemetry `Scope` leaves the span on the thread.
- **Formatters and buffers** — the classic `ThreadLocal<SimpleDateFormat>` optimisation, and
  `ThreadLocal<byte[]>` buffer pools, both of which are *intentionally* retained and both of which
  become unbounded if the buffer is grown to fit the largest request ever seen.

The leak is rarely the value itself. It is what the value reaches: a principal holding a user
object holding a tenant object holding a cached configuration graph.

## The fix, and where it has to go

```java
private static final ThreadLocal<RequestContext> CONTEXT = new ThreadLocal<>();

@Override
public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
        throws IOException, ServletException {
    CONTEXT.set(RequestContext.from(req));
    try {
        chain.doFilter(req, res);
    } finally {
        CONTEXT.remove();          // NOT set(null) — remove() drops the entry
    }
}
```

⚠️ **`set(null)` is not `remove()`.** `set(null)` leaves the entry in the table with a `null` value;
the entry, the key reference and the table slot all remain. `remove()` clears the entry. The
javadoc for `remove` also notes a subtlety worth knowing: *"If this thread-local variable is
subsequently read by the current thread, its value will be reinitialized by invoking its
`initialValue` method"* — so a `remove()` followed by a stray `get()` re-populates it, which is
another reason the `finally` must be the last thing that touches it.

**The `finally` is not optional and its placement is not arbitrary.** It must be in the outermost
frame that owns the thread for the duration of the unit of work — the servlet filter, the message
listener, the scheduled task's entry point. Putting it in a service method means an early return
or an exception in a *caller* skips it.

## The correctness bug hiding behind the memory bug

JEP 506's critique of thread-local variables is the best short statement of why this is worse than
a leak:

> *"Once a thread's copy of a thread-local variable is set via the `set` method, the value to which
> it was set is retained for the lifetime of the thread, or until code in the thread calls the
> `remove` method. Unfortunately, developers often forget to call `remove`, so per-thread data is
> often retained for longer than necessary. In particular, **if a thread pool is used, the value of
> a thread-local variable set in one task could, if not properly cleared, accidentally leak into an
> unrelated task, potentially leading to dangerous security vulnerabilities.** In addition… there
> may be no clear point at which it is safe for a thread to call `remove`; this can cause a
> long-term memory leak, since per-thread data will not be garbage-collected until the thread
> exits."*

🔴 **"Leak into an unrelated task" means request A's authenticated principal being visible to
request B.** The memory growth is the symptom you will notice; the cross-request data exposure is
the one that matters.

JEP 506 names a third cost that bites at scale:

> *"**Expensive inheritance** — The overhead of thread-local variables may be worse when using large
> numbers of threads, because thread-local variables of a parent thread can be inherited by child
> threads… the child thread has to allocate storage for every thread-local variable previously
> written in the parent thread. This can add significant memory footprint."*

That is `InheritableThreadLocal`, and with a million virtual threads it is not a rounding error.

## `ScopedValue`, final in JDK 25

JEP 506 is `Closed/Delivered` for **Release 25**, so this is available now rather than as a
preview:

```java
private static final ScopedValue<RequestContext> CONTEXT = ScopedValue.newInstance();

ScopedValue.where(CONTEXT, RequestContext.from(req))
           .run(() -> chain.doFilter(req, res));
// binding is gone here — structurally, with no finally to forget
```

The binding's lifetime is the dynamic extent of the `run` call, so there is nothing to remove and
nothing to leak. The value is immutable, so there is no "who set this" question either. Its goals,
verbatim: *"Ease of use… Comprehensibility — The lifetime of shared data should be apparent from
the syntactic structure of code. Robustness — Data shared by a caller should be retrievable only by
legitimate callees. Performance — Data should be efficiently sharable across a large number of
threads."*

⚠️ **It is not a drop-in replacement and the JEP says so:** *"It is not a goal to require migration
away from thread-local variables, or to deprecate the existing `ThreadLocal` API."* `ScopedValue`
is immutable and scoped; if your code genuinely needs a mutable per-thread slot set by one method
and read by an unrelated one, it does not apply. But for the request-context case — set at the
boundary, read by callees, discarded at the end — it is exactly the right shape and removes the
class of bug entirely.

## Finding it in a dump

The chain is fully strong, so the standard tools work without changing any exclusions:

1. Dominator tree sorted by retained heap. `Thread` objects near the top are the tell.
2. Expand a `Thread` → `threadLocals` → `table` and read the entries. Each one names a
   `ThreadLocal` subclass, which usually identifies the framework.
3. Path to GC Roots on the retained object confirms the chain terminates at the thread.
4. The thread's *name* identifies the pool, and therefore who owns the lifecycle that should have
   cleaned up.

⚠️ **`ThreadLocalMap.Entry` extends `WeakReference`, and MAT's path queries exclude weak references
by default.** The *value* field is a plain field so the path through it is found normally — but if
you ever need to see why the *key* is retained, you must relax `-excludes`
([04c](04c-leak-suspects-and-paths-to-gc-roots.md)).

## Gotchas

**★ The weak key protects the `ThreadLocal` object, not the value.**
`Entry extends WeakReference<ThreadLocal<?>>` with a strong `Object value` field. The thing you care
about is the value, and it is held strongly. This is the single most repeated piece of wrong
reassurance about `ThreadLocal`.

**★ Stale-entry cleanup is opportunistic, not guaranteed.**
The JDK's own comment: *"since reference queues are not used, stale entries are guaranteed to be
removed only when the table starts running out of space."* A pooled thread with a handful of
thread-locals never runs out of space, so cleanup may never happen.

**★ `set(null)` is not `remove()`.**
`set(null)` leaves the entry, the key and the slot in place with a null value. Only `remove()`
drops the entry. Code that "clears" thread-locals with `set(null)` has not cleared anything
structurally.

**★ The `finally` has to be in the frame that owns the thread, not in the service method.**
A filter, a message listener, a task's `run`. Placing it deeper means an exception or early return
in a caller skips it, and skipping it once on a pooled thread is a permanent retention.

**★ The security consequence is worse than the memory consequence.**
JEP 506: a value *"set in one task could, if not properly cleared, accidentally leak into an
unrelated task, potentially leading to dangerous security vulnerabilities."* Request A's principal
visible to request B is a data-exposure incident, not a performance issue.

**★ A `ThreadLocal` buffer sized to the largest request ever seen never shrinks.**
`ThreadLocal<byte[]>` pooling is a real optimisation and a real trap: grow the buffer once for a
100 MB upload and every thread in the pool that ever handles one keeps 100 MB for the life of the
process. Cap the reusable size and allocate above it.

**★ `InheritableThreadLocal` multiplies the cost by the number of child threads.**
JEP 506's *"expensive inheritance"*: each child allocates storage for every thread-local written in
the parent. With virtual threads, where child threads are created freely, this is a footprint
decision rather than a detail.

**★ A framework's `ThreadLocal` is still your leak.**
MDC, security context, transaction synchronisation, tracing scope — you did not write any of them
and you still have to ensure the boundary clears them. Frameworks generally do clean up their own;
the leak arrives when custom code sets something in a filter that the framework knows nothing about.

**★ Virtual threads change the calculus but do not remove the bug.**
A virtual thread is short-lived, so a `ThreadLocal` set on one dies with it — but the carrier's
pool is still bounded and a `ThreadLocal` on a *platform* thread in that pool behaves exactly as
before. And with a million virtual threads, per-thread storage is a footprint question in its own
right. [`../01-memory-layout/06b`](../01-memory-layout/06b-virtual-thread-stacks.md) owns the
mechanics.

**★ `ScopedValue` is final in JDK 25 but is not a `ThreadLocal` replacement.**
JEP 506 lists "require migration away from thread-local variables" as an explicit non-goal. It is
immutable and lexically scoped. Where that fits — the request-context case — it removes the bug
class; where it does not, `remove()` in a `finally` is still the answer.

## Interview questions

**★ Why does a `ThreadLocal` leak on a thread pool but not in a plain application?**
Because its javadoc's cleanup condition is that the thread ends: *"after a thread goes away, all of
its copies of thread-local instances are subject to garbage collection."* A pooled thread never
goes away — it is reused for the next task and the next, for the life of the pool, which is usually
the life of the process. Everything a task attached to the thread stays reachable through the
thread, and MAT lists `Thread` as a GC root precisely because a started, unstopped thread is
reachable from outside the heap. The fix is `remove()` in a `finally` at the boundary that owns the
unit of work.

**★ `ThreadLocalMap` uses weak references. Doesn't that prevent the leak?**
No, for two reasons that compound. The weak reference is on the *key* — the `ThreadLocal` object
itself — while the *value* is an ordinary strong field on the entry, and the value is what holds
your data. And the key is normally a `private static final` field, which makes it a GC root, so the
weak reference never clears in the first place. Even in the case where it does, the JDK's own
comment says *"since reference queues are not used, stale entries are guaranteed to be removed only
when the table starts running out of space"* — so cleanup is opportunistic and, on a thread holding
a small fixed number of thread-locals, may never happen at all.

**★ What is worse than the memory growth in this bug?**
Cross-request data exposure. JEP 506 states it directly: *"if a thread pool is used, the value of a
thread-local variable set in one task could, if not properly cleared, accidentally leak into an
unrelated task, potentially leading to dangerous security vulnerabilities."* If the thread-local
holds an authenticated principal, a tenant identifier or a decrypted secret, the next request
handled by that thread reads it. The memory growth is the symptom that eventually gets someone's
attention; the exposure is the one that ends up in an incident report.

**★ How does `ScopedValue` fix this, and when can you not use it?**
It replaces "set a value and remember to remove it" with "bind a value for the dynamic extent of a
call". `ScopedValue.where(V, value).run(() -> …)` makes the binding's lifetime the syntactic
structure of the code, so there is no `finally` to forget and no way for the value to survive into
the next task on the same thread. It is also immutable, which removes the "who set this and when"
problem that JEP 506 calls unconstrained mutability. You cannot use it where the code genuinely
needs a mutable per-thread slot written by one component and read by an unrelated one — and the JEP
is explicit that migrating away from `ThreadLocal` is not a goal, so both APIs are supported on
JDK 25.

**★ How would you spot this in a heap dump?**
`Thread` objects high in the dominator tree sorted by retained heap. Expand one to
`threadLocals` → `table` and read the entries: each names a `ThreadLocal` subclass, which usually
identifies the framework or the filter responsible, and the thread's own name identifies the pool.
The whole chain from thread to value is strong references, so nothing about MAT's default exclusion
of weak and soft references gets in the way — which is convenient, given that the entry class
itself extends `WeakReference`.

{/* FOOTER */}
