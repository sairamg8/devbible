---
title: "Part 1 — The language core"
sidebar_label: "1 · Language core"
sidebar_position: 1
---

> **Phases 0–4 · 84 topics · 29 Master**
> How JavaScript runs, its value system, and the two things everything else is
> built out of: **functions** and **objects**.

Nothing here is browser-specific or Node-specific. It is the language the spec
defines — and it is the part that decides whether you can read unfamiliar code.
Every page runs in both hosts unless it says otherwise.

---

## Phase 0 — How JavaScript runs

*12 topics.* The mental model everything hangs off. Short on purpose, but the
execution-context row is what makes hoisting stop being a list of rules to
memorise.

| Topic | Tier |
|---|---|
| **The engine, the runtime and the spec** — V8/SpiderMonkey/JSC execute the *language*; `window`, `document` and `process` come from the **host**, not from JavaScript | <span className="db-tier t-master">Master</span> |
| **Execution contexts and the call stack** — how a call frame is created, `RangeError: Maximum call stack size exceeded`, and reading a stack trace top-down | <span className="db-tier t-master">Master</span> |
| **Strict mode** — the six things it changes, and why modules and class bodies are always strict whether you ask or not | <span className="db-tier t-master">Master</span> |
| Parse → compile → execute — the creation phase, and why hoisting is a *consequence* of it rather than a rule | <span className="db-tier t-understand">Understand</span> |
| **What "JavaScript" means today** — ECMAScript editions, the TC39 stage process, and why you target *features*, not years | <span className="db-tier t-understand">Understand</span> |
| The hosts you write for — browser, Node, Web Worker, edge runtime: which globals exist in each and how to write code that survives all of them | <span className="db-tier t-understand">Understand</span> |
| **Loading scripts** — `<script>` position, `defer`, `async`, `type="module"`, and what each does to execution order | <span className="db-tier t-understand">Understand</span> |
| **Running and inspecting code** — the DevTools console and Sources panel, `node --eval`, `debugger`, breakpoints, watch expressions | <span className="db-tier t-understand">Understand</span> |
| Transpilation and polyfills — Babel, core-js, `browserslist`, and what "supported" actually means for a given feature | <span className="db-tier t-know">Know</span> |
| Feature detection over user-agent sniffing — `globalThis`, `'X' in window`, and graceful degradation | <span className="db-tier t-know">Know</span> |
| The JIT in one page — interpreter, optimising tier, deoptimisation, hidden classes, and why micro-benchmarks lie | <span className="db-tier t-know">Know</span> |
| Reading the specification — abstract operations, algorithm steps, and the rare day it is worth doing | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can say which parts of `document.querySelector('a').addEventListener(...)`
are JavaScript and which are the host, without hesitating.

---

## Phase 1 — Values, types and coercion

*17 topics.* The phase that explains most "JavaScript is broken" moments. Three
rows here (references, coercion, floating point) account for a large share of
the bugs a fullstack developer actually ships.

| Topic | Tier |
|---|---|
| **The eight types** — seven primitives plus object, `typeof` for each, and the `typeof null === 'object'` bug | <span className="db-tier t-master">Master</span> |
| **Primitives are copied, objects are shared** — the single biggest source of "why did this value change?" | <span className="db-tier t-master">Master</span> |
| **`==` vs `===`** — the abstract equality algorithm reduced to the four cases you actually hit, and the one time `==` is defensible | <span className="db-tier t-master">Master</span> |
| **Truthiness** — the exact list of eight falsy values, and why `[]`, `{}` and `"0"` are truthy | <span className="db-tier t-master">Master</span> |
| **`null` vs `undefined`** — which one to write, how defaults behave, and `??` vs `||` on `0` and `''` | <span className="db-tier t-master">Master</span> |
| **Numbers are IEEE-754 doubles** — `0.1 + 0.2`, `Number.EPSILON`, `MAX_SAFE_INTEGER`, and never storing money in one | <span className="db-tier t-master">Master</span> |
| **`const` does not mean immutable** — binding vs value, and what actually protects an object | <span className="db-tier t-understand">Understand</span> |
| **Type coercion** — `ToPrimitive`, `ToNumber`, `ToString`, and `[] + {}` explained once so it never surprises you again | <span className="db-tier t-understand">Understand</span> |
| **Explicit conversion** — `Number()`, `parseInt` with a radix, `parseFloat`, `String()`, `Boolean()`, `+x`, `!!x` | <span className="db-tier t-understand">Understand</span> |
| **Strings are UTF-16 code units** — `.length` vs code points vs grapheme clusters, emoji and surrogate pairs, `Intl.Segmenter` | <span className="db-tier t-understand">Understand</span> |
| `NaN` — why `NaN !== NaN`, `isNaN` vs `Number.isNaN`, and where NaN enters your data | <span className="db-tier t-understand">Understand</span> |
| **`Symbol`** — unique keys that never collide, and the well-known symbols (`Symbol.iterator`, `toPrimitive`, `hasInstance`) | <span className="db-tier t-understand">Understand</span> |
| **`BigInt`** — what to do when doubles run out, and why you cannot mix it with `Number` in one expression | <span className="db-tier t-understand">Understand</span> |
| Value equality in practice — deep equality, comparing by `JSON.stringify`, and exactly where that breaks | <span className="db-tier t-understand">Understand</span> |
| Object wrappers and autoboxing — how `"abc".toUpperCase()` works on a primitive, and why `new String()` is never right | <span className="db-tier t-know">Know</span> |
| `Object.is`, `-0` vs `+0`, and `Infinity` | <span className="db-tier t-know">Know</span> |
| Numeric literals — separators, binary/octal/hex, exponent form, and legacy octal in sloppy mode | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can predict the result of `[] == false`, `'' == 0`
and `null == undefined` and explain *each* from the algorithm, not from memory.

---

## Phase 2 — Operators, expressions and control flow

*15 topics.* Small rows, high frequency. The precedence and ASI rows are the ones
that produce bugs nobody can find by reading.

| Topic | Tier |
|---|---|
| **Arithmetic operators** — `+ - * / % **`, `%` with negative operands, integer division, and `+` doubling as concatenation | <span className="db-tier t-master">Master</span> |
| **Assignment and compound assignment** — including the logical forms `&&=`, `\|\|=`, `??=` and how they short-circuit the *write* | <span className="db-tier t-understand">Understand</span> |
| **Logical operators return operands, not booleans** — `&&`/`\|\|` short-circuit, `??`, and the default-value idiom that breaks on `0` | <span className="db-tier t-master">Master</span> |
| **Optional chaining `?.`** — with calls `?.()` and indexes `?.[]`, and the three failures it does *not* protect you from | <span className="db-tier t-master">Master</span> |
| **Loops** — `for`, `while`, `do…while`, `for…of`, `for…in`, `for await…of`, and a decision table for picking one | <span className="db-tier t-master">Master</span> |
| **Spread and rest** — where each is legal, that both copies are shallow, and forwarding arguments | <span className="db-tier t-master">Master</span> |
| **Comparison operators** — relational comparison on strings, comparing `Date`s, and why comparing objects never works | <span className="db-tier t-understand">Understand</span> |
| **Conditionals** — `if`/`else if`/`else`, the ternary, nesting limits, and when a ternary costs more than it saves | <span className="db-tier t-understand">Understand</span> |
| **`switch`** — strict comparison, deliberate fallthrough, the `case` block-scope trap, and object lookup as an alternative | <span className="db-tier t-understand">Understand</span> |
| **Operator precedence and associativity** — the ones that actually bite: `??` mixed with `\|\|`, right-associative `**`, `typeof` vs `instanceof` | <span className="db-tier t-understand">Understand</span> |
| **Expressions vs statements** — why an IIFE needs parentheses, why `{}` is ambiguous, and what an expression position is | <span className="db-tier t-understand">Understand</span> |
| **Automatic semicolon insertion** — the exact rules, and the five line starts that break your code without a semicolon | <span className="db-tier t-understand">Understand</span> |
| `break`, `continue`, and labelled statements — the one case labels earn their place | <span className="db-tier t-know">Know</span> |
| Bitwise operators — `&`, `\|`, `^`, `~`, `<<`, `>>`, `>>>`, the 32-bit coercion, flag sets, and `~~` as a bad `Math.trunc` | <span className="db-tier t-know">Know</span> |
| The comma operator, `void`, `in` and `delete` as operators | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain why `a ?? b || c` is a syntax error and
what the fix is.

---

## Phase 3 — Functions, scope and closures

*20 topics.* The brief names **custom functions** explicitly, and this is where
that starts: not just calling functions, but designing and writing them.
Phase 17 finishes the job by implementing the library ones from scratch.

| Topic | Tier |
|---|---|
| **Declarations vs expressions vs arrow functions** — hoisting differences, naming for stack traces, and which to reach for by default | <span className="db-tier t-master">Master</span> |
| **Parameters** — defaults evaluated left to right, rest parameters, and the `arguments` object you should stop using | <span className="db-tier t-master">Master</span> |
| **`this`** — the four binding rules resolved as one decision tree, evaluated at call time not definition time | <span className="db-tier t-master">Master</span> |
| **Arrow functions have no `this`** — lexical `this`, no `arguments`, no `new`, no `prototype`, and the method-definition mistake | <span className="db-tier t-master">Master</span> |
| **`call`, `apply` and `bind`** — borrowing methods, partial application, and what `bind` returns | <span className="db-tier t-master">Master</span> |
| **Closures** — what is captured (the variable, not the value), the classic `var`-in-a-loop bug, and the memory it holds alive | <span className="db-tier t-master">Master</span> |
| **Lexical scope and the scope chain** — `var` vs `let`/`const`, block scope, function scope, and shadowing | <span className="db-tier t-master">Master</span> |
| **Hoisting and the temporal dead zone** — functions vs `var` vs `let`/`const`, and why the TDZ is a feature | <span className="db-tier t-master">Master</span> |
| **Higher-order functions** — functions as values, callbacks, and functions that return functions | <span className="db-tier t-understand">Understand</span> |
| **Debounce and throttle** — the actual difference, leading vs trailing edge, cancellation, and choosing between them | <span className="db-tier t-understand">Understand</span> |
| **Currying and partial application** — a `curry` you can write and explain under interview pressure | <span className="db-tier t-understand">Understand</span> |
| **Composition** — `pipe` and `compose`, point-free style, and the debuggability it costs | <span className="db-tier t-understand">Understand</span> |
| **Memoization** — a cache-keyed wrapper, why key derivation is the hard part, and unbounded-cache leaks | <span className="db-tier t-understand">Understand</span> |
| **Recursion** — designing a base case, call-stack limits, mutual recursion, trampolines, and the absence of tail-call optimisation in V8 | <span className="db-tier t-understand">Understand</span> |
| **Pure functions and side effects** — what purity buys in testing, and where impurity is supposed to live | <span className="db-tier t-understand">Understand</span> |
| **There is no function overloading** — argument-shape dispatch, options objects, and designing a signature that ages well | <span className="db-tier t-understand">Understand</span> |
| **Closure and default-parameter gotchas** — shared mutable defaults, capturing loop variables, and the stale-closure bug React makes famous | <span className="db-tier t-understand">Understand</span> |
| **IIFE and the module pattern** — the problem it solved, and what modules replaced it with | <span className="db-tier t-know">Know</span> |
| Function properties — `length`, `name`, `toString`, and why libraries read them | <span className="db-tier t-know">Know</span> |
| `new.target`, constructor functions, and guarding against a class called without `new` | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can write `bind`, `debounce` and a counter factory
from an empty file, and say what each closes over.

---

## Phase 4 — Objects, prototypes and classes

*20 topics.* Everything non-primitive in JavaScript is here. The prototype rows
are what make `class` stop being magic, and the copy row is the one that costs
teams real money.

| Topic | Tier |
|---|---|
| **Object literals** — shorthand, computed keys, nesting, and the property-order rules (integer keys first) | <span className="db-tier t-master">Master</span> |
| **Property access** — dot vs bracket, keys are stringified, and when two different keys collide into one | <span className="db-tier t-understand">Understand</span> |
| **Existence checks** — `in` vs `hasOwnProperty` vs `Object.hasOwn` vs `!== undefined`, and `delete`'s real cost | <span className="db-tier t-master">Master</span> |
| **Shallow vs deep copy** — spread, `Object.assign`, `structuredClone`, and a hand-written deep clone with cycles | <span className="db-tier t-master">Master</span> |
| **The prototype chain** — `[[Prototype]]`, `Object.getPrototypeOf` vs the legacy `__proto__`, and how lookup actually walks | <span className="db-tier t-master">Master</span> |
| **`class`** — fields, methods, `static`, `#private`, static blocks, and exactly what it desugars to | <span className="db-tier t-master">Master</span> |
| **`this` inside methods, and losing it** — passing a method as a callback, and class fields vs `bind` as the fix | <span className="db-tier t-master">Master</span> |
| **`Object.keys` / `values` / `entries` / `fromEntries`** — what they include, what they skip, and round-tripping an object | <span className="db-tier t-master">Master</span> |
| **`extends` and `super`** — constructor ordering, why `this` is unavailable before `super()`, and overriding safely | <span className="db-tier t-understand">Understand</span> |
| **Getters and setters** — computed properties, validating on write, and the infinite-recursion trap | <span className="db-tier t-understand">Understand</span> |
| **Property descriptors** — `writable`, `enumerable`, `configurable`, and `Object.defineProperty` | <span className="db-tier t-understand">Understand</span> |
| **`Object.freeze` and `seal`** — both are shallow, and how to deep-freeze when you must | <span className="db-tier t-understand">Understand</span> |
| **`instanceof` and `Symbol.hasInstance`** — cross-realm failure, and why duck typing often beats it | <span className="db-tier t-understand">Understand</span> |
| **Object creation patterns** — factory vs constructor vs class, and `Object.create(null)` for true dictionaries | <span className="db-tier t-understand">Understand</span> |
| **Normalising untrusted shapes** — optional access, defaults, and turning an API payload into a value you can rely on | <span className="db-tier t-understand">Understand</span> |
| **Prototype patterns to avoid** — extending built-ins, monkey patching, and prototype pollution from merged JSON | <span className="db-tier t-understand">Understand</span> |
| **`toString`, `valueOf`, `Symbol.toPrimitive`** — how your object behaves inside `+`, template literals and comparisons | <span className="db-tier t-know">Know</span> |
| **Mixins and composition over inheritance** — why deep class hierarchies fail in JavaScript specifically | <span className="db-tier t-know">Know</span> |
| **`Proxy` and `Reflect`** — the traps, and the real uses (reactivity, validation, negative array indices) | <span className="db-tier t-know">Know</span> |
| Private state before `#` — closures, `WeakMap`, and the `_underscore` convention you will still meet | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can draw the prototype chain for an instance of a
subclass, and explain what `super.method()` looks up.

---

## Where this connects

- **Phase 3 → Phase 17** — closures, `bind` and `debounce` are *used* here and
  *implemented from scratch* in the machine-coding phase.
- **Phase 1 → Phase 5** — coercion decides what `sort` does by default, what
  `JSON.stringify` drops, and how `Map` keys differ from object keys.
- **Phase 4 → React** — `this`, references and shallow copying are the whole
  reason immutable state updates are written the way they are.
- **Deliberately not here:** the event loop and promises (Phase 7), modules
  (Phase 8), and anything with `window` or `process` in it (Part 3 and the
  Node.js syllabus).

---

← [Overview](../README.md) · Next: [Part 2 — Data, iteration and async](./02-data-and-async.md) →
