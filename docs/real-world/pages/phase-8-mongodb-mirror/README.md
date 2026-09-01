---
title: "Phase 8 — The MongoDB mirror"
sidebar_label: "Overview"
sidebar_position: 0
---

> The same storefront, one layer rewritten. [Phase 1](../phase-1-database/README.md)
> built this app's data layer on PostgreSQL with raw SQL; this phase rebuilds
> **that layer and only that layer** on MongoDB. MongoDB itself — the document
> model, BSON, query operators, `mongosh` — is the
> [MongoDB section](../../../mongodb/README.md), and no chapter here re-teaches
> it. These pages are the **decisions**: what this app's documents look like,
> what each choice costs against the Postgres original, and the complete code
> that ships.

**Prerequisites:** [Phase 0](../phase-0-the-app/01-the-storefront-spec.md) (the
spec and the eleven tables), all of [Phase 1](../phase-1-database/README.md)
(every chapter here names its counterpart), and
[Phase 3](../phase-3-express-api/README.md) — because the contract those routes
publish is the thing this phase must not break. From the concept side:
MongoDB phases 0–5, and
[Node — MongoDB from Node](../../../nodejs/pages/phase-6-data-access/05-mongodb-from-node.md).

| # | Chapter | Tier | In one line |
|---|---|---|---|
| 01 | **[Modeling the store as documents](01-modeling-the-store/README.md)** *(7 chunks)* | <span className="db-tier t-understand">Understand</span> | Eleven tables become eight collections — and the three that disappear are the whole argument |
| 02 | **[The catalog on MongoDB](02-the-catalog/README.md)** *(4 chunks)* | <span className="db-tier t-understand">Understand</span> | Same filters, same sorts, same opaque cursor — but keyset pagination has to be spelled out by hand |
| 03 | **Checkout with transactions** *(not written yet)* *(4 chunks)* | <span className="db-tier t-understand">Understand</span> | The stock decrement needs no transaction; the five-collection write does — and the callback may run twice |
| 04 | **The dashboard on the aggregation pipeline** *(not written yet)* *(3 chunks)* | <span className="db-tier t-understand">Understand</span> | `generate_series` becomes `$densify`, `filter` becomes `$cond`, window functions become `$setWindowFields` |
| 05 | **Indexes for this app's queries** *(not written yet)* *(3 chunks)* | <span className="db-tier t-understand">Understand</span> | Every index derived from a query, ESR instead of leftmost-prefix, and what `explain()` actually reports |
| 06 | **Change streams where `LISTEN`/`NOTIFY` was** *(not written yet)* *(2 chunks)* | <span className="db-tier t-know">Know</span> | A resumable, majority-committed event feed — strictly more than `NOTIFY` gave, and therefore easier to misuse |

## The gate

**The [Phase 3](../phase-3-express-api/README.md) Express API passes its own
end-to-end flow — browse, filter, paginate, add to cart, check out, replay the
checkout, read the dashboard — against the Mongo data layer, with no route
change and no change to the published contract.** Every chapter is written
toward that sentence. Where a chapter would force a contract change, that
collision *is* the chapter's problem: chunk
[01·05](01-modeling-the-store/05-ids-and-the-api-contract.md) reckons with the
two places the swap genuinely presses on Phase 3, and shows both the change
and the alternative that avoids it.

## What this phase is *not*

It is not "MongoDB vs PostgreSQL". That argument has a home —
[MongoDB 0·05](../../../mongodb/pages/phase-0-how-mongodb-runs/05-mongodb-vs-postgresql.md) —
and it is an argument about systems. This phase is narrower and more useful:
**one application, already built, moved.** The interesting output is not a
winner, it is the list of things that got easier (session expiry, the order
history read, cart writes), the things that got harder (multi-collection
invariants, deep pagination on a computed sort, full-text search), and the
things that turned out to be the same problem wearing different syntax
(idempotency, index derivation, the outbox).

## The version spine

Every chapter states it: **MongoDB 8.0** (the current Major Release; **8.2** is
the minor this corpus targets), the Node.js driver **`mongodb` 7.5.0**, on
**Node 24 LTS** — matching
[the MongoDB section](../../../mongodb/README.md) and
[Node 6·05](../../../nodejs/pages/phase-6-data-access/05-mongodb-from-node.md).
Three chapters depend on **a replica set, not a standalone `mongod`**:
transactions (03), change streams (06), and retryable writes throughout. That
is a deployment requirement, not a preference, and chunk
**03·04** *(not written yet)*
states it precisely from the manual.

## Where this connects

Phase 1 is the counterpart every chapter reads first. Phase 2's
[data layer](../phase-2-node-services/02-the-data-layer.md) supplies the shape
the Mongo modules keep (one client at module scope, repository per entity,
domain objects out). Phase 3 supplies the contract. Phase 4 and beyond never
learn which database is underneath — which is the entire point of the exercise.
