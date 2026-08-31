# Topic 03 · Heap sizing in containers — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **how much memory to give the JVM when something else is enforcing a limit**: cgroups,
`MaxRAMPercentage`, the OOMKilled loop, CPU shares and their effect on ergonomics.
🔴 **01 owns what the non-heap regions are**; this topic owns the *budget* across them.
The Docker/Kubernetes mechanics themselves are linked, not re-taught.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-oomkilled-loop.md` | The symptom: exit 137, no stack trace, no heap dump. Why it is not `OutOfMemoryError` |
| 2 | `02-container-awareness.md` | `UseContainerSupport`; what the JVM reads from cgroups; cgroup v1 vs v2 |
| 3 | `03-maxrampercentage.md` | 🔴 The right knob. `Initial`/`Min`/`MaxRAMPercentage`, and the 25% default trap |
| 3b | `03b-why-not-xmx.md` | The Dockerfile `-Xmx` that breaks on every other memory size |
| 4 | `04-the-memory-budget.md` | Heap + metaspace + code cache + stacks + direct + native ≤ limit. Worked arithmetic |
| 5 | `05-cpu-limits-and-ergonomics.md` | `ActiveProcessorCount`, quota vs shares, and the pool sized from a lie |
| 6 | `06-requests-limits-and-the-jvm.md` | Kubernetes requests/limits vs what the JVM sees; QoS classes |
| 7 | `07-choosing-a-collector-in-a-small-container.md` | Serial/Parallel at small sizes; what ergonomics picks and why |
| 8 | `08-getting-a-dump-out-of-a-container.md` | Ephemeral filesystems, volumes, and the dump you lost on restart |
| 9 | `09-the-checklist.md` | Sizing a service from first principles, then verifying it |

## Verify, do not assume
- ⚠️ 🔴 The **actual default** of `MaxRAMPercentage` on JDK 25 and the threshold below which
  the JVM uses a different fraction. Quote the `java` tool reference.
- ⚠️ How JDK 25 detects cgroup **v2** limits and what it does when a limit is unset/`max`.
- ⚠️ `ActiveProcessorCount` behaviour under CPU **quota** vs **shares** on JDK 25.
- ⚠️ Whether `-XX:+ExitOnOutOfMemoryError` / `CrashOnOutOfMemoryError` are the right pairing.
