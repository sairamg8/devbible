---
title: "What Node.js is"
sidebar_label: "01 · What Node.js is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. `process.versions` re-run on **Node 24.19.0** (v8 13.6.233.17-node.51,
> uv 1.52.1, openssl 3.5.7). The V8/libuv split checked against
> [libuv — Design overview](https://docs.libuv.org/en/v1.x/design.html) and
> [Don't block the event loop](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop).

**Node.js is not a language and not a framework. It is a program that runs
JavaScript outside the browser and gives it access to your computer.**

## Why it exists

JavaScript itself can do arithmetic, loops, objects and functions. That's all.
It cannot read a file, open a network port, or read an environment variable —
the language has no such words.

Those abilities always come from the *host*. In a browser the host is Chrome,
and it hands JavaScript the DOM, `fetch`, and `localStorage`. Node.js is a
different host. It hands JavaScript files, sockets, processes, and the operating
system.

Same language. Different powers.

## The four parts

| Part | What it is | What it gives you |
|---|---|---|
| **V8** | Google's JavaScript engine, written in C++ | Runs your JS: parses it, compiles it, garbage-collects it |
| **libuv** | A C library for asynchronous I/O | The event loop, and the ability to wait for files and sockets without freezing |
| **C++ bindings** | Glue code | Lets `fs.readFile` in JavaScript actually call `read()` in the operating system |
| **Standard library** | The `node:` modules, mostly written in JS | `node:fs`, `node:http`, `node:path`, `node:crypto`, and the rest |

A one-line version: **V8 is the brain, libuv is the hands.** The brain thinks in
JavaScript and only does one thing at a time. The hands go off and wait for the
disk and the network while the brain keeps thinking.

Every part is real and you can see them:

```js
// versions.js
console.log('node   ', process.versions.node);
console.log('v8     ', process.versions.v8);
console.log('uv     ', process.versions.uv);
console.log('openssl', process.versions.openssl);
```

```console
$ node versions.js
node    24.19.0
v8      13.6.233.17-node.51
uv      1.52.1
openssl 3.5.7
```

`process.versions` lists every C library Node was built with. This is proof that
"Node" is a bundle of things, not one thing.

## Where the powers come from

```js
// powers.js
console.log(typeof fetch);          // 'function'  — a web standard, Node has it too
console.log(typeof setTimeout);     // 'function'  — also standard
console.log(typeof document);       // 'undefined' — browser only, no DOM here

const fs = require('node:fs');
console.log(typeof fs.readFile);    // 'function'  — Node only, no browser has this
```

`fs.readFile` is not JavaScript. It is a C++ binding wearing a JavaScript
function as a costume. When you call it, execution leaves V8, enters libuv, and
comes back with your data.

## What happens when you run `node app.js`

1. The `node` binary starts and boots V8.
2. V8 sets up the globals: `process`, `console`, `Buffer`, `fetch`, timers.
3. Node reads `app.js` and hands the source to V8 to compile and run.
4. Your code runs top to bottom. Anything async is registered with libuv and
   left pending.
5. Your file ends — but the process does **not** exit. The event loop starts and
   keeps running as long as work is pending.
6. When nothing is left to wait for, the loop ends and the process exits.

Step 5 is why this program prints its lines out of order and still exits cleanly:

```js
// order.js
console.log('1 — runs now');

setTimeout(() => console.log('3 — runs after the file finishes'), 0);

console.log('2 — also runs now');
```

```console
$ node order.js
1 — runs now
2 — also runs now
3 — runs after the file finishes
```

Your file is not the program. Your file is the *setup* for the program. The
event loop is the program.

## Gotchas

**Symptom:** `ReferenceError: document is not defined`
**Cause:** Browser-only code running in Node — usually a shared package, or a
React component imported into a server file.
**Fix:** Move the DOM work behind a check for the browser, or keep it out of the
server bundle entirely. Never shim `document` with a fake object; you will hide
the problem, not solve it.

**Symptom:** `Module not found: Can't resolve 'fs'` when building for the browser
**Cause:** A dependency imports `node:fs`, and bundlers have no such thing to
give it — the browser has no filesystem.
**Fix:** Find which package pulls it in and replace it with a browser-safe one.
The error is correct: that code cannot run in a browser at all.

**Symptom:** Your script prints everything, then hangs and never exits
**Cause:** Something is still pending in the event loop — an open server, an
`setInterval`, a live database connection.
**Fix:** Close it. Find it with `node --trace-exit` or by calling
`process.getActiveResourcesInfo()` at the end of your script. Reaching for
`process.exit()` hides a resource leak rather than fixing it.

**Symptom:** "My code works in the browser but breaks in Node" (or the reverse)
**Cause:** You are treating the language and the host as one thing.
**Fix:** Ask which part you are using. Loops, `Array`, `Promise`, `JSON` are the
language and work everywhere. `document`, `window`, `fs`, `process` belong to a
host and do not.

## Interview questions

**★ Is Node.js a programming language, a framework, or something else?**
A runtime — a program that executes JavaScript outside a browser. The language is
still JavaScript, executed by V8; Node adds the operating-system access the
language does not have on its own.

**★ What does V8 do, and what does libuv do?**
V8 compiles and executes the JavaScript and manages memory. libuv provides the
event loop, the thread pool, and cross-platform asynchronous I/O. V8 has no
concept of files, sockets, or the event loop; that is all libuv.

**★ Why can JavaScript read a file in Node but not in a browser?**
Neither can. The language has no file API in either place. Node's host supplies
`node:fs`; the browser's host deliberately does not, because a web page reading
your disk would be a security hole.

**Node is called single-threaded, yet libuv has a thread pool. Which is true?**
Both. *Your JavaScript* runs on one thread. The I/O underneath it uses several.
See [Single-threaded JavaScript, multi-threaded I/O](02-single-thread-and-io.md).

**What happens after the last line of your entry file runs?**
Nothing exits yet. Node checks whether any work is still pending in the event
loop. If yes, the loop keeps spinning and your callbacks fire. Only when nothing
is pending does the process exit — which is why a server stays alive without a
`while (true)` anywhere in your code.

**Why does `process.versions` list more than one version number?**
Because Node is an assembly of independent C/C++ projects — V8, libuv, OpenSSL,
zlib, ares and others — each with its own release cycle. A Node upgrade is
really an upgrade of that whole set.

---

← Index: [Phase 0](README.md) · Next → [Single-threaded JavaScript, multi-threaded I/O](02-single-thread-and-io.md)
