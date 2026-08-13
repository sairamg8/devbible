---
title: "09 · Transpilation and polyfills"
sidebar_label: "09 · Transpilation, polyfills"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** for the feature-presence claims
> (`sandbox/js-p0/ex9-feature-era.mjs`). Build-tool behaviour described here is
> configuration, not measured output.

**Transpiling and polyfilling solve different problems and are not
interchangeable.** Confusing them is why a build "supports" a browser and then
throws `X is not a function` on it.

| | Transpiler | Polyfill |
|---|---|---|
| Fixes | **Syntax** the engine cannot parse | **Missing APIs** the engine does not have |
| Examples | `?.`, `??`, `class`, `async`, `#private`, JSX | `Object.groupBy`, `Array.at`, `structuredClone`, `Promise.any` |
| Works by | Rewriting your source at build time | Adding the function at runtime |
| Cost | Larger, less readable output | Runtime bytes, shipped to everyone |
| Tools | Babel, SWC, esbuild, TypeScript | core-js, individual ponyfills |

**Syntax fails at parse time**, so it takes the whole file down before any code
runs ([02 · Parse, compile, execute](./02-parse-compile-execute.md)). **A missing
method fails at call time**, so the page loads and then breaks on one
interaction. The failure modes are different, which is how you tell which one
you have.

## Transpiling: syntax down-levelled

```js
// source
const total = order?.lines?.reduce((s, l) => s + l.qty * l.priceMinor, 0) ?? 0;

// roughly what a transpiler emits for an old target
var _order$lines;
var total = (_order$lines = order === null || order === undefined
  ? undefined
  : order.lines) === null || _order$lines === undefined
  ? undefined
  : _order$lines.reduce(function (s, l) { return s + l.qty * l.priceMinor; }, 0);
total = total !== null && total !== undefined ? total : 0;
```

Identical behaviour, syntax an ES5 parser accepts. Note the size: this is why
setting your target lower than you need makes bundles bigger for everyone.

## Polyfilling: an API added at runtime

```js
// Polyfill — mutates the global, so all code sees it
if (!Object.groupBy) {
  Object.groupBy = function (items, keyFn) {
    const out = Object.create(null);
    let i = 0;
    for (const item of items) {
      const key = keyFn(item, i++);
      (out[key] ??= []).push(item);
    }
    return out;
  };
}

// Ponyfill — exported, no global mutation
export function groupBy(items, keyFn) { /* same body */ }
```

**Prefer the ponyfill in library code.** A polyfill that patches a built-in
affects every other script on the page, including ones you did not write, and a
subtly wrong implementation becomes very hard to trace. A polyfill is
appropriate in your own application entry point, where you control the whole
page.

### Some things cannot be polyfilled

`Proxy`, `WeakRef`, `BigInt` and real `#private` fields depend on engine
capabilities that cannot be reconstructed in JavaScript. There is no polyfill;
there is only "do not use it below this floor".

## `browserslist` is the single control

Both Babel and modern bundlers read it, and it should come from your real
traffic:

```jsonc
// package.json
{
  "browserslist": ["> 0.5%", "last 2 versions", "not dead"]
}
```

```jsonc
// .babelrc — targets come from browserslist; core-js only for what is missing
{
  "presets": [["@babel/preset-env", {
    "useBuiltIns": "usage",
    "corejs": "3.38"
  }]]
}
```

`useBuiltIns: "usage"` is the setting that matters: Babel inspects your code and
injects **only the polyfills you actually reference**, for the targets you
actually support. The alternative, `"entry"`, pulls in a large fixed block.

> **The most common configuration bug is a `browserslist` nobody revisited.**
> A five-year-old config still targeting IE11 makes every user download ES5
> output and a large core-js bundle for a browser with no remaining users.
> Re-derive it from analytics, not from memory.

## Do you still need any of this in 2026?

For **language syntax**, largely no. Everything through ES2025 is present in
current Chrome, Firefox, Safari and Node — measured on Node 24 in
[05 · ECMAScript and TC39](./05-ecmascript-and-tc39.md). If your
`browserslist` is honest, the transpiler often has nothing to down-level.

You still need a build step for:

- **JSX and TypeScript** — not JavaScript syntax at all, always compiled away.
- **Stage-3 proposals** — decorators, and `Temporal` if you cannot wait.
- **Bundling and tree shaking** — the request-waterfall problem from
  [07 · Loading scripts](./07-loading-scripts.md).
- **Minification, asset hashing, environment inlining.**

So the build survives; the *down-levelling* part of it is mostly finished.

## Gotchas

**Symptom:** `SyntaxError: Unexpected token '?'` in an older browser.
**Cause:** syntax the parser cannot read — no polyfill can help, because the file
never parses.
**Fix:** lower the transpiler target, or raise the `browserslist` floor if that
browser is not actually in your traffic.

**Symptom:** the page loads, then `TypeError: x.at is not a function` on one
interaction.
**Cause:** a missing **method**, not missing syntax. Transpiling does not add it.
**Fix:** polyfill that method, or avoid it. `useBuiltIns: "usage"` would have
injected it automatically.

**Symptom:** the bundle is far larger than expected.
**Cause:** a stale `browserslist` forcing ES5 output plus a full core-js.
**Fix:** re-derive targets from analytics; use `useBuiltIns: "usage"`; consider
`nomodule` two-bundle output only if you genuinely still support such browsers.

**Symptom:** a polyfill broke an unrelated third-party script.
**Cause:** it patched a global with a not-quite-correct implementation.
**Fix:** use a ponyfill and import it explicitly. Reserve global patching for
your own application entry point.

**Symptom:** `Proxy is not defined` and no polyfill fixes it.
**Cause:** `Proxy` cannot be implemented in JavaScript.
**Fix:** raise the runtime floor or design around it. Some features are a hard
requirement, not a soft one.

## Interview questions

**★ What is the difference between a transpiler and a polyfill?**
A transpiler rewrites **syntax** at build time so an older parser can read it —
`?.`, `class`, `async`. A polyfill adds a **missing API** at runtime —
`Object.groupBy`, `Array.at`. Syntax fails at parse time and takes the whole file
down; a missing method fails at call time on one interaction. They fix different
failures and neither substitutes for the other.

**★ What is a ponyfill and why prefer it?**
A ponyfill exports the implementation instead of patching the global. It avoids
affecting other scripts on the page with a possibly-imperfect implementation, and
it is tree-shakeable. Use ponyfills in libraries; a true polyfill is acceptable
in an application entry point you fully control.

**Do you still need Babel in 2026?**
For down-levelling syntax, usually not — everything through ES2025 is in current
engines. You still need a build for JSX and TypeScript, Stage-3 proposals,
bundling and tree shaking, and minification. The compiler survives; the
down-levelling is mostly done.

**What does `useBuiltIns: "usage"` do?**
Babel scans your source and injects only the core-js polyfills your code actually
uses, for your `browserslist` targets — instead of `"entry"`, which pulls in a
fixed block regardless of use. It is the difference between a few kilobytes and
tens of kilobytes.

**Can everything be polyfilled?**
No. `Proxy`, `WeakRef`, `BigInt` and real private fields need engine support that
cannot be reconstructed in JavaScript. For those the only options are raising the
runtime floor or designing around them.

---

← [08 · Running and inspecting](./08-running-and-inspecting.md) · [Phase index](./) · Next: [10 · Feature detection](./10-feature-detection.md) →
