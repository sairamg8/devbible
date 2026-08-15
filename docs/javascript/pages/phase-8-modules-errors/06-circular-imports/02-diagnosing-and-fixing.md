---
title: "02 · Diagnosing and fixing a cycle"
sidebar_label: "02 · Diagnosing and fixing"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [`import()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import), [`export`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export) — and Node.js [Modules: CommonJS § Cycles](https://nodejs.org/api/modules.html#cycles), [Modules: ECMAScript modules](https://nodejs.org/api/esm.html), ECMAScript [§ Cyclic Module Records](https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#sec-cyclic-module-records). Documentation-validated; **no timings, no console blocks**.

[01](./01-what-happens.md) explained what a cycle does. This page is what to do about one — and
first, the version of the problem that gives you no error at all.

## CommonJS: the silent `undefined`

Node's documentation is explicit about `require` in a cycle: when a module is required while it
is still loading, the requirer receives its **partially populated `module.exports`** — whatever
had been assigned by that point.

```js
// a.js (CommonJS)
exports.a = 1;
const b = require('./b');          // b runs now, and requires a back
exports.a2 = 2;

// b.js
const a = require('./a');
console.log(a.a);                  // 1   — already assigned
console.log(a.a2);                 // 🔴 undefined — not assigned yet, and NO error
```

🔴 **That `undefined` is the whole problem.** It is not a binding you cannot read; it is a value
that flows onward, gets stored, gets passed, and fails somewhere unrelated — often as
`x is not a function` in a different file. ESM's `ReferenceError` names the moment and the
binding; CommonJS's `undefined` names nothing.

**The other CommonJS-specific trap: reassigning `module.exports` breaks the cycle harder.**

```js
module.exports = { a: 1 };         // 🔴 the requirer already captured the OLD object
```

Anyone who required this module earlier holds a reference to the *previous* exports object and
never sees the replacement. `exports.foo = …` mutates the object they hold; `module.exports = …`
swaps it. ESM has no equivalent hazard, because imports are bindings rather than a snapshot of an
object — **15 · CommonJS in a modern world** *(not written yet)*.

## Finding them

**A cycle you know about is a decision; a cycle you do not know about is a time bomb.** Three
levels of detection, cheapest first:

| Tool | What it gives you |
|---|---|
| Your bundler's warnings | most bundlers report cycles during the build, with the file path chain |
| `eslint-plugin-import`'s `no-cycle` rule | fails the lint, with the chain; can be limited by depth |
| A graph tool such as `madge --circular` | the full list across the project, and a picture |

🔴 **Turn the lint rule on before you have a hundred cycles, not after.** Adding `no-cycle` to a
codebase that already has them produces an unactionable wall of errors, which is how the rule
ends up disabled. On a clean codebase it is nearly free and it stops the problem at the pull
request.

⚠️ **Note the `ReferenceError` alone will not point at the cycle.** It names the binding and the
file that read it too early — the *victim*. The cycle is the path between that file and the one
it imports, which the tools above give you and the stack trace does not.

## The four fixes, best first

### 1 · Extract the shared thing into a third module

The cycle almost always exists because two modules share something that belongs to neither.

```
a ⇄ b            →       a → shared ← b
```

```js
// shared/types.js — no imports of a or b
export const STATUS = { open: 'open', closed: 'closed' };
```

**This is the fix that removes the cycle rather than hiding it**, and it usually improves the
design on its own: the extracted module is the concept the other two were both reaching for.
Constants, types, a base class and pure helpers are the usual contents.

### 2 · Invert the dependency

If `a` needs `b` only to call back into it, pass the callback instead of importing:

```js
// ❌ b imports a just to notify it
import { onSaved } from './a.js';

// ✅ a hands b what it needs
export function save(data, { onSaved }) { … }
```

The lower-level module stops knowing about the higher-level one, which is the actual design
error a cycle usually encodes. Dependency injection, an event emitter, or a registry populated
at start-up all do this.

### 3 · Defer the import to the point of use

```js
export async function render(data) {
  const { format } = await import('./formatter.js');   // ✅ evaluated on call, not at link
  return format(data);
}
```

A dynamic import is not part of the static graph, so it cannot form a link-time cycle
([05 · Dynamic `import()`](../05-dynamic-import/01-the-expression.md)). **It is a genuine tool and
not only an escape hatch** — a rarely used, heavy dependency is a good candidate anyway.

⚠️ **It makes the function async, which propagates to every caller.** If that is unacceptable,
this is fix 1 in disguise: extract instead.

### 4 · Move the read later

The minimal change — turn a top-level read into a call-time one:

```js
// ❌
import { config } from './config.js';
export const timeout = config.timeout;      // top-level read; TDZ if in a cycle

// ✅
import { config } from './config.js';
export const getTimeout = () => config.timeout;
```

🔴 **This leaves the cycle in place.** It works because live bindings resolve by the time anyone
calls, but the cycle is still there, still order-dependent, and still one refactor away from
throwing again. Use it to unblock, then do fix 1.

## Barrel files are a cycle factory

```js
// index.js
export * from './user.js';
export * from './order.js';
```

A barrel re-exports a whole directory. The moment a module *inside* the directory imports from
the barrel — usually because the editor auto-imported from `'./index.js'` — you have a cycle
through it, and every other module in the barrel is pulled into the graph too.

**Two rules that avoid nearly all barrel cycles:**

- **Never import your own barrel from inside it.** Import the sibling file directly.
- **Keep barrels at the package boundary**, for external consumers, not as a convenience for
  internal imports.

⚠️ **Barrels also hurt code splitting**: importing one name from a barrel drags in the graph of
everything it re-exports unless the bundler can tree-shake it all, and a single side-effecting
module in there defeats that (**13 · Bundlers and the build** *(not written yet)*).

## When a cycle is acceptable

Rarely, and only with both of these true: **every export crossing the cycle is a function
declaration**, and **nothing reads across the cycle at the top level**. Mutually recursive
functions in two files are the honest example.

Even then, write down why. The next person to add a `const` export to either file will break it,
and nothing in the code says the constraint exists.

## Gotchas

**Symptom: an import is `undefined` in Node with no error.**
Cause — CommonJS returned a partially populated `module.exports` from a cycle.
Fix — break the cycle; ESM would at least have thrown.

**Symptom: a CommonJS module's exports are stale for one requirer.**
Cause — `module.exports = {…}` replaced the object others had already captured.
Fix — mutate `exports`, or restructure so the assignment happens before anyone requires it.

**Symptom: `no-cycle` reports hundreds of errors and gets disabled.**
Cause — the rule was added after the cycles.
Fix — enable it early; on an existing codebase, ratchet with a baseline rather than switching off.

**Symptom: the stack trace does not mention the cycle.**
Cause — it names the victim of the early read, not the loop.
Fix — get the chain from the bundler warning, `no-cycle`, or `madge --circular`.

**Symptom: cycles appear after an auto-import from `./index.js`.**
Cause — a module importing its own barrel.
Fix — import the sibling file directly; keep barrels at package boundaries.

**Symptom: making one function async to break a cycle cascaded through the codebase.**
Cause — a dynamic import used where extraction was the real fix.
Fix — extract the shared code into a third module.

**Symptom: the cycle "fix" worked, then broke again a month later.**
Cause — the read was moved later but the cycle was left in place.
Fix — remove the cycle; a working cycle is order-dependent, not safe.

## Interview questions

**★ How does a circular `require` behave differently from a circular `import`?**
CommonJS hands back a partially populated `module.exports` — missing properties are `undefined`
with no error. ESM gives a `ReferenceError` at the too-early read, which names the binding and
the moment.

**★ How do you find cycles in a project?**
Bundler warnings, `eslint-plugin-import`'s `no-cycle` rule, or a graph tool like
`madge --circular`. The runtime error alone points at the victim, not the loop.

**★ What is the best fix?**
Extract what the two modules share into a third module they both import. It removes the cycle
instead of hiding it, and it usually names a concept that was missing.

**★ When is a dynamic import the right fix?**
When the dependency is genuinely occasional or heavy, so deferring it is a win anyway. It leaves
the static graph acyclic — but it makes the function async, which propagates to callers.

**★ Why are barrel files a common source of cycles?**
Because a module inside the directory imports from the barrel that re-exports it, usually via an
editor auto-import. Import siblings directly and keep barrels at the package boundary.

**★ Is a cycle ever acceptable?**
Only when everything crossing it is a hoisted function declaration and nothing reads across it at
the top level — mutually recursive functions. Document the constraint, because nothing enforces
it.

**Why isn't "move the read into a function" a real fix?**
It works, but the cycle survives: the code stays order-dependent and one new `const` export
breaks it again.

---

← [01 · What actually happens](./01-what-happens.md) · [Topic index](./README.md)
