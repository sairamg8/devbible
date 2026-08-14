---
title: "Part 4 — Building a real app"
sidebar_label: "4 · Building a real app"
sidebar_position: 4
---

> Phase 14 · 18 topics · Correctness and delivery.
> 🔴 **Phases 12 and 13 were dropped on 2026-08-14** — see below.

React ships a rendering library and almost nothing else. This part was planned to
cover the four questions React refuses to answer — where data lives, how the URL
maps to the screen, how it fails, and how it gets to a user.

**Two of those four are no longer in scope.** Data and state (Phase 12) and routing
(Phase 13) were dropped; what remains here is **Phase 14 — correctness, errors,
accessibility, testing and delivery**, which is parallelizable with everything else.

---

## Phases 12 and 13 — dropped

> 🔴 **Abandoned on 2026-08-14, on the maintainer's instruction.** These two phases —
> **12 · Data and state in a real app** (16 topics) and **13 · Routing, structure and the
> app shell** (14 topics) — were planned and never written. No page of either exists, so
> nothing was removed except the plan itself.

The headings are kept so the numbering of Phase 14 stays stable and so the gap is
explained rather than mysterious. **React's scope is now Phases 0–11 and 14 — 214 topics.**

What their subjects meant, and where the material now lives or does not:

| Was going to cover | Where it stands now |
|---|---|
| Server state as a cache, the four state buckets, the URL as state | **Not covered.** Earlier pages that point forward to "Phase 12" state the idea and stop there |
| Data-fetching libraries, caching and invalidation | **Not covered.** [Phase 10 · 15](../pages/phase-10-server-components/15-data-fetching-in-rsc.md) covers fetching on the server only |
| Routing, code splitting and the app shell | **Not covered.** The framework comparison in [Phase 10 · 16](../pages/phase-10-server-components/16-nextjs-vs-react-router.md) is the closest thing |

⚠️ **Some written pages in Phases 2, 7 and 8 still name "Phase 12" in prose.** Those
sentences were rewritten when the phases were dropped; if you find one that was missed,
it is a stale forward reference, not a page that exists somewhere.

---

## Phase 14 — Correctness: errors, accessibility, testing, delivery

*18 topics.* The work that separates a demo from an application. None of it is
optional and all of it is skipped.

| Topic | Tier |
|---|---|
| **Error boundaries** — `getDerivedStateFromError` and `componentDidCatch`, why they are still class-only in 19.2.8, and where to place them so one broken widget does not blank the page | <span className="db-tier t-master">Master</span> |
| **What error boundaries do not catch** — event handlers, `setTimeout`, async code after an `await`, errors thrown during SSR, and errors in the boundary itself. The four gaps and what covers each | <span className="db-tier t-master">Master</span> |
| **React Testing Library** — querying by role and accessible name, `userEvent` over `fireEvent`, `findBy*` for async, and the `act()` warning explained by what it actually means | <span className="db-tier t-master">Master</span> |
| **Security in a React app** — XSS through `dangerouslySetInnerHTML` and user-controlled `href="javascript:"`, secrets compiled into the bundle, `target="_blank"` and `rel`, and dependency risk in a tree of 900 packages | <span className="db-tier t-master">Master</span> |
| **`react-error-boundary`** — the practical wrapper: `FallbackComponent`, `onError`, `resetKeys`, and designing a retry that does not immediately re-throw | <span className="db-tier t-understand">Understand</span> |
| **Root error reporting (19)** — `onCaughtError`, `onUncaughtError` and `onRecoverableError`, how they differ from a boundary, and wiring them to Sentry without double-reporting | <span className="db-tier t-understand">Understand</span> |
| **Accessibility fundamentals in React** — semantic elements before ARIA, labelling every control, and the fact that `<div onClick>` is not a button for anyone using a keyboard | <span className="db-tier t-understand">Understand</span> |
| **Focus management** — moving focus on route change, dialog open and close, focus traps, `inert`, and why you should reach for a headless library rather than reimplement a menu | <span className="db-tier t-understand">Understand</span> |
| **Announcing async change** — `aria-live` regions for results, errors and toasts; the part of every async UI that never gets built | <span className="db-tier t-understand">Understand</span> |
| **Testing philosophy for React** — test what the user does through the DOM, not implementation details; why "did `setState` get called" is a test that fails on every refactor | <span className="db-tier t-understand">Understand</span> |
| **Testing hooks, context and providers** — the wrapper pattern, `renderHook`, and testing a hook through a component that uses it realistically | <span className="db-tier t-understand">Understand</span> |
| **Mocking the network** — MSW at the network layer instead of stubbing `fetch`, sharing handlers between tests and development, and testing loading and error states deliberately | <span className="db-tier t-understand">Understand</span> |
| **Vite and the dev loop** — the dev server, Fast Refresh, the four things that silently break Fast Refresh, the production build, and what `@vitejs/plugin-react` is actually doing | <span className="db-tier t-understand">Understand</span> |
| **Deploying a React app** — static hosting versus a Node server; the SPA fallback rewrite (and its **Nginx** configuration); immutable caching for hashed assets and no-cache for `index.html` | <span className="db-tier t-understand">Understand</span> |
| **Upgrading React** — the 18 → 19 codemods and the removals that break builds: `propTypes`, `defaultProps` on function components, string refs, legacy context, `ReactDOM.render`, `react-test-renderer`, and peer-dependency fallout | <span className="db-tier t-understand">Understand</span> |
| `captureOwnerStack` (19) — the development-only component owner stack, and attaching it to error reports so a stack trace names components instead of minified frames | <span className="db-tier t-know">Know</span> |
| Testing Server Components and Server Functions — what is genuinely testable in 2026, what is not, and pushing logic out of them so it can be unit-tested at all | <span className="db-tier t-know">Know</span> |
| Component and end-to-end testing — Vitest browser mode and Playwright; which layer each bug class belongs to, and the cost of an E2E suite nobody trusts | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a feature with an error boundary that reports to a
logger and offers a working retry, a test suite that drives it by role and
mocks the network at the transport layer, no axe violations on the happy path,
and a production build served with correct cache headers.

---

## Where this connects

- **The Express and PostgreSQL handoffs move with Phase 12.** The API contract,
  status codes, pagination and idempotency were always **Express** topics, and
  cursor pagination a **PostgreSQL** one; with Phase 12 dropped, React simply
  never states the React half. Both remain covered on their own side.
- **The framework choice that Phase 13 would have made** is covered as a choice,
  not as a routing syllabus, in
  [Phase 10 · 16](../pages/phase-10-server-components/16-nextjs-vs-react-router.md).
- **Phase 14 → Nginx** — the SPA fallback, gzip/brotli and cache headers are
  configured in **Nginx**; this phase states the requirement and links out.
- **Phase 14 → Node** — the process that serves an SSR build, its graceful
  shutdown and its observability are **Node** Phases 10–11.
- **Deliberately not here:** CI pipeline design, container images and
  infrastructure. Those are **Docker & Podman** and remain project-based.

---

← Prev: [Part 3 — Concurrent React and the server](03-concurrent-and-server.md) · Index: [React](../README.md)
