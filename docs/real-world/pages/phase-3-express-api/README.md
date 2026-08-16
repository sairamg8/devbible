---
title: "Phase 3 — The Express API"
sidebar_label: "Overview"
sidebar_position: 0
---

> The storefront's HTTP surface: every endpoint the spec implies, assembled
> from Phase 1's queries and Phase 2's services. Concepts live in the
> [Express section](../../../expressjs/README.md) — especially
> [validation and authorization](../../../expressjs/pages/phase-8-validation-authz/README.md)
> and [the app factory](../../../expressjs/pages/phase-10-app-factory/README.md);
> these chapters are the endpoints themselves.

**Prerequisites:** Express phases 0–8; Phase 1 and Phase 2 of this track.

| # | Chapter | Tier | In one line |
|---|---|---|---|
| 01 | **[Project structure](01-project-structure.md)** | <span className="db-tier t-master">Master</span> | The factory, the layer rules, and a mount order five chapters depend on |
| 02 | **The validation boundary** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 03 | **Auth** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 04 | **Authorization** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 05 | **Catalog endpoints** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 06 | **Cart endpoints** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 07 | **The checkout endpoint** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 08 | **The uploads endpoint** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 09 | **The error contract** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 10 | **Rate limiting** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 11 | **Inbound webhooks** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 12 | **OpenAPI from the schemas** | <span className="db-tier t-know">Know</span> | *(not written yet)* |

## Phase gate

The gate from the syllabus: the full browse → cart → checkout flow exercised
end to end against the running API, including a replayed checkout that does
not double-charge.

## Where this connects

Phase 4's React screens consume these endpoints; Phase 6 types them end to
end; the Nginx section will front them when its serving phases are written.
