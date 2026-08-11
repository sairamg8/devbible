---
title: "pino in practice — child loggers, redaction, serializers"
sidebar_label: "02 · pino in practice"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`pino` is a fast JSON logger with the knobs production actually uses: child bindings, redaction paths, and serializers.**

[Page 01](./01-structured-logging.md) is why structure matters. This page is the library
shape most Node services end up on.

## Baseline setup

```js
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'orders-api',
    version: process.env.npm_package_version,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'body.password',
      'body.token',
    ],
    remove: true,
  },
});
```

Three load-bearing choices:

**`level` from env.** Change verbosity without a code change. Default `info` in prod.

**`base` fields on every line.** Service name and version make multi-service search
possible when every process writes to the same stream.

**`redact` at the logger, not in every call site.** People forget. Paths that match are
stripped before the line is written — see also [page 04](./04-what-to-log.md).

## Child loggers bind context once

```js
function handleOrder(req, res) {
  const log = logger.child({
    reqId: req.id,
    orderId: req.params.orderId,
  });

  log.info('checkout started');
  log.error({err}, 'payment failed');
}
```

Every subsequent line from `log` carries `reqId` and `orderId` without repeating them.
That is the practical half of correlation before you wire
[AsyncLocalStorage](./03-correlation-ids.md) for automatic binding.

Children are cheap. Prefer **one child per request** (or per job) over threading optional
fields through every helper signature.

## Serializers control hot objects

```js
import pino from 'pino';

const logger = pino({
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

logger.info({req, res}, 'request completed');
logger.error({err}, 'handler failed');
```

`pino.stdSerializers.err` pulls `type`, `message`, and `stack` into a plain object.
Without it, logging a raw `Error` often serializes poorly in JSON.

Custom serializers exist for a reason: **never dump `req` whole**. The standard `req`
serializer already limits fields; still combine with `redact` for headers.

## Logging errors correctly

```js
// Right — err key triggers the serializer
log.error({err}, 'payment failed');

// Wrong — stringifies poorly or loses the stack
log.error('payment failed ' + err);
log.error(err);
```

The first argument is the merge object; the second is `msg`. Putting the error on `err`
is what makes stack traces survive JSON.

## Transport and pretty-printing

```js
const logger = pino({
  transport: process.env.NODE_ENV === 'development'
    ? {target: 'pino-pretty', options: {colorize: true}}
    : undefined,
});
```

**Do not pretty-print in production.** Aggregators parse JSON. Colourized multi-line
output is for humans on a laptop.

## When not to use pino

- **One-off scripts and CLIs** where human-readable stderr is the product.
- **Libraries** that should not dictate a logger — accept an optional `log` with a
  compatible surface, or stay silent.
- **Extremely constrained edge runtimes** that ban dependencies you need — check the
  target before assuming pino is available.

## Gotchas

**Symptom:** Logged errors show up as empty objects
**Cause:** Passing an `Error` without the `err` serializer or wrong merge key
**Fix:** Use `log.error` with an `err` field and `pino.stdSerializers.err`

**Symptom:** Authorization headers appear in the log store
**Cause:** Logging `req` without `redact` paths
**Fix:** Redact `req.headers.authorization`, `cookie`, and body secret fields globally

**Symptom:** Debug code left with `pino-pretty` in production
**Cause:** Transport enabled for all environments
**Fix:** Pretty only in development; production stdout is one JSON object per line

**Symptom:** Helper functions have no request context on their log lines
**Cause:** Using the root logger instead of a request child
**Fix:** Pass `log` in or bind context via ALS ([page 03](./03-correlation-ids.md))

**Symptom:** Log volume still high after setting level to `info`
**Cause:** Child loggers created with a lower level
**Fix:** Prefer pino methods so disabled levels skip work; audit child levels

**Symptom:** Tests flood stdout
**Cause:** Real logger writing during unit tests
**Fix:** Inject a silent logger (`level: 'silent'`) or a discarding destination

## Interview questions

**★ What is a child logger for?**
To bind stable fields (`reqId`, `userId`, `orderId`) once so every subsequent line
carries them without repetition. One child per request is the usual shape.

**★ How does pino avoid logging secrets you accidentally pass in?**
`redact.paths` strips matching keys before write. It is defense in depth, not a
substitute for not putting secrets on the object.

**Why pass the error under an `err` field instead of `log.error(err)`?**
Serializers and the documented API expect the error on the merge object under `err`.
That preserves message and stack in JSON.

**Should production use `pino-pretty`?**
No. Pretty output is for local humans. Production needs single-line JSON for shippers
and aggregators.

**What belongs in `base` vs on a child?**
`base`: process-lifetime facts (service name, version). Child: per-request or per-job
facts. Do not put request ids in `base`.

---

← Prev: [Structured logging](./01-structured-logging.md) · Next → [Correlation IDs](./03-correlation-ids.md)
