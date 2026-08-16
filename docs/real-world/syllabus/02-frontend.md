---
title: "Part 2 — The frontend"
sidebar_label: "2 · Frontend"
sidebar_position: 2
---

> Phases 4–6 · React UI and custom hooks, JavaScript custom functions, TypeScript across the stack

The screens and the code under them. The React phase consumes the Phase 3 API;
the JavaScript phase builds the framework-free functions those screens lean on;
the TypeScript phase types the whole path from schema to component.

---

## Phase 4 — The React UI and its hooks

How to *write* a hook lives in
[React Phase 7 — Custom hooks](../../react/pages/phase-7-custom-hooks/README.md).
These chapters are the hooks and screens this storefront needs, built against
the real API contract from Phase 3.

| Topic | Tier |
|---|---|
| **`useAsync` / `useFetch`** — abort on unmount, race-safe, the base every data hook builds on | <span className="db-tier t-master">Master</span> |
| **`useDebounce` and the search box** — wired to the catalog search endpoint | <span className="db-tier t-master">Master</span> |
| **`useIntersectionObserver` and the infinite product list** | <span className="db-tier t-master">Master</span> |
| **`useForm` and the checkout form** — validation, dirty state, submit states | <span className="db-tier t-master">Master</span> |
| `useLocalStorage` and the persisted guest cart | <span className="db-tier t-understand">Understand</span> |
| **Cart state** — context + reducer, optimistic add-to-cart with rollback | <span className="db-tier t-master">Master</span> |
| Modal, portal and focus trap — the product gallery, with `useOutsideClick` | <span className="db-tier t-understand">Understand</span> |
| Upload with progress — the review form's image field | <span className="db-tier t-understand">Understand</span> |
| **Auth in the client** — protected routes, refresh, session-expiry UX | <span className="db-tier t-master">Master</span> |
| The admin data table — server-driven sorting and pagination | <span className="db-tier t-understand">Understand</span> |
| Error boundaries and retry UX | <span className="db-tier t-understand">Understand</span> |
| When to replace the hand-rolled hooks with TanStack Query — the honest trade | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the storefront browsing, carting and checking out against
the Phase 3 API, surviving a mid-flight session expiry without losing the cart.

---

## Phase 5 — JavaScript custom functions

Framework-free functions the app uses everywhere. The from-scratch foundations
(EventEmitter, debounce, deep clone, promise pool) live in
[JavaScript Phase 17 — Machine coding](../../javascript/pages/README.md); these
chapters *apply* them to the storefront and never re-implement them.

| Topic | Tier |
|---|---|
| **The fetch wrapper** — retry, abort, timeout, and in-flight deduplication | <span className="db-tier t-master">Master</span> |
| **A TTL cache with stale-while-revalidate** — the catalog's client cache | <span className="db-tier t-master">Master</span> |
| **A concurrency-limited task queue** — image prefetch without saturating the network | <span className="db-tier t-master">Master</span> |
| An event bus — cart badge, toasts and analytics decoupled | <span className="db-tier t-understand">Understand</span> |
| The form validation engine — rules in, errors map out; shared with `useForm` | <span className="db-tier t-understand">Understand</span> |
| **Money and dates with `Intl`** — prices, discounts and delivery windows formatted correctly per locale | <span className="db-tier t-master">Master</span> |
| Slug and search-term normalization | <span className="db-tier t-know">Know</span> |
| Feature flags with a local override | <span className="db-tier t-know">Know</span> |
| Optimistic-update helpers — apply and rollback as data, not as scattered setState | <span className="db-tier t-understand">Understand</span> |
| Debounce and throttle, applied — where each belongs in this app, linking the Phase 17 implementations | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** search, cart and reviews all running through the wrapper,
cache and queue — and a network throttled to 3G still leaves the UI responsive.

---

## Phase 6 — TypeScript across the stack

Typing the exact stack built so far — schema to query to endpoint to hook to
component. Language concepts live in the
[TypeScript section](../../typescript/README.md); these chapters are the
storefront's types.

| Topic | Tier |
|---|---|
| **The shared types package** — one workspace package the API and client both import | <span className="db-tier t-master">Master</span> |
| **zod schemas as the source of truth** — `z.infer` end to end, request to response | <span className="db-tier t-master">Master</span> |
| **Typing raw `pg` results** — interfaces per query module, no ORM types to lean on | <span className="db-tier t-master">Master</span> |
| **Discriminated unions** — the order-status state machine that won't compile invalid transitions | <span className="db-tier t-master">Master</span> |
| Typed Express handlers and middleware — `Request` generics without the cast parade | <span className="db-tier t-understand">Understand</span> |
| Typing the custom hooks — generics that infer, overloads where they pay | <span className="db-tier t-understand">Understand</span> |
| The typed API client — generated from the zod/OpenAPI source | <span className="db-tier t-understand">Understand</span> |
| Utility types in app code — `Pick`, `Omit`, `satisfies` doing real work | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** renaming a column in the schema breaks the build in the
query module, the endpoint, and the component that renders it — nowhere at runtime.

---

← Prev: [Part 1 — The backend spine](01-backend.md) · Next → [Part 3 — Completion](03-completion.md)
