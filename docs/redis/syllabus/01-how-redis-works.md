---
title: "Part 1 — How Redis works"
sidebar_label: "1 · How Redis works"
sidebar_position: 1
---

> Phases 0–2 · The execution model, the keyspace, and the CLI

Redis is easy to use badly. Every mistake in this bible's Redis track — a cache
that never expires, a `KEYS *` that stalls production, a lock that is not a lock —
traces back to not knowing what the server is actually doing with your command.

---

## Phase 0 — How Redis runs

The mental model. Skipping it is why people are surprised when one command
freezes every client.

| Topic | Tier |
|---|---|
| **What Redis is**: an in-memory data-structure server, not a "key-value cache" — the data types *are* the product | <span className="db-tier t-master">Master</span> |
| **Single-threaded command execution** — commands are atomic because only one runs at a time; I/O threads do not change this | <span className="db-tier t-master">Master</span> |
| **O(N) commands block everyone** — `KEYS`, `FLUSHALL`, big `LRANGE`, `SMEMBERS` on a large set; the operational consequence | <span className="db-tier t-master">Master</span> |
| The RESP protocol and round trips — why the network, not Redis, is usually the latency | <span className="db-tier t-understand">Understand</span> |
| **Redis is not durable by default** — what "in-memory" costs you, and what you may therefore store in it | <span className="db-tier t-master">Master</span> |
| Versions and the 8.x line — what Redis 8 absorbed (Search, JSON, time series, probabilistic types), and choosing a target | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain why `KEYS *` on a production instance is
an outage, and why `INCR` needs no lock.

---

## Phase 1 — Keys, expiry and the keyspace

The layer everything else sits on, and the source of most memory surprises.

| Topic | Tier |
|---|---|
| **Key naming as a schema** — `app:entity:id:field`, why the convention *is* your data model, and cardinality | <span className="db-tier t-master">Master</span> |
| **TTL and expiry** — `EXPIRE`, `SET … EX`, `PERSIST`, and what `TTL` returns for missing versus non-expiring keys | <span className="db-tier t-master">Master</span> |
| **How expiry actually happens** — lazy on access plus an active sampling cycle; why an expired key can still occupy memory | <span className="db-tier t-understand">Understand</span> |
| **`SCAN` instead of `KEYS`** — the cursor contract, guarantees it does and does not give, `MATCH` and `COUNT` | <span className="db-tier t-master">Master</span> |
| Key existence, deletion and `UNLINK` — why unlinking a huge key is not the same as deleting it | <span className="db-tier t-understand">Understand</span> |
| Keyspace notifications — what they are, why they are best-effort, and when not to build on them | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can iterate a million-key keyspace without blocking
the server, and say what happens to a key whose TTL passed while nobody read it.

---

## Phase 2 — `redis-cli`, mastered

The tool you will actually debug production with.

| Topic | Tier |
|---|---|
| Connecting, selecting databases, and why numbered databases are a trap in cluster mode | <span className="db-tier t-understand">Understand</span> |
| **`MONITOR`, `SLOWLOG`, `INFO`** — the three commands that answer "why is Redis slow?" | <span className="db-tier t-master">Master</span> |
| **`--bigkeys`, `--memkeys`, `--hotkeys`, `--scan`** — finding what is eating memory without a `KEYS` | <span className="db-tier t-understand">Understand</span> |
| `OBJECT ENCODING` and `MEMORY USAGE` — seeing the encoding a value actually got | <span className="db-tier t-understand">Understand</span> |
| `--latency`, `--stat`, and reading the numbers honestly | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** given a Redis instance you have never seen, you can name
its largest keys, its slowest commands and its memory ceiling in five minutes.

---

← Index: [Redis](../README.md) · Next → [Part 2 — Data types](02-data-types.md)
