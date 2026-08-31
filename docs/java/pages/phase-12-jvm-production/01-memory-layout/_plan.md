# Topic 01 · Memory layout — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **where the bytes are**: the process map, heap generations as a *shape*, metaspace,
code cache, thread stacks, direct and mapped buffers, the object header, alignment and
padding, compressed oops, string dedup/interning, and **Native Memory Tracking**.
🔴 It does **not** teach GC algorithms — **02** owns those. It does **not** teach container
limits — **03** owns those. It does **not** teach heap dumps — **04** owns those.
This topic is the **map**; every later topic in the phase reads a region of it.

## Chunks (a PLAN, not a budget — write to exhaustion, then split)
| # | File | What it argues |
|---|---|---|
| 1 | `01-heap-is-not-the-process.md` | The framing for the whole phase: `-Xmx` bounds one region of many |
| 2 | `02-the-process-map.md` | Every region a running JVM has, and who sizes each |
| 3 | `03-the-heap.md` | Young/old, eden and the survivor spaces, why generations exist at all |
| 3b | `03b-the-weak-generational-hypothesis.md` | The measured claim the design rests on, and where it fails |
| 3c | `03c-tlabs-and-allocation.md` | Thread-local allocation buffers; pointer-bump allocation; why `new` is cheap |
| 4 | `04-metaspace.md` | Native, not heap; PermGen's removal; `MaxMetaspaceSize` and the classloader leak |
| 5 | `05-the-code-cache.md` | JIT output lives here; segmented code cache; "CodeCache is full" and what it costs |
| 6 | `06-thread-stacks.md` | `-Xss`, frames, `StackOverflowError`, and the thread-count × stack-size arithmetic |
| 6b | `06b-virtual-thread-stacks.md` | Stack chunks on the heap; how JDK 21+ changes the arithmetic. Links to Phase 6 |
| 7 | `07-direct-and-mapped-buffers.md` | `ByteBuffer.allocateDirect`, `MaxDirectMemorySize`, `Cleaner`, and mmap |
| 8 | `08-the-object-header.md` | Mark word and class word; what is actually in them |
| 8b | `08b-compact-object-headers.md` | 🔴 **JEP 519, product in JDK 25**: 96–128 bits → 64. Not a default |
| 8c | `08c-alignment-and-padding.md` | 8-byte alignment, field reordering, `@Contended`, false sharing |
| 8d | `08d-measuring-an-object.md` | JOL as the honest measurement; why `sizeof` is the wrong question |
| 9 | `09-compressed-oops.md` | The 32 GB cliff, zero-based vs shifted, and the heap that got *smaller* when it grew |
| 10 | `10-strings.md` | The string pool, `intern()`, compact strings (Latin-1 vs UTF-16), string dedup |
| 11 | `11-native-memory-tracking.md` | `-XX:NativeMemoryTracking`, `jcmd VM.native_memory`, baselines and diffs |
| 11b | `11b-the-footprint-that-is-not-in-any-region.md` | Malloc arenas, JNI, the allocator; RSS vs the JVM's own accounting |
| 12 | `12-the-checklist.md` | "The pod grew and the heap is flat" — the ordered questions and the tool for each |

## Verify, do not assume
- ⚠️ **Compact object headers**: confirm JEP 519's *product* status in JDK 25 and that it is
  **off by default**; quote the JEP's own size numbers.
- ⚠️ **Compressed oops**: the exact `-XX:ObjectAlignmentInBytes` interaction and the real
  threshold (it is not exactly 32 GB — it depends on alignment). Quote the source.
- ⚠️ **`-XX:MaxDirectMemorySize` default** on JDK 25 — state what it actually derives from.
- ⚠️ **NMT overhead** — the tuning guide states a figure; quote it rather than estimating.
- ⚠️ Whether `UseStringDeduplication` is still G1-only on JDK 25.
