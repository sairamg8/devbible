---
title: "Diagnostics Channel — built-in pub/sub for instrumentation"
sidebar_label: "07 · Diagnostics Channel"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`node:diagnostics_channel` is a zero-dependency pub/sub bus inside the process — libraries publish named events; your observability glue subscribes without monkey-patching private APIs.**

You reach for it when you need hooks into `undici`, `http`, or your own modules and
do not want a full OpenTelemetry dependency at that layer.

## The shape

```js
import diagnostics_channel from 'node:diagnostics_channel';

const channel = diagnostics_channel.channel('myservice:order:checkout');

export function checkout(orderId) {
  const start = process.hrtime.bigint();
  if (channel.hasSubscribers) {
    channel.publish({phase: 'start', orderId});
  }
  try {
    // work
    if (channel.hasSubscribers) {
      channel.publish({
        phase: 'end',
        orderId,
        ok: true,
        ns: Number(process.hrtime.bigint() - start),
      });
    }
  } catch (err) {
    if (channel.hasSubscribers) {
      channel.publish({phase: 'error', orderId, err});
    }
    throw err;
  }
}

const ch = diagnostics_channel.channel('myservice:order:checkout');
ch.subscribe((message) => {
  if (message.phase === 'end') {
    // record histogram, log sample, etc.
  }
});
```

**`hasSubscribers` is the performance gate.** Keep payloads small on hot paths.

## Naming channels

Use a stable, namespaced string:

```text
undici:request:create
myservice:db:query
myservice:order:checkout
```

Prefer **subscribing to documented channels** over patching `http.request`.

## TracingChannel for request-shaped work

```js
import diagnostics_channel from 'node:diagnostics_channel';

const tc = diagnostics_channel.tracingChannel('myservice:charge');

export async function charge(orderId) {
  return tc.tracePromise(() => doCharge(orderId), {orderId});
}
```

## When to use this vs OpenTelemetry

| Need | Prefer |
|---|---|
| Portable traces/metrics to a backend | OpenTelemetry ([page 05](./05-opentelemetry.md)) |
| Tiny hook inside a library with no OTel peer dep | Diagnostics Channel |
| Subscribe to Node/undici internals | Diagnostics Channel |
| Full product APM UI | OTel export or vendor agent |

Many OTel instrumentations **are** diagnostics_channel subscribers under the hood.

## Gotchas

**Symptom:** Subscriber never runs
**Cause:** Subscribed after the first publish, or wrong channel name string
**Fix:** Register subscribers at process boot before traffic; copy names exactly

**Symptom:** Hot path allocations spike after adding publish calls
**Cause:** Building large message objects on every request
**Fix:** Keep messages tiny; sample in the subscriber

**Symptom:** Library users see side effects from your channel
**Cause:** Publishing mutable objects that subscribers mutate
**Fix:** Treat messages as immutable; document payload shape

**Symptom:** Memory leak after dynamic subscribe/unsubscribe in tests
**Cause:** Forgetting `unsubscribe`
**Fix:** Always pair subscribe with unsubscribe in test teardown

**Symptom:** Expected undici events missing
**Cause:** Different undici version or channel renamed between Node lines
**Fix:** Check Node docs for your exact version before asserting names

## Interview questions

**★ What is `diagnostics_channel` for?**
In-process pub/sub for instrumentation so publishers stay decoupled from subscribers.

**Why check `hasSubscribers` before building a heavy message?**
So the hot path stays cheap when nobody is listening.

**How does this relate to OpenTelemetry?**
OTel is the end-to-end observability standard and export pipeline. Diagnostics Channel
is a Node primitive often used underneath instrumentations.

**When would you publish your own channel?**
When you own a reusable module and want consumers to hook business events without you
depending on their metrics stack.

---

← Prev: [Error tracking](./06-error-tracking.md) · Next → [Trace events and reports](./08-trace-events-and-reports.md)
