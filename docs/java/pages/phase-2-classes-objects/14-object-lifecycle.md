---
title: "Object lifecycle"
sidebar_label: "14 · Object lifecycle"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the JDK 25 Javadoc for `java.lang.ref.Cleaner`,
> `java.lang.ref` package docs (`WeakReference`, `SoftReference`), JEP 421
> (Deprecate Finalization for Removal, 18), and the JDK 25 HotSpot GC
> Tuning Guide.

**A Java object's life is: allocated, reachable, unreachable, reclaimed —
and you control only the middle by holding or dropping references. There
are no destructors, and the historical substitute (finalization) is
deprecated for removal. The consequence worth internalizing: *memory* is
managed for you, but *resources* — files, sockets, connections — are not,
and anything that needs deterministic cleanup must be closed explicitly,
never left to the garbage collector's schedule.**

## The phases

1. **Allocation** — a TLAB pointer bump in the young generation; cheap by
   design. The mechanics live in
   [Phase 0 · Garbage collection](../phase-0-platform-jvm/08-garbage-collection.md).
2. **Initialization** — field initializers, then the constructor
   (initialization *order* is topic 01's subject).
3. **Reachable life** — as long as any GC root reaches it, directly or
   transitively, the object exists. There is no reference counting; cycles
   don't matter.
4. **Unreachable** — eligible for reclamation at some *unspecified future
   point*. Unreachability is not an event the object "experiences": no
   hook runs, nothing is notified, and reclamation may be delayed
   arbitrarily or never happen (a JVM under no memory pressure may not
   collect before exit).
5. **Reclaimed** — the memory is reused. Nothing about this is observable
   from the program except through the special reference types below.

## No destructors — and what replaced the substitute

C++ destructors run at a *defined point*; nothing in Java does. The
original workaround, `Object.finalize()`, was so broken that **JEP 421
deprecated finalization for removal** (18) and it is disabled-by-default
territory on its way out entirely. Its sins, for recognizing legacy code:
no timing guarantee (resource exhaustion long before finalizers run),
severe GC cost (finalizable objects need at least two collection cycles),
an executing thread you don't control, swallowed exceptions — and
**object resurrection**: a finalizer could store `this` into a static
field, making a dying object reachable again, with the guarantee that its
finalizer would never run a second time. Security exploits and heisenbugs
lived in that corner for two decades.

**The real answers, by problem:**

- **Deterministic resource cleanup** → `AutoCloseable` +
  **try-with-resources** — close at a defined point, exceptions handled,
  in reverse order. The full treatment is
  [Phase 5 · try-with-resources](../phase-5-exceptions/03-try-with-resources/README.md); the rule here is simply: if it has `close()`, you
  close it — the GC never will.
- **Safety net for a *native* resource whose owner forgot to close** →
  `java.lang.ref.Cleaner` (9+). You register the object plus a cleanup
  action; after the object becomes *phantom reachable*, the cleaner's
  thread *eventually* runs the action, at most once, with no resurrection
  possible (the action must not reference the object — that would pin it;
  use a static nested runnable holding only the raw resource handle).
  The Cleaner Javadoc itself stresses: this is a **backstop behind an
  explicit `close()`**, not a destructor — the timing non-guarantee is
  unchanged from finalization; only the safety and cost problems are
  fixed. The JDK uses it internally (direct buffers, file descriptors).

## Weak and soft references, honestly

`java.lang.ref` lets you hold an object *without* keeping it alive:

- **`WeakReference`** — collected at the next GC once no strong references
  remain. The legitimate use is **canonicalizing mappings**: associate
  extra data with an object for exactly as long as someone else keeps it
  alive. `WeakHashMap` (weak *keys*) is this packaged — its entries
  vanish when the key dies elsewhere. (`ThreadLocal` uses weak references
  internally, which is half of its famous leak — Phase 6's story.)
- **`SoftReference`** — like weak, but the collector keeps it *until
  memory pressure* forces reclamation. On paper, a memory-sensitive
  cache. In practice **soft-reference caches disappoint**: the JVM's
  clearing policy is coarse and global (roughly LRU across the whole
  heap, tuned by a single flag), they tend to hoard until a full GC then
  vanish all at once, and they give you no per-entry policy, no metrics,
  no TTL. Real caches — Caffeine in-process, or Redis out of process (its
  own section in this bible) — beat them everywhere it matters, which is
  why soft references are a *recognize-it* feature, not a *reach-for-it*
  one.

Both exist so *frameworks* can cooperate with the GC. Application code
touching them directly is rare — and usually a cache that wants to be
Caffeine.

## Gotchas

**Symptom:** "too many open files" / connection-pool exhaustion while heap usage is fine
**Cause:** resources left for the GC — file descriptors and sockets are not memory; the collector reclaims them only incidentally, maybe never
**Fix:** every `AutoCloseable` closed deterministically (try-with-resources); the GC's schedule is not a resource-management strategy

**Symptom:** legacy class overrides `finalize()` — does it still run?
**Cause:** finalization is deprecated for removal (JEP 421) and can be disabled with `--finalization=disabled`; behaviour depends on JVM flags and version
**Fix:** treat every `finalize()` as dead code to migrate: explicit `close()` + Cleaner backstop; do not write new ones

**Symptom:** a Cleaner action never runs
**Cause:** the cleanup lambda captured the tracked object itself (or an inner class captured `this`), keeping it strongly reachable forever
**Fix:** the action must be a static nested class/lambda holding only the resource handle (the raw FD, the native pointer) — never the owning object

**Symptom:** code assumes cleanup ran because the object "went out of scope"
**Cause:** scope ends reachability from that variable, but reclamation happens at an unspecified later time — or not at all before JVM exit
**Fix:** anything that must happen at a defined point needs an explicit call (`close()`, `shutdown()`); GC observability is not a scheduling mechanism

**Symptom:** a `WeakHashMap` used as a general-purpose cache keeps "losing" entries under zero memory pressure
**Cause:** weak references are cleared at the *next* GC once keys lose strong reachability — it is a canonicalizing map, not a cache with retention policy
**Fix:** Caffeine (size/TTL policies, metrics) or Redis; `WeakHashMap` only when "live exactly as long as the key lives elsewhere" is the actual requirement

**Symptom:** a `SoftReference` cache oscillates — grows unbounded, then empties entirely after a full GC, latency spikes both ways
**Cause:** soft clearing is a global heap-pressure heuristic, not per-entry policy — hoard-then-flush is its natural behaviour
**Fix:** a real cache with explicit sizing (Caffeine `maximumSize`/`expireAfterWrite`); soft references are not a cache design

**Symptom:** calling `System.gc()` to "make cleanup happen"
**Cause:** conflating memory collection with resource cleanup, and assuming the call does anything (it is a hint, commonly disabled in production)
**Fix:** explicit close for resources; for memory, trust the collector — the full argument is on the [GC page](../phase-0-platform-jvm/08-garbage-collection.md)

## Interview questions

**★ Does Java have destructors? What do you use instead?**
No. For resources needing deterministic cleanup: `AutoCloseable` and
try-with-resources — cleanup at a defined point. For a last-resort safety
net on native resources: `Cleaner`, which runs an action *eventually*
after the object becomes phantom reachable. Finalization, the old
mechanism, is deprecated for removal (JEP 421).

**★ Why was finalization removed from Java?**
No timing guarantee, heavy GC cost (extra collection cycles per
finalizable object), an uncontrolled execution thread, swallowed
exceptions, and the resurrection loophole (a finalizer could re-publish
`this`). It made both correctness and security worse; `Cleaner` +
try-with-resources cover its legitimate uses without those failure modes.

**★ Why must a Cleaner's action not reference the object it cleans?**
The cleaner holds the action strongly until it runs; if the action
references the tracked object, the object stays reachable and the trigger
condition (phantom reachability) never arrives — the cleanup deadlocks
against itself. Hence the idiom: a static nested action class holding
only the raw resource handle.

**★ Weak vs soft references — and why is a SoftReference cache usually a bad cache?**
Weak: cleared as soon as no strong references remain — for mappings that
should live exactly as long as the key does (`WeakHashMap`). Soft:
cleared under memory pressure — nominally a cache, but the policy is a
global heap heuristic: no per-entry TTL or size control, hoard-then-flush
dynamics, no metrics. Purpose-built caches (Caffeine, Redis) win.

**When does an object become eligible for collection, and what can you observe about it?**
When no GC root reaches it. The program observes nothing at that moment —
no callback, no event; reclamation is asynchronous and unguaranteed. The
only sanctioned observation points are the `java.lang.ref` types
(reference cleared / enqueued) and a Cleaner action, all of which are
*eventual*, not prompt.

**What is object resurrection?**
A finalization-era trick: `finalize()` stores `this` somewhere reachable,
cancelling the object's death — once, since finalizers run at most once.
It broke the invariant that unreachable objects stay dead and is one
reason finalization was removed; `Cleaner` actions run after *phantom*
reachability precisely so resurrection is impossible.

---

← Prev: [Composition over inheritance](13-composition-over-inheritance.md) · Next → [The rest of `Object`](15-rest-of-object.md)
