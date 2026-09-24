---
name: research-java-p12-metaspace-codecache-tlabs
description: Primary-source JDK 25 research for phase 12 — metaspace, the code cache, TLABs, generational aging, the OutOfMemoryError message list and the heap-dump flags. Everything needed to write 04-metaspace.md, 05-the-code-cache.md and 03b/03c without re-fetching. Several findings contradict the man page or common folklore.
metadata:
  type: project
---

# Java · Phase 12 — metaspace, code cache, TLABs: banked primary-source research

**Established 2026-08-31 by the band-A `devbible-author` fork in session `4248352b`.** Companion
to [[research-java-p12-t01-jvm-memory-internals]] (band B: stacks, buffers, mark word, headers).

🔴 **This is enough to write `04-metaspace.md`, `05-the-code-cache.md`, `03b` and `03c` without
re-fetching anything.**

## 🔴 Tooling — how to actually reach the sources

- `openjdk.org` **403s WebFetch**. Workaround that works: `curl -sL -A "Mozilla/5.0" https://openjdk.org/jeps/N`.
- 🔴 **`raw.githubusercontent.com/openjdk/jdk/jdk-25%2B36/src/hotspot/...` works from Bash/curl.**
  **`jdk-25+36` is the JDK 25 GA tag.** This is the authoritative source for every flag default the
  man page omits — **and it omits a lot.**
- Oracle doc pages need JS for their TOC; fetch chapter files directly. ⚠️ **A wrong chapter name
  silently returns a 33,756-byte "JDK 26 Documentation home" page — check the byte count.**

---

## 🔴 CONFLICT BETWEEN THE TWO FORKS — resolved in favour of band B

**`-XX:MaxDirectMemorySize`'s effective default.**

- **Band A** searched the man page, found only *"If not set, the flag is ignored and the JVM
  chooses the size for NIO direct-buffer allocations automatically"*, and correctly **refused to
  assert** the `= -Xmx` claim, calling it folklore absent a better source. Good discipline.
- **Band B found the better source.** `jdk/internal/misc/VM.java`, verbatim: *"The initial value
  of this field is arbitrary; during JRE initialization it will be reset to the value specified on
  the command line, if any, **otherwise to `Runtime.getRuntime().maxMemory()`**."*

🔴 **Resolution: the default DOES equal `-Xmx`** — a second copy of the heap ceiling, not a slice
of it. The man page is simply silent; the JDK source is authoritative. **Cite `VM.java`, not the
man page**, and say explicitly that the man page does not document it.

**The lesson worth keeping:** band A was right to refuse, band B was right to dig. *"The man page
does not say"* is a reason to read the source, not a reason to hedge forever.

---

## Metaspace — everything for `04-metaspace.md`

**`-XX:MaxMetaspaceSize` default is UNLIMITED.** Man page: *"Sets the maximum amount of native
memory that can be allocated for class metadata. **By default, the size isn't limited.**"*
Confirmed: `product(size_t, MaxMetaspaceSize, max_uintx, ...)`.

**`-XX:MetaspaceSize` default is 21 MB on 64-bit** — the man page only says *"depends on the
platform"*. Source settles it:
```cpp
product(size_t, MetaspaceSize, NOT_LP64(16 * M) LP64_ONLY(21 * M),
        "Initial threshold (in bytes) at which a garbage collection is done to reduce Metaspace usage")
```
🔴 It is a **GC trigger threshold, not a reservation.** Widely misread.

**`-XX:CompressedClassSpaceSize` default is 1 GB — and is NOT in the JDK 25 man page at all**
(zero occurrences of "CompressedClass"). Source:
```cpp
product(size_t, CompressedClassSpaceSize, 1*G,
        "Maximum size of class area in Metaspace when compressed class pointers are used")
        range(1*M, LP64_ONLY(4*G) NOT_LP64(max_uintx))
```
It *is* in the Troubleshooting Guide under the `Compressed class space` OOM message.

### 🔴 `UseCompressedClassPointers` is DEPRECATED in JDK 25, obsolete in 26

`arguments.cpp`, `special_jvm_flags[]`:
```cpp
{ "UseCompressedClassPointers", JDK_Version::jdk(25), JDK_Version::jdk(26), JDK_Version::undefined() },
```
and `globals.hpp` now labels it *"(Deprecated) Use 32-bit class pointers in 64-bit VM."*

🔴 **On JDK 25 `-XX:-UseCompressedClassPointers` warns; on 26 it is obsolete.** Any page telling a
reader to disable it is documenting a flag with a one-release life. **Affects phase-12 topics 01,
09-equivalent content and 13.**

**Metaspace is one NMT category with two sub-regions.** `Class (reserved=…, committed=…)` splits
into `Metadata:` and `Class space:` (`reserved=1048576KB` = the 1 GB default). **Two limits, two
distinct OOM messages.**

### PermGen removal — JEP 122, Java 8, verbatim

> *"Class metadata, interned Strings and class static variables will be moved from the permanent
> generation to either the Java heap or native memory."*

> *"The proposed implementation will allocate class meta-data in native memory and **move interned
> Strings and class statics to the Java heap**."*

🔴 **The classloader-leak mechanism, in the JEP's own words:**
> *"Allocation of native memory for class meta-data will be done in blocks… **Each block will be
> associated with a class loader**… **Freeing the space for the class meta-data would be done when
> the class loader dies** by freeing all the blocks associated with the class loader. Class
> meta-data will not be moved during the life of the class."*

**Metaspace is freed only at classloader granularity.** That single sentence *is* the leak.

### JEP 387 Elastic Metaspace (JDK 16)

> *"Metaspace memory is managed in per-class-loader arenas. An arena contains one or more chunks,
> from which its loader allocates via inexpensive pointer bumps."* … *"replace the existing
> metaspace memory allocator with a buddy-based allocation scheme… commit memory from the
> operating system to arenas lazily, on demand… uniformly-sized granules which can be committed
> and uncommitted independently."*

🔴 **JEP 387's flag `-XX:MetaspaceReclaimPolicy` is OBSOLETE since JDK 21**
(`{ "MetaspaceReclaimPolicy", undefined, jdk(21), undefined }`). Anyone quoting JEP 387's "new
command-line option" on JDK 25 is quoting a removed flag.

**Diagnostics:** `jcmd VM.metaspace [basic|show-loaders|show-classes|by-chunktype|by-spacetype|vslist|chunkfreelist|scale]`
— *"Impact: Medium --- Depends on number of classes loaded"*; `basic` *"does not need a
safepoint"*. Also `VM.classloader_stats` (Impact: Low) and `VM.classloaders [show-classes|verbose|fold]`.

---

## Code cache — everything for `05-the-code-cache.md`

**`-XX:ReservedCodeCacheSize`**, man page verbatim: *"**The default maximum code cache size is
240 MB; if you disable tiered compilation with the option `-XX:-TieredCompilation`, then the
default size is 48 MB.** This option has a limit of 2 GB."* Mechanism
(`compilerDefinitions.cpp`): `FLAG_SET_ERGO(ReservedCodeCacheSize, MIN2(CODE_CACHE_DEFAULT_LIMIT, (size_t)ReservedCodeCacheSize * 5))`
over the platform default `48*M` → **48 × 5 = 240 MB**.

### 🔴 `SegmentedCodeCache` IS on by default, despite `globals.hpp` saying `false`

It is set **ergonomically**. Man page: *"enabled by default if tiered compilation is enabled and
the reserved code cache size is at least 240 MB."* Source adds a third condition the man page omits:
```cpp
// ... and the code cache contains at least 8 pages (segmentation disables advantage of huge pages).
if (FLAG_IS_DEFAULT(SegmentedCodeCache) && ReservedCodeCacheSize >= 240*M &&
    8 * CodeCache::page_size() <= ReservedCodeCacheSize) { FLAG_SET_ERGO(SegmentedCodeCache, true); }
```
`-Xint` forcibly disables it: `warning("SegmentedCodeCache has no meaningful effect with -Xint")`.

**Segment names and tier mapping** (`codeCache.cpp::initialize_heaps`, with its own comments):

| Segment | Holds |
|---|---|
| `CodeHeap 'non-nmethods'` | interpreter, stubs, adapters, compiler buffers — **never freed** |
| `CodeHeap 'profiled nmethods'` | **tiers 2 and 3** (C1 + counters / C1 + full profiling) |
| `CodeHeap 'non-profiled nmethods'` | **tiers 1 and 4** (C1 no profiling, C2/JVMCI) + native wrappers |

**Tier levels** (`compilerDefinitions.hpp`): 0 Interpreter · 1 C1 · 2 C1+counters ·
3 C1+counters+mdo · 4 C2 or JVMCI.

⚠️ **Do NOT quote 21 MB / 22 MB / 5 MB as the JDK 25 segment defaults** — those platform values are
used only when set on the command line. With defaults, `initialize_heaps()` gives
**non-nmethod = 5 MB + compiler buffer space** (scales with C1/C2 thread count) and splits the
remaining ~235 MB **evenly between profiled and non-profiled**. If you set `ReservedCodeCacheSize`
explicitly and the segments do not sum to it, the JVM **refuses to start**:
`vm_exit_during_initialization("Invalid code heap sizes", message)`.

### 🔴 What actually happens when it fills — the message names the HEAP, not the cache

`codeCache.cpp::report_codemem_full`:
```cpp
if (SegmentedCodeCache) {
  msg1_stream.print("%s is full. Compiler has been disabled.", get_code_heap_name(code_blob_type));
  msg2_stream.print("Try increasing the code heap size using -XX:%s=", get_code_heap_flag_name(code_blob_type));
} else {
  "CodeCache is full. Compiler has been disabled."
  "Try increasing the code cache size using -XX:ReservedCodeCacheSize="
}
```
🔴 **On a default JDK 25 (segmented) you get e.g. `CodeHeap 'profiled nmethods' is full. Compiler
has been disabled.` / `Try increasing the code heap size using -XX:ProfiledCodeHeapSize=`.**
The famous `CodeCache is full` string only appears with `-XX:-SegmentedCodeCache` or
`-XX:-TieredCompilation`. Flag mapping: NonNMethod→`NonNMethodCodeHeapSize`,
MethodNonProfiled→`NonProfiledCodeHeapSize`, MethodProfiled→`ProfiledCodeHeapSize`.

### 🔴 "Once compilation is off it never comes back" is FALSE on JDK 25

```cpp
if (UseCodeCacheFlushing) {
  if (CompileBroker::set_should_compile_new_jobs(CompileBroker::stop_compilation)) {
    log_info(codecache)("Code cache is full - disabling compilation"); }
} else { disable_compilation_forever(); }
```
and `CodeCache::maybe_restart_compiler` → `log_info(codecache)("Restarting compiler")` + `EventJITRestart`.

`-XX:+UseCodeCacheFlushing` is **on by default** (*"This option is enabled by default"*), so the
modern behaviour is **stop → unload cold nmethods → restart, potentially repeatedly.** The man
page's Code Heap State Analytics section confirms it by listing the question *"Why was the JIT
turned off and then on again and again?"* JFR: `EventJITRestart` with `freedMemory` and
`codeCacheMaxCapacity`.

**Sweeping:** `SweeperThreshold` 15.0 (*"percentage of ReservedCodeCacheSize"*),
`StartAggressiveSweepingAt` 10 — note the segmented variant measures the **non-profiled heap
only**. GC causes: `_codecache_GC_aggressive`, `_codecache_GC_threshold`.

⚠️ **The man page's Code Heap State Analytics section is STALE** — it still asks *"Why is the
method sweeper not working effectively?"* The dedicated sweeper thread was removed years ago;
nmethod unloading is now GC-driven (`CodeCache::gc_on_allocation`). **Flag this on the page rather
than repeating it.**

**Diagnostics:** `-Xlog:codecache=Trace` (post-workload) and `-Xlog:codecache=Debug` (on full),
both quoted from the man page. `jcmd Compiler.codecache` (Impact: Low), `Compiler.codelist`
(Impact: Medium), `Compiler.CodeHeap_Analytics [aggregate|UsedSpace|FreeSpace|MethodCount|MethodSpace|MethodAge|MethodNames|discard]`.

---

## TLABs — for `03c-tlabs-and-allocation.md`

🔴 **`_plan.md` named `-XX:InitialTLABSize`. THAT FLAG DOES NOT EXIST.** It is **`-XX:TLABSize`**,
default **0 = ergonomic**. Man page: *"**If this option is set to 0, then the JVM selects the
initial size automatically.**"*

`-XX:+ResizeTLAB` and `-XX:MinTLABSize` are **not in the man page at all**. From
`gc/shared/tlab_globals.hpp` at `jdk-25+36`:

| Flag | Default | Description |
|---|---|---|
| `UseTLAB` | `true` | "Use thread-local object allocation" |
| `ResizeTLAB` | `true` | "Dynamically resize TLAB size for threads" |
| `ZeroTLAB` | `false` | "Zero out the newly created TLAB" |
| `MinTLABSize` | `2*K` | "Minimum allowed TLAB size (in bytes)" |
| `TLABSize` | `0` | "Starting TLAB size (in bytes); zero means set ergonomically" |
| `TLABWasteTargetPercent` | `1` | "Percentage of Eden that can be wasted" |
| `TLABRefillWasteFraction` | `64` | "Maximum TLAB waste at a refill" |
| `TLABWasteIncrement` | `4` | "Increment allowed waste at slow allocation" |
| `TLABAllocationWeight` | `35` | "Allocation averaging weight" |
| `YoungPLABSize` / `OldPLABSize` | `4096` / `1024` HeapWords | promotion LABs |

**Sizing formula** (`threadLocalAllocBuffer.cpp`): `init_sz = (eden_capacity / HeapWordSize) / (nof_threads * target_refills())`
with `_target_refills = 100 / (2 * TLABWasteTargetPercent)` = **50** by default (min 2).
So a TLAB ≈ **`eden_capacity / (allocating_threads × 50)`**.

🔴 **Pointer-bump allocation — the whole "why `new` is cheap" argument in eight lines**
(`threadLocalAllocBuffer.inline.hpp`):
```cpp
inline HeapWord* ThreadLocalAllocBuffer::allocate(size_t size) {
  HeapWord* obj = top();
  if (pointer_delta(end(), obj) >= size) { set_top(obj + size); return obj; }
  return nullptr;
}
```
No lock, no CAS, no free list — a compare and an add. Logging: `-Xlog:gc+tlab=trace|debug`.

---

## Generational aging — for `03b`

**The weak generational hypothesis, verbatim from the GC tuning guide:** *"the most important of
these observed properties is the **weak generational hypothesis**, which states that most objects
survive for only a short period of time."* Figure 3-1: *"The x-axis shows object lifetimes measured
in bytes allocated. The sharp peak at the left represents objects that can be reclaimed shortly
after being allocated. For example, iterator objects are often only alive for the duration of a
single loop."*

🔴 **The honest hedge to build `03b` around:** *"Some applications have very different looking
distributions, but a surprisingly large number possess this general shape."*

Minor-collection cost, verbatim: *"The costs of such collections are, to the first order,
proportional to the number of live objects being collected; a young generation full of dead
objects is collected very quickly."*

`InitialTenuringThreshold` = **7**, `MaxTenuringThreshold` = **15**, both
`range(0, markWord::max_age + 1)` — **the four-bit header age field is the documented reason for
the cap.** None of `InitialTenuringThreshold`, `PretenureSizeThreshold` (default 0, serial only),
`AlwaysTenure`, `NeverTenure` (ParallelGC only) is in the man page.

⚠️ **Unresolved:** the tuning guide's Table 4-1 gives `-XX:NewSize` default as **"1310 MB"**, which
looks wrong. **Neither confirmed nor refuted.** Quote it verbatim with the chapter's own caveat
(*"the following discussion … uses the serial collector as an example … the details presented here
may not apply to other collectors"*) and **do not assert a corrected value.**

---

## 🔴 `OutOfMemoryError` — corrections to `_PHASE-NOTES.md` and topic 04's plan

**The JDK 25 Troubleshooting Guide lists SEVEN detail messages, not eight:**
`Java heap space` · `GC Overhead limit exceeded` · `Requested array size exceeds VM limit` ·
`Metaspace` · `request size bytes for reason. Out of swap space?` · `Compressed class space` ·
`reason stack_trace (Native method)`.

🔴 `Direct buffer memory` and `unable to create native thread` are **real but not on that list**.
Topic 04 must say **"seven documented, plus these two"**. (Band B found their exact strings —
see [[research-java-p12-t01-jvm-memory-internals]].)

### 🔴 `-XX:+HeapDumpOnOutOfMemoryError` only fires for HEAP exhaustion

Man page verbatim, and the identical sentence appears under `-XX:OnOutOfMemoryError`:
> *"This applies only to `OutOfMemoryError` exceptions caused by Java Heap exhaustion; it does not
> apply to `OutOfMemoryError` exceptions thrown directly from Java code, nor by the JVM for other
> types of resource exhaustion (such as native thread creation errors)."*

🔴 **So the standard "always set HeapDumpOnOutOfMemoryError" advice is incomplete**: it gets you
nothing for metaspace, direct buffer, native thread or swap exhaustion. Any checklist recommending
it must say what it does *not* cover.

**`-XX:+ExitOnOutOfMemoryError` and `-XX:+CrashOnOutOfMemoryError` are NOT in the JDK 25 man page**
(zero grep hits) but are `product` flags, both `false`, described as firing *"on the first
occurrence of an out-of-memory error thrown from JVM"* — **no heap-exhaustion qualifier**, so they
are the broader net.

`-XX:HeapDumpPath` default: *"created in the current working directory, named
`java_pid<pid>.hprof`"*; `%p` is the only expansion.

🔴 **`jmap` is experimental and unsupported on JDK 25.** Man page opens: *"Note: This command is
experimental and unsupported."* Prefer `jcmd GC.heap_dump` — *"Request a full GC unless the `-all`
option is specified"*; `-all` = *"Dump all objects, including unreachable objects"*; plus `-gz`
(*"1 (recommended) is the fastest, 9 the strongest compression"*), `-parallel`, `-overwrite`.
⚠️ **`jmap -dump:` and `jcmd GC.heap_dump` have OPPOSITE defaults** — `jmap` needs `live`,
`jcmd` needs `-all` to invert.

---

## NMT extras (complements band B's file)

- **The complete JDK 25 category list is `src/hotspot/share/nmt/memTag.hpp` — 27 tags.** The
  Troubleshooting Guide's Table 2-1 is a **subset and is behind the source**, and warns *"These
  categories may change with a release."*
- Reserved vs committed, verbatim: *"only committed memory is actually used… if you run with
  `-Xms100m -Xmx1000m`, then the JVM will reserve 1000 MB… only 100 MB will be committed to begin
  with… The problem arises if more and more memory gets committed."*
- Arenas, verbatim: *"An arena is a chunk of memory allocated using malloc… An arena malloc policy
  ensures no memory leakage. So arena is tracked as a whole and not individual objects."*
- The guide contains **real sample NMT output** (summary, detail with a virtual memory map, and
  `summary.diff`) — quotable **with attribution**.
- ⚠️ **Weakest claim made anywhere in topic 01:** that direct buffers land in NMT's `Other`
  category. Table 2-1 defines `Other` only as *"Memory not covered by another category"* and does
  **not** name direct buffers. **Confirm against a real NMT report or the `mtOther` call sites
  before repeating it.** It is asserted in `02b` and in `11-native-memory-tracking.md`.

## Other flag facts for topic 13

- `-XX:MaxRAMPercentage` default **25%**; `-XX:MinRAMPercentage` default **50%** and is **not a
  floor** — it is MaxRAMPercentage for *"small heaps … approximately 125 MB"*. `-XX:MaxRAM`
  default *"the maximum amount of available memory to the JVM process or 128 GB"*.
- `-XX:+AlwaysPreTouch`: *"touch every page on the Java heap after requesting it from the operating
  system and before handing memory out… By default, this option is disabled."*
- `-XX:-UseContainerSupport`: *"The default for this flag is true."*
- **Deprecated/obsolete confirmations from `arguments.cpp`:** `ZGenerational` deprecated 23 /
  obsolete **24** · `MetaspaceReclaimPolicy` obsolete **21** · `PerfDataSamplingInterval` obsolete
  25, expires 26 · `ZMarkStackSpaceLimit` obsolete 25 · `LockingMode` deprecated 24, obsolete 26 ·
  `UseOprofile` deprecated 25 · `UseCompressedClassPointers` deprecated 25, obsolete 26.

⚠️ Band A deliberately wrote **nothing** about ZGC's address-space reservation multiple — unverified.

Related: [[research-java-p12-t01-jvm-memory-internals]] · [[progress-java-p12-t01-memory-layout]] · [[cursor-java]]
