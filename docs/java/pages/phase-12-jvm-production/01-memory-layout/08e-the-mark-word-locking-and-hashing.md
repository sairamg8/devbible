---
title: "The two lowest bits of the mark word encode three lock states and the identity hash competes with them for the same 64 bits, which is why JDK 25 deprecates legacy stack-locking and why calling identityHashCode writes to an object you thought was immutable"
sidebar_label: "08e · Mark word: locks and hashes"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against **JEP 450: Compact Object Headers (Experimental)**, section
> *"Description → Locking"* ([openjdk.org](https://openjdk.org/jeps/450)); and the OpenJDK
> `jdk-25+36` sources `src/hotspot/share/oops/markWord.hpp` (the lock-state table and the
> `hash_bits` constant) and `src/hotspot/share/runtime/globals.hpp` (`LockingMode` with its
> `LM_LIGHTWEIGHT` default and its two `(Deprecated)` values, and `UseObjectMonitorTable`).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[08](08-the-object-header.md) laid out the header's fields. This chunk is about the two
subsystems that fight over them at runtime. Locking writes the two lowest bits of the mark word and,
in one deprecated mode, overwrites the entire word; identity hashing claims 31 bits of the same
word the first time anyone asks for a hash. Understanding that competition explains why JDK 25
changed its default locking mode, why legacy stack-locking is incompatible with compact headers,
and why a "read-only" call like `System.identityHashCode` is a write.**

## The tag bits and what they mean

`markWord.hpp` again, verbatim:

```text
//  - the two lock bits are used to describe three states: locked/unlocked and monitor.
//
//    [ptr             | 00]  locked             ptr points to real header on stack (stack-locking in use)
//    [header          | 00]  locked             locked regular object header (fast-locking in use)
//    [header          | 01]  unlocked           regular object header
//    [ptr             | 10]  monitor            inflated lock (header is swapped out, UseObjectMonitorTable == false)
//    [header          | 10]  monitor            inflated lock (UseObjectMonitorTable == true)
//    [ptr             | 11]  marked             used to mark an object
//    [0 ............ 0| 00]  inflating          inflation in progress (stack-locking in use)
```

Note that `00` has two different meanings depending on the locking implementation in use. JDK 25's
default is the newer one:

```cpp
product(int, LockingMode, LM_LIGHTWEIGHT,
        "(Deprecated) Select locking mode: "
        "0: (Deprecated) monitors only (LM_MONITOR), "
        "1: (Deprecated) monitors & legacy stack-locking (LM_LEGACY), "
        "2: monitors & new lightweight locking (LM_LIGHTWEIGHT, default)")
```

The two legacy modes are marked `(Deprecated)`; `LM_LIGHTWEIGHT` is the default and the only
non-deprecated one. JEP 450 describes what each does:

> *"**Lightweight locking** is used when the locked object's monitor is uncontended, no thread
> control methods (`wait()`, `notify()`, etc.) are called, and no JNI locking is used. In such
> cases, HotSpot atomically flips the tag bits in the object header from 01 (unlocked) to 00
> (lightweight-locked). No additional data structures are required, and no other header bits are
> used."*
>
> *"**Monitor locking** is used when the locked object's monitor is contended, thread control
> methods are used, or lightweight locking is otherwise inadequate. To indicate this state, HotSpot
> atomically flips the tags bits in the object header from 01 (unlocked) or 00 (lightweight-locked)
> to 10 (monitor-locked)."*

And why the legacy mode had to go before headers could shrink:

> *"HotSpot also supports the legacy stack-locking mechanism. This spiritual predecessor to
> lightweight locking associates the locked object with the locking thread by copying the object
> header to the thread's stack and overwriting the object header with the pointer to the header
> copy. This is problematic for compact object headers because it overwrites the object header and
> thus loses crucial type information. Therefore, compact object headers are not compatible with
> legacy locking. If the JVM is configured to run with both legacy locking and compact object
> headers then compact object headers are disabled."*

That paragraph is worth remembering because it is a silent-downgrade rule: combine
`-XX:LockingMode=1` with `-XX:+UseCompactObjectHeaders` and you get ordinary headers with no
error.

## The identity hash code lives in the header, and only once

`Object.hashCode()`'s default implementation returns an *identity* hash that must stay stable for
the object's lifetime, including across garbage collections that move the object. It cannot be
derived from the address, therefore, so HotSpot computes it lazily on first request and stores it
in the mark word's 31 hash bits.

Three consequences follow:

- **An object that has never been hashed has no hash stored.** Calling
  `System.identityHashCode(o)` on it mutates the header. This is a write to a field you did not
  know existed, on an object you may be treating as immutable.
- **The hash and the lock state compete for the same word.** Under the legacy stack-locking mode
  the mark word is displaced onto the locking thread's stack, so a hash request on a
  stack-locked object has to find the displaced header. Under `LM_LIGHTWEIGHT` the header stays in
  place for the uncontended case, which is one of the reasons the newer mode was needed.
- **Identity hash is 31 bits, not 32.** The source computes
  `hash_bits = max_hash_bits > 31 ? 31 : max_hash_bits`, so the value is always non-negative in
  practice. Do not write code that depends on that.

## Gotchas

**★ `-XX:LockingMode` is deprecated in JDK 25 in two of its three values.**
The flag's own help text marks `LM_MONITOR` and `LM_LEGACY` as `(Deprecated)`. Setting
`-XX:LockingMode=1` to "restore old behaviour" also silently disables compact object headers if
you asked for them, because JEP 450 states the two are incompatible.

**★ `System.identityHashCode()` writes to the object.**
The identity hash is computed lazily and stored in the mark word on first request. Calling it —
directly, or indirectly by putting the object in an `IdentityHashMap`, or through a default
`hashCode()` — mutates the header of an object you may believe is immutable, and interacts with
whatever the locking subsystem is doing to the same word.

**★ Lock state `00` means two different things depending on `LockingMode`.**
`markWord.hpp`'s table lists both: *"[ptr | 00] locked — ptr points to real header on stack
(stack-locking in use)"* and *"[header | 00] locked — locked regular object header (fast-locking in
use)"*. Any tool, agent or blog post that decodes a mark word without knowing which mode the JVM is
running in can decode `00` wrongly.

**★ `-XX:LockingMode=1` silently disables compact object headers.**
JEP 450: *"compact object headers are not compatible with legacy locking. If the JVM is configured
to run with both legacy locking and compact object headers then compact object headers are
disabled."* No error, no warning in your flag review — you simply do not get the feature you asked
for.

**★ Inflation is one-way in practice, and it costs a heap object.**
Once a lock inflates to an `ObjectMonitor` because of contention, `wait()`/`notify()`, or JNI
locking, there is now a separate data structure associated with that object. Synchronising on a
shared, frequently-contended object therefore has a footprint cost as well as a latency cost.

**★ `UseObjectMonitorTable` changes where the displaced header goes, and it is a diagnostic flag.**
`product(bool, UseObjectMonitorTable, false, DIAGNOSTIC, "With Lightweight Locking mode, use a
table to record inflated monitors rather than the first word of the object.")` — with it off (the
default) the monitor-locked encoding is `[ptr | 10]` and the real header is swapped out; with it on
it is `[header | 10]`. Do not enable a diagnostic flag in production to change header behaviour.

**★ The identity hash is 31 bits and is therefore always non-negative in practice.**
`hash_bits = max_hash_bits > 31 ? 31 : max_hash_bits`. That is an implementation detail, not a
contract: `hashCode()` returns an `int` and nothing in the specification says it is non-negative,
so `Math.abs(o.hashCode())` remains a bug for overridden hash codes.

**★ Hashing an object and locking it interact, and the interaction is mode-dependent.**
Under the legacy stack-locking mode the mark word is displaced to the locking thread's stack, so a
hash request on a locked object must chase the displaced header. `LM_LIGHTWEIGHT` leaves the header
in place for the uncontended case. This is one of the reasons the newer mode exists, and it is why
microbenchmarks that both synchronise on and hash the same objects behave differently across JDK
versions.

## Interview questions

**★ What happens to the mark word when you `synchronized` on an object?**
It depends on the lock state. In the uncontended case under JDK 25's default `LM_LIGHTWEIGHT`
mode, HotSpot atomically flips the tag bits from `01` (unlocked) to `00` (lightweight-locked) and
touches nothing else — JEP 450: *"No additional data structures are required, and no other header
bits are used."* If the monitor becomes contended, or `wait()`/`notify()` is used, or JNI locking
is involved, the lock inflates: the tag bits become `10` and an `ObjectMonitor` is created. In the
legacy stack-locking mode, which is deprecated in JDK 25, the whole header was copied to the
locking thread's stack and replaced with a pointer to that copy — which is precisely why that mode
is incompatible with compact headers.

**★ Why can the identity hash code not just be the object's address?**
Because `Object.hashCode()`'s contract requires the value to be stable for the object's lifetime,
and a moving collector relocates objects. So HotSpot computes an identity hash on first request and
stores it in the mark word's 31 hash bits, where it survives relocation. The side effect worth
knowing is that the first call to `System.identityHashCode(o)` — or anything that reaches the
default `hashCode()`, including inserting into an `IdentityHashMap` — *writes* to the object's
header.

**★ What are the three lock states encoded in the mark word?**
Unlocked (`01`), lightweight-locked (`00`), and monitor-locked, also called inflated (`10`); the
fourth combination, `11`, is used by the GC to mark an object. `markWord.hpp` states it directly:
*"the two lock bits are used to describe three states: locked/unlocked and monitor."* The
transitions are cheap in the uncontended case — a single atomic flip of the tag bits from `01` to
`00` — and expensive on inflation, which allocates an `ObjectMonitor`.

**★ Why is JDK 25's default `LockingMode` significant for object layout?**
Because the two older modes it deprecates both interfere with the header. `LM_LEGACY`, the old
stack-locking scheme, copies the whole mark word onto the locking thread's stack and overwrites the
header with a pointer to that copy — which destroys the type information a compact header keeps in
the same word. JEP 450 therefore states that compact object headers are incompatible with legacy
locking and are silently disabled if both are configured. `LM_LIGHTWEIGHT`, the JDK 25 default,
flips only the two tag bits in the uncontended case and uses *"no other header bits"*, which is
what makes the compact layout possible at all.

**★ You see a `hs_err` or an agent decode a mark word ending in `00`. What do you still not know?**
Whether the object is stack-locked with the header displaced to a thread stack, or fast-locked with
the header still in place. `markWord.hpp` lists both encodings for `00`, distinguished only by
which locking mode the JVM is running. Without that, you cannot tell whether the remaining 62 bits
are a pointer into some thread's stack or the object's real header — which is the difference
between a valid hash/age reading and nonsense.

{/* FOOTER */}
