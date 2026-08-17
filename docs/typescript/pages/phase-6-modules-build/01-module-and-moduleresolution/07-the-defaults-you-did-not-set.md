---
title: "The defaults you did not set"
sidebar_label: "07 · The defaults you did not set"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. **This chunk is read from the compiler, not from
> documentation.** The `_computedOptions` table in the installed **TypeScript
> 5.9.3** build supplies every default below — the `moduleResolution`, `target`
> and `module` `computeValue` functions, quoted as they are written.
> Corroborated by the **TypeScript handbook**, *Modules — Reference*.
> **No sandbox, no console block.**

Almost nobody sets all of `target`, `module`, `moduleResolution` and
`esModuleInterop`. The compiler fills in the rest, and **the rule it uses is not
a constant — it is a chain**, where each default is computed from another option
that may itself be a default.

This is where the bugs live.

## The chain, in the compiler's own code

`moduleResolution`'s default, in full:

```js
moduleResolution: {
  dependencies: ["module", "target"],
  computeValue: (compilerOptions) => {
    let moduleResolution = compilerOptions.moduleResolution;
    if (moduleResolution === void 0) {
      switch (_computedOptions.module.computeValue(compilerOptions)) {
        case 1 /* CommonJS */:   moduleResolution = 2  /* Node10   */; break;
        case 100 /* Node16 */:
        case 101 /* Node18 */:
        case 102 /* Node20 */:   moduleResolution = 3  /* Node16   */; break;
        case 199 /* NodeNext */: moduleResolution = 99 /* NodeNext */; break;
        case 200 /* Preserve */: moduleResolution = 100 /* Bundler */; break;
        default:                 moduleResolution = 1  /* Classic  */; break;
      }
    }
    return moduleResolution;
  }
}
```

🔴 **Read the `default:` branch again.** Every `module` value that is not
`commonjs`, not in the Node family and not `preserve` — that is `es2015`,
`es2020`, `es2022`, `esnext`, `amd`, `umd`, `system` and `none` — falls through to
**`classic`**, the strategy that never looks in `node_modules`
([chunk 04](./04-every-resolution-strategy.md)).

## The table you should memorise

| `module` | implied `moduleResolution` |
|---|---|
| `commonjs` | `node10` |
| `node16`, `node18`, `node20` | `node16` |
| `nodenext` | `nodenext` |
| `preserve` | `bundler` |
| **`es2015`, `es2020`, `es2022`, `esnext`, `amd`, `umd`, `system`, `none`** | 🔴 **`classic`** |

Two of those rows are traps rather than conveniences:

- **`esnext` → `classic`.** The modern-looking setting gets the ancient
  resolver. Every bundler project that sets `module` and forgets
  `moduleResolution` is here.
- **`commonjs` → `node10`.** The legacy setting gets the legacy resolver, which
  is at least consistent — but `node10` cannot read `"exports"`, so a project
  that only ever set `"module": "commonjs"` has silently been resolving modern
  packages by guesswork.

📌 The other three rows are the design working: choose a `module` that describes
a real host, and the matching resolver arrives for free. The trap rows are
exactly the values that describe *no* host — `esnext` says "ES modules" without
saying who loads them, so there is nothing for the compiler to infer.

## `target` and `module` default from each other

They genuinely do, and the resolution of that apparent circle is worth
understanding because it explains an otherwise baffling behaviour.

```js
target: {
  dependencies: ["module"],
  computeValue: (compilerOptions) => {
    const target = compilerOptions.target === 0 /* ES3 */ ? void 0 : compilerOptions.target;
    return target ?? (compilerOptions.module === 100 /* Node16 */   && 9  /* ES2022 */
                   || compilerOptions.module === 101 /* Node18 */   && 9  /* ES2022 */
                   || compilerOptions.module === 102 /* Node20 */   && 10 /* ES2023 */
                   || compilerOptions.module === 199 /* NodeNext */ && 99 /* ESNext */
                   || 1 /* ES5 */);
  }
},
module: {
  dependencies: ["target"],
  computeValue: (compilerOptions) =>
    typeof compilerOptions.module === "number"
      ? compilerOptions.module
      : _computedOptions.target.computeValue(compilerOptions) >= 2 /* ES2015 */
        ? 5 /* ES2015 */
        : 1 /* CommonJS */
}
```

📌 **The circle breaks because they do not consult each other symmetrically.**
`target` reads the **raw** `compilerOptions.module`; `module` reads the
**computed** `target`. So if you set neither, `target` sees `undefined`, falls
through to `ES5`, and `module` then sees `ES5 < ES2015` and picks `CommonJS`. No
recursion, one fixed point.

⚠️ That asymmetry has a consequence people never expect: **`target`'s default
does not benefit from `module`'s default.** If `module` is unset, `target` sees
`undefined` in all four of those comparisons and lands on ES5 — even though
`module` is about to be computed as `es2015`. The two are not made consistent
with each other; they are each computed once, in an order.

**Implied `target` by `module`:**

| `module` | implied `target` |
|---|---|
| `node16` | `es2022` |
| `node18` | `es2022` |
| **`node20`** | **`es2023`** |
| `nodenext` | `esnext` (floating) |
| anything else | `es5` |

⚠️ That is why bumping `node18` → `node20` changes downlevelling even though you
only touched one line. The setting you edited was not the only one that moved.

## What an empty `tsconfig.json` actually means

```jsonc
{ "compilerOptions": {} }
```

resolves, step by step, to:

```text
target                        → ES5        (no module set, so the fallback)
module                        → CommonJS   (because ES5 < ES2015)
moduleResolution              → Node10     (because module is CommonJS)
esModuleInterop               → false      (CommonJS is not in the list — chunk 08)
allowSyntheticDefaultImports  → false      (interop off, not System, not Bundler)
resolvePackageJsonExports     → false      (Node10 cannot support it)
```

🔴 **An empty config is a 2018 config.** Not a neutral one — a specific, dated
one, chosen for backward compatibility and frozen. Every "why does this modern
package not resolve" question that starts with a minimal `tsconfig.json` ends
here.

⚠️ And the same is close to true of a generated one: `tsc --init`'s
`moduleResolution` list is ordered with `node10` first, because *"The first entry
specifies the value shown in `tsc --init`"* — the comment is in the option record
itself. A freshly initialised project is not automatically a modern one.

## Gotchas

**`"module": "esnext"` alone silently selects `classic`.** *Symptom:* `TS2307`
on every installed package. *Cause:* the `default:` branch. *Fix:* add
`"moduleResolution": "bundler"`, or use `"module": "preserve"` which implies it.
This is the single most common configuration bug in this area.

**An empty `tsconfig.json` is not neutral.** *Symptom:* a brand-new project
cannot resolve a modern dependency's subpath. *Cause:* `{}` resolves to ES5 /
CommonJS / node10 — a 2018 configuration. *Fix:* set `module` explicitly.

**`tsc --init` does not give you a modern resolver.** *Symptom:* a
freshly-initialised project behaves like a legacy one. *Cause:* `node10` is the
first entry in the option's value map, and that is what `--init` shows. *Fix:*
change it. Being generated by the compiler is not the same as being current.

**Bumping `node18` → `node20` changes your emitted syntax.** *Symptom:*
downlevelling differences in a commit that only touched `module`. *Cause:* the
implied `target` moves `es2022` → `es2023`. *Fix:* set `target` explicitly if you
need it pinned — an explicit value always beats an implied one.

**`target` does not default from `module`'s default.** *Symptom:* a config
setting only `moduleResolution` still emits ES5. *Cause:* `target` reads the raw
`module`, which is unset, so none of its four comparisons match. *Fix:* set
`module` — which is the option that actually drives the chain.

**`target: "es3"` is treated as unset.** *Symptom:* a config that names ES3 and
does not behave like the lowest possible target. *Cause:* the compiler maps ES3
to `undefined` at the top of `target`'s `computeValue`; ES3 support was removed
in TypeScript 5.0. *Fix:* nothing, but do not read `"es3"` in an old config as
meaningful.

**"It worked before we upgraded TypeScript" can be an implied-default change.**
*Symptom:* behaviour moves with no config change. *Cause:* `nodenext` implies a
floating `target`, and a new compiler can imply a different one. *Fix:* pin the
values you depend on; `nodenext` is a promise to track, not a promise to freeze.

**Copying half a config is worse than copying none.** *Symptom:* a config with
`module` from one blog post and `moduleResolution` from another. *Cause:* the
chain means the two lines are not independent, so a mix of two coherent configs
is usually incoherent. *Fix:* take a whole recipe
([chunk 11](./11-choosing-and-migrating.md)) rather than assembling one.

## Interview questions

**What `moduleResolution` do you get if you set `"module": "esnext"` and nothing
else?**
`classic` — the strategy that never searches `node_modules`. It is the
fall-through branch for every `module` value outside `commonjs`, the Node family
and `preserve`. It is also why the correct bundler config has two lines, or one
line that says `preserve`.

**What does an empty `tsconfig.json` compile as?**
Target ES5, module CommonJS, resolution node10, `esModuleInterop` off,
`"exports"` unread. Not a neutral configuration — a specific and dated one, kept
that way for backward compatibility.

**`target` defaults from `module` and `module` defaults from `target`. How is
that not infinite?**
Because the dependency is asymmetric. `target` reads the *raw* `module` value —
whatever the user literally wrote — while `module` reads the *computed* `target`.
With neither set, `target` sees `undefined`, falls to ES5, and `module` then
picks CommonJS. One pass, one fixed point.

**Why is `esnext` the value that gets the worst default?**
Because it is the only common value that describes an output format without
describing a host. `commonjs`, the Node family and `preserve` each imply
something about who loads the code, so the compiler can infer a matching
resolver. `esnext` says "ES modules" and nothing about who reads them, so there
is nothing to infer and it falls through.

**Someone bumps `"module"` from `node18` to `node20` and the emitted JavaScript
changes shape. Why?**
Because the implied `target` moved from `es2022` to `es2023`. The two options are
chained, so a one-line change to `module` silently changed downlevelling.
Explicitly setting `target` prevents it.

**How would you audit a `tsconfig.json` you have just inherited?**
Write out the four load-bearing values — `module`, `moduleResolution`, `target`,
`esModuleInterop` — *including the ones nobody set*, resolved through the chain.
Then check each against what actually runs the code. Most legacy configs turn out
to be `commonjs`/`node10`/`es5` with an interop flag someone added to silence one
error, and the resolution strategy is the line worth changing first.

**Is a config generated by `tsc --init` a good starting point?**
For the strict flags, yes. For modules, no — its `moduleResolution` suggestion is
`node10`, because that is the first entry in the compiler's value map and the
`--init` output takes the first entry. Set `module` yourself and let the chain do
the rest.

---

← [06 · The bundler resolver](./06-the-bundler-resolver.md) · Next → [08 · Implied, enforced, and incompatible](./08-implied-and-enforced.md)
