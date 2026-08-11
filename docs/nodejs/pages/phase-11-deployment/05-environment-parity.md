---
title: "Environment parity — dev, staging, production"
sidebar_label: "05 · Environment parity"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. Practice rules for fullstack Node; runtime **Node 24** Active LTS
> in all environments unless a matrix test says otherwise.

**The fewer differences between dev, staging, and production, the fewer "works on my
machine" outages. Parity is about runtime version, config shape, and dependency graph —
not about copying production secrets onto laptops.**

## What must match

| Dimension | Parity rule |
|---|---|
| **Node major** | Same Active LTS line (24.x) in CI, staging, prod |
| **Lockfile** | One lockfile; install with immutability in CI/prod |
| **Config shape** | Same variable *names*; different *values* |
| **Backing services** | Staging has real Postgres/Redis (or close), not only mocks |
| **Build artifact** | Same image/tag promoted when possible |

```js
// same code path everywhere
import {config} from './config.mjs';
// config.databaseUrl differs per env; schema does not
```

## What must not match

| Dimension | Why it differs |
|---|---|
| Secrets | Prod credentials never on developer machines |
| Scale | Prod replica count and pool sizes |
| Log level | `debug` in dev, `info` in prod |
| Third-party sandboxes | Stripe test keys vs live |

## Honest staging

Staging that uses SQLite while prod uses Postgres is a **lie** for anything that
touches SQL dialects, transactions, or concurrency. Prefer:

- Compose/Podman with the same engine versions you run in prod  
- Or a shared staging cluster with isolated namespaces  

Phase 6 measured real `pg` and Mongo behaviour for this reason — mocks do not catch
isolation or lock bugs.

## CI as an environment

CI is a third (or fourth) environment. Failures that only happen in CI are still
production risks if CI matches prod closer than your laptop does.

| CI practice | Why |
|---|---|
| `yarn install --immutable` | Drift detection |
| Test on Node 24 (and maybe 22 until EOL) | Version matrix ([page 08](./08-cicd.md)) |
| Service containers for DB | Real drivers |

## Gotchas

**Symptom:** Bug only in production
**Cause:** Different Node major, missing env, or real network latency never tested
**Fix:** Align Node; staging with real deps; load-shaped tests for hot paths

**Symptom:** Staging always green, prod config wrong
**Cause:** Staging hardcodes defaults that prod forgets to set
**Fix:** Same `required()` config module; deploy fails on missing env

**Symptom:** Developers use `latest` image tag
**Cause:** Floating tags drift between machines
**Fix:** Pin digests or immutable version tags

## Interview questions

**★ What is environment parity?**
Keeping runtime, dependencies, and config *shape* aligned across dev/staging/prod so
behaviour differences are intentional values, not accidental stacks.

**What should still differ between staging and production?**
Secrets, scale, and any third-party live side effects — not the Node version or DB
engine.

**Why is "mock the database in staging" risky?**
You will not see SQL, transaction, or pool behaviour that only the real engine shows.

**How does the lockfile support parity?**
Everyone installs the same tree; CI rejects drift with immutable installs.

**Where does Node 24 fit?**
Run the same Active LTS everywhere you care about production behaviour.

---

← Prev: [PID 1 and signals](./04-pid1-and-signals.md) · Next → [Reverse proxy](./06-reverse-proxy.md)
