---
title: "Part 4 — Building a real app"
sidebar_label: "4 · Building a real app"
sidebar_position: 4
---

> Phases 12–14 · 48 topics · Data and state, routing and structure, correctness
> and delivery

React ships a rendering library and almost nothing else. Every real application
still has to answer four questions React refuses to answer for you: where data
lives, how the URL maps to the screen, how it fails, and how it gets to a user.
This part covers those, with the honest trade-offs rather than a recommended
stack.

These three phases are **parallelizable** — testing and accessibility can run
alongside whatever you are building.

---

## Phase 12 — Data and state in a real app

*16 topics.* Most "global state" is a cache of somebody else's data. Sorting
state into the right bucket removes more complexity than any library.

| Topic | Tier |
|---|---|
| **Server state is a cache, not state** — data owned by your API is borrowed, may be stale, and needs invalidation rather than mutation. The reframing that deletes half of a typical Redux store | <span className="db-tier t-master">Master</span> |
| **The four buckets** — server state, URL state, form state and UI state. Which tool each one wants, and the bugs that come from putting one in the wrong bucket | <span className="db-tier t-master">Master</span> |
| **The URL as state** — filters, sorting, pagination and the open tab belong in the query string: shareable, restorable on reload, and free undo through the back button | <span className="db-tier t-master">Master</span> |
| **TanStack Query** — queries, mutations, query keys, `staleTime` vs `gcTime`, invalidation, and what it removes from your code (loading flags, dedupe, retries, refetch-on-focus, race conditions) | <span className="db-tier t-understand">Understand</span> |
| **Client state managers** — Zustand, Jotai and Redux Toolkit compared on the axes that matter: selector granularity, boilerplate, devtools, SSR support, and how each behaves under concurrent rendering | <span className="db-tier t-understand">Understand</span> |
| **Context versus a store** — the concrete re-render and selector argument, with the measurement; and the size of app at which context genuinely stops being enough | <span className="db-tier t-understand">Understand</span> |
| **Optimistic updates outside forms** — mutating a query cache and rolling back on error, versus `useOptimistic` inside an action. Choosing by whether the change outlives the interaction | <span className="db-tier t-understand">Understand</span> |
| **Real-time data** — WebSocket and SSE feeds pushed into a query cache or exposed through `useSyncExternalStore`; reconnection, backfill and the ordering problem | <span className="db-tier t-understand">Understand</span> |
| **Pagination and infinite lists** — offset versus cursor from the client's point of view, keeping scroll position stable, and why cursor pagination is the one your database wanted anyway | <span className="db-tier t-understand">Understand</span> |
| **Caching vocabulary** — fresh, stale, revalidate, invalidate, refetch; mapping the client cache onto the `Cache-Control` and `ETag` your API already sends instead of fighting it | <span className="db-tier t-understand">Understand</span> |
| **Local persistence** — `localStorage`, `sessionStorage` and IndexedDB in a React app; reading them without breaking SSR, and doing it through `useSyncExternalStore` so two tabs agree | <span className="db-tier t-understand">Understand</span> |
| **Authentication state on the client** — where the token lives (and why not `localStorage`), the hydration problem for "am I logged in", the flash of the wrong UI, and refresh handling | <span className="db-tier t-understand">Understand</span> |
| **Derive, don't store** — the client-side restatement of the derived-state rule: a `useMemo` over the source data beats a second state that has to be kept in sync | <span className="db-tier t-understand">Understand</span> |
| **Talking to your own Express + PostgreSQL API** — a typed client, one error contract, mapping HTTP status to UI, retries and timeouts, and exactly where React's responsibility ends | <span className="db-tier t-understand">Understand</span> |
| SWR and framework loaders — the alternatives to a query library, and recognising when the framework has already solved this and you are adding a second cache | <span className="db-tier t-know">Know</span> |
| Redux Toolkit specifically — slices, the store, RTK Query, and why hand-written Redux (actions, constants, `connect`) is no longer recommended by anyone including Redux | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a product list whose filters and page number live in the
URL, whose data comes from a cache that dedupes and revalidates, which updates
optimistically on "add to cart", and which shows a real error state when the API
returns 500.

---

## Phase 13 — Routing, structure and the app shell

*14 topics.* The router is where Suspense, code splitting and data loading stop
being features and start being the shape of your application.

| Topic | Tier |
|---|---|
| **React Router 8** — routes, nested routes, layout routes and `<Outlet>`; the three modes (declarative, data, framework) and which one a given project should use | <span className="db-tier t-master">Master</span> |
| **Navigation** — `<Link>`, `<NavLink>`, `useNavigate`, `replace` vs `push`, relative routes, and the cases where a real page load is the correct answer | <span className="db-tier t-master">Master</span> |
| **Protected routes** — the layout-route guard, redirecting with the intended destination preserved, and the rule that a client-side guard is **UI, not security** — the API authorizes | <span className="db-tier t-master">Master</span> |
| **What a router does** — map the URL to a component tree and keep history in sync; why React does not ship one, and what that means for portability | <span className="db-tier t-understand">Understand</span> |
| **URL parameters and search params** — `useParams`, `useSearchParams`, the read/write cycle, and typing both safely | <span className="db-tier t-understand">Understand</span> |
| **Data routers** — `loader` and `action` per route, `useLoaderData`, deferred data with `Await`, and how they remove the fetch-on-mount waterfall | <span className="db-tier t-understand">Understand</span> |
| **Route-level code splitting** — lazy routes, where the Suspense boundary goes, prefetching on hover, and avoiding a spinner on every navigation | <span className="db-tier t-understand">Understand</span> |
| **Scroll restoration, focus and announcements** — what a client-side route change breaks for keyboard and screen-reader users, and the three fixes a router will not do for you | <span className="db-tier t-understand">Understand</span> |
| **Next.js App Router** — file-based routing, nested layouts, the server/client split, and where its conventions differ from React Router's | <span className="db-tier t-understand">Understand</span> |
| **Choosing: Vite SPA, React Router framework mode, or Next.js** — a decision table for a MERN/PERN app, weighing SEO, hosting, an existing Express API, and team familiarity | <span className="db-tier t-understand">Understand</span> |
| **Project structure** — feature folders versus type folders, where hooks and shared components live, barrel files and what they cost in build time and circular imports | <span className="db-tier t-understand">Understand</span> |
| **The app shell** — providers, error boundaries and Suspense at the root, the order they must nest in, and keeping the root from becoming a fifteen-deep pyramid | <span className="db-tier t-understand">Understand</span> |
| **Environment configuration** — `import.meta.env.VITE_*` and `NEXT_PUBLIC_*`, build-time substitution, and the rule with no exceptions: anything in the client bundle is public | <span className="db-tier t-understand">Understand</span> |
| Migrating an SPA into a framework — the incremental paths, what breaks first (`window` at module scope, client-only libraries), and how to decide it is worth it | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a routed app with a shared layout, a protected section
that redirects to login and returns to the intended page after, route-level code
splitting, and filters that survive a reload and a back-button press.

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

- **Phase 12 → Express** — the API contract, status codes, pagination and
  idempotency are **Express** topics. React consumes the contract; it does not
  design it.
- **Phase 12 → PostgreSQL** — cursor pagination is a client concern here and a
  keyset-index concern there; the two pages link to each other.
- **Phase 13 → Phase 10** — the framework choice made here decides whether
  Server Components are available to you at all.
- **Phase 14 → Nginx** — the SPA fallback, gzip/brotli and cache headers are
  configured in **Nginx**; this phase states the requirement and links out.
- **Phase 14 → Node** — the process that serves an SSR build, its graceful
  shutdown and its observability are **Node** Phases 10–11.
- **Deliberately not here:** CI pipeline design, container images and
  infrastructure. Those are **Docker & Podman** and remain project-based.

---

← Prev: [Part 3 — Concurrent React and the server](03-concurrent-and-server.md) · Index: [React](../README.md)
