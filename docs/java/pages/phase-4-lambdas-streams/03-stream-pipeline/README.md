---
title: "The stream pipeline"
sidebar_label: "03 · The stream pipeline"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for the
> `java.util.stream` package (package summary: "Stream operations and
> pipelines"), the `Stream`, `BaseStream` and `Spliterator` Javadoc, and
> the `java.util.stream` package's "Ordering" and "Associativity" sections.

**A stream pipeline is a *description* of a computation, not the
computation itself. It has exactly three parts — one source, zero or more
intermediate operations, one terminal operation — and the single fact that
explains almost everything surprising about it is that *nothing happens
until the terminal operation runs*. The `map` you wrote doesn't map. The
`peek` you added for debugging may never print. The `filter` runs once per
element *pulled*, not once per element in the source — and a
short-circuiting terminal may pull only three. This topic is that
execution model, made explicit.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Lazy until terminal](01-lazy-until-terminal.md)** | The three stages, why intermediates are lazy, the print-debugging surprise, short-circuiting (`findFirst`, `anyMatch`, `limit`) and per-element flow |
| 2 | **[The machinery](02-the-machinery.md)** | `Spliterator`, how ops chain, encounter order and `unordered()`, sized-stream optimizations, why a stream is single-use (`IllegalStateException`) |
| 3 | **[Pipelines in practice](03-pipelines-in-practice.md)** | Choosing a source (`stream()`, `Stream.of`, `Files.lines`, `iterate`/`generate`), resource streams and try-with-resources, exceptions inside pipelines, debugging without print |

## Why this is a Master topic

Every stream page after this one leans on the execution model:

- **Core ops and collectors** ([04](../04-map-filter-flatmap/README.md),
  **05** *(not written yet)*) make no sense as "loops that run in order" —
  they are stages elements flow through one at a time.
- **Parallel streams** (**09** *(not written yet)*) are this same model
  with the source split across threads — the reasons `.parallel()`
  disappoints are visible already in the sequential machinery.
- **Stateful-lambda bugs** ([10](../10-stateful-lambdas.md)) are all,
  at bottom, code that assumed an execution order the pipeline never
  promised.

## Phase gate contribution

The gate's "group orders by customer, top N by total" pipeline requires
predicting *what runs, when, and how many times* — which is precisely what
chunk 1 trains, and what chunk 3's debugging patterns let you verify
without littering `peek` calls that lie.

---

← Prev: [Method references](../02-method-references.md) · Next → [Core operations](../04-map-filter-flatmap/README.md)
