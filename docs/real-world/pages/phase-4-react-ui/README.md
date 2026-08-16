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
| 03 | **[The infinite product list](03-the-infinite-product-list.md)** | <span className="db-tier t-master">Master</span> | Observer sentinel + accumulating pages, generation stamps against filter races, cursor reset as structure |
| 04 | **[`useForm` and the checkout form](04-useform-and-checkout.md)** | <span className="db-tier t-master">Master</span> | One shared zod schema in two runtimes, touched-based errors, the idempotency key scoped to the attempt |
| 05 | **[`useLocalStorage` and the persisted cart](05-uselocalstorage-and-cart.md)** | <span className="db-tier t-understand">Understand</span> | `useSyncExternalStore` over storage, mirrors of convenience, server truth always wins |
| 06 | **[Cart state](06-cart-state.md)** | <span className="db-tier t-master">Master</span> | Context + reducer with optimistic/settle/rollback choreography; rollback restores truth, not a diff |
| 07 | **[Modal, portal and focus trap](07-modal-portal-focus.md)** | <span className="db-tier t-understand">Understand</span> | Start from native `<dialog>`; your code owns focus return, state sync, and knowing when NOT to trap |
| 08 | **[Upload with progress](08-upload-with-progress.md)** | <span className="db-tier t-understand">Understand</span> | Resize on pick, XHR progress island, per-file state machine — cancelled vanishes, failed stays |
| 09 | **[Auth in the client](09-auth-in-the-client.md)** | <span className="db-tier t-master">Master</span> | Belief vs truth, the 401 broadcast seam, and expiry-during-checkout that never unmounts the work |
| 10 | **[The admin data table](10-the-admin-data-table.md)** | <span className="db-tier t-understand">Understand</span> | Server-driven sort/filter/page, URL as the state store, pessimistic mutations, stale-while-loading |
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
