---
title: "Structured logging — JSON, levels, and why console.log does not scale"
sidebar_label: "01 · Structured logging"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**A production log line is a searchable record, not a sentence you print to a terminal.**

`console.log('order failed', orderId, err)` is fine while you are alone on a laptop.
At three replicas and a log shipper it becomes unparseable noise that you cannot filter,
aggregate, or alert on without brittle regex.

## What breaks with free-form logs

```js
console.log('User', userId, 'checked out cart', cartId, 'total=', total);
console.error('Payment failed for', orderId, err);
```

Three problems show up the first time you open the aggregator:

1. **No stable fields.** `userId` is sometimes position 2, sometimes buried in a string.
2. **Levels are optional.** `console.log` and `console.error` are not a level system you
   can turn down in production without editing code.
3. **Multiline stack traces** split across log lines and lose their association with the
   request that produced them.

Structured logging fixes the shape first. Every line is one JSON object with a small
set of agreed keys.

```js
process.stdout.write(JSON.stringify({
  level: 'error',
  time: Date.now(),
  msg: 'payment failed',
  orderId,
  err: {type: err.name, message: err.message, stack: err.stack},
}) + '\n');
```

You filter on `orderId`, alert on `level=error` rate, and never write a parser that
guesses column positions again.

## Levels are a dial, not decoration

| Level | When |
|---|---|
| `fatal` / `error` | Something failed that needs a human or a retry path |
| `warn` | Recoverable surprise — degraded path, retry succeeded, config fallback |
| `info` | Business-significant events you want in steady state |
| `debug` | Detail for the request you are currently investigating |
| `trace` | High-volume internals — almost never on in production |

**Default production to `info`.** Turning on `debug` fleet-wide is how you fill a disk
and blow a logging bill overnight.

## Why not console.log in production

`console` is synchronous on some destinations. When stdout is a pipe (Docker, systemd,
almost every orchestrator), a slow consumer can **block the event loop** while your
process waits for the pipe buffer to drain. Under a traffic spike that is exactly when
you need the loop free.

| Approach | Structure | Backpressure | Levels |
|---|---|---|---|
| `console.log` strings | None | Can block the loop | Manual |
| Manual JSON + `stdout.write` | Yours to keep consistent | Still easy to block | Manual |
| Async logger (`pino`, etc.) | Built-in | Buffered, non-blocking path | Built-in |

Use the standard library for scripts and CLIs. Use a real logger for long-running servers.

## The minimum schema

| Key | Purpose |
|---|---|
| `time` | Epoch ms or ISO — pick one fleet-wide |
| `level` | String or numeric, consistent |
| `msg` | Short human summary |
| `service` / `version` | Which binary produced the line |
| `reqId` / `traceId` | Correlation ([page 03](./03-correlation-ids.md)) |
| domain ids | `orderId`, `userId` — never only buried in `msg` |

**Do not log passwords, tokens, or full card numbers** — that is
[page 04](./04-what-to-log.md).

## Where this stops

Structured logs answer **what happened, in which request, on which instance**. They do
not replace traces for multi-service latency, metrics for rates and percentiles, or
error trackers for stack clustering.

## Gotchas

**Symptom:** Log search cannot find an order you know failed
**Cause:** The id only appeared inside a free-form string, not a dedicated field
**Fix:** Put domain ids on the top-level object every time — `orderId`, not only `msg`

**Symptom:** Disk or logging bill explodes overnight
**Cause:** `debug` or `trace` left on in production, or logging full request bodies
**Fix:** Default `info`; sample or gate debug behind a flag; never log raw bodies

**Symptom:** Latency spikes when traffic rises, health checks slow with no CPU work
**Cause:** Synchronous writes to a clogged stdout pipe
**Fix:** Async logger with a destination that handles backpressure

**Symptom:** Stack traces appear as separate uncorrelated lines
**Cause:** Multiline `console.error(err)` without structured `err` serialization
**Fix:** Serialize `err` as one object field on a single JSON line

**Symptom:** You cannot turn logs down without a redeploy
**Cause:** Levels are hard-coded `console.log` calls, not a runtime level
**Fix:** One logger instance with a configurable level from env at boot

**Symptom:** Two services use `timestamp` vs `time` vs `@timestamp`
**Cause:** No shared schema
**Fix:** One field name fleet-wide; map at the shipper if a vendor demands another key

## Interview questions

**★ Why is `console.log` a poor default for a production Node server?**
It produces unstructured text that is hard to query, has no real level control, and can
block the event loop when stdout is a pipe under backpressure. Production needs one JSON
object per event and a non-blocking write path.

**★ What does "structured logging" actually require?**
Stable field names, one event per line, machine-parseable encoding (almost always JSON),
and consistent levels. The library is optional; the schema is not.

**Why put `orderId` as its own field instead of embedding it in the message string?**
Aggregators index fields. You filter, count, and alert on fields. A string forces
regex and breaks the moment the sentence changes.

**What level should production run at by default, and why not `debug`?**
`info` (or `warn` for very quiet services). `debug` multiplies volume, cost, and noise
so that the lines you need drown in the ones you do not.

**How do logs relate to traces and metrics?**
Logs are discrete events with context. Metrics are aggregates over time. Traces connect
work across services for one request. You need all three; none replaces the others.

---

Phase index: Observability and performance · Next → [pino in practice](./02-pino-in-practice.md)
