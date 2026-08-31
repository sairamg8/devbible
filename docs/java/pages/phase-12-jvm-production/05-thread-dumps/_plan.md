# Topic 05 · Thread dumps — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **the stuck service**: taking a dump, every thread state, deadlock and livelock,
pool exhaustion, and virtual-thread dumps. 🔴 **Phase 6 owns concurrency itself** — this
topic reads its consequences. **04 owns heap dumps**; **06 owns sampling profilers**.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-service-that-stopped-responding.md` | The symptom, and why a thread dump is the first tool not the last |
| 2 | `02-taking-one.md` | `jcmd <pid> Thread.print`, `jstack`, `kill -3`, and which to prefer on JDK 25 |
| 2b | `02b-take-three-of-them.md` | One dump is a photograph; three are a diagnosis |
| 3 | `03-anatomy-of-a-dump.md` | Header, thread block, `tid`/`nid`, priority, the stack, locks held |
| 4 | `04-the-thread-states.md` | `NEW`/`RUNNABLE`/`BLOCKED`/`WAITING`/`TIMED_WAITING`/`TERMINATED` |
| 4b | `04b-runnable-does-not-mean-running.md` | The state that lies: blocking socket reads report `RUNNABLE` |
| 5 | `05-locks-in-a-dump.md` | `waiting to lock`, `locked`, `parking to wait for` — monitors vs `j.u.c.` |
| 5b | `05b-deadlock.md` | The JVM's own `Found one Java-level deadlock` section; reading the cycle |
| 5c | `05c-livelock-and-lock-convoys.md` | The dumps that look busy and make no progress |
| 6 | `06-pool-exhaustion.md` | All N threads in the same frame — the shape of a saturated pool |
| 6b | `06b-the-connection-pool-in-a-dump.md` | HikariCP's own stack signature and what it proves |
| 7 | `07-virtual-threads.md` | 🔴 `jcmd Thread.dump_to_file` (plain + JSON); why `Thread.print` is not enough |
| 7b | `07b-pinning-in-a-dump.md` | Seeing a carrier pinned, and what causes it on JDK 25 |
| 8 | `08-what-a-dump-cannot-tell-you.md` | CPU burn, allocation, GC — hand off to 06 |
| 9 | `09-the-checklist.md` | From "it is hung" to a named cause |

## Verify, do not assume
- ⚠️ 🔴 The exact `jcmd` subcommands on **JDK 25** (`Thread.print`, `Thread.dump_to_file`)
  and their options — from the `jcmd` man page.
- ⚠️ Whether `jstack` is deprecated on 25 and what the tooling reference recommends.
- ⚠️ The current pinning conditions for virtual threads on JDK 25 (they changed after 21 —
  `synchronized` pinning was addressed by JEP 491 in JDK 24). **Check before writing.**
- ⚠️ **No fabricated thread dumps.** Quote the documented format or mark a schematic as one.
