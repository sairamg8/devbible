---
title: "The two questions"
sidebar_label: "01 · The two questions"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Theory*
> (sections *Scripts and modules in JavaScript*, *TypeScript's job concerning
> modules*, *The module output format*, *Input module syntax*, *Module
> resolution*, *TypeScript imitates the host's module resolution, but with
> types*). Quotes are verbatim from that page. **No sandbox, no console block.**

Before either setting makes sense you need the model they operate inside. It is
small, and once you have it the rest of this topic is bookkeeping.

## What a module is, and what it is not

A JavaScript file is either a **script** or a **module**. The handbook draws the
line where it matters — at scope:

> Any system that solves this problem by giving files their own scope while still
> providing a way to make bits of code available to other files can be called a
> "module system." (It may sound obvious to say that each file in a module system
> is called a "module," but the term is often used to contrast with *script*
> files, which run outside a module system, in a global scope.)

This is not trivia. It is the reason a `.ts` file with no `import` and no
`export` behaves differently from one with them: no import/export means **script**,
which means its top-level declarations land in the global scope, which means a
`const name = "x"` in it can collide with the DOM's `name` and produce an error
you cannot explain. Phase 4 depends on the same distinction —
[`declare global` only works inside a module](../../phase-4-classes-declarations/06-global-augmentation.md).

## The three jobs

The handbook states TypeScript's responsibilities as a list, and it is worth
memorising because each of the three maps onto a different failure:

> Understand the **rules of the host** enough
>
> 1. to compile files into a valid **output module format**,
> 2. to ensure that imports in those **outputs** will **resolve successfully**, and
> 3. to know what **type** to assign to **imported names**.

| Job | Governed by | What it looks like when it goes wrong |
|---|---|---|
| 1 · Output format | `module` | Your code starts and immediately throws `Cannot use import statement outside a module`, or `exports is not defined` |
| 2 · Output resolution | `moduleResolution` | `ERR_MODULE_NOT_FOUND` at runtime, from a file that compiled cleanly |
| 3 · Types for imported names | `moduleResolution` | `TS2307`, or — worse — *the wrong types*, silently |

Note that **jobs 2 and 3 are both `moduleResolution`, and they are not the same
job.** The compiler resolves your import twice, conceptually: once to answer
"will this work at runtime?" and once to answer "what type is this?". They
usually land on different files — `./util` resolves to `util.ts` for types and
`util.js` for the runtime — and the whole design of `moduleResolution` is about
keeping those two answers consistent.

## The decoupling nobody expects

Here is the sentence that surprises people:

> It's important to note that the *input* module syntax seen in input source
> files is somewhat decoupled from the output module syntax emitted to JS files.

You write `import`. That does not mean the output says `import`. Under
`"module": "commonjs"` this input:

```ts
import { readFile } from "node:fs/promises";

export async function load(p: string) {
  return readFile(p, "utf8");
}
```

emits, in shape, this:

```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = load;
const promises_1 = require("node:fs/promises");
async function load(p) {
  return (0, promises_1.readFile)(p, "utf8");
}
```

The `import` became a `require`. The `export function` became a property
assignment on `exports`. Your source is ESM; your output is CommonJS; both are
correct. **`module` is the knob that chose that.**

📌 This is also why "should I use ESM or CommonJS?" is an ambiguous question. It
has two answers — one about what you *write*, one about what you *ship* — and
they are independent.

## The specifier is emitted as written

Now the second sentence, and this one is load-bearing for the entire phase:

> While the `module` compiler option can transform imports and exports in input
> files to different module formats in output files, the module *specifier* (the
> string `from` which you `import`, or pass to `require`) is emitted as-written.

Look again at the emitted CommonJS above. `"node:fs/promises"` came through
untouched. The statement was rewritten; **the string was not.**

This is the crack that every runtime module failure falls into. TypeScript
resolved `"./util"` against your source tree, found `src/util.ts`, gave you
perfect types — and then emitted `require("./util")` into `dist/`, where Node has
to resolve `"./util"` *again*, on its own terms, against `dist/util.js`. If those
two resolutions can disagree, they eventually will.

```text
  YOUR SOURCE                  TSC                     THE HOST
  ───────────                  ───                     ────────
  import { f }                 resolves "./util"       resolves "./util"
    from "./util"      ──►     via moduleResolution    via its OWN rules
                               → src/util.ts           → dist/util.js  ← must also work
                                    │                        ▲
                                    │ types                  │
                                    ▼                        │
                               emit per `module`  ───────────┘
                               (specifier copied verbatim)
```

The handbook's own summary of the design:

> This model makes it clear that for TypeScript, module resolution is mostly a
> matter of accurately modeling the host's module resolution algorithm between
> output files, with a little bit of remapping applied to find type information.

Read "**between output files**". TypeScript is not resolving your source tree for
its own convenience. It is simulating what the host will do to the *output*, and
then walking that answer back to a source file so it can give you a type.

## The one deliberate exception

There is exactly one commonly-used feature that breaks the as-written rule on
purpose, and it is the subject of **Phase 6 · 03 · Path aliases** *(not written
yet)*: `paths` teaches the compiler a mapping the host has never heard of. The
compiler resolves `@/lib/db`; the host receives `require("@/lib/db")` and has no
idea what that is. Everything people find confusing about path aliases follows
from that one fact, and you now have the model to see why before you meet it.

📌 TypeScript 5.7 added `rewriteRelativeImportExtensions`, whose description in
the compiler's option table is *"Rewrite '.ts', '.tsx', '.mts', and '.cts' file
extensions in relative import paths to their JavaScript equivalent in output
files."* — a second, much narrower exception, covered in
**Phase 6 · 06 · File extensions** *(not written yet)*.

## What each setting is actually choosing

With the model in place, both settings collapse into one sentence each.

**`module`** picks the shape of the emitted import/export statements — and, for
one family of values, picks it *per file* rather than for the whole program.
That family is `node16`, `node18`, `node20` and `nodenext`, and it is the only
family that does so; every other value forces one format across the entire
compilation.

**`moduleResolution`** picks the algorithm used to turn a specifier string into a
file on disk — which `node_modules` lookups are performed, whether extensions may
be omitted, whether `package.json` `"exports"` is honoured, and whether the
answer depends on how the importing file is loaded.

Everything else in this topic is the enumeration of those choices and the
consequences of getting them out of step.

## Gotchas

**A file with no `import`/`export` is a script, and you will not be told.**
*Symptom:* `TS2451: Cannot redeclare block-scoped variable 'name'` in a file that
declares `name` exactly once. *Cause:* the file is a script, so `const name` is a
global, and it collides with `lib.dom.d.ts`. *Fix:* add `export {}` at the
bottom, or set `moduleDetection: "force"` (chunk 05).

**"Compiles" and "runs" are different claims and `tsc` only makes the first.**
*Symptom:* CI is green, production throws on the first line of the entry point.
*Cause:* `moduleResolution` modelled a host you are not using. *Fix:* choose the
strategy that matches the loader (chunk 07) — and note that no amount of
type-checking will ever catch this, because the check passed.

**Reading the emitted JavaScript is a five-second diagnostic that almost nobody
runs.** *Symptom:* an argument about whether the build "is ESM". *Cause:*
everyone is reasoning from `tsconfig.json` instead of from `dist/`. *Fix:* open
one output file. If it says `require(`, it is CommonJS, and no configuration file
overrules the artefact.

**The specifier rule makes directory imports a runtime bug, not a compile bug.**
*Symptom:* `import { x } from "./models"` type-checks against `models/index.ts`
and then throws under Node ESM. *Cause:* the specifier was copied as-written and
Node's ESM resolver does not do directory-index lookup. *Fix:* write
`"./models/index.js"` — or use a resolution mode that models the ESM rules and
tells you at compile time (`TS2834`, chunk 06).

**Two different files can supply the types and the runtime value, and only one of
them is checked.** *Symptom:* the types describe a function that does not exist.
*Cause:* a package's `types` entry points at a `.d.ts` that has drifted from the
`.js` it claims to describe — TypeScript never reads the `.js`. *Fix:* nothing at
this layer; it is a reason to prefer packages whose types are generated from
source, and it is why `moduleResolution` honouring `"exports"` matters (chunk 03).

## Interview questions

**What is the difference between `module` and `moduleResolution`?**
`module` controls the *output* format — what the emitted import and export
statements look like. `moduleResolution` controls *lookup* — which file on disk a
specifier refers to, and therefore which types you get. One is about emit, the
other about resolution; they are set independently and can be inconsistent.

**TypeScript compiled my code with no errors and Node throws
`ERR_MODULE_NOT_FOUND`. How is that possible?**
Because the module specifier is emitted as written. TypeScript resolved the
string against the source tree using its own configured algorithm; Node resolves
the same string again, in `dist/`, using its own. If the configured algorithm
does not model Node's — extensionless relative imports being the classic case —
the compile succeeds and the load fails. It is not a bug; it is the compiler
answering a different question than the runtime asked.

**Does `"module": "commonjs"` mean I have to write `require`?**
No. Input syntax and output syntax are decoupled. You write ESM `import`/`export`
in the source and the compiler emits `require`/`exports`. The `module` setting
chooses the output; it does not constrain what you type, except under the
`node16`–`nodenext` family where a file's detected format restricts what it may
contain.

**Why does TypeScript need to know about my runtime at all? Isn't it just a type
checker?**
Because two of its three module-related jobs are about the output, not the types:
producing a valid output format, and ensuring the *output's* imports resolve.
Both depend on host behaviour. Only the third — assigning types to imported
names — is pure type checking, and even that depends on resolution to find the
declaration file.

**What is a "script" in TypeScript's terminology, and how do you turn one into a
module?**
A file with no top-level `import` or `export` — its declarations go into the
global scope. Add any import or export (`export {}` suffices) to make it a
module, or set `moduleDetection: "force"` to treat every non-declaration file as
a module regardless.

**If `paths` breaks the "specifier emitted as written" rule, why does anything
work?**
Because something else re-implements the mapping at runtime: a bundler that
applies the same alias, a `package.json` `"imports"` map that Node understands
natively, or a loader hook. `paths` on its own is a compile-time-only fiction —
the compiler will resolve it and the host will not.

**How would you prove, in thirty seconds, whether a build emits ESM or CommonJS?**
Open an emitted file. `require(` and `exports.` mean CommonJS; a top-level
`import`/`export` statement means ESM. The artefact is authoritative; the config
is only the intent.

---

← [Topic index](./README.md) · Next → [02 · Every `module` value](./02-every-module-value.md)
