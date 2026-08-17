---
title: "Phase 6 — TypeScript across the stack"
sidebar_label: "Overview"
sidebar_position: 0
---

> The storefront in one language, end to end. These chapters **apply**
> TypeScript to the app already built in phases 0–5; the language itself —
> narrowing, generics, `satisfies`, declaration merging — is the
> [TypeScript section](../../../typescript/README.md), and no chapter here
> re-teaches it.

**Prerequisites:** TypeScript phases 1 (the type vocabulary), 2 (narrowing) and
3 (generics); the [Phase 3 API contract](../phase-3-express-api/README.md) and
the [Phase 1 schema](../phase-1-database/01-the-schema/README.md).

| # | Chapter | Tier | In one line |
|---|---|---|---|
| 01 | **[The shared types package](01-the-shared-types-package/README.md)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | One package both sides import — and the boundary that stops server-only types leaking to the browser |
| 02 | **zod schemas as the source of truth** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 03 | **Typing raw `pg` results** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 04 | **Discriminated unions: the order state machine** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 05 | **Typed Express handlers and middleware** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 06 | **Typing the custom hooks** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 07 | **The typed API client** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 08 | **Utility types in app code** | <span className="db-tier t-know">Know</span> | *(not written yet)* |

## Phase gate

The gate from the syllabus: **one shape change, made once.** Rename a column or
add an order status, and the compiler walks you to every place — the query
module, the handler, the client, the component — with no runtime discovery and
no `any` bridging the gap.

## Where this connects

Phase 1's schema decides what the types describe; Phase 3's validation boundary
is where untrusted input becomes a typed value; Phase 5's helpers get their
generics here. The direction is always the same: **types follow the data, and
the data starts at the database.**
