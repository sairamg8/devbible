---
title: "Link map · Jest and RTL · Part 1 (phases 01–06)"
sidebar_label: "01 · jest and rtl foundations"
sidebar_position: 1
---

# Link map · Jest and RTL · Part 1 (phases 01–06)

Covers every topic row of phases 1 to 6 in `docs/jest-rtl/syllabus/01-jest-runner.md` (T01-01 to T03-05) and `docs/jest-rtl/syllabus/02-rtl-foundations.md` (T04-01 to T06-04). That is 27 rows. Our track has one page per chapter, so several topics share one page path below; where the page only touches a topic in a gotcha or an interview question, the Our delta line says so. One row, T04-04, has no page that teaches it and is marked not written.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry the date the page shows. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line.

🔴 **Version note.** Our pages were verified against Jest 29.7 / 30.x. The jestjs.io pages below are the Jest 30.5 docs and were live on 2026-10-14. Testing Library pages (user-event v14) are current. The `act` guidance links to react.dev. Kent C. Dodds posts date from 2020 and predate user-event v14 and React 18 and 19; the reasoning stands but his code is not v14 style, and none of them names a version. Two syllabus rows are not backed by the page you would expect: the timer-mocks guide never mentions modern versus legacy timers (the Jest Object page does, through the `legacyFakeTimers` option), and the user-event Setup page does not say to call `setup()` before `render` (the Introduction page does, as a recommendation). Each affected block says so. A third-party page on `jest.spyOn` from DEV Community (Devin Rosario, 2025) was dropped: it cites unsourced statistics and anonymous anecdotes and carries leftover drafting notes.

---

## Phase 1 — Test structure and execution lifecycle

### T01-01 · Test registration vs execution — Master · ✅ written `docs/jest-rtl/pages/01-jest-core-concepts/01-test-structure.md`
- **Read this:** [Setup and Teardown](https://jestjs.io/docs/setup-teardown) · jestjs.io · "Jest executes all describe handlers in a test file before it executes any of the actual tests", so setup belongs in `before*` hooks and not in a `describe` body (*read*) · covers our angle: **partial** — states the rule and shows the log order, not the tree model · fetched 2026-10-14
- **Beyond the docs:** [Jest Recap: What Runs When?](https://dev.to/htho/jest-recap-what-runs-when-4475) · Hauke T., DEV Community, 2024-07-18 · a worked log of describe bodies, hooks and tests: "Everything on the top-level and in describe callbacks is executed immediately" · fetched 2026-10-14 (*read*)
- **Our delta:** the registration tree and why a `console.log` in a `describe` prints before `beforeAll`. Also on the Jest Globals page: `describe.skip` still runs the describe body.

### T01-02 · Hook scoping and cascading — Understand · ✅ written `docs/jest-rtl/pages/01-jest-core-concepts/01-test-structure.md`
- **Read this:** [Setup and Teardown](https://jestjs.io/docs/setup-teardown) · jestjs.io · the Scoping section's nested example prints the order for all four hooks: outer `beforeEach` before inner, inner `afterEach` before outer, inner `afterAll` before outer; the rule is "the after hooks of the enclosing scope are called first" (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Jest Recap: What Runs When?](https://dev.to/htho/jest-recap-what-runs-when-4475) · Hauke T., DEV Community, 2024-07-18 · spells out `beforeAll` top-level first then each describe level, and `afterAll` in reverse, with a longer advanced example · fetched 2026-10-14 (*read*)
- **Our delta:** an error thrown in `beforeAll` versus `beforeEach` (interview question 3 only).

### T01-03 · Data-driven parameterization — Understand · ✅ written `docs/jest-rtl/pages/01-jest-core-concepts/01-test-structure.md`
- **Read this:** [Jest Globals API](https://jestjs.io/docs/api) · jestjs.io · the `test.each` and `describe.each` entries: array table, 1D array, objects, and the tagged template (header row, `${value}` cells), titles with printf tokens and `$variable` (*read*) · covers our angle: **full** for syntax, **partial** for choosing between the two forms · fetched 2026-10-14
- **Beyond the docs:** [How to Use Jest each to Get More Code Coverage with Less Test Code](https://geshan.com.np/blog/2024/07/it.each-jest/) · Geshan Manandhar, 2024-07-06 · four repeated `it` blocks collapsed into one `it.each` table, then the same cases as a tagged template (the "before" snippet calls a differently named function than the one defined) · fetched 2026-10-14 (*read*)
- **Our delta:** the shared-object-payload gotcha across rows and why a loop inside one test hides which row failed.

### T01-04 · Test filtering and debugging flags — Know · ✅ written `docs/jest-rtl/pages/01-jest-core-concepts/01-test-structure.md`
- **Read this:** [Jest Globals API](https://jestjs.io/docs/api) · jestjs.io · `test.only`, `test.skip`, `test.todo` and `test.concurrent` (marked experimental) with their `.each` variants; the only warning is "Usually you wouldn't check code using test.only into source control" (*read*) · covers our angle: **partial** — API and hygiene note, no CI story · fetched 2026-10-14
- **Also good:** [no-focused-tests](https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-focused-tests.md) · eslint-plugin-jest · flags `describe.only`, `it.only`, `test.only`, `fdescribe`, `fit`; on in the recommended config; cannot catch `describe.only` assigned to a variable and called later (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Don't commit focused tests](https://timdeschryver.dev/blog/dont-commit-focused-tests) · Tim Deschryver, 2020-05-10 · the prevention stack: editor highlighter, lint rule (the eslint-plugin-jest rule among them), a Husky pre-commit script, and linting in CI; it does not explain why the rest of the suite is silently skipped, and its other examples are TSLint and Jasmine era · fetched 2026-10-14 (*read*)
- **Our delta:** the 1-run, 50-skipped green-CI symptom and the lint fix. `test.skip` is not covered on our page; `test.todo` and `test.concurrent` appear once each.

---

## Phase 2 — Assertions, matchers and snapshots

### T02-01 · The `expect` API and equality semantics — Master · ✅ written `docs/jest-rtl/pages/02-assertions-and-matchers/01-the-expect-api.md`
- **Read this:** [Expect](https://jestjs.io/docs/expect) · jestjs.io · `toBe` calls `Object.is`; `toEqual` ignores `undefined` properties, array sparseness and object type; `toStrictEqual` checks all three, shown with a `LaCroix` class against a literal (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Jest: toEqual or toStrictEqual? The difference.](https://ultimatecourses.com/blog/jest-toequal-tostrictequal-difference) · Todd Motto, Ultimate Courses, 2023-01-30 · a `Pizza` class instance passes `toEqual` against a literal and fails `toStrictEqual`; also the `undefined` keys case; concludes `toStrictEqual` should be the default · fetched 2026-10-14 (*read*)
- **Our delta:** the "x.method is not a function" production crash that `toEqual` lets through.

### T02-02 · Asynchronous assertions and modifiers — Understand · ✅ written `docs/jest-rtl/pages/04-async-testing/01-handling-asynchrony.md`
- **Read this:** [Testing Asynchronous Code](https://jestjs.io/docs/asynchronous) · jestjs.io · "Be sure to return (or await) the promise" or the test completes first; `expect.assertions(n)` is shown with the `.catch` and try/catch forms, not with `.rejects` (*read*) · covers our angle: **full** for the false-pass rule · fetched 2026-10-14
- **Also good:** [Expect](https://jestjs.io/docs/expect) · jestjs.io · `.rejects.toThrow('octopus')` on `Promise.reject(new Error('octopus'))`, and `expect.assertions(2)` in the `doAsync` example (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Demystifying Jest Async Testing Patterns](https://dev.to/lirantal/demystifying-jest-async-testing-patterns-4n5n) · Liran Tal, DEV Community, 2019-05-20 · a test that never returns its promise always passes; a try/catch test passes when nothing throws; calls `expect.assertions` "somewhat non-elegant" and prefers the promise matchers · fetched 2026-10-14 (*read*)
- **Our delta:** `expect(() => fn()).toThrow()` on async functions, and unhandled rejections after the test ends. `.not` has no section of its own.

### T02-03 · Asymmetric matchers — Understand · ✅ written `docs/jest-rtl/pages/02-assertions-and-matchers/01-the-expect-api.md`
- **Read this:** [Expect](https://jestjs.io/docs/expect) · jestjs.io · `expect.any`, `expect.objectContaining` and `expect.arrayContaining` each with an example; `expect.stringContaining` gets a one-line description with no example (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Snapshot Testing](https://jestjs.io/docs/snapshot-testing) · jestjs.io · property matchers, `createdAt: expect.any(Date)` and `id: expect.any(Number)`, checked before the snapshot is written (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Asymmetric Matchers](https://stevekinney.com/courses/testing/asymmetric-matchers) · Steve Kinney, Testing course, last modified 2025-04-28 · `expect.any(String)` on a generated id, `stringMatching`, `objectContaining` for a subset; argues for using them sparingly so tests do not go loose; no timestamp example and no `stringContaining` (*read*) · fetched 2026-10-14
- **Our delta:** the intermittent failure from dynamic timestamps. `expect.stringContaining` is not on our page.

### T02-04 · Snapshot testing mechanics — Know · ✅ written `docs/jest-rtl/pages/05-snapshot-testing/01-snapshot-mechanics.md`
- **Read this:** [Snapshot Testing](https://jestjs.io/docs/snapshot-testing) · jestjs.io · inline snapshots are written back into the source ("if Prettier is used, Jest delegates to it"; Prettier is optional), property matchers, "treat snapshots as code", the `no-large-snapshots` lint option, `-u` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Effective Snapshot Testing](https://kentcdodds.com/blog/effective-snapshot-testing) · Kent C. Dodds, 2017-10-30 · quotes Justin Searls that developers "nuke the snapshot and record a fresh passing one"; keeps snapshots for error messages, Babel plugin output and CSS-in-JS; cites a 640-line snapshot nobody reviewed · fetched 2026-10-14 (*read*)
- **Our delta:** why a large DOM snapshot asserts nothing, `-u` as a reflex, stale `.snap` files. Our page says inline snapshots "use Babel and Prettier"; the docs only say Prettier is used when present. The docs page says nothing on obsolete snapshots, so that part of our page rests on the CLI docs.

### T02-05 · Custom matchers with `expect.extend` — When · ✅ written `docs/jest-rtl/pages/02-assertions-and-matchers/01-the-expect-api.md`
- **Read this:** [Expect](https://jestjs.io/docs/expect) · jestjs.io · the `expect.extend` entry with `toBeWithinRange` returning `pass` and a `message` function built from `this.utils.printReceived` and `printExpected`; the custom matcher API section later shows a diff via `jest-diff` (*read*) · covers our angle: **partial** — the `toBeWithinRange` example prints no diff · fetched 2026-10-14
- **Beyond the docs:** [Making custom Jest assertion matchers in JavaScript and TypeScript](https://dev.to/andyhaskell/making-custom-jest-assertion-matchers-in-javascript-and-typescript-15ij) · Andy Haskell, DEV Community, 2020-12-29 · builds `toBeWithinOneMinuteOf`, handles the `.not` message, adds the `jest.Matchers` TypeScript declaration; its message prints times and a difference in seconds, not a Jest diff · fetched 2026-10-14 (*read*)
- **Our delta:** diagnostic diffs in the failure message (interview question 3 only).

---

## Phase 3 — Mocking and deterministic isolation

### T03-01 · Mock functions (`jest.fn`) — Master · ✅ written `docs/jest-rtl/pages/03-mocking/01-jest-mock-functions.md`
- **Read this:** [Mock Functions](https://jestjs.io/docs/mock-functions) · jestjs.io · the `.mock` property (`calls`, `results`, `instances`, `contexts`, `lastCall`), `mockReturnValue`, `mockImplementation`, and `mockResolvedValue` in the axios example (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Mock Functions API](https://jestjs.io/docs/mock-function-api) · jestjs.io · reference entries for each `.mock` array and `mockReturnValue`, `mockResolvedValue`, `mockImplementation`; `mockClear()` replaces `mockFn.mock`, so do not keep references to it (*read*) · fetched 2026-10-14
- **Our delta:** `.mock.contexts`, `.mock.lastCall` and the stale-`.mock` caution are not on our page. A second search turned up only the official API pages and no good third-party piece, so no Beyond line.

### T03-02 · Method spying (`jest.spyOn`) — Master · ✅ written `docs/jest-rtl/pages/03-mocking/01-jest-mock-functions.md`
- **Read this:** [The Jest Object](https://jestjs.io/docs/jest-object) · jestjs.io · `jest.spyOn(object, methodName)` tracks calls and by default still calls the original; `mockImplementation` overrides; the getter and setter form; `using spy = jest.spyOn(...)` restores on block exit; `restoreAllMocks()` "only works for mocks created with jest.spyOn()" and replaced properties (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Mocks and Spies with Jest](https://dev.to/qmenoret/mocks-and-spies-with-jest-32gf) · Quentin Ménoret, DEV Community, 2020-12-31 · replacing a global with `jest.fn` leaves cleanup to you while `spyOn` is cleaned up for you, and the original still runs unless mocked; its `jest.mock` remark is imprecise (Jest automocks the module), so read it for spyOn versus `jest.fn` only · fetched 2026-10-14 (*read*)
- **Our delta:** spying on an ES module namespace, and a spy that still calls the real network. The `using` form (Jest 30) is not on our page.

### T03-03 · Mock lifecycle management — Master · ✅ written `docs/jest-rtl/pages/03-mocking/01-jest-mock-functions.md`
- **Read this:** [Configuring Jest](https://jestjs.io/docs/configuration) · jestjs.io · `clearMocks`, `resetMocks`, `restoreMocks`, each the config form of the matching `jest.*AllMocks()` call, with what each removes; all default to `false` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [The Jest Object](https://jestjs.io/docs/jest-object) · jestjs.io · `clearAllMocks` clears `calls`, `instances`, `contexts`, `results`; `restoreAllMocks` is `.mockRestore()` on every mock, spies and replaced properties only (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The Difference Between Clearing, Resetting, and Restoring Mocks](https://www.epicweb.dev/the-difference-between-clearing-resetting-and-restoring-mocks) · Artem Zakharchenko, Epic Web Dev, 2024-10-25 · clear, reset, restore as three levels of cleanup; Vitest-centred (names `mockReset` in the Vitest config, mentions Jest once) · fetched 2026-10-14 (*read*)
- **Our delta:** none against the docs; the mock-function-api caution that `mockClear()` replaces `.mock` is not on our page.

### T03-04 · Module mocking (`jest.mock`) — Understand · ✅ written `docs/jest-rtl/pages/03-mocking/01-jest-mock-functions.md`
- **Read this:** [Manual Mocks](https://jestjs.io/docs/manual-mocks) · jestjs.io · the `__mocks__` directory rules (adjacent to the module, or next to `node_modules`; built-ins need an explicit `jest.mock`), and "Jest will automatically hoist jest.mock calls to the top of the module", which does not hold under native ESM; names `jest.requireActual` but shows no example (*read*) · covers our angle: **partial** — hoisting and `requireActual`, with the `__mocks__` side new · fetched 2026-10-14
- **Also good:** [Mock Functions](https://jestjs.io/docs/mock-functions) · jestjs.io · `jest.mock('axios')` automatic mock and the partial mock with `jest.requireActual` spread into the factory (*read*) · fetched 2026-10-14
- **Beyond the docs:** [When is it safe to use import statements in Jest tests?](https://tigeroakes.com/posts/jest-mock-and-import-statements/) · Tiger Oakes, 2022-12-27 · `babel-jest` hoists `jest.mock` above imports; lists what must hold (literal first argument, inline factory, top level, no outer variables) and `jest.doMock` as the escape; no word on the `mock` prefix · fetched 2026-10-14 (*read*)
- **Our delta:** the "Cannot access before initialization" error inside a factory. The `__mocks__` directory is not on our page, and nor is the native-ESM exception to hoisting.

### T03-05 · Deterministic fake timers — Understand · ✅ written `docs/jest-rtl/pages/03-mocking/01-jest-mock-functions.md`
- **Read this:** [Timer Mocks](https://jestjs.io/docs/timer-mocks) · jestjs.io · `runAllTimers`, `runOnlyPendingTimers`, `advanceTimersByTime`, selective faking, and the abort message "Aborting after running 100000 timers, assuming an infinite loop!" (*read*) · covers our angle: **partial** — never mentions modern versus legacy, `@sinonjs` or debounce · fetched 2026-10-14
- **Also good:** [The Jest Object](https://jestjs.io/docs/jest-object) · jestjs.io · `jest.useFakeTimers` is backed by `@sinonjs/fake-timers` and fakes `Date`, `performance.now()` and the timer APIs; `legacyFakeTimers: true` selects the legacy implementation, which supports no other options and has no async advance variants (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Faster tests with Jest timers vs. waitFor on debounced inputs](https://testdouble.com/insights/jest-timers-vs-waitfor-debounced-inputs) · James Walker, Test Double, undated · a debounced input tested both ways; `userEvent.setup({ advanceTimers: jest.advanceTimersByTime })` and `act` around the advance; reports 10 to 100 times faster, no Jest version stated · fetched 2026-10-14 (*read*)
- **Our delta:** our page has a 300 ms debounce scenario and interview question 3 on modern versus legacy; throttle, `advanceTimers` for user-event and `legacyFakeTimers` are not written up.

---

## Phase 4 — The RTL mental model and query architecture

### T04-01 · The guiding principle and `screen` — Master · ✅ written `docs/jest-rtl/pages/07-rtl-core-philosophy/01-guiding-principle.md`
- **Read this:** [Guiding Principles](https://testing-library.com/docs/guiding-principles) · testing-library.com · "The more your tests resemble the way your software is used, the more confidence they can give you" and deal with DOM nodes rather than component instances; the phrase "implementation details" does not appear (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details) · Kent C. Dodds, 2020-08-17 · an accordion test that fails after renaming `openIndex` to `openIndexes` (false negative) and passes with a broken click handler (false positive); enzyme and React 16 class components, so read it for the argument, not the code · fetched 2026-10-14 (*read*)
- **Also good:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · "Not using screen", added in DOM Testing Library 6.11.0; written before React 18 and user-event v14 · fetched 2026-10-14 (*read*)
- **Our delta:** Portal queries and a prop-received assertion that renders nothing.

### T04-02 · The query family matrix — Master · ✅ written `docs/jest-rtl/pages/08-rtl-queries/01-query-variants-and-priority.md`
- **Read this:** [About Queries](https://testing-library.com/docs/queries/about) · testing-library.com · the table of 0, 1 and more than 1 matches for `getBy`, `queryBy`, `findBy` and their `AllBy` forms, with the retry column; `findBy` rejects after a default 1000 ms (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · "Using query* variants for anything except checking for non-existence" and "Using get* variants as assertions" · fetched 2026-10-14 (*read*)
- **Our delta:** `expect(getByRole(...)).not.toBeInTheDocument()` throwing before the matcher runs.

### T04-03 · Accessibility-first query priority — Master · ✅ written `docs/jest-rtl/pages/08-rtl-queries/01-query-variants-and-priority.md`
- **Read this:** [About Queries](https://testing-library.com/docs/queries/about) · testing-library.com · the priority list in three groups (accessible to everyone: `ByRole`, `ByLabelText`, `ByPlaceholderText`, `ByText`, `ByDisplayValue`; semantic: `ByAltText`, `ByTitle`; then `ByTestId`), the `name` option, and `exact` defaulting to `true` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · "Using the wrong query" with the sub-section "Not using *ByRole most of the time", and the reasoning · fetched 2026-10-14 (*read*)
- **Our delta:** the "Unable to find an accessible element" error and the `{ exact: false }` versus RegExp question (the docs say `exact` has no effect with a regex).

### T04-04 · DOM matchers with `jest-dom` — Dom · 🔲 not written (matchers appear only inside examples on `docs/jest-rtl/pages/07-rtl-core-philosophy/01-guiding-principle.md`, `docs/jest-rtl/pages/14-accessibility-testing/01-a11y-assertions.md` and `docs/jest-rtl/pages/16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md`)
- **Read this:** [testing-library/jest-dom](https://github.com/testing-library/jest-dom) · GitHub README · each matcher; `toBeVisible` needs the element in the document, `display` not `none`, `visibility` not `hidden` or `collapse`, `opacity` not `0`, a visible parent, no `hidden` attribute, and `open` on `details`; `toBeDisabled` "does not take into account the presence or absence of the aria-disabled attribute" (*read*) · covers our angle: **full** for the matcher list · fetched 2026-10-14
- **Our delta:** `toBeInTheDocument` and `toHaveValue` appear in examples, `toHaveAccessibleName` and `toHaveAttribute` have an interview question on the accessibility page, and setup is on the recipes page; there is no page on `toBeVisible`, `toBeDisabled` semantics or the matcher list. A second search found only React Native and mirror pages, so no Beyond line.

### T04-05 · Scoped queries within container subtrees — Understand · ✅ written `docs/jest-rtl/pages/08-rtl-queries/01-query-variants-and-priority.md`
- **Read this:** [Querying Within Elements](https://testing-library.com/docs/dom-testing-library/api-within) · testing-library.com · `within` is an alias of `getQueriesForElement` and binds the queries to one element; one short example (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Within reach: testing lists with React Testing Library](https://dev.to/derekmt12/within-reach-testing-lists-with-react-testing-library-347o) · Derek N. Davis, DEV Community, 2021-06-30 · a list where every row has its own Delete button; `within(item)` scopes each lookup to one row; the article does not name the "Found multiple elements" error itself (*read*) · fetched 2026-10-14
- **Our delta:** a `within()` call in the main example plus interview question 3.

---

## Phase 5 — User interaction and event simulation

### T05-01 · `user-event` v14 setup and execution — Master · ✅ written `docs/jest-rtl/pages/09-user-interaction/01-simulating-input.md`
- **Read this:** [Introduction](https://testing-library.com/docs/user-event/intro) · testing-library.com · "We recommend invoking userEvent.setup() before the component is rendered", inside the test or a setup function and not in `before` or `after` hooks; v14 calls are awaited (*read*) · covers our angle: **full** for the before-render rule · fetched 2026-10-14
- **Also good:** [Setup](https://testing-library.com/docs/user-event/setup) · testing-library.com · `setup()` returns an instance whose methods "share one input device state"; direct calls like `userEvent.click()` still work and call `setup` internally, kept to ease migration; never mentions `render`, `delay` or `advanceTimers` (*read*) · fetched 2026-10-14
- **Our delta:** our page says v14 "requires" setup before render; the docs only recommend it and keep direct calls working. The sync-assertion race when an `await` is missing is our own gotcha. No good non-official page turned up on the ordering.

### T05-02 · Realistic input and pointer interactions — Understand · ✅ written `docs/jest-rtl/pages/09-user-interaction/01-simulating-input.md`
- **Read this:** [Utility APIs](https://testing-library.com/docs/user-event/utility) · testing-library.com · `clear`, `selectOptions` and `deselectOptions`, `type` and `upload`, with `skipClick`, `initialSelectionStart`, `applyAccept` and `pointerEventsCheck`; no `click` entry here (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Convenience APIs](https://testing-library.com/docs/user-event/convenience) · testing-library.com · `click`, `dblClick`, `tripleClick`, `hover`, `unhover`, and `tab` with a `shift` option (*read*) · fetched 2026-10-14
- **Also good:** [Introduction](https://testing-library.com/docs/user-event/intro) · testing-library.com · typing focuses first, then keyboard and input events, then selection and value updates; refuses to click hidden elements or type into disabled ones (*read*) · fetched 2026-10-14
- **Our delta:** the docs describe the cascade in prose and list no events; our page lists the pointer sequence and the typing sequence by event name. `user.clear()` appears only in a gotcha. A search found only a pre-v14 tutorial, so no Beyond line.

### T05-03 · Keyboard navigation and focus management — Understand · ✅ written `docs/jest-rtl/pages/09-user-interaction/01-simulating-input.md`
- **Read this:** [Keyboard](https://testing-library.com/docs/user-event/keyboard) · testing-library.com · braces name a `key` value, brackets a `code` value, `>` holds a key, `/` releases it, doubling `{` or `[` escapes; `{Enter}` and `{Escape}` are not shown by name, and `tab()` and focus are not mentioned (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Convenience APIs](https://testing-library.com/docs/user-event/convenience) · testing-library.com · `tab()` and `tab({ shift: true })`; the example cycles focus through the inputs and back to the body (*read*) · fetched 2026-10-14
- **Also good:** [testing-library/jest-dom](https://github.com/testing-library/jest-dom) · GitHub README · `toHaveFocus()` (*read*) · fetched 2026-10-14
- **Our delta:** `user.tab()` and `toHaveFocus` in our example and `{Enter}`, `{Escape}` in a key list; the focus-trap and modal-escape check is not written up. The one test-focused pick found (OpenReplay, 2025-08-09) is mostly about building, tests a trap without Escape and names no versions, so it is left out.

### T05-04 · `fireEvent` vs `userEvent` — Know · ✅ written `docs/jest-rtl/pages/09-user-interaction/01-simulating-input.md`
- **Read this:** [Introduction](https://testing-library.com/docs/user-event/intro) · testing-library.com · `fireEvent` dispatches individual DOM events; user-event simulates complete interactions with checks along the way (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Firing Events](https://testing-library.com/docs/dom-testing-library/api-events) · testing-library.com · "Most projects have a few use cases for fireEvent", without saying which; silent on `act` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · "Not using @testing-library/user-event"; names no user-event version and predates v14 · fetched 2026-10-14 (*read*)
- **Our delta:** the rare cases where `fireEvent` is still right (interview question 3, for example window scroll).

---

## Phase 6 — Asynchronous waiting and the `act()` model

### T06-01 · `findBy*` vs `waitFor` — Master · ✅ written `docs/jest-rtl/pages/10-async-utilities/01-waiting-for-updates.md`
- **Read this:** [Async Methods](https://testing-library.com/docs/dom-testing-library/api-async) · testing-library.com · "findBy methods are a combination of getBy queries and waitFor"; `waitFor` retries a callback until it stops throwing (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · "Using waitFor to wait for elements that can be queried with find*", rated high importance · fetched 2026-10-14 (*read*)
- **Our delta:** none.

### T06-02 · `waitFor` rules and pitfalls — Understand · ✅ written `docs/jest-rtl/pages/10-async-utilities/01-waiting-for-updates.md`
- **Read this:** [Async Methods](https://testing-library.com/docs/dom-testing-library/api-async) · testing-library.com · defaults of 1000 ms timeout and 50 ms interval, a MutationObserver rerun, and "the callback must throw an error in order to retry"; says nothing on side effects (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · empty `waitFor` callback, several assertions in one callback, side effects in `waitFor` (rated high) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Testing-library: avoid these mistakes in async tests](https://dev.to/tipsy_dev/testing-library-writing-better-async-tests-c67) · Aleksei Tsikov, DEV Community, 2021-11-21 · a `fireEvent.click` inside `waitFor` toggles a panel on every retry and hangs the test; also an un-awaited `waitFor` that lets a broken test pass · fetched 2026-10-14 (*read*)
- **Our delta:** the "Timed out in waitFor" error trace (a gotcha) and the `onTimeout` and `container` options.

### T06-03 · Waiting for element removal — Understand · ✅ written `docs/jest-rtl/pages/10-async-utilities/01-waiting-for-updates.md`
- **Read this:** [Async Methods](https://testing-library.com/docs/dom-testing-library/api-async) · testing-library.com · `waitForElementToBeRemoved` is "a small wrapper around the waitFor utility" and throws if the element is already absent ("already removed") (*read*) · covers our angle: **partial** — no spinner or skeleton example · fetched 2026-10-14
- **Our delta:** the docs have no spinner example; our page has a loading-spinner scenario and interview question 2 on the choice against `waitFor` with `queryBy` and `not.toBeInTheDocument()`. A search found only a thin course page (Stanza) that offers both forms without saying when to choose, so no Beyond line.

### T06-04 · The `act(...)` warning demystified — Understand · ✅ written `docs/jest-rtl/pages/10-async-utilities/01-waiting-for-updates.md`
- **Read this:** [act](https://react.dev/reference/react/act) · react.dev · `act` makes sure updates are applied to the DOM before assertions; needs `global.IS_REACT_ACT_ENVIRONMENT=true`, already set by React Testing Library; use `await act(async ...)`, the sync form will be deprecated; treats the warning as a configuration problem, not a bug signal (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) · Kent C. Dodds, 2020-05-04 · "Wrapping things in act unnecessarily", rated medium (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Fix the "not wrapped in act(...)" warning](https://kentcdodds.com/blog/fix-the-not-wrapped-in-act-warning) · Kent C. Dodds, 2020-02-03 · a test still passes with `setState` commented out because nothing waited for "Saving..." to go; fix is `waitForElementToBeRemoved`, with manual `act` kept for fake timers and hooks; names no React version and predates React 18 · fetched 2026-10-14 (*read*)
- **Our delta:** our page covers the warning and why not to wrap everything; `IS_REACT_ACT_ENVIRONMENT` and React 18 versus 19 differences are not written up.
