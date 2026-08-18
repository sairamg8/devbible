---
title: "The rest of Object"
sidebar_label: "15 · The rest of Object"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the JDK 25 Javadoc for `java.lang.Object`,
> `Cloneable`, and `System.identityHashCode`; the JLS SE 25 §17.2 (wait
> sets); and Effective Java 3rd ed. Item 13 where cited.

**Every class inherits eleven public/protected members from `Object`. Three
of them — `equals`, `hashCode`, `toString` — are daily tools with their own
pages. This page covers the rest, and the honest summary is: one is broken
by design (`clone`), two are legacy concurrency you should recognize but
never write (`wait`/`notify`), and the others are small sharp tools
(`getClass`, `identityHashCode`) with one famous trap each.**

## `clone` and `Cloneable`: broken by design

The design, and why each piece fails:

- `Object.clone()` is **`protected`** — you cannot call `x.clone()` on an
  arbitrary object; the class must override it publicly.
- `Cloneable` **declares no methods.** It is a marker that flips
  `Object.clone()`'s behaviour from throwing
  `CloneNotSupportedException` to performing a field-by-field copy — an
  interface changing a *superclass method's* behaviour, unique and
  unimitated for good reason.
- The default copy is **shallow**: object fields are shared between
  original and clone. A cloned object with a `List` field shares the list
  — mutate one, surprise the other. Deep cloning means overriding to
  clone every mutable field, recursively, by hand.
- `clone()` bypasses constructors — invariants your constructor enforces
  are not re-checked; final fields cannot be reassigned to deep copies,
  which is why cloneable and immutable-component designs collide.
- Even the checked exception is wrong: callers of a class that *is*
  `Cloneable` still juggle `CloneNotSupportedException`.

**The replacement, per Effective Java Item 13: copy constructors and copy
factories.**

```java
public Order(Order original) {                    // copy constructor
    this.id = original.id;
    this.items = List.copyOf(original.items);     // deep enough, on purpose
}
public static Order copyOf(Order original) { ... } // or a static factory
```

They run through real construction (invariants enforced), state their
depth explicitly, work with final fields, take interface parameters if you
want (`new ArrayList<>(anyCollection)` is the JDK's own copy-constructor
idiom), and involve no marker-interface magic. Arrays are the one place
`clone()` is idiomatic: `values.clone()` is the standard array copy.
Records compose naturally with "copy with change" `withX` methods instead.

## `getClass`: exact runtime type, and the proxy surprise

`getClass()` returns the exact runtime class — the gateway to reflection
(`getSimpleName()`, `getDeclaredFields()`, and everything Phase 8's
annotation processing and Spring's machinery build on).

Two practical notes:

- **`getClass()` vs `instanceof`**: `instanceof` accepts subclasses;
  `getClass() == other.getClass()` demands the exact class. That
  distinction is load-bearing in `equals` implementations (topic 06's
  symmetry discussion).
- **The proxy surprise.** Frameworks hand you *subclass or proxy*
  instances: on a Spring bean with `@Transactional`, `getClass()` may
  name `OrderService$$SpringCGLIB$$0`, not `OrderService`; Hibernate lazy
  proxies do the same. Logging, `getClass()`-keyed maps, and hand-rolled
  reflection all misbehave on proxies. Frameworks ship unwrappers
  (`AopUtils.getTargetClass`, `Hibernate.getClass`) precisely because
  `getClass()` tells the mechanical truth, not the domain truth.

## `wait`/`notify`/`notifyAll`: recognize, don't write

Every object owns a **monitor** (the thing `synchronized` locks — see
**Phase 6 · `synchronized` and intrinsic locks** *(not written yet)*) and
a **wait set**. The legacy protocol:

```java
synchronized (lock) {
    while (!condition) {      // ALWAYS a while — never an if
        lock.wait();          // releases the monitor, parks the thread
    }
    // proceed under the monitor with condition true
}
// producer side:
synchronized (lock) {
    condition = true;
    lock.notifyAll();         // wakes waiters; they re-acquire and re-check
}
```

The rules that make it treacherous: `wait`/`notify` may only be called
while *holding that object's monitor* (else
`IllegalMonitorStateException`); waits can wake **spuriously**, hence the
mandatory `while`; `notify` wakes *one arbitrary* waiter (lost-wakeup
deadlocks when waiters wait for different conditions), so correct code
usually needs `notifyAll`; and a `notify` with no one waiting is simply
lost — there is no memory of it.

You will meet this pattern in pre-2004 codebases and in textbooks. New
code uses the tools that package it safely: `BlockingQueue` for
producer/consumer, `CountDownLatch`/`Semaphore` for signalling,
`Condition` when explicit waiting is genuinely needed — all in
**Phase 6 — Concurrency** *(not written yet)*.

## The small ones

- **`hashCode`'s identity cousin — `System.identityHashCode(x)`**: the
  hash `Object.hashCode` would have produced even if the class overrides
  it. Used by `IdentityHashMap` and debugging ("same instance or equal
  copy?"). Note it is *not* an address — objects move under GC; the JVM
  guarantees only stability per object.
- **`toString`'s default** — `ClassName@hex` where hex is the identity
  hash code: seeing it in logs means an override is missing (topic 07).
- **`finalize`** — deprecated for removal; covered with the
  [object lifecycle](14-object-lifecycle.md).

## Gotchas

**Symptom:** cloned an object, mutated the copy, and the original changed too
**Cause:** default `clone()` is shallow — mutable fields (lists, maps, arrays) are shared between original and clone
**Fix:** copy constructor with explicit deep copies (`List.copyOf`, `clone()` per array); if `clone` must stay, override it to deep-copy every mutable field

**Symptom:** `x.clone()` doesn't compile even though the class implements `Cloneable`
**Cause:** `Object.clone()` is protected; `Cloneable` adds no public method — the class must override `clone()` publicly itself
**Fix:** the class provides a public `clone()` (returning its own type) — or better, a copy constructor, sidestepping the whole design

**Symptom:** `CloneNotSupportedException` from a class that "supports" cloning via inheritance
**Cause:** a superclass's `clone()` chain reached `Object.clone()` on a class not marked `Cloneable`
**Fix:** every class in the chain must cooperate — one more reason the mechanism is abandoned in favour of copy factories

**Symptom:** log lines or metrics keyed by class name show `Service$$SpringCGLIB$$0`
**Cause:** `getClass()` on a framework proxy names the generated subclass
**Fix:** `AopUtils.getTargetClass(bean)` / `Hibernate.getClass(entity)` — or key by an explicit name rather than runtime class

**Symptom:** `IllegalMonitorStateException` from `wait()` or `notify()`
**Cause:** called without holding the object's monitor — the protocol requires being inside `synchronized` on the *same* object
**Fix:** wrap in `synchronized (sameLock) { ... }`; better, replace with `BlockingQueue`/`CountDownLatch` and retire the hand-rolled protocol

**Symptom:** a waiting thread proceeds although nobody notified, and state is not ready
**Cause:** spurious wakeup — permitted by the spec, expected by the protocol
**Fix:** always `while (!condition) wait();` — an `if` is a latent bug even if it "never happened in testing"

**Symptom:** producer/consumer hangs intermittently under load with `notify()`
**Cause:** single `notify` woke an arbitrary waiter — possibly one waiting for a *different* condition, which re-checked, found nothing, and went back to sleep; the intended waiter never woke (lost wakeup)
**Fix:** `notifyAll()` and per-condition re-check loops — or the honest fix, `BlockingQueue`

**Symptom:** two objects report the same `identityHashCode`
**Cause:** identity hashes are not unique — 32 bits over an unbounded object population collide by pigeonhole
**Fix:** never use any hash as a unique id; equality of hash proves nothing (true for `hashCode` generally — topic 06)

## Interview questions

**★ Why is `clone`/`Cloneable` considered broken, and what do you use instead?**
Protected method + method-less marker interface that mutates a superclass
method's behaviour; shallow copies by default; constructor bypass (no
invariant enforcement, fights final fields); a checked exception even for
supporting classes. Use copy constructors or static copy factories
(Effective Java Item 13): real construction, explicit depth, no magic.
Arrays are the exception — `array.clone()` is idiomatic.

**★ What must be true before calling `wait()` or `notify()`, and why the `while` loop?**
The calling thread must hold that object's monitor (be `synchronized` on
it) — else `IllegalMonitorStateException`. The condition is re-checked in
a `while` because wakeups can be spurious, and because between a
`notifyAll` and re-acquiring the monitor another thread may have consumed
the condition.

**★ `notify` vs `notifyAll`?**
`notify` wakes one *arbitrary* thread from the wait set — correct only
when every waiter waits for the same condition and any one can proceed.
`notifyAll` wakes all; each re-acquires the monitor and re-checks. When
waiters await different conditions, `notify` risks lost wakeups —
`notifyAll` is the safe default in the legacy protocol.

**★ What does `getClass()` return on a Spring `@Transactional` bean, and why does it matter?**
The proxy's generated class (e.g. `...$$SpringCGLIB$$0`), not your class —
proxies are subclasses/implementations created at runtime. It breaks
class-keyed logic, reflection and logging unless unwrapped
(`AopUtils.getTargetClass`). The general lesson: `getClass()` reports the
exact runtime type, and frameworks make runtime types you didn't write.

**What is `System.identityHashCode` for?**
It returns the default (identity-based) hash regardless of any `hashCode`
override — letting you distinguish "same instance" from "equal value" in
debugging, and powering `IdentityHashMap`. It is stable per object but
neither unique nor an address.

**Which `Object` methods should a modern class actually engage with?**
Override `equals`/`hashCode` (as a pair) and `toString` when the type has
value semantics or appears in logs — topics 06 and 07. Leave `clone`,
`finalize`, `wait`/`notify` alone: copy factories, try-with-resources +
`Cleaner`, and `java.util.concurrent` replaced them respectively.

---

← Prev: [Object lifecycle](14-object-lifecycle.md) · Index: [Phase 2 — Classes and objects](README.md)
