---
title: "01 · The expression and its semantics"
sidebar_label: "01 · The expression"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`import()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import), [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [`import.meta`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta), [Module namespace object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#namespace_import) — and ECMAScript [§ `import` calls](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-import-calls), [§ Cyclic Module Records](https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#sec-cyclic-module-records). Documentation-validated; **no timings, no console blocks**.

```js
const module = await import('./heavy-chart.js');
module.render(data);
```

Static `import` is a **declaration**: hoisted, resolved before any code runs, with live bindings
([01 · Import and export](../01-es-modules/01-import-and-export.md)). Dynamic `import()` is an
**expression**: it runs where it is written, takes a specifier computed at runtime, and gives you
a promise.

🔴 **That difference is the whole feature.** Static imports are the module graph; dynamic imports
are a decision made while the program is running — and everything below follows from it.

## It is an operator, not a function

`import()` looks like a call and is not one. The specification defines it as syntax, and the
consequences are concrete:

```js
const load = import;              // ❌ SyntaxError
import.call(null, './x.js');      // ❌ there is no function to call
[].map(import);                   // ❌ cannot be passed as a value
const load = (s) => import(s);    // ✅ wrap it in a real function
```

⚠️ **You cannot alias, spread, or pass it around.** Where a codebase needs a loader value, it
wraps `import()` in an arrow function — which is also exactly what a bundler expects to see.

**It works in every context, including a classic script.** Unlike static `import`, which requires
a module, `import()` is available in non-module scripts, in CommonJS, and inside functions,
conditionals and loops.

## What the promise resolves to

**The module namespace object** — the same thing `import * as ns from '…'` gives you:

```js
const ns = await import('./maths.js');
ns.add(1, 2);            // a named export
ns.default;              // 🔴 the default export lives under `.default`
```

🔴 **`default` is a property, not the resolution value.** The single most common slip is
`const render = await import('./chart.js')` followed by `render(...)`. Destructure explicitly:

```js
const { default: render, options } = await import('./chart.js');
```

The namespace object is **sealed and its properties are read-only** — you cannot add to it or
reassign an export through it. The values behind it are still live bindings, so a counter
exported by the module updates as the module updates it.

## Modules are evaluated once, and failures are remembered

```js
const a = await import('./config.js');
const b = await import('./config.js');
a === b;                 // true — the same namespace object
```

The module registry is keyed by resolved specifier, so the second import does no work at all. It
is the same singleton rule as static imports
([02 · Singletons and strict](../02-module-semantics/01-singletons-and-strict.md)) — dynamic
importing does not opt out of it.

🔴 **A module whose top-level code *throws* is cached in that failed state.** Re-importing the
same specifier rejects with the same error rather than re-running the module; evaluation happens
once, success or failure. So "import failed — try again" does not re-execute a module that blew
up in its own initialisation.

⚠️ **A *network* failure is a different matter and host-dependent** — whether a browser will
re-fetch a specifier whose request failed is not something to rely on either way. The robust
pattern for a chunk that failed to download is to reload the page, not to retry the import
([02 · Code splitting in practice](./02-code-splitting.md)).

## Errors it can produce

| Failure | What you get |
|---|---|
| The specifier cannot be resolved | a `TypeError` |
| The network request fails (a missing chunk after a deploy) | a rejected promise; the message and type vary by host |
| The module's top-level code throws | that error, and it is **remembered** |
| A `SyntaxError` in the module | a rejected promise, at fetch/parse time |

```js
try {
  const { init } = await import('./optional-feature.js');
  init();
} catch (err) {
  // 🔴 this catch covers BOTH loading and init() throwing — usually not what you want
}
```

**Keep the two apart.** A failed *load* is an infrastructure problem to report and degrade
around; a throw from `init()` is an application bug. Wrapping both in one `try` makes them
indistinguishable — the same argument as
[Phase 7 · 08 · Try/catch around await](../../phase-7-async/08-error-handling/01-try-catch-around-await.md).

## Specifier resolution is relative to the module, not the page

The specifier resolves **relative to the file containing the `import()`**, exactly like a static
import — not to the document's URL and not to the current working directory. For a URL built at
runtime, make that explicit:

```js
const url = new URL(`./locales/${lang}.js`, import.meta.url);
const messages = await import(url.href);
```

`import.meta.url` is the current module's own URL, and `new URL(relative, base)` is the portable
way to build one from it. `import.meta.resolve(specifier)` does the same job through the module
resolver, including bare specifiers, where it is available.

## Import attributes

Where supported, a second argument carries attributes — most usefully the module type:

```js
const data = await import('./config.json', { with: { type: 'json' } });
data.default;            // the parsed JSON
```

⚠️ **The type attribute is a security requirement, not a hint.** It tells the host what the module
must be; a server returning JavaScript where JSON was declared is rejected rather than executed.
Check availability before relying on it — support and the older `assert` spelling differ across
runtimes.

## Gotchas

**Symptom: `import is not defined` or a `SyntaxError` when aliasing it.**
Cause — `import()` is an operator, not a function value.
Fix — wrap it: `const load = (s) => import(s)`.

**Symptom: the imported "function" is not callable.**
Cause — the promise resolves to the namespace object; the default export is `.default`.
Fix — `const { default: fn } = await import(…)`.

**Symptom: assigning to a property of the imported namespace silently fails or throws.**
Cause — the namespace object is sealed and read-only.
Fix — export a setter, or hold the value in your own object.

**Symptom: a module that failed to initialise keeps failing even after fixing the condition.**
Cause — evaluation happens once; a thrown top-level error is cached with the module.
Fix — do not do failure-prone work at module top level; expose an `init()` you can call again.

**Symptom: the second `import()` of the same module did not re-run its side effects.**
Cause — modules are singletons keyed by resolved specifier.
Fix — expected; export a function if you need repeatable work.

**Symptom: a runtime-built specifier resolves to the wrong place.**
Cause — it was treated as relative to the page rather than to the module.
Fix — `new URL(path, import.meta.url).href`, or `import.meta.resolve`.

**Symptom: one `catch` reports "failed to load feature" for a bug inside the feature.**
Cause — the load and the initialisation are inside the same `try`.
Fix — `await` the import in its own `try`, then call `init()` outside it.

## Interview questions

**★ How does dynamic `import()` differ from a static import?**
Static `import` is a hoisted declaration resolved before execution, with live bindings and a
statically known specifier. `import()` is an expression evaluated where it appears, takes a
runtime specifier, returns a promise, and works in non-module contexts.

**★ What does the promise resolve to?**
The module namespace object — a sealed, read-only object whose properties are the exports, with
the default export under `.default`.

**★ Does importing the same module twice run it twice?**
No. Modules are singletons keyed by resolved specifier; the second import returns the same
namespace object with no re-evaluation. A top-level throw is likewise remembered.

**★ Why can't you write `const load = import`?**
Because `import()` is syntax, not a function object. Wrap it in an arrow function if you need a
value.

**★ How do you build a specifier at runtime correctly?**
`new URL(relativePath, import.meta.url).href` — resolution is relative to the importing module,
not the page. `import.meta.resolve` handles bare specifiers where available.

**★ Should you `try`/`catch` the import and the call together?**
No — you lose the distinction between a failed download and a bug in the feature. Catch the
import, then invoke outside the `try`.

**What is the `{ with: { type: 'json' } }` argument for?**
Import attributes: they state what the module must be. A mismatched response is rejected rather
than executed, which is a security property, not a convenience.

---

[Topic index](./README.md) · [02 · Code splitting in practice](./02-code-splitting.md) →
