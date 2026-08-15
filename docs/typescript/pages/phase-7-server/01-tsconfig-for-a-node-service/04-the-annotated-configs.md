---
title: "The annotated configs"
sidebar_label: "04 · The annotated configs"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **`tsconfig` reference** on typescriptlang.org
> (documented defaults for `strict`, `noUncheckedIndexedAccess`,
> `exactOptionalPropertyTypes`, `resolveJsonModule`, `declaration`,
> `incremental`, `sourceMap`) and the **Node.js API docs** (*Modules:
> TypeScript*). The `exactOptionalPropertyTypes` message text was read out of
> the **TypeScript 7.0.2** binary's diagnostic table. The `strict` default is
> [phase 0's sandbox-proven measurement](../../phase-0-how-typescript-runs/05-strict.md),
> cited rather than re-derived. **No sandbox, no console block on this page.**

Three chunks of reasoning; here is what they produce. Both files below are
complete — nothing is elided — and every line is annotated with *why*, because a
config you cannot defend line by line is one you will copy into the next project
unchanged.

## Path A — `tsc` builds, Node runs `dist/`

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "lib": ["es2024"],
    "types": ["node"],

    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true,
    "declaration": false,
    "noEmitOnError": true,
    "incremental": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,

    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

| Line | Why it is there |
|---|---|
| `module: nodenext` | The only setting that models Node's dual module system. Implies and enforces `moduleResolution: nodenext`, implies `target: esnext` and `esModuleInterop` — [chunk 02](./02-the-module-format.md) |
| `lib: ["es2024"]` | Stated rather than inherited, and deliberately **without `dom`** — [chunk 03](./03-target-lib-and-types.md) |
| `types: ["node"]` | Keeps a stray `@types/jest` out of production source's global scope. An allowlist; the test config extends and adds to it |
| `rootDir` / `outDir` | `src/foo.ts` → `dist/foo.js`. Without `rootDir` the output layout depends on the *longest common path of the inputs*, which changes when you add a file — [chunk 05](./05-emit-layout-and-programs.md) |
| `sourceMap: true` | Stack traces from `dist/` are otherwise unreadable. Topic 02 covers the `--enable-source-maps` half |
| `declaration: false` | A service is not a library. Turn it on only for a package you publish. Defaults to `true` only when `composite` is set |
| `noEmitOnError: true` | Without it, `tsc` writes JavaScript for a program it has just rejected |
| `incremental: true` | Writes `.tsbuildinfo` so the second check is much cheaper. Defaults to `false` unless `composite` is set |
| the strict block | Below |
| `verbatimModuleSyntax` | [Chunk 05](./05-emit-layout-and-programs.md) |
| `resolveJsonModule` | `import pkg from './package.json'` with a type derived from the file's actual shape. Default `false` |
| `skipLibCheck` | `true` in an application; `false` when producing a published `.d.ts` |
| `include: ["src"]` | Explicit, so a rename fails loudly with `TS18003` instead of quietly checking a subset |

## Path B — Node strips types, `tsc` only checks

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
    "lib": ["es2024"],
    "types": ["node"],

    "noEmit": true,
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,

    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,

    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

The differences are all consequences of one fact: **the `.ts` file is the
artefact that runs.**

- `noEmit` — there is nothing to emit. `tsc` is a CI gate.
- `allowImportingTsExtensions` — you now write `import './router.ts'`, because
  that is the path Node resolves at runtime.
- `rewriteRelativeImportExtensions` — kept so the same source can *also* be built
  with `tsc` if you ever need to. Under 7.x it is one of the three options that
  unlock `allowImportingTsExtensions` — see the `TS5096` wording change in
  [chunk 01](./01-who-compiles.md).
- `erasableSyntaxOnly` — turns Node's runtime
  `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` into a compile-time `TS1294`.
- `verbatimModuleSyntax` — mandatory here, not merely advisable.
- **No `outDir`, no `rootDir`, no `sourceMap`** — Node replaces types with
  whitespace, preserving line numbers, and documents that it generates no source
  maps for stripped code. Stack traces line up without one.

## The strict block

`strict` **defaults to `true` in TypeScript 7** — measured, not assumed.
[Phase 0 · `strict`](../../phase-0-how-typescript-runs/05-strict.md) reads it out
of `tsc --help --all` and shows the same file passing with `--strict false` and
failing with no flag at all. Writing it explicitly is still worth doing: your
config outlives your compiler version, and a reader should not have to know the
default to know the intent.

The three worth adding on a server, none of which `strict` includes:

### `noUncheckedIndexedAccess`

Default `false`. Adds `undefined` to every index-signature and array-element
read. On a server this is not pedantry — it is the difference between believing
and knowing:

```ts
const parts = header.split(' ');
const scheme = parts[0];    // string              — without the flag
const scheme = parts[0];    // string | undefined  — with it
```

The second is the true type. Every `req.params.id`, every `req.headers['x-…']`,
every `rows[0]` is an index access into an object that some runtime populated,
and the compiler has no idea whether the key is there.

⚠️ The flag's weakness is worth naming: it makes the *type* honest, it does not
make the *code* handle it. The temptation is to silence each new error with `!`,
which converts a compiler complaint into
[a non-null assertion nobody can audit](../../phase-2-narrowing/13-non-null-assertion.md).
That is strictly worse than not enabling it, because it looks like it was
handled.

### `exactOptionalPropertyTypes`

Default `false`. Stops `{ name?: string }` from accepting an explicit
`undefined`:

```text
Type '{0}' is not assignable to type '{1}' with 'exactOptionalPropertyTypes: true'.
Consider adding 'undefined' to the types of the target's properties.
```

This one earns its place specifically at the JSON boundary. **`name: undefined`
and an absent `name` are different in JavaScript and identical after
`JSON.stringify`** — the key simply disappears. A `PATCH` endpoint that cannot
distinguish "do not change this field" from "clear this field" is the bug the
flag prevents, and it is a data-loss bug, not a cosmetic one.

If you need three states, model three states: `name?: string` for absent,
`name: string | null` for explicitly cleared. The flag is what stops the two
from collapsing into each other by accident.

### `noImplicitOverride`

Default `false`. Requires the `override` keyword when a subclass member replaces
a base one. Cheap to adopt, and it catches the rename-in-the-base-class failure
where a subclass silently stops overriding anything and starts adding a method
nobody calls.

### 📌 When to switch these on

Both `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` produce a large
number of errors mid-project, and `exactOptionalPropertyTypes` in particular
fights with libraries that spread optional props into object literals. They
belong in a new service from day one, or in a **phase 11 · Migration and legacy**
*(dropped 2026-08-15)* pass with a plan and a budget — not in a Friday commit.

## Gotchas

**Symptom:** a `PATCH` endpoint clears fields the client never sent.
**Cause:** without `exactOptionalPropertyTypes`, `{ name?: string }` accepts an
explicit `undefined`, so "absent" and "set to undefined" are the same type — and
`JSON.stringify` erases the distinction on the way out anyway.
**Fix:** the flag, plus modelling "absent" and "cleared" as genuinely different
states rather than leaning on optionality.

**Symptom:** turning on `noUncheckedIndexedAccess` produces hundreds of errors
and the team reverts it.
**Cause:** it is a correct flag applied to code written under a false assumption.
Most of those errors are real bugs or near-bugs.
**Fix:** enable it on a new service, or directory by directory during a
migration. Do not enable it and then paper over it with `!`.

**Symptom:** `tsc` failed, and `dist/` was updated anyway — the container ships
code from a rejected build.
**Cause:** `noEmitOnError` is `false` by default. `tsc` reports errors *and*
emits.
**Fix:** `noEmitOnError: true`, and check the exit code in CI rather than the
presence of output files.

**Symptom:** the build got slower and slower and nobody knows why.
**Cause:** no `incremental`, so every run is a cold check; or `.tsbuildinfo`
landing somewhere the CI cache does not persist.
**Fix:** `incremental: true` and cache the `.tsbuildinfo` alongside
`node_modules`.

## Interview questions

**Your config has `noEmit: true` and the service still runs in production. How?**
Node is doing the compiling — it strips types and executes the result, stable on
Node 24.12+/25.2+ and on by default since 23.6/22.18. `tsc` has been demoted to a
CI checker, which is precisely why running it is non-optional: Node's stripper
does no type checking whatsoever.

**Which strict-family flags are *not* in `strict`, and why would a server want
them?**
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`noPropertyAccessFromIndexSignature`. The first matters because every
`req.params` / `req.headers` / `rows[0]` read is an index access into an object
built at runtime; the second because `undefined` versus absent is a real
distinction in a JSON API that `JSON.stringify` silently erases.

**Why write `"strict": true` when it is already the default?**
Because a config file outlives the compiler version it was written against, and
because the alternative is a reader who must know a version-specific default to
know what the project intends. The same argument applies to `target` under
`nodenext`.

**A build emits JavaScript for code that failed type checking. Bug or
configuration?**
Configuration. `tsc` checks and emits as separate jobs, and `noEmitOnError`
defaults to `false`, so errors do not stop the write. It is the most common
reason a "broken" build produces a runnable — and wrong — artefact.

---

← [03 · `target`, `lib` and types](./03-target-lib-and-types.md) · Next → [05 · Emit, layout and programs](./05-emit-layout-and-programs.md)
