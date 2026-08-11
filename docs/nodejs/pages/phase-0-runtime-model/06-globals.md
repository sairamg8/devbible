---
title: "Globals worth knowing"
sidebar_label: "06 · Globals"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). Everything here is
> available in Node 24.

**The handful of names that are always there: `process`, `globalThis`, `Buffer`,
and the two ways to ask "where is this file?".**

## `process` — the program talking about itself

`process` is your link to the outside: arguments, environment, working
directory, signals, and exit.

```js
// info.js
console.log('argv    ', process.argv);          // command-line arguments
console.log('cwd     ', process.cwd());         // where node was started FROM
console.log('platform', process.platform);      // 'linux' | 'darwin' | 'win32'
console.log('pid     ', process.pid);
console.log('uptime  ', process.uptime().toFixed(3), 's');
console.log('rss     ', (process.memoryUsage().rss / 1024 / 1024).toFixed(1), 'MB');
```

```console
$ node info.js --port 3000
argv     [ '/usr/bin/node', '/home/you/info.js', '--port', '3000' ]
cwd      /home/you
platform linux
pid      48213
uptime   0.031 s
rss      44.2 MB
```

**`process.argv` always starts with two entries** — the node binary and your
script — so your own arguments begin at index 2. Parse them with
`util.parseArgs()` rather than by hand (Phase 5).

### `process.env`

```js
// env.js
const port = Number(process.env.PORT ?? 3000);
const debug = process.env.DEBUG === 'true';

console.log(typeof process.env.PORT, port, debug);
```

```console
$ PORT=8080 DEBUG=true node env.js
string 8080 true
```

Every value is a **string**, always. `PORT` is `'8080'`, not `8080`; `DEBUG=false`
is the string `'false'`, which is truthy. Convert at the edge, once, and validate
at startup — a missing database URL should crash the process on boot, not at 3am
on the first request that needs it.

### Exiting

```js
// exit.js
process.exitCode = 1;            // "finish up, then exit with 1"  ✅
// process.exit(1);              // "stop NOW, drop everything"    ⚠
```

`process.exit()` is immediate. Pending writes to stdout, in-flight requests and
open database transactions are abandoned. Set `process.exitCode` and let the
event loop drain instead. Reserve `process.exit()` for the moment after you have
deliberately finished everything.

```js
// shutdown.js — the shape every server needs
const server = require('node:http').createServer((req, res) => res.end('ok'));
server.listen(3000);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n${signal} — closing server`);
    server.close(() => {
      console.log('closed cleanly');
      process.exitCode = 0;
    });
  });
}
```

`SIGTERM` is what Docker and Kubernetes send before they kill you. Handling it is
the difference between a graceful deploy and dropped requests. Full treatment in
Phase 11.

## `globalThis`

One name for the global object in every JavaScript environment — `window` in a
browser, `global` in Node, `self` in a worker. Node has all three names but
`globalThis` is the one that is portable.

```js
console.log(globalThis === global);   // true in Node
```

Use it to *check* for something, not to store your own state. Globals defeat
module scoping, break tests that run in parallel, and turn into a race the moment
two modules both write.

## `Buffer`

A fixed-length chunk of raw bytes — the type Node uses for anything that is not
text: file contents, socket data, image bytes, hashes.

```js
// buffer.js
const buf = Buffer.from('héllo', 'utf8');

console.log(buf);              // <Buffer 68 c3 a9 6c 6c 6f>
console.log(buf.length);       // 6 — BYTES, not characters
console.log('héllo'.length);   // 5 — characters
console.log(buf.toString('base64'));
```

`Buffer` is a `Uint8Array` underneath, so every typed-array method works on it.
The full story — encodings, slicing, pooling, the `Buffer.from` vs
`Buffer.allocUnsafe` distinction — is Phase 3.

## Where am I? Paths in CJS and ESM

The most common Node bug of all: **relative paths resolve against the current
working directory, not against the file that contains them.**

```js
// CommonJS — always available
console.log(__filename);   // /home/you/app/config/load.js
console.log(__dirname);    // /home/you/app/config
```

```js
// ESM — __dirname does not exist
console.log(import.meta.url);        // file:///home/you/app/config/load.js
console.log(import.meta.filename);   // /home/you/app/config/load.js
console.log(import.meta.dirname);    // /home/you/app/config
```

`import.meta.dirname` and `import.meta.filename` were added in **v21.2.0 /
v20.11.0** and are stable as of **v24.0.0 / v22.16.0**. Before them you needed
`fileURLToPath(import.meta.url)`; you will still see that in older code.

The bug they prevent:

```js
// load.js, living in app/config/, reading app/config/settings.json
const fs = require('node:fs');
const path = require('node:path');

// ❌ works from app/, breaks from anywhere else
fs.readFileSync('./config/settings.json', 'utf8');

// ✅ works no matter where node was started
fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8');
```

```console
$ cd ~/app && node config/load.js     # both work
$ cd / && node ~/app/config/load.js   # only the second works
Error: ENOENT: no such file or directory, open './config/settings.json'
```

This is why a script works locally and fails in a container or a cron job: the
working directory changed, and `./` moved with it. Anything shipped with your
code — templates, migrations, fixtures — should be located from `__dirname` or
`import.meta.dirname`. Only paths a *user* supplies should be relative to `cwd`.

## Gotchas

**Symptom:** `ReferenceError: __dirname is not defined in ES module scope`
**Cause:** The file is ESM — `.mjs`, or `"type": "module"` in `package.json`.
**Fix:** `import.meta.dirname`. Note it exists only for `file:` modules, so it is
`undefined` for anything loaded from a `data:` or `http:` URL.

**Symptom:** A feature flag is on even though you set `ENABLE_X=false`
**Cause:** `process.env` values are strings, and `'false'` is truthy.
**Fix:** Compare explicitly (`=== 'true'`) or parse the whole environment once
through a schema validator at startup.

**Symptom:** Log lines go missing right before the process exits
**Cause:** `process.exit()` fired while stdout still had buffered output — writes
to a pipe or file are asynchronous.
**Fix:** Set `process.exitCode` and return, letting the loop drain naturally.

**Symptom:** `ENOENT` in production for a file that exists in the repo
**Cause:** A relative path resolved against the container's working directory
instead of the file's directory.
**Fix:** Build the path from `__dirname` / `import.meta.dirname`. Check the
file is actually included in your image or in `package.json`'s `files`.

**Symptom:** Kubernetes reports dropped requests on every deploy
**Cause:** No `SIGTERM` handler, so the process dies mid-request instead of
draining.
**Fix:** Handle `SIGTERM`, stop accepting new connections, finish in-flight work,
then exit.

## Interview questions

**★ Why does `process.argv[0]` not contain your first argument?**
Index 0 is the path to the node executable and index 1 is the path to the script
being run. Your arguments start at index 2.

**★ What is the difference between `process.exit()` and setting
`process.exitCode`?**
`process.exit()` terminates immediately and abandons pending asynchronous work,
including buffered stdout. `process.exitCode` records the status you want and
lets the event loop finish, so the process exits cleanly once there is nothing
left to do. Prefer the second.

**★ What is the difference between `__dirname` and `process.cwd()`?**
`__dirname` is where the *file* lives and never changes. `process.cwd()` is where
`node` was *started* and depends entirely on how it was launched. Use `__dirname`
for files that ship with your code; `cwd` only for paths a user typed.

**★ How do you get `__dirname` in an ES module?**
`import.meta.dirname` (v21.2.0 / v20.11.0, stable in v24 / v22.16). Older code
uses `path.dirname(fileURLToPath(import.meta.url))`.

**Why does `if (process.env.DEBUG)` behave surprisingly?**
Environment variables are always strings, so `DEBUG=false` sets the truthy string
`'false'`. Only an unset variable is `undefined` and therefore falsy.

**What is `globalThis` for, and when should you write to it?**
It is the portable name for the global object across Node, browsers and workers,
useful for feature detection. Writing your own state onto it is a smell: it
bypasses module boundaries, leaks between tests, and creates hidden coupling.

**Why must a server handle `SIGTERM`?**
Because that is the signal orchestrators send to ask for a clean shutdown before
force-killing with `SIGKILL`. Without a handler the process dies instantly and
in-flight requests are dropped on every single deploy.

---

← Prev: [Node vs the browser](05-node-vs-browser.md) · Next → [Choosing a version](07-choosing-a-version.md)
