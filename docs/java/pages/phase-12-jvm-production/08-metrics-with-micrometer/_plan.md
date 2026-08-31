# Topic 08 · Metrics with Micrometer — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **aggregate numbers over time**: meters, tags, RED, percentiles, and the registry.
🔴 **Phase 9 topic 13 taught Actuator** — link to it, do not re-teach endpoints.
**07 owns logs**, **09 owns traces**; this topic states the three-signal boundary once.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-average-that-lied.md` | Mean latency hides the p99 that is your users' experience |
| 2 | `02-what-micrometer-is.md` | A facade over registries; SLF4J's shape applied to metrics |
| 3 | `03-the-meter-types.md` | Counter, gauge, timer, distribution summary, long task timer |
| 3b | `03b-the-gauge-that-was-garbage-collected.md` | 🔴 Weak references; the gauge that reports NaN |
| 3c | `03c-counter-versus-gauge.md` | Monotonic vs sampled, and why `rate()` needs a counter |
| 4 | `04-tags.md` | Dimensions, not metric-name-mangling |
| 4b | `04b-cardinality.md` | 🔴 The user id in a tag that killed the metrics backend |
| 4c | `04c-meterfilter.md` | Denying, renaming, capping cardinality, common tags |
| 5 | `05-red-and-use.md` | Rate/Errors/Duration per endpoint; Utilisation/Saturation/Errors per resource |
| 6 | `06-what-boot-gives-you-free.md` | `http.server.requests`, JVM, pool, cache and DB meters |
| 6b | `06b-the-uri-tag.md` | Templated path vs raw path — the cardinality bomb Boot avoids for you |
| 7 | `07-timing-your-own-code.md` | `Timer.record`, `@Timed`, `Timer.Sample`, and the try/finally |
| 7b | `07b-observation-api.md` | One instrumentation, three signals; `ObservationRegistry` |
| 8 | `08-percentiles.md` | 🔴 Client-side percentiles cannot be aggregated across instances |
| 8b | `08b-histograms-and-buckets.md` | `publishPercentileHistogram`, SLO boundaries, bucket cost |
| 9 | `09-exporting.md` | Prometheus scrape vs push; the registry as the export point |
| 10 | `10-alerting-on-what-matters.md` | Symptom-based alerts; the dashboard nobody looks at |
| 11 | `11-cost-and-overhead.md` | Meter count, scrape size, and the memory a registry holds |
| 12 | `12-the-checklist.md` | Instrumenting a new service, in order |

## Verify, do not assume
- ⚠️ 🔴 The Micrometer version managed by **Boot 4.1.0** and whether the Prometheus registry
  artifact id changed (`micrometer-registry-prometheus` vs the `simpleclient` split).
- ⚠️ The exact default meter names Boot 4.1 publishes — quote the production-ready reference.
- ⚠️ Whether `@Timed` needs a `TimedAspect` bean in Boot 4.1 and where it is auto-configured.
- ⚠️ **No fabricated metric values or scrape output.**
