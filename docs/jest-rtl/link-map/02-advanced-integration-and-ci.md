---
title: "Link map · Jest and RTL · Part 2 (phases 07–12)"
sidebar_label: "02 · advanced integration and ci"
sidebar_position: 2
---

# Link map · Jest and RTL · Part 2 (phases 07–12)

Covers every topic row of phases 7 to 12 in `docs/jest-rtl/syllabus/03-advanced-integration.md` (T07-01 to T10-05) and `docs/jest-rtl/syllabus/04-production-ci.md` (T11-01 to T12-04). That is 32 rows: 21 have a page of ours and 11 are not written. Our pages are one per chapter, so several topics share a page: phase 7 maps to `11-custom-render`, phase 8 to `12-mocking-network-requests`, T10-01/02 to `13-testing-hooks`, T10-04 to `14-accessibility-testing`, T10-05 to `15-debugging-tests`, T11-02 and T11-05 to T11-08 to `06-coverage-and-configuration`, and T11-01, T11-03, T11-04 and T12-04 to `16-real-world-workflows-and-recipes`. All of phase 9 (recipe catalog) and T10-03, T12-01, T12-02 and T12-03 have no page yet and are marked not written; a grep of the chapter pages found none of Radix, framer-motion, lucide mocks, charts, SDKs, storage mocks, React 19 form hooks, sharding or worker tuning.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. Tier text is taken from the Tier column of the syllabus tables.

🔴 **Version notes.**
- **MSW.** The MSW docs now describe **msw 3.x** (3.0.0 was published to npm on 2026-09-28; the listen page cites v3.0.2). There the unhandled-request option is `onUnhandledFrame` (default `"warn"`; `"error"`, `"bypass"` or a function), and the published 3.0.3 type files contain no `onUnhandledRequest`. `onUnhandledRequest` is the msw 2.x name, which our syllabus and our pages use, and 3.x requires Node 22.12 or newer. Check which major your installed `msw` is before copying either name.
- **TanStack Query** links are v5 (`latest`). **React Router** links are the v7 docs unless marked v6; `createMemoryRouter` there is Data mode, and the testing guide centres on `createRoutesStub`.
- **Next.js** Jest guide is the 16.4 page (lastUpdated 2026-08-25). **Jest** pages are 30.x. **Vitest** links are the current docs (the migration page mentions Vitest 5.0 changes).

---

## Phase 7 — Custom render and state provider isolation

### T07-01 · The `renderWithProviders` pattern — Master · ✅ written `docs/jest-rtl/pages/11-custom-render/01-provider-wrapping.md`
- **Read this:** [Setup](https://testing-library.com/docs/react-testing-library/setup) · Testing Library · the Custom Render section: an `AllTheProviders` wrapper (a theme provider and a translation provider) passed as the `wrapper` option, with the rest of the library re-exported (*read*) · covers our angle: **partial** — shows the wrapper with data providers, not a per-test store or router · fetched 2026-10-14
- **Beyond the docs:** [Setting up React Testing Library](https://github.com/nareshbhatia/react-testing-techniques/blob/main/docs/setting-up-react-testing-library.md) · Naresh Bhatia, GitHub docs repo (no date shown) · argues the custom render should mirror the real app's global providers, tells tests to import from the utility file instead of the library, and links a `test-utils.tsx` example; the page is short, so read the linked file for the code · fetched 2026-10-14 (*headings only*)
- **Our delta:** the single-entrypoint re-export, the ESLint rule that blocks importing `render` from the library directly, and the per-test isolation gotchas.

### T07-02 · Testing with Redux Toolkit — Understand · ✅ written `docs/jest-rtl/pages/11-custom-render/01-provider-wrapping.md`
- **Read this:** [Writing Tests](https://redux.js.org/usage/writing-tests) · Redux docs · `renderWithProviders`, a `setupStore` factory that calls `configureStore` with an optional `preloadedState`, and the rule that each test gets its own store; the helper returns the store "in case the test needs to dispatch more actions or check state" (*read*) · covers our angle: **partial** — full for store setup and seeding, but it recommends asserting on UI output and shows no dispatched-action assertion in component tests · fetched 2026-10-14
- **Beyond the docs:** [Getting started with Redux and Testing Library](https://dev.to/bonnie/getting-started-with-redux-and-testing-library-36ln) · Bonnie Schulkin, DEV Community, 2022-06-02 · a custom `render` that takes `preloadedState` and builds a new store per test from a factory function; written before the Toolkit `setupStore` convention, so read it for the reasoning · fetched 2026-10-14 (*read*)
- **Our delta:** our helper returns both `store` and `queryClient`, so a test can read state after an interaction; the page does not assert on dispatched actions themselves, which the Redux page also steers away from.

### T07-03 · Testing with TanStack Query — Understand · ✅ written `docs/jest-rtl/pages/11-custom-render/01-provider-wrapping.md`
- **Read this:** [Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing) · TanStack Query v5 docs · default is three retries with exponential backoff, so set `retry: false` in the client's `defaultOptions.queries` (a per-query `retry` overrides it); a fresh `QueryClient` in the wrapper isolates tests (*read*) · covers our angle: **partial** — recommends `gcTime: Infinity` (not `0`) to stop Jest's "did not exit one second after the test run completed" warning, and says that only matters if you set `gcTime` yourself · fetched 2026-10-14
- **Beyond the docs:** [Testing React Query](https://tkdodo.eu/blog/testing-react-query) · TkDodo (Dominik Dorfmeister), first published 2021-04-04, updated 2023-10-21 · one client per test over clearing a shared cache, retries off, and MSW as the single API mock; does not mention `gcTime`, and predates some v5 renames, so read for reasoning · fetched 2026-10-14 (*read*)
- **Our delta:** flagged finding, verified: the syllabus and our page use `gcTime: 0`; the official guide says `Infinity` and never mentions `0`, and a search found no source comparing the two. Our page should cite the docs' value or say that `0` is our choice, not theirs.

### T07-04 · Testing with React Router — Understand · ✅ written `docs/jest-rtl/pages/11-custom-render/01-provider-wrapping.md`
- **Read this:** [createMemoryRouter](https://reactrouter.com/api/data-routers/createMemoryRouter) · React Router v7 docs · keeps history in memory, takes `initialEntries` and `initialIndex`, is passed to `RouterProvider`, and should be created once outside the React tree (*read*) · covers our angle: **partial** — no test example on the page · fetched 2026-10-14
- **Also good:** [createMemoryRouter (v6)](https://reactrouter.com/v6/routers/create-memory-router) · React Router v6 docs · a full RTL test: `initialEntries: ["/", "/events/123"]`, `initialIndex: 1`, `render(<RouterProvider router={router} />)`, then `waitFor` on a heading. v6 era, so imports come from `react-router-dom` (*read*) · fetched 2026-10-14
- **Also good:** [Testing](https://reactrouter.com/start/framework/testing) · React Router v7 docs · `createRoutesStub` for unit testing reusable components that need router context; recommends E2E tools for whole routes. It does not mention `createMemoryRouter` (*read*) · fetched 2026-10-14
- **Our delta:** our page uses `MemoryRouter` with `initialEntries` (including a search string) and a `useLocation` probe component for navigation assertions; it does not show `createMemoryRouter` with `RouterProvider`, which the syllabus names. Say when each is a fair choice, since the v7 testing page steers toward `createRoutesStub`.

---

## Phase 8 — Network mocking with MSW v2

### T08-01 · MSW v2 setup and lifecycle — Master · ✅ written `docs/jest-rtl/pages/12-mocking-network-requests/01-api-level-mocking.md`
- **Read this:** [Node.js integration](https://mswjs.io/docs/integrations/node) · MSW docs · `setupServer` from `msw/node`, a synchronous `listen`, `resetHandlers` between tests, and `close` after all tests (*read*) · covers our angle: **partial** — does not mention unhandled requests · fetched 2026-10-14
- **Also good:** [Quick start](https://mswjs.io/docs/quick-start) · MSW docs · the five-step setup with a Vitest setup file; Jest wiring is the same hooks in `setupFilesAfterEnv`. It calls `listen()` with no options (*read*) · fetched 2026-10-14
- **Also good:** [listen()](https://mswjs.io/docs/api/setup-server/listen) · MSW docs (v3) · the unhandled-request option is documented here as `onUnhandledFrame`, default `"warn"`, with `"error"`, `"bypass"` or a custom function (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Stop mocking fetch](https://kentcdodds.com/blog/stop-mocking-fetch) · Kent C. Dodds, 2020-06-03 · why mocking `fetch` per test hides bad request formats and headers, and why one shared mock server is better; uses the old `rest` API · fetched 2026-10-14 (*read*)
- **Our delta:** flagged finding, verified in the published package: `'error'` as the project default is correct for msw 2.x with `onUnhandledRequest`, and the same behaviour is `onUnhandledFrame: 'error'` in 3.x. Our page should name the version it targets.

### T08-02 · Request handlers and responses — Master · ✅ written `docs/jest-rtl/pages/12-mocking-network-requests/01-api-level-mocking.md`
- **Read this:** [Path parameters](https://mswjs.io/docs/http/intercepting-requests/path-parameters) · MSW docs · `:id`, optional `:id?`, repeating `:segments+`; values are always strings or string arrays, with no parsing (*read*) · covers our angle: **partial** — route params only · fetched 2026-10-14
- **Also good:** [Query parameters](https://mswjs.io/docs/http/intercepting-requests/query-parameters) · MSW docs · build a `URL` from `request.url` and use `searchParams.get` or `getAll` (*read*) · fetched 2026-10-14
- **Our delta:** our page covers `params`, a POST body read with `await request.json()` and a captured-payload assertion; neither fetched official page covers the body. A search found only a guide on capturing the body in a resolver and a matcher library, not worth linking.

### T08-03 · Per-test handler overrides — Understand · ✅ written `docs/jest-rtl/pages/12-mocking-network-requests/01-api-level-mocking.md`
- **Read this:** [Network behavior overrides](https://mswjs.io/docs/best-practices/network-behavior-overrides) · MSW docs · `server.use()` prepends handlers that take priority, overrides are permanent until `resetHandlers()`, and `{ once: true }` limits one to a single request (*read*) · covers our angle: **full** for overrides · fetched 2026-10-14
- **Also good:** [Error responses](https://mswjs.io/docs/http/mocking-responses/error-responses) · MSW docs · 404 with a null body, 401 with a JSON body (*read*); [Network errors](https://mswjs.io/docs/recipes/network-errors) · `HttpResponse.error()` aborts the request and the client sees a generic `TypeError: Failed to fetch` (*read*) · fetched 2026-10-14
- **Also good:** [Response timing](https://mswjs.io/docs/http/mocking-responses/response-timing) · MSW docs · `await delay(ms)` inside a resolver; says nothing on Node-specific behaviour, which is left to the `delay()` API reference I did not fetch (*read*) · fetched 2026-10-14
- **Our delta:** the 500 case (no official 500 example) and the order-dependent failure when an override leaks into the next test. Searches returned only tutorials on the old `rest` API or aggregator pages, so no Beyond line.

### T08-04 · Testing loading, error and optimistic states — Understand · ✅ written `docs/jest-rtl/pages/12-mocking-network-requests/01-api-level-mocking.md`
- **Read this:** [Async methods](https://testing-library.com/docs/dom-testing-library/api-async) · Testing Library · `findBy` is `getBy` plus `waitFor`; `waitFor` retries a callback that throws, 1000 ms timeout and 50 ms interval by default (*read*) · covers our angle: **partial** — no loading or error example · fetched 2026-10-14
- **Also good:** [Network behavior overrides](https://mswjs.io/docs/best-practices/network-behavior-overrides) · MSW docs · the override mechanism for the error and retry paths (*read*) · fetched 2026-10-14
- **Our delta:** our page tests the 500 error alert with a retry button and the offline case; `delay()` is described as the way to see a loading skeleton, but there is no skeleton test and no optimistic-update test, so those two parts of the topic are still open. I found no clean third-party walkthrough of a retry button, so there is no Beyond line.

---

## Phase 9 — Mocking third-party and external libraries (recipe catalog)

### T09-01 · Portalled UI primitives — Understand · 🔲 not written
- **Read this:** [Select cannot be opened with Testing Library (issue 1822)](https://github.com/radix-ui/primitives/issues/1822) · Radix primitives issue tracker · `userEvent.click` fails with "target.hasPointerCapture is not a function"; workarounds: stub `PointerEvent`, `hasPointerCapture`, `releasePointerCapture` and `scrollIntoView`, query by role, await the event, or drive the hidden native select. Some commenters report the stubs break forms, and later comments say earlier fixes stopped working for some setups (*read*) · covers our angle: **partial** — Select only · fetched 2026-10-14
- **Beyond the docs:** [Vitest Browser Modeがアツい](https://zenn.dev/apple_yagi/articles/b2b96af1fd355c) · Yanagi, Zenn, 2024-07-17 · Radix Tooltip needs `ResizeObserver`, which jsdom lacks, so the test stubs it; the post's point is that Browser Mode avoids this. In Japanese · fetched 2026-10-14 (*read*)
- **Our delta:** `baseElement` and `screen` for content outside the container, and one shared stub list in `setupTests.ts`. Radix has no testing page of its own, so no official link.

### T09-02 · Framework navigation hooks — Understand · 🔲 not written
- **Read this:** [Mock functions](https://jestjs.io/docs/mock-functions) · Jest docs · `jest.mock` on a module in "Mocking Modules", `mockReturnValue`, and partial mocks through a factory in "Mocking Partials" (*read*) · covers our angle: **partial** — the mechanism, nothing router-specific · fetched 2026-10-14
- **Also good:** [How to set up Jest with Next.js](https://nextjs.org/docs/app/guides/testing/jest) · Next.js 16.4 docs · config and `next/jest` only (which auto-mocks stylesheets, images and `next/font`); it does not show how to mock `next/navigation` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Mocking Next 16 useParams, useSearchParams, usePathname and useRouter in Jest](https://dev.to/peterlidee/mocking-next-16-useparams-usesearchparams-usepathname-and-userouter-in-jest-2l7k) · Peter Jacxsens, DEV Community, 2025-11-26 · `jest.mock('next/navigation')`, `useSearchParams` needs `get` and `toString`, `useRouter` returns a `push` spy; async `params` is left unsolved by the author · fetched 2026-10-14 (*read*)
- **Our delta:** `useNavigate` and `next/router` (Pages Router) in the same table, and a controllable-spy helper.

### T09-03 · Animation libraries (`framer-motion`) — Understand · 🔲 not written
- **Read this:** [MotionConfig](https://motion.dev/docs/react-motion-config) · Motion docs · `reducedMotion` is a site-wide policy (`"user"`, `"always"`, `"never"`), but it disables only transform and layout animations; opacity and colour still animate (*read*) · covers our angle: **partial** — no instant-finish switch on this page · fetched 2026-10-14
- **Beyond the docs:** [Mocking framer-motion v9](https://dev.to/pgarciacamou/mocking-framer-motion-v9-7jh) · Pablo Garcia, DEV Community, 2025-06-16 · keeps the real `AnimatePresence` and forces zero durations through a Proxy, so exit lifecycles still run; the author lists its fragility, such as layout animations not running under Jest (*read*) · fetched 2026-10-14
- **Our delta:** choosing between a passthrough mock (fast, exits never run) and zero durations (exits run), and the package rename from `framer-motion` to `motion` (the Motion docs import from `motion/react`).

### T09-04 · Icon and asset packages — Know · 🔲 not written
- **Read this:** [Using with webpack](https://jestjs.io/docs/webpack) · Jest docs · `moduleNameMapper` to a stub file for images and fonts, `identity-obj-proxy` for styles (*read*) · covers our angle: **partial** — static assets, not icon packages · fetched 2026-10-14
- **Also good:** [Manual mocks](https://jestjs.io/docs/manual-mocks) · Jest docs · a `__mocks__` folder next to `node_modules` mocks a package automatically, with no `jest.mock` call (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Jest with SVGR](https://react-svgr.com/docs/jest/) · SVGR docs · a mapped `.svg` mock whose `ReactComponent` is the string `'div'`; notes snapshots then include the icon's props (*read*) · fetched 2026-10-14
- **Our delta:** a `lucide-react` mock specifically. Our config page only maps image and SVG imports to a file stub and lets `lucide-react` through `transformIgnorePatterns`; it has no icon-package mock, so this stays unwritten. A search found nothing lucide-specific.

### T09-05 · Canvas and charting libraries — Understand · 🔲 not written
- **Read this:** [jest-canvas-mock](https://github.com/hustcc/jest-canvas-mock) · project README · replaces `getContext` with a mock 2D context, set up through `setupFiles`; `jest.resetAllMocks()` removes it, so call `setupJestCanvasMock()` again (*read*) · covers our angle: **partial** — canvas only, not container sizing · fetched 2026-10-14
- **Beyond the docs:** [Recharts (Mastering Jest)](https://www.educative.io/courses/mastering-jest-a-complete-guide-to-testing/recharts) · Educative course lesson (no date) · a partial mock via `requireActual` swaps `ResponsiveContainer` for a plain div; the visible excerpt omits the code · fetched 2026-10-14 (*headings only*)
- **Our delta:** stubbing the `ResizeObserver` that `ResponsiveContainer` relies on, and asserting props passed to the chart wrapper. Recharts has no testing guide.

### T09-06 · Third-party client SDKs — Understand · 🔲 not written
- **Read this:** [The Jest Object](https://jestjs.io/docs/jest-object) · Jest docs · `jest.mock` with a factory, `jest.spyOn`, and `jest.requireActual` for partial mocks (*read*) · covers our angle: **partial** — generic; no SDK specifics · fetched 2026-10-14
- **Our delta:** the Firebase `onAuthStateChanged` pattern (capture the callback, call it by hand), Supabase chaining and Google Maps callbacks. Searches returned only partial Firebase and Supabase examples and one unfetched Stripe setup, so those parts are ours and there is no Beyond line.

### T09-07 · Browser storage and native Web APIs — Understand · 🔲 not written
- **Read this:** [Clipboard](https://testing-library.com/docs/user-event/clipboard) · Testing Library user-event · `userEvent.setup()` replaces `navigator.clipboard` with a stub; `copy`, `cut` and `paste` use it (*read*) · covers our angle: **partial** — clipboard only · fetched 2026-10-14
- **Also good:** [The Jest Object](https://jestjs.io/docs/jest-object) · Jest docs · documents `jest.spyOn` including the getter and setter access type; it has no storage example (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Testing localStorage in Jest](https://read.webuild.community/read/MXxodXkucm9ja3MvZXZlcnlkYXkvMDgtMjctMjAyMi10eXBlc2NyaXB0LXRlc3RpbmctbG9jYWxzdG9yYWdlLWluLWplc3Q%3D) · Huy's Everyday Blog on WeBuild Community (no date shown) · `jest.spyOn(Storage.prototype, 'getItem')` with `mockReturnValue`; no error simulation (*read*) · fetched 2026-10-14
- **Our delta:** `Object.defineProperty` storage mocks, a `QuotaExceededError` from `setItem`, and restoring in `afterEach`. No source combined these. Our hook page uses the real jsdom `localStorage` inside `useLocalStorage` tests, which is not this topic.

---

## Phase 10 — Custom hooks, React 19 patterns and accessibility

### T10-01 · Testing custom hooks with `renderHook` — Understand · ✅ written `docs/jest-rtl/pages/13-testing-hooks/01-render-hook.md`
- **Read this:** [React Testing Library API](https://testing-library.com/docs/react-testing-library/api) · Testing Library · `renderHook`: `result.current` is the last committed value, `rerender` with new props, `initialProps`, and `wrapper`; `initialProps` are not passed to the wrapper (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [How to test custom hooks with React Testing Library](https://site.builder.io/blog/test-custom-hooks-react-testing-library) · Vishwas Gopinath, Builder.io blog, 2023-05-09 · a counter hook with `initialProps` and `act(() => result.current.increment())`; does not cover `rerender` or `wrapper` (*read*) · fetched 2026-10-14
- **Our delta:** wrapping state-changing callbacks in `act`, and the stale-destructure pitfall.

### T10-02 · Test a hook directly or through a component — Know · ✅ written `docs/jest-rtl/pages/13-testing-hooks/01-render-hook.md`
- **Read this:** [Testing custom hooks](https://www.epicreact.dev/modules/testing-react-apps-v1/testing-custom-hooks-intro) · Kent C. Dodds, Epic React · test through the component for hooks used by one or two components; test directly for reusable or library hooks (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** the `renderHook` docs above say you "should prefer `render`" when a test component keeps the test readable (*read*).
- **Beyond the docs:** [How to test custom React hooks](https://kentcdodds.com/blog/how-to-test-custom-react-hooks) · Kent C. Dodds, 2020-03-22 · tests a `useUndo` hook through an example component first, then shows a test-only component and `renderHook` as alternatives; written when the package was `react-hooks-testing-library` (*read*) · fetched 2026-10-14
- **Our delta:** `useLocalStorage` as the worked reusable case (our page's example; `useDebounce` is only named in the text).

### T10-03 · Testing React 19 Actions and forms — Understand · 🔲 not written
- **Read this:** [useActionState](https://react.dev/reference/react/useActionState) · react.dev · returns `[state, dispatchAction, isPending]`; dispatch must run inside a Transition (a `form action` counts); a thrown error cancels queued actions, so return expected errors as state (*read*) · covers our angle: **partial** — no testing section · fetched 2026-10-14
- **Also good:** [useFormStatus](https://react.dev/reference/react-dom/hooks/useFormStatus) · react.dev · must be called from a component rendered inside the form; in the form's own component `pending` stays false (*read*) · fetched 2026-10-14
- **Our delta:** submit, assert the pending label, then `findBy` the resulting state; and `useOptimistic`. Two searches found no RTL walkthrough (a DEV post on `useActionState` had no test code), so there is no Beyond line.

### T10-04 · Accessibility auditing with `jest-axe` — Understand · ✅ written `docs/jest-rtl/pages/14-accessibility-testing/01-a11y-assertions.md`
- **Read this:** [jest-axe README](https://github.com/NickColley/jest-axe) · project README · `expect(await axe(html)).toHaveNoViolations()`, `configureAxe`, colour contrast is off because it does not work in jsdom, and axe does not work with fake timers (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Automatically testing for accessibility issues with jest-axe](https://maxrozen.com/automatic-a11y-testing-with-jest-axe) · Max Rozen (no date shown) · a short RTL example, and a plain statement that it finds markup problems but cannot prove a component is accessible · fetched 2026-10-14 (*read*)
- **Our delta:** focus management and Escape handling that axe does not check, and re-running axe after interaction. The fake-timer limit is in the README but not on our page.

### T10-05 · Debugging utilities and DOM inspection — Know · ✅ written `docs/jest-rtl/pages/15-debugging-tests/01-diagnostic-tools.md`
- **Read this:** [Debugging](https://testing-library.com/docs/dom-testing-library/api-debugging) · Testing Library · `screen.debug()`, `prettyDOM`, `logTestingPlaygroundURL`, and `DEBUG_PRINT_LIMIT` (default 7000 characters) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Using the React Testing Library debug method](https://blog.logrocket.com/using-react-testing-library-debug-method/) · Ibadehin Mojeed, LogRocket, 2023-11-03 · `logRoles` and the playground link; moves a `findByText` test to `findByRole` (*read*) · fetched 2026-10-14
- **Our delta:** keeping debug calls out of CI logs and attaching a Node inspector with `--runInBand`.

---

## Phase 11 — Configuration architecture, `setupTests` and polyfills

### T11-01 · Step-by-step setup from zero — Master · ✅ written `docs/jest-rtl/pages/16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md`
- **Read this:** [Getting started](https://jestjs.io/docs/getting-started) · Jest 30 docs · install, config generation, Babel and TypeScript (`ts-jest` for type checking), and a note that Vite does not support Jest (use Vitest). No jsdom mention (*read*) · covers our angle: **partial** — the Jest layer only · fetched 2026-10-14
- **Also good:** [How to set up Jest with Next.js](https://nextjs.org/docs/app/guides/testing/jest) · Next.js 16.4 docs · jsdom, `@testing-library/react`, and jest-dom through `setupFilesAfterEnv` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Setup Jest and React Testing Library in a React project](https://dev.to/ivadyhabimana/setup-jest-and-react-testing-library-in-a-react-project-a-step-by-step-guide-1mf0) · Ivad Yves Habimana, DEV Community, 2022-05-17 · installs RTL, Jest and `jest-environment-jsdom`, wires jest-dom in a setup file, ends with a first test; Babel era, no MSW · fetched 2026-10-14 (*read*)
- **Our delta:** the page's setup recipe ends with MSW; a check after every layer is the part to make explicit.

### T11-02 · `setupFiles` versus `setupFilesAfterEnv` — Master · ✅ written `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`
- **Read this:** [Configuring Jest](https://jestjs.io/docs/configuration) · Jest docs · `setupFiles` configures the environment once per test file, before the framework is installed; `setupFilesAfterEnv` runs right after the framework is installed and is for code repeated in each test file (*read*) · covers our angle: **full** for the definitions · fetched 2026-10-14
- **Beyond the docs:** [jest-explore-config](https://github.com/rajatkumar/jest-explore-config) · rajatkumar, GitHub repo README (no date shown) · a small repo whose README explains that `setupFiles` has no `beforeAll`, `beforeEach` or other hooks and `setupFilesAfterEnv` does · fetched 2026-10-14 (*read*)
- **Our delta:** which of jest-dom, MSW lifecycle, polyfills and env vars belongs in which file; our page also lists this as an interview question twice.

### T11-03 · Vite and Vitest configuration architecture — Master · ✅ written `docs/jest-rtl/pages/16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md`
- **Read this:** [Configuring Vitest](https://vitest.dev/config/) · Vitest docs · extending Vite's config from a separate `vitest.config` with `mergeConfig(viteConfig, defineConfig({ ... }))`, and Vite options such as `resolve.alias` go at the top level, not inside `test` (*read*) · covers our angle: **partial** — the option pages for `environment`, `setupFiles` and `globals` are separate · fetched 2026-10-14
- **Also good:** [environment](https://vitest.dev/config/environment) · Vitest docs · `jsdom` is a supported environment; `environmentOptions` for custom settings (*read*); [setupFiles](https://vitest.dev/config/setupfiles) · they run before each test file in the same process (*read*) · fetched 2026-10-14
- **Also good:** [Migrating from Jest](https://vitest.dev/guide/migration/jest) · Vitest docs · globals are off by default, and with them off Testing Library's automatic cleanup does not run (*read*) · fetched 2026-10-14
- **Our delta:** flagged finding, now confirmed from the official config page: sharing aliases through `mergeConfig` is a supported route. Our page shows a standalone `vitest.config.ts` that repeats the alias, not the merge. A search found only config samples, so no Beyond line.

### T11-04 · The global polyfill checklist — Master · ✅ written `docs/jest-rtl/pages/16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md`
- **Read this:** [Testing with Jest (Mantine)](https://mantine.dev/guides/jest/) · Mantine docs · `matchMedia` via `Object.defineProperty` with `matches: false`, a no-op `ResizeObserver` class, a `scrollIntoView` stub, plus `document.fonts` and `getComputedStyle` shims (*read*) · covers our angle: **partial** — no `IntersectionObserver`, `TextEncoder` or `getContext` · fetched 2026-10-14
- **Also good:** [jest-canvas-mock](https://github.com/hustcc/jest-canvas-mock) · project README · the `getContext` row (*read*) · fetched 2026-10-14
- **Beyond the docs:** [jsdom-testing-mocks](https://github.com/trurl-master/jsdom-testing-mocks) · trurl-master, project README (no date shown) · ready-made `matchMedia` (`mockViewport`), `IntersectionObserver` and `ResizeObserver` mocks you can trigger by hand; `configMocks({ act })` for React; Jest and Vitest both confirmed (*read*) · fetched 2026-10-14
- **Our delta:** our page's `setupTests.ts` has only the `matchMedia` polyfill (and a `TextEncoder` mention under `setupFiles`). The rest of the checklist, `IntersectionObserver` (with `takeRecords`), `ResizeObserver`, `window.scrollTo`, `getContext`, is not written, and the file must stay free of mutable state.

### T11-05 · Fast transpilers: `@swc/jest`, `ts-jest`, `babel-jest` — Understand · ✅ written `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`
- **Read this:** [Jest (SWC usage)](https://swc.rs/docs/usage/jest) · SWC docs · install `@swc/core` and `@swc/jest`, map `'^.+\\.(t|j)sx?$'` to `@swc/jest`, `jsc.target` defaults from your Node version; no benchmark figures (*read*) · covers our angle: **partial** — setup, no timings · fetched 2026-10-14
- **Beyond the docs:** [Jest: from Babel to SWC](https://www.joshuakgoldberg.com/blog/jest-babel-to-swc) · Josh Goldberg, 2022-02-21 · his project's runs got 30–40% faster (10–13% with coverage and two workers), not 3–5x; install size grew from 186M to 330M · fetched 2026-10-14 (*read*)
- **Our delta:** flagged finding, verified: the syllabus "3–5x" is unsupported, and so are our page's "3x to 5x" and "up to 20x" lines. The measured source says 30–40%, and a search found a conflicting report of almost no gain for ts-jest to `@swc/jest`. Rewrite those lines as "often faster, measure on your suite" with the 30–40% datapoint.

### T11-06 · The ESM and `transformIgnorePatterns` resolution — Understand · ✅ written `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`
- **Read this:** [Configuring Jest](https://jestjs.io/docs/configuration) · Jest docs · `transformIgnorePatterns`: a file matching any pattern is not transformed; default is `/node_modules/` (*read*) · covers our angle: **partial** — the rule, not the ESM-only-package recipe · fetched 2026-10-14
- **Also good:** [ECMAScript Modules](https://jestjs.io/docs/ecmascript-modules) · Jest 30 docs · ESM support is experimental; needs `--experimental-vm-modules`; says nothing on transforming `node_modules` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Jest and ESM: Cannot use import statement outside a module](https://dev.to/steveruizok/jest-and-esm-cannot-use-import-statement-outside-a-module-4mmj) · Steve Ruiz, DEV Community, 2021-06-25 · the negative-lookahead pattern for one package plus a `transform` entry that runs `babel-jest` on `.js` and `.mjs`, which is why the pattern alone is not always enough (*read*) · fetched 2026-10-14
- **Our delta:** the negated pattern that lets one named package through, with `nanoid`, `axios` and `d3` as examples (our code sample lists `nanoid`, `@noble` and `lucide-react`).

### T11-07 · Module name mappers and asset mocking — Understand · ✅ written `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`
- **Read this:** [Using with webpack](https://jestjs.io/docs/webpack) · Jest docs · `moduleNameMapper` sends images and fonts to a `fileMock.js` stub and `.css` to `identity-obj-proxy`, where `styles.foobar === 'foobar'` (*read*) · covers our angle: **partial** — no path alias example · fetched 2026-10-14
- **Also good:** [How to set up Jest with Next.js](https://nextjs.org/docs/app/guides/testing/jest) · Next.js 16.4 docs · maps `@/components/*` from `tsconfig` paths to `<rootDir>/components/$1` (*read*) · fetched 2026-10-14
- **Also good:** [Paths mapping](https://kulshekhar.github.io/ts-jest/docs/getting-started/paths-mapping) · ts-jest docs · `pathsToModuleNameMapper` turns `compilerOptions.paths` into `moduleNameMapper`, with an optional `prefix` such as `<rootDir>/` (*read*) · fetched 2026-10-14
- **Our delta:** the generic `@/*` to `<rootDir>/src/*` mapping and SVG imports. A search returned config recipes only, so no Beyond line.

### T11-08 · Coverage thresholds and reporting — Understand · ✅ written `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`
- **Read this:** [Configuring Jest](https://jestjs.io/docs/configuration) · Jest docs · `coverageThreshold` (global, glob or path; Jest fails if unmet), `collectCoverageFrom`, `coverageReporters` (default `clover`, `json`, `lcov`, `text`), `coverageProvider` (`babel` default or `v8`) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** a strict per-metric threshold set and wiring lcov into CI. Third-party results were config snippets and aggregator posts, so no Beyond line.

---

## Phase 12 — CI performance, flakiness and the Vitest bridge

### T12-01 · CI tuning and worker orchestration — Understand · 🔲 not written
- **Read this:** [Troubleshooting](https://jestjs.io/docs/troubleshooting) · Jest docs · a Docker and CI section: `--runInBand`, `--maxWorkers=4`, and detecting cores in GitHub Actions; it does not cover memory (*read*) · covers our angle: **partial** — no OOM guidance · fetched 2026-10-14
- **Also good:** [Jest CLI](https://jestjs.io/docs/cli) · Jest docs · `--maxWorkers` defaults to cores minus one, `--maxWorkers=50%` for variable CPUs; `--logHeapUsage` helps find leaks (*read*) · fetched 2026-10-14
- **Also good:** [Configuring Jest](https://jestjs.io/docs/configuration) · Jest docs · `workerIdleMemoryLimit`: after each test the worker's memory is checked and the worker is killed and restarted above the limit; a percentage limit does not work on Linux CircleCI workers (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The ideal number of workers in Jest](https://www.peterbe.com/plog/ideal-number-of-workers-in-jest-maxWorkers) · Peter Bengtsson, 2018-10-08 · Jest saw 36 CPUs in a container and ran out of memory; `--maxWorkers=2` fixed it. Old, but the cause still applies · fetched 2026-10-14 (*read*)
- **Our delta:** flagged finding, verified: `workerIdleMemoryLimit` is a config option, documented on the Configuring Jest page and absent from the CLI page, which is why a CLI-only check missed it. Cover the `50%` form for variable runners, then `workerIdleMemoryLimit` as the leak work-around.

### T12-02 · Test sharding and parallelization — Understand · 🔲 not written
- **Read this:** [Jest CLI](https://jestjs.io/docs/cli) · Jest docs · `--shard=shardIndex/shardCount`, both 1-based; the configured `testSequencer` must implement a `shard` method (*read*) · covers our angle: **partial** — no CI wiring · fetched 2026-10-14
- **Also good:** [Troubleshooting](https://jestjs.io/docs/troubleshooting) · Jest docs · names `--shard` for splitting across machines (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Run Tests in Parallel in GitHub Actions](https://oneuptime.com/blog/post/2025-12-20-github-actions-parallel-tests/view) · OneUptime blog, 2025-12-20 · a `shard: [1, 2, 3, 4]` matrix running `npm test -- --shard=N/4` with `fail-fast: false`; no coverage merging (*read*) · fetched 2026-10-14
- **Our delta:** merging coverage across shards. A search found no Jest-native merge command, only a per-shard JSON output plus a separate merge tool, which I did not confirm.

### T12-03 · Root causes of flakiness and memory leaks — Understand · 🔲 not written
- **Read this:** [Timer mocks](https://jestjs.io/docs/timer-mocks) · Jest docs · `useFakeTimers`, `advanceTimersByTime`, `runOnlyPendingTimers` for recursive timers, and `useRealTimers` to restore (*read*) · covers our angle: **partial** — timers only · fetched 2026-10-14
- **Also good:** [Async methods](https://testing-library.com/docs/dom-testing-library/api-async) · Testing Library · wait on a condition with `waitFor` or `findBy`; the page does not discuss flakiness (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Jest: Your test suite is leaking memory](https://bobbyhadz.com/blog/jest-your-test-suite-is-leaking-memory-please-ensure-all-references-are-cleaned) · Borislav Hadzhiev, bobbyhadz, updated 2024-03-07 · the error's three causes (unfinished async work, unmocked timers, references to the global scope), `--logHeapUsage` with `--runInBand --expose-gc`, then `--maxWorkers 1` (*read*) · fetched 2026-10-14
- **Our delta:** unawaited work, real timers, detached DOM nodes and shared mock state as one list. Neither the Jest docs nor the search found a source on detached DOM nodes, so that part is ours.

### T12-04 · The Vitest migration bridge — Understand · ✅ written `docs/jest-rtl/pages/16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md`
- **Read this:** [Migrating from Jest](https://vitest.dev/guide/migration/jest) · Vitest docs · globals off by default; `vi.mock` factories must return each export explicitly; `jest.requireActual` becomes `await vi.importActual`; `jest.setTimeout` becomes `vi.setConfig`; `mockReset` restores the original implementation (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Migrating from Jest to Vitest for React testing](https://dev.to/eamonnprwalsh/migrating-from-jest-to-vitest-for-react-testing-ljn) · Eamonn Walsh, DEV Community, 2023-06-17 · seven steps: swap packages, setup file with jest-dom matchers and RTL `cleanup`, `test` block with `globals`, `jsdom` and `setupFiles`; warns Vitest does not type-check tests; written for an early Vitest, so use the official page for current behaviour (*read*) · fetched 2026-10-14
- **Our delta:** our page has the five-step list and the rename of `jest.fn`, `jest.spyOn` and `jest.mock`; the RTL-specific parts (cleanup with globals off, the jest-dom import) and the `vi.mock` factory difference are not there yet.
