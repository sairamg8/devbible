# Topic 10 · Correlation across services — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **the identifier that makes one user request legible across six services**: W3C
`traceparent`, propagation through every hop, and getting it into the logs. 🔴 **Phase 12
topic 09 owns tracing infrastructure** (collectors, backends, sampling economics) — check what
it actually wrote before duplicating: `ls ../../phase-12-jvm-production/`. As of 2026-09-01 that
topic is planned but unwritten, so **state the boundary in prose and link only to what exists**.
🔴 **07 owns the gateway**; 10 owns what the gateway must *inject and forward*.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-incident-without-a-correlation-id.md` | Six log files, one timestamp range, no way to join them |
| 2 | `02-trace-span-and-request.md` | The three words people use interchangeably and should not |
| 3 | `03-the-w3c-traceparent-header.md` | The actual format, field by field, and why a standard mattered |
| 3b | `03b-tracestate-and-vendor-baggage.md` | The second header, and what belongs in it |
| 4 | `04-micrometer-tracing.md` | The abstraction on Boot 4.1, and the bridge you must choose |
| 4b | `04b-observation-api.md` | `Observation` as the one instrumentation point for metrics *and* traces |
| 5 | `05-what-is-instrumented-for-free.md` | Incoming HTTP, outgoing clients, messaging — and the gaps |
| 6 | `06-getting-the-trace-id-into-the-log.md` | MDC, the logging pattern, and structured output |
| 6b | `06b-the-log-line-that-is-useless.md` | A message with no ids is an orphan the moment it leaves the service |
| 7 | `07-propagation-across-a-thread-boundary.md` | 🔴 The context that vanishes on `@Async`, an executor, or a virtual thread |
| 7b | `07b-propagation-across-a-message.md` | Headers on a queue message; the async hop that breaks the chain |
| 8 | `08-baggage.md` | Carrying tenant or user id alongside the trace — and the cost of doing it |
| 9 | `09-sampling.md` | Why you cannot keep everything, and how sampling decisions propagate |
| 9b | `09b-the-sampled-out-request-that-broke.md` | The honest limitation of head-based sampling |
| 10 | `10-correlation-without-a-tracing-backend.md` | A correlation id in logs gets you 80% for almost nothing |
| 11 | `11-the-user-facing-request-id.md` | Returning an id in the response so a support ticket is actionable |
| 12 | `12-the-checklist.md` | What to add before the first cross-service incident, not after |

## Verify, do not assume
- ⚠️ 🔴 Quote the **W3C Trace Context** recommendation for the `traceparent` format (version,
  trace-id, parent-id, trace-flags) — field lengths and the hex encoding, from the spec itself.
- ⚠️ 🔴 Verify Micrometer Tracing's current bridges and what **Boot 4.1** auto-configures. The
  Sleuth-era API is gone; never present `spring-cloud-sleuth` as live.
- ⚠️ Verify how context propagates over virtual threads on **JDK 25** and what Boot 4.1 does
  about it — this is the chunk most likely to be wrong from memory.
- ⚠️ Check phase 6 (concurrency) and phase 12 for anything already written on context
  propagation; link rather than repeat.
- ⚠️ **No sandbox.** No trace waterfalls, no screenshots, no sampled log excerpts that were not
  in the documentation.
