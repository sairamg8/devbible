# Topic 09 · Distributed tracing — chunk plan

Tier: **Know**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **one request across many processes**: spans, propagation, sampling, and the exporters.
🔴 **08 owns metrics** and **07 owns logs** — this topic owns joining all three.
**Phase 14/15** own the architecture that makes tracing necessary; link, do not pre-empt.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-request-that-vanished.md` | Six services, one slow call, and logs that cannot be joined |
| 2 | `02-traces-spans-and-context.md` | The vocabulary, precisely: trace, span, parent, attributes, events |
| 3 | `03-context-propagation.md` | 🔴 W3C `traceparent`/`tracestate`; B3 as the legacy format |
| 3b | `03b-propagation-that-breaks.md` | Thread pools, messaging, batch jobs, and the trace that ends at a queue |
| 4 | `04-the-two-ways-in-java.md` | Micrometer Observation + bridge vs the OpenTelemetry Java agent |
| 4b | `04b-choosing-between-them.md` | Zero-code breadth vs first-class domain spans; using both |
| 5 | `05-wiring-it-in-spring-boot.md` | Starters, the OTLP exporter, and what auto-instruments itself |
| 6 | `06-sampling.md` | Head vs tail; parent-based; the ratio that decides your bill |
| 6b | `06b-the-trace-you-needed-was-not-sampled.md` | Why tail sampling exists |
| 7 | `07-joining-logs-metrics-and-traces.md` | `traceId` in MDC; exemplars; the three-click investigation |
| 8 | `08-instrumenting-what-the-agent-misses.md` | Custom spans, attributes and span events that are worth the code |
| 9 | `09-cost-and-overhead.md` | Agent startup, span volume, storage, and what to drop first |
| 10 | `10-the-checklist.md` | Making a new service traceable end to end |

## Verify, do not assume
- ⚠️ 🔴 The Micrometer Tracing bridge artifact names on **Boot 4.1** and which are still
  supported (Brave vs OTel). Quote the reference.
- ⚠️ The current W3C Trace Context header names and format — from the spec.
- ⚠️ OTel Java agent's supported JDK range and whether it works on JDK 25.
- ⚠️ **No fabricated trace waterfalls or span timings.**
