---
title: "Link map · JavaScript · Part 4 (phases 5–6)"
sidebar_label: "04 · built ins and iteration"
sidebar_position: 4
---

# Link map · JavaScript · Part 4 (phases 5–6)

Covers every topic row of `docs/javascript/syllabus/02-data-and-async.md` in phase 5 (T05-01 to T05-26, the built-in library) and phase 6 (T06-01 to T06-13, iteration, destructuring and generators). That is 39 rows, and all 39 have a written page of ours.
*read* = I read the passage and it supports the claim; *headings only* = fetched, headings or size checked; *fetched, not read* = the URL returned 200 but I did not read the passage, so treat the pick as a lead. Third-party links carry a date only where the page shows one. No `#anchors` are given.

🔴 **Version note.** Our syllabus targets **Node 24 LTS** (`docs/javascript/README.md`). MDN is a live reference and tracks the current spec. Several third-party picks are older than the features they teach: the Date-trap and sort articles are fine for any engine, but the iterator-helpers pages (2024–2025) predate wide support, and the V8 weak-references page (2019, updated 2020) lists support that is now out of date (it says no Safari). The javascript.info lookbehind chapter (2022) says lookbehind is unsupported in Safari, which is also out of date. Temporal support moves fast: the Bryntum post (2026-01-21) says Firefox 139 and Chrome 144 ship it by default, with Safari still in preview, and MDN's Temporal page is marked "Limited availability". Whether Node 24 LTS ships Temporal was not verified, so recheck before quoting. Two well-known sources were dropped because they were offline on 2026-10-13: 2ality.com and the Exploring JavaScript books both show "temporarily offline", so no link points at them. SitePoint returned 403 and was not used.

---

## Phase 5 — The built-in library

### T05-01 · Array creation and shape — Master · ✅ written `docs/javascript/pages/phase-5-built-in-library/01-array-creation-and-shape/01-making-arrays.md`
- **Read this:** [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) · MDN · the "Relationship between length and numerical properties" section shows `length = 2` deleting elements and a larger `length` adding empty slots; "Array methods and empty slots" covers holes; `Array.of` and `Array.from` get only one-line entries here (*read* the headings) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Array.of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/of) · MDN · `Array.of(7)` makes one element, `Array(7)` makes seven empty slots (*read*) · [Array.from](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from) · MDN · iterable or array-like plus an optional map function (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Sparse and dense arrays in JavaScript](https://dmitripavlutin.com/javascript-sparse-dense-arrays/) · Dmitri Pavlutin, 2021-10-27 · lists the four ways a hole appears (literal gaps, `Array(length)`, `delete`, growing `length`) and names `forEach`, `map` and `filter` as skipping holes, which MDN spreads across pages · fetched 2026-10-13 (*read*)
- **Our delta:** `length` as a writable property (truncation) and `Array.from` with a map function.

### T05-02 · Adding and removing — Master · ✅ written `docs/javascript/pages/phase-5-built-in-library/02-adding-and-removing/01-push-pop-shift-unshift.md`
- **Read this:** [Array.prototype.push](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push) · MDN · the mutating end-operation; its See also links `pop`, `shift`, `unshift`, `splice` (*read*) · covers our angle: **partial** — no complexity or `shift` cost anywhere on the page · fetched 2026-10-13
- **Beyond the docs:** [Queues in JavaScript](https://dev.to/alaindet/queues-in-javascript-42a6) · Alain D'Ettorre, DEV Community, 2025-05-01 · says `shift` is linear time, benchmarks 200,000 operations against a double-array queue and a linked list (single-array dequeue about 4,972 ms against 3.85 ms for the list), and calls it fine only for small queues · fetched 2026-10-13 (*read*)
- **Our delta:** why `shift` in a loop is O(n^2). Engines differ here (a WebKit bug thread says V8 and SpiderMonkey make `shift` cheap on dense arrays), so the cost claim is not engine-proof.

### T05-03 · `slice` vs `splice` vs `at` — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/03-slice-splice-at.md`
- **Read this:** [Array.prototype.slice](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice) · MDN · shallow-copy semantics and negative indices, with an arrays-of-objects example (*read*) · covers our angle: **partial** — `splice` and `at` are on their own pages · fetched 2026-10-13
- **Beyond the docs:** [The difference between slice and splice](https://dev.to/antdp425/javascript-the-difference-between-slice-and-splice-mh0) · Anthony (antdp425), DEV Community, 2020-10-21 · beginner side-by-side: `slice` returns a copy, `splice` edits in place; covers negative start for `slice` but not for `splice`, and not `at` · fetched 2026-10-13 (*read*)
- **Our delta:** `at` and the name collision framed as one decision.

### T05-04 · Array iteration methods — Master · ✅ written `docs/javascript/pages/phase-5-built-in-library/04-array-iteration-methods/01-choosing-a-method.md`
- **Read this:** [Array methods](https://javascript.info/array-methods) · javascript.info, 2023-12-31 · ends with a task-grouped cheat sheet for choosing, and covers `find`, `findIndex`, `findLastIndex`, `filter`, `map`; `some` and `every` appear only in the summary; it has no `findLast` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) · MDN · the "Iterative methods" section (*read* the headings) · fetched 2026-10-13
- **Our delta:** the explicit chooser, plus `findLast`.

### T05-05 · `reduce` — Master · ✅ written `docs/javascript/pages/phase-5-built-in-library/05-reduce/01-the-shape.md`
- **Read this:** [Array.prototype.reduce](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce) · MDN · the empty-array TypeError without an initial value, and a "When to not use reduce()" section: copying the accumulator each pass is O(N^2) so use a `for` loop, plus swaps for `flat`, `Object.groupBy`, `flatMap`, `Set`, `some` and `every` (*read*) · covers our angle: **full** for the trap and the loop-vs-reduce call; accumulating into a Map is not shown · fetched 2026-10-13
- **Beyond the docs:** [How not to use reduce](https://dev.to/ycmjason/how-not-to-use-reduce-4a1o) · YCM Jason, DEV Community, 2020-06-30 · shows `map`, `flatMap`, `filter`, `Object.fromEntries` and `Math.max` replacing reduce calls; the author says it is about readability, not speed · fetched 2026-10-13 (*read*)
- **Our delta:** accumulating into Maps and objects, the missing-initial-value trap.

### T05-06 · `sort` — Master · ✅ written `docs/javascript/pages/phase-5-built-in-library/06-sort/01-the-default-and-the-comparator.md`
- **Read this:** [Array.prototype.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) · MDN · default UTF-16 string order, comparator contract, stability since ES2019, in-place mutation with a `toSorted` pointer (*read*) · covers our angle: **partial** — only single-key comparators, no multi-key sorting · fetched 2026-10-13
- **Beyond the docs:** [Sorting complex arrays in JavaScript](https://johnkavanagh.co.uk/articles/sorting-complex-arrays-in-javascript/) · John Kavanagh, 2025-08-20 · a comparator that sorts by age then name (the multi-key case MDN lacks), says `sort` has been stable since ES2019, and shows capitals sorting before lowercase by default · fetched 2026-10-13 (*read*)
- **Our delta:** the in-place mutation warning and a general multi-key comparator.

### T05-07 · String methods — Master · ✅ written `docs/javascript/pages/phase-5-built-in-library/07-string-methods/01-slicing-and-splitting.md`
- **Read this:** [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) · MDN · instance-method index; each method has its own page (*fetched, not read*) · covers our angle: **full** across the linked pages · fetched 2026-10-13
- **Beyond the docs:** [Strings](https://javascript.info/string) · javascript.info, 2024-01-17 · covers `slice`, `substring` and `at` in detail, with `trim` and `repeat` only named in the summary; it does not cover `split`, `padStart` or `replaceAll`, so it fills only the first third of the row · fetched 2026-10-13 (*read*)
- **Our delta:** the `replace` vs `replaceAll` and `padStart`/`padEnd` pieces, which this pick lacks.

### T05-08 · Template literals — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/08-template-literals/01-interpolation-and-multiline.md`
- **Read this:** [Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) · MDN · multi-line strings, interpolation, nesting, tagged templates, raw strings and `String.raw` (*read* the headings) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Tagged template literals: build mini DSLs](https://blog.openreplay.com/tagged-template-literals-mini-dsls-javascript/) · OpenReplay Team, 2026-06-22 · states that the strings array is always one longer than the values array, and contrasts cooked strings with `strings.raw`, then builds SQL and HTML-escaping tags · fetched 2026-10-13 (*read*)
- **Our delta:** the worked tag examples tied to `String.raw`.

### T05-09 · `JSON.parse` and `JSON.stringify` — Master · ✅ written `docs/javascript/pages/phase-5-built-in-library/09-json/01-stringify.md`
- **Read this:** [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) · MDN · replacer, `toJSON`, dropped values, `undefined` in arrays becoming `null`, `TypeError` on cycles and BigInt (*read*) · covers our angle: **full** for `stringify`; the reviver lives on the `JSON.parse` page · fetched 2026-10-13
- **Beyond the docs:** [JSON methods, toJSON](https://javascript.info/json) · javascript.info, 2024-01-24 · tutorial-paced walk through replacer, reviver, `toJSON`, skipped properties and the circular-reference error (*read*) · fetched 2026-10-13
- **Our delta:** `undefined` in arrays becoming `null`, as a table.

### T05-10 · `Map` vs a plain object — Master · ✅ written `docs/javascript/pages/phase-5-built-in-library/10-map-vs-object/01-the-six-differences.md`
- **Read this:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · the "Objects vs. Maps" section: accidental keys, security, key types, order, size, iteration, performance, serialization (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Map vs Object in JavaScript](https://www.explainthis.io/en/swe/map-vs-object) · ExplainThis, 2023-02-13 (no author shown) · key types, direct iteration, order, `size`; says only that performance depends on context and points elsewhere · fetched 2026-10-13 (*read*)
- **Our delta:** the decision rule and a performance claim we measure.

### T05-11 · `Number` and `Math` — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/11-number-and-math/01-rounding-and-precision.md`
- **Read this:** [Math.random](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random) · MDN · `getRandomInt` and an inclusive variant, and a warning that `Math.round` makes a non-uniform distribution (*read*) · covers our angle: **partial** — rounding is on the `toFixed` page · fetched 2026-10-13
- **Also good:** [Number.prototype.toFixed](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed) · MDN · returns a string; `(2.55).toFixed(1)` gives `'2.5'` because the nearest float is lower (*read*) · fetched 2026-10-13
- **Our delta:** the `toFixed` rounding oddity and clamping. The researcher's three searches found one decent third-party `toFixed` article (SitePoint), but it returned 403, so no Beyond line is given. My own re-search could not run because the web-search budget was exhausted.

### T05-12 · String searching — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/12-string-searching/01-finding-a-substring.md`
- **Read this:** [String.prototype.includes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes) · MDN · case-sensitive substring test; See also links `indexOf`, `startsWith`, `endsWith` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [String.prototype.localeCompare](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare) · MDN · delegates to `Intl.Collator`; use a collator for large arrays (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Locale Aware Sorting in JavaScript](https://elijahmanor.com/byte/js-locale-sort) · Elijah Manor, 2022-03-28 · default sort puts accented ñop last; `localeCompare` fixes it, with `Intl.Collator` for big sets · fetched 2026-10-13 (*read*)
- **Our delta:** the search methods themselves; the pick covers only the sorting half.

### T05-13 · Non-mutating array counterparts — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/13-non-mutating-counterparts.md`
- **Read this:** [Array.prototype.toSorted](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted) · MDN · "the copying version of the `sort()` method"; empty slots sort as `undefined`; See also links `toReversed`, `toSpliced`, `with` (*read*) · covers our angle: **partial** — one method per page · fetched 2026-10-13
- **Beyond the docs:** [ES2023 new array copying methods](https://www.sonarsource.com/blog/es2023-new-array-copying-methods-javascript/) · Phil Nash, Sonar blog, 2023-05-10 · all four methods and why they exist: the old way needed a manual copy before every mutation · fetched 2026-10-13 (*read*)
- **Our delta:** `with` as the missing "assign without mutating".

### T05-14 · `flat`, `flatMap`, `fill`, `copyWithin` — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/14-flat-flatmap-fill.md`
- **Read this:** [Array.prototype.flat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat) · MDN · default depth 1, `Infinity` in an example, and holes removed while flattening (*read*) · covers our angle: **partial** — `fill`, `copyWithin` and `includes` vs `indexOf` have their own pages · fetched 2026-10-13
- **Also good:** [Array.prototype.includes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes) · MDN · `NaN` is equal to itself; the page does not compare with `indexOf`, which is only in See also (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Array.prototype.flat and flatMap](https://v8.dev/features/array-flat-flatmap) · Mathias Bynens, V8 blog, 2019-06-11 · default depth 1, `Infinity` for full flatten, and `flatMap` as a slightly more efficient `map` then `flat`; says nothing about holes · fetched 2026-10-13 (*read*)
- **Our delta:** `fill` and `copyWithin`, which this pick skips.

### T05-15 · Regular expressions — the syntax — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/15-regex-syntax/01-characters-and-quantifiers.md`
- **Read this:** [Regular expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions) · MDN Guide · an overview with a summary table and the flags section; quantifiers, classes, assertions and groups are summarised and linked to sub-guides (*read* the headings) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Assertions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Assertions) · MDN Guide · positive and negative lookahead and lookbehind with examples (*read*) · [Groups and backreferences](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Groups_and_backreferences) · MDN Guide · named groups with a `matchAll` example; no example uses a named backreference (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Regular expressions](https://javascript.info/regular-expressions) · javascript.info · a 17-chapter part: patterns and flags, character classes, anchors, quantifiers, greedy and lazy, capturing groups, backreferences, alternation, lookahead and lookbehind, catastrophic backtracking, sticky flag, methods; I read the table of contents and the lookahead and groups chapters (the lookbehind chapter, 2022-06-07, calls lookbehind unsupported in Safari, which is out of date) · fetched 2026-10-13 (*read* two chapters, *headings only* for the rest)
- **Our delta:** named groups and the lookbehind rules in one table.

### T05-16 · Regular expressions — in practice — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/16-regex-in-practice/01-the-methods-and-flags.md`
- **Read this:** [RegExp.prototype.exec](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec) · MDN · the `lastIndex` loop warnings: do not put the literal in the `while` condition, keep the `g` flag, step manually on zero-length matches (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [String.prototype.matchAll](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll) · MDN · clones the regex, so `lastIndex` is untouched; needs the `g` flag or it throws `TypeError` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [ReDoS and catastrophic backtracking](https://snyk.io/blog/redos-and-catastrophic-backtracking/) · Tim Kadlec, Snyk, 2017-01-17 · `/A(B|C+)+D/` on a 30-character failing string takes about 1.8 s versus 52 ms; fixes include bounding repetition and a lookahead-plus-backreference trick · fetched 2026-10-13 (*read*)
- **Our delta:** the `test` vs `match` vs `matchAll` chooser. The Snyk page is from 2017.

### T05-17 · `Set` — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/17-set.md`
- **Read this:** [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) · MDN · includes the set-composition methods and the rule that arguments must be set-like (a `size`, a `has()` and a `keys()`), not plain iterables; an array is not set-like (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Union, intersection, difference: new JavaScript Set methods](https://www.sonarsource.com/blog/union-intersection-difference-javascript-sets/) · Phil Nash, Sonar blog, 2024-02-15 · worked examples for all seven methods and the SQL-join analogy for four of them; its summary says the methods "operate on any iterable", which MDN contradicts (set-like, not iterable), and every example passes a Set · fetched 2026-10-13 (*read*)
- **Our delta:** the argument-type rules for the set methods. Trust MDN over the Sonar summary here.

### T05-18 · `Object` statics — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/18-object-statics/01-the-map-and-the-four-axes.md`
- **Read this:** [Object.groupBy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy) · MDN · string or symbol keys, null-prototype result, and `Map.groupBy` for other key types (*read*) · covers our angle: **partial** — `assign`, `entries`, `create`, `getOwnPropertyNames` are separate pages · fetched 2026-10-13
- **Beyond the docs:** [How to group array items with Object.groupBy()](https://flaviocopes.com/javascript-object-groupby/) · Flavio Copes, 2026-08-22 · `groupBy` sorts items into named arrays by a callback key, returns a null-prototype object, and `Map.groupBy` keeps object keys · fetched 2026-10-13 (*read*)
- **Our delta:** the four-axes map across all the statics.

### T05-19 · `Date` — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/19-date/01-the-model-and-making-one.md`
- **Read this:** [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) · MDN · date-only forms are read as UTC and date-time forms as local, zero-indexed months, two-digit years, DST gaps and overlaps (*read*) · covers our angle: **partial** — nothing on why a library is still the default · fetched 2026-10-13
- **Beyond the docs:** [The Hidden Traps in JavaScript's Date API](https://hackernoon.com/the-hidden-traps-in-javascripts-date-api) · Gabor Koos, HackerNoon, 2026-07-23 · zero-indexed months, date-only ISO read as UTC, a 23-hour DST day (the 25-hour case is stated but not shown), `setMonth` rolling January 31 to March 3 · fetched 2026-10-13 (*read*)
- **Our delta:** "why a library is still the default", set against Temporal (T05-24).

### T05-20 · `Intl` — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/20-intl/01-the-shape-and-numberformat.md`
- **Read this:** [Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) · MDN · index of every Intl constructor, including `Collator` and `Segmenter` (*read*) · covers our angle: **full** by links · fetched 2026-10-13
- **Beyond the docs:** [The Power Of The Intl API](https://www.smashingmagazine.com/2025/08/power-intl-api-guide-browser-native-internationalization/) · Fuqiao Xue, Smashing Magazine, 2025-08-08 · covers `NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`, `ListFormat`, `PluralRules` and `DisplayNames`; it has nothing on `Collator` or `Segmenter` · fetched 2026-10-13 (*read*)
- **Our delta:** `Collator` and `Segmenter`.

### T05-21 · `structuredClone` — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/21-structuredclone.md`
- **Read this:** [structuredClone()](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone) · MDN · the `transfer` option and `DataCloneError`; it does not list what is cloneable, it links out (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) · MDN · supported types (`Map`, `Set`, `Date`, typed arrays, errors), cycles handled by a visited map, and what fails: functions, DOM nodes, the prototype chain, property descriptors (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Deep-copying in JavaScript using structuredClone](https://web.dev/articles/structured-clone) · Surma, web.dev, last updated 2021-12-16 · JSON round trip throws on cycles and drops functions while `structuredClone` handles cycles and built-ins; it cannot clone functions, DOM nodes or class prototypes · fetched 2026-10-13 (*read*)
- **Our delta:** a table of what survives. The benchmark in the pick dates from 2018.

### T05-22 · Array-likes and iterables — Understand · ✅ written `docs/javascript/pages/phase-5-built-in-library/22-array-likes-and-iterables/01-the-two-contracts.md`
- **Read this:** [Array.from](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from) · MDN · accepts both iterables and array-likes, with `arguments` and `NodeList` examples (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Iterables](https://javascript.info/iterable) · javascript.info, 2024-05-10 · contrasts iterables with array-likes (indexes and `length`, maybe no `Symbol.iterator`) and shows `Array.from` converting either · fetched 2026-10-13 (*read*)
- **Our delta:** `arguments` and `NodeList` converted correctly.

### T05-23 · `WeakMap` and `WeakSet` — Know · ✅ written `docs/javascript/pages/phase-5-built-in-library/23-weakmap-and-weakset/01-the-weak-collections.md`
- **Read this:** [WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap) · MDN · private-members, metadata and caching examples; `WeakRef` and `FinalizationRegistry` are only linked out to the memory-management guide (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Weak references and finalizers](https://v8.dev/features/weak-references) · V8 team, v8.dev, 2019-07-09 (updated 2020-06-19) · `WeakRef` and `FinalizationRegistry` fixing a listener leak, with "don't place important logic in the code path of a finalizer"; also explains `WeakMap` and `WeakSet` · fetched 2026-10-13 (*read*)
- **Our delta:** the attach-data-without-leaking pattern. The pick's support list is dated.

### T05-24 · `Temporal` — Know · ✅ written `docs/javascript/pages/phase-5-built-in-library/24-temporal/01-the-types.md`
- **Read this:** [Temporal documentation](https://tc39.es/proposal-temporal/docs/) · TC39 · `PlainDate`, `Instant`, `ZonedDateTime`, `Duration` and a cookbook; it states no shipping status (*read* the overview) · covers our angle: **partial** — no shipping status · fetched 2026-10-13
- **Also good:** [Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) · MDN · lists the types, marks the feature "Limited availability", and links two polyfills (*read*) · fetched 2026-10-13
- **Beyond the docs:** [JavaScript Temporal in 2026 - is it finally here?](https://bryntum.com/blog/javascript-temporal-is-it-finally-here/) · Arsalan Khattak, Bryntum, 2026-01-21 · lists all eight types and says Firefox 139 and Chrome 144 ship by default, Safari in preview, with two polyfills · fetched 2026-10-13 (*read*)
- **Our delta:** "where it currently ships". Shipping status moves, so check it again; Node 24 status was not verified.

### T05-25 · Typed arrays, `ArrayBuffer` and `DataView` — Know · ✅ written `docs/javascript/pages/phase-5-built-in-library/25-typed-arrays/01-buffers-and-views.md`
- **Read this:** [JavaScript typed arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Typed_arrays) · MDN Guide · buffers, views, `DataView`, multiple views on the same data; endianness is covered inside the `DataView` section, not as its own heading (*read* the headings) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [TypedArray or DataView: Understanding byte order](https://hacks.mozilla.org/2017/01/typedarray-or-dataview-understanding-byte-order/) · Martin Splitt, Mozilla Hacks, 2017-01-04 · typed arrays use host byte order (usually little-endian) while `DataView` defaults to big-endian · fetched 2026-10-13 (*read*)
- **Our delta:** one buffer, several views.

### T05-26 · Text encoding — Know · ✅ written `docs/javascript/pages/phase-5-built-in-library/26-text-encoding/01-textencoder-and-textdecoder.md`
- **Read this:** [The nuances of base64 encoding strings in JavaScript](https://web.dev/articles/base64-encoding) · web.dev, Matt Joseph, last updated 2023-10-17 · `btoa` throws on non-Latin1 text, the TextEncoder fix, and lone surrogates silently changing data (*read*) · covers our angle: **partial** — no "base64 in 2026" (`Uint8Array.toBase64`) · fetched 2026-10-13
- **Also good:** [TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder) · MDN · UTF-8 only, `encode` and `encodeInto`, links `TextDecoder`; no mention of `btoa` or base64 (*read*) · fetched 2026-10-13
- **Our delta:** the 2026 base64 story.

---

## Phase 6 — Iteration, destructuring and generators

### T06-01 · Destructuring — Master · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/01-destructuring/01-the-patterns.md`
- **Read this:** [Destructuring](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring) · MDN · arrays, objects, nesting, defaults, renaming, rest, function parameters, swapping (*read* the headings) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Destructuring assignment](https://javascript.info/destructuring-assignment) · javascript.info, 2026-02-26 · arrays, objects, defaults, renaming, rest, nesting, function parameters, and the swap trick, in lesson order (*read*) · fetched 2026-10-13
- **Our delta:** destructuring in parameters.

### T06-02 · `for…of` vs `for…in` vs `forEach` — Master · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/02-loop-forms/01-what-each-iterates.md`
- **Read this:** [for...of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of) · MDN · a `for...in` comparison, `break` and iterator `return()`; no `forEach` comparison and nothing on `return` or `await` in the body (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [For vs forEach vs for/in vs for/of](https://thecodebarbarian.com/for-vs-for-each-vs-for-in-vs-for-of-in-javascript) · Valeri Karpov, The Code Barbarian, 2019-02-20 · compares the four on holes, `this`, `await` and `yield`; the article does not discuss `break` · fetched 2026-10-13 (*read*)
- **Our delta:** the `break`, `return` and `await` table.

### T06-03 · Spread with iterables — Master · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/03-spread-with-iterables/01-two-operations-one-syntax.md`
- **Read this:** [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax) · MDN · iterables only in arrays and calls, versus own enumerable properties in object literals, so it works on non-iterables (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Rest parameters and spread syntax](https://javascript.info/rest-parameters-spread) · javascript.info, 2022-10-18 · says spread works only with iterables, unlike `Array.from`; it does not explain why object spread works on non-iterables · fetched 2026-10-13 (*read*)
- **Our delta:** object spread as a different operation.

### T06-04 · The iteration protocols — Understand · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/04-iteration-protocols/01-two-protocols-one-handshake.md`
- **Read this:** [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) · MDN · "The iterable protocol" then "The iterator protocol", error handling, and class and generator examples (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Iterables](https://javascript.info/iterable) · javascript.info, 2024-05-10 · builds a `range` object with `Symbol.iterator` returning `next()` results, then calls the iterator by hand (*read*) · fetched 2026-10-13
- **Our delta:** the two protocols as one handshake.

### T06-05 · Generators — Understand · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/05-generators/01-pause-and-resume.md`
- **Read this:** [Generators](https://javascript.info/generators) · javascript.info, 2022-08-30 · generators as iterables, two-way yield, `throw`, composition; infinite sequences get only a short mention (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [function*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) · MDN · a `while (true)` id maker, `return` semantics, generators as iterables; the word "lazy" is not used (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Lazy Sequences with ECMAScript 6 Generators](https://spin.atomicobject.com/ecmascript-6-lazy-sequences/) · William Shawn, Atomic Object, 2017-02-23 · an infinite integer generator with `while (true)`, then `filter` and `map` generators layered on it so nothing is computed until asked · fetched 2026-10-13 (*read*)
- **Our delta:** infinite streams that cost nothing until consumed.

### T06-06 · Async iterators — Understand · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/06-async-iterators/01-for-await-of.md`
- **Read this:** [for await...of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) · MDN · `Symbol.asyncIterator`, async generators, the sync-iterable fallback, and early exit calling `return()` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Async iteration and generators](https://javascript.info/async-iterators-generators) · javascript.info, 2022-02-04 · "Async iterables", "Async generators (finally)" and a paginated GitHub-commits example (*read*) · fetched 2026-10-13
- **Our delta:** none known beyond the row.

### T06-07 · Paginating an API with an async generator — Understand · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/07-paginating-an-api/01-the-pattern.md`
- **Read this:** [Async iteration and generators](https://javascript.info/async-iterators-generators) · javascript.info, 2022-02-04 · the `fetchCommits` pagination example: the next URL comes from the `Link` header, each commit is yielded, and the caller stops with `break` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [ES2018 real-life simple usage of async iteration: get paginated data from REST APIs](https://dev.to/exacs/es2018-real-life-simple-usage-of-async-iteration-get-paginated-data-from-rest-apis-3i2e) · Carlos Saito, DEV Community, 2018-09-24 (edited 2018-10-02) · follows the GitHub Link header for the next URL, yields each page, and stops when none remains · fetched 2026-10-13 (*read*)
- **Also good:** [How to paginate the AWS JS SDK using async generators](https://advancedweb.hu/how-to-paginate-the-aws-js-sdk-using-async-generators/) · Tamas Sallai, 2019-07-30 · a generic `getPaginatedResults` over marker-based APIs; it still collects an array, so it does not show the streaming benefit (*read*) · fetched 2026-10-13
- **Our delta:** where the generator beats collecting an array.

### T06-08 · Early exit inside iteration — Understand · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/08-early-exit/01-what-can-stop.md`
- **Read this:** [Array.prototype.some](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some) · MDN · stops at the first truthy result; it never presents `some` as a `break` replacement (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [How to break out of a JavaScript forEach() loop](https://masteringjs.io/tutorials/fundamentals/foreach-break) · Mastering JS, 2020-10-05 · `break` fails in `forEach`; use `for/of`, or `every()` returning false; it does not mention `some` · fetched 2026-10-13 (*read*)
- **Our delta:** `find` instead of `filter()[0]`, and the cost of chaining.

### T06-09 · Two-way generators — Know · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/09-two-way-generators/01-talking-back.md`
- **Read this:** [Generator.prototype.next](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/next) · MDN · the argument becomes the result of the paused `yield`, and the first value sent is lost; no mention of coroutines or async/await (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Generators](https://javascript.info/generators) · javascript.info, 2022-08-30 · "yield is a two-way street" and `generator.throw`; nothing on the generator-as-coroutine link to async/await (*read*) · fetched 2026-10-13
- **Our delta:** the coroutine idea behind async/await. A search for it found only Python material; nothing JavaScript-specific was verified, and my own re-search could not run because the web-search budget was exhausted.

### T06-10 · `yield*` delegation — Know · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/10-yield-delegation/01-what-it-delegates.md`
- **Read this:** [yield*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield*) · MDN · delegating to generators and other iterables, and the value of the `yield*` expression itself (*read*) · covers our angle: **partial** — no recursive tree-walk example · fetched 2026-10-13
- **Beyond the docs:** [Generators: Generator composition](https://javascript.info/generators) · javascript.info, 2022-08-30 · its "Generator composition" section delegates to other generators with `yield*` to join digit, uppercase and lowercase sequences without storing intermediates (*read*) · fetched 2026-10-13
- **Our delta:** recursive tree walks with `yield*`.

### T06-11 · Iterator helpers — Know · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/11-iterator-helpers/01-the-helper-set.md`
- **Read this:** [Iterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator) · MDN · `drop`, `filter`, `flatMap`, `map`, `take`, `reduce`, `toArray` and `Iterator.from`; the page never uses the word "lazy" (*read*) · covers our angle: **full** for the helper set, **partial** for laziness · fetched 2026-10-13
- **Also good:** [Iterator helpers](https://v8.dev/features/iterator-helpers) · Rezvan Mahdavi Hezaveh, V8 blog, 2024-03-27 · `map`, `filter`, `take`, `drop`, `toArray` and `Iterator.from`; shipped in V8 12.2 (Chrome 122); the page does not use the word "lazy" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Iterator helpers in ES2025](https://blog.logrocket.com/iterator-helpers-es2025) · Elijah Asaolu, LogRocket, 2025-07-21 · helpers run lazily, "they don't do anything until you actually start consuming the values", suited to large or infinite data · fetched 2026-10-13 (*read*)
- **Our delta:** lazy pipelines compared with array chains.

### T06-12 · A collection class that iterates — Know · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/12-a-collection-class/01-the-shape-to-copy.md`
- **Read this:** [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) · MDN · "Defining an iterable with a class" (a `SimpleClass` with a private field and `[Symbol.iterator]()`) and "Defining an iterable with a generator" (*read*) · covers our angle: **partial** — no collection-style example with both forms side by side · fetched 2026-10-13
- **Beyond the docs:** [JavaScript iterators and iterables](https://blog.appsignal.com/2019/07/16/javascript-iterators-and-iterables) · Adam Yeats, AppSignal, 2019-07-16 · builds a LinkedList with a hand-written iterator, then replaces it with a generator method `*[Symbol.iterator]()` (*read*) · fetched 2026-10-13
- **Our delta:** both forms side by side.

### T06-13 · Driving an iterator by hand — When Needed · ✅ written `docs/javascript/pages/phase-6-iteration-and-destructuring/13-driving-by-hand/01-when-for-of-is-not-enough.md`
- **Read this:** [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) · MDN · "Errors during iteration": if you call `next()` by hand, assume the iterator is closed after an error; `return()` runs only on early exit (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Iterables: calling an iterator explicitly](https://javascript.info/iterable) · javascript.info, 2024-05-10 · loops `str[Symbol.iterator]()` with `next()` by hand, and says this lets you pause, do other work, and resume (*read*) · fetched 2026-10-13
- **Our delta:** the cases where manual `next()` wins, such as reading a generator's return value.
