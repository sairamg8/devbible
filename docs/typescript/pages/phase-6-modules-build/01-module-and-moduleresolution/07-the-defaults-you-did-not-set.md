---
title: "The defaults you did not set"
sidebar_label: "07 · The defaults you did not set"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. **This chunk is read from the compiler, not from
> documentation.** The `_computedOptions` table in the installed **TypeScript
> 5.9.3** build supplies every default below — the `target`, `module`,
> `moduleResolution`, `esModuleInterop`, `allowSyntheticDefaultImports` and
> `resolvePackageJsonExports` `computeValue` functions, quoted as they are
> written. `TS5095`, `TS5109` and `TS5110` are verbatim from the same build's
> message table, cross-checked in the **7.0.2** native binary. The implied-option
> statements are corroborated by the **TypeScript handbook**, *Modules —
> Reference*. **No sandbox, no console block.**

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

**Implied `target` by `module`:**

| `module` | implied `target` |
|---|---|
| `node16` | `es2022` |
| `node18` | `es2022` |
| **`node20`** | **`es2023`** |
| `nodenext` | `esnext` (floating) |
| anything else | `es5` |

⚠️ That is why bumping `node18` → `node20` changes downlevelling even though
you only touched one line. The setting you edited was not the only one that
moved.

## `esModuleInterop` and its shadow

```js
esModuleInterop: {
  computeValue: (compilerOptions) => {
    if (compilerOptions.esModuleInterop !== void 0) return compilerOptions.esModuleInterop;
    switch (_computedOptions.module.computeValue(compilerOptions)) {
      case 100: case 101: case 102: case 199: case 200: return true;  // node16/18/20/nodenext/preserve
    }
    return false;
  }
}
```

So `esModuleInterop` is **on** for the Node family and `preserve`, **off**
everywhere else — including `esnext`. And `allowSyntheticDefaultImports`, which
governs only what the *checker* permits, is wider still:

```js
allowSyntheticDefaultImports: {
  computeValue: (compilerOptions) => {
    if (compilerOptions.allowSyntheticDefaultImports !== void 0) return compilerOptions.allowSyntheticDefaultImports;
    return _computedOptions.esModuleInterop.computeValue(compilerOptions)
        || _computedOptions.module.computeValue(compilerOptions) === 4 /* System */
        || _computedOptions.moduleResolution.computeValue(compilerOptions) === 100 /* Bundler */;
  }
}
```

📌 Note the third clause: **`moduleResolution: bundler` turns on
`allowSyntheticDefaultImports` by itself**, which is the handbook's *"implies
`--allowSyntheticDefaultImports`"* seen from the inside. `system` gets it too,
for historical reasons nobody needs today.

And `resolvePackageJsonExports` is gated before it is defaulted — if the
strategy cannot support `"exports"` at all, the option is forced to `false`
regardless of what you wrote. Setting it to `true` under `node10` is not an
error; it is simply ignored.

## What an empty `tsconfig.json` actually means

```jsonc
{ "compilerOptions": {} }
```

resolves, step by step, to:

```text
target                        → ES5        (no module set, so the fallback)
module                        → CommonJS   (because ES5 < ES2015)
moduleResolution              → Node10     (because module is CommonJS)
esModuleInterop               → false      (CommonJS is not in the list)
allowSyntheticDefaultImports  → false      (interop off, not System, not Bundler)
resolvePackageJsonExports     → false      (Node10 cannot support it)
```

🔴 **An empty config is a 2018 config.** Not a neutral one — a specific, dated
one, chosen for backward compatibility and frozen. Every "why does this modern
package not resolve" question that starts with a minimal `tsconfig.json` ends
here.

## "Implied and enforced" is stronger than "defaulted"

Some of these are defaults you can override. Some are not.

> `--module nodenext` implies and enforces `--moduleResolution nodenext`.

> `--module node18` or `node16` implies and enforces `--moduleResolution node16`.

Writing `"module": "nodenext", "moduleResolution": "bundler"` is not a
configuration — it is an error:

```text
TS5109  Option 'moduleResolution' must be set to '{0}' (or left unspecified)
        when option 'module' is set to '{1}'.

TS5110  Option 'module' must be set to '{0}' when option 'moduleResolution' is
        set to '{1}'.
```

Note that the pair is symmetric: one fires when the `module` is Node-family and
the resolution is not, the other when the resolution is Node-family and the
module is not. Whichever you get, the fix is the same — make them match.

And the third member of the family, which is *not* symmetric:

```text
TS5095  Option '{0}' can only be used when 'module' is set to 'preserve' or to
        'es2015' or later.
```

That one fires on `moduleResolution: "bundler"` with an incompatible `module`.
⚠️ In **7.0.2** its text reads *"…'preserve', 'commonjs', or 'es2015' or
later."* — TypeScript 7 widened the accepted set
([chunk 06](./06-the-bundler-resolver.md)).

## The rule that follows from all of this

**Set `module` explicitly, and let `moduleResolution` follow — unless you are
using a bundler, in which case set both.**

```jsonc
// Node — one line is genuinely enough
{ "compilerOptions": { "module": "nodenext" } }

// A bundler — two lines, because `esnext` alone would give you `classic`
{ "compilerOptions": { "module": "esnext", "moduleResolution": "bundler" } }

// A bundler, alternative — one line, because `preserve` implies `bundler`
{ "compilerOptions": { "module": "preserve" } }
```

📌 That third form is the tidiest bundler config there is, and it is the reason
`preserve`'s implication is worth knowing rather than merely reading.

## Gotchas

**`"module": "esnext"` alone silently selects `classic`.** *Symptom:* `TS2307`
on every installed package. *Cause:* the `default:` branch. *Fix:* add
`"moduleResolution": "bundler"`, or use `"module": "preserve"` which implies it.
This is the single most common configuration bug in this area.

**An empty `tsconfig.json` is not neutral.** *Symptom:* a brand-new project
cannot resolve a modern dependency's subpath. *Cause:* `{}` resolves to ES5 /
CommonJS / node10 — a 2018 configuration. *Fix:* set `module` explicitly. `tsc
--init` writing `node10` as its first `moduleResolution` suggestion has the same
effect.

**Bumping `node18` → `node20` changes your emitted syntax.** *Symptom:*
downlevelling differences in a commit that only touched `module`. *Cause:* the
implied `target` moves `es2022` → `es2023`. *Fix:* set `target` explicitly if you
need it pinned — an explicit value always beats an implied one.

**`esModuleInterop` is off under `esnext` and on under `nodenext`.** *Symptom:*
a default import from a CommonJS package type-checks in one project and not
another with "the same" modern config. *Cause:* the interop default keys off the
`module` family, and `esnext` is not in it. *Fix:* set it explicitly if you care;
do not infer it from how modern the config looks.

**Setting `resolvePackageJsonExports: true` under `node10` does nothing and does
not warn.** *Symptom:* an option that appears to have no effect. *Cause:* the
computed value short-circuits to `false` when the strategy cannot support
`"exports"`, before your value is consulted. *Fix:* change the strategy; the flag
is not the lever.

**`TS5109` and `TS5110` look like two problems and are one.** *Symptom:* a
confusing pair of errors about `module` and `moduleResolution`. *Cause:* they are
the two directions of the same mismatch. *Fix:* one edit resolves both — make the
Node-family setting appear on both lines, or on neither.

**"It worked before we upgraded TypeScript" can be an implied-default change.**
*Symptom:* behaviour moves with no config change. *Cause:* `nodenext` implies a
floating `target`, and a new compiler can imply a different one. *Fix:* pin the
values you depend on; `nodenext` is a promise to track, not a promise to freeze.

**Copying half a config is worse than copying none.** *Symptom:* a config with
`module` from one blog post and `moduleResolution` from another. *Cause:* the
chain means the two lines are not independent, so a mix of two coherent configs
is usually incoherent. *Fix:* take a whole recipe from the handbook
([chunk 10](./10-choosing-and-migrating.md)) rather than assembling one.

**`target: "es3"` is treated as unset.** *Symptom:* a config that names ES3 and
does not behave like the lowest possible target. *Cause:* the compiler maps ES3
to `undefined` in `target`'s `computeValue` before doing anything else — ES3
support was removed in TypeScript 5.0. *Fix:* nothing to fix, but do not read
`"es3"` in an old config as meaningful.

## Interview questions

**What `moduleResolution` do you get if you set `"module": "esnext"` and nothing
else?**
`classic` — the strategy that never searches `node_modules`. It is the fall-
through branch for every `module` value outside `commonjs`, the Node family and
`preserve`. It is also why the correct bundler config has two lines, or one line
that says `preserve`.

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

**What is the difference between an option being "implied" and being "implied
and enforced"?**
An implied option is a default you may override. An implied-and-enforced one you
may not: `module: nodenext` requires `moduleResolution: nodenext`, and writing
anything else is `TS5109` or `TS5110`, not a configuration choice.

**Why does `moduleResolution: bundler` switch on
`allowSyntheticDefaultImports`?**
Because bundlers synthesise a default export for CommonJS modules, so a default
import is legitimate under them. In the compiler it is a literal third clause in
`allowSyntheticDefaultImports`'s computed value, alongside `esModuleInterop`
being on and `module` being `system`.

**A colleague sets `resolvePackageJsonExports: true` under
`"moduleResolution": "node"`. What happens?**
Nothing. The computed value checks whether the strategy supports `"exports"`
*before* it reads the user's value, and returns `false` if it does not. No error,
no warning, no effect — which makes it a good example of why the strategy is the
lever and the flag is not.

**Someone bumps `"module"` from `node18` to `node20` and the emitted JavaScript
changes shape. Why?**
Because the implied `target` moved from `es2022` to `es2023`. The two options are
chained, so a one-line change to `module` silently changed downlevelling.
Explicitly setting `target` prevents it.

**How would you audit a `tsconfig.json` you have just inherited?**
Write out the four load-bearing values — `module`, `moduleResolution`, `target`,
`esModuleInterop` — including the ones nobody set, resolved through the chain.
Then check each against what actually runs the code. Most legacy configs turn out
to be `commonjs`/`node10`/`es5` with an interop flag someone added to silence one
error, and the resolution strategy is the line worth changing first.

---

← [06 · The bundler resolver](./06-the-bundler-resolver.md) · Next → [08 · Format detection, file by file](./08-format-detection.md)
