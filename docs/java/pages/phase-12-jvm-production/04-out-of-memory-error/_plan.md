# Topic 04 · `OutOfMemoryError` — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **the error, the dump and the analysis**. 🔴 **03 owns the container-kill** (a
different failure with a different fix); **01 owns the regions**; **05 owns thread dumps**.
This topic owns everything from the moment the JVM prints `java.lang.OutOfMemoryError`.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-it-is-an-error-not-an-exception.md` | Why catching it is almost always wrong, and the state the JVM is in |
| 2 | `02-the-eight-messages.md` | `Java heap space`, `GC overhead limit exceeded`, `Metaspace`, `Requested array size…`, `unable to create native thread`, `Direct buffer memory`, `Compressed class space`, `reason stack_trace_with_native_method` — each with its own cause |
| 2b | `02b-the-message-decides-the-fix.md` | Why "add more heap" is wrong for five of the eight |
| 3 | `03-getting-a-heap-dump.md` | `HeapDumpOnOutOfMemoryError`, `HeapDumpPath`, `jcmd GC.heap_dump`, `jmap` |
| 3b | `03b-the-dump-you-could-not-take.md` | Size, pause, disk, and dumping a container |
| 4 | `04-reading-a-dump-in-mat.md` | Histogram, dominator tree, retained vs shallow heap |
| 4b | `04b-retained-heap-is-the-only-number-that-matters.md` | The distinction people get wrong |
| 4c | `04c-leak-suspects-and-paths-to-gc-roots.md` | The report, and the reference chain that explains it |
| 5 | `05-the-usual-suspects.md` | Unbounded cache, unbounded queue, growing static map |
| 5b | `05b-threadlocal-on-a-pooled-thread.md` | The leak that survives the request |
| 5c | `05c-classloader-leaks.md` | Redeploy leaks, why metaspace does not come back |
| 5d | `05d-listeners-callbacks-and-forgotten-registrations.md` | The observer nobody removed |
| 6 | `06-when-it-is-not-a-leak.md` | Legitimate working set, a batch that loaded everything, a bad query |
| 7 | `07-references.md` | Strong/soft/weak/phantom, `WeakHashMap`, and when a cache should use them |
| 8 | `08-the-checklist.md` | From the error line to the fix, in order |

## Verify, do not assume
- ⚠️ 🔴 The **exact** set and wording of the `OutOfMemoryError` messages on JDK 25 — from the
  troubleshooting guide, not from memory. If there are more than eight, write them all.
- ⚠️ Whether `GC overhead limit exceeded` applies to every collector or only some.
- ⚠️ `jmap -dump:live` semantics and whether `jmap` is deprecated in favour of `jcmd` on 25.
- ⚠️ **No fabricated MAT screenshots or dump statistics.** Describe, quote, or schematise.
