---
title: "TypeScript without a build step"
sidebar_label: "12 · TypeScript natively"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). Type stripping is enabled by
> default since **v23.6.0** and is **Stability 2 – Stable as of v24.12.0**, so it
> is stable on the target runtime — no flag, no warning.

**`node server.ts` just runs. Node deletes the types and executes the JavaScript
underneath. It never checks them.**

## What works

```ts
// server.ts
interface Config { port: number; host: string; }

function start(config: Config): string {
  return `listening on ${config.host}:${config.port}`;
}

const conf: Config = { port: 8080, host: '127.0.0.1' };
console.log(start(conf));
```

```console
$ node server.ts
listening on 127.0.0.1:8080
```

No `tsc`, no `ts-node`, no `tsconfig.json`, no flag, and nothing on stderr.

The mechanism is **type stripping**: Node replaces type annotations with
whitespace and runs the result. Positions are preserved, so stack traces and line
numbers stay correct without a source map.

## What it does not do: check anything

```ts
// wrong.ts
const port: number = "this is a string, not a number";
console.log('Node ran it anyway:', port);
```

```console
$ node wrong.ts
Node ran it anyway: this is a string, not a number
```

This is the single most important fact on the page. **Node is not a type
checker and will never be one.** Type checking stays a separate step:

```console
$ tsc --noEmit          # in CI, in your editor, in a pre-commit hook
```

Running `.ts` natively removes the *build*, not the *check*. A team that drops
`tsc --noEmit` from CI because "Node runs TypeScript now" has silently switched to
writing JavaScript with decorative annotations.

## Erasable syntax only

Anything that is pure annotation disappears cleanly. Anything that must **generate
JavaScript** does not:

| Erasable — works | Non-erasable — needs a transform |
|---|---|
| type annotations, `interface`, `type` | `enum` |
| generics, `as`, `satisfies` | `namespace` with runtime code |
| `import type` / `export type` | parameter properties (`constructor(private x: T)`) |
| `declare`, non-null `!` | legacy `import x = require('y')` |

```ts
// enums.ts
enum Level { Info, Warn }
console.log(Level.Info);
```

```console
$ node enums.ts
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported
in strip-only mode
  code: 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'
```

There is a flag, and it costs you the stability guarantee:

```console
$ node --experimental-transform-types enums.ts
(node:235167) ExperimentalWarning: Transform Types is an experimental feature and
might change at any time
0
```

**The better move is to not use non-erasable syntax.** Replace `enum` with a const
object plus a derived type, which is more idiomatic TypeScript anyway:

```ts
// levels.ts
const Level = { Info: 0, Warn: 1 } as const;
type Level = (typeof Level)[keyof typeof Level];

const current: Level = Level.Warn;
console.log(current);
```

```console
$ node levels.ts
1
```

`verbatimModuleSyntax` and `erasableSyntaxOnly` in `tsconfig.json` make `tsc`
reject non-erasable syntax for you, so the mistake is caught at check time rather
than at run time.

## `node_modules` is excluded

```console
$ node -e "import('tspkg')" --input-type=module
blocked → ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING
```

Node refuses to strip types inside `node_modules`. This is deliberate: published
packages should ship JavaScript plus `.d.ts` declarations, not TypeScript source.
Consumers should never be compiling your library.

It also bounds the cost — Node is not parsing thousands of dependency files
looking for annotations.

## Import specifiers

The rule that surprises people: **import the `.ts` extension**.

```ts
import { helper } from './helper.ts';   // ✅ the only form that works
import { helper } from './helper.js';   // ❌ ERR_MODULE_NOT_FOUND — no such file
import { helper } from './helper';      // ❌ ERR_MODULE_NOT_FOUND
```

```console
$ node imp1.ts
.ts specifier → helped
$ node imp2.ts
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/you/ts/helper.js'
imported from /home/you/ts/imp2.ts
```

ESM does not guess extensions ([resolution](05-module-resolution.md)), and it does
not rewrite `.js` to `.ts` either — it asks the filesystem for exactly what you
wrote. That conflicts with the long-standing TypeScript convention of importing
`./helper.js` from `helper.ts`, which exists because that is what the path will be
*after* compilation.

The two conventions cannot both be right, and which one you need depends on
whether you compile:

- **Running `.ts` directly** — write `./helper.ts` and set
  `"allowImportingTsExtensions": true` so `tsc` stops complaining.
- **Compiling with `tsc`** — write `./helper.js`, because that is the file that
  will exist at runtime.

Pick one and apply it consistently across the codebase. Mixing them produces
imports that work under one command and not the other.

## So do you still need a build step?

| Situation | Build? |
|---|---|
| Scripts, tooling, tests | **No.** Run `.ts` directly |
| A server you deploy as source or in a Node image | **No**, if you avoid non-erasable syntax |
| A published library | **Yes** — ship `.js` + `.d.ts`; `node_modules` stripping is blocked |
| Browser or bundled code | **Yes** — the bundler handles it |
| Codebase using `enum`, decorators, parameter properties | **Yes**, or migrate the syntax |

Type checking is required in all five. The build step is what became optional.

## Gotchas

**Symptom:** `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`
**Cause:** `enum`, `namespace` with runtime code, or a parameter property.
**Fix:** Rewrite it as erasable syntax — a `const` object for enums, explicit
field assignment for parameter properties. `--experimental-transform-types` works
but drops you back to an experimental code path.

**Symptom:** Type errors reach production
**Cause:** Node strips types without checking them, and CI no longer runs `tsc`.
**Fix:** Keep `tsc --noEmit` in CI. Native execution replaces the build, not the
check.

**Symptom:** `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`
**Cause:** A dependency published TypeScript source instead of compiled output.
**Fix:** Nothing you can do from the consuming side — the package must ship `.js`
plus `.d.ts`. Report it.

**Symptom:** `ERR_MODULE_NOT_FOUND` for `./helper.js` when `helper.ts` exists
**Cause:** Node resolves the literal specifier and does not rewrite `.js` to
`.ts`. The `.js`-specifier convention assumes you compile first.
**Fix:** When running `.ts` directly, import `./helper.ts` and set
`allowImportingTsExtensions` in `tsconfig.json`.

**Symptom:** Decorators do not work
**Cause:** They are not erasable and are not covered by type stripping.
**Fix:** Compile with `tsc`, or design without them.

## Interview questions

**★ Does Node type-check TypeScript?**
No, and it is not planned to. Node erases type annotations and runs the remaining
JavaScript. Checking stays a separate step — `tsc --noEmit` — and dropping it
because "Node runs TypeScript" means type errors reach production.

**★ What is erasable syntax, and why does the distinction exist?**
Erasable syntax is anything that can be deleted without changing runtime
behaviour: annotations, `interface`, generics, `import type`. Non-erasable syntax
— `enum`, runtime `namespace`, parameter properties — must *generate* JavaScript,
which is a transform rather than an erasure. Node does the first by default and
the second only behind an experimental flag.

**★ Why does Node refuse to strip types inside `node_modules`?**
To keep published packages shipping JavaScript and `.d.ts` declarations rather
than source. It stops consumers from compiling their dependencies and bounds the
work Node does at startup.

**★ How do you replace an `enum` with erasable syntax?**
A `const` object plus a derived type:
`const Level = { Info: 0, Warn: 1 } as const; type Level = (typeof Level)[keyof typeof Level];`
It erases cleanly, and it is closer to idiomatic modern TypeScript than `enum`.

**Do you still need a build step for a published library?**
Yes. `node_modules` type stripping is blocked, so a library must ship compiled
JavaScript with `.d.ts` files. Applications are the case where the build step
genuinely becomes optional.

**What does `erasableSyntaxOnly` do?**
It makes `tsc` reject non-erasable constructs, so the incompatibility is caught at
check time rather than as a runtime `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`.

---

← Prev: [npm, pnpm, yarn and workspaces](11-package-managers.md) · Next → [Publishing a package](13-publishing.md)
