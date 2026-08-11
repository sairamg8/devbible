---
title: "Correlation and request IDs with AsyncLocalStorage"
sidebar_label: "03 · Correlation IDs"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**If every log line from one request does not share an id, you do not have a request — you have a pile of lines and a prayer.**

Correlation is the discipline of generating (or accepting) one id at the edge and
threading it through logs, outbound calls, jobs, and errors until the work is done.

The mechanism in modern Node is
[`AsyncLocalStorage`](../phase-2-async/20-asynclocalstorage.md). This page is the
production use: request ids, not the ALS API tour.

## The failure mode

Without an id, multi-replica logs after a deploy are "sort by timestamp and guess."
With a request id on every line you filter once and see the whole story.

## Accept incoming ids, mint when missing

```js
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import http from 'node:http';

const als = new AsyncLocalStorage();

export function getRequestId() {
  return als.getStore()?.reqId;
}

export function withRequest(reqId, fn) {
  return als.run({reqId}, fn);
}

const server = http.createServer((req, res) => {
  const reqId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', reqId);

  withRequest(reqId, () => {
    handle(req, res);
  });
});
```

Three rules:

**Trust a well-formed incoming `x-request-id` (or `traceparent`) from your own edge.**
Validate length and charset so a client cannot inject multi-megabyte garbage.

**Mint a UUID when the header is absent.** Local curls still get a coherent timeline.

**Echo the id on the response.** Support and clients can paste it back to you.

## Bind the logger automatically

```js
import pino from 'pino';
import {getRequestId} from './request-context.js';

const base = pino({level: process.env.LOG_LEVEL ?? 'info'});

export function log() {
  const reqId = getRequestId();
  return reqId ? base.child({reqId}) : base;
}

log().info({orderId}, 'checkout started');
log().error({err}, 'payment failed');
```

Call sites stay clean. The id cannot be forgotten on a new helper six months later.

## Propagate outbound

```js
async function chargeCard(orderId, amount) {
  const reqId = getRequestId();
  const res = await fetch(process.env.PAYMENTS_URL + '/charge', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(reqId ? {'x-request-id': reqId} : {}),
    },
    body: JSON.stringify({orderId, amount}),
  });
}
```

For OpenTelemetry, prefer W3C `traceparent` ([page 05](./05-opentelemetry.md)); for
plain logs, `x-request-id` is still the workhorse.

## Jobs and queues

When you enqueue work, **persist the id on the job payload**:

```js
await queue.add('send-receipt', {
  orderId,
  reqId: getRequestId(),
});

// worker
worker.process(async (job) => {
  await withRequest(job.data.reqId ?? job.id, async () => {
    log().info({orderId: job.data.orderId}, 'sending receipt');
  });
});
```

Otherwise background failures are orphaned from the HTTP request that caused them.

## Where ALS does not save you

- **Worker threads and child processes** do not inherit ALS — pass the id explicitly.
- **Timers** scheduled outside `als.run` will not see the store.
- ALS is not a security boundary and not a substitute for auth checks.

## Gotchas

**Symptom:** Some log lines for a request lack `reqId`
**Cause:** Code running outside `als.run`, or a second logger that does not read the store
**Fix:** Enter ALS at the earliest edge; route all logging through one helper that binds

**Symptom:** Client-supplied `x-request-id` is huge or contains newlines
**Cause:** Accepting the header with no validation
**Fix:** Allowlist length and characters; otherwise mint a new id

**Symptom:** Outbound service logs cannot be joined to inbound
**Cause:** Id never forwarded on HTTP headers
**Fix:** Inject `x-request-id` or W3C trace context on every egress call

**Symptom:** Queue job logs have no link to the HTTP request
**Cause:** Job payload omitted `reqId`
**Fix:** Copy id at enqueue; re-enter ALS in the worker

**Symptom:** `getRequestId()` is undefined inside a worker thread
**Cause:** ALS does not cross thread boundaries
**Fix:** Pass `reqId` in `workerData` or the message

**Symptom:** Different ids for one logical request across services
**Cause:** Each service mints instead of accepting the edge header
**Fix:** Only mint when missing; prefer gateway-generated ids

## Interview questions

**★ Why put a request id on every log line?**
So you can filter one request timeline out of a multi-replica firehose. Without it,
post-incident reconstruction is timestamps and guesswork.

**★ How does AsyncLocalStorage help compared to passing `reqId` through every function?**
It preserves the id across `await` points without threading an extra argument through
every helper. You still enter the context once at the edge.

**Should you always trust `x-request-id` from the public internet?**
Only after validation. Many systems overwrite at the trusted gateway and ignore
client values beyond that.

**How do correlation ids relate to OpenTelemetry trace ids?**
Trace ids are the standardized inter-service form with span hierarchy. A simple
`reqId` is the log-centric form. The requirement is one join key across systems.

**What happens to ALS context in a BullMQ worker?**
Nothing automatic. Store the id on the job and establish context when the job starts.

---

← Prev: [pino in practice](./02-pino-in-practice.md) · Next → [What to log](./04-what-to-log.md)
