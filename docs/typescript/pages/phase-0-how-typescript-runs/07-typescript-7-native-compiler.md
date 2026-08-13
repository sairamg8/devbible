---
title: "TypeScript 7 is a different compiler"
sidebar_label: "07 · TypeScript 7"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. **`typescript@7.0.2`** and **`typescript@5.9.3`** installed
> side by side in `sandbox/ts-p0/`; timings from `ex8-compiler-speed.sh` on
> Node 24.19.0. The benchmark in this page was **wrong twice** before it was
> right — that story is the most useful part of it.

**TypeScript 7 is the compiler rewritten as a native binary. The language did not
change; the tool did.** For most people that means "it got faster". For anyone
whose tooling reaches into the compiler, it means an API that moved.

## What is in the package

```console
$ npm view typescript dist-tags
{ latest: '7.0.2', rc: '7.0.1-rc', beta: '6.0.0-beta', next: '7.1.0-dev...' }

$ ls node_modules/typescript/
bin  dist  lib  LICENSE  NOTICE.txt  package.json  README.md  vendor

$ du -sh node_modules/typescript
3.6M
```

The heavy lifting is in **platform-specific optional dependencies** —
`@typescript/typescript-linux-x64`, `-darwin-arm64`, `-win32-x64` and seventeen
more. npm installs the one binary matching your machine; `lib/getExePath.js`
finds it.

So `tsc` is now a thin Node wrapper around a native executable, rather than
megabytes of JavaScript the runtime has to parse and JIT on every invocation.

## The speed, measured honestly

300 files, 1500 lines, `--noEmit --strict`, best of 3 after a warm-up:

| Compiler | Best of 3 | Diagnostics |
|---|---|---|
| **TypeScript 7.0.2** | **0.76 s** | 0 |
| TypeScript 5.9.3 | 2.32 s | 0 |

About **3×** on this workload. Two reruns gave 0.74/2.36 and 0.76/2.32, so the
number is stable.

### The two confounds that had to be removed first

The first run of this benchmark reported **10×**, and it was wrong.

1. **Ancestor `@types`.** Run inside this repo, 5.9.3 auto-included
   `../../node_modules/@types` — the Docusaurus site's React, Node and MDX
   declarations — while 7.0.2 did not. It was reporting four `TS2503` errors from
   files that have nothing to do with the fixture. The "slow" side was checking a
   different, larger program.
2. **Moving the fixture was not enough.** Copying the sources to `/tmp` changed
   nothing, because 5.9.3 resolves ambient `@types` relative to the **current
   working directory**, not the source files. The cwd was still inside the repo.

The fix was to put the fixture *and* the cwd in `/tmp`, and then to **assert both
sides reported zero diagnostics before believing either timing**. That assertion
is now in the script, and it is the reason the honest figure is 3× rather than a
headline 10×.

> **The general rule:** when one side of a benchmark is doing work the other side
> never has to do, the benchmark measures the setup, not the thing.

Bigger real projects report larger multiples than 3× — a 1500-line fixture spends
a meaningful share of its time on process startup, which no rewrite removes.
Measure your own repository before quoting a number.

## The API moved — this is the migration risk

TypeScript 5.x exported the whole compiler from the package root: `ts.createProgram`,
`ts.createSourceFile`, the `SyntaxKind` enum, the transformer API. Tools built on
that — `ts-morph`, custom transformers, type-aware lint plugins, codemods — imported
`typescript` and reached in.

In 7.0.2 the root export is not that:

```console
$ node -p "Object.keys(require('typescript')).join(',')"
version,versionMajorMinor

$ node -p "typeof require('typescript').createProgram"
undefined
```

Two keys. `ts.createProgram` is gone from the default export.

**It has not disappeared, it has been re-shaped and renamed.** The package's
`exports` map publishes a new, explicitly-unstable surface:

```console
$ node -p "JSON.stringify(require('typescript/package.json').exports, null, 1)"
{
 ".": "./lib/version.cjs",
 "./unstable/sync": "./dist/api/sync/api.js",
 "./unstable/async": "./dist/api/async/api.js",
 "./unstable/fs": "./dist/api/fs.js",
 "./unstable/proto": "./dist/api/proto.js",
 "./unstable/ast": "./dist/ast/index.js",
 "./unstable/ast/is": "./dist/ast/is.js",
 "./unstable/ast/factory": "./dist/ast/factory.generated.js",
 "./unstable/ast/utils": "./dist/ast/utils.js",
 "./unstable/ast/scanner": "./dist/ast/scanner.js",
 "./unstable/ast/visitor": "./dist/ast/visitor.js",
 "./unstable/ast/clone": "./dist/ast/clone.js"
}
```

And it works:

```console
$ node --input-type=module -e "
  const sync = await import('typescript/unstable/sync');
  console.log('sync api keys:', Object.keys(sync).slice(0,10).join(','));
  const ast = await import('typescript/unstable/ast');
  console.log('ast keys count:', Object.keys(ast).length);
"
sync api keys: API,Checker,CompletionItemKind,DiagnosticCategory,ElementFlags,Emitter,InternalAPI,ModifierFlags,ModuleKind,NodeBuilderFlags
ast keys count: 409
```

So the accurate statement is: **the classic `ts.*` root API is gone; a
sync/async API plus a full AST surface lives under `typescript/unstable/*`, and
the word `unstable` in the path is the maintainers telling you it can move.**

The package also ships `vendor/vscode-jsonrpc` and no `tsserver` binary of its
own — the editor integration is a language-server protocol story now rather than
the old `tsserver` process.

**What to do before upgrading:** grep your toolchain for `require('typescript')`
and `from 'typescript'`. Anything that does more than read `version` needs
checking against the new surface.

## Defaults that changed

Measured by comparing `tsc --help --all` on both versions:

| Option | 5.9.3 | 7.0.2 |
|---|---|---|
| `strict` | `false` | **`true`** |
| `esModuleInterop` | `false` | **`true`** |
| `moduleResolution` | `Node` / `Classic` | **`bundler`**, or `node16`/`nodenext` following `module` |

A project that never set these explicitly behaves differently on 7 — see
[05 · strict](./05-strict.md).

## The version line in one table

| Version | What it is |
|---|---|
| **5.9.3** | Last of the JavaScript-implemented 5.x line |
| **6.0** (`beta`) | The JavaScript codebase with deprecations and the bridge warnings — the upgrade stepping stone |
| **7.0.2** (`latest`) | The native compiler |
| `7.1.0-dev` (`next`) | Nightly |

The intended path off 5.x is **through** 6.0: fix what it deprecates, then move
to 7. Jumping straight from 5.9 to 7.0 works for ordinary application code and is
riskiest for tooling.

## Trade-off

**Upgrading** buys compile speed with no source changes for application code.

**It costs** an audit of anything touching the compiler API, plus the behaviour
changes from the new defaults. Editor plugins and lint rules are where the real
work is — not your `src/`.

## Gotchas

**Symptom:** `TypeError: ts.createProgram is not a function` after upgrading
**Cause:** The root export is now version metadata only.
**Fix:** Port to `typescript/unstable/sync` (or `/ast`), or pin the tool to 5.x
until it supports 7.

**Symptom:** Hundreds of new errors after an upgrade, source untouched
**Cause:** `strict` and `esModuleInterop` now default to `true`.
**Fix:** Set them explicitly to reproduce the old behaviour, then tighten
deliberately.

**Symptom:** Imports stop resolving after upgrading
**Cause:** The `moduleResolution` default moved to `bundler`.
**Fix:** Set `module`/`moduleResolution` explicitly to match your runtime —
`nodenext` for Node. Phase 6.

**Symptom:** A benchmark shows a spectacular speed-up you cannot reproduce
**Cause:** Ambient `@types` inclusion differs between versions, so the two sides
check different amounts of code — and it follows the **cwd**, not the sources.
**Fix:** Assert equal diagnostic counts on both sides before comparing timings.

## Interview questions

**★ What actually changed in TypeScript 7?**
The compiler was reimplemented as a native binary shipped as platform-specific
optional dependencies; `tsc` is now a thin wrapper that locates it. The *language*
is unchanged. The visible consequences are speed, several changed option defaults
(`strict`, `esModuleInterop`, `moduleResolution`), and a relocated compiler API.

**★ Is the TypeScript compiler API gone in 7?**
Not gone — moved and renamed. `require('typescript')` now exports only `version`
and `versionMajorMinor`, so `ts.createProgram` is `undefined`, but the package
exports `typescript/unstable/sync`, `/async` and a 409-export `/ast` surface.
Anything built on the old root API must be ported, and `unstable` signals it may
still change.

**★ How much faster is it, and how would you check?**
About 3× on a 1500-line synthetic project here (0.76 s vs 2.32 s). Check it on
your own repo, with both sides reporting the same diagnostics — the first version
of this benchmark showed 10× purely because the old compiler was also loading
ambient `@types` from an ancestor directory.

**What is TypeScript 6.0 for?**
It is the JavaScript-implemented bridge release carrying deprecations and
warnings, so a large codebase can fix issues on a familiar compiler before moving
to the native one.

**Which parts of an upgrade are risky for application code versus tooling?**
Application code is mostly affected by the changed defaults, which is a config
conversation. Tooling — lint plugins, codemods, custom transformers, anything
importing `typescript` — carries the real risk, because the API it used is no
longer at the package root.

---

← Prev: [tsconfig.json anatomy](./06-tsconfig-anatomy.md) · Next → [Where types come from](./08-where-types-come-from.md)
