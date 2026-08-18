---
title: "Structured concurrency"
sidebar_label: "08 · Structured concurrency"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against JEP 505 (Structured Concurrency, fifth
> preview, JDK 25) and the JDK 25 Javadoc for
> `java.util.concurrent.StructuredTaskScope` (preview API), including
> `StructuredTaskScope.Joiner` and `Subtask`. **Preview API** — shape has
> changed across previews and may change again before finalizing.

**Structured concurrency applies the oldest rule in programming — a
block's work ends when the block ends — to threads. A
`StructuredTaskScope` forks subtasks that *cannot outlive* the scope:
leave the block and every unfinished subtask is cancelled and awaited,
success or failure or exception. That closes the leak class that
unstructured fan-out (`submit` here, `get` maybe-later, forget on the
error path) has always carried, and it gives thread dumps a tree instead
of a flat list.**

⚠️ **Status first, because it decides what you do with this page:**
`StructuredTaskScope` is a **preview** API in JDK 25 (JEP 505 — the
fifth preview), compiled and run only with `--enable-preview`. The API
was **reshaped in 25**: earlier previews (JDK 21–24) had you subclass or
instantiate `ShutdownOnFailure`/`ShutdownOnSuccess`; JDK 25 replaced
those with a static **`open()`** factory and a **`Joiner`** you pass in.
Code and articles from the earlier shape no longer compile. Learn the
concept as durable; treat the exact names as JDK-25-preview facts.

## The leak this closes

The unstructured original:

```java
Future<Profile> p = executor.submit(() -> client.profile(userId));
Future<Orders>  o = executor.submit(() -> client.orders(userId));
return new PageData(p.get(), o.get());   // and if p.get() throws?
```

If `profile` fails, `o` is never `get`-ed, never cancelled, never
observed: it runs to completion for nothing — or forever. The failure
path *leaks a thread of work*. Every fix (try/finally cancels, flags,
`allOf` gymnastics) is manual bookkeeping the compiler can't check —
[the pools chunk](06-executorservice-pools/02-submit-and-futures.md)
ends at exactly this cliff.

## The JDK 25 shape

```java
Response handle(String userId) throws InterruptedException {
    try (var scope = StructuredTaskScope.open()) {     // default joiner
        Subtask<Profile> profile = scope.fork(() -> client.profile(userId));
        Subtask<Orders>  orders  = scope.fork(() -> client.orders(userId));

        scope.join();                                   // wait: all succeed, or throw

        return new Response(profile.get(), orders.get());
    }   // leaving the block: nothing can still be running
}
```

The moving parts:

- **`open()`** starts a scope owned by the current thread. The
  no-argument form uses the default joiner: *all must succeed;* the
  first failure **cancels the scope** — every unfinished sibling is
  interrupted — and `join()` throws `FailedException` with the
  subtask's exception as its cause.
- **`fork(Callable | Runnable)`** starts a subtask on a **new virtual
  thread** by default and returns a `Subtask` — a `Supplier`-shaped
  handle, deliberately not a `Future`: no `cancel`, no blocking `get`.
- **`join()` is mandatory** before reading results; calling
  `Subtask.get()` before the scope joined throws `IllegalStateException`
  rather than blocking. One `join` per scope, called by the owner.
- **`close()`** (the try-with-resources exit —
  [phase 5, topic 03](../phase-5-exceptions/03-try-with-resources/README.md))
  enforces the invariant: if the body exits early — exception between
  `fork` and `join`, early return — the scope is cancelled and close
  *waits* for every subtask to terminate. That wait is the no-leak
  guarantee.
- Only the owner thread may `fork` and `join`; subtasks may open scopes
  of their own, nesting into a tree.

## Joiners — the policy slot

`open(Joiner)` swaps the completion policy:

| Joiner | `join()` returns | Semantics |
|---|---|---|
| default (`open()`) | `void` | all succeed or `FailedException`; results via `Subtask.get()` |
| `Joiner.allSuccessfulOrThrow()` | `Stream<Subtask<T>>` | homogeneous fan-out, results as a stream |
| `Joiner.anySuccessfulResultOrThrow()` | `T` | first success wins; siblings cancelled; all fail → throws |
| `Joiner.awaitAllSuccessfulOrThrow()` | `void` | side-effect subtasks, fail-fast |
| `Joiner.awaitAll()` | `void` | wait for all regardless of outcome; inspect subtasks yourself |
| `Joiner.allUntil(predicate)` | `Stream<Subtask<T>>` | custom: predicate sees each completion, returns true to cancel the rest |

`anySuccessfulResultOrThrow` is the *first-success* race that
[`anyOf` cannot express](07-completablefuture/02-fan-out-allof-anyof-timeouts.md) —
and unlike `anyOf`, the losers are genuinely interrupted, not abandoned.

Configuration rides on a second argument:
`open(joiner, cf -> cf.withTimeout(Duration.ofSeconds(2)))` — on expiry
the scope cancels and `join` throws `TimeoutException`; `withName` and
`withThreadFactory` label and control the subtask threads.

## Cancellation and observability

- Cancellation **propagates down the tree**: cancelling a scope
  interrupts its subtasks; a subtask running a nested scope propagates
  to its children. Interruption is still the cooperative protocol of
  [topic 01](01-threads-lifecycle-interrupt/02-interruption.md) — a
  subtask that ignores interruption delays `close()`, it doesn't escape
  it.
- The owner calling code *above* the scope can be interrupted too:
  `join` throws `InterruptedException`, the scope cancels, nothing
  leaks. Servers use this to reap entire request trees on client
  disconnect.
- Because the parent-child relationships are real objects, a JSON
  thread dump (`jcmd <pid> Thread.dump_to_file -format=json <file>`)
  groups the virtual threads of a scope under their scope, nested —
  the fan-out is *visible* as a tree, where executor tasks are an
  undifferentiated flat list. (Shape stated per JEP 505 — not
  reproduced here; producing one requires a run.)

## Gotchas

**Symptom:** `Subtask.get()` throws `IllegalStateException` though the subtask "must be done by now"
**Cause:** `get` called before `scope.join()` — the API refuses to block on an unjoined subtask by design
**Fix:** the sequence is fixed: fork everything → `join()` → read results; a subtask handle is not a `Future`

**Symptom:** code from a JDK 21 tutorial (`new StructuredTaskScope.ShutdownOnFailure()`, `throwIfFailed()`) doesn't compile on 25
**Cause:** JEP 505 reshaped the API — `open()`/`Joiner` replaced the `ShutdownOn*` subclasses
**Fix:** translate: ShutdownOnFailure → `open()` default joiner + `FailedException`; ShutdownOnSuccess → `open(Joiner.anySuccessfulResultOrThrow())`

**Symptom:** production build fails: "StructuredTaskScope is a preview API"
**Cause:** preview status — JDK 25 requires `--enable-preview` at compile *and* run time
**Fix:** a deliberate team decision, not a flag flipped in silence: preview APIs may change; pin the JDK version, or stay on executors until finalization

**Symptom:** scope with a slow subtask ignores its `withTimeout` budget by several seconds
**Cause:** timeout *cancels* — i.e. interrupts — but the subtask does uninterruptible work (socket read without a read-timeout, native call)
**Fix:** cancellation is cooperative all the way down: I/O inside subtasks needs its own timeouts; the scope's timeout bounds *waiting*, not the underlying syscall

**Symptom:** `IllegalStateException`/`WrongThreadException` when a helper method forks into a scope passed to it
**Cause:** only the owner thread may fork; the helper ran on a subtask's thread (or the scope escaped the owning method)
**Fix:** keep the scope block-local — fork at the top, pass *results* down; a scope is not a shared handle

**Symptom:** hedged fan-out with `anySuccessfulResultOrThrow` still hammers every replica at full duration
**Cause:** expectation carried over from `anyOf` — but here it's the opposite failure: the *replicas'* client library swallows interrupts, so cancellation can't take
**Fix:** verify the client honours interruption (or exposes cancellation) — the scope delivers interrupts, the stack below must respect them

## Interview questions

**★ What problem does structured concurrency solve that executors don't?**
Lifetime. Executor subtasks are free-floating: an error path that skips
a `get` leaks running work, and no one entity knows the fan-out exists.
A scope binds subtask lifetimes to a lexical block — exit means
everything finished or was cancelled-and-awaited — turning thread
lifetime into something the code's *shape* enforces.

**★ Walk the canonical scope sequence and say where each failure surfaces.**
`open()` in try-with-resources → `fork` each subtask → `join()` → read
`Subtask.get()` → implicit `close()`. A subtask failure surfaces at
`join` as `FailedException` (cause attached) with siblings interrupted;
interruption of the owner surfaces at `join` as `InterruptedException`;
an early exit before `join` is caught by `close`, which cancels and
waits. Nothing survives the block.

**★ Why does `fork` return `Subtask` and not `Future`?**
`Future` invites exactly the unstructured moves the model bans:
arbitrary blocking `get` before the join point, per-task `cancel`
from anywhere, handles outliving the fan-out. `Subtask` is a
read-after-join supplier — control stays with the scope.

**★ How do you express "first replica to answer wins, kill the rest"?**
`open(Joiner.anySuccessfulResultOrThrow())`, fork one subtask per
replica, `join` returns the first successful result and the scope
interrupts the losers. `CompletableFuture.anyOf` can't: it settles on
first *completion* (even a failure) and never cancels the rest.

**★ What is the relationship between scopes and virtual threads?**
Forks run on virtual threads by default, which is what makes
one-thread-per-subtask fan-out affordable at scope granularity
(thousands of scopes, each with a handful of subtasks). The model is
independent — a `ThreadFactory` can supply platform threads — but the
economics that make it the default style come from JEP 444.

**★ Can you rely on this API today?**
It's a preview in JDK 25 (fifth round, JEP 505), gated behind
`--enable-preview`, with a history of reshaping between rounds — the 25
`open()`/`Joiner` form replaced the earlier `ShutdownOn*` classes. Ship
it only with eyes open (pinned JDK, tolerance for migration); otherwise
the concepts transfer to executors-with-discipline until it finalizes.

---

← Prev: [CompletableFuture](07-completablefuture/README.md) · Next → [Explicit locks](09-explicit-locks.md)
