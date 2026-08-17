---
title: "The bundler resolver"
sidebar_label: "06 · The bundler resolver"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Reference*
> (the `bundler` section and its supported-feature list, *package.json
> "exports"*, *package.json "imports" and self-name imports*) and *Modules —
> Choosing Compiler Options*. The gating function
> `moduleResolutionSupportsPackageJsonExportsAndImports` and the `bundler`/`module`
> pairing check were read out of the installed **TypeScript 5.9.3** build; the
> 7.0-era wording of `TS5095` comes from the **7.0.2** native binary's string
> table. **No sandbox, no console block.**

`bundler` arrived in **TypeScript 5.0** and did something the other three
strategies do not: it stopped pretending a bundler is a runtime.

## What it is

> `--moduleResolution bundler` attempts to model the module resolution behavior
> common to most JavaScript bundlers. In short, this means supporting all the
> behaviors traditionally associated with Node.js's CommonJS `require` resolution
> algorithm like `node_modules` lookups, directory modules, and extensionless
> paths, while also supporting newer Node.js resolution features like
> package.json `"exports"` and package.json `"imports"`.

So `bundler` is the **union**: the ergonomics of `node10` with the correctness of
`node16`. That is not a compromise — it is an accurate description of what
Webpack, Vite, esbuild and Rollup actually do. Before 5.0 there was no honest way
to express it, and every bundler project used `node10` and quietly lost
`"exports"`.

Its supported-features list, verbatim from the reference:

- `paths` ✅
- `baseUrl` ✅
- `node_modules` package lookups ✅
- package.json `"exports"` ✅ *matches `types`, `import`/`require` depending on syntax*
- package.json `"imports"` and self-name imports ✅ *matches `types`, `import`/`require` depending on syntax*
- package.json `"typesVersions"` ✅
- Package-relative paths ✅ *when `exports` not present*
- Full relative paths ✅
- Extensionless relative paths ✅
- Directory modules ✅

Every row is ✅. That is the point of it.

## The condition list is where it differs from `nodenext`

🔴 **`bundler` matches `types` and `import`/`require`, but not `node`.**

That one omission has real consequences. A package whose `"exports"` looks like
this ships two different implementations:

```jsonc
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "node":  "./dist/index.node.js",   // ← nodenext takes this
      "default": "./dist/index.browser.js" // ← bundler takes this
    }
  }
}
```

Under `nodenext` you resolve the Node build. Under `bundler` you resolve the
browser build. **Both answers are correct for their host**, and this is the single
most common reason a monorepo's front end and back end disagree about what a
shared dependency exports — including disagreeing about its *types*, if the
package ships more than one `.d.ts`.

## The two implications the compiler applies

> `--moduleResolution bundler` must be paired with `--module esnext` or `--module
> preserve`.

> `--moduleResolution bundler` implies `--allowSyntheticDefaultImports`.

⚠️ **The documentation is narrower than the implementation, and the
implementation moved in TypeScript 7.** The 5.9.3 check fires only when the
module kind is neither ES2015-through-ESNext nor `preserve`:

```js
if (moduleResolution === Bundler && !emitModuleKindIsNonNodeESM(moduleKind)
                                 && moduleKind !== Preserve) { /* TS5095 */ }
```

and its message reads *"Option '{0}' can only be used when 'module' is set to
'preserve' or to 'es2015' or later."* — so `es2020` and `es2022` are accepted
too, despite the doc naming only `esnext` and `preserve`.

🔴 In the **7.0.2** binary the same `TS5095` reads *"Option '{0}' can only be used
when 'module' is set to 'preserve', **'commonjs'**, or 'es2015' or later."*
TypeScript 7 additionally permits `bundler` resolution with CommonJS emit — a
real behaviour change, visible only in the message text. **Take the doc as the
recommendation and the diagnostic as the rule, and read the diagnostic on the
compiler version you actually run.**

## Conditions, and the flag that widens them

The non-configurable conditions are fixed by your `moduleResolution`. The
configurable ones are `customConditions`, and the handbook's bundler recipe uses
exactly one:

```jsonc
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "customConditions": ["module"],
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "allowArbitraryExtensions": true,
    "verbatimModuleSyntax": true
  }
}
```

It is gated, and the error names the same three settings as everything else here:

```text
TS5098  Option '{0}' can only be used when 'moduleResolution' is set to
        'node16', 'nodenext', or 'bundler'.
```

📌 Note `"noEmit": true` in that recipe. Under a bundler, `tsc` is a type
checker and nothing else — the bundler produces the JavaScript. That is also why
`allowImportingTsExtensions` is available there and not in a `tsc` build:
the compiler refuses to emit a specifier it knows a runtime cannot resolve.

## The `"imports"` trap that only bites your own package

The handbook flags a fork in how `"imports"` resolution works, and it catches
monorepos specifically — when the `package.json` belongs to the project being
compiled rather than to a dependency:

> If the package.json is part of the local project, an additional remapping step
> is performed in order to find the *input* TypeScript implementation file that
> will eventually produce the output JavaScript or declaration file path that was
> resolved from `"imports"`. Without this step, any compilation that resolves an
> `"imports"` path would be referencing output files from the *previous
> compilation* instead of other input files that are intended to be included in
> the current compilation. This remapping uses the `outDir`/`declarationDir` and
> `rootDir` from the tsconfig.json, so using `"imports"` usually requires an
> explicit `rootDir` to be set.

🔴 That is the doc-backed reason a `#internal/*` specifier resolves to **stale
output from the previous build** when `rootDir` is missing. It is a genuinely
obscure failure and this sentence is the only place it is written down.

## The dividing line, in the compiler's own words

Everything in chunks 04–06 reduces to one function in the source:

```js
function moduleResolutionSupportsPackageJsonExportsAndImports(moduleResolution) {
  return moduleResolution >= 3 /* Node16 */ && moduleResolution <= 99 /* NodeNext */
      || moduleResolution === 100 /* Bundler */;
}
```

🔴 **There are not four strategies in any meaningful sense.** There are two that
can read a modern package's `package.json` and two that cannot, and moving from
the second group to the first is the highest-value single change most legacy
`tsconfig.json` files can make.

## The one thing all four agree on

> All of TypeScript's `moduleResolution` algorithms support referencing a module
> by a relative path that includes a file extension.

`import {} from "./a.js"` works everywhere. If you adopt one spelling of relative
import for the rest of your life, adopt that one — it is the only form correct
under every strategy and every runtime.

## Gotchas

**`bundler` and `nodenext` resolve the same dependency to different files.**
*Symptom:* a shared package behaves differently in the front end and the back end
of one monorepo. *Cause:* `nodenext` matches the `node` export condition;
`bundler` does not. *Fix:* nothing — this is correct. But do not assume a type
that checks in one package checks in the other, and do not force both to one
strategy to make them agree.

**`customConditions` silently does nothing under `node10`.** *Symptom:* a
condition you added is ignored. *Cause:* it is gated to the three modern
strategies. *Fix:* you should get `TS5098` — if you do not, check the spelling and
that it is inside `compilerOptions`.

**`"imports"` in your own package needs `rootDir`.** *Symptom:* `#internal/db`
resolves to something in `dist/` from the previous build, so edits have no effect
and deleting `dist/` breaks the build. *Cause:* the local-project remapping step
needs `rootDir`/`outDir` to walk an output path back to an input file. *Fix:* set
`rootDir` explicitly. Close to impossible to guess without the doc sentence above.

**`bundler` with `"type": "module"` is discouraged.** *Symptom:* interop
differences between the compiler and the bundler that no configuration seems to
explain. *Cause:* per the handbook, *"Some bundlers adopt different ESM/CJS
interop behavior under these circumstances, which TypeScript cannot currently
analyze with `"moduleResolution": "bundler"`."* *Fix:* omit the `"type"` field in
bundler projects, and avoid `.mts`.

**`TS5095`'s wording differs between TypeScript 5 and 7.** *Symptom:* a
`bundler` + `commonjs` config errors on one machine and not another. *Cause:* 7.0
relaxed the pairing to include `commonjs`. *Fix:* pin the compiler version in CI,
and read the message from the version you ship with — not from the handbook,
which is narrower than both.

**`bundler` is not a licence to import anything.** *Symptom:* an import resolves
in `tsc` and fails in the bundler. *Cause:* `bundler` models what *most* bundlers
do; yours may have its own aliases, plugins or extension handling. *Fix:* the
bundler's own resolution config is the authority. `bundler` narrows the gap; it
does not close it.

**Choosing `bundler` because it has the fewest errors is choosing wrong.**
*Symptom:* a Node service set to `bundler` because `nodenext` complained.
*Cause:* `bundler` permits extensionless imports and directory modules, which
Node's ESM does not — so the errors were real and were silenced. *Fix:* pick the
strategy by what loads the code, never by error count.

**`allowImportingTsExtensions` needs `noEmit`.** *Symptom:* `TS5096: Option
'allowImportingTsExtensions' can only be used when either 'noEmit' or
'emitDeclarationOnly' is set.` *Cause:* the compiler will not emit a `.ts`
specifier into JavaScript. *Fix:* it belongs in a check-only config, which is what
the bundler recipe is.

## Interview questions

**When would you choose `bundler` over `nodenext`?**
When a bundler, not Node, resolves your imports — a front-end app, or anything
built by Vite, Webpack, esbuild or Rollup. `bundler` keeps extensionless paths
and directory modules, which bundlers support and Node's ESM does not, while
still honouring `"exports"` and `"imports"`.

**A shared package resolves to different files in your app and your API. Bug or
not?**
Not a bug. `nodenext` matches the `node` export condition and `bundler` does not,
so a package that ships separate Node and browser implementations resolves
correctly-but-differently for each. The mistake would be forcing both onto one
strategy so they agree.

**What does `customConditions` do, and when can you use it?**
It adds extra `"exports"` conditions for the resolver to match — `"module"` being
the common one in bundler projects. It requires `moduleResolution` to be
`node16`, `nodenext` or `bundler`; anything else produces `TS5098`.

**What is the single sentence that separates the four strategies?**
Whether the strategy can read `package.json` `"exports"` and `"imports"`. In the
compiler it is literally one predicate covering `node16` through `nodenext` plus
`bundler`; everything else about the four is detail on top of that split.

**Your `#internal/*` import resolves to a file in `dist/`. What is wrong?**
`rootDir` is not set. When `"imports"` is resolved from the local project's own
`package.json`, TypeScript has to remap the resolved output path back to the
input file that produces it, and that remapping needs `rootDir`/`outDir`. Without
it, the current build takes the previous build's output as a dependency.

**Is `bundler` allowed with `"module": "commonjs"`?**
It depends on the compiler version, which is itself the interesting answer. Under
TypeScript 5.9 it is not — `TS5095` names only `preserve` and `es2015` or later.
The 7.0 message adds `commonjs`, so the pairing is legal there. The documentation
is narrower than both and names only `esnext` and `preserve`.

**If `bundler` models bundlers, why does `tsc` still disagree with mine
sometimes?**
Because it models what bundlers have *in common*. Aliases, resolve plugins,
custom extensions and framework-specific conventions live in the bundler's own
config and TypeScript never sees them. `bundler` removes the systematic
disagreement about `"exports"` and extensionless paths; the project-specific
disagreements are still yours to keep in sync.

**Why does the handbook's bundler config set `noEmit`?**
Because under a bundler `tsc` has no emit job — the bundler produces the
JavaScript. That also unlocks `allowImportingTsExtensions`, which the compiler
refuses outside `noEmit`/`emitDeclarationOnly` precisely because a `.ts`
specifier in emitted JavaScript would not resolve at runtime.

---

← [05 · The Node resolver](./05-the-node-resolver.md) · Next → [07 · The defaults you did not set](./07-the-defaults-you-did-not-set.md)
