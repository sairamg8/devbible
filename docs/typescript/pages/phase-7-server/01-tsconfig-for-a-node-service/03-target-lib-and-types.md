---
title: "target, lib and where the types come from"
sidebar_label: "03 · target, lib and types"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **`tsconfig` reference** on typescriptlang.org
> (`target`, `lib`, `types`, `typeRoots`, `skipLibCheck`, `include`, `exclude`)
> and the **`@tsconfig/bases`** repository, whose `node22.json` base is quoted in
> full. `TS2580`, `TS2591`, `TS2688`, `TS6278` and `TS18003` and their exact
> `{0}` message text were read out of the **compiler's own diagnostic table** —
> the strings compiled into the **TypeScript 7.0.2** binary, with codes taken
> from the numbered table in the **5.9.3** build. **No sandbox, no console
> block.**

[Chunk 01](./01-who-compiles.md) settled who compiles; [chunk 02](./02-the-module-format.md)
settled what module format each file is. Those are the decisions with
consequences. What is left is
three questions that people habitually get wrong in the *same* three ways:

1. **How new is the JavaScript I am allowed to write?** — `target`
2. **What globals and built-ins exist?** — `lib`, and `@types/node`
3. **Which `.d.ts` files does the compiler load, and does it check them?** —
   `types`, `typeRoots`, `skipLibCheck`

## `target` — and why "es5" is the tell of a copied config

`target` sets the JavaScript language version of the **emitted** code, and
nothing else about the runtime.

⚠️ **The documented default is `ES5`.** That is not a typo and it is not
version-appropriate advice — it is a two-decade-old default kept for
compatibility, and it drags a second default with it: with `target: es5`,
`module` defaults to `CommonJS` and `lib` defaults to `["dom", "es5",
"scripthost"]`. A config that sets nothing is therefore configured for a 2013
browser, on a server.

You will almost never write `target` yourself in a Node service, because
[chunk 02](./02-the-module-format.md) already implied it:

| `module` | implied `target` |
|---|---|
| `nodenext` | `esnext` |
| `node16` / `node18` | `es2022` |

Setting it explicitly is still reasonable for a service you want pinned. The
`@tsconfig/bases` "Node 22" base does exactly that:

```json
{
  "$schema": "https://www.schemastore.org/tsconfig",
  "display": "Node 22",
  "_version": "22.0.0",

  "compilerOptions": {
    "lib": ["es2024", "ESNext.Array", "ESNext.Collection", "ESNext.Iterator"],
    "module": "nodenext",
    "target": "es2022",
    "types": ["node"],

    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node16"
  }
}
```

That file is worth studying because of what it does **not** contain. No `outDir`,
no `rootDir`, no `include`. A base describes the *runtime*; the project describes
its own layout. That separation is the reason `extends` is worth using at all.

⚠️ Note the mismatch inside the base itself: `module: nodenext` with
`moduleResolution: node16`. Since `nodenext` *implies and enforces*
`moduleResolution: nodenext`, the explicit `node16` here is redundant at best.
Bases lag; read them, do not obey them.

## `lib` — what exists, as opposed to what compiles

`target` controls **syntax** emitted. `lib` controls **what the type checker
believes exists**. They are wired together only by a default: pick a `target`
and you get a matching `lib` unless you say otherwise.

The distinction matters on a server in one specific way. `Array.prototype.at`,
`Object.groupBy`, `Promise.withResolvers`, `Array.prototype.toSorted` — each
arrived in a particular ES version, and whether the compiler lets you call one
is a `lib` question, not a `target` question and not a Node question. The
compiler's own error even says so:

```text
Property '{0}' does not exist on type '{1}'. Do you need to change your target
library? Try changing the 'lib' compiler option to '{2}' or later.
```

Which means: **`lib` is a promise you make about the runtime.** Set it too high
and the build is green while production throws `TypeError: x.toSorted is not a
function`. Set it too low and you are told a method does not exist that plainly
does.

🔴 **Never include `"dom"` in a Node service.** It is the default under
`target: es5`, and it is a lie that costs debugging hours: `fetch`, `URL`,
`AbortController`, `setTimeout` and `console` all exist in `lib.dom.d.ts` *and*
in `@types/node`, with different signatures. With `dom` loaded, `setTimeout`
returns `number`; with `@types/node`, it returns `NodeJS.Timeout`. Code that
stores the handle then fails to compile — or worse, compiles against the wrong
one and only breaks when someone calls `.unref()`.

## `@types/node` — the part that is not TypeScript's job

TypeScript ships type definitions for **the JavaScript language**. It ships
none for **Node**. `fs`, `path`, `process`, `Buffer`, `require`, `__dirname` —
every one of those comes from `@types/node`, a DefinitelyTyped package you
install yourself.

Forget it, and the compiler tells you in a way that is unusually specific about
which mistake you made:

| Code | Exact message |
|---|---|
| `TS2580` | Cannot find name '{0}'. Do you need to install type definitions for node? Try \`npm i --save-dev @types/node\`. |
| `TS2591` | Cannot find name '{0}'. Do you need to install type definitions for node? Try \`npm i --save-dev @types/node\` and then add 'node' to the types field in your tsconfig. |

🔴 **Those two codes are not interchangeable, and the difference is the whole
lesson of the next section.** `TS2580` means the package is not installed.
`TS2591` means it *is* installed and your `types` array is excluding it.

## `types` and `typeRoots` — an allowlist that is off by default

This is the option that produces the most "it worked yesterday" incidents,
because its semantics invert the moment you write it down.

- **Default:** every visible `@types` package is included in global scope,
  automatically, without being imported.
- **Once `types` is specified:** *only* the packages you list are included.

```json
{ "compilerOptions": { "types": ["node"] } }
```

That line is not "make sure node is included". It is **"include node and nothing
else"** — and it silently drops `@types/jest`, `@types/express-serve-static-core`
augmentations and anything else that was working by ambient magic.

`typeRoots` is the same trap one level up: it defaults to
`./node_modules/@types` and every visible ancestor of it, and specifying it
restricts the search to the directories you name. A name that cannot be found in
those roots gives:

```text
error TS2688: Cannot find type definition file for '{0}'.
```

**When is `types` worth setting?** When ambient globals are actively harmful —
the classic case being a package that pulls in `@types/jest`, so `describe` and
`it` appear as globals in production source files and nobody notices the test
helper imported into a request handler. Setting `"types": ["node"]` in the
service's config and letting the test config extend it with
`"types": ["node", "jest"]` is the fix. Otherwise leave it alone.

⚠️ **`types` only governs *automatic global* inclusion.** An explicit
`import type { Request } from 'express'` works regardless of the array. This is
also why the two rules feel inconsistent: one controls the ambient global scope,
the other is ordinary module resolution.

## `skipLibCheck` — the pragmatic lie everyone tells

**Default `false`**: the compiler type-checks every `.d.ts` in the program,
including the several megabytes of them in `node_modules`.

Nearly every real config sets it to `true`, including the `@tsconfig` bases
quoted above. The honest framing:

- **What you gain:** a large drop in check time, and immunity to two dependencies
  shipping mutually incompatible declarations — a failure you cannot fix in your
  own code anyway.
- **What you lose:** errors *inside* declaration files stop being reported. If
  you author a library, `skipLibCheck: true` means you may ship a broken `.d.ts`
  and never know. It also masks the "two copies of `@types/react`" class of bug
  rather than fixing it.

The rule that survives contact: **`true` in an application, `false` in the CI job
that builds a published library's declarations.**

There is a related diagnostic worth recognising when a dependency's types
resolve badly:

```text
There are types at '{0}', but this result could not be resolved when respecting
package.json "exports". The '{1}' library may need to update its package.json or
typings.
```

That one (`TS6278`) is not your bug. It is the dependency's `exports` map missing
a `types` condition, and the fix belongs upstream.

## `include`, `exclude`, and the empty program

Small, but it produces one of the most confusing outcomes in the whole file: a
`tsc` run that reports **nothing** and checks **nothing**.

- **`include` default:** `**/*` — unless `files` is specified, in which case `[]`.
- **`exclude` default:** `["node_modules", "bower_components", "jspm_packages"]`
  plus `outDir`.

If `include` matches no files at all, you get:

```text
error TS18003: No inputs were found in config file '{0}'. Specified 'include'
paths were '{1}' and 'exclude' paths were '{2}'.
```

⚠️ **`exclude` does not prevent a file from entering the program.** It only
filters what `include` globbed. A file that is `import`ed by an included file is
compiled regardless of `exclude`. This is why "I excluded the tests and they are
still being checked" is a recurring puzzle — something in `src/` imports a test
helper.

## Gotchas

**Symptom:** `setTimeout(...)` returns a `number` in one file and
`NodeJS.Timeout` in another, or `clearTimeout` refuses the handle you stored.
**Cause:** `lib` includes `"dom"` — usually because `target` was left at its
`es5` default — so the DOM's `setTimeout` and `@types/node`'s are both in scope.
**Fix:** set `lib` explicitly to an `es20xx` value with no `dom`, and set
`target` so the default cannot bite.

**Symptom:** adding `"types": ["node"]` to fix one error breaks the whole test
suite's globals.
**Cause:** `types` is an allowlist, not an addition. Everything not listed stops
being auto-included.
**Fix:** list all of them, or better — a base config with `["node"]` and a
`tsconfig.test.json` that `extends` it with the test runner's types added.

**Symptom:** `TS2591` rather than `TS2580` for `process`.
**Cause:** `@types/node` *is* installed; your `types` array excludes it. The
compiler is telling you exactly this and the message is usually skimmed.
**Fix:** add `"node"` to the array.

**Symptom:** CI passes, the published package's consumers get type errors from
inside your `.d.ts`.
**Cause:** `skipLibCheck: true` in the config that produced the declarations.
**Fix:** keep it `true` for the app build and `false` for the declaration build.

**Symptom:** `tsc` exits 0 in a second and checks nothing.
**Cause:** `TS18003`, or an `include` pointed at a directory that was renamed.
Read the exit output rather than trusting the exit code.
**Fix:** make `include` explicit — `["src"]` — so the failure is loud.

## Interview questions

**What is the difference between `target` and `lib`?**
`target` decides the syntax level of the *emitted* JavaScript — whether `async`
is downlevelled, whether class fields are transformed. `lib` decides what the
*checker believes exists* at runtime. They are linked only by defaults. Raising
`lib` without the runtime actually having those methods produces a green build
and a runtime `TypeError`.

**`types: ["node"]` — what does that line do?**
It switches automatic `@types` inclusion from "everything visible" to "only
these". It is an allowlist. The most common bug it causes is silently dropping a
test runner's or a framework augmentation's ambient declarations.

**Is `skipLibCheck: true` safe?**
In an application, effectively yes, and it buys a large amount of check time.
In a library that publishes `.d.ts` files, no — it is precisely the check that
would have caught a broken declaration before your consumers did.

**Why does a Node service need `@types/node` at all — isn't Node the platform
TypeScript is built for?**
TypeScript ships definitions for the ECMAScript language only. Node's API surface
is a third-party type package on DefinitelyTyped, versioned separately from both
Node and TypeScript. That separation is also why a `@types/node` that is older
than your Node can make a real, working API look nonexistent.

---

← [02 · The module format](./02-the-module-format.md) · Next → [04 · The annotated configs](./04-the-annotated-configs.md)
