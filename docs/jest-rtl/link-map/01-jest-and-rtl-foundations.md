---
title: "Link map · Jest and RTL · Part 1 (phases 01–06)"
sidebar_label: "01 · jest and rtl foundations"
sidebar_position: 1
---

# Link map · Jest and RTL · Part 1 (phases 01–06)

Covers every topic row of phases 1 to 6 in `docs/jest-rtl/syllabus/01-jest-runner.md` (T01-01 to T03-05) and `docs/jest-rtl/syllabus/02-rtl-foundations.md` (T04-01 to T06-04). That is 24 rows. Our track has one page per chapter, so several topics share one page path below; where the page only touches a topic in a gotcha or an interview question, the Our delta line says so.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry the date the page shows. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line.

🔴 **Version note.** Our pages were verified against Jest 29.7 / 30.x. The jestjs.io pages below are the Jest 30.5 docs and were live on 2026-10-14. Testing Library pages (user-event v14) are current. The `act` guidance links to react.dev (React 19). Kent C. Dodds posts date from 2020 and predate user-event v14 and React 18 and 19, but the reasoning stands. Two pages do not say what the syllabus row says: the timer-mocks guide never mentions modern versus legacy timers, and the user-event setup page does not say to call `setup()` before `render`. Each affected block flags it.

---

## Phase 1 — Test structure and execution lifecycle

### T01-01 · Test registration vs execution — Master · ✅ written `docs/jest-rtl/pages/01-jest-core-concepts/01-test-structure.md`
- **Read this:** [Setup and Teardown](https://jestjs.io/docs/setup-teardown) · jestjs.io · says Jest runs all `describe` handlers in a file before any test, so setup belongs in `before*` hooks, not in a `describe` body (*read*) · covers our angle: **partial** — states the rule and the log order, not the AST-like tree · fetched 2026-10-14
- **Beyond the docs:** [Jest Recap: What Runs When?](https://dev.to/htho/jest-recap-what-runs-when-4475) · Hauke T., DEV Community, 2024-07-18 · a worked log of describe bodies, hooks and tests showing "everything on the top-level and in describe callbacks is executed immediately" · fetched 2026-10-14 (*read*)
- **Our delta:** the registration tree and why a `console.log` in a `describe` prints before `beforeAll`.

### T01-02 · Hook scoping and cascading — Understand · ✅ written `docs/jest-rtl/pages/01-jest-core-concepts/01-test-structure.md`
- **Read this:** [Setup and Teardown](https://jestjs.io/docs/setup-teardown) · jestjs.io · the nested example with its printed order: outer `beforeEach` first, inner `afterEach` first (*read*) · covers our angle: **full** — covers `beforeEach` and `afterEach`; `beforeAll` and `afterAll` scoping comes from the third-party page · fetched 2026-10-14
- **Beyond the docs:** [Jest Recap: What Runs When?](https://dev.to/htho/jest-recap-what-runs-when-4475) · Hauke T., DEV Community, 2024-07-18 · adds `beforeAll` and `afterAll` ordering, outer to inner and inner to outer · fetched 2026-10-14 (*read*)
- **Our delta:** an error thrown in `beforeAll` versus `beforeEach`.

### T01-03 · Data-driven parameterization — Understand · ✅ written `docs/jest-rtl/pages/01-jest-core-concepts/01-test-structure.md`
- **Read this:** [Jest Globals API](https://jestjs.io/docs/api) · jestjs.io · the `test.each` and `describe.each` entries for the array table and the tagged template (pipe-separated header, `${value}` cells, `$variable` in titles) (*read*) · covers our angle: **full** for syntax, **partial** for the choice between the two forms · fetched 2026-10-14
- **Beyond the docs:** [How to Use Jest each to Get More Code Coverage with Less Test Code](https://geshan.com.np/blog/2024/07/it.each-jest/) · Geshan Manandhar, 2024-07-06 · before and after of repeated `it` blocks collapsed into one `it.each` table, in both syntaxes · fetched 2026-10-14 (*read*)
- **Our delta:** the intermittent-failure gotcha with object payloads and why a loop inside one test hides which row failed.

### T01-04 · Test filtering and debugging flags — Know · ✅ written `docs/jest-rtl/pages/01-jest-core-concepts/01-test-structure.md`
- **Read this:** [Jest Globals API](https://jestjs.io/docs/api) · jestjs.io · the `test.only`, `test.skip`, `test.todo` and `test.concurrent` entries with their `.each` variants (*read*) · covers our angle: **partial** — the API only; the CI risk is in the lint rule · fetched 2026-10-14
- **Also good:** [no-focused-tests](https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-focused-tests.md) · eslint-plugin-jest · flags `.only`, `fit`, `fdescribe`; on in the `recommended` config; cannot catch an aliased `describe.only` (*read*) · fetched 2026-10-14
- **Our delta:** the CI story of 1 test run and 50 skipped, passing green.

---

## Phase 2 — Assertions, matchers and snapshots

### T02-01 · The `expect` API and equality semantics — Master · ✅ written `docs/jest-rtl/pages/02-assertions-and-matchers/01-the-expect-api.md`
- **Read this:** [Expect](https://jestjs.io/docs/expect) · jestjs.io · `toBe` uses `Object.is`; `toEqual` ignores `undefined` properties, sparseness and type; `toStrictEqual` checks all three, with a class-versus-literal example (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Jest: toEqual or toStrictEqual? The difference.](https://ultimatecourses.com/blog/jest-toequal-tostrictequal-difference) · Todd Motto, Ultimate Courses, 2023-01-30 · a `Pizza` class instance passes `toEqual` against a literal and fails `toStrictEqual`; argues for `toStrictEqual` as the default · fetched 2026-10-14 (*read*)
- **Our delta:** the "x.method is not a function" production crash that `toEqual` lets through.

### T02-02 · Asynchronous assertions and modifiers — Understand · ✅ written `docs/jest-rtl/pages/04-async-testing/01-handling-asynchrony.md`
- **Read this:** [Testing Asynchronous Code](https://jestjs.io/docs/asynchronous) · jestjs.io · `.resolves` and `.rejects` must be returned or awaited or the test ends early; `expect.assertions(n)` guards a `.catch` path (*read*) · covers our angle: **full** for the false-pass rule · fetched 2026-10-14
- **Also good:** [Expect](https://jestjs.io/docs/expect) · jestjs.io · `await expect(Promise.reject(new Error('octopus'))).rejects.toThrow('octopus')` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Demystifying Jest Async Testing Patterns](https://dev.to/lirantal/demystifying-jest-async-testing-patterns-4n5n) · Liran Tal, DEV Community, 2019-05-20 · a test that never returns its promise passes while the assertion would fail; a `try/catch` test passes when nothing throws; when `expect.assertions` helps and when it is noise · fetched 2026-10-14 (*read*)
- **Our delta:** `expect(async () => ...).toThrow()` on async functions, and unhandled rejections after the test ends.

### T02-03 · Asymmetric matchers — Understand · ✅ written `docs/jest-rtl/pages/02-assertions-and-matchers/01-the-expect-api.md`
- **Read this:** [Expect](https://jestjs.io/docs/expect) · jestjs.io · `expect.any`, `expect.objectContaining`, `expect.arrayContaining` and `expect.stringContaining`, each with an example (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Snapshot Testing](https://jestjs.io/docs/snapshot-testing) · jestjs.io · the property-matcher form, `{ id: expect.any(Number), createdAt: expect.any(Date) }`, for generated IDs and dates (*read*) · fetched 2026-10-14
- **Our delta:** the intermittent failure from dynamic timestamps.

### T02-04 · Snapshot testing mechanics — Know · ✅ written `docs/jest-rtl/pages/05-snapshot-testing/01-snapshot-mechanics.md`
- **Read this:** [Snapshot Testing](https://jestjs.io/docs/snapshot-testing) · jestjs.io · inline snapshots written back into the test source (Prettier needed), property matchers, "treat snapshots as code", and the `no-large-snapshots` lint rule (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Effective Snapshot Testing](https://kentcdodds.com/blog/effective-snapshot-testing) · Kent C. Dodds, 2017-10-30 · quotes the objection that snapshots go unreviewed and get regenerated; keeps them for error messages, Babel output and CSS-in-JS; says avoid huge ones · fetched 2026-10-14 (*read*)
- **Our delta:** why a large DOM snapshot asserts nothing, `-u` as a reflex, stale `.snap` files.

### T02-05 · Custom matchers with `expect.extend` — When · ✅ written `docs/jest-rtl/pages/02-assertions-and-matchers/01-the-expect-api.md`
- **Read this:** [Expect](https://jestjs.io/docs/expect) · jestjs.io · the `expect.extend` entry with the `toBeWithinRange` example returning `pass` and a `message` function, using `this.utils.printReceived` (*read*) · covers our angle: **partial** — the diff output is not shown · fetched 2026-10-14
- **Beyond the docs:** [Making custom Jest assertion matchers in JavaScript and TypeScript](https://dev.to/andyhaskell/making-custom-jest-assertion-matchers-in-javascript-and-typescript-15ij) · Andy Haskell, DEV Community, 2020-12-29 · builds `toBeWithinOneMinuteOf`, handles the `.not` message, adds the TypeScript declaration · fetched 2026-10-14 (*read*)
- **Our delta:** diagnostic diffs in the failure message.

---

## Phase 3 — Mocking and deterministic isolation

### T03-01 · Mock functions (`jest.fn`) — Master · ✅ written `docs/jest-rtl/pages/03-mocking/01-jest-mock-functions.md`
- **Read this:** [Mock Functions](https://jestjs.io/docs/mock-functions) · jestjs.io · the `.mock` property (`calls`, `results`, `instances`, `contexts`, `lastCall`), `mockReturnValue`, `mockImplementation`, and `mockResolvedValue` in the axios example (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** none beyond the lifecycle gotchas on the same page.

### T03-02 · Method spying (`jest.spyOn`) — Master · ✅ written `docs/jest-rtl/pages/03-mocking/01-jest-mock-functions.md`
- **Read this:** [The Jest Object](https://jestjs.io/docs/jest-object) · jestjs.io · `jest.restoreAllMocks()` works only for mocks made with `jest.spyOn()` and replaced properties; the spy entry sits on this page too (*headings only* for the spy entry; the restore text was read) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Complete Guide to Jest.spyOn for Unit Testing](https://dev.to/devin-rosario/complete-guide-to-jestspyon-for-unit-testing-4io6) · Devin Rosario, DEV Community, 2025-10-16 · spyOn versus `jest.fn()`, spying on prototype, instance or module exports, restoring in cleanup; the page cites statistics I could not verify, so use it for the mechanics only · fetched 2026-10-14 (*read*)
- **Our delta:** spying on an ES module namespace, and a spy that still calls the real network.

### T03-03 · Mock lifecycle management — Master · ✅ written `docs/jest-rtl/pages/03-mocking/01-jest-mock-functions.md`
- **Read this:** [Configuring Jest](https://jestjs.io/docs/configuration) · jestjs.io · `clearMocks`, `resetMocks`, `restoreMocks`, each defined as the config form of the matching `jest.*AllMocks()` call, with what each removes (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [The Jest Object](https://jestjs.io/docs/jest-object) · jestjs.io · exact definitions of `clearAllMocks`, `resetAllMocks`, `restoreAllMocks` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The Difference Between Clearing, Resetting, and Restoring Mocks](https://www.epicweb.dev/the-difference-between-clearing-resetting-and-restoring-mocks) · Artem Zakharchenko, Epic Web Dev, 2024-10-25 · clear versus reset versus restore as three levels of cleanup; its config advice names Vitest options, so map the names to Jest's · fetched 2026-10-14 (*read*)
- **Our delta:** none.

### T03-04 · Module mocking (`jest.mock`) — Understand · ✅ written `docs/jest-rtl/pages/03-mocking/01-jest-mock-functions.md`
- **Read this:** [Manual Mocks](https://jestjs.io/docs/manual-mocks) · jestjs.io · the `__mocks__` directory rules, hoisting of `jest.mock` above imports, `jest.requireActual` to keep the real exports (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Mock Functions](https://jestjs.io/docs/mock-functions) · jestjs.io · `jest.mock('axios')` automatic mock and the partial mock with `jest.requireActual` (*read*) · fetched 2026-10-14
- **Our delta:** the "Cannot access before initialization" error inside a factory.

### T03-05 · Deterministic fake timers — Understand · ✅ written `docs/jest-rtl/pages/03-mocking/01-jest-mock-functions.md`
- **Read this:** [Timer Mocks](https://jestjs.io/docs/timer-mocks) · jestjs.io · `advanceTimersByTime` and `runOnlyPendingTimers`, with the infinite-loop abort message for recursive timers (*read*) · covers our angle: **partial** — never mentions modern versus legacy · fetched 2026-10-14
- **Also good:** [The Jest Object](https://jestjs.io/docs/jest-object) · jestjs.io · `jest.useFakeTimers` is backed by `@sinonjs/fake-timers` and covers the date, `performance` and timer APIs (*read*) · fetched 2026-10-14
- **Our delta:** the modern versus legacy comparison, and debounce and throttle examples.

---

## Phase 4 — The RTL mental model and query architecture

### T04-01 · The guiding principle and `screen` — Master · ✅ written `docs/jest-rtl/pages/07-rtl-core-philosophy/01-guiding-principle.md`
- **Read this:** [Guiding Principles](https://testing-library.com/docs/guiding-principles) · testing-library.com · the "resemble the way your software is used" line and the rule to deal with DOM nodes, not component instances; it never uses the phrase "implementation details" (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details) · Kent C. Dodds, 2020-08-17 · an accordion test that breaks on a state rename (false negative) and passes with a broken click handler (false positive) · fetched 2026-10-14 (*read*)
- **Also good:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · the "Not using `screen`" item · fetched 2026-10-14 (*read*)
- **Our delta:** Portal queries and a prop-received assertion that renders nothing.

### T04-02 · The query family matrix — Master · ✅ written `docs/jest-rtl/pages/08-rtl-queries/01-query-variants-and-priority.md`
- **Read this:** [About Queries](https://testing-library.com/docs/queries/about) · testing-library.com · the table of 0, 1 and more than 1 matches for `getBy`, `queryBy`, `findBy` and the retry column (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · use `query*` only to assert absence, not `get*` as an assertion · fetched 2026-10-14 (*read*)
- **Our delta:** `expect(getByRole(...)).not.toBeInTheDocument()` throwing before the matcher runs.

### T04-03 · Accessibility-first query priority — Master · ✅ written `docs/jest-rtl/pages/08-rtl-queries/01-query-variants-and-priority.md`
- **Read this:** [About Queries](https://testing-library.com/docs/queries/about) · testing-library.com · the priority list from `getByRole` down to `getByTestId`, in three groups (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · "Using the wrong query" and "Not using `*ByRole` most of the time", with the reasoning · fetched 2026-10-14 (*read*)
- **Our delta:** the "Unable to find an accessible element" error and the `{ exact: false }` versus RegExp question.

### T04-04 · DOM matchers with `jest-dom` — Dom · ✅ written `docs/jest-rtl/pages/07-rtl-core-philosophy/01-guiding-principle.md`
- **Read this:** [testing-library/jest-dom](https://github.com/testing-library/jest-dom) · GitHub README · each matcher, including what `toBeVisible` requires (display, visibility, opacity, parents, `hidden`, `details`) and that `toBeDisabled` ignores `aria-disabled` (*read*) · covers our angle: **full** for the matcher list · fetched 2026-10-14
- **Our delta:** our page names these matchers only in passing; the semantics above are new to it.

### T04-05 · Scoped queries within container subtrees — Understand · ✅ written `docs/jest-rtl/pages/08-rtl-queries/01-query-variants-and-priority.md`
- **Read this:** [Querying Within Elements](https://testing-library.com/docs/dom-testing-library/api-within) · testing-library.com · `within` binds the queries to one element; a short page with one example (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Within reach: testing lists with React Testing Library](https://dev.to/derekmt12/within-reach-testing-lists-with-react-testing-library-347o) · Derek N. Davis, DEV Community, 2021-06-30 · a list where every row has the same buttons; `within(item)` fixes "Found multiple elements" (*read*) · fetched 2026-10-14
- **Our delta:** none beyond the `within()` interview question.

---

## Phase 5 — User interaction and event simulation

### T05-01 · `user-event` v14 setup and execution — Master · ✅ written `docs/jest-rtl/pages/09-user-interaction/01-simulating-input.md`
- **Read this:** [Setup](https://testing-library.com/docs/user-event/setup) · testing-library.com · `setup(options?)` returns a `UserEvent` instance whose methods are awaited (*read*) · covers our angle: **partial** — the page does not say to call `setup()` before `render` · fetched 2026-10-14
- **Also good:** [Introduction](https://testing-library.com/docs/user-event/intro) · testing-library.com · user-event simulates whole interactions, and refuses to click hidden elements or type into disabled ones (*read*) · fetched 2026-10-14
- **Our delta:** the before-render rule and the sync-assertion race when an `await` is missing.

### T05-02 · Realistic input and pointer interactions — Understand · ✅ written `docs/jest-rtl/pages/09-user-interaction/01-simulating-input.md`
- **Read this:** [Utility APIs](https://testing-library.com/docs/user-event/utility) · testing-library.com · `type`, `clear`, `selectOptions` and `upload`, including `skipClick`, `applyAccept` and `pointerEventsCheck` (*read*) · covers our angle: **partial** — has no `click` entry and no event-by-event list · fetched 2026-10-14
- **Also good:** [Introduction](https://testing-library.com/docs/user-event/intro) · testing-library.com · the typing example: focus, then keyboard and input events, then selection and value updates (*read*) · fetched 2026-10-14
- **Our delta:** the full cascade from hover to blur.

### T05-03 · Keyboard navigation and focus management — Understand · ✅ written `docs/jest-rtl/pages/09-user-interaction/01-simulating-input.md`
- **Read this:** [Keyboard](https://testing-library.com/docs/user-event/keyboard) · testing-library.com · the key descriptor syntax for named keys, modifiers and holding a key; `{Enter}` and `{Escape}` are not shown by name (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [testing-library/jest-dom](https://github.com/testing-library/jest-dom) · GitHub README · `toHaveFocus()` (*read*) · fetched 2026-10-14
- **Our delta:** `user.tab()` and `toHaveFocus` in our example; the focus-trap and modal-escape check is not written up. I found no good non-official page on it in this search.

### T05-04 · `fireEvent` vs `userEvent` — Know · ✅ written `docs/jest-rtl/pages/09-user-interaction/01-simulating-input.md`
- **Read this:** [Introduction](https://testing-library.com/docs/user-event/intro) · testing-library.com · `fireEvent` is a thin wrapper over `dispatchEvent`, one event; user-event runs the full interaction (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Firing Events](https://testing-library.com/docs/dom-testing-library/api-events) · testing-library.com · says most projects have only a few uses for `fireEvent`, without explaining why (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · "Not using `@testing-library/user-event`"; written before v14 · fetched 2026-10-14 (*read*)
- **Our delta:** the rare cases where `fireEvent` is still right.

---

## Phase 6 — Asynchronous waiting and the `act()` model

### T06-01 · `findBy*` vs `waitFor` — Master · ✅ written `docs/jest-rtl/pages/10-async-utilities/01-waiting-for-updates.md`
- **Read this:** [Async Methods](https://testing-library.com/docs/dom-testing-library/api-async) · testing-library.com · `findBy` is `getBy` plus `waitFor`; `waitFor` retries a callback until it stops throwing (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · "Using `waitFor` to wait for elements that can be queried with `find*`" · fetched 2026-10-14 (*read*)
- **Our delta:** none.

### T06-02 · `waitFor` rules and pitfalls — Understand · ✅ written `docs/jest-rtl/pages/10-async-utilities/01-waiting-for-updates.md`
- **Read this:** [Async Methods](https://testing-library.com/docs/dom-testing-library/api-async) · testing-library.com · defaults of 1000 ms timeout and 50 ms interval, a MutationObserver rerun, and that the callback must throw to retry (*read*) · covers our angle: **partial** — no side-effect rule on this page · fetched 2026-10-14
- **Also good:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · empty `waitFor` callback, several assertions in one callback, side effects in `waitFor` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Testing-library: avoid these mistakes in async tests](https://dev.to/tipsy_dev/testing-library-writing-better-async-tests-c67) · Aleksei Tsikov, DEV Community, 2021-11-21 · a `fireEvent.click` inside `waitFor` toggles a panel on every retry and hangs the test · fetched 2026-10-14 (*read*)
- **Our delta:** the "Timed out in waitFor" error trace.

### T06-03 · Waiting for element removal — Understand · ✅ written `docs/jest-rtl/pages/10-async-utilities/01-waiting-for-updates.md`
- **Read this:** [Async Methods](https://testing-library.com/docs/dom-testing-library/api-async) · testing-library.com · `waitForElementToBeRemoved` wraps `waitFor` and throws if the element is already absent when called (*read*) · covers our angle: **partial** — no spinner or skeleton example · fetched 2026-10-14
- **Our delta:** loading spinners and skeletons, and the choice against `waitFor` with `queryBy` and `not.toBeInTheDocument()`. I found no good non-official page on removal in this search.

### T06-04 · The `act(...)` warning demystified — Understand · ✅ written `docs/jest-rtl/pages/10-async-utilities/01-waiting-for-updates.md`
- **Read this:** [act](https://react.dev/reference/react/act) · react.dev · `act` flushes updates before assertions, needs `IS_REACT_ACT_ENVIRONMENT`, and testing libraries set it up for you; use the async form (*read*) · covers our angle: **partial** — says nothing about when the warning means a bug · fetched 2026-10-14
- **Beyond the docs:** [Fix the "not wrapped in act(...)" warning](https://kentcdodds.com/blog/fix-the-not-wrapped-in-act-warning) · Kent C. Dodds, 2020-02-03 · a test that passes with `setState` commented out because nothing waited for "Saving..." to go away; fixes by waiting for the UI; written for React 16 and 17 · fetched 2026-10-14 (*read*)
- **Our delta:** React 18 and 19 behavior.
