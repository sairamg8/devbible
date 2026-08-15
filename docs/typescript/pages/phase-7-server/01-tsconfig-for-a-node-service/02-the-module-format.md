---
title: "Decision 2 — the module format"
sidebar_label: "02 · The module format"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Modules → Reference*,
> the `node16`/`node18`/`nodenext` section — implied options, format detection,
> the resolution differences between `import` and `require`, and the
> `require(esm)` comparison table). `TS2834`, `TS2835`, `TS1471`, `TS1479`,
> `TS2792` and `TS6280` and their exact `{0}` message text were read out of the
> **compiler's own diagnostic table** — the strings compiled into the
> **TypeScript 7.0.2** native binary, with codes from the numbered table in the
> **5.9.3** JavaScript build. **No sandbox, no console block.**

[Chunk 01](./01-who-compiles.md) settled who produces the JavaScript. This chunk
settles the other decision, and it is the one with the larger blast radius:
**what module format is each file?**

Set `"module": "nodenext"` and stop thinking about it. The handbook is unusually
blunt:

> Because they are the only `module` options that reflect the complexities of
> Node.js's dual module system, they are the **only correct `module` options**
> for all apps and libraries that are intended to run in Node.js v12 or later,
> whether they use ES modules or not.

Read the last clause twice. **`nodenext` is correct for a CommonJS project too.**
It is not the "ESM setting" — it is the "obey Node" setting.

## What `nodenext` implies

The handbook lists these as implied *and enforced* — you cannot contradict them:

| Option | Implied by `module: nodenext` |
|---|---|
| `moduleResolution` | `nodenext` (implied **and enforced**) |
| `target` | `esnext` |
| `esModuleInterop` | on |

For comparison, `node16` and `node18` imply `moduleResolution: node16` and
`target: es2022`.

📌 "Implied and enforced" is stronger than "defaulted". Writing
`"module": "nodenext", "moduleResolution": "bundler"` is not a configuration —
it is an error. This is worth knowing because plenty of published base configs
still pair `nodenext` with an explicit `node16`, which is redundant rather than
wrong, and reads as if it were meaningful.

## Format is detected per file, not set globally

This is the mechanism that makes `nodenext` different from every other `module`
value: it **emits CommonJS or ESM per file**, using the same rules Node uses.

| Extension | Format |
|---|---|
| `.mts` / `.mjs` / `.d.mts` | Always ES module |
| `.cts` / `.cjs` / `.d.cts` | Always CommonJS |
| `.ts` / `.tsx` / `.js` / `.d.ts` | Whatever the nearest ancestor `package.json` says — ESM if it has `"type": "module"`, CommonJS otherwise |

So the single most consequential line in a TypeScript service is not in
`tsconfig.json` at all. It is `"type": "module"` in `package.json`.

The compiler will even tell you this when it thinks you meant the other thing:

```text
To convert this file to an ECMAScript module, change its file extension to '.mts'
or create a local package.json file with `{ "type": "module" }`.
```

⚠️ **"Nearest ancestor" is literal.** A `package.json` inside a subdirectory
overrides the root one for everything beneath it. That is a legitimate technique
— dropping a one-line `{"type": "commonjs"}` into a directory of legacy scripts
inside an ESM project — and it is also a way to be very confused about why one
folder behaves differently.

## The consequence people hit first: extensions

Under ESM resolution, extensionless relative imports and directory modules are
**gone**. Under `require`, they still work. Same project, same config, different
rules per file:

```ts
// in an ESM-detected file
import './router';          // ✗ extensionless
import './router.js';       // ✓ — yes, .js, pointing at router.ts
import './handlers';        // ✗ directory modules are not supported
```

```text
error TS2835: Relative import paths need explicit file extensions in ECMAScript
imports when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './router.js'?
```

There is a sibling, `TS2834`, carrying the same first sentence and *"Consider
adding an extension to the import path."* — emitted when the compiler cannot
guess the intended file.

**Why `.js` when the file is `router.ts`?** Because the import specifier is a
runtime string that Node resolves *after* your types are gone, so it must name
the file that will exist then. This is the single most-asked question about
`nodenext` and the answer is the oldest one in the language:
[types are erased](../../phase-0-how-typescript-runs/02-erasure.md).

On Path B, where Node runs the `.ts` file itself, the file that exists at runtime
*is* `router.ts` — so there you write `'./router.ts'`, with
`allowImportingTsExtensions` ([chunk 01](./01-who-compiles.md)).

📌 The rule that makes both cases obvious: **the specifier names the file that
will exist when the import runs.** Everything else follows.

## `require` of an ESM file — the real difference between the three modes

| | node16 | node18 | nodenext |
|---|---|---|---|
| `target` | `es2022` | `es2022` | `esnext` |
| `moduleResolution` | `node16` | `node16` | `nodenext` |
| Import assertions | ✗ | ✓ | ✗ |
| Import attributes | ✗ | ✓ | ✓ |
| JSON imports | no restrictions | needs `type: "json"` | needs `type: "json"` |
| `require(esm)` | ✗ | ✗ | ✓ |

`require(esm)` landed in Node v22.12.0 and only `nodenext` models it. Under
`node16` you get:

```text
error TS1471: Module 'x' cannot be imported using this construct. The specifier
only resolves to an ES module, which cannot be imported with 'require'. Use an
ECMAScript import instead.
```

⚠️ The handbook names the limit, and it is a sharp one: `require()` of an ES
module **throws at runtime if that module uses top-level `await`**, and
**TypeScript does not detect this at compile time**. A green build, a runtime
crash — the exact shape this whole phase is about.

The reverse direction has its own rule. An ES module importing a CommonJS one
gets `module.exports` as the default import, and TypeScript will *optimistically*
offer named properties it found by static analysis — which is an inference, not a
guarantee, and one of the few places the compiler knowingly guesses.

## Gotchas

**Symptom:** every relative import in the service is suddenly an error after
adding `"type": "module"` to `package.json`.
**Cause:** the detected format of every `.ts` file beneath it flipped from
CommonJS to ESM, and ESM resolution has no extensionless paths and no directory
modules. Nothing in `tsconfig.json` changed.
**Fix:** add `.js` extensions to relative imports. This is a real code change
across the whole tree, not a config toggle — budget for it, and do it in its own
commit.

**Symptom:** `TS1479` — *"The current file is a CommonJS module whose imports
will produce 'require' calls; however, the referenced file is an ECMAScript
module and cannot be imported with 'require'. Consider writing a dynamic
'import()' call instead."*
**Cause:** a CommonJS-detected file importing an ESM-only dependency — very
common as libraries go ESM-only.
**Fix:** flip the importing file to ESM, or use `await import()`, which CommonJS
*can* do. Under `nodenext` on Node ≥ 22.12 the plain `require` also works, which
is why bumping `module` sometimes makes this error vanish with no code change.

**Symptom:** top-level `await` is rejected in a file that plainly is a module.
**Cause:** `TS1309` — *"The current file is a CommonJS module and cannot use
'await' at the top level."* The file's *detected* format is CommonJS, whatever
its contents look like.
**Fix:** `"type": "module"`, or rename to `.mts`. And remember the mirror image:
an ESM file with top-level `await` cannot be `require`d, silently, at runtime.

**Symptom:** a dependency's types resolve in the editor but not in the build, or
the reverse.
**Cause:** almost always a `moduleResolution` mismatch between `tsconfig.json`
and the project the editor actually loaded. The compiler usually says so:

```text
error TS6280: There are types at '{0}', but this result could not be resolved
under your current 'moduleResolution' setting. Consider updating to 'node16',
'nodenext', or 'bundler'.
```

**Fix:** one `tsconfig.json` per program, `moduleResolution` set explicitly, and
`TS2792` read as the instruction it literally is:

```text
error TS2792: Cannot find module '{0}'. Did you mean to set the
'moduleResolution' option to 'nodenext', or to add aliases to the 'paths' option?
```

## Interview questions

**Why is `"module": "nodenext"` the right setting for a project that uses
CommonJS?**
Because `nodenext` is not "use ESM" — it is "detect each file's format the way
Node does, and emit that". A CommonJS project under `nodenext` emits CommonJS.
The handbook calls node16/node18/nodenext the only correct options for anything
running on Node v12+, *whether or not* it uses ES modules, precisely because they
are the only ones that model the dual system instead of overriding it.

**You changed nothing but `package.json`, and 200 imports broke. What happened?**
`"type": "module"` was added. That flips the detected format of every `.ts` file
beneath it from CommonJS to ESM, and ESM resolution supports neither
extensionless relative paths nor directory modules. The errors are
`TS2834`/`TS2835`.

**Why does an import in a `.ts` file point at a `.js` file?**
Because the specifier is a runtime string resolved after erasure, so it must name
the file that exists at runtime. The exception is the type-stripping path, where
the `.ts` file *is* the runtime file — there you write `.ts` and enable
`allowImportingTsExtensions`.

**Give a case where the build is green and the process still fails to start.**
`require()` of an ES module that uses top-level `await`. `nodenext` models
`require(esm)` as legal, so the compiler accepts it, but Node throws at runtime
and the handbook states plainly that TypeScript does not detect it. It is the
cleanest small example of the phase's thesis: a type checker is not a runtime
guarantee.

---

← [01 · Who compiles](./01-who-compiles.md) · Next → [03 · `target`, `lib` and types](./03-target-lib-and-types.md)
