---
title: "The transform flag has an end date, so moving to erasable-only syntax is a Node 24 task you can finish on your own schedule — make tsc fail first, rewrite the four constructs, and hunt the flag out of NODE_OPTIONS"
sidebar_label: "12b · Erasable-only before Node 26"
sidebar_position: 12.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-10-08 on **Node 24.19.0** (the page's target) against the Node.js `typescript` docs for [v24.x](https://nodejs.org/docs/latest-v24.x/api/typescript.html) and [v26.x](https://nodejs.org/docs/latest-v26.x/api/typescript.html), the [v26.x `module` docs](https://nodejs.org/docs/latest-v26.x/api/module.html), the [v24.x CLI docs](https://nodejs.org/docs/latest-v24.x/api/cli.html), [CHANGELOG_V26.md](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V26.md), the v26.0.0 option-parser source ([`src/node_options-inl.h`](https://github.com/nodejs/node/blob/v26.0.0/src/node_options-inl.h), [`src/node.cc`](https://github.com/nodejs/node/blob/v26.0.0/src/node.cc)) and [process exit codes](https://nodejs.org/docs/latest-v26.x/api/process.html#exit-codes), the [Release schedule](https://github.com/nodejs/Release/blob/main/schedule.json) and the [TypeScript `erasableSyntaxOnly` reference](https://www.typescriptlang.org/tsconfig/#erasableSyntaxOnly).
> Documentation-validated — **no sandbox run**: the code below is written from the docs and was not executed.

**`--experimental-transform-types` works on Node 24 and is gone in Node 26.0.0, so any codebase that needs it has a deadline it can pick for itself. The migration is mechanical: make `tsc` reject non-erasable syntax in CI, rewrite each construct it flags, then delete the flag from every place a process can inherit it. Doing that on Node 24 turns the Node 26 upgrade into a version bump instead of a rewrite.**

This continues [page 12](12-typescript-natively.md), which teaches type stripping and why the flag exists. This page is only about getting off it.

## What was removed, and when

| Release | Change | Where it is stated |
|---|---|---|
| v22.7.0 | `--experimental-transform-types` added | `typescript.md` history |
| v24.12.0 | type stripping becomes Stable; the flag does not | `typescript.md` history; the v24.x CLI docs still mark the flag `Stability: 1.2 - Release candidate` |
| v26.0.0 | flag **removed**; `module.stripTypeScriptTypes()` loses its `transform` and `sourceMap` options in the same PR, [#61803](https://github.com/nodejs/node/pull/61803) | `typescript.md` and `module.md` history; CHANGELOG_V26.md |

The two history entries, verbatim:

> *"Removed `--experimental-transform-types` flag."*

> *"Removed `transform` and `sourceMap` options."*

The second is the one that surprises tooling: code that calls `stripTypeScriptTypes(code, { mode: 'transform' })` on 24 is calling an option 26 no longer documents. The 26 docs list one `mode` value, `'strip'`.

Node 24's description of the opt-in, which is the sentence that stops being true:

> *"To enable the transformation of non erasable TypeScript syntax, which requires JavaScript code generation, such as `enum` declarations, parameter properties use the flag `--experimental-transform-types`."*

Node 26's `Type stripping` section has no such sentence, and its `TypeScript features` paragraph ends at "will error" (compare the two versions on page 12).

**The timeline gives you room.** The Release schedule lists `v26.lts` as 2026-10-28 and `v24.end` as 2028-04-30. Nothing forces the move while you stay on 24; the flag keeps working there. The deadline is the day you adopt 26 — pick the day you do this work instead.

## Step 1 — make `tsc` fail first

Node cannot warn you about syntax it will not run until it runs it. `tsc` can, at check time, in CI, before a deploy. Node's docs recommend this baseline (TypeScript 5.8 or newer; `noEmit` is optional and is for when you only execute `.ts` files):

```json
{
  "compilerOptions": {
    "noEmit": true, "target": "esnext", "module": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true, "verbatimModuleSyntax": true
  }
}
```

The TypeScript reference ties the flag to Node by name, then says what it covers:

> *"The `--erasableSyntaxOnly` flag will cause TypeScript to error on most TypeScript-specific constructs that have runtime behavior."*

> *"Typically, you will want to combine this flag with the `--verbatimModuleSyntax`, which ensures that a module contains the appropriate import syntax, and that import elision does not take place."*

Note **"most"**. A green `tsc` is strong evidence, not proof; the [gotchas](#gotchas) below cover the gap.

## Step 2 — rewrite each construct

Node's docs name four constructs that need transformation: *"`Enum` declarations"*, *"`namespace` with runtime code"*, *"parameter properties"* and *"import aliases"*. `enum` is on [page 12](12-typescript-natively.md) (a `const` object plus a derived type). The other three:

```ts
// parameter properties — instead of: constructor(private host: string, private port: number) {}
class Listener {
  private host: string;
  private port: number;
  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }
}
```

```ts
// namespace with runtime code — instead of: namespace Validators { export const isPort = ... }
export const Validators = {
  isPort: (n: number): boolean => Number.isInteger(n) && n > 0 && n < 65536,
};
```

```ts
// import alias — instead of: import fs = require('node:fs');
import fs from 'node:fs';          // in an ES module ("type": "module")
const fsCjs = require('node:fs');  // in a CommonJS file
```

The TypeScript reference's list is longer than Node's. Besides the four above it names *"Non-ECMAScript `import =` and `export =` assignments"* and *"`<prefix>`-style type assertions"*. Follow `tsc` here, not the shorter list: `const n = <number>x` becomes `const n = x as number`.

## Step 3 — hunt the flag

The flag is on the v24.x list of options `NODE_OPTIONS` accepts, so a source search of `src/` is not enough:

```bash
git grep -n -e 'experimental-transform-types'
printenv NODE_OPTIONS
```

Then look where `git grep` and your shell cannot: a Dockerfile `ENV NODE_OPTIONS=...`, a systemd `Environment=` line, a CI variable, a PaaS dashboard. Those are the places a flag outlives the commit that added it.

What you give up by dropping it: on 24, with the flag on, the docs say *"source-maps are enabled by default"*. In strip-only mode they are not generated, and the docs say why that is fine:

> *"Since inline types are replaced by whitespace, source maps are unnecessary for correct line numbers in stack traces; and Node.js does not generate them."*

## Gotchas

**★ Symptom: after the move to Node 26 the process refuses to start, with `bad option: --experimental-transform-types` when the flag is on the command line or `--experimental-transform-types is not allowed in NODE_OPTIONS` when it is in the environment.** Cause: the flag was removed in v26.0.0 and still rides in a start command, `NODE_OPTIONS`, a Dockerfile or a `package.json` script. Node 26 does not ignore it. The v26.0.0 `src/node_options.cc` no longer declares the option, so the parser treats it as unknown: on the command line it is passed on to V8, left over, and reported as `bad option: …` (`src/node_options-inl.h`, `src/node.cc`), and in `NODE_OPTIONS` it is rejected as `… is not allowed in NODE_OPTIONS` (`src/node_options-inl.h`). Both return exit code 9, which the process docs define as *"Invalid Argument: Either an unknown option was specified, or an option requiring a value was provided without a value."* Those strings are Node's generic unknown-option messages, read from the v26.0.0 source rather than written for this flag, and the process never starts, so files that were already erasable-only stop running too. Fix: find the flag before the upgrade, with the `git grep` and `printenv` commands above, and delete it together with the syntax that needed it.

**★ Symptom: `tsc` is green and `node server.ts` throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`.** Cause: `erasableSyntaxOnly` is not set, or TypeScript is older than the 5.8 Node's docs recommend, or the construct is one of the *"most"* the flag does not cover. Fix: set the flag as in Step 1, and have CI execute the entry point or the test suite under `node` at least once — `tsc` is the guardrail, running the file is the proof. Do not substitute `node --check`: the docs say *"TypeScript syntax is unsupported in the REPL, `--check`, and `inspect`."*

**Symptom: one `namespace` is fine and the next throws.** Cause: only a namespace with runtime code needs transformation. The docs' pair:

```ts
// works: the namespace exports only a type
namespace TypeOnly {
   export type A = string;
}

// ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: the namespace exports a value
namespace A {
   export let x = 1
}
```

Fix: a type-only namespace may stay; rewrite the second as exported values, as in Step 2.

**Symptom: an `import` of a type works under `tsc` and fails at runtime.** Cause: without the `type` keyword Node treats the import as a value import. Fix: `import type { T } from './m.ts'` and `import { fn, type T } from './m.ts'`, which `verbatimModuleSyntax` enforces. The docs: *"Without the `type` keyword, Node.js will treat the import as a value import, which will result in a runtime error."*

**Symptom: a build script calling `stripTypeScriptTypes(code, { mode: 'transform' })` breaks on 26.** Cause: the `transform` and `sourceMap` options were removed in v26.0.0. Fix: use `'strip'` and erasable source, or compile with `tsc` or a third-party transformer for code that needs enum or namespace output.

## Interview questions

**★ What changed in Node 26.0.0 for TypeScript?**
`--experimental-transform-types` was removed (#61803), and `module.stripTypeScriptTypes()` lost its `transform` and `sourceMap` options in the same change. Type stripping itself — erasable syntax only, types replaced by whitespace — is unchanged and still Stability 2 – Stable. After 26.0.0, `enum`, runtime `namespace`, parameter properties and import aliases error when Node runs the file.

**★ How do you make the Node 24 to 26 upgrade a non-event for a TypeScript codebase?**
Do it on 24, where nothing is forced. Turn on `erasableSyntaxOnly` and `verbatimModuleSyntax` so `tsc --noEmit` fails on every construct Node 26 will reject. Rewrite what it flags — `const` objects for enums, field assignment for parameter properties, exported values for runtime namespaces, ES `import` for aliases. Grep the repository and the deployment config for the flag, including `NODE_OPTIONS`. By the time you change the runtime, nothing in the code depends on the removed path.

**★ Why is `erasableSyntaxOnly` a guardrail and not a guarantee?**
The TypeScript reference says it errors on *"most"* constructs with runtime behaviour, and Node's own list of unsupported constructs is shorter than TypeScript's. It can also only be as current as the TypeScript version you run: Node recommends 5.8 or newer. The proof is executing the code under `node`, which a test run already does.

**What do you do if you genuinely need `enum` or decorators on Node 26?**
Not the built-in path. Node's docs: *"For full support of all of TypeScript's syntax and features, including using any version of TypeScript, use a third-party package."* Their example is `tsx` (`node --import=tsx your-file.ts`). The other option is to compile with `tsc`, which is the build step page 12 says remains for such codebases.

**Why does the TypeScript compiler have a flag named after one runtime's limitation?**
Because the limitation became common. The reference says Node.js *"supports running TypeScript files directly as of v23.6; however, only TypeScript-specific syntax that does not have runtime semantics are supported under this mode"*, and that tools such as ts-blank-space and Amaro, the library Node uses, *"have the same limitations"*. The flag lets the compiler enforce at check time what those tools can only report at run time.

**Does dropping the flag change stack traces?**
Not their line numbers. The docs say inline types are replaced by whitespace, so positions are preserved and source maps are unnecessary; Node does not generate them in strip-only mode. With the flag on, the docs say source maps are enabled by default — that default goes away with the flag.

---

← Prev: [TypeScript without a build step](12-typescript-natively.md) · Next → [Publishing a package](13-publishing.md)
