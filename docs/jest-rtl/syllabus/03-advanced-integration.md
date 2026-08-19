---
title: "Part 3 — State, Network, 3rd-Party Mocks & Modern React"
sidebar_label: "3 · State, Network & Mocks"
sidebar_position: 3
---

> Phases 07–10 · Provider wrappers, MSW v2, 3rd-party library mocking recipes, custom hooks, and React 19

Real applications depend on routing, global state, server caches, portalled UI libraries, charts, animation engines, and external SDKs. Testing them reliably requires standardized provider harnesses and clean mock boundaries.

---

## Phase 07 — Custom Render & State Provider Isolation

Building a single, clean test harness for components wrapped in global contexts.

| Topic | Tier |
|---|---|
| **The `renderWithProviders` pattern** — creating a unified custom render utility wrapping Theme, Router, and State providers via RTL's `wrapper` option | <span className="db-tier t-master">Master</span> |
| Testing with Redux Toolkit — instantiating a fresh Redux store per test, preloading initial state, and asserting component reactions to dispatched actions | <span className="db-tier t-understand">Understand</span> |
| Testing with TanStack Query (React Query) — configuring an isolated `QueryClient` per test with `retry: false` and `gcTime: 0`; preventing cross-test cache leaks | <span className="db-tier t-understand">Understand</span> |
| Testing with React Router — `createMemoryRouter` and `RouterProvider` for simulating nested routes, URL search params, and navigation assertions without browser history | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you have authored a reusable `renderWithProviders` helper that initializes a fresh TanStack Query client and Redux store for each test case without bleeding state.

---

## Phase 08 — Network Mocking with Mock Service Worker (MSW v2)

Intercepting requests at the network boundary rather than mocking `fetch` or SDKs.

| Topic | Tier |
|---|---|
| **MSW v2 setup & lifecycle** — `setupServer`, `server.listen({ onUnhandledRequest: 'error' })`, `server.resetHandlers()`, and `server.close()`; why mocking at the network boundary beats mocking `fetch` | <span className="db-tier t-master">Master</span> |
| **Request handlers & responses** — `http.get()`, `http.post()`, `HttpResponse.json()`, reading route parameters, query parameters, and request JSON bodies | <span className="db-tier t-master">Master</span> |
| Per-test handler overrides — using `server.use()` to simulate 404, 401, 500 error responses, slow network delays with `delay()`, and `HttpResponse.error()` for offline failures | <span className="db-tier t-understand">Understand</span> |
| Testing loading, error, and optimistic states — asserting the initial loading skeleton, the error banner with retry button, and successful data population | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can write a test suite for a data-fetching component that verifies the loading state, the happy-path list, a 500 server error recovery, and an unhandled request error detection.

---

## Phase 09 — Mocking 3rd-Party & External Libraries (Recipe Catalog)

Pragmatic mocking recipes for third-party packages, UI primitives, animations, and SDKs.

| Topic | Tier |
|---|---|
| Portalled UI primitives (`@radix-ui`, Headless UI, `react-modal`) — testing dialogs, dropdowns, and tooltips that render outside the root container; stubbing pointer capture and DOM rect measurements | <span className="db-tier t-understand">Understand</span> |
| Framework navigation hooks (`next/navigation`, `next/router`, `react-router`) — mocking `useRouter`, `useSearchParams`, `usePathname`, `useParams`, and `useNavigate` with controllable spies | <span className="db-tier t-understand">Understand</span> |
| Animation libraries (`framer-motion`) — bypassing exit animations, mocking `AnimatePresence`, and rendering plain passthrough elements to eliminate async timing delays in tests | <span className="db-tier t-understand">Understand</span> |
| Icon and asset packages (`lucide-react`, `@heroicons/react`) — module mocking large SVG libraries to reduce render overhead and prevent thousand-line snapshot noise | <span className="db-tier t-know">Know</span> |
| Canvas & charting libraries (`chart.js`, `recharts`) — stubbing `HTMLCanvasElement.prototype.getContext('2d')`, mocking container dimensions, and asserting on props passed to chart wrappers | <span className="db-tier t-understand">Understand</span> |
| Third-party client SDKs (Stripe, Firebase Auth, Supabase, Google Maps) — mocking client SDK instances, token exchanges, method chaining, and callback dispatchers | <span className="db-tier t-understand">Understand</span> |
| Browser storage & native Web APIs (`localStorage`, `sessionStorage`, `navigator.clipboard`) — mocking storage with `Object.defineProperty`, simulating quota errors, and asserting clipboard writes | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can write clean, un-leaking mocks for a component that uses a Radix UI dialog, Lucide icons, Framer Motion animations, Next.js router hooks, and `localStorage`.

---

## Phase 10 — Custom Hooks, React 19 Patterns & Accessibility

Testing custom hooks, modern React concurrent features, and automated a11y.

| Topic | Tier |
|---|---|
| Testing custom hooks with `renderHook` — invoking hooks in isolation, inspecting `result.current`, triggering stateful callbacks, and passing wrapper options | <span className="db-tier t-understand">Understand</span> |
| When to test a hook directly vs through a component — why standalone hook tests are ideal for reusable utility hooks (e.g. `useDebounce`, `useLocalStorage`) but redundant for component-coupled hooks | <span className="db-tier t-know">Know</span> |
| Testing React 19 Actions & Forms — testing `<form action={...}>`, `useActionState`, `useFormStatus`, and `useOptimistic` transitions in UI tests | <span className="db-tier t-understand">Understand</span> |
| Automated accessibility auditing with `jest-axe` — integrating `axe-core`, running `expect(await axe(container)).toHaveNoViolations()`, and interpreting WCAG violations | <span className="db-tier t-understand">Understand</span> |
| Debugging utilities & DOM inspection — `screen.debug()`, `logTestingPlaygroundURL()`, and inspecting rendered DOM hierarchies during test failures | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can test a custom hook with `renderHook` that updates async state, and verify that a rendered dialog component passes `jest-axe` accessibility checks with zero violations.

---

## Where this connects

- **Part 4 (Production CI & Setup)**: Integrates global `setupTests.ts` polyfills, SWC/Vite setup, and CI pipelines.
- **TanStack Query Track (`docs/tanstack-query/`)**: Deep dive into query keys and server-state caching strategies.
- **Redux Toolkit Track (`docs/redux-toolkit/`)**: Advanced reducer and slice state verification.
