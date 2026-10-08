---
title: "A synchronous hook is two small contracts — resolve returns a url or calls next, load returns a format and a source or calls next — and every way of breaking them fails differently: the chain order, the format hint, the conditions array and the source types"
sidebar_label: "14b · Hook contracts"
sidebar_position: 14.1
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-10-08 on **Node 24.19.0** against the `Customization hooks` section of the Node.js [`module` docs (v24.x)](https://nodejs.org/docs/latest-v24.x/api/module.html), cross-checked against [v26.x](https://nodejs.org/docs/latest-v26.x/api/module.html). `module.registerHooks()` is `Stability: 1.2 - Release candidate` (since v24.13.1).
> Documentation-validated — **no sandbox run**: every hook below is written from the docs' signatures and was not executed. The `'text'` format-name collision is read from the Node source at the [`v24.19.0` tag](https://github.com/nodejs/node/blob/v24.19.0/lib/internal/modules/esm/assert.js) (`assert.js`, `load.js`, `loader.js`); `assert.js` was also compared at `v24.15.0`, `v24.20.0`, `v24.21.0`, `v26.0.0` and `v22.22.0`.

**[Page 14](14-node-module-api.md) shows a hook working. This page is the contract behind it: what each hook receives, what it must return, which returns the docs say are errors, and which mistakes the docs warn about but do not turn into errors. Skim it before writing a hook that will outlive a demo. Every contract rule is quoted from the docs; the code is written from those rules and not run; and where the docs are silent the page says so.**

## The `resolve` contract

`resolve(specifier, context, nextResolve)` runs for every `import` and `require`. The docs state its job and its inputs:

> *"The `resolve` hook chain is responsible for telling Node.js where to find and how to cache a given `import` statement or expression, or `require` call."*

| Input | Meaning |
|---|---|
| `specifier` | the string being resolved |
| `context.conditions` | export conditions of the relevant `package.json` |
| `context.importAttributes` | the import attributes on the import |
| `context.parentURL` | the importing module, or `undefined` for the entry point |
| `nextResolve(specifier, context?)` | the next hook, or Node's default after the last one; omitted context means defaults, provided context is merged with *"preference to the provided properties"* |

It returns `url` (*"The absolute URL to which this input resolves"*) and optionally `format`, `importAttributes` and `shortCircuit` (default `false`). Two forms cover nearly every resolve hook — defer with a changed argument, or answer and stop:

```js
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Change the specifier and add an export condition, then defer.
    if (specifier.includes('foo')) {
      return nextResolve(specifier.replace('foo', 'bar'), {
        ...context,
        conditions: [...context.conditions, 'another-condition'],
      });
    }

    // Skip default resolution and answer directly.
    if (specifier === 'special-module') {
      return { url: 'file:///path/to/special-module.mjs', shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});
```

The `format` a resolve hook returns is only a hint, and it carries a cost:

> *"If a format is specified, the `load` hook is ultimately responsible for providing the final `format` value (and it is free to ignore the hint provided by `resolve`); if `resolve` provides a `format`, a custom `load` hook is required even if only to pass the value to the Node.js default `load` hook."*

## The `load` contract

`load(url, context, nextLoad)` receives the URL the `resolve` chain produced, with `context.conditions`, `context.format` (the hint, if any) and `context.importAttributes`. It returns the three fields below.

| Return field | Meaning |
|---|---|
| `format` | one of the accepted final formats (table below) |
| `source` | what Node evaluates; the types accepted depend on `format` (next table) |
| `shortCircuit` | `true` to end the chain, as in `resolve` |

The final `format` must be one of these, and the accepted `source` depends on it:

| `format` | Loads | `source` accepted |
|---|---|---|
| `'module'` | an ES module | string, `ArrayBuffer` or `TypedArray` |
| `'commonjs'` | a CommonJS module | string, `ArrayBuffer`, `TypedArray`, `null` or `undefined` |
| `'json'` | a JSON file | string, `ArrayBuffer` or `TypedArray` |
| `'wasm'` | a WebAssembly module | `ArrayBuffer` or `TypedArray` |
| `'module-typescript'` | an ES module with TypeScript syntax | string, `ArrayBuffer` or `TypedArray` |
| `'commonjs-typescript'` | a CommonJS module with TypeScript syntax | string, `ArrayBuffer`, `TypedArray`, `null` or `undefined` |
| `'builtin'` | a Node.js builtin | `null` |
| `'addon'` | a Node.js addon | `null` |

For `'builtin'` the docs add: *"The value of `source` is ignored for format `'builtin'` because currently it is not possible to replace the value of a Node.js builtin (core) module."* And: *"If the source value of a text-based format (i.e., `'json'`, `'module'`) is not a string, it is converted to a string using `util.TextDecoder`."*

**A module with no file behind it.** Resolve and load can both answer and stop, so the URL never has to exist on disk:

```js
// virtual-hooks.mjs
import { registerHooks } from 'node:module';

const VIRTUAL = 'file:///virtual/build-info.mjs';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'virtual:build-info') {
      return { url: VIRTUAL, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === VIRTUAL) {
      return {
        format: 'module',
        source: 'export const builtAt = "2026-10-08";',
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});
```

```js
// app.mjs — run with: node --import ./virtual-hooks.mjs app.mjs
const { builtAt } = await import('virtual:build-info');
console.log(builtAt);
```

**Editing what the default loader found.** Call `nextLoad`, change `source`, return the rest as it came:

```js
function load(url, context, nextLoad) {
  const result = nextLoad(url, context);
  if (result.format !== 'module' || result.source == null) return result;
  const text = Buffer.from(result.source).toString('utf8');
  return { ...result, source: text.replace(/__BUILD_DATE__/g, '2026-10-08') };
}
```

`Buffer.from()` accepts a string, an `ArrayBuffer` or a `Uint8Array`, which covers every `source` type the table allows for `'module'`. The guard handles `commonjs`, whose `source` may be `null` or `undefined`.

**A file type Node does not know.** The default `nextLoad` needs a module type for the URL, so a custom extension throws unless you supply one. The docs say a placeholder is fine on the way in:

> *"The format optionally supplied by the `resolve` hook chain. This can be any string value as an input; input values do not need to conform to the list of acceptable return values described below."*

Not every string is free, though: the placeholder must not be a name the default loader already knows. In the `v24.19.0` source, `formatTypeMap` in `lib/internal/modules/esm/assert.js` contains `'text'`, mapped to the import attribute `type: 'text'`, and `defaultLoadSync()` ends in `validateAttributes(url, format, importAttributes)`. Passing `format: 'text'` to `nextLoad` therefore reaches the `default:` branch, and a plain `import` carries no `type` attribute, so it throws `ERR_IMPORT_ATTRIBUTE_MISSING`. `v24.20.0` has the same entry; `v24.15.0`, `v24.21.0`, `v26.0.0` and `v22.22.0` do not. Use a name nothing recognises:

```js
const TEXT = /\.txt$/;

function load(url, context, nextLoad) {
  if (TEXT.test(url)) {
    // 'txt-raw' is a made-up placeholder; 'text' is a real format name on Node 24.19.0
    const { source } = nextLoad(url, { ...context, format: 'txt-raw' });
    const text = Buffer.from(source).toString('utf8');
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${JSON.stringify(text)};`,
    };
  }
  return nextLoad(url, context);
}
```

This is the pattern in the docs' CoffeeScript example, which passes `format: 'coffee'` to read the raw source and then returns a format Node knows.

## Chaining: last in, first out

`registerHooks()` may be called any number of times, and each call adds to the front of the chain:

```js
import { registerHooks } from 'node:module';

const hook1 = {
  resolve(specifier, context, nextResolve) {
    console.log('hook1 sees', specifier);
    return nextResolve(specifier, context);
  },
};
const hook2 = {
  resolve(specifier, context, nextResolve) {
    console.log('hook2 sees', specifier);
    return nextResolve(specifier, context);
  },
};

registerHooks(hook1);
registerHooks(hook2);   // hook2 runs before hook1
```

The docs' order, for any hook type:

> *"Node.js default `resolve` ← `hook1.resolve` ← `hook2.resolve`"*

So the hook that should see a specifier **first** is the one registered **last**. Mixing in `register()` does not change that for the synchronous side: *"the synchronous hooks are always run first before the asynchronous hooks start running"* ([14c](14c-migrating-off-module-register.md)).

One rule about hooks that load other hooks: *"If a hook should be applied when loading other hook modules, the other hook modules should be loaded after the hook is registered."*

## Reach and lifetime

Hooks are not scoped to a block. The `registerHooks()` return value is the only handle:

> *"Remove the registered hooks so that they are no longer called. Hooks are otherwise retained for the lifetime of the running process."*

```js
import { registerHooks } from 'node:module';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier, context);
  },
});

await import('./needs-the-hook.mjs');
hooks.deregister();   // imports after this line no longer pass through the hook
```

Threads are the other boundary. The default is no inheritance, with one exception:

> *"Unlike the asynchronous hooks, the synchronous hooks are not inherited into child worker threads by default, though if the hooks are registered using a file preloaded by `--import` or `--require`, child worker threads can inherit the preloaded scripts via `process.execArgv` inheritance."*

## Gotchas

**Symptom:** A `resolve` hook returns a `format` and no `load` hook is registered
**Cause:** The docs require a custom `load` hook whenever `resolve` returns a `format`, and name no error for leaving it out. In the `v24.19.0` loader source the resolved `format` is placed in the load context and, with no `load` hook registered, that context goes straight to the default load; no failure is claimed here. The pass-through `load` is the documented contract, not a fix for an observed break.
**Fix:** Register a pass-through `load` next to the `resolve`:

```js
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'app:entry') {
      return { url: new URL('./entry.mjs', import.meta.url).href, format: 'module', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    return nextLoad(url, context);   // hands resolve's format hint to the default load
  },
});
```

**Symptom:** Two hooks fight, and the one registered second wins
**Cause:** Chains run last-in, first-out; the later `registerHooks()` call sees the specifier first and can short-circuit before the earlier hook runs.
**Fix:** Register in the reverse of the order you want to see them in: the hook that must run first goes last.

**Symptom:** Package resolution behaves differently once a resolve hook changes `conditions`
**Cause:** The docs: *"To guarantee default Node.js module specifier resolution behavior when calling `defaultResolve`, the `context.conditions` array passed to it must include all elements of the `context.conditions` array originally passed into the `resolve` hook."*
**Fix:** Extend, never replace:

```js
return nextResolve(specifier, {
  ...context,
  conditions: [...context.conditions, 'another-condition'],
});
```

**Symptom:** A `load` hook that edits the source has no effect
**Cause:** A spread placed after your edit overwrites it. The docs' own `load` example writes `{ source: source.replace(/foo/g, 'bar'), ...result }`; a later spread key replaces an earlier one, so, as written on 2026-10-08, it returns the original source.
**Fix:** Spread first, edit last, as in `{ ...result, source: text }` above.

**Symptom:** A `load` hook throws a `TypeError` when it calls string methods on `source`, or crashes on a CommonJS module
**Cause:** `source` from `nextLoad()` is not always a string: it can be an `ArrayBuffer` or typed array, and for `'commonjs'` the docs allow `null` or `undefined`.
**Fix:** Guard on `result.format` and `result.source == null`, and convert with `Buffer.from(result.source).toString('utf8')`, as in the edit example.

**Symptom:** `nextLoad` throws `ERR_UNKNOWN_FILE_EXTENSION` or `ERR_UNKNOWN_MODULE_FORMAT` for your custom extension
**Cause:** The docs: *"In the default `nextLoad`, if the module pointed to by `url` does not have explicit module type information, `context.format` is mandatory."* Those two errors are named in the docs' CoffeeScript example, for an undefined format and for one that is not a known format.
**Fix:** Pass a placeholder `format` on the way in and return a real one, as in the `.txt` example.

**Symptom:** `nextLoad` throws `ERR_IMPORT_ATTRIBUTE_MISSING` on Node 24.19.0 for a file type your hook handles, though the importer wrote a plain `import`
**Cause:** The placeholder `format` you passed to `nextLoad` is `'text'`, which `formatTypeMap` in the `v24.19.0` `lib/internal/modules/esm/assert.js` already maps to the import attribute `type: 'text'`. The docs' sentence that the input *"can be any string value"* does not mention built-in names.
**Fix:** Rename the placeholder to something Node does not know, as `'txt-raw'` in the `.txt` example.

**Symptom:** A hook keeps rewriting imports after you are done with it
**Cause:** Hooks live for the whole process unless removed.
**Fix:** Keep the handle and call `deregister()`, as above.

**Symptom:** Hooks apply on the main thread and not inside a `Worker`
**Cause:** Synchronous hooks are not inherited into workers by default.
**Fix:** Register from a preload file, `node --import ./register-hooks.mjs app.mjs`, so the `execArgv` inheritance the docs describe carries it into workers.

## Interview questions

**★ In what order do chained `registerHooks()` hooks run?**
Last registered, first run: `default` ← `hook1` ← `hook2` means `hook2` sees the specifier first, then `hook1`, then Node's default. A hook that wants to short-circuit has to be registered after the ones it should pre-empt, and one that must see everything first goes last.

**★ What happens when a resolve hook returns a `format`?**
It is a hint to `load`, not a final answer. The docs make the `load` hook responsible for the final `format` and require a custom `load` hook whenever `resolve` supplies one, even a pass-through that forwards the value to the default `load`. The docs name no failure when it is missing, and the `v24.19.0` loader source hands the hint to the default load either way, so treat the pass-through `load` as the documented contract rather than as a fix for an observed break.

**★ Why do the docs say `context.conditions` must be preserved?**
Because the conditions decide which branch of a package's `exports` map matches. Node passes the current conditions into every `resolve` hook, and the default resolver only behaves as it normally would if the array it receives contains all of them. A hook that wants an extra condition appends to the array and passes the result to `nextResolve`.

**How do you serve a module that has no file?**
Answer in both hooks. `resolve` returns a `url` with `shortCircuit: true`; `load` recognises that URL and returns `format`, `source` and `shortCircuit: true`. Because both end their chains, the default loader never runs; the docs say a `load` hook *"would allow a loader to potentially avoid reading files from disk"*. This is written from the docs and not run, so do not rely on the URL being unchecked elsewhere.

**Why does a placeholder `format: 'text'` fail in a `load` hook on Node 24.19.0?**
Because `'text'` is not a free name there. The default load checks the format it ends up with against the import attributes, and in the `v24.19.0` source `'text'` is a recognised format that expects `type: 'text'` on the import. A plain `import` carries none, so `nextLoad` throws `ERR_IMPORT_ATTRIBUTE_MISSING`. For a format name it does not recognise, the same function's source comment says *"Ignore attributes for module formats we don't recognize"*, which is why a made-up name such as `'txt-raw'` passes. The `v24.21.0` and `v26.0.0` sources have no `'text'` entry, so a hook that works there can still fail on 24.19.0.

**Why can a `load` hook crash on `source`?**
Because `source` is a string, an `ArrayBuffer` or a `Uint8Array` depending on the module, and for `'commonjs'` it may be `null` or `undefined`. Convert with `Buffer.from(source).toString('utf8')` after a null check.

**Do hooks registered with `registerHooks()` reach worker threads?**
Not by default. They are inherited only when registered from a file preloaded with `--import` or `--require`, because workers inherit those through `process.execArgv`.

**How do you remove a hook?**
`registerHooks()` returns an object with `deregister()`. Without it hooks last for the life of the process.

---

← Prev: [The node:module API](14-node-module-api.md) · Next → [Migrating off module.register()](14c-migrating-off-module-register.md)
