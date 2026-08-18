---
title: "ScopedValue — the 25-era replacement"
sidebar_label: "2 · ScopedValue"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against JEP 506 (Scoped Values — final in JDK 25,
> after previews as JEP 429/446/464/481) and the JDK 25 Javadoc for
> `ScopedValue`, `ScopedValue.Carrier` and
> `ScopedValue.where(...)`.

**A `ScopedValue<T>` is a value you bind for the duration of a lexical
scope: `where(KEY, value).run(task)` makes `KEY.get()` return that value in
`task` and everything it calls, and unbinds it — unconditionally, even on
exception — when `run` returns. No `set`, no `remove()`, no way for a
callee to mutate the caller's context. It is `ThreadLocal`'s main use case
(share data downward through a call chain) rebuilt with the failure modes
designed out, and it went final in JDK 25.**

## The shape

```java
private static final ScopedValue<RequestContext> CTX = ScopedValue.newInstance();

// at the top of the request:
ScopedValue.where(CTX, new RequestContext(userId, traceId))
           .run(() -> handle(request));

// twenty frames down, no parameter threading:
void audit(Order order) {
    RequestContext ctx = CTX.get();     // bound → the value; unbound → throws
    log.info("{} by {}", order.id(), ctx.userId());
}
```

- `where(key, value)` returns a `ScopedValue.Carrier`; chain several
  `.where(...)` calls to bind multiple values, then `.run(Runnable)` or
  `.call(Callable)` (which can return a result and throw).
- `get()` outside any binding throws `NoSuchElementException`; probe with
  `isBound()`, or soften with `orElse(fallback)` / `orElseThrow(...)`.
  The hard failure is deliberate — a missing context is a structural bug,
  and [phase 5's lean](../../phase-5-exceptions/01-hierarchy-checked-unchecked/README.md)
  says surface those, not default them.
- The binding is gone when the scope exits — there is no cross-request
  bleed for a pool to preserve, which deletes chunk 1's leak class
  outright.

## One-way, immutable, rebindable

The design refuses three things `ThreadLocal` allows, all on purpose:

- **No mutation from below.** There is no `set()`. A callee that wants a
  different value cannot alter what its caller sees — data flows down
  only. (Return values flow up; that's what they're for.)
- **No unbounded lifetime.** The binding's life is the scope's life. You
  cannot "stash" a value for later code outside the scope.
- **No distant writes.** The binding site is findable by reading the code
  upward — against `ThreadLocal`, where any frame may have `set` the slot
  at any earlier time.

What *is* allowed is **rebinding for a nested scope**:

```java
ScopedValue.where(CTX, elevatedContext)     // inner scope only
           .run(() -> reindex(tenant));
// here CTX.get() is the outer binding again
```

The inner binding shadows the outer for the nested scope's dynamic extent
and evaporates on exit — the outer one was never touched. (The value
*object* itself should be immutable too, or you've rebuilt shared mutable
state with better syntax — [the cures](../03-race-conditions/03-the-cures.md).)

## Inheritance: per fork, not per thread

`ScopedValue` bindings are inherited by subtasks forked inside a
`StructuredTaskScope` (structured concurrency — **topic 08** *(not written
yet)*; still a preview API in JDK 25 per JEP 505, while `ScopedValue`
itself is final):

```java
ScopedValue.where(CTX, ctx).run(() -> {
    try (var scope = StructuredTaskScope.open()) {
        scope.fork(this::fetchOrders);      // CTX.get() works in the fork
        scope.fork(this::fetchInvoices);    // and here
        scope.join();
    }
});
```

The fork happens *inside* the binding's scope, and the child's lifetime is
contained by it (the scope can't outlive `run`) — so inheritance is safe
by construction. Contrast every `InheritableThreadLocal` failure in
[chunk 1](01-threadlocal.md): copying at thread creation was the wrong
moment; copying at fork, inside a bounded scope, is the right one.
Unstructured executors get no inheritance — a plain
`executor.submit(...)` task sees `CTX` unbound, loudly.

## Migration — and when `ThreadLocal` remains right

| Use | Verdict |
|---|---|
| Request/trace context set at the top, read below | **`ScopedValue`** — the designed-for case |
| Context that must cross a `StructuredTaskScope` fan-out | **`ScopedValue`** — inherited per fork |
| Value mutated mid-request by frames below the binding | **`ThreadLocal`** (or better: restructure so it isn't) |
| Set in one method, read later from an unrelated call chain (no enclosing scope possible) | **`ThreadLocal`** — `ScopedValue` has no way to express it |
| Per-thread instance of a non-thread-safe helper | **`ThreadLocal`** — this is confinement, not context passing |
| Framework APIs that require `set` from interceptors without wrapping the call | **`ThreadLocal`** until the framework adopts carriers |

Migration is mechanical where the shape fits: the filter's
`set`/`try`/`finally remove()` becomes `where(...).run(...)`, readers'
`get()` calls survive unchanged in spelling, and every "forgot to remove"
bug class disappears. Where the shape doesn't fit — mutation from below,
storage past the scope — that's not a migration blocker to work around;
it's the API telling you the design leans on distant mutable state.

## Gotchas

**Symptom:** `NoSuchElementException` from `ScopedValue.get()` in a task submitted to a plain executor
**Cause:** bindings don't cross unstructured submission — the pool thread never ran inside `where(...).run()`; only structured forks inherit
**Fix:** fork inside a `StructuredTaskScope` within the binding, or rebind at the task boundary: capture the value, then `ScopedValue.where(CTX, captured).run(task)` inside the submitted lambda

**Symptom:** a service method "sets" a new context by calling `where(...).run()` and returns — but its caller still sees the old value
**Cause:** correct behaviour misread through `ThreadLocal` eyes: rebinding covers only the nested scope's dynamic extent; nothing escapes upward
**Fix:** none needed in the API — restructure so the code needing the new value runs *inside* the nested scope, or return the value

**Symptom:** migrated code stores a mutable `Map` in a `ScopedValue` and mutates it from callees "since there's no set()"
**Cause:** immutability of the *binding* smuggled around via mutability of the *value* — the old distant-write pattern in disguise
**Fix:** bind immutable values (records); if a lower frame must contribute data, have it return results, or give it its own nested rebinding

**Symptom:** `isBound()` checks and `orElse(null)` scattered everywhere, recreating null-checking noise
**Cause:** treating unbound as a normal state instead of a structural error
**Fix:** bind once at every real entry point (HTTP filter, message consumer, scheduled job) and let `get()` throw elsewhere — an unbound read *should* fail the way a broken invariant fails

**Symptom:** on JDK 21–24 the code needs `--enable-preview` and breaks across minor upgrades
**Cause:** `ScopedValue` was preview through four rounds (JEP 429/446/464/481) with API changes between them; it is final only in 25
**Fix:** production use on JDK 25+; on 21 LTS, stay on `ThreadLocal` or a context-propagation library rather than shipping preview APIs

**Symptom:** context is bound but a `CompletableFuture` continuation still reads it unbound
**Cause:** the continuation runs after `run(...)` returned, on an arbitrary thread ([topic 07](../07-completablefuture/README.md)) — outside the binding's dynamic extent by definition
**Fix:** structured concurrency for fan-out that needs the context, or carry the context inside the values the stages pass along

## Interview questions

**★ What problem does `ScopedValue` solve that `ThreadLocal` already solved — and what does it fix?**
Same problem: sharing per-request data down a call chain without
parameters. It fixes the lifetime (bound to a scope, auto-unbound even on
exception — no pooled-thread leaks, no `remove()` discipline), the
mutability (no `set` from below — data flows one way), and inheritance
(per structured fork at the right moment, instead of per thread creation
at the wrong one).

**★ Why is there deliberately no `set()` method?**
Distant writes are the failure mode: with `ThreadLocal`, any frame can
mutate context another frame relies on, making the value's provenance
unfindable. Binding only at scope entry makes the value's origin visible
in the source and lets the runtime treat bindings as constants within a
scope. A callee needing a different value gets a *nested rebinding* that
cannot affect its caller.

**★ What happens to a binding when the scope exits via an exception?**
It is unbound regardless of how the scope exits — normal return or thrown
exception. That's the point of tying it to `run`/`call`'s dynamic extent:
cleanup is the runtime's job, structurally, where `ThreadLocal` needed a
`finally remove()` on every path a human had to remember.

**★ How does `ScopedValue` inheritance interact with `StructuredTaskScope`, and why is that pairing safe where `InheritableThreadLocal` wasn't?**
Forks inside a scope inherit the bindings in force at the fork, and the
task scope guarantees the forks complete before the enclosing binding can
exit — inherited context can't dangle past its life. `InheritableThreadLocal`
copied at thread construction (the wrong moment for pools) into threads
with unbounded lifetimes (the wrong duration for request data).

**★ Rebinding: a nested scope binds the same key. What do readers above, inside and after the nested scope see?**
Inside: the inner value, for the nested scope's whole dynamic extent —
including anything it calls. Above and after: the outer value, unchanged;
the inner binding never existed for them. It's shadowing with dynamic
extent, not mutation.

**★ Why can the runtime treat `ScopedValue` more cheaply than `ThreadLocal`?**
Because the binding is immutable for its whole dynamic extent, the JIT
may treat `get()` as reading a constant within the scope — cache it,
hoist it, no per-read map lookup guarantee games — and inheritance into
forks can share the parent's binding structure instead of copying values
per thread the way `InheritableThreadLocal` must. JEP 506 names exactly
these: comprehensibility from bounded lifetime, and optimization from
immutability.

**★ Name a use case you would still write with `ThreadLocal` on JDK 25, and defend it.**
A per-thread instance of a non-thread-safe, expensive helper (a legacy
parser, a `MessageDigest`) — that's thread *confinement* of a tool, not
downward *context passing*: there's no natural binding scope, mutation is
the object's purpose, and its lifetime legitimately spans many operations.
Also anything that must be set in one place and read from an unrelated
call chain no scope encloses — `ScopedValue` cannot express it by design.

---

← Prev: [`ThreadLocal` — the slot and the leak](01-threadlocal.md) · Index: [ThreadLocal and ScopedValue](README.md) · Next → [Deadlock, livelock, starvation](../13-deadlock-livelock-starvation/README.md)
