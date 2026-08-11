---
title: "trace_events and diagnostic reports"
sidebar_label: "08 · Trace events and reports"
sidebar_position: 8
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**These are Node's built-in black boxes for hard problems — V8/node trace categories when you need low-level timing, and diagnostic reports when a process is dying.**

You do not run them on every pod all day. You flip them on when something is already
on fire or when you are chasing a heisenbug.

## Diagnostic reports

A **report** is a structured JSON dump: stacks, handles, versions, resource usage —
produced on demand or on fatal conditions.

```bash
node --report-on-fatalerror app.js
node --report-on-signal app.js
```

```js
import process from 'node:process';

const path = process.report.writeReport();
// path to the JSON file written on disk
```

Useful when:

- The process abort leaves nothing useful on stdout.
- You need **handles and libuv state** that logs never captured.
- You are comparing two dumps before/after a suspected leak growth
  (page 17).

**Trade-off:** reports are large, may contain sensitive environment data, and writing
them is not free.

## trace_events / CLI trace categories

```bash
node --trace-event-categories v8,node,node.async_hooks app.js
```

```js
import trace_events from 'node:trace_events';

const tracing = trace_events.createTracing({categories: ['node.perf']});
tracing.enable();
// critical section
tracing.disable();
```

Prefer scoping tracing to a critical section over leaving global tracing on in production.

## When this is the wrong tool

| Problem | Better tool |
|---|---|
| Request latency across services | OpenTelemetry ([page 05](./05-opentelemetry.md)) |
| Exception regressions | Error tracker ([page 06](./06-error-tracking.md)) |
| Everyday CPU hotspot | `--cpu-prof` / clinic / flamegraphs (pages 19–22) |
| Event-loop delay under load | `monitorEventLoopDelay` (page 09) |

## Operational checklist

1. Know the flags before the incident (`--report-on-fatalerror`, report directory).
2. Ensure disk is writable and monitored.
3. Scrub or restrict access to report files (they can include env vars).
4. Disable heavy tracing when the investigation ends.

## Gotchas

**Symptom:** Fatal crash still produces no report file
**Cause:** Flag not set, or report directory not writable in the container
**Fix:** Pass `--report-on-fatalerror` and `--report-directory`; verify volume permissions

**Symptom:** Report contains secrets from `process.env`
**Cause:** Env dumped into the report by design
**Fix:** Limit who can read report artifacts

**Symptom:** Production latency collapses after enabling trace categories
**Cause:** Trace overhead left on under full traffic
**Fix:** Scope tracing to short windows; prefer sampling profilers

**Symptom:** Cannot open the trace file in the viewer
**Cause:** Incomplete flush on hard kill
**Fix:** Graceful disable/flush when using programmatic tracing

## Interview questions

**★ What is a Node diagnostic report for?**
A JSON snapshot of process state useful after fatals or on demand — stacks, versions,
handles — when logs are not enough.

**When would you enable `--report-on-fatalerror` in production?**
When you need crash artifacts for intermittent fatals and have secure storage for the
output.

**How do `trace_events` differ from OpenTelemetry traces?**
Trace events are low-level runtime categories for Node/V8 internals. OTel traces are
product/request distributed tracing.

**Why is this tier "When Needed"?**
Most fullstack work is served by logs, metrics, OTel, and profilers. These flags matter
for deep runtime incidents, not everyday feature delivery.

---

← Prev: [Diagnostics Channel](./07-diagnostics-channel.md) · Next → [Event loop lag](./09-event-loop-lag.md)
