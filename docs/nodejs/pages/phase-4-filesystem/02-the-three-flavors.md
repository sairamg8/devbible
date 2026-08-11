---
title: "The three flavors"
sidebar_label: "02 · Three flavors"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Every `fs` operation exists three times: callback, sync, and promise. The
promise form is the default; the sync form is acceptable *at startup only*; the
callback form is what you meet in older code.**

```js
// flavors.mjs
import { readFile as readFileCb, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

readFileCb('flavors.mjs', 'utf8', (err, data) => console.log('callback :', err ? err.code : data.length + ' chars'));
console.log('sync     :', readFileSync('flavors.mjs', 'utf8').length, 'chars');
console.log('promises :', (await readFile('flavors.mjs', 'utf8')).length, 'chars');
```

```console
$ node flavors.mjs
sync     : 2203 chars
promises : 2203 chars
callback : 2203 chars
```

Note the order: the callback result prints **last**, even though it was
requested first. Sync returns inline; the promise resolved on a microtask; the
callback landed in a later event loop phase.

| Flavor | Import | Errors | Blocks |
|---|---|---|---|
| **Promise** | `node:fs/promises` | thrown, `try`/`catch` | no |
| **Callback** | `node:fs` | first argument | no |
| **Sync** | `node:fs`, `*Sync` suffix | thrown | **yes — the whole process** |

## What "sync blocks" actually costs

```js
// blocking.mjs
import { readFileSync } from 'node:fs';
let ticks = 0;
const iv = setInterval(() => ticks++, 1);
await new Promise((r) => setTimeout(r, 30));

const t = Date.now(); ticks = 0;
for (let i = 0; i < 200; i++) readFileSync('yarn.lock');
console.log(`200 sync reads: ${Date.now() - t} ms, timer ticked ${ticks} times`);
clearInterval(iv);
```

```console
$ node blocking.mjs
200 sync reads: 86 ms, timer ticked 0 times
```

A 1 ms timer fired **zero** times across 86 ms. In a server that is 86 ms during
which no request is accepted, no response is written, no health check answered.
At 100 requests per second that is 8–9 requests stalled by one careless
`readFileSync`.

The mechanism is [Phase 0](../phase-0-runtime-model/03-blocking-the-event-loop.md):
one thread runs your JavaScript, and a sync syscall owns it until the kernel
returns.

## When sync is genuinely correct

**At startup, before the server listens.** There is no concurrency to protect
yet, and sync code is simpler:

```js
// boot.mjs — legitimate sync
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const cert = readFileSync('/etc/tls/server.crt');

const server = createServer(handler);
server.listen(config.port);        // from here on, no sync fs
```

Also legitimate:

- **CLI tools and build scripts** — a single-purpose process with no concurrent
  work to block.
- **Inside a `worker_thread`** whose only job is that file.
- **Crash handlers**, where you must write a diagnostic before the process dies
  and there is no future event loop turn to await in.

Everything else — request handlers, background jobs, anything after
`server.listen` — uses `fs/promises`.

The trade-off is honest: sync code is shorter and its errors are easier to
sequence. That is worth something at boot, where the cost is zero. It is worth
nothing once traffic arrives.

## Callback form, and why you still meet it

```js
// callback.mjs
import { readFile } from 'node:fs';

readFile('config.json', 'utf8', (err, data) => {
  if (err) return console.error('failed:', err.code);      // ← the error-first contract
  console.log('ok:', data.length);
});
```

The convention is [error-first callbacks](../phase-2-async/13-callbacks-and-promisify.md):
`(err, result)`, error checked before anything else. You meet it in older
codebases and in libraries that predate promises. Bridge it with
`util.promisify` rather than rewriting:

```js
import { promisify } from 'node:util';
import { readFile } from 'node:fs';
const readFileAsync = promisify(readFile);   // or just import from node:fs/promises
```

For `fs` specifically there is no reason to promisify — the promise version
already exists.

## Sync inside a hot path, disguised

The dangerous cases are the ones that do not look like `fs`:

| Looks innocent | Actually sync fs |
|---|---|
| `require('./thing')` | Reads and compiles from disk synchronously |
| `existsSync(path)` | Sync stat, plus a TOCTOU race ([page 08](08-stat-and-existence.md)) |
| `JSON.parse(readFileSync(...))` inside a handler | The obvious one, still common |
| A template engine's default loader | Many read templates with `readFileSync` per render |
| `console.log` to a **file** or pipe | Synchronous on some stdout targets |

`require` is the one people miss: a lazy `require()` inside a request handler
blocks the loop the first time it runs. Import at module scope, or use dynamic
`import()`, which does not.

## Gotchas

**Symptom:** Latency spikes correlated with traffic, CPU mostly idle
**Cause:** A sync fs call in a request path.
**Fix:** Switch to `fs/promises`. Find them with `--cpu-prof` or by grepping for
`Sync(`.

**Symptom:** Health checks fail intermittently under load
**Cause:** The event loop is blocked long enough to miss the check window.
**Fix:** Same — remove sync I/O from the serving path.

**Symptom:** A lazy `require()` in a handler causes a one-off stall
**Cause:** Module loading is synchronous disk I/O plus compilation.
**Fix:** Import at the top level, or `await import()`.

**Symptom:** Mixed `await` and callbacks in one function, errors escaping
**Cause:** A callback's thrown error is not caught by the surrounding
`try`/`catch`.
**Fix:** Use one flavour per function; prefer promises.

**Symptom:** `readFileSync` in a `worker_thread` flagged in review
**Cause:** Reviewer applied the main-thread rule.
**Fix:** It is fine there — the worker has its own loop, and blocking it is often
the point. Say so in a comment.

## Interview questions

**★ Why is `readFileSync` in a request handler a bug?**
It blocks the single thread that runs all JavaScript, so the whole process stops
— no other request progresses. Measured: 200 sync reads blocked a 1 ms timer for
86 ms, zero ticks.

**★ When is sync fs acceptable?**
Before the server starts listening (config, certificates), in CLI and build
scripts, inside a dedicated worker thread, and in crash handlers where there is
no future event loop turn.

**★ Which is faster for 200 files, sync or async?**
Async — 45 ms versus 86 ms — because `fs` work runs on the libuv thread pool and
overlaps. Sync is not even the faster option; it is just simpler to write.

**★ What hidden sync I/O exists in a typical app?**
`require()` (synchronous read and compile), `existsSync`, template engines that
load with `readFileSync` per render, and `console.log` when stdout is a file.

**How do you find sync calls in a running service?**
`--cpu-prof` and look for `fs.readFileSync` frames, or event loop delay
monitoring; the syllabus covers both in Phase 10. Statically, grep for `Sync(`.

---

← Prev: [node:fs/promises](01-fs-promises.md) · Next → [node:path](03-path.md)
