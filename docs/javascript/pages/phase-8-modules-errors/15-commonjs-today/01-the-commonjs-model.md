---
title: "01 · The CommonJS model"
sidebar_label: "01 · The CommonJS model"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against the Node.js documentation — [Modules: CommonJS modules](https://nodejs.org/api/modules.html) (the module wrapper, `exports` shortcut, `require.cache`, cycles, `require(esm)`) and [Modules: ECMAScript modules](https://nodejs.org/api/esm.html) — and MDN [`import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import). Documentation-validated; **no runs, no timings, no console blocks** — the samples are illustrative.

## Why a Know-tier topic at all

You are not going to write new CommonJS. You are going to **read** it — in a dependency, in a
config file, in a stack trace, in the one script in your repository that nobody has converted — and
you will meet it as an error message when it does not mix with ES modules
([13 · What a bundler does](../13-bundlers-and-the-build/01-what-a-bundler-does.md)). This topic is
the minimum that makes those moments legible.

## Every CommonJS file is a function body

Node's documentation is explicit: before a module runs, it is wrapped.

```js
(function (exports, require, module, __filename, __dirname) {
  // your file goes here
});
```

Five things follow directly from that one wrapper, and they explain almost everything CommonJS
does differently from ESM:

| | Consequence |
|---|---|
| **Top-level `var` is not global** | it is a local of the wrapper — CommonJS got module scope for free |
| **`this` at top level is `module.exports`** | not `undefined` as in an ES module, which is strict-mode code |
| **`require` is an ordinary function** | it can be called conditionally, in a loop, with a computed string |
| **`__filename` / `__dirname` exist** | because they were passed in as parameters |
| **Execution is synchronous** | `require` returns the finished exports before the next line runs |

🔴 **"`require` is a function call" is the whole difference.** It is why CommonJS cannot be
tree-shaken ([13 · Tree shaking](../13-bundlers-and-the-build/02-tree-shaking.md)), why its graph is
not knowable without running it, and why `import` — a declaration the engine reads before execution
([01 · Import and export](../01-es-modules/01-import-and-export.md)) — is not simply nicer syntax
for the same thing.

## `exports` versus `module.exports` — the one bug everyone writes

`exports` starts as a *reference* to `module.exports`. Adding a property works through either name.
**Assigning to `exports` does not**, because assignment rebinds the local parameter and leaves
`module.exports` untouched:

```js
exports.hello = true;              // ✅ exported
module.exports.hello = true;       // ✅ the same thing

exports = { hello: false };        // ⛔ rebinds the parameter; nothing is exported
module.exports = { hello: false }; // ✅ replaces the exported object
```

**The rule: use `exports.x = …` to add, and `module.exports = …` to replace.** Node's own
documentation recommends assigning to `module.exports` whenever you replace the whole export, and
shows the belt-and-braces form `module.exports = exports = fn` for keeping both names in agreement.

⚠️ **This is not a stylistic difference.** The failure is silent — the file loads, the consumer gets
an empty object, and the error appears one call later as `x is not a function`.

## `require` is cached, by resolved filename

Node caches modules after the first load, so every `require('./thing.js')` in the process returns
the same object — the CommonJS version of the singleton rule
([02 · Singletons](../02-module-semantics/01-singletons-and-strict.md)).

**The key is the *resolved filename*, not the string you typed.** Two documented consequences:

- `require('./foo')` and `require('./FOO')` are **different cache entries** on a case-insensitive
  filesystem — two copies of the same module, with separate state.
- The same package resolved from two `node_modules` locations is cached separately, which is the
  duplicate-copy problem seen from Node's side
  ([13 · Analysing a bundle](../13-bundlers-and-the-build/03-analysing-and-shrinking.md)).

`require.cache` is inspectable and mutable — deleting an entry forces a reload — and the docs use
exactly that to swap a fake for a real module. ⚠️ **Treat it as a debugging tool, not a technique.**
Anything already holding a reference to the old exports keeps it, so you get two live versions of a
module and a bug that reads like impossible behaviour. The `node:` prefix bypasses this entirely for
built-ins.

🔴 **`require.cache` is not used by `import`.** The ES module loader has its own separate cache, in
Node's own words — so a module loaded both ways is genuinely loaded twice.

## Cycles: an unfinished copy instead of an error

When two CommonJS modules require each other, Node returns the **partially populated** `exports` of
the module still executing, rather than erroring or looping forever. Node's documented example is
worth carrying:

```js
// a.js
exports.done = false;
const b = require('./b.js');    // b runs now, and requires a back
exports.done = true;

// b.js
exports.done = false;
const a = require('./a.js');    // gets a's exports as they are RIGHT NOW: { done: false }
exports.done = true;
```

**`b` sees `a.done === false`** — not because of a bug, but because `a` had not reached its last
line when `b` asked. Whoever is required *second* sees a complete picture; the first does not.

⚠️ **ESM's answer to the same shape is different**, and the difference is instructive: live bindings
plus hoisted declarations mean you may hit a temporal dead zone instead of a stale value
([06 · Circular imports](../06-circular-imports/01-what-happens.md)). CommonJS gives you a
value that is quietly wrong; ESM gives you an error at the moment of use. Neither is a reason to
keep the cycle.

## Where you still meet it, and why

- **Dependencies published years ago** — and plenty published this year, because a CommonJS build
  runs everywhere.
- **Tool configuration files.** Plenty of ecosystems still load config through `require`.
- **Scripts** — a repository's one-off maintenance script, where nobody wanted to think about module
  type.
- **Anything using `__dirname` to find a file next to itself**, which is a genuinely convenient
  thing the wrapper gave away for free.

**And the reason it persists is the same reason it is hard to shake:** `require` is a function you
can call anywhere, which makes migration a rewrite rather than a rename.

## Gotchas

**Symptom: the importer gets an empty object.**
Cause — the module assigned to `exports` instead of `module.exports`, rebinding the local parameter.
Fix — `module.exports = …` when replacing the whole export.

**Symptom: module state appears twice in one process.**
Cause — two cache entries: a case difference in the specifier, or the package resolved from two
locations.
Fix — normalise the specifier, deduplicate the dependency, and never assume one copy.

**Symptom: a value from a circular require is `undefined` or stale.**
Cause — you received the unfinished exports of a module still executing.
Fix — require it lazily inside the function that needs it, or break the cycle by extracting the
shared piece.

**Symptom: deleting from `require.cache` did not reload everything.**
Cause — existing references still point at the old exports object.
Fix — use it only for debugging; restart the process when you need a truly clean load.

**Symptom: `this` is not what you expected at the top of a file.**
Cause — in CommonJS the top-level `this` is `module.exports`; in an ES module it is `undefined`.
Fix — never rely on top-level `this`; name what you mean.

**Symptom: `__dirname is not defined`.**
Cause — the file is being treated as an ES module, where the wrapper's parameters do not exist.
Fix — the ESM replacements, covered in [02 · Interop both ways](./02-interop-both-ways.md).

## Interview questions

**★ Why can CommonJS not be tree-shaken?**
Because `require` is a function call with a computable argument and `module.exports` can be
reassigned at run time. The module's shape is only knowable by executing it, and a bundler will not
execute it.

**★ What is the difference between `exports` and `module.exports`?**
`exports` is a reference to `module.exports`. Adding properties through either works; assigning to
`exports` rebinds a local parameter and exports nothing.

**★ What is a CommonJS module cached by?**
Its resolved filename — so a case difference or a second `node_modules` location produces a second
copy with separate state.

**★ What happens with circular `require`s?**
Node returns the partially populated exports of the module still executing. No error, no loop — just
a value that may be incomplete.

**★ How does that differ from ESM cycles?**
ESM has hoisted declarations and live bindings, so the same shape surfaces as a temporal dead zone
error on use rather than a silently stale value.

**★ Why does `__dirname` exist in CommonJS and not in ESM?**
It is a parameter of the module wrapper function that Node wraps every CommonJS file in. ES modules
have no such wrapper.

**Is `require.cache` the same cache as `import` uses?**
No — Node documents them as separate, which is how one module ends up loaded twice.

---

← [Topic index](./README.md) · Next → [02 · Interop, both ways](./02-interop-both-ways.md)
