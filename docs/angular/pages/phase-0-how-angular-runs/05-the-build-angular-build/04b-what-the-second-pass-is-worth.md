---
title: "The Rolldown pass runs only when three separate conditions all hold — script optimization on, at least three lazy chunks, and the Rolldown switch untouched — which is why your development and production chunk graphs are produced by different bundlers"
sidebar_label: "04b · What the second pass is worth"
sidebar_position: 4.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **`@angular/build` 22.1.7** — the source of
> [`src/utils/environment-options.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/environment-options.ts),
> [`src/builders/application/execute-build.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/execute-build.ts)
> and [`src/builders/application/chunk-optimizer.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/chunk-optimizer.ts),
> all read at tag `v22.1.7`; the `22.1.0` section of
> [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md); the
> `peerDependencies` of the published manifest at
> [registry.npmjs.org/@angular/build/22.1.7](https://registry.npmjs.org/@angular/build/22.1.7);
> and `addAppToWorkspaceFile()` in
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts).
> Source-validated; **no sandbox run** — no build was executed and no build output, size or timing
> is reproduced on this page.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The chunk optimizer is the most conditional thing in the Angular build: three independent gates,
none of them an `angular.json` option you would find by reading the schema, and failing any one of
them silently produces a different chunk graph.** Two of the three are environment variables in an
internal utility file, and their parsing is stranger than anyone guesses — `false` does not mean
false, `1` does not mean one, and a typo means *default*, not *off*. This chunk is those gates, the
arithmetic behind them, and the honest answer to "how much does the second pass actually save",
which is that no primary source will tell you.

## What the second pass is worth — read the hedging

Two claims exist about the benefit and both are hedged. Quote them rather than paraphrasing into
something stronger:

> *"This process can result in smaller and more efficient code by combining and restructuring the
> original chunks."*
> — [`chunk-optimizer.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/chunk-optimizer.ts)

> *"Advanced chunk optimization is most beneficial when there are multiple lazy chunks."*
> *"This avoids overhead for small projects with few chunks."*
> — [`execute-build.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/execute-build.ts)

And the release note that made Rolldown the implementation:

> *"| 585d08af8 | perf | default chunk optimization to use Rolldown |"*
> — [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md), section `# 22.1.0 (2026-07-29)`

🔴 **No source quantifies the saving.** *"Can result in smaller"* is the strongest wording that
exists anywhere, the changelog entry is a `perf` label with no figure attached, and there is no
sandbox behind this page. If you need a number for your application, measure your application: build
the same commit twice with `--output-hashing none`, once normally and once with
`NG_BUILD_OPTIMIZE_CHUNKS=0`, and compare. That differential is the only honest measurement
available to you, and it is also the reliable way to discover whether the pass was running at all.

The *shape* of the benefit is easier to reason about than its size. esbuild emits a chunk wherever a
module subgraph is shared between entry points — correct, and potentially granular. A second
bundling pass over those finished chunks is an opportunity to merge ones that are always loaded
together and to restructure the rest, which is exactly what *"combining and restructuring"* names,
and exactly why it needs *"multiple lazy chunks"* to have anything to work with.

## Gate 1 — `optimization.scripts` must be true

The `if` that wraps the whole pass is `if (options.optimizationOptions.scripts)`. Not
`optimization` as a whole: **the `scripts` sub-field specifically.**

That single fact explains the most common confusion about Angular chunk graphs, because the
`development` configuration `ng new` writes turns optimization off wholesale:

```json
"configurations": {
  "production": {
    "budgets": [
      { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
      { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
    ],
    "outputHashing": "all"
  },
  "development": {
    "optimization": false,
    "extractLicenses": false,
    "sourceMap": true
  }
}
```

`ng serve` defaults to the `development` configuration, so **the chunk optimizer never runs under
the development server.** The chunk graph you inspect while developing was produced by esbuild
alone; the one you deploy was produced by esbuild and then rebundled. They are the output of two
different bundlers and there is no reason to expect them to match.

The object form of `optimization` makes the gate sharper still. Turning script optimization off
while leaving styles alone also disables the pass, because the condition reads only `scripts`:

```json
"optimization": {
  "scripts": false,
  "styles": { "minify": true, "inlineCritical": true },
  "fonts": true
}
```

## Gate 2 — at least three lazy chunks

The count, from the call site:

```ts
const { metafile, initialFiles } = bundlingResult;
const lazyChunksCount = Object.keys(metafile.outputs).filter(
  (path) => path.endsWith('.js') && !initialFiles.has(path),
).length;
```

Two exclusions are worth reading off that filter directly. **It counts `.js` outputs only** — a
lazily-loaded stylesheet is not a lazy chunk for this purpose. And it counts **outputs not in
`initialFiles`**, so everything needed for the initial load is excluded no matter how many files it
is split across. An application with a large initial bundle and two lazy routes has a lazy chunk
count of two.

### The threshold, and the arithmetic behind it

From `environment-options.ts` at `v22.1.7`, doc comment verbatim:

> *"The threshold of lazy chunks required to enable the chunk optimization pass.*
> *Can be configured via the `NG_BUILD_OPTIMIZE_CHUNKS` environment variable.*
> *- `false` or `0` disables the feature.*
> *- `true` or `1` forces the feature on (threshold 0).*
> *- A number sets the specific threshold.*
> *- Default is 3."*

```ts
const optimizeChunksEnv = process.env['NG_BUILD_OPTIMIZE_CHUNKS'];
export const optimizeChunksThreshold = (() => {
  if (optimizeChunksEnv === undefined) { return 3; }
  if (optimizeChunksEnv === 'false' || optimizeChunksEnv === '0') { return Infinity; }
  if (optimizeChunksEnv === 'true' || optimizeChunksEnv === '1') { return 0; }
  const num = Number.parseInt(optimizeChunksEnv, 10);

  return Number.isNaN(num) || num < 0 ? 3 : num;
})();
```

Every branch of that has a consequence people get wrong:

| You set | Threshold becomes | What actually happens |
|---|---|---|
| *(unset)* | `3` | Runs when there are three or more lazy `.js` chunks |
| `0` or `false` | `Infinity` | Never runs — the comparison `count >= Infinity` can never be true |
| `1` or `true` | `0` | **Always** runs, even with zero lazy chunks |
| `2` | `2` | Runs at two or more lazy chunks |
| `5` | `5` | Runs at five or more |
| `-1` | `3` | Negative falls back to the default — not "off" |
| `off`, `no`, `yes` | `3` | `parseInt` returns `NaN`, which falls back to the default — **not "off"** |

🔴 **The mapping is not monotonic and `1` is the trap.** `NG_BUILD_OPTIMIZE_CHUNKS=1` does *not*
mean "threshold 1"; it means *force on*, threshold zero. `2` does mean threshold 2. So going from
`1` to `2` makes the pass run *less* often, not more.

🔴 **`false` is implemented as an unreachable threshold, not a boolean.** There is no "disabled"
flag anywhere in the pass — disabling it means setting a bar the build can never clear. Say it that
way and the behaviour of every other value follows.

⚠️ **`optimizeChunksThreshold` is a module-level `const` computed by an IIFE at import time.** It
reads `process.env` once, when the module is first loaded. Setting the variable from inside a build
script after the CLI process has started does nothing; it has to be in the environment of the `ng`
process itself.

## The third gate is not yours

Gates 1 and 2 are decided by your project: a field of `optimization` and how many lazy chunks your
routes produce. The third — *which* bundler performs the pass — is decided by an environment
variable whose default changed in 22.1.0, and it comes with a Rollup fallback, an optional peer
dependency and one question the sources do not answer. That, the 22.1.0 extension to server builds,
and how to stop two machines disagreeing are
**[04c · The Rolldown switch and the environment](04c-the-rolldown-switch-and-the-environment.md)**.

## Gotchas

**★ Symptom: chunk filenames and chunk counts differ between `ng serve` and `ng build`, and you
suspect a caching bug.** Cause: the generated `development` configuration sets `optimization: false`,
so gate 1 fails and the Rolldown pass is skipped entirely; `ng build` defaults to `production`, where
it runs. Two different bundlers produced the two graphs. Fix: compare like with like by building the
same configuration twice:

```bash
ng build --configuration development
ng build --configuration production
```

**★ Symptom: two similar applications produce structurally different chunk graphs and nothing in
their configuration differs.** Cause: the three-lazy-chunk threshold — one crossed it and the other
did not. Fix: force the pass on for both so the comparison is meaningful, then decide whether the
smaller app wants it permanently:

```bash
NG_BUILD_OPTIMIZE_CHUNKS=1 ng build --configuration production
```

**★ Symptom: you set `NG_BUILD_OPTIMIZE_CHUNKS=false` expecting a boolean and cannot explain the
behaviour you get.** Cause: `false` and `0` are mapped to `Infinity` — an unreachable threshold —
rather than to a disable flag. It does disable the pass, but by making the condition
`lazyChunksCount >= Infinity` permanently false. Fix: use it, but read it as a threshold; `0` says
the same thing with less ambiguity:

```bash
NG_BUILD_OPTIMIZE_CHUNKS=0 ng build --configuration production
```

**★ Symptom: `NG_BUILD_OPTIMIZE_CHUNKS=off` did not disable anything.** Cause: `parseInt('off', 10)`
is `NaN`, and the code returns the **default of 3** for `NaN` — a typo silently means "normal
behaviour", not "off", and nothing warns you. Fix: only `0` and `false` disable it:

```bash
NG_BUILD_OPTIMIZE_CHUNKS=0 ng build
```

**★ Symptom: you set `NG_BUILD_OPTIMIZE_CHUNKS=1` to "lower the threshold to one lazy chunk" and the
pass now runs on every build including ones with no lazy chunks at all.** Cause: `1` and `true` are
the force-on branch, threshold `0`. Fix: if you want a literal threshold of one, there is no way to
express it — `1` is taken. Use `2` for two, and accept that force-on is the nearest thing below it:

```bash
NG_BUILD_OPTIMIZE_CHUNKS=2 ng build --configuration production
```

**Symptom: turning off script optimization to debug a minification problem also changed the chunk
layout.** Cause: gate 1 tests `optimization.scripts` specifically, so switching scripts off removes
the chunk optimizer as well as the minifier — two changes, one flag. Fix: if you only want readable
output, keep the pass in play and use the debugging switch that targets minification instead of
disabling script optimization wholesale:

```bash
NG_BUILD_DEBUG_OPTIMIZE=beautify ng build --configuration production
```

**Symptom: you added lazily-loaded stylesheets and the pass still does not engage.** Cause: the
counter filters on `path.endsWith('.js')`, so only JavaScript outputs count towards the threshold.
Fix: count your lazy `.js` outputs, or stop guessing and force the pass on for a comparison build:

```bash
NG_BUILD_OPTIMIZE_CHUNKS=1 ng build --configuration production
```

## Interview questions

**★ Under exactly what conditions does Angular's chunk optimizer run?**
Three, all of which must hold. `optimization.scripts` must be true for the configuration being
built — not `optimization` generally, the `scripts` sub-field. The build must produce at least
`optimizeChunksThreshold` lazy chunks, where a lazy chunk is an output ending in `.js` that is not
in the initial file set, and the threshold defaults to three. And `useRolldownChunks` decides which
implementation performs it, defaulting to Rolldown since 22.1.0. The reason the first condition
matters more than it looks is that the generated `development` configuration sets
`optimization: false`, so `ng serve` and any development build skip the pass entirely.

**★ Why is the chunk graph you see in `ng serve` not the one you ship?**
Because they were produced by different bundlers. `ng serve` uses the `development` configuration,
which disables optimization, so the output is esbuild's chunking exactly as esbuild produced it. A
production build runs esbuild and then, if there are enough lazy chunks, rebundles the result with
Rolldown and replaces the build result with the rebundled one. Everything measured after that point
— budgets, transfer-size estimates — describes the rebundled graph. So "the lazy chunk boundaries
look fine in dev" is not evidence about production, and neither is a chunk count taken from a
development build.

**★ How do you turn the chunk optimizer off, and why is `NG_BUILD_OPTIMIZE_CHUNKS=false` a strange
answer?**
`NG_BUILD_OPTIMIZE_CHUNKS=0` or `=false` both work, and they work by setting the threshold to
`Infinity` rather than by setting a disable flag — the pass is gated by `lazyChunksCount >= threshold`,
and no build can produce infinitely many lazy chunks. Saying it that way is not pedantry; it is what
makes the rest of the value table predictable. `1` and `true` mean the opposite extreme, threshold
zero, so the pass always runs. Any other numeric value is used literally. And anything unparseable
— `off`, `no`, an empty typo — falls back to the default of three with no warning, which is the
failure mode that actually bites people, because it looks like a disable and behaves like normal.

**★ Why does the builder refuse to run the optimizer on small projects?**
Because the pass is a whole second bundling of the output and its own source says the payoff is
conditional: *"Advanced chunk optimization is most beneficial when there are multiple lazy chunks"*
and *"this avoids overhead for small projects with few chunks."* Three is the default bar. It is a
cost/benefit gate, not a correctness one — you can force it on with `NG_BUILD_OPTIMIZE_CHUNKS=1` and
the build will still be correct, just slower for a benefit the maintainers judged unlikely to
materialise below the threshold.

**How much smaller does the Rolldown pass make a bundle?**
No primary source says. The optimizer's own header claims it *"can result in smaller and more
efficient code"*, and the changelog entry that made it the default is labelled `perf` with no figure
attached. Anyone quoting a percentage is quoting a blog post, not Angular. The measurable answer for
a specific application is a differential build — the same commit built twice with
`--output-hashing none`, once with `NG_BUILD_OPTIMIZE_CHUNKS=0` and once without — and that same
experiment is how you confirm the pass was engaging in the first place.

**How would you establish, for one specific project, whether the optimizer is running?**
Not by inspecting the output, because the optimizer deliberately hands back an esbuild-shaped
metafile and leaves no marker of its own. Work from the gates: check `optimization.scripts` for the
configuration you are building, count the lazy `.js` outputs against the threshold, and check
whether either environment variable is set in the shell or the CI job. Then confirm with the
differential build. If a build with `NG_BUILD_OPTIMIZE_CHUNKS=0` produces byte-identical JavaScript
to one without it, the pass was not running either way.

---

← Prev: [The Rolldown chunk optimizer](04-the-rolldown-chunk-optimizer.md) · Index: [Topic index](README.md) · Next → [The Rolldown switch](04c-the-rolldown-switch-and-the-environment.md)
