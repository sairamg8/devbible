---
title: "Link map · Jest and RTL · Part 2 (phases 07–12)"
sidebar_label: "02 · advanced integration and ci"
sidebar_position: 2
---

# Link map · Jest and RTL · Part 2 (phases 07–12)

Covers every topic row of phases 7 to 12 in `docs/jest-rtl/syllabus/03-advanced-integration.md` (T07-01 to T10-05) and `docs/jest-rtl/syllabus/04-production-ci.md` (T11-01 to T12-04). That is 24 rows. Our pages are one per chapter, so several topics share a page: phase 7 maps to `11-custom-render`, phase 8 to `12-mocking-network-requests`, T10-01/02 to `13-testing-hooks`, T10-04 to `14-accessibility-testing`, T10-05 to `15-debugging-tests`, and phase 11 to `06-coverage-and-configuration` and `16-real-world-workflows-and-recipes`. Phase 9 (recipe catalog) and most of phase 12 have no page yet, and are marked not written.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line. Tier text is the syllabus tag capitalised; the tags on T09-01, T09-02, T10-02, T10-04, T11-01, T11-02 and T12-01 are not the usual Master, Understand or Know words, and are copied as written.

🔴 **Version notes.** TanStack Query links are v5 (`latest`). React Router links are the v7 docs; `createMemoryRouter` there is Data mode, and the testing guide centres on `createRoutesStub`. The Next.js Jest guide is the 16.4 page (lastUpdated 2026-08-25). The Jest pages are 30.x. The MSW listen page now documents `onUnhandledFrame` (default `"warn"`) and not `onUnhandledRequest`; our syllabus uses `onUnhandledRequest`, so check which name your installed `msw` accepts. Vitest links are the current docs (the migration page mentions Vitest 5.0 changes).

---

## Phase 7 — Custom render and state provider isolation

### T07-01 · The `renderWithProviders` pattern — Master · ✅ written `docs/jest-rtl/pages/11-custom-render/01-provider-wrapping.md`
- **Read this:** [Setup](https://testing-library.com/docs/react-testing-library/setup) · Testing Library · the Custom Render section: a `customRender` that passes a `wrapper` option to `render` and re-exports everything else from the library (*read*) · covers our angle: **partial** — shows the wrapper with a data provider, not a per-test store or router · fetched 2026-10-14
- **Beyond the docs:** [Setting up React Testing Library](https://github.com/nareshbhatia/react-testing-techniques/blob/main/docs/setting-up-react-testing-library.md) · Naresh Bhatia, GitHub docs repo (no date shown) · argues the custom render should mirror the real app's global providers and links a `test-utils.tsx` example; the page is short, so read the linked file for the code · fetched 2026-10-14 (*headings only*)
- **Our delta:** the single-entrypoint re-export, the ESLint rule that blocks importing `render` from the library directly, and the per-test isolation gotchas.

### T07-02 · Testing with Redux Toolkit — Understand · ✅ written `docs/jest-rtl/pages/11-custom-render/01-provider-wrapping.md`
- **Read this:** [Writing Tests](https://redux.js.org/usage/writing-tests) · Redux docs · `renderWithProviders`, a `setupStore` factory that calls `configureStore` with an optional `preloadedState`, and the rule that each test gets its own store (*read*) · covers our angle: **full** — nearly the same shape as our helper · fetched 2026-10-14
- **Our delta:** asserting on dispatched actions through the returned store, and how the helper composes with the router and query client.

### T07-03 · Testing with TanStack Query — Understand · ✅ written `docs/jest-rtl/pages/11-custom-render/01-provider-wrapping.md`
- **Read this:** [Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing) · TanStack Query v5 docs · default is three retries with backoff, so set `retry: false` in the client's `defaultOptions.queries` (a per-query `retry` overrides it); a fresh `QueryClient` in the wrapper isolates tests (*read*) · covers our angle: **partial** — says `gcTime: Infinity` (not `0`) to stop Jest's "did not exit" warning, only when you set `gcTime` yourself · fetched 2026-10-14
- **Beyond the docs:** [Testing React Query](https://tkdodo.eu/blog/testing-react-query) · TkDodo (Dominik Dorfmeister), first published 2021-04-04, updated 2023-10-21 · one client per test over clearing a shared cache, retries off, and MSW as the single API mock; predates some v5 renames, so read for reasoning · fetched 2026-10-14 (*read*)
- **Our delta:** the `gcTime: 0` choice versus the docs' `Infinity`, and why the two differ.

### T07-04 · Testing with React Router — Understand · ✅ written `docs/jest-rtl/pages/11-custom-render/01-provider-wrapping.md`
- **Read this:** [createMemoryRouter](https://reactrouter.com/api/data-routers/createMemoryRouter) · React Router v7 docs · keeps history in memory, takes `initialEntries` and `initialIndex`, is passed to `RouterProvider`, and should be created once outside the React tree (*read*) · covers our angle: **partial** — no test example on the page · fetched 2026-10-14
- **Also good:** [Testing](https://reactrouter.com/start/framework/testing) · React Router v7 docs · `createRoutesStub` for unit testing components that need router context; says to use E2E tools for whole routes. It does not mention `createMemoryRouter` (*read*) · fetched 2026-10-14
- **Our delta:** nested routes and search params with `createMemoryRouter`, and reading the location back for navigation assertions. The official testing page steers away from this style, so our page should say when that is a fair choice.

---

## Phase 8 — Network mocking with MSW v2

### T08-01 · MSW v2 setup and lifecycle — Master · ✅ written `docs/jest-rtl/pages/12-mocking-network-requests/01-api-level-mocking.md`
- **Read this:** [Node.js integration](https://mswjs.io/docs/integrations/node) · MSW docs · `setupServer` from `msw/node`, a synchronous `listen`, `resetHandlers` in `afterEach`, and `close` in `afterAll` (*read*) · covers our angle: **partial** — does not cover unhandled requests · fetched 2026-10-14
- **Also good:** [Quick start](https://mswjs.io/docs/quick-start) · MSW docs · the five-step setup with a Vitest setup file; Jest wiring is the same hooks in `setupFilesAfterEnv` (*read*) · fetched 2026-10-14
- **Also good:** [listen()](https://mswjs.io/docs/api/setup-server/listen) · MSW docs · the unhandled-request option is documented here as `onUnhandledFrame`, default `"warn"`, with `"error"` and `"bypass"` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Stop mocking fetch](https://kentcdodds.com/blog/stop-mocking-fetch) · Kent C. Dodds, 2020-06-03 · why mocking `fetch` per test hides bad request formats and headers, and why one shared mock server is better; uses an older MSW API · fetched 2026-10-14 (*read*)
- **Our delta:** `'error'` as the project default and the drift between `onUnhandledRequest` and `onUnhandledFrame`.

### T08-02 · Request handlers and responses — Master · ✅ written `docs/jest-rtl/pages/12-mocking-network-requests/01-api-level-mocking.md`
- **Read this:** [Path parameters](https://mswjs.io/docs/http/intercepting-requests/path-parameters) · MSW docs · `:id`, optional `:id?`, repeating `:segments+`; values are always strings or string arrays (*read*) · covers our angle: **partial** — route params only · fetched 2026-10-14
- **Also good:** [Query parameters](https://mswjs.io/docs/http/intercepting-requests/query-parameters) · MSW docs · build a `URL` from `request.url` and use `searchParams.get` or `getAll` (*read*) · fetched 2026-10-14
- **Our delta:** reading JSON request bodies and asserting the POST payload (neither fetched page covers the body).

### T08-03 · Per-test handler overrides — Understand · ✅ written `docs/jest-rtl/pages/12-mocking-network-requests/01-api-level-mocking.md`
- **Read this:** [Network behavior overrides](https://mswjs.io/docs/best-practices/network-behavior-overrides) · MSW docs · `server.use()` prepends handlers that win over the initial ones, overrides are permanent until `resetHandlers()`, and `{ once: true }` limits one to a single request (*read*) · covers our angle: **full** for overrides · fetched 2026-10-14
- **Also good:** [Error responses](https://mswjs.io/docs/http/mocking-responses/error-responses) · MSW docs · 404 with a null body, 401 with a JSON body (*read*); [Network errors](https://mswjs.io/docs/recipes/network-errors) · `HttpResponse.error()` aborts the request and the client sees a generic `TypeError` (*read*) · fetched 2026-10-14
- **Also good:** [Response timing](https://mswjs.io/docs/http/mocking-responses/response-timing) · MSW docs · `await delay(ms)` inside a resolver; the Node-specific behaviour is in the API reference, which I did not fetch (*read*) · fetched 2026-10-14
- **Our delta:** the 500 case (no official 500 example) and the order-dependent failure when an override leaks into the next test.

### T08-04 · Testing loading, error and optimistic states — Understand · ✅ written `docs/jest-rtl/pages/12-mocking-network-requests/01-api-level-mocking.md`
- **Read this:** [Async methods](https://testing-library.com/docs/dom-testing-library/api-async) · Testing Library · `findBy` is `getBy` plus `waitFor`; `waitFor` retries a callback that throws, 1000 ms timeout and 50 ms interval by default (*read*) · covers our angle: **partial** — no loading or error example · fetched 2026-10-14
- **Also good:** [Network behavior overrides](https://mswjs.io/docs/best-practices/network-behavior-overrides) · MSW docs · the override mechanism for the error and retry paths (*read*) · fetched 2026-10-14
- **Our delta:** the skeleton, error banner and retry-button flow as one worked test, plus the optimistic case. I found no clean third-party walkthrough of a retry button, so there is no Beyond line.

---

## Phase 9 — Mocking third-party and external libraries (recipe catalog)

### T09-01 · Portalled UI primitives — Modal · 🔲 not written
- **Read this:** [Select cannot be opened with Testing Library (issue 1822)](https://github.com/radix-ui/primitives/issues/1822) · Radix primitives issue tracker · `userEvent.click` fails with "hasPointerCapture is not a function"; workarounds: stub `hasPointerCapture`, `releasePointerCapture` and `scrollIntoView`, query by role, await the event, or drive the hidden native select. Some commenters report the stubs break forms (*read*) · covers our angle: **partial** — Select only · fetched 2026-10-14
- **Beyond the docs:** [Vitest Browser Modeがアツい](https://zenn.dev/apple_yagi/articles/b2b96af1fd355c) · Yanagi, Zenn, 2024-07-17 · Radix Tooltip needs `ResizeObserver`, which jsdom lacks, so the test stubs it in `beforeAll`; the post's point is that Browser Mode avoids this. In Japanese · fetched 2026-10-14 (*read*)
- **Our delta:** `baseElement` and `screen` for content outside the container, and one shared stub list in `setupTests.ts`. Radix has no testing page of its own, so no official link.

### T09-02 · Framework navigation hooks — Router · 🔲 not written
- **Read this:** [Mock functions](https://jestjs.io/docs/mock-functions) · Jest docs · `jest.mock` on a module, `mockReturnValue`, and partial mocks through a factory (*read*) · covers our angle: **partial** — the mechanism, nothing router-specific · fetched 2026-10-14
- **Also good:** [How to set up Jest with Next.js](https://nextjs.org/docs/app/guides/testing/jest) · Next.js 16.4 docs · config and `next/jest` only; it does not show how to mock `next/navigation` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Mocking Next 16 useParams, useSearchParams, usePathname and useRouter in Jest](https://dev.to/peterlidee/mocking-next-16-useparams-usesearchparams-usepathname-and-userouter-in-jest-2l7k) · Peter Jacxsens, DEV Community, 2025-11-26 · `jest.mock('next/navigation')`, `useSearchParams` needs `get` and `toString`, `useRouter` returns a `push` spy; async `params` with `use()` is not covered · fetched 2026-10-14 (*read*)
- **Our delta:** `useNavigate` and `next/router` (Pages Router) in the same table, and a controllable-spy helper.

### T09-03 · Animation libraries (`framer-motion`) — Understand · 🔲 not written
- **Read this:** [MotionConfig](https://motion.dev/docs/react-motion-config) · Motion docs · `reducedMotion` is a site-wide policy, but it disables only transform and layout animations; opacity and colour still animate (*read*) · covers our angle: **partial** — no instant-finish switch on this page · fetched 2026-10-14
- **Beyond the docs:** [Mocking framer-motion v9](https://dev.to/pgarciacamou/mocking-framer-motion-v9-7jh) · Pablo Garcia, DEV Community, 2025-06-16 · keeps the real `AnimatePresence` and forces zero durations through a Proxy, so exit lifecycles still run; the author lists its fragility (*read*) · fetched 2026-10-14
- **Our delta:** choosing between a passthrough mock (fast, exits never run) and zero durations (exits run), and the package rename from `framer-motion` to `motion`.

### T09-04 · Icon and asset packages — Know · ✅ written `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`
- **Read this:** [Using with webpack](https://jestjs.io/docs/webpack) · Jest docs · `moduleNameMapper` to a stub file for images and fonts, `identity-obj-proxy` for styles (*read*) · covers our angle: **partial** — static assets, not icon packages · fetched 2026-10-14
- **Also good:** [Manual mocks](https://jestjs.io/docs/manual-mocks) · Jest docs · a `__mocks__` folder next to `node_modules` mocks a package automatically (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Jest with SVGR](https://react-svgr.com/docs/jest/) · SVGR docs · a mapped `.svg` mock exporting a `div`; notes snapshots then include the icon's props (*read*) · fetched 2026-10-14
- **Our delta:** a `lucide-react` mock specifically. A search found nothing lucide-specific, so this page is our own.

### T09-05 · Canvas and charting libraries — Understand · 🔲 not written
- **Read this:** [jest-canvas-mock](https://github.com/hustcc/jest-canvas-mock) · project README · replaces `getContext` with a mock 2D context, set up through `setupFiles`; `jest.resetAllMocks()` removes it, so call `setupJestCanvasMock()` again (*read*) · covers our angle: **partial** — canvas only, not container sizing · fetched 2026-10-14
- **Beyond the docs:** [Recharts (Mastering Jest)](https://www.educative.io/courses/mastering-jest-a-complete-guide-to-testing/recharts) · Educative course lesson (no date) · a partial mock via `requireActual` swaps `ResponsiveContainer` for a plain div; the visible excerpt omits the code · fetched 2026-10-14 (*headings only*)
- **Our delta:** stubbing the `ResizeObserver` that `ResponsiveContainer` relies on, and asserting props passed to the chart wrapper. Recharts has no testing guide.

### T09-06 · Third-party client SDKs — Understand · 🔲 not written
- **Read this:** [The Jest Object](https://jestjs.io/docs/jest-object) · Jest docs · `jest.mock` with a factory, `jest.spyOn`, and `jest.requireActual` for partial mocks (*read*) · covers our angle: **partial** — generic; no SDK specifics · fetched 2026-10-14
- **Our delta:** the Firebase `onAuthStateChanged` pattern (capture the callback, call it by hand), Supabase chaining and Google Maps callbacks. A search turned up a Sentry Jest setup that mocks `@stripe/stripe-js`, but I did not fetch it, so it is not linked; Firebase and Supabase examples were partial, so those parts are ours.

### T09-07 · Browser storage and native Web APIs — Understand · 🔲 not written
- **Read this:** [Clipboard](https://testing-library.com/docs/user-event/clipboard) · Testing Library user-event · `userEvent.setup()` replaces `navigator.clipboard` with a stub; `copy`, `cut` and `paste` use it (*read*) · covers our angle: **partial** — clipboard only · fetched 2026-10-14
- **Also good:** [The Jest Object](https://jestjs.io/docs/jest-object) · Jest docs · `jest.spyOn(Storage.prototype, 'setItem')` follows from the `spyOn` section; calling the original by default is the part to override (*read*) · fetched 2026-10-14
- **Our delta:** `Object.defineProperty` storage mocks, a `QuotaExceededError` from `setItem`, and restoring in `afterEach`. No source combined these, so there is no Beyond line.

---

## Phase 10 — Custom hooks, React 19 patterns and accessibility

### T10-01 · Testing custom hooks with `renderHook` — Understand · ✅ written `docs/jest-rtl/pages/13-testing-hooks/01-render-hook.md`
- **Read this:** [React Testing Library API](https://testing-library.com/docs/react-testing-library/api) · Testing Library · `renderHook`: `result.current` is the last committed value, `rerender` with new props, `initialProps`, and `wrapper`; `initialProps` are not passed to the wrapper (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** wrapping state-changing callbacks in `act`, and the stale-destructure pitfall.

### T10-02 · Test a hook directly or through a component — Coupled · ✅ written `docs/jest-rtl/pages/13-testing-hooks/01-render-hook.md`
- **Read this:** [Testing custom hooks](https://www.epicreact.dev/modules/testing-react-apps-v1/testing-custom-hooks-intro) · Kent C. Dodds, Epic React · test through the component for hooks used by one or two components; test directly for reusable or library hooks (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** the `renderHook` docs above say to prefer `render` when possible.
- **Our delta:** `useDebounce` and `useLocalStorage` as worked cases of the reusable side.

### T10-03 · Testing React 19 Actions and forms — Understand · 🔲 not written
- **Read this:** [useActionState](https://react.dev/reference/react/useActionState) · react.dev · returns `[state, dispatchAction, isPending]`; dispatch must run inside a Transition (a `form action` counts); a thrown error cancels queued actions (*read*) · covers our angle: **partial** — no testing section · fetched 2026-10-14
- **Also good:** [useFormStatus](https://react.dev/reference/react-dom/hooks/useFormStatus) · react.dev · must be called from a component rendered inside the form; in the form's own component `pending` stays false (*read*) · fetched 2026-10-14
- **Our delta:** submit, assert the pending label, then `findBy` the resulting state; and `useOptimistic`. A search found no RTL walkthrough, so there is no Beyond line.

### T10-04 · Accessibility auditing with `jest-axe` — Axe · ✅ written `docs/jest-rtl/pages/14-accessibility-testing/01-a11y-assertions.md`
- **Read this:** [jest-axe README](https://github.com/NickColley/jest-axe) · project README · `expect(await axe(html)).toHaveNoViolations()`, `configureAxe`, colour contrast is off because it does not work in jsdom, and axe does not work with fake timers (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Automatically testing for accessibility issues with jest-axe](https://maxrozen.com/automatic-a11y-testing-with-jest-axe) · Max Rozen (no date shown) · a short RTL example, and a plain statement that it finds markup problems but cannot prove a component is accessible · fetched 2026-10-14 (*read*)
- **Our delta:** focus management and Escape handling that axe does not check, and re-running axe after interaction.

### T10-05 · Debugging utilities and DOM inspection — Know · ✅ written `docs/jest-rtl/pages/15-debugging-tests/01-diagnostic-tools.md`
- **Read this:** [Debugging](https://testing-library.com/docs/dom-testing-library/api-debugging) · Testing Library · `screen.debug()`, `prettyDOM`, `logTestingPlaygroundURL`, and `DEBUG_PRINT_LIMIT` (default 7000 characters) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Using the React Testing Library debug method](https://blog.logrocket.com/using-react-testing-library-debug-method/) · Ibadehin Mojeed, LogRocket, 2023-11-03 · debug before and after async loads, `logRoles`, and the playground link · fetched 2026-10-14 (*read*)
- **Our delta:** keeping debug calls out of CI logs and attaching a Node inspector.

---

## Phase 11 — Configuration architecture, `setupTests` and polyfills

### T11-01 · Step-by-step setup from zero — Dom · ✅ written `docs/jest-rtl/pages/16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md`
- **Read this:** [Getting started](https://jestjs.io/docs/getting-started) · Jest 30 docs · install, config generation, Babel and TypeScript, and a note that Vite is not officially supported (use Vitest). No jsdom mention (*read*) · covers our angle: **partial** — the Jest layer only · fetched 2026-10-14
- **Also good:** [How to set up Jest with Next.js](https://nextjs.org/docs/app/guides/testing/jest) · Next.js 16.4 docs · jsdom, `@testing-library/react`, and jest-dom through `setupFilesAfterEnv` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Setup Jest and React Testing Library in a React project](https://dev.to/ivadyhabimana/setup-jest-and-react-testing-library-in-a-react-project-a-step-by-step-guide-1mf0) · Ivady Habimana, DEV Community, 2022-05-17 · seven ordered steps ending in a first passing test; Babel era, no MSW · fetched 2026-10-14 (*read*)
- **Our delta:** a check after every layer, and MSW as the last layer.

### T11-02 · `setupFiles` versus `setupFilesAfterEnv` — Level · ✅ written `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`
- **Read this:** [Configuring Jest](https://jestjs.io/docs/configuration) · Jest docs · `setupFiles` configures the environment once per test file; `setupFilesAfterEnv` configures the framework before each test file (*read*) · covers our angle: **full** for the definitions · fetched 2026-10-14
- **Our delta:** which of jest-dom, MSW lifecycle, polyfills and env vars belongs in which file. A search for a third-party explainer returned only config files and a migration note, so no Beyond line.

### T11-03 · Vite and Vitest configuration architecture — Master · ✅ written `docs/jest-rtl/pages/16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md`
- **Read this:** [Configuring Vitest](https://vitest.dev/config/) · Vitest docs · the config reference lists `environment`, `setupFiles` and `globals` (*headings only*) · covers our angle: **partial** — I only saw the option names · fetched 2026-10-14
- **Also good:** [Migrating from Jest](https://vitest.dev/guide/migration/jest) · Vitest docs · globals are off by default, and with them off Testing Library's automatic cleanup does not run (*read*) · fetched 2026-10-14
- **Our delta:** sharing `resolve.alias` between `vite.config.ts` and `vitest.config.ts` with `mergeConfig`. I did not confirm that from an official page.

### T11-04 · The global polyfill checklist — Master · ✅ written `docs/jest-rtl/pages/16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md`
- **Read this:** [Testing with Jest (Mantine)](https://mantine.dev/guides/jest/) · Mantine docs · `matchMedia` via `Object.defineProperty` with `matches: false`, a no-op `ResizeObserver` class, and a `scrollIntoView` stub (*read*) · covers our angle: **partial** — no `IntersectionObserver`, `TextEncoder` or `getContext` · fetched 2026-10-14
- **Also good:** [jest-canvas-mock](https://github.com/hustcc/jest-canvas-mock) · project README · the `getContext` row (*read*) · fetched 2026-10-14
- **Our delta:** `IntersectionObserver` (with `takeRecords`), `window.scrollTo`, `TextEncoder`, and keeping the file free of mutable state.

### T11-05 · Fast transpilers: `@swc/jest`, `ts-jest`, `babel-jest` — Understand · ✅ written `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`
- **Read this:** [Jest (SWC usage)](https://swc.rs/docs/usage/jest) · SWC docs · install `@swc/core` and `@swc/jest`, map `^.+\\.(t|j)sx?$` to `@swc/jest`, optional ESM, `jsc.target` (*read*) · covers our angle: **partial** — setup, no timings · fetched 2026-10-14
- **Beyond the docs:** [Jest: from Babel to SWC](https://www.joshuakgoldberg.com/blog/jest-babel-to-swc) · Josh Goldberg, 2022-02-21 · his project's runs got 30–40% faster (10–13% with coverage), not 3–5x; install size grew from 186M to 330M · fetched 2026-10-14 (*read*)
- **Our delta:** the "3–5x" claim in the syllabus is not backed by what I found: this source says 30–40%, and a PR comparison I saw showed about 2x against `ts-jest`. Treat the syllabus figure as unsupported until measured.

### T11-06 · The ESM and `transformIgnorePatterns` resolution — Understand · ✅ written `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`
- **Read this:** [Configuring Jest](https://jestjs.io/docs/configuration) · Jest docs · `transformIgnorePatterns`: a file matching any pattern is not transformed (*read*) · covers our angle: **partial** — the rule, not the ESM-only-package recipe · fetched 2026-10-14
- **Also good:** [ECMAScript Modules](https://jestjs.io/docs/ecmascript-modules) · Jest 30 docs · ESM support is experimental; needs `--experimental-vm-modules`; says nothing on transforming `node_modules` (*read*) · fetched 2026-10-14
- **Our delta:** the negated pattern that lets one named package through, with `nanoid`, `axios` and `d3` as examples. Some reports say the pattern alone is not enough without a transform that handles `.js`.

### T11-07 · Module name mappers and asset mocking — Understand · ✅ written `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`
- **Read this:** [Using with webpack](https://jestjs.io/docs/webpack) · Jest docs · `moduleNameMapper` sends images and fonts to a `fileMock.js` stub and `.css` to `identity-obj-proxy`, where `styles.foobar === 'foobar'` (*read*) · covers our angle: **partial** — no path alias example · fetched 2026-10-14
- **Also good:** [How to set up Jest with Next.js](https://nextjs.org/docs/app/guides/testing/jest) · Next.js 16.4 docs · maps `@/components/*` from `tsconfig` paths to `<rootDir>/components/$1` (*read*) · fetched 2026-10-14
- **Our delta:** the generic `@/*` to `<rootDir>/src/*` mapping and SVG imports.

### T11-08 · Coverage thresholds and reporting — Understand · ✅ written `docs/jest-rtl/pages/06-coverage-and-configuration/01-jest-config.md`
- **Read this:** [Configuring Jest](https://jestjs.io/docs/configuration) · Jest docs · `coverageThreshold` (global, glob or path; Jest fails if unmet), `collectCoverageFrom`, `coverageReporters` (any Istanbul reporter), `coverageProvider` (`babel` default or `v8`) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** a strict per-metric threshold set and wiring lcov into CI. Third-party results were config snippets only, so no Beyond line.

---

## Phase 12 — CI performance, flakiness and the Vitest bridge

### T12-01 · CI tuning and worker orchestration — Of · 🔲 not written
- **Read this:** [Troubleshooting](https://jestjs.io/docs/troubleshooting) · Jest docs · a Docker and CI section: `--runInBand`, `--maxWorkers=4`, and detecting cores in GitHub Actions (*read*) · covers our angle: **partial** — no OOM guidance · fetched 2026-10-14
- **Also good:** [Jest CLI](https://jestjs.io/docs/cli) · Jest docs · `--maxWorkers` defaults to cores minus one, accepts `50%`; `--logHeapUsage` helps find leaks (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The ideal number of workers in Jest](https://www.peterbe.com/plog/ideal-number-of-workers-in-jest-maxWorkers) · Peter Bengtsson, 2018-10-08 · Jest saw 36 CPUs in a container and ran out of memory; capping workers fixed it. Old, but the cause still applies · fetched 2026-10-14 (*read*)
- **Our delta:** the `50%` form for variable runners, and `--workerIdleMemoryLimit` (not found on the CLI page, so unverified).

### T12-02 · Test sharding and parallelization — Understand · 🔲 not written
- **Read this:** [Jest CLI](https://jestjs.io/docs/cli) · Jest docs · `--shard=shardIndex/shardCount`, both 1-based; the configured `testSequencer` must implement `shard` (*read*) · covers our angle: **partial** — no CI wiring · fetched 2026-10-14
- **Also good:** [Troubleshooting](https://jestjs.io/docs/troubleshooting) · Jest docs · names `--shard` for splitting across machines (*read*) · fetched 2026-10-14
- **Our delta:** a GitHub Actions matrix, `fail-fast: false`, and merging coverage across shards. Search results here were secondary and unfetched, so no Beyond line.

### T12-03 · Root causes of flakiness and memory leaks — Understand · 🔲 not written
- **Read this:** [Timer mocks](https://jestjs.io/docs/timer-mocks) · Jest docs · `useFakeTimers`, `advanceTimersByTime`, `runOnlyPendingTimers` for recursive timers, and `useRealTimers` to restore (*read*) · covers our angle: **partial** — timers only · fetched 2026-10-14
- **Also good:** [Async methods](https://testing-library.com/docs/dom-testing-library/api-async) · Testing Library · wait on a condition with `waitFor` or `findBy`; the page does not discuss flakiness (*read*) · fetched 2026-10-14
- **Our delta:** unawaited work, real timers, detached DOM nodes and shared mock state as one list, with `--logHeapUsage` for leaks. I did not find a good Jest-specific source on detached nodes, so there is no Beyond line.

### T12-04 · The Vitest migration bridge — Understand · ✅ written `docs/jest-rtl/pages/16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md`
- **Read this:** [Migrating from Jest](https://vitest.dev/guide/migration/jest) · Vitest docs · globals off by default; `vi.mock` factories must return each export explicitly; `jest.requireActual` becomes `await vi.importActual`; `jest.setTimeout` becomes `vi.setConfig`; `mockReset` restores the original implementation (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the RTL-specific parts (cleanup with globals off, the jest-dom import) and a rename table for `jest.fn`, `jest.spyOn` and `jest.mock`. Third-party guides found were mostly unfetched, so no Beyond line.
