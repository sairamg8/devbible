---
title: "01 · The engine, the runtime and the spec"
sidebar_label: "01 · Engine, runtime, spec"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — V8 **13.6.233.17**, ICU **78.3**,
> Unicode **17.0**. Script: `sandbox/js-p0/ex4-hosts.mjs`.

**`document` is not JavaScript. `process` is not JavaScript. `fetch` is not
JavaScript either.** Exactly one of those three is *nearly* everywhere anyway,
and knowing which — and why — is the difference between "this works on my
machine" and knowing before you type it.

Three separate things are involved every time your code runs.

| | What it is | Examples | Who defines it |
|---|---|---|---|
| **The spec** | The written rules of the language | `Object`, `Array`, `Promise`, `Map`, `Symbol`, `JSON`, `Math`, `Intl`, closures, `class` | ECMA-262, by **TC39** |
| **The engine** | A program that implements the spec | **V8** (Chrome, Node, Edge, Deno), **SpiderMonkey** (Firefox), **JavaScriptCore** (Safari, Bun) | Browser/runtime vendors |
| **The host** | Everything *around* the language that lets it touch the world | `document`, `window`, `localStorage`, `process`, `fs`, `fetch`, `setTimeout` | WHATWG/W3C (web), Node, WinterCG |

The spec has **no I/O in it at all.** No printing, no files, no network, no
clock you can wait on. A conforming engine given only ECMA-262 can compute
things and hand back a value — it cannot show you the value. Everything you
actually build with is host-provided.

## Why this split exists

The language was standardised separately from the browser on purpose, so it
could be embedded somewhere else. That is precisely what happened: Node took
V8, threw away the DOM, and bolted on files, sockets and processes instead.
Same language, different host.

The practical consequence is the one that matters:

> **A JavaScript feature works everywhere the engine is new enough. A host
> feature works only where that host provides it.** They fail differently and
> you fix them differently.

## Measured: which globals exist in Node 24

```js
// sandbox/js-p0/ex4-hosts.mjs
const languageGlobals = ['Object','Array','Promise','Map','Symbol','JSON','Math','Intl','globalThis'];
const webPlatform = ['fetch','URL','URLSearchParams','AbortController','Headers','Request',
  'Response','structuredClone','queueMicrotask','TextEncoder','crypto','Blob','FormData',
  'EventTarget','ReadableStream','WebSocket','performance','setTimeout'];
const browserOnly = ['window','document','localStorage','history','navigator',
  'IntersectionObserver','requestAnimationFrame','XMLHttpRequest','alert'];
const nodeOnly = ['process','Buffer','require','__dirname','module'];

const show = (label, names) =>
  console.log(label + '\n  ' + names.map(n => `${n}=${typeof globalThis[n] !== 'undefined'}`).join(' '));

show('language (spec):', languageGlobals);
show('web platform in node 24:', webPlatform);
show('browser-only:', browserOnly);
show('node-only (in ESM):', nodeOnly);

console.log('\nnode version:', process.version, '| v8:', process.versions.v8);
console.log('globalThis === global:', globalThis === global);
```

```
language (spec):
  Object=true Array=true Promise=true Map=true Symbol=true JSON=true Math=true Intl=true globalThis=true
web platform in node 24:
  fetch=true URL=true URLSearchParams=true AbortController=true Headers=true Request=true Response=true structuredClone=true queueMicrotask=true TextEncoder=true crypto=true Blob=true FormData=true EventTarget=true ReadableStream=true WebSocket=true performance=true setTimeout=true
browser-only:
  window=false document=false localStorage=false history=false navigator=true IntersectionObserver=false requestAnimationFrame=false XMLHttpRequest=false alert=false
node-only (in ESM):
  process=true Buffer=true require=false __dirname=false module=false

node version: v24.19.0 | v8: 13.6.233.17-node.51
globalThis === global: true
```

Four things in that output are worth stopping on.

**1. The whole middle row is `true`, and none of it is JavaScript.** `fetch`,
`URL`, `AbortController`, `Blob`, `WebSocket` — every one is a *web platform*
API, and Node 24 implements them anyway. This is deliberate convergence: the
same code moves between browser, Node, Deno, Bun and Cloudflare Workers. When
you write a `fetch` wrapper for a storefront, that file runs in both places
unchanged. That portability is a **choice by runtime vendors**, not a
guarantee from the spec.

**2. `navigator=true` in Node.** It is not the browser's `navigator` — Node
implements a small slice of it. Testing `typeof navigator !== 'undefined'` to
detect a browser is therefore **broken on Node 24**, and this is a real
regression in code written before Node 21.

**3. `require=false`, `__dirname=false`, `module=false`.** Those are CommonJS
bindings, and the script is an ES module. They are not "Node globals" — they
are *module-system* bindings, absent in ESM. Use `import.meta.url` and
`import.meta.dirname` instead.

**4. `globalThis === global` is `true`.** `globalThis` is the spec's name for
"the global object, whatever the host calls it" — `window` in a browser,
`self` in a worker, `global` in Node. It is the only name that works
everywhere, which is why it exists.

## The rule this gives you

Read any line of code and split it:

```js
document.querySelector('a').addEventListener('click', (event) => {
  event.preventDefault();
  console.log(new URL(event.target.href).pathname);
});
```

| Fragment | Language or host? |
|---|---|
| `const`, the arrow function, `=>`, the call syntax, the object literal | **Language** |
| `document`, `querySelector`, `addEventListener`, `event`, `preventDefault` | **Host** (DOM) |
| `new URL(...)`, `.pathname` | **Host** (web platform — but also in Node) |
| `console.log` | **Host** — and it is in *every* host, which is why it feels like language |

`console` is the sharpest example. It is in no ECMAScript edition at all. It
exists in every host you will ever use, which is exactly what makes people
assume it is part of the language.

## Which engine, and does it matter

| Engine | Ships in | Note |
|---|---|---|
| **V8** | Chrome, Edge, Node, Deno, Electron | The one you optimise against by default |
| **SpiderMonkey** | Firefox | First JS engine ever written (1995) |
| **JavaScriptCore** | Safari, Bun | Where iOS bugs come from — and every iOS browser uses it |

For language semantics: **it does not matter.** All three implement the same
spec, and where they differ it is a bug or an unshipped proposal.

For performance: it matters, and you cannot generalise. A micro-benchmark
tuned on V8 tells you nothing about JavaScriptCore. See
[11 · The JIT](./11-the-jit.md).

For **your bug reports**: it matters a lot. "Broken in Safari" almost always
means JavaScriptCore lacks a feature V8 shipped first, or an iOS-specific host
restriction — not that the language differs.

## Gotchas

**Symptom:** `ReferenceError: window is not defined` during a Next.js/SSR build,
in code that works in the browser.
**Cause:** the module ran on the **server** host, which has no `window`. The
language is identical; the host is not.
**Fix:** move the access inside an effect that only runs client-side, or guard
with `typeof window !== 'undefined'`. Do not guard with `typeof navigator`,
which is now truthy in Node.

**Symptom:** `navigator`-based browser detection started misfiring after a Node
upgrade.
**Cause:** Node 21+ defines a minimal `navigator`; the check was never testing
for a browser, only for that name.
**Fix:** test the exact capability you need — `typeof document !== 'undefined'`
for DOM, `typeof window !== 'undefined'` for browser globals. See
[10 · Feature detection](./10-feature-detection.md).

**Symptom:** `__dirname is not defined in ES module scope`.
**Cause:** CJS bindings do not exist in ESM.
**Fix:** `import.meta.dirname` (Node 20.11+), or
`path.dirname(fileURLToPath(import.meta.url))`.

**Symptom:** a feature works in Chrome and Node but throws in Safari.
**Cause:** JavaScriptCore has not shipped it yet — a *timing* difference in
implementing the same spec.
**Fix:** check availability before assuming, and reach for a polyfill only for
the specific gap. Never branch on the browser name.

## Interview questions

**★ Is `setTimeout` part of JavaScript?**
No. It is not in ECMA-262 at all. It is provided by the host — the HTML spec
in browsers, and separately by Node. Both provide it because it is universally
useful, but a bare conforming engine has no timers, and no way to schedule
anything against the clock.

**★ What is the difference between the engine and the runtime?**
The engine (V8) executes the language: parsing, compiling, optimising,
garbage collection. The runtime is the engine *plus* the host APIs, the
event loop, and the queues that feed it. V8 alone cannot open a file, make a
request or wait a second. Node and Chrome each embed the same V8 and supply
very different worlds around it.

**★ Why does the same code behave differently in Node and the browser?**
The language does not change; the host does. Different globals, a different
module system by default, and a different event loop implementation — the
browser's is specified by HTML and interleaves rendering, Node's is libuv's
phase loop. Language-level ordering (microtasks) is identical; host-level
ordering (`setImmediate`, rendering) is not.

**Why does `globalThis` exist when `window`, `self` and `global` already did?**
Because none of those three worked everywhere: `window` is browser-only, `self`
is browser and workers, `global` is Node. Library code that wanted the global
object had to sniff for all three, and the sniffing itself broke under bundlers
and strict CSP. `globalThis` (ES2020) is one name that is correct in every host.

**If `fetch` is not part of JavaScript, why is it in Node?**
Because runtime vendors converged on the web platform deliberately, so code is
portable. Node 18 shipped `fetch` (via undici) for exactly that reason. It is
still a host API — an older Node lacks it, and that is a host-version problem,
not a language-version one.

**Does it matter which engine my code runs on?**
Not for semantics — all major engines implement the same spec and differences
are bugs or unshipped proposals. It matters for **performance** (optimisations
are engine-specific, so a V8-tuned micro-benchmark says nothing about Safari)
and for **feature timing** (engines ship proposals at different rates, which is
where most "Safari is broken" reports come from).

---

[Phase index](./) · Next: [02 · Parse, compile, execute](./02-parse-compile-execute.md) →
