---
title: "Fourteen `NG_BUILD_*` variables exist, none of them is public API, and only `1`/`true` and `0`/`false` are recognised — so `NG_BUILD_TYPE_CHECK=yes` silently does nothing at all"
sidebar_label: "11b · The `NG_BUILD_*` surface"
sidebar_position: 11.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/build/src/utils/environment-options.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/environment-options.ts)
> at tag `v22.1.7`. Every description below is the file's own doc comment, quoted verbatim.
> ⚠️ **None of these variables appear in the workspace schema or on angular.dev** — they live in an
> internal `utils/` file, which is stated on this page rather than glossed over.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**These are the levers the build system exposes to the environment rather than to `angular.json`,
and the most important thing about them is what they are not: public API.** They are declared in an
internal utilities file, not in a schema and not in the documentation. They can change in a patch
release. A build script that depends on one is depending on an implementation detail — which is
sometimes exactly the right trade when you are debugging, and never a good foundation for a
pipeline. The cache and worker variables' behaviour is [11 · Cache and
workers](11-cache-and-workers.md).

## The whole surface at 22.1.7

| Variable | Effect (verbatim doc comment) |
|---|---|
| `NG_BUILD_MANGLE` | *"Allows disabling of code mangling when the `NG_BUILD_MANGLE` environment variable is set to `0` or `false`. This is useful for debugging build output."* |
| `NG_BUILD_DEBUG_OPTIMIZE` | Turns off mangle and minify and turns on beautify; accepts a comma list of `mangle`, `minify`, `beautify` to re-enable individually |
| `NG_BUILD_CHUNKS_ROLLDOWN` | *"Allows using Rolldown for chunk optimization instead of Rollup."* — default `true` |
| `NG_BUILD_OPTIMIZE_CHUNKS` | The lazy-chunk threshold; default `3`, `false`/`0` → `Infinity`, `true`/`1` → `0` |
| `NG_BUILD_MAX_WORKERS` | *"The maximum number of workers to use for parallel processing."* |
| `NG_BUILD_PARALLEL_TS` | *"When `NG_BUILD_PARALLEL_TS` is set to `0` or `false`, parallel TypeScript compilation is disabled."* |
| `NG_BUILD_TYPE_CHECK` | *"When `NG_BUILD_TYPE_CHECK` is set to `0` or `false`, type checking is disabled."* |
| `NG_BUILD_DEBUG_PERF` | *"When `NG_BUILD_DEBUG_PERF` is enabled, performance debugging information is printed."* |
| `NG_BUILD_WATCH_ROOT` | *"When `NG_BUILD_WATCH_ROOT` is enabled, the build will watch the root directory for changes."* |
| `NG_BUILD_LOGS_JSON` | *"When `NG_BUILD_LOGS_JSON` is enabled, build logs will be output in JSON format."* |
| `NG_BUILD_PARTIAL_SSR` | *"When `NG_BUILD_PARTIAL_SSR` is enabled, a partial server-side rendering build will be performed."* |
| `NG_BUILD_CACHE_STORE` | `lmdb`, `sqlite`, or automatic with an LMDB-to-SQLite fallback |
| `NG_HMR_CSTYLES` | *"When `NG_HMR_CSTYLES` is enabled, component styles will be hot-reloaded."* |
| `NG_HMR_TEMPLATES` | *"When `NG_HMR_TEMPLATES` is set to `0` or `false`, component templates will not be hot-reloaded."* |

Note the asymmetry in the last two: `NG_HMR_TEMPLATES` is described as something you turn **off**,
`NG_HMR_CSTYLES` as something you turn **on**. That is a real difference in their defaults, and it is
one of the three disagreeing sources on HMR scope discussed in
[05c · What HMR actually replaces](05c-what-hmr-actually-replaces.md).

## 🔴 The truthiness rule, and why it bites

```ts
/** A set of strings that are considered "truthy" when parsing environment variables. */
const TRUTHY_VALUES = new Set(['1', 'true']);

/** A set of strings that are considered "falsy" when parsing environment variables. */
const FALSY_VALUES = new Set(['0', 'false']);
```

`parseTristate` returns `undefined` for anything that is in neither set, and the value falls through
to the default. Beside it, the source carries its own note:

```ts
// TODO: Consider whether a warning is useful in this case of a malformed value
```

**So `NG_BUILD_TYPE_CHECK=yes` does nothing. `NG_BUILD_MANGLE=off` does nothing.
`NG_BUILD_MANGLE=FALSE` does nothing** — the sets are exact strings, so case matters too. There is
no warning, no error, and no output difference from not setting the variable at all. The build
behaves exactly as if you had never typed the line, which is the worst possible failure mode for a
debugging lever: you conclude the *option* does not work rather than that your *value* was not
recognised.

The only safe values:

```bash
NG_BUILD_TYPE_CHECK=0 ng build     # off
NG_BUILD_TYPE_CHECK=false ng build # off
NG_BUILD_MANGLE=1 ng build         # on
NG_BUILD_MANGLE=true ng build      # on
```

## The ones actually worth reaching for

**Reading unminified output.** `NG_BUILD_MANGLE=0` keeps names; `NG_BUILD_DEBUG_OPTIMIZE` goes
further by disabling mangle and minify and enabling beautify in one step, with a comma list to
re-enable pieces:

```bash
NG_BUILD_DEBUG_OPTIMIZE=beautify ng build --configuration production
```

**Finding where build time goes.** `NG_BUILD_DEBUG_PERF` prints performance debugging information —
the first thing to try before theorising about which stage is slow:

```bash
NG_BUILD_DEBUG_PERF=1 ng build
```

**Structured logs for a pipeline.** `NG_BUILD_LOGS_JSON` emits JSON, which is the difference between
grepping a build log and querying it:

```bash
NG_BUILD_LOGS_JSON=1 ng build
```

⚠️ That last one is a good illustration of the API warning: it is tempting to build pipeline
tooling on JSON logs, and the format has no stability guarantee whatsoever.

## Gotchas

**★ Symptom: `NG_BUILD_MANGLE=off` does not disable mangling, and no error appears.** Cause: only
`0` and `false` are falsy; everything else parses to `undefined` and falls through to the default.
Fix: use a recognised value:

```bash
NG_BUILD_MANGLE=0 ng build --configuration production
```

**★ Symptom: `NG_BUILD_TYPE_CHECK=FALSE` did not disable type checking.** Cause: the sets contain
the exact lowercase strings `'0'` and `'false'`, so case matters. Fix:

```bash
NG_BUILD_TYPE_CHECK=false ng build
```

**★ Symptom: a variable worked on one machine and not another, with the same command.** Cause: a
trailing space, a quoted value, or a `.env` loader adding quotes — anything that makes the string
something other than exactly `1`, `true`, `0` or `false`. Fix: print what the process actually sees
before blaming the build:

```bash
node -p "JSON.stringify(process.env.NG_BUILD_TYPE_CHECK)"
```

**★ Symptom: an upgrade silently changed build behaviour that an `NG_BUILD_*` variable was
controlling.** Cause: these are not public API — they live in an internal `utils/` file, appear in
no schema and no documentation page, and can change in a patch. Fix: express the intent in
`angular.json` where an equivalent option exists, and treat the variables as debugging levers only.

**★ Symptom: a pipeline that parsed `NG_BUILD_LOGS_JSON` output broke after a patch release.**
Cause: the JSON log format has no stability guarantee. Fix: same as above — the variable is fine for
interactive investigation, and a poor foundation for tooling.

**★ Symptom: `NG_HMR_CSTYLES` and `NG_HMR_TEMPLATES` seem to behave inconsistently.** Cause: they
genuinely do — templates default to hot-reloading and the variable turns it off, styles default off
and the variable turns it on. Fix: read the doc comments as written rather than assuming symmetry,
and see [05c](05c-what-hmr-actually-replaces.md) for why the sources disagree on HMR scope.

**★ Symptom: setting `NG_BUILD_OPTIMIZE_CHUNKS=true` produced far more aggressive chunking than
expected.** Cause: it is a threshold, not a boolean — `true`/`1` maps to `0`, meaning no threshold
at all, and `false`/`0` maps to `Infinity`. Fix: set the number you actually want:

```bash
NG_BUILD_OPTIMIZE_CHUNKS=5 ng build
```

**★ Symptom: you cannot find any of these documented on angular.dev.** Cause: they are not
documented there; they are declared in `packages/angular/build/src/utils/environment-options.ts`.
Fix: read that file for the version you are on — it is the only authority, and it changes.

## Interview questions

**★ What happens if you set `NG_BUILD_TYPE_CHECK=yes`?**
Nothing. The parser recognises exactly `'1'` and `'true'` as truthy and `'0'` and `'false'` as
falsy; anything else returns `undefined` and the value falls through to the default, with no warning
— the source even carries a `TODO` wondering whether a warning would be useful. This is worth
knowing because of how the failure presents: the build behaves identically to not setting the
variable, so the natural conclusion is that the feature does not work rather than that the value was
unrecognised. Case matters too, so `FALSE` fails the same way.

**★ Are the `NG_BUILD_*` variables safe to depend on in a pipeline?**
No. They are declared in an internal utilities file inside `@angular/build`, appear in neither the
workspace schema nor the documentation, and carry no stability guarantee — they can change in a
patch release. They are debugging levers: `NG_BUILD_DEBUG_PERF` to find where build time goes,
`NG_BUILD_MANGLE=0` or `NG_BUILD_DEBUG_OPTIMIZE` to read the output, `NG_BUILD_MAX_WORKERS` to work
around a container's CPU reporting. Where an equivalent exists in `angular.json`, that is the
supported expression of the same intent. `NG_BUILD_LOGS_JSON` is the most tempting one to build
tooling on and the clearest example of why not to.

**★ Which variable would you reach for first when a build is slow, and why that one?**
`NG_BUILD_DEBUG_PERF=1`, because it prints performance debugging information and replaces a guess
with a measurement. The instinct is usually to start turning things off — parallel TypeScript, type
checking, chunk optimization — which changes several variables at once and tells you little. Getting
the stage timings first means the next change is aimed at something. It also pairs naturally with
the cache and worker defaults, which are the usual answer in CI.

**Why does `NG_BUILD_OPTIMIZE_CHUNKS` behave oddly with boolean values?**
Because it is a threshold rather than a switch, and the boolean forms are mapped to the extremes:
`false` or `0` becomes `Infinity`, which effectively disables the optimization, and `true` or `1`
becomes `0`, which applies it with no threshold at all. Its default is `3`. Passing `true` expecting
"the normal amount, enabled" gets you the most aggressive setting available, which is the opposite of
the intent most people have when they type it.

{/* FOOTER */}
