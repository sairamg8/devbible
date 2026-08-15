---
title: "Decision 1 — who compiles"
sidebar_label: "01 · Who compiles"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **Node.js API docs** (*Modules: TypeScript* —
> stability, default-on versions, the unsupported-syntax list, the recommended
> `tsconfig`) and the **`tsconfig` reference** on typescriptlang.org
> (`allowImportingTsExtensions`, `rewriteRelativeImportExtensions`, `noEmit`).
> `TS5096`, `TS5097` and `TS1294` and their exact `{0}` message text were read
> out of the **compiler's own diagnostic table** — the strings compiled into the
> **TypeScript 7.0.2** native binary, with codes from the numbered table in the
> **5.9.3** JavaScript build. **No sandbox, no console block** — nothing here
> was run.

Most `tsconfig.json` files on the internet are cargo cult. Someone's worked, it
got copied, and now a service has `"target": "es5"` and `"moduleResolution":
"node"` in 2026 because nobody remembers why.

The file is not actually large. It is **two decisions and their consequences**,
plus a handful of options that are simply on because you want them on.

> **Decision 1 — who produces the JavaScript that runs?** `tsc`, or the runtime?
>
> **Decision 2 — what module format is each file?** — [the next chunk](./02-the-module-format.md).

Get them wrong and you get the two classic failure modes: a build that emits
`require()` into a package declared `"type": "module"`, and an editor that is
confidently checking a completely different program from the one your build
compiles.

## Path A — `tsc` emits, Node runs the output

The traditional shape. Source in `src/`, JavaScript in `dist/`, `node
dist/server.js` in production.

```json
{
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true
  }
}
```

`tsc` is doing two jobs here — checking *and* emitting — and the emitted output
is what ships. That matters for the `strict` discussion in
[chunk 04](./04-the-annotated-configs.md): under
[`noEmitOnError`](../../phase-0-how-typescript-runs/10-checking-vs-transpiling.md),
a type error stops the build; without it, `tsc` writes the JavaScript anyway.

## Path B — Node runs the `.ts` files, `tsc` only checks

Node strips the types itself and executes the result. **Type stripping is
documented as Stable as of Node v25.2.0 and v24.12.0**, and has been on by
default since v23.6.0 and v22.18.0 — so on the **Node 24.19.0** this corpus
targets it is stable, on, and needs no flag.

```json
{
  "compilerOptions": {
    "noEmit": true
  }
}
```

`tsc` now emits nothing. It is a linter you run in CI. Node is the thing that
turns `.ts` into running code — and Node's stripper does **no type checking at
all**, which is why `tsc --noEmit` in CI is not optional on this path, it is the
*only* checking that happens.

### What Path B costs you

This is the part the "just run TypeScript directly!" posts leave out. Node
documents each of these:

- **Node does not read `tsconfig.json`.** Not for `paths`, not for anything.
  Path aliases do not exist at runtime; use package `imports` (the `#`-prefixed
  subpath imports) instead, which Node resolves natively and TypeScript
  understands.
- **File extensions are mandatory in imports** — `import './file.ts'`, not
  `'./file'`. Node has no resolution guessing.
- **Node refuses to handle `.ts` files inside `node_modules`**, deliberately, to
  discourage publishing TypeScript source.
- **`.tsx` is unsupported.**
- **Only erasable syntax works.** `enum`, `namespace` with runtime code,
  parameter properties (`constructor(private x: number)`), import aliases and
  decorators all fail — the error is
  [`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`](../../phase-0-how-typescript-runs/04-strip-only-and-erasable-syntax.md).
  This is exactly what `erasableSyntaxOnly` exists to catch at check time
  instead of at 3 a.m.
- **The `type` keyword becomes load-bearing.** A stripper works one file at a
  time and cannot know that `FnParams` is a type, so
  `import { fn, FnParams } from './fn.ts'` emits a real import of a binding that
  does not exist at runtime. `import { fn, type FnParams }` is required — which
  is what `verbatimModuleSyntax` enforces, and
  [chunk 05](./05-emit-layout-and-programs.md) dissects.

Node's own documentation gives the matching config, and it is worth reading as a
single artefact rather than option by option:

```json
{
  "compilerOptions": {
    "noEmit": true,
    "target": "esnext",
    "module": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true
  }
}
```

Every entry is a consequence of the list above. That is the whole point of this
chunk: **the config is not a preference list, it is the shape of the decision you
already made.**

## Which path should a service take?

Neither is the default answer, and the honest split is about what else is in the
pipeline:

| | Path A — `tsc` builds | Path B — Node strips |
|---|---|---|
| What ships | `dist/*.js` | your `.ts` sources |
| Startup cost | none | per-file stripping on first load |
| Stack traces | need `sourceMap` + `--enable-source-maps` | line numbers already align |
| `enum`, decorators, parameter properties | fine | **rejected at runtime** |
| Path aliases (`paths`) | resolved at build | do not exist — use `#` subpath imports |
| Type checking in CI | the build already does it | a **separate, mandatory** `tsc --noEmit` |

The decisive question is usually the third row from the bottom. A codebase with
decorators — NestJS, TypeORM, `class-validator` — cannot take Path B at all
without rewriting, because the stripper has nothing to transform them into.

## 🔴 The trap: `allowImportingTsExtensions` and its version-dependent rule

If you write `import './file.ts'` so Node can run it, `tsc` complains unless you
allow it:

```text
error TS5097: An import path can only end with a '.ts' extension when
'allowImportingTsExtensions' is enabled.
```

And turning it on has a precondition — one whose **wording changed between the
versions this corpus straddles**:

| Version | Exact text of `TS5096` |
|---|---|
| 5.9.3 | Option 'allowImportingTsExtensions' can only be used when either 'noEmit' or 'emitDeclarationOnly' is set. |
| 7.0.2 | Option 'allowImportingTsExtensions' can only be used when one of 'noEmit', 'emitDeclarationOnly', or 'rewriteRelativeImportExtensions' is set. |

Both strings were read out of the two compilers' own message tables, and the
5.9.3 wording is **absent** from the 7.0.2 binary. The practical difference:
under 7.x you can import `.ts` extensions **and still emit**, because
`rewriteRelativeImportExtensions` (TypeScript 5.7+) turns `./file.ts` into
`./file.js` on the way out. Under 5.9 that combination was rejected outright.

⚠️ `rewriteRelativeImportExtensions` rewrites **relative** paths only. A
non-relative specifier that resolves to a `.ts` input gets its own warning,
present verbatim in the 7.0.2 table:

```text
This import uses a '.ts' extension to resolve to an input TypeScript file, but
will not be rewritten during emit because it is not a relative path.
```

Which is to say: a monorepo that imports `@acme/shared/src/index.ts` will build
something that cannot run. The fix is a real package entry point, not a deeper
relative path.

## Gotchas

**Symptom:** the service runs fine locally under `node src/server.ts` and the
Docker image fails to start.
**Cause:** the image runs an older Node, or the code uses a non-erasable
construct that only fails on the stripping path.
**Fix:** `erasableSyntaxOnly` in the config, so `TS1294` — *"This syntax is not
allowed when 'erasableSyntaxOnly' is enabled."* — fires in CI instead of at
container start. Pin the Node version in the image and in `engines`.

**Symptom:** `tsc` reports `TS5097` for an import you deliberately wrote with a
`.ts` extension.
**Cause:** `allowImportingTsExtensions` is off — or it is on and its
precondition is not met, which is `TS5096` and a different message.
**Fix:** read which of the two codes you actually got; they point at opposite
halves of the same config.

**Symptom:** `paths` aliases resolve under `tsc` and throw
`ERR_MODULE_NOT_FOUND` under `node src/server.ts`.
**Cause:** Node does not read `tsconfig.json`. `paths` is a *type-resolution*
feature that has never affected runtime resolution on any path — Path A hides
this because a bundler or `tsc-alias` was rewriting the output.
**Fix:** package `imports` (`"#config": "./src/config.ts"`), which both Node and
TypeScript honour.

**Symptom:** CI is green and nothing is checked.
**Cause:** the pipeline runs the build (which on Path B emits nothing and exits
0 having been given no reason to check) but never runs `tsc --noEmit`.
**Fix:** make `tsc --noEmit` an explicit, separate CI step on Path B. It is the
only checking in the system.

## Interview questions

**If Node can run `.ts` directly, why keep `tsc` in the project?**
Node's stripper does no type checking — it replaces types with whitespace and
runs the result. `tsc --noEmit` is then the *only* thing that checks types, so it
moves from being "the build" to being a required CI gate. Dropping it does not
make the project loosely typed; it makes it unchecked.

**Your service uses decorators. Which path can it take?**
Path A only. Decorators are not erasable — they have runtime behaviour — so
Node's stripper rejects them with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, and
`erasableSyntaxOnly` will flag them at check time as `TS1294`. The same applies
to `enum`, `namespace` with runtime code, and parameter properties.

**What does `rewriteRelativeImportExtensions` buy you, and what is its limit?**
It lets the source name the file that exists at *authoring* time (`./x.ts`) while
the emitted output names the file that exists at *runtime* (`./x.js`) — so one
source tree can be both run directly by Node and built by `tsc`. Its limit is in
the name: relative paths only. A non-relative specifier resolving to a `.ts`
input is left alone and warned about.

**Why did `allowImportingTsExtensions` require `noEmit` before TypeScript 5.7?**
Because without a rewrite step the extension in the source would be copied
verbatim into the output, producing JavaScript that imports a `.ts` file that
will not exist. `noEmit` made the question moot. `rewriteRelativeImportExtensions`
answered it instead, which is why 7.0's `TS5096` lists three options where 5.9's
listed two.

---

← [Topic index](./README.md) · Next → [02 · Decision 2 — the module format](./02-the-module-format.md)
