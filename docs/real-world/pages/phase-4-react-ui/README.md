---
title: "Phase 4 — The React UI"
sidebar_label: "Overview"
sidebar_position: 0
---

> The storefront's screens and the custom hooks under them, wired to the
> Phase 3 API. How to *write* a hook is
> [React Phase 7 — Custom hooks](../../../react/pages/phase-7-custom-hooks/README.md);
> these chapters are the hooks and screens this app actually needs.

**Prerequisites:** React phases 0–7 (components, state, effects, refs and
context, custom hooks); the Phase 3 API contract.

| # | Chapter | Tier | In one line |
|---|---|---|---|
| 01 | **[`useAsync` and the API client](01-useasync-and-the-api-client.md)** | <span className="db-tier t-master">Master</span> | The base data hook: abort-on-cleanup kills the race and the leak; retry is a refetch through the same door |
| 02 | **[`useDebounce` and the search box](02-usedebounce-and-search.md)** | <span className="db-tier t-master">Master</span> | A debounced value, not a debounced function — and why abort still matters after it |
| 03 | **The infinite product list** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 04 | **`useForm` and the checkout form** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 05 | **`useLocalStorage` and the persisted cart** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 06 | **Cart state** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 07 | **Modal, portal and focus trap** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 08 | **Upload with progress** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 09 | **Auth in the client** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 10 | **The admin data table** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 11 | **Error boundaries and retry UX** | <span className="db-tier t-understand">Understand</span> | *(not written yet)* |
| 12 | **When to switch to TanStack Query** | <span className="db-tier t-know">Know</span> | *(not written yet)* |

## Phase gate

The gate from the syllabus: the storefront browsing, carting and checking
out against the Phase 3 API, surviving a mid-flight session expiry without
losing the cart.

## Where this connects

The framework-free functions these screens lean on are Phase 5's; typing
all of it is Phase 6's; the styling is Phase 7's. JavaScript's own
storefront pages ([phase 18](../../../javascript/pages/README.md)) cover
the vanilla versions of infinite scroll and uploads — these chapters are
the React-shaped counterparts, and link there rather than repeat the
platform material.
