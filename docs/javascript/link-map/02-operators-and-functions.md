---
title: "Link map · JavaScript · Part 2 (phases 2–3)"
sidebar_label: "02 · operators and functions"
sidebar_position: 2
---

# Link map · JavaScript · Part 2 (phases 2–3)

Covers every topic row of `docs/javascript/syllabus/01-language-core.md` in phase 2 (T02-01 to T02-15, operators, expressions and control flow) and phase 3 (T03-01 to T03-20, functions, scope and closures). That is 35 rows, and every one has a written page of ours, so every block is ✅. Phase 3 topics that are a directory of chunk files name the first chunk.
*read* = the passage that supports the claim was read. For MDN, glossary, spec and lodash links the 200 response and the page title were checked and the lead passage was read, so their one-line descriptions say what the page is, not everything it says, and their "covers our angle" is not assessed. Third-party pages carry the date the page shows; where it shows none, none is given. GitHub book chapters were read from the raw file at the same repo path and are linked to the normal GitHub page, which also loads. No `#anchors` are given.

🔴 **Version note.** Our syllabus verifies against **Node 24 LTS** (`docs/javascript/README.md`) and names no ECMAScript edition. MDN pages are the current living reference. Picks written for an older language: the You Don't Know JS `this` chapter is from the 1st edition (pre-ES2015 era, though it notes arrows), the Overreacted `useEffect` guide is from 2019 and predates `useEffectEvent`, and the 2015 and 2016 articles predate optional chaining and logical assignment. The 2ality pages that came up in search returned 404 on the live site, so none is cited. The tail-call story in T03-14 comes from javascript.info, which says tail-call optimisation is "not yet supported everywhere" and does not name V8; the WebKit post on proper tail calls shows one engine that shipped it. No page opened here states V8's position, so the syllabus claim about V8 is not backed by a link in this file.

---

## Phase 2 — Operators, expressions and control flow

### T02-01 · Arithmetic operators — Master · ✅ written `docs/javascript/pages/phase-2-operators/01-arithmetic.md`
- **Read this:** [Remainder (%)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder) · MDN · reference for `%`; sibling pages Addition and Exponentiation cover `+` and `**` *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [Addition (+)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Addition) · [Exponentiation (**)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Exponentiation)
- **Also good:** [Basic operators](https://javascript.info/operators) · javascript.info, page dated Jan 31, 2023 · `%`, `**`, and the `+` concatenation order (`'1' + 2 + 2` gives `"122"`) are all shown (*read*) · fetched 2026-10-13
- **Beyond the docs:** [The Modulus Operator in JavaScript](https://masteringjs.io/tutorials/fundamentals/modulus) · Mastering JS, page dated Dec 13, 2019 · states the result of `%` takes the sign of the left operand, with `-21 % 5` giving -1; no true-modulo workaround is shown there · fetched 2026-10-13 (*read*)
- **Our delta:** integer division and the true-modulo workaround, which the Mastering JS page lacks.

### T02-02 · Assignment and compound assignment — Understand · ✅ written `docs/javascript/pages/phase-2-operators/02-assignment.md`
- **Read this:** [Assignment (=)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Assignment) · MDN · assignment and compound assignment forms *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [Logical AND assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_AND_assignment) · [Logical OR assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_OR_assignment) · [Nullish coalescing assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_assignment)
- **Beyond the docs:** [Logical assignment](https://v8.dev/features/logical-assignment) · Shu-yu Guo, V8 blog, May 7, 2020 · logical assignments only run when the logical operation would evaluate its right side, so no write happens otherwise, with an `innerHTML` reset losing focus as the motivating bug · fetched 2026-10-13 (*read*)
- **Our delta:** the write is skipped, not just the right-hand evaluation; the V8 article is an engine-team explainer of ES2021.

### T02-03 · Logical operators return operands, not booleans — Master · ✅ written `docs/javascript/pages/phase-2-operators/03-logical-operators.md`
- **Read this:** [Logical operators](https://javascript.info/logical-operators) · javascript.info, page dated June 5, 2022 · `||` and `&&` return one of their original operands without boolean conversion, and `||` stops at the first truthy operand · fetched 2026-10-13 (*read*) · covers our angle: **partial** — does not reach the default-value idiom that breaks on `0`
- **Also good:** [Nullish coalescing operator (??)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing) · MDN *(MDN: 200, title and lead passage read)* · [Logical OR (||)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_OR) · [Logical AND (&&)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_AND) · fetched 2026-10-13
- **Beyond the docs:** [Nullish coalescing operator '??'](https://javascript.info/nullish-coalescing-operator) · javascript.info, page dated April 23, 2023 · `height || 100` gives 100 when `height` is `0` because `0` is falsy, while `height ?? 100` keeps `0`; the page says a zero height is often valid and should not be replaced · fetched 2026-10-13 (*read*) · covers our angle: **full** for the `0` failure; it does not show the `''` case
- **Our delta:** the `0` and `''` failure of `x || default` shown as one table next to `??`.

### T02-04 · Optional chaining `?.` — Master · ✅ written `docs/javascript/pages/phase-2-operators/04-optional-chaining.md`
- **Read this:** [Optional chaining (?.)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining) · MDN · reference for `?.`, `?.()` and `?.[]` *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Also good:** [no-unsafe-optional-chaining](https://eslint.org/docs/latest/rules/no-unsafe-optional-chaining) · ESLint docs · lists where a short-circuited chain still throws: `(obj?.foo)()`, `(obj?.foo).bar`, `new (obj?.foo)()`, spread, destructuring, `for (bar of obj?.foo)` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Optional chaining](https://javascript.info/optional-chaining) · javascript.info, page dated April 14, 2022 · `?.()` and `?.[]` shown, and `user?.name = "John"` is an error; an undeclared variable before `?.` still throws a ReferenceError · fetched 2026-10-13 (*read*)
- **Our delta:** the three failures it does not protect against: an undeclared base, assignment targets, and a short-circuited result used as input to the next operation (the ESLint list is the evidence).

### T02-05 · Loops — Master · ✅ written `docs/javascript/pages/phase-2-operators/05-loops.md`
- **Read this:** [Loops and iteration](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Loops_and_iteration) · MDN · guide chapter covering the loop statements *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [for...of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of) · [for...in](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in) · [for await...of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of)
- **Also good:** [Loops: while and for](https://javascript.info/while-for) · javascript.info, page dated June 19, 2022 · `break`, `continue` and labels; `break` and `continue` cannot sit on the right of `?` · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Javascript loops: for vs forEach vs for.. in vs for.. of](https://dev.to/smpnjn/javascript-loops-for-vs-foreach-vs-for-in-vs-for-of-1mbo) · Johnny Simpson, DEV Community, posted Nov 6, 2022 · side-by-side of the four loop forms and when each fits; it does not cover `for await...of`, and its claim that `forEach` is much slower is not verified here · fetched 2026-10-13 (*read*)
- **Our delta:** a decision table that includes `for await…of`, which the third-party article omits.

### T02-06 · Spread and rest — Master · ✅ written `docs/javascript/pages/phase-2-operators/06-spread-and-rest.md`
- **Read this:** [Spread syntax (...)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax) · MDN · reference for spread *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [Rest parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters)
- **Beyond the docs:** [Rest parameters and spread syntax](https://javascript.info/rest-parameters-spread) · javascript.info, page dated Oct 18, 2022 · rest must be last in the parameter list, and spread copies arrays and objects; the page never says the copy is shallow · fetched 2026-10-13 (*read*) · covers our angle: **partial**
- **Our delta:** both copies are shallow, plus forwarding arguments; the third-party page does not say so.

### T02-07 · Comparison operators — Understand · ✅ written `docs/javascript/pages/phase-2-operators/07-comparison.md`
- **Read this:** [Less than](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Less_than) · MDN · reference for relational operators *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [Greater than](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Greater_than)
- **Beyond the docs:** [Comparisons](https://javascript.info/comparison) · javascript.info, page dated Nov 12, 2025 · strings compare letter by letter in Unicode order so "a" is greater than "A", mixed types convert to numbers, and `null >= 0` is true while `null == 0` is false · fetched 2026-10-13 (*read*) · covers our angle: **partial** — nothing on `Date` or object comparison
- **Our delta:** comparing `Date`s (relational works on the number, `===` does not) and why objects never compare by content.

### T02-08 · Conditionals — Understand · ✅ written `docs/javascript/pages/phase-2-operators/08-conditionals.md`
- **Read this:** [Conditional (ternary) operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_operator) · MDN · reference for the ternary *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [if...else](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/if...else)
- **Beyond the docs:** [Conditional branching: if, '?'](https://javascript.info/ifelse) · javascript.info, page dated Dec 7, 2022 · chained `?` equals `if..else if..else`, split across lines, and use `?` to return a value rather than to pick which code runs · fetched 2026-10-13 (*read*)
- **Our delta:** the point at which a ternary costs more than it saves, and nesting limits.

### T02-09 · `switch` — Understand · ✅ written `docs/javascript/pages/phase-2-operators/09-switch.md`
- **Read this:** [switch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/switch) · MDN · reference for `switch`, `case` and `default` *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Also good:** [no-case-declarations](https://eslint.org/docs/latest/rules/no-case-declarations) · ESLint docs · a `let`, `const`, `function` or `class` in a `case` is visible across the whole `switch` block but initialised only when its case runs; wrap the clause in braces (*read*) · fetched 2026-10-13
- **Beyond the docs:** [The switch statement](https://javascript.info/switch) · javascript.info, page dated April 25, 2022 · comparison is strict, cases can share a block, and a missing `break` runs on into the next case without checks · fetched 2026-10-13 (*read*)
- **Our delta:** the case block-scope trap in full, and object lookup as an alternative.

### T02-10 · Operator precedence and associativity — Understand · ✅ written `docs/javascript/pages/phase-2-operators/10-precedence.md`
- **Read this:** [Operator precedence](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence) · MDN · the precedence and associativity table *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Also good:** [SyntaxError: cannot use ?? unparenthesized within || and && expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cant_use_nullish_coalescing_unparenthesized) · MDN *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Beyond the docs:** [Nullish coalescing operator '??'](https://javascript.info/nullish-coalescing-operator) · javascript.info, page dated April 23, 2023 · `1 && 2 ?? 3` is a syntax error and `(1 && 2) ?? 3` gives `2`; `height ?? 100 * width ?? 50` groups as `height ?? (100 * width) ?? 50` · fetched 2026-10-13 (*read*) · covers our angle: **partial** — nothing on right-associative `**` or `typeof` vs `instanceof`
- **Our delta:** right-associative `**` and the `typeof` / `instanceof` cases; look them up in the MDN table.

### T02-11 · Expressions vs statements — Understand · ✅ written `docs/javascript/pages/phase-2-operators/11-expressions-vs-statements.md`
- **Read this:** [Expressions and operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators) · MDN · guide chapter on expressions *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [Statements and declarations](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements)
- **Also good:** [IIFE](https://developer.mozilla.org/en-US/docs/Glossary/IIFE) · MDN glossary *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Beyond the docs:** [What is a JavaScript Expression?](https://masteringjs.io/tutorials/fundamentals/expressions) · Mastering JS, page dated July 22, 2019 · an expression yields a value and a statement performs an action; `function getAnswer() { return 42 }();` is a SyntaxError and the grouping operator turns it into an IIFE · fetched 2026-10-13 (*read*)
- **Our delta:** the `{}` block-or-object ambiguity at statement start; the Mastering JS page covers only the IIFE half.

### T02-12 · Automatic semicolon insertion — Understand · ✅ written `docs/javascript/pages/phase-2-operators/12-asi.md`
- **Read this:** [Lexical grammar](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar) · MDN · the page that holds the automatic semicolon insertion rules *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Also good:** [ECMAScript Language Specification](https://tc39.es/ecma262/) · TC39 · normative rules under the "Rules of Automatic Semicolon Insertion" section, which the page contains (section confirmed present, rules not read; no anchor given) · fetched 2026-10-13
- **Beyond the docs:** [Semicolons in JavaScript](https://flaviocopes.com/javascript-automatic-semicolon-insertion/) · Flavio Copes, Jul 16, 2018 · pitfalls: a bare `return` before an object literal, and next lines that start with a parenthesis, bracket or operator merging into the previous one · fetched 2026-10-13 (*read*)
- **Our delta:** the exact rules and all five dangerous line starts as one list; the article has four of them.

### T02-13 · `break`, `continue` and labelled statements — Know · ✅ written `docs/javascript/pages/phase-2-operators/13-break-continue-labels.md`
- **Read this:** [Labeled statement](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/label) · MDN · reference for labels *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [break](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/break) · [continue](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/continue)
- **Also good:** [Loops: while and for](https://javascript.info/while-for) · javascript.info, page dated June 19, 2022 · labels let `break` or `continue` target an outer loop; they cannot jump to arbitrary places and `continue` needs a loop · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [How to Break and Continue in Nested Loops in JavaScript](https://www.dannyguo.com/blog/how-to-break-and-continue-in-nested-loops-in-javascript) · Danny Guo, April 17, 2022 · short, uses `break chunkLoop;` and `continue chunkLoop;`; labels only, no function-return or flag alternative · fetched 2026-10-13 (*read*) · also [JavaScript Labels](https://davidwalsh.name/javascript-labels) · David Walsh, Jan 15, 2019 · a `continue firstLoop` example (*read*)
- **Our delta:** the one case labels earn their place, against extracting a function.

### T02-14 · Bitwise operators — Know · ✅ written `docs/javascript/pages/phase-2-operators/14-bitwise.md`
- **Read this:** [Bitwise AND (&)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND) · MDN · reference for `&` *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [Bitwise NOT (~)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_NOT) · [Unsigned right shift](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unsigned_right_shift)
- **Beyond the docs:** [A guide to JavaScript bitwise operators](https://blog.logrocket.com/guide-javascript-bitwise-operators/) · Glad Chinda, LogRocket, Apr 13, 2023 · operands become signed 32-bit two's complement; bit masks to turn bits on, off and toggle, a config-flags section, and `>>>` as an unsigned result; it never mentions `~~` · fetched 2026-10-13 (*read*)
- **Our delta:** `~~` as a bad `Math.trunc`; absent from the article.

### T02-15 · The comma operator, `void`, `in` and `delete` — Know · ✅ written `docs/javascript/pages/phase-2-operators/15-comma-void-in-delete.md`
- **Read this:** [Comma operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Comma_operator) · MDN · reference for the comma operator *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [void](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/void) · [in](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in) · [delete](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete)
- **Beyond the docs:** [Basic operators](https://javascript.info/operators) · javascript.info, page dated Jan 31, 2023 · the comma operator evaluates each part, keeps the last, and has lower precedence than `=`, so `let a = (1 + 2, 3 + 4);` needs the parentheses · fetched 2026-10-13 (*read*) · covers our angle: **partial** — comma only; no good third-party piece on `void`, `in` or `delete` found in 2 searches
- **Our delta:** `void`, `in` and `delete` as operators.

---

## Phase 3 — Functions, scope and closures

### T03-01 · Declarations vs expressions vs arrow functions — Master · ✅ written `docs/javascript/pages/phase-3-functions/01-declarations-expressions-arrows.md`
- **Read this:** [Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions) · MDN · guide chapter *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [function declaration](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function) · [function expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/function) · [Arrow function expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions)
- **Also good:** [Function expressions](https://javascript.info/function-expressions) · javascript.info, page dated Jan 22, 2025 · a declaration is set up before the script runs, an expression exists only once execution reaches it, and a declaration in a block is block-scoped in strict mode · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Function Declarations vs. Function Expressions vs. Arrow Functions](https://johnkavanagh.co.uk/articles/function-declarations-vs-expressions-vs-arrow-functions/) · John Kavanagh, 5 December 2016 · declarations are callable before their line, expressions assigned with `const` are not, and arrows close over the surrounding `this`; stack-trace naming is not covered · fetched 2026-10-13 (*read*)
- **Our delta:** naming for stack traces and which to reach for by default.

### T03-02 · Parameters — Master · ✅ written `docs/javascript/pages/phase-3-functions/02-parameters/01-defaults-and-scope.md`
- **Read this:** [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters) · MDN · reference for defaults *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [Rest parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters) · [The arguments object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments)
- **Beyond the docs:** [Function basics](https://javascript.info/function-basics) · javascript.info, page dated July 4, 2026 · a default applies when the argument is strictly `undefined` and is evaluated on every call without it; contrasts `||` and `??` · fetched 2026-10-13 (*read*) · covers our angle: **partial** — nothing on left-to-right evaluation, rest, or `arguments`
- **Our delta:** left-to-right evaluation and the `arguments` object you should stop using.

### T03-03 · `this` — Master · ✅ written `docs/javascript/pages/phase-3-functions/03-this/01-the-four-rules.md`
- **Read this:** [this](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this) · MDN · reference for `this` *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Beyond the docs:** [this and Object Prototypes, ch. 2: this All Makes Sense Now](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/this%20%26%20object%20prototypes/ch2.md) · Kyle Simpson, You Don't Know JS (1st ed.) · find the call-site, then apply new binding, explicit binding, implicit binding, default binding in that order; arrows ignore all four. First edition, so older than the syllabus; fetched as the raw file from the same repo path · fetched 2026-10-13 (*read*)
- **Our delta:** the four rules as one decision tree, evaluated at call time.

### T03-04 · Arrow functions have no `this` — Master · ✅ written `docs/javascript/pages/phase-3-functions/04-arrow-functions-and-this/01-lexical-this.md`
- **Read this:** [Arrow function expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions) · MDN · reference for arrows *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Also good:** [Arrow functions revisited](https://javascript.info/arrow-functions) · javascript.info, page dated Feb 1, 2021 · no `this`, no `arguments`, cannot be called with `new`, no `super` · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [When Not to use an Arrow Function](https://wesbos.com/arrow-function-no-no) · Wes Bos, Sept 10, 2016 · four wrong uses: click handlers, object methods, prototype methods, and code that reads `arguments` · fetched 2026-10-13 (*read*)
- **Our delta:** the method-definition mistake in full, with the `new` and `prototype` consequences.

### T03-05 · `call`, `apply` and `bind` — Master · ✅ written `docs/javascript/pages/phase-3-functions/05-call-apply-bind/01-the-three-methods.md`
- **Read this:** [Function.prototype.call()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call) · MDN · reference for `call` *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [apply()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply) · [bind()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind)
- **Also good:** [Decorators and forwarding, call/apply](https://javascript.info/call-apply-decorators) · javascript.info, page dated June 8, 2022 · `call` and `apply` set `this`, `[].join.call(arguments)` borrows a method, and a caching decorator is built on them · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Function binding](https://javascript.info/bind) · javascript.info, page dated April 13, 2025 · `setTimeout(user.sayHi, 1000)` loses `this`; `bind` returns a new function and "A function cannot be re-bound"; `mul.bind(null, 2)` is partial application · fetched 2026-10-13 (*read*)
- **Our delta:** what `bind` returns and its cost.

### T03-06 · Closures — Master · ✅ written `docs/javascript/pages/phase-3-functions/06-closures/01-what-is-captured.md`
- **Read this:** [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures) · MDN · guide chapter *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Also good:** [Variable scope, closure](https://javascript.info/closure) · javascript.info, page dated June 13, 2022 · each call gets a Lexical Environment with an outer reference fixed when the function is created, and it stays in memory while reachable · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Scope and Closures, ch. 7: Using Closures](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/ch7.md) · Kyle Simpson, You Don't Know JS Yet (2nd ed.) · a closure is a live link to the variable, not a snapshot; `var` in a loop shares one `i`, fixed by a per-iteration copy or `let`; closures keep captured values alive; fetched as the raw file from the same repo path · fetched 2026-10-13 (*read*)
- **Our delta:** the memory it holds alive, with the engine caveat that a whole scope may be kept.

### T03-07 · Lexical scope and the scope chain — Master · ✅ written `docs/javascript/pages/phase-3-functions/07-lexical-scope/01-the-scope-chain.md`
- **Read this:** [Scope](https://developer.mozilla.org/en-US/docs/Glossary/Scope) · MDN glossary · definition page *(MDN: 200, title and lead passage read)* · [let](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let) · fetched 2026-10-13
- **Beyond the docs:** [Scope and Closures, ch. 3: The Scope Chain](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/ch3.md) · Kyle Simpson, You Don't Know JS Yet (2nd ed.) · lookup, shadowing, and illegal shadowing: a `var` cannot cross a `let` of the same name in an enclosing block, but a function boundary lifts the limit; fetched as the raw file from the same repo path · fetched 2026-10-13 (*read*)
- **Our delta:** `var` vs `let`/`const` side by side with function and block scope.

### T03-08 · Hoisting and the temporal dead zone — Master · ✅ written `docs/javascript/pages/phase-3-functions/08-hoisting-and-tdz/01-the-two-step-scope-entry.md`
- **Read this:** [Hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting) · MDN glossary *(MDN: 200, title and lead passage read)* · [let](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let) · fetched 2026-10-13
- **Beyond the docs:** [Scope and Closures, ch. 5: The (Not So) Secret Lifecycle of Variables](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/ch5.md) · Kyle Simpson, You Don't Know JS Yet (2nd ed.) · hoisting as a compile-time registering of identifiers; `let` and `const` are registered but uninitialised, so early access throws; the TDZ is a period of time, not a position; fetched as the raw file from the same repo path · fetched 2026-10-13 (*read*)
- **Our delta:** why the TDZ is a feature, and class and circular-import cases.

### T03-09 · Higher-order functions — Understand · ✅ written `docs/javascript/pages/phase-3-functions/09-higher-order-functions.md`
- **Read this:** [Higher-order Functions](https://eloquentjavascript.net/05_higher_order.html) · Eloquent JavaScript, Marijn Haverbeke · "Functions that operate on other functions, either by taking them as arguments or by returning them", with `greaterThan(n)` and `noisy(f)`; the page shows no date (*read*) · fetched 2026-10-13
- **Also good:** [First-class Function](https://developer.mozilla.org/en-US/docs/Glossary/First-class_Function) · MDN glossary *(MDN: 200, title and lead passage read)* · [Callback function](https://developer.mozilla.org/en-US/docs/Glossary/Callback_function) · fetched 2026-10-13
- **Our delta:** callbacks and functions that return functions in one place.

### T03-10 · Debounce and throttle — Understand · ✅ written `docs/javascript/pages/phase-3-functions/10-debounce-and-throttle.md`
- **Read this:** [Debouncing and Throttling Explained Through Examples](https://css-tricks.com/debouncing-throttling-explained-examples/) · David Corbacho, CSS-Tricks, April 6, 2016 · debounce groups a burst into one call, trailing edge by default with a leading option; throttle runs at most once every X ms, which suits infinite scroll (*read*) · fetched 2026-10-13
- **Also good:** [Lodash documentation](https://lodash.com/docs/) · lodash · the `debounce` and `throttle` entries, with `leading` and `trailing` options (*read*; no anchor given) · fetched 2026-10-13
- **Our delta:** cancellation and choosing between them; no official docs page exists since neither is in the language.

### T03-11 · Currying and partial application — Understand · ✅ written `docs/javascript/pages/phase-3-functions/11-currying-and-partial-application.md`
- **Read this:** [Currying](https://javascript.info/currying-partials) · javascript.info, page dated Jan 10, 2021 · currying turns `f(a, b, c)` into `f(a)(b)(c)`; a partial is the result of presetting arguments; `curry` built on `func.length` and fails for rest-parameter functions · fetched 2026-10-13 (*read*) · covers our angle: **full** for the interview `curry`
- **Also good:** [Partial Application and Currying](https://github.com/getify/Functional-Light-JS/blob/master/manuscript/ch3.md) · Kyle Simpson, Functional-Light JavaScript, ch. 3 · partial application reduces arity, currying fixes it at 1, both rely on closures; fetched as the raw file from the same repo path (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Chapter 04: Currying](https://mostly-adequate.gitbook.io/mostly-adequate-guide/ch04) · Mostly Adequate Guide to Functional Programming (free online book) · currying as calling a function with fewer arguments than it expects and getting back a function that takes the rest, with the page calling the fewer-arguments call partial application; the page shows no author or date · fetched 2026-10-13 (*read*)
- **Our delta:** explaining it under interview pressure.

### T03-12 · Composition — Understand · ✅ written `docs/javascript/pages/phase-3-functions/12-composition.md`
- **Read this:** [Composing Functions](https://github.com/getify/Functional-Light-JS/blob/master/manuscript/ch4.md) · Kyle Simpson, Functional-Light JavaScript, ch. 4 · `compose` runs right to left and `pipe` left to right, a point-free refactor that ends in `getLastOrder( lookupPerson );`, and a warning that fully inlined point-free is less readable; fetched as the raw file from the same repo path (*read*) · fetched 2026-10-13
- **Also good:** [Chapter 05: Coding by Composing](https://mostly-adequate.gitbook.io/mostly-adequate-guide/ch05) · Mostly Adequate Guide to Functional Programming · `compose` runs right to left, point-free style can obscure intent, and a `trace` helper logs the value between steps of a composition; no date or author shown (*read*) · fetched 2026-10-13
- **Our delta:** the debuggability cost in full; Functional-Light ch. 4 never mentions debugging, and the Mostly Adequate chapter reaches only the `trace` helper.

### T03-13 · Memoization — Understand · ✅ written `docs/javascript/pages/phase-3-functions/13-memoization.md`
- **Read this:** [Practical Memoization Patterns in JavaScript](https://blog.openreplay.com/practical-memoization-patterns-javascript/) · OpenReplay Team, January 20, 2026 · objects are cached by reference, `JSON.stringify` keys fail on cycles and drop functions, unbounded caches leak so cap with LRU or TTL, cache the promise for async and delete it on failure; no mention of `WeakMap` (*read*) · fetched 2026-10-13
- **Our delta:** key derivation as the hard part and the `WeakMap` option the article leaves out.

### T03-14 · Recursion — Understand · ✅ written `docs/javascript/pages/phase-3-functions/14-recursion.md`
- **Read this:** [Recursion and stack](https://javascript.info/recursion) · javascript.info, page dated Oct 1, 2022 · execution context stack, a depth limit that the page puts around 10000 as a safe assumption, base case, and tail-call optimisation that is "not yet supported everywhere" and works only in simple cases; it does not name V8 · fetched 2026-10-13 (*read*)
- **Also good:** [InternalError: too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Beyond the docs:** [ECMAScript 6 Proper Tail Calls in WebKit](https://webkit.org/blog/6240/ecmascript-6-proper-tail-calls-in-webkit/) · Michael Saboff, WebKit blog, May 23, 2016 · what a proper tail call buys (the caller's stack space is reused, deep recursion no longer overflows), that it applies only in strict mode, and how JavaScriptCore keeps debugging usable; it describes WebKit only and does not discuss V8 · fetched 2026-10-13 (*read*) · covers our angle: **partial**
- **Our delta:** mutual recursion, trampolines and V8's lack of tail-call optimisation; no opened page states V8's position.

### T03-15 · Pure functions and side effects — Understand · ✅ written `docs/javascript/pages/phase-3-functions/15-pure-functions.md`
- **Read this:** [Reducing Side Effects](https://github.com/getify/Functional-Light-JS/blob/master/manuscript/ch5.md) · Kyle Simpson, Functional-Light JavaScript, ch. 5 · side effects and side causes, purity judged from the outside, and where impurity belongs: move effects to the call site, encapsulate, or wrap in a pure interface; fetched as the raw file from the same repo path (*read*) · fetched 2026-10-13
- **Also good:** [Chapter 03: Pure Happiness with Pure Functions](https://mostly-adequate.gitbook.io/mostly-adequate-guide/ch03) · Mostly Adequate Guide to Functional Programming · a pure function gives the same output for the same input with no observable side effects, and the chapter lists portable, memoizable and testable (no mocks, no world state) as the payoffs; no date or author shown (*read*) · fetched 2026-10-13
- **Our delta:** what purity buys in testing; the functional-core imperative-shell talk by Gary Bernhardt was found by search but its page was not opened, so it is not cited.

### T03-16 · There is no function overloading — Understand · ✅ written `docs/javascript/pages/phase-3-functions/16-no-function-overloading.md`
- **Read this:** [Even More Useful JavaScript Function Patterns - Function Overloading](https://www.barbarianmeetscoding.com/blog/mastering-the-arcane-art-of-javascript-mancy-for-c-sharp-developers-chapter-5-more-useful-function-patterns-function-overloading/) · Jaime González García, Barbarian Meets Coding, May 26, 2015 · four emulations: inspect `arguments`, an options object, ES2015 default arguments, and a functional dispatch helper; a 2015 article (*read*) · fetched 2026-10-13
- **Also good:** [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters) · MDN *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Beyond the docs:** [JavaScript Method Overloading](https://johnresig.com/blog/javascript-method-overloading/) · John Resig, November 13, 2007 · an `addMethod` helper that dispatches on `fn.length`, the number of declared parameters, so overloads differ by argument count; a 2007 technique that predates default and rest parameters · fetched 2026-10-13 (*read*)
- **Our delta:** designing a signature that ages well.

### T03-17 · Closure and default-parameter gotchas — Understand · ✅ written `docs/javascript/pages/phase-3-functions/17-closure-and-default-gotchas/01-null-undefined-and-the-api-boundary.md`
- **Read this:** [A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/) · Dan Abramov, Overreacted, March 9, 2019 · each render has its own props and state; an interval with an empty dependency array keeps the first render's `count`, fixed by the dependency array or `setCount(c => c + 1)` (*read*) · covers our angle: **partial** — the stale closure only, not shared mutable defaults · fetched 2026-10-13
- **Also good:** [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures) · MDN *(MDN: 200, title and lead passage read)* · fetched 2026-10-13
- **Beyond the docs:** [Be Aware of Stale Closures when Using React Hooks](https://dmitripavlutin.com/react-hooks-stale-closures/) · Dmitri Pavlutin, page shows "Updated March 17, 2023" · a `setInterval` in `useEffect` with empty dependencies logs the first render's `count` forever; fixes are the dependency array, `setCount(count => count + 1)`, or a ref · fetched 2026-10-13 (*read*) · covers our angle: **partial** — the stale closure only
- **Our delta:** shared mutable defaults and loop-variable capture; both React articles predate `useEffectEvent`.

### T03-18 · IIFE and the module pattern — Know · ✅ written `docs/javascript/pages/phase-3-functions/18-iife-and-the-module-pattern.md`
- **Read this:** [IIFE](https://developer.mozilla.org/en-US/docs/Glossary/IIFE) · MDN glossary *(MDN: 200, title and lead passage read)* · [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) · fetched 2026-10-13
- **Also good:** [The old var](https://javascript.info/var) · javascript.info, page dated Nov 13, 2022 · `var` has no block scope, so older code used an IIFE for private variables; "nowadays there's no reason to write such code" · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Scope and Closures, ch. 8: The Module Pattern](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/ch8.md) · Kyle Simpson, You Don't Know JS Yet (2nd ed.) · the IIFE module is a singleton unless wrapped in a factory; ES modules are file-based, private by default and strict; fetched as the raw file from the same repo path · fetched 2026-10-13 (*read*)
- **Our delta:** what modules replaced the pattern with.

### T03-19 · Function properties — Know · ✅ written `docs/javascript/pages/phase-3-functions/19-function-properties.md`
- **Read this:** [Function: length](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/length) · MDN · reference for `length` *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [name](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name) · [toString()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/toString)
- **Beyond the docs:** [Function object, NFE](https://javascript.info/function-object) · javascript.info, page dated April 6, 2025 · `name` is inferred from context, `length` skips rest parameters and is used for introspection by checking `handler.length`, and a named function expression can call itself reliably · fetched 2026-10-13 (*read*)
- **Our delta:** `toString` and why libraries read these properties; one search could not name specific libraries.

### T03-20 · `new.target`, constructor functions and class guards — Know · ✅ written `docs/javascript/pages/phase-3-functions/20-new-target-and-constructor-guards.md`
- **Read this:** [new.target](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target) · MDN · reference for `new.target` *(MDN: 200, title and lead passage read)* · fetched 2026-10-13 · [TypeError: class constructors must be invoked with new](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Class_ctor_no_new)
- **Beyond the docs:** [Constructor, operator new](https://javascript.info/constructor-new) · javascript.info, page dated Oct 1, 2022 · `new.target` is undefined for regular calls; a constructor can return `new User(name)` itself when missing, though the page calls this unwise to use everywhere · fetched 2026-10-13 (*read*)
- **Our delta:** guarding a class called without `new`; classes throw by themselves.
