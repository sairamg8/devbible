---
title: "map, filter, flatMap and friends — the core ops"
sidebar_label: "04 · map, filter, flatMap"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.stream.Stream` (per-method docs for `map`, `filter`, `flatMap`,
> `mapMulti`, `sorted`, `distinct`, `limit`, `skip`, `peek`) and the
> `java.util.stream` package documentation (stream operations and pipelines,
> statefulness, short-circuiting).

**Six intermediate operations carry ninety percent of every pipeline you will
read or write. Three of them transform — `map` (one in, one out), `filter`
(one in, zero-or-one out), `flatMap` (one in, any number out) — and three of
them reshape the whole stream: `sorted` and `distinct` (stateful — they must
see everything or remember everything before emitting), and `limit`/`skip`
(the bounding pair). The odd one out is `peek`, which transforms nothing and
exists for debugging — and under short-circuiting may not run at all. Knowing
which category an op belongs to is what lets you predict a pipeline's cost
and its behaviour without running it.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The transforming trio](01-the-transforming-trio.md)** | `map` and `filter` semantics, `flatMap` in depth — orders → line items, `Optional.stream`, flattening nested collections — and `mapMulti`, the low-allocation alternative |
| 2 | **[Stateful, bounding and peek](02-stateful-bounding-peek.md)** | Why `sorted` buffers everything, `distinct` and the `equals` contract, `limit`/`skip` and encounter order, `peek`'s honest job description — and when it silently doesn't run |

## Why this is a Master topic

`flatMap` is the single most-asked stream question in interviews and the op
juniors avoid by nesting loops around a stream — the tell of someone who
never internalized it. `sorted` and `distinct` are where "streams are lazy"
stops being true (they're the ops that can turn a cheap-looking pipeline into
a full materialization), and `peek`-that-never-ran is a classic
head-scratcher in production debugging. These six are daily vocabulary.

## Phase gate contribution

The gate pipeline — "group orders by customer, keep the three most recent
each" — is `sorted` + `limit` thinking applied per group; chunk 2's cost
model is what tells you where that work actually happens.

---

[← Prev: The stream pipeline](../03-stream-pipeline/README.md) · Index: [Phase 4 — Lambdas, streams and Optional](../README.md) · [Next → Collectors](../05-collectors/README.md)
