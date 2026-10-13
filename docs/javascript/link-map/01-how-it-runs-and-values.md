---
title: "Link map · JavaScript · Part 1 (phases 0–1)"
sidebar_label: "01 · how it runs and values"
sidebar_position: 1
---

# Link map · JavaScript · Part 1 (phases 0–1)

Covers every topic row of `docs/javascript/syllabus/01-language-core.md` in phase 0 (T00-01 to T00-12, how JavaScript runs) and phase 1 (T01-01 to T01-17, values, types and coercion). That is 29 rows, and all 29 have a written page of ours.
*read* = I read the passage that supports the claim; *headings only* = fetched, headings/size checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no Beyond line.

🔴 **Version note.** Our syllabus verifies output in **Node 24 LTS** (`docs/javascript/README.md`). MDN and the V8 blog track the current language. The living spec at tc39.es/ecma262 was titled as the 2027 edition draft on 2026-10-13, so it can be ahead of what Node 24 ships. Third-party picks are older than the spec and are flagged by date: the Bynens Unicode note (2013) predates `Intl.Segmenter`, and the V8 Ignition and TurboFan post (2017) describes the pipeline at its launch, not the current tiers.

---

## Phase 0 — How JavaScript runs

### T00-01 · The engine, the runtime and the spec — Master · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/01-engine-runtime-spec.md`
- **Read this:** [What's the difference between JavaScript engines and JavaScript runtimes?](https://humanwhocodes.com/blog/2024/03/javascript-engines-runtimes/) · Nicholas C. Zakas, 2024-03-26 · defines engine (implements ECMA-262), host and runtime (host plus I/O), and says the event loop is not in the spec, so each runtime brings its own (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [JavaScript Guide: Introduction](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction) · MDN · states that ECMAScript does not describe the DOM, and splits client-side from server-side JavaScript (*read*) · fetched 2026-10-13
- **Our delta:** which globals come from the host, shown by running the same line in Node and a browser.

### T00-02 · Execution contexts and the call stack — Master · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/03-call-stack.md`
- **Read this:** [Call stack](https://developer.mozilla.org/en-US/docs/Glossary/Call_stack) · MDN · push on call, pop on return, and a stack overflow error when the space runs out (*read*) · covers our angle: **partial** — does not name `RangeError` or show reading a trace · fetched 2026-10-13
- **Beyond the docs:** [JavaScript Call Stack](https://www.javascripttutorial.net/javascript-call-stack/) · javascripttutorial.net (no author or date shown) · steps through an `add` and `average` example and an unbounded recursion that overflows the stack (*read*) · fetched 2026-10-13
- **Our delta:** reading a V8 stack trace top-down and the exact `Maximum call stack size exceeded` text.

### T00-03 · Strict mode — Master · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/04-strict-mode.md`
- **Read this:** [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode) · MDN · the full list of changes, and that module and class bodies are strict with no directive (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** collapsing MDN's long list to the six that bite.

### T00-04 · Parse → compile → execute — Understand · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/02-parse-compile-execute.md`
- **Read this:** [Hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting) · MDN · says the interpreter only appears to move declarations, that the term is not normative in the spec, and shows the TDZ "taint" of a whole block (*read*) · covers our angle: **partial** — does not describe a compile or creation phase · fetched 2026-10-13
- **Also good:** [Blazingly fast parsing, part 2: lazy parsing](https://v8.dev/blog/preparser) · V8 blog, Toon Verwaest and Marja Hölttä, 2019-04-15 · the preparser skips inner functions and still tracks variable declarations (*read*) · fetched 2026-10-13
- **Beyond the docs:** [JavaScript Execution Context and Hoisting](https://www.freecodecamp.org/news/javascript-execution-context-and-hoisting/) · Tapas Adhikary, freeCodeCamp, 2021-04-27 · walks the creation phase and execution phase per context, so hoisting reads as a consequence (*read*) · fetched 2026-10-13
- **Our delta:** the claim that hoisting follows from the creation step, not from a rule.

### T00-05 · What "JavaScript" means today — Understand · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/05-ecmascript-and-tc39.md`
- **Read this:** [The TC39 Process](https://tc39.es/process-document/) · TC39 · stages 0, 1, 2, 2.7, 3, 4, the Stage 4 criteria (two implementations passing Test262), and the yearly July ratification (*read*) · covers our angle: **partial** — process only, nothing on targeting features instead of years · fetched 2026-10-13
- **Also good:** [Specification: ECMA-262](https://tc39.es/ecma262/) · TC39 · the living spec, titled as the 2027 edition on the fetch date (*headings only*) · fetched 2026-10-13
- **Our delta:** feature targets over edition years. A 2017 Pony Foo article on the stages was checked and left out because it predates Stage 2.7.

### T00-06 · The hosts you write for — Understand · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/06-hosts-and-globals.md`
- **Read this:** [globalThis](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis) · MDN · `window` is main-thread only, `self` works in workers, `global` is Node only, `globalThis` works everywhere (*read*) · covers our angle: **partial** — does not list what else differs per host · fetched 2026-10-13
- **Beyond the docs:** [Introducing the Standards-Compliant Workers API](https://blog.cloudflare.com/standards-compliant-workers-api/) · James M Snell, Cloudflare blog, 2022-11-14 · lists the web APIs shared by Node, Deno, Bun and Workers (the Minimum Common API) and the globals runtimes are expected to offer; edge-runtime view (*read*) · fetched 2026-10-13
- **Our delta:** a per-host table (browser, worker, Node, edge) with the guard idiom.

### T00-07 · Loading scripts — Understand · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/07-loading-scripts.md`
- **Read this:** [script element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script) · MDN · `async` runs with no order guarantee, `defer` runs in document order after parsing and before DOMContentLoaded, modules defer by default (*read*) · covers our angle: **partial** — does not state the order among several module scripts · fetched 2026-10-13
- **Beyond the docs:** [Scripts: async, defer](https://javascript.info/script-async-defer) · javascript.info · "load-first" order for async against relative order for defer, plus dynamic scripts; does not cover `type="module"` (*read*) · fetched 2026-10-13
- **Our delta:** module scripts and the full order table.

### T00-08 · Running and inspecting code — Understand · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/08-running-and-inspecting.md`
- **Read this:** [Pause your code with breakpoints](https://developer.chrome.com/docs/devtools/javascript/breakpoints) · Chrome for Developers · line, conditional, logpoint, exception, function and event breakpoints, and `debugger` as an in-code line breakpoint (*read*) · covers our angle: **partial** — Watch expressions are on a separate page, not this one · fetched 2026-10-13
- **Also good:** [Debugging Node.js](https://nodejs.org/learn/getting-started/debugging) · Node.js · `--inspect`, `--inspect-brk` and `chrome://inspect`; it does not mention `node --eval` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Debugging in the browser](https://javascript.info/debugging-chrome) · javascript.info · a short walk through the Sources panel, breakpoints, `debugger` and Watch (*read*) · fetched 2026-10-13
- **Our delta:** `node --eval` and a repeatable debug loop for the sandbox.

### T00-09 · Transpilation and polyfills — Know · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/09-transpilation-polyfills.md`
- **Read this:** [@babel/preset-env](https://babeljs.io/docs/babel-preset-env) · Babel · `targets`, reading Browserslist config, `useBuiltIns` with `entry` and `usage` (removed in Babel 8), and the `corejs` option (*read*) · covers our angle: **partial** — assumes you know the syntax-versus-API split · fetched 2026-10-13
- **Also good:** [Browserslist](https://github.com/browserslist/browserslist) · the shared query list: `defaults`, `last 2 versions`, `> 0.5%`, `not dead`, `baseline widely available` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Compiling vs Polyfills with Babel](https://dev.to/tylermcginnis/compiling-vs-polyfills-with-babel-javascript-bho) · Tyler McGinnis, DEV Community, 2017-10-05 · transforming syntax versus adding missing built-ins, with Promise, `fetch` and `includes` as the polyfill cases; 2017, so the Babel setup it shows is old (*read*) · fetched 2026-10-13
- **Our delta:** what "supported" means for one named feature in one named target.

### T00-10 · Feature detection over user-agent sniffing — Know · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/10-feature-detection.md`
- **Read this:** [Implementing feature detection](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Testing/Feature_detection) · MDN · `in` checks, element-property checks, `CSS.supports` and `@supports`, and a warning not to confuse feature detection with browser sniffing (*read*) · covers our angle: **partial** — browser features only; no `globalThis` guard for non-browser hosts · fetched 2026-10-13
- **Also good:** [globalThis](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis) · MDN · replaces the old per-environment global-object probe (*read*) · fetched 2026-10-13
- **Our delta:** guards that work across hosts. Searched for a stronger third-party explanation; the results were older sniffing rants or thin posts, so none is listed.

### T00-11 · The JIT in one page — Know · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/11-the-jit.md`
- **Read this:** [Launching Ignition and TurboFan](https://v8.dev/blog/launching-ignition-and-turbofan) · V8 team, 2017-05-15 · why V8 moved to an interpreter plus optimizing compiler (*read*) · covers our angle: **partial** — a launch post, not the current tier list · fetched 2026-10-13
- **Also good:** [Microbenchmarks fairy tale](https://mrale.ph/blog/2012-12-15-microbenchmarks-fairy-tale.html) · Vyacheslav Egorov, 2012-12-15 · loop-invariant motion and dead-code removal make a naive timing loop measure the compiler, not the code; V8 internals have moved on since (*read*) · fetched 2026-10-13
- **Beyond the docs:** [JavaScript engine fundamentals: Shapes and Inline Caches](https://mathiasbynens.be/notes/shapes-ics) · Mathias Bynens (with Benedikt Meurer), 2018-06-14 · shapes, transitions and inline caches, the mechanism behind hidden classes (*read*) · fetched 2026-10-13
- **Our delta:** deoptimisation as something you can trigger and observe, and why micro-benchmarks lie.

### T00-12 · Reading the specification — When Needed · ✅ written `docs/javascript/pages/phase-0-how-javascript-runs/12-reading-the-spec.md`
- **Read this:** [ECMAScript Language Specification](https://tc39.es/ecma262/) · TC39 · the Algorithm Conventions section and the Overview section exist and are where reading starts (*headings only*) · covers our angle: **partial** — the spec itself, no guidance on reading it · fetched 2026-10-13
- **Beyond the docs:** [Understanding the ECMAScript spec, part 1](https://v8.dev/blog/understanding-ecmascript-part-1) · Marja Hölttä, V8 blog, 2020-02-03 · reads `Object.prototype.hasOwnProperty` step by step: abstract operations, internal slots, Completion Records and the `?` and `!` shorthands (*read*) · fetched 2026-10-13
- **Beyond the docs:** [How to Read the ECMAScript Specification](https://timothygu.me/es-howto/) · Timothy Gu, living document dated 2020-03-28 · how the spec is organised and worked examples such as `String.prototype.substring()` (*read*) · fetched 2026-10-13
- **Our delta:** one worked lookup of a surprising behaviour end to end.

---

## Phase 1 — Values, types and coercion

### T01-01 · The eight types — Master · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/01-the-eight-types.md`
- **Read this:** [JavaScript data types and data structures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Data_structures) · MDN · lists the primitives, states that all except `null` can be tested with `typeof`, and that `typeof null` returns `"object"` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [typeof](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof) · MDN · the type-tag history, and that an opt-in fix was proposed and rejected (*read*) · fetched 2026-10-13
- **Beyond the docs:** [typeof null: investigating a classic JavaScript bug](https://alexanderell.is/posts/typeof-null/) · Caffeinspiration blog (no author name shown on the page), 2018-03-19 · reads an early (1996) JavaScript engine implementation to show why the zero object tag made `null` look like an object (*read*) · fetched 2026-10-13
- **Our delta:** counting the types (seven primitives plus object) and the safe `typeof` table.

### T01-02 · Primitives are copied, objects are shared — Master · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/02-references-vs-values.md`
- **Read this:** [Object references and copying](https://javascript.info/object-copy) · javascript.info · primitives copied by value, objects hold a reference, `const` objects still mutate, shallow `Object.assign` against deep `structuredClone` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [JavaScript data types and data structures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Data_structures) · MDN · primitives are immutable values (*read*) · fetched 2026-10-13
- **Our delta:** the argument-passing case, "pass by sharing", with a bug that shows it.

### T01-03 · `==` vs `===` — Master · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/03-equality.md`
- **Read this:** [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness) · MDN · the loose-equality steps (same type, null and undefined, object to primitive, then case by case) and a four-way table (*read*) · covers our angle: **partial** — lists the steps but does not cut them to four cases · fetched 2026-10-13
- **Beyond the docs:** [JavaScript Equality Table](https://dorey.github.io/JavaScript-Equality-Table/) · no author or date shown · a grid of `==`, `===` and `if` results, ending with "Always use 3 equals unless you have a good reason to use 2" (*read*) · fetched 2026-10-13
- **Our delta:** four cases and the one defensible use, `x == null`.

### T01-04 · Truthiness — Master · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/04-truthiness.md`
- **Read this:** [Truthy](https://developer.mozilla.org/en-US/docs/Glossary/Truthy) · MDN · everything is truthy except the falsy list, and `[]` is truthy (*read*) · covers our angle: **partial** — the page lists nine entries including `document.all`, our syllabus counts eight · fetched 2026-10-13
- **Beyond the docs:** [Type Conversions](https://javascript.info/type-conversions) · javascript.info · the boolean rule: `"0"` and a whitespace-only string are `true` because a non-empty string always is (*read*) · fetched 2026-10-13
- **Our delta:** why the count is eight, and the `document.all` footnote.

### T01-05 · `null` vs `undefined` — Master · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/05-null-vs-undefined.md`
- **Read this:** [Nullish coalescing](https://v8.dev/features/nullish-coalescing) · V8 blog, Justin Ridgewell, 2019-09-17 · `||` falls back on every falsy value, `??` only on null and undefined, and destructuring defaults fire only for `undefined` (*read*) · covers our angle: **partial** — nothing on which of the two to write · fetched 2026-10-13
- **Also good:** [JavaScript data types and data structures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Data_structures) · MDN · definitions of both primitives (*read*) · fetched 2026-10-13
- **Our delta:** the convention for which to write. No further third-party explainer beat the V8 post.

### T01-06 · Numbers are IEEE-754 doubles — Master · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/06-numbers-are-doubles.md`
- **Read this:** [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) · MDN · 64-bit double layout, `Number.EPSILON` as the mantissa precision, and the safe-integer range; the `MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2` example is on the separate `Number.MAX_SAFE_INTEGER` page (*read* both) · covers our angle: **partial** — no advice on money · fetched 2026-10-13
- **Beyond the docs:** [The Floating-Point Guide: Basic Answers](https://floating-point-gui.de/basic/) · floating-point-gui.de (no author or date shown) · why `0.1 + 0.2` misses (binary cannot represent 0.1 exactly); its sibling pages cover comparison with a tolerance and store-money-as-integer-cents with the drawbacks (*read* the Basic, Comparison and On Using Integers pages) · fetched 2026-10-13
- **Our delta:** integer minor units for money and a tolerance compare.

### T01-07 · `const` does not mean immutable — Understand · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/07-const-is-not-immutable.md`
- **Read this:** [const](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const) · MDN · an immutable binding, not an immutable value; `push` on a `const` array works; freeze for immutability (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [ES2015 const is not about immutability](https://mathiasbynens.be/notes/es6-const) · Mathias Bynens, 2016-02-04 · "The only thing that's immutable here is the binding", and that `Object.freeze()` is shallow (*read*) · fetched 2026-10-13
- **Our delta:** what actually protects an object, including deep freeze.

### T01-08 · Type coercion — Understand · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/08-type-coercion.md`
- **Read this:** [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness) · MDN · shows coercion in the loose-equality steps, such as `[1, 2] == '1,2'` (*read*) · covers our angle: **partial** — no `ToPrimitive` walk-through or `+` operator trace · fetched 2026-10-13
- **Beyond the docs:** [JS Type Coercion Explained](https://www.freecodecamp.org/news/js-type-coercion-explained-27ba3d9a2839/) · Alexey Samoshkin, freeCodeCamp, 2018-01-17 · the internal ToPrimitive with a pseudo implementation, numeric and string conversion, and how `+` and `==` trigger them (*read*) · fetched 2026-10-13
- **Our delta:** the `[] + {}` trace done once, and the statement-start `{}` block ambiguity.

### T01-09 · Explicit conversion — Understand · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/09-explicit-conversion.md`
- **Read this:** [parseInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt) · MDN · always pass a radix, parsing stops at the first invalid character (`parseInt("15px", 10)` is 15), and do not use it to truncate (*read*) · covers our angle: **partial** — `parseInt` only, not `Number()`, `String()`, `Boolean()` or `+x` · fetched 2026-10-13
- **Also good:** [Type Conversions](https://javascript.info/type-conversions) · javascript.info · `Number(value)` on `undefined`, `null`, empty and invalid strings (*read*) · fetched 2026-10-13
- **Our delta:** one table of all the conversion forms against the same twelve inputs.

### T01-10 · Strings are UTF-16 code units — Understand · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/10-strings-are-utf16.md`
- **Read this:** [String: length](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length) · MDN · `length` counts UTF-16 code units, splitting with the string iterator counts characters (code points), and `Intl.Segmenter` counts graphemes (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Intl.Segmenter.prototype.segment()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter/segment) · MDN · the grapheme-granularity example (*read*) · fetched 2026-10-13
- **Beyond the docs:** [JavaScript has a Unicode problem](https://mathiasbynens.be/notes/javascript-unicode) · Mathias Bynens, 2013-10-20 · astral code points, why `'💩'.length` is 2, and the ES6 fixes (`codePointAt`, `for...of`, the `u` flag); 2013, so it predates `Intl.Segmenter` (*read*) · fetched 2026-10-13
- **Our delta:** the three-level length table (units, code points, graphemes).

### T01-11 · `NaN` — Understand · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/11-nan.md`
- **Read this:** [NaN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NaN) · MDN · why `NaN !== NaN` (IEEE 754), `Number.isNaN` against `isNaN`, and the five ways NaN enters your data (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [NaN, the not-a-number number that isn't NaN](https://piccalil.li/blog/nan-the-not-a-number-number-that-isnt-nan/) · Mat Marquis, Piccalilli, 2025-10-23 · arithmetic against NaN gives NaN, `typeof NaN` is `"number"`, and the global `isNaN()` is set beside `Number.isNaN` (*read*) · fetched 2026-10-13
- **Our delta:** where NaN enters real data (parsing, empty fields, bad dates).

### T01-12 · `Symbol` — Understand · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/12-symbol.md`
- **Read this:** [Symbol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol) · MDN · every `Symbol()` is unique, `Symbol.for` uses a registry, and the well-known symbols are listed one line each (*read*) · covers our angle: **partial** — one-line descriptions, no worked use of `toPrimitive` or `hasInstance` · fetched 2026-10-13
- **Beyond the docs:** [A Detailed Overview of Well-Known Symbols](https://dmitripavlutin.com/detailed-overview-of-well-known-symbols/) · Dmitri Pavlutin, updated 2019-07-05 · one section per well-known symbol with examples, including `iterator`, `hasInstance` and `toPrimitive`; no `dispose` symbols, which are newer (*read*) · fetched 2026-10-13
- **Our delta:** symbols as collision-free keys first, protocols second.

### T01-13 · `BigInt` — Understand · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/13-bigint.md`
- **Read this:** [BigInt: arbitrary-precision integers in JavaScript](https://v8.dev/features/bigint) · V8 blog, Mathias Bynens, 2018-05-01 · why doubles run out, why `1 + 1n` throws, and which type to pick for which API (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [BigInt](https://javascript.info/bigint) · javascript.info · explicit `BigInt()` and `Number()` conversion, relational operators working across types, `1 == 1n` true and `1 === 1n` false, and why there is no general polyfill (*read*) · fetched 2026-10-13
- **Our delta:** JSON and BigInt, which neither page covers.

### T01-14 · Value equality in practice — Understand · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/14-value-equality.md`
- **Read this:** [How to Compare Objects in JavaScript](https://masteringjs.io/tutorials/fundamentals/compare-objects) · Mastering JS, 2021-03-23 · the `JSON.stringify` shortcut and its limits: key order, Dates turned into strings, and dropped `undefined` values (*read*) · covers our angle: **partial** — does not cover cycles, Maps, Sets or NaN · fetched 2026-10-13
- **Also good:** [util.isDeepStrictEqual](https://nodejs.org/api/util.html) · Node.js · the built-in deep strict equality; it compares prototypes and constructors by default (*read* that entry) · fetched 2026-10-13
- **Our delta:** a deep-equal that handles cycles, plus the exact list of JSON round-trip losses.

### T01-15 · Object wrappers and autoboxing — Know · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/15-object-wrappers.md`
- **Read this:** [no-new-wrappers](https://eslint.org/docs/latest/rules/no-new-wrappers) · ESLint · says that a wrapper object is created and then destroyed behind a method call on a primitive, that `typeof new String("x")` is `"object"`, and that `new Boolean(false)` is truthy because every object is (*read*) · covers our angle: **partial** — a lint rule with a short autoboxing note, no `String(value)` without `new` case · fetched 2026-10-13
- **Beyond the docs:** [Methods of primitives](https://javascript.info/primitives-methods) · javascript.info · walks the temporary object wrapper created for a method call and discarded after, why `null` and `undefined` have none, and why `new Number(1)` is discouraged (*read*) · fetched 2026-10-13
- **Our delta:** the exact create-and-drop sequence, and `String(value)` against `new String(value)`. A 2ality article on wrapper objects was not fetchable at the canonical URL, so it is not listed.

### T01-16 · `Object.is`, `-0` vs `+0`, and `Infinity` — Know · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/16-object-is-and-zero.md`
- **Read this:** [Object.is()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is) · MDN · differs from `===` only on signed zeros and `NaN`, and does no coercion (*read*) · covers our angle: **partial** — nothing on `Infinity` · fetched 2026-10-13
- **Also good:** [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness) · MDN · the four-way table with SameValueZero, which `includes`, `Map` and `Set` use (*read*) · fetched 2026-10-13
- **Our delta:** where `-0` comes from and `Infinity` arithmetic.

### T01-17 · Numeric literals — Know · ✅ written `docs/javascript/pages/phase-1-values-and-coercion/17-numeric-literals.md`
- **Read this:** [Lexical grammar: numeric literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar) · MDN · decimal, exponent, binary, octal, hex, BigInt, separators and their limits, and legacy octal as a strict-mode syntax error (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Numeric separators](https://v8.dev/features/numeric-separators) · V8 blog, Mathias Bynens, 2019-05-28 · readable digit grouping across literal forms and why legacy `017` gets no separators; lists Chrome 75, Firefox 70, Safari 13, Node.js 12.5.0 (*read*) · fetched 2026-10-13
- **Our delta:** the `0888` against `0777` legacy trap.
