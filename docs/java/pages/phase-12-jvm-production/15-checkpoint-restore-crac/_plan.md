# Topic 15 · Checkpoint/restore (CRaC) — chunk plan

Tier: **When needed** — ⚠️ the phase README uses the class `t-when`, **match it**.
🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **restoring a running JVM from a snapshot**. 🔴 It is the third member of the
fast-start trio: **10** owns CDS/AOT cache, **11** owns native image, **15** owns CRaC.
Each of those three chunks must name the other two; this topic owns the comparison table.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-cold-start-problem.md` | Scale-to-zero, scale-out spikes, and the first request that took 4 seconds |
| 2 | `02-what-crac-is.md` | Coordinated Restore at Checkpoint; the API and the CRIU machinery underneath |
| 2b | `02b-warm-not-just-started.md` | 🔴 The differentiator: a restored JVM is already JIT-warm |
| 3 | `03-the-resource-lifecycle.md` | `Resource`, `beforeCheckpoint`, `afterRestore`, `Core.checkpointRestore()` |
| 4 | `04-what-must-be-released.md` | Open sockets, files, native handles — the checkpoint that refused |
| 4b | `04b-what-changes-across-a-restore.md` | Time jumps, expired tokens, stale DNS, secure random state, hostname/IP |
| 4c | `04c-secrets-and-the-snapshot.md` | 🔴 The snapshot contains your heap. Treat it as a credential |
| 5 | `05-spring-boot-support.md` | Boot's checkpoint/restore integration and the `-Dspring.context.checkpoint=onRefresh` mode |
| 5b | `05b-the-two-modes.md` | On-refresh (no CRIU) vs a full CRaC checkpoint of a warmed process |
| 6 | `06-operating-it.md` | Building the checkpoint in CI, storing the image, privileges CRIU needs |
| 7 | `07-crac-vs-native-image-vs-aot-cache.md` | 🔴 The comparison table this topic owns |
| 8 | `08-when-to-reach-for-it.md` | And the much more common case where the answer is "fix the startup" |
| 9 | `09-the-checklist.md` | Deciding, then the readiness list before you try |

## Verify, do not assume
- ⚠️ 🔴 Which JDK builds ship CRaC support (it is **not** stock OpenJDK — Azul Zulu, Bellsoft
  Liberica, others). State availability precisely; this is the topic's biggest correctness risk.
- ⚠️ 🔴 Boot **4.1**'s exact checkpoint/restore property and its documented limitations.
- ⚠️ The `org.crac` API package and class names — from the CRaC project docs.
- ⚠️ Linux/CRIU privilege requirements as documented, not as assumed.
- ⚠️ **No fabricated restore timings.**
