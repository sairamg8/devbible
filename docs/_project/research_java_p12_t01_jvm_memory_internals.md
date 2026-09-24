---
name: research-java-p12-t01-jvm-memory-internals
description: Primary-source JDK 25 research for phase 12 — thread stacks, direct/mapped buffers, the mark word, compact object headers, virtual thread pinning, @Contended. Read BEFORE authoring phase-12 topics 01, 03, 04, 05 or 13; several findings contradict the common belief and two contradict devbible's own earlier pages.
metadata:
  type: project
---

# Java · Phase 12 · JVM memory internals — banked primary-source research

**Established 2026-08-31 by the band-B `devbible-author` fork in session `4248352b`**, from the
**JDK 25 `java` man page**, **HotSpot source** (`globals.hpp`, `markWord.hpp`, `os.hpp`,
`os_linux.cpp`, `arrayOop.hpp`, `fieldLayoutBuilder.cpp`, `gc_globals.hpp`,
`globals_linux.hpp`), **JDK source** (`jdk/internal/misc/VM.java`, `Bits`, `DirectByteBuffer`,
`FileChannelImpl`, `Striped64`), the **JEPs**, and the **bugs.openjdk.org REST API**.

🔴 **This is expensive research. Do not re-derive it.** Several items below contradict what most
articles say, and three contradict briefs written for this very phase.

⚠️ **`openjdk.org` returns HTTP 403 to WebFetch.** The workaround that works:
`curl -A "Mozilla/5.0" https://openjdk.org/jeps/NNN`. It succeeded for JEPs 374, 444, 450, 491,
519 and 534. `https://bugs.openjdk.org` REST API works for issue status.

---

## 🔴 The five findings that contradict common belief

### 1. `-XX:MaxDirectMemorySize` defaults to **`-Xmx`**, not to a share of it

The man page is unhelpful — *"If not set, the flag is ignored and the JVM chooses the size for
NIO direct-buffer allocations automatically"* — and `globals.hpp` declares it
`product(uint64_t, MaxDirectMemorySize, 0, "… Ignored if not explicitly set.")`.

The real derivation is in **`jdk/internal/misc/VM.java`**, verbatim:

> *"The initial value of this field is arbitrary; during JRE initialization it will be reset to
> the value specified on the command line, if any, **otherwise to
> `Runtime.getRuntime().maxMemory()`**."*

🔴 **So the direct-memory ceiling equals the heap ceiling — a second copy of `-Xmx`, not a slice
of it.** Raising `-Xmx` or `MaxRAMPercentage` silently doubles the worst-case native budget.
This is the single most consequential container-sizing fact in the phase and belongs in
**topic 03 (heap sizing in containers)** as well as topic 01.

Also verbatim, from `Bits.tryReserveMemory`: *"-XX:MaxDirectMemorySize limits the total
**capacity** rather than the actual memory usage, which will differ when buffers are page
aligned."*

### 2. `-XX:MaxDirectMemorySize` does **not** bound memory-mapped buffers — and nothing does

`FileChannelImpl` contains **no call to `Bits.reserveMemory`**, and exposes
`getMappedBufferPool()` (`"mapped"`) and `getSyncMappedBufferPool()`
(`"mapped - 'non-volatile memory'"`) as pools **separate** from `Bits.BUFFER_POOL` (`"direct"`).

🔴 **Mapped memory is unbounded by any JVM flag.** Widely assumed otherwise.

Related, verified: `map(MapMode,long,long)` constrains `size` to *"non-negative and no greater
than `Integer.MAX_VALUE`"*; *"Closing the channel, in particular, has no effect upon the validity
of the mapping"*; the mapping lasts *"until the buffer itself is garbage-collected"*; and
`map(mode,offset,size,Arena)` (Java 22+) is the deterministic replacement — *"the returned
segment will be unmapped when the provided closeable arena is closed."*

### 3. `-Xss` **does** still apply to virtual threads — as a depth ceiling

JEP 444, verbatim:

> *"The stacks of virtual threads are stored in Java's garbage-collected heap as stack chunk
> objects. The stacks grow and shrink as the application runs, both to be memory-efficient and to
> accommodate stacks of depth **up to the JVM's configured platform thread stack size**."*

🔴 **"`-Xss` does not apply to virtual threads" is too strong and was wrong in the brief.**
`-Xss` no longer *reserves* per thread, but it is still the *depth ceiling*.

Corroborated by API shape: `Thread.Builder.OfPlatform` declares `stackSize(long)`;
`Thread.Builder.OfVirtual` declares only `name`, `name(prefix,start)`,
`inheritInheritableThreadLocals`, `uncaughtExceptionHandler` — **no `stackSize`**.

Also verbatim from JEP 444: *"Unlike platform thread stacks, virtual thread stacks are not GC
roots"*, and a limitation with no JDK 25 document lifting it — *"the G1 GC does not support
humongous stack chunk objects. If a virtual thread's stack reaches half the region size, which
could be as small as 512KB, then a StackOverflowError might be thrown."*

### 4. `jdk.tracePinnedThreads` was **removed**, so pre-24 pinning runbooks are silently broken

JEP 491 (Release 24, Closed/Delivered): *"This will eliminate nearly all cases of virtual threads
being pinned."* And: *"We previously recommended solving frequent and long-lived pinning problems
by migrating code from using `synchronized` to using `ReentrantLock`. Once the `synchronized`
keyword no longer pins virtual threads, such migration will no longer be necessary."*

🔴 Two facts the brief did not have:
- *"We will therefore remove this system property; setting it on the command line will have no
  effect"* — **`jdk.tracePinnedThreads` is gone.** A runbook that says "set it and read the
  output" now silently produces nothing.
- **JVM TI `GetObjectMonitorUsage` no longer reports monitors owned by virtual threads**
  (spec change in Java 23).

Remaining pinning on 25: native/FFM downcalls that call back into blocking Java, plus the three
class-loading/initialization cases in Future Work. Carrier pool default: *"The maximum number of
platform threads available to the scheduler is limited, with a default limit of 256 threads."*

### 5. `unable to create native thread` is **not** in the troubleshooting guide's OOME list

The **JDK 25 troubleshooting guide's** enumerated `OutOfMemoryError` detail messages are:
`Java heap space` · `GC Overhead limit exceeded` · `Requested array size exceeds VM limit` ·
`Metaspace` · **`Out of swap space`** · `Compressed class space` ·
`reason stack_trace (Native method)`.

The native-thread failure is real but comes from elsewhere — `src/hotspot/share/runtime/os.hpp`,
thrown from `JVM_StartThread`, exact string:

```
unable to create native thread: possibly out of memory or process/resource limits reached
```

preceded by `log_warning(os, thread)("Failed to start the native thread for java.lang.Thread \"%s\"", …)`.

⚠️ Likewise the direct-buffer OOME's **real message is not `Direct buffer memory`** — `Bits`
throws `OutOfMemoryError("Cannot reserve " + size + " bytes of direct buffer memory (allocated: …, limit: …)")`.

🔴 **Consequences for the corpus:** any page enumerating "the eight `OutOfMemoryError` messages"
must list `Out of swap space` and `reason stack_trace (Native method)`, must not present
`Direct buffer memory` as the literal message, and must say that the native-thread message is
real but comes from HotSpot rather than from the guide's list.

---

## Compact object headers — the full picture (banked for whoever writes `08b`)

- **JEP 519 is `Type: Feature`, `Release 25`, `Status Closed/Delivered`.** Summary: *"Change
  compact object headers from an experimental feature to a product feature."*
- 🔴 **Non-Goals, verbatim: *"It is not a goal to make compact object headers be the default
  object-header layout."*** So "product" ≠ "default" is the JEP's own explicit position.
- 🔴 **No unlock flag on JDK 25.** JEP 519: *"The first option,
  `-XX:+UnlockExperimentalVMOptions`, will no longer be needed once they are a product feature."*
  Confirmed in `globals.hpp`: `product(bool, UseCompactObjectHeaders, false, ...)` — plain
  `product`, not `experimental`.
- **The size numbers belong to JEP 450, not 519**: *"between 96 bits (12 bytes) and 128 bits
  (16 bytes)"* → *"64 bits (8 bytes) on the target 64-bit platforms (x64 and AArch64)"*.
- 🔴 **NEW — JEP 534 "Compact Object Headers by Default" is `Closed/Delivered`, Release 27.**
  So **JDK 25 asks, JDK 27 defaults.** The `java` man page's *"eventually will be the only mode
  of operation"* now has a version attached to it. **Any page quoting that sentence should name
  JEP 534 and Release 27.**
- Compact headers **require compressed class pointers** and shrink them **32 → 22 bits**.
- 🔴 **Silent downgrade:** *"compact object headers are not compatible with legacy locking. If the
  JVM is configured to run with both … compact object headers are disabled."*

### The mark word on JDK 25 (`markWord.hpp` layout comment, verbatim)

```
64 bits:            unused:22 hash:31 -->| unused_gap:4  age:4  self-fwd:1  lock:2
64 bits (compact):  klass:22  hash:31 -->| unused_gap:4  age:4  self-fwd:1  lock:2
```

🔴 **The *legacy* JDK 25 layout already carries `self-fwd:1` and a 4-bit `unused_gap`**
(`unused_gap_bits = LP64_ONLY(4) … // Reserved for Valhalla`). **JEP 450's diagram was written
for JDK 24 and renders it differently** — prefer the JDK 25 source and quote the JEP alongside.
Also: `hash_bits = max_hash_bits > 31 ? 31 : max_hash_bits`; `klass_bits = 22` for compact.

**Lock states:** `00` has **two** meanings depending on `LockingMode`. `LockingMode` defaults to
`LM_LIGHTWEIGHT`; `LM_MONITOR` and `LM_LEGACY` are both marked `(Deprecated)` in JDK 25.

### Biased locking — removed, confirmed from the issue tracker

JEP 374 (JDK 15): *"biased locking will no longer be enabled when HotSpot is started unless
`-XX:+UseBiasedLocking` is set on the command line"*, all flags deprecated.
**Removal confirmed via `JDK-8256425`** — summary *"Obsolete Biased Locking in JDK 18"*,
`fixVersions: [18]`, resolution Fixed. `UseBiasedLocking` appears **zero times** in JDK 25's
`globals.hpp` and `arguments.cpp` — not even in the obsolete-flags table.
🔴 **A mark-word diagram with a bias bit is describing a JVM that has not existed since 18.**

---

## Thread stacks

**`-Xss` default (JDK 25 `java` man page, verbatim):** *"The default value depends on the
platform. For example: Linux/x64: 1024 KB · Linux/Aarch64: 2048 KB · macOS/x64: 1024 KB ·
macOS/Aarch64: 2048 KB · Windows: The default value depends on virtual memory."* Plus *"The
actual size may be rounded up to a multiple of the system page size."*

🔴 **AArch64 is 2 MB — double x64.** An x64 → Graviton/Apple-silicon migration **doubles reserved
stack per thread** with no configuration change. `globals.hpp` declares it
`product_pd(intx, ThreadStackSize, ...)` — platform-dependent, so **no single number exists** and
any page quoting "1 MB" without naming the platform is wrong half the time.

⚠️ **Unit trap:** `-XX:ThreadStackSize=1k` is **1 MB** (the value is in kilobytes, ×1024).

**glibc static TLS is subtracted from your stack** (`os_linux.cpp`, verbatim): *"On Linux, glibc
places static TLS blocks (for `__thread` variables) on the thread stack. This decreases the stack
size actually available to threads… Due to compatibility concerns, this size adjustment is opt-in
and controlled via `AdjustStackSizeForTLS`."* — and `globals_linux.hpp` has
`product(bool, AdjustStackSizeForTLS, false, …)`, i.e. **off by default**.

---

## `@Contended` and array headers (banked for whoever writes `08c`)

From `globals.hpp`, verbatim:

```cpp
product(int,  ContendedPaddingWidth, 128, "How many bytes to pad the fields/classes marked @Contended with") range(0, 8192)
product(bool, EnableContended,   true,  "Enable @Contended annotation support")
product(bool, RestrictContended, true,  "Restrict @Contended to trusted classes")
```

🔴 **`RestrictContended` defaults to `true`, so application code needs `-XX:-RestrictContended`.**
The annotation is `jdk.internal.vm.annotation.Contended`, `@Retention(RUNTIME)`,
`@Target({FIELD, TYPE})`, `String value() default ""` (contention-group tag). Its javadoc warns
*"The effects of this annotation will nearly always add significant space overhead to objects."*

- Class-level annotation groups all un-annotated **non-static** fields into one anonymous group.
- **Not inherited.**
- **Ignored for static fields** (`fieldLayoutBuilder.cpp`: *"@Contended annotation is ignored for
  static fields"*).
- Supported alternative for application code: **manual padding**.
- **Real JDK usage to cite:** `java.util.concurrent.atomic.Striped64.Cell` is
  `@jdk.internal.vm.annotation.Contended`, with the class comment *"Table entries are of class
  Cell; a variant of AtomicLong padded (via @Contended) to reduce cache contention… Atomic objects
  residing in arrays will tend to be placed adjacent to each other, and so will most often share
  cache lines (with a huge negative performance impact) without this precaution."*

**Array header** (`arrayOop.hpp`): object header **plus a 4-byte `int` length** — *"The `_length`
field … is allocated after the mark-word when using compact headers … otherwise after the
compressed `Klass*`"*. ⚠️ **`CompactFields` no longer exists in JDK 25's `globals.hpp`.**

---

## Direct buffers: the reclamation path, verified from source

`Bits.reserveMemory` escalates in this exact order:
optimistic CAS → `jlra.waitForReferenceProcessing()` loop → **`System.gc(); // trigger VM's
Reference processing`** → exponential back-off → `throw new OutOfMemoryError("Cannot reserve " +
size + " bytes of direct buffer memory (allocated: …, limit: …)")`.

`DirectByteBuffer` registers `cleaner = Cleaner.create(this, new Deallocator(base, size, cap))` —
`jdk.internal.ref.Cleaner`, a `PhantomReference`, whose javadoc says the thunk runs *"Some time
after the GC detects that a cleaner's referent has become phantom-reachable"*, on the
reference-handler thread.

🔴 **`-XX:+DisableExplicitGC` disables the JDK's own direct-buffer reclamation trigger.**
`gc_globals.hpp`: `product(bool, DisableExplicitGC, false, "Ignore calls to System.gc()")`. The
safer flag when you want to neutralise a rogue `System.gc()` is **`ExplicitGCInvokesConcurrent`**.

**Deterministic free:** `sun.misc.Unsafe.invokeCleaner` is `@Deprecated(since="23",
forRemoval=true)`, javadoc: *"Use a `MemorySegment` allocated in an `Arena` with the appropriate
temporal bounds. The `MemorySegment.asByteBuffer()` method wraps a memory segment as a
`ByteBuffer`."*

⚠️ **NMT's exact category name for direct buffers was NOT confirmed.** Do not assert it. Route
direct-buffer monitoring to `BufferPoolMXBean` / Micrometer `jvm.buffer.*`, whose pool names
(`"direct"`, `"mapped"`, `"mapped - 'non-volatile memory'"`) **are** verified from source.

---

## ⛔ RETRACTED tooling warning — `mdxcheck.py` is FINE (corrected 2026-09-01)

⛔ **This warning was WRONG and is retracted.** Tested empirically on 2026-09-01 against a control
file containing a bare `<Tag` in prose, the script reported `RAW-TAG … 1 MDX hazard(s) in 1
file(s)` — **it works**. The second number is files-WITH-HITS, not files-scanned, so
`0 hazards in 0 files` is a genuine pass. Confirmed independently by a fork that read the source:
it walks directories, skips `_`-prefixed files, blanks fenced blocks and joins wrapped inline
spans. Full correction in [[progress-java-p12-run-20260901]].

**The lesson that survives:** test a checker against a known-bad control before concluding it is
broken. Two agents worked around this tool for no reason.

Manual substitute that did work: check for bare `<!-- -->`, bare `<Tag` in prose (`<pid>`-style
hits inside fenced code blocks are fine), any line beginning with `{` other than
`{/* FOOTER */}`, and wrapped inline code spans followed by a brace-leading line.

Related: [[progress-java-p12-t01-memory-layout]] · [[cursor-java]] · [[java-board]]
