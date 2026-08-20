---
title: "The transform pipeline"
sidebar_label: "02 · The transform pipeline"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the [Jest configuration reference](https://jestjs.io/docs/configuration)
> (`transform`, `transformIgnorePatterns`, `cache`, `cacheDirectory`), the
> [Jest ECMAScript Modules guide](https://jestjs.io/docs/ecmascript-modules), and the
> [`@swc/jest`](https://swc.rs/docs/usage/jest) and [`ts-jest`](https://kulshekhar.github.io/ts-jest/)
> documentation. **No sandbox, no console blocks.**

**Node cannot execute your source.** It has TypeScript annotations, JSX, and `import`
statements in files Node may treat as CommonJS. Something must rewrite it first, per file,
on the way in. That something is the transform pipeline, and it produces the single most
misdiagnosed error in the whole of Jest.

---

## `transform`

| Option | Default |
|---|---|
| `transform` | `{"\\.[jt]sx?$": "babel-jest"}` |

A map of **regex → transformer**, optionally with options:

```js
transform: {
  '^.+\\.(t|j)sx?$': ['@swc/jest', { /* swc options */ }],
},
```

⚠️ **Setting `transform` replaces the default entirely.** Map every extension you need,
including plain `.js` — a config that maps only `\\.tsx?$` leaves JavaScript files
untransformed, and they fail the moment one contains JSX or ESM syntax.

### Choosing a transformer

| Transformer | Type-checks? | Speed | Use when |
|---|---|---|---|
| `babel-jest` | no | slowest | Already on Babel — it reads your `babel.config.js`, so tests compile exactly like the app |
| `ts-jest` | **yes**, by default | slowest | You want type errors to fail the test run |
| `@swc/jest` | no | fastest — Rust, single-file | Default choice for a TypeScript project without a Babel config |

🔴 **Type-checking during tests is usually the wrong trade.** It makes every run pay for
work `tsc --noEmit` does once in CI, far faster and across the whole program rather than
per file. **Check types in CI as their own step, and let the test transformer only
strip.** `ts-jest` supports `isolatedModules` for exactly this.

⚠️ Whichever you pick, **single-file transformers cannot see across files.** That is why
`const enum` and certain `export =` forms misbehave under SWC and Babel but work under a
full `tsc` — the same constraint TypeScript's own `isolatedModules` flag describes.

---

## 🔴 `transformIgnorePatterns` — the ESM error

| Option | Default |
|---|---|
| `transformIgnorePatterns` | `["/node_modules/", "\\.pnp\\.[^\\\\]+$"]` |

**By default Jest does not transform anything in `node_modules`.** That was fine when
every package shipped CommonJS. It is not fine now — a growing number ship ESM only, and
the moment your code imports one:

```
SyntaxError: Cannot use import statement outside a module
```

**Read that error carefully: it names a file inside `node_modules`, not your file.** That
is the whole diagnosis. Your code is fine; a dependency arrived untransformed because the
default pattern told Jest to skip it.

### The fix is a negative lookahead

```js
transformIgnorePatterns: [
  'node_modules/(?!(nanoid|uuid|@myorg/ui)/)',
],
```

Read it as *"ignore `node_modules`, **except** these"*. Points that catch people:

- **No leading slash** once you use the lookahead form, or the pattern stops matching the
  way you expect.
- **List every offender**, and note that a nested dependency needs its own entry — the
  path being tested is the real one on disk.
- **This is not free.** Each un-ignored package is now transformed on every cold run.
  Prefer a package's CJS build if it ships one.

### The three fixes ranked

1. **Map it away.** If the package is incidental (an icon set, a UUID generator), a
   `moduleNameMapper` stub is faster than transforming it —
   [chunk 03](./03-module-resolution.md).
2. **Un-ignore it** with the lookahead above. The general answer.
3. **Turn on native ESM** — `--experimental-vm-modules` plus `extensionsToTreatAsEsm`.
   Genuinely more involved, and the reason many teams reach for Vitest instead; it is a
   supported path, not a hack, but it changes mocking ergonomics.

---

## The cache

| Option | Default |
|---|---|
| `cache` | `true` |
| `cacheDirectory` | a temp directory |

Transform output is cached, keyed on file contents **and** on the transformer's own
configuration. Change `jest.config.ts` and the cache invalidates correctly.

🔴 **It does not always invalidate on a `babel.config.js` change reached indirectly**, and
it will not notice that you edited a transformer's plugin in `node_modules`. When output
looks impossibly stale:

```bash
npx jest --clearCache
```

⚠️ **`--clearCache` is a diagnostic, not a fix.** If it "fixes" the build in CI, the real
bug is a cache directory shared between differently-configured runs — often a CI cache
key that omits the config file's hash. Never leave `--clearCache` in a CI script: it
throws away the largest single speed win Jest has.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot use import statement outside a module`, pointing **inside `node_modules`** | The package is ESM-only and `transformIgnorePatterns` skipped it | Negative lookahead for that package |
| The same error pointing at **your own file** | Not this option at all — your file was not matched by any `transform` regex | Widen the `transform` key |
| `.js` files break after adding a TS-only transform | `transform` **replaces** the default; JS is now untransformed | Match `^.+\\.(t\|j)sx?$` |
| `Unexpected token '<'` | JSX reaching a transformer not configured for it | Enable the JSX/TSX parser in the transformer's options |
| The lookahead pattern still does not work | A **nested** dependency is the ESM one, not the one you named | Read the path in the error and add that package |
| Tests slow to a crawl after fixing the ESM error | Every listed package now transforms each cold run | Map trivial ones away instead |
| `const enum` behaves oddly | Single-file transformers cannot see across files | Avoid `const enum`, or type-check separately with `tsc` |
| Type errors never fail the run | SWC and Babel only strip types | A separate `tsc --noEmit` step — the correct place for it |
| Stale output that only `--clearCache` fixes | Cache key missed a config change reached indirectly | Fix the CI cache key to include the config hash; do not ship `--clearCache` |
| CI is fast on one branch, slow on another | Cache miss from a lockfile or config difference | Include both in the cache key |

---

## Interview questions

**Q. Walk through `Cannot use import statement outside a module`.**
A file reached Node as ESM syntax without being transformed. The path in the message says
whose fault it is: inside `node_modules` means `transformIgnorePatterns` skipped an
ESM-only dependency; inside your source means no `transform` regex matched the file.

**Q. Why does `transformIgnorePatterns` default to ignoring `node_modules`?**
Speed. Dependencies were historically pre-compiled CommonJS, so transforming them was
pure waste. The default has aged badly as packages went ESM-only.

**Q. Explain `node_modules/(?!(nanoid|uuid)/)`.**
A negative lookahead: match paths under `node_modules` **except** those continuing with
`nanoid/` or `uuid/`, so those two are the only dependencies transformed.

**Q. `@swc/jest` vs `ts-jest` vs `babel-jest`?**
SWC is a Rust type-stripper, fastest, no type checking. `ts-jest` runs the TypeScript
compiler and can type-check, at a large per-file cost. `babel-jest` is the default and
reuses your Babel config, which is the strongest argument for it when one exists.

**Q. Should the test run type-check?**
Generally no. `tsc --noEmit` checks the whole program once, faster than per-file checking
across hundreds of files, and keeps a type error from being reported as a test failure.

**Q. Why can a single-file transformer break `const enum`?**
Inlining a `const enum` requires knowing its declaration in another file. Single-file
transformers see one file at a time — the same limitation TypeScript's `isolatedModules`
flag exists to warn about.

**Q. What invalidates the transform cache?**
File contents plus the transformer configuration. Changes reached indirectly can be
missed, which is when `--clearCache` helps — as a diagnostic, never as a permanent CI
step.

**Q. Your dependency ships ESM only. Three options?**
Stub it via `moduleNameMapper` if its behaviour does not matter; un-ignore it in
`transformIgnorePatterns`; or enable native ESM with `--experimental-vm-modules` and
`extensionsToTreatAsEsm`.

**Q. Why is this pain the strongest practical argument for Vitest?**
Vitest is ESM-first and runs dependencies through Vite's own pipeline, so an ESM-only
package needs no equivalent of this option at all.

---

← **Prev:** [01 · Discovery and environments](./01-discovery-and-environments.md) ·
**Next:** [03 · Module resolution](./03-module-resolution.md)
