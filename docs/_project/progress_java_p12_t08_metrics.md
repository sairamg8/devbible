---
name: progress-java-p12-t08-metrics
description: Java phase 12 topic 08 · Metrics with Micrometer — CLOSED 2026-09-03 at 33 chunks + index, 8,372 lines, 493 stars. Carries the banked Micrometer memory-footprint source quotes that chunks 11/11b are built on, so they never need re-fetching.
metadata:
  type: project
---

# Java · phase 12 · topic 08 — Metrics with Micrometer — ✅ CLOSED 2026-09-03

Session `c246d8d8`, claimed and released on `devbible/JAVA-BOARD.md`. Phase 12 is now **11/15**.

**Final:** 33 chunks + `README.md`, **8,372 lines**, **493 ★**, `sidebar_position` 0–33 contiguous,
0 over the 300-line cap, 0 broken links, 0 MDX hazards.

## What this session actually wrote

The topic was left at 30 chunks with no index by session `67176b1d` fork B on 2026-09-02. It owed
three files. All three are now written:

| File | pos | lines | ★ |
|---|---|---|---|
| `11-cost-and-overhead.md` | 31 | 289 | 25 |
| `11b-the-scrape-the-cpu-and-the-levers.md` | 32 | 225 | 20 |
| `12-the-checklist.md` | 33 | 273 | 17 |
| `README.md` | 0 | 108 | — |

🔴 **Chunk 11 was drafted at 341 lines and SPLIT, and the split was proven UP** per hard rule 1:

|  | before | after |
|---|---|---|
| lines | 341 | **514** (289 + 225) |
| ★ | 25 | **45** |
| gotchas | 10 | **19** |
| interview Q | 9 | **16** |

The boundary is real and not the 300th line: **11 costs what a meter holds in your process**
(a number Micrometer publishes a formula for), **11b costs what it costs everybody else, forever**
(scrape, CPU, and the four levers in order).

## 🔴 BANKED SOURCE — do not re-fetch, this is the expensive part

From the **Micrometer** reference · *Timers* → *Memory Footprint Estimation*
(`docs.micrometer.io/micrometer/reference/concepts/timers.html`):

> *"Timers are the most memory-consuming meter, and their total footprint can vary dramatically,
> depending on which options you choose."*

Variables: **R** ring buffer length (`Timer.Builder#distributionStatisticBufferLength`, default
**3**) · **B** total histogram buckets (default range **1ms–30s**, **66** buckets for percentile
histograms) · **I** interval estimator, pause detection only, **~1.7kb** · **M** time-decaying max,
**104 bytes** · **Fb** fixed-boundary histogram, **8 bytes × B × R** · **Pp** percentile precision
(`Timer.Builder#percentilePrecision`, **0–3**, default **1**).

`Hdr(Pp)`: Pp=0 → 1.9kb × R + 0.8kb · Pp=1 → 3.8kb × R + 1.1kb · Pp=2 → 18.2kb × R + 4.7kb ·
Pp=3 → **66kb × R + 33kb**.

The six documented configurations:

| Pause detection | Client percentiles | Histogram/SLOs | Formula | Example |
|---|---|---|---|---|
| Yes | No | No | I + M | ~1.8kb |
| Yes | No | Yes | I + M + Fb | ~7.7kb (defaults) |
| Yes | Yes | Yes | I + M + Hdr(Pp) | ~14.3kb (0.95) |
| No | No | No | M | ~0.1kb |
| No | No | Yes | M + Fb | ~6kb (defaults) |
| No | Yes | Yes | M + Hdr(Pp) | ~12.6kb (0.95) |

🔴 The single most useful sentence for a Boot service, and the one nobody knows:

> *"For Prometheus, specifically, R is always equal to 1, regardless of how you attempt to
> configure it through Timer.Builder"*

— so on Prometheus every `× R` collapses to `× 1` and `distributionStatisticBufferLength` is
**silently ignored**. A memory fix based on tuning R is a no-op that logs nothing.

From *Meter Filters*:

> *"When you try to register a meter against a registry and the filter returns `DENY`, the registry
> returns a NOOP version of that meter … anything recorded to it is discarded immediately with
> minimal overhead."*

> *"Whitelisting only a certain group of metrics is a particularly common case for monitoring
> systems that are expensive."*

From *Registry*: *"Meters in Micrometer are created from and held in a `MeterRegistry`"* — the
registry is the owner, not a cache, so nothing evicts a series whose tag value stopped appearing.

⚠️ **There is no published bytes-per-series constant** and none was invented. 11b gives the reader
the two commands that measure their own instead:
`curl -s localhost:8080/actuator/prometheus | wc -c` and `| grep -vc '^#'`.

⚠️ `docs.spring.io/spring-boot/4.1.0/reference/...` **302-redirects** to the unversioned path. Fetch
`docs.spring.io/spring-boot/reference/actuator/metrics.html`.

## Boards wired

- `docs/java/pages/phase-12-jvm-production/README.md` — topic 08 row linked; **"9 of 15 topics
  closed" corrected to "11 of 15", counted off disk.** It was stale by two: topic 10 closed
  2026-09-02 and the count was never bumped.
- `src/data/progress.js` — java phase 12 `pages: 10 → 11`, `updated: '2026-09-03 02:30'`.
- `devbible/JAVA-BOARD.md` — row 08 ✅, phase header 10/15 67% → **11/15 73%**, roll-up
  173 → **179 done / 54 pending**.

## What is next in phase 12, cheapest first

1. **Topic 12 · Graceful shutdown** — 10 chunks on disk, no index. Owes `06b-message-consumers.md`
   at pos 11, then 07, 08, 08b, 09, 10, README.
2. **Topic 09 · Distributed tracing** — 6 chunks on disk, no index. Next is
   `03c-tracestate-and-baggage.md` at pos 7; honour the on-disk names `03d`/`03e`/`05`/`05b`/`06`/
   `06b`/`08` the earlier author linked.
3. Topics **11** (GraalVM) and **13** (JVM flags) are `_plan.md` only, and both carry
   **abandoned claims** from `67176b1d` dated 2026-09-02 14:30 — that session released at 14:52
   the same day with zero chunks on disk. Both are free.

🔴 Both 09 and 12 have forward references that were de-linked to `*(not written yet)*` in
`74e8d2f7`. **Re-link them as each chunk lands** — see [[progress-build-warnings-20260903]].

Related: [[java-board]], [[progress-build-warnings-20260903]], [[cursor-java]].
