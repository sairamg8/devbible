---
title: "The node: prefix"
sidebar_label: "03 · The node: prefix"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). 72 built-in modules, four of
> which are reachable **only** through the prefix.

**Write `node:fs`, never `fs`. It is one habit, it costs four characters, and it
closes a real hole.**

## What it does

`node:` marks a specifier as a built-in module. Node recognises the scheme and
returns the built-in immediately — no `node_modules` walk, no filesystem probing,
no ambiguity about what you meant.

```js
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const { createServer } = require('node:http');
```

## The part that actually bites

The common claim is that the prefix stops a package from shadowing a core module.
Be precise about this, because for most modules it is not the risk:

```js
// shadow.js — with a hand-written node_modules/path/ present
const bare   = require('path');
const scoped = require('node:path');
console.log('require("path")      →', bare.join('a', 'b'));
console.log('require("node:path") →', scoped.join('a', 'b'));
console.log('is the bare one the imposter?', bare.imposter === true);
```

```console
$ node shadow.js
require("path")      → a/b
require("node:path") → a/b
is the bare one the imposter? false
```

**Core wins already.** A package called `path` in `node_modules` cannot hijack
`require('path')` — core modules are resolved before the `node_modules` lookup, in
both CommonJS and ESM.

The real hole is the opposite case: **built-ins that are prefix-only**. Four of
them exist in Node 24.

```js
// builtins.js
const { builtinModules } = require('node:module');
console.log(builtinModules.filter(m => m.startsWith('node:')).join(', '));
console.log('total builtins:', builtinModules.length);
```

```console
$ node builtins.js
node:sea, node:sqlite, node:test, node:test/reporters
total builtins: 72
```

For these, the bare name is **not** a core module — so it falls through to
`node_modules`, and npm has a package called `test`:

```js
// testprefix.js
const bare = require('test');
const core = require('node:test');
console.log('require("test")      → third-party package?', bare.thirdParty === true);
console.log('require("node:test") → has .describe?', typeof core.describe === 'function');
```

```console
$ node testprefix.js
require("test")      → third-party package? true
require("node:test") → has .describe? true
```

That is the failure mode worth caring about: you meant the built-in test runner
and silently got somebody else's package. Same story for `sqlite`. The prefix
makes the mistake impossible to write.

## Why it is also faster

With the prefix, resolution is a lookup in a fixed table. Without it, Node must
first check whether the name is a known built-in and then, for anything that is
not, walk `node_modules` directories upward. The saving per import is small — this
is not a performance tuning knob — but it is never negative, and it removes a
filesystem-dependent step from startup.

Do not go looking for a benchmark to justify it. Clarity is the reason; the
resolution shortcut is a bonus.

## Where you will still see bare names

Plenty of published packages and older tutorials use `require('fs')`. That code is
correct and keeps working — the prefix is not a breaking change and bare names for
the 68 non-prefix-only builtins are not deprecated. Adopt `node:` in code you
write; do not open pull requests to churn dependencies over it.

One place it matters beyond style: bundlers and edge runtimes use the prefix to
tell "this is a Node built-in, leave it alone or fail loudly" from "this is a
package, go find it." Prefixed imports produce better errors when someone tries to
run your library where `node:fs` does not exist.

## Gotchas

**Symptom:** `Cannot find module 'test'` — or worse, a third-party module loads
where you expected the built-in test runner
**Cause:** `node:test`, `node:sea`, `node:sqlite` and `node:test/reporters` have
no bare alias. The bare name resolves through `node_modules`.
**Fix:** Always write the prefix for these four.

**Symptom:** A `node:`-prefixed import fails in a browser bundle or an edge
runtime
**Cause:** The target has no Node built-ins. The prefix made an existing problem
visible rather than causing it.
**Fix:** Guard the import behind a runtime check, or split the platform-specific
code behind a [conditional export](08-exports-map.md).

**Symptom:** `require('node:foo')` throws `ERR_UNKNOWN_BUILTIN_MODULE`
**Cause:** The prefix asserts "this is a built-in." A typo can no longer fall
through to a package with a similar name.
**Fix:** Check the spelling against `require('node:module').builtinModules`.

## Interview questions

**★ What does the `node:` prefix do?**
It marks the specifier as a Node built-in, so the loader returns it directly
instead of running the normal resolution algorithm. It makes the intent explicit,
removes the `node_modules` lookup, and produces a clear error if the name is not
actually a built-in.

**★ Can an npm package shadow `require('fs')`?**
No — core modules are resolved ahead of `node_modules`, so a package named `fs`
never wins. The genuine risk is the four prefix-only built-ins (`node:test`,
`node:sea`, `node:sqlite`, `node:test/reporters`): their bare names are *not*
core, so `require('test')` will happily load a package from npm.

**★ Should you rewrite existing `require('fs')` calls?**
In your own code, yes, as you touch it. Bare names for the long-standing built-ins
are not deprecated and still work, so mass-rewriting dependencies buys nothing and
costs a diff.

**Why might a bundler prefer prefixed imports?**
The prefix is an unambiguous signal that the specifier is a Node built-in, so the
bundler can externalise it or fail with a useful message instead of searching for
a package that does not exist.

---

← Prev: [CommonJS](02-commonjs.md) · Next → [CJS ↔ ESM interop](04-cjs-esm-interop.md)
