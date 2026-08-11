---
title: "Node vs the browser"
sidebar_label: "05 · Node vs the browser"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Same language, different host, different powers — and a growing middle ground
of web standards that work in both.**

## Why it matters

You will write code that runs in both places (validation, date maths, types) and
code that can only run in one. Knowing which is which stops a whole category of
confusing errors, and it is the reason "isomorphic" or "universal" code has to be
written carefully.

## The map

| | Browser | Node.js |
|---|---|---|
| **Runs for** | One user, one tab | Many users at once |
| **Global object** | `window` (also `self`, `globalThis`) | `globalThis` — there is no `window` |
| **DOM** | `document`, `HTMLElement`, `CSSStyleSheet` | None. Node never renders anything |
| **Filesystem** | No access; only what the user picks in a file input | Full access via `node:fs` |
| **Network** | `fetch`, `WebSocket`, restricted by CORS and the same-origin policy | `fetch`, plus raw TCP/UDP sockets. **No CORS** — it is a browser rule, not an HTTP one |
| **Storage** | `localStorage`, `IndexedDB`, cookies | Files, databases, Redis |
| **Modules** | ESM only (`type="module"`), plus bundlers | ESM and CommonJS, resolved through `node:` and `node_modules` |
| **Environment config** | Baked in at build time | `process.env`, read at runtime |
| **Sandbox** | Strong — the page cannot touch your machine | None. Your code has your user's permissions |
| **Ships to** | Every visitor, so size matters | One server, so size barely matters |

## What is shared

The overlap is much larger than it was five years ago. These are web standards
that Node implements, so the same code works in both:

```js
// shared.mjs — every line of this runs in a browser too
const url = new URL('/users?page=2', 'https://api.example.com');
const params = new URLSearchParams({ page: '2' });
const controller = new AbortController();
const encoded = new TextEncoder().encode('héllo');
const id = crypto.randomUUID();
const digest = await crypto.subtle.digest('SHA-256', encoded);
queueMicrotask(() => {});
structuredClone({ nested: { ok: true } });
```

Also shared: `Promise`, `Map`, `Set`, `Intl`, `JSON`, `Array`, timers,
`console`, `Event`/`EventTarget`, `Blob`, `ReadableStream`, `performance.now()`.

Anything in that list is safe in shared code.

## Where "the same" API differs

```js
// timers.mjs
const t = setTimeout(() => {}, 1000);

console.log(typeof t);
// browser: 'number'
// node:    'object'  — a Timeout instance with .ref(), .unref(), .refresh()

clearTimeout(t);   // works in both, which is why nobody notices
```

Other quiet differences:

- **`this` at the top of a module.** In CommonJS it is `module.exports`. In ESM
  (both Node and browser) it is `undefined`. Never `window`.
- **`fetch` with relative URLs.** The browser resolves them against the page.
  Node has no page, so `fetch('/api/users')` throws — always pass an absolute
  URL.
- **`crypto`.** `globalThis.crypto` is the Web Crypto API in both. Node
  additionally has `node:crypto`, which is a different, much larger API.
- **Errors.** Node adds a `code` property (`'ENOENT'`, `'ECONNREFUSED'`) that
  browsers do not have. Match on `err.code`, not on the message.

## Gotchas

**Symptom:** `ReferenceError: window is not defined` during a server render or a
test run
**Cause:** Browser-only code executing in Node — usually a component or a
library that touches `window` at import time.
**Fix:** Move the access into an effect or a lazy call, or guard with
`typeof window !== 'undefined'`. Defining a fake `window` global makes the
crash disappear and the bug stay.

**Symptom:** A request works from the server but the browser reports a CORS error
**Cause:** CORS is enforced by the browser, not by the server or by HTTP. `curl`
and Node ignore it entirely.
**Fix:** Fix the response headers on the server. A successful Node request proves
nothing about whether the browser will be allowed to read it.

**Symptom:** `process.env.API_KEY` is `undefined` in browser code
**Cause:** There is no `process` in a browser. A bundler replaced the string at
build time — and if it did, **your key is now inside the JavaScript everyone can
read.**
**Fix:** Keep secrets on the server. Only ship values you would be happy to print
on the homepage.

**Symptom:** `fetch('/api/users')` throws `Failed to parse URL` in Node
**Cause:** No document, so no base URL to resolve a relative path against.
**Fix:** Use an absolute URL, or `new URL('/api/users', process.env.API_BASE)`.

## Interview questions

**★ What are the main differences between Node and the browser?**
Different hosts around the same language. The browser supplies the DOM and a
strict sandbox; Node supplies filesystem, sockets, processes and no sandbox at
all. Globals differ (`window` vs `process`/`globalThis`), Node supports
CommonJS as well as ESM, and Node code serves many users while browser code
serves one.

**★ Does CORS apply to requests made from Node?**
No. CORS is a browser policy protecting a user's session; Node has no origin and
no cookies to protect, so it never enforces it. This is exactly why proxying a
request through your own server bypasses it.

**★ Why does `typeof window !== 'undefined'` appear in library code?**
It is a runtime environment check, letting one package work in both hosts by
skipping browser-only code paths when loaded in Node.

**Is `setTimeout` the same in both?**
Same behaviour, different return value: a numeric id in the browser, a `Timeout`
object in Node. Node's object has `unref()`, which lets the process exit with the
timer still pending — no browser equivalent.

**What does "isomorphic" or "universal" code mean in practice?**
Code written against the shared standard surface only — `fetch`, `URL`,
`AbortController`, `TextEncoder`, Web Crypto, streams — so the same module works
on the server and in the browser without a shim.

---

← Prev: [The libuv thread pool](04-libuv-thread-pool.md) · Next → [Globals worth knowing](06-globals.md)
