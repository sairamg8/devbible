---
title: "webpack's require(), module.exports and __dirname Work in Application Source Because webpack Rewrites Them — Vite's Dev Server Serves Native ESM and None of the Three Exist There"
sidebar_label: "01j · CommonJS in app source"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. Node.js CommonJS module scope — [Modules: CommonJS modules § The Module Wrapper](https://nodejs.org/api/modules.html#the-module-wrapper). No Vite documentation page states this negatively ("`__dirname` does not exist in Vite"); the behaviour follows from Vite serving native ESM in the browser and via `<script type="module">`, where these CommonJS-wrapper-scoped names are not defined by the language. **No sandbox run, no timings.** Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · webpack 5.110.3**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ CommonJS Idioms in Application Source

**`require()`, `module.exports`, `__dirname` and `__filename` are not JavaScript language
features — they are variables webpack (and Node's CommonJS loader) inject into every module
by wrapping it in a function before running it.** A dev server that serves native ESM has no
such wrapper, so none of the four exist in the browser under Vite, and code that used them
directly in application source — as opposed to inside a build-time config file, which is a
separate story — needs converting, not configuring around.

> *"Node.js wraps module code in a function… This ensures that top-level variables (defined
> with `var`, `const`, or `let`) are scoped to the module rather than the global object… The
> parameters `exports`, `require`, `module`, `__filename`, `__dirname` are the same as the
> corresponding module scope variable."* — [Modules: CommonJS modules](https://nodejs.org/api/modules.html#the-module-wrapper)

That wrapper is what supplies the four names in Node, and it is what webpack's own CJS
handling emulated for browser code. Vite's dev server does none of this: `<script
type="module">` runs your code exactly as ESM defines it, with no wrapper, so a reference to
`require` in application source is a plain `ReferenceError`, not a webpack-specific quirk.

## The four idioms, translated

```javascript
// ❌ require() of a local module — works under webpack, ReferenceError under Vite
const { formatDate } = require('./utils/date');

// ✅ static import — the mechanical translation for a top-level require
import { formatDate } from './utils/date';
```

```javascript
// ❌ conditional / lazy require — a genuinely harder case, because
// dynamic import() is ASYNC and require() was SYNCHRONOUS
if (shouldUseFeature) {
  const feature = require('./feature');
  feature.run();
}

// ✅ the mechanical translation changes the calling code's shape
if (shouldUseFeature) {
  const feature = await import('./feature');
  feature.run();
}
```

```javascript
// ❌ module.exports — CommonJS's export mechanism
module.exports = { formatDate, parseDate };
module.exports.default = formatDate;

// ✅ named / default exports — ESM's
export { formatDate, parseDate };
export default formatDate;
```

```javascript
// ❌ __dirname / __filename — supplied by the CJS wrapper, absent in ESM
const configPath = path.join(__dirname, 'config.json');

// ✅ import.meta.dirname / import.meta.filename — Node 20.11+ and 21.2+,
// well inside this track's pinned Node range (^20.19.0 || >=22.12.0)
const configPath = path.join(import.meta.dirname, 'config.json');
```

`import.meta.url` is the more portable predecessor of `import.meta.dirname` and works
anywhere ESM runs, including the browser (with a caveat covered in the Vite-8-upgrade
chunks later in this topic, for UMD/IIFE builds specifically) — `new
URL('./config.json', import.meta.url)` is the pattern to reach for when a plain filesystem
path is not actually what you need.

## Why this rarely appears in your own recently-written code, and always in a dependency

A codebase's own application source, if it has been running under webpack's default modern
tooling (any recent Create React App, Next.js, or a TypeScript setup using `esModuleInterop`)
is almost always already written as ESM `import`/`export` — webpack transpiled it down, but
the source itself never used `require()`. The idioms in this chunk show up in two places
that a naive migration misses:

- **Older files nobody has touched**, often utility scripts or a config-loading module
  written before the rest of the codebase moved to ESM syntax, that kept working because
  webpack accepted CJS and ESM interchangeably in the same graph.
- **Third-party dependencies that assume Node**, particularly ones written for a Node script
  or CLI first and only later pressed into service as a browser dependency — these are
  usually not in "application source" you can edit, and the fix is different: see the
  Node-builtins-and-dead-ends chunk later in this topic, since a `require()` call *inside a
  dependency* is a pre-bundling and externalisation question, not a rewrite-your-code one.

## The one place `require()` and `__dirname` are still completely normal

`vite.config.ts` itself, if it is written as CommonJS (`.cjs`, or a `package.json` with no
`"type": "module"`), runs under plain Node before Vite's dev server exists at all — `require`
and `__dirname` work there exactly as they always did, because nothing about Vite changes how
Node loads its own config file. The failure mode this causes is the opposite of the one this
chunk is about: code that works fine in `vite.config.ts` gets copy-pasted into application
source under the mistaken belief that Vite "supports" `require()` because the config file
just did.

---

## Gotchas

**★ Symptom: `Uncaught ReferenceError: require is not defined` in the browser console, and the app worked identically under webpack.** Cause: a `require()` call survived in application source — often inside an old utility module nobody has touched since before the codebase adopted ESM syntax elsewhere. Fix: convert to a static `import` (top-level) or `await import()` (conditional/lazy) at that specific call site; there is no global shim that makes `require()` exist for arbitrary application code in the browser.

**★ Symptom: `__dirname is not defined` appears only when a specific file is imported, not from the entry point.** Cause: the same wrapper-scoped variable, further down the module graph than the first place anyone checked. Fix: `path.join(import.meta.dirname, ...)` if the code is Node-only utility code that happens to be bundled anyway (a build script imported for its constants, for instance); if the code genuinely needs to run in the browser, `__dirname`-based filesystem logic is itself the bug, and the fix is removing the dependency on a real filesystem path rather than polyfilling one.

**★ Symptom: converting `module.exports = { a, b }` to `export { a, b }` breaks a consumer that did `const { a, b } = require('./thing')` elsewhere in the same, still-partially-CJS codebase.** Cause: mixed CJS/ESM in one codebase during a migration is expected and temporary, but `require()`ing a file that has been converted to pure ESM `export` syntax does not work the way `require()`ing old-style `module.exports` did — Node's CJS loader cannot synchronously load an ES module. Fix: convert consumers alongside their dependencies, file by file, rather than converting exports and imports independently; this is one of the few places in a migration where order matters within application source, not just build config.

**★ Symptom: `require()`-ing a JSON file (`const config = require('./config.json')`) needs replacing and the obvious `import config from './config.json'` triggers a bundler warning about import assertions.** Cause: JSON module imports have their own evolving syntax in the JS specification, and Vite's own support for a bare `import config from './config.json'` (no assertion needed) is a Vite convenience feature, not yet universal ESM behaviour outside a bundler. Fix: a plain default import of a `.json` file works under Vite without an import assertion — this is one CommonJS idiom that ports to something *simpler* than the strict ESM spec would otherwise require, and no bundler-specific plugin is needed for it.

---

## Interview questions

**★ Why does `require()` fail under Vite but often keep working, unmodified, in the exact same repository's `vite.config.ts`?**
Because the two files run in different environments with different module systems. `vite.config.ts` is loaded by plain Node, as CommonJS, before any dev server exists — Node's own CJS loader supplies `require`, `module.exports`, `__dirname`, exactly as it always has, and nothing about Vite touches that. Application source, in contrast, is served to the browser (or bundled for one) as native ESM via `<script type="module">`, a language mode that has never defined `require` as a global; there is no wrapper function supplying it, because ESM's whole design is that imports are declarative and static rather than a runtime function call. Confusing the two is a common early mistake: seeing `require()` work in the config file is not evidence that it will work anywhere else in the project.

**★ Converting a synchronous `require()` inside an `if` block to `import()` changes the calling function from synchronous to asynchronous. Is that always a safe mechanical translation?**
No, and it is the one case in this chunk that is not purely mechanical. `require()` returns
the module immediately; `import()` returns a Promise, so every caller up the chain that
expected the conditional branch to finish synchronously — a function that returned a value
computed from the lazily-required module, for instance — now needs to become `async` too, or
the code needs restructuring so the await happens at a point where blocking is acceptable.
The syntax swap is one line; verifying nothing upstream assumed synchronicity is the actual
work, and it is exactly the kind of thing that passes a type checker (if the function was
already loosely typed) and fails at runtime instead.

**★ A dependency (not your own source) calls `require()` internally and still works fine under Vite in dev. Why doesn't the same "require is not defined" error apply to it?**
Because dependencies go through **dependency pre-bundling**, a separate pipeline from your
application source that specifically exists to convert CommonJS dependencies into ESM before
the browser ever sees them — Vite scans `node_modules`, and CJS packages get this treatment
automatically. Your own application source is not pre-bundled the same way; it is served
directly, so a `require()` call there hits the browser's real module system with nothing in
between. This is why "it's just a dependency, Vite handles CJS" is true for `node_modules`
and false for a `require()` left in `src/` — they are handled by two different mechanisms,
and only one of them exists for code you wrote yourself.

---

← [01i · require.context → import.meta.glob](01i-require-context-to-import-meta-glob.md) · [Vite overview](../../README.md) · Next → [01k · loaders, define & mode](01k-loaders-define-and-mode.md)
