---
title: "The machinery: invoke instructions, tables, and the JIT"
sidebar_label: "2 · The machinery and the JIT"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JVMS SE 25 §6.5 (`invokevirtual`,
> `invokeinterface`, `invokespecial`, `invokestatic`, `invokedynamic`),
> §5.4.3.3–5.4.3.4 (method and interface method resolution), §5.4.5
> (overriding), and the HotSpot documentation on tiered compilation,
> inlining and deoptimization in the JDK 25 docs
> ([Phase 0's JIT](../../phase-0-platform-jvm/07-jit-compilation.md) and
> [HotSpot internals](../../phase-0-platform-jvm/13-hotspot-internals.md) pages).

**Dispatch is not a search. Every class carries a table of its virtual
methods; a call through a reference is a pointer hop into whatever table the
receiver object points at. And in warmed-up code even the hop usually
disappears: the JIT watches each call site, and where only one receiver
class ever shows up it replaces the table lookup with a guarded direct call
and inlines it. Polymorphism is essentially free in Java — paying for it is
the JIT's job, not yours.**

## The five invoke instructions

The compiler encodes the *kind* of call into the bytecode — this is the
two-machines split made physical:

| Instruction | Used for | Dispatch? |
|---|---|---|
| `invokevirtual` | Instance methods through a class type | ✅ by receiver class |
| `invokeinterface` | Instance methods through an interface type | ✅ by receiver class |
| `invokespecial` | Constructors, `private` methods, `super.m()` | ❌ statically selected |
| `invokestatic` | `static` methods | ❌ statically selected |
| `invokedynamic` | Lambdas, string concatenation, language plumbing | resolved once by a bootstrap method |

The first two are the polymorphic pair. `invokespecial` is why `private`
methods and `super` calls can never be intercepted or overridden.
`invokedynamic` is not "more dynamic dispatch" — it is a one-time linkage
hook the platform uses to implement
[lambdas](../../phase-4-lambdas-streams/README.md) and string concatenation
without generating classes at compile time.

## Tables: the vtable/itable mental model

Conceptually every class carries a table: one slot per virtual method
signature, each slot holding the most-derived implementation for that class
(HotSpot calls these **vtables**; interface dispatch goes through
per-interface **itables**, since two classes can implement the same
interface at different slot positions). `new StripeProcessor()` stamps the
object with a pointer to `StripeProcessor`'s table; `invokevirtual charge`
means "call slot N of whatever table this object carries".

- A subclass copies its parent's table and overwrites the slots it
  overrides — which *is* the "most-derived override wins" rule, as data.
- `invokeinterface` first finds the itable for the interface, then the
  slot — a short extra indirection, which is one reason the JIT works so
  hard to remove both.
- The table is per-*class*, not per-object: a million `Order` instances
  share one table. Objects pay one header word to point at their class,
  nothing per method.

Class loading is what fills the tables — and it is also where they can
break. If an interface gains an abstract method and an old compiled
implementor is loaded against the new interface, resolution finds no
implementation and the *call* throws `AbstractMethodError` at run time —
a linkage error surfacing at dispatch, the classic sign of a
[dependency version skew](../../phase-8-build-dependencies/README.md).

## What the JIT does to virtual calls

The interpreter and C1-compiled code profile every virtual call site: which
receiver classes actually arrive, and how often. C2 then acts on the
profile:

- **Monomorphic site** (one observed class): the table lookup is replaced
  with a cheap class check plus a **direct call — then inlined**, letting
  every downstream optimization see through the call. This is
  **devirtualization**.
- **Bimorphic site** (two classes): two guarded direct calls — still
  inlinable.
- **Megamorphic site** (three or more): the profile stops helping; the call
  stays a real table dispatch. Not a crisis — a pointer hop — but the
  inlining-driven optimizations behind it are off.
- **Class hierarchy analysis (CHA)**: if the JVM can prove no loaded class
  overrides a method (e.g. nothing extends `StripeProcessor` *yet*), it may
  devirtualize *without* a guard — registering an assumption.

Every one of these is **speculative**. Load a new subclass tomorrow and the
assumption breaks; the JVM **deoptimizes** — throws away the compiled code,
falls back to the interpreter, re-profiles, recompiles
([Phase 0's HotSpot page](../../phase-0-platform-jvm/13-hotspot-internals.md)
covers the mechanics). Correctness is never at stake; only the optimization
level moves.

The design consequence is one sentence: **write the natural virtual-call
design and let the JIT pay for it.** Marking methods `final` "for speed" is
folklore — `final` is a *semantic* tool ([Phase 1](../../phase-1-language-core/12-final.md));
the JIT already devirtualizes what the profile supports, with a guard
instead of a keyword.

## Gotchas

**Symptom:** performance review claims virtual calls are slow, demands `final` everywhere
**Cause:** stale intuition — HotSpot profiles call sites and inlines monomorphic/bimorphic ones, deoptimizing if the assumption breaks
**Fix:** write the natural design; let [the JIT](../../phase-0-platform-jvm/07-jit-compilation.md) devirtualize. Reserve `final` for *semantic* sealing, not micro-optimization

**Symptom:** `AbstractMethodError` (or `IncompatibleClassChangeError`) thrown at run time from a line that compiles fine
**Cause:** linkage skew — the receiver's class was compiled against an older interface/superclass and implements no body for the resolved method; dispatch found an empty slot
**Fix:** align dependency versions so implementors are compiled against the interface they run with; API authors add interface methods as `default`, not abstract ([topic 05](../05-abstract-vs-interfaces.md))

**Symptom:** a hot loop's performance drops sharply after a plugin/new implementation is loaded, with no code change in the loop
**Cause:** the call site went from monomorphic to polymorphic — the JIT deoptimized its inlined guard and the site may now be megamorphic
**Fix:** expected behaviour, not a bug; if it matters, split the call site per implementation or batch by type — and measure before restructuring (rule: profile, don't guess)

**Symptom:** a microbenchmark "proves" interface calls cost the same as direct calls, but the production profiler disagrees
**Cause:** the benchmark call site was monomorphic (one implementation loaded) and fully inlined; production feeds the same site many types — megamorphic, never inlined
**Fix:** benchmark with the production *type mix* at the call site; treat single-implementation benchmarks of dispatch as measuring the JIT, not the design

**Symptom:** debugger/stack traces show a method that "cannot" be there — frames missing or merged in a hot path
**Cause:** inlining — devirtualized calls collapse into the caller's compiled frame; the JVM reconstructs logical frames on deopt, but sampling profilers may attribute time to the caller
**Fix:** expected; use async-profiler-style tools that understand inlining when attributing hot methods

**Symptom:** adding an unused subclass to the classpath changed performance characteristics elsewhere
**Cause:** class hierarchy analysis — loading the subclass invalidated a no-override assumption, forcing guarded dispatch where a bare direct call was compiled
**Fix:** nothing to fix in code; know that JIT state depends on *loaded classes*, not source — relevant when comparing runs with different classpaths

## Interview questions

**★ What do `invokevirtual`, `invokeinterface`, `invokespecial`, `invokestatic` and `invokedynamic` each do?**
The first two dispatch on the receiver's runtime class (class-typed vs
interface-typed references). `invokespecial` statically calls constructors,
`private` methods and `super` targets; `invokestatic` calls statics.
`invokedynamic` links a call site once via a bootstrap method — the JVM's
hook for lambdas and string concatenation, not ordinary dispatch.

**★ What is devirtualization?**
The JIT observing that a virtual call site only ever sees one (or two)
receiver classes, replacing the table lookup with a guarded direct call and
inlining it — undone via deoptimization if a new class arrives later.

**★ Is virtual dispatch a performance problem?**
Not in warmed-up code: HotSpot inlines monomorphic and bimorphic call sites
after profiling, guarded by deoptimization. Megamorphic sites (3+ observed
classes) stay as table calls — a JIT-forensics concern, not a design driver.

**★ Why does dispatch cost a pointer hop and not a search up the hierarchy?**
Each class's table already holds the most-derived implementation per slot —
the "search" happened once, at class load, when the subclass's table was
built by copying the parent's and overwriting overridden slots.

**What causes an `AbstractMethodError`, given that the compiler checks abstract methods?**
Separate compilation: the class compiled cleanly against version A of an
interface, but runs against version B that added a method it never
implemented. Resolution succeeds, the slot is empty, the *call* throws. A
build-hygiene error surfacing as a dispatch error.

**Why is interface dispatch (`invokeinterface`) discussed as costlier than class dispatch?**
A class's vtable slot numbers are fixed by its hierarchy, but two unrelated
classes implement the same interface at different positions — so interface
calls resolve through per-interface itables, an extra indirection. In
practice the JIT devirtualizes hot sites of both kinds, so the difference
rarely survives warm-up.

**Does `final` on a method make calls to it faster?**
Effectively no in hot code: the JIT already devirtualizes based on the
observed profile and CHA, guard included. `final` is for semantics —
forbidding overrides — not for speed.

---

← Prev: [The two machines](01-the-two-machines.md) · Next → [Dispatch in the wild](03-dispatch-in-the-wild.md)
