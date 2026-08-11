---
title: "12-factor config — env-driven, validated at boot"
sidebar_label: "01 · 12-factor config"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — `process.env` and fail-fast boot validation.

**Config is injected by the environment, parsed once at boot, and refused loudly when
required values are missing. Silent defaults for secrets and connection strings are how
you connect to the wrong database in production.**

The 12-factor idea is older than Node. In this stack it means: no production secrets in
the repo, no "it worked because my laptop had a `.env`", and one object the rest of the
app reads after validation.

## What lives in env

| Kind | Examples | Rule |
|---|---|---|
| Secrets | `DATABASE_URL`, API keys | Required; never default in code |
| Deployment shape | `PORT`, `NODE_ENV`, public base URL | Typed; `PORT` is a number |
| Feature flags | `ENABLE_BILLING_V2` | Explicit booleans, not string truthiness traps |
| Tuning | pool size, log level | Defaults OK if safe |

```js
// config.mjs — load once, export a frozen object
function required(name) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    throw new Error(`missing required env: ${name}`);
  }
  return v;
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`);
  return n;
}

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: int('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  logLevel: process.env.LOG_LEVEL ?? 'info',
});
```

Call this **before** opening sockets. A throw here is a failed deploy, not a half-up
process accepting traffic ([page 02](./02-boot-sequence.md)).

## NODE_ENV is not a feature flag

`NODE_ENV=production` changes dependency behaviour (React, Express views, some loggers).
Do not overload it for "which customer tier". Use explicit flags.

## Files vs platform env

| Source | Use |
|---|---|
| Platform secrets / K8s env | Production and staging |
| `.env` via `--env-file` (Node 24) | Local only — never the only copy of prod secrets |
| Checked-in `config/default.json` | Non-secret defaults only |

Node 24 supports `--env-file` natively ([Phase 0](../phase-0-runtime-model/08-running-node.md)).
Prefer that over a runtime dotenv dependency when you control the start command.

## Gotchas

**Symptom:** Production talks to localhost Postgres
**Cause:** Missing `DATABASE_URL` defaulted in code
**Fix:** `required()` with no default for connection strings

**Symptom:** `ENABLE_X=false` still true
**Cause:** `if (process.env.ENABLE_X)` — non-empty string is truthy
**Fix:** Parse booleans explicitly (`=== 'true'` or a small allow-list)

**Symptom:** Config object mutated mid-request
**Cause:** Exported a plain mutable object
**Fix:** `Object.freeze` (shallow) or a validated schema library

**Symptom:** Secret appears in logs and diagnostic reports
**Cause:** Logging `process.env` or report dumps
**Fix:** Never log raw env; scrub reports ([Phase 10](../phase-10-observability/08-trace-events-and-reports.md))

**Symptom:** Works in CI, fails on the laptop
**Cause:** CI injects vars your local shell lacks
**Fix:** Document required env; fail at boot with the missing name

## Interview questions

**★ What does 12-factor config mean for a Node API?**
Store config in the environment, validate at process start, fail fast on missing
required values, keep secrets out of the repo.

**★ Why is a default `DATABASE_URL` dangerous?**
A misconfigured deploy silently uses the default — often localhost or a shared dev DB.

**How do you handle booleans in env vars?**
Env values are strings. Compare to `'true'`/`'false'` or parse with an explicit schema.

**When is `.env` acceptable?**
Local development only, never as the production secret store.

**Where does validation belong relative to `listen`?**
Before any dependency connect and before listening — boot sequence page 02.

---

Phase index: [Deployment and operations](./README.md) · Next → [Boot sequence](./02-boot-sequence.md)
