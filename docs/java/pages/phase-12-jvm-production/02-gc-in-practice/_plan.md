# Topic 02 · GC in practice — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **choosing a collector and reading what it tells you**. Algorithms only to the depth
that changes a decision. 🔴 **01 owns the memory map**; **03 owns sizing**; **13 owns the
flag inventory**; **06 owns profilers**. This topic owns the **GC log** and the choice.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-what-a-collector-actually-promises.md` | Three axes: throughput, latency, footprint. You get two |
| 2 | `02-the-four-collectors.md` | Serial, Parallel, G1, ZGC on JDK 25 — and G1 is the default |
| 2b | `02b-shenandoah-and-availability.md` | 🔴 Not in every JDK build; JEP 521 generational is product but not default |
| 3 | `03-g1.md` | Regions, concurrent marking, evacuation pauses, the pause-time goal |
| 3b | `03b-humongous-allocations.md` | The half-region rule, and the array that fragments a heap |
| 3c | `03c-g1-when-it-goes-wrong.md` | To-space exhaustion, evacuation failure, full GC |
| 4 | `04-zgc.md` | 🔴 Generational since 23, non-generational **removed in 24**. Coloured pointers, load barriers |
| 4b | `04b-zgc-costs.md` | Footprint and CPU as the price of the pause; when it is the wrong choice |
| 5 | `05-parallel-and-serial.md` | Where throughput or a tiny container still wins |
| 6 | `06-choosing.md` | A decision table driven by the latency target, not by fashion |
| 7 | `07-unified-logging.md` | `-Xlog:gc*` — the JDK 9+ framework; `-XX:+PrintGCDetails` is gone |
| 7b | `07b-reading-a-gc-log.md` | Line by line: what each field means, what healthy looks like |
| 7c | `07c-rotating-and-shipping-gc-logs.md` | `filecount`, `filesize`, and always having the log when it matters |
| 8 | `08-allocation-rate.md` | The number that predicts GC pressure better than heap size |
| 8b | `08b-premature-promotion.md` | Survivor sizing, tenuring threshold, and the old gen that fills for no reason |
| 9 | `09-gc-overhead-and-the-death-spiral.md` | `GC overhead limit exceeded`; the 98% rule |
| 10 | `10-safepoints.md` | Time-to-safepoint, the pause that the GC log does not show |
| 11 | `11-when-tuning-is-the-wrong-answer.md` | The allocation the code should not have made |
| 12 | `12-the-checklist.md` | "GC pauses went up" — the ordered questions |

## Verify, do not assume
- ⚠️ 🔴 Confirm from the **JDK 25 GC tuning guide** that the collector list is exactly
  Serial/Parallel/G1/ZGC and quote *"G1 is selected by default…"* verbatim.
- ⚠️ 🔴 Confirm **JEP 490** removed non-generational ZGC in JDK 24 and that `-XX:-ZGenerational`
  is therefore obsolete on 25. Never print it as live advice.
- ⚠️ The exact default of `-XX:MaxGCPauseMillis` for G1 on JDK 25.
- ⚠️ Whether `-XX:+UseAdaptiveSizePolicy` is still meaningful and for which collectors.
- ⚠️ Quote the real `-Xlog` decorators; do not invent a log line. **No fabricated GC output.**
