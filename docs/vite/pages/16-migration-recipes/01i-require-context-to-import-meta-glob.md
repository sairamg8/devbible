---
title: "require.context and import.meta.glob Share the Same Constraint That Broke Both — Every Argument Must Be a Literal the Bundler Can Read at Compile Time, Not a Value Your Code Computes"
sidebar_label: "01i · require.context → import.meta.glob"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Features § Glob Import](https://vite.dev/guide/features). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · webpack 5.110.3**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ `require.context` → `import.meta.glob`

**This is the single most common hard blocker in a real webpack-to-Vite migration**, because
`require.context` is how a huge number of codebases implement "load every file matching a
pattern" — route tables built from a `pages/` directory, locale bundles, icon registries,
Storybook story discovery — and unlike a loader or a `splitChunks` config, this one usually
shows up as application source, not build config, so it is easy to miss until the app fails
to boot.

## The direct mapping

```javascript
// BEFORE — webpack. require.context(directory, useSubdirectories, regExp)
const context = require.context('./locales', false, /\.json$/);
const locales = {};
context.keys().forEach((key) => {
  locales[key] = context(key);
});
```

```typescript
// AFTER — Vite. Eager: true gives a plain object of already-resolved modules,
// mirroring the "load everything now" behaviour the webpack code above wrote by hand.
const locales = import.meta.glob('./locales/*.json', { eager: true });
```

The default (no `eager`) is **lazy** — each value is an async import function, not the module
itself, and matched files are code-split at build time:

```typescript
// Lazy form: values are () => Promise<Module>, not the module.
const locales = import.meta.glob('./locales/*.json');

async function loadLocale(path: string) {
  const mod = await locales[path](); // dynamic import happens HERE, not at startup
  return mod.default;
}
```

That default is the opposite of `require.context`'s behaviour, which loaded everything
synchronously and eagerly the moment the context was created. A naive port that keeps the
webpack-shaped loop but drops `eager: true` compiles cleanly and then hands the rest of the
code a map of *functions* where it expected data — the bug is a type error at best and a
silent object-in-place-of-string bug at worst, depending on how loosely typed the call site
is.

## Options, mapped from what webpack's third argument did

| webpack `require.context` argument | Vite `import.meta.glob` option |
|---|---|
| the `regExp` filter (3rd arg) | the glob pattern itself, e.g. `'./locales/*.json'` |
| `useSubdirectories` (2nd arg) | `'./locales/**/*.json'` (glob recursion) vs `'./locales/*.json'` |
| implicit eager load | `{ eager: true }` |
| picking one export of each module | `{ import: 'default' }` |

> *"Matched files are by default lazy-loaded via dynamic import and will be split into
> separate chunks during build. If you'd rather import all the modules directly … you can
> pass `{ eager: true }` as the second argument"* — [Features](https://vite.dev/guide/features)

> *"It's possible to only import parts of the modules with the `import` options."* Setting
> `import` to `'default'` imports only the default export, flattening the value further:

```typescript
// Only the default export of each module, eagerly — the map is { path: Component }
// rather than { path: { default: Component } }.
const pages = import.meta.glob('./pages/*.tsx', { eager: true, import: 'default' });
```

### The `query` option — importing assets, not modules, from a glob

`require.context` only ever gave you modules. `import.meta.glob`'s `query` option can ask
for a raw string or a URL instead, which is useful for the asset-manifest style of
`require.context` usage (icon paths, not icon components):

> *"You can also use the `query` option to provide queries to imports, for example, to import
> assets as a string or as a url"* — [Features](https://vite.dev/guide/features)

```typescript
const iconUrls = import.meta.glob('./icons/*.svg', { eager: true, query: '?url', import: 'default' });
```

## The constraint that fails silently: the pattern must be a literal

Both APIs share the exact same limitation, and it is the reason a `require.context` port is
never fully mechanical.

> *"You should also be aware that all the arguments in the `import.meta.glob` must be
> **passed as literals**. You can NOT use variables or expressions in them."* —
> [Features](https://vite.dev/guide/features)

```typescript
// ❌ Fails SILENTLY. The pattern is not statically analysable, so it is not
// rewritten at all — glob returns an empty object, not an error.
function loadFeature(name: string) {
  return import.meta.glob(`./features/${name}/*.ts`); // ⛔ template literal with a variable
}

// ✅ Glob the fixed superset, select at runtime instead.
const allFeatures = import.meta.glob('./features/*/*.ts');
function loadFeature(name: string) {
  return allFeatures[`./features/${name}/index.ts`]?.();
}
```

`require.context`'s regex argument had the same requirement — it had to be a literal
`RegExp` webpack's loader could read out of the AST — so a codebase that already worked under
webpack has, by construction, never relied on a computed pattern. The risk in a migration is
not that working code breaks; it is that someone "cleans up" the port into a helper function
that takes the pattern as a parameter, at which point it silently stops working, and nothing
in the type system or the build catches it.

## Common `require.context` idioms and their glob shape

```typescript
// Route table from a pages/ directory — eager, default export, recursive.
const routes = import.meta.glob('./pages/**/*.tsx', { eager: true, import: 'default' });

// Storybook-style story discovery — lazy is fine, nothing needs it at startup.
const stories = import.meta.glob('./**/*.stories.tsx');

// Icon registry keyed by filename, values are raw SVG source as a string.
const icons = import.meta.glob('./icons/*.svg', { eager: true, query: '?raw', import: 'default' });
```

---

## Gotchas

**★ Symptom: `import.meta.glob` returns `{}` and no error appears anywhere.** Cause: the pattern argument is not a literal — a template literal with an interpolated variable, a variable holding the whole string, or a pattern built by string concatenation. This is a compile-time rewrite, not a runtime call, so an unanalysable argument is simply skipped rather than rejected. Fix: glob the widest fixed pattern that covers every case and index into the result at runtime with the dynamic part.

**★ Symptom: code that expects module objects gets handed functions instead, and the failure looks like "`.default` is undefined on a function".** Cause: `import.meta.glob` defaults to **lazy** — every value is `() => Promise<Module>` — and a straight port of eager `require.context` code forgot `{ eager: true }`. Fix: add `eager: true` if the original code's whole point was synchronous access, or `await` the function and keep the laziness if it was accidental.

**★ Symptom: after porting, every glob'd module import includes an extra `.default` layer that was not there before.** Cause: `require.context`'s per-key call returned whatever the module exported directly in common CJS-interop setups, while `import.meta.glob`'s default returns the full ESM module namespace object (`{ default: ..., ...named }`). Fix: pass `{ import: 'default' }` when the original code only ever wanted the default export — this is the option, not a manual `.default` unwrap at every call site.

**★ Symptom: a route table built with `import.meta.glob('./pages/**/*.tsx')` includes test files and stories that `require.context`'s regex used to exclude.** Cause: `require.context`'s third argument was a `RegExp` that could exclude with a negative lookahead; a glob pattern's exclusion vocabulary is different (a second, negated pattern, or a narrower positive pattern). Fix: either narrow the glob (`'./pages/**/*.page.tsx'` if such a naming convention exists) or maintain an explicit exclude list — do not assume the glob's default matching is equivalent to the old regex's.

**★ Symptom: a code reviewer "refactors" a `import.meta.glob` call into a helper function parameterised by the pattern, and it silently breaks in a later PR.** Cause: passing the pattern through a variable defeats the literal-argument requirement, and there is no lint rule in a typical setup that catches it — the code type-checks and runs, it just globs nothing. Fix: keep the `import.meta.glob` call itself un-abstracted at the call site; wrap the *result*, never the pattern, in a helper.

---

## Interview questions

**★ Why is `require.context` singled out as the hardest part of a webpack-to-Vite port, when it looks like a one-line swap?**
Because it is application source, not build config, so a migration audit that greps
`webpack.config.js` for the things that need porting never sees it — it is scattered through
`src/`, often inside a helper someone wrote years ago and forgot the mechanism of. The swap
itself, `require.context(dir, sub, regex)` → `import.meta.glob(pattern, opts)`, is mechanical
once you have found every call site; the actual work is finding them all and checking each
one's eagerness assumption, because the default laziness is the opposite of what
`require.context` did.

**★ `import.meta.glob` with a computed path returns an empty object instead of throwing. Why design it that way, and what does it imply for how you write migration code?**
Because `import.meta.glob` is not a function call at runtime at all — it is rewritten by the
bundler at compile time into a set of static imports, the same way `require.context` was
read directly out of the AST by webpack's loader rather than executed. A pattern the bundler
cannot statically read has nothing to rewrite into, so the call becomes, in effect, a glob
over zero files rather than a runtime error. The implication is that you cannot detect this
class of mistake by testing the happy path — it demands either code review discipline (never
parameterise the pattern itself) or treating an empty result from a glob as suspicious enough
to check by hand during migration.

**★ How do you decide between the lazy and eager forms when porting a `require.context` call, when the original code gives no explicit signal either way?**
Ask what the code did with the result immediately after creating the context. If it iterated
every key and used the value right away — building a route table, a locale dictionary, an
icon map that the app reads throughout its lifetime — that is eager behaviour and needs
`{ eager: true }`, because those values were never meant to be deferred. If it only looked up
one key at a time, on demand (a lazily-loaded feature module, a code-split settings panel),
the lazy default is correct and is in fact a strict improvement — the webpack version was
eagerly bundling everything the context matched whether or not a given code path was ever
reached, and the Vite default naturally code-splits it.

---

← [01h · devServer → server](01h-devserver-and-resolve.md) · [Vite overview](../../README.md) · Next → [01j · CommonJS in app source](01j-commonjs-in-application-source.md)
