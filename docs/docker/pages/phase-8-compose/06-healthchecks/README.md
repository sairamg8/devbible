---
title: "Healthchecks in Compose"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the `healthcheck` attribute](https://docs.docker.com/reference/compose-file/services/),
> [the Dockerfile `HEALTHCHECK` reference](https://docs.docker.com/reference/dockerfile/#healthcheck)
> and the [official `postgres` image documentation](https://hub.docker.com/_/postgres).
> **No sandbox** — no console output on this page.

**A healthcheck is a claim your stack believes. `depends_on:
condition: service_healthy` acts on it, so a check that lies is worse than no check
at all** — it converts an obvious boot failure into an intermittent one.

Phase 3 covered `HEALTHCHECK` as a Dockerfile instruction and made the case that
**Docker only reports; something else must act**
([Phase 3, page 11](../../phase-3-dockerfile/11-healthcheck.md)). Compose is the
first place in this track where something *does* act. That raises the stakes on
getting the check right.

| Chunk | What it covers |
|---|---|
| **[01 · The keys, and why the defaults are wrong](01-the-keys.md)** | `test` and its four forms, `interval`/`timeout`/`retries`, the `start_period` + `start_interval` pair, `disable`, and how a Compose healthcheck interacts with one baked into the image |
| **[02 · Checks that are actually true](02-checks-that-are-true.md)** | Postgres (and the `pg_isready` trap), MongoDB, Redis and a Node API — plus what a check must *not* test |

## The two rules everything else follows from

1. **Check your own readiness, not your dependencies'.** If the API's healthcheck
   queries the database, a database blip marks every API replica unhealthy at once
   — you have coupled the failure instead of containing it.
2. **A check must be able to fail.** `test: ["CMD", "true"]` and a check that only
   confirms the process exists both pass while the service is useless.

## Where this connects

- **[05 · depends_on](../05-depends-on.md)** is the consumer. These two pages are
  one mechanism.
- **[Phase 3, page 11 — HEALTHCHECK](../../phase-3-dockerfile/11-healthcheck.md)**
  is the instruction and the defaults.
- **[03 · up and down](../03-up-and-down/README.md)** — `up --wait` waits for
  "running|healthy", so it depends on these checks too.
- **Phase 10 · Healthchecks in production** *(not written yet)* is where a check
  becomes a restart or an eviction rather than a colour in `ps`.

---

← Prev: [depends_on](../05-depends-on.md) · Index: [Phase 8](../README.md) · Start → [The keys](01-the-keys.md)
